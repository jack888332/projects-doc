-- FEE0024（代收货款）改用目的国币种。
-- 本脚本仅更新 tmall_bms 费项来源配置，不修改 OFP 来源数据或表结构，可重复执行。

USE tmall_bms;

START TRANSACTION;

UPDATE fee_source_rule fsr
JOIN fee_index fi ON fi.id = fsr.fee_index_id
SET fsr.source_currency_column = 'dest_country_currency_code',
    fsr.remark = 'FEE0024代收货款使用sale_order_header.dest_country_currency_code作为来源币种'
WHERE fi.fee_code = 'FEE0024'
  AND fsr.source_table = 'sale_order_header'
  AND fsr.source_amount_column = 'cod_price';

COMMIT;

-- 执行后核验（预期 source_currency_column = dest_country_currency_code）：
SELECT
    fi.id AS fee_index_id,
    fi.fee_code,
    fi.fee_name,
    fsr.id AS fee_source_rule_id,
    fsr.source_table,
    fsr.source_amount_column,
    fsr.source_currency_column,
    fsr.enabled
FROM fee_index fi
JOIN fee_source_rule fsr ON fsr.fee_index_id = fi.id
WHERE fi.fee_code = 'FEE0024';
