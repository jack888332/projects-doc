# BMS 数据库连接与只读排查指南

## 1. 适用场景

本文记录在本地开发机上临时连接 BMS/OFP MySQL，用于排查账单生成、订单取数、费用明细等问题的方式。

适用场景：

- 核对 `ar_bill`、`bill_generate_task`、`fee_detail` 等 BMS 业务表。
- 核对 `sale_order_header`、`sale_order_header_extend`、`sale_order_additional_matter` 等源订单表。
- 对比账单生成 SQL 的过滤条件和源表实际数据。
- 排查网络、DNS、MySQL 握手、账号权限等连接问题。

安全要求：

- 不把数据库密码写入文档、代码、提交记录或终端输出。
- 默认只执行 `SELECT`、`SHOW CREATE TABLE` 等只读 SQL。
- 需要写入模拟数据时，必须限定 `member_code`、`shop_id`、`sc_id`，并使用可识别批次前缀。
- 不对其他会员数据执行 `UPDATE`、`DELETE`、批量修复或回滚操作。

## 2. 数据库口径

当前 BMS 排查通常涉及两个库：

| 库名 | 用途 | 常见表 |
| --- | --- | --- |
| `tmall_bms` | BMS 账单业务库 | `bill_config`、`bill_generate_task`、`ar_bill`、`fee_detail`、`main_order` |
| `ofp_ofdb1` | OFP 源订单库 | `sale_order_header`、`sale_order_header_extend`、`sale_order_additional_matter` |

BMS 服务本地配置文件位于：

```text
bms/disconf/download/DS_ds0_conf.properties
```

该文件中的 JDBC URL 默认指向 `tmall_bms`。账单生成源码里会将 URL 中的 `/tmall_bms?` 替换为 `/ofp_ofdb1?` 后读取源订单库。

## 3. 网络连通性检查

先确认 DNS 和端口：

```powershell
Test-NetConnection rm-7xv99ejitty1k0228.mysql.rds.aliyuncs.com -Port 3306 |
  Format-List ComputerName,RemoteAddress,TcpTestSucceeded,InterfaceAlias,SourceAddress
```

判断方式：

- `TcpTestSucceeded = True`：TCP 端口通，可以继续测试 MySQL 协议握手。
- `TcpTestSucceeded = False`：优先检查 VPN、内网路由、RDS 白名单、DNS 解析结果。
- 如果解析到 `198.18.x.x` 等隧道地址且 MySQL 握手被 reset，可切换网络/VPN 后重试。
- 可用时通常能解析到内网地址，例如 `192.168.x.x`。

## 4. Node.js 连接方式

本地没有 `mysql` 命令行时，可用 Node.js + `mysql2` 作为临时只读查询工具。

### 4.1 安装临时依赖

依赖安装到系统临时目录，不写入项目 `package.json`：

```powershell
$tmp = Join-Path $env:TEMP 'codex-mysql-probe'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Push-Location $tmp
if (!(Test-Path package.json)) { npm init -y | Out-Null }
npm install mysql2@3 --no-save
Pop-Location
```

使用时设置 `NODE_PATH`：

```powershell
$env:NODE_PATH = Join-Path $env:TEMP 'codex-mysql-probe/node_modules'
```

### 4.2 设置连接环境变量

不要把真实密码写进文档或脚本文件。临时会话里设置：

```powershell
$env:DB_HOST = 'rm-7xv99ejitty1k0228.mysql.rds.aliyuncs.com'
$env:DB_PORT = '3306'
$env:DB_USER = '<用户名>'
$env:DB_PASS = '<密码>'
$env:NODE_PATH = Join-Path $env:TEMP 'codex-mysql-probe/node_modules'
```

### 4.3 最小连接测试

分别测试 BMS 库和源订单库：

