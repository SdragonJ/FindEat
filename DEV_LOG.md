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

### 17. 네이버 수입 시 거리·도보(`source=naver`)
- `mapx`·`mapy`를 WGS84(도×10⁷)로 해석, `.env` 의 `NAVER_REFERENCE_LAT`·`NAVER_REFERENCE_LNG` 가 있으면 Haversine으로 `distance_meters`·`walk_minutes`(분당 약 60m, UI 거리 필터와 동일 계열) 저장
- 기준점 없으면 좌표만(`latitude`·`longitude`) 파싱 성공 시 저장, 거리·도보는 NULL
- `server.js` 목록·추천·상세 SELECT 에 `latitude`·`longitude`·`distance_meters` 포함
- `scripts/verify-naver.mjs` 첫 건 `mapx`/`mapy` 로그, `.env.example` 기준점 안내

### 18. 위·경도 컬럼 DECIMAL 교정 + API에 기준점 노출
- `sql/migration_mariadb_restaurants_latlng_decimal.sql`: INT 등으로 잘리던 `latitude`/`longitude` 를 `DECIMAL(10,7)` 로 수정
- `server.js`: 응답에 `reference_location`(`.env` 내 위치), `lib/naverImport.js` 는 식당 좌표를 문자열 소수 7자리로 INSERT
- `public/app.js`·`index.html`: 목록 카운트 옆 기준점 좌표, 목록에 직선 m, 추천·수정 화면에 기준점/식당 좌표 안내

### 19. `schema.sql`(SQL Server) 을 MariaDB 스키마와 동기화
- `sql/schema.sql`: `schema_mariadb.sql` 과 동일 컬럼군 및 UNIQUE `(source,external_id)` 등
- `RULES_MEMO.md`: DDL 동시 반영 규칙·표 문구 정리

### 23. 기준점 변경 후 거리·도보 재계산 CLI
- `lib/naverImport.js`: `recalculateNaverDistancesFromEnv` — naver 행의 `distance_meters`·`walk_minutes`만 갱신
- `npm run recalc:naver-distances` — `.env` LAT/LNG 수정 후 13997m·walk NULL 같은 옛 값 정리용

### 22. verify·.env — 대륭19차(가산) 기준 안내
- `verify-naver`: 기본 검색어를 `NAVER_IMPORT_QUERIES` 첫 항목으로, `강남역` 기본값 제거; 검색어 vs 기준점 좌표 구분 로그; 가산 대륭19차와 기준점 5km 이상이면 경고
- `.env.example`: 대륭19차=가산(37.47x, 126.88x) 예시, 37.50/127.04(강남 쪽) 오설정 주의

### 21. 네이버 도보 분(walk_minutes) 234분 등 오류 완화
- 원인: 직선 약 14km(÷60≈234분) — 기준점 LAT/LNG 뒤바뀜·좌표 오류·재수입 시 중복 스킵으로 옛 값 유지
- `lib/naverImport.js`: LAT/LNG 자동 교정·한국 범위 검사, 우회 1.25·75m/분, 3.5km 초과 시 walk NULL, `source=naver` 중복 시 UPDATE
- `scripts/verify-naver.mjs`: 기준점·첫 건 직선 m·도보 분 미리보기
- `server.js` sync 응답에 `updatedTotal`

### 20. 스키마 기준본·마이그레이션 역할 정리
- `sql/schema_mariadb.sql`: 신규 DB 시 이 파일만 실행하면 마이그레이션 전부 적용과 동일 구조; 헤더에 신규 vs 기존 절차·마이그레이션 순서 명시
- 각 `migration_mariadb_*.sql`: 기존 DB용, 상단에「신규면 실행 불필요」안내; `source` 마이그레이션을 VARCHAR(100) 으로 기준본과 통일
- `.env.example` 마이그레이션 순서를 헤더와 동일하게 수정
- `sql/schema.sql`: 깨진 줄바꿈 정리

---

## 2026.05.18

