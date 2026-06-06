# BMS 应收账单详情页优化设计

## 1. 背景

当前 `admin_front` 的应收账单详情页已经具备基础能力：

- 账单基础信息展示。
- 费项汇总。
- 费项明细分页查看。
- 调账记录。
- 收款/核销记录。
- 订单费用重新生成。

但页面现在更偏“接口数据查看”，不够像财务实际使用的账单详情。参考原型图后，详情页需要围绕账单审核、费用构成、汇率、调账、订单追溯、核销收款形成一个完整工作台。

## 2. 页面目标

账单详情页要支持财务人员快速完成四件事：

1. 判断账单当前处于什么状态，下一步能做什么。
2. 看清账单金额怎么组成，包括原始费用、调账、滞纳金、实收、未收。
3. 追溯账单费用来自哪些订单、哪些费项、哪些来源单据。
4. 对账单执行复核、发送、登记收款、反核销、汇率编辑、费项补录、红冲调账、订单费用重算、导出明细。

## 3. 页面入口

保留现有入口：

- 应收账单列表点击 `详情`。
- 账单生成任务列表点击账单编号跳转到应收账单后打开详情。
- 核销列表点击账单编号跳转到应收账单详情。

建议后续支持路由参数：

```text
/billing/receivableBill?billNo=BMS-BILL-xxx&openDetail=1
```

页面加载后自动查询并打开指定账单详情，便于从任务监控、核销流水、异常通知跳转。

## 4. 页面结构

详情页建议从当前抽屉升级为“右侧大抽屉或独立详情页”。第一阶段仍可使用抽屉，宽度调整到 `88%`，内容按以下结构重排。

### 4.1 顶部状态与操作区

顶部固定展示：

- 账单编号
- 客户名称 / 客户编码 / 会员编码
- 店铺名称
- 账单状态
- 通知状态
- 账期
- 账单金额
- 未收金额

右侧操作按钮按状态控制：

- 起草中：复核通过、红冲调账、导出明细。
- 待复核：复核通过、红冲调账、导出明细。
- 待结算/部分结算：发送账单、登记收款、红冲调账、导出明细。
- 已结清：导出明细、查看核销、反核销入口。
- 已作废/已冲销：只读。

按钮权限规则：

- 只有 `CONFIRMED`、`PART_PAID` 状态允许登记收款。
- 只有正常核销流水允许反核销。
- 已结清账单不允许继续登记收款，但允许查看核销与反核销。
- 红冲调账需要记录原因、金额、币种、凭证。

### 4.2 核心摘要区

顶部摘要分为两行。

第一行：账单概况

| 字段 | 来源 |
| --- | --- |
| 账单编号 | `ar_bill.bill_no` |
| 账单状态 | `ar_bill.bill_status` 翻译 |
| 客户名称 | `ar_bill.customer_name` |
| 客户编码 | `ar_bill.customer_no` |
| 会员编码 | `ar_bill.member_code` |
| 店铺 | `shop_id` 翻译为店铺名称 |
| 集运目的国 | `destination_country` 翻译为国家/地区 |
| 账期类型 | `billing_cycle_type` 翻译 |
| 账期起止 | `billing_period_start_date` ~ `billing_period_end_date` |
| 账单发送日 | `bill_send_date` |
| 信用期结束日 | `credit_period_end_date` |

第二行：账单金额

| 字段 | 来源 |
| --- | --- |
| 结算币种 | `bill_currency` |
| 原始应收金额 | `initial_receivable_amount_in_bill_currency` |
| 本期调账金额 | `this_bill_amount_adjustment_delta_in_bill_currency` |
| 往期调账金额 | `previous_bill_amount_adjustment_delta_in_bill_currency` |
| 滞纳金 | `late_fee_in_bill_currency` |
| 应收金额 | `receivable_amount_in_bill_currency` |
| 实收金额 | `paid_amount_in_bill_currency` |
| 未收金额 | `unpaid_amount_in_bill_currency` |
| 财务本位币金额 | `receivable_amount_in_fin_currency` |

### 4.3 汇率区

在“账单信息”底部增加“账单汇率”区块，用于解释费用币种、结算币种、财务本位币之间的换算。

汇率不是只读数据，需要支持编辑。账单生成时保存当次汇率快照，详情页展示快照，财务可在账单复核前编辑汇率并重算账单金额。

汇率必须按转换类型分组展示，不允许把结算汇率和财务汇率聚合在同一行：

