# 三竹短信接入与通知中心改造设计

## 1. 背景

当前通知中心已经支持台湾 8D 短信和三竹短信两种平台：

- 台湾 8D：`TWEvery8dHttpUtil`
- 三竹短信：`MitakeSmsUtil`
- 通知入口：`SmsNotifyService`
- 短信平台配置：`third_party_app_keys`
- 通知模板配置：`notice_activity_param`
- 通知事件记录：`notice_activity_event`

现有三竹短信接入已经可以发送单笔短信，但整体能力还偏工具化：

- 发送逻辑直接写在 `SmsNotifyService` 的平台分支里。
- 三竹响应只解析了发送结果，没有统一错误码说明。
- 没有把第三方短信 `msgid/clientid/statuscode` 标准化沉淀到短信记录。
- 没有完整的主动回调、状态补偿查询、失败重试和发送幂等设计。
- `MitakeSmsUtil` 使用 `HttpURLConnection` 静态方法，后续扩展多接口、超时、日志、监控会比较散。

## 2. 目标

本次设计目标是把三竹短信从“能发”升级为“可运营、可追踪、可补偿”的短信能力。

核心目标：

1. 支持三竹短信单笔发送。
2. 支持发送结果标准化解析。
3. 支持业务幂等，避免同一通知事件重复发送。
4. 支持短信发送记录查询。
5. 支持三竹状态回调接收。
6. 支持发送状态补偿查询。
7. 支持失败重试和错误原因可见。
8. 与现有 `notice_activity_event`、`notice_activity_param`、`third_party_app_keys` 保持兼容。

## 3. 现状代码分析

### 3.1 三竹工具类

当前类：

```text
szt-cloud/core/src/main/java/com/szt/framework/core/sms/mitake/MitakeSmsUtil.java
```

当前发送接口：

```java
MitakeSmsUtil.smSend(domain, username, password, smsRequest)
```

请求地址：

```text
{domain}/b2c/mtk/SmSend
```

已支持参数：

- `dstaddr`：收讯人手机号
- `smbody`：短信内容
- `destname`：收讯人名称或来源系统 Key
- `dlvtime`：预约发送时间
- `vldtime`：有效期限
- `response`：状态主动回报网址
- `clientid`：客户短信 ID，用于避免重复发送
- `objectID`：批次名称
- `smsPointFlag`：是否返回扣点数
- `CharsetURL`：编码方式，默认 `UTF8`

当前响应解析：

- `clientid`
- `msgid`
- `statuscode`
- `AccountPoint`
- `Duplicate`
- `smsPoint`
- 原始响应 `result`

当前成功判断：

```java
msgid 不为空，且 statuscode in 0, 1, 2, 4
```

### 3.2 通知中心调用链

当前类：

```text
notice-center/biz/src/main/java/com/szt/supplychain/noticecenter/biz/activity/notice/sms/impl/SmsNotifyService.java
```

调用流程：

1. 根据 `shopId + dataType + noticeType` 获取 `notice_activity_param`。
2. 使用 `dataVar` 替换模板变量。
3. 文案转繁体。
4. 根据 `noticeActivityParam.platform` 判断短信平台。
5. 从 `third_party_app_keys` 获取短信账号配置。
6. 调用对应短信平台工具类。
7. 返回 `NotifyResult`。

当前三竹配置平台编码：

```java
SourcePlatformEnum.SMS_MITAKE = sms_mitake
```

## 4. 总体设计

### 4.1 分层设计

建议把短信发送拆成三层：

```text
SmsNotifyService
  -> SmsProviderRouter
      -> MitakeSmsProvider
          -> MitakeSmsClient
```

职责划分：

- `SmsNotifyService`：负责通知事件、模板变量、业务结果处理。
- `SmsProviderRouter`：根据 `platform` 路由短信供应商。
- `MitakeSmsProvider`：负责三竹短信业务适配、请求组装、响应转换。
- `MitakeSmsClient`：负责三竹 HTTP API 调用。

这样后续新增阿里云、Unimatrix、其他国际短信时，不需要继续把平台分支堆在 `SmsNotifyService` 里。

### 4.2 标准短信发送模型

新增统一发送请求模型：

```java
SmsSendCommand
```

建议字段：

| 字段 | 说明 |
| --- | --- |
| shopId | 店铺 ID |
| noticeEventId | 通知事件 ID |
| platform | 短信平台 |
| mobile | 手机号 |
| title | 短信标题 |
| content | 短信内容 |
| businessNo | 业务单号，如订单号 |
| clientMessageId | 客户端幂等 ID |
| callbackUrl | 状态回调 URL |
| scheduleSendTime | 预约发送时间 |
| validUntil | 有效截止时间 |

新增统一发送结果模型：

```java
SmsSendResult
```

建议字段：

