# BMS 任务流水监控设计

## 1. 目标

任务流水需要有可视化页面，能直接查看 `bill_generate_task` 的执行记录，也能从账单配置维度监控每日任务是否按计划执行。

本期任务流水统一使用 `bill_generate_task`：产生账单的记录展示为 `账单生成任务`，未产生账单的记录展示为 `源数据同步任务`。两类任务都基于账单配置执行。

本设计解决三个问题：

1. 查看每次任务的开始时间、结束时间、执行状态、处理数量和错误原因。
2. 按 `bill_config` 维度判断某一天是否应该执行、是否已执行、是否漏执行、是否执行失败。
3. 能从任务追溯到账单、订单快照、费用明细、配置快照和失败原因。

## 2. 菜单设计

建议放在 `admin_front` 的费用中心下：

- `费用中心 / 任务流水`
- 路由：`/billing/billGenerateTask`

页面分两个 Tab：

1. `任务流水`：直接查询 `bill_generate_task`，并分为 `账单生成任务` / `源数据同步任务` 两个页签。
2. `配置监控`：按账单配置检查指定日期的执行情况。

## 3. 任务流水页

### 3.1 查询条件

顶部查询条件：

- 任务编号 `task_no`
- 配置编号 `config_no`
- 客户名称
- 客户编码 `customer_no`
- 会员编码 `member_code`
- 店铺
- 账单配置 ID `bill_config_id`
- 账期开始日期、账期结束日期
- 任务状态：`PENDING/RUNNING/SUCCESS/FAILED/NEED_RETRY/CANCELED`
- 触发方式：`SCHEDULE/MANUAL/RETRY`
- 创建时间范围
- 开始时间范围

店铺要展示店铺名称，查询传 `shop_id`。

### 3.2 顶部统计

按当前筛选条件统计：

- 任务总数
- 成功任务数
- 失败任务数
- 待重试任务数
- 运行中任务数
- 拉取订单数合计
- 生成费用明细数合计

### 3.3 列表字段

列表展示：

- 任务编号
- 任务状态
- 触发方式
- 账单配置
- 配置类型：默认配置 / 分支配置
- 客户名称
- 客户编码
- 会员编码
- 店铺
- 账期
- 开始时间
- 结束时间
- 耗时
- 拉取订单数
- 命中订单数
- 跳过订单数
- 费用明细数
- 附加费明细数
- 失败数
- 错误摘要
- 操作

操作：

- `详情`
- `查看账单`
- `查看配置快照`
- `失败重试`
- `查看错误`

`失败重试` 只允许 `FAILED/NEED_RETRY` 状态使用。

## 4. 任务详情页

详情页展示四块内容。

### 4.1 基础信息

- 任务编号
- 任务状态
- 触发方式
- 操作人
- 开始时间
- 结束时间
- 执行耗时
- 幂等键
- 重试次数

### 4.2 配置信息

- 账单配置 ID
- 配置编号
- 配置类型
- 业务场景
- 客户信息
- 店铺信息
- 账期范围
- 结算币种

### 4.3 执行结果

- 拉取订单数
- 命中订单数
- 跳过订单数
- 费用明细数
- 附加费明细数
- 失败数
- 关联账单编号

### 4.4 快照和错误

- `bill_config_snapshot_json`
- `bill_scope_snapshot_json`
- `fee_rule_snapshot_json`
- `error_message`

JSON 默认折叠，支持复制。

## 5. 配置监控页

配置监控页不是简单查任务，而是以 `bill_config` 为主表，判断每个启用配置在指定日期是否有对应任务。

### 5.1 查询条件

- 监控日期，默认今天
- 店铺
- 客户名称
- 客户编码
- 会员编码
- 配置类型：默认 / 分支
- 业务场景
- 账期类型
- 运行状态：全部 / 已执行 / 未执行 / 漏执行 / 执行失败 / 运行中 / 待重试

### 5.2 顶部统计

按当前筛选条件统计：

- 应执行配置数
- 已成功配置数
- 未执行配置数
- 漏执行配置数
- 失败配置数
- 运行中配置数
- 待重试配置数

### 5.3 监控列表字段

- 配置编号
- 配置类型
- 客户名称
- 客户编码
- 会员编码
- 店铺
- 业务场景
- 账期类型
- 本次应生成账期
- 是否应执行
- 监控状态
- 最新任务编号
- 最新任务状态
- 最新开始时间
- 最新结束时间
- 错误摘要
- 操作

操作：

- `查看任务`
- `查看账单`
- `手动生成`
- `失败重试`

## 6. 配置监控判断口径

### 6.1 应执行配置范围

配置满足以下条件才进入监控：

1. `bill_config.enabled = 1`。
2. `bill_config.deleted = 0`。
3. 监控日期在配置生效期内。
4. 配置所属 `sc_id/shop_id/user_id/member_code` 有效。

### 6.2 应生成账期

根据 `bill_config.billing_cycle_type` 计算监控日期对应账期：

- 日账单：监控日期当天。
- 周账单：监控日期所在周。
- 月账单：监控日期所在月。

后续如果账单配置增加固定出账日，则以固定出账日判断当天是否应执行。

### 6.3 任务匹配规则

用以下字段匹配任务：

- `bill_generate_task.bill_config_id`
- `bill_generate_task.billing_period_start_date`
- `bill_generate_task.billing_period_end_date`
- `bill_generate_task.trigger_type`

监控页默认关注定时任务，所以默认匹配 `trigger_type = SCHEDULE`。如果人工补跑，需要在页面上标识为 `人工补跑完成`，但不要掩盖原定时任务漏执行事实。

### 6.4 监控状态

监控状态是页面计算出来的状态，不一定落库。

