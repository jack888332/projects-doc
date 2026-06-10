# BMS 账单生成订单任务现状与源数据变更补账说明

## 1. 文档目的

本文结合以下产品设计、技术调整方案和当前代码实现，梳理 BMS 应收账单生成订单任务的实际运行链路，以及源数据新增、修改后如何补充到账单。

参考文档：

1. `aidocs/product-caliber/bms/prd/bms-bill-generation-design.md`
2. `aidocs/product-caliber/bms/prd/账单生成机制.PRD.md`
3. `aidocs/technical-caliber/bms/dev-specs/bms-bill-generate-adjustment-plan.md`

本文重点区分：

1. **当前代码已经实现的行为**。
2. **设计文档规划但尚未落地的目标行为**。

## 2. 核心结论

当前账单生成任务仍采用以下模式：

```text
OFP 业务源表
  -> 账单生成任务直接拉取未归集订单、附加费和理赔
  -> 写入 ar_bill、main_order、fee_detail
  -> 写入 bill_source_collect_mark
  -> 回写源表 bms_billed_flag、bms_bill_no
```

当前已经支持：

1. 首次生成账单。
2. 同账期新增订单增量追加到账单。
3. 账单生成后新增的附加费增量归集。
4. 对 `DRAFT`、`GENERATED` 状态账单追加费用并重新汇总。
5. 源表打标失败时记录失败轨迹，避免静默丢失。
6. 对可修改状态的整张账单执行“作废旧账单、回退源表标记、创建异步重跑任务”。

当前尚未支持：

1. 自动识别已经归集、后来金额或其他关键字段发生修改的源数据。
2. 根据 `source_row_hash` 自动创建新的费用版本。
3. 使用 `bill_fee_detail_relation` 区分来源费用和账单侧费用关系。
4. 已复核账单发生源数据变化时自动生成后续调整。

因此，当前代码中：

> 未归集的新数据可以通过再次运行生成任务补充到账单；已经归集的数据发生修改后，不会被普通生成任务自动补充。

## 3. 当前任务入口

### 3.1 计划任务

计划任务类：

```text
bms/biz/src/main/java/com/szt/supplychain/bms/biz/task/BillGeneratePlanJob.java
```

职责：

1. 扫描启用的账单配置。
2. 按当前账期创建 `bill_generate_task`。
3. 任务初始状态为 `PENDING`。
4. 只创建待执行任务，不直接生成账单。

主要调用：

```text
BillGenerateService.enqueueCurrentPeriodForEnabledConfigs()
```

### 3.2 执行任务

执行任务类：

```text
bms/biz/src/main/java/com/szt/supplychain/bms/biz/task/BillGenerateTaskExecuteJob.java
```

职责：

1. 按分片扫描 `PENDING`、`NEED_RETRY` 状态任务。
2. 调用 `executeTask()` 领取并执行任务。
3. 同一个客户、同一个账期只允许一个任务处于 `RUNNING`。

主要调用：

```text
BillGenerateService.executePendingTasks(shardingItem, shardingTotal)
  -> BillGenerateService.executeTask(taskId, operator)
```

## 4. 账单生成任务运行流程

当前主要实现位于：

```text
bms/biz/src/main/java/com/szt/supplychain/bms/biz/service/impl/BillGenerateServiceImpl.java
```

### 4.1 创建任务

手动生成、定时生成都会先调用：

```text
generate(BillGenerateReqDTO)
  -> createTask(BillGenerateReqDTO)
```

创建任务时执行：

1. 查询账单配置。
2. 校验供应链归属。
3. 计算账期开始、结束日期。
4. 校验同客户、同账期是否已有活动任务。
5. 查询费项规则和币种规则。
6. 保存配置、范围、费项规则等任务快照。
7. 新增或复用 `bill_generate_task`，状态设为 `PENDING`。

同一客户、同一账期的活动任务判断维度为：

