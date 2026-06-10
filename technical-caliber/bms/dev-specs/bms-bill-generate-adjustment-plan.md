# BMS 账单生成机制调整方案

> 产品依据：`aidocs/product-caliber/bms/prd/账单生成机制.PRD.md`
>
> 现有设计依据：
>
> - `aidocs/product-caliber/bms/prd/bms-fee-source-dataset-design.md`
> - `aidocs/product-caliber/bms/prd/bms-multi-currency-billing-design.md`
> - `aidocs/technical-caliber/bms/sql/ddl/fee_source_dataset_create.sql`
> - `aidocs/technical-caliber/bms/sql/ofp_db1/bms_source_marking_alter.sql`
> - `aidocs/technical-caliber/bms/sql/ddl/bill_source_collect_mark_create.sql`
>
> 调整目标：复用源表已有同步标识，将“抓取到 BMS 的费用源数据”和“费用计入某张账单后的账单侧数据”拆开，保证账单调整、汇率调整和重跑不会修改 `fee_detail` 源数据。

## 1. 本次调整结论

原调整方案存在两个方向性问题：

1. 重复设计了源表字段 `bms_collect_status`，没有复用项目已有的 `bms_billed_flag / bms_bill_no` 和 `fee_source_dataset` 配置。
2. 继续把 `fee_detail` 同时当作来源费用和账单费用明细，导致账单归属、结算币种、财务本位币、汇率、换算金额和调整状态都直接写在来源数据上。

本次方案调整为三层模型：

```text
业务源表
  -> fee_detail                         BMS费用源数据池
  -> bill_fee_detail_relation           账单费用关联及账单侧快照
  -> ar_bill / ar_bill_currency_summary 账单及币种汇总
```

核心原则：

1. 源表继续复用已有打标字段，不新增 `bms_collect_status`；其中 `bms_billed_flag` 在新模型中按“是否已同步到 BMS 费用源数据池”解释。
2. `fee_detail` 表示抓取进入 BMS 后的费用源数据，不直接归属账单。
3. `bill_fee_detail_relation` 表示某笔费用如何计入某张账单。
4. 结算币种、财务本位币、两段汇率和换算金额属于账单，全部放在关联表。
5. 账单补录、红冲、调账、汇率调整只修改或新增关联记录，不修改 `fee_detail`。
6. 同一笔 `fee_detail` 可以关联不同账单类型；同一账单类型和结算角色下，同一时刻只能有一条有效正向关联。
7. `ar_bill_currency_summary` 和 `ar_bill` 金额统一从有效关联记录汇总，不再从 `fee_detail` 汇总。
8. 账单类型、费用准入、账期、分组、金额方向、汇率和汇总公式必须由账单类型策略决定，不能写死为应收账单规则。

## 2. 源表同步标识复用方案

### 2.1 已有字段和配置

项目已在 OFP 源表增加以下字段：

| 源表 | 已有字段 | 用途 |
| --- | --- | --- |
| `sale_order_header_extend` | `bms_billed_flag`、`bms_bill_no` | 主订单费用同步标识、账单号字段 |
| `sale_order_additional_matter` | `bms_billed_flag`、`bms_bill_no`、`bms_after_bill_added_flag` | 附加费同步标识、账单号字段、出账后新增标识 |

`fee_source_dataset` 已提供：

| 配置字段 | 当前配置示例 | 用途 |
| --- | --- | --- |
| `billed_flag_column` | `e.bms_billed_flag`、`a.bms_billed_flag` | 配置不同数据集的同步标识字段 |
| `bill_no_column` | `e.bms_bill_no`、`a.bms_bill_no` | 可选账单号回写字段，不作为是否已同步的判断依据 |
| `incremental_time_column` | `a.create_time` | 附加费增量扫描时间 |
| `query_window_days` | `1` | 查询窗口 |
| `query_page_size` | `500` | 分页条数 |

因此，本次不再增加 `bms_collect_status / bms_collect_at / bms_collect_task_id`。

### 2.2 PRD 状态与现有字段映射

PRD 中的 `null / sync / modified` 是业务状态，不要求再建立同名源表字段。基于现有字段按以下方式实现：

| PRD 状态 | 现有字段或识别方式 | 定时任务行为 |
| --- | --- | --- |
| `null` 未同步 | `bms_billed_flag = 0` | 首次抓取并写入 `fee_detail` |
| `sync` 已同步 | `bms_billed_flag = 1` | 常规增量任务不重复抓取 |
| `modified` 已同步后变化 | BMS 对比来源行最新 `source_row_hash` 与已抓取版本哈希不一致 | 写入新的 `fee_detail` 版本并进入账单侧调整 |

现有源表字段不能单独表达 `modified`，因此不能仅依赖 `bms_billed_flag = 0` 查找修改数据，也不能通过清空已有标识模拟修改。

修改识别采用 BMS 侧版本比对：

1. `fee_detail` 保存 `source_row_hash` 和来源版本。
2. `bill_source_collect_mark` 保存最近采集哈希和来源快照。
3. 数据集存在可用更新时间字段时，在 `fee_source_dataset` 增加 `modified_time_column` 配置，指向源表已有更新时间字段，不要求修改源表结构。
4. 来源变更扫描任务按 `modified_time_column + query_window_days` 扫描近期变更数据。
5. 最新哈希与已采集哈希不一致时，新增一条 `fee_detail` 版本，不覆盖旧版本。
6. 没有可靠更新时间字段的数据集，一期只支持首次增量抓取；必须补齐现有更新时间字段或明确上游变更通知机制后，才能支持 `modified`。

建议仅调整 BMS 配置表：

```sql
ALTER TABLE fee_source_dataset
  ADD COLUMN modified_time_column varchar(255) DEFAULT NULL
  COMMENT '来源数据修改时间表达式，使用源表已有字段，用于已同步数据变化扫描';
```

### 2.3 源表打标规则

首次抓取成功后的源表回写仍使用数据集配置：

```text
billed_flag_column = 1
bill_no_column = 可选字段；费用尚未关联账单时允许为空
```

约束：

1. `fee_detail` 和来源同步轨迹落库成功后即可将 `billed_flag_column` 更新为 `1`，不依赖账单关联是否成功。
2. 源表打标失败时，由 `bill_source_collect_mark` 记录 `FAILED` 并补偿。
3. 禁止 `unmarkSourceByBillNo()` 将已同步数据重置为未同步。
4. 禁止账单重跑时清空 `bms_billed_flag / bms_bill_no`。
5. `bms_bill_no` 不是费用与账单的关系依据；费用与账单的真实关系只认 `bill_fee_detail_relation`，新链路不得依赖该字段判断同步状态或账单归属。
6. 已同步源数据发生修改时，旧账单关系不通过源表字段回退；由 BMS 费用版本和账单关联版本处理。

## 3. 数据模型拆分

### 3.1 `fee_detail`：BMS 费用源数据池

`fee_detail` 调整后的职责：

1. 保存从业务源表抓取进入 BMS 的标准化费用数据。
2. 保存来源身份、业务身份、原始金额、原始币种和来源快照。
3. 保存来源数据版本，支持来源修改后的历史追溯。
4. 不保存具体账单的归属、结算口径和调整结果。
5. 来源数据写入后原则上不可修改；来源变化时新增版本。

应保留或新增的字段分类：

