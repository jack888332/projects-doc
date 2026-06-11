# BMS 账单生成机制调整开发计划

> 设计依据：`aidocs/technical-caliber/bms/dev-specs/bms-bill-generate-adjustment-plan.md`
>
> 现状依据：`aidocs/technical-caliber/bms/dev-specs/bms-bill-generation-task-current-flow.md`
>
> 本计划用于指导开发、数据迁移、联调、验收和上线。设计文档定义目标模型和规则，本计划按依赖关系将其拆分为可执行开发批次。

## 1. 开发目标

本次开发将当前“来源同步、账单生成、账单调整共用 `fee_detail`”的实现调整为：

```text
业务源表
  -> fee_detail
     只保存来源费用事实及版本
  -> bill_fee_detail_relation
     保存账单归属、结算币种、汇率、金额和调整状态
  -> ar_bill_currency_summary / ar_bill
     从有效账单费用关系汇总
```

最终必须实现：

1. 来源费用同步与账单生成拆为独立任务。
2. `fee_detail` 不再保存或更新账单归属、账单汇率、账单金额和账单调整状态。
3. 所有账单金额、币种汇总、详情和导出统一读取 `bill_fee_detail_relation`。
4. 补录、调账、红冲、汇率调整和重跑只操作账单费用关系，不修改来源费用。
5. 账单重跑不再清空业务源表 `bms_billed_flag / bms_bill_no`。
6. 来源数据修改通过哈希和版本识别，新增 `fee_detail` 版本，不覆盖旧版本。
7. 多账单类型通过 `bill_type` 隔离配置、任务、汇率和费用关系。
8. 存量账单迁移前后金额逐账单一致，未知状态或对账差异必须阻断上线。

## 2. 实施原则

### 2.1 强制门禁

1. P0-0 生产等价环境 Schema 摸底未完成前，禁止执行 `fee_detail` 改造 DDL。
2. 存量迁移演练和逐账单金额对账未通过前，禁止切换账单详情、汇总、导出和核销读路径。
3. 新关系写入和幂等验证未通过前，禁止删除旧 `fee_detail` 账单侧字段。
4. 新任务链路稳定前，禁止删除当前任务执行入口和任务监控能力。
5. 每个阶段必须删除本阶段已被替代的旧逻辑，不长期保留双实现。

### 2.2 开发规范

1. Java 目标版本为 Java 8。
2. 新增实体、DTO、Context 的类和字段必须有 JavaDoc。
3. Controller 和 Service 不使用 `Map<String, Object>` 作为入参或返回值。
4. 新增复杂 SQL 必须放在 MyBatis XML 中。
5. 写操作必须使用 `@Transactional(rollbackFor = Exception.class)`。
6. 金额使用 `BigDecimal`，数据库金额使用 `DECIMAL(18,4)`，汇率使用 `DECIMAL(18,8)`。
7. SQL 的 WHERE 条件列不得使用函数。
8. 数据隔离条件必须包含 `sc_id / shop_id / user_id`。
9. 状态、关系类型、任务类型和账单类型必须使用常量或枚举，不新增魔法值。

## 3. 里程碑与依赖

| 阶段 | 目标 | 主要输出 | 依赖 |
| --- | --- | --- | --- |
| P0-0 | 确认生产事实和冻结口径 | Schema 基线、调用清单、迁移映射、对账基线 | 无 |
| P0-1 | 修正多账单类型和配置边界 | `bill_type` 维度、配置唯一约束、规则解耦方案 | P0-0 |
| P0-2 | 建立来源费用池和账单关系模型 | 新 DDL、Entity、DTO、Mapper、迁移脚本 | P0-0/P0-1 |
| P0-3 | 完成存量迁移和关系表读路径切换 | 存量关系、金额对账、详情/汇总/导出新读路径 | P0-2 |
| P1-1 | 改造账单侧写操作 | 补录、调账、红冲、汇率调整写关系表 | P0-3 |
| P1-2 | 拆分来源费用同步任务 | 来源同步独立任务、来源打标补偿 | P0-2 |
| P1-3 | 改造账单生成任务 | 消费 `fee_detail`、生成关系、统一汇总 | P1-1/P1-2 |
| P1-4 | 改造重跑和任务执行框架 | 重算任务、执行器注册表、禁止回退源表标识 | P1-3 |
| P2 | 来源变化识别和版本替换 | 修改扫描、哈希比对、新版本关联处理 | P1-4 |
| P3 | 收口、前端联调和上线 | 删除旧逻辑、全链路验收、上线与回滚材料 | P2 |

推荐按以上阶段顺序执行，不建议将 P0-2 至 P1-4 合并为一次大提交。

## 3.1 当前进度同步（2026-06-11）

### 本轮范围说明

