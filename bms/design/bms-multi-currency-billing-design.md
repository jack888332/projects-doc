# BMS 多币种费项收费与按币种核销设计

## 1. 背景

集运账单存在同一张账单、同一个订单内不同费项使用不同收费币种的场景。

例如一票集运订单：

- 运费：向客户收 `10 CNY`
- 代收手续费：向客户收 `10 TWD`

这不是“统一折算成账单币种后收款”，而是客户需要分别支付 `10 CNY + 10 TWD`。因此核销也不能只针对 `ar_bill` 的单一 `bill_currency` 金额，而应该针对账单下每个收费币种的应收汇总进行核销。

核心结论：

```text
ar_bill 是账单主单。
fee_detail 是费用明细。
ar_bill_currency_summary 是账单按币种的应收、已收、未收汇总。
payment_writeoff_detail 核销到 ar_bill_currency_summary。
```

## 2. 当前代码和表结构问题

### 2.1 现有表已经具备的能力

`fee_source_rule` 已经可以从来源表读取费用金额和来源币种：

- `source_amount_column`
- `source_currency_column`
- `source_converted_amount_column`
- `source_converted_currency_column`

`fee_detail` 已经有费用原币、账单币种、财务币种字段：

- `fee_currency`
- `amount_fee_currency`
- `exchange_rate_to_bill`
- `bill_currency`
- `amount_bill_currency`
- `exchange_rate_to_fin`
- `fin_currency`
- `amount_fin_currency`

`payment_receipt` 已经有收款币种：

- `receipt_currency`
- `receipt_amount`
- `writeoff_amount`
- `unwriteoff_amount`

`payment_writeoff_detail` 已经有收款币种和账单币种核销金额：

- `receipt_currency`
- `writeoff_amount_receipt_currency`
- `bill_currency`
- `writeoff_amount_bill_currency`

### 2.2 现有缺口

当前表和代码仍然偏“整张账单一个结算币种”：

1. `bill_config.billing_currency` 是单一账单结算币种。
2. `ar_bill.bill_currency` 是单一账单结算币种。
3. `ar_bill.receivable_amount/paid_amount/unpaid_amount` 是单币种金额。
4. `BillGenerateServiceImpl.buildFeeBase` 当前把 `bill_currency` 直接设为 `billConfig.billingCurrency`。
5. `BillGenerateMapper.insertFeeDetail` 当前 `exchange_rate_to_bill`、`exchange_rate_to_fin` 写死为 `1`。
6. 当前没有定义“某个账单配置下某个费项到底按哪个币种向客户收费”。
7. 当前没有 `ar_bill_currency_summary` 表来承载多币种应收、已收、未收。
8. 核销没有明确指向某个账单币种汇总行。

因此，如果运费应收 CNY、代收手续费应收 TWD，现在系统没有稳定位置表达这个业务规则。

## 3. 核心设计原则

1. `fee_index` 只定义费项身份，不直接定义客户收费币种。
2. `fee_source_rule` 只定义从哪里取金额和来源币种，不定义客户收费币种。
3. “客户按什么币种收这个费项”属于账单配置规则，应该绑定到 `bill_config`。
4. 同一张 `ar_bill` 可以有多个收费币种。
5. 核销必须落到 `ar_bill_currency_summary` 的某个币种桶。
6. V1 不做跨币种自动抵扣。CNY 收款只核销 CNY 应收，TWD 收款只核销 TWD 应收。
7. 财务本位币金额只用于财务统计和展示，不影响客户真实应收与核销。

## 4. 账单配置如何定义费项收费币种

### 4.1 新增账单配置费项币种规则表

建议新增：

```sql
bill_config_fee_currency_rule
```

用途：

表达“这个账单配置下，这个业务场景的这个费项，向客户按什么币种收费”。

DDL 建议：

