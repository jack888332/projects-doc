-- 应收/COD返款业务单号与尾程子运单来源纠正。
-- 执行前确认当前环境 OFP_DB 配置可同时查询 cxms 库。

ALTER TABLE `main_order`
  DROP INDEX `idx_main_order_waybill`,
  MODIFY COLUMN `last_mile_waybill_no` varchar(1000) DEFAULT NULL
    COMMENT '尾程运单号，多个子运单号英文逗号分隔';

ALTER TABLE `fee_detail`
  DROP INDEX `idx_fee_last_waybill`,
  MODIFY COLUMN `last_mile_waybill_no` varchar(1000) DEFAULT NULL
    COMMENT '尾程运单号，多个子运单号英文逗号分隔';

CREATE TABLE IF NOT EXISTS `bill_order_waybill_snapshot` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `bill_type` varchar(16) NOT NULL COMMENT '账单类型',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `main_order_id` bigint(20) unsigned NOT NULL COMMENT '业务主单快照ID',
  `business_order_no` varchar(64) NOT NULL COMMENT '业务单号，来源OFP配送单号',
  `warehouse_code` varchar(64) NOT NULL COMMENT 'OFP/CXMS匹配仓库编码',
  `sub_waybill_no` varchar(64) NOT NULL COMMENT '单个CXMS尾程子运单号',
  `cxms_package_id` bigint(20) NOT NULL COMMENT 'CXMS包裹记录ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_order_waybill` (`bill_type`,`bill_no`,`business_order_no`,`warehouse_code`,`sub_waybill_no`),
  KEY `idx_bill_waybill_query` (`bill_id`,`sub_waybill_no`,`business_order_no`,`warehouse_code`),
  KEY `idx_main_order_waybill` (`main_order_id`,`sub_waybill_no`),
  KEY `idx_waybill_subject` (`sc_id`,`shop_id`,`user_id`,`member_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单业务单尾程子运单关系快照';

INSERT INTO `fee_source_datasource` (
  `datasource_code`, `datasource_name`, `source_system`, `env_code`, `db_type`, `driver_class_name`,
  `jdbc_url`, `username`, `password_cipher`, `password_mask`, `default_database`, `default_schema`,
  `enabled`, `max_pool_size`, `connect_timeout_seconds`, `query_timeout_seconds`, `max_rows_per_query`,
  `last_test_status`, `last_test_at`, `last_test_message`, `remark`, `created_by`, `updated_by`, `is_deleted`
)
SELECT
  'CXMS_DB',
  'CXMS尾程包裹库',
  'CXMS',
  `env_code`,
  `db_type`,
  `driver_class_name`,
  REPLACE(`jdbc_url`, CONCAT('/', `default_database`), '/cxms'),
  `username`,
  `password_cipher`,
  `password_mask`,
  'cxms',
  'cxms',
  1,
  `max_pool_size`,
  `connect_timeout_seconds`,
  `query_timeout_seconds`,
  `max_rows_per_query`,
  NULL,
  NULL,
  '待应用启动后验证连接',
  '复用OFP数据库用户权限，独立连接CXMS尾程包裹库',
  'system',
  'system',
  0
FROM `fee_source_datasource`
WHERE `datasource_code` = 'OFP_DB'
  AND `enabled` = 1
  AND `is_deleted` = 0
LIMIT 1
ON DUPLICATE KEY UPDATE
  `datasource_name` = VALUES(`datasource_name`),
  `source_system` = VALUES(`source_system`),
  `env_code` = VALUES(`env_code`),
  `db_type` = VALUES(`db_type`),
  `driver_class_name` = VALUES(`driver_class_name`),
  `jdbc_url` = VALUES(`jdbc_url`),
  `username` = VALUES(`username`),
  `password_cipher` = VALUES(`password_cipher`),
  `password_mask` = VALUES(`password_mask`),
  `default_database` = VALUES(`default_database`),
  `default_schema` = VALUES(`default_schema`),
  `enabled` = 1,
  `max_pool_size` = VALUES(`max_pool_size`),
  `connect_timeout_seconds` = VALUES(`connect_timeout_seconds`),
  `query_timeout_seconds` = VALUES(`query_timeout_seconds`),
  `max_rows_per_query` = VALUES(`max_rows_per_query`),
  `is_deleted` = 0,
  `updated_by` = 'system';
