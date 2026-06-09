# BMS 账单生成机制调整方案

> 来源口径：`aidocs/产品口径/bms/prd/账单生成机制.PRD.md`
>
> 代码基线：`bms/biz/src/main/java/com/szt/supplychain/bms/biz/service/impl/BillGenerateServiceImpl.java`、`BillConfigServiceImpl.java`、`BillGenerateMapper.java`
>
> 目标：在保留现有账单生成能力的基础上，将生成逻辑调整为“源数据增量采集”和“账单侧调整重算”两条任务线，满足复核完成后不可重跑、源数据不可回退、增量采集可补偿的业务要求。

## 1. 核心结论

现有代码已经具备以下能力：

1. `generate()` 创建 `bill_generate_task(PENDING)`。
2. `executeTask()` 领取 `PENDING / NEED_RETRY` 任务并执行。
3. 支持默认配置和分支配置互斥归属。
4. 支持按履约节点读取订单宽表。
5. 支持订单宽表拆分 `fee_detail`。
6. 支持同步附加费、增量附加费、理赔来源归集。
7. 已有 `bill_source_collect_mark` 的 `PENDING / MARKED / FAILED` 补偿雏形。
8. 已保存配置快照、范围快照、费项规则快照、来源 SQL 快照。

但与新 PRD 仍有关键差距：

1. 源表仍使用 `bms_billed_flag + bms_bill_no` 双字段表达采集状态；新口径要求单字段 `null / sync / modified`。
2. `regenerate()` 会清理源表打标并作废旧账单；新口径要求重跑只采集增量，不做源数据状态回退。
3. `REGENERATE` 触发类型混在主生成链路中；新口径要求源数据采集任务和账单侧调整重算任务拆开。
4. 查询源数据仍过滤 `bms_billed_flag = 0 AND bms_bill_no IS NULL`；新口径应过滤 `collect_status IS NULL OR collect_status = 'modified'`。
5. 源表打标方法当前写入 `bms_billed_flag = 1, bms_bill_no = ?`；新口径应写入 `bms_collect_status = 'sync'`，账单号留给审计字段或 BMS 标记表。
6. `unmarkSourceByBillNo()`、`restoreSourceMarks()` 与“已采集源数据不能回退/删除”的新约束冲突。
7. 账单创建状态当前主要使用 `GENERATED`；PRD 建议生成过程中使用 `GENERATING`，成功后进入待复核态。
8. `BillGenerateMapper` 仍大量使用注解 SQL 和 `Map<String, Object>`，不符合当前 BMS 开发规范，后续改造应同步收敛。

## 2. 目标业务模型

### 2.1 账单状态和动作边界

当前代码状态常量在 `BmsConstants` 中已有对应关系：

| PRD 状态 | 当前代码状态 | 允许重跑 | 允许账单侧调整 | 说明 |
| --- | --- | --- | --- | --- |
| 起草中 | `DRAFT` | 是 | 是 | 可改阶段 |
| 待复核 | `GENERATED` | 是 | 是 | 可复核、可重跑 |
| 待结清 | `PENDING_SETTLEMENT` | 否 | 否 | 复核完成后，只允许重发、核销 |
| 已结清 | `PAID` | 否 | 否 | 只允许查询追溯 |
| 作废 | `VOID` | 否 | 否 | 历史记录 |

调整要求：

1. `RERUN_ALLOWED_STATUSES` 保持只包含 `DRAFT / GENERATED`。
2. `PENDING_SETTLEMENT / PAID / VOID` 必须禁止进入账单生成任务重跑。
3. `confirm()` 将 `GENERATED` 更新为 `PENDING_SETTLEMENT` 后，账单生成链路不得再修改该账单及其明细。
4. 复核后的补录、红冲、汇率调整必须进入财务调账或账单侧调整链路，不得回源表重扫。

### 2.2 两条任务线

#### 源数据增量采集任务

