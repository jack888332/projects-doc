-- 成本费项索引补充成本费项别名
-- 数据库：tmall_bms
-- 说明：fee_type 已存在且固定为 AP，本次仅新增缺失的 fee_aliases 字段并按原型回填别名。

ALTER TABLE `tmall_bms`.`cost_fee_index`
    ADD COLUMN `fee_aliases` varchar(1000) DEFAULT NULL
        COMMENT '成本费项别名，多个别名使用英文逗号分隔，用于成本账单导入名称映射'
        AFTER `fee_name`;

UPDATE `tmall_bms`.`cost_fee_index`
SET `fee_aliases` = CASE `fee_code`
    WHEN 'COST-DEL-001' THEN '運費,本款,宅配運費'
    WHEN 'COST-DEL-006' THEN '超才費,超大,材积附加'
    WHEN 'COST-DEL-002' THEN '偏遠費'
    WHEN 'COST-DEL-003' THEN '跨區費'
    WHEN 'COST-DEL-004' THEN '轉發費'
    WHEN 'COST-DEL-005' THEN '手續費'
    WHEN 'COST-DEL-007' THEN '車趟費'
    WHEN 'COST-DEL-008' THEN '續倉費用'
    WHEN 'COST-DEL-010' THEN '貼單拖袋費'
    WHEN 'COST-DEL-011' THEN '拖袋費'
    WHEN 'COST-DEL-012' THEN '帳務調整'
    WHEN 'COST-CLR-001' THEN '清關費'
    WHEN 'COST-CLR-002' THEN '稅金,税费,關稅'
    WHEN 'COST-CLR-003' THEN '報關費'
    WHEN 'COST-CLR-008' THEN '倉租,萬海倉租,遠雄倉租'
    WHEN 'COST-CLR-004' THEN '規費請款單'
    WHEN 'COST-CLR-005' THEN '罰單'
    WHEN 'COST-CLR-006' THEN '移倉費'
    WHEN 'COST-CLR-007' THEN '退運費用'
    WHEN 'COST-CLR-009' THEN 'EZ Way 明細'
    WHEN 'COST-SEA-001' THEN '海運費,普貨海運費'
    WHEN 'COST-SEA-002' THEN '拖櫃費'
    WHEN 'COST-SEA-003' THEN '續單費'
    WHEN 'COST-SEA-004' THEN '操作費'
    WHEN 'COST-SEA-005' THEN '文件費'
    WHEN 'COST-SEA-006' THEN '報關費'
    WHEN 'COST-AIR-001' THEN '空運費'
    WHEN 'COST-AIR-002' THEN '提單費'
    WHEN 'COST-AIR-003' THEN '中港段費,中港車費'
    WHEN 'COST-AIR-004' THEN '收送費'
    WHEN 'COST-AIR-005' THEN '打包費'
    WHEN 'COST-AIR-006' THEN '報關費'
    WHEN 'COST-AIR-007' THEN '壓夜費'
    WHEN 'COST-AIR-008' THEN '查驗費'
    WHEN 'COST-AIR-009' THEN '文件費'
    WHEN 'COST-TRK-001' THEN '9.6米車,17.5米車,70方車'
    WHEN 'COST-TRK-002' THEN '搬運費'
    WHEN 'COST-TRK-003' THEN '等待費'
    WHEN 'COST-TRK-004' THEN '月度補差'
    WHEN 'COST-TRK-005' THEN '里程費'
    ELSE `fee_aliases`
END
WHERE `fee_code` IN (
    'COST-DEL-001', 'COST-DEL-006', 'COST-DEL-002', 'COST-DEL-003',
    'COST-DEL-004', 'COST-DEL-005', 'COST-DEL-007', 'COST-DEL-008',
    'COST-DEL-010', 'COST-DEL-011', 'COST-DEL-012',
    'COST-CLR-001', 'COST-CLR-002', 'COST-CLR-003', 'COST-CLR-008',
    'COST-CLR-004', 'COST-CLR-005', 'COST-CLR-006', 'COST-CLR-007',
    'COST-CLR-009',
    'COST-SEA-001', 'COST-SEA-002', 'COST-SEA-003', 'COST-SEA-004',
    'COST-SEA-005', 'COST-SEA-006',
    'COST-AIR-001', 'COST-AIR-002', 'COST-AIR-003', 'COST-AIR-004',
    'COST-AIR-005', 'COST-AIR-006', 'COST-AIR-007', 'COST-AIR-008',
    'COST-AIR-009',
    'COST-TRK-001', 'COST-TRK-002', 'COST-TRK-003', 'COST-TRK-004',
    'COST-TRK-005'
);

SELECT `fee_code`, `fee_name`, `fee_type`, `fee_aliases`
FROM `tmall_bms`.`cost_fee_index`
ORDER BY `cost_board`, `fee_code`;
