> **폐기됨 (2026-11-20):** 사용자 요청으로 5초 감시기 도입을 중단하고 별도 실행기·사용자 C급 활성화 도구를 소스에서 제거했다. 이 문서의 설치 명령·C급 사용자 실행 절차·승인 후보는 **더 이상 실행하지 않는다**. 당시 pin과 증거는 변경하지 않은 역사 기록이다. 현재 공식 Handoff 접수는 기존 GitHub 이벤트 기반 Workflow·15분 관제만 유지한다. 이전 격리 PC 실측 Issue #2384 / Run #44557834733에서 대상 ZGMINI Task 미등록을 확인했으며, 실행 중인 임의 프로세스를 이 증거만으로 특정·종료하지 않는다.

# ZGMINI 공통 대기열 5초 감시 — C급 1회 활성화 계약 (2026-11-17)

**대상:** `DESKTOP-N62L0NG` (격리 공통 대기열 PC). **상태:** 승인·설치 전 운영 준비 절차. 이 문서만으로 Windows 작업·서비스·인증이 등록되지 않음.

## 선택된 구조

1. 기존 GitHub Actions 격리 Runner `zgmini-handoff-ci-spare-01`는 **정상 이벤트 기반 접수 및 15분 관제**를 계속 처리한다. Runner의 유일한 ZGMINI 좌석을 5초 상주 작업이 점유하지 않는다.
2. 5초 감시 소스 `agent-handoff/intake-watch-5s.mjs`는 **별도 저권한 Windows 사용자 프로세스**로 기동한다. GitHub 저장소의 열려 있는 `agent-handoff` Issue 변경을 5초 간격 조건부 GET으로 읽고, 변경된 사건의 `HANDOFF_ROUTED` 원본 영수증만 인증된 읽기 작업으로 검증한다. 자동 PC 재실행·원본 Issue 쓰기·ChatGPT 대화 자동 기동은 하지 않는다.
3. Windows 자격 관리에 안전하게 보관된 GitHub CLI 인증을 사용할 때는 `ZGMINI_HANDOFF_WATCH_AUTH_SOURCE=GH_CREDENTIAL_STORE`를 설정한다. `gh auth token --hostname github.com`의 **stdout을 해당 Node 프로세스의 메모리에서만 읽어** 조건부 GET에 사용한다. 토큰은 인수·로그·Issue·예약 명령문에 넣지 않고 60초 내 캐시를 갱신한다.
4. 정상 조회 주기는 5초, GitHub 제한 시 `Retry-After`·rate-limit reset을 지키고, 401 인증 거부 시 반복 재시도 없이 중단한다. **12회 조회마다 1회** 비민감 `WATCH_HEARTBEAT`(관측 최소/최대 간격·백오프 유무)을 기록한다.

## 읽기 전용 C 사전검사 (실행·설치·승인 아님)

- **검사 소스:** `tools/handoff-watch-c-preflight.mjs`는 **별도 임시 검증 checkout**에 둔 채 해당 checkout에서만 `node tools/handoff-watch-c-preflight.mjs`로 검사한다. 실제 watcher C 설치의 원래 **7개 파일 범위에는 이 검사기를 포함하지 않는다**. 소스를 임의 복사하거나 신뢰하지 않은 checkout에서 실행하지 않는다.
- **로컬 확인 항목:** 이 검사기는 7개 승인 후보 파일의 Git blob 바이트 해시(Windows CMD 하나는 CRLF→LF 정규화 결과가 **정확히 동일 Git blob**인 경우에만 허용, 이때 `windowsCmdCrLfNormalized=true` 표시), `DESKTOP-N62L0NG` 호스트, Windows 운영체제, Node 22, 원시 `GITHUB_TOKEN`·`GH_TOKEN` 환경변수 부재만 로컬에서 읽는다. 결과는 `sourceFilesMatched`, `hostMatch`, `node22`, `rawTokenEnvironmentAbsent`와 상태 코드만 반환하며 사용자 계정명·경로·GitHub 토큰은 출력하지 않는다. `tools/handoff-watch-user-start.cmd`는 Git checkout의 LF를 우선 보존하도록 해당 파일만 `text eol=lf`로 고정한다. 기존 Windows checkout이 CRLF를 남겼을 때에도 CMD의 **줄바꿈만** 정상화해 Git blob 내용의 동일성을 확인하고, 다른 문자·명령 변경은 계속 STOP한다.
- **결과 해석:** `SOURCE_PREFLIGHT_STOP`이면 **설치 전 중단**. `SOURCE_PREFLIGHT_PASS_C_AUTH_AND_TASK_REQUIRED`는 **바이트·호스트·Node 사전검사만 통과**한 상태다. 이 결과는 실제 Windows Task 등록, 안전한 Windows 자격 저장·최소권한, 작업 실행권한, 자동 재기동, 5초 heartbeat, 영수증 검증, Runner 비간섭을 인증하지 않는다. 이 후속 요건은 기존 C급 사용자 직접 확인·승인·실행 절차에 남긴다.
- **권한 경계:** 검사기는 외부 HTTP·GitHub API·인증 조회, Task 스케줄러 명령, 서비스·파일 생성·설치, 감시 루프 실행을 전혀 수행하지 않는다. 운영 PC 임의 원격 실행이나 새 Windows 사용자/토큰 등록을 승인하지 않는다.

