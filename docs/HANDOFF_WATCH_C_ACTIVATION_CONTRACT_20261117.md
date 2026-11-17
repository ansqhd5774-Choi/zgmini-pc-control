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

## 사용자 직접 C급 설정 전 확인할 실제 조건

- **호스트와 사용자:** PC는 `DESKTOP-N62L0NG`이어야 한다. 별도 저권한 Windows 사용자로 로그인할 때 자동 실행하는 태스크를 선택한다. 이미 등록된 GitHub Runner 서비스·6개 운영 Runner에는 변경하지 않는다.
- **실행 source (PR #1920 main 병합 pin, 운영 C 설치는 별도):** 기존 pin `0a30d3061d25fc826e2b149046dea46d123e785e`는 예외 로그에 비밀정보를 노출할 수 있는 이전 watcher 소스로 **신규 설치 불허**. [PR #1920](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1920)을 안전 오류코드 출력으로 수정한 뒤 main squash SHA **`f1a280b9c24ec8d01ee228115b92ebb964f49802`**로 병합했다. 격리 Windows [CI #44035399650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44035399650)에서 463/463 PASS, C996 #44035374844 SUCCESS이며, 병합 이후 main과 이 불변 SHA의 7개 실행 소스 Git blob을 **7/7 동일** 재확인했다. **사용자 C급 직접 설치 검증은 아직 없으므로 CI가 운영 가동 승인은 아니다.** 실제 PC의 사용자 승인된 고정 읽기 전용 위치에는 아래 정확 7파일만 같은 불변 SHA에서 가져와 상대 폴더 구조를 유지한다. 일회성 Runner `_work`를 쓰거나 임의 경로·토큰·저권한 Windows 계정을 추정하지 않는다.

  | 설치 대상 소스 확인 항목 | Git blob SHA-1 (확정 main 소스 `f1a280b9…`, **C급 설치 별도**) |
  |---|---|
  | `agent-handoff/intake-watch-5s.mjs` | `2515dd83b96f76146dc75991fa8648cae6d42382` |
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
