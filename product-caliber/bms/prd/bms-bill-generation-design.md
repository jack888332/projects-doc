# BMS 账单生成与附加费增量归集设计

## 1. 背景

BMS 账单配置已经支持按客户维度配置：

`sc_id -> shop_id -> user_id -> member_code`

同时支持默认方案、目的国/仓库分支方案，以及分支方案的业务类型：

1. `PEER`：同行订单。
2. `ECOMMERCE`：电商订单。
3. `CONSOLIDATION`：集运订单。

账单生成需要从业务订单相关表拉取费用，并写入 BMS 账单与费用快照。当前重点场景是集运客户账单。

## 2. 目标

1. 按账单配置自动生成客户账单。
2. 拉取订单主表、订单扩展表、附加费表的数据生成费用明细。
3. 账期归属时间不能简单按创建时间，而要按核重时间或签收时间。
4. 账单生成后，需要对来源表打标，记录 `bill_no` 等归集信息。
5. 附加费允许账单生成后继续新增，因此需要独立的附加费增量归集任务。
6. 附加费增量归集默认进入后续账单，避免修改已生成/已确认账单。
7. 拉取订单数据时按订单批量拉取宽数据，再按 `fee_index`/`fee_source_rule` 拆成 `fee_detail` 竖表，避免一个费项查一次来源表。
8. 数据来源连接信息由 BMS 统一管理，`fee_index` 通过来源规则引用数据源。

## 3. 数据源配置

### 3.1 数据源管理表

需要新增一张表统一管理费项拉取来源的 URL、账号、密码等信息，供 `fee_index`/`fee_source_rule` 使用。

建议表名：

`fee_source_datasource`

```sql
CREATE TABLE `fee_source_datasource` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `datasource_code` varchar(64) NOT NULL COMMENT '数据源编码，如OFP_DB',
  `datasource_name` varchar(128) NOT NULL COMMENT '数据源名称',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `env_code` varchar(32) NOT NULL DEFAULT 'PROD' COMMENT '环境编码：DEV/TEST/UAT/PROD',
  `db_type` varchar(32) NOT NULL DEFAULT 'MYSQL' COMMENT '数据库类型：MYSQL/POSTGRES/ORACLE等',
  `driver_class_name` varchar(128) DEFAULT NULL COMMENT 'JDBC驱动类名，可为空走默认驱动',
  `jdbc_url` varchar(500) NOT NULL COMMENT 'JDBC连接URL',
  `username` varchar(128) NOT NULL COMMENT '账号',
  `password_cipher` varchar(500) NOT NULL COMMENT '加密后的密码',
  `password_mask` varchar(64) DEFAULT NULL COMMENT '脱敏密码展示，如******',
  `default_database` varchar(64) DEFAULT NULL COMMENT '默认库名',
  `default_schema` varchar(64) DEFAULT NULL COMMENT '默认schema，MySQL可与default_database一致',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `max_pool_size` int(11) NOT NULL DEFAULT '5' COMMENT '最大连接数',
  `connect_timeout_seconds` int(11) NOT NULL DEFAULT '10' COMMENT '连接超时时间',
  `query_timeout_seconds` int(11) NOT NULL DEFAULT '30' COMMENT '查询超时时间',
  `max_rows_per_query` int(11) NOT NULL DEFAULT '50000' COMMENT '单次最大拉取行数',
  `last_test_status` varchar(32) DEFAULT NULL COMMENT '最近一次连接测试状态：SUCCESS/FAILED',
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

密码要求：

1. `password_cipher` 必须加密存储。
2. 接口返回和日志打印时只允许脱敏展示。
3. 数据源测试连接接口不能返回原始密码。
4. 建议由后端统一加解密，前端只提交明文一次，保存后不再回显。
5. 如果后续接入配置中心或密钥管理服务，表内仍保留 `password_cipher` 作为 BMS 的快照，不把密钥明文写入 `fee_index`。

管理范围：

1. 一条数据源配置代表一个可读数据库连接，例如 `OFP_DB`、`ERP_DB`。
2. 数据源配置只负责“怎么连接”，不负责“取哪个费项”。
3. 费项取数字段、过滤条件、增量字段放在 `fee_source_rule`。
4. `fee_index` 只保存费项身份和业务含义，不保存 URL、账号、密码。

示例：

```sql
INSERT INTO `fee_source_datasource` (
  `datasource_code`, `datasource_name`, `source_system`, `env_code`, `db_type`,
  `jdbc_url`, `username`, `password_cipher`, `password_mask`, `default_database`,
  `enabled`, `created_by`, `updated_by`
) VALUES (
  'OFP_DB', 'OFP订单库', 'OFP', 'PROD', 'MYSQL',
  'jdbc:mysql://192.168.0.250:3306/ofp_ofdb1?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai',
  'readonly_user', 'ENC(...)', '******', 'ofp_ofdb1',
  1, 'system', 'system'
);
```

### 3.2 fee_source_rule 引用数据源

`fee_source_rule` 建议增加字段：

```sql
`datasource_code` varchar(64) NOT NULL COMMENT '数据源编码，关联fee_source_datasource.datasource_code'
```

使用方式：

1. `fee_index` 定义费项身份，如运费、超重费、转板费。
2. `fee_source_rule` 定义该费项从哪个表、哪个字段、什么过滤条件取数。
3. `fee_source_rule.datasource_code` 指向 `fee_source_datasource`，运行时根据数据源配置创建连接读取数据。
4. `business_type_fee_index` 负责把业务类型、费项、来源规则绑定起来。

这样 `fee_index` 不直接保存 URL、账号、密码，避免每个费项重复配置敏感信息。

关系如下：

```text
fee_source_datasource.datasource_code
  -> fee_source_rule.datasource_code
  -> business_type_fee_index.fee_source_rule_id
  -> business_type_fee_index.fee_index_id
  -> fee_index.id
