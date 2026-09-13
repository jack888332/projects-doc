# 税金管理与财务结算流程

<a id="mainflow-08"></a>

本文定义税金管理（应付税金付款、应收税金核销、税金余额管理、税金充值）与财务结算（应付、应收、报价计费）流程。应收税金核销衔接财务应收，应付税金付款衔接结算应付，报价计费是应付、应收费用的上游。


## 一、税金管理

### 1. 应付税金付款

```plantuml
@startuml
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
title 税金充值
start
:通知客户充值;
:充值税金;
if (支付方式) then (线上支付)
  :在线支付;
  -> 支付成功;
else (线下汇款)
  :选择水单;
  -> 提交;
endif
:(自动)审核;
:增加账户余额;
stop
@enduml
```


## 二、财务结算

### 1. 结算应付流程

```plantuml
@startuml
title 结算应付流程
start
:录入应付费用（自动/手动）;
:提交审核;
:审核费用;
while (审核是否通过？) is (审核不通过)
  if (修改或作废？) then (修改)
    :修改重新提交;
    :提交审核;
    :审核费用;
  else (作废)
    :作废，该费用申请流程结束;
    stop
  endif
endwhile (审核通过)
fork
  :单票账单;
fork again
  :自动生成应付结算明细;
  :生成对账单;
  :供应商确认对账单;
end fork
if (是否有异常？) then (有异常)
  :录入调整单（关联原先的子单）;
  note right: 回到“提交审核”环节重新流转
else (无异常)
  :付款申请;
  :职能部门审批;
  while (是否通过？) is (审批不通过)
    :付款申请;
    :职能部门审批;
  endwhile (审批通过)
  :出纳付款;
endif
stop
@enduml
```


### 2. 财务应收流程

```plantuml
@startuml
title 财务应收流程
start
:录入应收费用（自动/手动）;
:提交审核;
:审核应收费用明细;
while (审核是否通过？) is (审核拒绝)
  if (修改或作废？) then (修改)
    :修改并重新提交;
    :提交审核;
    :审核应收费用明细;
  else (作废)
    :作废，此应收费用申请业务结束;
    stop
  endif
endwhile (审核通过)
fork
  :单票账单;
fork again
  :自动生成应收结算明细;
  :生成对账单;
  :客户确认对账单;
end fork
if (是否有异常？) then (有异常)
  :录入调整单（关联原先的子单）;
  note right: 回到“提交审核”环节重新流转
else (无异常)
  :收款申请;
  fork
    :登记发票;
  fork again
    :线下跟踪收款;
    :出纳线下收款;
    :会计审批收款;
  end fork
  :出纳线上登记收款确认（核销业务单据）;
  :释放客户额度;
endif
stop
@enduml
```


### 3. 报价计费流程

```plantuml
@startuml
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