| 分类 | 字段 |
| --- | --- |
| 费用身份 | `id`、`fee_no`、`fee_index_id`、`fee_source_rule_id`、`fee_code`、`fee_name`、`fee_type`、`attached_object` |
| 客户与业务身份 | `sc_id`、`shop_id`、`user_id`、`member_code`、`business_order_no`、目的国、仓库、首尾程单号 |
| 来源身份 | `source_system`、`source_table`、`source_id`、`source_order_id`、`source_biz_no`、`source_fee_field`、`source_fee_time` |
| 来源原始金额 | `fee_currency`、`amount_fee_currency` |
| 来源版本 | `source_row_hash`、`source_version_no`、`previous_fee_detail_id`、`source_snapshot_json` |
| 平台状态 | `source_fee_status`、`effective_flag`、审计字段 |

应从 `fee_detail` 移出的字段：

| 不再存放于 `fee_detail` 的字段 | 调整后归属 | 原因 |
| --- | --- | --- |
| `bill_id / bill_no / bill_config_id / generate_task_id` | `bill_fee_detail_relation` | 属于账单归属 |
| `business_type_code / business_type_fee_id` | `bill_fee_detail_relation` | 属于本次账单配置命中结果 |
| `exchange_rate_to_bill / exchange_rate_level_to_bill` | `bill_fee_detail_relation` | 每张账单使用的汇率可能不同 |
| `bill_currency / amount_bill_currency` | `bill_fee_detail_relation` | 结算币种属于账单 |
| `exchange_rate_to_fin / exchange_rate_level_to_fin` | `bill_fee_detail_relation` | 每张账单财务换算不同 |
| `fin_currency / amount_fin_currency` | `bill_fee_detail_relation` | 财务本位币属于账单 |
| `fee_status / manual_flag / manual_reason` | `bill_fee_detail_relation` | 属于账单侧操作状态 |
| `original_fee_id / offset_bill_no` | `bill_fee_detail_relation` | 属于账单侧红冲和调整关系 |

`fee_detail` 推荐唯一键：

```text
source_system + source_table + source_id + fee_code + source_version_no
```

不能继续使用只包含来源行和费项的唯一键阻止新版本写入。

### 3.2 `bill_fee_detail_relation`：账单费用关联及账单侧快照

新增 `bill_fee_detail_relation`。该表不是简单的中间表，而是账单侧费用明细，是账单金额、币种、汇率、调整和导出的事实依据。

推荐结构：

```sql
CREATE TABLE bill_fee_detail_relation (
  id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  relation_no varchar(64) NOT NULL COMMENT '账单费用关联编号',
  bill_id bigint unsigned NOT NULL COMMENT '账单ID',
  bill_no varchar(64) NOT NULL COMMENT '账单编号',
  bill_type varchar(32) NOT NULL COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP等',
  bill_config_id bigint unsigned NOT NULL COMMENT '账单配置ID',
  generate_task_id bigint unsigned DEFAULT NULL COMMENT '生成任务ID',
  fee_detail_id bigint unsigned DEFAULT NULL COMMENT 'BMS费用源数据ID，手工补录时可为空',

  sc_id bigint NOT NULL COMMENT '供应链/组织ID',
  shop_id bigint NOT NULL COMMENT '店铺ID',
  user_id bigint NOT NULL COMMENT '用户ID',
  member_code varchar(64) NOT NULL COMMENT '会员/客户编码',
  settlement_subject_type varchar(32) NOT NULL COMMENT '结算主体类型：MEMBER/SUPPLIER等',
  settlement_subject_id bigint DEFAULT NULL COMMENT '结算主体ID',
  settlement_subject_code varchar(64) NOT NULL COMMENT '结算主体编码',

  relation_type varchar(32) NOT NULL COMMENT '关联类型：SOURCE/MANUAL/ADJUSTMENT/REVERSAL',
  settlement_role varchar(32) NOT NULL COMMENT '结算角色：RECEIVABLE/PAYABLE/REFUND_PRINCIPAL/REFUND_DEDUCTION等',
  relation_status varchar(32) NOT NULL DEFAULT 'NORMAL'
    COMMENT '状态：NORMAL/REPLACED/REVERSED/VOID',
  original_relation_id bigint unsigned DEFAULT NULL COMMENT '原关联记录ID，红冲或替换时使用',
  adjustment_order_id bigint unsigned DEFAULT NULL COMMENT '调账单ID',
  calculation_rule_code varchar(64) NOT NULL COMMENT '账单类型计算规则编码',
  calculation_snapshot_json json COMMENT '本次关系使用的计算规则快照',

  business_type_code varchar(64) DEFAULT NULL COMMENT '账单命中的业务类型',
  business_type_fee_id bigint unsigned DEFAULT NULL COMMENT '账单命中的业务费项关系ID',
  fee_index_id bigint unsigned NOT NULL COMMENT '费项ID快照',
  fee_code varchar(64) NOT NULL COMMENT '费项编码快照',
  fee_name varchar(128) NOT NULL COMMENT '费项名称快照',
  fee_type varchar(16) NOT NULL COMMENT '费用类型快照',
  attached_object varchar(16) NOT NULL COMMENT '挂靠对象快照',
  business_order_no varchar(64) DEFAULT NULL COMMENT '业务主单号快照',

  fee_currency varchar(16) NOT NULL COMMENT '费用原始币种快照',
  amount_fee_currency decimal(18,4) NOT NULL COMMENT '费用原始金额快照',
  exchange_rate_to_bill decimal(18,8) NOT NULL COMMENT '原始币种到结算币种汇率',
  exchange_rate_level_to_bill varchar(16) DEFAULT NULL COMMENT 'L1汇率级别',
  bill_exchange_rate_id bigint unsigned DEFAULT NULL COMMENT '使用的L1账单汇率记录ID',
  bill_currency varchar(16) NOT NULL COMMENT '本账单结算币种',
  amount_bill_currency decimal(18,4) NOT NULL COMMENT '本账单结算币种金额',
  exchange_rate_to_fin decimal(18,8) NOT NULL COMMENT '结算币种到财务本位币汇率',
  exchange_rate_level_to_fin varchar(16) DEFAULT NULL COMMENT 'L2汇率级别',
  fin_exchange_rate_id bigint unsigned DEFAULT NULL COMMENT '使用的L2账单汇率记录ID',
  fin_currency varchar(16) NOT NULL COMMENT '本账单财务本位币',
  amount_fin_currency decimal(18,4) NOT NULL COMMENT '本账单财务本位币金额',

  manual_reason varchar(500) DEFAULT NULL COMMENT '手工补录或调整原因',
  voucher_url varchar(500) DEFAULT NULL COMMENT '账单侧费用凭证',
  remark varchar(500) DEFAULT NULL COMMENT '备注',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  created_by varchar(64) DEFAULT NULL COMMENT '创建人',
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  updated_by varchar(64) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (id),
  UNIQUE KEY uk_bill_fee_relation_no (relation_no),
  KEY idx_bill_fee_relation_bill (bill_type, bill_id, relation_status),
  KEY idx_bill_fee_relation_fee (fee_detail_id, bill_type, settlement_role, relation_status),
  KEY idx_bill_fee_relation_original (original_relation_id),
  KEY idx_bill_fee_relation_currency (bill_id, bill_currency, relation_status)
) COMMENT='账单费用关联及账单侧金额快照';
```

关键规则：

