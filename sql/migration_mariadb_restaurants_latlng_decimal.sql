-- MariaDB: `latitude` / `longitude` 가 INT·TINYINT 등이면 소수가 잘려 37, 127 처럼만 저장됩니다.
-- `DECIMAL(10,7)` 로 바꾼 뒤 네이버 재수입(`npm run import:naver` 또는 화면「주변 식당 최신화」)을 다시 실행하세요.
--
-- [신규 DB] `sql/schema_mariadb.sql` 로 테이블을 만들었다면 이 파일은 **실행할 필요 없음**
-- (이미 DECIMAL 및 주석이 맞춰져 있음).

ALTER TABLE `restaurants`
  MODIFY COLUMN `latitude` DECIMAL(10,7) DEFAULT NULL COMMENT '식당 위도(WGS84, 네이버 mapy÷1e7)',
  MODIFY COLUMN `longitude` DECIMAL(10,7) DEFAULT NULL COMMENT '식당 경도(WGS84, 네이버 mapx÷1e7)',
  MODIFY COLUMN `distance_meters` INT UNSIGNED DEFAULT NULL COMMENT 'NAVER_REFERENCE_* 기준 직선거리(m)';
