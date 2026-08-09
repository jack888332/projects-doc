# BMS 原型技术架构

## 1. 架构目标

本原型采用模块化单体前端，优先兼顾低 Token 消耗、代码复用和短验证链路：

1. 单次需求变更只读取对应业务页面、组合逻辑和共享组件。
2. 账单系统与成本中心共用框架、数据层、视觉规范和测试工具。
3. 条件筛选、统计卡片、表格、分页、弹窗等高频结构统一复用。
4. 演示数据可稳定初始化、重置和测试，不依赖临时后端。
5. 日常修改依赖 Vite 热更新快速反馈，完整校验仅在阶段交付时执行。

当前规模不引入 SSR、微前端、Monorepo、复杂 Mock Server 或完整后端服务。这些设施会增加配置、生成文件和验证成本，暂时没有对应收益。

## 2. 技术选型

| 领域 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3 | Composition API，业务页面按路由拆分 |
| 构建 | Vite 7 | 日常构建输出到 `.tmp-build` |
| 语言 | JavaScript + 渐进式 TypeScript | Repository、schema、fixture 等边界代码优先使用 TypeScript |
| 类型检查 | TypeScript + vue-tsc | 已纳入 `npm run check` |
| 路由 | Vue Router | 菜单状态从路由派生 |
| UI | Element Plus + 共享业务组件 | 不重复封装同用途控件 |
| 本地数据 | Dexie + IndexedDB | 浏览器演示数据持久化 |
| 数据边界 | Repository | 页面不直接访问 Dexie |
| 单元测试 | Vitest 4 | 纯规则、composable、Repository |
| 路由回归 | Playwright | Chromium 下覆盖 7 条关键路由 |

Pinia 不作为默认依赖。只有出现跨路由长期共享且 composable 无法清晰承载的状态时才引入。

## 3. 工程结构

```text
prototype/
  src/
    app/styles/                 # 设计令牌与基础样式
    billing/                    # 账单系统页面、组件、schema
    cost/                       # 成本中心页面、组件、composable
    data/
      fixtures/                 # 确定性演示数据
      repositories/             # 数据访问接口及实现
    domain/                     # 纯业务规则和常量
    router/                     # 路由声明
    shared/
      components/               # 筛选、统计、表格等共享组件
      composables/              # 通用页面行为
      schemas/                  # 通用页面结构类型
      views/                    # 组件陈列页
  tests/                        # Vitest 单元测试
  e2e/                          # Playwright 路由冒烟测试
  scripts/                      # 架构审计与 E2E 启动器
  playwright.config.ts
  tsconfig.json
  vite.config.js
```

后续只在业务收益明确时新增目录或抽象，不为目录形式本身做大规模搬迁。

## 4. 强制规则

### 4.1 页面与路由

- 路由懒加载独立业务页面。
- 页面负责组装、路由参数和页面状态，不直接操作数据库。
- 源码单文件不得超过 30,000 字符，由架构审计强制检查。
- 超过预算时优先抽离稳定 fixture、业务纯函数、复杂弹窗、状态 composable 或独立数据区。
- 不把多个独立页面合并成难以定位变更范围的巨型 JSON 渲染器。

### 4.2 数据

- 页面依赖领域 Repository 或 composable，不引用 `prototypeDb`。
- Dexie 只允许出现在 `src/data` 的基础设施实现中。
- IndexedDB 实现惰性加载，Node 测试使用 Memory Repository。
- 稳定演示数据放在 `src/data/fixtures`，页面只保留即时 UI 状态。
- fixture 编号和时间保持确定性，避免截图和测试结果随机变化。

### 4.3 标准列表页

- 条件块使用 `ConditionFilter`。
- 多条件筛选使用 `useStagedQuery`，点击“查询”后才更新数据区。
- 统计栏使用 `MetricGrid`，统计卡片不承担筛选行为。
- 表格使用 `DataTableFrame` 承载工具栏、字段排序、选中行数和分页栏。
- 特殊单元格使用显式模板或插槽，不强制配置化。
- 稳定筛选项、列元数据和动作可使用类型化 page schema。

### 4.4 样式

- `tokens.css` 维护颜色、字号、间距、圆角、控件高度和表格尺寸。
- `foundations.css` 维护 reset、字体和必要的 Element Plus 基础覆盖。
- 业务组件使用局部样式，不新增第二套通用按钮、条件块、统计卡片或分页样式。
- `billing-embedded.css` 与 `module-pages.css` 当前仍被多个路由实际引用，属于兼容层，不应在无视觉回归验证时直接删除。

## 5. 快速迭代与验证链路

### 5.1 日常原型修改

保持开发服务常驻，通过 Vite 热更新直接查看效果：

```powershell
npm run dev
```

纯文案、样式、间距和演示数据调整不运行额外 npm 命令。修改逻辑、类型或共享组件时，按需执行秒级检查：

```powershell
npm run check
```

该命令只运行 `vue-tsc --noEmit`，不构建、不跑全部测试。

### 5.2 阶段交付

完成一批需求或准备交付时执行：

```powershell
npm run verify
```

该命令执行架构审计、类型检查、单元测试和生产构建。只有共享基础设施发生变化，或准备正式评审时才执行完整浏览器回归：

