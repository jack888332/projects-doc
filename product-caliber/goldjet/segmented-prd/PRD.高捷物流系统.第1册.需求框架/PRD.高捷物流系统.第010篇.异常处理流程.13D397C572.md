# 第010篇

> 本篇定位：异常处理流程；主要内容：订单、理货、快递及进出口查验异常处理；文档角色：共享规则档；文档ID：13D397C572

<a id="doc-13D397C572-exceptions"></a>
## 1. 业务范围

本文定义订单异常、理货异常、快递异常和查验异常四类处理流程，并说明各类异常的触发情形与处理路径。各业务模式主流程引用相应子流程；普货出口侧的查验、申报异常处理见《普货进出口关务详细流程》第 3.1 节，BC 出口侧的查验、申报异常处理见《跨境电商BC出口关务详细流程》第 2、3 节。


<a id="doc-13D397C572-section-104108ced8b2"></a>
## 2. 订单异常子流程

各类海关回执异常分别进入对应处理路径；下列三图按异常类型分组，不表示连续执行。图中终点仅表示本次处理阶段结束，不代表订单已完成。

```plantuml
@startuml goldjet-mainflow-09-9648187c-01
skinparam activityDiamondBackgroundColor #FFF4CC
title 订单异常：退单、退运与撤单
start
switch (海关回执异常类型)
case (退单)
  :通知客户，让客户修改订单、\n重新申报；或者取消订单;
case (退运)
  :通知客户，与客户沟通确定退单或\n退运出区申报的处理方式;
  if (需要退运？) then (是)
    :退运子流程;
  else (否)
  endif
case (撤单)
  if (是否已出库) then (是)
    :申报撤销单;
    if (海关审核通过？) then (是)
      :撤单成功;
    else (否)
    endif
  else (否)
    :库内拦截并取消订单;
  endif
endswitch
stop
@enduml
```

```plantuml
@startuml goldjet-mainflow-09-missing-declarations
skinparam activityDiamondBackgroundColor #FFF4CC
title 订单异常：申报信息缺失
start
switch (海关回执异常类型)
case (订单信息不存在)
  :重新推送清单\n（报机场跨境清单）;
case (运单信息不存在)
  :重新推送运单;
case (支付信息不存在)
  :重新推送支付单;
endswitch
stop
@enduml
```

```plantuml
@startuml goldjet-mainflow-09-inspection-and-other
skinparam activityDiamondBackgroundColor #FFF4CC
title 订单异常：查验、挂起及其他回执
start
switch (海关回执异常类型)
case (查验)
  :订单下发给仓库;
  :仓库将需要查验的订单\n单独打包;
  if (海关查验通过？) then (是)
    :放行;
  else (否)
    :发送消息通知，\n联系客户解决;
  endif
case (挂起)
  :发送消息通知，\n联系客户解决;
case (人工审核)
  :等待回执状态更新;
case (担保金不足或其他异常)
  :提醒客服;
endswitch
stop
@enduml
```


<a id="doc-13D397C572-section-cce5504b44c6"></a>
## 3. 理货异常处理

```plantuml
@startuml goldjet-mainflow-09-9648187c-02
skinparam activityDiamondBackgroundColor #FFF4CC
title 理货异常
start
:发送理货报告;
if (理货是否存在异常) then (有异常)
  :自动生成工单;
  repeat
    :处理工单;
    :反馈意见;
  repeat while (是否达成一致) is (否) not (是)
else (无异常)
endif
:确认理货报告;
:上架;
stop
@enduml
```


<a id="doc-13D397C572-section-70233f77b44a"></a>
## 4. 快递异常处理

```plantuml
@startuml goldjet-mainflow-09-9648187c-03
skinparam activityDiamondBackgroundColor #FFF4CC
title 快递异常处理流程
start
switch (快递异常)
case (快递拦截)
  :通知快递拦截;
  :改派到客户仓库;
case (改地址)
  :填写地址信息;
  :接收地址信息;
  :通知快递改地址;
  :改派到新地址;
case (快递破损、虚假签收、\n缺件少件或丢件)
  :通知客服处理;
  :工单处理子流程;
  :记录包裹最终处理情况;
endswitch
stop
@enduml
```


<a id="doc-13D397C572-section-0e7272cf22ad"></a>
## 5. 查验异常处理（出口侧：改单/删单/落装/改配）

```plantuml
@startuml goldjet-mainflow-09-9648187c-04
skinparam activityDiamondBackgroundColor #FFF4CC
title 查验异常处理（出口侧）
start
switch (发起方式)
case (海关发起改单)
  :确认改单;
  :打印改单资料;
  -> 线下提交资料给海关，\n海关审批通过;
  :上传新的报关资料;
  :打印纠正和改进\n措施处理单;
  -> 线下由主管签字;
  :上传纠正和改进\n措施处理单;
case (海关发起删单)
  :出口退运流程;
case (企业发起落装申请)
  :确认落装申请;
  :打印落装申请资料;
  :系统外操作;
case (企业线下纸本申请改配)
  :确认改配申请;
  :打印改配申请资料;
  :系统外操作;
endswitch
stop
@enduml
```

<a id="doc-13D397C572-section-184ecf2712ab"></a>
## 6. 查验异常处理（进口侧：改单/删单）

```plantuml
@startuml goldjet-mainflow-09-9648187c-05
skinparam activityDiamondBackgroundColor #FFF4CC
title 查验异常处理（进口侧）
start
-> 海关发起改单/删单;
:打印改单资料;
-> 线下提交资料给海关，\n海关审批通过;
:确认改单;
fork
  :上传新的报关资料;
fork again
  :进口退运-直接退运;
  -> 货物放行后;
  :打印退税资料;
  -> 线下递交资料申请退还税金;
  :确认删单;
end fork
:打印纠正和改进\n措施处理单;
-> 线下由主管签字;
:上传纠正和改进\n措施处理单;
stop
@enduml
```
