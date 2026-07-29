-- 成本费项索引初始化数据
-- 数据来源：成本账单原型“成本费项索引”页面
-- 数据库：tmall_bms
-- 说明：
-- 1. 当前原型共 41 条：派送成本 12 条、清关成本 9 条、海运成本 6 条、空运成本 9 条、租车成本 5 条。
-- 2. 费项类型均为应付类 AP，原型状态均为启用。
-- 3. 执行前请按实际环境修改初始化操作人 ID。

SET NAMES utf8mb4;
SET @cost_fee_operator_id = 1;

START TRANSACTION;

INSERT INTO `tmall_bms`.`cost_fee_index`
    (`fee_code`, `fee_name`, `cost_board`, `fee_type`, `business_definition`,
     `enabled`, `remark`, `created_by`, `updated_by`, `created_at`, `updated_at`)
VALUES
    -- 派送成本（12条）
    ('COST-DEL-001', '派送费', 'DELIVERY', 'AP', '尾程包裹配送产生的基础运费。',
     1, '按尾程运单归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-10 16:20:00', '2026-07-10 16:20:00'),
    ('COST-DEL-006', '超才费', 'DELIVERY', 'AP', '尾程包裹超过供应商尺寸或材积限制后加收的费用。',
     1, '供应商也可能写作超大或材积附加。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 11:35:00', '2026-07-08 11:35:00'),
    ('COST-DEL-002', '偏远费', 'DELIVERY', 'AP', '偏远地区或特殊送达区域产生的附加配送费用。',
     1, '与偏远附加、偏远区加收同口径。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 12:02:00', '2026-07-08 12:02:00'),
    ('COST-DEL-003', '跨区费', 'DELIVERY', 'AP', '跨越供应商基础配送区间后收取的附加费用。',
     1, '包含跨区、跨区附加等表达。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 12:15:00', '2026-07-08 12:15:00'),
    ('COST-DEL-004', '转发费', 'DELIVERY', 'AP', '包裹因转运、改派或二次投递产生的费用。',
     1, '常见于改派、转单或中转服务。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 12:25:00', '2026-07-08 12:25:00'),
    ('COST-DEL-005', '手续费', 'DELIVERY', 'AP', '代收、改单或其他派送附带服务产生的手续费。',
     1, '通常与代收、改单和服务处理相关。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 12:34:00', '2026-07-08 12:34:00'),
    ('COST-DEL-007', '车趟费', 'DELIVERY', 'AP', '派送或转运过程中按车趟发生的运输费用。',
     1, '常见于车趟、拖袋或批量操作场景。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-10 16:32:00', '2026-07-10 16:32:00'),
    ('COST-DEL-008', '续仓费', 'DELIVERY', 'AP', '货物在仓库或集货点续存期间产生的费用。',
     1, '供应商也可能写作续仓费用。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-09 11:08:00', '2026-07-09 11:08:00'),
    ('COST-DEL-009', '货故赔款', 'DELIVERY', 'AP', '因货损、货故或遗失而向客户或供应商承担的赔款。',
     1, '属于事件型费用。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 17:20:00', '2026-07-08 17:20:00'),
    ('COST-DEL-010', '批量贴单费', 'DELIVERY', 'AP', '批量贴标、贴单、分拣或拖袋作业产生的费用。',
     1, '供应商可能拆写为贴单费、拖袋费。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 17:28:00', '2026-07-08 17:28:00'),
    ('COST-DEL-011', '拖袋费', 'DELIVERY', 'AP', '袋件搬运、拖袋或袋间转运产生的费用。',
     1, '常见于批量派送场景。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 17:31:00', '2026-07-08 17:31:00'),
    ('COST-DEL-012', '账务调整', 'DELIVERY', 'AP', '派送账单中的冲补差、调账或其他账务修正金额。',
     1, '保留原始账务调整口径。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-08 17:35:00', '2026-07-08 17:35:00'),

    -- 清关成本（9条）
    ('COST-CLR-001', '清关费', 'CUSTOMS', 'AP', '货物进出口清关或申报环节产生的基础服务费。',
     1, '不得与税金、仓租混合。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-12 09:12:00', '2026-07-12 09:12:00'),
    ('COST-CLR-002', '进口税费', 'CUSTOMS', 'AP', '货物进口申报产生并由供应商代垫或代收的关税、进口税等税款。',
     1, '不得与报关服务费合并。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-12 09:18:00', '2026-07-12 09:18:00'),
    ('COST-CLR-003', '报关费', 'CUSTOMS', 'AP', '货物报关、代报或申报服务产生的费用。',
     1, '与税金分开维护。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-12 09:22:00', '2026-07-12 09:22:00'),
    ('COST-CLR-008', '仓租', 'CUSTOMS', 'AP', '货物在清关或查验期间占用监管仓、机场仓产生的仓储费用。',
     1, '通常作为间接成本按业务订单分摊。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-11 14:06:00', '2026-07-11 14:06:00'),
    ('COST-CLR-004', '规费', 'CUSTOMS', 'AP', '清关过程中产生的规费、行政费或代办费。',
     1, '与税金、罚款、仓租分开。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-11 14:16:00', '2026-07-11 14:16:00'),
    ('COST-CLR-005', '罚款', 'CUSTOMS', 'AP', '因申报、时效或合规原因产生的处罚费用。',
     1, '保留处罚依据。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-11 14:22:00', '2026-07-11 14:22:00'),
    ('COST-CLR-006', '移仓费', 'CUSTOMS', 'AP', '货物转移监管仓、换仓或挪仓产生的费用。',
     1, '按受影响范围归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-11 14:28:00', '2026-07-11 14:28:00'),
    ('COST-CLR-007', '退运费', 'CUSTOMS', 'AP', '货物退运、返运或撤单过程中发生的费用。',
     1, '按退运事件归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-11 14:34:00', '2026-07-11 14:34:00'),
    ('COST-CLR-009', '实名认证费', 'CUSTOMS', 'AP', 'EZ Way 或其他实名认证、身份核验产生的费用。',
     1, '保留认证平台口径。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-11 14:40:00', '2026-07-11 14:40:00'),

    -- 海运成本（6条）
    ('COST-SEA-001', '海运费', 'SEA_FREIGHT', 'AP', '供应商承运海运主程产生的基础运输费用。',
     1, '与空运板块的同名费项分别维护。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-06 17:42:00', '2026-07-06 17:42:00'),
    ('COST-SEA-002', '拖柜费', 'SEA_FREIGHT', 'AP', '集装箱拖车、拖柜或港区调柜产生的费用。',
     1, '与柜号、提单号联动。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-06 18:00:00', '2026-07-06 18:00:00'),
    ('COST-SEA-003', '续单费', 'SEA_FREIGHT', 'AP', '海运单证续开、续单或补单产生的费用。',
     1, '按提单或订单范围归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-06 18:08:00', '2026-07-06 18:08:00'),
    ('COST-SEA-004', '操作费', 'SEA_FREIGHT', 'AP', '海运操作、装卸、文件处理或中转操作产生的费用。',
     1, '通常为整票或整柜费用。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-06 18:16:00', '2026-07-06 18:16:00'),
    ('COST-SEA-005', '文件费', 'SEA_FREIGHT', 'AP', '海运单证、文件、资料或出单服务产生的费用。',
     1, '与操作费可分开维护。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-06 18:22:00', '2026-07-06 18:22:00'),
    ('COST-SEA-006', '报关费', 'SEA_FREIGHT', 'AP', '海运业务对应的报关、代报或申报费用。',
     1, '与海运费分开维护。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-06 18:26:00', '2026-07-06 18:26:00'),

    -- 空运成本（9条）
    ('COST-AIR-001', '空运费', 'AIR_FREIGHT', 'AP', '空运主程产生的基础运输费用。',
     1, '与海运费分别维护。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:12:00', '2026-07-05 10:12:00'),
    ('COST-AIR-002', '提单费', 'AIR_FREIGHT', 'AP', '空运提单、分单或单证处理产生的费用。',
     1, '可与账单费并存。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:17:00', '2026-07-05 10:17:00'),
    ('COST-AIR-003', '中港段费', 'AIR_FREIGHT', 'AP', '空运货物由内地集货点运往香港机场或操作仓产生的运输费用。',
     1, '间接成本按所属账单、标准成本费项和币种进入分摊集。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:27:00', '2026-07-05 10:27:00'),
    ('COST-AIR-004', '收送费', 'AIR_FREIGHT', 'AP', '空运收件、派送、收货或送货环节发生的费用。',
     1, '可按收送范围归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:33:00', '2026-07-05 10:33:00'),
    ('COST-AIR-005', '打包费', 'AIR_FREIGHT', 'AP', '空运打包、包装、加固或分箱产生的费用。',
     1, '与订单包装范围相关。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:40:00', '2026-07-05 10:40:00'),
    ('COST-AIR-006', '报关费', 'AIR_FREIGHT', 'AP', '空运业务对应的报关或申报费用。',
     1, '与空运费分开维护。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:45:00', '2026-07-05 10:45:00'),
    ('COST-AIR-007', '压夜费', 'AIR_FREIGHT', 'AP', '航班压夜、过夜或暂存等待产生的费用。',
     1, '通常按主单或批次归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:52:00', '2026-07-05 10:52:00'),
    ('COST-AIR-008', '查验费', 'AIR_FREIGHT', 'AP', '空运货物查验、复查或现场处理产生的费用。',
     1, '按查验事件归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 10:58:00', '2026-07-05 10:58:00'),
    ('COST-AIR-009', '文件费', 'AIR_FREIGHT', 'AP', '空运单证、文件或资料处理产生的费用。',
     1, '与提单费可并存。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-05 11:04:00', '2026-07-05 11:04:00'),

    -- 租车成本（5条）
    ('COST-TRK-001', '租车费', 'TRUCKING', 'AP', '因仓库提送、码头交接或履约调拨而租用车辆产生的费用。',
     1, '车型差异通过供应商映射保留。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-03 10:25:00', '2026-07-03 10:25:00'),
    ('COST-TRK-002', '搬运费', 'TRUCKING', 'AP', '仓库装卸、搬运、上下车或人工协作产生的费用。',
     1, '与车型费分开维护。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-03 10:31:00', '2026-07-03 10:31:00'),
    ('COST-TRK-003', '等待费', 'TRUCKING', 'AP', '车辆等待、压车、排队或滞留产生的费用。',
     1, '按实际等待时长或车次归属。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-03 10:36:00', '2026-07-03 10:36:00'),
    ('COST-TRK-004', '月度补差', 'TRUCKING', 'AP', '按月最低消费、保底或账期补差产生的费用。',
     1, '按月度账单口径归集。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-03 10:42:00', '2026-07-03 10:42:00'),
    ('COST-TRK-005', '里程费', 'TRUCKING', 'AP', '按运输里程、路线或里程单价计费的费用。',
     1, '常见于长途或计里程租车。', @cost_fee_operator_id, @cost_fee_operator_id, '2026-07-03 10:48:00', '2026-07-03 10:48:00');

-- 按原型中的成本费项别名回填；没有配置别名的费项保持为空。
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
WHERE `fee_code` LIKE 'COST-%';

COMMIT;

-- 执行后校验：应返回 41 条。
SELECT COUNT(*) AS `cost_fee_index_count`
FROM `tmall_bms`.`cost_fee_index`;

-- 按成本板块校验：DELIVERY=12、CUSTOMS=9、SEA_FREIGHT=6、AIR_FREIGHT=9、TRUCKING=5。
SELECT `cost_board`, COUNT(*) AS `fee_count`
FROM `tmall_bms`.`cost_fee_index`
GROUP BY `cost_board`
ORDER BY `cost_board`;

-- 校验费项类型和别名。
SELECT `fee_code`, `fee_name`, `fee_type`, `fee_aliases`
FROM `tmall_bms`.`cost_fee_index`
ORDER BY `cost_board`, `fee_code`;
