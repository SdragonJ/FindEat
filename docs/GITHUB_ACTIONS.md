# GitHub Actions (CI/CD)

`main`에 push하면 **CI(검사)** 후 **CD(테스트 서버 배포)** 가 실행됩니다.  
PR은 **CI만** 돌고 서버는 건드리지 않습니다.

| 단계 | 어디서 | 하는 일 |
|------|--------|---------|
| CI | GitHub 호스트 (Ubuntu) | `npm ci`, `npm run check` |
| CD | **self-hosted Runner** (Windows VM) | `C:\dev\FindEat`에서 pull → `npm ci` → `pm2 restart findeat` |

워크플로 파일: `.github/workflows/ci-cd.yml`

---

## 1. Runner 설치 (테스트 서버, 최초 1회)

1. RDP로 **네이버 클라우드 Windows VM** 접속
2. 브라우저 → `https://github.com/SdragonJ/FindEat` → **Settings** → **Actions** → **Runners**
3. **New self-hosted runner** → OS **Windows** → 안내 명령 복사
4. **관리자 PowerShell**에서 실행 (예: `C:\actions-runner` 폴더에 설치)
5. 설치 마지막에 **서비스로 등록** 권장 → VM 재부팅 후에도 Runner 유지

### 서버 사전 확인

```powershell
git --version
node -v
pm2 -v
cd C:\dev\FindEat
git pull origin main
```

- **private 저장소**: Runner가 돌아가는 Windows 계정에서 `git pull`이 되어야 합니다.  
  (Git Credential Manager에 로그인되어 있거나, Deploy key / PAT 설정)
- **pm2**: `npm install -g pm2` 후 `pm2 start server.js --name findeat` 은 이미 해 둔 상태 가정

### GitHub 연결 테스트

```powershell
Invoke-WebRequest -Uri "https://github.com" -UseBasicParsing -TimeoutSec 15
Invoke-WebRequest -Uri "https://api.github.com" -UseBasicParsing -TimeoutSec 15
```

---

## 2. 일상적인 개발 흐름

```text
[PC] 수정 → commit → push (main 또는 PR)

PR / feature 브랜치  →  CI만 (배포 없음)
main push            →  CI 통과 후 CD (자동 pull + pm2 restart)
```

수동 배포가 필요하면 예전처럼 서버에서:

```powershell
cd C:\dev\FindEat
git pull origin main
npm ci --omit=dev
pm2 restart findeat
```

---

## 3. Actions 결과 보기

GitHub → **Actions** 탭 → `CI/CD` 워크플로 실행 목록  
실패 시 로그에서 `Deploy` job 단계 확인.

### CD가 안 돌 때

| 원인 | 확인 |
|------|------|
| Runner 오프라인 | Settings → Actions → Runners 에 **Idle** 인지 |
| CI 실패 | deploy는 CI 성공 후에만 실행 |
| `main`이 아님 | 다른 브랜치 push는 CD 없음 |
| `C:\dev\FindEat` 없음 | clone 경로·`DEPLOY_PATH` |
| `git pull` 실패 | private repo 자격 증명 |
| `pm2` 없음 | PATH, `pm2 restart findeat` 이름 |

---

## 4. 환경 변수 (워크플로에서 변경 가능)

`ci-cd.yml` deploy job:

| 변수 | 기본값 |
|------|--------|
| `DEPLOY_PATH` | `C:\dev\FindEat` |
| `PM2_APP_NAME` | `findeat` |

`.env`는 Git에 없으며 **서버에만** 둡니다. CD는 `.env`를 덮어쓰지 않습니다.

---

## 5. 이 저장소에 workflow를 처음 push한 뒤

1. 이 문서 + `.github/workflows/ci-cd.yml` 을 `main`에 merge
2. 서버에 Runner 설치 (위 1번)
3. `main`에 아무 작은 commit push → Actions에서 CI·CD 녹색 확인
4. `http://127.0.0.1:3001/` (또는 공인 IP:3001) 동작 확인
