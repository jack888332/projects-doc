# BMS 集运计费设计

## 1. 背景与目标

面向 BMS 的集运计费场景，建设一套可配置、可追溯、可调账、可收款分摊的账单系统。

核心目标：

1. 支持按周期自动出账（周、半月、月等）与结算节点（核重、签收）配置。
2. 支持账单费项的自动拉取与手工录入并存。
3. 设计清晰可控的账单状态机。
4. 支持手工调账、红冲、导入订单调整数据，并完整留痕。
5. 支持客户账单收款：单账单部分收款、多账单合并收款。
6. 支持账单邮件通知客户，并可追踪发送结果。
7. 支持同一账单内不同费项按不同币种结算（多币种账单）。

## 2. 范围

本设计覆盖：

1. 账单配置与出账规则。
2. 费项来源抽象（适配器 + 人工录入）。
3. 账单、调账、红冲、导入、收款与分摊。
4. 账单邮件通知（客户主数据来自 `platform_crm.customer`）。
5. 数据模型与接口草案。
6. 作业调度、幂等、审计与风控控制点。

不覆盖：

1. 第三方支付渠道对接细节（仅预留收款登记能力）。
2. 财务总账/凭证系统记账规则（仅提供可对接数据）。

## 3. 业务对象

1. `账单周期配置`：定义出账频率、结算节点、账期偏移等。
2. `费项配置`：定义费项编码、计费方式、数据来源、税率、方向（应收/应退）。
3. `账单主单`：客户级账单头，包含状态及多币种汇总视图。
4. `账单明细`：订单维度或费项维度明细行。
5. `调账单`：人工增减金额，支持关联账单/订单。
6. `红冲单`：对原单（账单明细或调账）进行冲销。
7. `收款单`：一次收款行为，可分摊至多个账单。
8. `收款分摊`：收款单与账单的分配关系。
9. `导入批次`：手工导入订单调整文件及处理结果。
10. `通知任务`：账单邮件发送任务与回执记录。

## 4. 账单配置设计

### 4.1 周期类型

建议枚举 `billing_cycle_type`：

1. `WEEKLY`：按周。
2. `HALF_MONTHLY`：每月 1-15、16-月末。
3. `MONTHLY`：按自然月。
4. `CUSTOM_DAYS`：按 N 天（可选扩展）。

### 4.2 结算节点

建议枚举 `settlement_node`：

1. `WEIGHT_CONFIRMED`：核重。
2. `SIGNED`：签收。

### 4.3 配置关键字段

1. 客户维度：`customer_id`。
2. 周期类型：`billing_cycle_type`。
3. 周期参数：如周起始日、固定日、N 天。
4. 结算节点：`settlement_node`。
5. 时区：默认 `Asia/Shanghai`。
6. 生效区间：`effective_start_at/effective_end_at`。
7. 是否自动出账：`auto_generate_enabled`。

## 5. 账单费项设计

### 5.1 费项配置

建议字段：

1. `fee_item_code`、`fee_item_name`。
2. `charge_mode`：按票、按重、按体积、固定、比例。
3. `source_type`：`AUTO_PULL` / `MANUAL_INPUT`。
4. `adapter_code`：自动拉取时指定适配器。
5. `tax_rate`、`currency`、`rounding_rule`。
6. `enabled`、`sort`。

说明：

1. `currency` 为费项结算币种，允许同一账单存在多个费项币种。

### 5.2 自动拉取（适配器）

采用适配器模式，统一入口：

`FeeItemDataAdapter#pull(FeePullContext) -> List<FeeItemRecord>`

建议能力：

1. 按费项配置绑定不同 `adapter_code`。
2. 适配器支持 API、DB、文件三类来源。
3. 统一幂等键：`customer + order_no + fee_item_code + biz_key`。
4. 拉取任务记录：开始/结束时间、成功数、失败数、错误明细。

### 5.3 DB 源配置化读表（BMS 内实现）

目标：费项适配器支持在数据表中配置“读取哪个数据库源、哪个表、哪些字段、按什么条件取数”，并由 `bms` 服务内部直接执行读表，不依赖外部中间服务。

建议实现：