```text
sc_id
+ shop_id
+ user_id
+ member_code
+ billing_period_start_date
+ billing_period_end_date
```

### 4.2 领取任务

`executeTask()` 只允许执行：

```text
PENDING
NEED_RETRY
```

任务领取成功后状态改为：

```text
RUNNING
```

领取时会检查同客户、同账期是否已有其他 `RUNNING` 任务，避免默认配置和分支配置并发抢同一订单。

### 4.3 查询订单候选集合

任务按账单配置从 OFP 查询订单主表和扩展表宽数据：

```text
sale_order_header
LEFT JOIN sale_order_header_extend
```

主要过滤条件：

1. 客户、店铺、供应链匹配。
2. 订单业务类型匹配。
3. 履约节点时间在当前账期内。
4. 订单尚未被 BMS 归集。

当前未归集判断条件等价于：

```sql
COALESCE(e.bms_billed_flag, 0) = 0
AND (e.bms_bill_no IS NULL OR e.bms_bill_no = '')
```

账期时间根据账单配置的履约节点确定，不直接使用订单创建时间。

### 4.4 默认配置和分支配置归属

订单分配遵循：

```text
分支配置优先
  -> 默认配置兜底
```

处理规则：

1. 分支配置按目的国、仓库等范围匹配订单。
2. 已命中分支配置的订单不会再次进入默认配置。
3. 未命中任何分支配置的订单才进入默认配置。
4. 同一订单在同一账期只能归属一个配置。

### 4.5 按业务板块和目的国拆账单

订单分配到账单配置后，继续按以下维度拆分账单：

```text
business_sector
+ destination_country
```

业务板块或目的国缺失时，任务直接失败，避免将数据归入错误账单。

### 4.6 创建或匹配已有账单

每个分组执行 `executeBillGroup()`。

查找账单的主要维度：

```text
bill_config_id
+ billing_period_start_date
+ billing_period_end_date
+ business_sector
+ destination_country
```

处理规则：

1. 没有已有账单时，创建新账单。
2. 已有账单为 `DRAFT` 或 `GENERATED` 时，允许增量追加。
3. 已有账单已核销、待结清或已结清时，不允许继续追加。

### 4.7 写入订单和费用

单个账单分组的写入顺序为：

```text
创建或匹配 ar_bill
  -> 写入 main_order 订单快照
  -> 按订单宽表拆分主费用 fee_detail
  -> 查询并写入普通附加费 fee_detail
  -> 查询并写入理赔费用 fee_detail
  -> 写来源归集轨迹
  -> 回写源表归集标记
  -> 重建币种汇总
  -> 刷新账单应收金额
  -> 更新账单状态为 GENERATED
```

一条订单宽数据可以根据费项规则拆成多条费用明细。例如：

```text
订单 SO10001
  运费：100
  超重费：20
  仓租费：0
```

生成：

```text
SO10001 + 运费 + 100
SO10001 + 超重费 + 20
```

金额为空或为零的费项不生成费用明细。

### 4.8 来源表打标

费用成功写入后，任务会写入 `bill_source_collect_mark`，并回写源表：

```text
bms_billed_flag = 1
bms_bill_no = 当前账单号
```

涉及的主要源表：

1. `sale_order_header_extend`
2. `sale_order_additional_matter`
3. `claim_order`

来源打标过程使用：

```text
PENDING
  -> MARKED
  -> FAILED
```

如果源表更新失败，会记录失败轨迹并使当前任务失败，便于后续补偿。

### 4.9 完成任务

任务成功后：

1. 更新拉取订单数。
2. 更新命中订单数。
3. 更新费用明细数、附加费数。
4. 更新本次任务生成金额。
5. 将任务状态更新为 `SUCCESS`。

发生异常时，任务状态更新为：

```text
FAILED
```

并记录错误信息。

## 5. 新增订单如何补充到账单

### 5.1 适用场景

例如某账期账单已经生成，之后发现还有一条属于该账期的新订单尚未归集。

只要源订单满足：

