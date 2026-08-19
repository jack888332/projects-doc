# BMS 账单生成任务当前实现说明

## 1. 文档目的

本文基于当前仓库中的最新 BMS 代码，梳理账单生成任务的真实运行链路、任务快照机制、源表打标补偿方式，以及源数据新增或修改后当前系统如何补充到账单。

参考文档：

1. `aidocs/product-caliber/bms/prd/bms-bill-generation-design.md`
2. `aidocs/product-caliber/bms/prd/账单生成机制.PRD.md`
3. `aidocs/technical-caliber/bms/dev-specs/fee_detail-schema-baseline.md`
4. `aidocs/technical-caliber/sql/ar_bill.sql`

本文重点区分：

1. 当前代码已经实现的行为。
2. 设计文档或目标模型中提出、但当前代码尚未完全落地的行为。

## 2. 范围与核心结论

### 2.1 当前代码范围

最新代码中，`BillGenerateServiceImpl` 已经成为统一任务入口，会先根据 `billType` 分流：

```text
MEMBER_AR
  -> 会员应收账单生成链路

COD_REFUND
  -> COD 返款账单生成链路
```

本文主分析对象仍然是当前最成熟、也是“源数据变更补账”问题最核心的 `MEMBER_AR` 链路；但当前代码中 `COD_REFUND` 已经补上两条和应收链路直接相关的规则：

1. `代收货款` 作为返款本金判断项，金额必须大于 `0`，否则本期不再拉取其他返款扣减费项。
2. 其他返款扣减费项按本期返款账单 `startDate` 往前回看一个同长度周期进行关联。
3. `MEMBER_AR` 在完成本期正常计费扫描后，还会反扫 `fee_detail`，把已被 `COD_REFUND` 占用的返款扣减费项做 `related_*` 弱关联，避免重复计费。

### 2.2 MEMBER_AR 当前主模式

当前会员应收账单生成仍采用“直接拉源表 + BMS 内部落账 + 回写源表标记”的模式：

```text
OFP 源表
  -> 账单生成任务直接查询未归集订单/附加费/理赔
  -> 写入 ar_bill、main_order、fee_detail
  -> 写入 bill_source_collect_mark
  -> 回写源表 bms_billed_flag、bms_bill_no
```

### 2.3 当前已经支持

1. 首次生成账单。
2. 同账期漏跑订单的再次补采集。
3. 出账后新增附加费的增量归集。
4. 对 `DRAFT`、`GENERATED` 且未发生核销的账单做增量追加。
5. 对整张可修改账单执行“作废旧账单 + 回退源表标记 + 异步重跑任务”。
6. 在 `bill_generate_task` 中保存配置快照、范围快照、费项规则快照和实际源 SQL 快照。
7. 在 `bill_source_collect_mark` 中记录 `PENDING -> MARKED / FAILED` 的跨库打标轨迹。
8. 通过任务监控入口创建 `RETRY` 触发的重试任务。
9. 支持 `非费项` 类型：来源被拉取后写 `bms_billed_flag = 1` 和 `NON_FEE_FETCH` 轨迹，但不写 `fee_detail`、不关联应收账单，也不进入账单汇总和核销金额。

### 2.4 当前尚未支持

1. 自动识别“已经归集过、后来又被上游修改”的来源数据。
2. 基于 `source_row_hash` 自动生成新的来源费用版本。
3. 使用 `bill_fee_detail_relation` 将“来源费用”和“账单挂账关系”彻底拆开。
4. 已复核或已结清账单在来源变化后自动进入标准化后续调整链路。
5. 只针对 `bill_source_collect_mark = FAILED` 做独立补打标而不重走整条生成链路。

因此，当前代码中的真实结论是：

> 未归集的新数据可以通过再次运行生成任务补进账单；已经归集的数据发生修改后，普通生成任务不会自动补差。

## 3. 当前任务入口

### 3.1 Job 与本地配置现状

任务入口分为两个 ElasticJob：

1. `BillGeneratePlanJob`
2. `BillGenerateTaskExecuteJob`

当前仓库本地 Disconf 缓存文件 `bms/disconf/download/elastic_job_main_config.properties` 中记录的配置为：

```text
enabled=false
job.names=billGeneratePlanJob,billGenerateTaskExecuteJob
job.crons=0 0 2 * * ?,0 0/1 * * * ?
```

这表示本地缓存中的计划配置是：

1. `billGeneratePlanJob` 每天 `02:00` 运行一次。
2. `billGenerateTaskExecuteJob` 每分钟运行一次。

