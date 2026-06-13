# BMS 返款账单数据库设计补充方案

## 1. 设计结论

本轮返款账单数据库设计按以下原则落地：

1. `ar_bill` 继续作为统一账单主表使用，不新增 `refund_bill` 主表。
2. `COD_REFUND` 通过 `ar_bill.bill_type` 区分，与 `MEMBER_AR` 共用主表、汇总表、汇率表、生成任务表。
3. `refund_bill_config` 继续作为返款配置主表，不并回 `bill_config`。
4. `fee_detail`、`main_order`、`bill_source_collect_mark` 继续复用，但需要补字段和索引，支持同一业务单同时进入应收账单和返款账单。
5. `payment_receipt`、`payment_writeoff_detail` 不复用到返款打款场景，返款打款流水仍需独立表。
6. 本方案先不引入 `bill_fee_detail_relation`；在此约束下，一条 `fee_detail` 支持“主账单 + 关联账单”双挂账，典型场景是同时挂一张应收账单和一张返款账单。

## 2. 为什么主表必须复用 `ar_bill`

### 2.1 当前现状

1. 前端返款账单页面已经按照“账单主表 + 币种汇总 + 费用明细 + 汇率 + 打款记录”的结构开发。
2. 最新基线中 `bill_generate_task` 已有 `bill_type` 字段。
3. 最新基线中 `bill_exchange_rate` 已有 `bill_type` 字段。
4. 最新基线中 `bill_config` 也已有 `bill_type` 字段，但返款配置仍独立维护在 `refund_bill_config`。
5. `refund_bill_config` 已经独立成表，并具备版本能力。

### 2.2 复用收益

1. 列表、详情、导出、任务、汇率、审计可以共享一套账单主线。
2. 返款账单和应收账单都能沿用 `bill_no`、账期、客户维度、生成任务、币种汇总的既有结构。
3. 后续如果需要统一账单中心，`bill_type` 已经是自然主轴。

## 3. 设计边界

### 3.0 以最新 `ar_bill.sql` 为准的基线判断

基于你当前更新后的 `aidocs/technical-caliber/sql/ar_bill.sql`，先明确几个事实：

1. `ar_bill` 还没有 `bill_type`，因此主账单层还不能直接承载返款账单。
2. `ar_bill_currency_summary` 还是纯应收口径，没有返款本金、扣减、未回款等金额字段。
3. `fee_detail` 仍然是“账单侧费用快照”模型，不是纯来源费用池。
4. `fee_detail.bill_id`、`fee_detail.bill_config_id` 已放宽为可空，但 `bill_no` 仍然非空，这说明它仍偏向“已经归属到某张账单”的模型。
5. `main_order.order_no` 仍有唯一约束 `uk_main_order_no`，这是同一业务主单无法同时挂应收和返款账单的直接阻塞点。
6. `bill_source_collect_mark` 的唯一键仍未带 `bill_type`，同一来源行无法对两类账单分别留痕。
7. `payment_record` 已经存在，但它是旧接口兼容表，不足以表达返款打款分配。
8. 当前 `fee_detail` 只有一套账单侧字段，因此如果要支持“一条 `fee_detail` 同时关联两张账单”，必须额外补一组关联账单侧字段，不能只补一个关联账单号。

### 3.1 本次明确复用

1. `ar_bill`
2. `ar_bill_currency_summary`
3. `fee_detail`
4. `main_order`
5. `bill_source_collect_mark`
6. `bill_exchange_rate`
7. `bill_generate_task`

### 3.2 本次明确不复用

1. `payment_receipt`
2. `payment_writeoff_detail`
3. `payment_record`

原因很直接：

1. `payment_receipt`、`payment_writeoff_detail` 表达的是“客户向我方付款并核销应收账单”。
2. `payment_record` 只是旧接口兼容收款记录，缺少打款分配、币种汇总分摊、撤销留痕等能力。
3. 返款账单需要的是“我方向客户打款并分配到返款账单”，资金方向完全相反。

### 3.3 本次明确不新增

1. 不新增 `refund_bill`
2. 不新增 `refund_bill_currency_summary`
3. 不新增“货款结算币种子表”
4. 不新增“返款账单费用明细子表”