```text
bms_billed_flag = 0
bms_bill_no 为空
履约节点时间属于原账期
```

再次手动触发同配置、同账期生成任务时，该订单会被重新扫描到。

### 5.2 补充规则

任务找到相同：

```text
账单配置
+ 账期
+ 业务板块
+ 目的国
```

对应的已有账单后：

1. 如果账单是 `DRAFT` 或 `GENERATED`，将订单和费用追加到已有账单。
2. 追加完成后重新构建币种汇总和账单金额。
3. 如果账单已进入不可修改状态，任务拒绝追加并报错。

## 6. 新增附加费如何补充到账单

### 6.1 普通附加费

主订单生成时，会同时查询当前订单集合对应的普通附加费。

当前主要过滤条件：

```text
bms_billed_flag = 0
bms_after_bill_added_flag = 0
fee_amount 非空且不为 0
fee_pay_status = waiting_pay
```

命中的费用直接写入当前账单。

### 6.2 出账后新增附加费

账单生成后新增的附加费，通过增量附加费链路处理。

主要过滤条件：

```text
bms_after_bill_added_flag = 1
bms_billed_flag = 0
bms_bill_no 为空
fee_amount 非空且不为 0
fee_pay_status = waiting_pay
```

归集类型记录为：

```text
ADDITIONAL_INCREMENT
```

当前处理策略：

1. 原账期账单为 `DRAFT` 或 `GENERATED` 时，追加到原账单。
2. 原账期账单不可追加时，寻找最近一张可追加账单。
3. 找不到可追加账单时，任务失败并提示业务处理。
4. 追加完成后重新计算目标账单金额。

## 7. 已归集源数据发生修改时的当前行为

### 7.1 当前任务不能自动识别修改

普通账单任务查询源数据时，只扫描未归集数据：

```text
bms_billed_flag = 0
bms_bill_no 为空
```

假设某条订单费用首次归集时为：

```text
运费 = 100
bms_billed_flag = 1
```

之后上游将运费修改为：

```text
运费 = 120
```

如果上游没有修改 BMS 标记，该数据仍然是：

```text
bms_billed_flag = 1
```

再次执行普通账单生成任务时，该订单不会被查询到，新增的 20 元差额不会自动补充到账单。

### 7.2 当前重跑账单的处理方式

当前整张账单重跑入口为：

```text
POST /api/bms/billGenerate/regenerate
  -> BillGenerateController.regenerate()
  -> BillGenerateServiceImpl.regenerate()
```

请求参数：

```text
scId
billNo
reason
operator
```

前端应收账单页面支持单条或批量选择账单重跑，但批量处理实际是前端按账单号逐个调用重跑接口，不是后端单事务批量重跑。

#### 7.2.1 重跑前置校验

重跑前依次校验：

1. 账单编号不能为空。
2. 账单必须存在。
3. 请求供应链 `scId` 必须与账单一致。
4. 账单不能已经核销或部分核销。
5. 账单状态不能是 `PAID` 或 `SETTLED`。
6. 账单必须存在 `bill_config_id`。
7. 账单状态只允许：

```text
DRAFT
GENERATED
```

对应业务含义为“起草中”和“待复核”。进入待结清、已结清等后续状态后，不允许通过账单生成任务重跑。

#### 7.2.2 重跑不是原账单就地重算

当前 `regenerate()` 不是在原账单上重新计算金额，而是：

```text
查询并保存原账单来源归集轨迹
  -> 回退原账单关联源数据的 BMS 打标
  -> 作废原账单费用明细
  -> 删除原账单币种汇总
  -> 清空订单快照上的账单关联字段
  -> 将来源归集轨迹标记为 REGENERATED
  -> 将原账单标记为 VOID 并逻辑删除
  -> 创建 trigger_type = REGENERATE 的生成任务
  -> 等待任务执行 Job 异步重新生成
```

接口返回成功只表示：

> 原账单已完成作废处理，并成功创建重跑任务。

