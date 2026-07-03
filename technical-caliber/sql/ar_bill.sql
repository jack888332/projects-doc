/*
 Latest tmall_bms schema dump

 Source Server Type    : MySQL
 Source Server Version : 5.7.43-log
 Source Host           : rm-7xv99ejitty1k0228.mysql.rds.aliyuncs.com:3306
 Source Schema         : tmall_bms
 File Encoding         : UTF-8

 Exported At: 13/06/2026 12:08:28 CST
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for ar_bill
-- ----------------------------
DROP TABLE IF EXISTS `ar_bill`;
CREATE TABLE `ar_bill` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_title` varchar(128) NOT NULL COMMENT '账单标题',
  `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `bill_status` varchar(32) NOT NULL COMMENT '账单状态：DRAFT/GENERATED/UNDER_REVIEW/PENDING_SETTLEMENT/PART_PAID/PAID/SETTLED/VOID',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `config_no` varchar(64) DEFAULT NULL COMMENT '配置编号快照',
  `config_version` int(11) DEFAULT NULL COMMENT '配置版本快照',
  `config_snapshot_json` json DEFAULT NULL COMMENT '配置快照JSON',
  `config_type` varchar(16) NOT NULL COMMENT '配置类型：DEFAULT默认配置，BRANCH分支配置',
  `refund_mode` varchar(32) DEFAULT NULL COMMENT '返款模式：SIGNED/RECEIVED，仅COD_REFUND使用',
  `generate_task_id` bigint(20) unsigned DEFAULT NULL COMMENT '生成任务ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `member_name` varchar(128) DEFAULT NULL COMMENT '会员/客户名称',
  `customer_no` varchar(64) DEFAULT NULL COMMENT '外部客户编号',
  `customer_name` varchar(128) DEFAULT NULL COMMENT '外部客户名称',
  `destination_country` varchar(64) DEFAULT NULL COMMENT '集运目的国',
  `business_sector` varchar(64) DEFAULT NULL COMMENT '业务板块',
  `consolidation_warehouse_code` varchar(64) DEFAULT NULL COMMENT '集运仓编码',
  `billing_cycle_type` varchar(32) NOT NULL COMMENT '账期类型',
  `billing_period_start_date` date NOT NULL COMMENT '账期开始日期',
  `billing_period_end_date` date NOT NULL COMMENT '账期结束日期',
  `bill_send_date` date DEFAULT NULL COMMENT '账单发送日',
  `credit_period_end_date` date DEFAULT NULL COMMENT '信用期结束日',
  `payment_overdue_days` int(11) NOT NULL DEFAULT '0' COMMENT '付款逾期天数',
  `bill_currency` varchar(16) NOT NULL COMMENT '账单结算币种',
  `fin_currency` varchar(16) NOT NULL DEFAULT 'CNY' COMMENT '财务本位币',
  `initial_receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '初始应收金额<账单币种>',
  `principal_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金<账单币种>',
  `deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '直接扣减金额<账单币种>',
  `pending_deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '待补扣金额<账单币种>',
  `uncollected_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额<账单币种>',
  `this_adjustment_delta_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '本期调整增量<账单币种>',
  `previous_adjustment_delta_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '往期调整增量<账单币种>',
  `late_fee_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '滞纳金<账单币种>',
  `receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收金额<账单币种>',
  `paid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已核销金额<账单币种>',
  `unpaid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未核销金额<账单币种>',
  `receivable_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收金额<本位币>',
  `paid_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已核销金额<本位币>',
  `unpaid_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未核销/未返金额<本位币>',
  `principal_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金<本位币>',
  `deduction_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '直接扣减金额<本位币>',
  `uncollected_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额<本位币>',
  `confirmed_at` datetime DEFAULT NULL COMMENT '确认时间',
  `confirmed_by` varchar(64) DEFAULT NULL COMMENT '确认人',
  `settled_at` datetime DEFAULT NULL COMMENT '结清时间，仅COD_REFUND使用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0否，1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ar_bill_no` (`bill_no`),
  UNIQUE KEY `uk_ar_bill_period_sector_country` (`bill_type`,`bill_config_id`,`billing_period_start_date`,`billing_period_end_date`,`business_sector`,`destination_country`),
  KEY `idx_ar_bill_customer_status` (`sc_id`,`shop_id`,`user_id`,`member_code`,`bill_status`,`is_deleted`),
  KEY `idx_ar_bill_type_status` (`bill_type`,`bill_status`,`is_deleted`),
  KEY `idx_ar_bill_config_type` (`bill_config_id`,`config_type`),
  KEY `idx_ar_bill_country_wh` (`destination_country`,`consolidation_warehouse_code`),
  KEY `idx_ar_bill_period` (`billing_period_start_date`,`billing_period_end_date`),
  KEY `idx_ar_bill_type_member_period` (`bill_type`,`member_code`,`billing_period_start_date`,`billing_period_end_date`),
  KEY `idx_ar_bill_customer_no` (`customer_no`),
  KEY `idx_ar_bill_task` (`generate_task_id`),
  KEY `idx_ar_bill_sector_country` (`business_sector`,`destination_country`),
  KEY `idx_ar_bill_refund_mode` (`bill_type`,`refund_mode`,`member_code`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单主表：客户应收/返款/COST_AP';

-- ----------------------------
-- Table structure for ar_bill_currency_summary
-- ----------------------------
DROP TABLE IF EXISTS `ar_bill_currency_summary`;
CREATE TABLE `ar_bill_currency_summary` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `currency` varchar(16) NOT NULL COMMENT '收费币种',
  `fin_currency` varchar(16) DEFAULT NULL COMMENT '财务本位币',
  `principal_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金',
  `deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '直接扣减金额',
  `pending_deduction_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '待补扣金额',
  `uncollected_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额',
  `receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收金额',
  `paid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已核销金额',
  `unpaid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未核销金额',
  `receivable_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收/应返本位币金额',
  `paid_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已核销/已返本位币金额',
  `unpaid_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未核销/未返本位币金额',
  `principal_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '返款本金本位币',
  `deduction_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '扣减金额本位币',
  `uncollected_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未回款金额本位币',
  `fee_count` int(11) NOT NULL DEFAULT '0' COMMENT '费用明细数',
  `order_count` int(11) NOT NULL DEFAULT '0' COMMENT '涉及订单数',
  `summary_status` varchar(32) NOT NULL DEFAULT 'WAITING_PAY' COMMENT '币种核销状态：WAITING_PAY待收款，PART_PAID部分核销，PAID已核销',
  `receipt_account_id` bigint(20) unsigned DEFAULT NULL COMMENT '客户收款账户ID快照',
  `receipt_account_name` varchar(128) DEFAULT NULL COMMENT '客户收款账户名称快照',
  `receipt_account_no_masked` varchar(128) DEFAULT NULL COMMENT '客户收款账号脱敏快照',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_currency_summary` (`bill_no`,`currency`),
  KEY `idx_currency_summary_bill` (`bill_id`),
  KEY `idx_currency_summary_status` (`currency`,`summary_status`),
  KEY `idx_currency_summary_type_status` (`bill_type`,`currency`,`summary_status`)
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COMMENT='账单按币种汇总';

-- ----------------------------
-- Table structure for bill_config
-- ----------------------------
DROP TABLE IF EXISTS `bill_config`;
CREATE TABLE `bill_config` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `config_no` varchar(64) NOT NULL COMMENT '账号/账单配置编号',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `member_name` varchar(128) DEFAULT NULL COMMENT '会员/客户名称',
  `customer_no` varchar(64) DEFAULT NULL COMMENT '外部客户编号',
  `bill_name` varchar(128) NOT NULL COMMENT '账单配置名称',
  `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR客户应收等',
  `business_type_codes` varchar(500) NOT NULL COMMENT '适用业务类型编码，多选逗号分隔，如PEER,ECOMMERCE,CONSOLIDATION',
  `config_type` varchar(16) NOT NULL DEFAULT 'DEFAULT' COMMENT '配置类型：DEFAULT默认配置，BRANCH分支配置',
  `parent_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '父配置ID，分支配置指向默认配置',
  `priority` int(11) NOT NULL DEFAULT '0' COMMENT '匹配优先级，数值越小越优先；默认配置建议9999',
  `billing_currency` varchar(16) NOT NULL COMMENT '账单结算币种',
  `billing_period_type` varchar(32) NOT NULL COMMENT '账期类型：DAY/WEEK/HALF_MONTH/MONTH',
  `fin_currency` varchar(16) NOT NULL DEFAULT 'CNY' COMMENT '财务本位币',
  `bill_send_offset_days` int(11) NOT NULL DEFAULT '0' COMMENT '账单结束后第几天发送账单',
  `contract_node` varchar(64) DEFAULT NULL COMMENT '履约/归集节点',
  `credit_period_days` int(11) NOT NULL DEFAULT '0' COMMENT '信用期天数',
  `credit_level` varchar(32) DEFAULT NULL COMMENT '信用评级',
  `advance_limit_amount` decimal(18,4) DEFAULT NULL COMMENT '垫付/预支额度',
  `overdue_penalty_rate` decimal(10,6) DEFAULT NULL COMMENT '逾期费率',
  `effective_start_date` date NOT NULL COMMENT '生效开始日期',
  `effective_end_date` date DEFAULT NULL COMMENT '生效结束日期',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `version` int(11) NOT NULL DEFAULT '1' COMMENT '版本号',
  `is_current_version` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否当前版本',
  `extra_json` json DEFAULT NULL COMMENT '扩展配置JSON',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0否，1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_config_version` (`config_no`,`version`),
  KEY `idx_bill_config_customer` (`sc_id`,`shop_id`,`user_id`,`member_code`,`status`,`is_deleted`),
  KEY `idx_bill_config_current` (`sc_id`,`shop_id`,`user_id`,`member_code`,`config_type`,`is_current_version`,`is_deleted`),
  KEY `idx_bill_config_parent` (`parent_config_id`,`config_type`,`priority`,`status`,`is_deleted`),
  KEY `idx_bill_config_effective` (`effective_start_date`,`effective_end_date`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账号/账单配置：默认配置/目的国仓库分支配置';

-- ----------------------------
-- Table structure for bill_config_fee_currency_rule
-- ----------------------------
DROP TABLE IF EXISTS `bill_config_fee_currency_rule`;
CREATE TABLE `bill_config_fee_currency_rule` (
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
) ENGINE=InnoDB AUTO_INCREMENT=156 DEFAULT CHARSET=utf8mb4 COMMENT='账单配置费项收费币种规则';

-- ----------------------------
-- Table structure for bill_config_scope
-- ----------------------------
DROP TABLE IF EXISTS `bill_config_scope`;
CREATE TABLE `bill_config_scope` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `scope_type` varchar(32) NOT NULL COMMENT '限定类型：DEST_COUNTRY集运目的国，WAREHOUSE集运仓',
  `scope_code` varchar(64) NOT NULL COMMENT '限定值编码',
  `scope_name` varchar(128) DEFAULT NULL COMMENT '限定值名称',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_scope` (`bill_config_id`,`scope_type`,`scope_code`),
  KEY `idx_scope_lookup` (`scope_type`,`scope_code`,`bill_config_id`)
) ENGINE=InnoDB AUTO_INCREMENT=90 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单配置限定范围';

-- ----------------------------
-- Table structure for base_exchange_rate
-- ----------------------------
DROP TABLE IF EXISTS `tmall_bms`.`base_exchange_rate`;
CREATE TABLE `tmall_bms`.`base_exchange_rate` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `source_currency` varchar(16) NOT NULL COMMENT '源币种，必须为外币',
  `target_currency` varchar(16) NOT NULL COMMENT '目标币种，必须为财务本位币',
  `conversion_direction` varchar(8) NOT NULL DEFAULT 'MUL' COMMENT '换算方向：MUL乘汇率，DIV除汇率',
  `exchange_rate` decimal(18,8) NOT NULL COMMENT '基准汇率',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `confirmed_by` varchar(64) DEFAULT NULL COMMENT '确认人',
  `confirmed_at` datetime DEFAULT NULL COMMENT '确认时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0正常，1删除',
  `active_unique_guard` tinyint(1) GENERATED ALWAYS AS ((case when (`is_deleted` = 0) then 1 else NULL end)) STORED COMMENT '未删除唯一约束辅助列：未删除时为1，已删除时为NULL',
  `currency_pair_key` varchar(40) GENERATED ALWAYS AS (concat(least(`source_currency`,`target_currency`),'|',greatest(`source_currency`,`target_currency`))) STORED COMMENT '无方向货币对唯一键',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_base_rate_pair_active` (`currency_pair_key`,`active_unique_guard`),
  KEY `idx_rate_pair` (`source_currency`,`target_currency`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='基准汇率';

-- ----------------------------
-- Table structure for customer_exchange_rate_rule
-- ----------------------------
DROP TABLE IF EXISTS `tmall_bms`.`customer_exchange_rate_rule`;
CREATE TABLE `tmall_bms`.`customer_exchange_rate_rule` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `sc_id` bigint(20) DEFAULT NULL COMMENT '供应链ID',
  `shop_id` bigint(20) DEFAULT NULL COMMENT '店铺ID',
  `user_id` bigint(20) DEFAULT NULL COMMENT '用户ID',
  `customer_no` varchar(64) DEFAULT NULL COMMENT '客户编码',
  `member_code` varchar(64) DEFAULT NULL COMMENT '会员编码',
  `customer_name` varchar(128) DEFAULT NULL COMMENT '客户名称',
  `source_currency` varchar(16) NOT NULL COMMENT '源币种，ALL代表全部外币',
  `target_currency` varchar(16) NOT NULL COMMENT '目标币种，必须为财务本位币',
  `adjust_type` varchar(16) NOT NULL COMMENT '调整方式：FIXED固定汇率，PERCENT按百分比调整，DELTA固定汇率差',
  `adjust_direction` varchar(8) NOT NULL DEFAULT 'NONE' COMMENT '调整方向：UP上浮，DOWN下浮，NONE不适用',
  `adjust_value` decimal(18,8) NOT NULL COMMENT '调整值；PERCENT时2代表2%',
  `default_exchange_rate` decimal(18,8) DEFAULT NULL COMMENT '默认基准汇率',
  `customer_exchange_rate` decimal(18,8) DEFAULT NULL COMMENT '计算后的客户汇率',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0正常，1删除',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`id`),
  KEY `idx_sc_shop_user` (`sc_id`,`shop_id`,`user_id`),
  KEY `idx_customer_pair` (`customer_no`,`member_code`,`source_currency`,`target_currency`,`status`),
  KEY `idx_rule_pair` (`source_currency`,`target_currency`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='客户特调汇率规则';

-- ----------------------------
-- Table structure for customer_exchange_rate_rule_log
-- ----------------------------
DROP TABLE IF EXISTS `tmall_bms`.`customer_exchange_rate_rule_log`;
CREATE TABLE `tmall_bms`.`customer_exchange_rate_rule_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `rule_id` bigint(20) unsigned NOT NULL COMMENT '客户特调汇率规则ID',
  `action_type` varchar(32) NOT NULL COMMENT '操作类型：CREATE新增，UPDATE修改，STATUS状态变更',
  `before_status` tinyint(1) DEFAULT NULL COMMENT '调整前状态',
  `after_status` tinyint(1) DEFAULT NULL COMMENT '调整后状态',
  `before_adjust_type` varchar(16) DEFAULT NULL COMMENT '调整前方式',
  `after_adjust_type` varchar(16) DEFAULT NULL COMMENT '调整后方式',
  `before_adjust_direction` varchar(8) DEFAULT NULL COMMENT '调整前方向',
  `after_adjust_direction` varchar(8) DEFAULT NULL COMMENT '调整后方向',
  `before_adjust_value` decimal(18,8) DEFAULT NULL COMMENT '调整前值',
  `after_adjust_value` decimal(18,8) DEFAULT NULL COMMENT '调整后值',
  `operator` varchar(64) DEFAULT NULL COMMENT '操作人',
  `operated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  KEY `idx_rule_log` (`rule_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='客户特调汇率规则变更日志';

-- ----------------------------
-- Table structure for bill_exchange_rate
-- ----------------------------
DROP TABLE IF EXISTS `bill_exchange_rate`;
CREATE TABLE `bill_exchange_rate` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `bill_currency` varchar(16) NOT NULL COMMENT '目标币种',
  `conversion_currency` varchar(16) NOT NULL COMMENT '来源币种',
  `conversion_currency_type` varchar(32) NOT NULL COMMENT '转换类型：FEE_TO_BILL费项原始币种转账单结算币种，BILL_TO_FIN账单结算币种转财务本位币',
  `conversion_direction` varchar(8) NOT NULL COMMENT '换算方向：MUL/DIV',
  `exchange_rate` decimal(18,8) NOT NULL COMMENT '锁定汇率',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '账单汇率配置固定启用；历史0值仅兼容读取',
  `rate_date` date DEFAULT NULL COMMENT '汇率日期',
  `rate_source` varchar(64) DEFAULT NULL COMMENT '汇率来源',
  `source_type` varchar(16) NOT NULL DEFAULT 'SYSTEM' COMMENT '来源：SYSTEM系统，MANUAL人工',
  `hit_level` varchar(32) DEFAULT NULL COMMENT '命中级别：BILL/CUSTOMER/BASE/SHOP/FALLBACK_ONE/DIRECT',
  `customer_rule_id` bigint(20) unsigned DEFAULT NULL COMMENT '客户特调汇率规则ID',
  `base_rate_id` bigint(20) unsigned DEFAULT NULL COMMENT '基准汇率ID',
  `secondary_base_rate_id` bigint(20) unsigned DEFAULT NULL COMMENT 'CNY交叉推导的第二条基准汇率ID',
  `source_rate_value` decimal(18,8) DEFAULT NULL COMMENT '调整或推导前基础汇率',
  `adjust_type` varchar(16) DEFAULT NULL COMMENT '客户调整方式',
  `adjust_direction` varchar(8) DEFAULT NULL COMMENT '客户调整方向：UP/DOWN/NONE',
  `adjust_value` decimal(18,8) DEFAULT NULL COMMENT '客户调整值',
  `derivation_type` varchar(16) DEFAULT NULL COMMENT '推导类型：DIRECT/REVERSE/CNY_CROSS/NONE',
  `derivation_expression` varchar(500) DEFAULT NULL COMMENT '汇率推导表达式',
  `fallback_reason` varchar(500) DEFAULT NULL COMMENT '按1兜底原因',
  `edit_reason` varchar(500) DEFAULT NULL COMMENT '人工编辑原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_rate` (`bill_type`,`bill_id`,`bill_currency`,`conversion_currency`,`conversion_currency_type`),
  KEY `idx_bill_rate_no` (`bill_no`),
  KEY `idx_bill_rate_no_type` (`bill_no`,`bill_type`),
  KEY `idx_bill_rate_customer_rule` (`customer_rule_id`),
  KEY `idx_bill_rate_base_rate` (`base_rate_id`),
  KEY `idx_bill_rate_secondary_base` (`secondary_base_rate_id`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单汇率';

-- ----------------------------
-- Table structure for bill_fee_currency_template
-- ----------------------------
DROP TABLE IF EXISTS `bill_fee_currency_template`;
CREATE TABLE `bill_fee_currency_template` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `template_code` varchar(64) NOT NULL COMMENT '模板编码',
  `template_name` varchar(128) NOT NULL COMMENT '模板名称',
  `business_type_code` varchar(32) NOT NULL DEFAULT 'CONSOLIDATION' COMMENT '业务场景',
  `country_code` varchar(16) DEFAULT NULL COMMENT '目的国编码',
  `country_name` varchar(64) DEFAULT NULL COMMENT '目的国名称',
  `country_alias_codes` varchar(500) DEFAULT NULL COMMENT '目的国别名集合，逗号分隔',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_fee_currency_template_code` (`template_code`),
  KEY `idx_bill_fee_currency_template_country` (`country_code`,`business_type_code`,`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COMMENT='目的国费项收费币种模板';

-- ----------------------------
-- Table structure for bill_fee_currency_template_rule
-- ----------------------------
DROP TABLE IF EXISTS `bill_fee_currency_template_rule`;
CREATE TABLE `bill_fee_currency_template_rule` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `template_id` bigint(20) unsigned NOT NULL COMMENT '模板ID',
  `business_type_code` varchar(32) NOT NULL DEFAULT 'CONSOLIDATION' COMMENT '业务场景',
  `fee_index_id` bigint(20) unsigned DEFAULT NULL COMMENT '费项索引ID',
  `fee_code` varchar(64) NOT NULL COMMENT '费项编码',
  `fee_name` varchar(128) DEFAULT NULL COMMENT '费项名称',
  `charge_currency_mode` varchar(32) NOT NULL DEFAULT 'SOURCE' COMMENT '收费币种模式：CONFIG_DEFAULT/SOURCE/FIXED',
  `charge_currency` varchar(16) DEFAULT NULL COMMENT '固定收费币种',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_bill_fee_currency_template_rule_tpl` (`template_id`,`enabled`),
  KEY `idx_bill_fee_currency_template_rule_fee` (`fee_code`,`business_type_code`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COMMENT='目的国费项收费币种模板明细';

-- ----------------------------
-- Table structure for bill_generate_task
-- ----------------------------
DROP TABLE IF EXISTS `bill_generate_task`;
CREATE TABLE `bill_generate_task` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `task_no` varchar(64) NOT NULL COMMENT '任务编号',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `billing_period_start_date` date NOT NULL COMMENT '账期开始日期',
  `billing_period_end_date` date NOT NULL COMMENT '账期结束日期',
  `task_status` varchar(32) NOT NULL COMMENT '任务状态：PENDING/RUNNING/SUCCESS/FAILED/CANCELED/NEED_RETRY',
  `trigger_type` varchar(32) NOT NULL DEFAULT 'SCHEDULE' COMMENT '触发方式：SCHEDULE/MANUAL/RETRY',
  `data_pull_type` varchar(32) NOT NULL DEFAULT 'FULL' COMMENT '数据拉取类型：FULL全量/INCREMENTAL增量',
  `idempotent_key` varchar(128) NOT NULL COMMENT '任务幂等键',
  `retry_count` int(11) NOT NULL DEFAULT '0' COMMENT '重试次数',
  `started_at` datetime DEFAULT NULL COMMENT '开始时间',
  `finished_at` datetime DEFAULT NULL COMMENT '结束时间',
  `duration_ms` bigint(20) DEFAULT '0' COMMENT '执行耗时毫秒',
  `pulled_order_count` int(11) NOT NULL DEFAULT '0' COMMENT '拉取订单数',
  `matched_order_count` int(11) NOT NULL DEFAULT '0' COMMENT '命中出账订单数',
  `skipped_order_count` int(11) NOT NULL DEFAULT '0' COMMENT '跳过订单数',
  `fee_detail_count` int(11) NOT NULL DEFAULT '0' COMMENT '生成费用明细数',
  `additional_fee_count` int(11) NOT NULL DEFAULT '0' COMMENT '生成附加费明细数',
  `failed_count` int(11) NOT NULL DEFAULT '0' COMMENT '失败数据数',
  `receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '本任务生成应收金额',
  `error_message` varchar(2000) DEFAULT NULL COMMENT '错误信息',
  `bill_config_snapshot_json` json DEFAULT NULL COMMENT '账单配置快照JSON',
  `bill_scope_snapshot_json` json DEFAULT NULL COMMENT '账单配置范围快照JSON',
  `fee_rule_snapshot_json` json DEFAULT NULL COMMENT '费项规则快照JSON',
  `order_source_sql` longtext COMMENT '本次任务拉取主订单宽表实际执行SQL',
  `additional_source_sql` longtext COMMENT '本次任务拉取附加费实际执行SQL',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_idempotent` (`idempotent_key`),
  UNIQUE KEY `uk_task_period` (`bill_config_id`,`bill_type`,`billing_period_start_date`,`billing_period_end_date`,`trigger_type`),
  KEY `idx_task_status` (`task_status`,`created_at`),
  KEY `idx_task_subject_period` (`sc_id`,`shop_id`,`user_id`,`member_code`,`billing_period_start_date`),
  KEY `idx_task_subject_period_type` (`sc_id`,`shop_id`,`user_id`,`member_code`,`bill_type`,`billing_period_start_date`)
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单生成任务';

-- ----------------------------
-- Table structure for bill_source_collect_mark
-- ----------------------------
DROP TABLE IF EXISTS `bill_source_collect_mark`;
CREATE TABLE `bill_source_collect_mark` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `collect_no` varchar(64) NOT NULL COMMENT '归集标记编号',
  `collect_type` varchar(32) NOT NULL COMMENT '归集类型：MAIN_ORDER主订单，ADDITIONAL_FEE附加费，ADDITIONAL_INCREMENT附加费增量',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `source_database` varchar(64) DEFAULT NULL COMMENT '来源库',
  `source_table` varchar(128) NOT NULL COMMENT '来源表',
  `source_id` varchar(128) NOT NULL COMMENT '来源数据ID',
  `source_biz_no` varchar(128) DEFAULT NULL COMMENT '来源业务单号',
  `source_order_id` varchar(128) DEFAULT NULL COMMENT '来源订单ID',
  `source_order_no` varchar(128) DEFAULT NULL COMMENT '来源订单号',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `generate_task_id` bigint(20) unsigned DEFAULT NULL COMMENT '生成任务ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `mark_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '源表打标状态：PENDING待打标，MARKED已打标，FAILED打标失败',
  `marked_at` datetime DEFAULT NULL COMMENT '源表打标成功时间',
  `retry_count` int(11) NOT NULL DEFAULT '0' COMMENT '打标重试次数',
  `last_retry_at` datetime DEFAULT NULL COMMENT '最近重试时间',
  `last_error_message` varchar(2000) DEFAULT NULL COMMENT '最近失败原因',
  `source_snapshot_json` json DEFAULT NULL COMMENT '来源数据关键字段快照',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_collect_no` (`collect_no`),
  UNIQUE KEY `uk_source_collect` (`source_system`,`source_table`,`source_id`,`collect_type`),
  KEY `idx_collect_bill` (`bill_id`,`collect_type`,`mark_status`),
  KEY `idx_collect_task` (`generate_task_id`,`mark_status`),
  KEY `idx_collect_subject` (`sc_id`,`shop_id`,`user_id`,`member_code`,`mark_status`),
  KEY `idx_collect_source_order` (`source_order_id`,`source_order_no`),
  KEY `idx_collect_retry` (`mark_status`,`retry_count`,`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=253 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单来源归集标记/跨库打标补偿记录';

-- ----------------------------
-- Table structure for bms_operation_log
-- ----------------------------
DROP TABLE IF EXISTS `bms_operation_log`;
CREATE TABLE `bms_operation_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `biz_type` varchar(64) NOT NULL COMMENT '业务类型',
  `biz_id` varchar(64) NOT NULL COMMENT '业务ID',
  `operation_type` varchar(64) NOT NULL COMMENT '操作类型',
  `before_json` json DEFAULT NULL COMMENT '操作前JSON',
  `after_json` json DEFAULT NULL COMMENT '操作后JSON',
  `operator_id` varchar(64) DEFAULT NULL COMMENT '操作人ID',
  `operator_name` varchar(128) DEFAULT NULL COMMENT '操作人名称',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_operation_biz` (`biz_type`,`biz_id`,`created_at`),
  KEY `idx_operation_operator` (`operator_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='BMS操作日志';

-- ----------------------------
-- Table structure for business_type_fee_index
-- ----------------------------
DROP TABLE IF EXISTS `business_type_fee_index`;
CREATE TABLE `business_type_fee_index` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `business_type_code` varchar(64) NOT NULL COMMENT '业务类型编码：PEER同行订单，ECOMMERCE电商订单，CONSOLIDATION集运订单',
  `business_type_name` varchar(128) NOT NULL COMMENT '业务类型名称',
  `fee_index_id` bigint(20) unsigned NOT NULL COMMENT '费项索引ID',
  `fee_source_rule_id` bigint(20) unsigned NOT NULL COMMENT '费项数据来源规则ID',
  `fee_code` varchar(64) NOT NULL COMMENT '费项编码快照',
  `fee_name` varchar(128) NOT NULL COMMENT '费项名称快照',
  `fee_type` varchar(16) NOT NULL COMMENT '费用类型：AR/ARD/AP/ARAP/NON_FEE',
  `priority` int(11) NOT NULL DEFAULT '0' COMMENT '业务类型内归集优先级',
  `cod_collection_check_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'COD代收货款判定标记：1表示该费项作为COD返款账单代收货款判断项，且金额需大于0才允许继续拉取其他直接扣减费项；0表示否',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `extra_json` json DEFAULT NULL COMMENT '扩展配置JSON',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_business_fee_rule` (`business_type_code`,`fee_index_id`,`fee_source_rule_id`),
  KEY `idx_business_fee_enabled` (`business_type_code`,`enabled`,`priority`),
  KEY `idx_business_fee_rule` (`fee_source_rule_id`),
  KEY `idx_business_fee_index` (`fee_index_id`)
) ENGINE=InnoDB AUTO_INCREMENT=90 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='业务类型关联费项';

-- ----------------------------
-- Table structure for fee_adjustment_order
-- ----------------------------
DROP TABLE IF EXISTS `fee_adjustment_order`;
CREATE TABLE `fee_adjustment_order` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `adjustment_no` varchar(64) NOT NULL COMMENT '调账/红冲单号',
  `adjustment_type` varchar(32) NOT NULL COMMENT '类型：ADJUST调账，REVERSAL红冲',
  `adjustment_period_type` varchar(16) NOT NULL DEFAULT 'CURRENT' COMMENT '调账账期类型：CURRENT本期，PREVIOUS往期',
  `trigger_bill_id` bigint(20) unsigned NOT NULL COMMENT '触发账单ID',
  `trigger_bill_no` varchar(64) NOT NULL COMMENT '触发账单编号',
  `source_bill_no` varchar(64) DEFAULT NULL COMMENT '来源账单编号',
  `target_bill_no` varchar(64) DEFAULT NULL COMMENT '计入目标账单编号',
  `source_bill_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '来源账单配置ID',
  `source_main_order_id` bigint(20) unsigned DEFAULT NULL COMMENT '来源BMS订单快照ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `adjustment_status` varchar(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/SUBMITTED/APPROVED/REJECTED/POSTED/VOID',
  `adjustment_currency` varchar(16) NOT NULL COMMENT '调账币种',
  `adjustment_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '调账总金额',
  `rebuild_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否重整生成：0否，1是',
  `import_batch_no` varchar(64) DEFAULT NULL COMMENT '导入批次号',
  `original_amount` decimal(18,4) DEFAULT NULL COMMENT '原金额',
  `rebuilt_amount` decimal(18,4) DEFAULT NULL COMMENT '重整后金额',
  `reason` varchar(500) DEFAULT NULL COMMENT '原因',
  `voucher_url` varchar(500) DEFAULT NULL COMMENT '凭证URL',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `approved_at` datetime DEFAULT NULL COMMENT '审核时间',
  `approved_by` varchar(64) DEFAULT NULL COMMENT '审核人',
  `posted_at` datetime DEFAULT NULL COMMENT '入账时间',
  `posted_by` varchar(64) DEFAULT NULL COMMENT '入账人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adjustment_no` (`adjustment_no`),
  KEY `idx_adjustment_bill` (`trigger_bill_id`),
  KEY `idx_adjustment_subject` (`sc_id`,`shop_id`,`user_id`,`member_code`,`adjustment_status`,`created_at`),
  KEY `idx_adjustment_source_bill` (`source_bill_no`,`target_bill_no`),
  KEY `idx_adjustment_period` (`trigger_bill_no`,`adjustment_period_type`,`adjustment_status`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费用调账/红冲单';

-- ----------------------------
-- Table structure for fee_adjustment_record
-- ----------------------------
DROP TABLE IF EXISTS `fee_adjustment_record`;
CREATE TABLE `fee_adjustment_record` (
  `id` varchar(64) NOT NULL COMMENT 'ID',
  `adjustment_no` varchar(64) NOT NULL COMMENT '调账单号',
  `adjustment_object` varchar(16) DEFAULT NULL COMMENT '调账对象：BILL/ORDER/FEE',
  `object_no` varchar(64) DEFAULT NULL COMMENT '调账对象编号',
  `adjustment_type` varchar(16) DEFAULT NULL COMMENT '调账类型：ADJUST/REVERSAL',
  `fee_id` bigint(20) unsigned NOT NULL COMMENT '费项ID',
  `fee_adjustment_reason` varchar(500) DEFAULT NULL COMMENT '冲正理由',
  `fee_adjustment_currency` varchar(16) NOT NULL COMMENT '冲正所用币种',
  `adjustment_delta_in_fee_adjustment_currency` decimal(18,4) NOT NULL COMMENT '冲正幅度<冲正所用币种>',
  `adjusted_amount_in_fee_adjustment_currency` decimal(18,4) NOT NULL COMMENT '冲正后金额<冲正所用币种>',
  `trigger_bill_id` bigint(20) unsigned NOT NULL COMMENT '触发账单ID',
  `assigned_bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '归属账单ID',
  `assigned_bill_no` varchar(64) DEFAULT NULL COMMENT '归属账单号',
  `assigned_bill_type` varchar(32) DEFAULT NULL COMMENT '归属账单类型',
  `assignment_mode` varchar(16) DEFAULT NULL COMMENT '归属方式：AUTO/MANUAL',
  `trigger_bill_currency` varchar(16) NOT NULL COMMENT '触发结算币种',
  `exchange_rate_c1` decimal(18,8) DEFAULT NULL COMMENT '锁定汇率<L1>',
  `exchange_rate_level_c1` varchar(16) DEFAULT NULL COMMENT '汇率级别<L1>',
  `adjustment_delta_in_trigger_bill_currency` decimal(18,4) NOT NULL COMMENT '金额变幅<结算币种>',
  `adjusted_amount_in_trigger_bill_currency` decimal(18,4) NOT NULL COMMENT '冲正后金额<结算币种>',
  `exchange_rate_c2` decimal(18,8) DEFAULT NULL COMMENT '锁定汇率<L2>',
  `exchange_rate_level_c2` varchar(16) DEFAULT NULL COMMENT '汇率级别<L2>',
  `adjustment_delta_in_fin_currency` decimal(18,4) NOT NULL COMMENT '金额变幅<财务本位币>',
  `adjusted_amount_in_fin_currency` decimal(18,4) NOT NULL COMMENT '冲正后金额<财务本位币>',
  `voucher_url` varchar(500) DEFAULT NULL COMMENT '费用凭证URL',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登记时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '登记人',
  `approval_status` varchar(32) DEFAULT NULL COMMENT '审核状态',
  `rejected_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因',
  `approved_by` varchar(64) DEFAULT NULL COMMENT '审核人',
  `approved_at` datetime DEFAULT NULL COMMENT '审核时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`id`),
  KEY `idx_fee_adjustment_no` (`adjustment_no`),
  KEY `idx_fee_adjustment_fee_id` (`fee_id`),
  KEY `idx_fee_adjustment_assigned_bill_no` (`assigned_bill_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='调账中心主记录';

-- ----------------------------
-- Table structure for fee_detail
-- ----------------------------
DROP TABLE IF EXISTS `fee_detail`;
CREATE TABLE `fee_detail` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `fee_no` varchar(64) NOT NULL COMMENT '费用编号',
  `bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_type` varchar(32) NOT NULL DEFAULT 'MEMBER_AR' COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `bill_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单配置ID',
  `related_bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '关联账单ID，可同时挂第二张账单',
  `related_bill_no` varchar(64) DEFAULT NULL COMMENT '关联账单编号，可同时挂第二张账单',
  `related_bill_type` varchar(32) DEFAULT NULL COMMENT '关联账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `related_bill_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '关联账单配置ID',
  `business_type_code` varchar(64) DEFAULT NULL COMMENT '命中的业务类型编码',
  `business_type_fee_id` bigint(20) unsigned DEFAULT NULL COMMENT '命中的业务类型费项关联ID',
  `generate_task_id` bigint(20) unsigned DEFAULT NULL COMMENT '生成任务ID',
  `sc_id` bigint(20) DEFAULT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) DEFAULT NULL COMMENT '店铺ID',
  `user_id` bigint(20) DEFAULT NULL COMMENT '用户ID',
  `member_code` varchar(64) DEFAULT NULL COMMENT '会员/客户编码',
  `fee_index_id` bigint(20) unsigned NOT NULL COMMENT '费项索引ID',
  `fee_source_rule_id` bigint(20) unsigned DEFAULT NULL COMMENT '费项数据来源规则ID',
  `fee_code` varchar(64) NOT NULL COMMENT '费项编码',
  `fee_name` varchar(128) NOT NULL COMMENT '费项名称',
  `fee_type` varchar(16) NOT NULL COMMENT '费用类型：AR/ARD/AP/ARAP/NON_FEE',
  `settlement_role` varchar(32) NOT NULL DEFAULT 'RECEIVABLE' COMMENT '结算角色：RECEIVABLE/REFUND_PRINCIPAL/REFUND_DEDUCTION/REFUND_ADJUSTMENT/REFUND_UNCOLLECTED',
  `attached_object` varchar(16) NOT NULL COMMENT '挂靠对象：BILL/ORDER/LAST_PACKAGE/FIRST_PACKAGE',
  `business_order_no` varchar(64) DEFAULT NULL COMMENT '业务主单号',
  `related_business_order_no` varchar(64) DEFAULT NULL COMMENT '关联单号/关联主单号',
  `destination_country` varchar(64) DEFAULT NULL COMMENT '集运目的国',
  `consolidation_warehouse_code` varchar(64) DEFAULT NULL COMMENT '集运仓编码',
  `last_mile_waybill_no` varchar(64) DEFAULT NULL COMMENT '尾程运单号',
  `first_mile_waybill_no` varchar(64) DEFAULT NULL COMMENT '首程运单号',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统',
  `source_table` varchar(128) NOT NULL COMMENT '来源表',
  `source_id` varchar(128) NOT NULL COMMENT '来源数据ID',
  `source_order_id` varchar(128) DEFAULT NULL COMMENT '来源业务主单ID',
  `source_bill_no` varchar(128) DEFAULT NULL COMMENT '来源财务账单号',
  `source_biz_no` varchar(128) DEFAULT NULL COMMENT '来源业务单号',
  `source_fee_field` varchar(128) DEFAULT NULL COMMENT '来源金额字段',
  `source_fee_time` datetime DEFAULT NULL COMMENT '来源费用发生时间',
  `source_pay_status` varchar(64) DEFAULT NULL COMMENT '来源费用支付状态',
  `source_row_hash` varchar(64) DEFAULT NULL COMMENT '来源关键字段哈希，用于检测来源数据变化',
  `source_extra_json` json DEFAULT NULL COMMENT '来源扩展快照JSON',
  `dedupe_key` varchar(255) NOT NULL COMMENT '费用幂等键',
  `fee_currency` varchar(16) NOT NULL COMMENT '费用原始币种',
  `amount_in_fee_currency` decimal(18,4) DEFAULT NULL COMMENT '兼容旧结构：费用金额<费用原始币种>',
  `exchange_rate_c1` decimal(18,8) DEFAULT NULL COMMENT '兼容旧结构：锁定汇率<L1>',
  `exchange_rate_level_c1` varchar(16) DEFAULT NULL COMMENT '兼容旧结构：汇率级别<L1>',
  `amount_fee_currency` decimal(18,4) NOT NULL COMMENT '费用金额<原始币种>',
  `exchange_rate_to_bill` decimal(18,8) DEFAULT NULL COMMENT '原始币种到账单币种汇率',
  `exchange_rate_level_to_bill` varchar(16) DEFAULT NULL COMMENT '汇率级别',
  `bill_currency` varchar(16) NOT NULL COMMENT '账单币种',
  `amount_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '兼容旧结构：费用金额<结算币种>',
  `exchange_rate_c2` decimal(18,8) DEFAULT NULL COMMENT '兼容旧结构：锁定汇率<L2>',
  `exchange_rate_level_c2` varchar(16) DEFAULT NULL COMMENT '兼容旧结构：汇率级别<L2>',
  `amount_bill_currency` decimal(18,4) NOT NULL COMMENT '费用金额<账单币种>',
  `related_bill_currency` varchar(16) DEFAULT NULL COMMENT '关联账单币种',
  `related_amount_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '费用金额<关联账单币种>',
  `related_exchange_rate_to_bill` decimal(18,8) DEFAULT NULL COMMENT '原始币种到关联账单币种汇率',
  `related_exchange_rate_level_to_bill` varchar(16) DEFAULT NULL COMMENT '关联账单汇率级别',
  `exchange_rate_to_fin` decimal(18,8) DEFAULT NULL COMMENT '账单币种到本位币汇率',
  `exchange_rate_level_to_fin` varchar(16) DEFAULT NULL COMMENT '汇率级别',
  `fin_currency` varchar(16) NOT NULL DEFAULT 'CNY' COMMENT '财务本位币',
  `amount_fin_currency` decimal(18,4) NOT NULL COMMENT '费用金额<本位币>',
  `related_fin_currency` varchar(16) DEFAULT NULL COMMENT '关联账单财务本位币',
  `related_amount_fin_currency` decimal(18,4) DEFAULT NULL COMMENT '费用金额<关联账单本位币>',
  `related_exchange_rate_to_fin` decimal(18,8) DEFAULT NULL COMMENT '关联账单币种到本位币汇率',
  `related_exchange_rate_level_to_fin` varchar(16) DEFAULT NULL COMMENT '关联账单本位币汇率级别',
  `related_settlement_role` varchar(32) DEFAULT NULL COMMENT '关联账单结算角色：RECEIVABLE/REFUND_PRINCIPAL/REFUND_DEDUCTION/REFUND_ADJUSTMENT/REFUND_UNCOLLECTED',
  `fee_status` varchar(32) NOT NULL DEFAULT 'NORMAL' COMMENT '费用状态：NORMAL/ADJUSTED/REVERSED/VOID',
  `manual_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否手工补录：0否，1是',
  `manual_reason` varchar(500) DEFAULT NULL COMMENT '手工补录原因',
  `original_fee_id` bigint(20) unsigned DEFAULT NULL COMMENT '原费用ID，红冲/调账时使用',
  `offset_bill_no` varchar(64) DEFAULT NULL COMMENT '对冲账单号',
  `voucher_url` varchar(500) DEFAULT NULL COMMENT '费用凭证URL',
  `voucher_rul` varchar(500) DEFAULT NULL COMMENT '兼容旧结构：费用凭证URL',
  `voucher_supplier` varchar(128) DEFAULT NULL COMMENT '费用凭证供应商',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fee_no` (`fee_no`),
  UNIQUE KEY `uk_fee_dedupe` (`dedupe_key`),
  KEY `idx_fee_bill` (`bill_id`,`fee_type`,`fee_status`),
  KEY `idx_fee_bill_type` (`bill_type`,`bill_id`,`settlement_role`,`fee_status`),
  KEY `idx_fee_config` (`bill_config_id`,`fee_code`),
  KEY `idx_fee_business_type` (`business_type_code`,`business_type_fee_id`),
  KEY `idx_fee_country_wh` (`destination_country`,`consolidation_warehouse_code`),
  KEY `idx_fee_subject_time` (`sc_id`,`shop_id`,`user_id`,`member_code`,`source_fee_time`),
  KEY `idx_fee_order` (`business_order_no`),
  KEY `idx_fee_related_order` (`related_business_order_no`),
  KEY `idx_fee_last_waybill` (`last_mile_waybill_no`),
  KEY `idx_fee_first_waybill` (`first_mile_waybill_no`),
  KEY `idx_fee_source` (`source_system`,`source_table`,`source_id`),
  KEY `idx_fee_source_rule` (`fee_source_rule_id`),
  KEY `idx_fee_original` (`original_fee_id`),
  KEY `idx_fee_related_bill_type` (`related_bill_type`,`related_bill_id`,`related_settlement_role`,`fee_status`),
  KEY `idx_fee_related_bill_no` (`related_bill_no`)
) ENGINE=InnoDB AUTO_INCREMENT=614 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费用详情/费用快照（支持双账单关联）';

-- ----------------------------
-- Table structure for fee_index
-- ----------------------------
DROP TABLE IF EXISTS `fee_index`;
CREATE TABLE `fee_index` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `fee_code` varchar(64) NOT NULL COMMENT '费项编码',
  `fee_name` varchar(128) NOT NULL COMMENT '费项名称',
  `fee_type` varchar(16) NOT NULL COMMENT '费用类型：AR应收，ARD应收扣减，AP成本，ARAP代收代付，NON_FEE非费项',
  `attachment_object` varchar(16) NOT NULL COMMENT '挂靠对象：BILL账单，ORDER业务主单，LAST_PACKAGE尾程包裹，FIRST_PACKAGE首程包裹',
  `legacy_data_source` varchar(255) DEFAULT NULL COMMENT '旧数据源描述，兼容历史数据；新逻辑使用fee_source_rule',
  `scenario_tag` varchar(64) DEFAULT NULL COMMENT '场景标签',
  `applicable_order_source` varchar(255) DEFAULT NULL COMMENT '适用订单来源，逗号分隔',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fee_code` (`fee_code`),
  KEY `idx_fee_type_object` (`fee_type`,`attachment_object`,`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费项索引';

-- ----------------------------
-- Table structure for fee_source_dataset
-- ----------------------------
DROP TABLE IF EXISTS `fee_source_dataset`;
CREATE TABLE `fee_source_dataset` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `dataset_code` varchar(64) NOT NULL COMMENT '数据集编码，如CONSOLIDATION_ORDER',
  `dataset_name` varchar(128) NOT NULL COMMENT '数据集名称',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `datasource_code` varchar(64) NOT NULL DEFAULT 'OFP_DB' COMMENT '数据源编码，关联fee_source_datasource.datasource_code',
  `source_database` varchar(64) DEFAULT NULL COMMENT '来源库',
  `main_table` varchar(128) NOT NULL COMMENT '主表',
  `main_alias` varchar(32) DEFAULT NULL COMMENT '主表别名',
  `join_sql` varchar(1000) DEFAULT NULL COMMENT '关联SQL片段，不含FROM主表',
  `base_where_expr` varchar(1000) DEFAULT NULL COMMENT '公共过滤条件',
  `billed_flag_column` varchar(128) DEFAULT NULL COMMENT '计费标记字段',
  `bill_no_column` varchar(128) DEFAULT NULL COMMENT '账单编号打标字段',
  `weight_outbound_time_column` varchar(255) DEFAULT NULL COMMENT '出库时间表达式',
  `sign_time_column` varchar(255) DEFAULT NULL COMMENT '签收时间表达式',
  `order_completed_time_column` varchar(255) DEFAULT NULL COMMENT '订单完结时间表达式',
  `received_time_column` varchar(255) DEFAULT NULL COMMENT '回款时间表达式',
  `incremental_time_column` varchar(255) DEFAULT NULL COMMENT '追加/增量时间表达式',
  `supported_contract_nodes` varchar(255) DEFAULT NULL COMMENT '支持履约节点，逗号分隔：WEIGHT_OUTBOUND,ORDER_COMPLETED,SIGN,RECEIVED,INCREMENTAL',
  `query_window_days` int(11) NOT NULL DEFAULT '1' COMMENT '源数据查询窗口天数，1表示按天拆分',
  `query_page_size` int(11) NOT NULL DEFAULT '500' COMMENT '源数据分页条数',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `priority` int(11) NOT NULL DEFAULT '0' COMMENT '优先级',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dataset_code` (`dataset_code`),
  KEY `idx_dataset_source` (`source_system`,`datasource_code`,`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费项来源数据集配置';

-- ----------------------------
-- Table structure for fee_source_datasource
-- ----------------------------
DROP TABLE IF EXISTS `fee_source_datasource`;
CREATE TABLE `fee_source_datasource` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `datasource_code` varchar(64) NOT NULL COMMENT '数据源编码，如OFP_DB',
  `datasource_name` varchar(128) NOT NULL COMMENT '数据源名称',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `env_code` varchar(32) NOT NULL DEFAULT 'PROD' COMMENT '环境编码：DEV/TEST/UAT/PROD',
  `db_type` varchar(32) NOT NULL DEFAULT 'MYSQL' COMMENT '数据库类型：MYSQL/POSTGRES/ORACLE等',
  `driver_class_name` varchar(128) DEFAULT NULL COMMENT 'JDBC驱动类名，可为空走默认驱动',
  `jdbc_url` varchar(500) NOT NULL COMMENT 'JDBC连接URL',
  `username` varchar(128) NOT NULL COMMENT '账号',
  `password_cipher` varchar(500) NOT NULL COMMENT '加密后的密码',
  `password_mask` varchar(64) DEFAULT NULL COMMENT '脱敏密码展示，如******',
  `default_database` varchar(64) DEFAULT NULL COMMENT '默认库名',
  `default_schema` varchar(64) DEFAULT NULL COMMENT '默认schema，MySQL可与default_database一致',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `max_pool_size` int(11) NOT NULL DEFAULT '5' COMMENT '最大连接数',
  `connect_timeout_seconds` int(11) NOT NULL DEFAULT '10' COMMENT '连接超时时间',
  `query_timeout_seconds` int(11) NOT NULL DEFAULT '30' COMMENT '查询超时时间',
  `max_rows_per_query` int(11) NOT NULL DEFAULT '50000' COMMENT '单次最大拉取行数',
  `last_test_status` varchar(32) DEFAULT NULL COMMENT '最近一次连接测试状态：SUCCESS/FAILED',
  `last_test_at` datetime DEFAULT NULL COMMENT '最近一次连接测试时间',
  `last_test_message` varchar(500) DEFAULT NULL COMMENT '最近一次连接测试结果',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0否，1是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_datasource_code` (`datasource_code`),
  KEY `idx_datasource_system` (`source_system`,`enabled`,`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费项来源数据源配置';

-- ----------------------------
-- Table structure for fee_source_rule
-- ----------------------------
DROP TABLE IF EXISTS `fee_source_rule`;
CREATE TABLE `fee_source_rule` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `fee_index_id` bigint(20) unsigned NOT NULL COMMENT '费项索引ID',
  `fee_code` varchar(64) NOT NULL COMMENT '费项编码快照',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统，如OFP',
  `datasource_code` varchar(64) NOT NULL DEFAULT 'OFP_DB' COMMENT '数据源编码，关联fee_source_datasource.datasource_code',
  `dataset_code` varchar(64) DEFAULT NULL COMMENT '来源数据集编码，关联fee_source_dataset.dataset_code',
  `source_database` varchar(64) DEFAULT NULL COMMENT '来源库',
  `source_table` varchar(128) NOT NULL COMMENT '来源表',
  `source_alias` varchar(64) DEFAULT NULL COMMENT '来源别名',
  `source_id_column` varchar(128) NOT NULL COMMENT '来源主键字段，如id',
  `source_biz_no_column` varchar(128) DEFAULT NULL COMMENT '来源业务单号字段',
  `source_amount_column` varchar(128) NOT NULL COMMENT '来源金额字段，如fee_amount',
  `source_currency_column` varchar(128) DEFAULT NULL COMMENT '来源币种字段，如fee_amount_currency',
  `source_converted_amount_column` varchar(128) DEFAULT NULL COMMENT '来源转换后金额字段，如convert_fee_amount',
  `source_converted_currency_column` varchar(128) DEFAULT NULL COMMENT '来源转换后币种字段，如convert_fee_amount_currency',
  `source_time_column` varchar(128) DEFAULT NULL COMMENT '来源费用发生时间字段，如create_time/handle_time',
  `source_ref_columns_json` json DEFAULT NULL COMMENT '来源关联字段映射JSON，如{"billNo":"financial_bill_no","orderId":"sale_order_id","lastWaybillNo":"sub_bill_waybill_no"}',
  `source_tenant_columns_json` json DEFAULT NULL COMMENT '来源租户字段映射JSON，如{"shopId":"shop_id","country":"country_short_code"}',
  `source_status_columns_json` json DEFAULT NULL COMMENT '来源状态字段映射JSON，如{"payStatus":"fee_pay_status","payer":"payer","payMethod":"payment_method"}',
  `source_extra_columns_json` json DEFAULT NULL COMMENT '来源扩展字段映射JSON，如{"fileUrl":"file_url","detailJson":"fee_detail_json"}',
  `filter_expr` varchar(1000) DEFAULT NULL COMMENT '过滤表达式，如 fee_item_type = #{feeItemType} AND fee_amount <> 0',
  `filter_params_json` json DEFAULT NULL COMMENT '过滤参数JSON，如{"feeItemType":"超重费"}',
  `dedupe_key_expr` varchar(500) DEFAULT NULL COMMENT '幂等键表达式',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `priority` int(11) NOT NULL DEFAULT '0' COMMENT '优先级',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fee_source` (`fee_index_id`,`source_system`,`source_database`,`source_table`,`source_amount_column`),
  KEY `idx_source_table` (`source_system`,`source_database`,`source_table`,`enabled`),
  KEY `idx_source_fee_code` (`fee_code`,`enabled`),
  KEY `idx_datasource_code` (`datasource_code`,`enabled`),
  KEY `idx_fee_source_dataset` (`dataset_code`,`enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费项数据来源规则';

-- ----------------------------
-- Table structure for main_order
-- ----------------------------
DROP TABLE IF EXISTS `main_order`;
CREATE TABLE `main_order` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `sc_id` bigint(20) DEFAULT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) DEFAULT NULL COMMENT '店铺ID',
  `user_id` bigint(20) DEFAULT NULL COMMENT '用户ID',
  `member_code` varchar(64) DEFAULT NULL COMMENT '会员/客户编码',
  `order_no` varchar(64) NOT NULL COMMENT '业务主单号',
  `order_type` varchar(64) NOT NULL COMMENT '业务主单类型',
  `order_source` varchar(64) DEFAULT NULL COMMENT '订单来源',
  `order_status` varchar(64) DEFAULT NULL COMMENT '订单状态',
  `customer_name` varchar(128) DEFAULT NULL COMMENT '客户/会员名称',
  `store_name` varchar(128) DEFAULT NULL COMMENT '店铺名称',
  `recipient` varchar(128) DEFAULT NULL COMMENT '收件人/申报人',
  `is_tax_included` tinyint(1) DEFAULT NULL COMMENT '是否含税',
  `cargo_type` varchar(64) DEFAULT NULL COMMENT '货物类型',
  `shipping_warehouse` varchar(128) DEFAULT NULL COMMENT '发运仓',
  `timeliness_type` varchar(64) DEFAULT NULL COMMENT '时效类型',
  `destination_country` varchar(64) DEFAULT NULL COMMENT '目的国',
  `last_mile_carrier` varchar(128) DEFAULT NULL COMMENT '尾程承运商',
  `last_mile_waybill_no` varchar(64) DEFAULT NULL COMMENT '尾程运单号',
  `first_mile_waybill_no` varchar(64) DEFAULT NULL COMMENT '首程运单号',
  `route_auto_billing_scheme_no` varchar(128) DEFAULT NULL COMMENT '线路自动计费方案编号',
  `total_receivable` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '总应收',
  `source_total_weight` decimal(14,4) DEFAULT NULL COMMENT '源订单总重量',
  `warehouse_weight` decimal(14,4) DEFAULT NULL COMMENT '仓库核重重量',
  `billing_weight` decimal(14,4) DEFAULT NULL COMMENT '计费重量/收费重',
  `throw_weight` decimal(14,4) DEFAULT NULL COMMENT '体积重/抛重',
  `order_volume` decimal(18,4) DEFAULT NULL COMMENT '体积',
  `package_qty` decimal(14,4) DEFAULT NULL COMMENT '包裹数/件数',
  `actual_piece_qty` int(11) DEFAULT NULL COMMENT '实际总件数',
  `total_cost` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '总成本',
  `total_profit` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '总利润',
  `bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '归属账单ID',
  `bill_no` varchar(64) DEFAULT NULL COMMENT '归属账单编号',
  `bill_type` varchar(32) DEFAULT NULL COMMENT '账单类型：MEMBER_AR/COD_REFUND/COST_AP',
  `bill_config_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单配置ID',
  `config_type` varchar(16) DEFAULT NULL COMMENT '账单配置类型：DEFAULT默认配置，BRANCH分支配置',
  `generate_task_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单生成任务ID',
  `billing_period_start_date` date DEFAULT NULL COMMENT '归属账单账期开始日期',
  `billing_period_end_date` date DEFAULT NULL COMMENT '归属账单账期结束日期',
  `bill_currency` varchar(16) DEFAULT NULL COMMENT '归属账单结算币种',
  `fin_currency` varchar(16) DEFAULT NULL COMMENT '财务本位币',
  `billed_at` datetime DEFAULT NULL COMMENT '计入账单时间',
  `order_created_at` datetime DEFAULT NULL COMMENT '业务单创建时间',
  `billing_node_time` datetime DEFAULT NULL COMMENT '到达计费节点时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `customer_no` varchar(64) DEFAULT NULL COMMENT '客户/会员编号',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_main_order_bill_order` (`bill_type`,`bill_no`,`order_no`),
  KEY `idx_main_order_subject` (`sc_id`,`shop_id`,`user_id`,`member_code`,`order_created_at`),
  KEY `idx_main_order_order_no` (`order_no`),
  KEY `idx_main_order_waybill` (`last_mile_waybill_no`),
  KEY `idx_main_order_first_waybill` (`first_mile_waybill_no`),
  KEY `idx_main_order_billing_node` (`billing_node_time`),
  KEY `idx_main_order_bill` (`bill_id`,`bill_no`),
  KEY `idx_main_order_task` (`generate_task_id`),
  KEY `idx_main_order_bill_period` (`bill_config_id`,`billing_period_start_date`,`billing_period_end_date`),
  KEY `idx_main_order_weight_snapshot` (`bill_config_id`,`billing_period_start_date`,`billing_period_end_date`,`billing_weight`),
  KEY `idx_main_order_customer_no` (`customer_no`)
) ENGINE=InnoDB AUTO_INCREMENT=7028 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='业务主单快照';

-- ----------------------------
-- Table structure for payment_receipt
-- ----------------------------
DROP TABLE IF EXISTS `payment_receipt`;
CREATE TABLE `payment_receipt` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `receipt_no` varchar(64) NOT NULL COMMENT '收款单号',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `payer_name` varchar(128) DEFAULT NULL COMMENT '付款方名称',
  `payment_channel` varchar(64) DEFAULT NULL COMMENT '收款渠道',
  `receipt_currency` varchar(16) NOT NULL COMMENT '收款币种',
  `receipt_amount` decimal(18,4) NOT NULL COMMENT '收款金额',
  `writeoff_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已核销金额<收款币种>',
  `unwriteoff_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未核销金额<收款币种>',
  `receipt_status` varchar(32) NOT NULL DEFAULT 'SUBMITTED' COMMENT '状态：SUBMITTED/CONFIRMED/PART_WRITEOFF/WRITEOFF/VOID',
  `voucher_url` varchar(500) DEFAULT NULL COMMENT '付款凭证URL',
  `submitted_at` datetime DEFAULT NULL COMMENT '提交时间',
  `paid_at` datetime DEFAULT NULL COMMENT '实际付款时间',
  `confirmed_at` datetime DEFAULT NULL COMMENT '确认收款时间',
  `confirmed_by` varchar(64) DEFAULT NULL COMMENT '确认人',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_receipt_no` (`receipt_no`),
  KEY `idx_receipt_subject_status` (`sc_id`,`shop_id`,`user_id`,`member_code`,`receipt_status`,`created_at`),
  KEY `idx_receipt_paid_at` (`paid_at`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='收款记录';

-- ----------------------------
-- Table structure for payment_record
-- ----------------------------
DROP TABLE IF EXISTS `payment_record`;
CREATE TABLE `payment_record` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `voucher_url` varchar(500) DEFAULT NULL COMMENT '付款凭证URL',
  `submitted_at` datetime DEFAULT NULL COMMENT '提交时间',
  `payment_channel` varchar(64) DEFAULT NULL COMMENT '付款途径',
  `payment_amount` decimal(18,4) DEFAULT NULL COMMENT '付款金额',
  `paid_at` datetime DEFAULT NULL COMMENT '付款时间',
  `verification_status` varchar(32) DEFAULT NULL COMMENT '核销状态',
  PRIMARY KEY (`id`),
  KEY `idx_payment_record_bill_no` (`bill_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='收款记录（旧接口兼容表）';

-- ----------------------------
-- Table structure for payment_writeoff_detail
-- ----------------------------
DROP TABLE IF EXISTS `payment_writeoff_detail`;
CREATE TABLE `payment_writeoff_detail` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `writeoff_no` varchar(64) NOT NULL COMMENT '核销流水号',
  `receipt_id` bigint(20) unsigned NOT NULL COMMENT '收款单ID',
  `receipt_no` varchar(64) NOT NULL COMMENT '收款单号',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `currency_summary_id` bigint(20) unsigned DEFAULT NULL COMMENT '核销的账单币种汇总ID',
  `settlement_currency` varchar(16) DEFAULT NULL COMMENT '本次核销结算币种',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `receipt_currency` varchar(16) NOT NULL COMMENT '收款币种',
  `writeoff_amount_receipt_currency` decimal(18,4) NOT NULL COMMENT '核销金额<收款币种>',
  `bill_currency` varchar(16) NOT NULL COMMENT '账单币种',
  `exchange_rate_to_bill` decimal(18,8) DEFAULT NULL COMMENT '收款币种到账单币种汇率',
  `writeoff_amount_bill_currency` decimal(18,4) NOT NULL COMMENT '核销金额<账单币种>',
  `fin_currency` varchar(16) NOT NULL DEFAULT 'CNY' COMMENT '财务本位币',
  `exchange_rate_to_fin` decimal(18,8) DEFAULT NULL COMMENT '账单币种到本位币汇率',
  `writeoff_amount_fin_currency` decimal(18,4) NOT NULL COMMENT '核销金额<本位币>',
  `writeoff_status` varchar(32) NOT NULL DEFAULT 'NORMAL' COMMENT '核销状态：NORMAL/REVERSED/VOID',
  `writeoff_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '核销时间',
  `writeoff_by` varchar(64) DEFAULT NULL COMMENT '核销人',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_writeoff_no` (`writeoff_no`),
  KEY `idx_writeoff_receipt` (`receipt_id`),
  KEY `idx_writeoff_bill` (`bill_id`),
  KEY `idx_writeoff_subject_time` (`sc_id`,`shop_id`,`user_id`,`member_code`,`writeoff_time`),
  KEY `idx_writeoff_currency_summary` (`currency_summary_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='收款核销明细';

-- ----------------------------
-- Table structure for refund_payment_record
-- ----------------------------
DROP TABLE IF EXISTS `refund_payment_record`;
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

-- ----------------------------
-- Table structure for refund_payment_allocation
-- ----------------------------
DROP TABLE IF EXISTS `refund_payment_allocation`;
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

-- ----------------------------
-- Table structure for refund_bill_config
-- ----------------------------
DROP TABLE IF EXISTS `refund_bill_config`;
CREATE TABLE `refund_bill_config` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_no` varchar(64) NOT NULL COMMENT '返款配置编号，格式：RCB-{customerNo}-{timestamp}',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `customer_info_id` bigint(20) DEFAULT NULL COMMENT '客户信息ID（关联 store-service 客户快照）',
  `member_code` varchar(64) NOT NULL COMMENT '会员编码',
  `member_name` varchar(128) DEFAULT NULL COMMENT '客户名称快照',
  `customer_no` varchar(64) DEFAULT NULL COMMENT '客户编码',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：1启用，0停用',
  `refund_mode` varchar(32) NOT NULL COMMENT '返款模式：SIGNED 签收返款 / RECEIVED 回款返款',
  `billing_period_type` varchar(32) NOT NULL COMMENT '账期类型：WEEK/HALF_MONTH/MONTH/TEN_DAYS/FIFTEEN_DAYS',
  `billing_period_start_days` varchar(32) DEFAULT NULL COMMENT '账期起始日，半周账期保存两个星期值，逗号分隔（1周一，7周日）',
  `bill_send_offset_days` int(11) NOT NULL DEFAULT '2' COMMENT '账期结束后第几天预定发出账单',
  `cod_service_fee_rate` decimal(10,6) NOT NULL DEFAULT '0.030000' COMMENT '代收货款手续费比例，0.03 表示 3%',
  `config_snapshot_json` json DEFAULT NULL COMMENT '一期页面配置快照 JSON：含币种账户矩阵与直接扣减费项',
  `effective_start_date` date NOT NULL COMMENT '生效开始日期',
  `effective_end_date` date DEFAULT NULL COMMENT '生效结束日期',
  `version` int(11) NOT NULL DEFAULT '1' COMMENT '版本号',
  `is_current_version` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否当前版本：1是，0否',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0否，1是',
  `current_version_guard` tinyint(1) GENERATED ALWAYS AS ((case when ((`is_current_version` = 1) and (`is_deleted` = 0)) then 1 else NULL end)) STORED COMMENT '当前版本唯一约束辅助列（is_current_version=1 且未删除时为1，否则NULL）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_config_version` (`config_no`,`version`),
  UNIQUE KEY `uk_refund_config_current` (`sc_id`,`shop_id`,`user_id`,`member_code`,`current_version_guard`),
  KEY `idx_refund_config_customer` (`sc_id`,`shop_id`,`user_id`,`member_code`,`status`,`is_deleted`),
  KEY `idx_refund_config_effective` (`effective_start_date`,`effective_end_date`,`status`,`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COMMENT='COD 返款账单配置（一期）';

-- ----------------------------
-- Table structure for settlement_terms
-- ----------------------------
DROP TABLE IF EXISTS `settlement_terms`;
CREATE TABLE `settlement_terms` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `customer_no` varchar(64) NOT NULL COMMENT '客户编号',
  `settlement_terms_template_url` varchar(255) NOT NULL COMMENT '结算条款模板URL',
  `settlement_terms_profile` json NOT NULL COMMENT '结算条款配置',
  `create_at` datetime NOT NULL COMMENT '创建时间',
  `create_by` varchar(64) NOT NULL COMMENT '创建人',
  `is_newest_version` tinyint(2) NOT NULL COMMENT '最新版本标记',
  `sc_id` bigint(20) DEFAULT NULL COMMENT '供应链ID',
  PRIMARY KEY (`id`),
  KEY `idx_settlement_terms_customer_sc` (`customer_no`,`sc_id`,`is_newest_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='客户结算条款（旧接口兼容表）';

-- ----------------------------
-- Table structure for source_payment_writeback
-- ----------------------------
DROP TABLE IF EXISTS `source_payment_writeback`;
CREATE TABLE `source_payment_writeback` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `writeback_no` varchar(64) NOT NULL COMMENT '回写流水号',
  `writeoff_no` varchar(64) NOT NULL COMMENT '核销流水号',
  `receipt_no` varchar(64) DEFAULT NULL COMMENT '收款单号',
  `bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `currency_summary_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单币种汇总ID',
  `bill_currency` varchar(16) DEFAULT NULL COMMENT '账单币种',
  `sc_id` bigint(20) DEFAULT NULL COMMENT '供应链ID',
  `shop_id` bigint(20) DEFAULT NULL COMMENT '店铺ID',
  `user_id` bigint(20) DEFAULT NULL COMMENT '用户ID',
  `member_code` varchar(64) DEFAULT NULL COMMENT '会员编码',
  `fee_detail_id` bigint(20) unsigned DEFAULT NULL COMMENT '费用明细ID',
  `fee_code` varchar(64) DEFAULT NULL COMMENT '费项编码',
  `source_system` varchar(64) NOT NULL COMMENT '来源系统',
  `source_database` varchar(64) DEFAULT NULL COMMENT '来源库',
  `source_table` varchar(128) NOT NULL COMMENT '来源表',
  `source_id` varchar(128) NOT NULL COMMENT '来源主键',
  `source_biz_no` varchar(128) DEFAULT NULL COMMENT '来源业务单号',
  `writeback_type` varchar(32) NOT NULL COMMENT '回写类型：ORDER_FEE/ADDITIONAL_FEE/CLAIM_ORDER',
  `writeback_status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '回写状态：PENDING/SUCCESS/FAILED/REVERSED',
  `before_status` varchar(64) DEFAULT NULL COMMENT '回写前状态',
  `after_status` varchar(64) DEFAULT NULL COMMENT '回写后状态',
  `retry_count` int(11) NOT NULL DEFAULT '0' COMMENT '重试次数',
  `last_retry_at` datetime DEFAULT NULL COMMENT '最近重试时间',
  `error_message` varchar(2000) DEFAULT NULL COMMENT '失败原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_payment_writeback_no` (`writeback_no`),
  UNIQUE KEY `uk_source_payment_writeback` (`writeoff_no`,`source_table`,`source_id`),
  KEY `idx_source_payment_writeback_status` (`writeoff_no`,`writeback_status`),
  KEY `idx_source_payment_writeback_bill` (`bill_no`,`bill_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='核销后来源付款状态回写记录';

SET FOREIGN_KEY_CHECKS = 1;
