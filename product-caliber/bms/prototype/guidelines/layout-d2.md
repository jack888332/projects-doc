# D2 节点关系图布局规则

本文说明 D2 如何把节点、容器和连接转换为最终几何布局，并给出两个可直接渲染的完整案例：

- 第三章：业务对象泳道图，重点解决分组顶对齐、底对齐和内部卡片栅格化；
- 第四章：系统架构图，重点解决主区等宽、左右区域等高和多行多列矩阵。

文中示例已使用 D2 v0.7.1 执行 `d2 validate` 并渲染为 SVG。若 Markdown Preview Enhanced（MPE）内置的 D2 版本不同，应以实际渲染器支持的语法为准。

---

## 第一章　从 D2 语义到可控布局

### 1.1 D2 与布局引擎的关系

D2 不是一种“按源码坐标绘图”的语言。通常的处理过程是：

```text
D2 源码
  ↓
解析节点、容器、连接、类和 glob
  ↓
计算文本、图标、节点尺寸
  ↓
原生 Grid 先建立确定性的行列结构
  ↓
Dagre / ELK 等布局引擎处理其余图结构
  ↓
连接路由、标签定位和 SVG 渲染
```

因此，最终位置同时受两套机制影响：

1. **D2 原生结构规则**：容器、`grid-rows`、`grid-columns`、尺寸、声明顺序等；
2. **布局引擎规则**：根据图的方向、连接、层级、容器边界和节点尺寸计算位置与路线。

这也是理解 D2 布局的关键：**需要精确行列关系时使用 Grid；需要自动层次和避障连线时交给布局引擎。**

### 1.2 选择布局引擎

D2 默认使用 Dagre。本文第四章的网格化架构案例使用 ELK，第三章的高密度关系案例使用另外安装的 TALA：

```d2
vars: {
  d2-config: {
    layout-engine: elk
    sketch: false
  }
}
```

`sketch: false` 显式关闭手绘模式，使节点边框和连线保持规则的工程制图风格。命令行参数和环境变量的优先级高于 `d2-config`；如果外部渲染器强制传入 `--sketch`，还需要同时关闭外部渲染器的手绘选项。

命令行也可以选择引擎：

```powershell
d2 --layout=elk input.d2 output.svg
```

常用命令：

```powershell
d2 layout
d2 layout dagre
d2 layout elk
d2 layout tala
d2 validate input.d2
```

选择建议：

| 场景 | 建议引擎 | 原因 |
|---|---|---|
| 小型流程图、简单依赖图 | Dagre | 默认、快速、层次结构清楚 |
| 多容器系统架构图 | ELK | 容器间路由和正交连线更成熟 |
| SQL 表字段级连线 | ELK | 可把连接精确路由到字段 |
| Grid 内部存在大量关系 | TALA | 可以为 Grid 单元格关系寻路，而不是固定为中心直线 |
| 强调对称性的海报式图形 | Grid 优先 | Dagre、ELK 都不会保证视觉对称 |
| 需要绝对坐标 | TALA | `top`、`left` 只适用于 TALA |

TALA 不随 D2 捆绑，需要把 `d2plugin-tala` 单独安装到 `PATH`。它是闭源商业布局引擎，可以免费评估，但未配置许可证时可能带评估水印；不能把依赖 TALA 的案例视为只安装 D2 即可渲染的开源链路。

### 1.3 影响布局的参数总览

下表按“从强约束到弱影响”的顺序列出常用布局输入。

| 类别 | 参数或语法 | 主要作用 | 约束强度 |
|---|---|---|---|
| 引擎 | `layout-engine`、`--layout` | 决定整体布局算法与路由能力 | 全局 |
| 总方向 | `direction: up/down/left/right` | 指定层次图主要展开方向 | 全局强影响 |
| 网格 | `grid-rows`、`grid-columns` | 建立确定的行列结构 | 强约束 |
| 网格顺序 | 两个 `grid-*` 的出现顺序 | 决定按行还是按列填充 | 强约束 |
| 网格间距 | `grid-gap` | 同时设置横向和纵向间距 | 强约束 |
| 网格间距 | `horizontal-gap`、`vertical-gap` | 分别覆盖横向、纵向间距 | 强约束 |
| 结构 | 容器嵌套 | 定义分组、作用域和边界 | 强影响 |
| 尺寸 | `width`、`height` | 固定大多数普通节点的尺寸 | 强约束 |
| 内容 | `label`、字段、Markdown、图标 | 决定自动尺寸和最小空间 | 强影响 |
| 连接 | `--`、`->`、`<-`、`<->` | 定义拓扑、方向和路由需求 | 强影响 |
| 连接文本 | 普通标签、箭头端标签 | 增加路线周围的文字占用 | 中等影响 |
| 外围定位 | `near` 常量 | 把标题、图例放在画布周围 | 局部强约束 |
| 复用 | `classes` | 统一节点尺寸、样式和形状 | 间接影响 |
| 批量规则 | `*`、`**` 等 glob | 批量应用尺寸、类和样式 | 间接影响 |
| 文字样式 | `font-size`、`font`、`bold`、`italic` | 改变文字测量，进而改变自动尺寸 | 中等影响 |
| 外观样式 | `stroke-width`、`border-radius`、`3D`、`multiple` 等 | 改变轮廓或渲染占用 | 弱到中等 |
| 纯视觉样式 | `fill`、`stroke`、`stroke-dash`、`font-color` | 通常不改变节点排列 | 弱影响 |
| 隐形占位 | `style.opacity: 0` | 不显示但保留布局位置 | 强约束 |

这里的“约束强度”不是优先级语法，而是对最终几何结果的实际影响程度。

### 1.4 `direction` 只控制总体流向

可选值：

```d2
direction: down
```

```text
up    向上展开
down  向下展开
left  向左展开
right 向右展开
```

需要注意：

- 对 Dagre 和 ELK，`direction` 只能全局设置；
- 它指定的是主要层次方向，不等于逐个节点的绝对位置；
- 同层节点的左右或上下次序仍由引擎根据交叉数、容器和尺寸综合决定；
- Grid 内部的位置由行列规则控制，不依赖引擎猜测。

### 1.5 容器同时表达业务分组和布局边界

容器可以用嵌套语法定义：

```d2
platform: 平台 {
  gateway: 网关
  service: 业务服务
}
```

也可以使用点路径：

```d2
platform.gateway: 网关
platform.service: 业务服务
```

容器带来四项布局影响：

1. 子节点需要被容器包围；
2. 容器会为边框、标题和内边距预留空间；
3. 跨容器连接需要穿越容器边界；
4. 容器嵌套会增加整体宽高，不能把它当作“零尺寸分组标签”。

ELK 对容器到容器、容器子节点到其他容器的路由支持通常优于 Dagre。Dagre 对“祖先容器连接到后代节点”等关系还存在限制。

### 1.6 节点尺寸与容器尺寸

大多数普通节点可以直接指定尺寸：

```d2
api: API {
  width: 220
  height: 90
}
```

基本规则：

- 未指定尺寸时，D2 根据标签、字段、图标和形状计算尺寸；
- 同类卡片需要等宽时，优先把 `width` 放入公共类；
- 同类卡片需要等高时，可以统一 `height`，也可以放进同一 Grid 行；
- 文本换行、字体大小、字段数量都会改变自动高度；
- 不要为了“看起来差不多”给每个节点重复写尺寸。

容器通常根据子节点自动伸缩。D2 的引擎能力表指出，**ELK 支持在容器上设置 `width`、`height`，Dagre 不支持这一能力**。因此本文案例固定容器宽度时明确选用 ELK。即便使用 ELK，也应把容器尺寸视为构图手段，而不是跨引擎可移植规则。

### 1.7 Grid 是精确对齐的首选机制

#### 1.7.1 只指定列数

```d2
services: {
  grid-columns: 4
  a
  b
  c
  d
}
```

节点依次填入列。只指定一个维度时，Grid 会让单元格扩展以填满可用空间。

#### 1.7.2 只指定行数