此时新账单不一定已经生成完成。新任务仍需由 `BillGenerateTaskExecuteJob` 扫描并执行。

#### 7.2.3 重跑时具体修改的数据

当前 `regenerate()` 会执行：

1. 校验原账单必须为 `DRAFT` 或 `GENERATED`。
2. 查询原账单所有 `mark_status = MARKED` 的来源归集轨迹，用于失败时恢复源表标记。
3. 回退源表 BMS 标记。
4. 作废原 `fee_detail`。
5. 删除原币种汇总。
6. 清理 `main_order` 上的账单关联字段。
7. 将原来源归集轨迹标记为 `REGENERATED`。
8. 将原账单状态改为 `VOID`，并设置 `is_deleted = 1`。
9. 使用原账单的配置和账期创建 `REGENERATE` 类型任务。

源表回退范围：

| 源表 | 回退内容 |
| --- | --- |
| `sale_order_header_extend` | `bms_billed_flag = 0`，`bms_bill_no = NULL` |
| `sale_order_additional_matter` | `bms_billed_flag = 0`，`bms_bill_no = NULL` |
| `claim_order` | `bms_billed_flag = 0`，`bms_bill_no = NULL`，`bms_billed_at = NULL` |

BMS 数据处理：

| 数据对象 | 重跑处理 |
| --- | --- |
| `fee_detail` | 原账单费用状态改为 `VOID`，不物理删除 |
| `ar_bill_currency_summary` | 按原账单号物理删除汇总记录 |
| `main_order` | 保留订单快照行，但清空账单、配置、任务、账期和币种关联字段 |
| `bill_source_collect_mark` | 原账单轨迹状态改为 `REGENERATED`，重跑原因写入错误信息字段 |
| `ar_bill` | 状态改为 `VOID`，并逻辑删除 |
| `bill_generate_task` | 新增或复用同配置、同账期、`REGENERATE` 类型任务，重置为 `PENDING` |

#### 7.2.4 新任务如何重新生成

新创建的 `REGENERATE` 任务继续走普通账单生成主链路：

```text
PENDING
  -> Job 扫描并领取任务
  -> RUNNING
  -> 重新查询当前源表中未打标的数据
  -> 按当前任务创建时保存的配置和规则快照生成账单
  -> 重新写 main_order、fee_detail、来源轨迹
  -> 重新回写源表标记
  -> SUCCESS / FAILED
```

由于重跑前已把原账单关联的源表标记回退为未归集，新任务能够重新读取这些源数据。源表金额已发生修改时，新任务读取的是重跑执行时的最新源数据值。

需要注意：

1. 重跑使用原账单的 `bill_config_id` 和原账期。
2. 创建重跑任务时会重新读取当前账单配置和费项规则，并生成新的任务快照。
3. 如果原配置已删除、失效或规则已经变化，重跑结果可能与原账单不同，甚至可能无法创建或执行。
4. 重跑会重新执行默认配置、分支配置归属以及业务板块、目的国拆单逻辑。
5. 如果源数据在重跑前已被删除，任务无法恢复原费用。

#### 7.2.5 重跑失败时的恢复边界

`regenerate()` 使用 BMS 本地事务执行账单侧清理和任务创建，但源表回退通过独立 JDBC 连接执行，无法与 BMS 数据库处于同一个本地事务。

如果重跑准备阶段发生异常：

1. BMS 本地事务会回滚账单侧修改。
2. 代码会根据重跑前查询到的 `bill_source_collect_mark`，尝试恢复源表打标。
3. 恢复时会重新将来源行标记到原账单号。
4. 某条来源行恢复失败时只记录错误日志，不会继续向上抛出恢复异常。

因此仍存在跨库一致性风险：

1. 源表回退成功，但后续准备失败且恢复源表标记也失败。
2. 来源归集轨迹缺失时，失败恢复无法覆盖对应源数据。
3. 接口成功创建任务后，异步任务仍可能执行失败，此时原账单已经作废，需要通过任务监控处理。