但是否真正启用，最终仍以部署环境下生效的 Disconf 配置为准，不能只看仓库缓存文件。

### 3.2 计划任务

计划任务类：

```text
bms/biz/src/main/java/com/szt/supplychain/bms/biz/task/BillGeneratePlanJob.java
```

职责：

1. 调用 `BillGenerateService.enqueueCurrentPeriodForEnabledConfigs()`。
2. 为启用中的 `MEMBER_AR` 默认配置创建本期 `PENDING` 任务。
3. 为启用中的 `COD_REFUND` 配置创建本期 `PENDING` 任务。
4. 只创建任务，不直接执行账单生成。

### 3.3 执行任务

执行任务类：

```text
bms/biz/src/main/java/com/szt/supplychain/bms/biz/task/BillGenerateTaskExecuteJob.java
```

职责：

1. 按分片扫描 `PENDING`、`NEED_RETRY` 状态任务。
2. 调用 `BillGenerateService.executePendingTasks(shardingItem, shardingTotal)`。
3. 由 `executeTask()` 按 `billType` 分流到 `MEMBER_AR` 或 `COD_REFUND` 执行逻辑。

补充说明：

1. 当前仓库中的 `bill_generate_conf.properties` 配置 `task.scan.limit=10`。
2. 因此单次执行 Job 默认最多扫描 10 条待执行任务。

### 3.4 返款账单手工生成账期选择

返款账单配置页的“生成账单”入口与应收账单保持同一交互：先选择月份，再从该月份的标准账期列表中选择具体账期。

返款标准账期按配置计算：

1. `WEEK`：每周账期以周一为周锚点，起始日取 `billing_period_start_days` 的第一个值；未配置时默认周一。
2. `HALF_WEEK`：`billing_period_start_days` 配置每周两个起始日，例如 `2,5` 表示周二至周四、周五至次周一两个账期。
3. 手工生成提交的 `periodStartDate`、`periodEndDate` 会与配置解析出的标准账期校验；`RETRY`、`REGENERATE` 不参与该校验。
4. 调度任务对尚未生效的返款配置跳过任务创建，与应收账单调度行为保持一致。

该规则只影响后续新建的生成任务，历史已生成的返款账单及其账期不会被改写。

## 4. MEMBER_AR 任务运行流程

当前主实现位于：

```text
bms/biz/src/main/java/com/szt/supplychain/bms/biz/service/impl/BillGenerateServiceImpl.java
```

### 4.1 创建任务

会员应收生成入口：

```text
generate(BillGenerateReqDTO)
  -> resolveRequestedBillType()
  -> createTask(BillGenerateReqDTO)
```

`createTask()` 的核心行为：

1. 查询账单配置。
2. 如果传入的是分支配置，内部会通过 `requireDefaultConfig()` 折算为其挂靠的默认配置。
3. 校验请求 `scId` 与配置归属一致。
4. 计算账期开始、结束日期。
5. 校验同客户、同账期、同 `billType` 是否已有活动任务。
6. 查询费项规则、币种规则、模板币种规则。
7. 构建任务快照。
8. 新增任务，或复用同配置同账期同触发方式的历史任务行并重置为 `PENDING`。

同一客户、同一账期的活动任务判断维度为：

```text
sc_id
+ shop_id
+ user_id
+ member_code
+ bill_type
+ billing_period_start_date
+ billing_period_end_date
```

任务复用补充说明：

1. `bill_generate_task` 的周期唯一键是 `bill_config_id + bill_type + billing_period_start_date + billing_period_end_date + trigger_type`。
2. 当前任务行只有在旧状态不属于 `PENDING / RUNNING / NEED_RETRY` 时才允许被重置复用。
3. 重置时会刷新任务编号、幂等键、快照、统计字段和错误信息。

### 4.2 任务快照与 SQL 快照

当前代码不再只记录“配置 ID”，还会把本次生成使用的关键口径直接写进 `bill_generate_task`：

1. `bill_config_snapshot_json`
2. `bill_scope_snapshot_json`
3. `fee_rule_snapshot_json`
4. `order_source_sql`
5. `additional_source_sql`

其中：

1. `order_source_sql` 保存主订单宽表查询快照。
2. `additional_source_sql` 初始会保存理赔来源 SQL 快照。
3. 增量附加费来源 SQL 会在执行时继续追加到 `additional_source_sql`。

### 4.3 领取任务

`executeTask()` 只允许执行以下状态：

```text
PENDING
NEED_RETRY
```