1. 在 `bms` 维护数据源配置表 `fee_source_datasource`，保存 `datasource_code/jdbc_url/username/password_cipher/default_database` 等连接信息。
2. 在 `bms` 维护费项来源规则表（如 `fee_source_rule`），保存 `datasource_code/source_table/字段映射/过滤条件/增量游标字段` 等。
3. `fee_index` 只定义费项身份，不直接保存数据库 URL、账号、密码。
4. 自动出账时按订单维度批量读取宽数据，再按 `fee_index + fee_source_rule` 拆分成多条 `fee_detail`。
5. 不允许每个费项单独扫描一次订单表，避免费项数量越多查询次数越多。
6. 由 `bms` 在任务执行时动态装配查询并读取源表，再映射为统一 `FeeItemRecord`。

数据源配置表：

```sql
CREATE TABLE `fee_source_datasource` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `datasource_code` varchar(64) NOT NULL COMMENT '数据源编码，如OFP_DB',
  `datasource_name` varchar(128) NOT NULL COMMENT '数据源名称',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `env_code` varchar(32) NOT NULL DEFAULT 'PROD' COMMENT '环境编码：DEV/TEST/UAT/PROD',
  `db_type` varchar(32) NOT NULL DEFAULT 'MYSQL' COMMENT '数据库类型',
  `driver_class_name` varchar(128) DEFAULT NULL COMMENT 'JDBC驱动类名',
  `jdbc_url` varchar(500) NOT NULL COMMENT 'JDBC连接URL',
  `username` varchar(128) NOT NULL COMMENT '账号',
  `password_cipher` varchar(500) NOT NULL COMMENT '加密后的密码',
  `password_mask` varchar(64) DEFAULT NULL COMMENT '脱敏密码展示',
  `default_database` varchar(64) DEFAULT NULL COMMENT '默认库名',
  `default_schema` varchar(64) DEFAULT NULL COMMENT '默认schema',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `max_pool_size` int(11) NOT NULL DEFAULT '5' COMMENT '最大连接数',
  `connect_timeout_seconds` int(11) NOT NULL DEFAULT '10' COMMENT '连接超时时间',
  `query_timeout_seconds` int(11) NOT NULL DEFAULT '30' COMMENT '查询超时时间',
  `max_rows_per_query` int(11) NOT NULL DEFAULT '50000' COMMENT '单次最大拉取行数',
  `last_test_status` varchar(32) DEFAULT NULL COMMENT '最近一次连接测试状态',
  `last_test_at` datetime DEFAULT NULL COMMENT '最近一次连接测试时间',
  `last_test_message` varchar(500) DEFAULT NULL COMMENT '最近一次连接测试结果',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0否，1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_datasource_code` (`datasource_code`),
  KEY `idx_datasource_system` (`source_system`,`enabled`,`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费项来源数据源配置';
```

`fee_source_rule` 增加字段：

```sql
`datasource_code` varchar(64) NOT NULL COMMENT '数据源编码，关联fee_source_datasource.datasource_code'
```

关系：

```text
fee_source_datasource.datasource_code
  -> fee_source_rule.datasource_code
  -> business_type_fee_index.fee_source_rule_id
  -> fee_index
```

安全与风控要求：

1. 仅允许 `SELECT`，禁止 `INSERT/UPDATE/DELETE/DDL`。
2. `source_table` 必须命中白名单（按租户/环境配置）。
3. 条件参数化，禁止拼接原始输入，防 SQL 注入。
4. 单次拉取设置最大行数上限（如 5 万），超限分页。
5. 查询超时、连接超时、重试次数可配置。
6. 查询 SQL 与结果行数必须落审计日志。
7. `password_cipher` 加密存储，接口返回和日志中只允许展示 `password_mask`。

### 5.4 手工录入

手工录入支持两种：

1. 单条录入：按订单录入费项金额与备注。
2. 批量导入：模板导入（CSV/XLSX）。

录入后进入待审核或直接生效（取决于权限策略）。

### 5.5 多币种账单结算规则

1. 账单明细 `bms_bill_item` 按费项记录结算币种与金额：`settle_currency`、`settle_amount`。
2. 账单头不再只依赖单一金额字段，应按币种聚合展示应收、已收、未收。
3. 建议新增币种汇总表 `bms_bill_currency_summary`，主键维度：`bill_id + currency`。
4. 账单是否 `PAID` 判定规则：该账单所有币种的 `outstanding_amount = 0`。
5. 调账、红冲必须继承或显式指定币种，并回写对应币种汇总桶。
6. V1 默认不做跨币种自动抵扣（例如 USD 收款自动抵 EUR 应收）；仅支持同币种分摊。
7. 如需管理口径总览，可选增加“展示币种”折算字段（按快照汇率），仅用于展示，不影响实收实结。

## 6. 账单状态机设计

### 6.1 账单状态枚举

建议 `bill_status`：

1. `DRAFT`：草稿（系统生成未确认）。
2. `PENDING_REVIEW`：待审核（可选流程，金额变化后重新进入该状态）。
3. `ISSUED`：已出账（已对客户生效）。
4. `PARTIALLY_PAID`：部分收款。
5. `PAID`：已结清。
6. `CLOSED`：已关闭（异常终止，不可再收款）。

### 6.2 状态流转

1. `DRAFT -> PENDING_REVIEW`：提交审核。
2. `DRAFT/PENDING_REVIEW -> ISSUED`：审核通过或直接出账。
3. `ISSUED -> PARTIALLY_PAID`：发生部分收款。
4. `ISSUED/PARTIALLY_PAID -> PAID`：所有币种未收金额均归零。
5. `ISSUED/PARTIALLY_PAID/PAID -> PENDING_REVIEW`：账单金额被调账或红冲影响后，重新待审核。
6. `PENDING_REVIEW -> ISSUED`：复核通过后重新生效。
7. `DRAFT/PENDING_REVIEW/ISSUED -> CLOSED`：人工关闭（需权限与原因）。

说明：

1. 定时任务自动生成并已出账的账单，若后续发生金额调整（调增、调减、红冲），账单统一回到 `PENDING_REVIEW`。
2. 复核通过前，该账单不允许继续自动分摊新收款（避免金额基线变化造成分摊错误）。
3. `PAID` 后允许补录调账，但应生成新调账单并触发应收变化。
4. 负向调账或红冲导致账单金额下降时，若出现超收，状态置为 `OVERPAID`（可选扩展）或进入待退款流程。

## 7. 调账、红冲与导入留痕

### 7.1 手工调账

调账类型 `adjustment_type`：

1. `INCREASE`：调增。
2. `DECREASE`：调减。

关键字段：

1. 关联账单号、订单号（可选）。
2. 费项、金额、原因码、说明。
3. 提交人、审核人、审核时间。

### 7.2 红冲

红冲本质为“生成反向金额记录”，不物理删除原记录。

要求：

1. 必须关联原记录 `source_record_id`。
2. 红冲金额默认等额反向。
3. 红冲后更新原记录可冲余额，防重复冲销。
4. 若红冲影响已出账金额，对应账单状态回退为 `PENDING_REVIEW`，待复核后再生效。
5. 记录红冲原因、操作人、审批流转。

### 7.3 手工导入调整数据

导入对象：订单级调账数据。

建议流程：

1. 上传文件并创建导入批次。
2. 预校验（客户、订单、费项、金额格式）。
3. 通过后写入调账草稿。
4. 审核通过后入账并影响账单应收。

留痕要求：

1. 保存导入文件元信息（文件名、hash、上传人、时间）。
2. 保存批次统计（总条数、成功、失败、失败原因）。
3. 保存行级处理日志，可追溯到具体订单。

## 8. 收款与分摊设计

### 8.1 收款单

收款单字段：

1. `receipt_no`、`customer_id`、`pay_amount`、`pay_time`。
2. `pay_currency`（收款币种）。
3. `pay_channel`（转账/现金/线下等）。
4. `external_trade_no`（可选）。
5. `status`：`CONFIRMED`/`REVERSED`。

### 8.2 分摊能力

支持两类：

1. 单账单部分收款：一个账单多次收款。
2. 多账单合并收款：一次收款分摊到多个账单。

分摊表建议字段：

1. `receipt_id`、`bill_id`、`allocated_currency`、`allocated_amount`。
2. `allocation_type`：`AUTO_FIFO` / `MANUAL`。
3. `operator`、`allocated_at`。

### 8.3 自动分摊规则（默认）

默认采用“最早到期优先 + 账单号升序”：

1. 先按 `pay_currency` 找到该客户同币种未结清账单。
2. 按到期日、账单日期、账单号排序。
3. 顺序分摊直至该币种收款用完。

## 9. 数据模型（建议）

建议核心表：

1. `bms_billing_config`：账单配置。
2. `bms_fee_item_config`：费项配置。
3. `bms_bill`：账单头。
4. `bms_bill_item`：账单明细。
5. `bms_bill_currency_summary`：账单币种汇总（应收/已收/未收）。
6. `bms_adjustment`：调账单。
7. `bms_writeoff`：红冲记录。
8. `bms_receipt`：收款单。
9. `bms_receipt_allocation`：收款分摊。
10. `bms_import_batch`：导入批次。
11. `bms_import_batch_line`：导入行结果。
12. `bms_fee_pull_task`：自动拉取任务。
13. `bms_fee_pull_task_line`：自动拉取明细结果。
14. `bms_operation_log`：统一操作日志。
15. `bms_bill_notify_task`：账单通知任务。
16. `bms_bill_notify_log`：账单通知发送日志（含失败原因、重试次数）。
17. `bms_adapter_data_source`：适配器数据库源配置（加密存储连接信息）。
18. `bms_fee_item_adapter_db_config`：费项 DB 读表规则配置。

建议索引：

1. `bill(customer_id, bill_status, bill_period_start, bill_period_end)`。
2. `bill_item(bill_id, order_no, fee_item_code)`。
3. `bill_currency_summary(bill_id, currency)`。
4. `receipt(customer_id, pay_currency, pay_time)`。
5. `receipt_allocation(receipt_id, bill_id, allocated_currency)`。
6. `adjustment(bill_id, order_no, status)`。
7. `bill_notify_task(bill_id, notify_channel, notify_status)`。
8. `adapter_db_config(fee_item_code, adapter_code, enabled)`。

## 10. 账单邮件通知设计

### 10.1 客户主数据来源

当前 DEV 库已确认来源如下：

1. 主表：`platform_crm.customer`。
2. 客户主邮箱字段：`customer.enterprise_mailbox`（企业邮箱）。
3. 联系人表：`platform_crm.customer_contact_info`。
4. 联系人邮箱字段：`customer_contact_info.email`。

### 10.2 收件人选择优先级

默认优先级建议：

1. 若账单指定收件人（手工维护）存在，优先使用。
2. 否则使用 `customer.enterprise_mailbox`。
3. 若主邮箱为空，再回退到 `customer_contact_info.email`（可取多个，去重）。
4. 若仍为空，账单标记“通知失败-缺少收件人”，进入人工补录。

说明：

1. 仅对 `delete_flag=0` 的客户发通知。
2. 邮箱格式不合法时，不发送并记录错误码 `INVALID_EMAIL`。

### 10.3 发送触发时机

1. 账单首次 `ISSUED` 后触发“首次出账通知”。
2. 账单因调账/红冲复核后再次 `ISSUED`，触发“账单变更通知”。
3. 支持手工重发（单账单/批量）。

### 10.4 发送状态与重试

建议 `notify_status`：

1. `PENDING`：待发送。
2. `SENDING`：发送中。
3. `SUCCESS`：发送成功。
4. `FAILED`：发送失败（可重试）。
5. `CANCELLED`：取消发送。

重试策略：

1. 自动重试 3 次（如 1min/5min/30min 退避）。
2. 超限后转人工处理并告警。
3. 每次失败记录 `error_code + error_message`。

### 10.5 通知内容

建议模板字段：

1. 客户名称、账单号、账期、多币种应收/已收/未收金额。
2. 调账/红冲变更摘要（仅变更通知）。
3. 账单明细下载链接（带时效签名）。
4. 联系人与客服渠道。

### 10.6 通知留痕

建议新增：

1. `bms_bill_notify_task`：任务头（账单、渠道、接收人、模板、状态、重试次数）。
2. `bms_bill_notify_log`：发送日志（请求体摘要、响应码、供应商回执、失败原因）。

### 10.7 建议接口

1. `POST /api/bms/bill/notify/send` 发送单个账单通知。
2. `POST /api/bms/bill/notify/resend` 通知重发。
3. `POST /api/bms/bill/notify/batch-send` 批量通知。
4. `GET /api/bms/bill/{billNo}/notify-logs` 查询通知日志。

## 11. 接口草案

### 11.1 配置与出账

1. `POST /api/bms/billing/config/save` 保存账单配置。
2. `POST /api/bms/billing/generate` 手工触发出账。
3. `POST /api/bms/billing/issue` 账单出账生效。

### 11.2 费项与拉取

1. `POST /api/bms/fee-item/config/save` 保存费项配置。
2. `POST /api/bms/fee-item/pull/trigger` 触发自动拉取。
3. `POST /api/bms/fee-item/manual/add` 手工录入费项。
4. `POST /api/bms/adapter/datasource/save` 保存 DB 数据源配置。
5. `POST /api/bms/fee-item/adapter-db/save` 保存费项读表配置。
6. `POST /api/bms/fee-item/adapter-db/test` 测试读表配置（返回样例数据）。

### 11.3 调账与红冲

1. `POST /api/bms/adjustment/create` 创建调账。
2. `POST /api/bms/adjustment/approve` 审核调账。
3. `POST /api/bms/writeoff/create` 创建红冲。

### 11.4 导入

1. `POST /api/bms/import/adjustment/upload` 上传调整文件。
2. `POST /api/bms/import/adjustment/confirm` 确认导入入账。
3. `GET /api/bms/import/batch/{batchNo}` 查询批次结果。

### 11.5 收款与分摊

1. `POST /api/bms/receipt/create` 登记收款。
2. `POST /api/bms/receipt/allocate` 手工分摊收款。
3. `POST /api/bms/receipt/auto-allocate` 自动分摊收款。
4. `GET /api/bms/bill/{billNo}/receipts` 查询账单收款记录。
5. `GET /api/bms/bill/{billNo}/currency-summary` 查询账单币种汇总。

### 11.6 账单通知

1. `POST /api/bms/bill/notify/send` 发送账单邮件。
2. `POST /api/bms/bill/notify/resend` 重发账单邮件。
3. `GET /api/bms/bill/{billNo}/notify-logs` 查询通知记录。

## 12. 作业与幂等

建议定时任务：

1. 自动出账任务：按客户账单配置执行，一次拉取订单宽数据，再按费项规则拆分明细。
2. 附加费增量任务：只扫描未归集附加费，归集到后续账单。
3. 对账校验任务：检查账单金额与明细汇总一致性。
4. 账单通知任务：处理待发送/失败重试邮件。

幂等控制：

1. 拉取任务按 `task_no + source_unique_key` 防重。
2. 导入任务按 `file_hash + customer_id + biz_date` 防重提交。
3. 收款分摊按 `receipt_id + bill_id` 唯一约束。
4. 通知任务按 `bill_id + notify_type + notify_version` 防重。

## 13. 权限与审计

建议权限点：

1. 账单出账权限。
2. 调账创建/审核权限。
3. 红冲权限（高风险）。
4. 收款登记与分摊权限。
5. 导入确认权限。
6. 账单通知发送/重发权限。

审计要求：

1. 所有金额变更必须记录操作日志。
2. 日志至少包含：前值、后值、原因、操作人、时间、来源 IP。
3. 红冲、关闭、手工分摊必须强制填写原因。
4. 通知行为记录接收人、模板、触发源、发送结果与回执。

## 14. 分期落地建议

1. 第一阶段：账单配置 + 出账 + 收款（单账单部分收款）。
2. 第二阶段：适配器自动拉取 + 导入调账 + 审核流 + 邮件通知。
3. 第三阶段：红冲全流程 + 多账单收款分摊 + 对账看板。

---

该设计适配你当前已存在数据基础，可优先做“最小可用闭环”：`配置 -> 出账 -> 收款 -> 调账/红冲 -> 留痕追溯`。
