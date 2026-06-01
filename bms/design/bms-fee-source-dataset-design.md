# BMS费项来源数据集设计

## 背景

集运订单费用来自 `sale_order_header`、`sale_order_header_extend`、`sale_order_additional_matter` 等来源。原先在 `fee_source_rule` 上直接配置来源表、金额字段和 `source_time_column`，当账单配置选择“核重出库/签收”时，会出现两个歧义：

1. 费项取值表可能是 `sale_order_header_extend`，但归集时间应来自订单主表 `sale_order_header`。
2. 同一个订单类费项不应该每个费项单独配置核重时间/签收时间，否则容易漏配或配错。

## 优化原则

1. `fee_source_dataset` 表达公共来源数据集：主表、关联关系、打标字段、支持的归集时间口径。
2. `fee_source_rule` 只表达费用如何取值：金额字段、币种字段、过滤参数、去重规则。
3. 订单类费用的归集时间跟随账单配置的履约节点：核重出库使用 `sale_order_header.measure_time`，签收使用 `sale_order_header.signed_time`。
4. 附加费类数据只按 `sale_order_additional_matter.create_time` 增量拉取，并固定过滤 `fee_pay_status = waiting_pay`。
5. 同行订单、电商订单按 `sale_order_header.order_type` 区分：同行订单 `YBCK01`，电商订单 `SO`。

## 当前内置数据集

| 数据集 | 主数据 | 用途 |
| --- | --- | --- |
| `CONSOLIDATION_ORDER` | `sale_order_header h LEFT JOIN sale_order_header_extend e` | 集运订单主费用，支持核重出库和签收 |
| `CONSOLIDATION_ADDITIONAL_FEE` | `sale_order_additional_matter a JOIN sale_order_header h` | 集运附加费，只按 `a.create_time` 增量归集，过滤 `a.fee_pay_status = waiting_pay` |

## 页面调整

`/billing/feeItem` 增加“数据源规则”页签，用于维护 `fee_source_dataset`。

“场景费项对应”页签中：

- “来源表”调整为“来源数据集 + 取值表”。
- “增量时间字段”调整为“归集时间口径”。
- 订单类费用显示“跟随账单配置（核重出库、签收）”。
- 附加费类费用显示“增量：a.create_time”。

## 后续生成账单规则

生成账单时按照账单配置的 `contract_node` 选择数据集的时间表达式：

- 主订单 `WEIGHT_OUTBOUND`：使用 `h.measure_time`。
- 主订单 `SIGN`：使用 `h.signed_time`。
- 附加费：使用 `a.create_time`，且只取 `fee_pay_status = waiting_pay`。

这样可以保证配置账单时只选择业务含义，不需要对每个费项重复选择时间字段。
