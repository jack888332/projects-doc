# BMS COD 返款账单开发方案（含开发计划）

## 1. 开发结论

本轮返款账单开发按以下原则实施：

1. 物理表层复用 `ar_bill`、`ar_bill_currency_summary`、`fee_detail`、`main_order`、`bill_source_collect_mark`，通过 `bill_type = COD_REFUND` 承载返款账单。
2. 代码层不直接把返款账单塞进现有 `ArBillServiceImpl` 分支判断里，而是新增独立的 `RefundBill` 业务链路，避免把应收账单和返款账单逻辑继续揉在一起。
3. `refund_bill_config` 继续作为返款账单的唯一配置来源，返款账单生成时只读取该表当前有效版本并做快照冻结。
4. `refund_payment_record`、`refund_payment_allocation` 作为返款打款与分配专属流水表独立新增，不复用 `payment_receipt`、`payment_writeoff_detail`。
5. 同一条 `fee_detail` 允许同时关联一张应收账单和一张返款账单，返款账单查询与明细展示必须同时识别主账单字段组和关联账单字段组。

本方案建议分 4 个阶段推进：

1. `P0`：DDL、实体、枚举、Mapper 基础改造。
2. `P1`：返款账单查询、详情、导出、复核、发送、登记打款闭环。
3. `P2`：返款账单生成链路接入 `bill_generate_task` 与账单归集逻辑。
4. `P3`：前后端联调、回归测试、数据迁移与上线。

## 2. 当前基线

### 2.1 已有基础

当前仓库里已经具备以下返款能力基础：

1. `refund_bill_config` 表已经存在，且版本化保存链路已完成。
2. BMS 已有 `RefundBillConfigRemoteService`、`RefundBillConfigController`、`RefundBillConfigServiceImpl`。
3. 平台侧已有 `BmsRefundBillConfigController`。
4. 前端 `admin_shell/src/views/billing/refundBill/index.vue` 已经做出返款账单页面，并预留了真实接口调用入口。

### 2.2 当前缺口

当前仍缺以下关键能力：

1. 没有真正的 `RefundBillRemoteService / RefundBillController / RefundBillService / RefundBillMapper`。
2. `ArBill`、`FeeDetail` 等 Java 实体还没有补齐返款账单新增字段。
3. `admin_shell` 返款账单页仍存在 mock 数据和后端返回结构待对齐问题。
4. `platform-admin` 里还没有 `/portal/bms/refundBill/*` 的真实代理控制器。
5. 返款账单生成链路还没有接入现有 `bill_generate_task` / `BillGenerateTaskExecuteJob`。

### 2.3 当前 SQL 设计前提

本开发文档以以下两个文件为基线：

1. 当前数据库现状归档：`aidocs/technical-caliber/sql/ar_bill.sql`
2. 目标结构设计草案：`aidocs/technical-caliber/bms/dev-specs/ddl/refund_bill_reuse_ar_bill_ddl.sql`

## 3. 范围定义

### 3.1 本次开发范围

1. 返款账单列表查询。
2. 返款账单详情查询。
3. 返款账单费用明细分页。
4. 返款账单导出。
5. 返款账单复核通过。
6. 返款账单发送。
7. 返款账单登记打款。
8. 返款账单状态推进与支付分配留痕。
9. 返款账单正式生成链路。
10. 前端返款账单页面与真实接口联调。

### 3.2 本次暂不进入首批交付的范围

以下能力建议放到 `P2` 或后续版本：

1. 红冲调账。
2. 重新跑账单。
3. 任意多账单共享一条 `fee_detail` 的关系模型重构。
4. 通用 `bill_fee_detail_relation` 落地。
5. 返款账单专属订单分页页签。
6. 返款账单专属汇率编辑页面。

说明：

1. 前端虽然已经预留 `regenerateRefundBill` 入口，但当前按钮权限没有正式开放。
2. 在共享关系模型尚未落地前，不建议先做返款账单“重新跑账单”，否则旧账单作废、明细重挂、来源回写会很难保证一致性。

## 4. 库表落地方案

## 4.1 必改表

| 表 | 处理方式 | 目的 |
| --- | --- | --- |
| `ar_bill` | 扩字段 | 复用主账单表承载 `COD_REFUND` |
| `ar_bill_currency_summary` | 扩字段 | 复用币种汇总表承载返款金额口径 |
| `fee_detail` | 扩字段 | 支持主账单 + 关联账单双挂账 |
| `main_order` | 扩字段 + 改唯一键 | 支持同一主单同时挂应收和返款 |
| `bill_source_collect_mark` | 扩字段 + 改唯一键 | 支持来源行分别被应收和返款归集 |

