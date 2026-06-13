-- ============================================================
-- COD 返款账单复用 ar_bill / fee_detail 结构 DDL 草案
-- 说明：
-- 1. 本文件是目标设计草案，不代表当前线上已执行结构。
-- 2. 主表复用 ar_bill，不新增 refund_bill。
-- 3. 返款打款流水仍独立建表，不复用应收收款表。
-- ============================================================

-- ============================================================
-- 1. ar_bill
-- ============================================================
ALTER TABLE `ar_bill`
  ADD COLUMN `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP' AFTER `bill_title`,
  ADD COLUMN `config_no` varchar(64) DEFAULT NULL COMMENT '配置编号快照' AFTER `bill_config_id`,
  ADD COLUMN `config_version` int(11) DEFAULT NULL COMMENT '配置版本快照' AFTER `config_no`,
  ADD COLUMN `config_snapshot_json` json DEFAULT NULL COMMENT '配置快照JSON' AFTER `config_version`,
  ADD COLUMN `refund_mode` varchar(32) DEFAULT NULL COMMENT '返款模式：SIGNED/RECEIVED，仅COD_REFUND使用' AFTER `config_type`,
  ADD COLUMN `principal_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金<账单币种>' AFTER `initial_receivable_amount`,
  ADD COLUMN `deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '直接扣减金额<账单币种>' AFTER `principal_amount`,
  ADD COLUMN `pending_deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '待补扣金额<账单币种>' AFTER `deduction_amount`,
  ADD COLUMN `uncollected_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额<账单币种>' AFTER `pending_deduction_amount`,
  ADD COLUMN `principal_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金<本位币>' AFTER `receivable_amount_fin`,
  ADD COLUMN `deduction_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '直接扣减金额<本位币>' AFTER `principal_amount_fin`,
  ADD COLUMN `uncollected_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额<本位币>' AFTER `deduction_amount_fin`,
  ADD COLUMN `settled_at` datetime DEFAULT NULL COMMENT '结清时间，仅COD_REFUND使用' AFTER `confirmed_by`;

ALTER TABLE `ar_bill`
  DROP INDEX `uk_ar_bill_period_sector_country`,
  ADD UNIQUE KEY `uk_ar_bill_period_sector_country` (`bill_type`,`bill_config_id`,`billing_period_start_date`,`billing_period_end_date`,`business_sector`,`destination_country`),
  ADD KEY `idx_ar_bill_type_status` (`bill_type`,`bill_status`,`is_deleted`),
  ADD KEY `idx_ar_bill_type_member_period` (`bill_type`,`member_code`,`billing_period_start_date`,`billing_period_end_date`),
  ADD KEY `idx_ar_bill_refund_mode` (`bill_type`,`refund_mode`,`member_code`);