1. 按“历史数据暂不考虑迁移，直接修改表结构”的口径推进。
2. 本轮优先打通“新关系写入 + 统一汇总 + 主生成链路/补录链路”。
3. 存量迁移、对账口径、旧读路径完全切换、调账/红冲全量改造仍未完成。

### 已完成

1. 已新增直接改表脚本：
   `fee_detail_bill_generate_direct_alter.sql`、
   `bill_fee_detail_relation_create.sql`、
   `bill_fee_relation_migration_map_create.sql`。
2. 已新增 `BillFeeDetailRelation` 实体、DTO、查询 DTO、Mapper 与 XML。
3. 已新增 `BillAmountAggregateService`，并将 `BillGenerateServiceImpl`、`ArBillServiceImpl` 的金额重建委托到统一汇总服务。
4. 账单生成主链路已改为：写入 `fee_detail` 后同步写入 `bill_fee_detail_relation`，账单金额汇总优先读取有效关系。
5. `manualFee()` 已同步写入账单费用关系，但关系类型语义仍需继续收口；`saveExchangeRates()` 已改为刷新关系表汇率并重算账单金额。
6. `regenerate()` 已补充作废账单关系的动作。

### 未完成

1. `ArBillServiceImpl.adjustment()`、`rebuildAdjustment()`、`regenerateOrder()` 仍未完全切换为只操作关系表。
2. 账单详情、导出、订单费用汇总、核销相关查询仍有部分旧 SQL 继续读取 `fee_detail` 账单侧字段。
3. `FeeDetail` / `FeeDetailMapper` 仍未彻底收口为“仅来源费用池”最终形态。
4. 来源同步任务拆分、任务执行器模板化、来源版本替换识别尚未开始。

### 当前验证结论

1. `git diff --check` 已通过。
2. Maven 编译仍受环境阻塞：缺少私服父 POM `com.szt:supplychain-parent:0.0.1-SNAPSHOT`，暂未完成本地编译验收。

## 4. P0-0：生产事实确认

### 4.1 数据库摸底

- [ ] 在生产等价环境执行并归档 `SHOW CREATE TABLE fee_detail`。
- [ ] 执行并归档 `SHOW FULL COLUMNS FROM fee_detail`。
- [ ] 执行并归档 `SHOW INDEX FROM fee_detail`。
- [ ] 执行并归档 `bill_source_collect_mark`、`bill_generate_task`、`bill_exchange_rate`、`bill_config`、`ar_bill_currency_summary` 的真实 DDL 和索引。
- [ ] 统计 `fee_detail.fee_status` 全部状态及金额正负分布。
- [ ] 统计 `fee_detail` 中账单号为空、账单不存在、配置不存在、金额为空和币种为空的数据。
- [ ] 统计同一来源费用业务键的重复记录和版本分布。
- [ ] 检查 `bill_config.bill_type` 空值、重复当前默认配置和父子配置账单类型不一致数据。
- [ ] 检查 `fee_source_rule` 是否具备稳定去重表达式及可靠修改时间字段。
- [ ] 确认业务源表已有 `bms_billed_flag / bms_bill_no` 字段和真实语义。

### 4.2 代码调用摸底

- [ ] 确认生产部署版本及对应 Git commit。
- [ ] 盘点 `BillGenerateMapper.insertFeeDetail` 的实际调用入口和生产执行情况。
- [ ] 盘点 `FeeDetailController / FeeDetailService / FeeDetailMapper.xml` 的真实调用方。
- [ ] 盘点 `BillGenerateMapper` 中所有直接写入、更新和汇总 `fee_detail` 的方法。
- [ ] 盘点 `ArBillMapper` 中所有直接读取、更新和汇总 `fee_detail` 的方法。
- [ ] 盘点账单详情、导出、收款核销、来源付款回写对 `fee_detail` 账单字段的依赖。
- [ ] 盘点 `BillConfigMapper` 所有当前版本查询、停用和版本切换 SQL。
- [ ] 盘点 `FeeIndexMapper` 中 `business_type_fee_index + fee_source_rule` 混合查询。
- [ ] 盘点前端应收账单页面对 `feeDetailId`、费用状态和重跑提示的依赖。

重点现有文件：

```text
bms/model/.../FeeDetail.java
bms/dao/.../FeeDetailMapper.java
bms/dao/src/main/resources/sqlmap/FeeDetailMapper.xml
bms/dao/.../BillGenerateMapper.java
bms/dao/.../ArBillMapper.java
bms/dao/src/main/resources/sqlmap/ArBillMapper.xml
bms/dao/.../BillConfigMapper.java
bms/dao/.../FeeIndexMapper.java
bms/biz/.../BillGenerateServiceImpl.java
bms/biz/.../ArBillServiceImpl.java
admin_shell/src/views/billing/receivableBill/index.vue
```

