# 跨境电商BC出口关务详细流程

<a id="mainflow-04"></a>

本文定义跨境电商 BC 出口的查验、申报异常处理，以及转关和非转关主流程。第 3、5 节均描述转关流程，但适用条件尚未区分；主流程总览见《业务模式主流程总览》第 3 节。


## 1. 查验异常处理

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 查验异常处理（子流程）
start
switch (异常情形)
case (少量品名和数量\n与申报不一致)
  :申请清单撤单;
case (敏感物安检不过)
  :退单退场;
case (涉及侵权)
  :记录弃货;
case (超过55%不符/\n重量超3%)
  :删单退场;
endswitch
stop
@enduml
```
## 2. 申报异常处理

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 申报异常处理（子流程）
start
switch (异常情形)
case (清单申报被退单)
  :删除异常订单;
  :重新生成新订单;
  :重新一键申报三单;
  :重新申报清单;
case (清单申报人工审核)
  :生成清单审理表;
  :打印清单审理表;
case (总运单申报异常)
  :撤回总运单;
  :重新申报总运单;
endswitch
stop
@enduml
```
## 3. BC出口主流程（转关模式）

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
title BC出口主流程（转关模式）
start
group 申报与仓储准备 #F4F8FA {
-> 客户提供资料给客服;
:新建订单;
fork
  :接单;
  :资料审核;
  fork
    :一键申报三单;
    -> 单一窗口上的申报回执已收齐;
  fork again
    :录入提单信息;
  end fork
  :清单申报;
  if (清单是否审结放行？) then (是)
  else (否)
    :申报异常处理;
  endif
  :总运单申报;
  if (总运单是否审结放行？) then (是，且货物运抵理货场)
  else (否)
    :申报异常处理;
    -> 货物运抵理货场;
  endif
fork again
  fork
    -> 我司提货入仓;
    :约车;
  fork again
    :接收入仓通知;
  end fork
  :接收包裹;
  :打包过磅;
  :接收出仓通知;
  :约车;
  :车辆进出区登记;
  :装车出库;
end fork
}
group 理货与查验放行 #F5F9F6 {
if (需要理货？) then (是)
  :生成大箱号表格;
else (否，且货物运抵货站)
endif
if (查验？) then (是)
  :安排查验;
  if (查验异常？) then (是)
    :查验异常处理;
    -> 处理完成;
  else (否)
  endif
else (否)
endif
:放行;
}
group 转关与离境 #F8F6FA {
-> 货站出托书后;
:转关单申报;
-> 回执为“海关接收通知”;
:找海关做放行;
-> 线下交单;
:确认交单;
:货物离境;
}
stop
@enduml
```
## 4. BC出口主流程（非转关模式）

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
title BC出口主流程（非转关模式）
start
group 申报与仓储准备 #F4F8FA {
-> 客户提供资料给客服;
:新建订单;
fork
  :接单;
  :资料审核;
  fork
    :一键申报三单;
    -> 单一窗口上的申报回执已收齐;
  fork again
    :录入提单信息;
  end fork
  :清单申报;
  if (清单是否审结放行？) then (是)
  else (否)
    :申报异常处理;
  endif
  :总运单申报;
  if (总运单是否审结放行？) then (是，且货物运抵理货场)
  else (否)
    :申报异常处理;
    -> 货物运抵理货场;
  endif
fork again
  fork
    -> 我司提货入仓;
    :约车;
  fork again
    :接收入仓通知;
  end fork
  :接收包裹;
  :打包过磅;
  :接收出仓通知;
  :约车;
  :车辆进出区登记;
  :装车出库;
end fork
}
group 理货与查验放行 #F5F9F6 {
if (需要理货？) then (是)
  :生成大箱号表格;
else (否，且货物运抵货站)
endif
if (查验？) then (是)
  :安排查验;
  if (查验异常？) then (是)
    :查验异常处理;
  else (否)
  endif
else (否)
endif
:放行;
:申报结关;
}
stop
@enduml
```


## 5. BC出口转关流程（适用条件未区分）

本流程与第 3 节的适用条件尚未区分。本流程不包含“车辆进出区登记”，且“查验”判断未定义“不查验”分支；适用范围明确前，两套转关流程均不得作为唯一业务口径。图中的待确认终点仅标记已知流程边界，不表示业务完成。

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
title BC出口转关流程（适用条件未区分）
start
group 申报与仓储准备 #F4F8FA {
-> 客户提供资料给客服;
:新建订单;
fork
  :接单;
  :资料审核;
  fork
    :一键申报三单;
    -> 单一窗口上的申报回执已收齐;
  fork again
    :录入提单信息;
  end fork
  :清单申报;
  if (清单是否审结放行？) then (是)
  else (否)
    :申报异常处理;
  endif
  :总运单申报;
  if (总运单是否审结放行？) then (是，且货物运抵理货场)
  else (否)
    :申报异常处理;
    -> 货物运抵理货场;
  endif
fork again
  fork
    -> 我司提货入仓;
    :约车;
  fork again
    :接收入仓通知;
  end fork
  :接收包裹;
  :打包过磅;
  :接收出仓通知;
  :约车;
  :装车出库;
end fork
}
group 理货与查验放行 #F5F9F6 {
if (需要理货？) then (是)
  :生成大箱号表格;
else (否，且货物运抵货站)
endif
if (查验？) then (是)
  :安排查验;
  if (查验异常？) then (是)
    :查验异常处理;
    -> 处理完成;
  else (否)
  endif
else (否)
  :不查验时的后续待确认;
  end
endif
:放行;
}
group 转关与离境 #F8F6FA {
-> 货站出托书后;
:转关单申报;
-> 回执为“海关接收通知”;
:找海关做放行;
-> 线下交单;
:确认交单;
:货物离境;
}
stop
@enduml
```
