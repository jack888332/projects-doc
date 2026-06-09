-- BMS main_order bill ownership fields
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 给 main_order 增加账单归属字段，便于从订单快照直接追溯所属账单、账单配置、生成任务和账期。

ALTER TABLE `main_order`
  ADD COLUMN `bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '归属账单ID' AFTER `total_profit`,
  ADD COLUMN `bill_no` varchar(64) DEFAULT NULL COMMENT '归属账单编号' AFTER `bill_id`,
  ADD COLUMN `bill_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单配置ID' AFTER `bill_no`,
  ADD COLUMN `config_type` varchar(16) DEFAULT NULL COMMENT '账单配置类型：DEFAULT默认配置，BRANCH分支配置' AFTER `bill_config_id`,
  ADD COLUMN `generate_task_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单生成任务ID' AFTER `config_type`,
  ADD COLUMN `billing_period_start_date` date DEFAULT NULL COMMENT '归属账单账期开始日期' AFTER `generate_task_id`,
  ADD COLUMN `billing_period_end_date` date DEFAULT NULL COMMENT '归属账单账期结束日期' AFTER `billing_period_start_date`,
  ADD COLUMN `bill_currency` varchar(16) DEFAULT NULL COMMENT '归属账单结算币种' AFTER `billing_period_end_date`,
  ADD COLUMN `fin_currency` varchar(16) DEFAULT NULL COMMENT '财务本位币' AFTER `bill_currency`,
  ADD COLUMN `billed_at` datetime DEFAULT NULL COMMENT '计入账单时间' AFTER `fin_currency`;

CREATE INDEX `idx_main_order_bill` ON `main_order` (`bill_id`, `bill_no`);
CREATE INDEX `idx_main_order_task` ON `main_order` (`generate_task_id`);
CREATE INDEX `idx_main_order_bill_period` ON `main_order` (`bill_config_id`, `billing_period_start_date`, `billing_period_end_date`);
