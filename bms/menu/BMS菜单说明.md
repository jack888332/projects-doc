# BMS 菜单说明

## 菜单归属

BMS 页面统一放在 `admin_front`，不在 `super_admin_front` 开发业务页面。

入口建议放在：

`费用中心 -> 客户账单`

当前 `admin_front` 对 `客户账单` 菜单做了本地兜底入口，菜单中心未配置时也可以从侧边栏打开 BMS 页面。

## 菜单清单

| 菜单名称 | 前端路由 | 路由 name | 建议菜单 code | 页面文件 | 主要接口前缀 |
| --- | --- | --- | --- | --- | --- |
| 应收账单 | `/billing/receivableBill` | `ReceivableBill` | `ReceivableBill` | `admin_front/src/views/billing/receivableBill/index.vue` | `/portal/bms/arBill` |
| 账单配置 | `/billing/billConfig` | `BmsBillConfig` | `member_billconfig` | `admin_front/src/views/billing/billConfig/index.vue` | `/portal/bms/billConfig` |
| 账单核销 | `/billing/paymentWriteoff` | `PaymentWriteoff` | `PaymentWriteoff` 或 `BillPaymentWriteoff` | `admin_front/src/views/billing/paymentWriteoff/index.vue` | `/portal/bms/arBill/payment` |
| 账单生成任务 | `/billing/billGenerateTask` | `BmsBillGenerateTask` | `bill_generate_task` | `admin_front/src/views/billing/billGenerateTask/index.vue` | `/portal/bms/billGenerateTask` |
| BMS费项管理 | `/billing/feeItem` | `BmsFeeItem` | `bms_fee_item` | `admin_front/src/views/billing/feeItem/index.vue` | `/portal/bms/feeIndex` |
| BMS数据源规则 | `/billing/feeSourceDataset` | `BmsFeeSourceDataset` | `bms_fee_source_dataset` | `admin_front/src/views/billing/feeItem/index.vue` | `/portal/bms/feeIndex/dataset` |
| BMS币种模板 | `/billing/feeCurrencyTemplate` | `BmsFeeCurrencyTemplate` | `bms_fee_currency_template` | `admin_front/src/views/billing/feeItem/index.vue` | `/portal/bms/feeIndex/template` |

## 菜单中心配置建议

如果走菜单中心动态配置，建议按下面结构维护：

| 上级菜单 | 菜单名称 | code | 路由/打开地址 | 是否 iframe | 说明 |
| --- | --- | --- | --- | --- | --- |
| 费用中心 | 客户账单 | `customer_bill` | - | 否 | BMS 菜单分组 |
| 客户账单 | 应收账单 | `ReceivableBill` | `/billing/receivableBill` | 否 | 应收账单列表、详情、复核、发送、登记收款 |
| 客户账单 | 账单配置 | `member_billconfig` | `/billing/billConfig` | 否 | 客户默认/分支账单配置 |
| 客户账单 | 账单核销 | `PaymentWriteoff` | `/billing/paymentWriteoff` | 否 | 核销流水查询、反核销 |
| 客户账单 | 生成任务 | `bill_generate_task` | `/billing/billGenerateTask` | 否 | 账单生成任务流水和配置维度监控 |
| 客户账单 | 费项管理 | `bms_fee_item` | `/billing/feeItem` | 否 | fee_index 和业务场景费项对应管理 |
| 客户账单 | 数据源规则 | `bms_fee_source_dataset` | `/billing/feeSourceDataset` | 否 | 维护 fee_source_dataset，定义来源库表、联表关系、核重/签收/增量时间口径 |
| 客户账单 | 币种模板 | `bms_fee_currency_template` | `/billing/feeCurrencyTemplate` | 否 | 维护目的国费项收费币种模板，支持目的国别名、模板规则和币种映射 |

## 侧边栏本地兜底规则

文件：

`admin_front/src/layout/components/Sidebar/SiderPopup.vue`

当一级菜单名称为 `客户账单` 时，会本地显示以下按钮：

- `应收账单` -> `/billing/receivableBill`
- `账单配置` -> `/billing/billConfig`
- `账单核销` -> `/billing/paymentWriteoff`
- `生成任务` -> `/billing/billGenerateTask`
- `费项管理` -> `/billing/feeItem`
- `数据源规则` -> `/billing/feeSourceDataset`
- `币种模板` -> `/billing/feeCurrencyTemplate`

同时，如果菜单中心返回的是 iframe 形式菜单，前端会识别以下 code/名称并改为打开本地路由：

| 识别目标 | 支持 code / label |
| --- | --- |
| 应收账单 | `ReceivableBill`、`应收账单` |
| 账单核销 | `PaymentWriteoff`、`BillPaymentWriteoff`、`账单核销`、`核销列表` |
| 账单生成任务 | `BillGenerateTask`、`BmsBillGenerateTask`、`bill_generate_task`、`账单生成任务`、`生成任务` |
| BMS费项管理 | `BmsFeeItem`、`bms_fee_item`、`BMS费项管理`、`费项管理` |
| BMS数据源规则 | `BmsFeeSourceDataset`、`bms_fee_source_dataset`、`BMS数据源规则`、`数据源规则`、`费项数据源` |
| BMS币种模板 | `BmsFeeCurrencyTemplate`、`bms_fee_currency_template`、`BMS币种模板`、`币种模板`、`收费币种模板` |

## 费项管理相关菜单拆分

为了避免费项和来源数据集混在一起，BMS 费项相关菜单按职责拆成两个入口：

| 菜单 | 页面默认页签 | 说明 |
| --- | --- | --- |
| 费项管理 | 费项索引 | 维护 `fee_index`、业务场景费项对应、费项取值规则 |
| 数据源规则 | 数据源规则 | 维护 `fee_source_dataset`，把 `sale_order_header + sale_order_header_extend` 这类联表关系和核重/签收/增量时间字段沉到公共数据集配置 |

## 接口链路

BMS 页面请求链路：

`admin_front -> platform-admin -> bms`

本地调试时：

- `admin_front`: `http://localhost:9528`
- `platform-admin`: `http://localhost:8896`
- `bms`: `http://localhost:8908`

示例：

`admin_front` 请求 `/portal/bms/feeIndex/page`，由 `platform-admin` 转发到 `bms` 的 `/api/bms/fee-index/page`。

## 新增菜单后的检查项

1. `admin_front/src/router/billing.js` 已有对应路由。
2. `admin_front/src/api/billing.js` 已有对应接口配置。
3. `platform-admin` 已有 `/portal/bms/...` 代理 Controller。
4. `bms` 已有 `/api/bms/...` 内部 Controller。
5. 菜单中心 code 和本地识别 code 保持一致，避免打开 iframe 空白页。
6. BMS 页面只放 `admin_front`，不要同步到 `super_admin_front`。
