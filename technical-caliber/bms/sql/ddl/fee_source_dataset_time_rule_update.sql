-- BMS fee_source_dataset time rule update
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 订单类数据出库时间统一使用 sale_order_header.delivery_time，签收时间统一使用 sale_order_header.signed_time。
-- 3. 附加费只按 sale_order_additional_matter.create_time 增量归集，并固定过滤 fee_pay_status=waiting_pay。

UPDATE `fee_source_dataset`
SET `weight_outbound_time_column` = 'h.delivery_time',
    `sign_time_column` = 'h.signed_time',
    `received_time_column` = NULL,
    `incremental_time_column` = NULL,
    `supported_contract_nodes` = 'WEIGHT_OUTBOUND,SIGN',
    `remark` = 'sale_order_header + sale_order_header_extend；出库使用delivery_time，签收使用signed_time'
WHERE `dataset_code` = 'CONSOLIDATION_ORDER';

UPDATE `fee_source_dataset`
SET `weight_outbound_time_column` = 'h.delivery_time',
    `sign_time_column` = 'h.signed_time',
    `received_time_column` = NULL,
    `incremental_time_column` = NULL,
    `supported_contract_nodes` = 'WEIGHT_OUTBOUND,SIGN',
    `remark` = 'COD返款账单专用主数据源；出库使用delivery_time，签收使用signed_time'
WHERE `dataset_code` = 'COD_REFUND_MAIN_ORDER';

UPDATE `fee_source_dataset`
SET `base_where_expr` = 'a.fee_pay_status = ''waiting_pay''',
    `weight_outbound_time_column` = NULL,
    `sign_time_column` = NULL,
    `received_time_column` = NULL,
    `incremental_time_column` = 'a.create_time',
    `supported_contract_nodes` = 'INCREMENTAL',
    `remark` = '附加费仅按create_time增量拉取，并过滤fee_pay_status=waiting_pay'
WHERE `dataset_code` = 'CONSOLIDATION_ADDITIONAL_FEE';

UPDATE `fee_source_rule`
SET `dataset_code` = 'CONSOLIDATION_ORDER'
WHERE `source_table` IN ('sale_order_header', 'sale_order_header_extend')
  AND (`dataset_code` IS NULL OR `dataset_code` = '');

UPDATE `fee_source_rule`
SET `dataset_code` = 'CONSOLIDATION_ADDITIONAL_FEE',
    `source_time_column` = 'a.create_time'
WHERE `source_table` = 'sale_order_additional_matter'
  AND (`dataset_code` IS NULL OR `dataset_code` = '' OR `dataset_code` = 'CONSOLIDATION_ADDITIONAL_FEE');
