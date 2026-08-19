#!/usr/bin/env python3
"""按目标客户清理 BMS 测试迁移写入的 OFP 来源数据。默认只读预览。

用法（Windows cmd，单行执行）：
1. 先预览目标客户全部来源数据（不写库）：
   python aidocs/technical-caliber/bms/scripts/cleanup_customer_source_data.py --target-shop-id 1251903850790195200 --target-member-code AR260627A --target-owner-code OG-0054 --target-warehouse-code WH_TW

2. 只按指定订单号收窄清理范围：
   python aidocs/technical-caliber/bms/scripts/cleanup_customer_source_data.py --target-shop-id 1251903850790195200 --target-member-code AR260627A --target-owner-code OG-0054 --target-warehouse-code WH_TW --order-nos "AR260627A-ORD-001,AR260627A-ORD-002"

3. 按迁移页一致的时间字段/范围收窄：
   python aidocs/technical-caliber/bms/scripts/cleanup_customer_source_data.py --target-shop-id 1251903850790195200 --target-member-code AR260627A --target-owner-code OG-0054 --target-warehouse-code WH_TW --time-field delivery_time --start-date 2026-06-01 --end-date 2026-06-30

4. 确认执行：先运行预览，把输出的确认串原样填到 --confirm-summary。
   python aidocs/technical-caliber/bms/scripts/cleanup_customer_source_data.py --target-shop-id 1251903850790195200 --target-member-code AR260627A --target-owner-code OG-0054 --target-warehouse-code WH_TW --execute --confirm-summary "shop_id=1251903850790195200|member_code=AR260627A|owner_code=OG-0054|warehouse_code=WH_TW|all_orders=1"

安全约定：
- 不加 --execute 时只读预览，不执行任何写操作。
- 执行前会检查 tmall_bms 中该客户的 main_order / fee_detail /
  bill_source_collect_mark / ar_bill 下游引用，存在引用时拒绝清理。
- 所有 DELETE 在单事务内分批执行，任一失败整体回滚。
"""

import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import pymysql


TARGET_DB = "ofp_ofdb1"
BMS_DB = "tmall_bms"
HEADER_TABLE = "sale_order_header"
CHILD_TABLES = (
    "sale_order_header_extend",
    "sale_order_additional_matter",
    "sale_order_package_fee",
    "sale_order_fee_detail",
)
CLAIM_TABLE = "claim_order"
ALL_SOURCE_TABLES = (HEADER_TABLE,) + CHILD_TABLES + (CLAIM_TABLE,)
TIME_FIELD_WHITELIST = {
    "delivery_time",
    "measure_time",
    "signed_time",
    "create_time",
    "modify_time",
    "check_time",
}
DEFAULT_DELETE_BATCH_SIZE = 500


