-- MariaDB: 목록에서 “직접 추가·저장한” 행을 위로 올리기 위한 타임스탬프
-- 한 번만 실행합니다. 이미 컬럼이 있으면 건너뜁니다.
--
-- [신규 DB] `sql/schema_mariadb.sql` 만 실행했다면 이 파일은 **실행할 필요 없음**.
-- ※ `source` 컬럼이 있어야 UPDATE 조건이 동작합니다(`migration_mariadb_restaurants_source.sql` 선행).
--
-- - 네이버 수입 행: NULL → 한 번도 저장하지 않은 순수 수입은 목록 아래쪽
-- - PUT 저장 시: 서버가 NOW() 로 갱신 (`source` 는 naver 그대로 둘 수 있음)
-- - 직접 추가(`source=user`) 기존 행: `created_at` 으로 한 번 채워 목록이 아래로 가지 않게 함

ALTER TABLE restaurants
  ADD COLUMN `user_touched_at` DATETIME NULL DEFAULT NULL
    COMMENT '웹에서 추가(POST) 또는 저장(PUT)한 시각'
    AFTER `created_at`;

UPDATE restaurants
SET user_touched_at = created_at
WHERE IFNULL(source, '') = 'user' AND user_touched_at IS NULL;
