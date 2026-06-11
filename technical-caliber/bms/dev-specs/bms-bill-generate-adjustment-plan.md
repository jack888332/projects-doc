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
9. `bill_config` 当前默认配置唯一约束和所有配置读写 SQL 必须包含 `bill_type`，否则多账单类型不能上线。
10. 旧 `fee_status` 必须按明确映射迁移：`ADJUSTED` 是有效调账记录，`REPLACED` 仅表示来源版本替换，`REVERSED` 仅表示红冲记录。

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

### 3.0 实施前置：确认生产 `fee_detail` 真实 Schema

当前项目内存在多套互相不一致的 `fee_detail` 定义。在完成生产 Schema 摸底之前，本文 3.1 节描述的字段只能作为目标模型，不能直接据此编写或执行 DDL。

#### 当前已确认的不一致

| 事实来源 | 当前字段体系 | 主要问题 |
| --- | --- | --- |
| `aidocs/technical-caliber/bms/sql/ddl/tmall_bms_backup.sql` | `amount_in_fee_currency / exchange_rate_c1 / amount_in_bill_currency / exchange_rate_c2 / amount_in_fin_currency` | 2026-05-22 备份中的旧生产结构，字段较少，账单归属和来源轨迹能力不足 |
| `FeeDetail.java + FeeDetailMapper.java + FeeDetailMapper.xml` | 使用旧字段命名和旧精简字段模型 | 仍按旧生产结构读写；XML 还使用了疑似拼写错误字段 `voucher_rul` |
| `BillGenerateMapper.insertFeeDetail` | `amount_fee_currency / exchange_rate_to_bill / amount_bill_currency / exchange_rate_to_fin / fin_currency`，并写入大量 `bill_* / source_* / fee_status` 字段 | 与旧实体和 XML 完全不同，依赖扩展后的 `fee_detail` |
| `aidocs/technical-caliber/bms/sql/ddl/init.sql` | 扩展后的新字段体系 | 初始化脚本不等于生产真实结构，不能直接作为生产依据 |

因此当前至少存在两套字段命名：

```text
旧命名：
amount_in_fee_currency
exchange_rate_c1
amount_in_bill_currency
exchange_rate_c2
amount_in_fin_currency

新命名：
amount_fee_currency
exchange_rate_to_bill
amount_bill_currency
exchange_rate_to_fin
amount_fin_currency
```

在未确认真实生产 Schema 前，无法判断：

1. `BillGenerateMapper.insertFeeDetail` 在生产是否可正常执行。
2. `FeeDetailMapper.xml` 是否仍被生产接口调用。
3. 哪套字段需要保留、删除或重命名。
4. 新的来源费用池 DDL 应基于哪套真实结构调整。

#### P0-0 Schema 摸底门禁

开发前必须连接目标生产等价环境执行：

```sql
SELECT DATABASE();
SHOW CREATE TABLE fee_detail;
SHOW FULL COLUMNS FROM fee_detail;
SHOW INDEX FROM fee_detail;

SHOW CREATE TABLE bill_source_collect_mark;
SHOW CREATE TABLE bill_generate_task;
SHOW CREATE TABLE bill_exchange_rate;
SHOW CREATE TABLE bill_config;
SHOW INDEX FROM bill_config;

SELECT fee_status, COUNT(1)
FROM fee_detail
GROUP BY fee_status;
```

同时必须确认：

1. 生产应用当前部署版本及对应 Git commit。
2. `fee_detail` 最近一次成功 DDL 变更记录。
3. `BillGenerateMapper.insertFeeDetail` 是否在生产任务中实际执行成功。
4. `FeeDetailController / FeeDetailService / FeeDetailMapper.xml` 是否仍有真实调用方。
5. `ArBillMapper` 和 `BillGenerateMapper` 中所有直接读写 `fee_detail` 的 SQL。
6. 生产 `bill_config` 当前版本唯一索引的真实名称、列顺序，以及是否包含 `bill_type`。
7. 生产 `fee_detail.fee_status` 是否仅存在 `NORMAL / ADJUSTED / REVERSED / VOID`，以及各状态金额正负分布。

未完成以上摸底前：

1. 禁止执行 `fee_detail` 新 DDL。
2. 禁止直接删除旧字段、实体或 Mapper。
3. 禁止假设 `init.sql` 就是生产结构。
4. 禁止同时维护两套字段命名继续开发。

#### 摸底输出物

摸底完成后必须形成一份 `fee_detail-schema-baseline.md`，至少包含：

| 输出项 | 内容 |
| --- | --- |
| 生产真实 DDL | `SHOW CREATE TABLE fee_detail` 原始结果 |
| 字段差异矩阵 | 生产表、备份 SQL、`init.sql`、旧 Entity/XML、新 Mapper SQL 五方对比 |
| SQL 调用清单 | 每个直接读写 `fee_detail` 的 Mapper 方法、调用入口和是否仍使用 |
| 唯一命名结论 | 明确后续只保留哪一套 Java 属性名和数据库列名 |
| 删除清单 | 确认无调用后删除的实体、DTO、Service、Mapper、XML 和 SQL |
| 重写清单 | 仍有调用但需要改为新模型的查询和写入路径 |

#### 唯一模型收敛原则

生产 Schema 确认后，必须收敛为一套模型：

1. `fee_detail` 只保留来源费用池职责对应字段。
2. 账单归属、结算币种、汇率和换算金额只保存在 `bill_fee_detail_relation`。
3. `FeeDetail.java` 必须与最终 `fee_detail` 一一对应，不允许保留不存在的数据库列。
4. `FeeDetailMapper.xml` 若仍需保留，必须完全按最终 Schema 重写；若无真实调用则删除整个旧调用链。
5. `BillGenerateMapper.insertFeeDetail` 改为明确 DTO 入参，并只写最终来源费用字段。
6. 所有账单详情查询改为 `bill_fee_detail_relation LEFT JOIN fee_detail`。
7. 最终数据库列命名、Entity 属性和 Mapper resultMap 必须形成唯一映射，不再允许 `amount_in_fee_currency` 与 `amount_fee_currency` 两套命名并存。

### 3.1 费项身份与来源规则边界

`fee_index` 和 `fee_source_rule` 不合并。两者分别表达“是什么费用”和“如何从来源数据中取出这笔费用”。

| 模型 | 核心职责 | 是否进入 `fee_detail` 身份 |
| --- | --- | --- |
| `fee_index` | 定义稳定费项身份：`fee_code / fee_name / fee_type / attachment_object` | 是，`fee_index_id + fee_code` 是费用身份 |
| `fee_source_rule` | 定义来源取值方式：数据集、金额字段、币种字段、过滤条件、来源业务键 | 仅保存审计轨迹，不作为稳定费用身份 |
| `business_type_fee_index` | 定义某业务类型允许使用哪些费项 | 影响账单准入，不决定来源如何取值 |
| `bill_config_fee_currency_rule` / 币种模板 | 定义某账单配置中的费项结算币种 | 只影响账单关联，不影响来源费用身份 |

目标关系：

