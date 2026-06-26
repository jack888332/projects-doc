-- BMS fee_source_dataset delivery_time update
-- 说明：
-- 1. 本脚本用于将出库节点时间口径从 measure_time 切换为 delivery_time。
-- 2. 历史编码 WEIGHT_OUTBOUND 保留，但其业务含义统一改为出库节点。

UPDATE `fee_source_dataset`
SET `weight_outbound_time_column` = 'h.delivery_time',
    `remark` = 'sale_order_header + sale_order_header_extend；出库使用delivery_time，签收使用signed_time'
WHERE `dataset_code` IN ('CONSOLIDATION_ORDER', 'COD_REFUND_MAIN_ORDER')
  AND `supported_contract_nodes` LIKE '%WEIGHT_OUTBOUND%';
