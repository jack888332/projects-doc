# 跨境电商BBC进口详细流程

<a id="mainflow-06"></a>

本文定义 BBC 进口保税业务的入出区、调拨和特殊业务操作流程。入出区与调拨包括区间调拨、入保税仓关务操作、区内调拨、包裹出区和账册调拨；特殊业务操作包括简单加工、退运、客退、物料进区、卡板出区和保税展示。业务模式之间的关系见《业务模式主流程总览》第 6 节。

## 1. 入出区与调拨

### 1.1 区间调拨的出区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：区间调拨出区
start
group 订单与申报资料 #F4F8FA {
:通知提货出区;
:接收订单;
:订单校验成功后下发仓库;
:仓库拣货，做出库清单;
:制作箱单发票;
:核实价格;
:确认价格;
:审核资料;
:完善出仓信息;
}
group 核注申报与进场 #F5F9F6 {
:核注清单报送;
:保税核注清单推送到金二系统;
:约车;
:车辆核放及出区登记;
:车辆过卡口;
:空车过磅;
}
group 出库与货物交接 #F8F6FA {
:下架、打托、称重;
:发送出库清单;
:货物交接;
:重车过磅;
:记录过磅数据;
}
group 出区核放与查验 #F5F9FA {
:车辆核放及出区登记;
:登记出闸纸;
:车辆过闸口;
if (是否放行) then (是)
else (否)
  :打印查验所需单据;
  :记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
endif
:重车出区;
}
stop
@enduml
```

- “保税核注清单推送到金二系统”：金二系统操作在“南沙保税港区企业录入子系统”完成。
- “登记出闸纸”：出闸纸需购买，供出区时使用。

### 1.2 区间调拨的入区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：区间调拨入区
start
group 入仓资料与申报 #F4F8FA {
:入仓预报;
:初审资料;
:接单审核资料;
:完善入仓信息;
:核注清单报送;
:保税核注清单推送到金二系统;
}
group 入区核放与查验 #F5F9F6 {
:车辆核放及进区登记;
:登记出闸纸;
:车辆过卡口;
if (是否放行) then (是)
else (否)
  :打印查验所需单据;
  :记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
endif
}
group 收货理货与上架 #F8F6FA {
:重车过磅;
:收货;
:货物交接;
:发送理货报告;
if (理货是否存在异常) then (有异常)
  :理货异常处理;
else (无异常)
endif
:确认理货报告;
-> 确认;
:上架;
:空车出区;
}
stop
@enduml
```

- “保税核注清单推送到金二系统”：金二系统操作在“南沙保税港区企业录入子系统”完成。
- “登记出闸纸”：出闸纸需购买，供出区时使用。

### 1.3 入保税仓关务操作

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：入保税仓关务操作
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
start
group 资料与换单 #F4F8FA {
:入仓预报;
:初审资料;
fork
  :接单审核资料;
fork again
  :通知关务换单;
  :线下查询海运舱单、空运舱单;
  :携带材料线下换取提货单;
  :确认换单完成;
end fork
:完善入仓信息;
}
group 申报与查验 #F5F9F6 {
fork
  :核注清单报送;
  :保税核注清单推送到金二系统;
fork again
  :进境备案清单报送;
  :进境备案清单草单数据推送到单一窗口;
end fork
:进境备案清单报送正式申报;
if (是否放行) then (是)
else (否)
  :打印查验所需单据;
  :记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
endif
}
group 入区理货 #F8F6FA {
:约车;
:车辆核放及进区登记;
:登记出闸纸;
:车辆过卡口;
:重车过磅;
:收货;
:货物交接;
:发送理货报告;
if (理货是否存在异常) then (有异常)
  :理货异常处理;
else (无异常)
endif
:确认理货报告;
-> 确认;
:上架;
}
group 补报与出区 #F5F9FA {
if (进境备案清单前序是否两步申报) then (是)
  if (存在货物信息变化) then (是)
    :修改箱单发票资料;
  else (否)
  endif
  :完整申报;
else (否)
endif
:空车出区;
}
stop
@enduml
```

- “线下查询海运舱单、空运舱单”：查询入口为“海关总署-舱单信息查询”。
- “保税核注清单推送到金二系统”：金二系统操作在“南沙保税港区企业录入子系统”完成。
- “登记出闸纸”：出闸纸需购买，供出区时使用。

### 1.4 区内调拨

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：区内调拨
start
group 资料与核注申报 #F4F8FA {
:入仓预报;
:初审资料;
:接单审核资料;
:完善进仓信息;
:出/进核注清单报送;
:保税核注清单推送到金二系统;
}
group 出仓与区内运输 #F5F9F6 {
:约车;
:车辆进区登记;
:车辆过卡口;
:下架、打托、称重;
:发送出库清单;
:货物交接;
:车辆送货;
}
group 收货理货与上架 #F8F6FA {
:收货;
:货物交接;
:发送理货报告;
if (理货是否存在异常) then (有异常)
  :理货异常处理;
else (无异常)
endif
:确认理货报告;
:上架;
:空车出区;
}
stop
@enduml
```

- “保税核注清单推送到金二系统”：金二系统操作在“南沙保税港区企业录入子系统”完成。

### 1.5 包裹出区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：包裹出区
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
start
group 订单申报 #F4F8FA {
:订单预报：订单清单信息;
:收到订单信息，系统自动校验;
:预估税金;
:系统自动三单对碰，发给海关;
if (回执是否异常) then (是)
  :订单异常子流程;
else (否)
endif
:订单放行;
}
group 出仓准备 #F5F9F6 {
fork
  :约快递车;
fork again
  :出仓准备;
  :通知关务;
  :接收关务服务指令;
  :核对申报资料;
  :出区核注清单报送\n生成核注清单\n初审\n复审;
