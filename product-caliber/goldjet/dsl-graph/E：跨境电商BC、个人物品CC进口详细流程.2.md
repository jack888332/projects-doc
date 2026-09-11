# E：跨境电商BC、个人物品CC进口详细流程.2（C_01: BC/CC进口入库（集货））

> 来源：`temp/流程图SVG/E：跨境电商BC、个人物品CC进口详细流程.2.svg`（Visio 流程图），转换为 PlantUML 活动图（新语法）。

```plantuml
@startuml
title C_01: BC/CC进口入库（集货）
start
:1.入仓预报;
fork
  :2A.接收预报信息;
fork again
  :2B.发送送货通知;
  -> 客服可看送货通知;
end fork
:3.接收入仓信息和送货通知;
if (是否客户自己送货) then (是)
else (否)
  :4.约车;
endif
:接收包裹;
:揽收;
:5.发送入库清单;
if (入库是否存在异常) then (有异常)
  :入库异常处理;
else (无异常)
endif
:6.确认入库;
stop
@enduml
```

## 转换说明

- “1.入仓预报”后 2A/2B 两路无条件并行汇入“3.接收入仓信息和送货通知”，按 fork/join 表达。
- 原图中的“文档”类注释形状（入仓计划表、入库清单、库存查看说明等）未纳入流程图。