### 4.3 P0-0 输出物

- [ ] 新增 `fee_detail-schema-baseline.md`，保存真实 DDL、字段差异矩阵和唯一命名结论。
- [ ] 输出 `fee_detail` 直接读写 SQL 调用清单。
- [ ] 输出保留、删除、重写的 Entity、DTO、Service、Mapper、XML 和接口清单。
- [ ] 输出 `fee_status -> relation_type + relation_status` 唯一迁移映射。
- [ ] 输出逐账单迁移前金额基线 SQL。
- [ ] 输出迁移失败回滚方案。
- [ ] 对所有未知状态、无法映射数据和重复来源业务键形成处理结论。

### 4.4 P0-0 退出条件

- [ ] 已冻结唯一数据库字段命名和 Java 属性命名。
- [ ] 已确认 `fee_detail` 最终保留字段和移出字段。
- [ ] 已确认 `source_fee_key` 计算规则和唯一键。
- [ ] 已确认存量状态不存在未知值，或未知值已有书面迁移规则。
- [ ] 已确认所有影响金额的旧读写路径。
- [ ] 数据、开发、测试和财务共同确认迁移及对账口径。

## 5. P0-1：配置与规则边界修正

### 5.1 `bill_config` 多账单类型隔离

- [ ] 为存量 `bill_config` 回填明确 `bill_type`。
- [ ] 检查同一客户、同一 `bill_type` 的重复当前默认配置。
- [ ] 调整当前默认配置唯一约束，使唯一维度包含 `bill_type`。
- [ ] `BillConfigMapper` 所有当前版本查询增加 `bill_type` 条件。
- [ ] 所有配置停用、版本切换和默认配置查询增加 `bill_type` 条件。
- [ ] 父子配置保存时校验 `bill_type` 一致。
- [ ] 任务创建时保存和校验 `bill_type`。

### 5.2 费项身份与来源规则解耦

- [ ] 明确 `fee_index` 作为稳定费项身份。
- [ ] 明确 `fee_source_rule` 只负责来源读取和审计。
- [ ] `business_type_fee_index` 移除对 `fee_source_rule_id` 的业务依赖。
- [ ] 账单准入查询只读取 `business_type_fee_index + fee_index`。
- [ ] 来源同步查询直接读取数据集启用的 `fee_source_rule`。
- [ ] 币种模板和账单费项币种规则统一以 `fee_index_id` 关联。
- [ ] 每条启用来源规则补齐稳定 `dedupe_key_expr`。

### 5.3 共享表增加 `bill_type`

- [ ] `bill_generate_task` 增加并回填 `bill_type`。
- [ ] `bill_exchange_rate` 增加并回填 `bill_type`。
- [ ] 任务唯一约束、运行中任务检查和监控查询加入 `bill_type`。
- [ ] 汇率查询、保存和唯一约束加入 `bill_type`。
- [ ] 任务监控页面和 DTO 展示 `bill_type`。

### 5.4 P0-1 验收

- [ ] 同一客户可以同时存在不同 `bill_type` 的当前默认配置。
- [ ] 同一客户同一 `bill_type` 不能存在两个当前默认配置。
- [ ] 不同账单类型任务不会互相阻塞或错误复用任务。
- [ ] 不同账单类型汇率快照不会互相覆盖。
- [ ] 来源规则替换后不会因规则 ID 变化重复生成同一逻辑费用。

## 6. P0-2：建立新数据模型

### 6.1 DDL 开发

- [x] 根据 P0-0 基线编写 `fee_detail` 目标结构变更脚本。
- [x] 新增 `bill_fee_detail_relation` 建表脚本。
- [x] 新增 `bill_fee_relation_migration_map` 迁移映射表脚本。
- [ ] 调整 `bill_source_collect_mark`，移除账单归属职责并增加来源哈希、版本和快照字段。
- [ ] `fee_source_dataset` 增加 `modified_time_column`。
- [ ] `fee_source_rule` 增加或确认 `dedupe_key_expr`、默认来源币种和规则版本字段。
- [ ] 准备全部 DDL 回滚脚本和执行前检查 SQL。

`bill_fee_detail_relation` 必须覆盖：

```text
账单身份：bill_id / bill_no / bill_type / bill_config_id / generate_task_id
费用身份：fee_detail_id / fee_index_id / fee_code
关系身份：relation_no / relation_type / relation_status / settlement_role
账单金额：fee_currency / amount_fee_currency / bill_currency / amount_bill_currency
财务金额：fin_currency / amount_fin_currency
汇率快照：exchange_rate_to_bill / exchange_rate_to_fin / 汇率来源和层级
调整关系：original_relation_id / replaced_by_relation_id / adjustment_no
审计与隔离：sc_id / shop_id / user_id / created_at / created_by / updated_at / updated_by
```

