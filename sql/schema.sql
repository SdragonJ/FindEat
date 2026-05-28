-- FindEat_CURSOR — SQL Server 스키마
--
-- MariaDB 원본·기준본은 `sql/schema_mariadb.sql` 입니다.
-- 테이블 정의를 바꿀 때 두 파일을 같은 컬럼·의미로 맞춥니다.
-- 마이그레이션만 추가할 때도 최종 모양이 `schema_mariadb.sql`·이 파일에 반영되도록 합니다.
--
-- [학습]
-- - SSMS/DBeaver에서 통째로 실행. GO = 배치 구분자.
-- - DECIMAL(10,7): 위·경도 소수 저장(INT 컬럼이면 37·127처럼 잘림).

IF DB_ID(N'findeatDb') IS NULL
BEGIN
    CREATE DATABASE [findeatDb];
END
GO

USE [findeatDb];
GO

IF OBJECT_ID(N'dbo.restaurants', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.restaurants (
        id               INT             NOT NULL IDENTITY(1, 1),
        name             NVARCHAR(120)   NOT NULL,
        category         NVARCHAR(40)    NOT NULL CONSTRAINT DF_restaurants_category DEFAULT (N'기타'),
        address          NVARCHAR(255)   NULL,
        walk_minutes     TINYINT         NULL,
        memo             NVARCHAR(500)   NULL,
        rating           TINYINT         NULL,
        is_matjip        TINYINT         NOT NULL CONSTRAINT DF_restaurants_is_matjip DEFAULT (0),
        created_at       DATETIME2(0)    NOT NULL CONSTRAINT DF_restaurants_created_at DEFAULT (SYSDATETIME()),
        user_touched_at  DATETIME2(0)    NULL,
        latitude         DECIMAL(10, 7)  NULL,
        longitude        DECIMAL(10, 7)  NULL,
        distance_meters  INT             NULL,
        source           NVARCHAR(100)   NOT NULL CONSTRAINT DF_restaurants_source DEFAULT (N'user'),
        owner_client_id  CHAR(36)        NULL,
        external_id      NVARCHAR(100)   NULL,
        phone            NVARCHAR(100)   NULL,
        place_url        NVARCHAR(100)   NULL,
        last_synced_at   DATETIME2(0)    NULL,
        CONSTRAINT PK_restaurants PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UK_restaurants_source_external UNIQUE (source, external_id)
    );

    CREATE NONCLUSTERED INDEX idx_category ON dbo.restaurants (category);
    CREATE NONCLUSTERED INDEX idx_owner_client_id ON dbo.restaurants (owner_client_id);
END
GO