#### 7.2.6 重跑与同账期增量生成的区别

| 对比项 | 同账期增量生成 | 整张账单重跑 |
| --- | --- | --- |
| 主要目的 | 补充尚未归集的新订单、新附加费 | 使用当前源数据重新生成整张账单 |
| 原账单处理 | 保留并追加 | 作废并逻辑删除 |
| 原费用明细 | 保留 | 标记为 `VOID` |
| 源表标记 | 不回退，只扫描未归集数据 | 先回退原账单关联源表标记 |
| 任务类型 | `MANUAL`、`SCHEDULE` 等 | `REGENERATE` |
| 允许状态 | 目标账单必须可追加 | 原账单必须为 `DRAFT / GENERATED` |
| 接口完成含义 | 创建增量任务 | 作废原账单并创建异步重跑任务 |

#### 7.2.7 当前“重新生成订单”入口并不重新读取源数据

账单费用明细页面还存在单订单入口：

```text
POST /api/bms/ar-bill/regenerate-order
  -> ArBillServiceImpl.regenerateOrder()
```

当前实现只执行：

1. 校验账单和订单号。
2. 给该订单已有费用明细追加“手动重新生成订单费用”备注。
3. 基于现有 `fee_detail` 重新汇总账单金额。

该入口目前不会：

1. 查询 OFP 最新订单数据。
2. 回退订单源表标记。
3. 重新拆分订单费用。
4. 新增或替换 `fee_detail`。

因此当前“重新生成订单”更接近“标记并刷新现有账单汇总”，不能用于把源订单修改后的最新金额补到账单。

因此，当前源数据修改后如需重新拉取，只能通过：

1. 重跑整个账单。
2. 或在账单侧走人工补录、冲正、调账。

当前重跑方式可以重新读取修改后的源数据，但会回退源表归集标识并作废旧账单，不是最终目标方案。

## 8. 目标方案中的源数据修改补账机制

最新技术调整方案要求将当前模型拆分为：

```text
业务源表
  -> fee_detail
     BMS 费用源数据池，保存不可修改的来源费用版本
  -> bill_fee_detail_relation
     保存费用如何计入账单及账单侧金额、币种、汇率
  -> ar_bill / ar_bill_currency_summary
     保存账单及汇总金额
```

### 8.1 来源变化识别

目标方案通过以下方式识别已归集源数据修改：

1. 数据集配置来源修改时间字段 `modified_time_column`。
2. 来源变化任务扫描近期已修改数据。
3. 计算最新 `source_row_hash`。
4. 与 BMS 已保存的最近版本哈希比较。
5. 哈希未变化时跳过。
6. 哈希发生变化时，新增一条 `fee_detail` 版本，不覆盖旧版本。

### 8.2 根据账单状态处理修改

| 原账单状态 | 目标处理方式 |
| --- | --- |
| `DRAFT / GENERATED` | 旧费用关系置为 `REPLACED`，新费用版本重新关联原账单并刷新金额 |
| `PENDING_SETTLEMENT / PAID` | 原账单保持不变，进入后续账单调整或财务调账中心 |
| `VOID` | 不恢复原账单，根据当前有效配置决定是否进入新账单 |

### 8.3 目标方案的关键原则

1. 源数据修改后新增版本，不覆盖历史版本。
2. 不再通过清空 `bms_billed_flag` 模拟未归集。
3. 账单重跑不再回退源表标记。
4. 财务补录、冲正、调整汇率只修改账单侧关系。
5. 已复核账单不因源数据变化被直接修改。

## 9. 当前实现与目标方案差异

