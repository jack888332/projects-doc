# BMS费项来源数据集设计

## 背景

集运订单费用来自 `sale_order_header`、`sale_order_header_extend`、`sale_order_additional_matter` 等来源。原先在 `fee_source_rule` 上直接配置来源表、金额字段和 `source_time_column`，当账单配置选择“核重出库/签收”时，会出现两个歧义：

1. 费项取值表可能是 `sale_order_header_extend`，但归集时间应来自订单主表 `sale_order_header`。
2. 同一个订单类费项不应该每个费项单独配置核重时间/签收时间，否则容易漏配或配错。

## 优化原则

1. `fee_source_dataset` 表达公共来源数据集：主表、关联关系、打标字段、支持的归集时间口径。
2. `fee_source_rule` 只表达费用如何取值：金额字段、币种字段、过滤参数、去重规则。
3. 订单类费用的归集时间跟随账单配置的履约节点：核重出库使用 `sale_order_header.measure_time`，签收使用 `sale_order_header.signed_time`；返款账单在回款模式下可额外配置 `received_time_column` 作为回款时间口径。
4. 附加费类数据只按 `sale_order_additional_matter.create_time` 增量拉取，并固定过滤 `fee_pay_status = waiting_pay`。
5. 同行订单、电商订单按 `sale_order_header.order_type` 区分：同行订单 `YBCK01`，电商订单 `SO`。
6. 源数据查询拆分规则沉到 `fee_source_dataset`：`query_window_days` 控制每次查询窗口天数，`query_page_size` 控制分页条数，不再放到公共配置文件。

## 当前内置数据集

| 数据集 | 主数据 | 用途 |
| --- | --- | --- |
| `CONSOLIDATION_ORDER` | `sale_order_header h LEFT JOIN sale_order_header_extend e` | 集运订单主费用，支持核重出库和签收 |
| `CONSOLIDATION_ADDITIONAL_FEE` | `sale_order_additional_matter a JOIN sale_order_header h` | 集运附加费，只按 `a.create_time` 增量归集，过滤 `a.fee_pay_status = waiting_pay` |

默认查询策略：`query_window_days = 1` 按自然日拆分，`query_page_size = 500` 分页拉取。不同来源数据集可以单独调整，避免所有来源共用一份隐藏配置。

账单订单宽表使用 `OFP_DB`；尾程包裹补全使用独立 `CXMS_DB`。CXMS 补全是订单查询后的批量关联步骤，不作为单条费项 SQL 的跨库 JOIN。两个数据源可使用同一只读账号，但必须分别配置 JDBC URL、默认数据库和查询超时。

## 页面调整

`/billing/feeItem` 增加“数据源规则”页签，用于维护 `fee_source_dataset`。

“场景费项对应”页签中：

- “来源表”调整为“来源数据集 + 取值表”。
- “增量时间字段”调整为“归集时间口径”。
- 订单类费用显示“跟随账单配置（核重出库、签收、回款）”。
- 附加费类费用显示“增量：a.create_time”。
- 费用类型补充 `非费项`：该类费项允许被扫描并挂到账单明细，但不进入账单核销汇总金额。

## 后续生成账单规则

生成账单时按照账单配置的 `contract_node` 选择数据集的时间表达式：

- 主订单 `WEIGHT_OUTBOUND`：使用 `h.measure_time`。
- 主订单 `SIGN`：使用 `h.signed_time`。
- 返款主订单 `RECEIVED`：优先使用数据集配置的 `received_time_column`。
- 附加费：使用 `a.create_time`，且只取 `fee_pay_status = waiting_pay`。
- 当费项索引类型为 `非费项` 时，仍写入 `fee_detail` 并关联账单展示，但 `ar_bill_currency_summary` 和账单应收/未收汇总不累计该金额。

这样可以保证配置账单时只选择业务含义，不需要对每个费项重复选择时间字段。