领取成功后，当前任务会被原子更新为：

```text
RUNNING
```

需要特别注意：

1. `claimTask()` 的 SQL 只负责把“当前这条任务”从 `PENDING/NEED_RETRY` 改成 `RUNNING`。
2. 代码并没有在领取 SQL 层再次按“同客户同账期”做排他判断。
3. 同客户同账期的并发限制，主要是在创建任务阶段通过 `queryActiveCustomerPeriodTaskId()` 控住。

### 4.4 查询订单候选集合

主订单来源仍是 OFP 宽表：

```text
sale_order_header h
LEFT JOIN sale_order_header_extend e
```

主过滤条件：

1. `member_code`、`shop_id`、`sc_id` 匹配。
2. 根据配置或业务类型限制 `order_type`。
3. 履约节点时间在当前账期内。
4. 订单尚未被 BMS 归集。

未归集判断条件：

```sql
COALESCE(e.bms_billed_flag, 0) = 0
AND (e.bms_bill_no IS NULL OR e.bms_bill_no = '')
```

时间字段口径补充：

1. 主订单时间字段通过 `bill_generate_conf.properties` 和费项规则共同决定。
2. 当前支持的订单时间字段为 `delivery_time`、`measure_time`、`check_time`、`signed_time`。
3. 仓库默认配置中，出库节点默认走 `delivery_time`，签收节点默认走 `signed_time`。

分页扫描补充：

1. 源数据按“时间窗口 + 分页”方式拉取。
2. 默认窗口天数为 `1` 天，默认页大小为 `500`。
3. 如果费项规则配置了 `queryWindowDays` / `queryPageSize`，则使用规则值。
4. 同类来源规则如果配置出不同窗口或分页参数，代码会直接抛异常，不允许混用。

### 4.5 默认配置和分支配置归属

订单归属规则仍然是：

```text
分支配置优先
  -> 默认配置兜底
```

当前实现细节：

1. 分支配置仅处理启用状态的分支方案。
2. 分支范围当前按目的国、仓库编码匹配。
3. 已被分支命中的订单不会再进入默认配置。
4. 默认配置接收剩余未命中的订单。
5. 同一订单在一次任务中只会进入一个配置组。

### 4.6 按业务板块和目的国拆账单

订单进入具体配置后，会继续按以下维度拆成账单分组：

```text
business_sector
+ destination_country
```

如果任一分组维度缺失，代码会直接抛异常，防止把数据落到错误账单。

### 4.7 创建或匹配账单

每个分组进入 `executeBillGroup()`。

匹配已有账单的核心维度：

```text
bill_config_id
+ billing_period_start_date
+ billing_period_end_date
+ business_sector
+ destination_country
```

处理规则：

1. 没有已有账单时，新建 `ar_bill`。
2. 有已有账单且状态为 `DRAFT / GENERATED`，并且 `paid_amount = 0` 时，允许继续追加。
3. 如果已有账单已发生部分核销，或者状态已进入 `PENDING_SETTLEMENT / PAID / VOID` 等不可追加状态，则拒绝追加。

### 4.8 单个账单分组的写入顺序

`executeBillGroup()` 的当前真实顺序更接近：

```text
创建或匹配 ar_bill
  -> 写 main_order 订单快照
  -> 按订单宽表拆主费用 fee_detail
  -> 查询并写普通附加费 fee_detail
  -> 为附加费写来源轨迹并回写源表
  -> 为产生费用的主订单写来源轨迹并回写源表
  -> 查询并写理赔 fee_detail
  -> 为理赔写来源轨迹并回写源表
  -> 重建 ar_bill_currency_summary
  -> 刷新 ar_bill 金额
  -> 更新 ar_bill.bill_status = GENERATED
```

补充说明：

1. `main_order` 使用 `ON DUPLICATE KEY UPDATE`，因此同一业务订单再次归集时会刷新快照字段。
2. `fee_detail` 使用 `INSERT IGNORE`，幂等依赖 `dedupe_key` 等唯一约束。
3. 只有金额非空且不为 0 的费项才会生成费用明细。
4. `fee_type = NON_FEE` 只参与来源扫描和抓取留痕，不写入应收账单 `fee_detail`；来源写 `bms_billed_flag = 1`，未进入账单时 `bms_bill_no` 保持为空。
5. 只有非费项规则时，任务会完成来源抓取标记，但不会创建空应收账单。

### 4.9 普通附加费与理赔的当前过滤条件

普通附加费当前核心条件：

