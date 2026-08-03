-- 费项“其他”配置初始化。
-- 业务口径：用户所述“中转订单”按当前系统业务编码 PEER（同行订单）落库；另关联 CONSOLIDATION（集运订单）。
-- 来源数据集：CONSOLIDATION_ADDITIONAL_FEE（集运订单附加费）。
-- 本脚本仅写 tmall_bms 配置表，不修改 OFP 来源数据或表结构，可重复执行。

USE tmall_bms;

START TRANSACTION;

SET @fee_code := 'FEE0057';

INSERT INTO fee_index (
    fee_code,
    fee_name,
    fee_type,
    attachment_object,
    scenario_tag,
    applicable_order_source,
    enabled,
    remark
) VALUES (
    @fee_code,
    '其他',
    'AR',
    'ORDER',
    NULL,
    'PEER,CONSOLIDATION',
    1,
    '集运订单附加费：其他'
)
ON DUPLICATE KEY UPDATE
    fee_name = VALUES(fee_name),
    fee_type = VALUES(fee_type),
    attachment_object = VALUES(attachment_object),
    applicable_order_source = VALUES(applicable_order_source),
    enabled = VALUES(enabled),
    remark = VALUES(remark);

SET @fee_index_id := (
    SELECT id
    FROM fee_index
    WHERE fee_code = @fee_code
    LIMIT 1
);

INSERT INTO fee_source_rule (
    fee_index_id,
    fee_code,
    source_system,
    datasource_code,
    dataset_code,
    source_database,
    source_table,
    source_alias,
    source_id_column,
    source_biz_no_column,
    source_amount_column,
    source_currency_column,
    source_converted_amount_column,
    source_converted_currency_column,
    source_time_column,
    source_ref_columns_json,
    source_tenant_columns_json,
    source_status_columns_json,
    source_extra_columns_json,
    filter_expr,
    filter_params_json,
    dedupe_key_expr,
    enabled,
    priority,
    remark
) VALUES (
    @fee_index_id,
    @fee_code,
    'OFP',
    'OFP_DB',
    'CONSOLIDATION_ADDITIONAL_FEE',
    'ofp_ofdb1',
    'sale_order_additional_matter',
    'a',
    'id',
    'sale_order_id',
    'fee_amount',
    'fee_amount_currency',
    NULL,
    NULL,
    'a.create_time',
    JSON_OBJECT(
        'orderId', 'sale_order_id',
        'lastWaybillNo', 'sub_bill_waybill_no',
        'firstWaybillNo', 'bill_waybill_no'
    ),
    JSON_OBJECT('shopId', 'shop_id', 'country', 'country_short_code'),
    JSON_OBJECT(
        'payer', 'payer',
        'payStatus', 'fee_pay_status',
        'payerSource', 'payer_source',
        'paymentMethod', 'payment_method',
        'actualCollectionMethod', 'actual_collection_method'
    ),
    JSON_OBJECT('fileUrl', 'file_url', 'detailJson', 'fee_detail_json', 'billWaybillNo', 'bill_waybill_no'),
    'fee_item_type = #{feeItemType} AND fee_amount <> 0',
    JSON_OBJECT('feeItemType', '其他'),
    'concat(''ofp_ofdb1|sale_order_additional_matter|'',id,''|fee_amount|'',#{billConfigId},''|'',#{periodStart},''|'',#{periodEnd})',
    1,
    0,
    '费项“其他”来源规则，按 a.create_time 增量归集'
)
ON DUPLICATE KEY UPDATE
    fee_code = VALUES(fee_code),
    datasource_code = VALUES(datasource_code),
    dataset_code = VALUES(dataset_code),
    source_alias = VALUES(source_alias),
    source_id_column = VALUES(source_id_column),
    source_biz_no_column = VALUES(source_biz_no_column),
    source_currency_column = VALUES(source_currency_column),
    source_converted_amount_column = VALUES(source_converted_amount_column),
    source_converted_currency_column = VALUES(source_converted_currency_column),
    source_time_column = VALUES(source_time_column),
    source_ref_columns_json = VALUES(source_ref_columns_json),
    source_tenant_columns_json = VALUES(source_tenant_columns_json),
    source_status_columns_json = VALUES(source_status_columns_json),
    source_extra_columns_json = VALUES(source_extra_columns_json),
    filter_expr = VALUES(filter_expr),
    filter_params_json = VALUES(filter_params_json),
    dedupe_key_expr = VALUES(dedupe_key_expr),
    enabled = VALUES(enabled),
    priority = VALUES(priority),
    remark = VALUES(remark);

SET @fee_source_rule_id := (
    SELECT id
    FROM fee_source_rule
    WHERE fee_index_id = @fee_index_id
      AND source_system = 'OFP'
      AND source_database = 'ofp_ofdb1'
      AND source_table = 'sale_order_additional_matter'
      AND source_amount_column = 'fee_amount'
    LIMIT 1
);

INSERT INTO business_type_fee_index (
    business_type_code,
    business_type_name,
    fee_index_id,
    fee_source_rule_id,
    fee_code,
    fee_name,
    fee_type,
    priority,
    cod_collection_check_flag,
    enabled,
    extra_json
) VALUES
    ('PEER', '同行订单', @fee_index_id, @fee_source_rule_id, @fee_code, '其他', 'AR', 0, 0, 1, NULL),
    ('CONSOLIDATION', '集运订单', @fee_index_id, @fee_source_rule_id, @fee_code, '其他', 'AR', 0, 0, 1, NULL)
ON DUPLICATE KEY UPDATE
    business_type_name = VALUES(business_type_name),
    fee_code = VALUES(fee_code),
    fee_name = VALUES(fee_name),
    fee_type = VALUES(fee_type),
    priority = VALUES(priority),
    cod_collection_check_flag = VALUES(cod_collection_check_flag),
    enabled = VALUES(enabled),
    extra_json = VALUES(extra_json);

COMMIT;

-- 执行后核验（预期：1 条费项、1 条来源规则、2 条业务场景映射）：
SELECT
    fi.id AS fee_index_id,
    fi.fee_code,
    fi.fee_name,
    fi.fee_type,
    fsr.id AS fee_source_rule_id,
    fsr.dataset_code,
    fsr.source_table,
    fsr.source_amount_column,
    fsr.source_currency_column,
    fsr.source_time_column,
    fsr.filter_params_json,
    btfi.business_type_code,
    btfi.business_type_name,
    btfi.enabled
FROM fee_index fi
JOIN fee_source_rule fsr ON fsr.fee_index_id = fi.id
JOIN business_type_fee_index btfi
    ON btfi.fee_index_id = fi.id
   AND btfi.fee_source_rule_id = fsr.id
WHERE fi.fee_code = @fee_code
ORDER BY btfi.business_type_code;