1. 来源费用正常入账时，`relation_type = SOURCE`，`fee_detail_id` 必填。
2. 手工补录时，`relation_type = MANUAL`，`fee_detail_id` 可为空，账单侧费用快照字段必填。
3. 调账时新增 `ADJUSTMENT` 记录，不修改来源 `fee_detail`。
4. 红冲时新增负数 `REVERSAL` 记录，并通过 `original_relation_id` 指向原账单费用。
5. 来源数据修改后重新解释费用时，将旧关联置为 `REPLACED`，再基于新版本 `fee_detail` 新增关联。
6. 已复核账单不得直接将旧关联置为 `REPLACED/VOID`；必须通过后续账单或财务调账中心新增调整记录。
7. `bill_id` 只在 `bill_type` 范围内有意义，所有关联查询必须同时携带 `bill_type + bill_id` 或直接使用全局唯一 `bill_no`。
8. `settlement_role` 表示该费用在当前账单中的计算角色，同一笔费用在不同账单类型中可以使用不同角色。
9. `calculation_rule_code + calculation_snapshot_json` 固化本次计算口径，避免后续策略变化影响已生成账单。
10. `sc_id / shop_id / user_id` 继续承担数据隔离；`settlement_subject_type / settlement_subject_code` 表达真正结算对象，不能使用 `member_code` 兼代供应商。

### 3.3 多账单类型扩展边界

`fee_detail` 是所有账单类型共享的费用源数据池，不能增加只服务于某一种账单的字段。新增账单类型时，费用仍通过 `bill_fee_detail_relation` 与账单关联。

推荐账单类型：

| `bill_type` | 业务含义 | 典型费用类型或角色 | 典型计算结果 |
| --- | --- | --- | --- |
| `MEMBER_AR` | 客户应收账单 | `AR / ARD / ARAP`，角色为 `RECEIVABLE` | 应收金额 |
| `COST_AP` | 成本或应付账单 | `AP / ARAP`，角色为 `PAYABLE` | 应付金额 |
| `COD_REFUND` | COD 返款账单 | 代收货款为 `REFUND_PRINCIPAL`，手续费等为 `REFUND_DEDUCTION` | 应返金额 = 返款本金 - 扣减项 |

关键规则：

1. `bill_config.bill_type` 决定当前配置生成哪一种账单。
2. `fee_detail.fee_type` 只表达费用性质，不直接决定最终账单；是否进入某类账单由账单类型策略判断。
3. `ARAP` 等代收代付费用允许同时进入应收账单和成本账单，因此不能使用“存在任意有效关联就禁止再次入账”的全局规则。
4. 同一费用是否允许进入多个账单类型、是否允许部分金额分摊，由账单类型策略和关系幂等规则共同控制。
5. 应收、成本、返款账单可以使用不同账期、归集节点、结算主体、状态机、币种规则、汇率规则和汇总公式。
6. 各类账单可以使用独立账单主表和状态机，但共享 `bill_fee_detail_relation`。关联表通过 `bill_type + bill_id + bill_no` 标识目标账单。
7. 不得为了新增返款或成本账单复制一张新的费用关联表。
8. `bill_generate_task` 的任务唯一键、活动任务锁和查询条件必须包含 `bill_type`，不同账单类型可以按各自账期独立运行。
9. `bill_no` 应在 BMS 范围内全局唯一，并使用不同类型前缀，例如应收 `ARB`、成本/应付 `APB`、返款 `PCB`。

### 3.4 `bill_exchange_rate` 和币种汇总

保留现有 `bill_exchange_rate` 作为账单级汇率快照：

1. `FEE_TO_BILL`：费用原始币种到结算币种。
2. `BILL_TO_FIN`：结算币种到财务本位币。
3. `bill_fee_detail_relation` 保存实际使用的汇率值和对应汇率记录 ID。
4. 调整账单汇率时，只重算该账单的有效关联记录。
5. 不修改 `fee_detail.fee_currency / amount_fee_currency`。

为支持不同账单主表，`bill_exchange_rate` 增加 `bill_type`，汇率唯一键调整为：

```text
bill_type + bill_id + target_currency + source_currency + conversion_currency_type
```

不同账单类型可以定义额外汇率类型。例如返款账单可以增加返款业务汇率类型，但仍通过账单类型策略锁定并保存账单级快照。

应收账单的 `ar_bill_currency_summary` 改为从有效关联记录汇总：

```sql
SELECT bill_id,
       bill_no,
       bill_currency AS currency,
       SUM(amount_bill_currency) AS receivable_amount,
       SUM(amount_fin_currency) AS receivable_amount_fin,
       COUNT(1) AS fee_count,
       COUNT(DISTINCT business_order_no) AS order_count
FROM bill_fee_detail_relation
WHERE bill_id = ?
  AND relation_status = 'NORMAL'
GROUP BY bill_id, bill_no, bill_currency;
```

`ar_bill` 的应收和本位币金额同样从有效关联记录及币种汇总刷新，不再直接汇总 `fee_detail`。成本账单和返款账单使用各自的账单主表、币种汇总表及汇总策略。

### 3.5 `bill_source_collect_mark` 调整

`bill_source_collect_mark` 继续用于跨库打标补偿，但其职责调整为“来源行抓取轨迹”，不再作为费用和账单的一对一关系。

建议增加：

```sql
ALTER TABLE bill_source_collect_mark
  ADD COLUMN fee_detail_id bigint unsigned DEFAULT NULL COMMENT '本次抓取生成的费用源数据ID',
  ADD COLUMN source_row_hash varchar(64) DEFAULT NULL COMMENT '本次抓取来源行哈希',
  ADD COLUMN source_version_no int NOT NULL DEFAULT 1 COMMENT '来源版本号';
```

`bill_source_collect_mark` 不再保存 `bill_id / bill_no / bill_config_id`。账单归属只写 `bill_fee_detail_relation`。

现有唯一键：

```text
source_system + source_table + source_id + collect_type
```

需要调整为支持来源版本：

```text
source_system + source_table + source_id + collect_type + source_version_no
```

## 4. 调整后的定时任务模型

### 4.1 任务一：来源费用同步任务

职责：

1. 按 `fee_source_dataset` 配置读取未同步来源行。
2. 标准化并写入 `fee_detail`。
3. 写入 `bill_source_collect_mark`。
4. 使用 `billed_flag_column` 回写源表同步标识。
5. 不创建账单，不计算结算币种和财务本位币。

处理顺序：

```text
读取未同步源行
  -> 计算 source_row_hash
  -> 写 fee_detail
  -> 写 bill_source_collect_mark
  -> 回写源表已有同步标识
```

首次同步查询条件必须通过数据集配置生成，当前内置数据集以 `billed_flag_column` 为准，等价于：

```sql
COALESCE(bms_billed_flag, 0) = 0
```

`bill_no_column` 不再参与首次同步查询。

不得在服务代码中为每个源表重复硬编码字段名。

### 4.2 任务二：来源变化识别任务

职责：

1. 按 `fee_source_dataset.modified_time_column` 扫描已同步后发生变化的数据。
2. 计算最新 `source_row_hash`。
3. 哈希未变化则跳过。
4. 哈希变化则新增 `fee_detail` 版本。
5. 根据原账单状态决定替换原关联或生成后续调整。

状态处理：

| 原账单状态 | 来源变化处理 |
| --- | --- |
| `DRAFT / GENERATED` | 旧关联置 `REPLACED`，新版本费用创建新关联，刷新账单 |
| `PENDING_SETTLEMENT / PAID` | 不修改原账单；创建后续账单调整或进入财务调账中心 |
| `VOID` | 不恢复原账单；按当前有效配置决定是否进入新账单 |

### 4.3 任务三：账单生成任务

账单生成任务只消费已经同步到 BMS 的 `fee_detail`，负责确定费用计入哪张账单，以及该账单使用的结算币种、财务本位币、汇率和换算金额。

#### 4.3.1 待入账费用范围

从 `fee_detail` 查询满足以下条件的来源费用：

1. `effective_flag = 1`，来源费用版本有效。
2. 对当前 `bill_type + settlement_role` 尚未存在不允许重复的有效 `bill_fee_detail_relation`。
3. `source_fee_time` 落在本次任务账期内。
4. 客户、店铺、业务类型、目的国、仓库等字段满足账单配置范围。
5. 当前账单类型策略判断来源费用允许进入该类账单。

