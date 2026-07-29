-- BMS 成本供应商管理三表初始化
-- 数据隔离：供应链维度（sc_id），不按店铺或用户隔离

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `tmall_bms`.`cost_supplier_profile` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链ID，数据隔离字段',
  `supplier_code` varchar(64) NOT NULL COMMENT 'BMS后端生成的供应商编码',
  `supplier_name` varchar(128) NOT NULL COMMENT '供应商名称',
  `supplier_status` varchar(16) NOT NULL DEFAULT 'ENABLED' COMMENT '供应商状态：ENABLED/DISABLED',
  `default_currency` varchar(16) NOT NULL COMMENT '默认币种，ISO 4217三位大写代码',
  `remark` varchar(500) DEFAULT NULL COMMENT '财务对账口径、账期例外及其它备注',
  `version` int(11) NOT NULL DEFAULT '0' COMMENT '乐观锁版本号',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0正常，1删除',
  `active_supplier_code` varchar(64)
    GENERATED ALWAYS AS (CASE WHEN `is_deleted` = 0 THEN `supplier_code` ELSE NULL END) STORED
    COMMENT '有效供应商编码唯一键辅助列',
  `created_by` bigint(20) unsigned NOT NULL COMMENT '创建人用户ID',
  `updated_by` bigint(20) unsigned NOT NULL COMMENT '最后更新人用户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cost_supplier_sc_code` (`sc_id`, `active_supplier_code`),
  KEY `idx_cost_supplier_status` (`sc_id`, `supplier_status`, `is_deleted`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  ROW_FORMAT=DYNAMIC COMMENT='BMS成本供应商财务档案';

CREATE TABLE IF NOT EXISTS `tmall_bms`.`cost_supplier_period_config` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链ID，数据隔离字段',
  `config_no` varchar(64) NOT NULL COMMENT '账期配置编号，全局唯一',
  `supplier_id` bigint(20) unsigned NOT NULL COMMENT '供应商财务档案ID',
  `period_type` varchar(16) NOT NULL COMMENT '账期类型：WEEK/HALF_MONTH/MONTH/NATURAL_DAY',
  `natural_days` int(11) DEFAULT NULL COMMENT '自然天周期天数，仅NATURAL_DAY使用',
  `anchor_date` date DEFAULT NULL COMMENT '首个账期开始日，仅NATURAL_DAY使用',
  `effective_start_date` date NOT NULL COMMENT '生效开始日',
  `effective_end_date` date NOT NULL COMMENT '生效结束日',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0正常，1删除',
  `created_by` bigint(20) unsigned NOT NULL COMMENT '创建人用户ID',
  `updated_by` bigint(20) unsigned NOT NULL COMMENT '最后更新人用户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cost_supplier_period_config_no` (`config_no`),
  KEY `idx_cost_supplier_period_effective`
    (`sc_id`, `supplier_id`, `is_deleted`, `effective_start_date`, `effective_end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  ROW_FORMAT=DYNAMIC COMMENT='供应商成本账期配置';

CREATE TABLE IF NOT EXISTS `tmall_bms`.`cost_supplier_board` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链ID，数据隔离字段',
  `period_config_id` bigint(20) unsigned NOT NULL COMMENT '供应商成本账期配置ID',
  `cost_board` varchar(32) NOT NULL COMMENT '成本板块：DELIVERY/CUSTOMS/SEA_FREIGHT/AIR_FREIGHT/TRUCKING',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除：0正常，1删除',
  `active_period_config_id` bigint(20) unsigned
    GENERATED ALWAYS AS (CASE WHEN `is_deleted` = 0 THEN `period_config_id` ELSE NULL END) STORED
    COMMENT '有效账期配置唯一键辅助列',
  `created_by` bigint(20) unsigned NOT NULL COMMENT '创建人用户ID',
  `updated_by` bigint(20) unsigned NOT NULL COMMENT '最后更新人用户ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cost_supplier_board_period` (`sc_id`, `active_period_config_id`),
  KEY `idx_cost_supplier_board` (`sc_id`, `cost_board`, `is_deleted`, `period_config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  ROW_FORMAT=DYNAMIC COMMENT='供应商成本账期配置适用板块';
