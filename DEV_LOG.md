# DEV_LOG (개발 일지)

날짜별로 **무엇을 바꿨는지** 기록한다. 작업 규칙은 `RULES_MEMO.md`를 본다.

**순서:** **최신 날짜가 맨 위**(오래된 날짜는 아래). 같은 날짜면 해당 섹션에 항목만 추가. 의미 있는 변경 후 같은 세션에서 갱신(에이전트 자동). 큰 DB/배포는 시작 전 한 줄 의도 권장.

**작성 형식**

- `번호. 제목` — 변경 주제 한 줄 (제목과 디테일 사이 빈 줄 없음)
- 첫 불릿: 무엇을·왜 바꿨는지 한 줄 요약
- `수정 전` / `수정 후` — 값·동작·파일 상태가 바뀐 경우 (신규 추가만이면 `추가` 한 줄로 대체 가능)
- 날짜 구분 : 아래와 같은 긴 점선 한 줄 (`-` 100개). **이 파일만** 저장 서식 예외 — `.vscode/settings.json` + `.prettierignore`

----------------------------------------------------------------------------------------------------

## 2026.05.21

1. DEV_LOG 제목 마크다운 제거

- 항목 제목에서 `###` 제거
- 수정 전 : `### 번호. 제목`
- 수정 후 : `번호. 제목` (`##` 날짜만 유지), `dev-log.mdc` 동기화

2. DEV_LOG 항목 번호·순서 정리

- 날짜 섹션 안 번호를 1부터 연속·작업 순으로
- 수정 전 : 05.15 `19→23→22→21→20`, 05.18 `10→15→14→13→12→11`
- 수정 후 : 05.15 `19→20→21→22→23`, 05.18 `10→11→12→13→14→15`

3. DEV_LOG 작성 형식 통일

- 모든 항목을「요약 + 수정 전/후」형식으로 재작성
- 수정 전 : 파일·기능 나열 위주 불릿
- 수정 후 : `번호. 제목` → 요약 한 줄 → `수정 전` / `수정 후`(또는 `추가`), `RULES_MEMO.md`·`dev-log.mdc` 규칙 반영

4. DEV_LOG 날짜 구분선

- 날짜 섹션 사이 구분선을 긴 점선으로 통일
- 수정 전 : `---` (짧은 구분선)
- 수정 후 : `----------------------------------------------------------------------------------------------------` (`-` 100개)

5. DEV_LOG 날짜 역순 정렬

- 최신 날짜를 파일 맨 위로 배치
- 수정 전 : 05.12 → 05.13 → 05.15 → 05.18 → 05.21 (오래된 날짜가 위)
- 수정 후 : 05.21 → 05.18 → 05.15 → 05.13 → 05.12 (최신 날짜가 위), `RULES_MEMO.md`·`dev-log.mdc` 반영

6. DEV_LOG 저장 시 구분선 짧아짐 방지

- Markdown「저장 시 서식」이 `-` 100줄을 `---`로 줄임
- 수정 전 : `DEV_LOG.md` = Markdown, 저장 시 `---`로 축소
- 수정 후 : `.vscode/settings.json`에서 `DEV_LOG.md`를 `plaintext`로 연결, 긴 점선 유지

7. DEV_LOG만 저장 서식 예외 (워크스페이스)
- `DEV_LOG.md`만 plaintext + formatOnSave 끔, Prettier ignore
- 수정 전 : plaintext 연결만 있어 전역 Markdown 서식이 여전히 적용될 수 있음
- 수정 후 : `[plaintext]` `formatOnSave: false`, `.prettierignore`에 `DEV_LOG.md`만 등록

8. 네이버 클라우드 테스트 서버 FindEat 배포·외부 URL 접속
- RDP Windows VM에 GitHub `clone` → `.env`(로컬과 동일, DB는 외부 리눅스) → `npm install`·`npm start`(PORT=3001), Jenkins 없이 `git pull` 배포
- 서버 안 `http://127.0.0.1:3001/` 확인 후 PC·운영 Nexacro `system.execBrowser("http://공인IP:3001/")` — RDP는 3389, FindEat은 3001(별도 포트)
- 수정 전 : PC→공인IP:3001 타임아웃(3389 RDP만 허용), Windows 방화벽만으로는 부족
- 수정 후 : Windows 인바운드 3001 + 네이버 클라우드 ACG(보안 그룹) 인바운드 TCP 3001, PC·운영 PC에서 테스트 서버 FindEat URL 접속 가능