```d2
services: {
  grid-rows: 3
  a
  b
  c
}
```

#### 1.7.3 同时指定行列数

```d2
services: {
  grid-rows: 3
  grid-columns: 4
}
```

两个参数都存在时，**源码中先出现的参数决定主填充方向**：

- `grid-rows` 先出现：先填满一行，再进入下一行；
- `grid-columns` 先出现：先填满一列，再进入下一列。

例如，以下代码是常见的 4 列 × 3 行、按行填充：

```d2
services: {
  grid-rows: 3
  grid-columns: 4

  a
  b
  c
  d
  e
}
```

#### 1.7.4 Grid 的等宽、等高规则

Grid 的基础几何规则是：

- 同一列中的单元格等宽；
- 同一行中的单元格等高；
- 某个单元格内容变大时，会推高整行或推宽整列；
- 不完整的最后一行可以用透明节点补齐；
- Grid 可以嵌套 Grid。

这比依靠布局引擎“尽量对齐”更确定。

#### 1.7.5 间距

```d2
grid-gap: 24
horizontal-gap: 32
vertical-gap: 18
```

规则：

- `grid-gap` 同时设置横、纵间距；
- `horizontal-gap` 覆盖横向间距；
- `vertical-gap` 覆盖纵向间距；
- `grid-gap: 0` 可用于表格、拼图式结构。

### 1.8 声明顺序何时影响位置

普通自动布局中，声明顺序不是严格坐标约束。引擎可能为了减少交叉而重排节点。

声明顺序在以下场景中具有明确作用：

1. Grid 按声明顺序填充单元格；
2. 两个 `grid-*` 参数的出现顺序决定主填充方向；
3. 同一 Grid 中增加或删除节点会使后续节点整体移位；
4. 多个同构方案都可行时，声明顺序可能成为引擎的稳定性输入，但不应把它当作强保证。

需要固定矩阵顺序时，不要仅调整普通节点的源码顺序，应显式使用 Grid。

### 1.9 连接既表达语义，也影响自动布局

D2 支持四种基本连接：

```d2
a -- b
a -> b
a <- b
a <-> b
```

对 Dagre、ELK 这类层次布局引擎，连接会参与：

- 层次划分；
- 同层节点排序；
- 交叉最小化；
- 容器间路由；
- 整体宽高计算。

需要区分两种情况：

#### Grid 外或 Grid 之间的连接

通常由布局引擎路由，ELK 可以生成较整洁的正交路线。

#### 同一 Grid 内部单元格之间的连接

Grid 已经在布局引擎之外固定了单元格位置，布局引擎不能再进行路径搜索。因此这类连接采用中心到中心的直线段，**不会避开其他单元格**。

由此得到一条实用原则：

> 大量复杂关系需要避障时，让引擎负责节点布局；严格矩阵优先时使用 Grid，并控制可见连线数量。

### 1.10 `classes` 与 glob：减少重复而不牺牲布局

公共尺寸和样式应放入类：

```d2
classes: {
  card: {
    width: 220
    height: 90
    style.border-radius: 6
  }
  service-card: {
    style.fill: "#8DDE28"
  }
}

order.class: [card; service-card]
```

多个类按从左到右的顺序应用，后面的类可以覆盖前面的类。节点自身声明的属性又可以覆盖类。

同一作用域内大量同类节点，可以使用 glob：

```d2
services: {
  portal
  member
  order

  *.class: [card; service-card]
}
```

使用建议：

- `classes` 用于定义可命名、可复用的设计规则；
- glob 用于批量把规则应用到某个作用域；
- 业务节点保留语义化 ID，不在每个节点重复尺寸和颜色；
- 跨层级 glob 使用 `**` 时要留意它会递归匹配叶子节点。

### 1.11 会改变几何或视觉占用的 Style 属性

`width`、`height`、`grid-*` 不是 Style 属性。Style 主要控制外观，但部分属性会通过文本测量或轮廓影响最终占用。

#### 会明显改变自动尺寸

| Style 属性 | 影响 |
|---|---|
| `font-size` | 改变标签、字段和连接文字尺寸 |
| `font` | 字体度量不同，可能改变换行和宽度 |
| `bold`、`italic` | 可能改变文字宽度或边界 |

#### 可能改变轮廓或渲染占用

| Style 属性 | 影响 |
|---|---|
| `stroke-width` | 改变边框粗细 |
| `border-radius` | 改变节点圆角；ELK 的折线连接也可使用 |
| `shadow` | 增加视觉外延 |
| `3D`、`multiple`、`double-border` | 增加额外轮廓 |

#### 通常只改变外观

```text
fill
fill-pattern
stroke
stroke-dash
font-color
underline
text-transform
animated
```

需要特别注意：

```d2
pad: "" {
  width: 220
  height: 90
  style.opacity: 0
}
```

`opacity: 0` 只隐藏绘制结果，节点仍然占用 Grid 单元格。这是补齐不完整矩阵和精确对齐的常用方法。

#### 样式配置顺序与覆盖优先级

本项目按以下顺序配置样式：

```text
D2 主题 → 具体对象的 D2 Style → 文档内嵌 <style>
```

这里表达的是“先用哪一层解决问题”，不是发生冲突时谁优先。各层职责如下：

| 顺序 | 层级 | 适用范围 |
|---|---|---|
| 1 | `theme-id`、`theme-overrides` | 定义整张图的基础色板和默认外观 |
| 2 | `classes`、glob、节点或连接的 `style` | 覆盖特定业务对象和关系 |
| 3 | Markdown 内嵌 `<style>` | 补足 D2 无法独立控制的 SVG 细节和 MPE 显示行为 |

若三层设置了同一属性，实际覆盖方向通常相反：具体对象覆盖主题；带足够选择器优先级或 `!important` 的内嵌 CSS 又可以覆盖已经生成到 SVG 中的对象样式。因此 `<style>` 是最后手段，不应重复声明主题或 D2 Style 已经能够稳定表达的属性。

### 1.12 `near` 不等于相对节点定位

Dagre 和 ELK 支持把标题、图例等对象放到画布周边：

```d2
title: 系统架构图 {
  near: top-center
}
```

常量包括：

```text
top-left       top-center       top-right
center-left                     center-right
bottom-left    bottom-center    bottom-right
```

但对 Dagre 和 ELK：

- `near` 不能把一个业务节点定位到另一个业务节点附近；
- `top`、`left` 不能锁定绝对坐标；
- 这些能力只在 TALA 中提供。

因此，本文案例不使用 `near` 控制业务节点位置。

### 1.13 常用对齐配方

| 目标 | 推荐写法 |
|---|---|
| 多个分组顶、底对齐 | 把分组放入同一个 Grid 行 |
| 多个分组等宽 | 把分组放入同一个 Grid 列，或在 ELK 中统一容器 `width` |
| 一组卡片等宽 | 公共类设置 `width` |
| 一组卡片等高 | 公共类设置 `height`，或放入同一 Grid 行 |
| 4 × 3 服务矩阵 | `grid-rows: 3` 先写，再写 `grid-columns: 4` |
| 3 × 4 按列填充 | `grid-columns: 3` 先写，再写 `grid-rows: 4` |
| 最后一行缺单元格 | 添加 `opacity: 0` 的同尺寸占位节点 |
| 左侧上下两组与右侧一组可见边界等高 | 左右都增加透明包装，外层 Grid 对齐包装层，内部再统一留白与可见高度 |
| 多容器正交连线 | 使用 ELK，并尽量减少跨越多层容器的连接 |

---

## 第二章　Dagre 与 ELK 的布局机制

### 2.1 层次布局的共同过程

Dagre 和 ELK 都属于层次布局引擎。可以把它们的核心过程理解为：

```text
读取有向图
  ↓
处理环和方向
  ↓
把节点分配到不同层
  ↓
调整同层顺序以减少交叉
  ↓
计算节点坐标和层间距离
  ↓
计算连接路线
```

这里的“层”与 `direction` 相关：

- `direction: down`：层从上到下排列；
- `direction: right`：层从左到右排列。

