-- MariaDB: 직접 등록(user) vs 네이버 지역검색 수입(naver) 구분
-- 한 번만 실행합니다. 이미 컬럼이 있으면 건너뜁니다.
--
-- [신규 DB] `sql/schema_mariadb.sql` 만 실행했다면 이 파일은 **실행할 필요 없음**.
-- VARCHAR 길이는 `schema_mariadb.sql` 과 동일하게 100.

ALTER TABLE restaurants
  ADD COLUMN `source` VARCHAR(100) NOT NULL DEFAULT 'user'
    COMMENT '출처: user=직접등록, naver=네이버 등'
    AFTER `memo`;