职责：

1. 扫描源表 `collect_status IS NULL OR collect_status = 'modified'` 的行。
2. 生成或追加 `ar_bill / main_order / fee_detail`。
3. 写入 `bill_source_collect_mark`。
4. 源表成功采集后更新 `collect_status = 'sync'`。
5. 失败时保留 `bill_source_collect_mark = FAILED`，重试只补未完成采集或打标，不重复生成已成功明细。

触发类型：

| 类型 | 使用场景 |
| --- | --- |
| `SCHEDULE` | 周期自动出账 |
| `MANUAL` | 手动生成或补跑 |
| `RETRY` | 失败任务技术重试 |

#### 账单侧调整重算任务

职责：

1. 补录费项。
2. 冲正费项。
3. 调整汇率。
4. 配置变更后对未复核账单做账单侧重算。
5. 只改 BMS 账单、明细、汇总，不回写源表采集状态。

触发类型：

| 类型 | 使用场景 |
| --- | --- |
| `CONFIG_CHANGE` | 账单配置变更触发未复核账单重算 |
| `FINANCE_ADJUSTMENT` | 复核前补录、红冲、汇率调整 |

## 3. 数据库调整方案

### 3.1 源表采集状态字段

订单扩展表、附加费表、理赔表建议统一增加单字段采集状态：

```sql
ALTER TABLE sale_order_header_extend
  ADD COLUMN bms_collect_status varchar(16) DEFAULT NULL COMMENT 'BMS采集状态：NULL未采集/sync已采集/modified已修改待补采',
  ADD COLUMN bms_collect_at datetime DEFAULT NULL COMMENT 'BMS最近采集时间',
  ADD COLUMN bms_collect_task_id bigint DEFAULT NULL COMMENT 'BMS最近采集任务ID';

ALTER TABLE sale_order_additional_matter
  ADD COLUMN bms_collect_status varchar(16) DEFAULT NULL COMMENT 'BMS采集状态：NULL未采集/sync已采集/modified已修改待补采',
  ADD COLUMN bms_collect_at datetime DEFAULT NULL COMMENT 'BMS最近采集时间',
  ADD COLUMN bms_collect_task_id bigint DEFAULT NULL COMMENT 'BMS最近采集任务ID';

ALTER TABLE claim_order
  ADD COLUMN bms_collect_status varchar(16) DEFAULT NULL COMMENT 'BMS采集状态：NULL未采集/sync已采集/modified已修改待补采',
  ADD COLUMN bms_collect_at datetime DEFAULT NULL COMMENT 'BMS最近采集时间',
  ADD COLUMN bms_collect_task_id bigint DEFAULT NULL COMMENT 'BMS最近采集任务ID';
```

说明：

1. `bms_collect_status` 是采集状态唯一判断字段。
2. 旧字段 `bms_billed_flag / bms_bill_no` 进入兼容期，只读不再作为新逻辑的主判断。
3. 如果业务仍需要在源表显示账单号，保留 `bms_bill_no` 作为审计展示字段，但不得用它控制是否采集。
4. 上游修改已采集行时，必须将 `bms_collect_status` 更新为 `modified`。
5. `sync / modified` 行禁止物理删除。

### 3.2 BMS 来源归集标记表

保留 `bill_source_collect_mark`，并补齐账期、幂等和补偿字段：

```sql
ALTER TABLE bill_source_collect_mark
  ADD COLUMN billing_period_start_date date DEFAULT NULL COMMENT '账期开始日期',
  ADD COLUMN billing_period_end_date date DEFAULT NULL COMMENT '账期结束日期',
  ADD COLUMN source_row_hash varchar(64) DEFAULT NULL COMMENT '来源行关键字段哈希',
  ADD COLUMN collect_status varchar(32) DEFAULT NULL COMMENT '归集状态：COLLECTED/VOID/REGENERATED',
  ADD COLUMN source_collect_status varchar(16) DEFAULT NULL COMMENT '源表采集状态快照：NULL/sync/modified';
```