任务只读取 `fee_detail`，不再查询和修改业务源表。

不能使用“`fee_detail` 只要存在任意 `NORMAL` 关联就不再入账”的全局排除逻辑，否则 `ARAP` 等费用进入应收账单后，将无法继续进入成本账单。幂等判断必须包含 `bill_type + settlement_role`。

#### 4.3.2 匹配或创建账单

费用按以下账单归属维度匹配：

```text
bill_type
+ settlement_subject
+ bill_config_id
+ billing_period_start_date
+ billing_period_end_date
+ config_type
+ destination_country / consolidation_warehouse_code（分支配置存在时）
```

处理规则：

1. 已存在 `DRAFT / GENERATED` 账单时，费用追加到现有账单。
2. 不存在账单时，根据任务快照创建新账单。
3. 已存在 `PENDING_SETTLEMENT / PAID` 账单时，不允许向原账单追加，进入后续账单或财务调账流程。
4. `MEMBER_AR` 使用客户作为结算主体；`COST_AP` 通常使用供应商作为结算主体；`COD_REFUND` 使用返款客户作为结算主体。
5. 各账单类型通过策略决定具体主表、账单编号、状态初始值和结算主体字段。
6. 应收账单的 `ar_bill.bill_currency` 保存配置默认结算币种，仅作为默认值和展示值；一张账单允许存在多种实际结算币种。
7. 应收账单的 `ar_bill.fin_currency` 保存该账单统一使用的财务本位币；其他账单类型由对应策略写入自己的账单主表。

#### 4.3.3 来源原始金额和来源币种

来源原始金额和来源币种直接读取 `fee_detail`：

```text
amount_fee_currency = fee_detail.amount_fee_currency
fee_currency        = fee_detail.fee_currency
```

`fee_detail.fee_currency` 在来源费用同步任务中按以下顺序确定：

1. 优先读取 `fee_source_rule.source_currency_column` 配置的来源币种字段。
2. 来源规则未配置或来源字段为空时，读取数据集已约定的来源币种字段。
3. 仍为空时，回退到 `bill_config.billing_currency`。
4. 最终仍无法取得币种时，来源费用同步失败，不允许以未知币种进入账单。

来源原始金额和来源币种写入 `fee_detail` 后不允许被账单生成或账单调整修改。

#### 4.3.4 结算币种来源

每条费用的结算币种独立确定，并写入 `bill_fee_detail_relation.bill_currency`。

先按以下优先级匹配费项结算币种规则：

```text
当前 bill_config 的显式费项币种规则
  -> 当前 bill_config 选择的目的国费项币种模板
  -> 按业务类型 + 目的国自动命中的公共费项币种模板
  -> 未命中规则时使用 CONFIG_DEFAULT
```

命中规则后，根据 `charge_currency_mode` 决定结算币种：

| 模式 | 结算币种来源 | 校验规则 |
| --- | --- | --- |
| `SOURCE` | `fee_detail.fee_currency` | 来源币种不能为空 |
| `FIXED` | 规则中的 `charge_currency` | 固定币种不能为空 |
| `CONFIG_DEFAULT` | `bill_config.billing_currency` | 默认结算币种不能为空 |

示例：

| 费项 | 来源币种 | 币种规则 | 最终结算币种 |
| --- | --- | --- | --- |
| 运费 | `TWD` | `FIXED/CNY` | `CNY` |
| COD 金额 | `TWD` | `SOURCE` | `TWD` |
| 未配置特殊规则的费项 | `USD` | `CONFIG_DEFAULT`，配置默认币种为 `CNY` | `CNY` |

当前代码必须修正：

1. 当前 `resolveCurrencyRule()` 已能得到 `matchedCurrencyRule`。
2. 当前 `resolveGeneratedFeeAmounts()` 最终仍调用 `resolveChargeCurrency(billConfig)`，导致费项级规则未真正生效。
3. 调整后由 `BillCurrencyResolveProcessor` 根据 `matchedCurrencyRule + fee_detail.fee_currency + bill_config.billing_currency` 得出结算币种。
4. 禁止继续直接将所有费用的结算币种设置为 `bill_config.billing_currency`。

#### 4.3.5 财务本位币来源

默认情况下，财务本位币读取本次命中的账单配置：

```text
fin_currency = bill_config.fin_currency
```

规则：

1. 同一张账单只能使用一个财务本位币。
2. 创建 `ar_bill` 时，将任务快照中的 `bill_config.fin_currency` 写入 `ar_bill.fin_currency`。
3. 每条 `bill_fee_detail_relation.fin_currency` 保存账单财务本位币快照。
4. `bill_config.fin_currency` 为空时，禁止生成账单；不在生成代码中静默回退为 `CNY`。
5. 后续修改账单配置的财务本位币，不自动修改已生成账单；可修改账单需要通过账单侧重算任务显式重算。
6. 特殊账单类型需要不同本位币来源时，由账单类型策略覆盖，但必须在任务快照和关联记录中固化来源及结果。

#### 4.3.6 两段账单汇率来源

账单生成使用两段汇率：

| 转换类型 | 来源币种 | 目标币种 | 用途 |
| --- | --- | --- | --- |
| `FEE_TO_BILL` | `fee_detail.fee_currency` | 关联记录的 `bill_currency` | 原始费用换算为客户结算金额 |
| `BILL_TO_FIN` | 关联记录的 `bill_currency` | `ar_bill.fin_currency` | 结算金额换算为财务本位币金额 |

每一段汇率按以下顺序取得：

1. 来源币种与目标币种相同时，直接使用汇率 `1.00000000`，不查询、不新增 `bill_exchange_rate`。
2. 币种不同时，优先查询当前账单已锁定的 `bill_exchange_rate`。
3. 当前账单没有对应汇率时，查询当前账单所属 `sc_id + shop_id` 的店铺启用汇率。
4. 找到店铺启用汇率后，立即写入 `bill_exchange_rate`，后续同账单相同币种对复用该锁定汇率。
5. 店铺未配置可用汇率时，当前账单生成失败；禁止使用汇率 `1`，禁止通过来源已转换金额反推汇率。

账单汇率唯一键：

```text
bill_type
+ bill_id
+ target_currency
+ source_currency
+ conversion_currency_type
```

其中现有技术字段映射为：

```text
bill_exchange_rate.bill_currency       = target_currency
bill_exchange_rate.conversion_currency = source_currency
```

汇率方向处理：

| `conversion_direction` | 有效换算倍率 |
| --- | --- |
| `MUL` | `exchange_rate` |
| `DIV` | `1 / exchange_rate` |

写入 `bill_fee_detail_relation` 时，保存实际生效的换算倍率，而不是只保存店铺汇率原始配置值，保证账单金额可直接复算。

#### 4.3.7 金额计算和精度

单条费用金额按以下顺序计算：

```text
原始费用金额
amount_fee_currency = fee_detail.amount_fee_currency

结算币种金额
amount_bill_currency
  = amount_fee_currency * effective_exchange_rate_to_bill

财务本位币金额
amount_fin_currency
  = amount_bill_currency * effective_exchange_rate_to_fin
```

计算规则：

1. 汇率使用 `DECIMAL(18,8)`。
2. 金额使用 `DECIMAL(18,4)`。
3. 每段金额换算完成后按四位小数、`HALF_UP` 舍入。
4. `fee_currency = bill_currency` 时，`exchange_rate_to_bill = 1`，结算金额等于原始金额。
5. `bill_currency = fin_currency` 时，`exchange_rate_to_fin = 1`，本位币金额等于结算金额。
6. `ARD / REVERSAL` 等负向费用先确定金额正负，再执行币种换算。

