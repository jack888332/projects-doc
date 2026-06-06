# BMS 账单配置到账单生成全流程测试用例

## 测试对象

- 客户名称：700127
- 客户编码：OG0271
- 会员编码：700127
- 店铺：渣渣辉3号
- 店铺 ID：556490224971067392
- 供应链 ID：1076117217358700544

## 前置清理

1. 清理 `tmall_bms` 中该客户历史账单配置、账单、订单快照、费用明细、生成任务、核销流水。
2. 重置订单源库 `ofp_ofdb1` 的 BMS 计费标记：
   - `sale_order_header_extend.bms_billed_flag = 0`
   - `sale_order_header_extend.bms_bill_no = null`
   - `sale_order_additional_matter.bms_billed_flag = 0`
   - `sale_order_additional_matter.bms_bill_no = null`
   - `sale_order_additional_matter.bms_after_bill_added_flag = 0`

## 测试步骤

1. 打开客户账单配置页面：
   `http://localhost:9528/#/billing/billConfig`
2. 点击“新建账单配置”。
3. 在“选择客户”步骤查询并选择客户 `700127 / OG0271`。
4. 进入“配置账单规则”，保存默认方案：
   - 账单业务场景：集运订单
   - 结算币种：人民币
   - 账期类型：月账单
   - 履约节点：核重出库
   - 生效日期：2026-05-01 至 2026-05-31
   - 合同编号：TEST-OG0271-202605
5. 保存成功后，返回列表确认生成一条默认账单配置。
6. 在账单配置列表点击“生成账单”，选择账期：
   - 开始日期：2026-05-01
   - 结束日期：2026-05-31
7. 打开应收账单页面：
   `http://localhost:9528/#/billing/receivableBill`
8. 查询客户 `700127` 或客户编码 `OG0271`，确认生成账单可见。
9. 点击账单“详情”，确认可查看账单信息、费项汇总、费用明细、订单明细。
10. 打开账单生成任务监控页面：
    `http://localhost:9528/#/billing/billGenerateTask`
11. 查询对应账单配置，确认任务记录成功，并能看到开始时间、结束时间、处理数量和错误信息。

## 预期结果

- `bill_config` 生成一条该客户默认配置，且 `sc_id/shop_id/user_id/member_code/customer_no` 完整。
- `bill_generate_task` 生成一条执行记录，任务状态为成功。
- `ar_bill` 生成一条应收账单。
- `main_order` 写入订单快照，并记录账单归属字段。
- `fee_detail` 写入竖表费用明细。
- 订单源表成功打标，账单编号与生成账单一致。
- 前端页面能从配置列表进入生成账单，并能在应收账单和任务监控页面查看结果。

## 本次验证记录

- 清理时间：2026-05-25
- 清理结果：该客户 BMS 历史配置、账单、费用明细、订单快照、核销流水均已清空。
- 订单源表计费标记：已确认 `bms_billed_flag` 均为 0。
- 页面验证时间：2026-05-25 23:09
- 页面入口：`http://localhost:9528/#/billing/billConfig`
- 保存账单配置结果：
  - `bill_config.id = 8`
  - `config_no = BMS-BC-700127-DEFAULT`
  - `sc_id = 1076117217358700544`
  - `shop_id = 556490224971067392`
  - `user_id = 966342286751428608`
  - `member_code = 700127`
  - `customer_no = OG0271`
- 页面生成账单结果：
  - `bill_id = 5`
  - `bill_no = BMS-BILL-20260525230938-8`
  - `task_id = 5`
  - 拉取订单数：70
  - 计费订单数：65
  - 费用明细数：139
  - 应收金额：81876.22 CNY
- 数据库验证结果：
  - `ar_bill` 已生成一条账单，状态 `GENERATED`。
  - `bill_generate_task` 已生成一条任务，状态 `SUCCESS`，开始时间 `2026-05-25 23:09:38`，结束时间 `2026-05-25 23:09:53`。
  - `main_order` 写入 70 条订单快照。
  - `fee_detail` 写入 139 条费用明细。
  - `bill_source_collect_mark` 写入并标记 65 条主订单来源单据。
  - `ofp_ofdb1.sale_order_header_extend` 已按账单编号打标 65 条。
- 页面验证结果：
  - 应收账单列表可见账单 `BMS-BILL-20260525230938-8`。
  - 列表显示客户 `渣渣辉3号`、店铺 `星际货运(中转)`、账期 `2026/05/01 ~ 2026/05/31`、应收金额 `81,876.22`。
  - 账单详情可打开，账单信息和费用汇总可查看。
  - 费用汇总展示 `COD金额`、`代收货款`、`运费`、`超材费`、`超重费` 等费项小计。
