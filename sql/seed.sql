-- 테스트 데이터 (선택). schema.sql 로 테이블 만든 뒤 실행.
-- N'...' : NVARCHAR 리터럴(유니코드). 한글은 이렇게 쓰는 습관이 좋습니다.

USE [findeatDb];
GO

INSERT INTO dbo.restaurants (name, category, address, walk_minutes, memo) VALUES
(N'테스트 한식당', N'한식', N'회사 앞 골목', 5, N'점심 특선 있음'),
(N'테스트 분식집', N'분식', N'지하철 2번 출구', 8, NULL),
(N'테스트 카페', N'카페', N'1층 로비 옆', 3, N'디저트 굿');