9. 맛집 수정 화면 UI 정리
- 수정 화면에서 부가 안내·좌표 문구 제거, 맛집 토글을 식당 이름 위 가운데·크게 배치
- 수정 전 : 「정보를 바꾼 뒤…」·`editGeoHint` 기준점/직선거리, 맛집 토글이 이름 옆 작은 스탬프
- 수정 후 : 제목만 `맛집 수정`, `openEdit` 좌표 힌트 제거, `.edit-matjip-row`·`.edit-matjip-toggle` (`public/index.html`, `public/app.js`, `public/style.css`)

10. 맛집 토글 체크 팝 이펙트
- 맛집 스탬프 체크 시 짧은 확대·링·주변 점 퍼짐 애니메이션
- 수정 전 : 체크 시 색·스탬프 변화만
- 수정 후 : `setupMatjipPopEffect`·`playMatjipPop`, `.toggle-stamp-burst` (`public/app.js`, `public/style.css`), `prefers-reduced-motion` 시 생략

11. GitHub Actions CI/CD
- `main` push 시 CI(검사) 후 테스트 서버 self-hosted Runner로 pull·`pm2 restart` 자동화
- 수정 전 : PC push 후 서버에서 수동 `git pull`·`pm2 restart findeat`
- 수정 후 : `.github/workflows/ci-cd.yml`, `npm run check`, `docs/GITHUB_ACTIONS.md`(Runner 설치·배포 경로 `C:\dev\FindEat`, PowerShell `Exiting` 시 cmd `--unattended --runasservice`, CD shell `powershell`로 pwsh 미설치 대응, Runner는 `C:\actions-runner` 권장·`Administrator` 폴더+NETWORK SERVICE 시 권한 오류)

12. 로그인 없이 “내가 추가한 식당” 섞어 보기
- 브라우저 쿠키 UUID(`findeat_uid`)를 발급해 네이버 공통 데이터 + 내 추가분(`owner_client_id`)을 함께 노출
- 수정 전 : 목록·추천·카테고리·수정/삭제가 전체 공통 데이터 기준, 직접 추가 소유자 구분 없음
- 수정 후 : `GET /api/me`·쿠키 발급, 목록/추천/카테고리 접근 범위 `(source='naver' OR owner_client_id=쿠키ID)`, `POST` 시 `owner_client_id` 저장, `GET/PUT/DELETE /api/restaurants/:id` 접근 가드, 스키마/마이그레이션 `owner_client_id` 추가 (`server.js`, `public/app.js`, `sql/schema_mariadb.sql`, `sql/schema.sql`, `sql/migration_mariadb_restaurants_owner_client_id.sql`, `.env.example`)

13. CD PowerShell 인코딩 파싱 오류 수정
- 테스트 서버 배포 단계의 한글 `throw` 메시지가 깨지며 PowerShell 구문 오류가 나던 문제를 ASCII 메시지로 교체
- 수정 전 : `Deploy` 단계에서 `Unexpected token`, `string is missing the terminator`로 실패
- 수정 후 : `.github/workflows/ci-cd.yml` `run` 블록 오류 문구를 영문으로 변경해 파싱 안정화 + 단계별 종료코드 검사(`Step failed: ...`)와 `pm2` PATH 미존재 시 로컬 prefix(`C:\dev\FindEat\.npm-global`) 자동 설치 fallback으로 NETWORK SERVICE 환경에서도 재시작 가능하도록 보강, `docs/GITHUB_ACTIONS.md` EPERM 대응 가이드 보강

----------------------------------------------------------------------------------------------------

## 2026.05.18

1. 식당 목록 메모 숨김

- 목록 카드만 메모 비표시
- 수정 전 : 목록 카드에 메모 행 표시
- 수정 후 : 목록에서 메모 제거, 수정·추천 화면은 유지, 카드 높이 4.5rem(2줄)

2. 목록 UI·헤더 정리

- 도보 시간·주소·제목 크기 조정
- 수정 전 : 도보 별도 줄, 목록 건수 옆 기준 좌표 문구
- 수정 후 : 도보를 식당명 옆(`title-walk`), 2줄째 주소·직선거리만, FindEat 제목 3.5rem

3. 목록 도보 시간 색

- 도보 분 강조 색
- 수정 전 : `title-walk` + `muted`(회색 톤)
- 수정 후 : `title-walk` 연한 빨강 `#e57373`, `muted` 제거

4. 식당 목록 페이지 크기 50건

- 한 페이지 최대 건수 확대(이후 9번에서 다시 5건)
- 수정 전 : `limit` 기본 5
- 수정 후 : `limit` 기본·상한 50 (`app.js`, `server.js`)

