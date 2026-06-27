-- =========================================================
-- BMS 应收账单前置测试数据
-- 目标配置：ARB-SZT-A-001-Scheme-1782545178-v1
-- bill_config.id = 71
-- member_code = 700983
-- customer_no = SZT-A-001
-- 账期类型：WEEK
-- 履约节点：WEIGHT_OUTBOUND（按 measure_time 归集）
-- 账单币种：TWD
-- 适用业务类型：CONSOLIDATION（当前代码映射 order_type = YBCK01）
--
-- 用途：
-- 1. 为 2026-06 整月准备可出账前置数据
-- 2. 覆盖 4 个完整周 + 1 个跨周尾段（06-29 ~ 06-30）
-- 3. 覆盖主订单费用、扩展费用、附加费、理赔
--
-- 注意：
-- 1. 本脚本只写来源库 ofp_ofdb1，不写 tmall_bms 结果表
-- 2. 当前代码会强制回写 sale_order_header_extend，因此每条订单必须有扩展行
-- 3. 本脚本默认可重复执行：先清理同前缀数据，再重新插入
-- =========================================================

USE `ofp_ofdb1`;

-- =========================================================
-- 0. 配置核对（只读）
-- =========================================================
-- 可先在 tmall_bms 执行：
-- SELECT id, config_no, member_code, shop_id, sc_id, billing_period_type, contract_node
-- FROM tmall_bms.bill_config
-- WHERE id = 71;

START TRANSACTION;

-- =========================================================
-- 1. 清理旧测试数据
-- =========================================================

DELETE a
FROM sale_order_additional_matter a
JOIN sale_order_header h ON h.id = a.sale_order_id
WHERE h.member_code = '700983'
  AND h.shop_id = 556490224971067392
  AND h.order_code LIKE 'AR71-202606-%';

DELETE e
FROM sale_order_header_extend e
JOIN sale_order_header h ON h.id = e.sale_order_id
WHERE h.member_code = '700983'
  AND h.shop_id = 556490224971067392
  AND h.order_code LIKE 'AR71-202606-%';

DELETE FROM claim_order
WHERE member_code = '700983'
  AND dealer_shop_id = 556490224971067392
  AND code LIKE 'CLM-AR71-202606-%';

DELETE FROM sale_order_header
WHERE member_code = '700983'
  AND shop_id = 556490224971067392
  AND order_code LIKE 'AR71-202606-%';

-- =========================================================
-- 2. 插入主订单（2026-06 一个月）
-- =========================================================
-- 周期说明：
-- W1: 2026-06-01 ~ 2026-06-07
-- W2: 2026-06-08 ~ 2026-06-14
-- W3: 2026-06-15 ~ 2026-06-21
-- W4: 2026-06-22 ~ 2026-06-28
-- W5: 2026-06-29 ~ 2026-07-05（本脚本只补 06-29, 06-30 两天）