```text
fee_index 1
  -> N fee_source_rule

business_type N
  -> N fee_index

fee_source_rule
  -> 读取来源数据
  -> 生成 fee_detail，并保存 fee_index_id
```

明确规则：

1. 一个 `fee_index` 可以配置多条 `fee_source_rule`，例如“超重费”可以来自订单扩展表、订单主表或附加费表。
2. 一条 `fee_source_rule` 只能指向一个 `fee_index`。
3. `fee_source_rule.fee_code` 只是 `fee_index.fee_code` 的快照；保存规则时必须由 `fee_index` 带出，不允许人工录入不同值。
4. `fee_index` 不再保存具体数据源路径；旧 `data_source / legacy_data_source` 字段仅属于待清理的旧模型。
5. 修改或替换来源规则不能改变费项身份，也不能因为 `fee_source_rule_id` 变化重复生成同一逻辑费用。
6. 同一来源宽数据可以通过多条规则生成多个不同 `fee_index` 的费用。
7. 多条来源规则也可能命中同一个 `fee_index`；是否属于同一逻辑费用必须通过来源费用业务键判断。

#### `business_type_fee_index` 解耦

当前 `business_type_fee_index` 同时保存 `fee_index_id + fee_source_rule_id`，把“业务类型适用费项”和“来源取值规则”混在一起。来源费用同步独立于账单生成后，该关系需要拆开：

```text
business_type_fee_index
  只保留 business_type_code + fee_index_id

fee_source_rule
  通过 dataset_code + 自身过滤条件决定如何同步费用
```

建议调整：

1. 从 `business_type_fee_index` 移除 `fee_source_rule_id`。
2. 唯一键调整为 `business_type_code + fee_index_id`。
3. 来源费用同步任务直接查询当前数据集启用的 `fee_source_rule`，不通过 `business_type_fee_index` 反查来源规则。
4. 账单生成任务使用 `business_type_fee_index` 判断某个 `fee_detail.fee_index_id` 是否允许进入当前业务类型账单。
5. 如果某条来源规则只适用于特定业务类型，应在 `fee_source_rule` 增加明确的 `applicable_business_type_codes`，或通过来源行本身的业务类型过滤，不重新把规则绑定回 `business_type_fee_index`。

#### 来源费用业务键与唯一键

`fee_source_rule_id` 只用于追溯“本次费用由哪条规则生成”，不能直接作为来源费用唯一键。否则停用旧规则并新建等价规则后，会重复生成同一笔费用。

建议在 `fee_detail` 增加：

```text
dataset_code
source_fee_key
fee_source_rule_id
fee_source_rule_version
```

字段含义：

| 字段 | 用途 |
| --- | --- |
| `dataset_code` | 标识来源宽数据所属公共数据集 |
| `source_fee_key` | 标识来源系统中的一笔逻辑费用，由来源规则 `dedupe_key_expr` 计算 |
| `fee_source_rule_id` | 记录本次使用的来源规则，仅用于审计 |
| `fee_source_rule_version` | 固化生成时使用的规则版本 |

推荐唯一键：

```text
source_system
+ dataset_code
+ source_fee_key
+ fee_index_id
+ source_version_no
```

`source_fee_key` 示例：

| 来源场景 | 推荐 `source_fee_key` |
| --- | --- |
| 订单宽表一个金额列对应一笔费用 | `order_id + ':' + source_amount_column` |
| 附加费表一行就是一笔费用 | `additional_fee_id` |
| 同一来源行包含同费项的多个组成部分 | `source_id + ':' + component_code` |

为什么不只使用 `source_id + fee_code`：

1. 同一来源行可能存在两个相同 `fee_code` 的独立费用组成部分。
2. 不同来源规则可能只是同一逻辑费用的新旧取值方式，不应因规则 ID 不同重复生成。
3. `fee_code` 是业务费项身份，无法单独表达来源侧费用业务键。

规则约束：

1. `fee_source_rule.dedupe_key_expr` 必须配置并能够稳定计算 `source_fee_key`。
2. 等价规则替换前后必须生成相同 `source_fee_key`。
3. 确实需要将同一来源行拆成两笔相同费项时，必须提供不同 `component_code`。
4. `fee_source_rule` 规则变化后，来源行哈希或规则版本变化可以生成新 `source_version_no`，但不能产生两个同版本有效费用。
5. `fee_detail.fee_code / fee_name / fee_type` 保存 `fee_index` 快照，实际关联仍以 `fee_index_id` 为准。

### 3.2 `fee_detail`：BMS 费用源数据池

`fee_detail` 调整后的职责：

1. 保存从业务源表抓取进入 BMS 的标准化费用数据。
2. 保存来源身份、业务身份、原始金额、原始币种和来源快照。
3. 保存来源数据版本，支持来源修改后的历史追溯。
4. 不保存具体账单的归属、结算口径和调整结果。
5. 来源数据写入后原则上不可修改；来源变化时新增版本。

应保留或新增的字段分类：

| 分类 | 字段 |
| --- | --- |
| 费用身份 | `id`、`fee_no`、`fee_index_id`、`fee_code`、`fee_name`、`fee_type`、`attached_object` |
| 客户与业务身份 | `sc_id`、`shop_id`、`user_id`、`member_code`、`business_order_no`、目的国、仓库、首尾程单号 |
| 来源身份 | `source_system`、`dataset_code`、`source_table`、`source_id`、`source_fee_key`、`source_order_id`、`source_biz_no`、`source_fee_field`、`source_fee_time` |
| 来源规则审计 | `fee_source_rule_id`、`fee_source_rule_version` |
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
source_system + dataset_code + source_fee_key + fee_index_id + source_version_no
```

不能将 `fee_source_rule_id` 放入唯一键，也不能继续使用无法区分来源费用组成部分的简单 `source_id + fee_code`。

### 3.3 `bill_fee_detail_relation`：账单费用关联及账单侧快照

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
  KEY idx_bill_fee_relation_currency (bill_type, bill_id, bill_currency, relation_status)
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

#### 3.3.1 `fee_status` 到关系模型的唯一映射

生产现有 `fee_detail.fee_status` 取值为 `NORMAL / ADJUSTED / REVERSED / VOID`。新模型不得将旧状态直接等名复制到 `relation_status`，因为旧字段同时混合了“记录业务性质”和“记录是否有效”两种语义。

新模型必须分别使用：

1. `relation_type`：表达该记录是什么，取值 `SOURCE / MANUAL / ADJUSTMENT / REVERSAL`。
2. `relation_status`：表达该记录当前生命周期状态，取值 `NORMAL / REPLACED / REVERSED / VOID`。

迁移映射固定如下：

| 旧 `fee_detail.fee_status` | 新 `relation_type` | 新 `relation_status` | 是否参与有效金额汇总 | 说明 |
| --- | --- | --- | --- | --- |
| `NORMAL` 且 `manual_flag = 0` | `SOURCE` | `NORMAL` | 是 | 正常来源费用 |
| `NORMAL` 且 `manual_flag = 1` | `MANUAL` | `NORMAL` | 是 | 手工补录费用 |
| `ADJUSTED` | `ADJUSTMENT` | `NORMAL` | 是 | 现有调账增量记录；`ADJUSTED` 不映射为 `REPLACED` |
| `REVERSED` | `REVERSAL` | `REVERSED` | 是 | 现有红冲负数记录；通过 `original_relation_id` 指向被红冲记录 |
| `VOID` | 按来源性质映射 | `VOID` | 否 | 已作废记录，仅保留审计 |

`REPLACED` 和 `REVERSED` 的边界必须严格区分：

1. `REPLACED` 仅用于未复核账单中发生来源数据版本切换：旧版本关系退出有效口径，新版本关系重新入账。
2. `REVERSED` 仅用于红冲记录；红冲记录本身必须保留负数金额并参与汇总。
3. 调账记录使用 `relation_type = ADJUSTMENT, relation_status = NORMAL`，不得使用 `REPLACED` 或 `REVERSED` 表达普通调账。
4. 有效金额汇总范围为 `relation_status IN ('NORMAL', 'REVERSED')`；`REPLACED / VOID` 不参与汇总。
5. 被红冲的原关系不改为 `REPLACED`；原关系与负数红冲关系共同参与汇总，才能得到正确净额。

迁移时先落临时映射表，禁止用一条不可追溯的 `INSERT ... SELECT` 直接覆盖：

```sql
CREATE TABLE bill_fee_relation_migration_map (
  legacy_fee_detail_id bigint unsigned NOT NULL COMMENT '旧fee_detail.id',
  relation_id bigint unsigned NOT NULL COMMENT '新账单费用关系ID',
  PRIMARY KEY (legacy_fee_detail_id),
  UNIQUE KEY uk_relation_id (relation_id)
) COMMENT='旧费用明细到新账单费用关系迁移映射';
```

关系类型和状态必须按以下 SQL 表达式生成：

```sql
CASE
  WHEN fd.fee_status = 'ADJUSTED' THEN 'ADJUSTMENT'
  WHEN fd.fee_status = 'REVERSED' THEN 'REVERSAL'
  WHEN fd.manual_flag = 1 THEN 'MANUAL'
  ELSE 'SOURCE'
