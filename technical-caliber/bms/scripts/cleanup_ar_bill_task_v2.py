#!/usr/bin/env python3
"""按任务 ID 清理应收/返款账单生成任务产生的调试数据（v2）。默认只预览。

v2 相对 v1 的调整：
1. 源表打标恢复改为以 bill_source_collect_mark 的来源轨迹为准，不再按
   bms_bill_no 匹配，适配 2026-08-20 应收/返款源数据打标互斥改造后
   "bms_bill_no 仅记录最近入账单号"的语义。
2. 同一来源仍有其他任务/账单类型的 MARKED 轨迹时保留源表标记，避免清理
   当前任务时破坏跨类型占用；只有无任何剩余 MARKED 轨迹时才恢复未打标。
3. 保留源表标记的来源会把 bms_bill_no 刷新为仍占用轨迹的最近单号，保证
   源表展示与实际占用一致。
4. 同一账单可能被多个增量生成任务写入（生成代码按 配置+账期+拆单维度 复用
   已有 GENERATED/DRAFT 账单），因此 v2 增加 --include-related-tasks：
   默认遇到共享账单仍拦截，只有显式把相关任务纳入同一次清理时才整单原子回滚。
"""

import argparse
import re
import sys
from pathlib import Path

import pymysql


BMS_DB = "tmall_bms"
SOURCE_DB = "ofp_ofdb1"
ALLOWED_SOURCE_DATABASES = {"ofp_ofdb1", "cxms", "lfc_basedb"}
ALLOWED_BILL_TYPES = {"MEMBER_AR", "COD_REFUND"}
ALLOWED_BILL_STATUSES = {
    "MEMBER_AR": {"GENERATING", "DRAFT", "GENERATED", "VOID"},
    "COD_REFUND": {"DRAFT", "GENERATED", "UNDER_REVIEW", "VOID"},
}
ALLOWED_TASK_STATUSES = {"SUCCESS", "FAILED", "CANCELED"}
TERMINAL_EXPORT_STATUSES = {"SUCCESS", "PARTIAL_SUCCESS", "FAILED", "CANCELLED"}

# 已知来源表；来源轨迹(source_table)不在清单内时拒绝清理，避免误更新未知表。
KNOWN_SOURCE_TABLES = {
    "sale_order_header_extend",
    "sale_order_additional_matter",
    "claim_order",
}

# 各来源表恢复/刷新打标时使用的源表主键列。
SOURCE_PRIMARY_KEY = {
    "sale_order_header_extend": "sale_order_id",
    "sale_order_additional_matter": "id",
    "claim_order": "id",
}

# 清理来源打标时需要同时清空 bms_billed_at 的表。
SOURCE_CLEAR_BILLED_AT = {"claim_order": True}


def parse_args():
    script_dir = Path(__file__).resolve().parent
    default_env = script_dir.parent / "deployment" / "env.md"
    parser = argparse.ArgumentParser(
        description="清理一个 MEMBER_AR 应收或 COD_REFUND 返款账单生成任务的数据（v2，按来源轨迹恢复源表打标）；"
                    "不加 --execute 时只做只读预览。"
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
        help="执行清理时必须填写完整主任务 task_no，防止误删其他任务",
    )
    parser.add_argument(
        "--include-related-tasks",
        action="store_true",
        help="同一账单还被其他生成任务写入时，把相关任务一并纳入本次清理；省略时保持拦截",
    )
    parser.add_argument("--host", help="覆盖数据库地址（默认读 env.md）")
    parser.add_argument("--port", type=int, help="覆盖数据库端口（默认读 env.md）")
    parser.add_argument("--user", help="覆盖数据库账号（默认读 env.md）")
    parser.add_argument("--password", help="覆盖数据库密码（默认读 env.md）")
    return parser.parse_args()