```

生成账单时：

1. 按 `bill_config.business_type_codes` 找到可用的 `business_type_fee_index`。
2. 通过 `fee_source_rule.datasource_code` 找到数据源连接。
3. 按数据源分组，尽量一次拉订单宽数据。
4. 再按 `fee_index` 和 `fee_source_rule` 拆成 `fee_detail`。

## 4. 数据来源表

### 4.1 订单主表

建议来源：

`ofp_ofdb1.sale_order_header`

主要用途：

1. 提供订单 ID、订单号、客户、店铺、目的国、签收时间。
2. 提供部分订单主费用字段。
3. 作为账单归集的订单集合主入口。

### 4.2 订单扩展表

建议来源：

`ofp_ofdb1.sale_order_header_extend`

主要用途：

1. 提供核重时间。
2. 提供扩展费用字段。
3. 与订单主表按订单 ID 或业务订单 ID 关联。

### 4.3 附加费表

建议来源：

`ofp_ofdb1.sale_order_additional_matter`

主要用途：

1. 提供转板费、退运费、税费、木架费等附加费用。
2. 通过 `sale_order_id`、`financial_bill_no`、尾程运单号、首程运单号等字段关联订单。
3. 账单生成后仍可能新增费用，因此必须支持增量归集。

## 5. 账单归集时间

账单归集不能按来源数据 `create_time` 直接判断账期，应该按业务履约节点判断。

建议统一抽象：

```sql
billing_node_time =
  CASE
    WHEN weight_confirm_time IS NOT NULL THEN weight_confirm_time
    ELSE signed_time
  END
