# 普货进出口关务详细流程

<a id="mainflow-03"></a>

本文定义普货进口（6 个子流程）与普货出口（5 个子流程）的详细操作，说明进出口两侧主流程、异常处理和退运/删单环节的差异。主流程总览见《业务模式主流程总览》第 1、2 节。

## 一、普货进口流程

### 1. 企业主动发起改单流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 企业主动发起改单流程
start
:打印改单资料;
-> 线下提交资料给海关，海关审批通过;
:确认改单;
:上传新的报关资料;
:打印纠正和改进措施处理单;
-> 线下找主管签名;
:上传纠正和改进措施处理单;
stop
@enduml
```
### 2. 退运及出口报关流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 退运及出口报关流程
start
if (已申报？) then (已申报)
  :申请退运;
  :普货出口正常流程;
else (未申报)
  :申请直接退运;
  -> 线下提交资料办理退运手续;
  :确认已办理退运手续;
  -> 货站安排运货到指定仓库贴标签，\n称重，录入预配信息;
  :提交出口报关单;
  :提交进口报关单;
  :查看报关状态;
  if (报关状态) then (查验)
    :安排查验;
    if (查验异常？) then (是)
      :查验异常处理;
      -> 查验通过;
    else (否)
    endif
    :放行交单;
    :货物离境;
  else (放行)
  endif
endif
stop
@enduml
```
### 3. 普货进口卡航（国外空运—广州机场—卡车航班转运国内其他口岸）流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 普货进口卡航流程
start
:新建订单;
:接单;
if (理货正常？) then (是)
  :去国航/南航客服中心换单;
else (否)
  :通知客服;
  :联系货站处理;
endif
:确认换单完成;
-> 扫描/拍照正本提单给客服，客服确认资料后;
:安排转运车辆;
-> 车辆信息、驾驶员信息;
:制单;
:单一窗口申报转关;
-> 现场海关办理转关;
:费用结算;
-> 关务提供司机联原单;
:卡口系统录入，做入区登记;
:带监管车辆进入货站;
-> 交单到货站仓管，拉货;
if (货物异常？) then (是，货站开具破损证明)
  :联系客户，确认处理方案;
else (否)
endif
:提货装车;
:封车;
:确认发车;
:车辆离场;
stop
@enduml
```

运输路线为国外空运至广州机场，再由卡车航班转运至国内其他口岸。

### 4. 转关车辆进仓流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 转关车辆进仓流程
start
:新建订单;
:接单;
:卡口系统录入;
:打印配载单;
:打印进口转关操作表;
:复制司机本;
:带车进物流场;
-> 海关做转关单核销，拿胶条锁，海关剪锁;
:车辆离场确认;
:带车进监管仓;
-> 车辆卸货;
:主单理货;
:分单理货;
-> 通知司机刷卡;
:车辆离场;
:确认完成，录入服务信息;
stop
@enduml
```

### 5. 到货换单理货流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 到货换单理货流程
start
:新建订单;
:接单;
:查到货信息;
if (到货异常？) then (是)
  :通知客户处理;
  -> 处理完成;
else (否)
  :线下换单、盖章、结算;
endif
:确认换单完成;
:做分运清单;
:到货站交单;
if (货物破损？) then (是)
  :出破损证明;
  :通知客户;
else (否)
endif
:到货站找货;
:拉货回我司监管仓;
:理货;
if (理货异常？) then (是)
  :通知客服;
  :通知客户，确认异常情况;
else (否)
  :加盖验讫章;
endif
:上传分单理货数据;
:转仓完成;
stop
@enduml
```

### 6. 普货进口主流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 普货进口主流程
start
:新建订单;
:接单;
:审核资料;
while (审核通过？) is (否)
  :审核资料;
endwhile (是)
:制单录入;
:初审复审;
-> 有舱单回执;
:提交申报;
if (申报异常？) then (是)
  :申报异常处理;
  -> 处理完成;
else (否，且货物已运抵)
endif
:确认换单完成;
-> 线下录运抵后;
:查看报关状态;
-> 查验;
:安排查验;
if (查验异常？) then (是)
  :查验异常处理;
else (否)
endif
:放行;
if (提货方式) then (客户要求提货)
  :约车;
  :装车出仓;
  :送货;
  :确认客户已签收;
else (客户自提)
  :记录客户提货信息;
endif
stop
@enduml
```


## 二、普货出口流程

### 1. 查验/申报异常处理流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 查验/申报异常处理流程
start
switch (发起方式)
case (查验)
  :安排查验;
  if (查验异常？) then (是)
    :查验异常处理;
  else (否)
  endif
case (挂单)
  :提醒关务向海关咨询;
  -> 线下处理;
  :记录问题原因及处理结果;
case (退单)
  :修改报关单，重新上传单证;
  :提交到单一窗口;
  :在单一窗口申报;
