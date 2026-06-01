-- BMS fee_source_dataset public source dataset config
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. fee_source_dataset 管理订单/附加费等公共来源数据集，fee_source_rule 只负责金额和币种字段。
-- 3. 订单类费项的归集时间跟随账单配置的履约节点：核重出库使用 measure_time，签收使用 signed_time。
-- 4. 附加费只按 create_time 做增量归集，并固定过滤 fee_pay_status=waiting_pay。

CREATE TABLE IF NOT EXISTS `fee_source_dataset` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `dataset_code` varchar(64) NOT NULL COMMENT '数据集编码，如CONSOLIDATION_ORDER',
  `dataset_name` varchar(128) NOT NULL COMMENT '数据集名称',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `datasource_code` varchar(64) NOT NULL DEFAULT 'OFP_DB' COMMENT '数据源编码，关联fee_source_datasource.datasource_code',
  `source_database` varchar(64) DEFAULT NULL COMMENT '来源库',
  `main_table` varchar(128) NOT NULL COMMENT '主表',
  `main_alias` varchar(32) DEFAULT NULL COMMENT '主表别名',
  `join_sql` varchar(1000) DEFAULT NULL COMMENT '关联SQL片段，不含FROM主表',
  `base_where_expr` varchar(1000) DEFAULT NULL COMMENT '公共过滤条件',
  `billed_flag_column` varchar(128) DEFAULT NULL COMMENT '计费标记字段',
  `bill_no_column` varchar(128) DEFAULT NULL COMMENT '账单编号打标字段',
  `weight_outbound_time_column` varchar(255) DEFAULT NULL COMMENT '核重出库时间表达式',
  `sign_time_column` varchar(255) DEFAULT NULL COMMENT '签收时间表达式',
  `incremental_time_column` varchar(255) DEFAULT NULL COMMENT '追加/增量时间表达式',
  `supported_contract_nodes` varchar(255) DEFAULT NULL COMMENT '支持履约节点，逗号分隔：WEIGHT_OUTBOUND,SIGN,INCREMENTAL',
  `query_window_days` int(11) NOT NULL DEFAULT '1' COMMENT '源数据查询窗口天数，1表示按天拆分',
  `query_page_size` int(11) NOT NULL DEFAULT '500' COMMENT '源数据分页条数',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `priority` int(11) NOT NULL DEFAULT '0' COMMENT '优先级',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dataset_code` (`dataset_code`),
  KEY `idx_dataset_source` (`source_system`,`datasource_code`,`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费项来源数据集配置';

ALTER TABLE `fee_source_rule`
  ADD COLUMN `dataset_code` varchar(64) DEFAULT NULL COMMENT '来源数据集编码，关联fee_source_dataset.dataset_code' AFTER `datasource_code`;

CREATE INDEX `idx_fee_source_dataset` ON `fee_source_rule` (`dataset_code`,`enabled`);

INSERT INTO `fee_source_dataset` (
  `dataset_code`, `dataset_name`, `source_system`, `datasource_code`, `source_database`,
  `main_table`, `main_alias`, `join_sql`, `base_where_expr`, `billed_flag_column`, `bill_no_column`,
  `weight_outbound_time_column`, `sign_time_column`, `incremental_time_column`,
  `supported_contract_nodes`, `query_window_days`, `query_page_size`, `enabled`, `priority`, `remark`
) VALUES
(
  'CONSOLIDATION_ORDER', '集运订单主数据', 'OFP', 'OFP_DB', 'ofp_ofdb1',
  'sale_order_header', 'h', 'LEFT JOIN `ofp_ofdb1`.`sale_order_header_extend` e ON e.sale_order_id = h.id',
  NULL,
  'e.bms_billed_flag', 'e.bms_bill_no',
  'h.measure_time', 'h.signed_time', NULL,
  'WEIGHT_OUTBOUND,SIGN', 1, 500, 1, 10, 'sale_order_header + sale_order_header_extend；核重使用measure_time，签收使用signed_time'
),
(
  'CONSOLIDATION_ADDITIONAL_FEE', '集运订单附加费', 'OFP', 'OFP_DB', 'ofp_ofdb1',
  'sale_order_additional_matter', 'a', 'JOIN `ofp_ofdb1`.`sale_order_header` h ON h.id = a.sale_order_id',
  'a.fee_pay_status = ''waiting_pay''',
  'a.bms_billed_flag', 'a.bms_bill_no',
  NULL, NULL, 'a.create_time',
  'INCREMENTAL', 1, 500, 1, 20, '附加费仅按create_time增量拉取，并过滤fee_pay_status=waiting_pay'
)
ON DUPLICATE KEY UPDATE
  `dataset_name` = VALUES(`dataset_name`),
  `source_system` = VALUES(`source_system`),
  `datasource_code` = VALUES(`datasource_code`),
  `source_database` = VALUES(`source_database`),
  `main_table` = VALUES(`main_table`),
  `main_alias` = VALUES(`main_alias`),
  `join_sql` = VALUES(`join_sql`),
  `base_where_expr` = VALUES(`base_where_expr`),
  `billed_flag_column` = VALUES(`billed_flag_column`),
  `bill_no_column` = VALUES(`bill_no_column`),
  `weight_outbound_time_column` = VALUES(`weight_outbound_time_column`),
  `sign_time_column` = VALUES(`sign_time_column`),
  `incremental_time_column` = VALUES(`incremental_time_column`),
  `supported_contract_nodes` = VALUES(`supported_contract_nodes`),
  `query_window_days` = VALUES(`query_window_days`),
  `query_page_size` = VALUES(`query_page_size`),
  `enabled` = VALUES(`enabled`),
  `priority` = VALUES(`priority`),
  `remark` = VALUES(`remark`);

UPDATE `fee_source_rule`
SET `dataset_code` = 'CONSOLIDATION_ORDER'
WHERE `source_table` IN ('sale_order_header', 'sale_order_header_extend')
  AND (`dataset_code` IS NULL OR `dataset_code` = '');

UPDATE `fee_source_rule`
SET `dataset_code` = 'CONSOLIDATION_ADDITIONAL_FEE'
WHERE `source_table` = 'sale_order_additional_matter'
  AND (`dataset_code` IS NULL OR `dataset_code` = '');