连接越多、跨层越远、容器嵌套越深，引擎需要协调的约束越复杂。

### 2.2 Dagre 的特点

Dagre 是 D2 默认引擎，基于 Graphviz DOT 所采用的层次布局思想。

优点：

- 启动快；
- 适合小型有向流程；
- 普通层次结构结果通常清晰。

局限：

- 算法严格偏向层次图；
- 复杂容器关系依赖 D2 的兼容处理；
- 多段路线通常是曲线而不是正交折线；
- 容器子节点跨容器连接时，结果可能不如 ELK 稳定。

适合：

```text
线性流程
树状依赖
少量分组
对容器路由要求不高的图
```

### 2.3 ELK 的特点

ELK 同样是层次布局引擎，但在复杂容器和正交路由方面更成熟。

优点：

- 正交路线清晰；
- 交叉最小化能力较好；
- 原生支持容器到容器的路由；
- 对复杂系统架构图更合适；
- 支持 SQL 表字段级连接；
- D2 能在 ELK 下设置容器尺寸。

局限：

- 仍然是严格的层次布局，不保证镜像对称；
- 某些路线会产生额外折点；
- 连接很多时，自动结果仍可能与人工排版预期不同。

### 2.4 Grid 与布局引擎如何分工

Grid 不是 Dagre 或 ELK 的一个“参数”，而是 D2 在布局阶段施加的结构规则。

可以按以下原则分工：

```text
Grid
├─ 固定行列
├─ 等宽、等高
├─ 声明顺序
└─ 不完整矩阵补位

Dagre / ELK
├─ 自动层次
├─ 交叉最小化
├─ 容器摆放
└─ 路由与避障
```

一个图可以同时使用两者，但要接受 Grid 内部连接不做路径搜索的限制。

### 2.5 为什么修改一个节点会让全图移动

自动布局是全局求解，不是给每个节点独立分配坐标。以下任一变化都可能触发整体重排：

- 标签变长导致节点变宽；
- 字段增加导致节点变高；
- 新增一条跨容器连接；
- 改变连接方向；
- 增加或删除 Grid 单元格；
- 改变容器嵌套；
- 改变 `direction` 或布局引擎。

因此，维护复杂图时应把“布局骨架”和“业务内容”分开：

1. 先稳定外层 Grid；
2. 再稳定每个分组的内部 Grid；
3. 然后加入卡片内容；
4. 最后逐条加入业务连接。

### 2.6 D2 中不存在 PlantUML 的线长语法

D2 的 `--`、`->`、`<-`、`<->` 表示连接类型，不通过增加连字符数量表达期望距离。下面并不是 D2 的不同长度写法：

```text
--
---
----
```

需要增加距离时，应使用：

- Grid 的 `horizontal-gap`、`vertical-gap`；
- 节点或容器尺寸；
- 容器层级；
- 布局引擎自身的可用配置；
- 必要时使用透明占位节点。

### 2.7 推荐的调试顺序

遇到布局异常时按以下顺序排查：

1. 删除样式，仅保留节点、容器和连接；
2. 确认 `direction` 和布局引擎；
3. 检查 Grid 的行列数与参数出现顺序；
4. 检查声明顺序是否与预期填充顺序一致；
5. 给同类节点设置统一 `width`、`height`；
6. 检查容器嵌套是否引入额外内边距；
7. 暂时移除跨容器连接；
8. 逐条恢复连接，定位导致重排或交叉的关系；
9. 最后恢复颜色、圆角和字体。

---

## 第三章　完整案例：业务对象泳道图

### 3.1 布局目标

本案例要求：

- 三个业务分组从左到右排列；
- 三个分组顶部、底部严格对齐；
- 中间分组使用两个独立的单列卡片栈；
- 左右分组使用单列卡片；
- 卡片等宽；
- 所有 class 标题区等高；
- 三个泳道中的可见卡片垂直间距统一为 `80px`；
- 左侧业务列使用透明补位节点维持两列结构平衡；
- 保留 PlantUML 案例中的完整业务关系和关系说明；
- 使用 Crow's Foot 端点表达一对多、一对一和多对一；
- 使用白色图纸背景、低饱和分区色、圆角类卡片和细实线连接。

核心骨架是：

```text
lanes：1 行 × 3 列
├─ master：1 列
│  └─ master_column：1 列，vertical-gap = 80
├─ business：2 列
│  ├─ left_column：1 列，vertical-gap = 80
│  └─ right_column：1 列，vertical-gap = 80
└─ result：1 列
   └─ result_column：1 列，vertical-gap = 80
```

三组位于外层 Grid 的同一行，所以 D2 自动把它们调整为同一高度。这里不需要模拟隐藏连线，也不需要人工计算透明锚点。

### 3.2 完整 D2 源码

MPE 将 D2 输出作为内嵌 SVG 插入页面。本图通过空样式类 `diagram-3-1` 建立唯一编号，并把它挂到最外层 `lanes` 容器；D2 会把该类名保留到生成的 SVG `<g>` 元素中。下面所有页面级规则都先用 `:has(g.diagram-3-1)` 锁定这张图，再调整 class 标题、字段颜色与字号、横向关系标签和泳道标题的位置：
  
  ```css
  /* 仅选择 class 正文中的字段文字，排除标题和带主题填充类的符号。 */
  .markdown-preview .d2-diagram:has(g.diagram-3-1) .class_header ~ text.text-mono:not([class*="fill-"]):not(:first-of-type) {
    /* 将字段文字固定为黑色，避免受 D2 主题颜色影响。 */
    fill: #000000 !important;
    /* 单独设置字段字号，不改变 D2 计算出的卡片几何尺寸。 */
    font-size: 14px !important;
  }
  /* 选择紧跟在 class 标题背景之后的标题文字。 */
  .markdown-preview .d2-diagram:has(g.diagram-3-1) .class_header + text.text-mono {
    /* 单独设置 class 标题字号，不改变标题区块高度。 */
    font-size: 16px !important;
  }
  /* 仅选择带 horizontal-label 标记的横向关系文字。 */
  .markdown-preview .d2-diagram:has(g.diagram-3-1) g.horizontal-label > text {
    /* 将横向关系文字下移，使其视觉中心更靠近连线。 */
    transform: translateY(5px);
  }
  /* 选择三个泳道容器的直接标题文字。 */
  .markdown-preview .d2-diagram:has(g.diagram-3-1) g.lane > text {
    /* 将泳道标题下移，缩短标题与首张 class 的视觉距离。 */
    transform: translateY(20px);
  }
  /* 让编号为 diagram-3-1 的外层容器按 SVG 内容收缩，并取消内部滚动区域。 */
  .markdown-preview .d2-diagram:has(g.diagram-3-1) {
    /* 让容器宽度跟随内容。 */
    width: fit-content;
    /* 不用预览区宽度限制容器。 */
    max-width: none;
    /* 超出容器时直接显示，不生成容器滚动条。 */
    overflow: visible !important;
  }
  /* 只匹配内部含 diagram-3-1 编号标记的 D2 SVG。 */
  .markdown-preview .d2-diagram > svg:has(g.diagram-3-1) {
    /* 使用块级盒，消除行内 SVG 的基线空隙。 */
    display: block;
    /* 保留 SVG 的固有宽度。 */
    width: auto !important;
    /* 按宽高比自动计算高度。 */
    height: auto !important;
    /* 取消预览区对 SVG 最大宽度的限制。 */
    max-width: none !important;
    /* 将整张泳道图按实际 SVG 尺寸缩放到 70%。 */
    zoom: 0.7;
  }
  ```