示例：

```text
来源费用：100.0000 TWD
费项结算币种规则：FIXED/CNY
账单财务本位币：USD

账单锁定 FEE_TO_BILL：TWD -> CNY，有效倍率 0.22000000
账单锁定 BILL_TO_FIN：CNY -> USD，有效倍率 0.13800000

amount_bill_currency = 100.0000 * 0.22000000 = 22.0000 CNY
amount_fin_currency  = 22.0000 * 0.13800000 = 3.0360 USD
```

#### 4.3.8 关系落库和账单汇总

每条费用完成币种和金额计算后，写入 `bill_fee_detail_relation`：

```text
fee_detail_id
bill_id / bill_no / bill_config_id
fee_currency / amount_fee_currency
bill_currency / amount_bill_currency
fin_currency / amount_fin_currency
exchange_rate_to_bill / bill_exchange_rate_id
exchange_rate_to_fin / fin_exchange_rate_id
relation_type = SOURCE
relation_status = NORMAL
```

一个账单分组内的关系全部写入成功后，再统一刷新：

1. 先由账单类型汇总策略读取该账单的有效关系。
2. 应收账单写入 `ar_bill_currency_summary`，并刷新 `ar_bill` 应收及本位币金额。
3. 成本账单写入成本账单自己的币种汇总和应付金额。
4. 返款账单分别汇总返款本金、返款扣减项、应返金额和差额。
5. 各账单类型的费用条数、订单数和业务统计字段由对应汇总策略计算。

#### 4.3.9 不同账单类型的生成差异

账单生成公共骨架保持一致：

```text
读取 fee_detail
  -> 判断费用是否允许进入当前账单类型
  -> 计算账期和分组
  -> 创建或匹配账单
  -> 创建 bill_fee_detail_relation
  -> 执行账单类型汇总
```

差异部分由 `BillTypeStrategy` 提供：

```java
public interface BillTypeStrategy {

    String supportedBillType();

    boolean accepts(FeeDetail feeDetail, BillGenerateContext context);

    String resolveSettlementRole(FeeDetail feeDetail, BillGenerateContext context);

    BillPeriod resolvePeriod(FeeDetail feeDetail, BillGenerateContext context);

    BillGroupKey resolveGroupKey(FeeDetail feeDetail, BillGenerateContext context);

    BillHeaderRef getOrCreateBill(BillGenerateContext context, BillGroupKey groupKey);

    BillFeeCalculationResult calculate(BillFeeRelationContext context);

    void aggregate(BillHeaderRef bill, String operator);
}
```

各账单类型策略示例：

| 策略 | 费用准入 | 主要计算规则 | 汇总结果 |
| --- | --- | --- | --- |
| `MemberArBillTypeStrategy` | 接收应收、应收扣减及允许进入应收的代收代付费用 | 正向应收减去应收扣减，使用客户结算币种规则 | 应收、已收、未收、本位币金额 |
| `CostApBillTypeStrategy` | 接收成本及允许进入成本的代收代付费用 | 按供应商结算规则计算应付金额 | 应付、已付、未付、本位币金额 |
| `CodRefundBillTypeStrategy` | 接收 COD 返款本金和返款阶段扣减费项 | 应返金额 = 返款本金 - 返款扣减项，可使用返款业务汇率 | 返款本金、扣减金额、应返金额、返款差额 |

扩展新账单类型时：

1. 增加账单类型常量或枚举。
2. 增加该账单类型的配置、主表、状态规则和汇总表。
3. 实现一个 `BillTypeStrategy` 并注册到 `BillTypeStrategyRegistry`。
4. 复用来源费用同步任务、`fee_detail`、`bill_fee_detail_relation` 和公共任务执行骨架。
5. 不修改其他账单类型策略，不复制来源费用同步逻辑。

处理顺序：

```text
读取待入账 fee_detail
  -> 按账期和账单配置分组
  -> 匹配或创建可修改账单
  -> 匹配费项结算币种规则
  -> 确定每条费用的结算币种
  -> 从 bill_config 确定账单财务本位币
  -> 锁定 FEE_TO_BILL 和 BILL_TO_FIN 两段账单汇率
  -> 计算结算金额和财务本位币金额
  -> 写 bill_fee_detail_relation
  -> 按结算币种刷新 ar_bill_currency_summary
  -> 刷新 ar_bill 财务本位币金额和统计字段
```

失败处理：

1. 任一费用缺少结算币种、财务本位币或必要汇率时，当前账单分组生成失败。
2. 当前账单分组事务回滚，不留下部分 `bill_fee_detail_relation` 或错误汇总。
3. `fee_detail` 和源表同步标识保持不变。
4. 任务记录明确失败币种对、费项和来源费用 ID。
5. 配置或汇率修复后，任务继续消费尚未建立有效关联的费用。

### 4.4 任务四：账单侧重算任务

触发场景：

1. 账单配置变更。
2. 结算币种变更。
3. 财务本位币变更。
4. 汇率调整。
5. 补录、调账、红冲。

处理边界：

```text
只处理 ar_bill
       bill_fee_detail_relation
       bill_exchange_rate
       ar_bill_currency_summary
       fee_adjustment_order
```

禁止访问或修改：

```text
业务源表同步标识
fee_detail 来源原始金额和来源原始币种
bill_source_collect_mark 已完成抓取轨迹
```

## 5. 重跑与调整规则

### 5.1 重跑不再作废来源费用

现有 `regenerate()` 中以下行为必须移除：

1. `unmarkSourceByBillNo(oldBillNo)`。
2. `restoreSourceMarks(oldBillNo, sourceMarks)`。
3. 按账单号清空源表 `bms_billed_flag / bms_bill_no`。
4. 作废或修改 `fee_detail` 来重新生成账单。

重跑拆为两个明确动作：

| 动作 | 处理内容 |
| --- | --- |
| 补采来源费用 | 只采集未同步或已识别变化的来源数据，新增 `fee_detail`，不直接修改账单 |
| 补入账单 | 消费尚未建立有效关系的 `fee_detail`，新增账单关联 |
| 重算当前账单 | 只重建或调整 `bill_fee_detail_relation`，不重新抓取、不修改源表 |

### 5.2 调整账单详情

账单详情页面展示数据源改为：

```text
bill_fee_detail_relation
  LEFT JOIN fee_detail ON fee_detail.id = relation.fee_detail_id
```

展示规则：

1. 账单金额、结算币种、本位币、汇率、状态读取关联表。
2. 来源系统、来源表、来源单号、来源原始快照读取 `fee_detail`。
3. 手工补录记录没有 `fee_detail` 时，仅展示关联表快照。
4. 调整关联表中的账单字段不会影响其他账单，也不会影响来源费用。

### 5.3 幂等规则

建议分别定义两类幂等键：

```text
fee_detail:
source_system + source_table + source_id + fee_code + source_version_no

bill_fee_detail_relation:
bill_type + bill_id + fee_detail_id + settlement_role + relation_type + original_relation_id + relation_status有效版本
```

数据库无法直接约束“同一账单类型和结算角色仅一条有效记录”时，由 Service 在事务内使用行锁校验，并在创建新关系前将旧关系置为 `REPLACED`。不得跨账单类型排斥有效关系。

## 6. 代码调整范围

### 6.1 基于现有代码修改原则

本次改造必须基于现有代码渐进修改，不重新搭建一套与当前任务入口并行的账单系统。

保留以下现有入口和基础能力：