## 4. 关键复用策略

### 4.1 `ar_bill` 的统一账单类型

建议在 `ar_bill` 增加 `bill_type`，取值至少包括：

| 值 | 含义 |
| --- | --- |
| `MEMBER_AR` | 客户应收账单 |
| `COD_REFUND` | 返款账单 |
| `COST_AP` | 成本应付账单，预留 |

同时约定：

1. `bill_no` 继续是全局唯一。
2. `COD_REFUND` 编号前缀使用 PRD 约定的 `PCB`。
3. `bill_config_id` 继续保留，但在 `COD_REFUND` 下指向 `refund_bill_config.id`。
4. 为避免单靠 `bill_config_id` 产生歧义，需要补 `config_no`、`config_version`、`config_snapshot_json`。

### 4.2 返款账单金额口径

为了尽量复用现有金额字段，主表金额口径建议如下：

| `ar_bill` 字段 | `MEMBER_AR` 语义 | `COD_REFUND` 语义 |
| --- | --- | --- |
| `receivable_amount` | 应收金额 | 应返金额 |
| `paid_amount` | 已核销金额 | 已返金额 |
| `unpaid_amount` | 未核销金额 | 未返金额 |
| `receivable_amount_fin` | 应收本位币金额 | 应返本位币金额 |
| `paid_amount_fin` | 已核销本位币金额 | 已返本位币金额 |

返款账单额外需要、但应收账单没有的金额，单独补字段：

1. `principal_amount`：返款本金
2. `deduction_amount`：直接扣减金额
3. `pending_deduction_amount`：待补扣金额
4. `uncollected_amount`：未回款风险金额
5. `principal_amount_fin`
6. `deduction_amount_fin`
7. `uncollected_amount_fin`

### 4.3 `fee_detail` 的复用原则

本次不新增返款专属费用表，直接复用 `fee_detail`，并约定：

1. `fee_currency` 继续表示原始币种。
2. `bill_currency` 继续表示当前账单结算币种。
3. 在 `COD_REFUND` 场景下，`bill_currency` 即“货款结算币种”。
4. 不再单独拆“货款结算币种表”。
5. 继续沿用当前表里已存在的兼容列体系，例如 `amount_in_fee_currency`、`amount_in_bill_currency`、`exchange_rate_c1`、`exchange_rate_c2`，不在本轮删除。

为满足返款场景，需要补两组关键字段：

1. 主账单侧：
   `bill_type`
   `settlement_role`
2. 关联账单侧：
   `related_bill_id`
   `related_bill_no`
   `related_bill_type`
   `related_bill_config_id`
   `related_settlement_role`

`settlement_role` 建议取值：

| 值 | 含义 |
| --- | --- |
| `RECEIVABLE` | 应收类费用 |
| `REFUND_PRINCIPAL` | 返款本金 |
| `REFUND_DEDUCTION` | 返款扣减 |
| `REFUND_ADJUSTMENT` | 返款调整 |
| `REFUND_UNCOLLECTED` | 未回款风险占位 |

进一步说明：

1. 如果只补 `related_bill_no`，只能表达“这条费项还挂到了另一张账单”。
2. 但只要两张账单的结算币种、账单金额、汇率口径不完全一样，就还必须补关联账单侧的金额快照字段。
3. 因此本方案建议 `fee_detail` 不是只补一个关联账单号，而是补一套“关联账单侧快照”。

### 4.4 主单号与关联单号

你提到“同一条 `fee_detail` 被不同 `ar_bill` 用到时，可以在 `fee_detail` 补订单编号字段记录主单号、关联单号”，这里建议这么处理：

1. `business_order_no` 继续表示主单号。
2. 新增 `related_business_order_no` 表示关联单号。

字段用途：

1. COD 包裹主单与返款关联单同时存在时，保证账单详情可追溯。
2. 某些返款扣减费项来自关联单据而不是主单时，不会覆盖原 `business_order_no`。
3. 后续若需要做“主单视角”和“关联单视角”双链路导出，字段已经具备。

另外，对账单关联本身建议同步采用“主账单 + 关联账单”模式：

