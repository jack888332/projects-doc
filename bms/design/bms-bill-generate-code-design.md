# BMS 应收账单生成逻辑设计

> 基于当前代码 `BillGenerateServiceImpl` / `BillGenerateMapper` 梳理。目标是让“默认方案 + 分支方案”生成出来的数据互不重叠，并支持按履约节点、费项规则、附加费增量归集生成账单。

## 1. 当前代码实现概览

当前入口：

- 手动生成：`BillGenerateService.generate(BillGenerateReqDTO)`
- 定时生成：`BillGenerateTask.generateCurrentPeriodBills()`
- 远程接口：`/api/bms/billGenerate/generate`

当前主流程：

1. 根据 `billConfigId` 或 `configNo` 查询 `bill_config`。
2. 解析账期，默认使用当前月第一天到最后一天。
3. 通过 `bill_config_id + startDate + endDate` 判断是否已有账单。
4. 写入 `bill_generate_task`，状态 `RUNNING`。
5. 写入 `ar_bill`，状态 `GENERATED`。
6. 根据 `bill_config.business_type_codes` 查询 `business_type_fee_index + fee_source_rule`。
7. 从 `sale_order_header + sale_order_header_extend` 拉订单宽表数据。
8. 对一条订单宽数据按费项规则拆成多条 `fee_detail`。
9. 根据订单 ID 拉取 `sale_order_additional_matter` 附加费，再写入 `fee_detail`。
10. 汇总 `fee_detail` 金额更新 `ar_bill`。
11. 更新 `bill_generate_task` 为 `SUCCESS`。

这个方向是对的：先拉一条订单宽数据，再按 `fee_index`/规则拆竖表费用，避免“一个费项查一次订单”的低效做法。

## 2. 当前代码需要优化的问题

### 2.1 默认方案和分支方案没有做互斥匹配

当前定时任务会查询所有启用配置：

```sql
FROM bill_config WHERE status = 1 AND is_current_version = 1 AND is_deleted = 0
```

但拉订单时只按：

```text
member_code + shop_id + 账期时间
```

没有按 `bill_config_scope` 的目的国、集运仓过滤，也没有先用分支方案抢占订单，再让默认方案兜底。

风险：

- 默认配置和分支配置可能拉到同一批订单。
- 同一客户不同分支方案之间也可能重叠。
- 会导致同一个订单、同一个费项进入多个账单。

### 2.2 履约节点没有真正按配置选择

此前 SQL 容易写成：

```sql
COALESCE(h.check_time, h.measure_time, h.signed_time)
```

但配置里有 `contract_node`，现在明确为：核重出库只用 `h.measure_time`，签收只用 `h.signed_time`。

- 核重出库：按核重/出库时间进入账期。
- 签收：按签收时间进入账期。

现在没有根据 `contract_node` 切换时间字段。

### 2.2.1 订单/附加费时间字段配置口径

当前代码已支持“按公共配置选择时间字段”，不再要求每个账单配置单独选择，口径如下：

1. 主订单拉取时间字段：
   - 优先从公共配置文件 `bms/disconf/download/bill_generate_conf.properties` 读取：
     - `order.time.field.default`
     - `order.time.field.sign`
   - 支持值：
     - `measure_time`
     - `signed_time`
   - 如果公共配置未配置，则按 `contract_node` 默认：
     - `SIGN/SIGNED` -> `signed_time`
     - 其他 -> `measure_time`

2. 附加费增量拉取时间字段：
   - 统一从公共数据集/公共配置读取 `create_time`，不再按履约节点切换。
   - 公共配置文件 `bms/disconf/download/bill_generate_conf.properties`：
     - `additional.time.field.default`
     - `additional.time.field.sign`
   - 支持值：
     - `create_time`
   - 附加费查询固定追加条件：`sale_order_additional_matter.fee_pay_status = waiting_pay`。

3. 限制：
   - 同一个账单配置命中的附加费规则，当前只支持 `a.create_time` 作为增量时间字段。
   - 如果多个 `sale_order_additional_matter` 规则配置了不同时间字段，生成任务直接报错，避免公共口径不一致。

### 2.3 附加费没有按履约节点和计费状态完整归集

当前附加费只跟随本次订单集合查询：

```text
orderIds -> sale_order_additional_matter
```

问题：

- 首次生成账单时，只按订单 ID 拉附加费，没有明确“符合当前 `contract_node`/账期窗口”的附加费过滤规则。
- `queryAdditionalRows` 没有过滤已归集附加费。
- 账单生成后新增的附加费不会自动进入后续账单。
- 缺少“计费后新增”标识，无法区分普通未计费附加费和已出账订单后续追加的增值服务费。

### 2.4 失败任务记录可能被事务回滚

`generate()` 方法整体加了事务。异常时调用：

```java
finishTask(taskId, "FAILED", ...)
throw ex;
```

因为仍在同一个事务里，最终抛异常会导致前面 `finishTask(FAILED)` 也被回滚。这样失败任务可能看不到。