1. 保留 `BillGeneratePlanJob` 和 `BillGenerateTaskExecuteJob` 定时任务入口。
2. 保留 `BillGenerateService.generate()`、`executeTask()`、`regenerate()` 对外接口。
3. 保留 `bill_generate_task` 的创建、领取、成功、失败和重试机制。
4. 保留现有配置快照、默认配置和分支配置匹配能力。
5. 保留 `bill_source_collect_mark` 的跨库打标补偿能力。
6. 保留 `ArBillServiceImpl.manualFee()`、`adjustment()`、`rebuildAdjustment()` 对外业务入口。
7. 保留现有 Mapper 中仍符合新模型的配置、任务和账单查询 SQL。

调整方式：

1. 先增加明确 DTO、关联表 Mapper 和内部组件。
2. 再从 `BillGenerateServiceImpl` 中按职责逐段抽取现有方法。
3. 每抽取一段，原方法改为调用新组件，不同时保留两套业务实现。
4. 公共入口、任务调度和接口参数尽量不变，降低调用方调整范围。
5. 不为了使用设计模式创建空壳接口；只有存在变化点或多个实现时才使用模式。
6. 不进行与本方案无关的全项目重构。

#### Job 调整原则

推荐直接保留并改造现有 Job，不需要停掉原 Job 再启动一套并行的新 Job：

| 现有 Job | 调整后职责 |
| --- | --- |
| `BillGeneratePlanJob` | 按配置和账期创建来源费用同步任务、账单生成任务或账单侧重算任务 |
| `BillGenerateTaskExecuteJob` | 继续领取待执行任务，通过 `BillTaskExecutorRegistry` 分发到对应任务执行器 |

推荐调用关系：

```text
BillGeneratePlanJob
  -> BillGenerateService.generate()
  -> 创建不同 task_type / trigger_type 的 bill_generate_task

BillGenerateTaskExecuteJob
  -> BillGenerateService.executePendingTasks()
  -> BillGenerateService.executeTask()
  -> BillTaskExecutorRegistry
  -> SourceFeeCollectTaskExecutor
     / BillRelationGenerateTaskExecutor
     / BillRecalculateTaskExecutor
```

这样调整完成后：

1. 定时任务平台中的 Job 名称、分片配置和调度配置可以保持不变。
2. 不存在新旧 Job 同时扫描同一批数据的问题。
3. Job 只负责触发和分发，具体业务逻辑由新的任务执行器处理。
4. 上线时只需要发布新代码，不需要人工停旧 Job、启新 Job。

如果最终决定新增独立 Job，例如分别创建 `SourceFeeCollectJob` 和 `BillRelationGenerateJob`，则不能简单启动新 Job 后立即停止旧 Job，必须满足以下切换条件：

1. 旧 Job 已停止创建新任务。
2. 旧 Job 当前不存在 `RUNNING` 任务。
3. `PENDING / NEED_RETRY` 任务已经处理完成或明确作废。
4. 新旧 Job 不得同时消费相同 `task_type / trigger_type`。
5. 来源费用同步和账单生成必须使用不同任务类型及幂等键。
6. 新 Job 首次执行前，确认不存在已经写入 `fee_detail` 但仍会被旧 Job 重复抓取的数据。
7. 切换后验证来源同步、账单关联、汇率锁定和金额汇总各完成一轮，再正式恢复周期调度。

本方案默认采用“保留现有 Job、修改内部任务分发”的方式。

### 6.2 设计模式选型

本次只使用能够直接降低现有复杂度的设计模式。

| 设计模式 | 使用位置 | 解决的问题 |
| --- | --- | --- |
| 门面模式 Facade | 保留 `BillGenerateServiceImpl`、`ArBillServiceImpl` 作为入口 | 对 Controller、Job 保持稳定接口，隐藏内部组件拆分 |
| 模板方法 Template Method | 来源费用同步、账单生成、账单侧重算主流程 | 固定校验、执行、汇总、完成、失败处理顺序 |
| 策略模式 Strategy | 来源数据读取、账单费用关系创建、来源变化后的处理 | 消除按来源类型、关系类型和账单状态不断扩大的 `if/else` |
| 账单类型策略 Bill Type Strategy | 应收、成本、返款等不同账单计算 | 复用生成骨架，同时隔离费用准入、账期、分组、计算和汇总差异 |
| 工厂/注册表模式 Factory/Registry | 根据数据集编码、关系类型选择策略 | 集中管理策略选择，不在编排 Service 中手工 `new` 或判断 |
| 责任链模式 Chain of Responsibility | 单条 `fee_detail` 入账前校验和处理 | 将配置匹配、币种确定、汇率锁定、关系写入拆成清晰步骤 |
| 状态规则对象 State Policy | 判断账单状态允许的操作 | 统一控制可入账、可替换、可调账、需转后续账单等规则 |

不建议使用：

1. 不对每个小方法建立接口。
2. 不使用复杂事件总线替代当前同步事务流程。
3. 不使用完整状态模式重写所有账单状态；使用集中状态规则对象即可。
4. 不建立通用流程引擎，当前流程用固定模板和处理器链即可表达。

### 6.3 目标代码结构

在现有 `bms/biz` 模块内增加内部实现包，保持六模块依赖关系不变：

```text
com.szt.supplychain.bms.biz.billgenerate
├── context
│   ├── SourceFeeCollectContext
│   ├── BillGenerateContext
│   └── BillFeeRelationContext
├── facade
│   └── BillGenerateServiceImpl                保留现有类和接口
├── template
│   ├── AbstractBillTaskExecutor
│   ├── SourceFeeCollectTaskExecutor
│   ├── BillRelationGenerateTaskExecutor
│   └── BillRecalculateTaskExecutor
├── strategy
│   ├── source
│   │   ├── SourceDatasetReader
│   │   ├── OrderDatasetReader
│   │   └── AdditionalFeeDatasetReader
│   ├── relation
│   │   ├── BillFeeRelationStrategy
│   │   ├── SourceRelationStrategy
│   │   ├── ManualRelationStrategy
│   │   ├── AdjustmentRelationStrategy
│   │   └── ReversalRelationStrategy
│   ├── billtype
│   │   ├── BillTypeStrategy
│   │   ├── MemberArBillTypeStrategy
│   │   ├── CostApBillTypeStrategy
│   │   └── CodRefundBillTypeStrategy
│   └── change
│       ├── SourceChangeHandleStrategy
│       ├── EditableBillChangeStrategy
│       └── ConfirmedBillChangeStrategy
├── registry
│   ├── BillTaskExecutorRegistry
│   ├── SourceDatasetReaderRegistry
│   ├── BillTypeStrategyRegistry
│   └── BillFeeRelationStrategyRegistry
├── processor
│   ├── BillFeeRelationProcessor
│   ├── BillConfigMatchProcessor
│   ├── BillCurrencyResolveProcessor
│   ├── BillExchangeRateLockProcessor
│   └── BillFeeRelationPersistProcessor
├── policy
│   └── BillOperationStatePolicy
└── service
    ├── SourceFeePersistService
    ├── BillFeeRelationService
    └── BillAmountAggregateService
```

说明：

1. 包名和类名可结合现有项目最终确认，但职责边界必须保持。
2. `BillGenerateServiceImpl` 不移动、不改对外接口，只作为门面和任务编排入口。
3. Mapper 仍放在 `dao` 模块，Entity/DTO/Context 放在 `model` 模块或 `biz` 内部包时不得造成反向依赖。
4. Context 只保存一次任务执行需要的数据，不允许继续使用 `Map<String, Object>` 在组件间传递。

### 6.4 模板方法：统一任务执行骨架

现有 `executeTask()` 和 `executeTaskInternal()` 已经具备任务领取、执行和完成处理骨架，应在此基础上抽成模板方法：

