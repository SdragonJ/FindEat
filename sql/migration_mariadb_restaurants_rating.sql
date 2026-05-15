-- MariaDB: 맛집 별점 (1~5점, 비어 있으면 NULL)
-- 컬럼이 이미 있으면 ALTER 가 실패하므로 한 번만 실행합니다.

ALTER TABLE restaurants
  ADD COLUMN `rating` TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT '별점 1~5, NULL=미등록'
    AFTER `memo`;
