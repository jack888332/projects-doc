-- 2026-07-21 应收账单内部明细导出任务扩展
-- 执行前请先备份并在测试环境验证；完整最新结构见 technical-caliber/sql/ar_bill.sql。

ALTER TABLE `bill_export_task`
  ADD COLUMN `source_entry` varchar(32) NOT NULL DEFAULT 'LIST' COMMENT '发起入口：DETAIL/LIST' AFTER `bill_type`,
  ADD COLUMN `export_purpose` varchar(32) NOT NULL DEFAULT 'CUSTOMER' COMMENT '导出用途：CUSTOMER/INTERNAL' AFTER `source_entry`,
  ADD COLUMN `result_file_type` varchar(16) NOT NULL DEFAULT 'ZIP' COMMENT '结果文件类型：XLSX/ZIP' AFTER `export_purpose`,
  ADD COLUMN `data_frozen_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '数据冻结完成时间' AFTER `config_snapshot_json`,
  ADD COLUMN `failure_reason` varchar(1000) DEFAULT NULL COMMENT '任务级失败原因' AFTER `data_frozen_at`,
  MODIFY COLUMN `file_key` varchar(500) DEFAULT NULL COMMENT '当前有效结果文件键';

ALTER TABLE `bill_export_task_item`
  ADD COLUMN `item_seq` int NOT NULL DEFAULT '0' COMMENT '用户提交顺序' AFTER `bill_no`,
  ADD COLUMN `result_name` varchar(255) DEFAULT NULL COMMENT '客户文件名或内部Sheet名' AFTER `file_key`;

UPDATE `bill_export_task_item` item
JOIN (
  SELECT id,
         @row_no := IF(@task_id = task_id, @row_no + 1, 1) AS item_seq,
         @task_id := task_id AS ignored_task_id
  FROM `bill_export_task_item`
  CROSS JOIN (SELECT @row_no := 0, @task_id := 0) vars
  ORDER BY task_id, id
) ordered_item ON ordered_item.id = item.id
SET item.item_seq = ordered_item.item_seq
WHERE item.item_seq = 0;