END AS relation_type,
CASE
  WHEN fd.fee_status = 'REVERSED' THEN 'REVERSED'
  WHEN fd.fee_status = 'VOID' THEN 'VOID'
  ELSE 'NORMAL'
END AS relation_status
```

`original_relation_id` 必须在首轮关系迁移和映射表写入完成后回填：

```sql
UPDATE bill_fee_detail_relation r
JOIN bill_fee_relation_migration_map current_map
  ON current_map.relation_id = r.id
JOIN fee_detail legacy_fd
  ON legacy_fd.id = current_map.legacy_fee_detail_id
JOIN bill_fee_relation_migration_map original_map
  ON original_map.legacy_fee_detail_id = legacy_fd.original_fee_id
SET r.original_relation_id = original_map.relation_id
WHERE legacy_fd.original_fee_id IS NOT NULL;
```

迁移校验必须至少包含：

```sql
-- 不允许出现未知旧状态
SELECT fee_status, COUNT(1)
FROM fee_detail
WHERE fee_status NOT IN ('NORMAL', 'ADJUSTED', 'REVERSED', 'VOID')
GROUP BY fee_status;

-- REVERSED 按红冲负数记录迁移；若查询有结果，必须先人工确认，禁止直接迁移
SELECT id, bill_no, fee_no, amount_bill_currency, original_fee_id
FROM fee_detail
WHERE fee_status = 'REVERSED'
  AND amount_bill_currency > 0;

-- 按账单对比迁移前后有效金额；两侧结果必须一致
SELECT bill_no, SUM(amount_bill_currency)
FROM fee_detail
WHERE fee_status <> 'VOID'
GROUP BY bill_no;

SELECT bill_no, SUM(amount_bill_currency)
FROM bill_fee_detail_relation
WHERE relation_status IN ('NORMAL', 'REVERSED')
GROUP BY bill_no;
```

### 3.4 多账单类型扩展边界

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
10. `bill_config` 默认配置、分支配置和当前版本的唯一性及匹配维度必须包含 `bill_type`；同一客户可以分别拥有应收、成本和返款默认配置。
11. 账单配置匹配顺序必须先按 `bill_type` 隔离配置组，再在该类型内执行分支优先、默认兜底。

#### 3.4.1 `bill_config` 当前版本唯一约束调整

当前 `BillConfigServiceImpl.buildBillConfig()` 在未传 `bill_type` 时默认写入 `MEMBER_AR`。生产当前版本唯一约束若仍为：

```text
sc_id + shop_id + user_id + member_code + is_current_version
```

则同一客户创建第二种账单类型的当前配置时必然冲突。多账单类型上线前，必须先完成索引调整和存量数据清理，禁止先发布应用代码再补 DDL。

目标约束不是“同一客户只能有一个当前配置”，而是：

```text
同一 sc_id + shop_id + user_id + member_code + bill_type
只能有一个未删除的当前 DEFAULT 配置；
允许存在多个当前 BRANCH 配置和多个历史版本。
```

由于 MySQL 普通联合唯一键会同时限制历史版本和分支配置，推荐使用生成列只约束当前默认配置：

```sql
-- 1. 先确认并记录生产旧唯一索引名称；以下按 uk_bill_config_current 示例
SHOW INDEX FROM bill_config;

-- 2. 存量空账单类型按当前代码默认语义回填为 MEMBER_AR
UPDATE bill_config
SET bill_type = 'MEMBER_AR'
WHERE bill_type IS NULL OR TRIM(bill_type) = '';

-- 3. 执行前必须保证该查询无结果；若有重复，业务确认保留项后将其他记录置为非当前版本
SELECT sc_id, shop_id, user_id, member_code, bill_type, COUNT(1) AS duplicate_count
FROM bill_config
WHERE config_type = 'DEFAULT'
  AND is_current_version = 1
  AND is_deleted = 0
GROUP BY sc_id, shop_id, user_id, member_code, bill_type
HAVING COUNT(1) > 1;

-- 4. 删除不含 bill_type 的旧当前版本唯一索引
ALTER TABLE bill_config
  DROP INDEX uk_bill_config_current;

-- 5. 仅对“未删除的当前默认配置”生成非 NULL 唯一标识；历史版本和分支配置返回 NULL
ALTER TABLE bill_config
  ADD COLUMN current_default_guard tinyint
    GENERATED ALWAYS AS (
      CASE
        WHEN config_type = 'DEFAULT' AND is_current_version = 1 AND is_deleted = 0 THEN 1
        ELSE NULL
      END
    ) STORED COMMENT '当前默认配置唯一约束辅助列',
  ADD UNIQUE KEY uk_bill_config_current_default (
    sc_id, shop_id, user_id, member_code, bill_type, current_default_guard
  );
