-- 目的国费项收费币种模板示例数据
-- 适用库：tmall_bms
-- 说明：
-- 1. 本脚本提供集运场景下的示例模板。
-- 2. 可在此基础上按目的国继续扩展更多模板。

INSERT INTO `bill_fee_currency_template`
(`template_code`, `template_name`, `business_type_code`, `country_code`, `country_name`, `country_alias_codes`, `enabled`, `remark`)
VALUES
('BCFT-CONSOLIDATION-TW', '台湾集运费项币种模板', 'CONSOLIDATION', 'TW', '中国台湾(台湾)', 'TW,台湾,臺灣,台灣,中國臺灣,中国台湾', 1, '示例模板：运费/超材费收CNY，代收/COD收TWD'),
('BCFT-CONSOLIDATION-JP', '日本集运费项币种模板', 'CONSOLIDATION', 'JP', '日本(日本)', 'JP,日本,日', 1, '示例模板：主要费项统一收JPY')
ON DUPLICATE KEY UPDATE
`template_name` = VALUES(`template_name`),
`business_type_code` = VALUES(`business_type_code`),
`country_code` = VALUES(`country_code`),
`country_name` = VALUES(`country_name`),
`country_alias_codes` = VALUES(`country_alias_codes`),
`enabled` = VALUES(`enabled`),
`remark` = VALUES(`remark`),
`updated_at` = CURRENT_TIMESTAMP;

DELETE r
FROM `bill_fee_currency_template_rule` r
JOIN `bill_fee_currency_template` t ON t.`id` = r.`template_id`
WHERE t.`template_code` IN ('BCFT-CONSOLIDATION-TW', 'BCFT-CONSOLIDATION-JP');

INSERT INTO `bill_fee_currency_template_rule`
(`template_id`, `business_type_code`, `fee_index_id`, `fee_code`, `fee_name`, `charge_currency_mode`, `charge_currency`, `enabled`)
SELECT t.`id`, 'CONSOLIDATION', 17, 'FEE0017', '运费', 'FIXED', 'CNY', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-TW'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 45, 'FEE0045', '超材费', 'FIXED', 'CNY', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-TW'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 22, 'FEE0022', '代收货款', 'FIXED', 'TWD', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-TW'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 23, 'FEE0023', '代收货款手续费', 'FIXED', 'TWD', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-TW'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 24, 'FEE0024', 'COD金额', 'FIXED', 'TWD', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-TW'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 17, 'FEE0017', '运费', 'FIXED', 'JPY', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-JP'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 45, 'FEE0045', '超材费', 'FIXED', 'JPY', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-JP'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 22, 'FEE0022', '代收货款', 'FIXED', 'JPY', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-JP'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 23, 'FEE0023', '代收货款手续费', 'FIXED', 'JPY', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-JP'
UNION ALL
SELECT t.`id`, 'CONSOLIDATION', 24, 'FEE0024', 'COD金额', 'FIXED', 'JPY', 1
FROM `bill_fee_currency_template` t
WHERE t.`template_code` = 'BCFT-CONSOLIDATION-JP';
