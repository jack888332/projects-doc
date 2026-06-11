# BMS P0-0 Schema Baseline

## 1. 背景

本文件用于完成 COD 返款账单 P0-0 的数据库与代码摸底。

- 摸底时间：`2026-06-11`
- 数据源：`bms/disconf/download/DS_ds0_conf.properties`
- 目标库：`tmall_bms`
- 查询方式：只读 `SHOW CREATE TABLE` / `SHOW COLUMNS` / `SHOW INDEX`
- 归档 SQL：[p0-0-refund-bill-schema-baseline.sql](d:/lyl/javaProject/tmall-bms/aidocs/technical-caliber/bms/dev-specs/ddl/p0-0-refund-bill-schema-baseline.sql)

## 2. 结论摘要

### 2.1 `fee_detail` 仍是旧的“来源费用 + 账单归属 + 汇率快照”混合模型

当前生产等价库中的 `fee_detail` 仍直接持有以下账单归属字段：

- `bill_id`
- `bill_no`
- `bill_config_id`
- `generate_task_id`
- `exchange_rate_to_bill`
- `bill_currency`
- `amount_bill_currency`
- `exchange_rate_to_fin`
- `fin_currency`
- `amount_fin_currency`

这说明共享关系模型尚未落地，`fee_detail` 还没有收敛成纯来源费用池。返款账单正式生成能力不能假设 `bill_fee_detail_relation` 已可用。

### 2.2 `bill_fee_detail_relation` 当前不存在

基线查询结果：

- 表不存在：`ER_NO_SUCH_TABLE`
- 结论：`bms-bill-generate-adjustment-plan.md` 中的共享关系模型尚未在当前库落地

这也是为什么本轮返款账单实现只能先落 P1/P4 的独立主表、汇总和打款分配能力，不能直接进入 P0-1 / P2 / P3 正式生成链路。

### 2.3 `refund_bill_config` 的历史版本与当前版本唯一约束可用

当前库中 `refund_bill_config` 已具备以下约束：

- `uk_refund_config_version (config_no, version)`
- `uk_refund_config_current (sc_id, shop_id, user_id, member_code, current_version_guard)`

其中 `current_version_guard` 是生成列，仅对 `is_current_version = 1 and is_deleted = 0` 的记录产生非空值。配合 [RefundBillConfig-mapper.xml](d:/lyl/javaProject/tmall-bms/bms/dao/src/main/resources/sqlmap/RefundBillConfig-mapper.xml) 中的 `deactivateCurrentByCustomer` 和 [RefundBillConfigServiceImpl.java](d:/lyl/javaProject/tmall-bms/bms/biz/src/main/java/com/szt/supplychain/bms/biz/service/impl/RefundBillConfigServiceImpl.java) 版本化保存逻辑，可以支持：

- 历史版本保留
- 当前版本唯一
- 编辑时旧版本退为非当前，新版本插入

### 2.4 应收收款核销表不能复用为返款打款表

现有应收收款链路的主表是：

- `payment_receipt`
- `payment_writeoff_detail`

其业务含义是“客户向我方收款，再核销应收账单”，核心字段和状态语义是：

- `receipt_no`
- `receipt_currency`
- `receipt_amount`
- `writeoff_amount`
- `receipt_status = SUBMITTED / CONFIRMED / PART_WRITEOFF / WRITEOFF / VOID`

返款账单需要的是“我方向客户打款，再分配到返款账单币种汇总”，方向完全相反，状态语义也不同。本轮已新增的返款独立模型：

- `refund_payment_record`
- `refund_payment_allocation`

是正确方向，不能复用应收收款核销表。

## 3. 关键表现状

### 3.1 `fee_detail`

现状判断：

- 仍直接绑定账单主表，不是纯来源费用池
- 仍保存账单侧与本位币侧汇率快照
- 仍承担来源快照与账单快照双重职责
- 当前表结构中未见 `is_deleted` 字段，说明其生命周期控制也还未与新关系模型统一

对返款账单的影响：