end fork
}
group 车辆提货 #F8F6FA {
:申报空车入区;
:通知装货;
:快递车入区;
:空车过磅;
:出库操作;
:提货交接;
:重车过磅;
:车辆核放及出区登记;
}
group 出区核放 #F5F9FA {
:保税核注清单推送到金二系统;
:系统返回出区保税核注清单\n单证状态“审批通过”;
:制作出区资料;
:闸口查验;
if (状态是否出现查验) then (是)
  :打印查验所需单据;
  :记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
else (否)
endif
:车辆出区;
}
stop
@enduml
```

- “保税核注清单推送到金二系统”：金二系统操作在“南沙保税港区企业录入子系统”完成。

### 1.6 账册调拨

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：账册调拨
start
group 指令与资料核对 #F4F8FA {
:发送关务服务指令;
:关务调拨服务接单;
:核对申报资料;
}
group 转入核注 #F5F9F6 {
:转入核注清单报送;
:保税核注清单;
:系统返回入区保税核注清单\n单证状态“审批通过”;
}
group 转出核注 #F8F6FA {
:转出核注清单报送;
:保税核注清单推送到金二系统;
:系统返回出区保税核注清单\n单证状态“审批通过”;
}
stop
@enduml
```

- “保税核注清单推送到金二系统”：金二系统操作在“南沙保税港区企业录入子系统”完成。

<a id="mainflow-07"></a>
## 2. 特殊业务操作

### 2.1 简单加工操作

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：简单加工操作
start
:发送关务服务指令;
:关务服务接单;
:核对申报资料;
:业务申报;
-> 审批通过后;
:出区操作（料件）;
:入区操作（成品）;
stop
@enduml
```

### 2.2 退运操作

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：退运操作
start
group 退运指令与申报 #F4F8FA {
:发送退运指令;
:发送退运订单;
fork
  :约车;
fork again
  :关务退运接单;
  :核对申报资料;
end fork
:申报出口核注清单（金二系统）;
if (是否属于检验检疫名录) then (是)
  :出境检验检疫申报（单一窗口）;
else (否)
endif
}
group 车辆提货出区 #F5F9F6 {
:提供空车过磅信息;
:车辆核放（暂存）及进区登记;
:库内操作;
:重车过磅;
:车辆核放登记（确认）;
:车辆提货出区;
}
group 出境申报与交单 #F8F6FA {
if (是否退运出境) then (是)
  :车辆还柜给码头/机场/\n深圳关、皇岗关;
  if (是否还完柜) then (是)
  else (否)
  endif
  :报送出区公路/海运/空运舱单;
  repeat
    :海关总署系统查询确认状态;
  repeat while (是否确认) is (否) not (是)
  :申报出境备案清单;
  :交单;
else (否)
endif
}
stop
@enduml
```

### 2.3 客退操作

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：客退操作
start
group 客退申请与拦截 #F4F8FA {
:申请客退;
:通知快递拦截;
:存放临时点;
:申请客退;
}
if (海关是否同意) then (是)
group 资料与进区 #F5F9F6 {
  :约车;
  :制作箱单发票;
  :下发报关指令;
  :关务服务接单;
  :核对申报资料;
  :车辆核放及进区登记;
  :进区;
}
group 查验与入仓处理 #F8F6FA {
  :等候查验;
  :查验;
  if (是否有问题) then (是)
    :退客户指定点;
  else (否)
    :包裹理货入仓;
    if (理货是否存在异常) then (有异常)
      :理货异常处理;
    else (无异常)
    endif
    :确认理货;
    :理货上架;
    :将资料发给关务做账册增录;
    :做核注清单;
    :更新至金二系统，账册库存增加;
  endif
}
else (否)
endif
stop
@enduml
```

### 2.4 物料进区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：物料进区
start
group 接单与入区核放 #F4F8FA {
:发送物料进区关务操作指令;
fork
  :物料进区接单;
fork again
  :约车;
end fork
:重车过磅;
:制作核放单;
:车辆重车进区登记;
}
group 入区交接与作业 #F5F9F6 {
:重车入区;
:货物交接;
:库内操作;
:车辆出区;
}
stop
@enduml
```

### 2.5 卡板出区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：卡板出区
start
group 接单与车辆准备 #F4F8FA {
:发送卡板出区关务操作指令;
fork
  :卡板出区接单;
  :车辆登记;
fork again
  :约车;
end fork
}
group 入区作业与交接 #F5F9F6 {
:空车入区;
:库内操作;
:货物交接;
:重车过磅;
}
group 申报缴税与出区 #F8F6FA {
:进口报关单申报;
:进口缴税;
:车辆出区;
}
stop
@enduml
```

### 2.6 保税展示

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
<style>
activityDiagram {
  group {
    LineColor #CAD5DA
    LineThickness 0.7
    RoundCorner 12
    FontColor #78848D
    FontSize 11
    FontStyle plain
  }
}
</style>
title BBC进口：保税展示
start
group 申报与出库准备 #F4F8FA {
:发送出区关务操作指令;
:保税出区接单;
:业务申报;
:出库指令;
fork
  :车辆核放登记;
fork again
  :车辆进出区登记;
end fork
}
group 出区与门店交付 #F5F9F6 {
:车辆入区;
:库内操作;
:重车过磅;
:车辆进出区登记;
:车辆出区;
:门店卸货;
}
group 展示后回仓 #F8F6FA {
-> 半年或更长时间展示以后;
:入库指令;
:车辆核放及进区登记;
:门店装货;
:车辆入区;
:重车过磅;
:货物交接;
:库内操作;
}
stop
@enduml
```