<style>
/* 仅选择 class 正文中的字段文字，排除标题和带主题填充类的符号。 */
.markdown-preview .d2-diagram:has(g.diagram-3-1) .class_header ~ text.text-mono:not([class*="fill-"]):not(:first-of-type) {
  /* 将字段文字固定为黑色，避免受 D2 主题颜色影响。 */
  fill: #000000 !important;
  /* 单独设置字段字号，不改变 D2 计算出的卡片几何尺寸。 */
  font-size: 14px !important;
}
/* 选择紧跟在 class 标题背景之后的标题文字。 */
.markdown-preview .d2-diagram:has(g.diagram-3-1) .class_header + text.text-mono {
  /* 单独设置 class 标题字号，不改变标题区块高度。 */
  font-size: 16px !important;
}
/* 仅选择带 horizontal-label 标记的横向关系文字。 */
.markdown-preview .d2-diagram:has(g.diagram-3-1) g.horizontal-label > text {
  /* 将横向关系文字下移，使其视觉中心更靠近连线。 */
  transform: translateY(5px);
}
/* 选择三个泳道容器的直接标题文字。 */
.markdown-preview .d2-diagram:has(g.diagram-3-1) g.lane > text {
  /* 将泳道标题下移，缩短标题与首张 class 的视觉距离。 */
  transform: translateY(20px);
}
/* 让编号为 diagram-3-1 的外层容器按 SVG 内容收缩，并取消内部滚动区域。 */
.markdown-preview .d2-diagram:has(g.diagram-3-1) {
  /* 让容器宽度跟随内容。 */
  width: fit-content;
  /* 不用预览区宽度限制容器。 */
  max-width: none;
  /* 超出容器时直接显示，不生成容器滚动条。 */
  overflow: visible !important;
}
/* 只匹配内部含 diagram-3-1 编号标记的 D2 SVG。 */
.markdown-preview .d2-diagram > svg:has(g.diagram-3-1) {
  /* 使用块级盒，消除行内 SVG 的基线空隙。 */
  display: block;
  /* 保留 SVG 的固有宽度。 */
  width: auto !important;
  /* 按宽高比自动计算高度。 */
  height: auto !important;
  /* 取消预览区对 SVG 最大宽度的限制。 */
  max-width: none !important;
  /* 将整张泳道图按实际 SVG 尺寸缩放到 70%。 */
  zoom: 0.7;
}
</style>

所有规则都以 `:has(g.diagram-3-1)` 限定到编号为 `diagram-3-1` 的本章泳道图。其中缩放规则通过 `zoom: 0.7` 按实际 SVG 尺寸显示为 `70%`；其他 D2 案例不受影响。可由 `<style>` 完成的显示设置统一留在这里，不再通过 D2 命令参数或外部包装脚本重复控制。

```d2
vars: {
  d2-config: {
    layout-engine: tala
    sketch: false
    pad: 0
  }
}

direction: right

classes: {
  diagram-3-1: {}
  lane: {
    style: {
      stroke-width: 1
      border-radius: 10
      font-size: 18
      bold: true
    }
  }
  lane-master: {
    style.fill: "#F4F8FF"
    style.stroke: "#BFD7F2"
  }
  lane-business: {
    style.fill: "#F8F6FF"
    style.stroke: "#D4C9F2"
  }
  lane-result: {
    style.fill: "#F3FBF7"
    style.stroke: "#BFDCCE"
  }
  card: {
    shape: class
    width: 280
    style: {
      stroke: "#FFFFFF"
      stroke-width: 1
      border-radius: 10
      font-size: 10
      font-color: "#000000"
    }
  }
  card-master: {
    style.fill: "#E8ECF2"
  }
  card-business: {
    style.fill: "#ECEAF2"
  }
  card-result: {
    style.fill: "#E7EEEB"
  }
  layout-column: {
    style: {
      fill: transparent
      stroke: transparent
    }
  }
  relation: {
    style: {
      stroke: "#27313D"
      stroke-width: 1
      font-size: 12
      font-color: "#4B5565"
    }
  }
  horizontal-label: {}
  one-to-many: {
    source-arrowhead.shape: cf-one-required
    target-arrowhead.shape: cf-many-required
  }
  one-to-one: {
    source-arrowhead.shape: cf-one-required
    target-arrowhead.shape: cf-one-required
  }
  many-to-one: {
    source-arrowhead.shape: cf-many-required
    target-arrowhead.shape: cf-one-required
  }
}

lanes: {
  label: ""
  class: diagram-3-1
  grid-columns: 3
  horizontal-gap: 64
  style: {
    fill: transparent
    stroke: transparent
  }

  master: 主数据对象 {
    grid-columns: 1
    horizontal-gap: 0
    vertical-gap: 0
    class: [lane; lane-master]

    master_column: "" {
      grid-columns: 1
      vertical-gap: 80
      class: layout-column

      supplier: 供应商 {
        "供应商ID": ""
        "供应商名称": ""
        "供应商类型（物流/仓储/尾程/报关）": ""
        "结算币种": ""
        "对账周期": ""
        "税率/发票类型": ""
        "状态": ""
      }
      cost_item: 费用项目 {
        "费用项目ID": ""
        "费用名称": ""
        "费用类别": ""
        "计费单位": ""
        "是否可分摊": ""
        "入账方向（应付/成本）": ""
      }
      allocation_rule: 分摊规则 {
        "规则ID": ""
        "适用范围": ""
        "分摊方式": ""
        "优先级": ""
        "舍入规则": ""
        "生效时间": ""
      }
      supplier_rate: 线路报价 {
        "报价ID": ""
        "供应商ID": ""
        "线路ID": ""
        "单价规则": ""
        "起步价/最低消费": ""
        "附加费规则": ""
        "生效区间": ""
      }

      *.class: [card; card-master]
    }
  }

  business: 业务单据对象 {
    grid-columns: 2
    horizontal-gap: 0
    vertical-gap: 0
    class: [lane; lane-business]

    left_column: "" {
      grid-columns: 1
      vertical-gap: 80
      class: layout-column

      order: 集运订单 {
        class: [card; card-business]
        "订单ID": ""
        "客户ID": ""
        "线路ID": ""
        "仓库ID": ""
        "计费重量/体积": ""
        "包裹数": ""
        "出库时间": ""
        "状态": ""
      }
      batch: 航运批次 {
        class: [card; card-business]
        "批次ID": ""
        "供应商ID": ""
        "线路ID": ""
        "总重量/总体积": ""
        "发运时间": ""
        "批次状态": ""
      }
      pad: "" {
        width: 280
        height: 190
        style.opacity: 0
      }
    }

    right_column: "" {
      grid-columns: 1
      vertical-gap: 80
      class: layout-column

      package: 包裹 {
        class: [card; card-business]
        "包裹ID": ""
        "订单ID": ""
        "重量": ""
        "体积": ""
        "件数": ""
        "商品类型（普货/特货）": ""
      }
      cost_bill: 供应商成本单 {
        class: [card; card-business]
        "成本单ID": ""
        "供应商ID": ""
        "批次ID": ""
        "费用项目ID": ""
        "原始金额": ""
        "币种": ""
        "含税/未税": ""
        "单据状态": ""
      }

      bill_detail: 供应商账单明细 {
        class: [card; card-business]
        "明细ID": ""
        "成本单ID": ""
        "费用项": ""
        "数量": ""
        "单价": ""
        "金额": ""
        "可分摊标识": ""
      }
    }
  }

  result: 成本核算结果对象 {
    grid-columns: 1
    horizontal-gap: 0
    vertical-gap: 0
    class: [lane; lane-result]

    result_column: "" {
      grid-columns: 1
      vertical-gap: 80
      class: layout-column

      allocation: 订单成本分摊单 {
        "分摊单ID": ""
        "来源成本单ID": ""
        "分摊规则ID": ""
        "批次ID": ""
        "分摊状态": ""
        "分摊时间": ""
      }
      order_cost: 订单成本明细 {
        "明细ID": ""
        "订单ID": ""
        "费用项目ID": ""
        "分摊基础值": ""
        "分摊比例": ""
        "分摊金额": ""
        "币种": ""
      }
      order_pl: 订单利润汇总 {
        "订单ID": ""
        "订单收入": ""
        "订单总成本": ""
        "毛利": ""
        "毛利率": ""
      }
      ap_statement: 应付结算单 {
        "结算单ID": ""
        "供应商ID": ""
        "账期": ""
        "应付金额": ""
        "对账状态": ""
        "付款状态": ""
      }

      *.class: [card; card-result]
    }
  }
}

lanes.master.master_column.supplier <-> lanes.business.left_column.order: {
  class: [relation; one-to-many]
}
lanes.business.left_column.order <-> lanes.business.right_column.package: 包含 {
  class: [relation; horizontal-label; one-to-many]
}
lanes.business.right_column.package <-> lanes.result.result_column.allocation: 驱动分摊 {
  class: [relation; horizontal-label; one-to-many]
}

lanes.master.master_column.cost_item <-> lanes.business.left_column.batch: 产生应付成本 {
  class: [relation; horizontal-label; one-to-many]
}
lanes.master.master_column.allocation_rule <-> lanes.business.left_column.batch: 定义费用类型 {
  class: [relation; horizontal-label; one-to-many]
}
lanes.master.master_column.supplier_rate <-> lanes.business.left_column.batch: 提供报价 {
  class: [relation; horizontal-label; one-to-many]
}

lanes.business.left_column.batch <-> lanes.business.left_column.order: 归集订单 {
  class: [relation; one-to-many]
}
lanes.business.left_column.batch <-> lanes.business.right_column.cost_bill: 发生批次成本 {
  class: [relation; horizontal-label; one-to-many]
}
lanes.business.right_column.cost_bill <-> lanes.result.result_column.allocation: 沉淀成本 {
  class: [relation; horizontal-label; one-to-many]
}
lanes.business.right_column.cost_bill <-> lanes.result.result_column.order_cost: 作为分摊来源 {
  class: [relation; horizontal-label; one-to-many]
}
lanes.business.right_column.cost_bill <-> lanes.business.right_column.bill_detail: 拆分明细 {
  class: [relation; one-to-many]
}

lanes.result.result_column.allocation <-> lanes.result.result_column.order_cost: 分摊到订单 {
  class: [relation; one-to-many]
}
lanes.business.right_column.bill_detail <-> lanes.result.result_column.order_pl: 汇总利润 {
  class: [relation; horizontal-label; one-to-one]
}
lanes.business.right_column.bill_detail <-> lanes.result.result_column.ap_statement: 进入对账结算 {
  class: [relation; horizontal-label; many-to-one]
}
```