### 6.2 Model 与 DTO

- [ ] 重写 `FeeDetail`，使其与最终来源费用池字段一一对应。
- [x] 新增 `BillFeeDetailRelation` 实体。
- [ ] 新增 `SourceFeeRowDTO`。
- [ ] 新增 `SourceFeeMarkDTO`。
- [ ] 新增 `BillGenerateContext`。
- [ ] 新增 `SourceFeeCollectContext`。
- [ ] 新增 `BillFeeRelationContext`。
- [x] 新增 `BillFeeRelationDTO` 和查询 DTO。
- [ ] 新增关系类型、关系状态、结算角色、来源费用状态和任务类型枚举。
- [x] 账单费用详情响应增加 `sourceFeeDetailId / billFeeRelationId / relationType / relationStatus / sourceVersionNo`。

### 6.3 Mapper

- [x] 新增 `BillFeeDetailRelationMapper` 和 XML。
- [x] 实现关系新增、批量新增、按编号查询和行锁查询。
- [x] 实现有效关系查询和按账单汇总查询。
- [ ] 实现来源费用待入账查询。
- [ ] 实现同账单类型、结算角色下的有效关系幂等检查。
- [ ] 实现关系替换、红冲和作废更新。
- [ ] 重写 `FeeDetailMapper`，只保留来源费用池职责。
- [ ] `BillGenerateMapper.insertFeeDetail` 改为明确 DTO 入参，只写来源费用字段。
- [ ] 新增来源哈希和版本查询方法。

### 6.4 P0-2 验收

- [ ] 新模型 DDL 在生产等价环境执行成功。
- [ ] `FeeDetail` 与真实表结构不存在缺列、错列和双命名。
- [ ] 关系表唯一键能够阻止重复有效关系。
- [ ] 手工构造一条来源费用可以建立账单关系，但来源费用本身不发生更新。
- [ ] 所有新增类和字段有 JavaDoc。
- [ ] 新增复杂 SQL 位于 XML，不新增 SqlProvider。

## 7. P0-3：存量迁移与读路径切换

### 7.1 迁移脚本

- [ ] 按 P0-0 确认的唯一映射迁移 `NORMAL`。
- [ ] 将 `ADJUSTED` 迁移为有效 `ADJUSTMENT + NORMAL` 关系。
- [ ] 将 `REVERSED` 迁移为 `REVERSAL + REVERSED` 关系，并关联原关系。
- [ ] 将 `VOID` 迁移为不可汇总的作废关系或迁移审计记录。
- [ ] 写入 `bill_fee_relation_migration_map`，保留旧费用 ID 与新关系 ID 映射。
- [ ] 对无法确定原关系的红冲、调整数据生成异常清单并阻断切换。
- [ ] 迁移脚本支持按账单范围分批执行和重复执行。

### 7.2 金额对账

- [ ] 对比每张账单迁移前后结算币种金额。
- [ ] 对比每张账单迁移前后财务本位币金额。
- [ ] 对比每张账单币种汇总金额。
- [ ] 对比账单主表应收金额。
- [ ] 对比费用明细数量、有效关系数量和状态数量。
- [ ] 对比调整和红冲净额。
- [ ] 差异账单输出到独立异常表或报告，不允许静默忽略。

### 7.3 统一汇总服务

- [x] 新增 `BillAmountAggregateService`。
- [x] 将 `BillGenerateServiceImpl` 中金额刷新委托给统一汇总服务。
- [x] 将 `ArBillServiceImpl.refreshBillAmount()` 委托给统一汇总服务。
- [x] 汇总服务只读取有效 `bill_fee_detail_relation`。
- [x] 统一重建 `ar_bill_currency_summary`。
- [ ] 统一刷新 `ar_bill` 本位币金额和费用数量。
- [ ] 明确有效关系条件为设计冻结后的唯一状态集合。

### 7.4 应收账单读路径切换

- [ ] 账单费用详情改为 `bill_fee_detail_relation LEFT JOIN fee_detail`。
- [ ] 账单订单费用汇总改为读取关系表。
- [ ] 账单详情金额改为读取关系表和币种汇总。
- [ ] 账单导出改为读取关系表。
- [ ] 账单汇率展示只读取 `bill_exchange_rate`。
- [ ] 收款核销涉及费用明细的读取改为关系表。
- [ ] 来源付款回写所需来源信息通过关系表关联 `fee_detail` 获取。
- [ ] API DTO 返回来源费用 ID 和账单关系 ID，账单侧操作以关系 ID 为准。

### 7.5 P0-3 验收

- [ ] 全量账单迁移前后金额对账一致。
- [ ] 账单列表、详情、费用明细、订单明细、导出和核销查询正常。
- [ ] 页面展示的来源金额、账单金额、汇率和状态可追溯。
- [ ] 关闭旧 `fee_detail` 账单字段读取后，核心查询仍可用。
- [ ] 查询性能满足现有页面和任务要求，必要索引已验证。