-- ============================================================
-- 2. ar_bill_currency_summary
-- ============================================================
ALTER TABLE `ar_bill_currency_summary`
  ADD COLUMN `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP' AFTER `bill_no`,
  ADD COLUMN `principal_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金' AFTER `fin_currency`,
  ADD COLUMN `deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '直接扣减金额' AFTER `principal_amount`,
  ADD COLUMN `pending_deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '待补扣金额' AFTER `deduction_amount`,
  ADD COLUMN `uncollected_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额' AFTER `pending_deduction_amount`,
  ADD COLUMN `receivable_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应返/应收本位币金额' AFTER `unpaid_amount`,
  ADD COLUMN `paid_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已返/已核销本位币金额' AFTER `receivable_amount_fin`,
  ADD COLUMN `unpaid_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未返/未核销本位币金额' AFTER `paid_amount_fin`,
  ADD COLUMN `principal_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金本位币' AFTER `unpaid_amount_fin`,
  ADD COLUMN `deduction_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '扣减金额本位币' AFTER `principal_amount_fin`,
  ADD COLUMN `uncollected_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额本位币' AFTER `deduction_amount_fin`,
  ADD COLUMN `receipt_account_id` bigint(20) unsigned DEFAULT NULL COMMENT '客户收款账户ID快照' AFTER `summary_status`,
  ADD COLUMN `receipt_account_name` varchar(128) DEFAULT NULL COMMENT '客户收款账户名称快照' AFTER `receipt_account_id`,
  ADD COLUMN `receipt_account_no_masked` varchar(128) DEFAULT NULL COMMENT '客户收款账号脱敏快照' AFTER `receipt_account_name`;

ALTER TABLE `ar_bill_currency_summary`
  ADD KEY `idx_currency_summary_type_status` (`bill_type`,`currency`,`summary_status`);

-- ============================================================
-- 3. fee_detail
-- ============================================================
ALTER TABLE `fee_detail`
  ADD COLUMN `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP' AFTER `bill_no`,
  ADD COLUMN `settlement_role` varchar(32) NOT NULL DEFAULT 'RECEIVABLE' COMMENT '结算角色：RECEIVABLE/REFUND_PRINCIPAL/REFUND_DEDUCTION/REFUND_ADJUSTMENT/REFUND_UNCOLLECTED' AFTER `fee_type`,
  ADD COLUMN `related_bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '关联账单ID，可同时挂第二张账单' AFTER `bill_config_id`,
  ADD COLUMN `related_bill_no` varchar(64) DEFAULT NULL COMMENT '关联账单编号，可同时挂第二张账单' AFTER `related_bill_id`,
  ADD COLUMN `related_bill_type` varchar(32) DEFAULT NULL COMMENT '关联账单类型：MEMBER_AR/COD_REFUND/COST_AP' AFTER `related_bill_no`,
  ADD COLUMN `related_bill_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '关联账单配置ID' AFTER `related_bill_type`,
  ADD COLUMN `related_settlement_role` varchar(32) DEFAULT NULL COMMENT '关联账单结算角色：RECEIVABLE/REFUND_PRINCIPAL/REFUND_DEDUCTION/REFUND_ADJUSTMENT/REFUND_UNCOLLECTED' AFTER `related_bill_config_id`,
  ADD COLUMN `related_bill_currency` varchar(16) DEFAULT NULL COMMENT '关联账单币种' AFTER `related_settlement_role`,
  ADD COLUMN `related_amount_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '费用金额<关联账单币种>' AFTER `related_bill_currency`,
  ADD COLUMN `related_exchange_rate_to_bill` decimal(18,8) DEFAULT NULL COMMENT '原始币种到关联账单币种汇率' AFTER `related_amount_bill_currency`,
  ADD COLUMN `related_exchange_rate_level_to_bill` varchar(16) DEFAULT NULL COMMENT '关联账单汇率级别' AFTER `related_exchange_rate_to_bill`,
  ADD COLUMN `related_fin_currency` varchar(16) DEFAULT NULL COMMENT '关联账单财务本位币' AFTER `related_exchange_rate_level_to_bill`,
  ADD COLUMN `related_amount_fin_currency` decimal(18,4) DEFAULT NULL COMMENT '费用金额<关联账单本位币>' AFTER `related_fin_currency`,
  ADD COLUMN `related_exchange_rate_to_fin` decimal(18,8) DEFAULT NULL COMMENT '关联账单币种到本位币汇率' AFTER `related_amount_fin_currency`,
  ADD COLUMN `related_exchange_rate_level_to_fin` varchar(16) DEFAULT NULL COMMENT '关联账单本位币汇率级别' AFTER `related_exchange_rate_to_fin`,
  ADD COLUMN `related_business_order_no` varchar(64) DEFAULT NULL COMMENT '关联单号/关联主单号' AFTER `business_order_no`;

ALTER TABLE `fee_detail`
  ADD KEY `idx_fee_bill_type` (`bill_type`,`bill_id`,`settlement_role`,`fee_status`),
  ADD KEY `idx_fee_related_bill_type` (`related_bill_type`,`related_bill_id`,`related_settlement_role`,`fee_status`),
  ADD KEY `idx_fee_related_bill_no` (`related_bill_no`),
  ADD KEY `idx_fee_related_order` (`related_business_order_no`);

-- ============================================================
-- 4. main_order
-- ============================================================
ALTER TABLE `main_order`
  ADD COLUMN `bill_type` varchar(32) DEFAULT NULL COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP' AFTER `bill_no`;

ALTER TABLE `main_order`
  DROP INDEX `uk_main_order_no`,
  ADD UNIQUE KEY `uk_main_order_bill_order` (`bill_type`,`bill_no`,`order_no`),
  ADD KEY `idx_main_order_order_no` (`order_no`);

-- ============================================================
-- 5. bill_source_collect_mark
-- ============================================================
ALTER TABLE `bill_source_collect_mark`
  ADD COLUMN `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP' AFTER `bill_no`;

