-- MariaDB: 맛집 별점 (1~5점, 비어 있으면 NULL)
-- 한 번만 실행합니다. 이미 컬럼이 있으면 건너뜁니다.
--
-- [신규 DB] `sql/schema_mariadb.sql` 만 실행했다면 이 파일은 **실행할 필요 없음**.

ALTER TABLE restaurants
  ADD COLUMN `rating` TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT '별점 1~5, NULL=미등록'
    AFTER `memo`;
