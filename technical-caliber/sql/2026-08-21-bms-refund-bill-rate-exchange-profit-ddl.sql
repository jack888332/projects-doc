-- 返款账单实付返款算法、返款汇率与汇兑损益：加表加字段
-- 数据库：tmall_bms
-- 需求：PRD 15.7.2 实付返款算法、15.7.3 汇兑损益金额；订单费用报表只导入实收回款和回款汇率，
--       返款汇率按“货款原始币种 -> 货款结算币种”锁定，汇兑损益只在返款账单详情和财务内部导出展示。
-- 方案：aidocs/technical-caliber/bms/dev-specs/2026-08-20-bms-返款账单实付返款算法返款汇率与汇兑损益需求落地方案及调整计划.md
-- 说明：完整最新表结构已同步至 ar_bill.sql；本文件为上线前增量 DDL，不包含存量数据迁移。

ALTER TABLE `tmall_bms`.`ar_bill_currency_summary`
    ADD COLUMN `original_currency` varchar(16) DEFAULT NULL
        COMMENT '货款原始币种'
        AFTER `fin_currency`,
    ADD COLUMN `cod_amount` decimal(18,4) NOT NULL DEFAULT '0.0000'
        COMMENT '到付金额'
        AFTER `original_currency`,
    ADD COLUMN `additional_fee_amount` decimal(18,4) NOT NULL DEFAULT '0.0000'
        COMMENT '到付附加费总额'
        AFTER `cod_amount`,
    ADD COLUMN `payable_amount_original` decimal(18,4) NOT NULL DEFAULT '0.0000'
        COMMENT '应付返款（货款原始币种）'
        AFTER `additional_fee_amount`,
    ADD COLUMN `deduction_amount_original` decimal(18,4) NOT NULL DEFAULT '0.0000'
        COMMENT '指定扣减费项合计（货款原始币种）'
        AFTER `payable_amount_original`,
    ADD COLUMN `payable_quasi_amount_original` decimal(18,4) NOT NULL DEFAULT '0.0000'
        COMMENT '实付返款（准）（货款原始币种）'
        AFTER `deduction_amount_original`,
    ADD COLUMN `refund_exchange_rate` decimal(18,8) NOT NULL DEFAULT '1.00000000'
        COMMENT '返款汇率快照'
        AFTER `payable_quasi_amount_original`,
    ADD COLUMN `refund_exchange_rate_level` varchar(32) DEFAULT NULL
        COMMENT '返款汇率命中层级'
        AFTER `refund_exchange_rate`;

ALTER TABLE `tmall_bms`.`bill_exchange_rate`
    ADD COLUMN `rate_business_type` varchar(32) NOT NULL DEFAULT 'NORMAL_FEE_RATE'
        COMMENT '汇率业务类型：REFUND_RATE返款汇率，RECEIPT_RATE回款汇率，NORMAL_FEE_RATE普通费项汇率'
        AFTER `fallback_reason`;

CREATE TABLE IF NOT EXISTS `tmall_bms`.`refund_receipt_rate_snapshot` (
    `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
    `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
    `user_id` bigint(20) NOT NULL COMMENT '用户ID',
    `bill_id` bigint(20) unsigned NOT NULL COMMENT '返款账单ID',
    `bill_no` varchar(64) NOT NULL COMMENT '返款账单编号',
    `tail_way_bill_no` varchar(64) NOT NULL COMMENT '尾程运单号',
    `business_order_no` varchar(64) NOT NULL COMMENT '业务订单号',
    `recovery_money` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '实收回款',
    `receipt_exchange_rate` decimal(18,8) NOT NULL COMMENT '回款汇率',
    `receipt_rate_pair` varchar(40) NOT NULL COMMENT '回款汇率货币对，如 TWD->CNY',
    `shop_currency` varchar(16) NOT NULL COMMENT '店铺币种',
    `source_type` varchar(16) NOT NULL DEFAULT 'SYSTEM' COMMENT '来源：SYSTEM系统，MANUAL人工',
    `type` int(11) DEFAULT NULL COMMENT '来源包裹费行type原值',
    `snapshot_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '快照时间',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_receipt_rate_bill_waybill` (`bill_no`,`tail_way_bill_no`),
    KEY `idx_receipt_rate_bill` (`bill_id`),
    KEY `idx_receipt_rate_order` (`business_order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='返款账单包裹级回款汇率快照';

CREATE TABLE IF NOT EXISTS `tmall_bms`.`refund_exchange_profit` (
    `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
    `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
    `user_id` bigint(20) NOT NULL COMMENT '用户ID',
    `bill_id` bigint(20) unsigned NOT NULL COMMENT '返款账单ID',
    `bill_no` varchar(64) NOT NULL COMMENT '返款账单编号',
    `business_order_no` varchar(64) NOT NULL COMMENT '业务订单号',
    `tail_way_bill_no` varchar(64) DEFAULT NULL COMMENT '尾程运单号',
    `source_currency` varchar(16) NOT NULL COMMENT '货款原始币种',
    `settlement_currency` varchar(16) NOT NULL COMMENT '货款结算币种',
    `compare_left_currency` varchar(16) NOT NULL COMMENT '比较货币对左侧币种',
    `compare_right_currency` varchar(16) NOT NULL COMMENT '比较货币对右侧币种',
    `base_amount_original` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '实付返款（准）原始币种金额',
    `base_amount_compare_left` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '换算到比较货币对左侧币种后的金额',
    `receipt_exchange_rate` decimal(18,8) DEFAULT NULL COMMENT '回款汇率',
    `receipt_rate_pair` varchar(40) DEFAULT NULL COMMENT '回款汇率货币对',
    `refund_exchange_rate` decimal(18,8) NOT NULL COMMENT '返款汇率',
    `refund_rate_pair` varchar(40) NOT NULL COMMENT '返款汇率货币对',
    `normalized_receipt_rate` decimal(18,8) DEFAULT NULL COMMENT '标准化回款汇率',
    `normalized_refund_rate` decimal(18,8) DEFAULT NULL COMMENT '标准化返款汇率',
    `profit_amount` decimal(18,4) DEFAULT NULL COMMENT '汇兑损益金额',
    `profit_currency` varchar(16) DEFAULT NULL COMMENT '汇兑损益币种',
    `missing_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否缺失必要数据：0否，1是',
    `missing_reasons` varchar(500) DEFAULT NULL COMMENT '缺失项说明',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_exchange_profit_bill_order` (`bill_no`,`business_order_no`),
    KEY `idx_exchange_profit_bill` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='返款账单汇兑损益快照';
