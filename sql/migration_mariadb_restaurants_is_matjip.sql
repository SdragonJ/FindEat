-- MariaDB: 사용자가 지정한 «맛집» 표시 (0/1)
-- 한 번만 실행합니다. 컬럼이 이미 있으면 ALTER 가 실패합니다.

ALTER TABLE restaurants
  ADD COLUMN `is_matjip` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=맛집으로 표시'
    AFTER `rating`;
