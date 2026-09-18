# 税金管理与财务结算流程

<a id="mainflow-08"></a>

本文定义税金管理（应付税金付款、应收税金核销、税金余额管理、税金充值）与财务结算（应付、应收、报价计费）流程。应收税金核销衔接财务应收，应付税金付款衔接结算应付，报价计费是应付、应收费用的上游。


## 一、税金管理

### 1. 应付税金付款

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 应付税金付款
start
:导入海关税金明细;
-> 生成应付账单，关联保函，\n释放供应商、海关可用额度;
:申请付款;
:申请付款审核;
:付款录入;
:付款核销;
stop
@enduml
```
### 2. 应收税金账单核销

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 应收税金账单核销
start
:生成应收扣费历史记录;
:生成应收账单;
-> 充值记录;
:应收税金核销;
stop
@enduml
```
### 3. 税金余额管理

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 税金余额管理
start
:接收订单;
:预估税金统计;
:税金余额预扣减;
:导入海关税金明细;
:税金余额实际应扣;
fork
  :更新税金余额;
fork again
  :应收税金核销;
end fork
stop
@enduml
```
### 4. 税金充值

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 税金充值
start
:通知客户充值;
:充值税金;
switch (支付方式)
case (线上支付)
  :在线支付;
  -> 支付成功;
case (线下汇款)
  :选择水单;
  -> 提交;
endswitch
:(自动)审核;
:增加账户余额;
stop
@enduml
```


## 二、财务结算

### 1. 结算应付流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #687680
    FontSize 11
    FontStyle plain
  }
}
</style>
title 结算应付流程
start
group 费用录入与审核 #EDF3F7 {
:录入应付费用（自动/手动）;
#gold:(A)
:提交审核;
:审核费用;
if (审核通过？) then (否)
  if (修改或作废？) then (作废)
    :作废，该费用申请流程结束;
    stop
  else (修改)
  endif
  :修改费用;
  #gold:(A)
  detach
else (是)
endif
}
group 账单与对账 #EEF5F0 {
fork
  :单票账单;
fork again
  :自动生成应付结算明细;
  :生成对账单;
  :供应商确认对账单;
end fork
}
group 调整或付款 #F3EFF8 {
if (是否有异常？) then (有异常)
  :录入调整单\n（关联原先的子单）;
  #gold:(A)
  detach
else (无异常)
  repeat
    :付款申请;
    :职能部门审批;
  repeat while (审批通过？) is (否) not (是)
  :出纳付款;
endif
}
stop
@enduml
```


连接符 A：“修改费用”和“录入调整单”均返回“提交审核”。

### 2. 财务应收流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #687680
    FontSize 11
    FontStyle plain
  }
}
</style>
title 财务应收流程
start
group 费用录入与审核 #EDF3F7 {
:录入应收费用（自动/手动）;
#gold:(A)
:提交审核;
:审核应收费用明细;
if (审核通过？) then (否)
  if (修改或作废？) then (作废)
    :作废，此应收费用申请业务结束;
    stop
  else (修改)
  endif
  :修改费用明细;
  #gold:(A)
  detach
else (是)
endif
}
group 账单与对账 #EEF5F0 {
fork
  :单票账单;
fork again
  :自动生成应收结算明细;
  :生成对账单;
  :客户确认对账单;
end fork
}
group 调整或收款核销 #F3EFF8 {
if (是否有异常？) then (有异常)
  :录入调整单\n（关联原先的子单）;
  #gold:(A)
  detach
else (无异常)
  :收款申请;
  fork
    :登记发票;
  fork again
    :线下跟踪收款;
    :出纳线下收款;
    :会计审批收款;
  end fork
  :出纳线上登记收款确认\n（核销业务单据）;
  :释放客户额度;
endif
}
stop
@enduml
```


连接符 A：“修改费用明细”和“录入调整单”均返回“提交审核”。

### 3. 报价计费流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 报价计费流程
start
fork
  :设置收费规则;
  :审核报价规则;
  :自动生成应收费用;
fork again
  :设置付费规则;
  :审核报价规则;
  :自动生成应付费用;
end fork
stop
@enduml
```
