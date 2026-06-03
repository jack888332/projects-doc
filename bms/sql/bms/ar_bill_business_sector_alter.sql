-- BMS 应收账单业务板块支持
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 给 ar_bill 增加 business_sector 字段并放宽唯一约束，使其支持同一账单配置在同一账期内按【业务板块+目的国】拆分为多份账单。
-- 3. 给 ar_bill_currency_summary 增加 fin_currency 字段，便于单独维护"费项结算币种"与"财务本位币"两份汇总。

-- 1. 应收账单：增加业务板块
ALTER TABLE `ar_bill`
  ADD COLUMN `business_sector` varchar(64) DEFAULT NULL COMMENT '业务板块' AFTER `destination_country`;

-- 2. 应收账单：放宽账期内唯一约束
-- 旧唯一键：(bill_config_id, billing_period_start_date, billing_period_end_date)
-- 新唯一键：(bill_config_id, billing_period_start_date, billing_period_end_date, business_sector, destination_country)
ALTER TABLE `ar_bill` DROP INDEX `uk_ar_bill_period`;
ALTER TABLE `ar_bill` ADD UNIQUE KEY `uk_ar_bill_period_sector_country`
    (`bill_config_id`, `billing_period_start_date`, `billing_period_end_date`, `business_sector`, `destination_country`);

-- 3. 应收账单：补齐业务板块+目的国索引
CREATE INDEX `idx_ar_bill_sector_country` ON `ar_bill` (`business_sector`, `destination_country`);

-- 4. 币种汇总：补齐财务本位币信息
ALTER TABLE `ar_bill_currency_summary`
  ADD COLUMN `fin_currency` varchar(16) DEFAULT NULL COMMENT '财务本位币' AFTER `currency`;
