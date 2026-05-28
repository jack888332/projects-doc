-- BMS bill_generate_task snapshot fields
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 生成账单任务会保存当次执行使用的账单配置、限定范围、费项规则快照。
-- 3. 后续 bill_config 被修改后，历史任务仍可追溯当时实际执行配置。

ALTER TABLE `bill_generate_task`
  ADD COLUMN `bill_config_snapshot_json` json COMMENT '账单配置快照JSON' AFTER `error_message`,
  ADD COLUMN `bill_scope_snapshot_json` json COMMENT '账单配置范围快照JSON' AFTER `bill_config_snapshot_json`,
  ADD COLUMN `fee_rule_snapshot_json` json COMMENT '费项规则快照JSON' AFTER `bill_scope_snapshot_json`,
  ADD COLUMN `order_source_sql` longtext COMMENT '本次任务拉取主订单宽表实际执行SQL' AFTER `fee_rule_snapshot_json`,
  ADD COLUMN `additional_source_sql` longtext COMMENT '本次任务拉取附加费实际执行SQL' AFTER `order_source_sql`;
