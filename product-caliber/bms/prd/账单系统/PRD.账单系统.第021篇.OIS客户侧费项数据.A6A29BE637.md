# 第021篇

> 本篇定位：OIS客户侧费项数据；主要内容：客户侧费项的 OIS 数据源；文档角色：字典或参考库；文档ID：A6A29BE637

<a id="doc-A6A29BE637-ois-fee-data-ad5529f1"></a>
## 1. 客户侧费项的 OIS 数据源

本节记录应收账单和返款账单涉及的客户侧费用在 OIS 中的现状，包括存储结构、来源表、关联字段、金额与币种字段、时间与支付字段以及两类附加费导入形成的数据差异。

成本费项不在本节范围内，其来源和导入方式见<a href="../../../长篇单档PRD/PRD.成本中心.md">《成本中心 PRD》5. 成本费项标准化与供应商账单导入</a>。客户侧费项的业务对象层级见[核心对象关系](PRD.账单系统.第003篇.业务系统基本面.A231A39E11.md#doc-A231A39E11-business-baseline-c84fb3e2)。

<a id="doc-A6A29BE637-ois-fee-data-160f3004"></a>
### 1.1 OIS 怎样存放费用数据？

OIS 保存费用时存在三种数据结构：

1. `费项横表`：同一条业务记录通过多个金额字段保存不同费项。费项名称由金额字段决定，例如`freight`表示运费、`warehouse_rental_amount`表示仓租费。
2. `费项纵表`：一条记录只表达一项费用或一项费用事件，费项名称、金额和币种保存在该记录中。同一业务对象发生多项费用时，通过增加多条记录而非增加新的金额字段表达。
3. `多行横字段混合结构`：同一业务订单可以对应多条明细记录，每条明细记录中又包含多个固定金额字段。

<a id="doc-A6A29BE637-ois-fee-data-2cde7fd4"></a>
### 1.2 各来源表怎样保存并关联业务对象？

OIS 的费用数据主要分布在以下六张表中，OIS 集运单在 BMS 中按`业务订单`理解。完整对象层级见[核心对象关系](PRD.账单系统.第003篇.业务系统基本面.A231A39E11.md#doc-A231A39E11-business-baseline-c84fb3e2)，账单中的费项挂靠规则见[核心设计思路](PRD.账单系统.第011篇.应收账单.88A604AED3.md#doc-88A604AED3-receivable-bill-2a64a5e1)。

| 来源表 | 存储方式 | 一条记录表示什么 | 关联字段 | 关联对象 | 补充说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ofp_ofdb1.sale_order_header` | 费项横表 | 一笔业务订单；同一行包含多个订单级金额字段 | `id`、`order_code` | 业务订单 | 保存业务订单主体及部分金额字段；`order_type = "BILL"`的记录为虚拟业务订单。 |
| `ofp_ofdb1.sale_order_header_extend` | 费项横表 | 一笔业务订单的扩展信息；同一行包含多个扩展金额字段 | `sale_order_id` | 业务订单 | `sale_order_id`关联`sale_order_header.id`，并保存订单完结时间等扩展事实。 |
| `ofp_ofdb1.sale_order_package_fee` | 多行横字段混合结构 | 一个费用方向下的一笔尾程包裹费用明细；同一业务订单可以对应多条包裹级记录 | `sale_order_id`、`tail_way_bill_no` | 尾程包裹 | 订单费项报表导入后形成的包裹级明细，直接保存包裹级回款金额；`sale_order_id`关联`sale_order_header.id`。主键为`id`，唯一索引为`type + sale_order_id + tail_way_bill_no`，同一尾程包裹可以分别存在应收行和成本行。 |
| `ofp_ofdb1.sale_order_fee_detail` | 多行横字段混合结构 | 一笔订单费用明细；同一业务订单可以对应多条记录，每条记录仍包含多个金额字段 | `sale_order_id` | 业务订单 | 同一业务订单可以存在多条独立的费用明细记录。 |
| `ofp_ofdb1.sale_order_additional_matter` | 费项纵表 | 一项附加事项；同一业务订单可以对应多条记录 | `sale_order_id`、`bill_waybill_no`、`sub_bill_waybill_no` | 业务订单或尾程包裹 | `sale_order_id`关联业务订单，收款运单号和子运单号记录附加费涉及的尾程运单；两种导入入口的差异见[同一张附加事项表，为什么要区分两种导入？](#doc-A6A29BE637-ois-fee-data-a254f9b7)。 |
| `ofp_ofdb1.claim_order` | 业务事件纵表 | 一笔理赔；同一订单编号可以对应多条记录 | `order_code` | 业务订单 | 同一业务订单可以存在多条独立的理赔记录。 |

`ofp_ofdb1.sale_order_package_fee.type`和`ofp_ofdb1.sale_order_fee_detail.type`采用相同口径：`1`表示应收，`2`表示成本。客户侧费项使用应收数据，成本数据由成本中心处理；其它值没有已定义的业务含义。

订单费项报表导入的数据先按尾程包裹粒度写入`ofp_ofdb1.sale_order_package_fee`，再汇总为业务订单粒度的`ofp_ofdb1.sale_order_fee_detail`。前者保留包裹级回款明细，后者承接订单级汇总；两张表不得被理解为两份彼此独立的回款来源。

订单主表和订单扩展表中的金额在订单出库前仍可能变化，金额稳定过程见[费项重算窗口](PRD.账单系统.第003篇.业务系统基本面.A231A39E11.md#doc-A231A39E11-business-baseline-c9cdf277)。附加事项和理赔以新增记录表达新增业务事实，不在订单原记录中继续增加金额字段。

<a id="doc-A6A29BE637-ois-fee-data-cce16964"></a>
### 1.3 BMS 归集费项时使用哪些非金额字段？

下表只列 BMS 归集 OIS 费用时正式使用的非金额字段，包括用于判断来源数据能否进入本次范围的过滤字段，以及写入`BMS费项池`后仍需保留的采集字段。同一字段可以同时用于过滤和采集；某张来源表不涉及的分组以`--`表示。金额字段见[OIS 有哪些客户侧费用字段？](#doc-A6A29BE637-ois-fee-data-b7b2c0fa)，订单或包裹关联字段见[各来源表怎样保存并关联业务对象？](#doc-A6A29BE637-ois-fee-data-2cde7fd4)，均不在本表重复列示。

| 来源表 | 归属范围 | 费项识别 | 扫描时间 | 业务状态 | 支付信息 | 金额币种 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ofp_ofdb1.sale_order_header` | `member_code`<br>`shop_id`<br>`sc_id`<br>`order_type`<br>`country_code`<br>`dest_warehouse_code`<br>`warehouse_code` | -- | `delivery_time` | -- | -- | `currency`<br>`dest_country_currency_code` |
| `ofp_ofdb1.sale_order_header_extend` | -- | -- | `order_completed_time` | -- | -- | -- |
| `ofp_ofdb1.sale_order_package_fee` | -- | `type` | `create_time` | -- | -- | -- |
| `ofp_ofdb1.sale_order_additional_matter` | -- | `fee_item_type` | `create_time` | -- | `payment_method`<br>`fee_pay_status` | `fee_amount_currency` |
| `ofp_ofdb1.claim_order` | `member_code`<br>`user_id`<br>`dealer_shop_id` | -- | `create_time` | `status`<br>`customer_service_audit_status`<br>`finance_audit_status` | `payment_status` | `currency`<br>`real_currency` |

字段使用口径如下：

1. `归属范围`：匹配任务锁定的客户、店铺和供应链，以及账单配置中的业务场景、运抵国和仓库。`order_type = "BILL"`表示虚拟业务订单。
2. `费项识别`：`sale_order_package_fee.type`用于区分费用方向，`1`表示应收，`2`表示成本；BMS 归集客户侧费项时只采集`type = 1`的记录。`sale_order_additional_matter.fee_item_type`用于匹配启用中的客户侧费项及场景取值规则。
3. `时间字段`：业务订单的`delivery_time`记录出库时间，`order_completed_time`记录订单完结时间。`sale_order_package_fee`本身不保存这两个履约时间，可通过`sale_order_id`关联业务订单取得；`sale_order_additional_matter`保存附加事项自身的`create_time`，挂靠真实尾程包裹时还可以沿业务订单关系取得上述履约时间；理赔记录具有`update_time`。
4. `业务状态`：理赔记录只归集有效且已通过客服、财务审核的数据。
5. `支付信息`：`payment_method`记录附加费的`收取方式`，是应收归集的必要过滤字段；只有其值表示`账期支付`时，该附加费才进入应收归集范围。`fee_pay_status`和理赔记录的`payment_status`用于排除已经完成支付处理的数据，并随来源记录保留以供追溯。
6. `金额币种`：`currency`和`currency_code`记录来源订单现有币种信息，`dest_country_currency_code`记录目的国币种。币种字段与来源金额一并采集并保留原值，不参与账期范围判断；来源未明确币种时的默认规则见[系统从哪里取金额和币种？](PRD.账单系统.第009篇.来源范围与费项池.C986F40642.md#doc-C986F40642-fee-source-3859a98f)，换算规则见[金额汇兑](PRD.账单系统.第014篇.金额汇兑.27B80EF314.md#doc-27B80EF314-currency-exchange-e7e21dd6)。

<a id="doc-A6A29BE637-ois-fee-data-b7b2c0fa"></a>
### 1.4 OIS 有哪些客户侧费用字段？

下表统一记录 OIS 当前存在的客户侧费用字段及其财务名称、账单挂靠对象、费项类型、是否由系统计算、最早形成阶段和 BMS 原始币种或汇率口径。费项类型由费项索引定义，见[费项索引怎样定义费项类型？](PRD.账单系统.第009篇.来源范围与费项池.C986F40642.md#doc-C986F40642-fee-source-798b26a1)；挂靠对象边界见[核心设计思路](PRD.账单系统.第011篇.应收账单.88A604AED3.md#doc-88A604AED3-receivable-bill-2a64a5e1)。附加事项行按`附加费用报表导入`的现有数据关系列示。

<style>
.fee-source-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 1320px;
}
.fee-source-table th {
  background-color: #000000;
  color: #ffffff;
  border: 1px solid #666666;
  padding: 4px 6px;
  text-align: left;
}
.fee-source-table td {
  border: 1px solid #999999;
  padding: 3px 6px;
}
.fee-source-table .source-extend { background-color: #f4cccc; }
.fee-source-table .source-header { background-color: #d9ead3; }
.fee-source-table .source-package-fee { background-color: #d9eaf7; }
.fee-source-table .source-claim { background-color: #fff2cc; }
.fee-source-table .source-additional { background-color: #ffffff; }
</style>
<div style="overflow-x: auto;">
<table class="fee-source-table">
  <thead>
    <tr>
      <th>OIS 字段或筛选条件</th>
      <th>费项名称</th>
      <th>挂靠对象</th>
      <th>费项类型</th>
      <th>是否机算费项</th>
      <th>最早产生时刻</th>
      <th>币种</th>
    </tr>
  </thead>
  <tbody>
    <tr class="source-extend"><td><code>ofp_ofdb1.sale_order_header_extend.tail_freight_amount</code></td><td>派送费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>业务订单完成核重</td><td>店铺币种</td></tr>
    <tr class="source-extend"><td><code>ofp_ofdb1.sale_order_header_extend.system_service_amount</code></td><td>系统服务费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>业务订单完成核重</td><td>店铺币种</td></tr>
    <tr class="source-extend"><td><code>ofp_ofdb1.sale_order_header_extend.packing_amount</code></td><td>打包费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>业务订单完成核重</td><td>店铺币种</td></tr>
    <tr class="source-extend"><td><code>ofp_ofdb1.sale_order_header_extend.overweight_amount</code></td><td>超重费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>业务订单完成核重</td><td>店铺币种</td></tr>
    <tr class="source-extend"><td><code>ofp_ofdb1.sale_order_header_extend.overmaterial_amount</code></td><td>超材费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>业务订单完成核重</td><td>店铺币种</td></tr>
    <tr class="source-extend"><td><code>ofp_ofdb1.sale_order_header_extend.overlength_amount</code></td><td>超长费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>业务订单完成核重</td><td>店铺币种</td></tr>
    <tr class="source-extend"><td><code>ofp_ofdb1.sale_order_header_extend.marketing_activity_discount_amount</code></td><td>满减活动优惠金额</td><td>业务订单</td><td>应收扣减类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.weight_charge_amount</code></td><td>超重费</td><td>业务订单</td><td>应收类</td><td><code>否</code></td><td>--</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.warehouse_rental_amount</code></td><td>仓租费用</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.user_coupon_fee</code></td><td>优惠券优惠金额</td><td>业务订单</td><td>应收扣减类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.tax_premium_amount</code></td><td>包税手续费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.material_charge_amount</code></td><td>包材费</td><td>业务订单</td><td>应收类</td><td><code>否</code></td><td>--</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.length_charge_amount</code></td><td>超长费</td><td>业务订单</td><td>应收类</td><td><code>否</code></td><td>--</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.integral_fee</code></td><td>积分优惠金额</td><td>业务订单</td><td>应收扣减类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.insurance_amount</code></td><td>保险金额</td><td>业务订单</td><td>应收类</td><td><code>否</code></td><td>--</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.freight</code></td><td>运费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.forwarding_charge_amount</code></td><td>转运费用</td><td>业务订单</td><td>应收类</td><td><code>否</code></td><td>--</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.dest_division_amount</code></td><td>偏远地区费用</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.compensation_price</code></td><td>保价金额</td><td>业务订单</td><td>应收类</td><td><code>否</code></td><td>--</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.compensation_premium_amount</code></td><td>保价手续费</td><td>业务订单</td><td>应收类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.advance_amount</code></td><td>垫付金额</td><td>业务订单</td><td>代付类</td><td><code>是</code></td><td>下单核价</td><td>店铺币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.cod_price</code></td><td>到付金额</td><td>业务订单</td><td>非费项</td><td><code>是</code></td><td>下单核价</td><td>目的国币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.cod_amount</code></td><td>货到付款手续费</td><td>业务订单</td><td>非费项</td><td><code>是</code></td><td>下单核价</td><td>目的国币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.dest_country_surcharge_amount</code></td><td>到付附加费总额</td><td>业务订单</td><td>非费项</td><td><code>是</code></td><td>--</td><td>目的国币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.collection_price</code></td><td>代收货款</td><td>业务订单</td><td>代收类</td><td><code>否</code></td><td>--</td><td>目的国币种</td></tr>
    <tr class="source-header"><td><code>ofp_ofdb1.sale_order_header.collection_premium_amount</code></td><td>代收货款手续费</td><td>业务订单</td><td>应收类</td><td><code>否</code></td><td>--</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.collection</code></td><td>历史实付返款</td><td>尾程包裹</td><td>非费项</td><td><code>否</code></td><td>历史订单费用报表导入（停止新增）</td><td>只保留存量原记录；不再展示，也不作为返款账单币种、汇率或金额计算依据</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.recovery_money</code></td><td>实收回款</td><td>尾程包裹</td><td>非费项</td><td><code>否</code></td><td>订单费项报表导入</td><td>原始口径为目的国币种；有回款汇率时，导入结果为财务本位币</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.receivable_collection_amount</code></td><td>代收货款手续费（包裹导入值）</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.payment_collect</code></td><td>回款汇率</td><td>尾程包裹</td><td>非费项</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种兑财务本位币</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.resend_fee</code></td><td>重出费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.receivable_freight</code></td><td>运费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.receivable_delivery_fee</code></td><td>派送费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.additional_fee</code></td><td>仓租费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>店铺币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.air_fee</code></td><td>航空费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>店铺币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.customs_clearance</code></td><td>清关费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.remote_fee</code></td><td>偏远费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.should_amount</code></td><td>应付手续费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.receivable6</code></td><td>费用6</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-package-fee"><td><code>ofp_ofdb1.sale_order_package_fee.receivable7</code></td><td>费用7</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>订单费项报表导入</td><td>目的国币种</td></tr>
    <tr class="source-claim"><td><code>ofp_ofdb1.claim_order.claim_amount</code></td><td>理赔费</td><td>业务订单</td><td>应收扣减类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="超材费"</code></td><td>超材费</td><td>尾程包裹</td><td>应收类</td><td><code>可能</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="转板费"</code></td><td>转板费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="退运费"</code></td><td>退运费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="税金"</code></td><td>税金</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="税费"</code></td><td>税费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="木架费"</code></td><td>木架费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="加收地址附加费"</code></td><td>加收地址附加费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="加固包装费"</code></td><td>加固包装费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="国内转寄"</code></td><td>国内转寄</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="国内到付"</code></td><td>国内到付</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="改单费"</code></td><td>改单费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="分单费"</code></td><td>分单费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="罚款"</code></td><td>罚款</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="店取费"</code></td><td>店取费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="代客收台币"</code></td><td>代客收台币</td><td>尾程包裹</td><td>代收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="代客付台币"</code></td><td>代客付台币</td><td>尾程包裹</td><td>代付类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="超重费"</code></td><td>超重费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="超长费"</code></td><td>超长费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="超材手续费"</code></td><td>超材手续费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="缠膜费"</code></td><td>缠膜费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="仓租费"</code></td><td>仓租费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="报关费"</code></td><td>报关费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="派送费"</code></td><td>派送费</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
    <tr class="source-additional"><td><code>ofp_ofdb1.sale_order_additional_matter where fee_item_type="其他"</code></td><td>其他</td><td>尾程包裹</td><td>应收类</td><td><code>否</code></td><td>--</td><td>录入币种</td></tr>
  </tbody>
</table>
</div>

字段说明：

1. `是否为机算费项`为`是`，表示当前存在明确的系统计算或汇总过程；为`否`，表示当前没有明确的系统计算过程，数据来自历史兼容字段、人工登记、后置录入或外部导入；为`可能`，表示同名费项在不同业务场景下可能属于机算费项，也可能由人工登记或外部导入产生。
2. `最早形成阶段`为`--`，表示当前没有统一、明确的形成阶段；`下单核价`早于`业务订单完成核重`，后者发生在尾程包裹完成核重并回填费用之后。
3. 订单主表和订单扩展表中存在名称相同或相近的费项字段。
4. 表中订单费项报表字段按包裹级来源`sale_order_package_fee`列示；`sale_order_fee_detail`保存由包裹明细形成的业务订单级汇总，不在表中重复展开。`collection`、`recovery_money`和`payment_collect`属于返款、回款或汇率核对事实，不是普通应收费项；`payment_collect`当前保存订单费用报表导入的回款汇率，历史返款汇率仅作为存量原记录保留，不再依赖`sale_order_package_fee.type`区分返款汇率和回款汇率。
5. 附加事项通过`fee_item_type`区分费项；上表所列附加费按`附加费用报表导入`口径挂靠尾程包裹。两种导入入口的差异见[同一张附加事项表，为什么要区分两种导入？](#doc-A6A29BE637-ois-fee-data-a254f9b7)。
6. `代收货款`和`应返货款`属于代收类资金，用于返款账单、回款管理或对账；`cod_price`、`dest_country_surcharge_amount`和`实收回款`属于非费项核对事实。`dest_country_surcharge_amount`是订单侧到付附加费总额，不进入客户应收账单。费项类型和账单用途见[费项索引怎样定义费项类型？](PRD.账单系统.第009篇.来源范围与费项池.C986F40642.md#doc-C986F40642-fee-source-798b26a1)。
7. `录入币种`表示优先采用来源数据中随金额录入的币种；录入币种为空时，使用来源订单所属店铺的店铺币种兜底。店铺币种通常配置为人民币，但必须以实际店铺配置为准。完整规则见[系统从哪里取金额和币种？](PRD.账单系统.第009篇.来源范围与费项池.C986F40642.md#doc-C986F40642-fee-source-3859a98f)。
8. 目的国币种优先读取`ofp_ofdb1.sale_order_header.dest_country_currency_code`，为空时再按运抵国匹配运抵国配置。该规则只确定 BMS 原始币种，不改变费项类型和账单归属：到付附加费仍不进入客户应收账单，只有`收取方式`为`账期支付`的附加费才进入应收归集范围。
9. 订单费用报表导入的普通费项金额都必须确定原始币种；其中`仓租费`和`航空费`固定为人民币，其它普通费项金额采用目的国币种。后续订单费用报表只导入`实收回款`和`回款汇率`，不再导入`实付返款`和`返款汇率`。系统不再依赖`ofp_ofdb1.sale_order_package_fee.type`区分返款汇率和回款汇率，`payment_collect`当前导入值统一按回款汇率处理。当前回款汇率表示`目的国币种 → 财务本位币`；返款账单所用返款汇率由货款原始币种和货款结算币种确定，见[返款账单换算总则](PRD.账单系统.第014篇.金额汇兑.27B80EF314.md#doc-27B80EF314-currency-exchange-83e6bbc9)。
10. 表中币种是`费项原始币种`，不是客户账单的`费项结算币种`。进入账单后的换算按[金额汇兑](PRD.账单系统.第014篇.金额汇兑.27B80EF314.md#doc-27B80EF314-currency-exchange-e7e21dd6)执行；系统不得因账单结算币种不同而改写来源数据的原始币种。

<a id="doc-A6A29BE637-ois-fee-data-a254f9b7"></a>
### 1.5 同一张附加事项表，为什么要区分两种导入？

`附加费用报表导入`和`记账单导入`产生的记录都写入`ofp_ofdb1.sale_order_additional_matter`，但两类费用归属不同的业务对象，可取得的履约时间事实也不同。

| 导入入口 | 记录什么费用 | 当前挂靠对象 | 可用的时间事实 |
| :--- | :--- | :--- | :--- |
| `附加费用报表导入` | 归属于真实尾程包裹的附加费 | 真实业务订单下由尾程运单号对应的尾程包裹 | 附加事项记录具有`create_time`；还可以沿包裹归属读取真实业务订单的出库时间或订单完结时间。 |
| `记账单导入` | 直接向客户收取、但不归属于真实业务订单的附加费 | `ofp_ofdb1.sale_order_header.order_type = "BILL"`的虚拟业务订单 | 虚拟业务订单没有出库或完结时间；附加事项记录自身具有`create_time`。 |

`ofp_ofdb1.sale_order_header.order_type = "BILL"`用于标记虚拟业务订单。虚拟业务订单只承载来源和客户归属，不代表客户真实下单，也不发生核价、核重、出库、运输或签收。两类附加费如何进入任务处理范围、如何入池和防重，分别见[第三步：哪些来源数据可以由本次任务处理？](PRD.账单系统.第009篇.来源范围与费项池.C986F40642.md#doc-C986F40642-fee-source-07045de3)、[费用达到什么条件才能入池？](PRD.账单系统.第009篇.来源范围与费项池.C986F40642.md#doc-C986F40642-fee-source-a23a7c51)和[怎样防止重复，并查清每笔费用的来源？](PRD.账单系统.第009篇.来源范围与费项池.C986F40642.md#doc-C986F40642-fee-source-16ab4787)。

<a id="doc-A6A29BE637-ois-fee-data-a5752663"></a>
### 1.6 返款账单怎样理解订单侧和包裹侧字段？

返款相关金额同时存在于OIS输出的订单级机算结果和订单费用报表导入形成的包裹级金额中。OIS机算形成的`应付返款`及其手续费直接下挂业务订单，BMS只读取结果；`ofp_ofdb1.sale_order_package_fee`中的所有金额均为尾程包裹级导入值，不是OIS机算值。包裹侧只导入新的实收回款、回款汇率和包裹级手续费等事实；历史实付返款和返款汇率只保留存量原记录。

| 来源字段 | 当前业务含义 | 返款账单用途 |
| :--- | :--- | :--- |
| `ofp_ofdb1.sale_order_header.collection_price` | 订单侧代收货款本金 | OIS输出并直接挂靠业务订单；BMS读取后作为订单级`应付返款`的来源。 |
| `ofp_ofdb1.sale_order_header.collection_premium_amount` | 订单侧代收货款手续费 | 用于核对业务订单级手续费结果；命中返款扣减配置时按业务订单计入一次。 |
| `ofp_ofdb1.sale_order_header.cod_price` | 收件人侧 COD 到付总额 | 用于核对到付总额；该金额可能同时包含代收货款本金和到付附加费，不等于`应付返款（即代收货款）`。 |
| `ofp_ofdb1.sale_order_header.cod_amount` | 历史字段中文名为`货到付款手续费` | 不得仅凭字段名直接认定为手续费；必须结合具体订单和包裹侧事实判断。 |
| `ofp_ofdb1.sale_order_header.dest_country_surcharge_amount` | 订单侧到付附加费总额 | 用于核对到付附加费并从到付总额中扣除，确定应付返款本金；不作为客户应收费用进入应收账单。 |
| `ofp_ofdb1.sale_order_package_fee.collection` | 历史包裹侧实付返款 | 停止新增导入；存量只保留原记录，不再展示，也不参与返款账单计算或核销。 |
| `ofp_ofdb1.sale_order_package_fee.recovery_money` | 包裹侧导入的实收回款 | 直接作为`实收回款`来源；回款返款模式下，用于判断是否已回款并核对回款金额。 |
| `ofp_ofdb1.sale_order_package_fee.receivable_collection_amount` | 包裹侧导入的代收货款手续费 | 直接挂靠对应尾程包裹，是导入费项而非机算结果；与业务订单级机算手续费同时存在时，按各自挂靠层级分别归集。 |
| `ofp_ofdb1.sale_order_package_fee.payment_collect` | 包裹侧导入的回款汇率 | 来源口径为`目的国币种 → 财务本位币`；直接作为回款汇率来源，账单生成时随任务或账单快照固化，不由系统按金额关系自动生成或覆盖。 |

字段使用规则如下：

1. 到付总额、代收货款本金、实际回款和实际返款必须分开保存和展示，不得因数值相同而合并为一个金额口径。
2. 当订单侧 `cod_price` 大于 `collection_price` 时，差额只能表示到付总额中存在非货款本金部分；不得在缺少费项明细时自动把差额认定为某一种手续费。
3. 当历史字段的中文名与实际数据表现不一致时，以可追溯的业务事实和包裹侧导入结果为准，不得按字段名直接生成扣减金额。
4. 同时存在业务订单级机算手续费和尾程包裹级导入手续费时，不做额外冲突判断、覆盖或合并；两者按各自挂靠层级分别归集，并分别保留形成方式、来源字段和挂靠对象。
5. `实收回款`和`回款汇率`继续作为包裹级回款事实导入，不属于客户应付费用，不得直接进入应收账单核销金额。历史`实付返款`和`返款汇率`只保留存量原记录，不参与返款账单的结算币种、返款汇率、金额计算或核销。系统不再依赖`ofp_ofdb1.sale_order_package_fee.type`区分返款汇率和回款汇率。
6. 返款账单详情须保留业务订单号、尾程运单号、当前采用的返款计算来源字段、来源金额、来源币种和最终账单计算金额，便于财务追溯返款计算结果；包裹级回款事实只在回款管理展示，不进入返款账单详情。

已有数据核对表明，订单侧字段名不能独立决定业务含义。例如订单`1051651926`中，`cod_price = 608`、`collection_price = 505`，而`cod_amount = 505`。该结果只能证明到付总额与代收货款本金存在差额，并且`cod_amount`不能按字段中文名直接作为`505`的手续费扣减；差额和手续费归属仍须回到包裹侧导入事实及费项明细判断。