## 8. P1-1：账单侧写操作改造

### 8.1 服务与策略

- [ ] 新增 `BillFeeRelationService`。
- [ ] 新增 `BillOperationStatePolicy`。
- [ ] 新增 `BillFeeRelationStrategy` 和注册表。
- [ ] 实现 `SOURCE` 关系策略。
- [ ] 实现 `MANUAL` 关系策略。
- [ ] 实现 `ADJUSTMENT` 关系策略。
- [ ] 实现 `REVERSAL` 关系策略。
- [ ] 所有关系写入后统一调用 `BillAmountAggregateService`。

### 8.2 现有应收操作改造

- [ ] `ArBillServiceImpl.manualFee()` 改为新增 `MANUAL` 关系。
- [ ] `ArBillServiceImpl.adjustment()` 改为新增 `ADJUSTMENT / REVERSAL` 关系。
- [ ] `ArBillServiceImpl.rebuildAdjustment()` 改为重建账单关系。
- [x] `ArBillServiceImpl.saveExchangeRates()` 只更新账单汇率快照并重算关系。
- [ ] `ArBillServiceImpl.regenerateOrder()` 明确调整为关系重算或替换，不继续只追加备注。
- [ ] 删除上述操作直接新增、修改或作废 `fee_detail` 的 SQL。
- [ ] 状态校验统一委托 `BillOperationStatePolicy`。

### 8.3 API 与前端

- [ ] 账单侧修改请求使用 `billFeeRelationId`，不使用 `feeDetailId` 直接修改来源费用。
- [ ] 应收账单费用明细展示关系类型和关系状态。
- [ ] 调账、红冲和补录完成后刷新关系明细和账单汇总。
- [ ] “重新生成订单”文案和行为按最终业务语义调整。
- [ ] API 继续通过 `admin_shell/src/api/billing.js` 调用，不新增组件内 axios。

### 8.4 P1-1 验收

- [ ] 补录、调账、红冲和汇率调整均不修改 `fee_detail`。
- [ ] 每次写操作后关系汇总、币种汇总和账单主表金额一致。
- [ ] 不允许状态下的修改被后端拒绝。
- [ ] 红冲保留原关系和反向关系，可完整追溯。
- [ ] 重复提交不会生成重复有效关系。

## 9. P1-2：来源费用同步任务拆分

### 9.1 任务与组件

- [ ] 新增来源费用同步任务类型。
- [ ] 新增 `SourceDatasetReader` 和注册表。
- [ ] 新增 `SourceFeeCollectService`。
- [ ] 新增 `SourceFeePersistService`。
- [ ] 将来源查询、费用拆分、来源快照和哈希计算从 `BillGenerateServiceImpl` 抽出。
- [ ] 将 `markSourceWithCompensation()` 迁入来源同步服务，保留失败补偿语义。
- [ ] 来源同步任务只写 `fee_detail + bill_source_collect_mark`。
- [ ] 来源同步成功后即可回写 `bms_billed_flag = 1`，不依赖是否已生成账单。
- [ ] 新链路不依赖 `bms_bill_no` 判断同步状态或账单归属。

### 9.2 分页、游标和幂等

- [ ] 来源读取使用稳定排序和游标分页。
- [ ] 查询窗口使用 `fee_source_dataset.query_window_days`。
- [ ] 分页大小使用 `fee_source_dataset.query_page_size`。
- [ ] 每条来源费用生成稳定 `source_fee_key`。
- [ ] 通过来源系统、数据集、来源费用业务键、费项和版本保证幂等。
- [ ] 同一来源行可按多条规则拆分多个不同费项。
- [ ] 金额为空或为零的处理规则与设计一致并可追溯。

### 9.3 P1-2 验收

- [ ] 首次同步只新增来源 `fee_detail`，不创建账单。
- [ ] 来源同步成功后源表被标记为已同步。
- [ ] 源表打标失败时记录 `FAILED`，重试只补打标。
- [ ] 重复同步不会新增重复来源费用。
- [ ] 来源规则替换不会因规则 ID 变化重复生成同一费用。
- [ ] 来源同步失败不影响已存在账单。

## 10. P1-3：账单生成任务改造

### 10.1 单笔关系处理链

- [ ] 新增 `BillFeeRelationProcessor` 接口。
- [ ] 新增 `BillConfigMatchProcessor`。
- [ ] 新增 `BillCurrencyResolveProcessor`。
- [ ] 新增 `BillExchangeRateLockProcessor`。
- [ ] 新增 `BillFeeRelationPersistProcessor`。
- [ ] Processor 顺序使用代码常量固定。
- [ ] 用 `BillFeeRelationContext` 替换 `buildFeeBase()` 的 Map 返回值。
- [ ] 最终持久化处理器只写 `bill_fee_detail_relation`。

