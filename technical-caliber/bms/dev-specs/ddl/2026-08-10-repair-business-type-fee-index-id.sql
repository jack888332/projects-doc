-- ============================================================
-- Repair business_type_fee_index association fields.
-- Part 1: fee_source_rule_id = fee_source_rule.id by fee_code
-- Part 2: fee_index_id = fee_index.id by fee_code
--
-- Order matters: FEE0056 currently reuses FEE0007's
-- fee_source_rule_id=56. Repairing fee_source_rule_id first
-- avoids uk_business_fee_rule conflicts when fee_index_id is
-- repaired afterwards.
-- ============================================================
USE tmall_bms;

-- 1. Backup before any change.
DROP TABLE IF EXISTS `business_type_fee_index_bak_20260810`;
CREATE TABLE `business_type_fee_index_bak_20260810` LIKE `business_type_fee_index`;
INSERT INTO `business_type_fee_index_bak_20260810`
SELECT * FROM `business_type_fee_index`;

-- 2. Pre-check: fee_source_rule_id does not match fee_source_rule.id.
SELECT
    btfi.id,
    btfi.business_type_code,
    btfi.fee_code,
    btfi.fee_name,
    btfi.fee_source_rule_id AS current_fee_source_rule_id,
    fsr.id AS expected_fee_source_rule_id
FROM `business_type_fee_index` btfi
LEFT JOIN `fee_source_rule` fsr ON fsr.fee_code = btfi.fee_code
WHERE btfi.fee_source_rule_id <> fsr.id OR fsr.id IS NULL
ORDER BY btfi.business_type_code, btfi.fee_code, btfi.id;

-- 3. Pre-check: fee_index_id does not match fee_index.id.
SELECT
    btfi.id,
    btfi.business_type_code,
    btfi.fee_code,
    btfi.fee_name,
    btfi.fee_index_id AS current_fee_index_id,
    fi.id AS expected_fee_index_id
FROM `business_type_fee_index` btfi
LEFT JOIN `fee_index` fi ON fi.fee_code = btfi.fee_code
WHERE btfi.fee_index_id <> fi.id OR fi.id IS NULL
ORDER BY btfi.business_type_code, btfi.fee_code, btfi.id;

-- 4. Guard: fee_source_rule.fee_code must be unique.
SELECT
    fee_code,
    COUNT(*) AS duplicate_count
FROM `fee_source_rule`
GROUP BY fee_code
HAVING COUNT(*) > 1;

SET @duplicate_fsr_fee_code_count := (
    SELECT COUNT(*)
    FROM (
        SELECT fee_code
        FROM `fee_source_rule`
        GROUP BY fee_code
        HAVING COUNT(*) > 1
    ) duplicate_fsr_fee_code
);

-- 5. Guard: fee_index.fee_code must be unique.
SELECT
    fee_code,
    COUNT(*) AS duplicate_count
FROM `fee_index`
GROUP BY fee_code
HAVING COUNT(*) > 1;

SET @duplicate_fee_index_fee_code_count := (
    SELECT COUNT(*)
    FROM (
        SELECT fee_code
        FROM `fee_index`
        GROUP BY fee_code
        HAVING COUNT(*) > 1
    ) duplicate_fee_index_fee_code
);

-- 6. Guard: every business_type_fee_index.fee_code must exist in
-- fee_source_rule and fee_index.
SET @unmatched_fsr_fee_code_count := (
    SELECT COUNT(*)
    FROM `business_type_fee_index` btfi
    LEFT JOIN `fee_source_rule` fsr ON fsr.fee_code = btfi.fee_code
    WHERE fsr.id IS NULL
);

SET @unmatched_fee_index_fee_code_count := (
    SELECT COUNT(*)
    FROM `business_type_fee_index` btfi
    LEFT JOIN `fee_index` fi ON fi.fee_code = btfi.fee_code
    WHERE fi.id IS NULL
);

-- 7. Guard: fee_source_rule_id repair must not occupy an existing
-- (business_type_code, fee_index_id, fee_source_rule_id) key.
SET @occupied_fsr_target_conflict_count := (
    SELECT COUNT(*)
    FROM `business_type_fee_index` btfi
    JOIN `fee_source_rule` fsr ON fsr.fee_code = btfi.fee_code
    JOIN `business_type_fee_index` existing
      ON existing.business_type_code = btfi.business_type_code
     AND existing.fee_index_id = btfi.fee_index_id
     AND existing.fee_source_rule_id = fsr.id
     AND existing.id <> btfi.id
    WHERE btfi.fee_source_rule_id <> fsr.id
);

SET @projected_fsr_duplicate_count := (
    SELECT COUNT(*)
    FROM (
        SELECT
            btfi.business_type_code,
            btfi.fee_index_id,
            fsr.id AS fee_source_rule_id
        FROM `business_type_fee_index` btfi
        JOIN `fee_source_rule` fsr ON fsr.fee_code = btfi.fee_code
        GROUP BY btfi.business_type_code, btfi.fee_index_id, fsr.id
        HAVING COUNT(*) > 1
    ) duplicate_after_fsr_repair
);

SET @fsr_repair_enabled := IF(
    @duplicate_fsr_fee_code_count = 0
    AND @unmatched_fsr_fee_code_count = 0
    AND @occupied_fsr_target_conflict_count = 0
    AND @projected_fsr_duplicate_count = 0,
    1,
    0
);