```powershell
@'
const mysql = require('mysql2/promise');

async function tryDb(database) {
  const startedAt = Date.now();
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database,
      timezone: '+08:00',
      charset: 'utf8mb4',
      connectTimeout: 20000
    });
    const [rows] = await conn.query('SELECT DATABASE() db, NOW() now_time');
    await conn.end();
    console.log(database, 'OK', Date.now() - startedAt, JSON.stringify(rows));
  } catch (error) {
    console.log(database, 'ERR', Date.now() - startedAt, error.code || '', error.message);
  }
}

(async () => {
  await tryDb('ofp_ofdb1');
  await tryDb('tmall_bms');
})();
'@ | node
```

常见结果：

- `OK`：可以继续执行只读 SQL。
- `PROTOCOL_CONNECTION_LOST` / `Connection reset`：TCP 端口可能通，但 MySQL 握手被服务端或网络中间层断开。
- `ETIMEDOUT`：网络路径或服务端响应超时。
- `ER_ACCESS_DENIED_ERROR`：账号或密码错误，或账号来源地址不被允许。

## 5. 跨库只读查询模板

建议连接默认库为 `tmall_bms`，源订单表使用库名前缀 `ofp_ofdb1.`：

```powershell
@'
const mysql = require('mysql2/promise');

const billNo = '<账单号>';
const memberCode = '<会员编码>';

function normalizeValue(value) {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').replace('.000Z', '');
  }
  return value;
}

function normalizeRows(rows) {
  return rows.map(row => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])
  ));
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'tmall_bms',
    timezone: '+08:00',
    charset: 'utf8mb4',
    connectTimeout: 20000
  });

  const out = {};
  async function q(label, sql, params = []) {
    const [rows] = await conn.execute(sql, params);
    out[label] = normalizeRows(rows);
  }

  try {
    await q('bill', `
      SELECT id, bill_no, bill_status, bill_config_id, generate_task_id,
             sc_id, shop_id, user_id, member_code,
             billing_period_start_date, billing_period_end_date,
             receivable_amount, unpaid_amount
      FROM ar_bill
      WHERE bill_no = ?
    `, [billNo]);

    await q('fee_detail_group', `
      SELECT fee_code, fee_name, source_table, source_fee_field,
             COUNT(*) cnt, COUNT(DISTINCT business_order_no) order_cnt,
             SUM(amount_bill_currency) bill_amt
      FROM fee_detail
      WHERE bill_no = ? AND fee_status <> 'VOID'
      GROUP BY fee_code, fee_name, source_table, source_fee_field
      ORDER BY fee_code
    `, [billNo]);

    await q('source_order_mark', `
      SELECT COALESCE(e.bms_billed_flag, 0) billed_flag,
             COALESCE(NULLIF(e.bms_bill_no, ''), '') bill_no,
             COUNT(*) cnt
      FROM ofp_ofdb1.sale_order_header h
      LEFT JOIN ofp_ofdb1.sale_order_header_extend e ON e.sale_order_id = h.id
      WHERE h.member_code = ?
        AND h.measure_time >= '2026-06-01'
        AND h.measure_time <  '2026-07-01'
      GROUP BY COALESCE(e.bms_billed_flag, 0), COALESCE(NULLIF(e.bms_bill_no, ''), '')
      ORDER BY cnt DESC
    `, [memberCode]);

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error('QUERY_ERROR:', error.message);
  if (error.sqlMessage) {
    console.error(error.sqlMessage);
  }
  process.exit(1);
});
'@ | node
```

## 6. 账单生成排查常用 SQL

### 6.1 查询账单与任务

```sql
SELECT id, bill_no, bill_status, bill_config_id, generate_task_id,
       member_code, billing_period_start_date, billing_period_end_date,
       receivable_amount, paid_amount, unpaid_amount
FROM ar_bill
WHERE bill_no = ?;

SELECT id, task_no, bill_config_id, task_status, trigger_type,
       pulled_order_count, matched_order_count, skipped_order_count,
       fee_detail_count, additional_fee_count, receivable_amount,
       error_message, order_source_sql, additional_source_sql
FROM bill_generate_task
WHERE id = ?;
```

### 6.2 查询费用明细聚合

