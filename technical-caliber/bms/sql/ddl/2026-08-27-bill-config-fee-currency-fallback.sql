-- ============================================================
-- bill_config_fee_currency_rule 增加 is_fallback，并补齐存量配置兜底规则
--
-- 背景：应收账单费项结算币种“随原始币种”未生效，
-- 根因是兜底规则未作为正式规则落库，生成期未命中规则时落到账单默认币种 CNY。
-- 方案：兜底规则与明确费项规则一起落库，统一使用 fee_code='FALLBACK' + is_fallback=1。
-- 适用库：tmall_bms
--
-- 说明：
-- 1. 生产 19 条未删除配置均为单一业务类型 CONSOLIDATION，本脚本按配置补齐一条
--    business_type_code='CONSOLIDATION' 的兜底行；多业务类型配置需人工扩展。
-- 2. 兜底币种来源优先级：
--    extra_json.fallbackFeeCurrencyRule
--    -> settlementProfile.defaultPlan.fallbackFeeCurrencyRule
--    -> settlementProfile.branchPlanList[0].fallbackFeeCurrencyRule
--    -> 默认 SOURCE（随原始币种）。
-- 3. 脚本幂等：已存在 fee_code='FALLBACK' + is_fallback=1 的配置自动跳过。
-- ============================================================

USE `tmall_bms`;

-- 1. 表结构增加兜底规则标记。
-- MySQL 8.0.29 以下不支持 ADD COLUMN IF NOT EXISTS，执行前请人工确认字段不存在。
ALTER TABLE `bill_config_fee_currency_rule`
  ADD COLUMN `is_fallback` tinyint(1) NOT NULL DEFAULT '0'
  COMMENT '是否兜底规则：0否，1是' AFTER `fee_name`;

-- 2. 存量配置补齐兜底规则。
INSERT INTO `bill_config_fee_currency_rule`
  (`bill_config_id`, `business_type_code`, `fee_index_id`, `fee_code`, `fee_name`,
   `charge_currency_mode`, `charge_currency`, `enabled`, `is_fallback`,
   `remark`, `created_by`, `updated_by`)
SELECT
  c.id,
  'CONSOLIDATION',
  NULL,
  'FALLBACK',
  '兜底规则',
  COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.extra_json, '$.fallbackFeeCurrencyRule.chargeCurrencyMode')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.extra_json, '$.settlementProfile.defaultPlan.fallbackFeeCurrencyRule.chargeCurrencyMode')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.extra_json, '$.settlementProfile.branchPlanList[0].fallbackFeeCurrencyRule.chargeCurrencyMode')), ''),
    'SOURCE'
  ),
  COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.extra_json, '$.fallbackFeeCurrencyRule.chargeCurrency')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.extra_json, '$.settlementProfile.defaultPlan.fallbackFeeCurrencyRule.chargeCurrency')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.extra_json, '$.settlementProfile.branchPlanList[0].fallbackFeeCurrencyRule.chargeCurrency')), ''),
    NULL
  ),
  1,
  1,
  '存量配置补齐费项结算币种兜底规则',
  'system',
  'system'
FROM `bill_config` c
WHERE c.is_deleted = 0
  AND NOT EXISTS (
    SELECT 1 FROM `bill_config_fee_currency_rule` r
    WHERE r.bill_config_id = c.id
      AND r.business_type_code = 'CONSOLIDATION'
      AND r.fee_code = 'FALLBACK'
      AND r.is_fallback = 1
      AND r.is_deleted = 0
  );

-- 3. 校验：未删除配置均应至少有一条兜底规则。
SELECT c.id AS bill_config_id,
       c.config_no,
       c.business_type_codes
FROM `bill_config` c
LEFT JOIN `bill_config_fee_currency_rule` r
  ON r.bill_config_id = c.id
  AND r.fee_code = 'FALLBACK'
  AND r.is_fallback = 1
  AND r.is_deleted = 0
WHERE c.is_deleted = 0
  AND r.id IS NULL;

-- 4. 抽查配置 86 的兜底规则。
SELECT c.config_no,
       r.business_type_code,
       r.fee_code,
       r.is_fallback,
       r.charge_currency_mode,
       r.charge_currency,
       r.enabled
FROM `bill_config` c
JOIN `bill_config_fee_currency_rule` r ON r.bill_config_id = c.id
WHERE c.config_no = 'ARB-OG0863-Scheme-1787793589-v2'
  AND r.is_deleted = 0
ORDER BY r.is_fallback, r.id;
