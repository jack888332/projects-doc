-- BMS multi-currency billing support
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 支持同一账单内按费项定义不同收费币种，并按币种独立核销。
-- 3. 核销入口必须落到 ar_bill_currency_summary 的某个币种汇总桶。

CREATE TABLE IF NOT EXISTS `bill_config_fee_currency_rule` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `business_type_code` varchar(64) NOT NULL COMMENT '业务场景编码',
  `fee_index_id` bigint(20) unsigned DEFAULT NULL COMMENT '费项ID',
  `fee_code` varchar(64) NOT NULL COMMENT '费项编码',
  `fee_name` varchar(128) DEFAULT NULL COMMENT '费项名称',
  `charge_currency_mode` varchar(32) NOT NULL DEFAULT 'CONFIG_DEFAULT' COMMENT '收费币种模式：CONFIG_DEFAULT账单默认币种，SOURCE来源币种，FIXED固定币种',
  `charge_currency` varchar(16) DEFAULT NULL COMMENT '固定收费币种',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：0否，1是',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否删除：0否，1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_config_fee_currency` (`bill_config_id`,`business_type_code`,`fee_code`),
  KEY `idx_bill_config_currency_rule` (`bill_config_id`,`enabled`,`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账单配置费项收费币种规则';

CREATE TABLE IF NOT EXISTS `ar_bill_currency_summary` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `currency` varchar(16) NOT NULL COMMENT '收费币种',
  `receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收金额',
  `paid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已核销金额',
  `unpaid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未核销金额',
  `fee_count` int(11) NOT NULL DEFAULT '0' COMMENT '费用明细数',
  `order_count` int(11) NOT NULL DEFAULT '0' COMMENT '涉及订单数',
  `summary_status` varchar(32) NOT NULL DEFAULT 'WAITING_PAY' COMMENT '币种核销状态：WAITING_PAY待收款，PART_PAID部分核销，PAID已核销',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_currency_summary` (`bill_no`,`currency`),
  KEY `idx_currency_summary_bill` (`bill_id`),
  KEY `idx_currency_summary_status` (`currency`,`summary_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应收账单按币种汇总';

ALTER TABLE `payment_writeoff_detail`
  ADD COLUMN `currency_summary_id` bigint(20) unsigned DEFAULT NULL COMMENT '核销的账单币种汇总ID' AFTER `bill_no`,
  ADD COLUMN `settlement_currency` varchar(16) DEFAULT NULL COMMENT '本次核销结算币种' AFTER `currency_summary_id`;

CREATE INDEX `idx_writeoff_currency_summary` ON `payment_writeoff_detail` (`currency_summary_id`);