## 공통 대기열 PC 한정 — 일반 사용자 직접 활성화 경로

**권한 구분:** 이 PC는 데이터 수집 운영 PC와 다른 `DESKTOP-N62L0NG`이다. 공통 대기열 PC에서 현재 로그인한 일반 사용자 명의로 만드는 `ONLOGON / Interactive / RunLevel Limited` 작업에는 Windows 관리자 상승이 필수인 것은 아니다. 다만 OS/조직 정책이 막으면 실패를 보고하고 중단하며 SYSTEM·관리자·기존 Runner 서비스로 우회하지 않는다. 과거 문서의 `C급`은 기존 프로젝트 내부 변경 분류이고 **다른 운영 PC의 관리자 승인을 자동으로 요구한다는 뜻은 아니다**.

- **제공된 사용자 직접 도구:** `tools/handoff-watch-user-activate.ps1`은 인터랙티브 사용자 PC에서만 실행하도록 호스트·세션 0 금지·서비스 계정 금지·원시 토큰 환경변수 부재를 검사한다. **기본 실행은 읽기 전용**이고 `-Apply`가 있어야 변경 가능하다. 사용자가 기존 GitHub 토큰이 이 제어 저장소의 `Issues:read` 정도로 제한됐음을 직접 확인하고 `-ConfirmRestrictedCredential`를 전달해야 등록한다. 권한 검증을 GitHub 읽기 API 성공만으로 과장하지 않는다.
- **소스 경로:** 개인 로그인 계정에서 접근 가능한 **신뢰된 체크아웃**에서 실행한다. Runner `_work` 폴더나 운영 PC에서 실행하지 않는다. Node22의 검증된 `node.exe`와 `gh.exe`가 필요하다. 도구는 체크아웃의 정해진 **7개 Git blob SHA-1**과 `C_SOURCE_COMMIT=82e06469569bb6842aa4aca43970d84262329481`을 읽기 전용 검사한 다음, 대상 파일 7개만 현재 사용자의 `%LOCALAPPDATA%\ZGMINI\handoff-watch`에 **신규 복사**한다. 기존 대상 폴더나 이름이 같은 예약 작업이 있으면 덮어쓰지 않고 중단한다. 복사 후 동일 해시를 재검사한다.
- **보안 자격:** 작업 등록 전 GitHub CLI가 해당 로그인 사용자에서 동작하고 private 제어 저장소 Issues GET이 가능한지 출력 없이 확인한다. `GH_TOKEN`·`GITHUB_TOKEN` 환경 입력, `GH_CONFIG_DIR` 사용자 정의, 기본 `hosts.yml`의 평문 `oauth_token` 또는 토큰 문자열은 **STOP**. 토큰·계정명·절대경로·CLI 오류 원문을 GitHub/채팅/CI에 노출하지 않는다. 새 로그인이나 토큰 생성·권한 확대는 자동 수행하지 않는다.
- **예약 등록:** 검증된 사용자 계정의 `ZGMINI-HANDOFF-WATCH`를 `Interactive / Limited / ONLOGON`으로만 등록한다. 재실행은 최대 2회·5분 간격, 동시 인스턴스 중복 실행 금지. 기존 Runner/Task의 속성 변경이나 운영 PC 접근 없음. 등록 시 시작을 요청하지만 `REGISTERED_START_REQUESTED_HEARTBEAT_PENDING`는 5초 실제 가동 완료를 의미하지 않는다.
- **실행 순서:** 관리자 PowerShell이나 GitHub Actions Runner가 아닌 일반 사용자 로그인 PowerShell에서 신뢰된 소스 루트로 이동해 아래 두 명령을 사용한다. 첫 번째는 완전 읽기 전용; 첫 번째의 `READONLY_READY_USER_APPLY_REQUIRED` 결과와 최소권한 저장소 확인 후 두 번째를 실행한다.

```powershell
powershell -NoProfile -File .\tools\handoff-watch-user-activate.ps1
powershell -NoProfile -File .\tools\handoff-watch-user-activate.ps1 -Apply -ConfirmRestrictedCredential
```

