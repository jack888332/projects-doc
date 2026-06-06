# BMS 应收账单核销设计

## 目标

应收账单核销用于把客户实际收款分摊到一个或多个应收账单，形成可追溯的收款单和核销流水，并同步更新账单的已收、未收和结清状态。

本期先支持人工核销场景：

- 账单列表勾选一个或多个账单后登记收款并核销。
- 支持一笔收款按未收金额顺序分摊到多张账单。
- 支持部分核销、全额核销和多账单核销。
- 支持查看账单详情内的核销流水。
- 支持反核销，把已核销金额退回到账单未收金额。

本期暂不做第三方流水自动认领、银行回单 OCR、跨币种复杂汇兑损益。跨币种核销先要求传入明确汇率，未传时按 1 处理并记录。

## 数据模型

### 收款单 `payment_receipt`

表示客户实际付款记录。

关键字段：

- `receipt_no`：收款单号。
- `sc_id`、`shop_id`、`user_id`、`member_code`：供应链、店铺、客户维度，必须从账单继承。
- `payer_name`：付款方名称。
- `payment_channel`：收款方式，如银行转账、线下收款、其他。
- `receipt_currency`：收款币种。
- `receipt_amount`：收款金额。
- `writeoff_amount`：已核销金额。
- `unwriteoff_amount`：未核销金额。
- `receipt_status`：`SUBMITTED`、`CONFIRMED`、`PART_WRITEOFF`、`WRITEOFF`、`VOID`。
- `paid_at`、`confirmed_at`、`confirmed_by`：付款和确认信息。

### 核销明细 `payment_writeoff_detail`

表示一笔收款分摊到一张账单的一条核销流水。

关键字段：

- `writeoff_no`：核销流水号。
- `receipt_id`、`receipt_no`：关联收款单。
- `bill_id`、`bill_no`：关联账单。
- `sc_id`、`shop_id`、`user_id`、`member_code`：维度冗余，便于按组织和客户查询。
- `writeoff_amount_receipt_currency`：收款币种核销金额。
- `writeoff_amount_bill_currency`：结算币种核销金额。
- `writeoff_amount_fin_currency`：财务本位币核销金额。
- `writeoff_status`：`NORMAL`、`REVERSED`、`VOID`。
- `writeoff_time`、`writeoff_by`：核销时间和操作人。

### 应收账单 `ar_bill`

核销会更新账单金额和状态。

关键字段：

- `paid_amount`：已收金额，按结算币种。
- `unpaid_amount`：未收金额，按结算币种。
- `paid_amount_fin`：已收金额，按财务本位币。
- `bill_status`：核销后按金额更新为 `PART_PAID` 或 `PAID`。

## 状态流

### 收款单

```text
SUBMITTED -> CONFIRMED -> PART_WRITEOFF -> WRITEOFF
                           \-> VOID
```

本期前端“登记收款并核销”会直接创建确认后的收款单。如果收款金额全部分摊，状态为 `WRITEOFF`；如果只分摊部分金额，状态为 `PART_WRITEOFF`。

### 核销明细

```text
NORMAL -> REVERSED
NORMAL -> VOID
```

反核销只允许处理 `NORMAL` 状态的核销流水。

### 应收账单

```text
GENERATED/CONFIRMED -> PART_PAID -> PAID
```

反核销后如果账单仍有已收金额，回到 `PART_PAID`；如果已收为 0，回到 `CONFIRMED`。

## 核销规则

### 多账单分摊

一笔收款核销多张账单时，不能把同一笔金额重复写到每一张账单。

处理方式：

1. 按前端选择顺序读取账单。
2. 计算剩余可核销金额 `remaining_amount`。
3. 当前账单核销金额为 `min(remaining_amount, bill.unpaid_amount)`。
4. 写入一条 `payment_writeoff_detail`。
5. 更新当前账单 `paid_amount`、`unpaid_amount` 和 `bill_status`。
6. 扣减 `remaining_amount`，直到金额用完或账单全部处理完。

### 账单维度约束

同一次核销选择的账单必须属于同一客户维度：

- `sc_id`
- `shop_id`
- `user_id`
- `member_code`

如果后续要支持一笔集团付款跨店铺核销，需要增加集团收款单和跨维度授权规则，不能直接混在本期逻辑里。

### 金额校验

- 核销金额必须大于 0。
- 已结清账单不能再核销。
- 核销金额不能让账单 `unpaid_amount` 小于 0。
- 反核销金额不能让账单 `paid_amount` 小于 0。
- 收款金额大于账单未收合计时，剩余部分保留在 `payment_receipt.unwriteoff_amount`。

### 并发控制

核销和反核销必须在数据库事务中执行。

执行时需要锁定：

- 目标账单行。
- 目标收款单行。
- 目标核销流水行。

MySQL 5.7 下建议使用 `SELECT ... FOR UPDATE`，避免两个财务操作同时核销同一张账单导致已收金额重复增加。

## 接口设计

### 创建核销

```http
POST /api/bms/ar-bill/payment
```

当前先沿用已有接口，语义调整为“登记收款并核销”。

请求字段：

- `billNos`：账单编号列表。
- `amount`：收款金额。
- `currency`：收款币种。
- `paymentChannel`：收款方式。
- `paidAt`：实际收款时间。
- `remark`：备注。
- `operator`：操作人。

返回：

- 本期保持 `Boolean`，后续建议返回 `receiptNo` 和 `writeoffNos`。

### 反核销

```http
POST /api/bms/ar-bill/reverse-payment
```

请求字段：

- `writeoffNo`：核销流水号。
- `reason`：反核销原因。
- `operator`：操作人。

处理：

1. 校验核销流水存在且状态为 `NORMAL`。
2. 锁定账单和收款单。
3. 核销流水置为 `REVERSED`。
4. 回退账单已收、未收和状态。
5. 回退收款单已核销、未核销和状态。

### 账单详情

```http
GET /api/bms/ar-bill/detail?billNo=xxx
```

账单详情返回 `payments`，用于前端“收款记录/核销记录”页签展示。

## 前端设计

### 应收账单列表

批量按钮：

- `复核通过`
- `发送账单`
- `登记收款/核销`

行操作：

- `详情`
- `登记收款`
- `红冲调账`
- `导出明细`

### 登记收款/核销弹窗

信息区：

- 已选账单数。
- 未收合计。
- 收款金额。
- 收款币种。
- 收款方式。
- 实际收款时间。
- 备注。

分摊预览区：

- 账单编号。
- 客户名称。
- 结算币种。
- 未收金额。
- 本次核销金额。
- 核销后未收金额。

默认按选择顺序自动分摊，后续可支持手动修改每张账单本次核销金额。

### 账单详情页

“收款记录”页签显示：

- 核销流水号。
- 收款单号。
- 收款日期。
- 收款方式。
- 收款币种。
- 核销金额。
- 状态。
- 操作人。
- 备注。
- 操作：反核销。

只有 `NORMAL` 状态的核销流水显示反核销按钮。

## 开发拆分

### 第一步：修正现有核销逻辑

- 修正多账单登记收款时金额被重复核销的问题。
- 增加同客户维度校验。
- 收款单金额、已核销金额、未核销金额按真实分摊结果写入。

### 第二步：反核销

- BMS 增加反核销服务方法。
- BMS Feign client 暴露接口。
- platform-admin 转发接口。
- 前端详情页收款记录增加反核销按钮。

### 第三步：交互增强

- 弹窗增加分摊预览。
- 支持手动分摊金额。
- 支持按收款单维度查询核销历史。

