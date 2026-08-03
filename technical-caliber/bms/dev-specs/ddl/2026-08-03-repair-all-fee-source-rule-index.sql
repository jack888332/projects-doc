-- 全量修复 fee_source_rule.fee_index_id。
-- 关联依据：fee_source_rule.fee_code = fee_index.fee_code。
-- 不修改 fee_code 无法匹配的记录；发现唯一键冲突时整批跳过更新。

USE tmall_bms;

-- 修复前：查看所有 fee_index_id 不一致的数据。
SELECT
    fsr.id AS fee_source_rule_id,
    fsr.fee_code,
    fsr.fee_index_id AS current_fee_index_id,
    fi.id AS expected_fee_index_id,
    fsr.source_system,
    fsr.source_database,
    fsr.source_table,
    fsr.source_amount_column
FROM fee_source_rule fsr
JOIN fee_index fi ON fi.fee_code = fsr.fee_code
WHERE fsr.fee_index_id <> fi.id
ORDER BY fsr.fee_code, fsr.id;

-- 无法通过 fee_code 找到费项索引的规则：本脚本不会修改这些记录。
SELECT
    fsr.id AS fee_source_rule_id,
    fsr.fee_code,
    fsr.fee_index_id
FROM fee_source_rule fsr
LEFT JOIN fee_index fi ON fi.fee_code = fsr.fee_code
WHERE fi.id IS NULL
ORDER BY fsr.fee_code, fsr.id;

SET @unmatched_fee_code_count := (
    SELECT COUNT(*)
    FROM fee_source_rule fsr
    LEFT JOIN fee_index fi ON fi.fee_code = fsr.fee_code
    WHERE fi.id IS NULL
);

-- 冲突检查一：目标 fee_index_id 已被相同来源规则占用。
SELECT
    fsr.id AS repair_rule_id,
    fsr.fee_code,
    fsr.fee_index_id AS current_fee_index_id,
    fi.id AS expected_fee_index_id,
    existing_rule.id AS conflicting_rule_id
FROM fee_source_rule fsr
JOIN fee_index fi ON fi.fee_code = fsr.fee_code
JOIN fee_source_rule existing_rule
  ON existing_rule.fee_index_id = fi.id
 AND existing_rule.id <> fsr.id
 AND existing_rule.source_system = fsr.source_system
 AND existing_rule.source_database <=> fsr.source_database
 AND existing_rule.source_table = fsr.source_table
 AND existing_rule.source_amount_column = fsr.source_amount_column
WHERE fsr.fee_index_id <> fi.id
ORDER BY fsr.fee_code, fsr.id;

SET @occupied_target_conflict_count := (
    SELECT COUNT(*)
    FROM fee_source_rule fsr
    JOIN fee_index fi ON fi.fee_code = fsr.fee_code
    JOIN fee_source_rule existing_rule
      ON existing_rule.fee_index_id = fi.id
     AND existing_rule.id <> fsr.id
     AND existing_rule.source_system = fsr.source_system
     AND existing_rule.source_database <=> fsr.source_database
     AND existing_rule.source_table = fsr.source_table
     AND existing_rule.source_amount_column = fsr.source_amount_column
    WHERE fsr.fee_index_id <> fi.id
);

-- 冲突检查二：多条规则修复后将形成相同的来源唯一键。
SET @projected_duplicate_count := (
    SELECT COUNT(*)
    FROM (
        SELECT
            fi.id,
            fsr.source_system,
            fsr.source_database,
            fsr.source_table,
            fsr.source_amount_column
        FROM fee_source_rule fsr
        JOIN fee_index fi ON fi.fee_code = fsr.fee_code
        GROUP BY
            fi.id,
            fsr.source_system,
            fsr.source_database,
            fsr.source_table,
            fsr.source_amount_column
        HAVING COUNT(*) > 1
    ) duplicate_source_rule
);

START TRANSACTION;

UPDATE fee_source_rule fsr
JOIN fee_index fi ON fi.fee_code = fsr.fee_code
SET fsr.fee_index_id = fi.id
WHERE fsr.fee_index_id <> fi.id
  AND @occupied_target_conflict_count = 0
  AND @projected_duplicate_count = 0;

SET @repaired_row_count := ROW_COUNT();

COMMIT;

SELECT
    CASE
        WHEN @occupied_target_conflict_count > 0
          OR @projected_duplicate_count > 0
            THEN 'SKIPPED: 修复后会产生 uk_fee_source 唯一键冲突'
        WHEN @unmatched_fee_code_count > 0
            THEN 'SUCCESS_WITH_UNMATCHED_FEE_CODE'
        ELSE 'SUCCESS'
    END AS status,
    @occupied_target_conflict_count AS occupied_target_conflict_count,
    @projected_duplicate_count AS projected_duplicate_count,
    @unmatched_fee_code_count AS unmatched_fee_code_count,
    @repaired_row_count AS repaired_row_count;

-- 修复后核验：matched_mismatch_count 预期为 0。
SELECT COUNT(*) AS matched_mismatch_count
FROM fee_source_rule fsr
JOIN fee_index fi ON fi.fee_code = fsr.fee_code
WHERE fsr.fee_index_id <> fi.id;

-- 最终关联核验。
SELECT
    fsr.id AS fee_source_rule_id,
    fsr.fee_code,
    fsr.fee_index_id,
    fi.id AS expected_fee_index_id,
    fi.fee_name,
    fsr.source_table,
    fsr.source_amount_column,
    fsr.enabled
FROM fee_source_rule fsr
LEFT JOIN fee_index fi ON fi.fee_code = fsr.fee_code
WHERE fi.id IS NULL OR fsr.fee_index_id <> fi.id
ORDER BY fsr.fee_code, fsr.id;