### 10.2 账单生成主流程

- [ ] 账单生成任务只查询待入账 `fee_detail`。
- [ ] 按账单类型策略执行费用准入、账期、分组、金额方向和汇总。
- [ ] 保留 `executeBillGroup()` 第一阶段调用壳，内部委托关系处理链。
- [ ] 创建或匹配账单后批量创建账单费用关系。
- [x] 一组关系完成后统一调用 `BillAmountAggregateService`。
- [ ] 账单生成过程不修改来源 `fee_detail`。
- [ ] 账单生成失败时保留来源费用和源表同步标识。
- [ ] 删除 `buildFeeBase()` 和旧 `fee_detail` 账单字段写入逻辑。

### 10.3 账单类型策略

- [ ] 新增 `BillTypeStrategy` 和注册表。
- [ ] 先实现现有应收账单类型策略，保持现有应收业务结果。
- [ ] 策略负责账单类型准入、账期、分组、结算角色、金额方向和汇总公式。
- [ ] 公共生成代码不写死应收账单规则。
- [ ] 为后续 `COD_REFUND / COST_AP` 等类型保留明确扩展入口。

### 10.4 P1-3 验收

- [ ] 待入账来源费用可生成账单和有效关系。
- [ ] 同一费用重复执行任务不重复建立有效关系。
- [ ] 生成任务失败后重试不重复写入费用或关系。
- [ ] 账单金额完全由有效关系汇总。
- [ ] 现有应收账单分组、账期、币种和金额结果与改造前一致。
- [ ] 新生成账单不再向 `fee_detail` 写入账单侧字段。

## 11. P1-4：重跑与任务执行框架改造

### 11.1 执行器模板化

- [ ] 新增 `AbstractBillTaskExecutor`。
- [ ] 新增 `BillTaskExecutorRegistry`。
- [ ] 新增 `SourceFeeCollectTaskExecutor`。
- [ ] 新增 `BillRelationGenerateTaskExecutor`。
- [ ] 新增 `BillRecalculateTaskExecutor`。
- [ ] `BillGenerateServiceImpl.executeTask()` 改为领取任务后通过注册表分发。
- [ ] 将 `executeTaskInternal()` 剩余逻辑迁入对应执行器。
- [ ] 保留任务成功、失败、重试状态的独立事务处理。
- [ ] 删除已被执行器替代的旧内部流程。

### 11.2 重跑语义调整

- [ ] `regenerate()` 按请求场景创建补采、补入账或账单侧重算任务。
- [ ] 删除或禁用 `unmarkSourceByBillNo()`。
- [ ] 删除重跑时清空 `bms_billed_flag / bms_bill_no` 的逻辑。
- [ ] 删除重跑时作废来源 `fee_detail` 的逻辑。
- [ ] `DRAFT / GENERATED` 账单通过替换关系和重算刷新。
- [ ] `PENDING_SETTLEMENT / PAID` 账单进入后续调整，不直接覆盖历史。
- [ ] 调整前端重跑提示，使其与新语义一致。

### 11.3 P1-4 验收

- [ ] 各任务类型由唯一执行器处理，不存在新旧双实现。
- [ ] 任务失败、重试和错误信息仍可在监控页面追踪。
- [ ] 账单重跑不修改业务源表同步标识。
- [ ] 账单重跑不修改或作废来源费用。
- [ ] 重复重跑不会重复生成有效关系。
- [ ] 已进入不可修改状态的账单不会被直接覆盖。

## 12. P2：来源变化识别

### 12.1 来源版本能力

- [ ] `fee_detail` 保存 `source_row_hash / source_version_no / previous_fee_detail_id / source_snapshot_json`。
- [ ] `bill_source_collect_mark` 保存最近采集哈希和来源版本轨迹。
- [ ] 有可靠更新时间的数据集配置 `modified_time_column`。
- [ ] 无可靠更新时间的数据集明确标记为不支持自动修改识别。
- [ ] 新增来源变化识别任务。

### 12.2 变化处理

- [ ] 扫描已同步且近期修改的来源数据。
- [ ] 计算最新来源行哈希。
- [ ] 哈希未变化时跳过。
- [ ] 哈希变化时新增 `fee_detail` 版本，不覆盖旧版本。
- [ ] `DRAFT / GENERATED` 账单将旧关系置为 `REPLACED`，新版本建立新关系并刷新金额。
- [ ] `PENDING_SETTLEMENT / PAID` 账单保持不变，生成后续调整待处理记录。
- [ ] 来源版本替换不使用 `REVERSED` 表示。

### 12.3 P2 验收