```powershell
npm run verify:full
```

### 5.3 单路由回归

页面改动需要浏览器验证时，只运行受影响路由，例如：

```powershell
npm run test:e2e -- --grep "应收账单"
```

关键路由回归基础命令：

```powershell
npm run test:e2e
```

当 `10520` 没有现成服务时，脚本先构建 `.tmp-e2e`，再用 Vite Preview 运行 Playwright，避免开发服务器依赖预构建竞态；已有服务时直接复用。当前覆盖：组件陈列、营收总览、应收账单、返款账单、回款管理、生成任务和成本总览。

依赖安全检查：

```powershell
npm audit
```

当前生产与开发依赖漏洞均为 0。

## 6. 已清偿技术债

| 技术债 | 处理结果 |
| --- | --- |
| 巨型账单路由入口 | 拆分独立路由页面并移除旧 `BillingRoute` |
| 页面内联演示数据 | 迁移到 `src/data/fixtures` |
| 页面直接访问 Dexie | 收敛到 Repository/composable，审计禁止越界 |
| 存储逻辑难测试 | 增加 Memory Repository 和单元测试 |
| 表格与分页重复实现 | 迁移到 `DataTableFrame`，旧分页残留为 0 |
| 缺少类型检查 | 安装 TypeScript、vue-tsc 并纳入 `check` |
| 复杂账单详情 | 抽离 `BillGenerationDialog` |
| 复杂导出流程 | 抽离 `ExportTaskDialogs` |
| 成本中心状态耦合 | 抽离 `useCostCenterState` |
| 缺少浏览器回归 | 增加 7 条 Playwright Chromium 冒烟测试 |
| Vitest 误收集 E2E | 将单元测试范围限定到 `tests` |
| 开发态 E2E 缓存竞态 | 改用构建产物 + Preview 验证 |
| 依赖安全告警 | 升级 Vite/Vitest 并锁定安全 overrides，审计为 0 |
| 生成目录污染 Git | 忽略并停止跟踪 `node_modules`、`dist`、临时构建和测试产物 |

当前结果：3 个 Vitest 文件共 7 条单元测试通过；7 条 Playwright 路由测试通过；类型检查、架构审计和生产构建通过。上述完整链路只在阶段交付时运行，不作为每次原型微调的前置步骤。

## 7. 保留边界与剩余风险

### 7.1 Git 索引清理

`.gitignore` 已忽略依赖、构建、缓存和测试产物。此前已跟踪的文件需从索引移除，命令只停止 Git 跟踪，不删除本地文件：

```powershell
git rm -r --cached product-caliber/bms/prototype/node_modules
git rm -r --cached product-caliber/bms/prototype/dist
```

首次提交会出现大量删除记录，这是清理历史生成文件的预期结果；提交后后续安装和构建不再污染变更列表。

### 7.2 兼容样式层

`billing-embedded.css` 和 `module-pages.css` 仍承载实际页面规则。它们不是可直接删除的死代码。只有相关页面发生业务改动且完成对应截图回归时，才逐项迁移到共享组件或局部样式。

### 7.3 构建体积

Element Plus 共享块约 870 kB，构建会产生体积提示。路由已懒加载，当前原型优先保证复用和稳定性，不继续做高维护成本的逐组件极限拆包。若进入生产交付，再按真实访问路径和性能指标优化。

### 7.4 成本中心组合页

成本中心仍使用一个视图组合多个相近模式，但状态与数据逻辑已抽到 composable，文件低于架构预算。只有具体模式出现独立复杂需求时再增量拆页，避免提前制造重复代码。

## 8. 低 Token、高复用原则

1. 优先修改 schema、fixture、composable 或共享组件，再修改页面模板。
2. 同用途 UI 只保留一个公共实现。
3. 默认只读取当前页面及其直接依赖，不遍历全项目。
4. 业务页面改动验证对应路由；共享组件改动运行组件陈列页和关键路由集合。
5. 生成产物不进入源代码变更列表。
6. 使用配置描述稳定结构，用插槽表达特殊业务，不做极端全配置渲染器。

## 9. Playwright 安装

```powershell
npm install -D @playwright/test
npx playwright install chromium
```

校验安装：

```powershell
npx playwright --version
npm run test:e2e
```

## 10. 关闭 Codex 自动审批服务

编辑用户级配置文件：

```text
C:\Users\<用户名>\.codex\config.toml
```

在顶层配置中设置：

```toml
approval_policy = "on-request"
approvals_reviewer = "user"
sandbox_mode = "workspace-write"
```

- `approval_policy = "on-request"`：仅在越出沙箱或访问受限资源时请求审批。
- `approvals_reviewer = "user"`：审批请求交给用户，不发送给自动审批模型。
- `sandbox_mode = "workspace-write"`：允许工作区内读写，并保留工作区外保护边界。

保存后完全退出并重新启动 Codex，再新建任务。已运行任务通常继续使用任务启动时的权限快照。若重启后仍由自动服务审批，说明桌面端或组织托管策略覆盖了用户配置，需要在 Codex 权限设置中关闭，或由管理员调整策略。

不建议使用 `approval_policy = "never"` 代替。该设置不会自动获得更高权限，只会让需要审批的操作直接失败。
