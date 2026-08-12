-- 尾程包裹费项索引初始化 SQL
-- 数据来源：2026-08-12 截图“应收账单生成费项索引”
-- 数据库：tmall_bms
-- 适用范围：PEER（同行订单）、CONSOLIDATION（集运订单）
-- 关联文档：aidocs/technical-caliber/bms/dev-specs/2026-08-12-bms-应收账单生成费项索引关联关系技术说明.md
-- 说明：
-- 1. 按截图创建 15 个费项，重复出现的 resend_fee 只建一次。
-- 2. payment_collect 按 type = 1 / type = 2 拆成“返款汇率 / 回款汇率”两个费项和两条来源规则。
-- 3. 除 payment_collect 外，其余字段严格按截图配置，不额外加 type 过滤条件。
-- 4. 费项编码从 FEE0058 起，避免与现有 FEE0001-FEE0057 冲突。
-- 5. fee_index / fee_source_rule 不保存“默认币种”；本脚本末尾为现有
--    CONSOLIDATION 的 TW/JP 币种模板补充规则，PEER 如需相同币种口径，
--    需在对应 bill_config_fee_currency_rule 或 PEER 币种模板中另行配置。
-- 6. 本脚本只写 tmall_bms 配置表，不修改 OFP 来源数据或来源表结构。
-- 7. 当前 BillGenerateServiceImpl 应收账单生成还没有 sale_order_package_fee
--    采集分支；本脚本完成后仍需补运行时采集/打标逻辑，配置本身不会直接
--    让这些费项进入应收账单。

USE tmall_bms;

START TRANSACTION;

-- 1. 尾程包裹费项来源数据集
INSERT INTO `fee_source_dataset` (
    `dataset_code`,
    `dataset_name`,
    `source_system`,
    `datasource_code`,
    `source_database`,
    `main_table`,
    `main_alias`,
    `join_sql`,
    `base_where_expr`,
    `billed_flag_column`,
    `bill_no_column`,
    `weight_outbound_time_column`,
    `sign_time_column`,
    `order_completed_time_column`,
    `received_time_column`,
    `incremental_time_column`,
    `supported_contract_nodes`,
    `query_window_days`,
    `query_page_size`,
    `enabled`,
    `priority`,
    `remark`
) VALUES (
    'TAIL_PACKAGE_FEE',
    '尾程包裹费项',
    'OFP',
    'OFP_DB',
    'ofp_ofdb1',
    'sale_order_package_fee',
    'p',
    'JOIN `ofp_ofdb1`.`sale_order_header` h ON h.id = p.sale_order_id',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'p.create_time',
    'INCREMENTAL',
    1,
    500,
    1,
    40,
    '尾程包裹费项按 p.create_time 增量归集；sale_order_package_fee 当前无计费打标字段'
)
ON DUPLICATE KEY UPDATE
    `dataset_name` = VALUES(`dataset_name`),
    `source_system` = VALUES(`source_system`),
    `datasource_code` = VALUES(`datasource_code`),
    `source_database` = VALUES(`source_database`),
    `main_table` = VALUES(`main_table`),
    `main_alias` = VALUES(`main_alias`),
    `join_sql` = VALUES(`join_sql`),
    `base_where_expr` = VALUES(`base_where_expr`),
    `billed_flag_column` = VALUES(`billed_flag_column`),
    `bill_no_column` = VALUES(`bill_no_column`),
    `weight_outbound_time_column` = VALUES(`weight_outbound_time_column`),
    `sign_time_column` = VALUES(`sign_time_column`),
    `order_completed_time_column` = VALUES(`order_completed_time_column`),
    `received_time_column` = VALUES(`received_time_column`),
    `incremental_time_column` = VALUES(`incremental_time_column`),
    `supported_contract_nodes` = VALUES(`supported_contract_nodes`),
    `query_window_days` = VALUES(`query_window_days`),
    `query_page_size` = VALUES(`query_page_size`),
    `enabled` = VALUES(`enabled`),
    `priority` = VALUES(`priority`),
    `remark` = VALUES(`remark`);