```text
fee_amount 非空且不为 0
fee_pay_status in (waiting_pay, waiting_settlement)
bms_billed_flag = 0
bms_after_bill_added_flag = 0
```

归集自 `sale_order_additional_matter` 的费项默认挂靠 `LAST_PACKAGE`（尾程包裹）；费项主档明确配置为非历史默认值 `ORDER` 的其他挂靠对象时，以主档配置为准。

理赔当前核心条件：

```text
customer_service_audit_status = 2
finance_audit_status = 2
payment_status = 1
update_time 在账期内
bms_billed_flag = 0
bms_bill_no 为空
```

### 4.10 来源打标与跨库补偿

当前来源打标涉及的主要表：

1. `sale_order_header_extend`
2. `sale_order_additional_matter`
3. `claim_order`

当前做法不是“只改源表”，而是两段式：

```text
先写 bill_source_collect_mark = PENDING
  -> 再更新源表 bms_billed_flag / bms_bill_no
  -> 成功后把轨迹改成 MARKED
  -> 失败则把轨迹改成 FAILED 并记录错误
```

实现特点：

1. 轨迹写入和状态更新使用 `REQUIRES_NEW` 事务。
2. 源表更新使用独立 JDBC 连接直接访问 OFP。
3. `bill_source_collect_mark` 当前唯一维度已包含 `bill_type`。
4. 正常打标状态流转是 `PENDING -> MARKED / FAILED`。
5. 账单重跑时，旧轨迹还会被额外更新为 `REGENERATED`。

### 4.11 任务完成

任务执行成功后会更新：

1. `pulled_order_count`
2. `matched_order_count`
3. `skipped_order_count`
4. `fee_detail_count`
5. `additional_fee_count`
6. `receivable_amount`
7. `task_status = SUCCESS`

如果主订单和增量附加费都没有命中数据，任务也会直接记为 `SUCCESS`，只是不会生成账单。

发生运行时异常时，任务状态更新为：

```text
FAILED
```

任务执行使用程序化事务包裹，避免定时扫描在同一个 Service 内调用 `executeTask()` 时绕过 Spring 事务代理。生成异常时先回滚本次 BMS 账单、订单、费用和汇总写入，再通过独立事务持久化任务 `FAILED` 状态。

如果历史失败任务已经遗留 `GENERATING` 应收账单，重试只在以下条件同时满足时自动恢复：

1. 账单未发生核销。
2. 账单关联任务 ID 与当前重试任务 ID 一致。
3. 先回退来源标记并清理费用明细、币种汇总、账单汇率和主订单账单关联，再复用原账单重建。

`GENERATING` 不属于普通增量追加状态，不能未经清理直接追加，避免半成品数据重复入账。

残留恢复发生在来源数据扫描之前，保证首次失败后已经写入的来源标记先被回退，重试任务能够重新命中完整来源数据；账单分组落库前仍会再次执行幂等清理校验。

## 5. 新增订单如何补充到账单

适用前提：

```text
bms_billed_flag = 0
bms_bill_no 为空
履约节点时间仍落在原账期
```

当前补充方式：

1. 再次触发同配置、同账期生成任务。
2. 任务会重新扫描这批“仍未归集”的订单。
3. 若命中同一 `bill_config_id + 账期 + business_sector + destination_country` 的已有账单，则尝试追加。
4. 账单必须同时满足 `bill_status in (DRAFT, GENERATED)` 且 `paid_amount = 0`。
5. 追加后重建币种汇总并刷新账单金额。

## 6. 新增附加费如何补充到账单

### 6.1 普通附加费

普通附加费是在主订单分组生成时顺带查询的，不是单独任务。

主要条件：

```text
bms_billed_flag = 0
bms_after_bill_added_flag = 0
fee_amount 非空且不为 0
fee_pay_status in (waiting_pay, waiting_settlement)
```

### 6.2 出账后新增附加费

出账后新增附加费走独立的“增量附加费”链路，核心条件为：

```text
bms_after_bill_added_flag = 1
bms_billed_flag = 0
bms_bill_no 为空
fee_amount 非空且不为 0
fee_pay_status in (waiting_pay, waiting_settlement)
```

来源轨迹中的 `collect_type` 记录为：

```text
ADDITIONAL_INCREMENT
```

处理策略：

1. 先查原账期对应账单。
2. 原账期账单可追加时，直接追加到原账单。
3. 原账期账单不可追加时，查询同配置、同业务板块、同目的国的最近一张可追加账单。
4. 仍找不到可追加账单时，任务失败。
5. 成功后重建汇总并刷新目标账单金额。