```

如果生产旧唯一索引名称不是 `uk_bill_config_current`，第 4 步必须替换为 `SHOW INDEX` 查到的真实名称；如果生产仅有普通索引，则跳过第 4 步并在变更单中记录真实索引差异，不得盲目执行 `DROP INDEX`。

存量数据处理规则：

1. `bill_type` 为空的存量配置统一回填 `MEMBER_AR`，因为当前代码默认值和已有账单链路均为客户应收。
2. 同一客户同一 `bill_type` 存在多个当前默认配置时，不允许脚本自动按最大 ID 删除；必须结合已生成账单、任务和生效时间确认保留项，其余记录置 `is_current_version = 0`。
3. 每个分支配置的 `bill_type` 必须与其父默认配置一致；不一致记录必须修正后才能上线。
4. `config_no + version` 仍保持全局唯一时，自动生成的 `config_no` 必须包含 `bill_type`；否则不同账单类型仍会命中 `uk_bill_config_version`。
5. 索引变更后再插入 `COST_AP / COD_REFUND` 默认配置，旧 `MEMBER_AR` 配置不得被停用。
6. 一旦已创建多账单类型当前默认配置，不能直接回滚为不含 `bill_type` 的旧唯一索引；回滚前必须先停用新增类型配置并重新执行重复检查。

代码调整门禁：

1. `queryCurrentDefault`、`queryCurrentByCustomer`、默认/分支配置匹配查询必须增加 `bill_type` 入参和过滤条件。
2. `disableOtherCurrentDefaults`、`deactivateCurrentDefaults`、`disableCurrentBranches`、`deactivateCurrentBranches` 必须增加 `bill_type` 条件，禁止跨账单类型停用配置。
3. `buildConfigNo()` 生成默认配置编号时必须包含 `bill_type`，或明确保证调用方传入全局唯一编号。
4. `BillGenerateMapper.queryEnabledDefaultConfigs()` 和任务创建逻辑必须按 `bill_type` 分组并写入任务快照。
5. 完成以上代码调整前，即使数据库索引已放开，也不得开放多账单类型配置入口。

### 3.5 `bill_exchange_rate` 和币种汇总

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
WHERE bill_type = 'MEMBER_AR'
  AND bill_id = ?
  AND relation_status IN ('NORMAL', 'REVERSED')
GROUP BY bill_id, bill_no, bill_currency;
```

`ar_bill` 的应收和本位币金额同样从有效关联记录及币种汇总刷新，不再直接汇总 `fee_detail`。成本账单和返款账单使用各自的账单主表、币种汇总表及汇总策略。

### 3.6 `bill_source_collect_mark` 调整

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

来源费用同步任务负责把业务源系统中已经具备费用含义的数据同步为 BMS 公共费用源数据。该任务只解决“哪些来源费用进入 `fee_detail`”，不决定费用进入哪种账单。

#### 4.1.1 同步边界

来源费用同步与账单生成必须彻底解耦：

| 来源费用同步任务负责 | 来源费用同步任务不负责 |
| --- | --- |
| 按数据集连接和读取业务源表 | 不按应收、成本、返款等账单类型筛选 |
| 判断来源行是否已具备同步条件 | 不按 `bill_config` 的账期筛选 |
| 按启用的 `fee_source_rule` 拆分标准费用 | 不决定费用属于哪张账单 |
| 保存来源原始金额、币种和业务身份 | 不决定客户结算币种和财务本位币 |
| 保存来源版本、抓取轨迹和幂等标识 | 不查询或锁定账单汇率 |
| 回写源表已有同步标识 | 不写 `bill_fee_detail_relation` |

同步任务按 `fee_source_dataset` 运行，不按 `bill_config` 运行。同一份 `fee_detail` 后续可以被应收、成本、返款等不同账单类型分别消费。

#### 4.1.2 同步配置来源

每次同步只读取启用状态的数据集及来源规则：

```text
fee_source_datasource
  -> fee_source_dataset
  -> fee_source_rule
```

配置职责：

| 配置 | 决定内容 |
| --- | --- |
| `fee_source_datasource` | 从哪个数据库连接读取 |
| `fee_source_dataset.main_table / join_sql` | 来源宽数据如何组成 |
| `fee_source_dataset.base_where_expr` | 数据集公共有效性条件 |
| `fee_source_dataset.billed_flag_column` | 首次同步标识字段 |
| `fee_source_dataset.initial_sync_time_column` | 首次同步时间游标字段 |
| `fee_source_dataset.modified_time_column` | 来源变化扫描时间字段 |
| `fee_source_dataset.query_window_days / query_page_size` | 查询窗口和分页大小 |
| `fee_source_rule` | 一条来源宽数据如何拆成费用、金额和币种如何读取 |

当前 `fee_source_dataset` 缺少统一的首次同步游标字段，建议增加：

```sql
ALTER TABLE fee_source_dataset
  ADD COLUMN initial_sync_time_column varchar(255) DEFAULT NULL
  COMMENT '首次同步时间表达式，必须使用源表已有可索引时间字段';
```

配置示例：

| 数据集 | `initial_sync_time_column` | `modified_time_column` | 公共过滤条件 |
| --- | --- | --- | --- |
| `CONSOLIDATION_ORDER` | 使用订单已有的费用准备时间或更新时间字段 | 使用订单已有更新时间字段 | 订单有效、未删除 |
| `CONSOLIDATION_ADDITIONAL_FEE` | `a.create_time` | 使用附加费已有更新时间字段 | `a.fee_pay_status = 'waiting_pay'` |

订单数据集具体使用哪个已有字段作为首次同步时间，必须由业务确认“该时间点之后费用字段已经具备可同步条件”。不能继续由某张账单配置的 `contract_node` 临时决定。

#### 4.1.3 数据范围

一次来源费用同步任务的数据范围由以下维度共同确定：

```text
dataset_code
+ source_system / datasource_code / source_database
+ initial_sync_time_column 的时间窗口 [window_start, window_end)
+ billed_flag_column = 未同步
+ base_where_expr
+ 来源主键游标
```

明确规则：

1. 只处理 `fee_source_dataset.enabled = 1` 的数据集。
2. 只使用 `fee_source_rule.enabled = 1` 且绑定当前 `dataset_code` 的规则拆分费用。
3. 不按 `bill_config`、`bill_type`、账期或账单状态过滤来源数据。
4. 不只拉取已有账单配置客户的数据；只要数据集和来源规则启用，就进入公共费用池。
5. 数据隔离字段 `sc_id / shop_id / user_id / member_code` 必须能从来源宽数据解析，否则该行同步失败。
6. `base_where_expr` 只保存稳定的公共业务条件，例如有效状态、未删除和附加费待支付状态。
7. 费项特有过滤条件使用 `fee_source_rule.filter_params_json`，不得污染数据集公共条件。
8. `bill_no_column` 不参与同步范围判断。

当前内置数据集的首次同步条件等价于：

```sql
-- 订单主数据集
WHERE COALESCE(e.bms_billed_flag, 0) = 0
  AND {initial_sync_time_column} >= #{windowStart}
  AND {initial_sync_time_column} <  #{windowEnd}

-- 附加费数据集
WHERE COALESCE(a.bms_billed_flag, 0) = 0
  AND a.fee_pay_status = 'waiting_pay'
  AND a.create_time >= #{windowStart}
  AND a.create_time <  #{windowEnd}
```

所有时间条件必须使用左闭右开区间，不允许在 WHERE 列上使用日期格式化函数。

