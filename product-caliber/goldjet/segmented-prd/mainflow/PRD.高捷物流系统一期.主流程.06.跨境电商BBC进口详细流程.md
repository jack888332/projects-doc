# 跨境电商BBC进口详细流程

<a id="mainflow-06"></a>

本文定义 BBC 进口保税业务的入出区、调拨和特殊业务操作流程。入出区与调拨包括区间调拨、入保税仓关务操作、区内调拨、包裹出区和账册调拨；特殊业务操作包括简单加工、退运、客退、物料进区、卡板出区和保税展示。业务模式之间的关系见《业务模式主流程总览》第 6 节。

## 1. 入出区与调拨

### 1.1 区间调拨的出区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：区间调拨出区
start
:通知提货出区;
:1.接收订单;
:2.订单校验成功后下发仓库;
:3.仓库拣货，做出库清单;
:4.制作箱单发票;
:5.核实价格;
:6.确认价格;
:7.审核资料;
:8.完善出仓信息;
:9.核注清单报送;
:保税核注清单推送到金二系统\nP1;
:10.约车;
:11.车辆核放及出区登记;
:车辆过卡口;
:空车过磅;
:12.下架、打托、称重;
:13.发送出库清单;
:14.货物交接;
:重车过磅;
:15.记录过磅数据;
:16.车辆核放及出区登记;
:17.登记出闸纸\nP2;
:车辆过闸口;
if (是否放行) then (是)
else (否)
  :18.1 打印查验所需单据;
  :18.2 记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
endif
:重车出区;
stop
@enduml
```

- P1：此处金二系统操作在“南沙保税港区企业录入子系统”完成。
- P2：出闸纸需购买，供出区时使用。

### 1.2 区间调拨的入区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：区间调拨入区
start
:1.入仓预报;
:2.初审资料;
:3.接单审核资料;
:4.完善入仓信息;
:5.核注清单报送;
:保税核注清单推送到金二系统\nP1;
:6.车辆核放及进区登记;
:7.登记出闸纸\nP2;
:车辆过卡口;
if (是否放行) then (是)
else (否)
  :8.1 打印查验所需单据;
  :8.2 记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
endif
:重车过磅;
:收货;
:9.货物交接;
:10、发送理货报告;
if (理货是否存在异常) then (有异常)
  :理货异常处理;
else (无异常)
endif
:11、确认理货报告;
-> 确认;
:12、上架;
:空车出区;
stop
@enduml
```

- P1：此处金二系统操作在“南沙保税港区企业录入子系统”完成。
- P2：出闸纸需购买，供出区时使用。

### 1.3 入保税仓关务操作

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：入保税仓关务操作
start
:1.入仓预报;
:2.初审资料;
fork
  :3A.接单审核资料;
fork again
  :3B.通知关务换单;
  :线下查询海运舱单、空运舱单\nP1;
  :携带材料线下换取提货单;
  :4.确认换单完成;
end fork
:5.完善入仓信息;
fork
  :6A.核注清单报送;
  :保税核注清单推送到金二系统\nP2;
fork again
  :6B.进境备案清单报送;
  :进境备案清单草单数据推送到单一窗口;
end fork
:7.进境备案清单报送正式申报;
if (是否放行) then (是)
else (否)
  :8.1 打印查验所需单据;
  :8.2 记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
endif
:9.约车;
:10.车辆核放及进区登记;
:11.登记出闸纸\nP3;
:车辆过卡口;
:重车过磅;
:收货;
:12.货物交接;
:13、发送理货报告;
if (理货是否存在异常) then (有异常)
  :理货异常处理;
else (无异常)
endif
:14、确认理货报告;
-> 确认;
:15、上架;
if (进境备案清单前序是否两步申报) then (是)
  if (存在货物信息变化) then (是)
    :16.修改箱单发票资料;
  else (否)
  endif
  :17、完整申报;
else (否)
endif
:空车出区;
stop
@enduml
```

- P1：查询入口为“海关总署-舱单信息查询”。
- P2：此处金二系统操作在“南沙保税港区企业录入子系统”完成。
- P3：出闸纸需购买，供出区时使用。

### 1.4 区内调拨

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：区内调拨
start
:1.入仓预报;
:2.初审资料;
:3.接单审核资料;
:4.完善进仓信息;
:5.出/进核注清单报送;
:保税核注清单推送到金二系统\nP1;
:6.约车;
:7.车辆进区登记;
:车辆过卡口;
:8.下架、打托、称重;
:9.发送出库清单;
:10.货物交接;
:车辆送货;
:收货;
:11.货物交接;
:12、发送理货报告;
if (理货是否存在异常) then (有异常)
  :理货异常处理;
else (无异常)
endif
:13、确认理货报告;
:12、上架;
:空车出区;
stop
@enduml
```

- P1：此处金二系统操作在“南沙保税港区企业录入子系统”完成。

### 1.5 包裹出区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：包裹出区
start
:1.订单预报：订单清单信息;
:2.收到订单信息，系统自动校验;
:3.预估税金;
:4.系统自动三单对碰，发给海关;
if (回执是否异常) then (是)
  :订单异常子流程;
