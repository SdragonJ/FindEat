-- FindEat_CURSOR — MariaDB / MySQL 8+ 초기 스키마 (**기본 구조의 기준본**)
--
-- ┌───────────────────────────────────────────────────────────────────────────
-- │ 신규 DB (테이블이 없거나 처음부터 맞출 때)
-- │   ① 아래 `USE` 줄의 DB 이름을 `.env` 의 DB_NAME 과 같게 바꾸거나,
-- │     이미 만든 빈 DB에 연결한 뒤
-- │   ② 이 파일만 실행합니다.
-- │   → `restaurants` 가 아래 `migration_mariadb_*.sql` 을 **모두 거친 것과 동일한**
-- │     최종 컬럼·타입·인덱스로 만들어집니다.
-- │   → 이 경우 **`sql/migration_mariadb_*.sql` 은 실행하지 않습니다.**
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌───────────────────────────────────────────────────────────────────────────
-- │ 기존 DB (예전 DDL 로 만든 `restaurants` 에 컬럼이 하나씩 없을 때)
-- │   빠진 것부터 아래 순서대로 실행합니다. 이미 있는 컬럼이면 해당 파일은 건너뜁니다.
-- │   1. migration_mariadb_restaurants_source.sql      (`user_touched_at` 의 UPDATE 가 source 필요)
-- │   2. migration_mariadb_restaurants_rating.sql
-- │   3. migration_mariadb_restaurants_is_matjip.sql
-- │   4. migration_mariadb_restaurants_user_touched_at.sql
-- │   5. latitude/longitude 가 정수형이라 37·127 만 들어가면:
-- │      migration_mariadb_restaurants_latlng_decimal.sql
-- │   6. 로그인 없이 브라우저별 소유 구분이 필요하면:
-- │      migration_mariadb_restaurants_owner_client_id.sql
-- └───────────────────────────────────────────────────────────────────────────
--
-- SQL Server 참고본(컬럼 의미 동일 유지): `sql/schema.sql`

CREATE DATABASE IF NOT EXISTS `terp_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `terp_db`;

CREATE TABLE `restaurants` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '기본키',
  `name` varchar(120) NOT NULL COMMENT '맛집 이름',
  `category` varchar(40) NOT NULL DEFAULT '기타' COMMENT '카테고리',
  `address` varchar(255) DEFAULT NULL COMMENT '주소',
  `walk_minutes` tinyint(3) unsigned DEFAULT NULL COMMENT '도보 시간(분)',
  `memo` varchar(500) DEFAULT NULL COMMENT '메모',
  `rating` tinyint(3) unsigned DEFAULT NULL COMMENT '별점 1~5, NULL=미등록',
  `is_matjip` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=맛집으로 표시',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT '등록일시',
  `user_touched_at` datetime DEFAULT NULL COMMENT '웹에서 추가(POST) 또는 저장(PUT)한 시각',
  `latitude` decimal(10,7) DEFAULT NULL COMMENT '식당 위도(WGS84, 네이버 mapy÷1e7)',
  `longitude` decimal(10,7) DEFAULT NULL COMMENT '식당 경도(WGS84, 네이버 mapx÷1e7)',
  `distance_meters` int(10) unsigned DEFAULT NULL COMMENT 'NAVER_REFERENCE_* 기준 직선거리(m)',
  `source` varchar(100) NOT NULL DEFAULT 'user' COMMENT '출처: user=직접등록, naver=네이버 등',
  `owner_client_id` char(36) DEFAULT NULL COMMENT '로그인 없이 브라우저별 소유 구분(UUID v4). naver 공통 데이터는 NULL',
  `external_id` varchar(100) DEFAULT NULL COMMENT 'API의 장소 고유 ID',
  `phone` varchar(100) DEFAULT NULL COMMENT '번호',
  `place_url` varchar(100) DEFAULT NULL COMMENT '지도/상세 링크',
  `last_synced_at` datetime DEFAULT NULL COMMENT '마지막 수집 시각',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_external` (`source`,`external_id`),
  KEY `idx_category` (`category`),
  KEY `idx_owner_client_id` (`owner_client_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='맛집 목록';
