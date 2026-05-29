# GitHub Actions (CI/CD)

`main`에 push하면 **CI(검사)** 후 **CD(테스트 서버 배포)** 가 실행됩니다.  
PR은 **CI만** 돌고 서버는 건드리지 않습니다.

| 단계 | 어디서                              | 하는 일                                                      |
| ---- | ----------------------------------- | ------------------------------------------------------------ |
| CI   | GitHub 호스트 (Ubuntu)              | `npm ci`, `npm run check`                                    |
| CD   | **self-hosted Runner** (Windows VM) | `C:\dev\FindEat`에서 pull → `npm ci` → `pm2 restart findeat` |

워크플로 파일: `.github/workflows/ci-cd.yml`

---

## 1. Runner 설치 (테스트 서버, 최초 1회)

1. RDP로 **네이버 클라우드 Windows VM** 접속
2. 브라우저 → `https://github.com/SdragonJ/FindEat` → **Settings** → **Actions** → **Runners**
3. **New self-hosted runner** → OS **Windows** → 안내 명령 복사
4. Download·Extract까지 끝낸 뒤 **Configure** — 아래 **A(권장)** 또는 **B**
5. GitHub **Runners**에 **Idle** 보이면 완료. **`run.cmd`는 서비스 등록 시 실행하지 않음**

### A. Configure — 질문 없이 (권장, PowerShell에서 `Exiting...` 날 때)

**관리자 cmd**(PowerShell 말고 `cmd.exe`)에서:

```bat
cd C:\Users\Administrator\actions-runner
config.cmd --url https://github.com/SdragonJ/FindEat --token 여기_새_토큰 --name findeat-test --unattended --runasservice
```

PowerShell에서는 `config.cmd` 대신 **`.\config.cmd`** 로 실행합니다.  

- 토큰: GitHub Runners → **New self-hosted runner** → Configure 줄에만 잠깐 표시되는 값 (**만료 빠름**, 채팅·스크린샷에 올리지 말 것)
- 이미 같은 이름 Runner가 있으면 `--replace` 추가
- 성공 후 **`run.cmd` 실행 안 함**

### B. Configure — 대화형 (cmd 권장)

PowerShell 대신 **관리자 cmd**에서 `config.cmd --url ... --token ...` 실행 후, 질문마다 Enter / 서비스 **Y**.  
중간에 Ctrl+C 하면 `Exiting...` · `Not configured` 가 납니다.

### Runner 등록이 안 될 때

| 증상                                       | 조치                                               |
| ------------------------------------------ | -------------------------------------------------- |
| runner group 질문 직후 `Exiting...`        | **cmd** + 위 **A** (`--unattended --runasservice`) |
| `Not configured` + `run.cmd`               | config **미완료** — `run.cmd` 말고 **A** 다시      |
| 404 on registration                        | 토큰 **새로** 받아 1~2분 안에 config               |
| `config.cmd remove` — config files missing | 한 번도 성공 안 한 상태 → **A** 로 새로 등록       |

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

| 원인                         | 확인                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| Runner 오프라인              | Settings → Actions → Runners 에 **Idle** 인지                |
| CI 실패                      | deploy는 CI 성공 후에만 실행                                 |
| `main`이 아님                | 다른 브랜치 push는 CD 없음                                   |
| `C:\dev\FindEat` 없음        | clone 경로·`DEPLOY_PATH`                                     |
| `git pull` 실패              | private repo 자격 증명                                       |
| `pm2` 없음                   | PATH, `pm2 restart findeat` 이름                             |
| `.git/FETCH_HEAD` EPERM      | Runner 서비스 로그온 계정 확인 (`.\Administrator` 권장)      |
| `node_modules` EPERM unlink  | 서비스 계정 권한·백신 파일 잠금·동시 프로세스 확인           |
| `Test-Path ... UnauthorizedAccess` | 서비스 계정이 `C:\Users\Administrator\...` 접근 불가. CD는 로컬 prefix(`C:\dev\FindEat\.npm-global`)로 pm2 설치 fallback 사용 |
| CD `pwsh: command not found` | workflow는 `powershell`(5.x) 사용. pwsh 미설치 서버에서 발생 |

### Runner 서비스가 Stopped / Offline일 때

1. `run.cmd` 창이 열려 있으면 **Ctrl+C**로 종료 (서비스와 동시 실행 금지)
2. `Get-Process Runner.Listener -ErrorAction SilentlyContinue | Stop-Process -Force`
3. `Start-Service "actions.runner.SdragonJ-FindEat.findeat-test"`
4. 안 되면 `services.msc` → 해당 서비스 → **시작**, 또는 `_diag` 최신 로그 확인

### `Access to the path 'C:\Users\Administrator' is denied` (로그)

Runner를 **`C:\Users\Administrator\actions-runner`** 에 두고 서비스가 **NETWORK SERVICE** 로 돌면 자주 납니다.  
→ Runner는 **`C:\actions-runner`** 에 두는 것을 권장 (GitHub 안내와 동일).

```powershell
# 기존 제거 (Administrator 폴더)
cd C:\Users\Administrator\actions-runner
Get-Process Runner.Listener -ErrorAction SilentlyContinue | Stop-Process -Force
.\config.cmd remove --unattended

# 새 폴더에 Download~Extract 후 Configure (GitHub Runners 화면 명령, 경로만 C:\actions-runner)
cd C:\
mkdir actions-runner -Force
cd C:\actions-runner
# … Invoke-WebRequest, Expand-Archive …
.\config.cmd --url https://github.com/SdragonJ/FindEat --token 새_토큰 --name findeat-test --unattended --runasservice
```

또는 서비스 **로그온을 `.\Administrator`** 로 바꾸면 같은 경로에서도 될 수 있으나, **`C:\actions-runner` + CD용 `git pull`/`pm2`** 가 더 단순합니다.

### CD 로그에 단계 이름이 안 보일 때

`ci-cd.yml` Deploy 스크립트는 각 단계(`git fetch`, `npm ci`, `pm2 restart`) 뒤에 종료 코드를 검사합니다.  
실패 시 `Step failed: ...` 형태로 실패 지점을 바로 표시하므로, 해당 단계의 권한/경로를 우선 확인합니다.

---

## 4. 환경 변수 (워크플로에서 변경 가능)

`ci-cd.yml` deploy job:

| 변수           | 기본값           |
| -------------- | ---------------- |
| `DEPLOY_PATH`  | `C:\dev\FindEat` |
| `PM2_APP_NAME` | `findeat`        |

`.env`는 Git에 없으며 **서버에만** 둡니다. CD는 `.env`를 덮어쓰지 않습니다.

---

## 5. 이 저장소에 workflow를 처음 push한 뒤

1. 이 문서 + `.github/workflows/ci-cd.yml` 을 `main`에 merge
2. 서버에 Runner 설치 (위 1번)
3. `main`에 아무 작은 commit push → Actions에서 CI·CD 녹색 확인
4. `http://127.0.0.1:3001/` (또는 공인 IP:3001) 동작 확인