### 2.5 数据源配置表还没有真正参与运行时查询

设计里已有 `fee_source_datasource`，`fee_source_rule.datasource_code` 也存在，但当前 SQL 硬编码：

```sql
ofp_ofdb1.sale_order_header
ofp_ofdb1.sale_order_header_extend
ofp_ofdb1.sale_order_additional_matter
```

短期能跑，长期不利于通用化。

### 2.6 任务缺少账单配置快照

当前 `bill_generate_task` 只记录 `bill_config_id`。如果后续修改了 `bill_config`，历史任务无法还原当时使用的账单规则。

建议任务表保存：

- `bill_config_snapshot_json`：默认/分支配置完整快照。
- `fee_rule_snapshot_json`：当次命中的业务类型费项规则快照。
- `scope_snapshot_json`：当次使用的目的国/仓库限定范围快照。

生成账单时以任务快照为准，不再受后续配置修改影响。

### 2.6.1 任务缺少源数据查询 SQL 快照

仅有配置快照还不够。排查“为什么这次少拉/多拉了订单、附加费”时，还需要看到任务当时到底执行了什么源 SQL。

建议在 `bill_generate_task` 增加：

- `order_source_sql`：本次主订单宽表查询的实际执行 SQL
- `additional_source_sql`：本次附加费查询的实际执行 SQL

要求：

1. 记录的是“带具体账期、member_code、shop_id、orderIds 的实际 SQL”，不是模板 SQL。
2. `order_source_sql` 在创建任务时即可写入。
3. `additional_source_sql` 在主订单 ID 集合确定后回写。
4. 任务失败时也必须保留这两个字段，便于排查。

### 2.7 幂等粒度还不够完整

当前已有：

- `ar_bill.uk_ar_bill_period(bill_config_id, start, end)`
- `fee_detail.uk_fee_dedupe(dedupe_key)`
- `bill_generate_task.uk_task_idempotent`

但订单归集打标不是强约束，且默认/分支互斥没做，所以仍可能产生跨配置重复归集。

### 2.8 币种换算暂时按 1 处理

当前 `fee_detail.exchange_rate_to_bill`、`exchange_rate_to_fin` 固定写 1。

如果原始费用币种和结算币种不一致，应按 `bill_exchange_rate` 或汇率表换算，否则账单金额不准。来源币种与目标币种相同时直接按汇率 `1` 计算，不记录账单关联汇率。

## 3. 推荐目标流程

账单生成应该拆成三个层次：

1. 配置解析：确定本次要跑哪些配置、每个配置覆盖什么范围。
2. 订单归集：一条订单只归属一个账单配置。
3. 费用生成：订单宽表拆 `fee_detail`，附加费可同步归集，也可增量归集。

推荐总流程：

```text
定时/手动触发
  -> 创建 bill_generate_task(RUNNING)
  -> 获取同一客户 + 同一账期任务锁
  -> 查询账单配置组：默认配置 + 分支配置
  -> 写入 bill_config / scope / fee_rule 快照到 bill_generate_task
  -> 计算账期窗口
  -> 关联查询 sale_order_header + sale_order_header_extend 未计费候选订单宽数据
  -> 同步拉取符合 contract_node/账期窗口且未计费的 sale_order_additional_matter
  -> 按分支配置优先级逐个生成分支账单并打标
  -> 最后执行默认配置，只吃剩余未打标订单
  -> 每条订单按费项规则拆 fee_detail
  -> 同步归集附加费 fee_detail
  -> 汇总 ar_bill 金额
  -> 打来源归集标记
  -> task SUCCESS / FAILED
```

## 4. 默认方案与分支方案互斥设计

### 4.1 配置关系

同一个客户：

- 只能有一个当前启用默认配置：`config_type = DEFAULT`
- 可以有多个分支配置：`config_type = BRANCH`
- 分支配置必须挂到默认配置：`parent_config_id = 默认配置ID`

分支配置通过 `bill_config_scope` 表限定：

- `DEST_COUNTRY`：目的国
- `WAREHOUSE`：集运仓

### 4.2 匹配原则

订单匹配配置时：

1. 先取客户默认配置。
2. 查询该默认配置下启用的所有分支配置，按 `priority ASC, id ASC` 排序。
3. 每条订单先尝试匹配分支：
   - 业务类型命中。
   - 目的国命中分支 scope；如果分支没有配置目的国则视为不限制。
   - 集运仓命中分支 scope；如果分支没有配置集运仓则视为不限制。
4. 第一条命中的分支拿走该订单。
5. 没有命中任何分支的订单进入默认配置；默认配置不按订单类型过滤，作为客户维度兜底方案。

这样可以保证：

- 默认和分支不重叠。
- 分支和分支不重叠。
- 特殊目的国/仓库可以单独出账单。

### 4.3 分支重复限制

保存分支配置时就应该校验：

