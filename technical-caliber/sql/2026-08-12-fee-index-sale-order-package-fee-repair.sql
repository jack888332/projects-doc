-- 尾程包裹费项索引修复 SQL
-- 修复内容：
-- 1. 回填 fee_index.legacy_data_source，避免历史数据源为空。
-- 2. 将 FEE0066 仓租费、FEE0067 航空费的 fee_source_rule.source_currency_column
--    修正为 fee_amount_currency。
-- 适用环境：tmall_bms，已执行 2026-08-12-fee-index-sale-order-package-fee-init.sql 的库。

USE tmall_bms;

START TRANSACTION;

-- 1. 回填费项索引历史数据源
UPDATE `fee_index`
SET `legacy_data_source` = CASE `fee_code`
    WHEN 'FEE0058' THEN 'ofp_ofdb1.sale_order_package_fee.collection'
    WHEN 'FEE0059' THEN 'ofp_ofdb1.sale_order_package_fee.recovery_money'
    WHEN 'FEE0060' THEN 'ofp_ofdb1.sale_order_package_fee.receivable_collection_amount'
    WHEN 'FEE0061' THEN 'ofp_ofdb1.sale_order_package_fee.payment_collect where type = ''1'''
    WHEN 'FEE0062' THEN 'ofp_ofdb1.sale_order_package_fee.payment_collect where type = ''2'''
    WHEN 'FEE0063' THEN 'ofp_ofdb1.sale_order_package_fee.resend_fee'
    WHEN 'FEE0064' THEN 'ofp_ofdb1.sale_order_package_fee.receivable_freight'
    WHEN 'FEE0065' THEN 'ofp_ofdb1.sale_order_package_fee.receivable_delivery_fee'
    WHEN 'FEE0066' THEN 'ofp_ofdb1.sale_order_package_fee.additional_fee'
    WHEN 'FEE0067' THEN 'ofp_ofdb1.sale_order_package_fee.air_fee'
    WHEN 'FEE0068' THEN 'ofp_ofdb1.sale_order_package_fee.customs_clearance'
    WHEN 'FEE0069' THEN 'ofp_ofdb1.sale_order_package_fee.remote_fee'
    WHEN 'FEE0070' THEN 'ofp_ofdb1.sale_order_package_fee.should_amount'
    WHEN 'FEE0071' THEN 'ofp_ofdb1.sale_order_package_fee.receivable6'
    WHEN 'FEE0072' THEN 'ofp_ofdb1.sale_order_package_fee.receivable7'
    ELSE `legacy_data_source`
END,
    `updated_at` = NOW()
WHERE `fee_code` BETWEEN 'FEE0058' AND 'FEE0072';

-- 2. 修复仓租费、航空费币种字段
UPDATE `fee_source_rule` fsr
JOIN `fee_index` fi ON fi.id = fsr.fee_index_id
SET fsr.source_currency_column = 'fee_amount_currency',
    fsr.updated_at = NOW()
WHERE fi.fee_code IN ('FEE0066', 'FEE0067')
  AND fsr.source_table = 'sale_order_package_fee'
  AND fsr.source_amount_column IN ('additional_fee', 'air_fee');

COMMIT;

-- 执行后核验：legacy_data_source 不应为空
SELECT `fee_code`, `fee_name`, `legacy_data_source`
FROM `fee_index`
WHERE `fee_code` BETWEEN 'FEE0058' AND 'FEE0072'
ORDER BY `fee_code`;

-- 执行后核验：FEE0066/FEE0067 币种字段应为 fee_amount_currency
SELECT fi.fee_code, fi.fee_name, fsr.source_amount_column, fsr.source_currency_column
FROM `fee_source_rule` fsr
JOIN `fee_index` fi ON fi.id = fsr.fee_index_id
WHERE fi.fee_code IN ('FEE0066', 'FEE0067')
ORDER BY fi.fee_code;
