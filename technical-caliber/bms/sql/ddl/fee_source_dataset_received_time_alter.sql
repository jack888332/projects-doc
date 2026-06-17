-- BMS fee_source_dataset received time field
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 为 fee_source_dataset 增加回款时间口径字段，供 COD 返款账单在 RECEIVED 模式下归集使用。

ALTER TABLE `fee_source_dataset`
  ADD COLUMN `received_time_column` varchar(255) DEFAULT NULL COMMENT '回款时间表达式'
  AFTER `sign_time_column`;
