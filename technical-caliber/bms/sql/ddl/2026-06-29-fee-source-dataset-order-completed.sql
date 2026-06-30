-- BMS 订单完结履约节点数据集配置
ALTER TABLE `tmall_bms`.`fee_source_dataset`
  ADD COLUMN `order_completed_time_column` varchar(255) DEFAULT NULL COMMENT '订单完结时间表达式' AFTER `sign_time_column`;

UPDATE `tmall_bms`.`fee_source_dataset`
SET `order_completed_time_column` = 'e.order_completed_time',
    `supported_contract_nodes` = 'WEIGHT_OUTBOUND,ORDER_COMPLETED',
    `remark` = 'sale_order_header + sale_order_header_extend；出库使用delivery_time，订单完结使用order_completed_time'
WHERE `dataset_code` = 'CONSOLIDATION_ORDER';