def parse_args():
    script_dir = Path(__file__).resolve().parent
    default_env = script_dir.parent / "deployment" / "env.md"
    parser = argparse.ArgumentParser(
        description="清理 BMS 测试数据迁移写入目标 ofp_ofdb1 的客户来源数据；"
                    "不加 --execute 时只做只读预览，不执行任何写操作。"
    )
    parser.add_argument("--env", type=Path, default=default_env, help="数据库连接说明文件")
    parser.add_argument(
        "--target-shop-id",
        required=True,
        help="迁移页面选择的目标客户 shop_id，也是 sale_order_header.shop_id / claim_order.dealer_shop_id",
    )
    parser.add_argument(
        "--target-member-code",
        required=True,
        help="迁移页面选择的目标客户 member_code",
    )
    parser.add_argument("--target-user-id", help="迁移页面填写的目标用户 user_id（仅用于收窄 claim_order）")
    parser.add_argument("--target-customer-no", help="目标客户编码 customer_no（仅用于展示确认串）")
    parser.add_argument("--target-owner-code", help="迁移后订单 owner_code（mine_owner_code），可进一步收窄")
    parser.add_argument("--target-warehouse-code", help="迁移后订单 warehouse_code，可进一步收窄")
    parser.add_argument("--target-platform-shop-id", help="迁移后订单 platform_shop_id，可进一步收窄")
    parser.add_argument("--sc-id", help="供应链 ID；填写后按 h.sc_id = 该值 或 h.sc_id IS NULL 过滤")

    parser.add_argument(
        "--time-field",
        default="delivery_time",
        choices=sorted(TIME_FIELD_WHITELIST),
        help="与迁移页面一致的时间字段，仅在未填写 --order-nos 且填写了时间范围时生效",
    )
    parser.add_argument("--start-date", type=date.fromisoformat, help="开始日期，含当天")
    parser.add_argument("--end-date", type=date.fromisoformat, help="结束日期，含当天")
    parser.add_argument(
        "--order-nos",
        help="指定订单号，逗号、空格或换行分隔；填写后优先按订单号收窄清理范围",
    )

    parser.add_argument("--skip-header-extend", action="store_true", help="不清理 sale_order_header_extend")
    parser.add_argument("--skip-additional-matter", action="store_true", help="不清理 sale_order_additional_matter")
    parser.add_argument("--skip-package-fee", action="store_true", help="不清理 sale_order_package_fee")
    parser.add_argument("--skip-fee-detail", action="store_true", help="不清理 sale_order_fee_detail")
    parser.add_argument("--skip-claim-order", action="store_true", help="不清理 claim_order")

    parser.add_argument(
        "--timeout",
        type=int,
        default=3000,
        help="单次查询/写入等待秒数；大表较慢或锁等待时调大，默认 3000",
    )
    parser.add_argument("--execute", action="store_true", help="确认执行清理；省略时只预览")
    parser.add_argument(
        "--confirm-summary",
        help="执行清理时必须填写与预览输出完全一致的确认串，防止误删其他客户",
    )
    return parser.parse_args()


def read_connection(env_path, database, timeout=3000):
    text = env_path.read_text(encoding="utf-8")
    jdbc = re.search(r"jdbc:mysql://([^:/\s]+):(\d+)", text)
    user = re.search(r"账号[：:]\s*([^\s`]+)", text)
    password = re.search(r"密码[：:]\s*([^\s`]+)", text)
    if not jdbc or not user or not password:
        raise ValueError("无法从 env.md 解析数据库地址、账号或密码")
    return {
        "host": jdbc.group(1),
        "port": int(jdbc.group(2)),
        "user": user.group(1),
        "password": password.group(1),
        "database": database,
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
        "connect_timeout": 300,
        "read_timeout": timeout,
        "write_timeout": timeout,
    }