```java
public abstract class AbstractBillTaskExecutor {

    @Transactional(rollbackFor = Exception.class)
    public BillGenerateRespDTO execute(BillGenerateTaskDTO task, String operator) {
        validate(task);
        BillGenerateContext context = buildContext(task, operator);
        beforeExecute(context);
        doExecute(context);
        afterExecute(context);
        return buildResult(context);
    }

    protected abstract boolean supports(String triggerType);

    protected abstract void doExecute(BillGenerateContext context);
}
```

不同执行器只实现差异步骤：

| 执行器 | 职责 |
| --- | --- |
| `SourceFeeCollectTaskExecutor` | 从业务源表同步费用到 `fee_detail` 并完成源表打标 |
| `BillRelationGenerateTaskExecutor` | 消费待入账 `fee_detail`，生成账单和费用关联 |
| `BillRecalculateTaskExecutor` | 重算现有账单关联、币种汇总和账单金额 |

`BillGenerateServiceImpl.executeTask()` 调整为：

```java
public BillGenerateRespDTO executeTask(Long taskId, String operator) {
    BillGenerateTaskDTO task = claimAndLoadTask(taskId);
    AbstractBillTaskExecutor executor = billTaskExecutorRegistry.getRequired(task.getTriggerType());
    return executor.execute(task, operator);
}
```

任务状态更新失败时仍沿用当前独立事务处理方式；不要把所有任务状态和业务写入强行放进一个超大事务。

### 6.5 策略和注册表：隔离变化点

#### 来源数据读取策略

复用现有 `fee_source_dataset` 配置，不在 `BillGenerateServiceImpl` 中继续增加源表判断：

```java
public interface SourceDatasetReader {

    String supportedDatasetCode();

    List<SourceFeeRowDTO> readPending(SourceFeeCollectContext context);

    List<SourceFeeRowDTO> readModified(SourceFeeCollectContext context);

    int markSynced(SourceFeeMarkDTO markDTO);
}
```

`SourceDatasetReaderRegistry` 通过 Spring 注入所有实现，按 `datasetCode` 选择，不使用静态工厂和手工实例化。

#### 账单费用关系策略

```java
public interface BillFeeRelationStrategy {

    String supportedRelationType();

    BillFeeRelation build(BillFeeRelationContext context);
}
```

分别处理：

1. 来源费用正常入账 `SOURCE`。
2. 手工补录 `MANUAL`。
3. 调账 `ADJUSTMENT`。
4. 红冲 `REVERSAL`。

`ArBillServiceImpl.manualFee()`、`adjustment()`、`rebuildAdjustment()` 保留入口，但内部统一调用 `BillFeeRelationService.createRelation()`，由注册表选择关系策略。

### 6.6 责任链：清晰表达单笔费用入账

现有 `executeBillGroup()`、`buildFeeBase()` 同时承担配置匹配、币种决策、汇率查询、金额计算和落库，参数较多且依赖 `Map<String, Object>`。调整为固定处理器链：

```text
BillConfigMatchProcessor
  -> BillCurrencyResolveProcessor
  -> BillExchangeRateLockProcessor
  -> BillFeeRelationPersistProcessor
```

统一接口：

```java
public interface BillFeeRelationProcessor {

    void process(BillFeeRelationContext context);

    int order();
}
```

约束：

1. Processor 只完成单一职责，并把结果写入明确 Context 字段。
2. Processor 顺序由代码常量固定，不做后台动态配置。
3. 校验失败直接抛出明确业务异常，终止当前费用关系创建。
4. 最终持久化处理器只写 `bill_fee_detail_relation`，不修改 `fee_detail`。
5. 汇总不放在单笔处理器链中，在一组关系写入完成后统一调用 `BillAmountAggregateService`。

### 6.7 状态规则对象：集中账单操作边界

当前状态校验散落在生成、重跑、补录和调账方法中。新增 `BillOperationStatePolicy`，集中表达规则：

```java
public class BillOperationStatePolicy {

    public void checkCanAppend(String billStatus) {
        // DRAFT / GENERATED
    }

    public void checkCanReplaceRelation(String billStatus) {
        // DRAFT / GENERATED
    }

    public void checkCanAdjust(String billStatus) {
        // DRAFT / GENERATED
    }

    public boolean shouldCreateNextBill(String billStatus) {
        // PENDING_SETTLEMENT / PAID
    }
}
```

状态值必须复用 `common` 模块已有常量或枚举，不能在 Policy 中直接写魔法字符串。

### 6.8 现有方法调整映射

| 现有代码 | 调整方式 | 调整后职责 |
| --- | --- | --- |
| `BillGenerateServiceImpl.generate()` | 保留并精简 | 校验请求、创建任务和快照 |
| `BillGenerateServiceImpl.executeTask()` | 保留并改为门面分发 | 领取任务，通过 Registry 选择任务执行器 |
| `executeTaskInternal()` | 拆入模板执行器 | 不再集中处理所有任务类型 |
| `executeBillGroup()` | 保留第一阶段调用壳，内部逐步委托 | 创建/获取账单，批量调用关系处理链并汇总 |
| `buildFeeBase()` | 删除 Map 构建逻辑 | 改由 `BillFeeRelationContext + Processor` 生成关系 |
| `markSourceWithCompensation()` | 保留并迁入来源同步服务 | 继续负责来源打标和失败补偿 |
| `regenerate()` | 保留接口，调整内部语义 | 创建补采、补入账或重算任务，不回退源表标识 |
| `ArBillServiceImpl.manualFee()` | 保留入口 | 调用 `MANUAL` 关系策略 |
| `ArBillServiceImpl.adjustment()` | 保留入口 | 调用 `ADJUSTMENT/REVERSAL` 关系策略 |
| `ArBillServiceImpl.rebuildAdjustment()` | 保留入口 | 重建账单侧关系，不修改来源费用 |
| `refreshBillAmount()` | 抽取实现 | 统一调用 `BillAmountAggregateService` |

### 6.9 事务边界

所有写操作 Service 必须使用：

```java
@Transactional(rollbackFor = Exception.class)
```

推荐事务边界：

1. 任务创建单独事务。
2. 来源费用批次写入 `fee_detail + bill_source_collect_mark` 使用一个本地事务。
3. 来源库打标使用当前补偿机制，不假设与 BMS 库处于同一事务。
4. 单个账单的关系写入、币种汇总和账单金额刷新使用一个事务。
5. 任务成功、失败、重试状态使用独立事务。
6. 不在同一事务中处理整个任务的所有账单，避免长事务和锁范围过大。

### 6.10 Mapper 调整

重点调整：

1. `BillGenerateMapper.insertFeeDetail` 只写来源费用字段。
2. 新增 `BillFeeDetailRelationMapper`，负责账单费用关联写入和查询。
3. `ArBillMapper` 中所有从 `fee_detail` 汇总账单金额、币种和汇率的 SQL 改为读取 `bill_fee_detail_relation`。
4. `manualFee / adjustment / rebuildAdjustment` 改为写关联表。
5. 删除 `selectSettlementExchangeRatesFromFeeDetail / selectFinancialExchangeRatesFromFeeDetail`，账单汇率只查询 `bill_exchange_rate`。
6. 源表字段名从 `fee_source_dataset` 读取，避免继续硬编码 `bms_billed_flag / bms_bill_no`。
7. 复杂 SQL 调整到 XML，并使用明确 DTO，不新增 `Map<String, Object>` 入参或返回值。

### 6.11 API 和 DTO 调整

账单费用明细响应至少区分：

