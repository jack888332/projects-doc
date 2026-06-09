-- BMS source marking fields for ofp_db1
-- 说明：
-- 1. 本脚本用于业务源库 ofp_db1 的源表打标字段变更。
-- 2. BMS 生成账单后会用这些字段判断订单/附加费是否已经计入账单。
-- 3. sale_order_additional_matter.bms_after_bill_added_flag 用于仓库系统在订单已出账后追加附加费时打标，BMS 增量任务据此补采。

ALTER TABLE `sale_order_header_extend`
  ADD COLUMN `bms_billed_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已进入BMS账单：0否，1是',
  ADD COLUMN `bms_bill_no` varchar(64) DEFAULT NULL COMMENT 'BMS账单编号';

ALTER TABLE `sale_order_additional_matter`
  ADD COLUMN `bms_billed_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已进入BMS账单：0否，1是',
  ADD COLUMN `bms_bill_no` varchar(64) DEFAULT NULL COMMENT 'BMS账单编号',
  ADD COLUMN `bms_after_bill_added_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '计费后新增：0否，1是';

CREATE INDEX `idx_bms_bill_extend` ON `sale_order_header_extend` (`bms_billed_flag`, `bms_bill_no`);
CREATE INDEX `idx_bms_bill_additional` ON `sale_order_additional_matter` (`bms_billed_flag`, `bms_after_bill_added_flag`, `bms_bill_no`);