```sql
CREATE TABLE `bill_config_fee_currency_rule` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `business_type_code` varchar(64) NOT NULL COMMENT '业务类型：PEER/ECOMMERCE/CONSOLIDATION',
  `fee_index_id` bigint(20) unsigned NOT NULL COMMENT '费项ID',
  `fee_code` varchar(64) NOT NULL COMMENT '费项编码快照',
  `fee_name` varchar(128) NOT NULL COMMENT '费项名称快照',
  `charge_currency_mode` varchar(32) NOT NULL DEFAULT 'SOURCE' COMMENT '收费币种模式：SOURCE跟随来源，FIXED固定币种，CONFIG_DEFAULT使用配置默认币种',
  `charge_currency` varchar(16) DEFAULT NULL COMMENT '固定收费币种，如CNY/TWD；FIXED模式必填',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `priority` int(11) NOT NULL DEFAULT '0' COMMENT '优先级',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `created_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `updated_by` varchar(64) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_config_fee_currency` (`bill_config_id`,`business_type_code`,`fee_code`),
  KEY `idx_fee_currency_rule_fee` (`fee_code`,`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='账单配置费项收费币种规则';
```

### 4.2 收费币种模式

| 模式 | 含义 | 示例 |
| --- | --- | --- |
| `SOURCE` | 跟随来源费用币种收费 | 来源是 TWD，就收 TWD |
| `FIXED` | 固定按指定币种收费 | 运费固定收 CNY |
| `CONFIG_DEFAULT` | 使用账单配置默认币种 | 使用 `bill_config.billing_currency` |

### 4.3 典型配置示例

账单配置：`OG0271 默认配置`

| 业务场景 | 费项 | 收费币种模式 | 收费币种 |
| --- | --- | --- | --- |
| `CONSOLIDATION` | 运费 | `FIXED` | `CNY` |
| `CONSOLIDATION` | 代收手续费 | `FIXED` | `TWD` |
| `CONSOLIDATION` | COD金额 | `SOURCE` | - |

这样一票订单中出现：

| 费项 | 来源金额 | 来源币种 | 收费币种 | 客户应收 |
| --- | ---: | --- | --- | ---: |
| 运费 | 10.00 | CNY | CNY | 10.00 CNY |
| 代收手续费 | 10.00 | TWD | TWD | 10.00 TWD |

## 5. 账单按币种汇总表

### 5.1 新增 ar_bill_currency_summary

建议新增：

```sql
ar_bill_currency_summary
```

DDL 建议：

```sql
CREATE TABLE `ar_bill_currency_summary` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `bill_id` bigint(20) unsigned NOT NULL COMMENT '账单ID',
  `bill_no` varchar(64) NOT NULL COMMENT '账单编号',
  `bill_config_id` bigint(20) unsigned NOT NULL COMMENT '账单配置ID',
  `sc_id` bigint(20) NOT NULL COMMENT '供应链/组织ID',
  `shop_id` bigint(20) NOT NULL COMMENT '店铺ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `member_code` varchar(64) NOT NULL COMMENT '会员/客户编码',
  `currency` varchar(16) NOT NULL COMMENT '收费币种',
  `initial_receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '初始应收金额',
  `this_adjustment_delta_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '本期调整金额',
  `previous_adjustment_delta_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '往期调整金额',
  `late_fee_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '滞纳金',
  `receivable_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收金额',
  `paid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已收/已核销金额',
  `unpaid_amount` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '未收金额',
  `receivable_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '应收金额<财务本位币>',
  `paid_amount_fin` decimal(18,4) NOT NULL DEFAULT '0.0000' COMMENT '已收金额<财务本位币>',
  `fee_count` int(11) NOT NULL DEFAULT '0' COMMENT '费用行数',
  `order_count` int(11) NOT NULL DEFAULT '0' COMMENT '订单数',
  `summary_status` varchar(32) NOT NULL DEFAULT 'UNPAID' COMMENT '币种核销状态：UNPAID/PART_PAID/PAID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_currency_summary` (`bill_no`,`currency`),
  KEY `idx_currency_summary_bill` (`bill_id`),
  KEY `idx_currency_summary_subject` (`sc_id`,`shop_id`,`user_id`,`member_code`,`currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='应收账单币种汇总';
```

### 5.2 ar_bill 的角色调整

`ar_bill` 继续作为账单主表，保存客户、账期、状态、配置、生成任务等信息。

但金额展示要改为：

1. 单币种账单：可继续显示 `ar_bill.receivable_amount`。
2. 多币种账单：页面优先显示 `ar_bill_currency_summary`，例如：

```text
CNY 应收 10.00，已收 0.00，未收 10.00
TWD 应收 10.00，已收 0.00，未收 10.00
```

兼容策略：

- `ar_bill.bill_currency` 可以保留，作为默认币种或单币种兼容字段。
- 多币种账单可将 `ar_bill.bill_currency` 写为默认币种，页面不要依赖它判断全部应收。
- `ar_bill.receivable_amount_fin` 可作为财务本位币汇总口径。

## 6. fee_detail 字段语义调整

现有字段建议明确语义：

| 字段 | 新语义 |
| --- | --- |
| `fee_currency` | 来源费用币种 |
| `amount_fee_currency` | 来源费用金额 |
| `bill_currency` | 客户收费币种，后续可改名为 `charge_currency` |
| `amount_bill_currency` | 客户收费币种金额 |
| `fin_currency` | 财务本位币 |
| `amount_fin_currency` | 财务本位币金额 |

为了避免字段名误导，建议新增明确字段：

```sql
ALTER TABLE `fee_detail`
  ADD COLUMN `charge_currency_mode` varchar(32) DEFAULT NULL COMMENT '收费币种模式：SOURCE/FIXED/CONFIG_DEFAULT' AFTER `amount_fee_currency`,
  ADD COLUMN `charge_currency` varchar(16) DEFAULT NULL COMMENT '客户收费币种' AFTER `charge_currency_mode`,
  ADD COLUMN `amount_charge_currency` decimal(18,4) DEFAULT NULL COMMENT '费用金额<客户收费币种>' AFTER `charge_currency`;
```

兼容写法：

```text
bill_currency = charge_currency
amount_bill_currency = amount_charge_currency
```

## 7. 账单生成逻辑调整

### 7.1 当前需要改的代码点

当前重点代码：

```text
bms/biz/.../BillGenerateServiceImpl.java
bms/dao/.../BillGenerateMapper.java
```

当前问题：

1. `buildFeeBase` 直接用 `billConfig.billingCurrency` 作为 `billCurrency`。
2. `amountBillCurrency = amountFeeCurrency`。
3. `insertFeeDetail` 中汇率固定写 `1`。
4. 账单金额直接汇总 `fee_detail.amount_bill_currency` 到 `ar_bill`。

### 7.2 新生成流程

```text
读取 bill_config
  -> 读取 bill_config_fee_currency_rule
  -> 读取业务类型绑定 fee rule
  -> 拉取订单宽表和附加费
  -> 一条订单拆多条 fee_detail
  -> 每条 fee_detail 决定 charge_currency
  -> 写 fee_detail
  -> 按 bill_no + charge_currency 汇总 ar_bill_currency_summary
  -> 刷新 ar_bill 状态和财务本位币金额
```

### 7.3 收费币种决定规则

伪代码：

```java
String sourceCurrency = feeCurrency;
FeeCurrencyRule rule = findRule(billConfigId, businessTypeCode, feeCode);

if (rule == null || rule.mode == CONFIG_DEFAULT) {
    chargeCurrency = billConfig.getBillingCurrency();
} else if (rule.mode == SOURCE) {
    chargeCurrency = sourceCurrency;
} else if (rule.mode == FIXED) {
    chargeCurrency = rule.getChargeCurrency();
}
```

金额计算：

1. 如果 `sourceCurrency == chargeCurrency`：
   - `amountChargeCurrency = amountFeeCurrency`
   - `exchangeRateToBill = 1`
2. 如果 `sourceCurrency != chargeCurrency`：
   - V1 不建议自动换算客户应收，除非该费项明确配置了换算规则。
   - 如果业务要求固定收 TWD，而来源是 CNY，必须按锁定汇率换算并保存快照。
   - 没有汇率时生成任务失败，不允许静默按 1 写入。

### 7.4 ar_bill_currency_summary 汇总规则

汇总 SQL 逻辑：

```sql
SELECT
  bill_id,
  bill_no,
  bill_config_id,
  sc_id,
  shop_id,
  user_id,
  member_code,
  bill_currency AS currency,
  SUM(amount_bill_currency) AS receivable_amount,
  SUM(amount_fin_currency) AS receivable_amount_fin,
  COUNT(1) AS fee_count,
  COUNT(DISTINCT business_order_no) AS order_count
FROM fee_detail
WHERE bill_no = ?
  AND fee_status <> 'VOID'
GROUP BY bill_no, bill_currency;
```

写入 `ar_bill_currency_summary`：

- `initial_receivable_amount = SUM(amount_bill_currency)`
- `receivable_amount = initial + adjustment + late_fee`
- `paid_amount = 0`
- `unpaid_amount = receivable_amount`
- `summary_status = UNPAID`

## 8. 核销逻辑调整

### 8.1 核销对象

核销对象从：

```text
ar_bill
```

调整为：

```text
ar_bill_currency_summary
```

也就是同一张账单有 CNY 和 TWD 两个应收桶时，必须分别核销。

### 8.2 payment_writeoff_detail 增加币种汇总关联

建议增加：

```sql
ALTER TABLE `payment_writeoff_detail`
  ADD COLUMN `currency_summary_id` bigint(20) unsigned DEFAULT NULL COMMENT '账单币种汇总ID' AFTER `bill_no`,
  ADD COLUMN `settlement_currency` varchar(16) DEFAULT NULL COMMENT '本次核销的应收币种' AFTER `currency_summary_id`,
  ADD KEY `idx_writeoff_currency_summary` (`currency_summary_id`);
```

字段关系：

| 字段 | 说明 |
| --- | --- |
| `receipt_currency` | 客户实际收款币种 |
| `settlement_currency` | 本次核销的账单应收币种 |
| `bill_currency` | 兼容字段，V1 等同 `settlement_currency` |
| `writeoff_amount_bill_currency` | 核销的应收币种金额 |

### 8.3 核销规则

V1 规则：

1. `receipt_currency` 必须等于 `ar_bill_currency_summary.currency`。
2. 不允许 CNY 收款核销 TWD 应收。
3. 核销金额不能超过该币种 `unpaid_amount`。
4. 一笔收款可以核销多张账单，但必须是同一客户维度、同一收款币种。
5. 核销完成后刷新：
   - `ar_bill_currency_summary.paid_amount`
   - `ar_bill_currency_summary.unpaid_amount`
   - `ar_bill_currency_summary.summary_status`
   - `payment_receipt.writeoff_amount`
   - `payment_receipt.unwriteoff_amount`
   - `ar_bill.bill_status`

### 8.4 ar_bill 状态刷新规则

按所有币种汇总行判断：

```text
全部 currency_summary.unpaid_amount = 0 -> PAID
任意 currency_summary.paid_amount > 0 -> PART_PAID
全部 paid_amount = 0 -> CONFIRMED 或 GENERATED
```

如果账单还未复核，不允许核销。

## 9. 调账、补录、红冲的多币种规则

### 9.1 费项补录

补录费项时必须选择：

- 费项
- 金额
- 来源币种
- 收费币种模式
- 收费币种

默认从 `bill_config_fee_currency_rule` 带出收费币种。

补录成功后：

1. 写入 `fee_detail`。
2. 刷新对应 `ar_bill_currency_summary`。
3. 刷新 `ar_bill` 状态和本位币金额。

### 9.2 本期红冲

本期红冲必须继承被冲正费用的收费币种。

例如原费用：

```text
运费 +10 CNY
```

红冲生成：

```text
运费 -10 CNY
```

不允许把 CNY 费用红冲成 TWD。

### 9.3 往期红冲

往期红冲要求：

1. 被红冲订单必须属于同一个账单配置历史生成的数据。
2. 红冲金额进入当前或后续账单。
3. 红冲币种继承原费用收费币种。
4. 写入当前账单的 `ar_bill_currency_summary` 对应币种桶。

## 10. 前端页面调整

### 10.1 账单配置页

新增“费项收费币种”区域：

| 业务场景 | 费项 | 收费币种模式 | 固定币种 |
| --- | --- | --- | --- |
| 集运订单 | 运费 | 固定币种 | 人民币 |
| 集运订单 | 代收手续费 | 固定币种 | 台币 |
| 集运订单 | COD金额 | 跟随来源 | - |

保存 `bill_config` 时，同时保存 `bill_config_fee_currency_rule`。

### 10.2 应收账单列表

金额列改造：

- 单币种显示：`CNY 10.00`
- 多币种显示：`CNY 10.00 / TWD 10.00`

筛选条件增加：

- 应收币种
- 是否多币种账单

### 10.3 账单详情页

新增“币种应收汇总”区：

| 币种 | 应收 | 已收 | 未收 | 状态 |
| --- | ---: | ---: | ---: | --- |
| CNY | 10.00 | 0.00 | 10.00 | 未核销 |
| TWD | 10.00 | 0.00 | 10.00 | 未核销 |

费项汇总按：

```text
fee_code + bill_currency
```

分组，不要只按 `fee_code` 聚合。

### 10.4 核销页面

登记收款时：

1. 先选收款币种。
2. 只展示该币种下未核销的账单币种汇总行。
3. 核销分摊到 `ar_bill_currency_summary`。

## 11. 迁移与兼容策略

### 11.1 历史单币种账单

迁移脚本可按历史 `ar_bill` 生成一条汇总：

```sql
INSERT INTO ar_bill_currency_summary (...)
SELECT
  id,
  bill_no,
  bill_config_id,
  sc_id,
  shop_id,
  user_id,
  member_code,
  bill_currency,
  initial_receivable_amount,
  this_adjustment_delta_amount,
  previous_adjustment_delta_amount,
  late_fee_amount,
  receivable_amount,
  paid_amount,
  unpaid_amount,
  receivable_amount_fin,
  paid_amount_fin,
  CASE WHEN unpaid_amount = 0 THEN 'PAID'
       WHEN paid_amount > 0 THEN 'PART_PAID'
       ELSE 'UNPAID'
  END
FROM ar_bill
WHERE is_deleted = 0;
```

### 11.2 生成任务兼容

在生成逻辑完全切换前：

1. 单币种配置继续按旧逻辑可跑。
2. 新增多币种配置时必须配置 `bill_config_fee_currency_rule`。
3. 没有币种规则的费项使用 `CONFIG_DEFAULT`，即 `bill_config.billing_currency`。

## 12. 开发拆分

### 第一阶段：表结构和配置保存

1. 新增 `bill_config_fee_currency_rule`。
2. 新增 `ar_bill_currency_summary`。
3. `payment_writeoff_detail` 增加 `currency_summary_id/settlement_currency`。
4. 账单配置页面增加费项收费币种设置。

### 第二阶段：账单生成

1. `BillGenerateServiceImpl` 加载费项收费币种规则。
2. `buildFeeBase` 根据规则决定 `bill_currency/amount_bill_currency`。
3. 生成后写入 `ar_bill_currency_summary`。
4. `ar_bill` 金额字段作为兼容和本位币统计使用。

### 第三阶段：账单详情和列表

1. 账单列表展示多币种应收、已收、未收。
2. 账单详情展示币种汇总。
3. 费项汇总按费项+币种分组。

### 第四阶段：核销

1. 登记收款按币种选择可核销账单。
2. 核销落到 `ar_bill_currency_summary`。
3. 反核销同步回退币种汇总。
4. 状态按所有币种汇总行刷新。

## 13. 需要修改的核心代码清单

后端：

- `BillConfigServiceImpl`：保存/查询费项收费币种规则。
- `BillGenerateServiceImpl`：生成 `fee_detail` 时决定收费币种，生成币种汇总。
- `BillGenerateMapper`：新增查询规则、插入/刷新币种汇总 SQL。
- `ArBillMapper`：账单列表、详情、核销查询改为读取币种汇总。
- `ArBillServiceImpl`：登记收款、反核销按 `ar_bill_currency_summary` 更新。
- BMS client/model DTO：增加币种汇总 DTO、费项币种规则 DTO。
- platform-admin：透传新增接口字段。

前端：

- `admin_front/src/views/billing/billConfig`：费项收费币种配置。
- `admin_front/src/views/billing/receivableBill`：多币种列表、详情、登记收款。
- `admin_front/src/views/billing/paymentWriteoff`：按币种核销流水和汇总。