- `NOT_DUE`：监控日期不需要执行。
- `RUNNING`：存在运行中任务。
- `SUCCESS`：存在成功任务。
- `FAILED`：存在失败任务。
- `NEED_RETRY`：存在需要补偿或重试的任务。
- `CANCELED`：任务被取消。

同一配置同一账期出现多条任务时，优先级：

1. `RUNNING`
2. `NEED_RETRY`
3. `FAILED`
4. `SUCCESS`
5. `CANCELED`
6. `PENDING`

## 7. 后端接口设计

接口仍按现有链路：

`admin_front -> platform-admin -> bms`

### 7.1 任务分页

`POST /portal/bms/billGenerateTask/page`

请求：

```json
{
  "pageNo": 1,
  "pageSize": 20,
  "taskNo": "",
  "billConfigId": null,
  "configNo": "",
  "customerName": "",
  "customerNo": "",
  "memberCode": "",
  "shopId": null,
  "taskStatus": "",
  "triggerType": "",
  "billingPeriodStartDate": "",
  "billingPeriodEndDate": "",
  "createdAtStart": "",
  "createdAtEnd": ""
}
```

返回：

```json
{
  "records": [],
  "total": 0,
  "summary": {
    "taskCount": 0,
    "successCount": 0,
    "failedCount": 0,
    "needRetryCount": 0,
    "runningCount": 0,
    "pulledOrderCount": 0,
    "feeDetailCount": 0
  }
}
```

### 7.2 任务详情

`GET /portal/bms/billGenerateTask/detail?id=1`

返回任务基础信息、关联账单列表、配置快照和错误信息。

### 7.3 配置监控分页

`POST /portal/bms/billGenerateTask/configMonitorPage`

请求：

```json
{
  "pageNo": 1,
  "pageSize": 20,
  "monitorDate": "2026-05-25",
  "shopId": null,
  "customerName": "",
  "customerNo": "",
  "memberCode": "",
  "configType": "",
  "businessTypeCode": "",
  "billingCycleType": "",
  "monitorStatus": ""
}
```

返回：

```json
{
  "records": [],
  "total": 0,
  "summary": {
    "expectedConfigCount": 0,
    "successConfigCount": 0,
    "missedConfigCount": 0,
    "failedConfigCount": 0,
    "runningConfigCount": 0,
    "needRetryConfigCount": 0
  }
}
```

### 7.4 重试任务

`POST /portal/bms/billGenerateTask/retry`

请求：

```json
{
  "taskId": 1
}
```

重试时必须复用原任务的配置快照，不允许直接读取当前最新 `bill_config` 覆盖历史任务口径。

## 8. 查询 SQL 设计

### 8.1 任务流水

主查询表：

- `bill_generate_task t`
- 左关联 `bill_config c`
- 左关联 `ar_bill b`

主要查询条件：

```sql
WHERE t.created_at BETWEEN ? AND ?
  AND t.task_status = ?
  AND t.bill_config_id = ?
  AND t.shop_id = ?
```

分页按 `t.created_at DESC, t.id DESC`。

### 8.2 配置监控

先查启用配置：

```sql
SELECT c.*
FROM bill_config c
WHERE c.enabled = 1
  AND c.deleted = 0
  AND c.effective_start_date <= :monitorDate
  AND c.effective_end_date >= :monitorDate
```

再按配置计算账期，用账期关联任务：

```sql
SELECT t.*
FROM bill_generate_task t
WHERE t.bill_config_id = :billConfigId
  AND t.billing_period_start_date = :periodStart
  AND t.billing_period_end_date = :periodEnd
  AND t.trigger_type = 'SCHEDULE'
ORDER BY t.created_at DESC
```

如果没有任务记录且该配置当天应执行，则配置监控展示为“未执行/待执行”，不落 `MISSED` 任务状态。

## 9. 表结构建议

现有 `bill_generate_task` 已能支撑基础监控。本期不调整表结构，不新增任务表，不新增金额字段。后续如果需要优化查询性能，再评估索引：

```sql
CREATE INDEX `idx_task_config_period_status`
  ON `bill_generate_task` (`bill_config_id`, `billing_period_start_date`, `billing_period_end_date`, `task_status`);

CREATE INDEX `idx_task_shop_created`
  ON `bill_generate_task` (`shop_id`, `created_at`);
```

如果后续要严格监控“每天调度是否触发”，再评估是否增加调度日期字段；本期不落 DDL：

```sql
ALTER TABLE `bill_generate_task`
  ADD COLUMN `schedule_date` date DEFAULT NULL COMMENT '调度日期，用于监控每日定时任务是否触发' AFTER `trigger_type`;

CREATE INDEX `idx_task_schedule_date`
  ON `bill_generate_task` (`schedule_date`, `task_status`, `trigger_type`);
```

`schedule_date` 表示任务在哪一天由调度器触发，不等于账期日期。

## 10. 前端交互要求

1. 所有接口失败必须用页面消息提示错误，不能静默失败。
2. 店铺 ID 必须翻译成店铺名称。
3. 业务场景、账期类型、任务状态、触发方式都要翻译中文。
4. 错误信息过长时列表只展示摘要，详情弹窗展示完整内容。
5. `FAILED/NEED_RETRY` 使用明显颜色标识。
6. 任务详情支持跳转到账单详情。
7. 配置监控页支持一键筛选“漏执行”和“执行失败”。

## 11. 开发顺序

1. BMS 增加 `bill_generate_task` 查询、详情、配置监控接口。
2. platform-admin 增加转发 Controller。
3. admin_shell 增加 `任务流水` 页面和路由。
4. 接入店铺名称、客户信息翻译。
5. 增加任务重试入口。
6. 使用真实 `bill_generate_task` 数据验证任务流水和配置监控状态。

