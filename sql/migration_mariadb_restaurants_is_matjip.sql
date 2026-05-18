-- MariaDB: 사용자가 지정한 «맛집» 표시 (0/1)
-- 한 번만 실행합니다. 이미 컬럼이 있으면 건너뜁니다.
--
-- [신규 DB] `sql/schema_mariadb.sql` 만 실행했다면 이 파일은 **실행할 필요 없음**.

ALTER TABLE restaurants
  ADD COLUMN `is_matjip` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=맛집으로 표시'
    AFTER `rating`;