- [ ] 来源金额或关键字段变化会新增版本。
- [ ] 哈希未变化不会新增版本。
- [ ] 可修改账单正确替换关系并重新汇总。
- [ ] 已复核账单历史金额不被直接修改。
- [ ] 来源版本链和账单关系链可完整追溯。
- [ ] 修改扫描任务可重复执行且结果幂等。

## 13. P3：收口、联调与上线

### 13.1 旧逻辑清理

- [ ] 删除从 `fee_detail` 汇总账单金额和币种的 SQL。
- [ ] 删除从 `fee_detail` 查询账单汇率的 SQL。
- [ ] 删除直接修改 `fee_detail` 账单侧字段的 SQL。
- [ ] 删除重跑回退源表标识和恢复源表账单号逻辑。
- [ ] 删除已确认无调用的旧 `FeeDetail` Controller、Service、Mapper 或 XML。
- [ ] 清理 `voucher_rul` 等与最终 Schema 不一致字段。
- [ ] 删除本次改造已替换的 `Map<String, Object>` 组件间传递。
- [ ] `BillGenerateServiceImpl` 最终只保留任务创建、门面和分发职责。

### 13.2 文档与排查材料

- [ ] 更新账单生成任务现状文档为新流程。
- [ ] 更新数据库连接与排查指南中的对账 SQL。
- [ ] 更新账单详情、调账、重跑和来源变化处理说明。
- [ ] 输出任务失败排查手册。
- [ ] 输出来源同步失败补偿手册。
- [ ] 输出迁移和上线操作手册。

### 13.3 构建与验证

项目当前无测试目录，必须至少完成以下验证：

- [ ] 执行 `cd bms && mvn clean package`。
- [ ] 验证 Mapper XML 可被正常加载。
- [ ] 在生产等价环境执行全量迁移演练。
- [ ] 执行逐账单金额对账。
- [ ] 执行任务重试和幂等验证。
- [ ] 执行来源同步、生成、补录、调账、红冲、汇率调整和重跑全链路验证。
- [ ] 验证任务监控列表、详情、错误信息和重试入口。
- [ ] 验证应收账单列表、详情、费用明细、导出和收款核销。
- [ ] 执行 `cd admin_shell && npm run lint`。
- [ ] 执行 `cd admin_shell && npm run build:prod`。

## 14. 文件级开发范围

以下为当前已确认的主要改造范围，实际删除项必须以 P0-0 调用摸底结果为准。

| 模块 | 主要文件或目标类 | 调整内容 |
| --- | --- | --- |
| `bms/common` | 状态、任务、账单类型和关系枚举 | 收口魔法值 |
| `bms/model` | `FeeDetail`、`BillFeeDetailRelation`、Context 和 DTO | 建立唯一来源费用与关系模型 |
| `bms/dao` | `FeeDetailMapper`、`BillFeeDetailRelationMapper` | 来源费用和账单关系持久化 |
| `bms/dao` | `BillGenerateMapper` | 拆除来源同步与账单生成混合 SQL |
| `bms/dao` | `ArBillMapper`、`ArBillMapper.xml` | 详情、汇总、导出和调整切换到关系表 |
| `bms/dao` | `BillConfigMapper`、`FeeIndexMapper` | `bill_type` 隔离和规则解耦 |
| `bms/biz` | `BillGenerateServiceImpl` | 精简为任务门面和分发 |
| `bms/biz` | `ArBillServiceImpl` | 账单侧操作改写关系表 |
| `bms/biz` | 来源同步、关系、汇总、执行器和策略组件 | 新增目标职责组件 |
| `bms/client` | 应收账单和任务契约 DTO | 返回关系 ID 和来源版本 |
| `bms/web` | 应收账单和任务 Controller | 保持接口契约并补齐注释 |
| `admin_shell` | `src/api/billing.js`、应收账单页、任务监控页 | 新字段、关系操作和重跑语义 |
| `aidocs` | DDL、迁移、对账、排查和流程文档 | 支撑上线和运维 |

## 15. 建议开发批次

每个批次应独立评审、构建和验收：

| 批次 | 内容 | 建议提交边界 |
| --- | --- | --- |
| A | P0-0 摸底材料和迁移基线 | 仅文档与只读 SQL |
| B | `bill_type`、配置唯一约束和规则边界 | DDL + 配置/规则代码 |
| C | 新关系模型、来源模型和 Mapper | DDL + model + dao |
| D | 存量迁移、金额对账和新读路径 | 迁移脚本 + 查询/汇总 |
| E | 补录、调账、红冲、汇率调整 | 账单侧写操作 |
| F | 来源费用同步独立任务 | 来源读取、持久化和打标 |
| G | 账单关系生成和统一汇总 | 生成主链路 |
| H | 任务执行器和重跑调整 | 任务框架与重跑 |
| I | 来源修改识别和版本替换 | 修改扫描任务 |
| J | 前端联调、旧逻辑删除和上线材料 | 收口发布 |

