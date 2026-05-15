# FindEat — RULES_MEMO (규칙 메모)

> **이 프로젝트에서 작업할 때마다 항상 이 파일을 먼저 읽고 규칙을 따른다.**  
> 개발 이력·수정 내역은 `DEV_LOG.md`에만 쓴다. 이 파일에는 규칙과 고정 메모만 둔다.

---

## 파일 역할

| 파일                | 용도                                                         |
| ------------------- | ------------------------------------------------------------ |
| **`RULES_MEMO.md`** | 규칙 메모 — 강제 규칙·항상 지켜야 할 지시·프로젝트 고정 정보 |
| **`DEV_LOG.md`**    | 개발 일지 (날짜별로 무엇을 바꿨는지 기록)                    |
| **`.cursor/rules/*.mdc`** | Cursor 에이전트용 — DEV_LOG·주석 등 자동 행동 규칙     |

---

## 필수 규칙 (항상 적용)

1. **작업 시작 전** `RULES_MEMO.md`와 `DEV_LOG.md`를 읽는다.
2. **`DEV_LOG.md` (개발 일지)**  
   - 에이전트는 사용자가 따로 요청하지 않아도, 이 저장소에서 **의미 있는 변경을 마친 뒤** 같은 세션에서 `DEV_LOG.md`에 **오늘 날짜**로 요약을 추가한다.  
   - 오늘 날짜의 `## YYYY.MM.DD` 섹션이 없으면 **새 섹션**을 만든다(이전 날짜 아래 `---` 구분).  
   - 큰 DB·배포 변경은 **시작 전** 한 줄 의도를 적는 것을 권장한다. 형식은 파일 상단 안내와 동일.
3. **`.env`는 읽지 않는다.** 비밀번호·DB 접속 정보 등 보안 내용이 들어 있다.
4. DB 연결 값이 필요하면 `server.js`의 환경변수 **이름**만 참고하고, 실제 값은 사용자에게 묻거나 `.env.example` 구조만 본다.
5. **주석 (초급자 설명)**  
   - 사용자가 따로 요청하지 않아도, **의미 있는 코드·스키마 수정**을 할 때마다 **함수/라우트 위 요약**과, 필요하면 **왜 이렇게 했는지**를 한국어로 짧게 남긴다.  
   - 세부 규칙은 `.cursor/rules/beginner-comments.mdc`를 따른다. (다른 프레임워크와의 비교 문구는 넣지 않는다.)

---

## 프로젝트 고정 정보 (비밀 아님)

| 항목        | 내용                                                     |
| ----------- | -------------------------------------------------------- |
| 스택        | Node.js + Express + **mysql2** (MariaDB)                 |
| DB          | 외부 리눅스 MariaDB (`175.45.194.189:3307`)              |
| 사용 DB     | **`terp_db`**                                            |
| 핵심 테이블 | `restaurants` — `source`, `user_touched_at`, `rating`, `is_matjip`. 마이그레이션: `sql/migration_mariadb_restaurants_source.sql`, `sql/migration_mariadb_restaurants_user_touched_at.sql`, `sql/migration_mariadb_restaurants_rating.sql`, `sql/migration_mariadb_restaurants_is_matjip.sql` |
| 백엔드      | `server.js`                                              |
| 프론트      | `public/`                                                |
| 예전 SQL    | `sql/schema.sql`, `sql/seed.sql` — SQL Server용 (레거시) |

---

## 사용자 메모 (규칙·지시 추가란)

- `RULES_MEMO.md` = 규칙 메모 / `DEV_LOG.md` = 개발 일지. 이 구분은 이후 작업에서도 항상 유지한다.
- `DEV_LOG.md` 작성 형식: **`번호. 제목` → 바로 아래 디테일**(제목과 디테일 사이 빈 줄 없음, 핵심만).
- 코드 수정 시 **초급자용 주석**은 매번 알아서 달 것(별도 요청 불필요). `.cursor/rules/beginner-comments.mdc`.