```

字段落地建议：

1. `weight_confirm_time`：核重时间，来源订单扩展表。
2. `signed_time`：签收时间，来源订单主表或尾程轨迹相关字段。
3. `billing_node_time`：BMS 生成时计算并写入 `main_order.billing_node_time`。

如果不同客户或不同业务类型需要固定使用签收时间/核重时间，可以后续在 `bill_config.contract_node` 或新增字段中配置。

## 6. 主账单生成流程

### 6.1 任务入口

定时任务扫描启用的 `bill_config`：

```text
bill_config.status = 1
bill_config.is_current_version = 1
bill_config.is_deleted = 0
effective_start_date <= period_end
effective_end_date IS NULL OR effective_end_date >= period_start
```

按配置计算账期：

1. `DAY`：自然日。
2. `WEEK`：自然周或配置周起始日。
3. `HALF_MONTH`：1-15、16-月底。
4. `MONTH`：自然月。

### 6.1.1 生成任务执行记录

账单生成必须记录任务执行情况，方便运营和研发查看每次出账是否正常。

任务表：

`bill_generate_task`

关键字段：

1. `task_no`：任务编号。
2. `bill_config_id`：本次执行的账单配置。
3. `sc_id/shop_id/user_id/member_code`：客户维度。
4. `billing_period_start_date/billing_period_end_date`：账期范围。
5. `task_status`：`INIT/RUNNING/SUCCESS/FAILED/CANCELED`。
6. `trigger_type`：`SCHEDULE/MANUAL/RETRY/MANUAL_TEST`。
7. `started_at/finished_at/duration_ms`：开始时间、结束时间、执行耗时。
8. `pulled_order_count`：本次拉取到的订单数。
9. `matched_order_count`：本次命中出账的订单数。
10. `skipped_order_count`：因重复、未命中配置、状态不满足等原因跳过的订单数。
11. `fee_detail_count`：本次生成的费用明细数。
12. `additional_fee_count`：其中由附加费表生成的费用明细数。
13. `failed_count`：处理失败的数据数。
14. `receivable_amount`：本次任务生成账单的应收金额。
15. `error_message`：失败原因，最长保留 2000 字符。

建议表结构补充字段：

```sql
ALTER TABLE `bill_generate_task`
  ADD COLUMN `duration_ms` bigint(20) NOT NULL DEFAULT '0' COMMENT '执行耗时毫秒' AFTER `finished_at`,
  ADD COLUMN `pulled_order_count` int(11) NOT NULL DEFAULT '0' COMMENT '拉取订单数' AFTER `duration_ms`,
  ADD COLUMN `matched_order_count` int(11) NOT NULL DEFAULT '0' COMMENT '命中出账订单数' AFTER `pulled_order_count`,
  ADD COLUMN `skipped_order_count` int(11) NOT NULL DEFAULT '0' COMMENT '跳过订单数' AFTER `matched_order_count`,
  ADD COLUMN `fee_detail_count` int(11) NOT NULL DEFAULT '0' COMMENT '生成费用明细数' AFTER `skipped_order_count`,
  ADD COLUMN `additional_fee_count` int(11) NOT NULL DEFAULT '0' COMMENT '生成附加费明细数' AFTER `fee_detail_count`,
  ADD COLUMN `failed_count` int(11) NOT NULL DEFAULT '0' COMMENT '失败数据数' AFTER `additional_fee_count`,
  ADD COLUMN `receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '本任务生成应收金额' AFTER `failed_count`;
```

任务写入规则：

1. 创建任务时写入 `RUNNING` 和 `started_at`。
2. 订单拉取完成后记录 `pulled_order_count`。
3. 费用生成完成后记录 `matched_order_count/fee_detail_count/additional_fee_count/receivable_amount`。
4. 任务成功时写入 `SUCCESS/finished_at/duration_ms`。
5. 任务失败时写入 `FAILED/finished_at/duration_ms/error_message`。
6. 任务表只记录执行摘要，明细仍以 `main_order`、`fee_detail`、`ar_bill` 为准。

### 6.2 配置匹配

生成前根据客户和范围匹配配置：

1. 先按 `sc_id/shop_id/user_id/member_code` 锁定客户。
2. 分支方案按 `business_type_codes` 判断业务类型；默认方案不按订单类型过滤。
3. 如果存在 `bill_config_scope` 非默认配置，优先匹配：
   - `DEST_COUNTRY`
   - `WAREHOUSE`
4. 没有命中任何非默认配置时，才使用默认配置。

### 6.3 默认配置与非默认配置的出账边界

默认配置和非默认配置生成的数据必须互相非包含。

核心规则：

1. 非默认配置用于满足“某些目的国/仓库要单独出账”的要求。
2. 命中非默认配置的订单，只能进入该非默认配置生成的账单。
3. 默认配置只接收没有命中任何非默认配置的剩余订单。
4. 默认账单不能再包含已经被目的国/仓库分支账单包含的订单。
5. 同一订单在同一账期内只能命中一个 `bill_config_id`。

示例：

客户 `700127` 有 3 个配置：

1. 默认配置：全部集运订单。
2. 非默认配置 A：目的国 `US`。
3. 非默认配置 B：集运仓 `WH01`。

生成结果：

1. US 订单进入配置 A 的账单。
2. 非 US 但仓库为 WH01 的订单进入配置 B 的账单。
3. 剩余订单进入默认配置账单。
4. 默认配置不是全量兜底后再重复包含 US/WH01，而是排除已被非默认配置命中的订单。

