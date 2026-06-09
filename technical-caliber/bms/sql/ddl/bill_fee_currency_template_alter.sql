-- 目的国费项结算币种模板别名字段
-- 适用库：tmall_bms

ALTER TABLE `bill_fee_currency_template`
  ADD COLUMN `country_alias_codes` varchar(500) DEFAULT NULL COMMENT '目的国别名集合，逗号分隔' AFTER `country_name`;
