#!/usr/bin/env python3
"""按任务 ID 清理应收账单生成任务产生的调试数据。默认只预览。"""

import argparse
import re
import sys
from datetime import timedelta
from pathlib import Path

import pymysql


BMS_DB = "tmall_bms"
SOURCE_DB = "ofp_ofdb1"
ALLOWED_BILL_STATUSES = {"GENERATING", "DRAFT", "GENERATED", "VOID"}
ALLOWED_TASK_STATUSES = {"SUCCESS", "FAILED", "CANCELED"}
TERMINAL_EXPORT_STATUSES = {"SUCCESS", "PARTIAL_SUCCESS", "FAILED", "CANCELLED"}

# 各源表在抓取 SQL 中的别名与关联方式，来源：bill_generate_task.order_source_sql /
# additional_source_sql 中保存的真实 SQL 快照（与 BillGenerateServiceImpl 的 build*QuerySql 一致）。
SOURCE_TABLE_META = {
    "sale_order_header_extend": (
        "e",
        f"JOIN {SOURCE_DB}.sale_order_header h ON h.id = e.sale_order_id",
    ),
    "sale_order_additional_matter": (
        "a",
        f"JOIN {SOURCE_DB}.sale_order_header h ON h.id = a.sale_order_id",
    ),
    "claim_order": ("c", ""),
}
KNOWN_SOURCE_TABLES = set(SOURCE_TABLE_META)


def parse_args():
    script_dir = Path(__file__).resolve().parent
    default_env = script_dir.parent / "deployment" / "env.md"
    parser = argparse.ArgumentParser(
        description="清理一个 MEMBER_AR 账单生成任务的数据；不加 --execute 时只做只读预览。"
    )
    parser.add_argument("--task-id", required=True, type=int, help="bill_generate_task.id")
    parser.add_argument("--env", type=Path, default=default_env, help="数据库连接说明文件")
    parser.add_argument(
        "--timeout",
        type=int,
        default=3000,
        help="单次查询等待秒数（读/写），生产库查询较慢或锁等待时调大；默认 3000",
    )
    parser.add_argument("--execute", action="store_true", help="确认执行清理；省略时只预览")
    parser.add_argument(
        "--confirm-task-no",
        help="执行清理时必须填写完整 task_no，防止误删其他任务",
    )
    return parser.parse_args()


def read_connection(env_path, timeout=3000):
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
        "database": BMS_DB,
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
        "connect_timeout": 300,
        "read_timeout": timeout,
        "write_timeout": timeout,
    }