```sql
SELECT fee_code, fee_name, source_table, source_fee_field,
       fee_currency, bill_currency,
       COUNT(*) cnt,
       COUNT(DISTINCT business_order_no) order_cnt,
       SUM(amount_fee_currency) fee_amt,
       SUM(amount_bill_currency) bill_amt
FROM fee_detail
WHERE bill_no = ? AND fee_status <> 'VOID'
GROUP BY fee_code, fee_name, source_table, source_fee_field, fee_currency, bill_currency
ORDER BY fee_code;
```

### 6.3 对比源订单口径

账单默认方案不按订单类型过滤；分支方案才按业务类型映射订单类型。

```sql
SELECT h.order_type, h.shop_id, h.sc_id,
       COUNT(*) cnt,
       MIN(h.measure_time) min_measure,
       MAX(h.measure_time) max_measure
FROM ofp_ofdb1.sale_order_header h
WHERE h.member_code = ?
  AND h.measure_time >= '2026-06-01'
  AND h.measure_time <  '2026-07-01'
GROUP BY h.order_type, h.shop_id, h.sc_id
ORDER BY cnt DESC;
```

查询按生成条件仍可见的未出账订单：

```sql
SELECT COUNT(*) cnt
FROM ofp_ofdb1.sale_order_header h
LEFT JOIN ofp_ofdb1.sale_order_header_extend e ON e.sale_order_id = h.id
WHERE h.member_code = ?
  AND h.shop_id = ?
  AND (h.sc_id = ? OR h.sc_id IS NULL)
  AND h.measure_time >= '2026-06-01'
  AND h.measure_time <  '2026-07-01'
  AND COALESCE(e.bms_billed_flag, 0) = 0
  AND (e.bms_bill_no IS NULL OR e.bms_bill_no = '');
```

## 7. 写入模拟数据规范

只有明确需要构造测试数据时才允许写入源订单库。必须遵守：

1. 只写指定会员：`member_code`、`shop_id`、`sc_id` 三个条件必须来自目标账单配置。
2. `order_code` 必须带批次前缀，例如 `BMS_SIM_yyyyMMdd_HHmm_序号`。
3. 插入 `sale_order_header` 后必须插入对应 `sale_order_header_extend`。
4. 模拟数据默认保持：
   - `bms_billed_flag = 0`
   - `bms_bill_no = NULL`
   - `bms_paid_flag = 0`
   - `bms_payment_status = 'WAITING_PAY'`
5. 写入必须包事务，失败立即回滚。
6. 写入后必须用批次前缀查询确认数量和生成口径可见性。

确认示例：

```sql
SELECT COUNT(*) cnt, MIN(id) min_id, MAX(id) max_id
FROM ofp_ofdb1.sale_order_header
WHERE order_code LIKE 'BMS_SIM_20260605_%';

SELECT COUNT(*) cnt
FROM ofp_ofdb1.sale_order_header h
LEFT JOIN ofp_ofdb1.sale_order_header_extend e ON e.sale_order_id = h.id
WHERE h.order_code LIKE 'BMS_SIM_20260605_%'
  AND h.member_code = ?
  AND h.shop_id = ?
  AND (h.sc_id = ? OR h.sc_id IS NULL)
  AND h.measure_time >= '2026-06-01'
  AND h.measure_time <  '2026-07-01'
  AND COALESCE(e.bms_billed_flag, 0) = 0
  AND (e.bms_bill_no IS NULL OR e.bms_bill_no = '');
```

## 8. 注意事项

- Node.js 查询脚本只作为本地临时排查工具，不提交到项目代码。
- 输出结果中不要打印连接密码、完整 JDBC URL 中的密码参数或账号敏感信息。
- Java/JDBC 也可用于连接测试；如果 Node 和 JDBC 都在握手阶段被 reset，优先排查网络和 RDS 访问策略。
- BMS 服务运行时仍以 `DS_ds0_conf.properties` 和代码中的连接逻辑为准，本文只是人工排查手册。
