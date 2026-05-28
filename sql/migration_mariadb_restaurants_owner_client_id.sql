-- MariaDB: 로그인 없이 브라우저별로 직접 등록한 맛집 소유자를 구분합니다.
-- [신규 DB] `sql/schema_mariadb.sql` 만 실행했다면 이 파일은 **실행할 필요 없음**.

ALTER TABLE `restaurants`
  ADD COLUMN `owner_client_id` CHAR(36) NULL
    COMMENT '로그인 없이 브라우저별 소유 구분(UUID v4). naver 공통 데이터는 NULL'
    AFTER `source`;

CREATE INDEX `idx_owner_client_id` ON `restaurants` (`owner_client_id`);