### 6.4 拉取订单集合

先拉订单集合，再拉订单费用和附加费。

查询条件建议：

```text
客户维度匹配
业务类型匹配
billing_node_time >= period_start
billing_node_time < period_end_next_day
未被 BMS 归集
订单状态满足可出账
```

主链路只处理账期内已到达结算节点的订单。

### 6.5 拉取策略：一次拉订单，多费项匹配

拉取订单时，不按费项逐个查询来源表。

错误方式：

```text
运费查一次订单表
超重费查一次订单表
仓租费查一次订单表
...
```

这种方式会随着费项数量线性放大查询次数，浪费数据库资源。

推荐方式：

```text
按账单配置和账期一次性拉取订单宽数据
-> 每条订单宽数据进入内存/临时结果集
-> 遍历业务类型可用的 fee_index 规则
-> 判断字段金额/过滤条件是否命中
-> 命中则写一行 fee_detail
```

也就是说：

1. 来源表按订单维度批量读取。
2. `fee_index` 和 `fee_source_rule` 作为“字段解释和费项拆分规则”。
3. `fee_detail` 是竖表，一条订单可以拆出多行费用明细。
4. 不允许为了每一个费项重复扫描一次订单主表/扩展表。

### 6.6 费用匹配

费用来源通过 `fee_source_rule` 配置表达。

主费用：

1. 从订单主表读取金额字段。
2. 从订单扩展表读取金额字段。
3. 按 `business_type_fee_index` 判断当前业务类型可用哪些费项。
4. 对同一条订单宽数据逐个匹配金额字段，金额为空或为 0 时不生成 `fee_detail`。

附加费：

1. 根据本次订单集合关联 `sale_order_additional_matter`。
2. 只拉未归集的附加费。
3. 按 `fee_item_type` 映射 `fee_index` / `fee_source_rule`。
4. 写入 `fee_detail`。

费用竖表示例：

一条订单宽数据：

```text
order_no = SO10001
freight = 100
overweight_amount = 20
warehouse_rental_amount = 0
```

拆成 `fee_detail`：

```text
SO10001 + 运费 + 100
SO10001 + 超重费 + 20
```

`warehouse_rental_amount = 0` 不生成明细。

### 6.7 生成账单

建议顺序：

1. 创建 `bill_generate_task`，状态 `RUNNING`。
2. 根据 `bill_config_id + period_start + period_end + trigger_type` 做幂等校验。
3. 创建 `ar_bill` 草稿。
4. 写订单快照 `main_order`。
5. 写费用快照 `fee_detail`。
6. 写来源归集标记。
7. 回写来源表 `bill_no/bill_id/bms_bill_status`。
8. 汇总 `fee_detail` 金额，更新 `ar_bill`。
9. `bill_generate_task` 标记 `SUCCESS`。

失败时不要物理删除已写数据，依靠幂等键和来源归集标记支持重跑。


### 6.8 应收账单编号规则与按【业务板块+目的国】拆单

应收账单（ARB）账单编号按如下结构动态生成：

```
ARB-[结算主体]-[账期起始日 yyyymmdd]-[业务板块+目的国 哈希4位]
```

- 结算主体：客户编号（customer_no），缺省回退到 member_code。
- 账期起始日：账单账期起始日的 yyyymmdd 形式。
- 后缀：业务板块与目的国拼接后取 MD5 截前 4 位的小写16进制，例 fsha。
- 样例：ARB-OG4155-20260101-fsha。

应付账单（APB）、返款账单（PCB）按新规则：

```
APB-[结算主体]-[yyyymmdd]
PCB-[结算主体]-[yyyymmdd]
```

#### 拆单规则

1. 系统本期采集的全部费用项，必须严格按照其所关联订单的【业务板块】和【目的国】分组归集。
2. 同一账单配置、同一账期内，业务板块或目的国不同的费用项拆分为多份应收账单。
3. 拆单分组键：(business_sector, destination_country)，缺值时账单生成任务直接报错。
4. 唯一键调整为 (bill_config_id, billing_period_start_date, billing_period_end_date, business_sector, destination_country)。
5. 拆分后每张账单拥有独立 bill_no，可独立复核、发送、付款、核销。

#### 同账期增量同步