```text
同一个 parent_config_id 下：
business_type_codes + DEST_COUNTRY 集合 + WAREHOUSE 集合 不能重复或互相包含冲突
```

建议规则：

- 如果两个分支业务类型有交集，并且目的国有交集，并且仓库有交集，则不允许保存。
- 空 scope 代表“不限制”，和任何具体值都有交集，因此分支方案不建议允许空目的国/空仓库同时出现；若允许，则必须作为兜底分支且只能有一个。

### 4.4 同客户同账期执行顺序

同一个客户、同一个账期内，账单生成任务必须按配置组串行执行，不能并发跑多个配置。

推荐锁维度：

```text
sc_id + shop_id + user_id/member_code + bill_period_start + bill_period_end + bill_type
```

执行规则：

1. 一个进程内先用本地锁或任务表唯一键保证同一客户同账期只有一个生成流程在跑。
2. 如果未来多实例部署，需要增加数据库锁或分布式锁，锁 key 使用上述维度。
3. 同一客户同账期先查询默认配置，再查默认配置下所有分支配置。
4. 按 `priority ASC, id ASC` 依次执行分支配置，分支配置每生成成功一张账单，立即对来源订单和附加费打标。
5. 所有分支配置执行完成后，再执行默认配置。
6. 默认配置查询时必须再次按源表打标过滤，只获取未被任何分支配置打标的剩余订单。
7. 如果任一分支配置生成失败，整个客户同账期任务应停止，不能继续执行默认配置，避免默认配置吃到本应归属分支的订单。

这样能保证：

- 分支账单优先占用特殊目的国/仓库订单。
- 默认账单只负责兜底剩余订单。
- 同一订单不会因为并发或执行顺序问题进入多个账单。

## 5. 账期和履约节点设计

### 5.1 账期窗口

按 `bill_config.billing_period_type` 计算：

- `DAY`：当天 00:00:00 到次日 00:00:00
- `WEEK`：自然周或配置周，建议先自然周
- `MONTH`：自然月
- 手动生成时，以前端传入 `periodStartDate/periodEndDate` 为准

### 5.2 履约节点字段

根据 `bill_config.contract_node` 选择订单时间：

| contract_node | 业务含义 | 推荐字段 |
| --- | --- | --- |
| `WEIGHT_OUTBOUND` | 核重出库 | `measure_time` |
| `SIGNED` / `SIGN` | 签收 | `signed_time` |

生成 SQL 不建议继续固定 `COALESCE(check_time, measure_time, signed_time)`，而应该在 Java 侧根据配置决定查询条件。

分支方案的业务场景需要映射到 `sale_order_header.order_type`；默认方案不使用该映射做订单类型限定：

| 账单业务场景 | `sale_order_header.order_type` | OFP枚举含义 |
| --- | --- | --- |
| 同行订单 `PEER` | `YBCK01` | 预报出库单 |
| 集运订单 `CONSOLIDATION` | `YBCK01` | 预报出库单 |
| 电商订单 `ECOMMERCE` | `SO` | 销售订单 |

## 6. 订单拉取设计

### 6.1 候选订单查询

除费用字段外，订单宽表还应同步保留关键重量快照字段，至少包含：

- `total_weight`：源订单总重量
- `warehouse_weight`：仓库核重重量
- `fee_weight`：计费重量
- `throw_weight`：抛重/体积重
- `volume`：体积
- `package_amount`：包裹数
- `actual_total_piece`：实际总件数

这些字段一方面用于账单详情页和导出展示，另一方面用于后续红冲、补录、争议核对时还原“当次出账时看到的重量口径”。

候选订单至少按以下条件过滤：

```text
sc_id
shop_id
member_code / user_id
履约节点时间 >= periodStart
履约节点时间 < periodEnd + 1 day
未作废/未删除/业务状态有效
未被 BMS 成功归集
```

订单查询必须使用 `sale_order_header` 与 `sale_order_header_extend` 的关联查询方式，一次拉出订单基础信息和扩展金额字段：

```sql
SELECT
  h.id,
  h.order_code,
  h.sc_id,
  h.shop_id,
  h.member_code,
  h.country_code,
  h.dest_warehouse_code,
  h.measure_time,
  h.signed_time,
  h.bms_bill_no,
  e.bms_bill_no AS extend_bms_bill_no,
  e.tail_freight_amount,
  e.system_service_amount,
  e.packing_amount
FROM sale_order_header h
LEFT JOIN sale_order_header_extend e ON e.sale_order_id = h.id
WHERE h.sc_id = ?
  AND h.shop_id = ?
  AND h.member_code = ?
  AND <contract_node_time> >= ?
  AND <contract_node_time> < ?
  AND (e.bms_billed_flag = 0 OR e.bms_billed_flag IS NULL)
  AND (e.bms_bill_no IS NULL OR e.bms_bill_no = '')
```

当前 `queryOrderWideRows` 需要补充：