推荐唯一键：

```text
source_system + source_database + source_table + source_id + collect_type
```

推荐新增订单账期归属唯一约束或独立归属表：

```text
source_system + source_table + source_order_id + billing_period_start_date + billing_period_end_date
```

用途：

1. 限制同一订单同一账期跨默认/分支重复归属。
2. 支持重试时判断 BMS 已经写过账单和费用，只补源表状态。
3. 支持审计源数据修改前后的快照。

### 3.3 任务触发类型和状态

`bill_generate_task.trigger_type` 新口径：

```text
SCHEDULE
MANUAL
RETRY
CONFIG_CHANGE
FINANCE_ADJUSTMENT
```

处理策略：

1. `SCHEDULE / MANUAL / RETRY` 走源数据增量采集链路。
2. `CONFIG_CHANGE / FINANCE_ADJUSTMENT` 走账单侧调整重算链路。
3. 废弃 `REGENERATE` 作为源数据重跑触发类型；兼容历史任务展示即可。

任务状态建议保留：

```text
PENDING
RUNNING
SUCCESS
FAILED
NEED_RETRY
CANCELED
```

### 3.4 账单状态补充

如果当前表允许，建议增加生成中状态：

```text
GENERATING
```

落库顺序：

1. 创建 `ar_bill(GENERATING)`。
2. 写 `main_order / fee_detail / bill_source_collect_mark`。
3. 源表状态更新成功。
4. 汇总金额。
5. 更新账单为 `GENERATED`。
6. 更新任务为 `SUCCESS`。

如果短期不增加 `GENERATING`，则任务未成功前生成的 `GENERATED` 账单必须在前端和接口侧屏蔽操作，避免半成品账单被复核。

## 4. 代码调整方案

### 4.1 服务拆分

当前 `BillGenerateServiceImpl` 超过 3000 行，建议按 PRD 推荐结构拆分：

```text
BillGenerateServiceImpl
  - 仅保留手动/定时入口编排

BillGenerateTaskService
  - createTask
  - claimTask
  - finishSuccess
  - finishFailed
  - finishNeedRetry

BillPeriodResolver
  - 计算账期 start/end

BillConfigSnapshotService
  - 创建配置、scope、费项规则、来源 SQL 快照
  - 从任务快照还原执行上下文

BillConfigMatcher
  - 默认/分支互斥匹配

OrderSourceReader
  - 按履约节点分页读取订单宽数据
  - 只读取 NULL / modified 源行

AdditionalFeeCollector
  - 同步附加费归集
  - 增量附加费归集

FeeRuleMatcher
  - 一条来源行拆多条 fee_detail

BillWriter
  - 创建 ar_bill
  - 写 main_order
  - 写 fee_detail
  - 刷新币种汇总和账单金额

BillSourceMarkService
  - 写 bill_source_collect_mark
  - 源表 collect_status 打标
  - FAILED 补偿重试

BillAdjustmentRecalculateService
  - 账单侧补录、冲正、汇率调整后的重算
  - 不访问源表打标逻辑
```

### 4.2 `generate()` 调整

当前职责基本保留，但需要收紧触发类型：

1. `generate(req)` 只允许 `SCHEDULE / MANUAL / RETRY`。
2. 创建任务时写入触发类型、配置快照、范围快照、费项规则快照、来源 SQL 快照。
3. 活动任务校验继续使用同客户同账期维度：

```text
sc_id + shop_id + user_id + member_code + billing_period_start + billing_period_end
```

4. 如果同配置同账期已有历史成功任务，允许再次创建或重置任务，但执行时只采集 `NULL / modified` 增量行。
5. 不再用 `REGENERATE` 表达重跑。

### 4.3 `executeTask()` 调整

执行流程调整为：