endswitch
stop
@enduml
```

### 2. 出口退运删单流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 出口退运删单流程
start
-> 企业在单一窗口发起删单或海关发起删单后;
:打印删单资料;
fork
  -> 同步线下找货站开《出口货物在库证明》，\n线下提交审批资料，海关审批通过;
  :确认删单;
  :在舱单系统作废预配信息;
  -> 线下提供资料申请退仓/退场，海关审批通过;
  :找货站作废运抵信息;
  :打印纠正和改进措施处理单;
  -> 线下找主管签名;
  :上传纠正和改进措施处理单;
fork again
  :收到删单提醒;
  fork
    -> 退到高捷仓;
    :约车;
    :装车封车;
    -> 关务办理放行条并交给司机，\n用于驶出闸口并将货物运至高捷仓;
  fork again
    :接收入仓通知;
  end fork
  :接收货物;
  :记录实际入仓信息;
  -> 客户自提;
  :装车出仓;
  -> 退回客户仓库;
end fork
stop
@enduml
```

### 3. 出口主流程（公路预配舱单模式）

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 出口主流程（公路预配舱单模式）
start
:新建订单;
fork
  -> 下发关务服务;
  :接单;
  :审核资料;
  while (审核通过？) is (否)
    :审核资料;
  endwhile (是)
  :制单录入;
  :初审复审;
  -> 有舱单回执;
fork again
  fork
    -> 下发入仓预报;
    :接收入仓通知;
  fork again
    if (客户要求提货？) then (是)
      :约车;
      -> 货到国内仓;
    else (否)
    endif
  end fork
  :接收货物;
  :记录实际入仓信息;
  if (入仓异常？) then (有异常)
    :入库异常处理;
    -> 异常处理完毕;
  else (无异常)
  endif
  :确认入仓;
  :录入公路预配舱单;
end fork
:提交申报;
if (申报异常？) then (是)
  :申报异常处理;
  -> 处理完成;
else (否)
  :提醒客服和仓库\n货物出仓入货站;
  fork
    :约车;
  fork again
    :接收出仓通知;
  end fork
  :装车;
  :记录出仓信息;
  -> 货物运抵货站;
  :货站现场操作人员\n拍照上传托运书;
endif
:查看报关状态;
if (报关状态) then (查验)
  :安排查验;
  if (查验异常？) then (是)
    :查验异常处理;
    -> 处理完成;
  else (否)
  endif
else (放行)
endif
:打印资料，交单;
:货物离境;
stop
@enduml
```
### 4. 出口主流程（货站录运抵模式）

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 出口主流程（货站录运抵模式）
start
:新建订单;
fork
  -> 下发关务服务;
  :接单;
  :审核资料;
  while (审核通过？) is (否)
    :审核资料;
  endwhile (是)
  :制单录入;
  :初审复审;
  -> 有舱单回执;
  :提交申报;
  if (申报异常？) then (是)
    :申报异常处理;
    -> 处理完成;
  else (否，货站录运抵后)
  endif
fork again
  fork
    -> 下发入仓预报;
    :接收入仓通知;
  fork again
    if (客户要求提货？) then (是)
      :约车;
      -> 货到国内仓;
    else (否)
    endif
  end fork
  :接收货物;
  :记录实际入仓信息;
  if (入仓异常？) then (有异常)
    :入库异常处理;
    -> 异常处理完毕;
  else (无异常)
  endif
  :确认入仓;
  fork
    :接收出仓通知;
  fork again
    -> 关务复审通过;
    :约车;
  end fork
  :装车;
  :记录出仓信息;
  -> 货物运抵货站;
end fork
:查看报关状态;
if (报关状态) then (查验)
  :安排查验;
  if (查验异常？) then (是)
    :查验异常处理;
    -> 处理完成;
  else (否)
  endif
else (放行)
endif
:打印资料，交单;
:货物离境;
stop
@enduml
```
### 5. 出口主流程（深圳口岸空运预配模式）

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 出口主流程（深圳口岸空运预配模式）
start
:新建订单;
fork
  -> 下发关务服务;
  :接单;
  :审核资料;
  while (审核通过？) is (否)
    :审核资料;
  endwhile (是)
  :制单录入;
  :初审复审;
  -> 有舱单回执;
fork again
  fork
    -> 下发入仓预报;
    :接收入仓通知;
  fork again
    if (客户要求提货？) then (是)
      :约车;
      -> 货到国内仓;
    else (否)
    endif
  end fork
  :接收货物;
  :记录实际入仓信息;
  if (入仓异常？) then (有异常)
    :入库异常处理;
    -> 异常处理完毕;
  else (无异常)
  endif
  :确认入仓;
  :发送预配信息;
end fork
:提交申报;
if (申报异常？) then (是)
  :申报异常处理;
  -> 处理完成;
else (否)
  fork
    :约车;
  fork again
    :接收出仓通知;
  end fork
  :装车;
  :记录出仓信息;
  -> 货物运抵深圳口岸;
endif
:查看报关状态;
if (报关状态) then (查验)
  :安排查验;
  if (查验异常？) then (是)
    :查验异常处理;
    -> 处理完成;
  else (否)
  endif
else (放行)
endif
:打印资料，交单;
:货物离境;
stop
@enduml
```
