## 读取说明
> 你要理解我整个数据库表结构中的数据设计、比如费项索引和场景关联关系、账单与费用明细关联关系等。

### 数据库基础配置信息
```
数据库连接：jdbc:mysql://rm-7xv99ejitty1k0228.mysql.rds.aliyuncs.com:3306
账号：root
密码：rootroot123321!@#

```

### BMS开发环境数据库配置信息

> bms项目账单数据，生成账单后存储数据，包含账单配置、费项索引、返款账单、应收账单业务表结构
```
库名：tmall_bms
```

### BMS-来源数据库配置信息
> bms-费项来源数据表，包含费项索引拉取数据源数据
```
库名：ofp_ofdb1
```

### BMS-来源数据库配置信息
> bms-费项来源数据表，包含费项索引拉取尾程包裹数据源数据
```
库名：cxms
```

### 数据连接方式

> 本次读取库表结构、索引和样例数据时，实际使用的是 `Python + pymysql` 直连方式。适用于快速核对表结构、关联关系、索引和样例数据，不修改现有业务配置文件。

#### 连接说明

1. 连接地址使用上方 `jdbc:mysql://rm-7xv99ejitty1k0228.mysql.rds.aliyuncs.com:3306`
2. 账号密码使用上方 `root / rootroot123321!@#`
3. 查询 BMS 账单数据时连接库 `tmall_bms`
4. 查询来源订单、费用明细等源数据时连接库 `ofp_ofdb1`
5. 建议默认只执行 `SELECT`、`SHOW`、`DESC`、`information_schema` 查询

#### Python 连接示例

```python
import pymysql

conn = pymysql.connect(
    host="rm-7xv99ejitty1k0228.mysql.rds.aliyuncs.com",
    port=3306,
    user="root",
    password="rootroot123321!@#",
    database="ofp_ofdb1",  # 查询 BMS 库时改为 tmall_bms
    charset="utf8mb4"
)

with conn.cursor() as cursor:
    cursor.execute("SELECT COUNT(1) FROM sale_order_header")
    print(cursor.fetchone())

conn.close()
```

#### 表结构查询示例

```sql
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'ofp_ofdb1'
  AND TABLE_NAME = 'sale_order_fee_detail'
ORDER BY ORDINAL_POSITION;
```

#### 索引查询示例

```sql
SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'ofp_ofdb1'
  AND TABLE_NAME = 'sale_order_package_fee'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
```

#### 关联关系核对示例

```sql
SELECT d.id,
       d.sale_order_id,
       h.order_code,
       h.shop_id,
       h.member_code
FROM sale_order_fee_detail d
LEFT JOIN sale_order_header h ON h.id = d.sale_order_id
ORDER BY d.id DESC
LIMIT 10;
```

#### 备注

1. 当前工作区已验证可使用 `pymysql` 连接读取数据
2. `sale_order_package_fee`、`sale_order_fee_detail` 当前都是通过 `sale_order_id` 关联 `sale_order_header.id`
3. 若仅核对结构与关系，优先查询 `information_schema`，避免直接扫描大表
