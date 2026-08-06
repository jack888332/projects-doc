-- 应收账单内部导出格式拆分式/合并式：导出任务表新增内部导出格式字段
-- 数据库：tmall_bms
-- 需求：面向财务的对账报表导出区分【合并式】和【拆分式】（PRD 提交 1700b4e233af64a2f81928b60b6ccd485a24a413）
-- 方案：aidocs/technical-caliber/bms/dev-specs/2026-08-05-bms-应收账单内部导出拆分式合并式技术调整方案与计划.md
-- 说明：字段允许为空，历史任务不做回填（internal_format 为空，前端展示"历史任务"）；
--       新任务由创建逻辑显式写入：CUSTOMER=NOT_APPLICABLE、INTERNAL=SPLIT/MERGED。
--       完整最新表结构已同步至 ar_bill.sql。

ALTER TABLE `tmall_bms`.`bill_export_task`
    ADD COLUMN `internal_format` varchar(32) DEFAULT NULL
        COMMENT '内部导出格式：SPLIT/MERGED/NOT_APPLICABLE，历史任务为空'
        AFTER `result_file_type`;
