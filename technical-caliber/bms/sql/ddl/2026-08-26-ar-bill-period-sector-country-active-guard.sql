-- ============================================================
-- ar_bill 唯一键增加 active_bill_guard
--
-- 背景：regenerate 归档旧账单时仅置 bill_status=VOID + is_deleted=1，
-- 旧行仍占据 uk_ar_bill_period_sector_country，导致新账单 INSERT 撞唯一键。
-- 方案：复用 base_exchange_rate.active_unique_guard 的生成列模式，
-- 唯一键只约束未删除行；已删除/归档行 guard 为 NULL，不再占用唯一键。
-- ============================================================

USE `tmall_bms`;

-- 前置检查：活跃数据里同键重复时禁止继续执行（正常应无结果）。
SELECT bill_type,
       bill_config_id,
       billing_period_start_date,
       billing_period_end_date,
       business_sector,
       destination_country,
       COUNT(1) AS active_count
FROM `tmall_bms`.`ar_bill`
WHERE is_deleted = 0
GROUP BY bill_type,
         bill_config_id,
         billing_period_start_date,
         billing_period_end_date,
         business_sector,
         destination_country
HAVING COUNT(1) > 1;

ALTER TABLE `tmall_bms`.`ar_bill`
  ADD COLUMN `active_bill_guard` tinyint(1) GENERATED ALWAYS AS (
    CASE WHEN `is_deleted` = 0 THEN 1 ELSE NULL END
  ) STORED COMMENT '未删除唯一约束辅助列：未删除时为1，已删除时为NULL' AFTER `is_deleted`;

ALTER TABLE `tmall_bms`.`ar_bill`
  DROP INDEX `uk_ar_bill_period_sector_country`;

ALTER TABLE `tmall_bms`.`ar_bill`
  ADD UNIQUE KEY `uk_ar_bill_period_sector_country` (
    `bill_type`,
    `bill_config_id`,
    `billing_period_start_date`,
    `billing_period_end_date`,
    `business_sector`,
    `destination_country`,
    `active_bill_guard`
  );

-- 验证：应可同时查询到同键的 VOID 归档行和新生成的活跃行。
SELECT bill_type,
       bill_config_id,
       billing_period_start_date,
       billing_period_end_date,
       business_sector,
       destination_country,
       bill_status,
       is_deleted,
       active_bill_guard,
       bill_no
FROM `tmall_bms`.`ar_bill`
WHERE bill_type = 'MEMBER_AR'
  AND business_sector = 'DEFAULT'
  AND destination_country = 'TW'
ORDER BY bill_config_id, billing_period_start_date, id;
