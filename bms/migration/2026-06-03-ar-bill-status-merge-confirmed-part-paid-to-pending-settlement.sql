-- ============================================================
-- BMS 应收账单状态合并迁移（CONFIRMED / PART_PAID → PENDING_SETTLEMENT）
-- 适用版本：待结清标签上线前执行
-- 执行顺序：先执行 SQL，再部署新版本代码
-- ============================================================

-- 1) 应收账单主表：合并 CONFIRMED、PART_PAID 为真实状态 PENDING_SETTLEMENT
UPDATE ar_bill
   SET bill_status = 'PENDING_SETTLEMENT',
       updated_at  = NOW()
 WHERE bill_status IN ('CONFIRMED', 'PART_PAID');

-- 2) 同步逾期标记字段（沿用旧逻辑：payment_overdue_days > 0 表示已逾期；
--    新版代码已改为实时比较 credit_period_end_date，但保留字段以便历史报表兼容）
--    若已切换为 CURDATE() > credit_period_end_date 实时判定，可跳过本段。
--    此处仅做一次性的字段重算（可选）：
UPDATE ar_bill b
   SET payment_overdue_days = CASE
           WHEN credit_period_end_date IS NULL THEN 0
           WHEN DATEDIFF(CURDATE(), credit_period_end_date) < 0 THEN 0
           ELSE DATEDIFF(CURDATE(), credit_period_end_date)
       END,
       updated_at = NOW()
 WHERE bill_status = 'PENDING_SETTLEMENT';

-- 3) 校验：迁移后不应再存在 CONFIRMED/PART_PAID 状态值
SELECT bill_status, COUNT(1) AS cnt
  FROM ar_bill
 WHERE bill_status IN ('CONFIRMED', 'PART_PAID')
 GROUP BY bill_status;

-- 4) 校验：PENDING_SETTLEMENT 数量应等于迁移前的 CONFIRMED + PART_PAID 数量
SELECT bill_status, COUNT(1) AS cnt
  FROM ar_bill
 WHERE bill_status = 'PENDING_SETTLEMENT'
 GROUP BY bill_status;

-- 5)（可选）更新表结构注释
-- ALTER TABLE ar_bill
--   MODIFY COLUMN bill_status VARCHAR(32) NOT NULL
--   COMMENT '账单状态: DRAFT/GENERATED/PENDING_SETTLEMENT/PAID/VOID';

-- 6)（可选）回滚 SQL
-- UPDATE ar_bill SET bill_status = 'CONFIRMED', updated_at = NOW()
--  WHERE bill_status = 'PENDING_SETTLEMENT' AND paid_amount = 0;
-- UPDATE ar_bill SET bill_status = 'PART_PAID', updated_at = NOW()
--  WHERE bill_status = 'PENDING_SETTLEMENT' AND paid_amount > 0;