#### 4.1.4 时间窗口和同步游标

每个数据集独立维护同步游标，建议新增 `fee_source_sync_checkpoint`：

```sql
CREATE TABLE fee_source_sync_checkpoint (
  id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  dataset_code varchar(64) NOT NULL COMMENT '来源数据集编码',
  sync_type varchar(32) NOT NULL COMMENT '同步类型：INITIAL/MODIFIED',
  checkpoint_time datetime NOT NULL COMMENT '已完成同步的时间游标',
  checkpoint_source_id varchar(128) DEFAULT NULL COMMENT '同一时间点已完成的来源主键游标',
  last_task_id bigint unsigned DEFAULT NULL COMMENT '最近成功任务ID',
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_dataset_sync_type (dataset_code, sync_type)
) COMMENT='来源费用同步游标';
```

##### `windowStart / windowEnd` 来源

`windowStart / windowEnd` 是来源费用同步窗口，不是账单账期。它们按 `dataset_code + sync_type` 独立计算，不读取 `bill_config.billing_period_type`，也不使用账单的 `billing_period_start_date / billing_period_end_date`。

每个数据集必须维护两条互不影响的同步游标：

| `sync_type` | 扫描对象 | `windowStart` 来源 | 使用的时间字段 |
| --- | --- | --- | --- |
| `INITIAL` | 尚未同步到 BMS 的来源行 | `INITIAL checkpoint_time` | `initial_sync_time_column` |
| `MODIFIED` | 已同步后又发生修改的来源行 | `MODIFIED checkpoint_time` | `modified_time_column` |

两条游标不能共用。首次同步窗口已经越过某条数据后，该数据后续发生修改，由 `MODIFIED` 窗口重新拉取。

这里必须区分两类时间：

| 时间范围 | 使用任务 | 解决的问题 |
| --- | --- | --- |
| 来源同步窗口 `windowStart / windowEnd` | 来源费用同步任务 | 本次应该扫描源库中哪些新增或变化的数据 |
| 账单账期 `billing_period_start_date / billing_period_end_date` | 账单生成任务 | 已进入 `fee_detail` 的费用最终归入哪一期、哪一种账单 |

来源同步不能直接使用某张账单的账期作为唯一拉取范围，原因如下：

1. `fee_detail` 是应收、成本、返款等账单类型共享的费用源数据池，不属于某一张账单。
2. 同一笔费用可能进入不同账单类型，而这些账单类型的账期可能不同。例如应收按月、返款按周。
3. 来源数据可能迟到。费用业务发生时间属于五月账期，但来源数据在六月才创建或更新；若六月同步任务仍只拉六月账期，将永远漏掉这笔费用。
4. 新增账单配置或账单类型时，来源费用可能已经同步到 `fee_detail`，无需重新回扫业务源库。
5. 来源同步时间字段表达“数据何时准备好供 BMS 读取”，账单归属时间字段表达“费用业务上属于哪个期间”，两者不是同一含义。

示例：

```text
费用业务发生时间 source_fee_time：2026-05-30
来源记录最终准备完成时间：2026-06-03

来源同步任务：
使用同步窗口 [2026-06-03 00:00:00, 2026-06-04 00:00:00)
将费用同步到 fee_detail

应收账单生成任务：
根据 source_fee_time = 2026-05-30
判断费用属于五月账期或按账单规则进入后续调整账单
```

因此，两个任务的查询边界分别为：

```sql
-- 来源费用同步：按来源数据准备/变化时间扫描
WHERE initial_sync_time_column >= #{windowStart}
  AND initial_sync_time_column <  #{windowEnd}
  AND billed_flag_column = 0

-- 账单生成：按账单归属时间和账单配置消费 fee_detail
WHERE BillTypeStrategy.resolveBillingAttributionTime(fee_detail) >= #{billingPeriodStart}
  AND BillTypeStrategy.resolveBillingAttributionTime(fee_detail) <  #{billingPeriodEnd}
  AND 当前账单类型策略判断该费用允许入账
```

需要强调：来源同步任务仍然会保存账单归属所需的业务时间，例如 `source_fee_time`、订单签收时间、核重时间、回款时间等。账单类型策略根据自己的归集节点，从这些来源时间快照中选择账单归属时间。

如果强制使用账单账期直接拉取业务源表，会使“来源同步”和“账单生成”重新耦合，`fee_detail` 也不再是真正的公共费用池。本方案不采用该方式。

任务创建时先固定：

```text
task_cutoff_time = 当前时间 - safe_delay_minutes
```

然后按以下规则确定窗口：

```text
windowStart = 本次需要处理的起点
windowEnd   = MIN(windowStart + query_window_days, task_cutoff_time)
```

不同场景的 `windowStart` 来源：

| 场景 | `windowStart` 来源 | `windowEnd` 来源 |
| --- | --- | --- |
| 数据集首次启用，不同步启用前数据 | 数据集启用时间或人工初始化时间 | `MIN(windowStart + query_window_days, task_cutoff_time)` |
| 数据集首次启用，需要指定起点补采 | 人工配置的 `initial_start_time` | `MIN(windowStart + query_window_days, task_cutoff_time)` |
| 正常定时续跑 | `fee_source_sync_checkpoint.checkpoint_time` | `MIN(windowStart + query_window_days, task_cutoff_time)` |
| 窗口执行失败重试 | 原失败任务快照中的 `window_start` | 原失败任务快照中的 `window_end`，不得重新计算 |
| 手工补跑指定时间段 | 手工请求的 `manual_start_time` | `MIN(manual_end_time, windowStart + query_window_days)` |
| 来源变化识别任务 | `MODIFIED` 类型 checkpoint | `MIN(windowStart + query_window_days, task_cutoff_time)` |

建议为 `fee_source_dataset` 增加首次启动配置：

```sql
ALTER TABLE fee_source_dataset
  ADD COLUMN initial_start_time datetime DEFAULT NULL
  COMMENT '首次同步起点；为空时首次启用默认从启用时间开始，不回扫此前数据',
  ADD COLUMN safe_delay_minutes int NOT NULL DEFAULT 5
  COMMENT '同步安全延迟分钟数，避免读取仍在提交或更新中的来源数据',
  ADD COLUMN modified_lookback_minutes int NOT NULL DEFAULT 10
  COMMENT '修改扫描回看分钟数，用于避免边界竞争导致漏数';
```

首次创建 checkpoint 时：

```text
INITIAL checkpoint_time
  = initial_start_time 有值 ? initial_start_time : 数据集启用时间

MODIFIED checkpoint_time
  = 数据集启用时间
```

如果启用时需要识别此前已经同步但后续可能变化的数据，应由人工明确设置 `MODIFIED checkpoint_time`，不能默认全量回扫。

示例：

```text
数据集：CONSOLIDATION_ADDITIONAL_FEE
initial_start_time：2026-06-01 00:00:00
query_window_days：1
safe_delay_minutes：5
任务创建时间：2026-06-10 10:00:00

task_cutoff_time = 2026-06-10 09:55:00

第一个窗口：
windowStart = 2026-06-01 00:00:00
windowEnd   = 2026-06-02 00:00:00

后续连续窗口：
[2026-06-02 00:00:00, 2026-06-03 00:00:00)
...
[2026-06-10 00:00:00, 2026-06-10 09:55:00)
```

