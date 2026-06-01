-- BMS fee_source_dataset query policy fields
-- 说明：
-- 1. 本脚本用于 tmall_bms 库。
-- 2. 将源数据拆分查询窗口和分页条数沉到数据集配置，账单生成不再读取公共配置文件中的 source.query.page.size。
-- 3. query_window_days=1 表示按天查询；query_page_size 控制每次分页拉取条数。

ALTER TABLE `fee_source_dataset`
  ADD COLUMN `query_window_days` int(11) NOT NULL DEFAULT '1' COMMENT '源数据查询窗口天数，1表示按天拆分' AFTER `supported_contract_nodes`,
  ADD COLUMN `query_page_size` int(11) NOT NULL DEFAULT '500' COMMENT '源数据分页条数' AFTER `query_window_days`;

UPDATE `fee_source_dataset`
SET `query_window_days` = 1,
    `query_page_size` = 500
WHERE `query_window_days` IS NULL
   OR `query_window_days` <= 0
   OR `query_page_size` IS NULL
   OR `query_page_size` <= 0;
