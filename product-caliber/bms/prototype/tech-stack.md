# BMS 原型技术架构

## 1. 目标

本原型采用模块化单体前端，优先兼顾以下目标：

1. 单次需求变更只需读取和修改少量业务文件，降低 AI 协作 Token 消耗。
2. 筛选区、统计栏、表格、分页、弹窗等高频结构统一复用。
3. 账单系统与成本中心共用同一套框架、数据基础设施和视觉规范。
4. 演示数据可稳定初始化、重置和测试，不依赖临时后端。
5. 校验链路短，默认通过单元测试和生产构建即可发现主要回归。

不采用 SSR、微前端、Monorepo、复杂 Mock Server 或完整后端服务。当前原型规模下，这些基础设施只会增加配置、生成文件和验证成本。

## 2. 技术选型

| 领域 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3 | Composition API，业务页面按路由拆分 |
| 构建 | Vite | 日常构建输出到 `.tmp-build` |
| 语言 | TypeScript 渐进迁移 | 新增 Repository、schema、fixture 优先使用 TypeScript |
| 路由 | Vue Router | 菜单状态从路由派生，不维护第二套路由状态 |
| UI | Element Plus + 共享业务组件 | 不重复封装同用途控件 |
| 本地数据 | Dexie + IndexedDB | 浏览器演示持久化 |
| 数据边界 | Repository | 页面不直接访问 Dexie |
| 测试 | Vitest | 纯规则、composable、内存 Repository |
| 视觉回归 | 组件陈列页，后续补 Playwright | 公共组件变更优先验证代表页面 |

Pinia 不作为默认依赖。只有出现跨路由长期共享、且本地 composable 无法清晰承载的状态时才引入。

## 3. 当前工程结构

```text
prototype/
  src/
    app/styles/                 # 设计令牌与基础样式
    billing/                    # 账单系统页面、组件、schema
    cost/                       # 成本中心页面与数据组合逻辑
    data/
      fixtures/                 # 稳定演示数据
      repositories/             # 数据访问接口及实现
    domain/                     # 纯业务规则和常量
    router/                     # 路由声明
    shared/
      components/               # 筛选、统计、表格等公共组件
      composables/              # 通用页面行为
      schemas/                  # 通用页面结构类型
      views/                    # 组件陈列页
  tests/                        # Vitest 测试
  tsconfig.json
  vite.config.js
```

后续新增业务域时可逐步收敛为 `features/<domain>`，但不为目录形式本身进行无业务收益的大规模搬迁。

## 4. 强制分层规则

### 4.1 路由与页面

- 路由直接懒加载业务页面，不经过巨型模式分发入口。
- 页面只负责组装、路由参数和页面状态，不直接操作数据库。
- 单文件超过约 250 行时，优先抽离稳定 fixture、业务纯函数、复杂弹窗或子数据区。
- 不把多个独立页面做成一个难以定位变更范围的巨型 JSON 渲染器。

### 4.2 数据

- 页面依赖领域 Repository 或 composable，不引用 `prototypeDb`。
- Dexie 仅允许出现在 `src/data` 的基础设施实现中。
- IndexedDB 实现惰性加载，Node 测试使用 Memory Repository。
- 稳定演示数据放入 `src/data/fixtures`，页面只保留即时 UI 状态。
- fixture 编号和时间保持确定性，避免截图和测试结果随机变化。

### 4.3 标准列表页

- 条件块统一使用 `ConditionFilter`。
- 有多个条件时使用 `useStagedQuery`，点击“查询”后才更新数据区。
- 统计栏统一使用 `MetricGrid`。
- 表格统一由 `DataTableFrame` 承载工具栏、字段排序、选中行数和分页栏。
- 特殊单元格继续使用显式模板或插槽，不强制配置化。
- 稳定筛选项、列元数据和动作可使用类型化 page schema。

### 4.4 样式

- `tokens.css` 维护颜色、字号、间距、圆角、控件高度和表格尺寸。
- `foundations.css` 维护 reset、字体和必要的 Element Plus 基础覆盖。
- 业务组件使用局部样式；不得新增第二套同用途按钮、条件块、统计卡片或分页样式。
- 页面间距只引用设计令牌，避免继续散落魔法数值。

## 5. 推荐验证链路

当前可执行：

```text
npm test
npm run build
npm run check
```

其中 `check` 当前执行 Vitest 和 Vite 生产构建。公共 UI 改动还应验证：

- `/#/__dev/ui`
- 账单列表代表路由
- 成本中心代表路由

待依赖可安装后补充：

```text
vue-tsc --noEmit
playwright test
```

## 6. 本轮已完成

