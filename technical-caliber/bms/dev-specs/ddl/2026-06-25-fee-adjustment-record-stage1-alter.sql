-- ============================================================
-- BMS 调账中心阶段一增量 DDL
-- Captured at: 2026-06-25
-- Target table: fee_adjustment_record
-- Purpose:
-- 1. 基于当前已上线 fee_adjustment_record 结构补齐调账中心阶段一字段
-- 2. 回填历史记录，保证新页面和审核流程可直接使用
-- 3. 与 aidocs/technical-caliber/sql/ar_bill.sql 中最新表结构保持一致
-- ============================================================

-- 执行前建议：
-- 1. 先在生产等价环境演练
-- 2. 确认 fee_adjustment_record 当前仍为旧结构（未包含本脚本新增字段）
-- 3. 回填 UPDATE 建议在低峰期执行

ALTER TABLE `tmall_bms`.`fee_adjustment_record`
  ADD COLUMN `adjustment_no` varchar(64) NOT NULL COMMENT '调账单号' AFTER `id`,
  ADD COLUMN `adjustment_object` varchar(16) DEFAULT NULL COMMENT '调账对象：BILL/ORDER/FEE' AFTER `adjustment_no`,
  ADD COLUMN `object_no` varchar(64) DEFAULT NULL COMMENT '调账对象编号' AFTER `adjustment_object`,
  ADD COLUMN `adjustment_type` varchar(16) DEFAULT NULL COMMENT '调账类型：ADJUST/REVERSAL' AFTER `object_no`,
  ADD COLUMN `assigned_bill_id` bigint(20) unsigned DEFAULT NULL COMMENT '归属账单ID' AFTER `trigger_bill_id`,
  ADD COLUMN `assigned_bill_no` varchar(64) DEFAULT NULL COMMENT '归属账单号' AFTER `assigned_bill_id`,
  ADD COLUMN `assigned_bill_type` varchar(32) DEFAULT NULL COMMENT '归属账单类型' AFTER `assigned_bill_no`,
  ADD COLUMN `assignment_mode` varchar(16) DEFAULT NULL COMMENT '归属方式：AUTO/MANUAL' AFTER `assigned_bill_type`,
  ADD COLUMN `rejected_reason` varchar(500) DEFAULT NULL COMMENT '驳回原因' AFTER `approval_status`,
  ADD COLUMN `approved_by` varchar(64) DEFAULT NULL COMMENT '审核人' AFTER `rejected_reason`,
  ADD COLUMN `approved_at` datetime DEFAULT NULL COMMENT '审核时间' AFTER `approved_by`,
  ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER `approved_at`,
  ADD COLUMN `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人' AFTER `updated_at`,
  ADD KEY `idx_fee_adjustment_no` (`adjustment_no`),
  ADD KEY `idx_fee_adjustment_assigned_bill_no` (`assigned_bill_no`);

-- ------------------------------------------------------------
-- 历史数据回填
-- ------------------------------------------------------------
-- 说明：
-- 1. 旧数据没有调账单号，统一回填为 FAR-HIS-{id}
-- 2. 旧数据没有归属账单时，默认归属到 trigger_bill_id / trigger_bill_no
-- 3. 调账对象、对象编号基于 fee_detail 快照推导
-- 4. 调账类型基于金额变幅正负推导：负数=REVERSAL，其他=ADJUST

UPDATE `tmall_bms`.`fee_adjustment_record` r
LEFT JOIN `tmall_bms`.`fee_detail` fd ON fd.`id` = r.`fee_id`
LEFT JOIN `tmall_bms`.`ar_bill` b ON b.`id` = r.`trigger_bill_id`
SET
  r.`adjustment_no` = CASE
    WHEN r.`adjustment_no` IS NULL OR r.`adjustment_no` = '' THEN CONCAT('FAR-HIS-', r.`id`)
    ELSE r.`adjustment_no`
  END,
  r.`adjustment_object` = CASE
    WHEN r.`adjustment_object` IS NOT NULL AND r.`adjustment_object` <> '' THEN r.`adjustment_object`
    WHEN fd.`attached_object` = 'BILL' THEN 'BILL'
    WHEN fd.`attached_object` = 'ORDER' THEN 'ORDER'
    ELSE 'FEE'
  END,
  r.`object_no` = CASE
    WHEN r.`object_no` IS NOT NULL AND r.`object_no` <> '' THEN r.`object_no`
    WHEN fd.`attached_object` = 'BILL' THEN fd.`bill_no`
    WHEN fd.`attached_object` = 'ORDER' THEN fd.`business_order_no`
    WHEN fd.`attached_object` = 'LAST_PACKAGE' THEN fd.`last_mile_waybill_no`
    WHEN fd.`attached_object` = 'FIRST_PACKAGE' THEN fd.`first_mile_waybill_no`
    ELSE CAST(fd.`id` AS CHAR)
  END,
  r.`adjustment_type` = CASE
    WHEN r.`adjustment_type` IS NOT NULL AND r.`adjustment_type` <> '' THEN r.`adjustment_type`
    WHEN r.`adjustment_delta_in_fee_adjustment_currency` < 0 THEN 'REVERSAL'
    ELSE 'ADJUST'
  END,
  r.`assigned_bill_id` = CASE
    WHEN r.`assigned_bill_id` IS NULL THEN r.`trigger_bill_id`
    ELSE r.`assigned_bill_id`
  END,
  r.`assigned_bill_no` = CASE
    WHEN r.`assigned_bill_no` IS NULL OR r.`assigned_bill_no` = '' THEN b.`bill_no`
    ELSE r.`assigned_bill_no`
  END,
  r.`assigned_bill_type` = CASE
    WHEN r.`assigned_bill_type` IS NULL OR r.`assigned_bill_type` = '' THEN 'MEMBER_AR'
    ELSE r.`assigned_bill_type`
  END,
  r.`assignment_mode` = CASE
    WHEN r.`assignment_mode` IS NULL OR r.`assignment_mode` = '' THEN 'AUTO'
    ELSE r.`assignment_mode`
  END,
  r.`updated_at` = NOW(),
  r.`updated_by` = CASE
    WHEN r.`updated_by` IS NULL OR r.`updated_by` = '' THEN r.`created_by`
    ELSE r.`updated_by`
  END;

-- ------------------------------------------------------------
-- 回填校验 SQL（执行完成后可人工核对）
-- ------------------------------------------------------------
-- SELECT COUNT(1) FROM tmall_bms.fee_adjustment_record WHERE adjustment_no IS NULL OR adjustment_no = '';
-- SELECT COUNT(1) FROM tmall_bms.fee_adjustment_record WHERE assigned_bill_no IS NULL OR assigned_bill_no = '';
-- SELECT COUNT(1) FROM tmall_bms.fee_adjustment_record WHERE adjustment_type IS NULL OR adjustment_type = '';
-- SELECT COUNT(1) FROM tmall_bms.fee_adjustment_record WHERE adjustment_object IS NULL OR adjustment_object = '';