checkpoint 推进规则：

1. 每个窗口使用左闭右开区间 `[windowStart, windowEnd)`。
2. 当前窗口全部完成后，将 `checkpoint_time` 更新为当前 `windowEnd`。
3. 下一窗口的 `windowStart` 直接取上一次成功窗口的 `windowEnd`，保证时间连续且不重叠。
4. 窗口执行失败时，不推进 `checkpoint_time`。
5. 重试必须使用原任务快照中的窗口，不使用当前时间重新计算，避免扩大或缩小失败范围。
6. 手工补跑不修改正常 `INITIAL / MODIFIED` checkpoint，避免破坏定时任务连续性。
7. 当 `windowStart >= task_cutoff_time` 时，本次没有可同步窗口，任务直接结束。

##### 已同步数据修改后如何再次拉取

假设来源行首次创建于 `2026-06-01 10:00:00`，首次同步完成后：

```text
bms_billed_flag = 1
INITIAL checkpoint 已推进到 2026-06-02 00:00:00
```

该来源行在 `2026-06-05 15:30:00` 被修改，来源表已有更新时间字段同步更新：

```text
updated_at = 2026-06-05 15:30:00
```

此时：

1. `INITIAL` 任务不会再拉取该行，因为 `bms_billed_flag = 1`。
2. `MODIFIED` 任务按 `modified_time_column = updated_at` 扫描 `2026-06-05 15:30:00` 所在窗口。
3. `MODIFIED` 查询不要求 `bms_billed_flag = 0`，它专门扫描已经同步或可能发生变化的数据。
4. 系统重新计算来源行 `source_row_hash`。
5. 新哈希与最近一次 `bill_source_collect_mark.source_row_hash` 相同则跳过。
6. 哈希不同则新增一条 `fee_detail` 来源版本，并更新最近采集轨迹。
7. 后续由账单生成或账单侧调整任务处理新版本费用，不回退源表同步标识。

修改扫描查询示例：

```sql
SELECT ...
FROM {main_table}
{join_sql}
WHERE {modified_time_column} >= #{windowStart}
  AND {modified_time_column} <  #{windowEnd}
  AND {base_where_expr}
ORDER BY {modified_time_column}, {source_id_column}
```

注意：

1. 修改扫描不能添加 `billed_flag_column = 0` 条件，否则已同步数据永远无法再次被拉取。
2. `modified_time_column` 必须在来源数据任何影响费用的字段发生变化时同步更新。
3. 来源数据修改和 `modified_time_column` 更新必须处于同一事务。
4. 如果源表没有可靠的更新时间字段，也没有变更日志、消息或上游主动通知，则系统无法可靠识别已同步数据被修改。
5. 对没有可靠修改时间的数据集，必须先补充上游变更能力，不能通过反复全表扫描或清空 `bms_billed_flag` 兜底。

为避免更新时间相同、数据库提交延迟或任务边界竞争导致漏数，`MODIFIED` 扫描建议使用短时间回看：

```text
modifiedQueryStart = MODIFIED checkpoint_time - modified_lookback_minutes
```

例如 `modified_lookback_minutes = 10`。回看窗口可能重复读取数据，但通过 `source_row_hash + source_version_no` 幂等判断不会重复生成费用版本。`MODIFIED checkpoint_time` 仍只向前推进，不回退。

窗口生成规则：

1. `window_start` 取该数据集 `INITIAL` 类型的 `checkpoint_time`。
2. `window_end = MIN(window_start + query_window_days, task_cutoff_time)`。
3. `task_cutoff_time` 在任务创建时固定，执行期间新增的数据留到下一次任务。
4. 默认 `query_window_days = 1`，即按自然时间连续拆分窗口。
5. 一个窗口全部分页处理成功后，才推进 `checkpoint_time`。
6. 窗口内部分页失败时不推进窗口游标，重试从已保存的 `checkpoint_source_id` 继续。
7. 为避免来源事务尚未提交或数据仍在更新，`task_cutoff_time` 应预留可配置安全延迟，例如只同步当前时间之前若干分钟的数据。
8. 不允许每次任务直接扫描所有 `bms_billed_flag = 0` 数据。
9. `initial_sync_time_column` 必须表达“来源费用已具备首次同步条件”的时间，而不能随意使用早于费用准备完成的创建时间。
10. 来源行在旧窗口结束后才满足公共过滤条件时，必须通过 `modified_time_column` 变化扫描重新进入同步流程。

如果首次启用数据集时不需要同步历史数据，初始 `checkpoint_time` 直接设置为启用时间，不回扫启用时间之前的数据。

#### 4.1.5 分页与稳定排序

来源查询必须使用稳定排序和游标分页：

```text
ORDER BY initial_sync_time_column ASC, source_id ASC
```

下一页条件：

```sql
AND (
     {initial_sync_time_column} > #{lastTime}
     OR (
          {initial_sync_time_column} = #{lastTime}
          AND {source_id_column} > #{lastSourceId}
     )
)
LIMIT #{queryPageSize}
```

规则：

1. 禁止对大表使用不断增大的 `OFFSET` 分页。
2. `source_id_column` 必须由数据集明确配置或约定为主表主键。
3. `query_page_size` 使用数据集配置，当前默认值为 `500`。
4. 每页处理完成后保存页级游标。
5. 同一来源行只能由一个分片处理；分片规则必须稳定，不能因任务重试改变。

#### 4.1.6 一条来源行如何拆分费用

来源查询按数据集读取宽数据，一条来源行可以根据多条启用的 `fee_source_rule` 拆成多条 `fee_detail`：

```text
来源宽数据行
  -> 匹配当前 dataset_code 下启用的 fee_source_rule
  -> 校验 filter_params_json
  -> 读取 source_amount_column
  -> 读取 source_currency_column 或默认来源币种
  -> 标准化为 fee_detail
```

生成规则：

1. 金额字段为空或金额为 `0` 时，该规则不生成 `fee_detail`。
2. `ARD` 等扣减类来源费用在标准化时保存明确费用性质；不得由某类账单生成任务反向修改来源金额。
3. 来源币种必须按来源规则取得，禁止使用任一账单配置币种兜底。
4. 每条生成费用必须保存 `dataset_code / source_fee_key / fee_index_id / fee_source_rule_id / fee_source_rule_version / source_system / source_table / source_id / source_row_hash / source_version_no`。
5. 一条来源行匹配多条费用规则时，所有费用共享同一来源行版本；每条规则必须计算稳定的 `source_fee_key`。
6. 规则处理顺序使用 `fee_source_rule.priority ASC, id ASC`，但不同费项规则可以同时生成，不采用先到先得排斥。
7. 多条规则生成相同 `fee_index_id + source_fee_key` 时，只允许生成一笔费用；若金额或币种结果不一致，当前来源行进入 `RULE_CONFLICT` 待处理状态，不允许静默选择其中一条。

首次同步 `fee_detail` 幂等键：