### 1. 식당 목록에서 메모 숨김
- `public/app.js`: 목록 카드에서 메모 행 제거; 맛집 수정 화면(`openEdit`)·추천 결과(`showPick`)는 메모 유지
- `public/style.css`: 목록 카드 고정 높이 2줄(제목·주소)에 맞게 4.5rem

### 2. 목록 UI·헤더 정리
- `public/app.js`: 도보 시간을 식당명 옆에 표시; 두 번째 줄은 주소·직선거리만; 목록 건수 옆 기준 좌표 문구 제거
- `public/style.css`: FindEat 제목 3.5rem, `title-walk` 스타일

### 3. 목록 도보 시간 색
- `public/style.css`: `title-walk` 연한 빨강(`#e57373`); `app.js`에서 `muted` 클래스 제거

### 4. 식당 목록 페이지 크기 50건
- `public/app.js`: 목록 API `limit=50`
- `server.js`: 기본·폴백 limit 50 (상한 50 유지)

### 5. 주변 식당 최신화(네이버) 50건 목표
- 원인: 네이버 지역 검색 API는 요청당·검색어당 최대 5건, `start` 페이지네이션 불가
- `lib/naverImport.js`: 검색어+음식종류 변형으로 여러 번 호출, `NAVER_IMPORT_TARGET`(기본 50)까지 수입; 무의미한 페이지 루프 제거
- `server.js`·`app.js`: 동기화 후 `naverTotal` 표시; `.env.example` 안내

### 6. 최신화 로딩 오버레이
- `index.html`: 전체 화면 오버레이 + FindEat 밥그릇 마스코트 SVG
- `style.css`: 블러·스크롤 잠금·통통 튀는 애니메이션
- `app.js`: `showSyncLoading` / `hideSyncLoading` — API 완료까지 클릭·스크롤 차단

### 7. 최신화 완료 팝업 제거
- `app.js`: 네이버 동기화 성공 시 `alert` 없음 — 로딩만 닫고 목록·카테고리 갱신 (실패 시에만 알림)

### 8. 최신화 완료 로딩 전환
- 성공 시 문구「최신화 완료」·점 애니메이션 숨김 → 1초 후 오버레이 닫힘 (`showSyncLoadingComplete`, `sleep`)

### 9. 식당 목록 페이지당 5건
- `public/app.js`·`server.js`: 목록 `limit` 기본 5 (6번째부터 다음 페이지·`#listPager`)

### 10. 페이지 버튼 10개 묶음·화살표
- `app.js`: `‹` `›` 로 1~10·11~20 … 묶음 이동, 현재 페이지는 묶음에 맞게 자동 정렬
- `style.css`: `pager-btn` 크기 축소, `pager-btn--arrow` 스타일

### 15. 도보 시간 필터 5·10·20·20분 이상
- `index.html`·`app.js`·`server.js`: 2/5/10분(100·300·600m) → `max_walk_minutes` 5·10·20·`gte20`

### 14. TMAP 도보 시간 보정(신호등 추산)
- 10분 미만: TMAP 그대로(+3 없음); 10분 이상: 신호 가산 + `TMAP_WALK_BASE_EXTRA_MIN`(기본 +3분)

### 13. 최신화 시 walk_minutes 보장
- TMAP 우선(직선 3.5km 제한 전에 시도), import 후 `fillMissingWalkMinutesForNaver` 보정
- `sync-naver`: `.env` 재로드, 기준점 없으면 400, 응답에 `tmapWalk`·`walkMinutesMissing`

### 12. TMAP 보행 경로로 도보 분 계산
- `lib/tmapWalk.js`: SK openapi 보행 API (`totalTime` 초 → 분, `totalDistance` m)
- `lib/naverImport.js`: `TMAP_APP_KEY` 시 import·recalc 에 TMAP 사용, 실패 시 직선 추정
- `npm run verify:tmap`, `.env.example` `TMAP_*` 안내; 목록 거리 문구 `약 Nm`

### 11. 점심 추천 결과 — 목록형 박스
- `buildListItemInnerHtml` 공통화; `showPick` → `list-browse-panel` + 카드(제목 옆 연빨강 도보, 위·경도 숨김)
- 추천 결과에서 메모(link·map 등) 미표시

---