- `sc_id`
- `user_id` 或客户归属字段
- `sale_order_header_extend.bms_billed_flag = 0`
- `sale_order_header_extend.bms_bill_no IS NULL`
- 按 `contract_node` 动态切换时间字段
- 去掉固定 `LIMIT 5000`，改为分页循环拉取

### 6.2 源订单和扩展表打标字段

为了只查询未计入账单的数据，并支持后续附加费增量归集，建议源表增加 BMS 打标字段。

`sale_order_header_extend` 建议字段：

```sql
ALTER TABLE `sale_order_header_extend`
  ADD COLUMN `bms_billed_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已进入BMS账单：0否，1是',
  ADD COLUMN `bms_bill_no` varchar(64) DEFAULT NULL COMMENT 'BMS账单编号';
```

账单生成成功后，需要对 `sale_order_header_extend` 打标。

打标原则：

- 只有成功写入 `ar_bill` 和 `fee_detail` 后才打标。
- 如果一个订单没有任何费用明细，原则上不打标，下次继续扫描；如业务需要跳过无费用订单，应另设跳过原因表，不混用已计费标识。
- 订单重新生成时，先作废旧 `fee_detail`，再清理或更新源表 BMS 标记。
- `sale_order_header_extend.bms_billed_flag / bms_bill_no` 必须和 BMS 账单、费用明细写入处于同一个业务事务边界；只要 `ar_bill`、`fee_detail`、源表打标任一环节失败，本次账单生成必须整体回滚或进入可补偿状态，不能出现“BMS 已有账单但源表未打标”或“源表已打标但 BMS 没有账单”的中间态。

### 6.3 一条订单只查一次

订单宽表一次性查出常用金额字段：

```text
sale_order_header
sale_order_header_extend
```

然后在 Java 内按 `FeeCollectRule.source_amount_column` 拆费用。

这个设计继续保留。

## 7. 费用生成设计

### 7.1 订单费项

对每一条候选订单：

1. 根据订单归属配置取 `business_type_codes`。
2. 查询业务类型关联的 `FeeCollectRule`。
3. 如果 `source_table = sale_order_header`，从订单宽表 `h_字段名` 取金额。
4. 如果 `source_table = sale_order_header_extend`，从订单宽表 `e_字段名` 取金额。
5. 金额为空或 0，不生成 `fee_detail`。
6. 根据 `fee_type` 判断正负：
   - `AR`：正向应收
   - `ARD`：红冲/抵扣，金额进入账单时为负数

### 7.2 附加费

同步归集：

1. 根据订单 ID 查询 `sale_order_additional_matter`。
2. 附加费必须符合当前配置的 `contract_node` 和账期窗口。
3. 过滤未归集附加费。
4. 通过 `fee_item_type` 匹配 `fee_source_rule.filter_params_json`。
5. 写 `fee_detail`。

附加费查询建议：

```sql
SELECT a.*
FROM sale_order_additional_matter a
JOIN sale_order_header h ON h.id = a.sale_order_id
WHERE a.sale_order_id IN (...)
  AND (a.bms_billed_flag = 0 OR a.bms_billed_flag IS NULL)
  AND (a.bms_after_bill_added_flag = 0 OR a.bms_after_bill_added_flag IS NULL)
  AND <additional_contract_node_time> >= ?
  AND <additional_contract_node_time> < ?
```

`additional_contract_node_time` 建议：

- 如果附加费已处理，优先使用 `a.handle_time`。
- 没有处理时间时使用 `a.create_time`。
- 如果 `contract_node = SIGNED/SIGN`，可以结合订单签收时间 `h.signed_time` 判断订单已达到签收节点，再按附加费创建/处理时间归集。

### 7.3 附加费源表打标字段

`sale_order_additional_matter` 建议字段：

```sql
ALTER TABLE `sale_order_additional_matter`
  ADD COLUMN `bms_billed_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已进入BMS账单：0否，1是',
  ADD COLUMN `bms_bill_no` varchar(64) DEFAULT NULL COMMENT 'BMS账单编号',
  ADD COLUMN `bms_after_bill_added_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '计费后新增：0否，1是';