## 4.2 新增表

| 表 | 用途 |
| --- | --- |
| `refund_payment_record` | 返款打款流水 |
| `refund_payment_allocation` | 打款到返款账单币种汇总的分配明细 |

## 4.3 各表在开发阶段的使用边界

### `ar_bill`

返款账单在代码层统一要求：

1. `bill_type = COD_REFUND`
2. `bill_config_id = refund_bill_config.id`
3. `config_no / config_version / config_snapshot_json` 必须冻结返款配置快照

返款账单状态建议使用：

1. `DRAFT`
2. `UNDER_REVIEW`
3. `PENDING_SETTLEMENT`
4. `SETTLED`
5. `VOID`

说明：

1. `OVERDUE_UNREFUNDED` 不是存库主状态，而是列表快捷筛选条件。
2. `OVERDUE_UNREFUNDED` 建议按 `bill_status = PENDING_SETTLEMENT AND credit_period_end_date < CURDATE()` 计算。

### `ar_bill_currency_summary`

返款账单下建议统一口径：

1. `receivable_amount` = 应返金额
2. `paid_amount` = 已返金额
3. `unpaid_amount` = 未返金额
4. `principal_amount` = 返款本金
5. `deduction_amount` = 扣减金额
6. `pending_deduction_amount` = 待补扣金额
7. `uncollected_amount` = 未回款金额

### `fee_detail`

返款账单明细查询必须考虑两种命中方式：

1. 当前账单作为主账单：
   `fee_detail.bill_no = 当前账单号 AND fee_detail.bill_type = COD_REFUND`
2. 当前账单作为关联账单：
   `fee_detail.related_bill_no = 当前账单号 AND fee_detail.related_bill_type = COD_REFUND`

这条规则必须体现在：

1. 返款账单详情费用汇总
2. 返款账单费用明细分页
3. 返款账单导出
4. 后续返款账单生成去重逻辑

### `main_order`

`main_order` 的改造主要服务于生成阶段：

1. 同一 `order_no` 可以同时被一张 `MEMBER_AR` 账单引用。
2. 同一 `order_no` 也可以同时被一张 `COD_REFUND` 账单引用。
3. 查询时必须带 `bill_type`，避免把两类账单的订单快照混掉。

### `bill_source_collect_mark`

该表改造后，返款生成链路在落来源归集标记时必须写：

1. `bill_type = COD_REFUND`
2. 与应收账单完全独立的 `collect_type`

否则同一来源行会被应收账单归集标记覆盖。

## 5. 代码架构设计

## 5.1 总体原则

虽然物理上复用 `ar_bill`，但代码上不建议继续复用 `ArBillServiceImpl` 直接承载返款账单，原因如下：

1. 应收账单和返款账单资金方向相反。
2. 应收核销与返款打款的状态机不同。
3. `fee_detail` 在返款场景下要支持“关联账单侧”查询，应收逻辑目前没有这层复杂度。
4. 如果继续把返款逻辑塞进 `ArBillServiceImpl`，后续维护成本会快速失控。

因此建议新增独立业务域：

```text
bms/model    -> RefundBill* DTO / 实体 / 枚举
bms/dao      -> RefundBillMapper + XML
bms/biz      -> RefundBillService + RefundBillServiceImpl
bms/client   -> RefundBillRemoteService
bms/web      -> RefundBillController
platform-admin/web -> BmsRefundBillController
admin_shell  -> refundBill 页面改真实接口
```

## 5.2 推荐新增对象

### Model 层

建议新增：

1. `RefundBillQueryReqDTO`
2. `RefundBillPageRespDTO`
3. `RefundBillDTO`
4. `RefundBillDetailRespDTO`
5. `RefundBillFeeDetailQueryReqDTO`
6. `RefundBillFeeDetailPageRespDTO`
7. `RefundBillActionReqDTO`
8. `RefundBillPaymentReqDTO`
9. `RefundBillExportRespDTO`
10. `RefundPaymentRecord`
11. `RefundPaymentAllocation`
12. `RefundBillStatusEnum`
13. `RefundBillTypeEnum` 或直接复用统一 `BillTypeEnum`
14. `RefundSettlementRoleEnum`

同时需要补齐现有实体字段：

1. `ArBill`
2. `FeeDetail`
3. `ArBillCurrencySummaryDTO` 或对应实体
4. `MainOrder`
5. `BillSourceCollectMark`

### DAO 层

建议新增：

1. `RefundBillMapper.java`
2. `sqlmap/RefundBillMapper.xml`

