-- 成本账单第二步字段映射补充关键单号落库字段。
-- 已执行初始化脚本的环境单独执行本迁移；全新环境直接执行初始化脚本即可。
ALTER TABLE `cost_detail`
  ADD COLUMN `key_no_type` varchar(32) DEFAULT NULL COMMENT '关键单号类型；为空表示未选择关键单号' AFTER `source_amount_column`,
  ADD COLUMN `key_no` varchar(255) DEFAULT NULL COMMENT '供应商原始关键单号' AFTER `key_no_type`,
  ADD KEY `idx_cost_detail_key_no` (`sc_id`, `key_no_type`, `key_no`, `is_deleted`);