SELECT
    @duplicate_fsr_fee_code_count AS duplicate_fsr_fee_code_count,
    @unmatched_fsr_fee_code_count AS unmatched_fsr_fee_code_count,
    @occupied_fsr_target_conflict_count AS occupied_fsr_target_conflict_count,
    @projected_fsr_duplicate_count AS projected_fsr_duplicate_count,
    @fsr_repair_enabled AS fsr_repair_enabled;

-- 8. Repair fee_source_rule_id first.
START TRANSACTION;

UPDATE `business_type_fee_index` btfi
JOIN `fee_source_rule` fsr ON fsr.fee_code = btfi.fee_code
SET btfi.fee_source_rule_id = fsr.id
WHERE btfi.fee_source_rule_id <> fsr.id
  AND @fsr_repair_enabled = 1;

SET @repaired_fsr_row_count := ROW_COUNT();

COMMIT;

-- 9. Recompute fee_index_id repair guards AFTER fee_source_rule_id is
-- repaired, otherwise FEE0007 and FEE0056 still conflict.
SET @occupied_fee_index_target_conflict_count := (
    SELECT COUNT(*)
    FROM `business_type_fee_index` btfi
    JOIN `fee_index` fi ON fi.fee_code = btfi.fee_code
    JOIN `business_type_fee_index` existing
      ON existing.business_type_code = btfi.business_type_code
     AND existing.fee_index_id = fi.id
     AND existing.fee_source_rule_id = btfi.fee_source_rule_id
     AND existing.id <> btfi.id
    WHERE btfi.fee_index_id <> fi.id
);

SET @projected_fee_index_duplicate_count := (
    SELECT COUNT(*)
    FROM (
        SELECT
            btfi.business_type_code,
            fi.id AS fee_index_id,
            btfi.fee_source_rule_id
        FROM `business_type_fee_index` btfi
        JOIN `fee_index` fi ON fi.fee_code = btfi.fee_code
        GROUP BY btfi.business_type_code, fi.id, btfi.fee_source_rule_id
        HAVING COUNT(*) > 1
    ) duplicate_after_fee_index_repair
);

SET @fee_index_repair_enabled := IF(
    @duplicate_fee_index_fee_code_count = 0
    AND @unmatched_fee_index_fee_code_count = 0
    AND @occupied_fee_index_target_conflict_count = 0
    AND @projected_fee_index_duplicate_count = 0,
    1,
    0
);

SELECT
    @occupied_fee_index_target_conflict_count AS occupied_fee_index_target_conflict_count,
    @projected_fee_index_duplicate_count AS projected_fee_index_duplicate_count,
    @fee_index_repair_enabled AS fee_index_repair_enabled;

-- 10. Repair fee_index_id.
START TRANSACTION;

UPDATE `business_type_fee_index` btfi
JOIN `fee_index` fi ON fi.fee_code = btfi.fee_code
SET btfi.fee_index_id = fi.id
WHERE btfi.fee_index_id <> fi.id
  AND @fee_index_repair_enabled = 1;

SET @repaired_fee_index_row_count := ROW_COUNT();

COMMIT;

SELECT
    CASE
        WHEN @fsr_repair_enabled = 0 THEN 'SKIPPED: resolve fee_source_rule_id conflicts first'
        WHEN @fee_index_repair_enabled = 0 THEN 'SKIPPED: resolve fee_index_id conflicts first'
        ELSE 'SUCCESS'
    END AS status,
    @repaired_fsr_row_count AS repaired_fsr_row_count,
    @repaired_fee_index_row_count AS repaired_fee_index_row_count;

-- 11. Post-check: fee_source_rule_id mismatches should be 0.
SELECT COUNT(*) AS remaining_fsr_mismatch_count
FROM `business_type_fee_index` btfi
JOIN `fee_source_rule` fsr ON fsr.fee_code = btfi.fee_code
WHERE btfi.fee_source_rule_id <> fsr.id;

-- 12. Post-check: fee_index_id mismatches should be 0.
SELECT COUNT(*) AS remaining_fee_index_mismatch_count
FROM `business_type_fee_index` btfi
JOIN `fee_index` fi ON fi.fee_code = btfi.fee_code
WHERE btfi.fee_index_id <> fi.id;

-- 13. Post-check: orphan fee_index_id should be 0.
SELECT COUNT(*) AS orphan_count
FROM `business_type_fee_index` btfi
LEFT JOIN `fee_index` fi ON fi.id = btfi.fee_index_id
WHERE fi.id IS NULL;

-- 14. Spot-check key fee codes after repair.
SELECT
    btfi.id,
    btfi.business_type_code,
    btfi.fee_code,
    btfi.fee_name,
    btfi.fee_index_id,
    fi.id AS expected_fee_index_id,
    btfi.fee_source_rule_id,
    fsr.id AS expected_fee_source_rule_id
FROM `business_type_fee_index` btfi
LEFT JOIN `fee_index` fi ON fi.fee_code = btfi.fee_code
LEFT JOIN `fee_source_rule` fsr ON fsr.fee_code = btfi.fee_code
WHERE btfi.fee_code IN ('FEE0007', 'FEE0017', 'FEE0018', 'FEE0028', 'FEE0056')
ORDER BY btfi.fee_code, btfi.id;

-- Rollback if needed:
-- DROP TABLE IF EXISTS `business_type_fee_index`;
-- RENAME TABLE `business_type_fee_index_bak_20260810` TO `business_type_fee_index`;