INSERT INTO sale_order_header (
    id,
    delivery_order_code,
    order_type,
    warehouse_code,
    order_code,
    create_time,
    latest_delivery_time,
    place_order_time,
    operate_time,
    shop_nick,
    country_code,
    country,
    order_status,
    sale_order_status,
    status,
    freight,
    shop_id,
    member_code,
    member_name,
    warehouse_name,
    compensation_price,
    cod_price,
    collection_price,
    waybill_no,
    master_waybill_no,
    currency,
    user_coupon_fee,
    integral_fee,
    currency_code,
    warehouse_rental_amount,
    advance_amount,
    dest_division_amount,
    tax_premium_amount,
    compensation_premium_amount,
    collection_premium_amount,
    signed_time,
    sc_id,
    cod_amount,
    forwarding_charge_amount,
    material_charge_amount,
    measure_time,
    dest_warehouse_code,
    dest_warehouse_name,
    insurance_amount
) VALUES
-- W1
(20514001, 'AR71-202606-W1-01', 'YBCK01', 'TMcang2', 'AR71-202606-W1-01', '2026-06-01 09:00:00', '2026-06-01 18:00:00', '2026-06-01 09:00:00', '2026-06-01 14:00:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, 88.00, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W1-01', 'FM-AR71-202606-W1-01', 'CNY', NULL, NULL, 'CNY', 10.00, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-01 14:00:00', NULL, NULL, NULL),
(20514002, 'AR71-202606-W1-02', 'YBCK01', 'TMcang2', 'AR71-202606-W1-02', '2026-06-02 10:00:00', '2026-06-02 19:00:00', '2026-06-02 10:00:00', '2026-06-02 16:00:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, 860.00, 1200.00, 'LM-AR71-202606-W1-02', 'FM-AR71-202606-W1-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 36.00, NULL, 1, NULL, NULL, NULL, '2026-06-02 16:00:00', NULL, NULL, NULL),
(20514003, 'AR71-202606-W1-03', 'YBCK01', 'TMcang2', 'AR71-202606-W1-03', '2026-06-04 09:30:00', '2026-06-04 18:30:00', '2026-06-04 09:30:00', '2026-06-04 13:30:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W1-03', 'FM-AR71-202606-W1-03', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-04 13:30:00', NULL, NULL, NULL),
(20514004, 'AR71-202606-W1-04', 'YBCK01', 'TMcang2', 'AR71-202606-W1-04', '2026-06-06 11:00:00', '2026-06-06 20:00:00', '2026-06-06 11:00:00', '2026-06-06 18:00:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W1-04', 'FM-AR71-202606-W1-04', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-06 18:00:00', NULL, NULL, NULL),
-- W2
(20514005, 'AR71-202606-W2-01', 'YBCK01', 'TMcang2', 'AR71-202606-W2-01', '2026-06-08 08:40:00', '2026-06-08 18:00:00', '2026-06-08 08:40:00', '2026-06-08 12:00:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W2-01', 'FM-AR71-202606-W2-01', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, 15.00, NULL, NULL, NULL, 1, NULL, NULL, 18.00, '2026-06-08 12:00:00', NULL, NULL, NULL),
(20514006, 'AR71-202606-W2-02', 'YBCK01', 'TMcang2', 'AR71-202606-W2-02', '2026-06-10 09:20:00', '2026-06-10 18:20:00', '2026-06-10 09:20:00', '2026-06-10 15:10:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W2-02', 'FM-AR71-202606-W2-02', 'CNY', NULL, NULL, 'CNY', NULL, NULL, 12.00, NULL, NULL, NULL, NULL, 1, NULL, 25.00, NULL, '2026-06-10 15:10:00', NULL, NULL, 30.00),
(20514007, 'AR71-202606-W2-03', 'YBCK01', 'TMcang2', 'AR71-202606-W2-03', '2026-06-11 10:10:00', '2026-06-11 19:00:00', '2026-06-11 10:10:00', '2026-06-11 17:25:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', 300.00, NULL, NULL, 'LM-AR71-202606-W2-03', 'FM-AR71-202606-W2-03', 'CNY', NULL, NULL, 'CNY', NULL, 80.00, NULL, NULL, 20.00, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-11 17:25:00', NULL, NULL, NULL),
(20514008, 'AR71-202606-W2-04', 'YBCK01', 'TMcang2', 'AR71-202606-W2-04', '2026-06-13 07:50:00', '2026-06-13 17:00:00', '2026-06-13 07:50:00', '2026-06-13 11:45:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W2-04', 'FM-AR71-202606-W2-04', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-13 11:45:00', NULL, NULL, NULL),
-- W3
(20514009, 'AR71-202606-W3-01', 'YBCK01', 'TMcang2', 'AR71-202606-W3-01', '2026-06-15 09:10:00', '2026-06-15 18:00:00', '2026-06-15 09:10:00', '2026-06-15 12:20:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, 66.00, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W3-01', 'FM-AR71-202606-W3-01', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-15 12:20:00', NULL, NULL, NULL),
(20514010, 'AR71-202606-W3-02', 'YBCK01', 'TMcang2', 'AR71-202606-W3-02', '2026-06-16 09:30:00', '2026-06-16 18:00:00', '2026-06-16 09:30:00', '2026-06-16 13:10:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, 980.00, 'LM-AR71-202606-W3-02', 'FM-AR71-202606-W3-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 29.00, NULL, 1, NULL, NULL, NULL, '2026-06-16 13:10:00', NULL, NULL, NULL),
(20514011, 'AR71-202606-W3-03', 'YBCK01', 'TMcang2', 'AR71-202606-W3-03', '2026-06-18 08:20:00', '2026-06-18 18:00:00', '2026-06-18 08:20:00', '2026-06-18 11:50:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W3-03', 'FM-AR71-202606-W3-03', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-18 11:50:00', NULL, NULL, NULL),
(20514012, 'AR71-202606-W3-04', 'YBCK01', 'TMcang2', 'AR71-202606-W3-04', '2026-06-20 10:00:00', '2026-06-20 18:00:00', '2026-06-20 10:00:00', '2026-06-20 17:00:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W3-04', 'FM-AR71-202606-W3-04', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-20 17:00:00', NULL, NULL, NULL),
-- W4
(20514013, 'AR71-202606-W4-01', 'YBCK01', 'TMcang2', 'AR71-202606-W4-01', '2026-06-22 09:00:00', '2026-06-22 18:00:00', '2026-06-22 09:00:00', '2026-06-22 12:15:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, 72.00, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W4-01', 'FM-AR71-202606-W4-01', 'CNY', NULL, NULL, 'CNY', 11.00, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-22 12:15:00', NULL, NULL, NULL),
(20514014, 'AR71-202606-W4-02', 'YBCK01', 'TMcang2', 'AR71-202606-W4-02', '2026-06-24 09:15:00', '2026-06-24 18:00:00', '2026-06-24 09:15:00', '2026-06-24 14:20:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, 720.00, 1100.00, 'LM-AR71-202606-W4-02', 'FM-AR71-202606-W4-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-24 14:20:00', NULL, NULL, NULL),
(20514015, 'AR71-202606-W4-03', 'YBCK01', 'TMcang2', 'AR71-202606-W4-03', '2026-06-26 08:50:00', '2026-06-26 18:00:00', '2026-06-26 08:50:00', '2026-06-26 13:00:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W4-03', 'FM-AR71-202606-W4-03', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, 9.00, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-26 13:00:00', NULL, NULL, NULL),
(20514016, 'AR71-202606-W4-04', 'YBCK01', 'TMcang2', 'AR71-202606-W4-04', '2026-06-27 10:00:00', '2026-06-27 19:00:00', '2026-06-27 10:00:00', '2026-06-27 16:40:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W4-04', 'FM-AR71-202606-W4-04', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-27 16:40:00', NULL, NULL, NULL),
-- W5（06-29, 06-30）
(20514017, 'AR71-202606-W5-01', 'YBCK01', 'TMcang2', 'AR71-202606-W5-01', '2026-06-29 09:30:00', '2026-06-29 18:00:00', '2026-06-29 09:30:00', '2026-06-29 15:00:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, NULL, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, 680.00, 900.00, 'LM-AR71-202606-W5-01', 'FM-AR71-202606-W5-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 27.00, NULL, 1, NULL, NULL, NULL, '2026-06-29 15:00:00', NULL, NULL, NULL),
(20514018, 'AR71-202606-W5-02', 'YBCK01', 'TMcang2', 'AR71-202606-W5-02', '2026-06-30 10:10:00', '2026-06-30 18:00:00', '2026-06-30 10:10:00', '2026-06-30 16:30:00', 'py123-test-shop', 'TW', '中國臺灣', '800', 1, 1, 58.00, 556490224971067392, '700983', 'py123', '天马集运仓', NULL, NULL, NULL, 'LM-AR71-202606-W5-02', 'FM-AR71-202606-W5-02', 'CNY', NULL, NULL, 'CNY', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-06-30 16:30:00', NULL, NULL, NULL);

-- =========================================================
-- 3. 插入扩展表（每条主订单都必须有对应扩展行）
-- =========================================================

INSERT INTO sale_order_header_extend (
    id,
    sale_order_id,
    marketing_activity_discount_amount,
    overweight_amount,
    overlength_amount,
    overmaterial_amount,
    packing_amount,
    tail_freight_amount,
    system_service_amount,
    bms_billed_flag,
    bms_bill_no
) VALUES
(2070800000000000001, 20514001, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000002, 20514002, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000003, 20514003, NULL, NULL, NULL, NULL, 8.00, 45.00, 12.00, 0, NULL),
(2070800000000000004, 20514004, NULL, 18.00, NULL, 40.00, NULL, NULL, NULL, 0, NULL),
(2070800000000000005, 20514005, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000006, 20514006, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000007, 20514007, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000008, 20514008, 11.00, NULL, 26.00, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000009, 20514009, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000010, 20514010, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000011, 20514011, NULL, NULL, NULL, NULL, NULL, 38.00, 13.00, 0, NULL),
(2070800000000000012, 20514012, NULL, NULL, NULL, 33.00, 9.00, NULL, NULL, 0, NULL),
(2070800000000000013, 20514013, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000014, 20514014, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000015, 20514015, NULL, 17.00, NULL, 28.00, NULL, NULL, NULL, 0, NULL),
(2070800000000000016, 20514016, NULL, NULL, NULL, NULL, 10.00, 42.00, 14.00, 0, NULL),
(2070800000000000017, 20514017, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL),
(2070800000000000018, 20514018, NULL, NULL, NULL, 35.00, NULL, NULL, NULL, 0, NULL);

-- =========================================================
-- 4. 插入普通附加费
-- =========================================================
-- 说明：
-- 1. 统一设置 fee_pay_status = waiting_pay，确保命中当前代码
-- 2. 统一设置 bms_billed_flag = 0 / bms_after_bill_added_flag = 0

INSERT INTO sale_order_additional_matter (
    id,
    sale_order_id,
    matter_status,
    matter_type,
    matter_desc,
    handler,
    handle_time,
    handle_remark,
    fee_item_type,
    fee_amount,
    fee_amount_currency,
    fee_pay_status,
    creator_code,
    creator_name,
    create_time,
    shop_id,
    convert_fee_amount,
    convert_fee_amount_currency,
    country_short_code,
    bill_waybill_no,
    sub_bill_waybill_no,
    bms_billed_flag,
    bms_bill_no,
    bms_after_bill_added_flag,
    bms_paid_flag,
    bms_payment_status
) VALUES
(2069100000000000001, 20514004, 'DONE', 'CHANGE_ORDER_FEE', 'W1-超材费附加费', 'admin', '2026-06-06 18:10:00', '自动造数', '超材费', 22.00000, 'CNY', 'waiting_pay', 'admin', 'admin', '2026-06-06 18:10:00', 556490224971067392, 22.00, 'CNY', 'TW', 'FM-AR71-202606-W1-04', 'LM-AR71-202606-W1-04', 0, NULL, 0, 0, 'WAITING_PAY'),
(2069100000000000002, 20514008, 'DONE', 'CHANGE_ORDER_FEE', 'W2-超长附加费', 'admin', '2026-06-13 12:10:00', '自动造数', '超长费', 18.00000, 'TWD', 'waiting_pay', 'admin', 'admin', '2026-06-13 12:10:00', 556490224971067392, 18.00, 'TWD', 'TW', 'FM-AR71-202606-W2-04', 'LM-AR71-202606-W2-04', 0, NULL, 0, 0, 'WAITING_PAY'),
(2069100000000000003, 20514009, 'DONE', 'CHANGE_ORDER_FEE', 'W3-超重附加费', 'admin', '2026-06-15 12:30:00', '自动造数', '超重费', 16.00000, 'TWD', 'waiting_pay', 'admin', 'admin', '2026-06-15 12:30:00', 556490224971067392, 16.00, 'TWD', 'TW', 'FM-AR71-202606-W3-01', 'LM-AR71-202606-W3-01', 0, NULL, 0, 0, 'WAITING_PAY'),
(2069100000000000004, 20514010, 'DONE', 'CHANGE_ORDER_FEE', 'W3-仓租费附加费', 'admin', '2026-06-16 13:20:00', '自动造数', '仓租费', 14.00000, 'CNY', 'waiting_pay', 'admin', 'admin', '2026-06-16 13:20:00', 556490224971067392, 14.00, 'CNY', 'TW', 'FM-AR71-202606-W3-02', 'LM-AR71-202606-W3-02', 0, NULL, 0, 0, 'WAITING_PAY'),
(2069100000000000005, 20514011, 'DONE', 'CHANGE_ORDER_FEE', 'W3-报关费附加费', 'admin', '2026-06-18 12:00:00', '自动造数', '报关费', 19.00000, 'CNY', 'waiting_pay', 'admin', 'admin', '2026-06-18 12:00:00', 556490224971067392, 19.00, 'CNY', 'TW', 'FM-AR71-202606-W3-03', 'LM-AR71-202606-W3-03', 0, NULL, 0, 0, 'WAITING_PAY'),
(2069100000000000006, 20514012, 'DONE', 'CHANGE_ORDER_FEE', 'W3-缠膜费附加费', 'admin', '2026-06-20 17:10:00', '自动造数', '缠膜费', 8.00000, 'CNY', 'waiting_pay', 'admin', 'admin', '2026-06-20 17:10:00', 556490224971067392, 8.00, 'CNY', 'TW', 'FM-AR71-202606-W3-04', 'LM-AR71-202606-W3-04', 0, NULL, 0, 0, 'WAITING_PAY'),
(2069100000000000007, 20514016, 'DONE', 'CHANGE_ORDER_FEE', 'W4-超材费附加费', 'admin', '2026-06-27 16:50:00', '自动造数', '超材费', 20.00000, 'CNY', 'waiting_pay', 'admin', 'admin', '2026-06-27 16:50:00', 556490224971067392, 20.00, 'CNY', 'TW', 'FM-AR71-202606-W4-04', 'LM-AR71-202606-W4-04', 0, NULL, 0, 0, 'WAITING_PAY'),
(2069100000000000008, 20514018, 'DONE', 'CHANGE_ORDER_FEE', 'W5-报关费附加费', 'admin', '2026-06-30 16:40:00', '自动造数', '报关费', 15.00000, 'TWD', 'waiting_pay', 'admin', 'admin', '2026-06-30 16:40:00', 556490224971067392, 15.00, 'TWD', 'TW', 'FM-AR71-202606-W5-02', 'LM-AR71-202606-W5-02', 0, NULL, 0, 0, 'WAITING_PAY');

-- =========================================================
-- 5. 插入理赔数据
-- =========================================================
-- 当前代码要求：
-- status = 1
-- customer_service_audit_status = 2
-- finance_audit_status = 2
-- payment_status = 1
-- bms_billed_flag = 0
-- bms_bill_no IS NULL

INSERT INTO claim_order (
    id,
    code,
    order_code,
    user_id,
    member_code,
    member_name,
    dealer_shop_id,
    dealer_shop_name,
    claim_amount,
    currency,
    real_currency,
    real_amount,
    customer_service_audit_status,
    finance_audit_status,
    payment_status,
    status,
    claim_description,
    customer_service_description,
    finance_description,
    create_time,
    update_time,
    responsible_person,
    bms_billed_flag,
    bms_bill_no
) VALUES
(24001, 'CLM-AR71-202606-01', 'AR71-202606-W1-04', 1276270357764702208, '700983', 'py123', 556490224971067392, 'py123-test-shop', 80.00000, 2, 2, 80.00000, 2, 2, 1, 1, 'W1 理赔测试数据', '客服审核通过', '财务审核通过', '2026-06-06 18:20:00', '2026-06-06 18:25:00', 'cs-a', 0, NULL),
(24002, 'CLM-AR71-202606-02', 'AR71-202606-W3-02', 1276270357764702208, '700983', 'py123', 556490224971067392, 'py123-test-shop', 120.00000, 2, 2, 120.00000, 2, 2, 1, 1, 'W3 理赔测试数据', '客服审核通过', '财务审核通过', '2026-06-16 13:30:00', '2026-06-16 13:35:00', 'cs-b', 0, NULL),
(24003, 'CLM-AR71-202606-03', 'AR71-202606-W4-02', 1276270357764702208, '700983', 'py123', 556490224971067392, 'py123-test-shop', 66.00000, 2, 2, 66.00000, 2, 2, 1, 1, 'W4 理赔测试数据', '客服审核通过', '财务审核通过', '2026-06-24 14:30:00', '2026-06-24 14:35:00', 'cs-c', 0, NULL),
(24004, 'CLM-AR71-202606-04', 'AR71-202606-W5-02', 1276270357764702208, '700983', 'py123', 556490224971067392, 'py123-test-shop', 150.00000, 2, 2, 150.00000, 2, 2, 1, 1, 'W5 理赔测试数据', '客服审核通过', '财务审核通过', '2026-06-30 16:45:00', '2026-06-30 16:50:00', 'cs-d', 0, NULL);

COMMIT;

-- =========================================================
-- 6. 校验 SQL（执行后可手工核对）
-- =========================================================

SELECT 'header_count' AS metric, COUNT(*) AS cnt
FROM sale_order_header
WHERE member_code = '700983'
  AND shop_id = 556490224971067392
  AND order_code LIKE 'AR71-202606-%'
UNION ALL
SELECT 'extend_count' AS metric, COUNT(*) AS cnt
FROM sale_order_header_extend
WHERE sale_order_id BETWEEN 20514001 AND 20514018
UNION ALL
SELECT 'additional_count' AS metric, COUNT(*) AS cnt
FROM sale_order_additional_matter
WHERE sale_order_id BETWEEN 20514001 AND 20514018
UNION ALL
SELECT 'claim_count' AS metric, COUNT(*) AS cnt
FROM claim_order
WHERE member_code = '700983'
  AND dealer_shop_id = 556490224971067392
  AND code LIKE 'CLM-AR71-202606-%';

SELECT
    DATE(measure_time) AS measure_date,
    COUNT(*) AS order_cnt
FROM sale_order_header
WHERE member_code = '700983'
  AND shop_id = 556490224971067392
  AND order_code LIKE 'AR71-202606-%'
GROUP BY DATE(measure_time)
ORDER BY measure_date;

-- 生成账单时推荐的账期窗口：
-- W1: 2026-06-01 ~ 2026-06-07
-- W2: 2026-06-08 ~ 2026-06-14
-- W3: 2026-06-15 ~ 2026-06-21
-- W4: 2026-06-22 ~ 2026-06-28
-- W5: 2026-06-29 ~ 2026-07-05（本脚本已准备 06-29 / 06-30 的数据）