## 7. 已归集源数据发生修改时的当前行为

### 7.1 普通任务不会自动识别“已归集后又修改”

当前主查询只扫描未归集数据：

```text
bms_billed_flag = 0
bms_bill_no 为空
```

所以只要一条订单、附加费或理赔曾经被成功归集并打标为已出账，哪怕上游后来把金额改了，普通生成任务也不会再次命中它。

### 7.2 当前整张账单重跑入口

整张账单重跑入口：

```text
POST /api/bms/billGenerate/regenerate
  -> BillGenerateController.regenerate()
  -> BillGenerateServiceImpl.regenerate()
```

请求参数核心字段：

```text
scId
billNo
reason
operator
```

### 7.3 重跑前置校验

当前代码会校验：

1. `billNo` 不能为空。
2. 原账单必须存在。
3. 请求 `scId` 必须与账单归属一致。
4. 账单不能已发生部分核销。
5. 账单状态不能是已结清态，代码里按 `PAID / SETTLED` 保护。
6. 账单必须有 `bill_config_id`。
7. 账单状态必须属于 `DRAFT / GENERATED`。

实际业务含义仍是：

```text
只允许对“起草中 / 待复核，且未核销”的账单重跑
```

### 7.4 重跑不是原账单就地重算

当前 `regenerate()` 不是“在原账单上重算”，而是：

```text
查询原账单已 MARKED 的来源轨迹
  -> 回退原账单关联源表打标
  -> 作废原 fee_detail
  -> 删除原 ar_bill_currency_summary
  -> 清空 main_order 的账单关联字段
  -> 将 bill_source_collect_mark 标为 REGENERATED
  -> 将原 ar_bill 置为 VOID + is_deleted = 1
  -> 创建 trigger_type = REGENERATE 的新任务
  -> 等待执行 Job 异步重建新账单
```

所以接口返回成功只表示：

> 旧账单已经完成作废准备，并成功创建了重跑任务；不代表新账单已经生成完成。

### 7.5 重跑时回退的源表

当前代码会回退：

| 源表 | 回退内容 |
| --- | --- |
| `sale_order_header_extend` | `bms_billed_flag = 0`，`bms_bill_no = NULL` |
| `sale_order_additional_matter` | `bms_billed_flag = 0`，`bms_bill_no = NULL` |
| `claim_order` | `bms_billed_flag = 0`，`bms_bill_no = NULL`，`bms_billed_at = NULL` |

### 7.6 重跑时修改的 BMS 数据

| 数据对象 | 当前处理 |
| --- | --- |
| `fee_detail` | 旧账单费用改为 `VOID`，不物理删除 |
| `ar_bill_currency_summary` | 按旧账单号删除 |
| `main_order` | 保留快照行，但清空账单、任务、账期、币种等关联字段 |
| `bill_source_collect_mark` | 轨迹状态改为 `REGENERATED`，原因写入 `last_error_message` |
| `ar_bill` | 账单状态改为 `VOID`，并逻辑删除 |
| `bill_generate_task` | 创建或复用同账期、同配置、`trigger_type = REGENERATE` 的任务并重置为 `PENDING` |

### 7.7 新任务如何重新生成

重跑创建出的 `REGENERATE` 任务，后续仍然走普通会员应收生成主链路：

```text
PENDING
  -> RUNNING
  -> 重新查询当前源表中的“未打标数据”
  -> 按最新读取到的配置快照和规则快照生成新账单
  -> 重新写 main_order / fee_detail / source mark
  -> 重新回写源表标记
  -> SUCCESS / FAILED
```

因为旧账单对应的源表标记已经被回退，所以最新任务能重新读取这些来源数据；如果上游金额已经变更，它读到的就是变更后的最新值。

### 7.8 重跑失败时的恢复边界

当前重跑存在明确的跨库一致性边界：

1. BMS 数据库侧清理和新任务创建在本地事务中。
2. OFP 源表回退通过独立 JDBC 连接执行，不在同一个本地事务内。
3. 如果准备阶段失败，代码会根据重跑前查出的 `bill_source_collect_mark` 尝试恢复源表打标。
4. 某条来源恢复失败时只打日志，不会继续向上抛恢复异常。

因此当前仍有以下风险：

1. 源表回退成功，但后续 BMS 侧事务失败，且恢复源表标记又失败。
2. 轨迹表不完整时，失败恢复覆盖不全。
3. 接口成功创建重跑任务后，异步任务本身仍可能失败，而旧账单已经作废。