```

`bms_after_bill_added_flag` 的业务含义：

- 仓库系统追加附加费时，如果发现该附加费关联订单已经有 `bms_bill_no`，说明订单主账单已经生成。
- 此时新增附加费应该打 `bms_after_bill_added_flag = 1`。
- BMS 附加费增量任务专门扫描该标识，将这类费用追加进入后续账单。

增量归集：

1. 定时扫描 `bms_after_bill_added_flag = 1` 且 `bms_billed_flag = 0` 的附加费。
2. 找到该订单最近一个可追加的账单。
3. 如果原账单还未复核，可以追加到原账单并重算金额。
4. 如果原账单已复核/已结算，则进入后续账单，或生成一张“附加费增量账单”。
5. 来源附加费表和 BMS 标记表都要记录归集状态。
6. 增量任务的扫描时间建议使用附加费 `create_time` 或 `handle_time`，同时以 `bms_after_bill_added_flag` 为准，避免漏单。
7. 首次账单生成时，`sale_order_additional_matter.bms_billed_flag / bms_bill_no` 必须和对应 `fee_detail` 写入在同一个业务事务边界内完成；附加费写入费用明细成功但源表未打标，或源表打标成功但费用明细回滚，都会导致后续重复计费或漏计，必须通过事务或补偿机制避免。

## 8. 来源归集标记设计

已落地 `bill_source_collect_mark`，不要只依赖源表打标。

作用：

- 记录来源表、来源 ID、账单号。
- 支持幂等重跑。
- 支持审计和问题排查。
- 支持附加费增量归集。
- 支持 BMS 库与订单源库不能同本地事务时的源表打标补偿。

核心唯一键：

```text
source_system + source_table + source_id + collect_type
```

其中：

- 主订单归集：`collect_type = MAIN_ORDER`
- 附加费归集：`collect_type = ADDITIONAL_FEE`
- 附加费增量：`collect_type = ADDITIONAL_INCREMENT`

DDL 文件：

- 初始化库：`docs/sql/bms/init.sql`
- 已有库增量：`docs/sql/bms/bill_source_collect_mark_create.sql`

## 9. 任务状态和事务设计

`bill_generate_task` 要能真实记录失败。建议：

1. 创建任务单独事务提交。
2. 生成账单主流程一个事务。
3. 成功后单独事务更新 `SUCCESS`。
4. 失败后单独事务更新 `FAILED + error_message`。

不要在一个大事务里写 `FAILED` 后再抛异常，否则失败记录会被回滚。

生成账单主流程的事务边界要求：

- 同一张账单内的 `ar_bill`、`fee_detail`、金额汇总、`sale_order_header_extend` 打标、`sale_order_additional_matter` 打标必须作为一个原子动作处理。
- 如果 BMS 库和订单源库不能处在同一个本地事务中，需要采用明确的补偿机制：先写 BMS 归集标记，再打源表标记；打标失败时任务进入 `FAILED/NEED_RETRY`，禁止把账单标记为成功。
- 成功状态只能在所有账单、费用明细、来源打标都完成后更新。
- 重跑任务时，必须以 `sale_order_header_extend.bms_billed_flag/bms_bill_no` 和 `sale_order_additional_matter.bms_billed_flag/bms_bill_no` 为准做幂等过滤。

跨库补偿机制建议：

1. BMS 库事务内先写入 `ar_bill`、`fee_detail`、`bill_source_collect_mark`，此时账单状态保持 `GENERATING` 或任务状态保持 `RUNNING`。
2. BMS 库事务提交后，开始回写订单源库：
   - `sale_order_header_extend.bms_billed_flag = 1`
   - `sale_order_header_extend.bms_bill_no = 当前账单号`
   - `sale_order_additional_matter.bms_billed_flag = 1`
   - `sale_order_additional_matter.bms_bill_no = 当前账单号`
3. 源库打标全部成功后，再单独提交 BMS 状态变更：`ar_bill` 改为可见业务状态，`bill_generate_task` 改为 `SUCCESS`。
4. 源库任意一条打标失败时：
   - `bill_generate_task` 改为 `NEED_RETRY` 或 `FAILED`，并记录失败来源表、来源 ID、异常信息。
   - `ar_bill` 保持 `GENERATING`/`FAILED`，不能进入待复核、待结算、已生成等可操作状态。
   - 后台重试任务按 `bill_source_collect_mark` 找到未完成打标的来源记录，只补打标，不重复生成 `fee_detail`。
5. 如果补偿重试仍失败，需要人工处理入口，处理完成后再把任务置为 `SUCCESS`；不能通过忽略源表打标失败来强制成功。

推荐拆分：

```text
BillGenerateService.generate()
  -> createTask(REQUIRES_NEW)
  -> try doGenerateInTx()
       -> finishTaskSuccess(REQUIRES_NEW)
    catch
       -> finishTaskFailed(REQUIRES_NEW)
       -> throw
```

### 9.1 任务配置快照

`bill_generate_task` 应记录当次执行使用的配置快照，避免后续修改 `bill_config` 后无法追溯历史任务。

建议字段：

```sql
ALTER TABLE `bill_generate_task`
  ADD COLUMN `bill_config_snapshot_json` json COMMENT '账单配置快照JSON',
  ADD COLUMN `bill_scope_snapshot_json` json COMMENT '账单配置范围快照JSON',
  ADD COLUMN `fee_rule_snapshot_json` json COMMENT '费项规则快照JSON';
