-- BMS bill_source_collect_mark
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 记录 BMS 账单与业务源表单据的归集关系。
-- 3. 当 BMS 库和订单源库不能处在同一个本地事务时，用于源表打标补偿重试。

CREATE TABLE IF NOT EXISTS `bill_source_collect_mark` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `collect_no` varchar(64) NOT NULL COMMENT '归集标记编号',
  `collect_type` varchar(32) NOT NULL COMMENT '归集类型：MAIN_ORDER主订单，ADDITIONAL_FEE附加费，ADDITIONAL_INCREMENT附加费增量',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `source_database` varchar(64) DEFAULT NULL COMMENT '来源库',
  `source_table` varchar(128) NOT NULL COMMENT '来源表',
  `source_id` varchar(128) NOT NULL COMMENT '来源数据ID',
  `source_biz_no` varchar(128) DEFAULT NULL COMMENT '来源业务单号',
  `source_order_id` varchar(128) DEFAULT NULL COMMENT '来源订单ID',
  `source_order_no` varchar(128) DEFAULT NULL COMMENT '来源订单号',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `generate_task_id` bigint(20) unsigned DEFAULT NULL COMMENT '生成任务ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `mark_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '源表打标状态：PENDING待打标，MARKED已打标，FAILED打标失败',
  `marked_at` datetime DEFAULT NULL COMMENT '源表打标成功时间',
  `retry_count` int(11) NOT NULL DEFAULT '0' COMMENT '打标重试次数',
  `last_retry_at` datetime DEFAULT NULL COMMENT '最近重试时间',
  `last_error_message` varchar(2000) DEFAULT NULL COMMENT '最近失败原因',
  `source_snapshot_json` json COMMENT '来源数据关键字段快照',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_collect_no` (`collect_no`),
  UNIQUE KEY `uk_source_collect` (`source_system`,`source_table`,`source_id`,`collect_type`),
  KEY `idx_collect_bill` (`bill_id`,`collect_type`,`mark_status`),
  KEY `idx_collect_task` (`generate_task_id`,`mark_status`),
  KEY `idx_collect_subject` (`sc_id`,`shop_id`,`user_id`,`member_code`,`mark_status`),
  KEY `idx_collect_source_order` (`source_order_id`,`source_order_no`),
  KEY `idx_collect_retry` (`mark_status`,`retry_count`,`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单来源归集标记/跨库打标补偿记录';