### 3.3 三个分组如何顶、底对齐

决定三组对齐的是外层：

```d2
lanes: {
  grid-columns: 3

  master
  business
  result
}
```

因为只声明了三列，三个分组被放在同一行。同一 Grid 行中的单元格等高，所以最高的分组决定整行高度，另外两个分组扩展到相同高度。

这是一种结构约束，不依赖布局引擎把三个容器“碰巧”排成等高。

### 3.4 中间分组的卡片顺序

中间分组不再把五张 class 直接放进 3 × 2 Grid，而是先建立两个透明列容器：

```d2
business: {
  grid-columns: 2
  horizontal-gap: 0
  vertical-gap: 0

  left_column: "" {
    grid-columns: 1
    vertical-gap: 80
    class: layout-column

    order
    batch
    pad
  }

  right_column: "" {
    grid-columns: 1
    vertical-gap: 80
    class: layout-column

    package
    cost_bill
    bill_detail
  }
}
```

`business` 的 Grid 只负责把两个列容器横向排列；真正控制业务卡片上下顺序的是 `left_column` 和 `right_column` 内部的单列 Grid。这样具有三个直接效果：

1. class 不再与另一列中字段数量不同的 class 共享同一 Grid 行，因而不会被强制等高；
2. 所有 class 保留内容驱动的自然高度，标题区统一为默认的 `72px`；
3. 两个业务列与左右泳道都显式使用 `vertical-gap: 80`，实际可见卡片间距保持一致。

业务泳道的外层横、纵间距都设为 `0`。两个透明列容器各自在 class 左右保留 `60px`，因此两列 class 之间最终形成 `120px` 的可见间距；无需在外层再叠加额外间距。

主数据和核算结果采用相同的“泳道 → 透明列容器 → class”层级。三个泳道采用同一内部列间距；按本例 TALA 配置渲染后，首张 class 距泳道顶部均为 `111px`，距左右边界均为 `60px`。

### 3.5 透明补位节点的作用

右列有三张卡片，左列只有两张真实卡片。左列末尾增加透明 `pad`，使两个列容器在外层 Grid 中保持稳定的结构平衡：

```d2
left_column: "" {
  grid-columns: 1
  vertical-gap: 80
  class: layout-column

  order
  batch
  pad: "" {
    width: 280
    height: 190
    style.opacity: 0
  }
}
```

透明节点：

- 不显示；
- 仍参与左列 Grid 的尺寸计算；
- 使用与真实卡片相同的 `280px` 宽度，维持左右列的几何一致性；
- 补足左列末端空间，使两列容器在业务泳道中保持平衡；
- 不改变右列中 `cost_bill → bill_detail` 的纵向排列关系。

ID 使用 `pad` 直接表达补位职责，不使用业务含义不明的 `a1`、`temp`。

### 3.6 卡片为何通过类统一宽度

```d2
card: {
  shape: class
  width: 280
}
```

主数据和核算结果也使用透明列容器。各列中的直接子节点通过作用域内 glob 批量继承公共卡片类和分组配色类：

```d2
master: {
  master_column: "" {
    class: layout-column

    supplier
    cost_item
    allocation_rule
    supplier_rate

    *.class: [card; card-master]
  }
}
```

业务泳道增加两个透明列容器后，真实卡片不再是泳道的直接子节点，因此在卡片自身声明 `class: [card; card-business]`。这虽然会重复类引用，但不会重复具体样式属性；若对业务泳道使用递归 glob，它也会匹配包含子节点的透明列容器，并把容器错误地变成 class，所以这里不使用递归 glob。

分组专用类只覆盖标题头配色；公共 `card` 类统一白色正文、圆角、字号和无阴影风格。四个透明列容器统一复用 `layout-column`：

这种拆分把“几何规则”和“配色规则”分别复用：

```text
card          → class 形状、宽度、白色正文、圆角、字号和无阴影
card-master   → 主数据卡片的浅灰蓝标题头
card-business → 业务卡片的浅灰紫标题头
card-result   → 核算结果卡片的浅灰绿标题头
layout-column → 三个泳道中承载单列 Grid 的透明列容器
```

这组颜色与 PlantUML 第三章一致或接近：Frame 分别使用淡蓝、淡紫、淡绿背景，卡片标题头比所在 Frame 略深，正文保持白底，所有卡片标题文字统一为黑色。需要注意，D2 对 `class` 和 `sql_table` 有特殊颜色规则：`fill` 作用于标题头，`stroke` 作为正文填充色；`font-color` 只控制标题文字，字段文字由主题控制。因此 D2 无法只用普通 Style 完全复刻 PlantUML 对标题、字段、正文和外框的独立着色。本案例通过 3.2 节的页面级 SVG 样式把字段名覆盖为黑色；D2 源码本身仍负责标题头、正文底色和整体层次。

### 3.7 用 Crow's Foot 端点复刻实体关系基数

PlantUML 案例使用 `||`、`|{` 和 `}|` 表达基数。D2 提供对应的 Crow's Foot 箭头形状，因此把连线拆为一个公共视觉类和三个基数类：

```d2
relation: {
  style: {
    stroke: "#27313D"
    stroke-width: 1
    font-size: 12
    font-color: "#4B5565"
  }
}
one-to-many: {
  source-arrowhead.shape: cf-one-required
  target-arrowhead.shape: cf-many-required
}
one-to-one: {
  source-arrowhead.shape: cf-one-required
  target-arrowhead.shape: cf-one-required
}
many-to-one: {
  source-arrowhead.shape: cf-many-required
  target-arrowhead.shape: cf-one-required
}
```

普通 `->` 只有目标端箭头，不能同时绘制两端基数。本例改用 `<->` 建立两个端点，再由 Crow's Foot 类覆盖两端默认箭头：