def read_connection(env_path, timeout=3000, overrides=None):
    text = env_path.read_text(encoding="utf-8")
    jdbc = re.search(r"jdbc:mysql://([^:/\s]+):(\d+)", text)
    user = re.search(r"账号[：:]\s*([^\s`]+)", text)
    password = re.search(r"密码[：:]\s*([^\s`]+)", text)
    if not jdbc or not user or not password:
        raise ValueError("无法从 env.md 解析数据库地址、账号或密码")
    conn = {
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
    for key in ("host", "port", "user", "password"):
        if overrides and overrides.get(key) is not None:
            conn[key] = overrides[key]
    return conn


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


def load_tasks_by_ids(cursor, task_ids):
    if not task_ids:
        return []
    ids_sql, ids_args = in_clause(sorted(task_ids))
    return fetch_all(
        cursor,
        "SELECT id, task_no, bill_type, task_status, data_pull_type, bill_config_id, "
        "sc_id, shop_id, user_id, member_code, "
        "billing_period_start_date, billing_period_end_date, created_at, order_source_sql "
        "FROM bill_generate_task WHERE id IN (" + ids_sql + ")",
        ids_args,
    )


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


def expand_shared_scope(cursor, tasks, bills):
    """把与目标账单/任务互有数据写入的其他任务及账单一并纳入清理范围。"""
    changed = True
    while changed:
        changed = False
        task_ids = {t["id"] for t in tasks}
        bill_ids = {b["id"] for b in bills}
        for table in ("fee_detail", "main_order", "bill_source_collect_mark"):
            if not bill_ids:
                break
            ids_sql, ids_args = in_clause(bill_ids)
            rows = fetch_all(
                cursor,
                f"SELECT DISTINCT generate_task_id FROM {table} "
                f"WHERE bill_id IN ({ids_sql}) AND generate_task_id IS NOT NULL",
                ids_args,
            )
            new_task_ids = {r["generate_task_id"] for r in rows} - task_ids
            if new_task_ids:
                tasks.extend(load_tasks_by_ids(cursor, new_task_ids))
                changed = True
        task_ids = {t["id"] for t in tasks}
        for table in ("fee_detail", "main_order", "bill_source_collect_mark"):
            if not task_ids:
                break
            ids_sql, ids_args = in_clause(task_ids)
            rows = fetch_all(
                cursor,
                f"SELECT DISTINCT bill_id FROM {table} "
                f"WHERE generate_task_id IN ({ids_sql}) AND bill_id IS NOT NULL",
                ids_args,
            )
            new_bill_ids = {r["bill_id"] for r in rows} - bill_ids
            if new_bill_ids:
                bill_sql, bill_args = in_clause(new_bill_ids)
                new_bills = fetch_all(
                    cursor,
                    "SELECT DISTINCT b.id, b.bill_no, b.bill_status, b.generate_task_id, "
                    "b.paid_amount, b.paid_amount_fin "
                    "FROM ar_bill b WHERE b.id IN (" + bill_sql + ")",
                    bill_args,
                )
                bills.extend(new_bills)
                changed = True
    seen_task_ids = set()
    seen_bill_ids = set()
    tasks = [t for t in tasks if not (t["id"] in seen_task_ids or seen_task_ids.add(t["id"]))]
    bills = [b for b in bills if not (b["id"] in seen_bill_ids or seen_bill_ids.add(b["id"]))]
    return tasks, sorted(bills, key=lambda b: b["id"])


def load_scope(cursor, task_id, lock=False, include_related=False):
    lock_sql = " FOR UPDATE" if lock else ""
    task = fetch_one(
        cursor,
        "SELECT id, task_no, bill_type, task_status, data_pull_type, bill_config_id, "
        "sc_id, shop_id, user_id, member_code, "
        "billing_period_start_date, billing_period_end_date, created_at, order_source_sql "
        "FROM bill_generate_task WHERE id = %s" + lock_sql,
        (task_id,),
    )
    if not task:
        raise ValueError(f"账单生成任务不存在：{task_id}")
    if task["bill_type"] not in ALLOWED_BILL_TYPES:
        raise ValueError(
            f"仅允许清理 {sorted(ALLOWED_BILL_TYPES)} 类型任务，当前类型：{task['bill_type']}"
        )

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
    tasks = [task]
    if include_related:
        tasks, bills = expand_shared_scope(cursor, tasks, bills)
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

    task_ids = [t["id"] for t in tasks]
    task_id_sql, task_id_args = in_clause(task_ids)
    mark_where = f"generate_task_id IN ({task_id_sql})"
    if bill_ids:
        mark_where += f" OR bill_id IN ({bill_id_sql})"
    marks = fetch_all(
        cursor,
        "SELECT id, source_system, source_database, source_table, source_id, bill_no, "
        "bill_type, collect_type, mark_status "
        f"FROM bill_source_collect_mark WHERE {mark_where} ORDER BY id",
        task_id_args + bill_id_args,
    )
    return task, tasks, bills, marks, bill_ids, bill_nos


def validate_scope(cursor, tasks, bills, marks, bill_ids, bill_nos, include_related=False):
    errors = []
    primary = tasks[0]
    task_ids = {t["id"] for t in tasks}
    tid_sql, tid_args = in_clause(sorted(task_ids))
    bill_type = primary["bill_type"]
    for t in tasks:
        if t["task_status"] not in ALLOWED_TASK_STATUSES:
            errors.append(
                f"任务 {t['id']} 状态 {t['task_status']} 不允许清理；请先确保执行器不再处理该任务"
            )
        if t["bill_type"] != bill_type:
            errors.append(
                f"任务 {t['id']} 的账单类型 {t['bill_type']} 与主任务 {bill_type} 不一致，不能一并清理"
            )

    for bill in bills:
        if bill["generate_task_id"] not in task_ids:
            errors.append(
                f"账单 {bill['bill_no']} 属于任务 {bill['generate_task_id']}，未纳入本次清理任务集合，无法安全整单回滚"
            )
        if bill["bill_status"] not in ALLOWED_BILL_STATUSES[bill_type]:
            errors.append(f"账单 {bill['bill_no']} 状态为 {bill['bill_status']}，不允许调试清理")
        if (bill["paid_amount"] or 0) != 0 or (bill["paid_amount_fin"] or 0) != 0:
            errors.append(f"账单 {bill['bill_no']} 已产生核销/返款金额")

    unknown_tables = sorted({m["source_table"] for m in marks} - KNOWN_SOURCE_TABLES)
    if unknown_tables:
        errors.append("存在尚未支持回退标记的来源表：" + ", ".join(unknown_tables))

    for mark in marks:
        if mark.get("bill_type") and mark["bill_type"] != bill_type:
            errors.append(
                f"轨迹 {mark['id']} 的账单类型 {mark['bill_type']} 与任务 {bill_type} 不一致，不能清理"
            )
        source_db = mark.get("source_database") or SOURCE_DB
        if source_db not in ALLOWED_SOURCE_DATABASES:
            errors.append(f"轨迹 {mark['id']} 的来源库 {source_db} 不在允许清单内")

    if bill_ids:
        ids_sql, ids_args = in_clause(bill_ids)
        foreign_fee_rows = fetch_all(
            cursor,
            f"SELECT generate_task_id, COUNT(*) cnt FROM fee_detail "
            f"WHERE bill_id IN ({ids_sql}) "
            f"AND (generate_task_id IS NULL OR generate_task_id NOT IN ({tid_sql})) "
            "GROUP BY generate_task_id",
            ids_args + tid_args,
        )
        foreign_order_rows = fetch_all(
            cursor,
            f"SELECT generate_task_id, COUNT(*) cnt FROM main_order "
            f"WHERE bill_id IN ({ids_sql}) "
            f"AND (generate_task_id IS NULL OR generate_task_id NOT IN ({tid_sql})) "
            "GROUP BY generate_task_id",
            ids_args + tid_args,
        )
        manual_fees = sum(r["cnt"] for r in foreign_fee_rows if r["generate_task_id"] is None)
        manual_orders = sum(r["cnt"] for r in foreign_order_rows if r["generate_task_id"] is None)
        other_fee_rows = [r for r in foreign_fee_rows if r["generate_task_id"] is not None]
        other_order_rows = [r for r in foreign_order_rows if r["generate_task_id"] is not None]
        if not include_related:
            for row in other_fee_rows:
                errors.append(
                    f"目标账单含 {row['cnt']} 条费用属于其他任务 {row['generate_task_id']}，"
                    "需加 --include-related-tasks 一并清理"
                )
            for row in other_order_rows:
                errors.append(
                    f"目标账单含 {row['cnt']} 条订单快照属于其他任务 {row['generate_task_id']}，"
                    "需加 --include-related-tasks 一并清理"
                )
        else:
            for row in other_fee_rows + other_order_rows:
                errors.append(
                    f"目标账单含 {row['cnt']} 条数据属于未纳入的任务 {row['generate_task_id']}，"
                    "无法安全整单回滚"
                )
        if manual_fees:
            errors.append(
                f"目标账单含 {manual_fees} 条无任务归属费用（手工费用），脚本不会自动删除，需先人工处理"
            )
        if manual_orders:
            errors.append(
                f"目标账单含 {manual_orders} 条无任务归属订单快照，脚本不会自动删除，需先人工处理"
            )
        external = scalar(
            cursor,
            f"SELECT COUNT(*) FROM fee_detail WHERE related_bill_id IN ({ids_sql}) "
            f"AND (generate_task_id IS NULL OR generate_task_id NOT IN ({tid_sql}))",
            ids_args + tid_args,
        )
        if external:
            errors.append(f"存在 {external} 条外部费用挂靠到目标账单，需先解除关联")

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

    task_fee_ids = fetch_all(
        cursor,
        f"SELECT id FROM fee_detail WHERE generate_task_id IN ({tid_sql})",
        tid_args,
    )
    if task_fee_ids:
        fee_ids = [row["id"] for row in task_fee_ids]
        fee_sql, fee_args = in_clause(fee_ids)
        derived = scalar(
            cursor,
            f"SELECT COUNT(*) FROM fee_detail WHERE original_fee_id IN ({fee_sql}) "
            f"AND (generate_task_id IS NULL OR generate_task_id NOT IN ({tid_sql}))",
            fee_args + tid_args,
        )
        if derived:
            errors.append(f"本任务费用已派生出 {derived} 条红冲/调账费用")
    return errors


def mark_source_key(mark):
    """返回来源轨迹的唯一标识：(来源库, 来源表, 来源ID)。"""
    return (mark.get("source_database") or SOURCE_DB, mark["source_table"], mark["source_id"])


def plan_source_restore(cursor, marks):
    """按来源轨迹决定源表打标恢复动作。

    同一来源仍存在其他任务/账单类型的 MARKED 轨迹时保留源表标记，并刷新
    bms_bill_no 为仍占用轨迹的最近单号；无剩余 MARKED 轨迹时恢复未打标。

    Args:
        cursor: 数据库游标
        marks: 当前任务关联的来源轨迹列表

    Returns:
        恢复计划列表，每项包含来源库/表/ID、是否恢复、保留时使用的最近单号
    """
    if not marks:
        return []
    mark_ids = [m["id"] for m in marks]
    ids_sql, ids_args = in_clause(mark_ids)
    plan_by_key = {}
    for mark in marks:
        key = mark_source_key(mark)
        if key in plan_by_key:
            continue
        plan_by_key[key] = {
            "source_database": key[0],
            "source_table": key[1],
            "source_id": key[2],
            "id_column": SOURCE_PRIMARY_KEY.get(key[1]),
            "clear_billed_at": SOURCE_CLEAR_BILLED_AT.get(key[1], False),
            "source_system": mark.get("source_system"),
            "restore": False,
            "keep_bill_no": None,
        }
    for item in plan_by_key.values():
        if item["id_column"] is None:
            continue
        # 排除当前任务即将删除的轨迹，统计同来源仍被占用的MARKED轨迹数。
        remaining = scalar(
            cursor,
            "SELECT COUNT(*) FROM bill_source_collect_mark "
            "WHERE (source_system = %s OR %s IS NULL OR source_system IS NULL) "
            "AND (source_database = %s OR (source_database IS NULL AND %s IS NULL)) "
            "AND source_table = %s AND source_id = %s AND mark_status = 'MARKED' "
            f"AND id NOT IN ({ids_sql})",
            (item["source_system"], item["source_system"],
             item["source_database"], item["source_database"],
             item["source_table"], item["source_id"]) + ids_args,
        )
        item["restore"] = remaining == 0
        if item["restore"]:
            continue
        keep = fetch_one(
            cursor,
            "SELECT bill_no FROM bill_source_collect_mark "
            "WHERE (source_system = %s OR %s IS NULL OR source_system IS NULL) "
            "AND (source_database = %s OR (source_database IS NULL AND %s IS NULL)) "
            "AND source_table = %s AND source_id = %s AND mark_status = 'MARKED' "
            f"AND id NOT IN ({ids_sql}) ORDER BY id DESC LIMIT 1",
            (item["source_system"], item["source_system"],
             item["source_database"], item["source_database"],
             item["source_table"], item["source_id"]) + ids_args,
        )
        item["keep_bill_no"] = keep["bill_no"] if keep else None
    return [item for item in plan_by_key.values() if item["id_column"] is not None]


def preview(cursor, tasks, bills, marks, bill_ids):
    primary = tasks[0]
    task_ids = [t["id"] for t in tasks]
    tid_sql, tid_args = in_clause(task_ids)
    export_tasks = load_export_tasks(cursor, bill_ids)
    export_task_ids = [row["id"] for row in export_tasks]
    export_ids_sql, export_ids_args = in_clause(export_task_ids)
    restore_plan = plan_source_restore(cursor, marks)
    counts = {
        "ar_bill": len(bills),
        "fee_detail": scalar(
            cursor, f"SELECT COUNT(*) FROM fee_detail WHERE generate_task_id IN ({tid_sql})", tid_args
        ),
        "main_order": scalar(
            cursor, f"SELECT COUNT(*) FROM main_order WHERE generate_task_id IN ({tid_sql})", tid_args
        ),
        "bill_source_collect_mark": len(marks),
        "bill_order_waybill_snapshot": scalar(
            cursor,
            "SELECT COUNT(*) FROM bill_order_waybill_snapshot s "
            "WHERE EXISTS (SELECT 1 FROM main_order m "
            f"WHERE m.id = s.main_order_id AND m.generate_task_id IN ({tid_sql}))",
            tid_args,
        ),
        "ar_bill_currency_summary": 0,
        "bill_exchange_rate": 0,
        "refund_receipt_rate_snapshot": 0,
        "refund_exchange_profit": 0,
        "bill_export_task": len(export_tasks),
        "bill_export_task_item": sum(row["target_item_count"] for row in export_tasks),
        "bill_export_notification": scalar(
            cursor,
            f"SELECT COUNT(*) FROM bill_export_notification WHERE task_id IN ({export_ids_sql})",
            export_ids_args,
        ) if export_task_ids else 0,
        "source_rows_to_restore": sum(1 for item in restore_plan if item["restore"]),
        "source_rows_keep_marked": sum(1 for item in restore_plan if not item["restore"]),
        "external_fee_links_to_clear": 0,
    }
    if bill_ids:
        ids_sql, ids_args = in_clause(bill_ids)
        counts["bill_order_waybill_snapshot"] = scalar(
            cursor,
            f"SELECT COUNT(*) FROM bill_order_waybill_snapshot s WHERE s.bill_id IN ({ids_sql}) "
            "OR EXISTS (SELECT 1 FROM main_order m "
            f"WHERE m.id = s.main_order_id AND m.generate_task_id IN ({tid_sql}))",
            ids_args + tid_args,
        )
        counts["ar_bill_currency_summary"] = scalar(
            cursor, f"SELECT COUNT(*) FROM ar_bill_currency_summary WHERE bill_id IN ({ids_sql})", ids_args
        )
        counts["bill_exchange_rate"] = scalar(
            cursor, f"SELECT COUNT(*) FROM bill_exchange_rate WHERE bill_id IN ({ids_sql})", ids_args
        )
        counts["refund_receipt_rate_snapshot"] = scalar(
            cursor, f"SELECT COUNT(*) FROM refund_receipt_rate_snapshot WHERE bill_id IN ({ids_sql})", ids_args
        )
        counts["refund_exchange_profit"] = scalar(
            cursor, f"SELECT COUNT(*) FROM refund_exchange_profit WHERE bill_id IN ({ids_sql})", ids_args
        )
        counts["external_fee_links_to_clear"] = scalar(
            cursor,
            f"SELECT COUNT(*) FROM fee_detail WHERE related_bill_id IN ({ids_sql}) "
            f"AND (generate_task_id IS NULL OR generate_task_id NOT IN ({tid_sql}))",
            ids_args + tid_args,
        )

    print(f"task: id={primary['id']}, no={primary['task_no']}, status={primary['task_status']}, "
          f"pull={primary['data_pull_type']}")
    for related in tasks[1:]:
        print(f"related task: id={related['id']}, no={related['task_no']}, "
              f"status={related['task_status']}, pull={related['data_pull_type']}")
    if bills:
        for bill in bills:
            print(f"bill: id={bill['id']}, no={bill['bill_no']}, status={bill['bill_status']}")
    else:
        print("bill: 本任务未生成账单")
    print("待处理数据：")
    for table, count in counts.items():
        print(f"  {table}: {count}")
    if restore_plan:
        print("来源打标恢复计划：")
        for index, item in enumerate(restore_plan):
            if index >= 50:
                print(f"  ... 其余 {len(restore_plan) - 50} 条来源略")
                break
            action = "恢复未打标" if item["restore"] else "保留已打标"
            line = f"  {item['source_database']}.{item['source_table']}#{item['source_id']} -> {action}"
            if not item["restore"]:
                line += f"，剩余单号={item['keep_bill_no']}"
            print(line)


def execute_cleanup(cursor, tasks, marks, bill_ids):
    task_ids = [t["id"] for t in tasks]
    tid_sql, tid_args = in_clause(task_ids)
    result = {}
    restore_plan = plan_source_restore(cursor, marks)

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

    for item in restore_plan:
        table = item["source_table"]
        source_db = item["source_database"]
        pk = item["id_column"]
        if item["restore"]:
            extra = ", bms_billed_at = NULL" if item["clear_billed_at"] else ""
            cursor.execute(
                f"UPDATE {source_db}.{table} SET bms_billed_flag = 0, bms_bill_no = NULL{extra} "
                f"WHERE {pk} = %s",
                (item["source_id"],),
            )
            result.setdefault(f"{source_db}.{table}.restored", 0)
            result[f"{source_db}.{table}.restored"] += cursor.rowcount
        else:
            cursor.execute(
                f"UPDATE {source_db}.{table} SET bms_bill_no = %s WHERE {pk} = %s",
                (item["keep_bill_no"], item["source_id"]),
            )
            result.setdefault(f"{source_db}.{table}.kept", 0)
            result[f"{source_db}.{table}.kept"] += cursor.rowcount

    for item in restore_plan:
        table = item["source_table"]
        source_db = item["source_database"]
        pk = item["id_column"]
        remaining_flag = scalar(
            cursor,
            f"SELECT COUNT(*) FROM {source_db}.{table} WHERE {pk} = %s AND bms_billed_flag = 1",
            (item["source_id"],),
        )
        if item["restore"] and remaining_flag:
            raise RuntimeError(
                f"{source_db}.{table}#{item['source_id']} 清理后 bms_billed_flag 仍为 1，事务已回滚"
            )
        if not item["restore"] and not remaining_flag:
            raise RuntimeError(
                f"{source_db}.{table}#{item['source_id']} 应保留已打标但 bms_billed_flag 为 0，事务已回滚"
            )

    snapshot_where = (
        "EXISTS (SELECT 1 FROM main_order m "
        f"WHERE m.id = bill_order_waybill_snapshot.main_order_id AND m.generate_task_id IN ({tid_sql}))"
    )
    snapshot_args = tid_args
    if bill_ids:
        ids_sql, ids_args = in_clause(bill_ids)
        cursor.execute(
            "UPDATE fee_detail SET related_bill_id = NULL, related_bill_no = NULL, related_bill_type = NULL, "
            "related_bill_config_id = NULL, related_settlement_role = NULL, related_business_order_no = NULL, "
            "related_bill_currency = NULL, related_amount_bill_currency = NULL, related_exchange_rate_to_bill = NULL, "
            "related_exchange_rate_level_to_bill = NULL, related_fin_currency = NULL, "
            "related_amount_fin_currency = NULL, related_exchange_rate_to_fin = NULL, "
            "related_exchange_rate_level_to_fin = NULL "
            f"WHERE related_bill_id IN ({ids_sql}) "
            f"AND (generate_task_id IS NULL OR generate_task_id NOT IN ({tid_sql}))",
            ids_args + tid_args,
        )
        result["fee_detail.external_links"] = cursor.rowcount

        snapshot_where = f"bill_id IN ({ids_sql}) OR " + snapshot_where
        snapshot_args = ids_args + snapshot_args
        for table in (
            "ar_bill_currency_summary",
            "bill_exchange_rate",
            "refund_receipt_rate_snapshot",
            "refund_exchange_profit",
        ):
            cursor.execute(f"DELETE FROM {table} WHERE bill_id IN ({ids_sql})", ids_args)
            result[table] = cursor.rowcount

    cursor.execute(f"DELETE FROM bill_order_waybill_snapshot WHERE {snapshot_where}", snapshot_args)
    result["bill_order_waybill_snapshot"] = cursor.rowcount

    cursor.execute(f"DELETE FROM fee_detail WHERE generate_task_id IN ({tid_sql})", tid_args)
    result["fee_detail"] = cursor.rowcount
    cursor.execute(f"DELETE FROM main_order WHERE generate_task_id IN ({tid_sql})", tid_args)
    result["main_order"] = cursor.rowcount

    mark_ids = [m["id"] for m in marks]
    if mark_ids:
        mark_sql, mark_args = in_clause(mark_ids)
        cursor.execute(f"DELETE FROM bill_source_collect_mark WHERE id IN ({mark_sql})", mark_args)
        result["bill_source_collect_mark"] = cursor.rowcount

    if bill_ids:
        bill_sql, bill_args = in_clause(bill_ids)
        cursor.execute(f"DELETE FROM ar_bill WHERE id IN ({bill_sql})", bill_args)
        result["ar_bill"] = cursor.rowcount
    else:
        result["ar_bill"] = 0
    cursor.execute(f"DELETE FROM bill_generate_task WHERE id IN ({tid_sql})", tid_args)
    if cursor.rowcount != len(task_ids):
        raise RuntimeError("删除任务记录失败，事务已回滚")
    result["bill_generate_task"] = cursor.rowcount
    return result


def main():
    args = parse_args()
    overrides = {
        "host": args.host,
        "port": args.port,
        "user": args.user,
        "password": args.password,
    }
    connection = pymysql.connect(**read_connection(args.env.resolve(), args.timeout, overrides))
    try:
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    "SET SESSION net_read_timeout = %s, net_write_timeout = %s",
                    (args.timeout, args.timeout),
                )
            except pymysql.MySQLError:
                pass
            task, tasks, bills, marks, bill_ids, bill_nos = load_scope(
                cursor, args.task_id, args.execute, args.include_related_tasks
            )
            errors = validate_scope(
                cursor, tasks, bills, marks, bill_ids, bill_nos, args.include_related_tasks
            )
            preview(cursor, tasks, bills, marks, bill_ids)
            if errors:
                print("\n安全检查未通过：", file=sys.stderr)
                for error in errors:
                    print(f"  - {error}", file=sys.stderr)
                connection.rollback()
                return 2
            if not args.execute:
                connection.rollback()
                print("\n当前为只读预览。确认无误后增加："
                      f" --execute --confirm-task-no {task['task_no']}"
                      + (" --include-related-tasks" if args.include_related_tasks else ""))
                return 0
            if args.confirm_task_no != task["task_no"]:
                connection.rollback()
                print("--confirm-task-no 与数据库中的完整任务号不一致，未执行清理", file=sys.stderr)
                return 2

            result = execute_cleanup(cursor, tasks, marks, bill_ids)
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


# > 查看清理数据
# python cleanup_ar_bill_task_v2.py --task-id 163
#
# > 执行清理
# python cleanup_ar_bill_task_v2.py --task-id 163 --execute --confirm-task-no BMS-TASK-20260815160936-82-1786781376647-78
#
# > 同一账单被多个增量任务写入时，先只读查看相关任务范围
# python cleanup_ar_bill_task_v2.py --task-id 163 --include-related-tasks
#
# > 确认相关任务后整单原子清理（会连同共享账单上的其他任务数据一起删除）
# python cleanup_ar_bill_task_v2.py --task-id 163 --include-related-tasks --execute --confirm-task-no BMS-TASK-20260815160936-82-1786781376647-78