5. 네이버 최신화 50건 목표

- API 5건 제한을 검색어 변형으로 우회
- 수정 전 : 검색 1회 5건, 페이지 루프 무의미
- 수정 후 : 검색어+음식종류 변형 반복, `NAVER_IMPORT_TARGET` 기본 50, `naverTotal` 표시

6. 최신화 로딩 오버레이

- 동기화 중 전체 화면 차단 UI
- 수정 전 : 버튼만 비활성·로딩 표시 없음
- 수정 후 : 오버레이+마스코트 SVG, 블러·스크롤 잠금, `showSyncLoading`/`hideSyncLoading`

7. 최신화 완료 팝업 제거

- 성공 시 alert 제거
- 수정 전 : 동기화 성공 `alert`
- 수정 후 : 로딩만 닫고 목록 갱신(실패만 알림)

8. 최신화 완료 로딩 전환

- 완료 문구 후 1초 뒤 닫힘
- 수정 전 : API 끝나면 즉시 오버레이 닫힘
- 수정 후 : 「최신화 완료」→1초 후 닫힘 (`showSyncLoadingComplete`)

9. 식당 목록 페이지당 5건

- 4번 50건 설정을 다시 5건으로
- 수정 전 : `limit` 50
- 수정 후 : `limit` 기본 5, `#listPager`로 6번째부터 다음 페이지

10. 페이지 버튼 10개 묶음·화살표

- 페이지 번호 UI 개선
- 수정 전 : 모든 페이지 번호 나열
- 수정 후 : `‹` `›`로 1~10·11~20 묶음, `pager-btn` 축소

11. TMAP 보행 경로 도보 분

- 직선 추정 대신 TMAP 보행 API 우선
- 수정 전 : Haversine·분당 60m 추정만
- 수정 후 : `lib/tmapWalk.js`, `TMAP_APP_KEY` 시 import·recalc TMAP, `npm run verify:tmap`, 목록 `약 Nm`

12. 최신화 시 walk_minutes 보장

- TMAP 실패·누락 보정
- 수정 전 : import 후 walk NULL 가능, 3.5km 제한이 TMAP보다 먼저
- 수정 후 : TMAP 우선 시도, `fillMissingWalkMinutesForNaver`, `sync-naver` `.env` 재로드·기준점 400·`tmapWalk` 응답

13. TMAP 도보 시간 보정

- 신호등·기본 가산 분 반영
- 수정 전 : TMAP 분 그대로(또는 직선만)
- 수정 후 : 10분 미만 TMAP 그대로, 10분 이상 신호 가산 + `TMAP_WALK_BASE_EXTRA_MIN`(기본 +3)

14. 점심 추천 결과 목록형

- 추천 결과를 목록 카드와 동일 레이아웃
- 수정 전 : 추천 전용 단순 블록, 메모·좌표 노출
- 수정 후 : `buildListItemInnerHtml` 공통, `list-browse-panel`, 제목 옆 도보·좌표 숨김·메모 미표시

15. 도보 시간 필터 변경

- 거리(m) 필터를 도보(분) 필터로
- 수정 전 : 2/5/10분(100·300·600m)
- 수정 후 : `max_walk_minutes` 5·10·20·`gte20`(20분 이상)

----------------------------------------------------------------------------------------------------

## 2026.05.15

1. 카테고리 콤보 정렬

- `기타`를 콤보 맨 아래로 고정
- 수정 전 : API·DB 순서 그대로
- 수정 후 : `orderCategoriesWithMiscLast` — 추천·필터·추가·수정 공통, 등록 후 기본값 `기타`

2. 주석·학습용 문서

- 초급자용 설명 주석 대량 추가
- 수정 전 : 최소 주석
- 수정 후 : `app.js`, `server.js`, `index.html`, `style.css`, `sql/schema.sql`, `sql/seed.sql` 함수·구간·문법 힌트

3. DEV_LOG 자동 기록 규칙

- Cursor가 작업 후 일지를 자동 갱신
- 추가 : `.cursor/rules/dev-log.mdc` (`alwaysApply`), `RULES_MEMO.md` “완료 후 자동 기록” 문구

4. 주석 스택 정리

- Next/React 비교 문구 제거
- 수정 전 : Next·React·Prisma 대비 설명 포함
- 수정 후 : Express + 정적 HTML/JS 기준 설명만 (`app.js`, `server.js`, `index.html`, `style.css`, `sql/*`, `DEV_LOG`)

5. 초급자용 주석 자동 규칙

- 의미 있는 수정 시 주석 자동 보강
- 추가 : `.cursor/rules/beginner-comments.mdc`, `RULES_MEMO.md` 필수 규칙 5번·표 반영