### 7.9 当前“重新生成订单”入口并不会回源重算

单订单入口：

```text
POST /api/bms/ar-bill/regenerate-order
  -> ArBillServiceImpl.regenerateOrder()
```

当前实现只做三件事：

1. 校验账单号和订单号。
2. 给该订单已有费用加一条“手动重新生成订单费用”备注。
3. 基于现有 `fee_detail` 重新汇总账单金额。

它不会：

1. 重新读取 OFP 最新订单数据。
2. 回退源表 BMS 标记。
3. 重新拆分费用。
4. 新增或替换 `fee_detail`。

所以这个入口本质上更接近“人工标记并刷新汇总”，不能用于把上游修改后的最新订单金额重新拉到账单中。

## 8. 当前实现与目标模型差异

当前目标模型仍然是：

```text
业务源表
  -> fee_detail
     作为来源费用池保存版本
  -> bill_fee_detail_relation
     保存账单挂账关系
  -> ar_bill / ar_bill_currency_summary
     保存账单和汇总
```

但当前代码距离该模型仍有差距：

| 能力 | 当前代码 | 目标模型 |
| --- | --- | --- |
| 首次同步未归集订单 | 已实现 | 保留 |
| 同账期漏跑订单补入 | 已实现 | 保留 |
| 出账后新增附加费补入 | 已实现 | 保留并继续独立化 |
| 来源轨迹补偿 | 已实现基础版 | 继续扩展到来源版本轨迹 |
| 已归集来源修改识别 | 未实现 | 通过修改时间 + `source_row_hash` 识别 |
| 来源费用版本化 | 未实现 | 新增版本，不覆盖旧版本 |
| 账单费用关系表 | 未实现 | 使用 `bill_fee_detail_relation` |
| 已复核账单接收来源变化 | 未实现 | 进入后续调整中心 |
| 重跑时是否回退源表标记 | 仍会回退 | 目标是不再回退 |

## 9. 业务场景汇总

| 场景 | 当前实际处理 |
| --- | --- |
| 新订单首次进入账期 | 扫描未打标订单并生成账单 |
| 同账期漏跑订单 | 再次生成，只补未打标订单 |
| 账单生成后新增附加费 | 走 `ADDITIONAL_INCREMENT` 链路追加到可修改账单 |
| 已归集订单/附加费/理赔金额被上游修改 | 普通生成任务无法自动识别 |
| 修改后的费用需要尽快修正 | 当前主要依赖整张账单重跑或人工调账 |
| 整张账单重跑 | 作废旧账单、回退源表标记、创建 `REGENERATE` 异步任务 |
| 单订单“重新生成” | 只追加备注并刷新汇总，不会回源重算 |
| 账单已待结清或已结清 | 不允许普通增量追加，也不允许重跑 |

## 10. 相关代码索引

| 职责 | 文件或方法 |
| --- | --- |
| 计划任务入口 | `BillGeneratePlanJob` |
| 执行任务入口 | `BillGenerateTaskExecuteJob` |
| 统一生成入口 | `BillGenerateServiceImpl.generate()` |
| 会员应收任务创建 | `BillGenerateServiceImpl.createTask()` |
| 返款任务创建 | `BillGenerateServiceImpl.createRefundTask()` |
| 任务领取与分流 | `BillGenerateServiceImpl.executeTask()` |
| 会员应收主编排 | `BillGenerateServiceImpl.executeTaskInternal()` |
| 订单归属到默认/分支配置 | `BillGenerateServiceImpl.assignOrdersToConfigGroup()` |
| 增量附加费归属到默认/分支配置 | `BillGenerateServiceImpl.assignIncrementalAdditionalToConfigGroup()` |
| 单账单分组生成 | `BillGenerateServiceImpl.executeBillGroup()` |
| 增量附加费归集 | `BillGenerateServiceImpl.executeIncrementalAdditionalGroup()` |
| 来源打标补偿 | `BillGenerateServiceImpl.markSourceWithCompensation()` |
| 源表打标回退 | `BillGenerateServiceImpl.unmarkSourceByBillNo()` |
| 重跑失败恢复源表标记 | `BillGenerateServiceImpl.restoreSourceMarks()` |
| 当前整张账单重跑 | `BillGenerateServiceImpl.regenerate()` |
| 单订单“重新生成” | `ArBillServiceImpl.regenerateOrder()` |
| 任务监控重试入口 | `BillGenerateTaskMonitorServiceImpl.retry()` |
