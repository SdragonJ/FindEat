# DEV_LOG (개발 일지)

날짜별로 **무엇을 바꿨는지** 기록한다. 작업 규칙은 `RULES_MEMO.md`를 본다.

**순서:** 의미 있는 변경을 마친 뒤 같은 세션에서 여기에 요약 추가(에이전트 자동). 큰 DB/배포는 시작 전 한 줄 의도 권장.

**작성 형식:** `번호. 제목` 바로 아래 디테일 (제목과 디테일 사이 빈 줄 없음)

---

## 2026.05.12

### 1. 프로젝트 초기 구성
- Express 백엔드 + `public/` 정적 프론트
- `.env`로 DB·포트 설정

### 2. SQL Server 연동
- 드라이버: `mssql`
- 로컬 SQLEXPRESS 기준 연결 설정

### 3. restaurants 테이블·API
- 컬럼: 이름, 카테고리, 주소, 도보 분, 메모, 등록일
- API: 목록·추천·카테고리·CRUD·health

### 4. 거리 필터 (초기)
- 100 / 200 / 300m → 도보 2 / 3 / 5분
- DB `walk_minutes` 컬럼과 매칭

### 5. SQL 스크립트
- `sql/schema.sql`, `sql/seed.sql` (SQL Server용)

---

## 2026.05.13

### 1. DB 변환 (SQL Server → MariaDB)
- `mssql` 제거, `mysql2` 설치
- `server.js` 연결·쿼리 MariaDB 문법으로 변경 (`?` 바인딩, `dbo.` 제거 등)
- 외부 DB `terp_db` 사용 (`findeat_db` 신규 생성은 서버 권한 문제로 보류)

### 2. restaurants 테이블 확장
- MariaDB에 테이블 생성·컬럼 추가
- 좌표, 거리, 출처, 외부 ID, 전화, URL, 동기화 시각
- 중복 방지: `UNIQUE (source, external_id)` 가이드

### 3. 거리 필터 통일
- 화면·서버 모두 100 / 300 / 600m → 2 / 5 / 10분
- 수정 파일: `server.js`, `public/index.html`

### 4. PROJECT_NOTES.md · DEV_LOG.md 추가
- **PROJECT_NOTES.md**: 작업 규칙·강제 지시·프로젝트 고정 정보
- **DEV_LOG.md**: 날짜별 개발 일지 (변경 전 먼저 기록)
- `.env` 읽지 않기 등 규칙을 PROJECT_NOTES에 정리

### 5. 주변 식당 자동 수집 (계획)
- 외부 장소 API + import 흐름·스키마 방향 정리 (미구현)

### 6. DEV_LOG 작성 형식 정리
- `번호. 제목` → 디테일 하위 항목 방식으로 통일

### 7. 규칙 메모 파일 이름 변경
- `PROJECT_NOTES.md` → `RULES_MEMO.md` (규칙을 적어 두는 메모)
- 파일 내 참조·DEV_LOG 안내 문구 함께 수정

### 8. DEV_LOG 줄바꿈 규칙
- 제목(`###`) 바로 다음 줄에 디테일 — 제목과 디테일 사이 빈 줄 없음

---

## 2026.05.15

### 1. 카테고리 콤보에서 기타 맨 아래
- `public/app.js`: `orderCategoriesWithMiscLast`, 추천·필터·추가·수정 셀렉트 동일 적용
- 등록 후 기본값 `기타` 유지

### 2. 주석·학습용 문서
- `public/app.js`, `server.js`, `public/index.html`, `public/style.css`, `sql/schema.sql`, `sql/seed.sql`에 함수/구간 설명 및 문법 힌트 주석 추가

### 3. DEV_LOG 자동 기록 규칙
- `.cursor/rules/dev-log.mdc` 추가 (`alwaysApply`) — 작업 후 날짜별로 `DEV_LOG.md` 갱신
- `RULES_MEMO.md`의 DEV_LOG 규칙 문구를 “완료 후 자동 기록 + 날짜 섹션 없으면 생성”에 맞게 정리

### 4. 주석에서 Next.js 대비 문구 제거
- 이 저장소는 Express + 정적 HTML/JS이므로, `app.js`·`server.js`·`index.html`·`style.css`·`sql/*`·`DEV_LOG`에서 Next/React/Prisma 비교 설명 삭제, 스택에 맞는 설명만 유지

### 5. 수정할 때마다 초급자용 주석 자동
- `.cursor/rules/beginner-comments.mdc` 추가 (`alwaysApply`) — 별도 요청 없이 의미 있는 변경 시 함수/라우트 위·필요 시 인라인 주석 보강
- `RULES_MEMO.md` 필수 규칙 5번·표·사용자 메모에 반영

### 6. 네이버 지역 검색 → DB 배치(초안)
- `scripts/naver-local-import.mjs`: `openapi.naver.com/v1/search/local.json` 호출 후 `restaurants` INSERT (이름+주소 중복 스킵)
- `package.json` 스크립트 `import:naver`, `.env.example`에 NAVER_*·MariaDB 안내 추가
- NCP Dynamic Map 전용 키와 검색 API 권한 차이·월간 스케줄은 스크립트 상단 주석에 정리