```

快照内容建议：

- `bill_config` 当前行完整字段。
- 默认配置下所有分支配置。
- 每个配置的 `bill_config_scope`。
- 本次命中的 `business_type_fee_index`。
- 本次命中的 `fee_source_rule`。

执行原则：

1. 创建任务时先读取配置并组装快照。
2. 任务后续执行全部使用快照对象，不再反查当前 `bill_config`。
3. `ar_bill.bill_config_id` 仍保存配置 ID，用于关联，但历史判断以快照为准。

## 10. 幂等设计

### 10.1 账单幂等

账单唯一：

```text
bill_config_id + billing_period_start_date + billing_period_end_date
```

这个当前已有，可以保留。

### 10.2 费用幂等

费用唯一：

```text
source_system + source_table + source_id + fee_code + bill_config_id
```

当前 `dedupe_key` 接近这个设计，可以保留，但建议把 `source_amount_column` 或 `business_type_fee_id` 也加进去，避免同一个源 ID 上不同规则但同 fee_code 冲突。

推荐：

```text
source_system:source_table:source_id:business_type_fee_id:bill_config_id
```

### 10.3 订单归属幂等

同一业务订单在同一账期只能归属一个账单配置。

建议增加归属标记：

```text
source_order_id + billing_period_start + billing_period_end
```

用于限制默认/分支重复拉取。

## 11. 汇率设计

生成 `fee_detail` 时要区分：

- `fee_currency`：来源费用币种。
- `bill_currency`：结算币种。
- `fin_currency`：财务本位币。

如果三者不同：

1. 查询汇率。
2. 写入 `exchange_rate_to_bill` / `exchange_rate_to_fin`。
3. 保存换算后的 `amount_bill_currency` / `amount_fin_currency`。

短期没有汇率时，可以限制只有币种相同才允许生成，避免金额错误。

## 12. 推荐代码改造步骤

### 第一阶段：修正生成正确性

1. `queryOrderWideRows` 改成 `sale_order_header + sale_order_header_extend` 关联查询，并增加 `sc_id`、履约节点动态字段、未计费过滤。
2. 增加配置组生成逻辑：同一默认配置下先分支、后默认。
3. 使用 `bill_config_scope` 做目的国和仓库匹配。
4. 修复失败任务回滚问题。
5. 附加费查询增加未计费过滤，并且按 `contract_node`/账期窗口查询。
6. 给 `sale_order_header_extend` 增加计费标识和账单编号字段。
7. 给 `sale_order_additional_matter` 增加计费标识、账单编号、计费后新增标识。
8. `bill_generate_task` 增加 `bill_config`/scope/fee rule JSON 快照。
9. `markAdditional` 只回写附加费来源单据的 `bms_billed_flag / bms_bill_no`，费用明细关系以 `fee_detail` 为准。

### 第二阶段：补齐增量和审计

1. 新增并落地 `bill_source_collect_mark`。
2. 增加附加费增量定时任务。
3. 支持订单手动重新生成时先作废旧 `fee_detail`，再按幂等键重建。
4. 任务列表展示 `pulled/matched/skipped/failed/fee_detail/additional_fee`。

### 第三阶段：通用化数据源

1. 让 `fee_source_datasource` 参与运行时连接管理。
2. `fee_source_rule` 只表达来源表、字段、过滤条件，不在代码里硬编码所有来源 SQL。
3. 对不同业务类型扩展独立数据适配器：
   - `CONSOLIDATION`
   - `PEER`
   - `ECOMMERCE`

## 13. 建议最终类结构

```text
BillGenerateService
  - 手动/定时入口

BillGenerateTaskService
  - createTask
  - finishSuccess
  - finishFailed

BillPeriodResolver
  - 按账期类型计算 start/end

BillConfigMatcher
  - 默认/分支互斥匹配
  - 默认方案和分支方案都独立保存账单发出时间，生成账单时使用命中的配置计算 bill_send_date

OrderSourceReader
  - 按履约节点分页读取订单宽数据

FeeRuleMatcher
  - 业务类型 -> 费项规则
  - 一条订单宽表 -> 多条 fee_detail

AdditionalFeeCollector
  - 同步附加费归集
  - 增量附加费归集

BillAmountAggregator
  - 汇总 fee_detail
  - 更新 ar_bill

BillSourceMarkService
  - 来源归集标记
  - 源表打标
