# 跨境电商BC、个人物品CC进口详细流程

<a id="mainflow-05"></a>

本文定义 BC/CC 进口的入库（备货/集货）、出库（空运/陆运）、退运与退供流程，说明备货与集货、空运与陆运链路的差异。主流程总览见《业务模式主流程总览》第 4、5 节。


## 1. BC、CC关务进口（备货入库）

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BC、CC关务进口（备货入库）
start
:入仓预报;
fork
  :接收预报信息;
fork again
  :发送送货通知;
  -> 客服可查看送货通知;
end fork
:接收入仓信息和送货通知;
if (客户是否自行送货？) then (是)
else (否)
  :约车;
endif
:接收货物;
:开始理货;
:发送理货报告;
if (理货是否存在异常) then (有异常)
  :理货异常处理;
else (无异常)
endif
:确认理货报告;
-> 确认;
:上架;
:上架完成更新库存信息;
:入库完成;
stop
@enduml
```
## 2. BC/CC进口入库（集货）

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BC/CC进口入库（集货）
start
:入仓预报;
fork
  :接收预报信息;
fork again
  :发送送货通知;
  -> 客服可查看送货通知;
end fork
:接收入仓信息和送货通知;
if (客户是否自行送货？) then (是)
else (否)
  :约车;
endif
:接收包裹;
:揽收;
:发送入库清单;
if (入库是否存在异常) then (有异常)
  :入库异常处理;
else (无异常)
endif
:确认入库;
stop
@enduml
```


## 3. BC/CC进口出库（空运/海外提货模式）

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BC/CC进口出库（空运/海外提货模式）
start
:订单;
:预估税金;
:下快递;
:接收订单通知;
:拣货、打包、包裹称重;
:打托、称重;
:导出当天出库明细;
:获得出库明细;
:准备海外出口申报材料;
:收到提单信息;
fork
  :打印提货证明;
  :报关员在货站提货，取提货单;
  -> 订单回执=待运抵，\n货物到达快件中心;
  :发送运抵数据\n给白云快件中心;
fork again
  :录入提单信息，进行申报;
  :订单申报;
  fork
    if (订单是否异常) then (是)
      :订单异常子流程;
    else (否)
      :放行;
    endif
  fork again
    :绑定干线信息;
    :返回干线信息;
  end fork
fork again
  :预约快递车辆;
  :车辆进出区申报;
end fork
:对接白云物流系统，抓取车辆信息;
:车辆入区;
:装车锁库;
:出区;
:跟踪快递;
stop
@enduml
```

## 4. BC/CC进口出库（陆运/中港车模式）

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BC/CC进口出库（陆运/中港车模式）
start
:订单;
:预估税金;
:下快递;
:接收订单通知;
:拣货、打包、包裹称重;
:打托、称重;
:导出当天出库明细;
:获得出库明细;
fork
  :约中港车;
fork again
  :准备过关材料;
  fork
    :收到载货清单信息;
    :维护载货清单和车辆资料表;
  fork again
    :收到过关资料并打印给司机;
    :装车出库;
  end fork
end fork
:录入原始舱单;
:录入承运确报;
:承运确报结果发送给司机;
-> 司机过皇岗口岸;
:在白云快件自助进出区系统\n录入车辆数据;
fork
  :订单申报;
  fork
    if (订单是否异常) then (是)
      :订单异常子流程;
    else (否)
      :放行;
    endif
  fork again
    :绑定干线信息;
    :返回干线信息;
  end fork
fork again
  :预约快递车辆;
  :车辆进出区申报;
fork again
  -> 司机将货送到快件中心;
  :发送运抵数据给白云快件中心;
end fork
:对接白云物流系统，抓取信息;
:车辆入区;
:装车锁库;
:出区;
:跟踪快递;
stop
@enduml
```


## 5. BC/CC退运

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title BC/CC退运
start
:接收退运通知;
if (是否需要上传材料？) then (是)
  if (是否补齐材料) then (是)
    :上传材料;
    :接收生产证明并提交海关;
    stop
  else (否)
  endif
else (否)
  if (是否年度超额退运) then (是，转CC申报)
    :补充CC所需材料给关务做申报;
    stop
  else (否)
  endif
endif
:退运登记;
-> 生成退运登记表并将退运材料发关务;
:申请退运批注;
-> 获得批注;
:机检;
if (是否机检通过) then (是，获得机检无异常批注)
  :退运二次批注;
  -> 批注完成;
  :通知客服约车;
  :约车;
  fork
    :通知仓库理货;
  fork again
    :维护载货清单;
    -> 载货清单和车辆资料表审核通过;
    :录入原始舱单;
    -> 原始舱单审核通过;
    :录入承运确报;
    :承运确报结果发送给司机;
    :白云快件自助进出区系统录入;
  end fork
  :中港车装货到香港仓;
  if (是否需要上架) then (是)
    :理货上架;
  else (否)
    if (是否客户自己提货) then (是)
      :客户自提;
    else (否)
      :寄快递;
    endif
  endif
else (否)
endif
stop
@enduml
```

## 6. 退供流程

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 退供流程
start
:申请退供;
:接收退供单;
:查看客户应付未核销金额;
if (是否允许退供) then (允许)
else (不允许)
  if (是否允许退供) then (允许)
  else (不允许)
    :发起对账单;
    :确认对账单;
    :收款申请;
    :付款;
    :确认收款;
  endif
endif
:接收退供单;
:下架;
:发送下架数据;
:收到下架数据;
if (是否需要约车) then (是)
  :约车;
  :收到车辆信息;
  :装车;
else (否)
  :自提;
endif
stop
@enduml
```