6. 네이버 지역 검색 → DB 배치(초안)

- 네이버 로컬 검색 결과를 DB에 넣는 CLI 초안
- 추가 : `scripts/naver-local-import.mjs`, `npm run import:naver`, `.env.example` NAVER\_\*·MariaDB 안내

7. 네이버 키 연결 절차

- 키 발급 후 동작 확인 스크립트
- 추가 : `scripts/verify-naver.mjs`, `npm run verify:naver`, `.env.example` 단계 안내

8. 출처(source) + 네이버 최신화

- `user`/`naver` 출처 구분·화면 동기화
- 수정 전 : 출처 없음, 수동·CLI 수입만
- 수정 후 : `source` 컬럼, `lib/naverImport.js`, `POST /sync-naver`(naver만 DELETE 후 재수입), 최신화 버튼·뱃지

9. 맛집 추가 폼 (필수·순서)

- 필수·필드 순서·API 검증 정리
- 수정 전 : 필드 필수·순서 불명확
- 수정 후 : 필수 이름·도보만(`input-required`), 순서 이름→도보→주소→카테고리→메모, `POST` 주소 NULL 허용

10. 라벨·음식 종류 고정 콤보

- 카테고리 API 대신 고정 9종
- 수정 전 : `/api/restaurants/categories` 동적 목록
- 수정 후 : `FOOD_CATEGORIES` 9종, 라벨 `식당이름`·`음식 종류`, 네이버 미매칭 시 `기타`

11. 맛집 수정 화면 삭제

- 수정 화면에서 행 삭제 가능
- 추가 : `DELETE /api/restaurants/:id`, 확인 후 삭제 버튼(`index.html`, `style.css`, `app.js`)

12. 목록 정렬 (직접 손댄 데이터 우선)

- 사용자가 저장·수정한 행을 목록 상단
- 수정 전 : `source=user` 우선만
- 수정 후 : `user_touched_at` 최근 순 상단, `PUT` 시 `source` 유지·`user_touched_at` 갱신, 마이그레이션 `migration_mariadb_restaurants_user_touched_at.sql`

13. 별점 (1~5점)

- 식당별 1~5점 저장·표시
- 수정 전 : 별점 없음
- 수정 후 : `rating` TINYINT, 목록·추천·추가·수정 UI, 네이버 수입 시 NULL

14. 점심 추천 별점 조건

- 추천 시 최소 별점 필터
- 수정 전 : `/pick` 별점 조건 없음
- 수정 후 : UI 별점 셀렉트, `GET /pick?min_rating=` (`NULL` 별점은 조건 시 제외)

15. 맛집 목록 페이지네이션·카드 레이아웃

- 목록 페이징·카드 높이·필터 순서 통일
- 수정 전 : 전체 목록 한 번에, 필터·레이아웃 제각각
- 수정 후 : `page`·`limit`(기본 5), `#listPager`, 카드 고정 높이·말줄임, 필터 순서 거리→음식→별점, `.toolbar` 목록에서 제거

16. 맛집 표시(`is_matjip`)

- 맛집 플래그·필터·뱃지
- 수정 전 : 맛집 구분 없음
- 수정 후 : `is_matjip` 컬럼, `matjip_only` 쿼리·체크박스·「맛집만」필터, 수입 시 0

17. 네이버 수입 시 거리·도보

- 기준점 기준 직선 거리·도보 분 저장
- 수정 전 : 좌표·거리 미저장
- 수정 후 : `mapx`/`mapy`→WGS84, `NAVER_REFERENCE_*` 있으면 Haversine `distance_meters`·`walk_minutes`, 없으면 좌표만

18. 위·경도 DECIMAL + 기준점 API 노출

- 좌표 정밀도·화면 안내
- 수정 전 : `latitude`/`longitude` INT 등으로 잘림, 기준점 미노출
- 수정 후 : `DECIMAL(10,7)`, 응답 `reference_location`, 목록·추천·수정에 좌표 안내

19. schema.sql MariaDB 동기화

- SQL Server DDL 파일을 MariaDB 기준본과 맞춤
- 수정 전 : `schema.sql` 구버전 컬럼
- 수정 후 : `schema_mariadb.sql`과 동일 컬럼·`UNIQUE (source,external_id)`, `RULES_MEMO.md` DDL 동시 반영 규칙

20. 스키마 기준본·마이그레이션 역할 정리

