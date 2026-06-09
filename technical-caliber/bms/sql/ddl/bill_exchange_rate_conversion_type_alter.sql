-- BMS 账单汇率转换类型与唯一性调整
-- 说明：
-- 1. ar_bill_currency_summary 仅承载结算币种金额汇总，不存储汇率转换类型。
-- 2. bill_exchange_rate.conversion_currency_type 区分两段账单汇率。
-- 3. 同一账单、同一来源/目标币种、同一转换类型只允许一条汇率快照。

UPDATE `bill_exchange_rate`
SET `conversion_currency_type` = 'FEE_TO_BILL'
WHERE `conversion_currency_type` = 'FEE';

UPDATE `bill_exchange_rate` rate_row
JOIN (
    SELECT `id`, `bill_currency` AS source_currency, `conversion_currency` AS target_currency
    FROM `bill_exchange_rate`
    WHERE `conversion_currency_type` = 'FIN'
) old_fin_rate ON old_fin_rate.id = rate_row.id
SET rate_row.`bill_currency` = old_fin_rate.target_currency,
    rate_row.`conversion_currency` = old_fin_rate.source_currency,
    rate_row.`conversion_currency_type` = 'BILL_TO_FIN';

ALTER TABLE `bill_exchange_rate`
  MODIFY COLUMN `bill_currency` varchar(16) NOT NULL COMMENT '目标币种',
  MODIFY COLUMN `conversion_currency` varchar(16) NOT NULL COMMENT '来源币种',
  MODIFY COLUMN `conversion_currency_type` varchar(32) NOT NULL COMMENT '转换类型：FEE_TO_BILL费项原始币种转账单结算币种，BILL_TO_FIN账单结算币种转财务本位币',
  DROP INDEX `uk_bill_rate`,
  ADD UNIQUE KEY `uk_bill_rate` (`bill_id`,`bill_currency`,`conversion_currency`,`conversion_currency_type`);
