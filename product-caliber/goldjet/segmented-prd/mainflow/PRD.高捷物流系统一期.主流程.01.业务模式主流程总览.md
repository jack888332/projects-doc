# 业务模式主流程总览

<a id="mainflow-01"></a>

本文展示高捷各业务模式的主流程总览，说明普货进出口、跨境电商 BC 出口、BC/CC 进口（备货/集货）与 BBC 进口（备货）的主链路及环节差异。各环节的详细操作见本目录对应流程篇。


## 1. 普货出口关务主流程

出口分直飞/直航与转关两种模式：接单/建单后，单证链（审单→制单录入）与货物链并行汇入“申报”，申报审结后货物运抵，按需查验后放行。

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 普货出口关务主流程（直飞/直航）

start
:接单/建单;
fork
  :审单;
  :制单录入;
fork again
  :仓库收货;
  -> 发预配信息;
end fork
:申报;
-> 已审结;
:货物运抵;
if (是否查验) then (是)
  :查验;
else (否)
endif
:放行;
stop
@enduml
```

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 普货出口关务主流程（转关）

start
:接单/建单;
fork
  :审单;
  :制单录入;
fork again
  :货物运抵;
  :上传托运书;
end fork
:申报;
if (是否查验) then (是)
  :已审结，去货站录运抵;
  :查验;
else (否)
endif
:放行;
stop
@enduml
```

## 2. 普货进口关务主流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 普货进口关务主流程
start
:建单/接单;
fork
  :审单;
  :制单录入;
  -> 有舱单数据后;
fork again
  :货物运抵;
  :换单完成;
end fork
:申报;
if (是否查验) then (是)
  :缴税完成;
  :查验;
else (否)
endif
:放行;
:提货;
stop
@enduml
```


## 3. 跨境电商BC出口关务主流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 跨境电商BC出口关务主流程
start
:建单/接单;
:资料审核;
fork
  :一键三单申报;
  -> 申报回执齐全;
fork again
  :录入提单信息;
end fork
:清单申报;
-> 清单审结放行;
:总单申报;
-> 总单放行;
:理货;
if (是否查验) then (人工布控/自动查验)
  :安排查验;
else (放行)
endif
:放行;
:申报结关;
stop
@enduml
```


## 4. 跨境电商BC、个人物品CC进口备货主流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 跨境电商BC、个人物品CC\n进口备货主流程
start
:建档签约;
:商品备案;
:业务准备;
:系统对接;
:客户预报（PO单）;
:进仓预报;
:商品送到海外仓库;
:库内作业;
:平台销售;
:海外仓打包;
:配干线;
:海外出口申报;
:国内口岸进口申报;
:放行过机;
:快递车入区申报;
:快递揽收;
:快递装车;
:快递跟踪;
stop
@enduml
```

## 5. 跨境电商BC、个人物品CC进口集货主流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 跨境电商BC、个人物品CC\n进口集货主流程
start
:建档签约;
:商品备案;
:业务准备;
:系统对接;
:客户预报;
:海外仓收到小包裹;
:小包裹揽收、称重;
:导出清单;
:配干线;
:海外出口申报;
:国内口岸进口申报;
:放行过机;
:快递车入区申报;
:快递完成打包;
:快递装车;
:快递跟踪;
stop
@enduml
```

## 6. 跨境电商BBC进口备货主流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 跨境电商BBC进口备货主流程
start
:建档签约;
:商品备案;
:业务准备;
:系统对接;
:客户预报;
:货物入区申报;
:货物入仓;
:库内作业;
:平台销售;
:订单申报;
:申报放行;
:下发保税仓;
:库内操作;
:快递车入区申报;
:快递完成打包;
:导出清单;
:快递装车;
:快递出区申报;
:快递跟踪;
stop
@enduml
```