| 能力 | 当前代码 | 目标方案 |
| --- | --- | --- |
| 首次同步未归集订单 | 已实现 | 保留 |
| 同账期新增订单追加 | 已实现 | 保留 |
| 出账后新增附加费归集 | 已实现 | 保留并独立任务化 |
| 来源归集轨迹 | 已实现基础补偿轨迹 | 扩展为来源版本轨迹 |
| 已归集源数据修改识别 | 未实现 | 使用修改时间和行哈希识别 |
| 来源费用版本 | 未实现 | `fee_detail` 新增版本，不覆盖旧版本 |
| 账单费用关系表 | 未实现 | 使用 `bill_fee_detail_relation` |
| 可修改账单接收新版本 | 未实现 | 替换旧关系并刷新账单 |
| 已复核账单接收变化 | 未实现 | 进入后续调整或财务调账 |
| 重跑时源表标记处理 | 清空标记后重新生成 | 禁止清空源表标记 |

## 10. 业务场景处理汇总

| 场景 | 当前实际处理 |
| --- | --- |
| 新订单首次进入账期 | 生成任务扫描未打标订单并生成账单 |
| 同账期存在漏跑订单 | 再次生成，只追加未打标订单 |
| 账单生成后新增附加费 | 扫描出账后新增附加费，追加到可修改账单 |
| 已归集订单金额被修改 | 普通生成任务无法自动识别 |
| 修改后的费用需要立即修正 | 当前通过重跑整个账单或人工调账处理 |
| 整张账单重跑 | 作废原账单、回退源表标记、创建 `REGENERATE` 异步任务重新生成 |
| 单订单“重新生成” | 当前只追加备注并按现有费用刷新汇总，不会重新读取源数据 |
| 账单已经待结清或已结清 | 不允许普通增量追加或重跑 |
| 目标方案中的来源修改 | 新增费用版本，可修改账单替换关系，不可修改账单进入后续调整 |

## 11. 当前风险和后续落地重点

### 11.1 当前风险

1. 已归集源数据修改后无法自动识别，可能导致账单金额与最新源数据不一致。
2. 当前重跑会回退源表归集标记，存在重复归集和跨库补偿复杂度。
3. `fee_detail` 同时承担来源费用和账单费用职责，来源数据与账单侧调整边界不清晰。
4. 已复核账单发生来源变化时，缺少标准化的后续调整链路。

### 11.2 后续优先落地内容

按照 `bms-bill-generate-adjustment-plan.md`，建议优先完成：

1. 创建 `bill_fee_detail_relation`。
2. 将来源费用同步和账单生成拆为独立任务。
3. 账单生成只消费已同步的 `fee_detail`。
4. 增加来源修改时间字段配置和 `source_row_hash` 比对。
5. 来源发生变化时新增 `fee_detail` 版本。
6. 移除重跑时清空源表归集标记的逻辑。
7. 将补录、冲正、调账和汇率调整统一切到账单费用关系。

## 12. 相关代码索引

| 职责 | 文件或方法 |
| --- | --- |
| 创建计划任务 | `BillGeneratePlanJob` |
| 执行待处理任务 | `BillGenerateTaskExecuteJob` |
| 创建生成任务 | `BillGenerateServiceImpl.generate()`、`createTask()` |
| 领取并执行任务 | `BillGenerateServiceImpl.executeTask()` |
| 任务主编排 | `BillGenerateServiceImpl.executeTaskInternal()` |
| 默认和分支配置分配 | `BillGenerateServiceImpl.assignOrdersToConfigGroup()` |
| 单账单分组生成 | `BillGenerateServiceImpl.executeBillGroup()` |
| 附加费增量归集 | `BillGenerateServiceImpl.executeIncrementalAdditionalGroup()` |
| 来源打标及补偿 | `BillGenerateServiceImpl.markSourceWithCompensation()` |
| 当前账单重跑 | `BillGenerateServiceImpl.regenerate()` |
| 源表标记回退 | `BillGenerateServiceImpl.unmarkSourceByBillNo()` |
| 重跑失败恢复源表标记 | `BillGenerateServiceImpl.restoreSourceMarks()` |
| 当前单订单“重新生成” | `ArBillServiceImpl.regenerateOrder()` |