1. 现有 `bill_id` / `bill_no` / `bill_config_id` 作为主账单关联。
2. 新增 `related_bill_id` / `related_bill_no` / `related_bill_config_id` 作为第二张账单关联。
3. 典型场景就是同一条 `fee_detail` 同时挂一张 `MEMBER_AR` 和一张 `COD_REFUND`。

这里要刻意区分两个“关联”字段：

1. `related_bill_no` 表示第二张账单的账单号，用来解决“一条 `fee_detail` 同时挂应收账单和返款账单”。
2. `related_business_order_no` 表示第二条业务单号，用来解决主单号和关联单号并存的追溯问题。

## 5. 必须一起调整的表

## 5.1 `ar_bill`

建议补充字段：

| 字段 | 说明 |
| --- | --- |
| `bill_type` | 账单类型 |
| `config_no` | 配置编号快照 |
| `config_version` | 配置版本快照 |
| `config_snapshot_json` | 配置快照 JSON，冻结返款条款、币种矩阵、直接扣减项等 |
| `refund_mode` | `SIGNED` / `RECEIVED`，仅返款账单使用 |
| `principal_amount` | 返款本金 |
| `deduction_amount` | 扣减金额 |
| `pending_deduction_amount` | 待补扣金额 |
| `uncollected_amount` | 未回款金额 |
| `principal_amount_fin` | 返款本金本位币 |
| `deduction_amount_fin` | 扣减金额本位币 |
| `uncollected_amount_fin` | 未回款本位币 |
| `settled_at` | 返款账单结清时间 |

索引调整建议：

1. 原 `uk_ar_bill_period_sector_country` 增加 `bill_type`。
2. 新增 `idx_ar_bill_type_status (bill_type, bill_status, is_deleted)`。
3. 新增 `idx_ar_bill_type_member_period (bill_type, member_code, billing_period_start_date, billing_period_end_date)`。

补充说明：

1. 现有 `bill_status` 字段可以继续复用，但 `COD_REFUND` 的状态枚举值要单独约束在代码层。
2. 现有 `bill_currency` 继续复用为返款账单的“货款结算币种默认口径”；多币种明细仍以下方汇总表为准。

### 5.2 `ar_bill_currency_summary`

这张表继续作为“账单按结算币种汇总表”使用。

建议补充字段：

| 字段 | 说明 |
| --- | --- |
| `bill_type` | 账单类型 |
| `principal_amount` | 返款本金 |
| `deduction_amount` | 直接扣减金额 |
| `pending_deduction_amount` | 待补扣金额 |
| `uncollected_amount` | 未回款金额 |
| `receivable_amount_fin` | 应返本位币金额 |
| `paid_amount_fin` | 已返本位币金额 |
| `unpaid_amount_fin` | 未返本位币金额 |
| `principal_amount_fin` | 返款本金本位币 |
| `deduction_amount_fin` | 扣减本位币 |
| `uncollected_amount_fin` | 未回款本位币 |
| `receipt_account_id` | 收款账户 ID 快照 |
| `receipt_account_name` | 收款账户名称快照 |
| `receipt_account_no_masked` | 收款账号脱敏快照 |

口径约定：

1. `currency` 在 `COD_REFUND` 下即“货款结算币种”。
2. `receivable_amount / paid_amount / unpaid_amount` 在 `COD_REFUND` 下分别表示“应返 / 已返 / 未返”。
3. `summary_status` 不改字段名，但按 `bill_type` 分别解释。
4. 由于当前基线里 `ar_bill_currency_summary` 还没有任何本位币金额字段，所以返款账单需要的本位币汇总字段必须在这里补齐。

推荐状态解释：

| `bill_type` | `summary_status` |
| --- | --- |
| `MEMBER_AR` | `WAITING_PAY / PART_PAID / PAID` |
| `COD_REFUND` | `WAITING_REFUND / PART_REFUNDED / REFUNDED` |

### 5.3 `fee_detail`

建议补充字段：