ALTER TABLE `bill_source_collect_mark`
  DROP INDEX `uk_source_collect`,
  ADD UNIQUE KEY `uk_source_collect` (`source_system`,`source_table`,`source_id`,`collect_type`,`bill_type`),
  ADD KEY `idx_collect_bill_type` (`bill_type`,`bill_id`,`collect_type`,`mark_status`);

-- ============================================================
-- 6. 返款打款流水
-- ============================================================
CREATE TABLE `refund_payment_record` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `payment_no` varchar(64) NOT NULL COMMENT '返款打款流水号',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '客户会员编码',
  `member_name` varchar(128) DEFAULT NULL COMMENT '客户名称快照',
  `customer_no` varchar(64) DEFAULT NULL COMMENT '客户编号快照',
  `payment_currency` varchar(16) NOT NULL COMMENT '打款币种',
  `payment_amount` decimal(18,4) NOT NULL COMMENT '打款金额',
  `allocated_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已分配金额',
  `unallocated_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未分配金额',
  `payment_channel` varchar(64) DEFAULT NULL COMMENT '打款渠道',
  `paid_at` datetime NOT NULL COMMENT '实际打款时间',
  `payment_status` varchar(32) NOT NULL COMMENT '状态：ALLOCATED/PART_ALLOCATED/VOID/REVERSED',
  `voucher_url` varchar(500) DEFAULT NULL COMMENT '打款凭证URL',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0否，1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_payment_no` (`payment_no`),
  KEY `idx_refund_payment_subject` (`sc_id`,`shop_id`,`user_id`,`member_code`,`paid_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='返款打款流水';

CREATE TABLE `refund_payment_allocation` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `allocation_no` varchar(64) NOT NULL COMMENT '返款打款分配流水号',
  `payment_id` bigint(20) unsigned NOT NULL COMMENT '返款打款流水ID',
  `payment_no` varchar(64) NOT NULL COMMENT '返款打款流水号',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_type` varchar(32) NOT NULL DEFAULT 'COD_REFUND' COMMENT '账单类型：固定COD_REFUND',
  `currency_summary_id` bigint(20) unsigned NOT NULL COMMENT '账单币种汇总ID，关联 ar_bill_currency_summary.id',
  `payment_currency` varchar(16) NOT NULL COMMENT '打款币种',
  `allocation_amount_payment_currency` decimal(18,4) NOT NULL COMMENT '打款币种分配金额',
  `bill_currency` varchar(16) NOT NULL COMMENT '账单结算币种',
  `exchange_rate_to_bill` decimal(18,8) DEFAULT NULL COMMENT '打款币种到账单币种汇率',
  `allocation_amount_bill_currency` decimal(18,4) NOT NULL COMMENT '账单币种分配金额',
  `fin_currency` varchar(16) NOT NULL DEFAULT 'CNY' COMMENT '财务本位币',
  `exchange_rate_to_fin` decimal(18,8) DEFAULT NULL COMMENT '账单币种到本位币汇率',
  `allocation_amount_fin_currency` decimal(18,4) NOT NULL COMMENT '本位币分配金额',
  `allocation_status` varchar(32) NOT NULL DEFAULT 'NORMAL' COMMENT '状态：NORMAL/REVERSED/VOID',
  `allocated_at` datetime NOT NULL COMMENT '分配时间',
  `allocated_by` varchar(64) DEFAULT NULL COMMENT '分配人',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_allocation_no` (`allocation_no`),
  KEY `idx_refund_allocation_payment` (`payment_id`),
  KEY `idx_refund_allocation_bill` (`bill_id`,`currency_summary_id`,`allocation_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='返款打款分配明细';