```

## 14. 应收账单按【业务板块+目的国】拆单与编号生成

基于当前 BillGenerateServiceImpl 的改造点：

1. 拆单分组键 BillGroupKey = (business_sector, destination_country)，缺一不可。
2. 账单编号由 buildArBillNo 统一生成，格式：ARB-{customerNo|fallback memberCode}-{yyyyMMdd}-{md5(sector+country)前4位}。
3. 同一 bill_config、同一账期内，按分组键分桶后逐桶生成 ar_bill，互不干扰。
4. ar_bill 唯一键调整为 (bill_config_id, billing_period_start_date, billing_period_end_date, business_sector, destination_country)。
5. BillGenerateServiceImpl.executeTaskInternal 在拉取订单后、创建账单前增加分组步骤；后续 executeBillGroup 按组执行原有的 buildBill -> insertBill -> 订单快照 -> fee_detail -> 来源打标 -> 币种汇总 -> 状态 流程。
6. 手动生成同一 bill_config、同一账期时，如果 `uk_task_period` 已存在历史任务且当前没有 PENDING/RUNNING/NEED_RETRY 活动任务，则复用该任务行并重置为 PENDING；executeBillGroup 先按分组唯一键查已有 ar_bill，找不到再按同配置、同账期、同 bill_no 兜底查历史账单。命中 DRAFT/GENERATED 账单时追加未打标源数据并重算金额；命中已核销或待结清/已结清账单时拒绝增量同步。

## 16. 推荐生成伪代码

```java
public BillGenerateRespDTO generate(req) {
    Task task = taskService.createRunningTask(req); // REQUIRES_NEW
    try {
        GenerateContext ctx = contextBuilder.build(req, task);
        List<OrderWideRow> candidates = orderReader.pageQuery(ctx);
        Map<BillConfig, List<OrderWideRow>> grouped = configMatcher.groupByConfig(ctx.configGroup, candidates);

        for (Map.Entry<BillConfig, List<OrderWideRow>> entry : grouped.entrySet()) {
            BillConfig config = entry.getKey();
            List<OrderWideRow> orders = entry.getValue();
            ArBill bill = billWriter.createBill(config, ctx.period, task);
            List<FeeDetail> feeDetails = feeCollector.collectOrderFees(config, bill, orders);
            feeDetails.addAll(additionalCollector.collectSync(config, bill, orders));
            sourceMarkService.markCollected(bill, orders, feeDetails);
            amountAggregator.refreshBillAmount(bill);
        }

        taskService.finishSuccess(task); // REQUIRES_NEW
        return resp;
    } catch (Exception ex) {
        taskService.finishFailed(task, ex); // REQUIRES_NEW
        throw ex;
    }
}
```

## 17. 结论

当前代码已经具备“按账单配置生成账单、按规则拆费用竖表、写任务记录”的基础，但还需要重点补齐：

1. 默认/分支互斥归属。
2. 按履约节点动态取时间。
3. 附加费增量归集。
4. 失败任务不被事务回滚。
5. 来源归集标记和幂等闭环。
6. 汇率换算。

这几个点做好后，账单生成逻辑才可以支撑多供应链、多店铺、多客户、多业务类型的稳定出账。

## 18. 优化记录跟踪表

> 状态说明：未开始、部分落地、已落地待验证、已完成、暂缓。

| 序号 | 优化项 | 当前状态 | 问题说明 | 建议处理方式 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| 1 | 默认方案/分支方案互斥归属 | 已落地待验证 | 生成任务已归并到默认配置维度执行，并按“分支优先、默认兜底”分配订单；仍需联调验证源库订单字段和分支 scope 编码完全一致。 | 生成任务按客户、账期加载默认配置及其分支配置，先按 `priority ASC, id ASC` 匹配分支，再由默认配置兜底。 | P0 |
| 2 | 同客户同账期串行锁 | 已落地待验证 | 创建任务时已按 `sc_id + shop_id + user_id + member_code + bill_period_start + bill_period_end` 拦截活动任务，执行领取时同维度只允许一个任务进入 `RUNNING`；当前实现比原建议更严格，未再细分 `bill_type`。 | 联调验证多任务并发领取场景；如后续确认同客户同账期允许不同 `bill_type` 并行，再把锁维度补回 `bill_type`。 | P0 |
| 3 | 失败任务状态独立提交 | 未完成 | `executeTask` 仍在事务内更新 `FAILED` 后抛异常，失败状态可能随主事务回滚。 | 拆出 `BillGenerateTaskService`，`createTask`、`finishSuccess`、`finishFailed` 使用 `REQUIRES_NEW`。 | P0 |
| 4 | 跨库源表打标补偿 | 已落地待验证 | 源表打标已接入 `PENDING -> MARKED/FAILED` 独立事务归集标记，源库 UPDATE 失败或影响 0 行时记录 `FAILED` 并中断生成；后续仍需补充只补打标的重试入口。 | 基于 `bill_source_collect_mark` 的 `FAILED` 记录做补偿重试，只补源表打标，不重复生成费用明细。 | P0 |
| 5 | 任务配置快照按快照执行 | 已落地待验证 | 新任务已写入默认配置、分支配置、scope、按配置分组的费项规则快照；执行任务时优先反序列化快照作为规则来源，老任务或快照解析失败时才回退当前配置。 | 联调验证修改 `bill_config` / `bill_config_scope` / 费项规则后，历史待执行任务仍按创建任务时的快照执行。 | P0 |
| 6 | 来源 SQL 快照准确性 | 已落地待验证 | 主订单/理赔 SQL 已按默认+分支配置组分段记录，附加费 SQL 已在实际订单 ID 集合确定后追加回写；分页 SQL 记录首个 offset，并在注释中保留 windowDays/pageSize/offset 递增口径。 | 联调验证任务详情中 `order_source_sql` / `additional_source_sql` 能覆盖默认、分支、附加费和理赔来源排查。 | P1 |
| 7 | 附加费增量归集 | 未开始 | 当前同步附加费查询排除了 `bms_after_bill_added_flag = 1`，但未看到独立增量任务处理这类费用。 | 新增附加费增量任务，扫描 `bms_after_bill_added_flag = 1 AND bms_billed_flag = 0`，按原账单状态决定追加原账单或进入后续账单。 | P0 |
| 8 | 附加费时间字段口径统一 | 部分落地 | 文档中同时出现“固定 `create_time`”和“优先 `handle_time`，否则 `create_time`”两种口径。 | 明确一期只支持 `create_time`，或正式支持 `handle_time/create_time` 优先级，并同步公共配置和规则校验。 | P1 |
| 9 | 数据源配置运行时生效 | 部分落地 | `fee_source_rule.datasource_code` 已查询，但运行时仍固定从 Disconf `DS_ds0_conf.properties` 推导 OFP 源库连接。 | 让 `fee_source_datasource` 参与连接解析，按 `datasource_code` 选择数据源，避免代码硬编码源库。 | P1 |
| 10 | 复杂 SQL 迁移到 XML | 未开始 | `BillGenerateMapper` 仍存在 `@SelectProvider` 和 Provider 拼 SQL，不符合 BMS Mapper 规范。 | 将复杂查询迁移到 `sqlmap/BillGenerateMapper.xml`，使用 `<sql>`、`<include>`、`<if>` 和显式 `resultMap`。 | P1 |
| 11 | 业务数据载体去 Map 化 | 未开始 | 订单宽表、附加费、理赔、任务构建等大量使用 `Map<String, Object>`，字段可读性和编译期校验不足。 | 新增明确 DTO/Row 类，如 `OrderWideRowDTO`、`AdditionalFeeSourceRowDTO`、`ClaimSourceRowDTO`。 | P1 |
| 12 | 源订单数据隔离条件收紧 | 待确认 | 源订单查询使用 `(h.sc_id = ? OR h.sc_id IS NULL)`，可能放宽供应链隔离。 | 确认历史源数据是否存在 `sc_id IS NULL`；若无业务必要，改为严格 `h.sc_id = ?`。 | P0 |
| 13 | 源表打标影响行数校验 | 未开始 | 源库 UPDATE 可能影响 0 行，例如缺少 `sale_order_header_extend` 记录，但当前打标结果未强校验。 | `executeSourceUpdate` 返回影响行数；影响 0 行时标记失败并进入补偿或人工处理。 | P0 |
| 14 | 无费用订单处理规则 | 待确认 | 文档要求无费用订单原则上不打标，但需要确认代码是否严格遵守，以及是否需要跳过原因记录。 | 明确无费用订单是否跳过、下次继续扫描，或新增跳过原因表。 | P1 |
| 15 | 账单唯一键初始化脚本一致性 | 未完成 | 增量脚本已调整为按 `business_sector + destination_country` 唯一，但 `init.sql` 仍保留旧唯一键。 | 同步更新 `aidocs/bms/sql/bms/init.sql`，避免新库和老库结构不一致。 | P0 |
| 16 | 订单归属幂等约束 | 部分落地 | 已有源表打标和归集标记，但缺少按 `source_order_id + billing_period_start + billing_period_end` 的归属唯一约束。 | 在 `bill_source_collect_mark` 或独立归属表增加账期维度唯一约束，限制同一订单同账期跨配置重复归集。 | P0 |
| 17 | 费用幂等键粒度 | 部分落地 | 当前 `dedupe_key` 接近可用，但需要确保包含 `business_type_fee_id`，避免同源 ID 同 fee_code 多规则冲突。 | 统一费用幂等键为 `source_system:source_table:source_id:business_type_fee_id:bill_config_id`。 | P1 |
| 18 | 汇率生成兜底策略 | 部分落地 | 已有汇率表和费用明细汇率字段，但仍需确认无汇率时是否允许不同币种出账。 | 币种不一致且无有效汇率时阻断生成；币种一致时汇率按 1，不重复记录无意义汇率。 | P0 |
| 19 | `fee_source_datasource` 与数据集规则审计 | 部分落地 | 费项规则已关联数据集，但运行时策略、字段白名单、窗口大小不一致时的异常提示还需要强化。 | 按数据集维度校验来源表、时间字段、分页窗口、金额字段白名单，配置错误提前失败。 | P1 |
| 20 | 任务监控可观测性 | 部分落地 | 任务已有部分统计字段，但排障还需要展示来源 SQL、快照、失败来源表/ID、补偿状态。 | 任务详情页增加配置快照、来源 SQL、归集标记明细、失败原因和重试入口。 | P1 |
| 21 | 文档状态化维护 | 未开始 | 当前文档混合了已落地设计、待办、长期规划，读者难判断真实状态。 | 后续每次改造同步更新本表状态、代码文件、SQL 脚本和验证结果。 | P2 |