| 技术债 | 处理结果 |
| --- | --- |
| 账单系统巨型入口 | 已拆出 `TasksView`，账单路由改为直接懒加载独立页面，删除 `BillingRoute` |
| 任务演示数据内联 | 已迁移到 `data/fixtures/billingTasks.ts` |
| 账单、返款、汇率演示数据内联 | 已迁移到对应 fixture |
| 页面直接访问 Dexie | 业务页面已改为 Repository/composable，Dexie 访问收敛到 `src/data` |
| 仓储难测试 | 已增加 Memory Billing Repository 和单元测试；IndexedDB 适配器改为惰性加载 |
| 表格框架重复 | 账单主要页面和成本中心各数据区已迁移到 `DataTableFrame` |
| 标准页面缺少类型契约 | 已增加通用 list schema 和账单列表 schema |
| 全局样式入口混乱 | 已增加 `tokens.css`、`foundations.css`，主样式入口统一导入 |
| 缺少组件集中验证入口 | 已增加 `/#/__dev/ui` 组件陈列页 |
| 日常构建污染 `dist` | `build` 已改为输出 `.tmp-build`；发布构建单独使用 `build:release` |
| TypeScript 无基础配置 | 已增加 `tsconfig.json` 和 `env.d.ts`，允许渐进迁移 |

本轮校验结果：Vitest 3 个测试文件、7 个测试通过；Vite 生产构建通过。

## 7. 尚未完全清偿

### P0：Git 索引仍跟踪生成目录

`.gitignore` 已忽略依赖和构建目录，但 Git 索引仍跟踪约 12,757 个 `node_modules` 文件和 24 个 `dist` 文件。这仍是变更列表噪声和 Token 浪费的最大来源。

需要在仓库根目录执行一次：

```text
git rm -r --cached product-caliber/bms/prototype/node_modules
git rm -r --cached product-caliber/bms/prototype/dist
```

本轮自动执行因 `.git` 写入授权服务不可用而未完成。命令只移除 Git 跟踪，不删除本地文件。

### P1：类型检查依赖未安装

项目已有 TypeScript 配置，但尚未安装 `typescript`、`vue-tsc`，因此 `check` 还不能执行 Vue 类型检查。本轮依赖安装因授权服务不可用而未完成。

### P1：成本中心仍有多模式主文件

`CostCenterView.vue` 的表格框架已统一，但多个成本页面仍通过 `initialView` 共用同一个多模式文件。后续修改某一成本页面时仍可能需要读取较大上下文。

建议按业务需求到达时增量拆分，不进行一次性机械搬迁：

1. 先拆 `成本总览`、`供应商管理`、`成本账单` 三个高频页面。
2. 公共查询和数据访问留在 composable。
3. 分摊、利润、费项页面在发生下一次需求变更时顺带拆分。

### P1：少数复杂详情子表仍使用旧分页拼装

主要列表页已统一，剩余集中在 `BillDetailPanel.vue` 和 `ProcessView.vue` 的详情/流程子表。它们应继续迁移到 `DataTableFrame` 的紧凑变体，避免弹窗内分页规范分叉。

### P1：历史全局视觉覆盖仍需渐进清理

`billing-embedded.css` 与 `module-pages.css` 仍承载部分历史页面覆盖。当前直接删除会扩大视觉回归范围，建议在相关组件下次修改时把规则迁入组件局部样式，并逐项删除旧选择器。

### P1：Playwright 回归尚未落地

组件陈列页已经具备，但 Playwright 依赖和脚本尚未安装。应补充账单列表、账单详情、账单配置、生成任务、成本总览五条关键路由冒烟测试。

## 8. 后续验收标准

- Git 不再追踪依赖、缓存和构建产物。
- `npm run check` 包含类型检查、单元测试和生产构建。
- 业务页面不存在对 Dexie 实例的直接引用。
- 新增业务表格全部使用 `DataTableFrame`。
- 新增稳定演示数据全部放在 fixture 层。
- 成本中心高频页面拥有独立页面实现。
- 公共 UI 变更可通过组件陈列页和少量代表路由完成验证。
- 关键路由具备 Playwright 冒烟测试。

## 9. 低 Token、高复用实施原则

1. 先修改 schema、fixture 或共享组件，再修改页面模板。
2. 同用途 UI 只保留一个公共实现。
3. 只读取当前业务页面、它依赖的 composable 和公共组件，不默认遍历全项目。
4. 构建输出保持稳定且不进入源码变更列表。
5. 公共组件变更扩大回归范围，业务页面变更只验证对应路由。
6. 对复杂页面采用“配置描述稳定结构、插槽表达特殊业务”，不走极端全配置渲染。
