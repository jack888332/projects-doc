-- 账单汇率增加独立启停配置。
ALTER TABLE `bill_exchange_rate`
  ADD COLUMN `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1启用，0关闭' AFTER `exchange_rate`;
