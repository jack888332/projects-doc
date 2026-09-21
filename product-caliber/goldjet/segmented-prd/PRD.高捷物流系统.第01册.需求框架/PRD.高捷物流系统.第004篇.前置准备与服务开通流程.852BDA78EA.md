# 第004篇

> 本篇定位：前置准备与服务开通流程；主要内容：建档签约、报价、商品备案、系统配置与服务开通；文档角色：共享规则档；文档ID：852BDA78EA

<a id="doc-852BDA78EA-service-readiness"></a>
## 1. 业务范围

本文定义业务开展前的准备工作（建档签约、报价、商品备案、系统配置），以及订单级服务开通与取消流程。前置准备对应各业务模式主流程中的“建档签约→商品备案→业务准备→系统对接”环节。


<a id="doc-852BDA78EA-section-3d637615e234"></a>
## 2. 前置准备工作详细流程

“准备资料”后分两条无条件并行链：平台签约与系统配置链（平台签约完成→…→准备耗材）、客户合同与商品备案链（维护客户档案→…→获取商品备案信息）；商品备案经预审、审核未通过时通知客户并循环接受意见直至通过。

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
title 前置准备工作详细流程
start
:准备资料;
fork
group 平台与仓库配置 #EDF3F7 {
  :平台签约完成;
  :收到平台对接信息;
  :维护客户店铺资料;
  :查看客户税金和运费;
  :设置客户信用等级;
  :创建仓库;
  :创建自动寻源规则;
  :通知仓库准备耗材/\n库内操作规范;
  :准备耗材;
}
fork again
group 客户建档与合同 #EEF5F0 {
  :维护客户档案;
  :维护店铺信息;
  :签订合同;
  :获取合同信息;
}
group 报价与备案准备 #F3EFF8 {
  fork
    :设置报价规则;
  fork again
    :发送客户指引;
    fork
      :税金和运费充值;
    fork again
      :填写商品备案信息;
      :预审;
    end fork
  end fork
}
group 备案审核 #EDF5F7 {
  while (是否审核通过) is (否)
    :通知客户;
    :收到意见;
    :接受意见;
  endwhile (是)
  :获取商品备案信息;
}
end fork
stop
@enduml
```
<a id="doc-852BDA78EA-section-8ff188da5d52"></a>
## 3. 服务添加或取消子流程

按“合同条款是否已包含该服务”与“客户是否需要该服务”两个判断决定：已包含且需要则添加本次运输费用项、已包含但不需要则移除本次运输费用项、未包含但需要则先添加合同补充条款。

```plantuml
@startuml
skinparam activityDiamondBackgroundColor #FFF4CC
title 服务添加或取消子流程
start
if (合同条款包含该服务？) then (是)
  if (客户需要该服务？) then (是)
    :添加本次运输费用项;
  else (否)
    :移除本次运输费用项;
  endif
else (否)
  if (客户需要该服务？) then (是)
    :添加合同补充条款;
  else (否)
  endif
endif
stop
@enduml
```