```text
query task
  -> 校验 PENDING / NEED_RETRY
  -> claimTask
  -> 从任务快照恢复配置组
  -> 判断 trigger_type
      -> SCHEDULE / MANUAL / RETRY: executeSourceCollectTask
      -> CONFIG_CHANGE / FINANCE_ADJUSTMENT: executeBillRecalculateTask
  -> finish SUCCESS / FAILED / NEED_RETRY
```

注意：

1. `finishTask` 必须使用独立事务。
2. 源表打标失败时，不应直接标记 `SUCCESS`。
3. 如果 BMS 已写入账单和明细，但源表打标失败，任务应进入 `NEED_RETRY`，重试时只补打标。

### 4.4 源数据查询调整

现有订单查询条件：

```sql
AND COALESCE(e.bms_billed_flag, 0) = 0
AND (e.bms_bill_no IS NULL OR e.bms_bill_no = '')
```

调整为：

```sql
AND (e.bms_collect_status IS NULL OR e.bms_collect_status = 'modified')
```

现有附加费查询条件：

```sql
AND COALESCE(a.bms_billed_flag, 0) = 0
AND COALESCE(a.bms_after_bill_added_flag, 0) = 0
```

调整为：

```sql
AND (a.bms_collect_status IS NULL OR a.bms_collect_status = 'modified')
AND COALESCE(a.bms_after_bill_added_flag, 0) = 0
```

现有增量附加费查询条件：

```sql
AND COALESCE(a.bms_after_bill_added_flag, 0) = 1
AND COALESCE(a.bms_billed_flag, 0) = 0
AND (a.bms_bill_no IS NULL OR a.bms_bill_no = '')
```

调整为：

```sql
AND COALESCE(a.bms_after_bill_added_flag, 0) = 1
AND (a.bms_collect_status IS NULL OR a.bms_collect_status = 'modified')
```

理赔查询同理从 `bms_billed_flag / bms_bill_no` 切换到 `bms_collect_status`。

### 4.5 源表打标调整

现有方法：

```java
markSaleOrderExtendFromSource(orderId, billNo)
markAdditionalFromSource(additionalId, billNo)
markClaimFromSource(claimId, billNo)
unmarkSourceByBillNo(billNo)
restoreSourceMarks(oldBillNo, sourceMarks)
```

调整为：

```java
markSaleOrderExtendSync(orderId, taskId)
markAdditionalSync(additionalId, taskId)
markClaimSync(claimId, taskId)
```

SQL 示例：

```sql
UPDATE sale_order_header_extend
   SET bms_collect_status = 'sync',
       bms_collect_at = NOW(),
       bms_collect_task_id = ?
 WHERE sale_order_id = ?
   AND (bms_collect_status IS NULL OR bms_collect_status = 'modified');
```

禁止：

1. 禁止重跑时将 `sync` 回退为 `NULL`。
2. 禁止按 `bill_no` 清空源表采集状态。
3. 禁止删除源表已采集数据来触发重跑。

兼容期可以同步维护 `bms_bill_no = ?` 作为审计展示，但不能作为采集状态判断依据。

### 4.6 `regenerate()` 调整

现有 `regenerate()` 做了以下动作：

1. `unmarkSourceByBillNo(oldBillNo)`。
2. 作废旧 `fee_detail`。
3. 清理 `ar_bill_currency_summary`。
4. 清理 `main_order` 账单字段。
5. 标记来源归集 `REGENERATED`。
6. 作废旧账单。
7. 创建 `triggerType = REGENERATE` 的新任务。
8. 失败时恢复源表打标。

新口径下需要改成：