建议不要在 `ArBillMapper` 中继续追加返款账单 SQL，避免一个 Mapper 同时承担两套状态机。

### Biz 层

建议新增：

1. `RefundBillService`
2. `RefundBillServiceImpl`

核心方法建议包括：

1. `page`
2. `detail`
3. `feeDetailPage`
4. `exportData`
5. `confirm`
6. `send`
7. `payment`
8. `generate`
9. `markDraftToReview`

### Client / Web 层

建议新增：

1. `RefundBillRemoteService`
2. `RefundBillController`

### Platform Admin 层

建议新增：

1. `BmsRefundBillController`

该控制器负责承接前端现有真实接口路径：

```text
/portal/bms/refundBill/page
/portal/bms/refundBill/detail
/portal/bms/refundBill/feeDetail/page
/portal/bms/refundBill/export
/portal/bms/refundBill/confirm
/portal/bms/refundBill/send
/portal/bms/refundBill/payment
/portal/bms/refundBill/regenerate
```

说明：

1. 由于前端现有页面已经使用 camelCase 的 `/portal/bms/refundBill/*`，平台代理层建议先保持兼容，不要强行改成中划线路径。
2. BMS 内部 Feign 路径仍建议使用 `/api/bms/refund-bill/*`，保持后端命名一致性。

## 6. 核心业务流设计

## 6.1 列表查询

列表查询数据源为：

1. `ar_bill`
2. `ar_bill_currency_summary`

基础过滤条件：

```sql
WHERE ar_bill.bill_type = 'COD_REFUND'
  AND ar_bill.is_deleted = 0
  AND sc_id / shop_id / user_id 数据隔离条件在前
```

列表页汇总字段需对齐前端当前页面：

1. `total`
2. `pendingCount`
3. `pendingRefundCount`
4. `pendingRefundAmount`
5. `overdueUnrefundedCount`
6. `overdueUnrefundedAmount`

建议定义：

1. `pendingCount`：`bill_status = UNDER_REVIEW`
2. `pendingRefundCount`：`bill_status = PENDING_SETTLEMENT`
3. `pendingRefundAmount`：所有 `PENDING_SETTLEMENT` 账单未返金额汇总
4. `overdueUnrefundedCount / Amount`：`PENDING_SETTLEMENT + credit_period_end_date < 当前日期`

## 6.2 详情查询

详情接口建议返回：

1. `bill`
2. `currencySummaries`
3. `feeSummaries`
4. `feeDetails`
5. `exchangeRates`
6. `paymentRows`

其中：

1. `bill` 来自 `ar_bill`
2. `currencySummaries` 来自 `ar_bill_currency_summary`
3. `paymentRows` 建议从 `refund_payment_record` + `refund_payment_allocation` 聚合
4. `feeDetails` 与 `feeSummaries` 必须覆盖主账单命中和关联账单命中两种情况

## 6.3 费用明细分页

费用明细分页必须支持以下 SQL 语义：

```sql
WHERE (
    bill_no = #{billNo}
    AND bill_type = 'COD_REFUND'
) OR (
    related_bill_no = #{billNo}
    AND related_bill_type = 'COD_REFUND'
)
```

并额外支持：

1. `business_order_no`
2. `related_business_order_no`
3. `fee_code`
4. `settlement_role`
5. `related_settlement_role`

等筛选项，为后续定位“双挂账”问题做准备。

## 6.4 复核通过

返款账单复核通过建议逻辑：

1. 只允许 `UNDER_REVIEW` 状态执行。
2. 执行后更新为 `PENDING_SETTLEMENT`。
3. 记录 `confirmed_at / confirmed_by`。
4. 如果账单所有币种汇总的 `unpaid_amount = 0`，则禁止进入 `PENDING_SETTLEMENT`，应直接提示账单金额异常。

## 6.5 发送账单

发送账单建议逻辑：

1. 只允许 `PENDING_SETTLEMENT` 状态执行重发或发送。
2. 主状态不变化，只刷新发送时间、发送人、发送结果标记。
3. 失败只记发送失败标志，不额外新增账单主状态。

## 6.6 登记打款

该能力是返款账单一期必须打通的关键闭环。

### 入参建议

使用独立 `RefundBillPaymentReqDTO`，至少包含：

1. `billNos`
2. `scId`
3. `amount`
4. `currency`
5. `paymentChannel`
6. `paidAt`
7. `remark`
8. `operator`

### 核心校验