| 分组 | 来源币种 | 目标币种 | 汇兑方向 | 汇率 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 费项结算汇率 | 费项原始币种 | 费项结算币种 | `MUL` / `DIV` | `FEE_TO_BILL` 锁定汇率 | 独立启停 |
| 财务本位币汇率 | 费项结算币种 | 财务本位币 | `MUL` / `DIV` | `BILL_TO_FIN` 锁定汇率 | 独立启停 |

详情展示直接读取 `bill_exchange_rate` 快照，同一转换类型下每个来源币种、目标币种对独立一行。

编辑规则：

- 只有 `GENERATED`、`CONFIRMED` 前的待复核状态允许编辑汇率；已结清、已作废、已冲销不允许编辑。
- 每个汇兑独立配置启停状态和换算方向；关闭后该汇兑按倍率 `1` 重算，配置行仍保留。
- 打开汇率编辑弹窗时，未启用的不同币种汇兑优先显示账单所属店铺对应方向的启用汇率；仅配置反向店铺汇率时自动取倒数。
- `MUL` 按金额乘锁定汇率换算，`DIV` 按金额除锁定汇率换算。
- 编辑汇率后必须重算该账单下所有关联费项的结算币种金额、财务本位币金额、费项汇总和 `ar_bill` 金额。
- 编辑汇率不要求填写编辑原因，保存时记录操作人和更新时间。
- 不建议直接把汇率只放在 `fee_detail`；应该增加账单级汇率快照表，`fee_detail` 保存最终使用的汇率结果，便于审计和导出。

建议新增表：

```sql
CREATE TABLE bill_exchange_rate_snapshot (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  bill_no varchar(64) NOT NULL COMMENT '账单编号',
  source_currency varchar(16) NOT NULL COMMENT '原币种',
  target_currency varchar(16) NOT NULL COMMENT '目标币种',
  exchange_direction varchar(16) NOT NULL COMMENT '换算方向：TO_BILL结算币种，TO_FIN财务本位币',
  exchange_rate decimal(18,8) NOT NULL COMMENT '锁定汇率',
  source_type varchar(16) NOT NULL DEFAULT 'SYSTEM' COMMENT '来源：SYSTEM系统，MANUAL人工',
  edit_reason varchar(500) DEFAULT NULL COMMENT '人工编辑原因',
  created_by varchar(64) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by varchar(64) DEFAULT NULL,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bill_exchange_rate_snapshot_bill (bill_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='BMS结算汇率快照';
```

## 5. Tab 设计

详情页主体使用 Tab，保留但重组现有内容。

### 5.1 Tab：费用汇总

展示每个费项的小计，来源为当前已有的动态聚合 `fee_detail`：

- 费项编码
- 费项名称
- 费用行数
- 订单数
- 费用币种
- 费用金额
- 结算币种
- 账单金额
- 财务本位币金额
- 操作：查看明细
- 操作：补录费项

说明：

- `feeSummaries` 当前不是独立表，是通过 `fee_detail` 动态聚合出来的。
- 该方式适合保证与明细一致。
- 若后续数据量很大，可增加 `ar_bill_fee_summary` 快照表，在生成账单时落库。

补录费项规则：

- 费用补录入口放在“费用汇总”标题右侧，按钮文案为 `补录费项`。
- 补录对象支持账单级、订单级、尾程包裹级，优先支持订单级。
- 补录字段至少包含：费项、挂靠对象、业务主单号、尾程单号、首程单号、费用币种、原币金额、凭证、备注。
- 补录时按结算汇率快照自动换算结算币种和财务本位币金额。
- 补录成功后插入 `fee_detail`，同时刷新费用汇总和 `ar_bill` 应收金额。
- 已结清账单不允许直接补录影响应收金额的费项；必须走往期冲正进入后续账单，或者先反核销再处理。

### 5.2 Tab：费用明细

费用明细不要一次性展示全部，要分页查询 `fee_detail`。

查询条件：

- 费项
- 订单号
- 尾程单号
- 首程单号
- 来源单据号
- 费用币种
- 是否有凭证

表格字段：

- 费项
- 挂靠对象
- 业务主单号
- 尾程运单号
- 首程运单号
- 来源系统
- 来源表
- 来源单据号
- 费用币种
- 原币金额
- 结算汇率
- 账单金额
- 财务汇率
- 财务本位币金额
- 凭证
- 录入时间
- 录入人
- 操作：订单费用重新生成

### 5.3 Tab：本期调账