```text
source_system
+ dataset_code
+ source_fee_key
+ fee_index_id
+ source_version_no
```

#### 4.1.7 来源行处理结果

一条来源行处理完成后必须得到明确结果：

| 结果 | 条件 | 是否写 `fee_detail` | 是否回写 `billed_flag_column = 1` |
| --- | --- | --- | --- |
| `COLLECTED` | 至少成功生成一条费用，且该来源行所有应生成费用均落库成功 | 是 | 是 |
| `NO_AMOUNT` | 已匹配启用规则，但所有金额均为空或为 `0` | 否 | 是 |
| `NO_RULE` | 当前数据集没有任何可匹配启用规则 | 否 | 否 |
| `RULE_CONFLICT` | 多条规则生成相同逻辑费用但金额、币种或费项快照不一致 | 否 | 否 |
| `INVALID` | 缺少来源主键、数据隔离字段、来源币种等必要字段 | 否 | 否 |
| `FAILED` | 查询、转换、落库或源表打标失败 | 视失败阶段而定 | 否或进入补偿 |

说明：

1. `NO_AMOUNT` 必须记录跳过原因后打标，否则同一空金额数据会被每次任务重复扫描；后续来源金额变化由来源变化识别任务处理。
2. `NO_RULE` 不打标，并写入来源费用待处理队列；新增规则后由待处理重放任务重新处理。
3. `RULE_CONFLICT` 不打标，并记录冲突的规则 ID、金额和币种结果，必须修正规则后重放。
4. `INVALID` 不打标，并写入来源费用待处理队列；数据修复或人工触发后重新处理。
5. 一条来源行拆出的费用必须整体成功，禁止只写入部分费用后直接打标。

建议新增 `source_fee_collect_pending` 保存游标已经越过但尚未完成同步的来源行：

```text
dataset_code
+ source_system
+ source_table
+ source_id
+ pending_reason
+ pending_status
+ retry_count
+ source_snapshot_json
```

`NO_RULE / RULE_CONFLICT / INVALID / FAILED` 记录进入待处理队列后，主同步窗口允许继续推进。新增来源规则、修复数据或技术重试时，优先重放待处理队列，不能依赖重新扫描已经越过的历史时间窗口。

#### 4.1.8 事务、打标和重试边界

单条来源行或小批次处理顺序：

```text
读取来源宽数据
  -> 拆分并校验全部费用
  -> 在 BMS 本地事务中写 fee_detail
  -> 写 bill_source_collect_mark
  -> 提交 BMS 本地事务
  -> 回写源表 billed_flag_column
  -> 更新 mark_status = MARKED
```

约束：

1. BMS 本地事务失败时，不回写源表同步标识。
2. BMS 数据已提交但源表打标失败时，`bill_source_collect_mark = FAILED`，补偿任务只补源表打标。
3. 补偿打标成功前，不重复写入 `fee_detail`；通过费用幂等键防止重复。
4. 一个来源行处理失败，不应回滚同窗口中已成功提交的其他来源行。
5. 只有窗口内所有页均已读取并完成分类，且失败记录已经写入待处理队列后，才能推进窗口 checkpoint。
6. 对长期无法修复的待处理项必须支持人工标记为忽略，并记录原因。

#### 4.1.9 完整处理顺序

```text
加载启用 fee_source_dataset 和 fee_source_rule
  -> 读取 dataset INITIAL checkpoint
  -> 固定 task_cutoff_time
  -> 按 query_window_days 生成 [window_start, window_end)
  -> 按 initial_sync_time_column + source_id 游标分页读取未同步来源行
  -> 对每条来源行执行规则匹配和费用拆分
  -> 写 fee_detail 和 bill_source_collect_mark
  -> 回写 billed_flag_column
  -> NO_RULE / INVALID / FAILED 写入待处理队列
  -> 处理打标失败补偿
  -> 当前窗口全部完成后推进 checkpoint
  -> 继续下一窗口，直到 task_cutoff_time
```

不得在服务代码中为每个源表重复硬编码字段名；来源表差异通过 `fee_source_dataset` 配置和 `SourceDatasetReader` 策略处理。

### 4.2 任务二：来源变化识别任务

职责：

1. 按 `fee_source_dataset.modified_time_column` 扫描来源发生变化的数据，包括已同步后变化和旧窗口结束后才满足同步条件的数据。
2. 计算最新 `source_row_hash`。
3. 来源行尚未生成过 `fee_detail` 时，按首次同步规则处理。
4. 已有费用版本且哈希未变化时跳过。
5. 已有费用版本且哈希变化时新增 `fee_detail` 版本。
6. 根据原账单状态决定替换原关联或生成后续调整。

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
3. 当前 `BillTypeStrategy` 选择的账单归属时间落在本次任务账期内。
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
3. 来源数据固定币种时，读取 `fee_source_rule.default_source_currency` 或数据集默认来源币种配置。
4. 最终仍无法取得币种时，来源费用同步失败，不允许以未知币种进入账单。

来源原始金额和来源币种写入 `fee_detail` 后不允许被账单生成或账单调整修改。

来源费用同步任务独立于具体账单类型，因此禁止使用 `bill_config.billing_currency` 作为来源币种兜底，否则同一笔费用进入应收、成本或返款账单时会丢失真实来源币种。

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

以上是所有账单类型可复用的基础换算链路。返款账单等特殊类型需要返款业务汇率、银行汇率或其他计算汇率时，由 `BillTypeStrategy.calculate()` 增加专用汇率类型和计算快照，不修改 `fee_detail`。

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

    LocalDateTime resolveBillingAttributionTime(FeeDetail feeDetail, BillGenerateContext context);

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
  -> 根据 bill_config.bill_type 获取 BillTypeStrategy
  -> 由策略判断费用准入、结算角色、账期和分组
  -> 由策略匹配或创建对应类型账单
  -> 执行公共币种规则和基础汇率处理
  -> 由策略执行账单类型专用计算
  -> 写 bill_fee_detail_relation
  -> 由策略刷新对应账单主表、币种汇总和统计字段
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
只处理 当前账单类型主表
       bill_fee_detail_relation
       bill_exchange_rate
       当前账单类型币种汇总表
       当前账单类型调整记录
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
source_system + dataset_code + source_fee_key + fee_index_id + source_version_no

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