1. 手动生成入口允许同一账单配置、同一账期再次触发生成，不再因为已有账单直接跳过。
2. 任务执行时只扫描源表中未被 BMS 打标的订单、附加费、理赔数据。
3. 对同一 (bill_config_id, billing_period_start_date, billing_period_end_date, business_sector, destination_country) 已存在且仍处于 DRAFT/GENERATED 的账单，增量数据追加到原账单，并重建币种汇总和账单金额。
4. 如果同账期账单已发生核销，或状态已进入待结清/已结清等不可修改状态，本次增量同步应失败并提示业务处理。
5. 对历史缺少 business_sector/destination_country 字段的账单，可按同配置、同账期、同 bill_no 兜底定位，避免重复插入同编号账单。
6. 由于 `bill_generate_task.uk_task_period` 限制同一 (bill_config_id, period_start, period_end, trigger_type) 只能有一条任务，手动增量同步在没有活动任务时复用历史任务行，将其重置为 `PENDING` 并刷新任务快照；`PENDING/RUNNING/NEED_RETRY` 任务仍通过活动任务校验避免并发执行。

## 7. 来源表打标设计

### 7.1 源表字段建议

订单主表、订单扩展表建议增加：

```sql
`bms_bill_no` varchar(64) DEFAULT NULL COMMENT 'BMS归集账单号',
`bms_bill_id` bigint(20) DEFAULT NULL COMMENT 'BMS账单ID',
`bms_bill_status` varchar(32) DEFAULT NULL COMMENT 'BMS归集状态：BILLED/VOID',
`bms_bill_time` datetime DEFAULT NULL COMMENT 'BMS归集时间'
```

附加费表建议增加：