本期调账展示当前账单上直接发生的红冲、补差、手工调账。原型里的“本期账单冲正”属于本期调账的一类，需要支持导入冲正和选中明细冲正两种方式。

字段：

- 调账单号
- 费项
- 挂靠对象
- 业务主单号
- 调账原因
- 调账币种
- 调账金额
- 调账后金额
- 结算币种金额
- 财务本位币金额
- 凭证
- 录入人
- 审核状态
- 操作：修改、移除、审核、冲正、重整

状态规则：

- 待审核调账可修改、移除。
- 已审核调账不可修改，只能追加新的反向调账。
- 已结清账单原则上不允许新增影响应收金额的调账，必须走反核销后再调账，或者走专门的后续差异账单。

本期冲正与重整规则：

- 入口放在“本期账单冲正”标题右侧，按钮：`添加`、`导入冲正`、`选中重整`。
- `添加`：手工选择本账单内的订单/费项，录入冲正原因和冲正金额。
- `导入冲正`：下载模板后导入订单号、费项、冲正金额、原因、凭证；导入前做数据校验预览。
- `选中重整`：针对当前账单内已选订单重新按最新费项规则计算，并生成冲正差异行，不直接覆盖原费用行。
- 本期冲正只能作用于当前账单已经包含的订单和费项。
- 重整结果必须保留原始金额、重整后金额、差额、重整原因、操作人。
- 冲正记录通过审核后才影响账单应收金额；未审核时只作为待处理差异展示。

### 5.4 Tab：往期调账

往期调账用于展示历史账单中遗留到本期处理的差异。原型里的“往期账单冲正”需要支持导入冲正和选中历史订单冲正两种方式。

需要区分：

- 来源账单号
- 来源订单号
- 关联费项
- 原结算币种
- 本期冲正币种
- 金额变动
- 审核状态
- 是否已计入当前账单
- 操作：添加、导入冲正、选中重整、审核、移除

后端当前已有 `fee_adjustment_order`，但需要确认是否能表达“来源账单”和“归属本期账单”。如果字段不足，需要补充：

```sql
ALTER TABLE fee_adjustment_order
  ADD COLUMN source_bill_no varchar(64) DEFAULT NULL COMMENT '来源账单编号',
  ADD COLUMN target_bill_no varchar(64) DEFAULT NULL COMMENT '计入目标账单编号',
  ADD COLUMN adjustment_period_type varchar(16) DEFAULT NULL COMMENT '调账账期类型：CURRENT本期，PREVIOUS往期',
  ADD COLUMN source_bill_config_id bigint(20) unsigned DEFAULT NULL COMMENT '来源账单配置ID',
  ADD COLUMN source_main_order_id bigint(20) unsigned DEFAULT NULL COMMENT '来源BMS订单快照ID';
```

往期冲正与重整规则：

- 入口放在“往期账单冲正”标题右侧，按钮：`添加`、`导入冲正`、`选中重整`。
- 往期冲正的前提：被冲正订单必须是同一账单配置之前生成账单的数据。
- 判断口径：
  - `source_bill.bill_config_id = current_bill.bill_config_id`
  - `source_bill.billing_period_end_date < current_bill.billing_period_start_date`
  - `source_order.bill_no = source_bill.bill_no`
  - 来源账单不是已作废或已冲销状态。
- 不允许把其他客户、其他店铺、其他账单配置、未来账期的数据作为往期冲正来源。
- 导入往期冲正时必须校验来源账单号、订单号、费项是否存在，并展示校验结果。
- 往期重整不修改历史账单原始费用，只在当前账单生成一条往期调账记录，保证历史账单可追溯。
- 往期冲正审核通过后计入当前账单应收金额，同时记录 `source_bill_no`、`target_bill_no`、`source_bill_config_id`。

### 5.5 Tab：收款核销

展示该账单相关所有核销流水。

字段：

- 核销流水号
- 收款单号
- 账单编号
- 收款币种
- 核销金额
- 结算币种核销金额
- 财务本位币核销金额
- 收款方式
- 核销状态
- 核销时间
- 核销人
- 备注
- 操作：反核销

规则：

- 反核销只允许 `NORMAL` 状态。
- 反核销成功后要刷新账单金额、核销列表、账单状态。

### 5.6 Tab：涉及订单

展示账单包含的主订单，来源优先使用 BMS 的 `main_order`。

字段：

