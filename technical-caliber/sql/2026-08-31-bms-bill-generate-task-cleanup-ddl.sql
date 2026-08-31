-- 账单生成任务清理功能：新增清理批次与批次明细表
-- 数据库：tmall_bms
-- 需求：应收账单与返款账单生成任务页增加任务清理功能，清理后删除账单相关数据并恢复来源打标
-- 方案：aidocs/technical-caliber/bms/dev-specs/2026-08-31-bms-账单生成任务清理功能需求落地方案及调整计划.md
-- 说明：完整最新表结构已同步至 ar_bill.sql；本文件为上线前增量 DDL，不包含存量数据迁移。

CREATE TABLE IF NOT EXISTS `tmall_bms`.`bill_generate_task_cleanup_batch` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `batch_no` varchar(64) NOT NULL COMMENT '清理批次号',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL DEFAULT '0' COMMENT '店铺ID；批次可能跨店铺，按明细隔离，0表示跨店',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `total_count` int(11) NOT NULL DEFAULT '0' COMMENT '任务总数',
  `processed_count` int(11) NOT NULL DEFAULT '0' COMMENT '已处理数',
  `success_count` int(11) NOT NULL DEFAULT '0' COMMENT '成功数',
  `fail_count` int(11) NOT NULL DEFAULT '0' COMMENT '失败数',
  `task_status` varchar(32) NOT NULL DEFAULT 'WAITING' COMMENT '状态：WAITING/RUNNING/SUCCESS/PARTIAL_SUCCESS/FAILED',
  `include_related_tasks` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否一并清理共享账单相关任务',
  `clear_external_links` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否解除外部费用挂靠',
  `failure_reason` varchar(2000) DEFAULT NULL COMMENT '批次级失败原因',
  `operator_id` varchar(64) DEFAULT NULL COMMENT '操作人ID',
  `operator_name` varchar(128) DEFAULT NULL COMMENT '操作人名称',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除: 0正常 1删除',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cleanup_batch_no` (`batch_no`),
  KEY `idx_cleanup_batch_sc` (`sc_id`, `task_status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  ROW_FORMAT=DYNAMIC COMMENT='账单生成任务清理批次';

CREATE TABLE IF NOT EXISTS `tmall_bms`.`bill_generate_task_cleanup_item` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `batch_id` bigint(20) unsigned NOT NULL COMMENT '批次ID',
  `task_id` bigint(20) unsigned NOT NULL COMMENT '生成任务ID',
  `task_no` varchar(64) NOT NULL COMMENT '任务编号',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `bill_type` varchar(32) NOT NULL COMMENT '账单类型：MEMBER_AR/COD_REFUND',
  `task_status` varchar(32) NOT NULL COMMENT '单任务结果：WAITING/SUCCESS/FAILED',
  `deleted_counts_json` json DEFAULT NULL COMMENT '各表删除数量JSON',
  `error_message` varchar(2000) DEFAULT NULL COMMENT '失败原因',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '逻辑删除: 0正常 1删除',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cleanup_item` (`batch_id`, `task_id`),
  KEY `idx_cleanup_item_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  ROW_FORMAT=DYNAMIC COMMENT='账单生成任务清理批次明细';
