-- ============================================================
-- BMS COD 返款账单配置 DDL（一期）
-- ============================================================
-- 业务说明：
--   1. 返款账单配置与应收账单配置 bill_config 完全独立，不建立任何外键关联。
--   2. 一期只新增 refund_bill_config 一张主表，不拆 返款账期锚点 / 扣减规则 / 币种规则 子表。
--   3. 币种账户矩阵与直接扣减费项以 JSON 快照方式保存在 config_snapshot_json，二期再拆专属子表。
--   4. 同一客户 (sc_id, shop_id, user_id, member_code) 同一时间只允许存在一条当前版本（is_current_version=1）。
--   5. 编辑采用版本化保存：旧版本 is_current_version=0，新版本插入新行。
--   6. current_version_guard 是为支持"同维度仅一条当前版本"唯一约束而引入的生成列。
-- ============================================================

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
  `current_version_guard` tinyint(1) GENERATED ALWAYS AS (
    CASE WHEN `is_current_version` = 1 AND `is_deleted` = 0 THEN 1 ELSE NULL END
  ) STORED COMMENT '当前版本唯一约束辅助列（is_current_version=1 且未删除时为1，否则NULL）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_config_version` (`config_no`,`version`),
  UNIQUE KEY `uk_refund_config_current` (
    `sc_id`,`shop_id`,`user_id`,`member_code`,`current_version_guard`
  ),
  KEY `idx_refund_config_customer` (
    `sc_id`,`shop_id`,`user_id`,`member_code`,`status`,`is_deleted`
  ),
  KEY `idx_refund_config_effective` (
    `effective_start_date`,`effective_end_date`,`status`,`is_deleted`
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='COD 返款账单配置（一期）';