- 不能直接复用“来源费用池 + 共享关系表”设计
- P2/P3 必须等待 P0-1 落地或明确兼容过渡方案

### 3.2 `bill_config`

现状判断：

- 还是应收账单配置主表
- 唯一约束仍是 `uk_bill_config_version`
- 当前索引仍按 `config_type + is_current_version` 管理

对返款账单的影响：

- 返款配置继续独立使用 `refund_bill_config` 是合理方案
- 不建议把返款配置并回 `bill_config`

### 3.3 `bill_generate_task`

现状判断：

- 当前没有 `bill_type`
- 当前唯一约束仍是 `uk_task_period (bill_config_id, period_start, period_end, trigger_type)`

对返款账单的影响：

- 返款账单生成任务还不能直接接入公共任务框架
- P0-1 需要先补 `bill_type`

### 3.4 `bill_exchange_rate`

现状判断：

- 当前没有 `bill_type`
- 当前唯一约束仍围绕 `bill_id + bill_currency + conversion_currency + conversion_currency_type`

对返款账单的影响：

- 返款账单正式汇率锁定方案还依赖 P0-1 的公共模型扩展

### 3.5 `ar_bill` / `ar_bill_currency_summary`

现状判断：

- 现有应收主表按 `bill_config_id + period + business_sector + destination_country` 唯一
- 币种汇总表按 `bill_no + currency` 唯一

对返款账单的影响：

- 返款账单主表与币种汇总表可以参考应收表设计
- 但返款状态机、金额字段和资金流方向必须独立建模

### 3.6 `refund_bill_config`

现状判断：

- `billing_period_start_days` 已存在
- 当前版本唯一约束已存在
- 代码中已按版本化保存实现，不依赖 `bill_config`

对返款账单的影响：

- P0-0 对返款配置基础能力的门禁已基本满足
- 后续可以直接在此配置表上承接返款账单生成逻辑

## 4. 代码摸底结论

### 4.1 返款配置链路

已存在：

- BMS 端 `RefundBillConfigServiceImpl`
- BMS 端 `RefundBillConfigController`
- 平台端 `BmsRefundBillConfigController`
- 前端配置面板 `RefundBillConfigPanel.vue`

当前判断：

- 代码链路完整
- 版本化保存逻辑完整
- 但“联调通过”仍建议以真实服务启动后的接口验收为准，本次 P0-0 仅能确认代码与表结构已对齐

### 4.2 返款账单页面

已完成盘点，当前页面情况：

- 已接入真实 `/portal/bms/refundBill/*` 接口
- 仍残留 mock 数据、mock 注释和未接入的 `/feeDetail/page`
- 已移除未实现的“重新跑账单 / 红冲调账”操作入口

### 4.3 平台代理层

当前已存在：

- [BmsRefundBillController.java](d:/lyl/javaProject/tmall-bms/platform-admin/web/src/main/java/com/szt/supplychain/platform/admin/web/controller/BmsRefundBillController.java)

已代理：

- `/page`
- `/detail`
- `/confirm`
- `/send`
- `/payment`
- `/export`

## 5. P0-0 仍阻塞的事项

以下事项不能仅靠当前代码与库表摸底完成，仍需产品/数据/架构侧书面确认：

- 手续费计算基数
- 正常签收、非正常签收、退件状态清单
- 签收时间字段与来源系统
- 台湾实际回款数据源与唯一流水号
- 银行汇率与返款业务汇率来源
- 扣减不足时 `NEXT_REFUND_BILL / CURRENT_AR_BILL` 的正式规则
- 返款扣减项在应收页面的展示口径
- 对账自动平账阈值和审批规则
- 共享关系模型 `bill_fee_detail_relation` 的正式落地时间

## 6. 建议

P0-0 可以视为“技术摸底已完成、业务口径待书面冻结”的状态。建议下一步拆成两条并行线：

1. 继续前端和查询侧收尾，完成 P1 剩余联调项。
2. 组织一次 P0-0 评审，把第 5 节未确认项逐条冻结，再进入 P0-1 / P2 / P3。