else (否)
endif
:订单放行;
fork
  :5A.约快递车;
fork again
  :5B.出仓准备;
  :6.通知关务;
  :7.接收关务服务指令;
  :8.核对申报资料;
  :9.出区核注清单报送\n9.1 生成核注清单\n9.2 初审\n9.3 复审;
end fork
:10.申报空车入区;
:通知装货;
:快递车入区;
:空车过磅;
:11.出库操作;
:12.提货交接;
:重车过磅;
:13.车辆核放及出区登记;
:保税核注清单推送到金二系统\nP1;
:系统返回出区保税核注清单\n单证状态“审批通过”;
:14.制作出区资料;
:闸口查验;
if (状态是否出现查验) then (是)
  :15.1 打印查验所需单据;
  :15.2 记录现场查验情况;
  if (查验是否出现异常) then (是)
    :查验异常处理;
  else (否)
  endif
else (否)
endif
:车辆出区;
stop
@enduml
```

- P1：此处金二系统操作在“南沙保税港区企业录入子系统”完成。

### 1.6 账册调拨

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：账册调拨
start
:1.发送关务服务指令;
:2.关务调拨服务接单;
:3.核对申报资料;
:4.转入核注清单报送;
:保税核注清单;
:系统返回入区保税核注清单\n单证状态“审批通过”;
:5.转出核注清单报送;
:保税核注清单推送到金二系统\nP1;
:系统返回出区保税核注清单\n单证状态“审批通过”;
stop
@enduml
```

- P1：此处金二系统操作在“南沙保税港区企业录入子系统”完成。

<a id="mainflow-07"></a>
## 2. 特殊业务操作

### 2.1 简单加工操作

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：简单加工操作
start
:1.发送关务服务指令;
:2.关务服务接单;
:3.核对申报资料;
:4.业务申报;
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
title BBC进口：退运操作
start
:1.发送退运指令;
:2.发送退运订单;
fork
  :3A.约车;
fork again
  :3B.关务退运接单;
  :4.核对申报资料;
end fork
:5.申报出口核注清单（金二系统）;
if (是否属于检验检疫名录) then (是)
  :6.出境检验检疫申报（单一窗口）;
else (否)
endif
:提供空车过磅信息;
:7.车辆核放（暂存）及进区登记;
:8.库内操作;
:重车过磅;
:9.车辆核放登记（确认）;
:车辆提货出区;
if (是否退运出境) then (是)
  :车辆还柜给码头/机场/\n深圳关、皇岗关;
  if (是否还完柜) then (是)
  else (否)
  endif
  :10.报送出区公路/海运/空运舱单;
  repeat
    :海关总署系统查询确认状态;
  repeat while (是否确认) is (否) not (是)
  :11.申报出境备案清单;
  :12.交单;
else (否)
endif
stop
@enduml
```

### 2.3 客退操作

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：客退操作
start
:1.申请客退;
:通知快递拦截;
:2.存放临时点;
:3.申请客退;
if (海关是否同意) then (是)
  :4.约车;
  :5.制作箱单发票;
  :6.下发报关指令;
  :7.关务服务接单;
  :8.核对申报资料;
  :9.车辆核放及进区登记;
  :进区;
  :等候查验;
  :10.查验;
  if (是否有问题) then (是)
    :退客户指定点;
  else (否)
    :11.包裹理货入仓;
    if (理货是否存在异常) then (有异常)
      :理货异常处理;
    else (无异常)
    endif
    :12.确认理货;
    :13.理货上架;
    :14.将资料发给关务做账册增录;
    :15.做核注清单;
    :更新至金二系统，账册库存增加;
  endif
else (否)
endif
stop
@enduml
```

### 2.4 物料进区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：物料进区
start
:1.发送物料进区关务操作指令;
fork
  :2A.物料进区接单;
fork again
  :2B.约车;
end fork
:重车过磅;
:3.制作核放单;
:4.车辆重车进区登记;
:重车入区;
:5.货物交接;
:6.库内操作;
:车辆出区;
stop
@enduml
```

### 2.5 卡板出区

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：卡板出区
start
:1.发送卡板出区关务操作指令;
fork
  :2A.卡板出区接单;
  :3.车辆登记;
fork again
  :2B.约车;
end fork
:空车入区;
:4.库内操作;
:5.货物交接;
:重车过磅;
:6.进口报关单申报;
:7.进口缴税;
:车辆出区;
stop
@enduml
```

### 2.6 保税展示

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BBC进口：保税展示
start
:1.发送出区关务操作指令;
:2.保税出区接单;
:3.业务申报;
:4.出库指令;
fork
  :5A.车辆核放登记;
fork again
  :5B.车辆进出区登记;
end fork
:车辆入区;
:6.库内操作;
:重车过磅;
:7.车辆进出区登记;
:车辆出区;
:8.门店卸货;
-> 半年或更长时间展示以后;
:9.入库指令;
:10.车辆核放及进区登记;
:11.门店装货;
:车辆入区;
:重车过磅;
:12.货物交接;
:13.库内操作;
stop
@enduml
```