```sql
`bms_bill_no` varchar(64) DEFAULT NULL COMMENT 'BMS归集账单号',
`bms_bill_id` bigint(20) DEFAULT NULL COMMENT 'BMS账单ID',
`bms_fee_detail_id` bigint(20) DEFAULT NULL COMMENT 'BMS费用明细ID',
`bms_bill_status` varchar(32) DEFAULT NULL COMMENT 'BMS归集状态：BILLED/VOID',
`bms_bill_time` datetime DEFAULT NULL COMMENT 'BMS归集时间',
`bms_increment_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否增量归集'
```

### 7.2 BMS 来源归集标记表

即使业务源表已打标，BMS 内仍建议维护一张来源归集标记表，便于审计、幂等和重跑。

```sql
CREATE TABLE `bill_source_collect_mark` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统',
  `source_database` varchar(64) DEFAULT NULL COMMENT '来源库',
  `source_table` varchar(128) NOT NULL COMMENT '来源表',
  `source_id` varchar(128) NOT NULL COMMENT '来源数据ID',
  `source_biz_no` varchar(128) DEFAULT NULL COMMENT '来源业务单号',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单号',
  `fee_detail_id` bigint(20) unsigned DEFAULT NULL COMMENT '费用明细ID',
  `collect_type` varchar(32) NOT NULL COMMENT '归集类型：MAIN/ADDITIONAL/ADDITIONAL_INCREMENT',
  `collect_status` varchar(32) NOT NULL DEFAULT 'BILLED' COMMENT '归集状态：BILLED/VOID',
  `source_row_hash` varchar(64) DEFAULT NULL COMMENT '来源行关键字段哈希',
  `collected_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '归集时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_collect` (`source_system`,`source_database`,`source_table`,`source_id`,`collect_type`),
  KEY `idx_bill_no` (`bill_no`),
  KEY `idx_source_biz_no` (`source_biz_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单来源归集标记';
```

## 8. 附加费增量归集

### 8.1 为什么需要独立任务

附加费表的费用可能在账单生成后才新增或修改，例如：

1. 人工补录转板费。
2. 客诉后补收退运费。
3. 后置确认税费。
4. 业务人员补录附加服务费。

如果只依赖主账单任务，已生成账单之后新增的附加费会漏掉。

### 8.2 增量任务扫描条件

定时任务只扫描 `sale_order_additional_matter`：

```text
bms_bill_no IS NULL
fee_amount <> 0
事项状态/费用状态满足可归集
fee_item_type 能映射到 fee_index
关联订单存在
```

建议任务频率：

1. 每 10 分钟扫描一次未归集附加费。
2. 或每小时扫描一次，按业务量调整。

### 8.3 增量归属策略

附加费增量归集需要先找到关联订单。

判断逻辑：

1. 如果订单所属账期账单尚未生成：不处理，等待主账单任务归集。
2. 如果订单所属账期账单已生成：进入后续账单。
3. 如果订单所属账期账单已确认/已收款：不修改原账单，进入后续账单或生成调账单。

V1 推荐策略：

```text
账单生成后新增的附加费，默认归集到后续账单收费。
```

这样账单一旦生成，不会因为后续补费反复变化，财务核销链路更稳定。

### 8.4 后续账单的处理方式

可选两种实现：

1. 直接落到下一期正常账单：
   - 优点：简单。
   - 缺点：费用所属订单账期和收费账期不同，需要清晰展示。
2. 先落到待归集池，下一期账单生成时吸收：
   - 优点：可审核、可人工干预。
   - 缺点：多一层状态管理。

V1 建议采用方案 1，并在 `fee_detail` 中保留：

1. `source_fee_time`：附加费发生/创建时间。
2. `source_order_id`：原订单 ID。
3. `business_order_no`：原订单号。
4. `source_extra_json`：记录原订单所属账期、原账单号等信息。

## 9. 幂等与去重

`fee_detail.dedupe_key` 建议包含：

```text
source_system
source_database
source_table
source_id
fee_code
bill_config_id
period_start
period_end
collect_type
```

主账单附加费：

```text
collect_type = ADDITIONAL
```

附加费增量：

```text
collect_type = ADDITIONAL_INCREMENT
```

这样同一条附加费不会在主任务和增量任务中重复入账。

## 10. 任务状态

### 10.1 主账单任务

建议状态：

1. `INIT`
2. `RUNNING`
3. `SUCCESS`
4. `FAILED`
5. `CANCELED`

失败处理：

1. 记录错误信息。
2. 支持按 `task_no` 重试。
3. 重试时根据 `dedupe_key` 和 `bill_source_collect_mark` 跳过已成功归集的数据。

### 10.2 附加费增量任务

建议任务记录可以复用 `bill_generate_task`，也可以新增独立任务表。

如果复用，建议 `trigger_type` 增加：

```text
ADDITIONAL_INCREMENT
```

## 11. 金额汇总

费用写入 `fee_detail` 后，再汇总到 `ar_bill`：

1. `initial_receivable_amount`：主费用 + 当期附加费。
2. `this_adjustment_delta_amount`：本期调账。
3. `previous_adjustment_delta_amount`：往期影响本期的调整或增量附加费。
4. `receivable_amount`：最终应收。
5. `unpaid_amount`：未收金额。

附加费增量进入后续账单时，建议计入：

```text
previous_adjustment_delta_amount
```

或在 `fee_detail.source_extra_json` 标记 `additionalIncrement=true`，前端单独展示“往期补收附加费”。

## 12. 推荐实现顺序

### 12.1 第一阶段

1. 新增 `fee_source_datasource`。
2. `fee_source_rule` 增加 `datasource_code`。
3. 新增 `bill_source_collect_mark`。
4. 给来源表增加 BMS 打标字段。
5. 实现主账单任务：
   - 拉订单集合。
   - 一次拉订单宽数据。
   - 按 `fee_index`/`fee_source_rule` 拆分主费用。
   - 拉当时未归集附加费。
   - 写 `ar_bill/main_order/fee_detail`。
   - 回写来源打标。

### 12.2 第二阶段

1. 实现附加费增量任务。
2. 增量附加费进入后续账单。
3. 前端账单详情展示“往期补收附加费”。

### 12.3 第三阶段

1. 支持增量附加费审核。
2. 支持按原账期生成调账单。
3. 支持已确认账单的红冲与补账闭环。

## 13. 风险点

1. 核重时间和签收时间字段来源必须确认，否则账期归属会错误。
2. 附加费关联订单的字段必须统一，不能只依赖运单号。
3. 来源表打标和 BMS 标记表必须在同一事务或具备补偿机制。
4. 已生成账单不建议反复修改，否则收款核销会复杂。
5. 增量附加费必须有清晰展示，否则客户会疑惑为什么本期账单包含往期订单费用。
6. 默认配置与非默认配置必须互斥，否则同一订单可能重复出账。
7. 订单宽数据一次拉取字段会变多，需要控制字段白名单和分页大小，避免单次查询过重。