1. 只允许 `DRAFT / GENERATED`。
2. 不调用 `unmarkSourceByBillNo()`。
3. 不恢复或回退源表 `collect_status`。
4. 对旧账单、旧明细做 BMS 侧作废或版本化。
5. 创建 `MANUAL` 或 `RETRY` 源数据增量采集任务，仅采集 `NULL / modified` 行。
6. 如果业务要求“重新解释已采集费用”，进入 `CONFIG_CHANGE / FINANCE_ADJUSTMENT` 账单侧重算任务，不访问源表。
7. `REGENERATE` 只保留为历史触发类型，不再由新接口产生。

建议将接口语义拆成两个：

| 接口 | 语义 | 影响范围 |
| --- | --- | --- |
| `/api/bms/bill-generate/rerun-source-collect` | 补采源数据增量 | 源表 `NULL / modified` + BMS 账单 |
| `/api/bms/ar-bill/recalculate` | 未复核账单侧重算 | 仅 BMS 账单和明细 |

### 4.7 账单侧调整重算

`ArBillServiceImpl` 当前已有：

1. `manualFee()` 补录费用。
2. `adjustment()` 调账。
3. `rebuildAdjustment()` 重建调账。
4. `confirm()` 复核。

调整方向：

1. `manualFee / adjustment / rebuildAdjustment` 必须只允许 `DRAFT / GENERATED`。
2. 这些方法只写 `fee_detail / fee_adjustment_record / ar_bill_currency_summary / ar_bill`。
3. 不得调用源表打标方法。
4. 调整后统一调用 `BillAmountAggregator` 刷新金额。
5. 如果账单已进入 `PENDING_SETTLEMENT / PAID`，提示走财务调账中心，不允许账单生成或普通重算。

### 4.8 任务补偿重试

新增补偿入口：

```text
retrySourceMarkFailed(taskId)
```

处理逻辑：

1. 查询 `bill_source_collect_mark` 中 `mark_status = FAILED` 的记录。
2. 校验对应 `fee_detail / main_order / ar_bill` 已存在。
3. 只执行源表 `collect_status = sync` 打标。
4. 成功后更新 `mark_status = MARKED`。
5. 全部成功后任务可从 `NEED_RETRY` 更新为 `SUCCESS`。
6. 不重新生成 `fee_detail`。

## 5. Mapper 和 DTO 调整

### 5.1 Mapper 规范化

`BillGenerateMapper` 当前大量使用：

1. `@Select`。
2. `@InsertProvider`。
3. `@SelectProvider`。
4. `Map<String, Object>`。

后续改造建议迁移到：

```text
bms/dao/src/main/resources/sqlmap/BillGenerateMapper.xml
```

要求：

1. 复杂 SQL 放 XML。
2. 使用 `<sql>` 和 `<include>` 复用列和 WHERE。
3. 使用显式 `resultMap`。
4. 不再用 Java 字符串拼接动态 SQL。

### 5.2 DTO 去 Map 化

建议新增明确数据载体：

```text
OrderWideSourceRowDTO
AdditionalFeeSourceRowDTO
ClaimSourceRowDTO
BillGenerateContextDTO
BillGenerateTaskSnapshotDTO
SourceCollectMarkDTO
BillGroupKeyDTO
```

原因：

1. 满足“Controller 和 Service 不使用 Map 入参/返回”的项目规范。
2. 避免来源字段别名拼写错误只能运行期发现。
3. 便于写单元测试和任务补偿逻辑。

## 6. 兼容迁移步骤

### 阶段一：兼容字段上线

1. 源表增加 `bms_collect_status / bms_collect_at / bms_collect_task_id`。
2. 对历史数据做初始化：
   - `bms_billed_flag = 1` 或 `bms_bill_no IS NOT NULL` 的行置为 `sync`。
   - 其他行保持 `NULL`。
3. 新代码查询时优先使用 `bms_collect_status`。
4. 兼容期仍同步写 `bms_bill_no`，但只作为展示。

### 阶段二：生成链路切换