def fetch_one(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor.fetchone()


def fetch_all(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor.fetchall()


def scalar(cursor, sql, params=()):
    row = fetch_one(cursor, sql, params)
    return next(iter(row.values())) if row else 0


def in_clause(values):
    if not values:
        return "NULL", ()
    return ",".join(["%s"] * len(values)), tuple(values)


def source_scope_conditions(task):
    """按任务实际抓取 SQL 的作用域生成源表查询条件（账期、member、shop、sc）。"""
    if not task["billing_period_start_date"] or not task["billing_period_end_date"]:
        raise ValueError("任务缺少账期起止日期，无法生成带时间范围的源表清理条件")
    start = task["billing_period_start_date"]
    end_exclusive = task["billing_period_end_date"] + timedelta(days=1)
    member = task["member_code"]
    shop_id = task["shop_id"]
    sc_id = task["sc_id"]
    user_id = task["user_id"]
    return {
        "sale_order_header_extend": (
            "h.member_code = %s AND h.shop_id = %s AND (h.sc_id = %s OR h.sc_id IS NULL) "
            "AND h.delivery_time >= %s AND h.delivery_time < %s",
            (member, shop_id, sc_id, start, end_exclusive),
        ),
        "sale_order_additional_matter": (
            "h.member_code = %s AND h.shop_id = %s AND (h.sc_id = %s OR h.sc_id IS NULL) "
            "AND a.create_time >= %s AND a.create_time < %s",
            (member, shop_id, sc_id, start, end_exclusive),
        ),
        "claim_order": (
            "c.dealer_shop_id = %s AND c.user_id = %s "
            "AND (c.member_code = %s OR c.member_code IS NULL OR c.member_code = '') "
            "AND c.update_time >= %s AND c.update_time < %s",
            (shop_id, user_id, member, start, end_exclusive),
        ),
    }


def load_export_tasks(cursor, bill_ids):
    if not bill_ids:
        return []
    ids_sql, ids_args = in_clause(bill_ids)
    return fetch_all(
        cursor,
        "SELECT t.id, t.task_no, t.task_status, t.is_deleted, COUNT(i.id) item_count, "
        f"SUM(i.bill_id IN ({ids_sql})) target_item_count "
        "FROM bill_export_task t JOIN bill_export_task_item i ON i.task_id = t.id "
        f"WHERE t.id IN (SELECT task_id FROM bill_export_task_item WHERE bill_id IN ({ids_sql})) "
        "GROUP BY t.id, t.task_no, t.task_status, t.is_deleted ORDER BY t.id",
        ids_args + ids_args,
    )


def load_scope(cursor, task_id, lock=False):
    lock_sql = " FOR UPDATE" if lock else ""
    task = fetch_one(
        cursor,
        "SELECT id, task_no, bill_type, task_status, data_pull_type, bill_config_id, "
        "sc_id, shop_id, user_id, member_code, "
        "billing_period_start_date, billing_period_end_date, created_at "
        "FROM bill_generate_task WHERE id = %s" + lock_sql,
        (task_id,),
    )
    if not task:
        raise ValueError(f"账单生成任务不存在：{task_id}")
    if task["bill_type"] != "MEMBER_AR":
        raise ValueError(f"仅允许清理 MEMBER_AR 应收任务，当前类型：{task['bill_type']}")

    bills = fetch_all(
        cursor,
        "SELECT DISTINCT b.id, b.bill_no, b.bill_status, b.generate_task_id, "
        "b.paid_amount, b.paid_amount_fin "
        "FROM ar_bill b WHERE b.generate_task_id = %s "
        "OR b.id IN (SELECT bill_id FROM fee_detail WHERE generate_task_id = %s AND bill_id IS NOT NULL) "
        "OR b.id IN (SELECT bill_id FROM main_order WHERE generate_task_id = %s AND bill_id IS NOT NULL) "
        "OR b.id IN (SELECT bill_id FROM bill_source_collect_mark WHERE generate_task_id = %s AND bill_id IS NOT NULL) "
        "ORDER BY b.id",
        (task_id, task_id, task_id, task_id),
    )
    bill_ids = [row["id"] for row in bills]
    bill_nos = [row["bill_no"] for row in bills]
    bill_id_sql, bill_id_args = in_clause(bill_ids)
    if lock and bill_ids:
        # 锁住目标账单，避免安全检查通过后又被确认、核销或追加费用。
        fetch_all(
            cursor,
            f"SELECT id FROM ar_bill WHERE id IN ({bill_id_sql}) FOR UPDATE",
            bill_id_args,
        )

    marks = fetch_all(
        cursor,
        "SELECT id, source_database, source_table, source_id, bill_no, collect_type, mark_status "
        "FROM bill_source_collect_mark WHERE generate_task_id = %s "
        + (f"OR bill_id IN ({bill_id_sql}) " if bill_ids else "")
        + "ORDER BY id",
        (task_id,) + bill_id_args,
    )
    return task, bills, marks, bill_ids, bill_nos


def validate_scope(cursor, task, bills, marks, bill_ids, bill_nos):
    errors = []
    task_id = task["id"]
    if task["task_status"] not in ALLOWED_TASK_STATUSES:
        errors.append(
            f"任务状态 {task['task_status']} 不允许清理；请先确保执行器不再处理该任务"
        )

    for bill in bills:
        if bill["generate_task_id"] != task_id:
            errors.append(
                f"账单 {bill['bill_no']} 属于任务 {bill['generate_task_id']}，当前任务只是增量写入，无法安全整单回滚"
            )
        if bill["bill_status"] not in ALLOWED_BILL_STATUSES:
            errors.append(f"账单 {bill['bill_no']} 状态为 {bill['bill_status']}，不允许调试清理")
        if (bill["paid_amount"] or 0) != 0 or (bill["paid_amount_fin"] or 0) != 0:
            errors.append(f"账单 {bill['bill_no']} 已产生核销金额")

    unknown_tables = sorted({m["source_table"] for m in marks} - KNOWN_SOURCE_TABLES)
    if unknown_tables:
        errors.append("存在尚未支持回退标记的来源表：" + ", ".join(unknown_tables))

    if bill_ids:
        ids_sql, ids_args = in_clause(bill_ids)
        foreign_fees = scalar(
            cursor,
            f"SELECT COUNT(*) FROM fee_detail WHERE bill_id IN ({ids_sql}) "
            "AND NOT (generate_task_id <=> %s)",
            ids_args + (task_id,),
        )
        foreign_orders = scalar(
            cursor,
            f"SELECT COUNT(*) FROM main_order WHERE bill_id IN ({ids_sql}) "
            "AND NOT (generate_task_id <=> %s)",
            ids_args + (task_id,),
        )
        if foreign_fees:
            errors.append(f"目标账单含 {foreign_fees} 条非本任务费用（可能是手工费用或其他任务增量）")
        if foreign_orders:
            errors.append(f"目标账单含 {foreign_orders} 条非本任务订单快照")

        downstream_checks = {
            "核销明细": (f"SELECT COUNT(*) FROM payment_writeoff_detail WHERE bill_id IN ({ids_sql})", ids_args),
            "返款分配": (f"SELECT COUNT(*) FROM refund_payment_allocation WHERE bill_id IN ({ids_sql})", ids_args),
            "源系统支付回写": (f"SELECT COUNT(*) FROM source_payment_writeback WHERE bill_id IN ({ids_sql})", ids_args),
            "调账记录": (
                f"SELECT COUNT(*) FROM fee_adjustment_record WHERE trigger_bill_id IN ({ids_sql}) "
                f"OR assigned_bill_id IN ({ids_sql})",
                ids_args + ids_args,
            ),
        }
        for export_task in load_export_tasks(cursor, bill_ids):
            detail = (f"id={export_task['id']}/no={export_task['task_no']}"
                      f"/status={export_task['task_status']}")
            if not export_task["is_deleted"] and export_task["task_status"] not in TERMINAL_EXPORT_STATUSES:
                errors.append(f"导出任务 {detail} 尚未结束，不能清理")
        nos_sql, nos_args = in_clause(bill_nos)
        downstream_checks["支付记录"] = (
            f"SELECT COUNT(*) FROM payment_record WHERE bill_no IN ({nos_sql})",
            nos_args,
        )
        downstream_checks["调账单"] = (
            f"SELECT COUNT(*) FROM fee_adjustment_order WHERE trigger_bill_id IN ({ids_sql}) "
            f"OR trigger_bill_no IN ({nos_sql}) OR source_bill_no IN ({nos_sql}) OR target_bill_no IN ({nos_sql})",
            ids_args + nos_args + nos_args + nos_args,
        )
        for name, (sql, params) in downstream_checks.items():
            count = scalar(cursor, sql, params)
            if count:
                errors.append(f"存在 {count} 条{name}，必须先按业务流程撤销")

    task_fee_ids = fetch_all(cursor, "SELECT id FROM fee_detail WHERE generate_task_id = %s", (task_id,))
    if task_fee_ids:
        fee_ids = [row["id"] for row in task_fee_ids]
        fee_sql, fee_args = in_clause(fee_ids)
        derived = scalar(
            cursor,
            f"SELECT COUNT(*) FROM fee_detail WHERE original_fee_id IN ({fee_sql}) "
            "AND NOT (generate_task_id <=> %s)",
            fee_args + (task_id,),
        )
        if derived:
            errors.append(f"本任务费用已派生出 {derived} 条红冲/调账费用")
    return errors


def preview(cursor, task, bills, marks, bill_ids):
    task_id = task["id"]
    bill_nos = [bill["bill_no"] for bill in bills]
    bill_nos_sql, bill_nos_args = in_clause(bill_nos)
    source_scope = source_scope_conditions(task)
    export_tasks = load_export_tasks(cursor, bill_ids)
    export_task_ids = [row["id"] for row in export_tasks]
    export_ids_sql, export_ids_args = in_clause(export_task_ids)
    counts = {
        "ar_bill": len(bills),
        "fee_detail": scalar(cursor, "SELECT COUNT(*) FROM fee_detail WHERE generate_task_id = %s", (task_id,)),
        "main_order": scalar(cursor, "SELECT COUNT(*) FROM main_order WHERE generate_task_id = %s", (task_id,)),
        "bill_source_collect_mark": len(marks),
        "bill_order_waybill_snapshot": scalar(
            cursor,
            "SELECT COUNT(*) FROM bill_order_waybill_snapshot s "
            "WHERE EXISTS (SELECT 1 FROM main_order m "
            "WHERE m.id = s.main_order_id AND m.generate_task_id = %s)",
            (task_id,),
        ),
        "ar_bill_currency_summary": 0,
        "bill_exchange_rate": 0,
        "bill_export_task": len(export_tasks),
        "bill_export_task_item": sum(row["target_item_count"] for row in export_tasks),
        "bill_export_notification": scalar(
            cursor,
            f"SELECT COUNT(*) FROM bill_export_notification WHERE task_id IN ({export_ids_sql})",
            export_ids_args,
        ) if export_task_ids else 0,
        f"{SOURCE_DB}.source_marks": sum(
            scalar(
                cursor,
                f"SELECT COUNT(*) FROM {SOURCE_DB}.{table} {alias} {join_sql} "
                f"WHERE {alias}.bms_bill_no IN ({bill_nos_sql}) AND {scope_sql}",
                bill_nos_args + scope_args,
            )
            for table, (alias, join_sql) in SOURCE_TABLE_META.items()
            for scope_sql, scope_args in [source_scope[table]]
        ) if bill_nos else 0,
        "external_fee_links_to_clear": 0,
    }
    if bill_ids:
        ids_sql, ids_args = in_clause(bill_ids)
        counts["bill_order_waybill_snapshot"] = scalar(
            cursor,
            f"SELECT COUNT(*) FROM bill_order_waybill_snapshot s WHERE s.bill_id IN ({ids_sql}) "
            "OR EXISTS (SELECT 1 FROM main_order m "
            "WHERE m.id = s.main_order_id AND m.generate_task_id = %s)",
            ids_args + (task_id,),
        )
        counts["ar_bill_currency_summary"] = scalar(
            cursor, f"SELECT COUNT(*) FROM ar_bill_currency_summary WHERE bill_id IN ({ids_sql})", ids_args
        )
        counts["bill_exchange_rate"] = scalar(
            cursor, f"SELECT COUNT(*) FROM bill_exchange_rate WHERE bill_id IN ({ids_sql})", ids_args
        )
        counts["external_fee_links_to_clear"] = scalar(
            cursor,
            f"SELECT COUNT(*) FROM fee_detail WHERE related_bill_id IN ({ids_sql}) "
            "AND NOT (generate_task_id <=> %s)",
            ids_args + (task_id,),
        )

    print(f"task: id={task_id}, no={task['task_no']}, status={task['task_status']}, pull={task['data_pull_type']}")
    if bills:
        for bill in bills:
            print(f"bill: id={bill['id']}, no={bill['bill_no']}, status={bill['bill_status']}")
    else:
        print("bill: 本任务未生成账单")
    print("待处理数据：")
    for table, count in counts.items():
        print(f"  {table}: {count}")


def execute_cleanup(cursor, task, marks, bill_ids, bill_nos):
    task_id = task["id"]
    result = {}

    export_tasks = load_export_tasks(cursor, bill_ids)
    export_task_ids = [row["id"] for row in export_tasks]
    if export_task_ids:
        export_sql, export_args = in_clause(export_task_ids)
        bill_sql, bill_args = in_clause(bill_ids)
        cursor.execute(
            f"DELETE FROM bill_export_notification WHERE task_id IN ({export_sql})",
            export_args,
        )
        result["bill_export_notification"] = cursor.rowcount
        cursor.execute(
            f"DELETE FROM bill_export_task_item WHERE task_id IN ({export_sql}) "
            f"AND bill_id IN ({bill_sql})",
            export_args + bill_args,
        )
        result["bill_export_task_item"] = cursor.rowcount
        cursor.execute(
            f"DELETE FROM bill_export_task WHERE id IN ({export_sql}) "
            "AND NOT EXISTS (SELECT 1 FROM bill_export_task_item i "
            "WHERE i.task_id = bill_export_task.id)",
            export_args,
        )
        result["bill_export_task"] = cursor.rowcount
        cursor.execute(
            "UPDATE bill_export_task t SET "
            "total_count = (SELECT COUNT(*) FROM bill_export_task_item i WHERE i.task_id = t.id), "
            "processed_count = (SELECT COUNT(*) FROM bill_export_task_item i WHERE i.task_id = t.id "
            "AND i.item_status IN ('SUCCESS', 'FAILED')), "
            "success_count = (SELECT COUNT(*) FROM bill_export_task_item i WHERE i.task_id = t.id "
            "AND i.item_status = 'SUCCESS'), "
            "failed_count = (SELECT COUNT(*) FROM bill_export_task_item i WHERE i.task_id = t.id "
            "AND i.item_status = 'FAILED'), "
            "file_key = NULL, file_expire_at = NULL, "
            "failure_reason = '关联账单已执行调试清理，原导出文件已失效', updated_at = NOW() "
            f"WHERE t.id IN ({export_sql})",
            export_args,
        )
        result["bill_export_task.invalidated"] = cursor.rowcount

    bill_nos_sql, bill_nos_args = in_clause(bill_nos)
    source_scope = source_scope_conditions(task)
    for table, id_column, clear_billed_at in (
        ("sale_order_header_extend", "sale_order_id", False),
        ("sale_order_additional_matter", "id", False),
        ("claim_order", "id", True),
    ):
        alias, join_sql = SOURCE_TABLE_META[table]
        scope_sql, scope_args = source_scope[table]
        affected = 0
        if bill_nos:
            extra = ", bms_billed_at = NULL" if clear_billed_at else ""
            cursor.execute(
                f"UPDATE {SOURCE_DB}.{table} {alias} {join_sql} "
                f"SET {alias}.bms_billed_flag = 0, {alias}.bms_bill_no = NULL{extra} "
                f"WHERE {alias}.bms_bill_no IN ({bill_nos_sql}) AND {scope_sql}",
                bill_nos_args + scope_args,
            )
            affected += cursor.rowcount
        table_marks = [m for m in marks if m["source_table"] == table]
        for mark in table_marks:
            if mark["bill_no"] is not None:
                continue
            extra = ", bms_billed_at = NULL" if clear_billed_at else ""
            cursor.execute(
                f"UPDATE {SOURCE_DB}.{table} SET bms_billed_flag = 0, bms_bill_no = NULL{extra} "
                f"WHERE {id_column} = %s AND bms_billed_flag = 1 AND bms_bill_no <=> %s",
                (mark["source_id"], mark["bill_no"]),
            )
            affected += cursor.rowcount
        result[f"{SOURCE_DB}.{table}"] = affected
        if bill_nos:
            remaining = scalar(
                cursor,
                f"SELECT COUNT(*) FROM {SOURCE_DB}.{table} {alias} {join_sql} "
                f"WHERE {alias}.bms_bill_no IN ({bill_nos_sql}) AND {scope_sql}",
                bill_nos_args + scope_args,
            )
            if remaining:
                raise RuntimeError(f"{SOURCE_DB}.{table} 仍有 {remaining} 条源数据抓取标识未恢复")

    snapshot_where = (
        "EXISTS (SELECT 1 FROM main_order m "
        "WHERE m.id = bill_order_waybill_snapshot.main_order_id AND m.generate_task_id = %s)"
    )
    snapshot_args = (task_id,)
    if bill_ids:
        ids_sql, ids_args = in_clause(bill_ids)
        cursor.execute(
            "UPDATE fee_detail SET related_bill_id = NULL, related_bill_no = NULL, related_bill_type = NULL, "
            "related_bill_config_id = NULL, related_settlement_role = NULL, related_business_order_no = NULL, "
            "related_bill_currency = NULL, related_amount_bill_currency = NULL, related_exchange_rate_to_bill = NULL, "
            "related_exchange_rate_level_to_bill = NULL, related_fin_currency = NULL, "
            "related_amount_fin_currency = NULL, related_exchange_rate_to_fin = NULL, "
            "related_exchange_rate_level_to_fin = NULL "
            f"WHERE related_bill_id IN ({ids_sql}) AND NOT (generate_task_id <=> %s)",
            ids_args + (task_id,),
        )
        result["fee_detail.external_links"] = cursor.rowcount

        snapshot_where = f"bill_id IN ({ids_sql}) OR " + snapshot_where
        snapshot_args = ids_args + snapshot_args
        for table in ("ar_bill_currency_summary", "bill_exchange_rate"):
            cursor.execute(f"DELETE FROM {table} WHERE bill_id IN ({ids_sql})", ids_args)
            result[table] = cursor.rowcount

    cursor.execute(f"DELETE FROM bill_order_waybill_snapshot WHERE {snapshot_where}", snapshot_args)
    result["bill_order_waybill_snapshot"] = cursor.rowcount

    cursor.execute("DELETE FROM fee_detail WHERE generate_task_id = %s", (task_id,))
    result["fee_detail"] = cursor.rowcount
    cursor.execute("DELETE FROM main_order WHERE generate_task_id = %s", (task_id,))
    result["main_order"] = cursor.rowcount

    mark_ids = [m["id"] for m in marks]
    if mark_ids:
        mark_sql, mark_args = in_clause(mark_ids)
        cursor.execute(f"DELETE FROM bill_source_collect_mark WHERE id IN ({mark_sql})", mark_args)
        result["bill_source_collect_mark"] = cursor.rowcount

    cursor.execute("DELETE FROM ar_bill WHERE generate_task_id = %s", (task_id,))
    result["ar_bill"] = cursor.rowcount
    cursor.execute("DELETE FROM bill_generate_task WHERE id = %s", (task_id,))
    if cursor.rowcount != 1:
        raise RuntimeError("删除任务记录失败，事务已回滚")
    result["bill_generate_task"] = cursor.rowcount
    return result


def main():
    args = parse_args()
    connection = pymysql.connect(**read_connection(args.env.resolve(), args.timeout))
    try:
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    "SET SESSION net_read_timeout = %s, net_write_timeout = %s",
                    (args.timeout, args.timeout),
                )
            except pymysql.MySQLError:
                pass
            task, bills, marks, bill_ids, bill_nos = load_scope(cursor, args.task_id, args.execute)
            errors = validate_scope(cursor, task, bills, marks, bill_ids, bill_nos)
            preview(cursor, task, bills, marks, bill_ids)
            if errors:
                print("\n安全检查未通过：", file=sys.stderr)
                for error in errors:
                    print(f"  - {error}", file=sys.stderr)
                connection.rollback()
                return 2
            if not args.execute:
                connection.rollback()
                print("\n当前为只读预览。确认无误后增加："
                      f" --execute --confirm-task-no {task['task_no']}")
                return 0
            if args.confirm_task_no != task["task_no"]:
                connection.rollback()
                print("--confirm-task-no 与数据库中的完整任务号不一致，未执行清理", file=sys.stderr)
                return 2

            result = execute_cleanup(cursor, task, marks, bill_ids, bill_nos)
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
                "通常是查询较慢、锁等待或网络抖动；可加 --timeout 6000 提高等待时间后重试。"
                "若连接是被服务端断开，则多半是查询本身太重或缺少索引。"
            )
        print(message, file=sys.stderr)
        return 1
    finally:
        connection.close()


if __name__ == "__main__":
    sys.exit(main())
