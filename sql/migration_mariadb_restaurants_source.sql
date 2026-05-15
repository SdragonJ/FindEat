-- MariaDB: 직접 등록(user) vs 네이버 지역검색 수입(naver) 구분
-- 한 번만 실행하면 됩니다. 이미 컬럼이 있으면 에러가 나므로 그때는 건너뜁니다.
--
-- [학습] DEFAULT 'user' 로 기존 행은 모두 "직접 등록"으로 간주됩니다.
-- 이전에 CLI만으로 넣은 네이버 데이터가 있다면 필요 시 수동으로:
--   UPDATE restaurants SET source = 'naver' WHERE ... 조건으로 맞춰 주세요.

ALTER TABLE restaurants
  ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'user'
    COMMENT 'user=직접등록, naver=네이버지역검색'
    AFTER `memo`;
