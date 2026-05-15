-- FindEat_CURSOR — SQL Server 스키마
--
-- MariaDB / MySQL 은 `sql/schema_mariadb.sql` 을 사용하세요.
--
-- [학습]
-- - SSMS/DBeaver에서 “스크립트 실행”으로 통째로 실행합니다. GO는 배치 구분자(SSMS/T-SQL).
-- - IF DB_ID(...) : 데이터베이스가 없을 때만 CREATE (이미 있으면 건너뜀).
-- - IDENTITY(1,1) : MySQL의 AUTO_INCREMENT 와 비슷, 삽입 시 id 자동 증가.
-- - NVARCHAR : 유니코드 문자열(한글 등). VARCHAR와 달리 길이가 “문자 단위”.
-- - dbo : 기본 스키마(테이블 네임스페이스).

-- DB 생성 권한이 없으면 IF 블록을 건너뛰고, 이미 만든 DB에 연결한 뒤 테이블 부분만 실행.

IF DB_ID(N'findeatDb') IS NULL
BEGIN
    -- 정렬은 서버 기본값 사용(일부 환경에서 Korean_Windows_CI_AS 미지원 시 오류 방지)
    CREATE DATABASE [findeatDb];
END
GO

USE [findeatDb];
GO

IF OBJECT_ID(N'dbo.restaurants', N'U') IS NULL
BEGIN
    -- U = 사용자 테이블. 없을 때만 CREATE (재실행 시 중복 생성 방지)
    CREATE TABLE dbo.restaurants (
        id            INT            NOT NULL IDENTITY(1, 1),  -- 기본키, 자동 증가
        name          NVARCHAR(120)  NOT NULL,
        category      NVARCHAR(40)   NOT NULL CONSTRAINT DF_restaurants_category DEFAULT (N'기타'),
        address       NVARCHAR(255)  NULL,
        walk_minutes  TINYINT        NULL,
        memo          NVARCHAR(500)  NULL,
        created_at    DATETIME2(0)   NOT NULL CONSTRAINT DF_restaurants_created_at DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_restaurants PRIMARY KEY CLUSTERED (id)
    );

    CREATE NONCLUSTERED INDEX idx_category ON dbo.restaurants (category);
END
GO