**검증/보류:** 실제 PC `WATCH_HEARTBEAT` 최소 2회, 정상 창의 `successfulReadsInWindow=12`·`failedReadsInWindow=0`·`backoffCyclesInWindow=0`, 관측 시작 간격 및 실제 영수증·Runner 비간섭을 확인하기 전에는 계획의 마지막 5/5단계를 완료로 변경하지 않는다. 사용자 로그인 환경이 없거나 자격 저장·기존 작업 조건을 만족하지 못하면 `RUNTIME_ACTIVATION_BLOCKED` 유지. 이 스크립트는 GitHub 소스 병합만으로 자동 실행되지 않는다.

## 사용자 직접 C급 설정 전 확인할 실제 조건

- **호스트와 사용자:** PC는 `DESKTOP-N62L0NG`이어야 한다. 별도 저권한 Windows 사용자로 로그인할 때 자동 실행하는 태스크를 선택한다. 이미 등록된 GitHub Runner 서비스·6개 운영 Runner에는 변경하지 않는다.
- **실행 source (heartbeat 집계 수정 완료, C 설치는 별도):** 이전 확정 pin `f1a280b9c24ec8d01ee228115b92ebb964f49802`는 12회 관측창에서 정상 조회·실패 조회·백오프 횟수를 구분하지 못한 감시기 버전으로 신규 설치에서 제외한다. [PR #1925](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1925)의 감시기 heartbeat 집계를 수정해 main squash **`82e06469569bb6842aa4aca43970d84262329481`**에 병합했다. 격리 Windows [CI #44037276119](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44037276119) **466/466 PASS**, C996 #44037249894 SUCCESS. 병합 직후 7개 watcher/CMD Git blob이 이 불변 commit과 main에서 **7/7 동일**함을 독립 재조회했다. 설치용 후보는 이 불변 commit의 정확 7파일(6개 watcher 모듈과 CMD 1개)로만 제한한다. **이 SHA 확정은 실제 Windows 상주 Task 설치·보안 인증·자동 재시작의 승인이 아니며, 해당 C급 확인 전 실제 설치·가동을 주장하지 않는다.** Runner 일회성 `_work` 경로에 상주 설치하지 않으며 사용자/경로/토큰을 추정하지 않는다.

  | 설치 대상 소스 확인 항목 | Git blob SHA-1 (확정 source pin `82e06469…`; **C급 설치 별도**) |
  |---|---|
  | `agent-handoff/intake-watch-5s.mjs` | `ac3bf7cd987e2ac4bacdcd94105a7689344bae7e` |
  | `agent-handoff/intake-receipt-readonly.mjs` | `0b97307fc3bf1ed8462a5a6413c3fc8f12bbb08b` |
  | `agent-handoff/queue-selector.mjs` | `964faf91138989cf3b42c44afbb6a77a1d2712b1` |
  | `agent-handoff/queue-priority.mjs` | `5178eb3b531e9f48c7f4ac9bc13888219425ed6a` |
  | `agent-handoff/contract.mjs` | `9b65f341c31a2ef6ac67be6824079806207ad72c` |
  | `agent-handoff/watcher-gh-credential.mjs` | `03340fc943af09c6be7b55e635d09b30ef346ff5` |
  | `tools/handoff-watch-user-start.cmd` | `1b1773df0e9f64093ce509bb1a3590da99096024` |

  위 값은 GitHub **Git blob SHA-1**이며 Windows 파일의 SHA-256이라고 주장하지 않는다. 실제 승인 C급 설치 시에는 원본 commit·실제 바이트/파일 경로·로컬 읽기 권한을 독립 확인하고, 불일치면 **설치 전 STOP**. `main` 최신 HEAD만으로 실제 C 설치 SHA가 갱신됐다고 간주하지 않는다. 실제 경로/Node 위치가 확인될 때까지 운영 PC E:나 C: 경로를 임의로 기입하지 않는다.
- **Node:** 위 사용자/부팅 컨텍스트에서 실행 가능한 고정 Node22 실행파일의 실제 경로·실행 해시를 확인한다. Actions의 `setup-node` 성공만으로 상주 실행이 가능한지 판단하지 않는다.
- **인증:** 동일 저권한 Windows 계정의 공식 GitHub CLI 설치 여부·인증 상태·**실제 저장 위치**를 사용자 로컬에서 확인한다. GitHub CLI는 Windows 자격 저장소 사용 불가 시 `hosts.yml` 평문으로 되돌아갈 수 있다. `gh auth status --hostname github.com`만으로 평문 저장이 없다는 점을 확정할 수 없으면 **STOP**. 이 명령의 원본 출력·스크린샷·토큰 일부도 채팅/Issue/CI에 전송하지 않는다. 최소한 해당 private 제어 저장소의 `Issues: read` 권한만 사용해야 한다. 일반 `gh auth login`의 기본 OAuth 권한(`repo` 등)은 이보다 넓으므로 **5초 감시를 위해 기본 로그인이나 광범위 토큰 발급을 새로 진행하지 않는다**. 안전한 기존 최소권한 자격이 확인되지 않거나 CLI가 세부권한 토큰을 수용하지 못하면 C 등록 전에 **STOP**하고 별도 승인된 인증 경로를 검토한다. GitHub CLI 설치/로그인이 없으면 이 경로는 미설치다.
- **Windows 작업 스케줄러:** 사용자 직접 `ZGMINI-HANDOFF-WATCH`라는 별도 `ONLOGON` 작업을 최소 권한(`LIMITED`)으로 등록한다. **기존 항목 있으면 덮어쓰지 않고 중단**. Windows 작업의 실행 항목은 고정 소스의 **`tools/handoff-watch-user-start.cmd`**를 사용하며, CMD에는 **실제 확인한 Node22 실행파일 절대경로 1개만** 전달한다. 이 CMD는 어떤 서비스/예약도 만들거나 수정하지 않으며 기존 작업을 덮어쓰지 않는다. 시작 직후 자격이 없으면 비정상 종료하고, 정상 동작 시 `%TEMP%\\ZGMINI\\handoff-watch-observation.log`에 비민감 경과·1분당 약 1회 heartbeat만 기록한다. 실제 사용자·고정 소스/Node 경로는 작업 스케줄러 C급 설정에서 확인한 값만 사용한다. 작업 시작 시 **중복 인스턴스 실행 금지**, 오류 시 제한된 횟수·간격으로만 재시작, 부팅/로그인 재개를 구성한다. 이 등록은 C급 사용자 직접 설정이며 GitHub PR/ChatGPT 도구가 대신하지 않는다.
- **비밀 전달:** `GITHUB_TOKEN` 또는 `GH_TOKEN`을 `setx`·작업 인수·로그·파일에 입력하지 않는다. 비민감 플래그 `ZGMINI_HANDOFF_WATCH_ENABLED=true`와 `ZGMINI_HANDOFF_WATCH_AUTH_SOURCE=GH_CREDENTIAL_STORE`만 실행 환경에 적용한다. 같은 프로세스 환경에 `GH_TOKEN`/`GITHUB_TOKEN`이 함께 있으면 소스가 안전하게 거부한다.
- **재시작/회수:** 토큰이 거부되면 무한 재시작하지 않고 자격 저장소를 사용자 직접 정정한다. Task 정지·비활성화는 사용자 직접 하고 원본 GitHub Issue/기존 Runner·DB·작업 결과는 보존한다.

## 사용자 C급 설정 이후 1회 검증

1. Windows 작업 스케줄러에서 `ZGMINI-HANDOFF-WATCH`의 대상 경로·사용자·실행 상태·마지막 실행 결과 확인. 기존 격리 Runner `zgmini-handoff-ci-spare-01`는 정상적으로 기존 Workflow Job을 계속 처리해야 한다.
2. 실제 `WATCH_HEARTBEAT`의 조회 시작 간격 최소·최대값을 2회 이상 수집해 **정상 조건에서 5초 주기**인지 판단. API 지연/백오프가 있다면 해당 시간에 5초 정상 판정 금지.
3. 기존 실제 `agent-handoff` 원본 Issue의 `HANDOFF_ROUTED` 증거를 조회해 `receiptVerified=true` 기록을 확인. 수신 대상 ChatGPT 자동 전달/원담당 ACK는 별도 미완료로 기록한다.
4. GitHub API 남은 할당량·429 대응, CPU/메모리, 기존 GitHub Runner Job 처리 유무를 함께 확인한다. 조회 누락·재시도 폭주 또는 기존 Runner 영향이 있으면 watcher만 비활성화한다.
5. **최종 5/5 완료 조건:** 실제 PC의 독립 감시기 등록+기동/재기동 경로, 안전한 인증, 최소 2회 실측 heartbeat, 정상 영수증 검증, Runner 비간섭 증거. 개발 PR·CI PASS만으로 완료 주장 금지.

## 권한 경계와 STOP

등록·자격 설정·Windows 작업 스케줄러 C급 작업은 사용자 직접 수행한다. 본 지침은 무인 설치 승인, 신규 요금·구독 승인, 운영 PC 설치/배포, 원격 셸/SQL, C급 작업 우회 허가가 아니다.

**참고:** [GitHub CLI 인증](https://cli.github.com/manual/gh_auth_login) — 자격 저장소 미지원 시 평문 파일로 저장될 수 있으며 이를 감지하면 중단. [GitHub REST API 제한](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [Windows 작업 스케줄러 ONLOGON](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create).
