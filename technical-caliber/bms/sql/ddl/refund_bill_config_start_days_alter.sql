ALTER TABLE `refund_bill_config`
  ADD COLUMN `billing_period_start_days` varchar(32) DEFAULT NULL COMMENT '账期起始日，半周账期保存两个星期值，逗号分隔（1周一，7周日）'
  AFTER `billing_period_type`;