### 7. 네이버 키 발급 후 연결 절차
- `scripts/verify-naver.mjs`, `npm run verify:naver`, `.env.example` 단계 안내

### 8. 출처(source) + 화면에서 네이버 최신화
- `sql/migration_mariadb_restaurants_source.sql`: `source` 컬럼 `user` | `naver`
- `lib/naverImport.js`: CLI·서버 공통 수입 로직
- `POST /api/restaurants/sync-naver`: `naver` 행만 DELETE 후 재수입, `user` 유지
- `index.html` / `app.js` / `style.css`: 주변 식당 최신화 버튼, 목록 뱃지

### 9. 맛집 추가 폼 (필수·순서)
- 필수: 이름·도보만 — `input-required`(빨간 테두리)도 이 둘만, `*` 없음
- 순서: 이름 → 도보 → 주소(위치) → 카테고리 → 메모(이름·도보·주소는 각각 `full` 한 줄)
- `POST /api/restaurants`: 이름·도보 필수 검증, 주소 비면 NULL

### 10. 라벨·음식 종류 고정 콤보
- `public/index.html`: 라벨 `식당이름`·`음식 종류`(추천·필터·추가·수정)
- `public/app.js`: `FOOD_CATEGORIES` 고정 9종, `/api/restaurants/categories` 없이 `fillCategorySelects`만 사용
- `lib/naverImport.js`: 네이버 `category` 첫 세그먼트가 목록에 없으면 DB에 `기타` 저장

### 11. 맛집 수정 화면에서 삭제
- `DELETE /api/restaurants/:id`: 해당 `id` 행 삭제, 없으면 404
- `index.html` / `style.css`: 저장 버튼 아래 `삭제` 버튼(위험 스타일), `app.js`에서 확인 후 호출

### 12. 목록에서 직접 데이터 우선
- `GET /api/restaurants`: `user_touched_at IS NOT NULL` 행을 먼저(최근 손댄 순), `NULL` 은 아래(카테고리·이름)
- `POST`: `user_touched_at = NOW()`; `PUT`: `source` 유지, `user_touched_at = NOW()` 만 갱신 → `source=naver` 도 저장하면 상단
- 마이그레이션: `sql/migration_mariadb_restaurants_user_touched_at.sql` (기존 `source=user` 행은 `created_at` 으로 백필)
- (이전 `source=user` 우선만 쓰던 방식은 제거 — naver 수정 행도 상단에 오도록 위 컬럼으로 통일)

### 13. 별점 (1~5점)
- `sql/migration_mariadb_restaurants_rating.sql`: `rating` TINYINT NULL (1~5)
- `server.js`: 목록·상세·추천 SELECT, POST/PUT 검증·저장, `lib/naverImport.js` 수입 시 `rating` NULL
- `index.html` / `style.css` / `app.js`: ⭐·☆ 클릭 + 옆 숫자 입력, 목록·추천에 표시

### 14. 점심 추천 별점 조건
- 메인「오늘 점심 추천」: 음식 종류 아래 `별점` 셀렉트(1점 이상~5점)
- `GET /api/restaurants/pick?min_rating=`: `rating >= min_rating` (NULL 별점 행은 조건 걸면 제외)

### 15. 맛집 목록 페이지네이션·고정 카드 높이
- `GET /api/restaurants`: `page`·`limit`(기본 5, 최대 50), `min_rating`, 응답 `{ items, total, page, pageSize, totalPages }`
- `index.html` `#listPager`, `app.js` 페이지 버튼·필터 시 페이지 1 리셋·등록 후 1페이지
- `style.css`: 목록 카드 고정 높이 + 제목·주소·메모 한 줄 말줄임(`…`); 별점은 **음식 종류 오른쪽**(제목과 분리)
- 점심 추천: 헤더에 **추천 받기** 오른쪽 정렬, 필터 순서 **거리 → 음식 종류 → 별점**; 목록 필터도 **거리 → 음식 종류 → 별점**·`pick-stack` + `field-full` 로 위와 동일 레이아웃
- `.toolbar select` 가 세로 스택에서 높이로 먹던 문제 수정(`:not(.toolbar-stack)`), 목록은 `toolbar` 제거

### 16. 맛집 표시(`is_matjip`)
- `sql/migration_mariadb_restaurants_is_matjip.sql`: `is_matjip` TINYINT(1) 기본 0
- `GET /api/restaurants`·`/pick`: `matjip_only=1` 이면 `is_matjip=1` 만; POST/PUT 본문 `is_matjip`
- `index.html` / `app.js`: 추가·수정 체크박스, 점심 추천 거리 옆「맛집만」, 목록「맛집만 보기」; 목록·추천 결과에 맛집 뱃지
- `lib/naverImport.js` 수입 시 `is_matjip=0`

---