1. 所选账单必须都属于同一 `sc_id / shop_id / user_id / member_code`。
2. 所选账单必须都为 `PENDING_SETTLEMENT`。
3. 所选币种必须在至少一条 `ar_bill_currency_summary` 未返余额中存在。
4. 打款金额必须大于 `0`。
5. 打款金额不能超过所选账单在该币种下的总未返金额。

### 执行步骤

1. 新增一条 `refund_payment_record`。
2. 按账单顺序分配到 `ar_bill_currency_summary`，生成多条 `refund_payment_allocation`。
3. 更新每条命中的 `ar_bill_currency_summary.paid_amount / unpaid_amount / summary_status`。
4. 反算更新 `ar_bill.paid_amount / unpaid_amount` 及本位币金额。
5. 若账单所有币种汇总均已结清，则更新 `ar_bill.bill_status = SETTLED`、`settled_at = now()`。

### 分配顺序建议

建议按以下优先级分配：

1. `billing_period_end_date` 升序
2. `bill_send_date` 升序
3. `id` 升序

这样可以避免多账单批量打款时分配顺序不稳定。

## 6.7 返款账单生成

返款账单生成建议放入 `P2`，但本开发文档先明确最终目标链路。

生成流程建议：

1. 从 `refund_bill_config` 读取当前有效版本。
2. 基于 `refund_mode`、账期、生效周期、客户维度，生成 `bill_generate_task`。
3. 拉取可归集来源数据。
4. 按配置确定货款结算币种与客户收款账户。
5. 生成 `ar_bill` 主记录，写 `bill_type = COD_REFUND`。
6. 生成 `ar_bill_currency_summary`。
7. 生成或挂接 `fee_detail`。
8. 写入 `bill_exchange_rate` 汇率快照。
9. 写入 `main_order` 快照。
10. 写入 `bill_source_collect_mark` 防重复归集。

### 与应收账单共享 `fee_detail` 时的处理原则

如果一条 `fee_detail` 同时命中应收账单和返款账单：

1. 保留主账单字段组。
2. 写入关联账单字段组。
3. 不能再复制一条新的 `fee_detail` 做“伪共享”。

## 7. 接口设计

## 7.1 BMS 内部接口

建议新增：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/bms/refund-bill/page` | 返款账单列表 |
| GET | `/api/bms/refund-bill/detail` | 返款账单详情 |
| POST | `/api/bms/refund-bill/fee-detail/page` | 返款账单费用明细分页 |
| GET | `/api/bms/refund-bill/export-data` | 导出返款账单 |
| POST | `/api/bms/refund-bill/confirm` | 复核通过 |
| POST | `/api/bms/refund-bill/send` | 发送账单 |
| POST | `/api/bms/refund-bill/payment` | 登记打款 |
| POST | `/api/bms/refund-bill/regenerate` | 重新跑账单，建议 P2/P3 开放 |

## 7.2 Platform Admin 代理接口

为兼容现有前端，建议暴露：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/portal/bms/refundBill/page` | 对应列表页 |
| GET | `/portal/bms/refundBill/detail` | 对应详情页 |
| POST | `/portal/bms/refundBill/feeDetail/page` | 对应费用明细弹层 |
| GET | `/portal/bms/refundBill/export` | 对应导出 |
| POST | `/portal/bms/refundBill/confirm` | 对应复核通过 |
| POST | `/portal/bms/refundBill/send` | 对应发送账单 |
| POST | `/portal/bms/refundBill/payment` | 对应登记打款 |
| POST | `/portal/bms/refundBill/regenerate` | 预留 |

## 8. 前端联调要求

前端现有文件：

1. `admin_shell/src/api/billing.js`
2. `admin_shell/src/views/billing/refundBill/index.vue`

需要对齐的点：

1. 移除返款账单 mock 数据开关。
2. 列表返回结构对齐当前页面的 `records / total / summary` 读取方式。
3. 详情接口至少返回 `bill / currencySummaries / paymentRows`。
4. 打款接口要支持单币种批量登记。
5. 当前前端状态枚举需要和后端统一使用：
   `DRAFT / UNDER_REVIEW / PENDING_SETTLEMENT / SETTLED / VOID`

建议同时修正前端当前遗留的不一致点：

1. mock 中仍有 `GENERATED`、`PENDING_REFUND` 等中间口径。
2. 页面 `TODO` 注释里还有“按真实 currencySummaries 结构适配”的待办。
3. `feeDetail` 当前还没有真实加载逻辑。

## 9. 开发计划

## 9.1 `P0`：数据库与基础模型改造

目标：让返款账单结构能在库表、实体、Mapper 层成立。

任务：

