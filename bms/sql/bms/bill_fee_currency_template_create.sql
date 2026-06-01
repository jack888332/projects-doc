-- 目的国费项收费币种模板
-- 适用库：tmall_bms

CREATE TABLE IF NOT EXISTS `bill_fee_currency_template` (
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
  KEY `idx_bill_fee_currency_template_country` (`country_code`, `business_type_code`, `enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='目的国费项收费币种模板';

CREATE TABLE IF NOT EXISTS `bill_fee_currency_template_rule` (
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
  KEY `idx_bill_fee_currency_template_rule_tpl` (`template_id`, `enabled`),
  KEY `idx_bill_fee_currency_template_rule_fee` (`fee_code`, `business_type_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='目的国费项收费币种模板明细';
