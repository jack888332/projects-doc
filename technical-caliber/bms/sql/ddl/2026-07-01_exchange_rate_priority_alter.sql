USE `tmall_bms`;

-- 执行前先检查全局货币对重复；有结果时需由财务确认保留记录后再执行后续 ALTER。
SELECT LEAST(source_currency, target_currency) AS currency_a,
       GREATEST(source_currency, target_currency) AS currency_b,
       COUNT(1) AS active_count
FROM `tmall_bms`.`base_exchange_rate`
WHERE is_deleted = 0
GROUP BY LEAST(source_currency, target_currency), GREATEST(source_currency, target_currency)
HAVING COUNT(1) > 1;

ALTER TABLE `tmall_bms`.`base_exchange_rate`
  DROP INDEX uk_base_rate_pair_active,
  DROP INDEX idx_sc_shop_user,
  DROP COLUMN sc_id,
  DROP COLUMN shop_id,
  DROP COLUMN user_id,
  ADD COLUMN currency_pair_key varchar(40)
    GENERATED ALWAYS AS (concat(least(source_currency,target_currency),'|',greatest(source_currency,target_currency))) STORED
    COMMENT '无方向货币对唯一键' AFTER active_unique_guard,
  ADD UNIQUE KEY uk_base_rate_pair_active
    (currency_pair_key, active_unique_guard);

ALTER TABLE `tmall_bms`.`customer_exchange_rate_rule`
  ADD COLUMN adjust_direction varchar(8) NOT NULL DEFAULT 'NONE'
    COMMENT '调整方向：UP上浮，DOWN下浮，NONE不适用' AFTER adjust_type;

UPDATE `tmall_bms`.`customer_exchange_rate_rule`
SET adjust_direction = CASE WHEN adjust_type = 'FIXED' THEN 'NONE' ELSE 'UP' END;

ALTER TABLE `tmall_bms`.`customer_exchange_rate_rule_log`
  ADD COLUMN before_adjust_direction varchar(8) DEFAULT NULL
    COMMENT '调整前方向' AFTER after_adjust_type,
  ADD COLUMN after_adjust_direction varchar(8) DEFAULT NULL
    COMMENT '调整后方向' AFTER before_adjust_direction;

ALTER TABLE `tmall_bms`.`bill_exchange_rate`
  ADD COLUMN hit_level varchar(32) DEFAULT NULL
    COMMENT '命中级别：BILL/CUSTOMER/BASE/SHOP/FALLBACK_ONE/DIRECT' AFTER source_type,
  ADD COLUMN customer_rule_id bigint(20) unsigned DEFAULT NULL
    COMMENT '客户特调汇率规则ID' AFTER hit_level,
  ADD COLUMN base_rate_id bigint(20) unsigned DEFAULT NULL
    COMMENT '基准汇率ID' AFTER customer_rule_id,
  ADD COLUMN secondary_base_rate_id bigint(20) unsigned DEFAULT NULL
    COMMENT 'CNY交叉推导的第二条基准汇率ID' AFTER base_rate_id,
  ADD COLUMN source_rate_value decimal(18,8) DEFAULT NULL
    COMMENT '调整或推导前基础汇率' AFTER secondary_base_rate_id,
  ADD COLUMN adjust_type varchar(16) DEFAULT NULL
    COMMENT '客户调整方式' AFTER source_rate_value,
  ADD COLUMN adjust_direction varchar(8) DEFAULT NULL
    COMMENT '客户调整方向：UP/DOWN/NONE' AFTER adjust_type,
  ADD COLUMN adjust_value decimal(18,8) DEFAULT NULL
    COMMENT '客户调整值' AFTER adjust_direction,
  ADD COLUMN derivation_type varchar(16) DEFAULT NULL
    COMMENT '推导类型：DIRECT/REVERSE/CNY_CROSS/NONE' AFTER adjust_value,
  ADD COLUMN derivation_expression varchar(500) DEFAULT NULL
    COMMENT '汇率推导表达式' AFTER derivation_type,
  ADD COLUMN fallback_reason varchar(500) DEFAULT NULL
    COMMENT '按1兜底原因' AFTER derivation_expression,
  ADD KEY idx_bill_rate_customer_rule (customer_rule_id),
  ADD KEY idx_bill_rate_base_rate (base_rate_id),
  ADD KEY idx_bill_rate_secondary_base (secondary_base_rate_id);

-- 历史快照兼容：来源已存在时补命中级别；无法追溯的规则ID和推导字段保持 NULL。
UPDATE `tmall_bms`.`bill_exchange_rate`
SET hit_level = CASE
  WHEN source_type = 'MANUAL' THEN 'BILL'
  WHEN rate_source = 'CUSTOMER' THEN 'CUSTOMER'
  WHEN rate_source = 'BASE' THEN 'BASE'
  WHEN rate_source = 'SHOP' THEN 'SHOP'
  WHEN rate_source = 'FALLBACK_ONE' THEN 'FALLBACK_ONE'
  ELSE 'BILL'
END
WHERE hit_level IS NULL;
