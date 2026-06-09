# BMS 周账期红冲、汇率、核销全流程测试用例

## 1. 测试目标

验证测试客户 `700127 / OG0271` 的原账单配置改为周账期后，可以完成以下链路：

- 清理客户历史 BMS 账单数据和源订单计费标记。
- 按 2026 年 5 月生成 4 份周账单。
- 对账单补录不同币种费项，并编辑不同汇率。
- 对账单执行本期红冲、本期订单重整、往期同配置订单重整。
- 账单复核后执行核销收款。

## 2. 测试客户

| 项目 | 值 |
| --- | --- |
| 客户名称 | 渣渣辉3号 |
| 客户编码 | OG0271 |
| 会员编码 | 700127 |
| 供应链 ID | 1076117217358700544 |
| 店铺 ID | 556490224971067392 |
| 用户 ID | 966342286751428608 |
| 账单配置 ID | 8 |
| 账单配置编号 | BMS-BC-700127-DEFAULT |

## 3. 前置处理

1. 将 `bill_config.id = 8` 的 `billing_period_type` 从 `MONTH` 改为 `WEEK`。
2. 清理该客户旧账单数据：
   - `ar_bill`
   - `fee_detail`
   - `main_order`
   - `bill_generate_task`
   - `bill_source_collect_mark`
   - `bill_exchange_rate`
   - `fee_adjustment_order`
   - `payment_receipt`
   - `payment_writeoff_detail`
3. 重置源订单库 `ofp_ofdb1` 中 2026 年 5 月测试订单的计费标记：
   - `sale_order_header_extend.bms_billed_flag = 0`
   - `sale_order_header_extend.bms_bill_no = NULL`
   - `sale_order_additional_matter.bms_billed_flag = 0`
   - `sale_order_additional_matter.bms_bill_no = NULL`
   - `sale_order_additional_matter.bms_after_bill_added_flag = 0`

## 4. 生成账单

调用 `POST /api/bms/billGenerate/generate`，按以下 4 个账期生成：

| 账期 | 账单编号 | 订单数 | 费项数 | 应收金额 |
| --- | --- | ---: | ---: | ---: |
| 2026-05-01 ~ 2026-05-07 | BMS-BILL-20260526165156-8 | 11 | 13 | 11,351.24 |
| 2026-05-08 ~ 2026-05-14 | BMS-BILL-20260526165200-8 | 18 | 36 | 7,164.18 |
| 2026-05-15 ~ 2026-05-21 | BMS-BILL-20260526165206-8 | 27 | 57 | 43,459.36 |
| 2026-05-22 ~ 2026-05-31 | BMS-BILL-20260526165213-8 | 15 | 34 | 19,981.44 |

源订单计费标记验证：`ofp_ofdb1.sale_order_header_extend` 中该客户 2026 年 5 月已有费用并入账的订单打标数量为 66。

## 5. 汇率和补录费项验证

测试账单：`BMS-BILL-20260526165213-8`

操作：

1. 补录 `MANUAL_USD / 手工补录USD测试费`，金额 `10 USD`。
2. 补录 `MANUAL_EUR / 手工补录EUR测试费`，金额 `5 EUR`。
3. 编辑账单汇率：
   - `CNY -> CNY = 1`
   - `USD -> CNY = 7.2`
   - `EUR -> CNY = 7.9`

验证结果：

| 费项 | 币种 | 原币金额 | 汇率 | 折算账单金额 |
| --- | --- | ---: | ---: | ---: |
| MANUAL_USD | USD | 10.00 | 7.2 | 72.00 |
| MANUAL_EUR | EUR | 5.00 | 7.9 | 39.50 |

账单 `BMS-BILL-20260526165213-8` 最终应收金额为 `20,101.94`，复核后已全额核销。

## 6. 红冲和重整验证

测试账单：`BMS-BILL-20260526165200-8`

来源往期账单：`BMS-BILL-20260526165156-8`

操作：

1. 本期红冲：对 `BMS-BILL-20260526165200-8` 登记红冲金额 `-8.88 CNY`。
2. 本期订单重整：选中订单 `PF579733510792200192` 执行本期重整。
3. 往期订单重整：以 `BMS-BILL-20260526165156-8` 为来源账单，选中订单 `JY202604081208565690000116` 执行往期重整。

验证结果：

| 类型 | 调账账期 | 来源账单 | 目标账单 | 金额 |
| --- | --- | --- | --- | ---: |
| REVERSAL | CURRENT | - | - | -8.88 |
| REBUILD | CURRENT | BMS-BILL-20260526165200-8 | BMS-BILL-20260526165200-8 | 0.00 |
| REBUILD | PREVIOUS | BMS-BILL-20260526165156-8 | BMS-BILL-20260526165200-8 | 0.00 |

账单金额验证：

| 项目 | 金额 |
| --- | ---: |
| 初始应收金额 | 7,224.18 |
| 本期红冲金额 | -8.88 |
| 最终应收金额 | 7,215.30 |
| 核销金额 | 7,215.30 |
| 未收金额 | 0.00 |

## 7. 核销验证

| 账单编号 | 核销流水 | 收款单号 | 核销金额 | 状态 |
| --- | --- | --- | ---: | --- |
| BMS-BILL-20260526165200-8 | BMS-WO-1779787385190-303 | BMS-REC-1779787385119-474 | 7,215.30 | NORMAL |
| BMS-BILL-20260526165213-8 | BMS-WO-1779785690834-733 | BMS-REC-1779785690766-505 | 20,101.94 | NORMAL |

## 8. 测试中发现并修复的问题

1. `fee_adjustment_order` 插入接口返回内部错误。
   - 原因：MyBatis 插件会给插入参数注入 `id`，但红冲 Mapper 使用多个 `@Param`，参数对象没有 `id` 字段。
   - 修复：红冲插入改为复用 `BillGenerateMapper.InsertParam` 参数结构。

2. 本期红冲后再执行订单重整，会把红冲金额从账单应收金额中覆盖掉。
   - 原因：账单金额刷新只按 `fee_detail` 合计刷新，未叠加 `this_adjustment_delta_amount / previous_adjustment_delta_amount / late_fee_amount`。
   - 修复：`refreshBillAmountByBillNo` 改为 `费用合计 + 本期调账 + 往期调账 + 滞纳金` 后再刷新应收与未收金额。

## 9. 结论

本次测试通过：

- 原账单配置已切换为周账期。
- 2026 年 5 月已生成 4 份周账单。
- 不同币种费项补录和汇率编辑生效。
- 本期红冲、本期重整、往期同配置重整可执行。
- 复核后的账单可正常登记收款并完成核销。