- 业务主单号
- 客户名称
- 会员编码
- 店铺
- 目的国
- 集运仓
- 核重出库时间
- 签收时间
- 订单金额
- 费用合计
- 归属账单号
- 生成任务号
- 操作：查看费用明细、重新生成费用

建议接口：

```text
POST /portal/bms/arBill/order/page
```

请求：

```json
{
  "billNo": "BMS-BILL-xxx",
  "businessOrderNo": "",
  "destinationCountry": "",
  "pageNo": 1,
  "pageSize": 20
}
```

响应：

```json
{
  "total": 70,
  "records": []
}
```

## 6. 接口设计

### 6.1 账单详情聚合接口

保留当前接口：

```text
GET /portal/bms/arBill/detail?billNo=xxx
```

建议返回结构扩展：

```json
{
  "bill": {},
  "feeSummaries": [],
  "exchangeRates": [],
  "currentAdjustments": [],
  "previousAdjustments": [],
  "payments": [],
  "orderSummary": {
    "orderCount": 70,
    "feeDetailCount": 139,
    "sourceMarkedCount": 65
  }
}
```

兼容当前字段：

- `adjustments` 可保留，前端按 `adjustmentPeriodType` 拆分本期/往期。
- `payments` 继续使用。

### 6.2 费用明细分页接口

当前已有：

```text
POST /portal/bms/arBill/feeDetail/page
```

需要补充查询字段：

- `lastMileWaybillNo`
- `firstMileWaybillNo`
- `sourceBizNo`
- `hasVoucher`

### 6.3 订单分页接口

新增：

```text
POST /portal/bms/arBill/order/page
```

从 `main_order` 查询，必须按 `bill_no` 过滤。

### 6.4 调账接口

当前已有：

```text
POST /portal/bms/arBill/adjustment
```

建议扩展：

- 支持调账对象：账单级、订单级、费项级。
- 支持本期/往期调账标识。
- 支持凭证 URL。
- 支持审核流字段。

建议拆分为更明确的接口：

```text
POST /portal/bms/arBill/adjustment/current/save
POST /portal/bms/arBill/adjustment/previous/save
POST /portal/bms/arBill/adjustment/import/preview
POST /portal/bms/arBill/adjustment/import/confirm
POST /portal/bms/arBill/adjustment/rebuild
POST /portal/bms/arBill/adjustment/audit
```

其中 `adjustment/rebuild` 用于“选中重整”，参数中必须包含 `billNo`、订单号列表、重整范围：`CURRENT` 或 `PREVIOUS`。

### 6.6 汇率编辑接口

新增：

```text
POST /portal/bms/arBill/exchangeRate/save
POST /portal/bms/arBill/exchangeRate/recalculate
```

`exchangeRate/save` 保存汇率快照；`exchangeRate/recalculate` 按当前汇率快照重算账单金额。为了避免半成品数据，实际实现可以合并为一个事务接口：保存汇率后立即重算。

### 6.7 费项补录接口

新增：

```text
POST /portal/bms/arBill/feeDetail/manual/save
```

请求需要包含账单号、费项、挂靠对象、订单号、币种、金额、凭证、备注。后端负责校验账单状态、订单归属、汇率换算和金额回写。

### 6.5 导出接口

保留：

```text
GET /portal/bms/arBill/export?billNo=xxx
```

导出 Excel 结构：

1. 顶部区域：账单信息。
2. 第二块：费项小计。
3. 第三块：订单横向明细。
4. 第四块：调账记录。
5. 第五块：核销流水。

## 7. 数据模型建议

### 7.1 当前可直接复用

- `ar_bill`
- `fee_detail`
- `fee_adjustment_order`
- `payment_receipt`
- `payment_writeoff_detail`
- `main_order`

### 7.2 建议补充

如详情页需要“通知属性”，建议在 `ar_bill` 增加：

```sql
ALTER TABLE ar_bill
  ADD COLUMN notify_status varchar(32) DEFAULT 'NOT_SENT' COMMENT '通知状态：NOT_SENT未通知，SENT已通知，FAILED通知失败',
  ADD COLUMN notify_time datetime DEFAULT NULL COMMENT '最近通知时间',
  ADD COLUMN notify_error varchar(500) DEFAULT NULL COMMENT '最近通知失败原因';
```

这样账单状态不再包含“通知失败”，通知只是账单属性。

如调账需要区分本期/往期：