def fetch_all(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor.fetchall()


def scalar(cursor, sql, params=()):
    row = fetch_all(cursor, sql, params)
    if not row:
        return 0
    return list(row[0].values())[0] or 0


def in_clause(values):
    if not values:
        return "NULL", ()
    return ",".join(["%s"] * len(values)), tuple(values)


def chunks(values, size=DEFAULT_DELETE_BATCH_SIZE):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def parse_order_nos(value):
    if not value:
        return []
    return [part.strip() for part in re.split(r"[,，\n\r\t ]+", value) if part.strip()]


def build_confirm_summary(args, headers, claims):
    parts = [
        f"shop_id={args.target_shop_id}",
        f"member_code={args.target_member_code}",
    ]
    if args.target_user_id:
        parts.append(f"user_id={args.target_user_id}")
    if args.target_customer_no:
        parts.append(f"customer_no={args.target_customer_no}")
    if args.target_owner_code:
        parts.append(f"owner_code={args.target_owner_code}")
    if args.target_warehouse_code:
        parts.append(f"warehouse_code={args.target_warehouse_code}")
    if args.target_platform_shop_id:
        parts.append(f"platform_shop_id={args.target_platform_shop_id}")
    if args.sc_id:
        parts.append(f"sc_id={args.sc_id}")
    order_nos = parse_order_nos(args.order_nos)
    if order_nos:
        parts.append(f"order_codes={len(order_nos)}")
    elif args.start_date or args.end_date:
        parts.append(f"time_field={args.time_field}")
        parts.append(f"range={args.start_date}~{args.end_date}")
    else:
        parts.append("all_orders=1")
    return "|".join(parts)


def load_headers(cursor, args):
    where = ["h.shop_id = %s", "h.member_code = %s"]
    params = [args.target_shop_id, args.target_member_code]
    if args.target_owner_code:
        where.append("h.owner_code = %s")
        params.append(args.target_owner_code)
    if args.target_warehouse_code:
        where.append("h.warehouse_code = %s")
        params.append(args.target_warehouse_code)
    if args.target_platform_shop_id:
        where.append("h.platform_shop_id = %s")
        params.append(args.target_platform_shop_id)
    if args.sc_id:
        where.append("(h.sc_id = %s OR h.sc_id IS NULL)")
        params.append(args.sc_id)

    order_nos = parse_order_nos(args.order_nos)
    if order_nos:
        ids_sql, ids_args = in_clause(order_nos)
        where.append(f"h.order_code IN ({ids_sql})")
        params.extend(ids_args)
    elif args.start_date or args.end_date:
        if not args.start_date or not args.end_date:
            raise ValueError("--start-date 与 --end-date 必须同时填写")
        if args.start_date > args.end_date:
            raise ValueError("--start-date 不能晚于 --end-date")
        end_exclusive = args.end_date + timedelta(days=1)
        where.append(f"h.{args.time_field} >= %s AND h.{args.time_field} < %s")
        params.extend([args.start_date, end_exclusive])

    sql = (
        "SELECT h.id, h.order_code, h.platform_shop_id, h.owner_code, "
        "h.warehouse_code, h.sc_id, h.create_time, h.delivery_time "
        f"FROM {HEADER_TABLE} h WHERE {' AND '.join(where)} ORDER BY h.id"
    )
    return fetch_all(cursor, sql, params)


def load_child_rows(cursor, table, header_ids):
    rows = []
    for batch in chunks(header_ids):
        ids_sql, ids_args = in_clause(batch)
        rows.extend(
            fetch_all(
                cursor,
                f"SELECT id, sale_order_id FROM {table} "
                f"WHERE sale_order_id IN ({ids_sql}) ORDER BY id",
                ids_args,
            )
        )
    return rows


def load_claims(cursor, args):
    where = ["dealer_shop_id = %s"]
    params = [args.target_shop_id]
    if args.target_user_id:
        where.append("user_id = %s")
        params.append(args.target_user_id)
    if args.target_member_code:
        where.append("member_code = %s")
        params.append(args.target_member_code)

    order_nos = parse_order_nos(args.order_nos)
    if order_nos:
        ids_sql, ids_args = in_clause(order_nos)
        where.append(f"order_code IN ({ids_sql})")
        params.extend(ids_args)
    elif args.start_date or args.end_date:
        if not args.start_date or not args.end_date:
            raise ValueError("--start-date 与 --end-date 必须同时填写")
        if args.start_date > args.end_date:
            raise ValueError("--start-date 不能晚于 --end-date")
        end_exclusive = args.end_date + timedelta(days=1)
        where.append("update_time >= %s AND update_time < %s")
        params.extend([args.start_date, end_exclusive])

    sql = (
        "SELECT id, code, order_code, user_id, member_code, dealer_shop_id, update_time "
        f"FROM {CLAIM_TABLE} WHERE {' AND '.join(where)} ORDER BY id"
    )
    return fetch_all(cursor, sql, params)


def check_bms_references(cursor, args, headers, child_rows):
    header_ids = [str(row["id"]) for row in headers]
    order_codes = [row["order_code"] for row in headers if row["order_code"]]
    source_ids = list(header_ids)
    for rows in child_rows.values():
        source_ids.extend(str(row["id"]) for row in rows)

    counts = {
        "main_order": 0,
        "fee_detail": 0,
        "bill_source_collect_mark": 0,
        "ar_bill": 0,
    }
    if not source_ids and not order_codes:
        return counts

    customer_filter = "shop_id = %s AND member_code = %s"
    customer_args = (args.target_shop_id, args.target_member_code)

    for batch in chunks(source_ids):
        ids_sql, ids_args = in_clause(batch)
        counts["fee_detail"] += scalar(
            cursor,
            f"SELECT COUNT(*) FROM fee_detail WHERE source_table IN ({in_clause(ALL_SOURCE_TABLES)[0]}) "
            f"AND (source_id IN ({ids_sql}) OR source_order_id IN ({ids_sql}))",
            in_clause(ALL_SOURCE_TABLES)[1] + ids_args + ids_args,
        )
        counts["bill_source_collect_mark"] += scalar(
            cursor,
            f"SELECT COUNT(*) FROM bill_source_collect_mark "
            f"WHERE source_table IN ({in_clause(ALL_SOURCE_TABLES)[0]}) "
            f"AND source_id IN ({ids_sql})",
            in_clause(ALL_SOURCE_TABLES)[1] + ids_args,
        )

    for batch in chunks(order_codes):
        nos_sql, nos_args = in_clause(batch)
        counts["main_order"] += scalar(
            cursor,
            f"SELECT COUNT(*) FROM main_order WHERE order_no IN ({nos_sql}) "
            f"AND {customer_filter}",
            nos_args + customer_args,
        )
        counts["bill_source_collect_mark"] += scalar(
            cursor,
            f"SELECT COUNT(*) FROM bill_source_collect_mark WHERE source_order_no IN ({nos_sql}) "
            f"AND {customer_filter}",
            nos_args + customer_args,
        )

    counts["fee_detail"] += scalar(
        cursor,
        f"SELECT COUNT(*) FROM fee_detail WHERE {customer_filter}",
        customer_args,
    )
    counts["bill_source_collect_mark"] += scalar(
        cursor,
        f"SELECT COUNT(*) FROM bill_source_collect_mark WHERE {customer_filter}",
        customer_args,
    )
    counts["main_order"] += scalar(
        cursor,
        f"SELECT COUNT(*) FROM main_order WHERE {customer_filter}",
        customer_args,
    )
    counts["ar_bill"] += scalar(
        cursor,
        f"SELECT COUNT(*) FROM ar_bill WHERE {customer_filter}",
        customer_args,
    )
    return counts


def delete_by_ids(cursor, table, ids):
    affected = 0
    for batch in chunks(ids):
        ids_sql, ids_args = in_clause(batch)
        cursor.execute(f"DELETE FROM {table} WHERE id IN ({ids_sql})", ids_args)
        affected += cursor.rowcount
    return affected


def preview(cursor, args, headers, child_rows, claims, bms_refs, confirm_summary):
    order_nos = parse_order_nos(args.order_nos)
    print(f"目标库: {TARGET_DB}")
    print(f"客户: shop_id={args.target_shop_id}, member_code={args.target_member_code}")
    if args.target_owner_code:
        print(f"owner_code={args.target_owner_code}")
    if args.target_warehouse_code:
        print(f"warehouse_code={args.target_warehouse_code}")
    if args.target_platform_shop_id:
        print(f"platform_shop_id={args.target_platform_shop_id}")
    if args.target_user_id:
        print(f"user_id={args.target_user_id}")
    if order_nos:
        print(f"范围: 按 {len(order_nos)} 个订单号")
    elif args.start_date or args.end_date:
        print(f"范围: {args.time_field} {args.start_date} ~ {args.end_date}")
    else:
        print("范围: 该客户全部来源数据")

    print("待处理数据：")
    print(f"  {HEADER_TABLE}: {len(headers)}")
    for table, rows in child_rows.items():
        print(f"  {table}: {len(rows)}")
    print(f"  {CLAIM_TABLE}: {len(claims)}")
    print("BMS 下游引用（只读校验）：")
    for table, count in bms_refs.items():
        print(f"  {table}: {count}")
    print(f"确认串: {confirm_summary}")
    if headers:
        print("订单号样例（最多 10 条）：")
        for row in headers[:10]:
            print(f"  {row['id']} {row['order_code']}")
    sys.stdout.flush()


def main():
    args = parse_args()
    connection = pymysql.connect(**read_connection(args.env.resolve(), TARGET_DB, args.timeout))
    bms_connection = pymysql.connect(**read_connection(args.env.resolve(), BMS_DB, args.timeout))
    try:
        with connection.cursor() as cursor, bms_connection.cursor() as bms_cursor:
            for current_cursor in (cursor, bms_cursor):
                try:
                    current_cursor.execute(
                        "SET SESSION net_read_timeout = %s, net_write_timeout = %s",
                        (args.timeout, args.timeout),
                    )
                except pymysql.MySQLError:
                    pass

            headers = load_headers(cursor, args)
            header_ids = [row["id"] for row in headers]
            child_rows = {}
            for table in CHILD_TABLES:
                if table == "sale_order_header_extend" and args.skip_header_extend:
                    child_rows[table] = []
                elif table == "sale_order_additional_matter" and args.skip_additional_matter:
                    child_rows[table] = []
                elif table == "sale_order_package_fee" and args.skip_package_fee:
                    child_rows[table] = []
                elif table == "sale_order_fee_detail" and args.skip_fee_detail:
                    child_rows[table] = []
                else:
                    child_rows[table] = load_child_rows(cursor, table, header_ids)
            claims = [] if args.skip_claim_order else load_claims(cursor, args)

            bms_refs = check_bms_references(bms_cursor, args, headers, child_rows)
            confirm_summary = build_confirm_summary(args, headers, claims)
            preview(cursor, args, headers, child_rows, claims, bms_refs, confirm_summary)

            errors = []
            if bms_refs and any(bms_refs.values()):
                errors.append(
                    "目标客户仍存在 BMS 下游数据，请先按账单任务清理 BMS 数据"
                    "（参考 cleanup_ar_bill_task.py），或确认这些数据确实允许保留"
                )

            if errors:
                print("\n安全检查未通过：", file=sys.stderr)
                for error in errors:
                    print(f"  - {error}", file=sys.stderr)
                connection.rollback()
                return 2

            if not args.execute:
                connection.rollback()
                print("\n当前为只读预览。确认无误后增加："
                      f" --execute --confirm-summary \"{confirm_summary}\"")
                return 0

            if args.confirm_summary != confirm_summary:
                connection.rollback()
                print("--confirm-summary 与预览输出不一致，未执行清理", file=sys.stderr)
                return 2

            result = {}
            claim_ids = [row["id"] for row in claims]
            if claim_ids:
                result[CLAIM_TABLE] = delete_by_ids(cursor, CLAIM_TABLE, claim_ids)
            for table, rows in child_rows.items():
                ids = [row["id"] for row in rows]
                if ids:
                    result[table] = delete_by_ids(cursor, table, ids)
            if header_ids:
                result[HEADER_TABLE] = delete_by_ids(cursor, HEADER_TABLE, header_ids)

            connection.commit()
            print("\n清理完成：")
            for name, count in result.items():
                print(f"  {name}: {count}")
            return 0
    except Exception as exc:
        try:
            connection.rollback()
        except pymysql.MySQLError:
            pass
        message = f"清理失败：{exc}"
        if isinstance(exc, pymysql.OperationalError) and exc.args and exc.args[0] == 2013:
            message += (
                f"\n提示：连接在查询期间中断（超过 {args.timeout} 秒未收到数据），"
                "通常是查询较慢、锁等待或网络抖动；可加 --timeout 6000 提高等待时间后重试"
            )
        print(message, file=sys.stderr)
        return 1
    finally:
        connection.close()
        bms_connection.close()


if __name__ == "__main__":
    sys.exit(main())