| 字段 | 说明 |
| --- | --- |
| `bill_type` | 账单类型 |
| `settlement_role` | 结算角色 |
| `related_bill_id` | 关联账单ID |
| `related_bill_no` | 关联账单编号 |
| `related_bill_type` | 关联账单类型 |
| `related_bill_config_id` | 关联账单配置ID |
| `related_settlement_role` | 关联账单结算角色 |
| `related_bill_currency` | 关联账单币种 |
| `related_amount_bill_currency` | 费用金额<关联账单币种> |
| `related_exchange_rate_to_bill` | 原始币种到关联账单币种汇率 |
| `related_exchange_rate_level_to_bill` | 关联账单汇率级别 |
| `related_fin_currency` | 关联账单本位币 |
| `related_amount_fin_currency` | 费用金额<关联账单本位币> |
| `related_exchange_rate_to_fin` | 关联账单币种到本位币汇率 |
| `related_exchange_rate_level_to_fin` | 关联账单到本位币汇率级别 |
| `related_business_order_no` | 关联单号 |

索引建议：

1. 新增 `idx_fee_bill_type (bill_type, bill_id, settlement_role, fee_status)`。
2. 新增 `idx_fee_related_bill_type (related_bill_type, related_bill_id, related_settlement_role, fee_status)`。
3. 新增 `idx_fee_related_bill_no (related_bill_no)`。
4. 新增 `idx_fee_related_order (related_business_order_no)`。

重要约束：

1. 在当前不引入 `bill_fee_detail_relation` 的前提下，一条 `fee_detail` 最多对应两张账单：主账单 + 关联账单。
2. 典型场景是同一条 `fee_detail` 同时挂一张应收账单和一张返款账单。
3. 当只挂一张账单时，`related_bill_*` 全部为空。
4. 当挂两张账单时，主账单侧仍使用现有 `bill_*` 字段，第二张账单侧使用 `related_bill_*` 字段。

补充说明：

1. 当前基线里的 `fee_detail.bill_no` 仍为非空，因此本表依然不适合作为“未归属账单的原始费用池”。
2. 这也意味着本轮方案仍然是“账单侧快照复用”，而不是“来源池 + 关系表”模型。
3. 你的这个场景下，`fee_detail` 不再是“同源复制两条快照”，而是“一条快照同时记录两张账单归属”。

### 5.4 `main_order`

这张表必须一起改，否则返款账单无法和应收账单同时引用同一个业务主单。

当前问题：

1. `main_order.order_no` 上存在唯一约束 `uk_main_order_no`。
2. 同一 `order_no` 一旦已经挂到应收账单，就无法再挂到返款账单。

建议改法：

1. 新增 `bill_type` 字段。
2. 删除唯一键 `uk_main_order_no`。
3. 改为唯一键 `uk_main_order_bill_order (bill_type, bill_no, order_no)`。
4. 额外保留普通索引 `idx_main_order_order_no (order_no)`。

这样可以实现：

1. 同一订单可以同时有一条应收账单快照。
2. 同一订单可以同时有一条返款账单快照。
3. 同一订单在同一张账单内仍然不会重复。

补充说明：

1. 当前基线里 `main_order` 已新增 `customer_no`，返款账单可以直接复用这个客户编号维度，不需要额外补一列。

### 5.5 `bill_source_collect_mark`

当前唯一键为：

`uk_source_collect (source_system, source_table, source_id, collect_type)`

这会导致同一来源行只能归集到一种账单类型。

返款账单接入后，建议：

1. 新增 `bill_type` 字段。
2. 唯一键改为 `uk_source_collect (source_system, source_table, source_id, collect_type, bill_type)`。

这样可以支持：

1. 同一来源订单被应收账单归集一次。
2. 同一来源订单被返款账单再归集一次。
3. 两条归集轨迹互不覆盖。

## 6. 不需要改或只需按既有能力复用的表

### 6.1 `refund_bill_config`

继续独立使用，不并回 `bill_config`。

原因：

1. 返款配置和应收配置的字段集已经分化。
2. 返款配置已具备版本能力。
3. 返款配置里的币种矩阵、直接扣减项、负数处理策略更适合继续保持独立。

### 6.2 `bill_generate_task`

当前 SQL 里已经有 `bill_type`，可以直接复用。

建议规则：