```d2
lanes.business.left_column.order <-> lanes.business.right_column.package: 包含 {
  class: [relation; horizontal-label; one-to-many]
}
lanes.business.right_column.bill_detail <-> lanes.result.result_column.order_pl: 汇总利润 {
  class: [relation; horizontal-label; one-to-one]
}
lanes.business.right_column.bill_detail <-> lanes.result.result_column.ap_statement: 进入对账结算 {
  class: [relation; horizontal-label; many-to-one]
}
```

`horizontal-label` 是不携带 D2 视觉属性的标记类，只加在横向关系上。3.2 节的页面级 SVG 样式据此把横向连接文字下移 `5px`，使其视觉中心更靠近连线；纵向关系标签不受影响。该调整只改变浏览器中的文字位置，不参与 TALA 的布局和路由计算。

第三章已经补齐 PlantUML 案例中的 14 条关系及其说明文字。D2 没有 `note on link` 的同等语法，因此关系说明采用连接标签；基数语义和连接集合保持一致，标签外观则使用灰色文字近似 PlantUML Note。

### 3.8 泳道内连线的取舍

第三章显式选择 TALA：

```d2
vars: {
  d2-config: {
    layout-engine: tala
  }
}
```

Dagre 和 ELK 无法为 Grid 单元格关系寻路，只能生成中心到中心直线；TALA 会接管 Grid 单元格关系的路由，在存在阻挡或多条关系竞争同一区域时生成水平、垂直折线或交错绕行。

TALA 仍会为无遮挡节点选择最短直线，因此“切换 TALA”不保证每条关系都至少产生一个折点。本例把 `pad` 放在 `left_column` 末尾，把 `package`、`cost_bill`、`bill_detail` 放在 `right_column`；泳道之间的水平间距保持 `64`，各泳道外层 Grid 的横、纵间距统一为 `0`。`master_column`、`left_column`、`right_column`、`result_column` 都显式使用 `vertical-gap: 80`，因此可见卡片的垂直间距统一。业务连接跨透明列容器时，TALA 可以围绕列边界寻找路线。

可选策略：

1. 使用 TALA 保留 Grid，并让其为拥挤关系寻找绕行路径；
2. 减少总览图中的关系，把详细关系拆成单独视图；
3. 调整关系声明顺序或 TALA seed，比较交叉数量和标签位置；
4. 将关系标签缩短，把详细解释放到正文。

即使使用 TALA，高密度跨泳道关系也不可能保证零交叉。Grid 先固定节点位置，路由器只能在剩余空间中优化连线；需要进一步降低交叉时，应优先减少总览图的关系数量，而不是继续增加样式声明。

### 3.9 修改泳道顺序

外层 Grid 按声明顺序放置三个分组。要把核算结果放在中间，应直接调整容器声明顺序：

```text
master
result
business
```

不要通过修改连接方向间接迫使引擎换位；那会把业务语义和排版意图混在一起。

---

## 第四章　完整案例：网格化系统架构图

### 4.1 布局目标

本案例模拟常见的“左侧主架构 + 右侧专项集群”版式：

- Nginx、网关层、微服务集群三个主分组等宽；
- 秒杀入口与秒杀微服务集群等宽；
- 秒杀入口的高度与左侧 Nginx + 网关组合区对齐；
- 秒杀微服务集群的高度与左侧微服务集群区对齐；
- 微服务内部为 4 列 × 3 行；
- 布局样式集中在类中，避免重复；
- 使用白色图纸、灰蓝轮廓、低饱和填充和直角构件。

外层骨架不是把五个可见分组直接排成一列，而是先构造 2 × 2 的宏观网格：

```text
architecture：2 行 × 2 列，按行填充
┌────────────────────────────┬──────────────────┐
│ top_stack                  │ entry_stack      │
│ ├─ Nginx                   │ └─ 秒杀入口       │
│ └─ 网关层                   │                  │
├────────────────────────────┼──────────────────┤
│ bottom_stack               │ seckill_stack    │
│ └─ 微服务集群               │ └─ 秒杀微服务集群  │
└────────────────────────────┴──────────────────┘
```

四个 `*_stack` 都是透明结构容器，只负责给外层 Grid 提供可对齐的矩形单元格。左右两侧使用同构包装，才能让外层单元格对齐继续传递到内部可见容器。

### 4.2 完整 D2 源码

```d2
vars: {
  d2-config: {
    layout-engine: elk
    sketch: false
  }
}

direction: down

classes: {
  region: {
    style: {
      fill: "#FFFFFF"
      stroke: "#475569"
      stroke-width: 1
      stroke-dash: 5
    }
  }
  wide-region: {
    width: 1040
  }
  side-region: {
    width: 320
  }
  card: {
    width: 210
    height: 92
    style: {
      stroke: "#334155"
      stroke-width: 1
      font-size: 16
    }
  }
  nginx-card: {
    style.fill: "#EEF4E8"
  }
  gateway-card: {
    style.fill: "#E8F1F3"
  }
  service-card: {
    style.fill: "#E7F0DE"
  }
  seckill-card: {
    style.fill: "#F3ECE8"
  }
  wrapper: {
    style: {
      fill: transparent
      stroke: transparent
    }
  }
}

architecture: 实际部署秒杀架构 {
  grid-rows: 2
  grid-columns: 2
  horizontal-gap: 28
  vertical-gap: 28
  class: region

  top_stack: "" {
    grid-columns: 1
    vertical-gap: 24
    class: wrapper

    nginx: Nginx {
      grid-columns: 2
      horizontal-gap: 50
      class: [region; wide-region]

      nginx_a: Nginx
      nginx_b: Nginx

      *.class: [card; nginx-card]
    }

    gateway: 网关层 {
      grid-columns: 3
      horizontal-gap: 35
      class: [region; wide-region]

      gateway_a: "SpringCloud\nGateway"
      gateway_b: "SpringCloud\nGateway"
      gateway_c: "SpringCloud\nGateway"

      *.class: [card; gateway-card]
    }
  }

  entry_stack: "" {
    grid-columns: 1
    horizontal-gap: 0
    vertical-gap: 24
    class: wrapper

    entry: 秒杀入口 {
      grid-columns: 1
      height: 448
      class: [region; side-region]

      openresty: "秒杀\nOpenResty"
      *.class: [card; seckill-card]
    }
  }

  bottom_stack: "" {
    grid-columns: 1
    class: wrapper

    services: 微服务集群 {
      grid-rows: 3
      grid-columns: 4
      grid-gap: 26
      class: [region; wide-region]

      portal: "门户服务\n… …\n(Pod)"
      member: "会员服务\n… …\n(Pod)"
      product: "商品服务\n… …\n(Pod)"
      order: "订单服务\n… …\n(Pod)"
      payment: "支付服务\n… …\n(Pod)"
      cart: "购物车\n… …\n(Pod)"
      admin: "后台服务\n… …\n(Pod)"
      points: "积分服务\n… …\n(Pod)"
      merchant: "商家服务\n… …\n(Pod)"
      inventory: "库存服务\n… …\n(Pod)"
      recommend: "内容推荐\n… …\n(Pod)"
      promotion: "促销服务\n… …\n(Pod)"

      *.class: [card; service-card]
    }
  }

  seckill_stack: "" {
    grid-columns: 1
    horizontal-gap: 0
    vertical-gap: 60
    class: wrapper

    seckill: 秒杀微服务集群 {
      grid-columns: 1
      grid-rows: 2
      vertical-gap: 40
      height: 390
      class: [region; side-region]

      confirm: "秒杀订单\n确认服务"
      order_service: 秒杀订单服务

      *.class: [card; seckill-card]
    }
  }
}
```

### 4.3 外层为什么必须是 2 × 2 Grid

外层代码是：

```d2
architecture: {
  grid-rows: 2
  grid-columns: 2

  top_stack
  entry_stack
  bottom_stack
  seckill_stack
}
```

`grid-rows` 先出现，所以按行填充：

```text
第一行：top_stack、entry_stack
第二行：bottom_stack、seckill_stack
```

由 Grid 规则得到：