- 신규 DB vs 기존 DB 절차 문서화
- 수정 전 : schema·migration 역할 혼재
- 수정 후 : `schema_mariadb.sql`=신규 일괄, `migration_*.sql`=기존 DB만, `.env.example` 순서·`schema.sql` 줄바꿈 정리

21. 네이버 도보 분 오류 완화

- 234분 등 비정상 walk_minutes 방지
- 수정 전 : LAT/LNG 오류·중복 스킵으로 옛 walk 유지, 직선÷60만 사용
- 수정 후 : LAT/LNG 교정·한국 범위 검사, 우회 1.25·75m/분, 3.5km 초과 walk NULL, naver 중복 UPDATE, `verify-naver` 미리보기

22. verify·.env 기준점 안내

- 가산(대륭19차) 기준 예시·오설정 경고
- 수정 전 : 기본 검색어 `강남역`, 기준점 혼동 가능
- 수정 후 : `NAVER_IMPORT_QUERIES` 첫 항목, 검색어 vs 기준점 로그, 5km 이상 경고, `.env.example` 가산 좌표 예시

23. 기준점 변경 후 거리·도보 재계산 CLI

- `.env` LAT/LNG만 바꾼 뒤 naver 행 거리 재계산
- 수정 전 : 수동 재수입 또는 옛 `distance_meters`·walk 유지
- 수정 후 : `npm run recalc:naver-distances`, `recalculateNaverDistancesFromEnv`

----------------------------------------------------------------------------------------------------

## 2026.05.13

1. DB 연동 변경

- SQL Server에서 MariaDB(`mysql2`)로 전환
- 수정 전 : `mssql`, `dbo.` 스키마, `@param` 바인딩
- 수정 후 : `mysql2`, `?` 바인딩, 외부 DB `terp_db` (`findeat_db` 신규 생성은 권한 문제로 보류)

2. restaurants 스키마 확장

- 수입·동기화용 컬럼 추가
- 수정 전 : 기본 식당 필드만
- 수정 후 : 좌표, 거리, `source`, `external_id`, 전화, URL, 동기화 시각, `UNIQUE (source, external_id)` 가이드

3. 거리 필터 통일

- 화면·서버 거리·도보 매핑을 하나로 맞춤
- 수정 전 : 100/200/300m → 2/3/5분
- 수정 후 : 100/300/600m → 2/5/10분 (`server.js`, `public/index.html`)

4. 규칙·일지 문서 추가

- 작업 규칙과 개발 일지 파일 분리
- 추가 : `PROJECT_NOTES.md`(규칙·고정 정보), `DEV_LOG.md`(날짜별 일지), `.env` 미읽기 규칙

5. 주변 식당 자동 수집 (계획)

- 외부 API import 방향만 문서화
- 수정 전 : 미구현
- 수정 후 : 외부 장소 API + import 흐름·스키마 방향 정리(코드 없음)

6. DEV_LOG 작성 형식 정리

- 일지 항목 구조 통일
- 수정 전 : 자유 서술
- 수정 후 : `번호. 제목` → 바로 아래 디테일 불릿

7. 규칙 메모 파일 이름 변경

- 규칙 전용 파일명 변경
- 수정 전 : `PROJECT_NOTES.md`
- 수정 후 : `RULES_MEMO.md` (내부·DEV_LOG 참조 문구 동기화)

8. DEV_LOG 줄바꿈 규칙

- 제목과 본문 사이 빈 줄 금지
- 수정 전 : 제목·디테일 사이 빈 줄 허용
- 수정 후 : 제목 다음 줄부터 바로 디테일

----------------------------------------------------------------------------------------------------

## 2026.05.12

1. 프로젝트 초기 구성

- FindEat 저장소 골격 신규 생성
- 추가 : Express 백엔드 + `public/` 정적 프론트 + `.env` DB·포트 설정

2. SQL Server 연동

- 로컬 DB를 SQL Server Express로 연결
- 추가 : 드라이버 `mssql`, `SQLEXPRESS` 연결 문자열

3. restaurants 테이블·API

- 식당 CRUD·목록·추천 API 최초 구현
- 추가 : 컬럼(이름, 카테고리, 주소, 도보 분, 메모, 등록일), `/api/restaurants`·`/pick`·`/categories`·`health`

4. 거리 필터 (초기)

- 거리(m)와 도보(분) 매핑 정의
- 수정 전 : 100/200/300m → 2/3/5분
- 수정 후 : DB `walk_minutes` 컬럼과 위 매핑 저장

5. SQL 스크립트

- SQL Server용 DDL·시드 추가
- 추가 : `sql/schema.sql`, `sql/seed.sql`

----------------------------------------------------------------------------------------------------
