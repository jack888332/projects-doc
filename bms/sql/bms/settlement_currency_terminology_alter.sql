-- BMS 结算币种术语纠正
-- 说明：
-- 1. 仅更新数据库字段和表注释，不修改现有字段名，避免影响接口与程序兼容。
-- 2. bill_currency、billing_currency、charge_currency 的业务语义统一为“结算币种”。

ALTER TABLE `bill_config`
  MODIFY COLUMN `billing_currency` varchar(16) NOT NULL COMMENT '默认结算币种';

ALTER TABLE `bill_config_fee_currency_rule`
  MODIFY COLUMN `charge_currency_mode` varchar(32) NOT NULL DEFAULT 'CONFIG_DEFAULT' COMMENT '结算币种模式：CONFIG_DEFAULT默认结算币种，SOURCE来源币种，FIXED固定结算币种',
  MODIFY COLUMN `charge_currency` varchar(16) DEFAULT NULL COMMENT '固定结算币种',
  COMMENT = '账单配置费项结算币种规则';

ALTER TABLE `main_order`
  MODIFY COLUMN `bill_currency` varchar(16) DEFAULT NULL COMMENT '归属结算币种';

ALTER TABLE `ar_bill`
  MODIFY COLUMN `bill_currency` varchar(16) NOT NULL COMMENT '默认结算币种',
  MODIFY COLUMN `initial_receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '初始应收金额<结算币种>',
  MODIFY COLUMN `this_adjustment_delta_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '本期调整增量<结算币种>',
  MODIFY COLUMN `previous_adjustment_delta_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '往期调整增量<结算币种>',
  MODIFY COLUMN `late_fee_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '滞纳金<结算币种>',
  MODIFY COLUMN `receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收金额<结算币种>',
  MODIFY COLUMN `paid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已核销金额<结算币种>',
  MODIFY COLUMN `unpaid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未核销金额<结算币种>';

ALTER TABLE `ar_bill_currency_summary`
  MODIFY COLUMN `currency` varchar(16) NOT NULL COMMENT '结算币种',
  COMMENT = '应收账单按结算币种汇总';

ALTER TABLE `fee_detail`
  MODIFY COLUMN `exchange_rate_to_bill` decimal(18,8) DEFAULT NULL COMMENT 'L1汇率快照：原始币种到结算币种汇率',
  MODIFY COLUMN `bill_currency` varchar(16) NOT NULL COMMENT '结算币种',
  MODIFY COLUMN `amount_bill_currency` decimal(18,4) NOT NULL COMMENT '费用金额<结算币种>',
  MODIFY COLUMN `exchange_rate_to_fin` decimal(18,8) DEFAULT NULL COMMENT 'L2汇率快照：结算币种到本位币汇率';

ALTER TABLE `bill_exchange_rate`
  MODIFY COLUMN `bill_currency` varchar(16) NOT NULL COMMENT '结算币种',
  COMMENT = '结算汇率快照';

ALTER TABLE `payment_writeoff_detail`
  MODIFY COLUMN `currency_summary_id` bigint(20) unsigned DEFAULT NULL COMMENT '核销的结算币种汇总ID',
  MODIFY COLUMN `settlement_currency` varchar(16) DEFAULT NULL COMMENT '本次核销结算币种',
  MODIFY COLUMN `bill_currency` varchar(16) NOT NULL COMMENT '结算币种',
  MODIFY COLUMN `exchange_rate_to_bill` decimal(18,8) DEFAULT NULL COMMENT '收款币种到结算币种汇率',
  MODIFY COLUMN `writeoff_amount_bill_currency` decimal(18,4) NOT NULL COMMENT '核销金额<结算币种>',
  MODIFY COLUMN `exchange_rate_to_fin` decimal(18,8) DEFAULT NULL COMMENT '结算币种到本位币汇率';
