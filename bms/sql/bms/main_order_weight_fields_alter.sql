-- BMS main_order weight snapshot fields
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 账单生成时，把源订单的重量/体积/件数关键口径快照到 main_order。
-- 3. 这些字段用于账单详情、红冲核对、导出追溯，不依赖源系统后续数据变化。

ALTER TABLE `main_order`
  ADD COLUMN `source_total_weight` decimal(14,4) DEFAULT NULL COMMENT '源订单总重量' AFTER `total_receivable`,
  ADD COLUMN `warehouse_weight` decimal(14,4) DEFAULT NULL COMMENT '仓库核重重量' AFTER `source_total_weight`,
  ADD COLUMN `billing_weight` decimal(14,4) DEFAULT NULL COMMENT '计费重量/收费重' AFTER `warehouse_weight`,
  ADD COLUMN `throw_weight` decimal(14,4) DEFAULT NULL COMMENT '体积重/抛重' AFTER `billing_weight`,
  ADD COLUMN `order_volume` decimal(18,4) DEFAULT NULL COMMENT '体积' AFTER `throw_weight`,
  ADD COLUMN `package_qty` decimal(14,4) DEFAULT NULL COMMENT '包裹数/件数' AFTER `order_volume`,
  ADD COLUMN `actual_piece_qty` int(11) DEFAULT NULL COMMENT '实际总件数' AFTER `package_qty`;

CREATE INDEX `idx_main_order_weight_snapshot` ON `main_order` (`bill_config_id`, `billing_period_start_date`, `billing_period_end_date`, `billing_weight`);