| 字段 | 说明 |
| --- | --- |
| success | 是否提交成功 |
| platform | 短信平台 |
| providerMsgId | 三竹 msgid |
| clientMessageId | 三竹 clientid |
| providerStatusCode | 三竹 statuscode |
| providerStatusName | 状态说明 |
| accountPoint | 账号剩余点数 |
| smsPoint | 本次扣点 |
| duplicate | 是否重复提交 |
| rawResponse | 第三方原始响应 |
| errorMessage | 错误说明 |

## 5. 数据库设计

### 5.1 短信发送记录表

建议新增独立短信记录表，不建议只依赖 `notice_activity_event.process_remark` 保存第三方返回。

表名：

```sql
notice_sms_record
```

字段建议：

```sql
CREATE TABLE `notice_sms_record` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `shop_id` bigint(20) DEFAULT NULL COMMENT '店铺ID',
  `notice_event_id` bigint(20) DEFAULT NULL COMMENT '通知事件ID',
  `data_type` int(11) DEFAULT NULL COMMENT '业务数据类型',
  `notice_type` int(11) DEFAULT NULL COMMENT '通知类型',
  `platform` varchar(32) NOT NULL COMMENT '短信平台',
  `business_no` varchar(64) DEFAULT NULL COMMENT '业务单号',
  `mobile` varchar(64) NOT NULL COMMENT '手机号',
  `title` varchar(128) DEFAULT NULL COMMENT '短信标题',
  `content` varchar(1000) NOT NULL COMMENT '短信内容',
  `client_message_id` varchar(64) NOT NULL COMMENT '客户端幂等ID',
  `provider_msg_id` varchar(64) DEFAULT NULL COMMENT '第三方消息ID',
  `provider_status_code` varchar(32) DEFAULT NULL COMMENT '第三方状态码',
  `provider_status_name` varchar(128) DEFAULT NULL COMMENT '第三方状态说明',
  `send_status` varchar(32) NOT NULL COMMENT '发送状态：INIT/SUBMITTED/SEND_SUCCESS/SEND_FAIL/CALLBACK_SUCCESS/CALLBACK_FAIL',
  `send_time` datetime DEFAULT NULL COMMENT '提交发送时间',
  `callback_time` datetime DEFAULT NULL COMMENT '回调时间',
  `last_query_time` datetime DEFAULT NULL COMMENT '最后查询状态时间',
  `retry_count` int(11) NOT NULL DEFAULT '0' COMMENT '重试次数',
  `account_point` varchar(32) DEFAULT NULL COMMENT '账号剩余点数',
  `sms_point` varchar(32) DEFAULT NULL COMMENT '本次扣点',
  `duplicate_flag` varchar(16) DEFAULT NULL COMMENT '三竹重复提交标识',
  `raw_request` text COMMENT '请求报文',
  `raw_response` text COMMENT '响应报文',
  `error_message` varchar(1000) DEFAULT NULL COMMENT '错误信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_message_id` (`client_message_id`),
  KEY `idx_notice_event_id` (`notice_event_id`),
  KEY `idx_shop_mobile` (`shop_id`, `mobile`),
  KEY `idx_provider_msg_id` (`provider_msg_id`),
  KEY `idx_send_status` (`send_status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信发送记录';
```

### 5.2 状态枚举

内部状态建议：

| 状态 | 说明 |
| --- | --- |
| INIT | 待发送 |
| SUBMITTED | 已提交三方 |
| SEND_SUCCESS | 三方返回提交成功 |
| SEND_FAIL | 三方返回提交失败 |
| CALLBACK_SUCCESS | 回调成功送达 |
| CALLBACK_FAIL | 回调失败 |
| QUERY_SUCCESS | 查询确认成功 |
| QUERY_FAIL | 查询确认失败 |

### 5.3 三竹状态码映射

新增枚举：

```java
MitakeSmsStatusCodeEnum
```

用途：

- 把 `statuscode` 翻译成中文。
- 判断是否提交成功。
- 判断是否可重试。

当前代码已将 `0/1/2/4` 视为提交成功，这部分可以先保留，但要集中到枚举里，不要散落在 `MitakeSmsResponse`。

## 6. 三竹短信发送流程

### 6.1 正常发送流程

```text
notice_activity_event
  -> SmsNotifyService
  -> 读取 notice_activity_param
  -> 渲染短信模板
  -> 生成 clientMessageId
  -> 创建 notice_sms_record INIT
  -> MitakeSmsProvider.send
  -> MitakeSmsClient.smSend
  -> 更新 notice_sms_record
  -> 返回 NotifyResult
```

### 6.2 clientMessageId 生成规则

建议：

```text
SMS-{platform}-{noticeEventId}
```

如果没有 `noticeEventId`，使用：

```text
SMS-{platform}-{shopId}-{businessNo}-{noticeType}-{yyyyMMddHHmmss}
```

优先使用 `notice_activity_event.id` 做幂等，避免同一通知事件重复发送。

三竹请求中写入：

```java
MitakeSmsRequest.clientid = clientMessageId
```

### 6.3 回调 URL

三竹请求中 `response` 字段建议配置为：

```text
https://{domain}/notice/sms/mitake/callback
```

如果本地/SIT 不方便外网回调，可先只记录发送结果，状态通过查询任务补偿。

## 7. 回调接口设计

新增 Controller：

```text
notice-center/web/.../MitakeSmsCallbackController.java
```

接口：

```text
POST /notice/sms/mitake/callback
```

处理逻辑：

1. 接收三竹回调原始参数。
2. 解析 `clientid/msgid/statuscode`。
3. 按 `clientid` 或 `msgid` 查 `notice_sms_record`。
4. 更新最终状态、回调时间、原始回调内容。
5. 返回三竹要求的成功响应。

注意：

- 回调接口必须幂等。
- 同一个 `msgid` 多次回调不能重复污染状态。
- 如果回调比发送记录更早到达，应记录异常日志，后续补偿处理。

## 8. 状态补偿任务

新增定时任务：

```text
MitakeSmsStatusSyncJob
```

处理范围：

- `send_status in (SUBMITTED, SEND_SUCCESS)`
- `created_at` 在最近 N 天
- `callback_time is null`

任务逻辑：

1. 分页查询待确认短信。
2. 调用三竹状态查询接口。
3. 更新 `notice_sms_record` 状态。
4. 超过最大确认时间仍无结果，标记为 `QUERY_FAIL` 或保持待人工确认。

如果三竹状态查询接口暂未开发，先保留任务接口和表字段，后续补充 `MitakeSmsClient.queryStatus`。

## 9. 失败重试策略

### 9.1 可重试场景

- 网络超时。
- HTTP 5xx。
- 三竹临时性错误码。
- 响应为空。

### 9.2 不可重试场景

- 手机号格式错误。
- 账号密码错误。
- 余额不足。
- 内容违规或参数错误。

重试次数建议：

```text
最多 3 次，每次间隔 1 / 5 / 15 分钟
```

## 10. 代码改造建议

### 10.1 szt-cloud/core

保留现有 `MitakeSmsUtil`，但建议新增更清晰的 client：

```text
com.szt.framework.core.sms.mitake.MitakeSmsClient
```

职责：

- `send(MitakeSmsSendRequest)`
- `queryStatus(MitakeSmsStatusQueryRequest)`
- `parseSendResponse(String)`
- `parseCallback(Map<String, String>)`

`MitakeSmsUtil` 可作为兼容入口，内部委托给 `MitakeSmsClient`。

### 10.2 notice-center/biz

新增：

```text
SmsProvider
SmsProviderRouter
MitakeSmsProvider
Every8dSmsProvider
NoticeSmsRecordService
```

`SmsNotifyService` 改成：

```java
SmsProvider provider = smsProviderRouter.route(noticeActivityParam.getPlatform());
SmsSendResult result = provider.send(command);
```

避免继续写：

```java
if SMS_TW8D ...
if SMS_MITAKE ...
```

### 10.3 notice-center/model

新增：

```text
NoticeSmsRecord
```

对应 `notice_sms_record`。

### 10.4 notice-center/client

如果前端需要查询短信记录，新增 DTO：

```text
NoticeSmsRecordDTO
NoticeSmsRecordQueryReqDTO
```

当前项目已经存在同名 DTO，可以优先复用，补齐字段即可。

## 11. 管理页面建议

短信记录页面建议查询条件：

- 店铺
- 手机号
- 业务单号
- 短信平台
- 发送状态
- 第三方 msgid
- clientMessageId
- 发送时间范围

列表展示：

- 店铺
- 手机号
- 业务单号
- 平台
- 内容摘要
- 发送状态
- 第三方状态码/说明
- msgid
- clientid
- 发送时间
- 回调时间
- 操作：查看详情、重试、重新查询状态

详情页展示：

- 请求参数
- 三竹原始响应
- 回调原始报文
- 错误信息
- 重试历史

## 12. 落地顺序

建议按以下顺序实施：

1. 新增 `notice_sms_record` 表和实体。
2. 新增统一短信发送模型 `SmsSendCommand/SmsSendResult`。
3. 新增 `SmsProvider` 抽象和三竹 Provider。
4. 改造 `SmsNotifyService` 使用 Provider 路由。
5. 三竹发送结果写入 `notice_sms_record`。
6. 新增三竹回调接口。
7. 新增状态补偿任务。
8. 增加短信记录查询页面和接口。

## 13. 关键注意事项

1. 三竹 `clientid` 必须稳定生成，避免业务重复通知。
2. `mobile/content` 涉及隐私，日志中不要完整打印手机号和短信全文。
3. 三竹账号配置继续从 `third_party_app_keys` 获取，不要写死。
4. `SmsNotifyService` 当前会把内容转繁体，这个行为要保留。
5. 营销券 `updateNotice` 只有短信真正提交成功后才执行。
6. 发送成功不代表用户已收到，最终送达状态以回调或状态查询为准。
7. 第三方原始响应要保存，便于和三竹客服排查。

