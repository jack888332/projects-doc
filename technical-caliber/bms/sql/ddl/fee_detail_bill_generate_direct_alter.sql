ALTER TABLE `fee_detail`
  ADD COLUMN `source_fee_key` varchar(128) DEFAULT NULL COMMENT '来源费用唯一业务键' AFTER `dedupe_key`,
  ADD COLUMN `source_version_no` bigint NOT NULL DEFAULT 1 COMMENT '来源版本号' AFTER `source_fee_key`,
  ADD COLUMN `source_row_hash` varchar(64) DEFAULT NULL COMMENT '来源行哈希' AFTER `source_version_no`,
  ADD COLUMN `is_latest_version` tinyint NOT NULL DEFAULT 1 COMMENT '是否最新版本：1是 0否' AFTER `source_row_hash`;

CREATE INDEX `idx_fee_detail_source_fee_key_version`
  ON `fee_detail` (`source_fee_key`, `source_version_no`);

CREATE INDEX `idx_fee_detail_latest_source`
  ON `fee_detail` (`source_system`, `source_table`, `is_latest_version`);