1. 执行 `refund_bill_reuse_ar_bill_ddl.sql` 草案并整理正式 DDL。
2. 同步更新 `aidocs/technical-caliber/sql/ar_bill.sql` 的完整最新建表结构。
3. 更新 `ArBill`、`FeeDetail`、相关 DTO / resultMap。
4. 新增 `RefundPaymentRecord`、`RefundPaymentAllocation` 实体与 Mapper 映射。
5. 新增返款账单状态、类型、结算角色枚举。

交付物：

1. 可执行 DDL
2. Java 实体与 XML 映射
3. SQL 归档文件

## 9.2 `P1`：查询、详情、打款闭环

目标：让返款账单页面可以真实查询、查看详情、复核、发送、登记打款。

任务：

1. 新增 `RefundBillRemoteService / Controller / Service / Mapper`。
2. 完成列表、详情、费用明细、导出接口。
3. 完成复核通过、发送、登记打款。
4. 新增 `platform-admin` 侧 `BmsRefundBillController`。
5. 前端页面切真实接口并完成联调。

验收标准：

1. 列表不再走 mock。
2. 详情能正确展示多币种汇总和支付记录。
3. 支持批量选账单登记打款。
4. 打款后账单状态、未返金额、支付流水全部正确落库。

## 9.3 `P2`：返款账单生成

目标：返款账单从“可查询可打款”升级为“可自动生成”。

任务：

1. 扩展 `bill_generate_task` 代码层 DTO / Mapper / Job，正式识别 `bill_type = COD_REFUND`。
2. 接入 `refund_bill_config` 作为生成源配置。
3. 完成返款账单生成、币种汇总生成、明细挂接、汇率快照、来源打标。
4. 处理 `fee_detail` 的双账单关联写入。
5. 完成草稿账单到待审核账单的状态推进。

验收标准：

1. 指定客户在有效账期内可生成返款账单。
2. 同一来源不会重复生成。
3. 同一条 `fee_detail` 可同时命中应收和返款账单。

## 9.4 `P3`：回归、迁移与上线

目标：完成真实环境验收与上线准备。

任务：

1. 回归应收账单原链路，确保 `MEMBER_AR` 不受影响。
2. 核对返款账单页面、导出、打款、状态推进。
3. 准备历史数据初始化策略。
4. 完成上线步骤和回滚脚本。

## 10. 测试要点

### 10.1 数据结构

1. 老应收账单默认 `bill_type = MEMBER_AR`。
2. 返款账单写入 `bill_type = COD_REFUND`。
3. `main_order` 同一 `order_no` 可同时挂两类账单。
4. `bill_source_collect_mark` 同一来源可分别被两类账单打标。

### 10.2 双挂账场景

1. 一条 `fee_detail` 只挂返款账单时，`related_bill_*` 为空。
2. 一条 `fee_detail` 同时挂应收账单和返款账单时，两套账单字段组都能查出来。
3. 返款账单详情和费用明细分页不能漏掉 `related_bill_*` 命中的记录。

### 10.3 打款场景

1. 单账单单币种全额打款。
2. 单账单单币种部分打款。
3. 多账单同币种批量打款。
4. 打款后自动结清。
5. 打款金额超限校验。

### 10.4 生成场景

1. 签收返款生成。
2. 回款返款生成。
3. 同一订单跨应收账单和返款账单双归集。
4. 非正常签收不进入返款账单。
5. 扣减不足进入待补扣。

## 11. 风险与待确认项

以下事项建议在正式进入 `P2` 前再冻结一次：

1. `OVERDUE_UNREFUNDED` 是否确认按 `credit_period_end_date` 判定。
2. 返款账单编号规则是否固定使用 `PCB` 前缀。
3. 打款分配顺序是否确认按账期先后 FIFO。
4. 返款账单导出最终字段清单是否沿用前端当前展示字段。
5. `regenerate` 是继续延后，还是在 `P2` 一起落地。
6. 返款账单生成任务是否必须复用现有 `BillGenerateTaskExecuteJob`，还是允许先单独入口过渡。

## 12. 最终建议

从落地风险和联调节奏看，最稳的顺序是：

1. 先做 `P0 + P1`，把“表结构 + 查询详情 + 打款闭环”打通。
2. 再做 `P2`，把返款账单正式生成功能接进任务体系。
3. `regenerate`、红冲调账继续延后，避免在共享关系模型未完全稳定前提前扩大影响面。

这样做的好处是：

1. 不会阻塞当前前端返款账单页面联调。
2. 不会把 `ArBillServiceImpl` 的既有应收逻辑改得过重。
3. 可以先把 `COD_REFUND` 账单域独立出来，再逐步接生成链路。
