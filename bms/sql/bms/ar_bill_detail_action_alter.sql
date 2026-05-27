-- BMS 应收账单详情页动作能力字段
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 支持账单详情页的汇率编辑、费项补录、本期/往期冲正和重整审计。

ALTER TABLE `bill_exchange_rate`
  ADD COLUMN `source_type` varchar(16) NOT NULL DEFAULT 'SYSTEM' COMMENT '来源：SYSTEM系统，MANUAL人工' AFTER `rate_source`,
  ADD COLUMN `edit_reason` varchar(500) DEFAULT NULL COMMENT '人工编辑原因' AFTER `source_type`,
  ADD COLUMN `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人' AFTER `created_at`,
  ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER `updated_by`;

ALTER TABLE `fee_detail`
  ADD COLUMN `manual_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否手工补录：0否，1是' AFTER `fee_status`,
  ADD COLUMN `manual_reason` varchar(500) DEFAULT NULL COMMENT '手工补录原因' AFTER `manual_flag`;

ALTER TABLE `fee_adjustment_order`
  ADD COLUMN `source_bill_no` varchar(64) DEFAULT NULL COMMENT '来源账单编号' AFTER `trigger_bill_no`,
  ADD COLUMN `target_bill_no` varchar(64) DEFAULT NULL COMMENT '计入目标账单编号' AFTER `source_bill_no`,
  ADD COLUMN `adjustment_period_type` varchar(16) NOT NULL DEFAULT 'CURRENT' COMMENT '调账账期类型：CURRENT本期，PREVIOUS往期' AFTER `adjustment_type`,
  ADD COLUMN `source_bill_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '来源账单配置ID' AFTER `target_bill_no`,
  ADD COLUMN `source_main_order_id` bigint(20) unsigned DEFAULT NULL COMMENT '来源BMS订单快照ID' AFTER `source_bill_config_id`,
  ADD COLUMN `rebuild_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否重整生成：0否，1是' AFTER `adjustment_amount`,
  ADD COLUMN `import_batch_no` varchar(64) DEFAULT NULL COMMENT '导入批次号' AFTER `rebuild_flag`,
  ADD COLUMN `original_amount` decimal(18,4) DEFAULT NULL COMMENT '原金额' AFTER `import_batch_no`,
  ADD COLUMN `rebuilt_amount` decimal(18,4) DEFAULT NULL COMMENT '重整后金额' AFTER `original_amount`;

CREATE INDEX `idx_adjustment_source_bill` ON `fee_adjustment_order` (`source_bill_no`, `target_bill_no`);
CREATE INDEX `idx_adjustment_period` ON `fee_adjustment_order` (`trigger_bill_no`, `adjustment_period_type`, `adjustment_status`);