-- 2. 尾程包裹费项主数据
INSERT INTO `fee_index` (
    `fee_code`,
    `fee_name`,
    `fee_type`,
    `attachment_object`,
    `scenario_tag`,
    `applicable_order_source`,
    `enabled`,
    `remark`
) VALUES
    ('FEE0058', '实返货款', 'NON_FEE', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.collection'),
    ('FEE0059', '实回货款', 'NON_FEE', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.recovery_money'),
    ('FEE0060', '代收货款手续费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.receivable_collection_amount'),
    ('FEE0061', '返款汇率', 'NON_FEE', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.payment_collect where type = 1'),
    ('FEE0062', '回款汇率', 'NON_FEE', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.payment_collect where type = 2'),
    ('FEE0063', '重出费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.resend_fee'),
    ('FEE0064', '运费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.receivable_freight'),
    ('FEE0065', '派送费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.receivable_delivery_fee'),
    ('FEE0066', '仓租费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.additional_fee，默认人民币'),
    ('FEE0067', '航空费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.air_fee，默认人民币'),
    ('FEE0068', '清关费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.customs_clearance'),
    ('FEE0069', '偏远费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.remote_fee'),
    ('FEE0070', '应付手续费', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.should_amount'),
    ('FEE0071', '费用6', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.receivable6'),
    ('FEE0072', '费用7', 'AR', 'LAST_PACKAGE', 'TAIL_PACKAGE', 'PEER,CONSOLIDATION', 1, 'sale_order_package_fee.receivable7')
ON DUPLICATE KEY UPDATE
    `fee_name` = VALUES(`fee_name`),
    `fee_type` = VALUES(`fee_type`),
    `attachment_object` = VALUES(`attachment_object`),
    `scenario_tag` = VALUES(`scenario_tag`),
    `applicable_order_source` = VALUES(`applicable_order_source`),
    `enabled` = VALUES(`enabled`),
    `remark` = VALUES(`remark`);

-- 3. 费项来源规则
-- source_currency_column 为 NULL 的费项按截图默认人民币处理；
-- 其余费项默认目的国币种，币种取自 sale_order_header.dest_country_currency_code。
INSERT INTO `fee_source_rule` (
    `fee_index_id`,
    `fee_code`,
    `source_system`,
    `datasource_code`,
    `dataset_code`,
    `source_database`,
    `source_table`,
    `source_alias`,
    `source_id_column`,
    `source_biz_no_column`,
    `source_amount_column`,
    `source_currency_column`,
    `source_converted_amount_column`,
    `source_converted_currency_column`,
    `source_time_column`,
    `source_ref_columns_json`,
    `source_tenant_columns_json`,
    `source_status_columns_json`,
    `source_extra_columns_json`,
    `filter_expr`,
    `filter_params_json`,
    `dedupe_key_expr`,
    `enabled`,
    `priority`,
    `remark`
)
SELECT
    fi.id,
    fi.fee_code,
    'OFP',
    'OFP_DB',
    'TAIL_PACKAGE_FEE',
    'ofp_ofdb1',
    'sale_order_package_fee',
    'p',
    'id',
    'tail_way_bill_no',
    rule_data.source_amount_column,
    CASE WHEN rule_data.fee_code IN ('FEE0066', 'FEE0067') THEN NULL ELSE 'dest_country_currency_code' END,
    NULL,
    NULL,
    'p.create_time',
    JSON_OBJECT(
        'orderId', 'sale_order_id',
        'lastWaybillNo', 'tail_way_bill_no'
    ),
    JSON_OBJECT('shopId', 'shop_id'),
    NULL,
    NULL,
    rule_data.filter_expr,
    rule_data.filter_params_json,
    CONCAT(
        'ofp_ofdb1|sale_order_package_fee|', 'id', '|',
        rule_data.source_amount_column, '|', rule_data.fee_code, '|', '#{billConfigId}'
    ),
    1,
    0,
    CONCAT('尾程包裹费项 ', fi.fee_name, ' 来源规则')
FROM (
    SELECT 'FEE0058' fee_code, 'collection' source_amount_column, 'collection <> 0' filter_expr, NULL filter_params_json
    UNION ALL SELECT 'FEE0059', 'recovery_money', 'recovery_money <> 0', NULL
    UNION ALL SELECT 'FEE0060', 'receivable_collection_amount', 'receivable_collection_amount <> 0', NULL
    UNION ALL SELECT 'FEE0061', 'payment_collect', 'p.type = 1 AND payment_collect <> 0', JSON_OBJECT('type', '1')
    UNION ALL SELECT 'FEE0062', 'payment_collect', 'p.type = 2 AND payment_collect <> 0', JSON_OBJECT('type', '2')
    UNION ALL SELECT 'FEE0063', 'resend_fee', 'resend_fee <> 0', NULL
    UNION ALL SELECT 'FEE0064', 'receivable_freight', 'receivable_freight <> 0', NULL
    UNION ALL SELECT 'FEE0065', 'receivable_delivery_fee', 'receivable_delivery_fee <> 0', NULL
    UNION ALL SELECT 'FEE0066', 'additional_fee', 'additional_fee <> 0', NULL
    UNION ALL SELECT 'FEE0067', 'air_fee', 'air_fee <> 0', NULL
    UNION ALL SELECT 'FEE0068', 'customs_clearance', 'customs_clearance <> 0', NULL
    UNION ALL SELECT 'FEE0069', 'remote_fee', 'remote_fee <> 0', NULL
    UNION ALL SELECT 'FEE0070', 'should_amount', 'should_amount <> 0', NULL
    UNION ALL SELECT 'FEE0071', 'receivable6', 'receivable6 <> 0', NULL
    UNION ALL SELECT 'FEE0072', 'receivable7', 'receivable7 <> 0', NULL
) rule_data
JOIN `fee_index` fi ON fi.fee_code = rule_data.fee_code
ON DUPLICATE KEY UPDATE
    `fee_code` = VALUES(`fee_code`),
    `datasource_code` = VALUES(`datasource_code`),
    `dataset_code` = VALUES(`dataset_code`),
    `source_alias` = VALUES(`source_alias`),
    `source_id_column` = VALUES(`source_id_column`),
    `source_biz_no_column` = VALUES(`source_biz_no_column`),
    `source_currency_column` = VALUES(`source_currency_column`),
    `source_converted_amount_column` = VALUES(`source_converted_amount_column`),
    `source_converted_currency_column` = VALUES(`source_converted_currency_column`),
    `source_time_column` = VALUES(`source_time_column`),
    `source_ref_columns_json` = VALUES(`source_ref_columns_json`),
    `source_tenant_columns_json` = VALUES(`source_tenant_columns_json`),
    `source_status_columns_json` = VALUES(`source_status_columns_json`),
    `source_extra_columns_json` = VALUES(`source_extra_columns_json`),
    `filter_expr` = VALUES(`filter_expr`),
    `filter_params_json` = VALUES(`filter_params_json`),
    `dedupe_key_expr` = VALUES(`dedupe_key_expr`),
    `enabled` = VALUES(`enabled`),
    `priority` = VALUES(`priority`),
    `remark` = VALUES(`remark`);

-- 4. PEER / CONSOLIDATION 业务场景绑定
INSERT INTO `business_type_fee_index` (
    `business_type_code`,
    `business_type_name`,
    `fee_index_id`,
    `fee_source_rule_id`,
    `fee_code`,
    `fee_name`,
    `fee_type`,
    `priority`,
    `cod_collection_check_flag`,
    `enabled`,
    `extra_json`
)
SELECT
    bt.business_type_code,
    bt.business_type_name,
    fi.id,
    fsr.id,
    fi.fee_code,
    fi.fee_name,
    fi.fee_type,
    0,
    0,
    1,
    NULL
FROM (
    SELECT 'PEER' business_type_code, '同行订单' business_type_name
    UNION ALL SELECT 'CONSOLIDATION', '集运订单'
) bt
JOIN `fee_index` fi ON fi.fee_code BETWEEN 'FEE0058' AND 'FEE0072'
JOIN `fee_source_rule` fsr
    ON fsr.fee_index_id = fi.id
   AND fsr.source_table = 'sale_order_package_fee'
   AND fsr.source_database = 'ofp_ofdb1'
ON DUPLICATE KEY UPDATE
    `business_type_name` = VALUES(`business_type_name`),
    `fee_code` = VALUES(`fee_code`),
    `fee_name` = VALUES(`fee_name`),
    `fee_type` = VALUES(`fee_type`),
    `priority` = VALUES(`priority`),
    `cod_collection_check_flag` = VALUES(`cod_collection_check_flag`),
    `enabled` = VALUES(`enabled`),
    `extra_json` = VALUES(`extra_json`);

-- 5. 现有 CONSOLIDATION 的 TW / JP 币种模板补充默认币种规则
-- FEE0066 仓租费、FEE0067 航空费按截图固定人民币；
-- 其余费项按目的国币种（SOURCE），实际币种由 source_currency_column 取目的国币种。
INSERT INTO `bill_fee_currency_template_rule` (
    `template_id`,
    `business_type_code`,
    `fee_index_id`,
    `fee_code`,
    `fee_name`,
    `charge_currency_mode`,
    `charge_currency`,
    `enabled`,
    `created_at`,
    `updated_at`
)
SELECT
    t.id,
    t.business_type_code,
    fi.id,
    fi.fee_code,
    fi.fee_name,
    CASE WHEN fi.fee_code IN ('FEE0066', 'FEE0067') THEN 'FIXED' ELSE 'SOURCE' END,
    CASE WHEN fi.fee_code IN ('FEE0066', 'FEE0067') THEN 'CNY' ELSE NULL END,
    1,
    NOW(),
    NOW()
FROM `bill_fee_currency_template` t
JOIN `fee_index` fi ON fi.fee_code BETWEEN 'FEE0058' AND 'FEE0072'
WHERE t.template_code IN ('BCFT-CONSOLIDATION-TW', 'BCFT-CONSOLIDATION-JP')
  AND NOT EXISTS (
      SELECT 1
      FROM `bill_fee_currency_template_rule` r
      WHERE r.template_id = t.id
        AND r.fee_code = fi.fee_code
        AND r.business_type_code = t.business_type_code
  );

COMMIT;

-- 执行后核验
SELECT fi.fee_code, fi.fee_name, fi.fee_type, fi.attachment_object, fi.applicable_order_source
FROM `fee_index` fi
WHERE fi.fee_code BETWEEN 'FEE0058' AND 'FEE0072'
ORDER BY fi.fee_code;

SELECT fsr.id, fsr.fee_code, fsr.source_table, fsr.source_amount_column, fsr.source_currency_column,
       fsr.filter_expr, fsr.filter_params_json, fsr.dataset_code
FROM `fee_source_rule` fsr
WHERE fsr.source_table = 'sale_order_package_fee'
ORDER BY fsr.id;

SELECT btfi.business_type_code, btfi.fee_code, btfi.fee_name, btfi.fee_type, btfi.enabled
FROM `business_type_fee_index` btfi
WHERE btfi.fee_code BETWEEN 'FEE0058' AND 'FEE0072'
ORDER BY btfi.business_type_code, btfi.fee_code;

SELECT dataset_code, dataset_name, main_table, main_alias, incremental_time_column, supported_contract_nodes
FROM `fee_source_dataset`
WHERE dataset_code = 'TAIL_PACKAGE_FEE';