- `top_stack` 与 `entry_stack` 等高；
- `bottom_stack` 与 `seckill_stack` 等高；
- `top_stack` 与 `bottom_stack` 位于同一列，等宽；
- `entry_stack` 与 `seckill_stack` 位于同一列，等宽。

如果交换两个 `grid-*` 参数的声明顺序，则会按列填充，布局会变为：

```text
第一列：top_stack、entry_stack
第二列：bottom_stack、seckill_stack
```

这正是架构图“左右上下位置颠倒”时首先需要检查的地方。

### 4.4 三个主分组如何等宽

三个可见主分组统一使用：

```d2
wide-region: {
  width: 1040
}
```

```d2
nginx.class: [region; wide-region]
gateway.class: [region; wide-region]
services.class: [region; wide-region]
```

因为容器宽度需要由 ELK 支持，所以案例显式选择 ELK。

这里还有一个容易忽略的细节：`top_stack` 包含 Nginx 和网关层，会额外产生容器内边距。若微服务集群直接作为外层 Grid 单元格，外层同列等宽规则可能把它扩展到 `top_stack` 的宽度，从而使其可见宽度大于 Nginx。

案例为微服务集群增加了同类型的透明包装层：

```d2
bottom_stack: "" {
  grid-columns: 1
  class: wrapper

  services: 微服务集群 {
    class: [region; wide-region]
  }
}
```

于是外层比较的是两个包装容器：

```text
top_stack    = 可见分组宽度 + 包装层内边距
bottom_stack = 可见分组宽度 + 包装层内边距
```

而三个可见分组本身都保持 `1040`。这比给某一组反复试算补偿宽度更稳定。

### 4.5 右侧两个分组如何等宽

右侧分组统一使用：

```d2
side-region: {
  width: 320
}
```

```d2
entry_stack.entry.class: [region; side-region]
seckill_stack.seckill.class: [region; side-region]
```

公共类保证两个可见容器的显式宽度相同。外层 Grid 比较的虽然是 `entry_stack` 和 `seckill_stack`，但两层透明包装都设置了 `horizontal-gap: 0`，不会在可见容器左右增加宽度；因此包装层和内部可见容器均保持 `320`。

### 4.6 左右区域如何等高

只把 `top_stack` 与秒杀入口直接放进 Grid 的同一行，能够让外层 Grid 单元格等高，却不能保证内部可见边界对齐。原因是 `top_stack` 自身透明，其内部 Nginx、网关层还会受到包装层留白影响。

案例因此给右侧也增加一层结构对称的透明包装：

```d2
entry_stack: "" {
  grid-columns: 1
  horizontal-gap: 0
  vertical-gap: 24
  class: wrapper

  entry: 秒杀入口 {
    height: 448
  }
}
```

其中：

- `entry_stack` 与 `top_stack` 位于外层 Grid 的同一行，因此二者都是 `496px` 高；
- `vertical-gap: 24` 在入口容器上下各保留 `24px`；
- `entry.height: 448`，正好等于左侧 Nginx 顶边到网关层底边的可见高度；
- 两侧可见内容最终都从 `y=82px` 延伸到 `y=530px`。

下方采用同一方法：

```d2
seckill_stack: "" {
  grid-columns: 1
  horizontal-gap: 0
  vertical-gap: 60
  class: wrapper

  seckill: 秒杀微服务集群 {
    height: 390
  }
}
```

`seckill_stack` 与 `bottom_stack` 都是 `510px` 高；上下各保留 `60px` 后，秒杀微服务集群与左侧微服务集群都为 `390px` 高，可见边界都从 `y=642px` 延伸到 `y=1032px`。

完整方法可概括为“先组合、再对称包装、最后对齐”：

1. 先把需要作为整体比较的多个分组放进透明包装容器；
2. 目标分组外侧也增加透明包装，使左右结构对称；
3. 把两侧包装容器放进外层 Grid 的同一行，使外层单元格等高；
4. 用相同的可见高度和对应的 `vertical-gap`，把单元格对齐传递给内部边界。

它适用于“左侧两块对应右侧一块”“左侧多行对应右侧侧栏”等不规则架构图。

### 4.7 4 × 3 微服务矩阵

微服务区写成：

```d2
services: {
  grid-rows: 3
  grid-columns: 4
}
```

因为 `grid-rows` 先出现，所以按行填充：

```text
第 1 行：portal、member、product、order
第 2 行：payment、cart、admin、points
第 3 行：merchant、inventory、recommend、promotion
```

卡片样式通过作用域内 glob 一次应用：

```d2
*.class: [card; service-card]
```

这样既保留了语义化节点 ID，也避免十二次重复声明宽度、高度、圆角和颜色。

### 4.8 不完整矩阵如何处理

如果服务数量从 12 个变成 10 个，最后一行只剩两个节点。希望它们仍占据前两列时，可以直接保留；希望视觉居中或保留特定列时，可以添加透明占位节点：

```d2
pad_1: "" {
  width: 210
  height: 92
  style.opacity: 0
}
pad_2: "" {
  width: 210
  height: 92
  style.opacity: 0
}
```

占位节点应与真实卡片同尺寸，否则会改变所在行、列的几何尺寸。

### 4.9 如何加入可见业务连接

本案例主要展示栅格排版，所以没有加入连线。若需要表示调用关系，可以添加：

```d2
architecture.top_stack.nginx.nginx_a \
  -> architecture.top_stack.gateway.gateway_a: 转发

architecture.top_stack.gateway.gateway_a \
  -> architecture.bottom_stack.services.order: 路由
```

但需要评估：

- 这些节点位于嵌套 Grid 中；
- Grid 单元格之间的路线不做路径搜索；
- 多条跨区连接可能穿过其他节点或标题。

若架构图需要展示大量调用关系，建议拆分为两张图：

1. **部署视图**：保留严格网格，只画入口主链路；
2. **调用视图**：移除严格 Grid，由 ELK 自动排布并路由。

### 4.10 本案例的样式复用层次

样式按职责拆分：

```text
region
└─ 所有可见分组的边框、背景、虚线和线宽

wide-region / side-region
└─ 两类分组宽度

card
└─ 所有卡片的宽度、高度、边框、线宽和字号

nginx-card / gateway-card / service-card / seckill-card
└─ 各业务区域配色

wrapper
└─ 透明结构容器
```

不建议把所有属性复制到每个节点，也不建议创建只使用一次、且只包含一个颜色属性的过细类。类的粒度应对应稳定的设计意图。

### 4.11 修改案例时的推荐顺序

1. 先确认外层四个单元格顺序；
2. 再确认四个 `*_stack` 的对称包装关系；
3. 再确认三组 `wide-region` 宽度一致；
4. 再确认两个 `side-region` 宽度一致；
5. 再调整各分组内部 `grid-*`；
6. 再增删业务卡片和透明占位节点；
7. 最后加入连接和视觉样式。

---

## 第五章　TALA 配置与 MPE 渲染链路

本章集中说明 TALA 从 D2 源码到 MPE 预览的全部配置入口。当前环境使用 D2 `v0.7.1` 和 `d2plugin-tala v0.4.3`。配置遵循一个简单边界：能由当前文档内嵌 `<style>` 完成的显示调整，不再放入命令参数或外部包装脚本；只有 CSS 无法参与的布局计算才交给 D2、TALA 或 MPE。需要先区分四类配置：

| 层级 | 配置项 | 作用 |
|---|---|---|
| D2 源码 | `layout-engine: tala` | 声明文档希望使用 TALA |
| D2 命令行 | `--layout=tala`、`--tala-seeds` | 为本次渲染选择引擎和候选随机种子 |
| MPE | `d2Path`、`d2Layout` | 指定 D2 启动程序并把引擎参数传给它 |
| 内嵌 `<style>` | `.d2-diagram`、内嵌 `svg` | 控制 SVG 在预览页面中的字号、偏移、缩放和滚动行为 |

其中只有 `--tala-seeds` 是当前 TALA 插件公开的专用布局参数。主题、手绘模式、Grid、`direction`、节点尺寸和连接样式都属于 D2 配置，不是 TALA 算法参数；预览缩放属于 CSS 显示设置。