```sql
ALTER TABLE fee_adjustment_order
  ADD COLUMN source_bill_no varchar(64) DEFAULT NULL COMMENT '来源账单编号',
  ADD COLUMN target_bill_no varchar(64) DEFAULT NULL COMMENT '计入目标账单编号',
  ADD COLUMN adjustment_period_type varchar(16) DEFAULT 'CURRENT' COMMENT 'CURRENT本期，PREVIOUS往期';
```

如支持费项补录，建议在 `fee_detail` 使用已有字段表达，并补充手工来源标识：

```sql
ALTER TABLE fee_detail
  ADD COLUMN manual_flag tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否手工补录：0否，1是',
  ADD COLUMN manual_reason varchar(500) DEFAULT NULL COMMENT '手工补录原因';
```

如支持冲正和重整，建议 `fee_adjustment_order` 补充重整来源：

```sql
ALTER TABLE fee_adjustment_order
  ADD COLUMN rebuild_flag tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否重整生成：0否，1是',
  ADD COLUMN import_batch_no varchar(64) DEFAULT NULL COMMENT '导入批次号',
  ADD COLUMN original_amount decimal(18,4) DEFAULT NULL COMMENT '原金额',
  ADD COLUMN rebuilt_amount decimal(18,4) DEFAULT NULL COMMENT '重整后金额';
```

## 8. 前端实现方案

文件：

```text
admin_front/src/views/billing/receivableBill/index.vue
```

建议拆组件，避免一个文件继续膨胀：

```text
admin_front/src/views/billing/receivableBill/components/ArBillDetailDrawer.vue
admin_front/src/views/billing/receivableBill/components/BillOverviewPanel.vue
admin_front/src/views/billing/receivableBill/components/BillFeeSummaryTable.vue
admin_front/src/views/billing/receivableBill/components/BillFeeDetailDialog.vue
admin_front/src/views/billing/receivableBill/components/BillAdjustmentTable.vue
admin_front/src/views/billing/receivableBill/components/BillPaymentTable.vue
admin_front/src/views/billing/receivableBill/components/BillOrderTable.vue
```

第一阶段可以不拆太细，但至少把详情抽屉拆出去。

## 9. 后端实现方案

### 9.1 BMS client/model

新增 DTO：

- `ArBillExchangeRateDTO`
- `ArBillOrderDTO`
- `ArBillOrderPageReqDTO`
- `ArBillOrderPageRespDTO`
- `ArBillOrderSummaryDTO`

扩展：

- `ArBillDetailRespDTO`

### 9.2 BMS biz/dao

新增 Mapper 查询：

- 结算汇率聚合：从 `fee_detail` group by fee_currency, bill_currency, exchange_rate_to_bill, fin_currency, exchange_rate_to_fin。
- 账单订单分页：从 `main_order` 按 `bill_no` 查询。
- 本期/往期调账拆分：从 `fee_adjustment_order` 查询。

### 9.3 platform-admin

透传新增接口：

- `/portal/bms/arBill/order/page`

## 10. 开发顺序

1. 前端先重排详情页结构，使用现有 `detail`、`feeDetail/page`、`payment/page` 数据。
2. 后端补充订单分页接口，从 `main_order` 查询涉及订单。
3. 后端补充汇率聚合数据，详情接口返回 `exchangeRates`。
4. 调账记录增加本期/往期区分。
5. 实现汇率编辑与重算。
6. 实现费项补录。
7. 实现本期冲正：手工添加、导入、选中重整。
8. 实现往期冲正：同账单配置历史账单校验、导入、选中重整。
9. 账单通知状态从账单状态中拆出为属性。
10. 导出接口按新详情结构优化 Excel。

## 11. 验收标准

账单详情页打开后必须满足：

- 顶部能直接看到客户、账期、状态、应收、实收、未收。
- 费用汇总金额合计等于账单应收基础金额。
- 点击费项明细能分页看到 `fee_detail`。
- 点击涉及订单能看到该账单下 `main_order` 数据。
- 调账记录能区分本期和往期。
- 汇率区支持编辑，编辑后账单金额和费项金额能重算且可追溯。
- 费用汇总支持补录费项，补录后费用明细和账单金额同步刷新。
- 本期账单冲正支持手工添加、导入、选中重整，且只能处理当前账单内订单。
- 往期账单冲正支持手工添加、导入、选中重整，且只能处理同一账单配置之前生成账单的数据。
- 收款核销能看到所有核销流水，并支持正常流水反核销。
- 店铺、业务场景、账期类型、履约节点、国家/地区都显示中文名称，不直接显示编码。
- 所有操作失败时必须提示后端返回的错误原因。