```text
sourceFeeDetailId       来源费用ID
billFeeRelationId       账单费用关联ID
relationType            来源/补录/调账/红冲
relationStatus          正常/替换/红冲/作废
sourceAmount            来源原始金额
sourceCurrency          来源原始币种
billAmount              账单结算金额
billCurrency            账单结算币种
finAmount               财务本位币金额
finCurrency             财务本位币
sourceVersionNo         来源版本号
```

所有账单侧修改接口必须以 `billFeeRelationId` 为操作对象，不能继续直接修改 `feeDetailId`。

### 6.12 基于现有代码的实施顺序

以下顺序是代码重构和新功能开发顺序，不涉及历史数据迁移：

#### 第一步：建立新模型和统一 DTO

1. 创建 `BillFeeRelation` 实体、DTO 和 `BillFeeDetailRelationMapper`。
2. 创建 `SourceFeeRowDTO`、`SourceFeeMarkDTO`、`BillGenerateContext`、`BillFeeRelationContext`。
3. `BillGenerateServiceImpl` 新增代码禁止继续使用 `Map<String, Object>`。
4. 现有代码暂未调整的 Map 仅允许在原方法内部存在，抽取时逐个替换。

#### 第二步：抽取账单金额汇总

1. 从 `BillGenerateServiceImpl` 和 `ArBillServiceImpl.refreshBillAmount()` 抽取 `BillAmountAggregateService`。
2. 汇总 SQL 直接改为读取 `bill_fee_detail_relation`。
3. 生成、补录、调账、红冲统一调用同一汇总服务。

这是优先抽取项，因为它可以先统一最终金额口径，减少后续各流程重复实现。

#### 第三步：改造单笔费用入账逻辑

1. 用 `BillFeeRelationContext` 替换 `buildFeeBase()` 的 Map 返回值。
2. 将币种决策、汇率锁定、金额计算和关系落库拆成 Processor。
3. `executeBillGroup()` 暂时保留现有分组和循环，只把单笔费用处理委托给处理器链。
4. 验证稳定后删除 `buildFeeBase()` 和旧 `fee_detail` 账单字段写入。

#### 第四步：改造账单侧操作

1. 保留 `manualFee()`、`adjustment()`、`rebuildAdjustment()` 方法签名。
2. 内部改为调用 `BillFeeRelationService`。
3. 通过关系策略处理 `MANUAL / ADJUSTMENT / REVERSAL`。
4. 状态校验统一改为调用 `BillOperationStatePolicy`。

#### 第五步：拆分来源费用同步

1. 从 `executeTaskInternal()` 抽取现有订单、附加费来源查询逻辑。
2. 通过 `SourceDatasetReader` 策略读取不同来源数据集。
3. 将 `markSourceWithCompensation()` 迁入 `SourceFeePersistService`，保留其补偿语义。
4. 来源同步只写 `fee_detail` 和抓取轨迹，不创建账单关系。

#### 第六步：模板化任务执行

1. 在前面组件稳定后，再创建三个任务执行器。
2. 将 `executeTaskInternal()` 中剩余编排逻辑分别移入对应执行器。
3. `executeTask()` 改为通过 `BillTaskExecutorRegistry` 分发。
4. 删除已被执行器替代的内部流程，确保不存在新旧两套任务实现。

#### 第七步：收口和清理

1. `BillGenerateServiceImpl` 最终只保留接口门面、任务创建和任务分发。
2. 删除回退源表标识、直接修改来源费用和从 `fee_detail` 汇总账单的代码。
3. 将复杂 Mapper SQL 调整到 XML。
4. 更新相关接口响应、前端账单详情和测试用例。

每一步完成后都必须验证：

1. 现有公开接口仍可调用。
2. 任务失败状态和错误信息仍可追踪。
3. 重试不会重复写入费用或账单关系。
4. 当前步骤替换的旧逻辑已经删除，不留双实现。

## 7. 直接落地范围

本方案不处理历史数据，不设计数据迁移、双写、兼容视图或灰度切换。

直接落地要求：

1. 按新职责调整 `fee_detail` 表结构。
2. 创建 `bill_fee_detail_relation`。
3. 调整 `bill_source_collect_mark`，删除账单归属字段并增加来源版本字段。
4. 来源费用同步任务只写 `fee_detail` 和来源抓取轨迹。
5. 账单生成、详情、导出、汇总、核销直接读取 `bill_fee_detail_relation`。
6. 补录、调账、红冲和汇率调整直接操作账单费用关联。
7. 删除从 `fee_detail` 读取或更新账单侧字段的代码。

## 8. 验收用例

| 场景 | 前置条件 | 预期结果 |
| --- | --- | --- |
| 首次来源同步 | 源行 `bms_billed_flag = 0` | 新增 `fee_detail`，源行打标为已同步 |
| 首次定时生成账单 | 存在未建立有效关联的 `fee_detail` | 新增账单和关联，不修改来源费用及源表标识 |
| 重复执行任务 | 源行已同步且哈希未变化 | 不新增 `fee_detail`，不新增有效关联 |
| 来源数据发生修改 | 已同步来源行哈希变化 | 新增 `fee_detail` 版本，不覆盖旧版本 |
| 未复核账单接收修改费用 | 原账单 `DRAFT/GENERATED` | 旧关联 `REPLACED`，新版本费用建立新关联 |
| 已复核账单来源变化 | 原账单 `PENDING_SETTLEMENT/PAID` | 原账单不变，进入后续调整流程 |
| 调整结算币种 | 账单可修改 | 只更新或重建关联及汇总，`fee_detail` 不变 |
| 调整财务本位币或汇率 | 账单可修改 | 只重算关联表本位币金额，来源费用不变 |
| 手工补录 | 账单可修改 | 新增 `MANUAL` 关联，允许 `fee_detail_id` 为空 |
| 红冲 | 存在有效来源关联 | 新增负数 `REVERSAL` 关联，原来源费用不变 |
| 源表打标失败 | `fee_detail` 已落库 | `bill_source_collect_mark = FAILED`，重试只补打标 |
| 账单生成失败 | `fee_detail` 已同步成功 | 保留来源费用和源表标识，修复后继续建立账单关联 |
| 账单重跑 | 源表已同步 | 不清空源表标识，不作废来源 `fee_detail` |

## 9. 实施优先级

### P0：模型边界修正

1. 创建 `bill_fee_detail_relation`。
2. 将来源费用同步和账单生成拆为两个独立任务。
3. 账单生成只消费 `fee_detail` 并写关联表。
4. 账单金额和币种汇总切换到关联表。
5. 移除重跑时回退源表标识的逻辑。
6. 调账、红冲、手工补录改为操作关联表。

### P1：来源变化识别

1. `fee_detail` 增加来源版本。
2. `bill_source_collect_mark` 支持版本轨迹。
3. `fee_source_dataset` 配置来源修改时间字段。
4. 增加来源变化识别任务。

### P2：代码和文档清理

1. 停止写入 `fee_detail` 账单侧字段。
2. 删除从 `fee_detail` 查询账单汇率和汇总的逻辑。
3. 清理硬编码源表打标 SQL。
4. 更新账单详情、导出、测试用例和数据库排查文档。

## 10. 最终边界

本次调整完成后，数据职责必须稳定为：

```text
源表已有同步字段
  只负责表达业务源数据是否已被 BMS 费用源数据池首次成功抓取

fee_detail
  只负责保存进入 BMS 的来源费用及其版本

bill_fee_detail_relation
  负责费用属于哪张账单，以及该账单使用的币种、汇率、金额和调整状态

bill_exchange_rate
  负责账单级汇率快照

ar_bill_currency_summary / ar_bill
  负责从有效账单费用关联汇总账单金额
```

任何账单调整都不得再修改或删除来源 `fee_detail`；任何账单重跑都不得再清空源表已有同步标识。
