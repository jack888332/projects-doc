-- 应收账单非费项仅记录来源抓取轨迹，不关联账单。
ALTER TABLE `bill_source_collect_mark`
  MODIFY COLUMN `collect_type` varchar(32) NOT NULL
    COMMENT '归集类型：MAIN_ORDER主订单，ADDITIONAL_FEE附加费，ADDITIONAL_INCREMENT附加费增量，CLAIM_ORDER理赔，NON_FEE_FETCH非费项已抓取',
  MODIFY COLUMN `bill_id` bigint(20) unsigned DEFAULT NULL
    COMMENT '账单ID；NON_FEE_FETCH未进入账单时为空',
  MODIFY COLUMN `bill_no` varchar(64) DEFAULT NULL
    COMMENT '账单编号；NON_FEE_FETCH未进入账单时为空';