1. `bill_type = MEMBER_AR` 时，`bill_config_id` 指向 `bill_config.id`。
2. `bill_type = COD_REFUND` 时，`bill_config_id` 指向 `refund_bill_config.id`。
3. `bill_config_snapshot_json` 在返款账单下保存返款配置快照。
4. 因为最新基线唯一键 `uk_task_period` 已带 `bill_type`，所以返款任务与应收任务可以天然并行存在，不需要再改这个唯一约束。

### 6.3 `bill_exchange_rate`

当前 SQL 里已经有 `bill_type`，可以直接复用。

返款账单建议沿用以下转换类型：

1. `FEE_TO_BILL`：货款原始币种或费用原始币种转货款结算币种
2. `BILL_TO_FIN`：货款结算币种转财务本位币

补充说明：

1. 最新基线里 `uk_bill_rate` 已带 `bill_type`，所以返款账单与应收账单的同币对汇率快照不会互相冲突。

## 7. 仍然需要新增的表

虽然账单主表复用了 `ar_bill`，但返款打款流水仍建议保留独立表：

1. `refund_payment_record`
2. `refund_payment_allocation`

原因：

1. 返款是“我方向客户付款”，不是“客户向我方付款”。
2. 打款流水、分配状态、撤销语义和应收收款核销不同。
3. 返款打款记录要绑定 `ar_bill_currency_summary` 的返款币种汇总，而不是绑定 `payment_receipt`。
4. 当前基线中的 `payment_record` 只有简单付款记录字段，不足以替代返款打款分配模型。

## 8. 兼容性与迁移建议

### 8.1 兼容老应收账单

1. 所有新增字段对旧 `MEMBER_AR` 数据默认可为空或有默认值。
2. 老应收逻辑只需在查询条件中补 `bill_type = MEMBER_AR`。
3. 老汇总、核销、导出逻辑默认不读取返款专属字段。

### 8.2 返款账单生成策略

1. 返款账单生成时写 `ar_bill.bill_type = COD_REFUND`。
2. 如果费项只归属返款账单，则写 `fee_detail.bill_type = COD_REFUND`。
3. 如果费项同时归属应收账单和返款账单，则主账单侧和关联账单侧分别写入 `bill_*` 与 `related_bill_*`。
4. 返款本金与返款扣减通过 `settlement_role` / `related_settlement_role` 区分。
5. 币种级账户信息写入 `ar_bill_currency_summary` 快照字段。

### 8.3 为什么本轮不直接上 `bill_fee_detail_relation`

1. 现有库里没有这张表。
2. 当前 BMS 代码仍是 `fee_detail` 直挂账单模型。
3. 你当前提出的是“一条 `fee_detail` 同时挂两张账单”，这个场景仍然可以先通过“主账单 + 关联账单”字段组承接。
4. 这次需求重点是尽快补齐返款账单数据库结构，而不是重构整套账单关系模型。

但要明确：

1. 如果未来你要求“一条 `fee_detail` 同时挂 3 张及以上账单”，那就必须上 `bill_fee_detail_relation`。
2. 当前方案只适合“最多两张账单”的固定场景。
3. 本方案是先在现有模型上把“应收账单 + 返款账单双挂账”跑通。

## 9. 本轮建议输出物

本轮建议保留两类文档产物：

1. 当前基线仍保留在 `aidocs/technical-caliber/sql/ar_bill.sql`。
2. 本次目标设计单独放在 `aidocs/technical-caliber/bms/dev-specs` 和 `ddl` 草案里。

这样做的原因是：

1. `ar_bill.sql` 现在描述的是当前库现状。
2. 本次设计还没正式执行，不应直接伪装成“现网最新结构”。

## 10. 关键结论

你这次指出的场景我已经改成如下结论：

1. 同一条 `fee_detail` 允许同时挂两张账单。
2. 这两张账单的承载方式是：主账单字段组 + 关联账单字段组。
3. 只补一个 `related_bill_no` 还不够，必须连同第二张账单的币种、金额、汇率、结算角色一起补。
4. 如果未来要从“两张账单”扩成“任意多张账单”，再升级到 `bill_fee_detail_relation` 模型。
