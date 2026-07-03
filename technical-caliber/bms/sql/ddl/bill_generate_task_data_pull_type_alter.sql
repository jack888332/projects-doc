-- 账单生成任务增加数据拉取类型，用于任务监控区分全量与增量任务。
ALTER TABLE `bill_generate_task`
  ADD COLUMN `data_pull_type` varchar(32) NOT NULL DEFAULT 'FULL'
  COMMENT '数据拉取类型：FULL全量/INCREMENTAL增量'
  AFTER `trigger_type`;