1. 替换订单、附加费、理赔查询条件。
2. 替换源表打标 SQL。
3. 禁用 `unmarkSourceByBillNo()` 的新逻辑调用。
4. `regenerate()` 改为只创建增量采集或账单侧重算任务。
5. 源表打标失败进入 `NEED_RETRY`，补偿入口只补打标。

### 阶段三：任务线拆分

1. 新增 `BillAdjustmentRecalculateService`。
2. `CONFIG_CHANGE / FINANCE_ADJUSTMENT` 不再进入源数据 Reader。
3. 前端按钮语义调整：
   - 起草中/待复核：显示“补采源数据”和“重算账单”。
   - 待结清/已结清：隐藏重跑和重算入口。
4. 任务监控增加任务线类型展示。

### 阶段四：清理旧字段依赖

1. 所有查询去除 `bms_billed_flag / bms_bill_no` 作为采集判断。
2. 文档和测试用例更新为 `bms_collect_status`。
3. 保留旧字段展示一段时间，确认无依赖后再评估下线。

## 7. 验收用例

| 场景 | 前置数据 | 操作 | 预期 |
| --- | --- | --- | --- |
| 首次生成 | 源行 `bms_collect_status IS NULL` | 手动生成 | 生成账单和明细，源行变 `sync` |
| 增量补采 | 已有账单 `GENERATED`，新增源行 `NULL` | 再次生成 | 只采新增行，追加到可改账单 |
| 源行修改 | 已采集源行被上游置为 `modified` | 再次生成 | 只补采 modified 行，成功后置 `sync` |
| 待结清阻断 | 账单 `PENDING_SETTLEMENT` | 触发重跑 | 拒绝，提示复核完成后不能重跑 |
| 已结清阻断 | 账单 `PAID` | 触发重跑 | 拒绝 |
| 账单侧补录 | 账单 `GENERATED` | 补录费用 | 只改 BMS 明细和汇总，不改源表 |
| 源表打标失败 | BMS 明细已写，源库更新失败 | 任务执行 | 任务 `NEED_RETRY/FAILED`，标记记录为 `FAILED` |
| 补偿重试 | 存在 `mark_status = FAILED` | 补偿重试 | 只补源表 `sync`，不新增 fee_detail |
| 重跑不回退源标记 | 源行已经 `sync` | 重跑 | 不把源行改回 `NULL`，不全量回扫 |
| 分支默认互斥 | 同客户有分支和默认配置 | 生成 | 分支先抢，默认只吃剩余订单 |

## 8. 风险和待确认

1. 源系统是否能保证已采集数据修改时自动置为 `modified`，需要与 OFP/OMS 确认。
2. `bms_bill_no` 是否仍要求写回源表展示；如保留，需要明确它不是采集状态字段。
3. `modified` 行补采时，是生成差额费用、作废重建原费用，还是进入调账中心，需要产品确认。
4. `GENERATING` 状态是否可以加到 `ar_bill.bill_status`；如果不能，需要通过任务状态屏蔽半成品账单。
5. `claim_order` 是否纳入新 PRD 的“数据源单字段采集状态”范围；现有代码已把理赔纳入生成链路，建议统一。
6. 现有测试文档仍以 `bms_billed_flag / bms_bill_no` 为准，需要同步更新。

## 9. 推荐实施顺序

1. 先做数据库兼容字段和历史数据初始化。
2. 再切换源数据查询和源表打标逻辑。
3. 随后改造 `regenerate()`，移除源表回退行为。
4. 再拆分 `BillSourceMarkService` 和补偿重试入口。
5. 最后拆分 `BillGenerateServiceImpl` 大类、迁移 Mapper XML、DTO 去 Map 化。

优先级：

| 优先级 | 内容 |
| --- | --- |
| P0 | 源表状态字段切换、复核后重跑阻断、移除源表回退、补偿重试 |
| P1 | 任务线拆分、`GENERATING` 状态、任务监控展示 |
| P2 | Mapper XML 化、DTO 去 Map 化、旧字段下线 |