1. 先根据 P0-0 Schema 摸底结果确认 `fee_detail` 唯一字段命名体系。
2. 清理或重写旧 `FeeDetail.java / FeeDetailMapper.java / FeeDetailMapper.xml / FeeDetailService` 调用链。
3. 修正旧 XML 中 `voucher_rul` 等与最终生产 Schema 不一致的字段。
4. `BillGenerateMapper.insertFeeDetail` 只写来源费用字段，并改为明确 DTO 入参。
5. 新增 `BillFeeDetailRelationMapper`，负责账单费用关联写入和查询。
6. `ArBillMapper` 中所有从 `fee_detail` 汇总账单金额、币种和汇率的 SQL 改为读取 `bill_fee_detail_relation`。
7. `manualFee / adjustment / rebuildAdjustment` 改为写关联表。
8. 删除 `selectSettlementExchangeRatesFromFeeDetail / selectFinancialExchangeRatesFromFeeDetail`，账单汇率只查询 `bill_exchange_rate`。
9. 源表字段名从 `fee_source_dataset` 读取，避免继续硬编码 `bms_billed_flag / bms_bill_no`。
10. 复杂 SQL 调整到 XML，并使用明确 DTO，不新增 `Map<String, Object>` 入参或返回值。
11. 拆分 `FeeIndexMapper` 中混合查询：费项主数据、来源规则、业务类型费项关系、币种模板分别使用明确 Mapper 或明确方法边界。
12. 来源同步查询直接返回 `FeeSourceRule`，不得通过 `business_type_fee_index` 拼成账单生成专用的 `FeeCollectRule`。
13. 账单生成查询只读取 `business_type_fee_index + fee_index` 判断费用准入，不携带 `fee_source_rule_id`。
14. 币种模板和账单费项币种规则以 `fee_index_id` 为关联主键，`fee_code` 只作快照和展示。

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

以下顺序同时覆盖结构调整、存量数据迁移和代码切换。历史数据必须先完成可校验迁移，不能在没有迁移方案的情况下直接切换读写模型：

#### 第零步：完成数据库门禁和存量数据迁移准备

1. 完成 P0-0 生产 Schema 摸底并输出 `fee_detail-schema-baseline.md`。
2. 确认 `bill_config` 生产当前版本唯一索引，并按 3.4.1 完成 `bill_type` 回填、重复检查和索引调整。
3. 统计生产 `fee_status`，确认仅存在 `NORMAL / ADJUSTED / REVERSED / VOID`。
4. 准备并演练 `fee_detail -> bill_fee_detail_relation` 迁移脚本、迁移映射表、金额对账 SQL 和回滚脚本。
5. 迁移演练未通过前，禁止切换账单详情、汇总、导出和核销查询。

#### 第一步：建立新模型和统一 DTO

1. 确认唯一字段命名，清理或重写僵尸 `FeeDetail` 实体、Mapper、XML 和 Service。
2. 创建 `BillFeeRelation` 实体、DTO 和 `BillFeeDetailRelationMapper`。
3. 创建 `SourceFeeRowDTO`、`SourceFeeMarkDTO`、`BillGenerateContext`、`BillFeeRelationContext`。
4. `BillGenerateServiceImpl` 新增代码禁止继续使用 `Map<String, Object>`。
5. 现有代码暂未调整的 Map 仅允许在原方法内部存在，抽取时逐个替换。

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

本方案不长期保留双写、兼容视图或新旧两套实现，但必须处理 `bill_config` 和 `fee_detail` 存量数据。上线采用“停写窗口内迁移、对账通过后一次切换”的方式；未完成迁移和对账不得直接落地。

直接落地要求：

1. 先完成生产 Schema 摸底，确认 `fee_detail` 真实结构、`fee_status` 分布、`bill_config` 唯一索引和唯一命名体系。
2. 先调整 `bill_config` 当前默认配置唯一约束，并将所有配置查询、停用和版本切换 SQL 增加 `bill_type` 条件。
3. 按新职责调整 `fee_detail` 表结构。
4. 创建 `bill_fee_detail_relation` 和 `bill_fee_relation_migration_map`。
5. 按 3.3.1 映射迁移现有 `NORMAL / ADJUSTED / REVERSED / VOID` 数据，并完成账单金额对账。
6. `bill_fee_detail_relation`、`bill_exchange_rate` 和 `bill_generate_task` 增加 `bill_type` 维度。
7. 为来源固定币种场景增加 `fee_source_rule.default_source_currency` 或等价数据集配置。
8. 调整 `bill_source_collect_mark`，删除账单归属字段并增加来源版本字段。
9. 来源费用同步任务只写 `fee_detail` 和来源抓取轨迹。
10. 账单生成、详情、导出、汇总、核销直接读取 `bill_fee_detail_relation`。
11. 补录、调账、红冲和汇率调整直接操作账单费用关联。
12. 删除从 `fee_detail` 读取或更新账单侧字段的代码。
13. 清理确认无调用的僵尸实体、Mapper、XML、Service 和 Controller。

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
| 多账单类型默认配置 | 同一客户已有 `MEMBER_AR` 当前默认配置 | 可新增 `COST_AP / COD_REFUND` 当前默认配置，原应收配置不被停用 |
| 同账单类型重复默认配置 | 同一客户同一 `bill_type` 已有当前默认配置 | 数据库唯一约束拒绝新增第二条当前默认配置 |
| 存量 `ADJUSTED` 迁移 | 存在调账增量费用 | 迁移为 `ADJUSTMENT + NORMAL`，参与金额汇总，不误标为 `REPLACED` |
| 存量 `REVERSED` 迁移 | 存在红冲负数费用 | 迁移为 `REVERSAL + REVERSED`，关联原关系并参与金额汇总 |
| 来源版本替换 | 未复核账单中的来源费用产生新版本 | 仅旧版本关系置 `REPLACED`，不使用 `REVERSED` |
| 迁移金额对账 | 完成关系表存量迁移 | 每张账单迁移前 `fee_status <> 'VOID'` 金额等于迁移后有效关系金额 |

## 9. 实施优先级

### P0-0：生产 Schema 真相确认

1. 执行 `SHOW CREATE TABLE fee_detail` 等生产等价环境摸底 SQL。
2. 输出 `fee_detail-schema-baseline.md` 和字段差异矩阵。
3. 确认 `BillGenerateMapper.insertFeeDetail` 与旧 `FeeDetailMapper.xml` 的实际调用情况。
4. 摸底 `fee_index / fee_source_rule / business_type_fee_index` 生产关系、重复规则和 `dedupe_key_expr` 配置情况。
5. 摸底 `bill_config` 当前版本唯一索引、空 `bill_type`、重复当前默认配置和分支父子账单类型一致性。
6. 统计 `fee_detail.fee_status` 及金额正负分布，确认状态迁移映射无未知值。
7. 确认最终唯一数据库字段命名、Java 模型和来源费用业务键规则。
8. 在该阶段完成前，禁止执行本方案中的 `fee_detail` DDL、`bill_config` 索引调整和代码结构调整。

### P0：模型边界修正

1. 调整 `bill_config` 当前默认配置唯一约束，并使配置读写 SQL 全部按 `bill_type` 隔离。
2. 清理或重写僵尸 `fee_detail` Entity、Mapper、XML 和 Service。
3. 解耦 `fee_index / fee_source_rule / business_type_fee_index`，统一以 `fee_index_id` 表达费项身份。
4. 为来源规则补齐稳定 `dedupe_key_expr`，生成 `source_fee_key`。
5. 创建 `bill_fee_detail_relation`，按唯一映射迁移存量 `fee_status` 并完成金额对账。
6. 将来源费用同步和账单生成拆为两个独立任务。
7. 账单生成只消费 `fee_detail` 并写关联表。
8. 账单金额和币种汇总切换到关联表。
9. 移除重跑时回退源表标识的逻辑。
10. 调账、红冲、手工补录改为操作关联表。

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
