CREATE TABLE `bill_fee_relation_migration_map` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `fee_detail_id` bigint NOT NULL COMMENT '历史fee_detail主键ID',
  `legacy_bill_no` varchar(64) NOT NULL COMMENT '历史账单编号',
  `legacy_fee_status` varchar(32) DEFAULT NULL COMMENT '历史费用状态',
  `relation_id` bigint NOT NULL COMMENT '新关系主键ID',
  `relation_no` varchar(64) NOT NULL COMMENT '新关系编号',
  `relation_type` varchar(32) NOT NULL COMMENT '关系类型',
  `relation_status` varchar(32) NOT NULL COMMENT '关系状态',
  `migration_batch_no` varchar(64) NOT NULL COMMENT '迁移批次号',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fee_detail_relation_map` (`fee_detail_id`, `relation_id`),
  KEY `idx_legacy_bill_no` (`legacy_bill_no`),
  KEY `idx_relation_no` (`relation_no`)
) COMMENT='账单费用关系迁移映射表';
