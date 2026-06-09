/*
 Navicat MySQL Data Transfer

 Source Server         : szt_test
 Source Server Type    : MySQL
 Source Server Version : 50743
 Source Host           : 192.168.0.250:3306
 Source Schema         : tmall_bms

 Target Server Type    : MySQL
 Target Server Version : 50743
 File Encoding         : 65001

 Date: 22/05/2026 16:20:39
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for ar_bill
-- ----------------------------
DROP TABLE IF EXISTS `ar_bill`;
CREATE TABLE `ar_bill` (
  `bill_no` varchar(20) NOT NULL COMMENT '账单编号',
  `bill_status` varchar(32) NOT NULL COMMENT '账单状态',
  `settlement_terms_id` bigint(20) unsigned NOT NULL COMMENT '结算条款编号',
  `customer_name` varchar(128) NOT NULL COMMENT '客户名称',
  `destination_country` varchar(64) NOT NULL COMMENT '集运目的国',
  `billing_cycle_type` varchar(32) NOT NULL COMMENT '账期类型',
  `billing_period_start_date` date NOT NULL COMMENT '账期起始日',
  `billing_period_end_date` date NOT NULL COMMENT '账期结束日',
  `bill_send_date` date NOT NULL COMMENT '账单发送日',
  `credit_period_end_date` date NOT NULL COMMENT '信用期结束日',
  `payment_overdue_days` int(11) DEFAULT NULL COMMENT '付款逾期天数',
  `bill_currency` varchar(16) NOT NULL COMMENT '账单结算币种',
  `initial_receivable_amount_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '初始应收金额<账单结算币种>',
  `this_bill_amount_adjustment_delta_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '本期账单金额调整增量<账单结算币种>',
  `previous_bill_amount_adjustment_delta_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '往期账单金额调整增量<账单结算币种>',
  `late_fee_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '本期滞纳金额<账单结算币种>',
  `receivable_amount_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '应收金额<账单结算币种>',
  `paid_amount_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '实收金额<账单结算币种>',
  `receivable_amount_in_fin_currency` decimal(18,4) DEFAULT NULL COMMENT '应收金额<财务本位币>',
  `paid_amount_in_fin_currency` decimal(18,4) DEFAULT NULL COMMENT '实收金额<财务本位币>',
  PRIMARY KEY (`bill_no`) USING BTREE,
  KEY `FK_ar_bill_settlement_terms` (`settlement_terms_id`) USING BTREE,
  CONSTRAINT `FK_ar_bill_settlement_terms` FOREIGN KEY (`settlement_terms_id`) REFERENCES `settlement_terms` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='应收账单';

-- ----------------------------
-- Table structure for bill_exchange_rate
-- ----------------------------
DROP TABLE IF EXISTS `bill_exchange_rate`;
CREATE TABLE `bill_exchange_rate` (
  `id` bigint(20) NOT NULL COMMENT 'ID',
  `bill_no` varchar(20) NOT NULL COMMENT '账单编号',
  `bill_currency` varchar(16) NOT NULL COMMENT '账单结算币种',
  `conversion_currency` varchar(16) NOT NULL COMMENT '换算币种',
  `conversion_currency_type` varchar(32) NOT NULL COMMENT '换算币种类型',
  `conversion_direction` varchar(8) NOT NULL COMMENT '换算方向',
  `exchange_rate` decimal(18,8) NOT NULL COMMENT '锁定汇率',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `FK_bill_exchange_rate_ar_bill` (`bill_no`),
  CONSTRAINT `FK_bill_exchange_rate_ar_bill` FOREIGN KEY (`bill_no`) REFERENCES `ar_bill` (`bill_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单汇率';

-- ----------------------------
-- Table structure for fee_adjustment_record
-- ----------------------------
DROP TABLE IF EXISTS `fee_adjustment_record`;
CREATE TABLE `fee_adjustment_record` (
  `id` varchar(20) NOT NULL COMMENT 'ID',
  `fee_id` bigint(20) unsigned NOT NULL COMMENT '费项ID',
  `fee_adjustment_reason` varchar(255) DEFAULT NULL COMMENT '冲正理由',
  `fee_adjustment_currency` varchar(16) NOT NULL COMMENT '冲正所用币种',
  `adjustment_delta_in_fee_adjustment_currency` decimal(18,4) NOT NULL COMMENT '冲正幅度<冲正所用币种>',
  `adjusted_amount_in_fee_adjustment_currency` decimal(18,4) NOT NULL COMMENT '冲正后金额<冲正所用币种>',
  `trigger_bill_id` bigint(20) unsigned NOT NULL COMMENT '触发账单编号',
  `trigger_bill_currency` varchar(16) NOT NULL COMMENT '触发账单结算币种',
  `exchange_rate_c1` decimal(18,8) DEFAULT NULL COMMENT '锁定汇率<L1>',
  `exchange_rate_level_c1` varchar(2) DEFAULT NULL COMMENT '汇率级别<L1>',
  `adjustment_delta_in_trigger_bill_currency` decimal(18,4) NOT NULL COMMENT '金额变幅<账单结算币种>',
  `adjusted_amount_in_trigger_bill_currency` decimal(18,4) NOT NULL COMMENT '冲正后金额<账单结算币种>',
  `exchange_rate_c2` decimal(18,8) DEFAULT NULL COMMENT '锁定汇率<L2>',
  `exchange_rate_level_c2` varchar(2) DEFAULT NULL COMMENT '汇率级别<L2>',
  `adjustment_delta_in_fin_currency` decimal(18,4) NOT NULL COMMENT '金额变幅<财务本位币>',
  `adjusted_amount_in_fin_currency` decimal(18,4) NOT NULL COMMENT '冲正后金额<财务本位币>',
  `voucher_url` varchar(255) DEFAULT NULL COMMENT '费用凭证URL',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登记时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '登记人',
  `approval_status` varchar(32) DEFAULT NULL COMMENT '审核状态',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `FK_fee_adjustment_record_fee` (`fee_id`),
  CONSTRAINT `FK_fee_adjustment_record_fee` FOREIGN KEY (`fee_id`) REFERENCES `fee_detail` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费用冲正记录';

-- ----------------------------
-- Table structure for fee_detail
-- ----------------------------
DROP TABLE IF EXISTS `fee_detail`;
CREATE TABLE `fee_detail` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `fee_name` varchar(128) NOT NULL COMMENT '费项名称',
  `fee_index_id` bigint(20) unsigned NOT NULL COMMENT '费项索引编号',
  `attached_object` varchar(2) NOT NULL COMMENT '挂靠对象：L1-财务账单，L2-业务主单，L3-尾程包裹，L4-原始包裹',
  `bill_no` varchar(20) NOT NULL COMMENT '财务账单号',
  `offset_bill_no` varchar(20) DEFAULT NULL COMMENT '对冲账单号',
  `business_order_no` varchar(64) DEFAULT NULL COMMENT '业务主单号',
  `last_mile_waybill_no` varchar(64) DEFAULT NULL COMMENT '尾程运单号',
  `first_mile_waybill_no` varchar(64) DEFAULT NULL COMMENT '首程运单号',
  `fee_type` varchar(2) NOT NULL COMMENT '费用类型：AR-应收类，ARD-应收扣减类，AP-成本类，ARAP-代收/付类',
  `fee_currency` varchar(16) NOT NULL COMMENT '费用原始币种',
  `amount_in_fee_currency` decimal(18,4) NOT NULL COMMENT '费用金额<费用原始币种>',
  `exchange_rate_c1` decimal(18,8) DEFAULT NULL COMMENT '锁定汇率<L1>',
  `exchange_rate_level_c1` varchar(2) DEFAULT NULL COMMENT '汇率级别<L1>',
  `bill_currency` varchar(16) DEFAULT NULL COMMENT '账单结算币种',
  `amount_in_bill_currency` decimal(18,4) DEFAULT NULL COMMENT '费用金额<账单结算币种>',
  `exchange_rate_c2` decimal(18,8) DEFAULT NULL COMMENT '锁定汇率<L2>',
  `exchange_rate_level_c2` varchar(2) DEFAULT NULL COMMENT '汇率级别<L2>',
  `amount_in_fin_currency` decimal(18,4) DEFAULT NULL COMMENT '费用金额<财务本位币>',
  `voucher_rul` varchar(255) DEFAULT NULL COMMENT '费用凭证URL',
  `voucher_supplier` varchar(128) DEFAULT NULL COMMENT '费用凭证供应商',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登记时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '登记人',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `FK_fee_ar_bill` (`bill_no`),
  KEY `FK_fee_main_order` (`business_order_no`),
  KEY `FK_fee_fee_index` (`fee_index_id`),
  CONSTRAINT `FK_fee_ar_bill` FOREIGN KEY (`bill_no`) REFERENCES `ar_bill` (`bill_no`),
  CONSTRAINT `FK_fee_fee_index` FOREIGN KEY (`fee_index_id`) REFERENCES `fee_index` (`id`),
  CONSTRAINT `FK_fee_main_order` FOREIGN KEY (`business_order_no`) REFERENCES `main_order` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费用详情';

-- ----------------------------
-- Table structure for fee_index
-- ----------------------------
DROP TABLE IF EXISTS `fee_index`;
CREATE TABLE `fee_index` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `data_source` varchar(255) NOT NULL DEFAULT '0' COMMENT 'ETL数据源',
  `fee_name` varchar(50) NOT NULL COMMENT '费用名称',
  `limited_fee_type` varchar(50) DEFAULT NULL COMMENT '限定费项类型：AR-应收类    ARD-应收扣减类    AP-成本类   ARAP-代收/付类',
  `limited_attachment_object` varchar(50) DEFAULT NULL COMMENT '限定挂靠对象：财务账单、业务主单、尾程包裹、首程包裹',
  `scenario_tag` varchar(50) DEFAULT NULL COMMENT '场景标签：如 国内段/发运仓',
  `applicable_to_order_from_peer` tinyint(4) DEFAULT NULL COMMENT '数据源适用于同行订单',
  `applicable_to_order_from_jiyunke` tinyint(4) DEFAULT NULL COMMENT '数据源适用于集运客订单',
  `applicable_to_order_from_shopee` tinyint(4) DEFAULT NULL COMMENT '数据源适用于虾皮订单',
  `is_enabled` tinyint(1) DEFAULT NULL COMMENT '是否已启用',
  `remark` varchar(300) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `index1` (`data_source`,`fee_name`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='费项索引';

-- ----------------------------
-- Records of fee_index
-- ----------------------------
BEGIN;
INSERT INTO `fee_index` VALUES (1, 'ofp_ofdb1.sale_order_header_extend.tail_freight_amount', '派送费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (2, 'ofp_ofdb1.sale_order_header_extend.system_service_amount', '系统服务费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (3, 'ofp_ofdb1.sale_order_header_extend.packing_amount', '打包费', '应收类', '集运单', NULL, NULL, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (4, 'ofp_ofdb1.sale_order_header_extend.overweight_amount', '超重费', '应收类', '集运单', NULL, NULL, 1, NULL, 1, '汇总首程包裹计费值');
INSERT INTO `fee_index` VALUES (5, 'ofp_ofdb1.sale_order_header_extend.overmaterial_amount', '超材费', '应收类', '集运单', NULL, NULL, 1, NULL, 1, '汇总首程包裹计费值');
INSERT INTO `fee_index` VALUES (6, 'ofp_ofdb1.sale_order_header_extend.overlength_amount', '超长费', '应收类', '集运单', NULL, NULL, 1, NULL, 1, '汇总首程包裹计费值');
INSERT INTO `fee_index` VALUES (7, 'ofp_ofdb1.sale_order_header_extend.marketing_activity_discount_amount', '满减活动优惠金额', '应收扣减类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (8, 'ofp_ofdb1.sale_order_header_extend.customer_address_surcharge_fee', '偏远地址附加费', '应收类', '集运单', NULL, NULL, NULL, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (9, 'ofp_ofdb1.sale_order_header.weight_charge_amount', '超重费', '应收类', '集运单', NULL, 1, NULL, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (10, 'ofp_ofdb1.sale_order_header.warehouse_rental_amount', '仓租费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (11, 'ofp_ofdb1.sale_order_header.user_coupon_fee', '优惠券优惠金额', '应收扣减类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (12, 'ofp_ofdb1.sale_order_header.tax_premium_amount', '包税手续费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (13, 'ofp_ofdb1.sale_order_header.material_charge_amount', '包材费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (14, 'ofp_ofdb1.sale_order_header.length_charge_amount', '超长费', '应收类', '集运单', NULL, 1, NULL, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (15, 'ofp_ofdb1.sale_order_header.integral_fee', '积分优惠金额', '应收扣减类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (16, 'ofp_ofdb1.sale_order_header.insurance_amount', '保险金额', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (17, 'ofp_ofdb1.sale_order_header.freight', '运费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (18, 'ofp_ofdb1.sale_order_header.forwarding_charge_amount', '转运费用', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (19, 'ofp_ofdb1.sale_order_header.dest_division_amount', '偏远地址附加费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (20, 'ofp_ofdb1.sale_order_header.compensation_price', '保价金额', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (21, 'ofp_ofdb1.sale_order_header.compensation_premium_amount', '保价手续费用', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (22, 'ofp_ofdb1.sale_order_header.collection_price', '代收货款', '代收/付类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (23, 'ofp_ofdb1.sale_order_header.collection_premium_amount', '代收货款手续费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (24, 'ofp_ofdb1.sale_order_header.cod_price', 'COD金额', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (25, 'ofp_ofdb1.sale_order_header.cod_amount', '货到付款手续费', '应收类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (26, 'ofp_ofdb1.sale_order_header.advance_amount', '垫付金额', '代收/付类', '集运单', NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (27, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"转板费\"', '转板费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (28, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"退运费\"', '退运费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (29, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"税金\"', '税金', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (30, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"税费\"', '税费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (31, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"木架费\"', '木架费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (32, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"加收地址附加费\"', '加收地址附加费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (33, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"加固包装费\"', '加固包装费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (34, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"国内转寄\"', '国内转寄', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (35, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"国内到付\"', '国内到付', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (36, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"改单费\"', '改单费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (37, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"分单费\"', '分单费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (38, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"罚款\"', '罚款', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (39, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"店取费\"', '店取费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (40, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"代客收台币\"', '代客收台币', '代收/付类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (41, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"代客付台币\"', '代客付台币', '代收/付类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (42, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"超重费\"', '超重费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (43, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"超长费\"', '超长费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (44, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"超材手续费\"', '超材手续费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (45, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"超材费\"', '超材费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (46, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"缠膜费\"', '缠膜费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (47, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"仓租费\"', '仓租费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
INSERT INTO `fee_index` VALUES (48, 'ofp_ofdb1.sale_order_additional_matter where fee_item_type=\"报关费\"', '报关费', '应收类', NULL, NULL, 1, 1, NULL, 1, NULL);
COMMIT;

-- ----------------------------
-- Table structure for main_order
-- ----------------------------
DROP TABLE IF EXISTS `main_order`;
CREATE TABLE `main_order` (
  `order_no` varchar(64) NOT NULL COMMENT '业务主单号',
  `order_type` varchar(64) NOT NULL COMMENT '业务主单类型',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `customer_no` varchar(64) DEFAULT NULL COMMENT '客户/会员编号',
  `customer_name` varchar(128) DEFAULT NULL COMMENT '客户/会员名称',
  `store_name` varchar(128) DEFAULT NULL COMMENT '店铺',
  `recipient` varchar(128) DEFAULT NULL COMMENT '收件人，同为申报人',
  `is_tax_included` tinyint(1) DEFAULT NULL COMMENT '含税标记',
  `cargo_type` varchar(64) DEFAULT NULL COMMENT '货物类型',
  `shipping_warehouse` varchar(128) DEFAULT NULL COMMENT '发运仓库',
  `timeliness_type` varchar(64) DEFAULT NULL COMMENT '时效类型',
  `destination_country` varchar(64) DEFAULT NULL COMMENT '目的国',
  `last_mile_carrier` varchar(128) DEFAULT NULL COMMENT '尾程承运商',
  `route_auto_billing_scheme_no` varchar(128) DEFAULT NULL COMMENT '线路自动计费方案编号',
  `total_receivable` decimal(18,4) DEFAULT NULL COMMENT '总应收',
  `total_cost` decimal(18,4) DEFAULT NULL COMMENT '总成本',
  `total_profit` decimal(18,4) DEFAULT NULL COMMENT '总利润',
  PRIMARY KEY (`order_no`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='业务主单';

-- ----------------------------
-- Table structure for payment_record
-- ----------------------------
DROP TABLE IF EXISTS `payment_record`;
CREATE TABLE `payment_record` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bill_no` varchar(20) NOT NULL COMMENT '账单ID',
  `voucher_url` varchar(255) DEFAULT NULL COMMENT '付款凭证URL',
  `submitted_at` datetime DEFAULT NULL COMMENT '提交时间',
  `payment_channel` varchar(64) DEFAULT NULL COMMENT '付款途径',
  `payment_amount` decimal(18,4) DEFAULT NULL COMMENT '付款金额',
  `paid_at` datetime DEFAULT NULL COMMENT '付款时间',
  `verification_status` varchar(32) DEFAULT NULL COMMENT '核销状态',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `FK_payment_record_ar_bill` (`bill_no`),
  CONSTRAINT `FK_payment_record_ar_bill` FOREIGN KEY (`bill_no`) REFERENCES `ar_bill` (`bill_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='收款记录';

-- ----------------------------
-- Table structure for settlement_terms
-- ----------------------------
DROP TABLE IF EXISTS `settlement_terms`;
CREATE TABLE `settlement_terms` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `customer_no` varchar(50) NOT NULL COMMENT '客户编号',
  `settlement_terms_template_url` varchar(50) NOT NULL COMMENT '结算条款模板URL，指向XSD文件',
  `settlement_terms_profile` json NOT NULL COMMENT '结算条款配置',
  `create_at` datetime NOT NULL COMMENT '创建时间',
  `create_by` varchar(20) NOT NULL COMMENT '创建人',
  `is_newest_version` tinyint(2) NOT NULL COMMENT '最新版本标记',
  `sc_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='客户结算条款';

-- ----------------------------
-- Records of settlement_terms
-- ----------------------------
BEGIN;
INSERT INTO `settlement_terms` VALUES (1, '', '', 'null', '0000-00-00 00:00:00', '', 0, NULL);
INSERT INTO `settlement_terms` VALUES (2, 'OG0361', 'supplychain/billContract/1779334276930导入模版.xlsx', '{\"enabled\": true, \"contract\": {\"contractNo\": \"HT202605216276\"}, \"defaultPlan\": {\"contractNode\": \"出库核重\", \"billingCurrency\": \"VND\", \"billingPeriodType\": \"半月\", \"autoCalculateFeeItems\": [\"超重费\"], \"billingSendOffsetDays\": 43}, \"branchPlanList\": [{\"id\": 1779334285503, \"contractNode\": \"出库核重\", \"billingCurrency\": \"VND\", \"billingPeriodType\": \"月\", \"destinationCountries\": [{\"code\": \"US\", \"name\": \"US\"}, {\"code\": \"JP\", \"name\": \"JP\"}, {\"code\": \"GB\", \"name\": \"GB\"}], \"autoCalculateFeeItems\": [\"超重费\"], \"billingSendOffsetDays\": 43, \"consolidationWarehouses\": [{\"code\": \"NiuMa\", \"name\": \"牛马仓\"}]}], \"creditSettings\": {\"advanceLimit\": 4, \"creditPeriod\": 3, \"creditRating\": \"B\", \"overduePenaltyRate\": 1}, \"termEffectivePeriod\": {\"endDate\": \"2026-06-24\", \"startDate\": \"2026-05-21\"}}', '2026-05-21 11:45:10', 'admin', 1, NULL);
INSERT INTO `settlement_terms` VALUES (3, 'OG0360', 'supplychain/billContract/1779362802188测试1.xlsx', '{\"enabled\": true, \"contract\": {\"contractNo\": \"HT202605215989\"}, \"defaultPlan\": {\"contractNode\": \"广义签收\", \"billingCurrency\": \"VND\", \"billingPeriodType\": \"周\", \"autoCalculateFeeItems\": [\"超重费\"], \"billingSendOffsetDays\": 1}, \"branchPlanList\": [{\"id\": 1779362772208, \"contractNode\": \"出库核重\", \"billingCurrency\": \"TWD\", \"billingPeriodType\": \"月\", \"destinationCountries\": [{\"code\": \"KOR\", \"name\": \"KOR\"}], \"autoCalculateFeeItems\": [\"运费\"], \"billingSendOffsetDays\": null, \"consolidationWarehouses\": [{\"code\": \"NiuMa001\", \"name\": \"牛马1号仓库\"}, {\"code\": \"NiuMa\", \"name\": \"牛马仓\"}]}], \"creditSettings\": {\"advanceLimit\": null, \"creditPeriod\": 3, \"creditRating\": \"A\", \"overduePenaltyRate\": 0}, \"termEffectivePeriod\": {\"endDate\": \"2026-06-21\", \"startDate\": \"2026-05-21\"}}', '2026-05-21 19:26:47', 'admin', 0, 1);
INSERT INTO `settlement_terms` VALUES (4, 'OG0360', 'supplychain/billContract/1779362802188测试1.xlsx', '{\"enabled\": true, \"contract\": {\"contractNo\": \"HT202605215989\"}, \"defaultPlan\": {\"contractNode\": \"广义签收\", \"billingCurrency\": \"VND\", \"billingPeriodType\": \"周\", \"autoCalculateFeeItems\": [\"超重费\"], \"billingSendOffsetDays\": 1}, \"branchPlanList\": [{\"id\": 1779362772208, \"contractNode\": \"出库核重\", \"billingCurrency\": \"TWD\", \"billingPeriodType\": \"月\", \"destinationCountries\": [{\"code\": \"KOR\", \"name\": \"KOR\"}], \"autoCalculateFeeItems\": [\"运费\"], \"billingSendOffsetDays\": 2, \"consolidationWarehouses\": [{\"code\": \"NiuMa001\", \"name\": \"牛马1号仓库\"}, {\"code\": \"NiuMa\", \"name\": \"牛马仓\"}]}], \"creditSettings\": {\"advanceLimit\": 22, \"creditPeriod\": 3, \"creditRating\": \"A\", \"overduePenaltyRate\": 0}, \"termEffectivePeriod\": {\"endDate\": \"2026-06-21\", \"startDate\": \"2026-05-21\"}}', '2026-05-21 19:27:10', 'admin', 1, 1);
COMMIT;

SET FOREIGN_KEY_CHECKS = 1;