### 5.1 完整调用链

当前工作区的调用链为：

```text
Markdown 中的 D2 源码
  ↓
MPE 读取 .vscode/settings.json
  ↓
直接调用 C:\Program Files\D2\d2.exe
  ↓
D2 根据 --layout=tala 查找 PATH 中的 d2plugin-tala.exe
  ↓
TALA 计算布局，D2 生成 SVG
  ↓
MPE 把 SVG 放入 <div class="d2-diagram">
  ↓
文档内嵌 <style> 控制预览尺寸、缩放与滚动行为
```

故障排查也应沿这条链逐层进行。TALA 已安装并不代表 MPE 一定使用它；MPE 还必须调用正确的 D2，并把 `tala` 作为布局参数传入。

### 5.2 安装位置与可用性检查

当前可执行文件为：

```text
D2   ：C:\Program Files\D2\d2.exe
TALA ：C:\Users\jack8\AppData\Local\Microsoft\WindowsApps\d2plugin-tala.exe
```

使用以下命令核对版本、插件发现结果和可用参数：

```powershell
d2 --version
d2plugin-tala --version
Get-Command d2
Get-Command d2plugin-tala
d2 layout tala
```

`d2 layout tala` 能显示 TALA 帮助，表示 D2 已经发现插件。若提示找不到布局引擎，应确认 `d2plugin-tala.exe` 所在目录已经进入启动 VS Code 时继承的 `PATH`，修改环境变量后重新启动 VS Code。

### 5.3 在 D2 源码中选择 TALA

可移植的 D2 文件应在源码中声明所需引擎：

```d2
vars: {
  d2-config: {
    layout-engine: tala
    theme-id: 104
    sketch: false
  }
}
```

三项配置的职责不同：

- `layout-engine: tala` 选择 TALA；
- `theme-id: 104` 选择 D2 主题，与 TALA 算法无关；
- `sketch: false` 关闭手绘效果，使边框和连接保持工程制图风格，也与 TALA 算法无关。

第三章案例和 `pm-skill\临时图.md` 都使用这种声明。源码声明便于文件离开 MPE 后仍表达渲染意图，但外部渲染器传入的命令行参数优先级更高。当前 MPE 会显式传入布局参数，因此源码与工作区设置应保持一致。

### 5.4 命令行与环境变量

直接渲染时可以使用：

```powershell
d2 --layout=tala input.d2 output.svg
```

等价的通用环境变量是：

```powershell
$env:D2_LAYOUT = "tala"
d2 input.d2 output.svg
```

命令行选项适合单次构建，`D2_LAYOUT` 适合由脚本统一控制的多个构建。项目文档仍建议保留 `layout-engine: tala`，避免渲染意图只存在于某台机器的环境变量中。

### 5.5 `--tala-seeds`：TALA 专用参数

在当前 `d2plugin-tala v0.4.3` 中，插件公开的专用参数只有：

```text
--tala-seeds int64Slice
```

默认值为 `[1,2,3]`。传入多个 seed 时，TALA 会并行计算多个候选布局，并返回评分最好的结果：

```powershell
d2 --layout=tala --tala-seeds=1,2,3 input.d2 output.svg
```

希望构建结果更稳定、渲染更快时，可以固定为一个 seed：

```powershell
d2 --layout=tala --tala-seeds=7 input.d2 output.svg
```

希望比较更多候选方案时可以增加 seed，但会增加计算成本。seed 只能改变 TALA 在多个合法布局之间的选择，不能替代 Grid、容器、尺寸和间距等结构约束。

MPE 没有独立的 `talaSeeds` 设置。当前工作区不使用外部包装脚本，因此 MPE 预览采用 TALA 默认的 `[1,2,3]`。只有确实需要固定候选布局时，才应在独立构建命令中传入 `--tala-seeds`；该参数影响布局计算，不能由 `<style>` 替代。

### 5.6 MPE 工作区配置

当前工作区的 `.vscode/settings.json` 包含：

```json
{
  "markdown-preview-enhanced.d2Path": "C:\\Program Files\\D2\\d2.exe",
  "markdown-preview-enhanced.d2Layout": "tala"
}
```

两项配置分别表示：

- `markdown-preview-enhanced.d2Path`：MPE 直接调用已安装的 `d2.exe`，不经过工作区包装脚本；
- `markdown-preview-enhanced.d2Layout`：MPE 为 D2 代码块显式选择 TALA。

MPE 的布局选择顺序可概括为：代码块的 `layout` 属性优先，其次是工作区 `d2Layout`，最后才使用 MPE 默认值。MPE 最终通过命令行调用 D2，所以其选择会覆盖源码中的 `d2-config.layout-engine`。为减少环境差异，本项目让两处都写成 `tala`。

修改设置后若预览没有更新，应关闭并重新打开 MPE 预览；修改系统 `PATH` 后则应重新启动 VS Code。

### 5.7 显示设置统一放入内嵌 `<style>`

当前工作区已经移除只负责 `--scale` 的 `.tools\d2-mpe\d2-mpe.cmd`，MPE 直接调用 `d2.exe`。预览比例、实际尺寸呈现和滚动方式均由当前 Markdown 文档中的 `<style>` 控制。第三章案例采用以下结构：

```css
/* 只匹配编号为 diagram-3-1 的泳道图容器。 */
.markdown-preview .d2-diagram:has(g.diagram-3-1) {
  width: fit-content;
  max-width: none;
  overflow: visible !important;
}

/* 只匹配编号为 diagram-3-1 的泳道图 SVG。 */
.markdown-preview .d2-diagram > svg:has(g.diagram-3-1) {
  display: block;
  width: auto !important;
  height: auto !important;
  max-width: none !important;
  zoom: 0.7;
}
```

职责边界如下：

```text
字号、颜色、视觉偏移、预览缩放、滚动行为 → 内嵌 <style>
Grid、方向、节点尺寸、间距、连接拓扑       → D2 源码
布局引擎与 TALA seed                      → D2 配置或构建命令
```

`zoom: 0.7` 只改变 MPE 中的显示比例，不会重新计算 TALA 布局。`width: auto` 与 `height: auto` 保留 SVG 的固有宽高比；外层容器使用 `fit-content` 和 `overflow: visible`，避免单独生成横向滚动条。只有需要改变独立 SVG 文件的固有尺寸、且该 SVG 不经过 MPE 显示时，才有理由在一次性导出命令中使用 `--scale`。

### 5.9 配置检查清单

- [ ] `d2 --version` 能返回版本；
- [ ] `d2plugin-tala --version` 能返回版本；
- [ ] `d2 layout tala` 能显示插件帮助；
- [ ] D2 源码包含 `layout-engine: tala`；
- [ ] MPE 的 `d2Layout` 为 `tala`；
- [ ] MPE 的 `d2Path` 直接指向存在且可执行的 `d2.exe`；
- [ ] 需要稳定布局时，仅在构建命令中固定 `--tala-seeds`；
- [ ] 预览比例、滚动和显示尺寸由当前文档的 `<style>` 控制；
- [ ] 修改 `PATH` 后已重启 VS Code，修改 CSS 或工作区设置后已刷新预览。

---

## 官方资料

- [D2 布局概览](https://d2lang.com/tour/layouts/)
- [D2 Dagre 布局引擎](https://d2lang.com/tour/dagre/)
- [D2 ELK 布局引擎](https://d2lang.com/tour/elk/)
- [D2 TALA 布局引擎](https://d2lang.com/tour/tala/)
- [D2 Grid Diagrams](https://d2lang.com/tour/grid-diagrams/)
- [D2 Containers](https://d2lang.com/tour/containers/)
- [D2 Connections](https://d2lang.com/tour/connections/)
- [D2 Dimensions](https://d2lang.com/tour/dimensions/)
- [D2 Positions](https://d2lang.com/tour/positions/)
- [D2 Styles](https://d2lang.com/tour/style/)
- [D2 Classes](https://d2lang.com/tour/classes/)
- [D2 Globs](https://d2lang.com/tour/globs/)