并行建议：

1. P0-0 完成后，配置边界修正和新模型 DTO 设计可以并行。
2. 新模型冻结后，迁移脚本开发和关系 Mapper 开发可以并行。
3. P0-3 读路径切换稳定后，账单侧写操作和来源同步拆分可以并行。
4. 账单生成、重跑和来源变化识别必须依次推进，避免同时修改任务主链路。

## 16. 全链路验收清单

- [ ] 首次来源同步新增 `fee_detail`，源表标记为已同步。
- [ ] 首次账单生成新增账单和关系，不修改来源费用。
- [ ] 重复任务不新增重复来源费用或有效关系。
- [ ] 同账期新增来源费用可以追加到可修改账单。
- [ ] 来源变化新增费用版本，不覆盖旧版本。
- [ ] 可修改账单正确替换旧关系。
- [ ] 已复核账单来源变化不直接修改历史账单。
- [ ] 手工补录新增 `MANUAL` 关系，允许无来源费用。
- [ ] 红冲新增负向 `REVERSAL` 关系，保留原关系。
- [ ] 调账新增有效 `ADJUSTMENT` 关系。
- [ ] 汇率调整只重算账单关系和汇总。
- [ ] 账单重跑不清空源表同步标识。
- [ ] 账单重跑不作废来源费用。
- [ ] 所有账单金额可由有效关系重算。
- [ ] 所有账单汇率只从 `bill_exchange_rate` 查询。
- [ ] 多账单类型配置、任务和汇率互相隔离。
- [ ] 存量迁移前后逐账单金额一致。
- [ ] 任务失败、重试、补偿和错误信息可追踪。
- [ ] 新增写操作均有 `@Transactional(rollbackFor = Exception.class)`。
- [ ] 新增 SQL 无 WHERE 列函数、无新增 SqlProvider、无新增 Map 接口。

## 17. 上线计划

### 17.1 上线前

1. 冻结账单生成、补录、调账、红冲和汇率调整写操作。
2. 备份涉及表，并记录备份时间点。
3. 执行 Schema 和数据前置检查。
4. 执行 `bill_config`、任务和汇率的 `bill_type` 回填及约束调整。
5. 创建新关系表和迁移映射表。
6. 执行存量关系迁移。
7. 执行逐账单金额对账。
8. 对账未通过时停止上线并执行回滚，不切换应用。

### 17.2 应用切换

1. 发布后端新模型和新读写路径。
2. 验证来源同步任务处于关闭状态。
3. 验证账单生成任务处于关闭状态。
4. 冒烟验证账单列表、详情、导出、核销和任务监控。
5. 小范围执行来源同步任务。
6. 小范围执行账单生成任务并完成金额对账。
7. 验证补录、调账、红冲、汇率调整和重跑。
8. 发布前端并验证关系 ID、状态和重跑提示。
9. 验证通过后开启正式调度。

### 17.3 上线后监控

- [ ] 监控来源同步新增数、重复数和打标失败数。
- [ ] 监控待入账来源费用数量。
- [ ] 监控账单关系新增数和幂等冲突数。
- [ ] 监控账单汇总差异。
- [ ] 监控任务失败率、重试次数和执行耗时。
- [ ] 每日抽样执行来源费用、关系、币种汇总和账单主表四层对账。

## 18. 回滚原则

1. DDL 和数据迁移必须提供对应回滚脚本。
2. 应用切换前对账失败时，直接回滚新增关系数据和 DDL，不发布新应用。
3. 应用切换后发现问题时，先关闭来源同步、账单生成和账单侧写入口。
4. 已由新链路新增的来源费用和关系不得直接物理删除，必须保留审计并按回滚脚本处理。
5. 不允许通过清空业务源表同步标识进行回滚。
6. 不允许在未确认账单金额影响前恢复旧账单写路径。
7. 回滚后必须重新执行逐账单金额和任务状态对账。

## 19. 完成标准

满足以下条件后，本次调整才可视为完成：

1. `fee_detail` 已稳定为来源费用池，账单操作不会修改其来源事实。
2. `bill_fee_detail_relation` 已成为账单费用明细和金额计算的唯一事实来源。
3. 来源同步、账单生成、账单重算由独立任务职责处理。
4. 补录、调账、红冲、汇率调整和重跑全部通过账单关系完成。
5. 已删除回退源表同步标识和直接修改来源费用的旧逻辑。
6. 来源修改可新增版本并按账单状态处理。
7. 多账单类型配置、任务、汇率和关系具备完整隔离。
8. 存量迁移、全链路验收、构建、前端联调和上线对账全部通过。
