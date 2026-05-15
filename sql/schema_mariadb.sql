-- FindEat_CURSOR — MariaDB / MySQL 8+ 호환 초기 스키마
--
-- [용도] 새 DB(예: terp_db)에 테이블을 처음 만들 때 이 파일을 실행합니다.
-- [인덱스] PRIMARY KEY / UNIQUE KEY / KEY 는 모두 아래 CREATE TABLE 안에 포함됩니다.
--          별도 "indexes 폴더"나 스크립트가 없어도 한 번 실행으로 같이 생성됩니다.
-- [환경] DB 이름은 .env 의 DB_NAME 과 맞추세요. 아래 USE 줄만 바꿔도 됩니다.
--
-- [이미 DB가 있고 컬럼만 추가하는 경우] sql/migration_mariadb_*.sql 만 순서대로 실행하면 됩니다.

CREATE DATABASE IF NOT EXISTS `terp_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `terp_db`;

-- 기존 테이블이 있으면 건너뛰려면: 수동으로 DROP 하거나, 새 DB에만 실행하세요.
CREATE TABLE `restaurants` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL COMMENT '맛집 이름',
  `category` varchar(40) NOT NULL DEFAULT '기타' COMMENT '카테고리',
  `address` varchar(255) DEFAULT NULL COMMENT '주소',
  `walk_minutes` tinyint(3) unsigned DEFAULT NULL COMMENT '도보 시간(분)',
  `memo` varchar(500) DEFAULT NULL COMMENT '메모',
  `rating` tinyint(3) unsigned DEFAULT NULL COMMENT '별점 1~5, NULL=미등록',
  `is_matjip` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=맛집으로 표시',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT '등록일시',
  `user_touched_at` datetime DEFAULT NULL COMMENT '웹에서 추가(POST) 또는 저장(PUT)한 시각',
  `latitude` decimal(10,7) DEFAULT NULL COMMENT '위도',
  `longitude` decimal(10,7) DEFAULT NULL COMMENT '경도',
  `distance_meters` int(10) unsigned DEFAULT NULL COMMENT '기준점에서 거리',
  `source` varchar(100) NOT NULL DEFAULT 'user' COMMENT '출처: user=직접등록, naver=네이버 등',
  `external_id` varchar(100) DEFAULT NULL COMMENT 'API의 장소 고유 ID',
  `phone` varchar(100) DEFAULT NULL COMMENT '번호',
  `place_url` varchar(100) DEFAULT NULL COMMENT '지도/상세 링크',
  `last_synced_at` datetime DEFAULT NULL COMMENT '마지막 수집 시각',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_external` (`source`,`external_id`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='맛집 목록';
