# ZGMINI 공통 대기열 5초 감시 — C급 1회 활성화 계약 (2026-11-17)

**대상:** `DESKTOP-N62L0NG` (격리 공통 대기열 PC). **상태:** 승인·설치 전 운영 준비 절차. 이 문서만으로 Windows 작업·서비스·인증이 등록되지 않음.

## 선택된 구조

1. 기존 GitHub Actions 격리 Runner `zgmini-handoff-ci-spare-01`는 **정상 이벤트 기반 접수 및 15분 관제**를 계속 처리한다. Runner의 유일한 ZGMINI 좌석을 5초 상주 작업이 점유하지 않는다.
2. 5초 감시 소스 `agent-handoff/intake-watch-5s.mjs`는 **별도 저권한 Windows 사용자 프로세스**로 기동한다. GitHub 저장소의 열려 있는 `agent-handoff` Issue 변경을 5초 간격 조건부 GET으로 읽고, 변경된 사건의 `HANDOFF_ROUTED` 원본 영수증만 인증된 읽기 작업으로 검증한다. 자동 PC 재실행·원본 Issue 쓰기·ChatGPT 대화 자동 기동은 하지 않는다.
3. Windows 자격 관리에 안전하게 보관된 GitHub CLI 인증을 사용할 때는 `ZGMINI_HANDOFF_WATCH_AUTH_SOURCE=GH_CREDENTIAL_STORE`를 설정한다. `gh auth token --hostname github.com`의 **stdout을 해당 Node 프로세스의 메모리에서만 읽어** 조건부 GET에 사용한다. 토큰은 인수·로그·Issue·예약 명령문에 넣지 않고 60초 내 캐시를 갱신한다.
4. 정상 조회 주기는 5초, GitHub 제한 시 `Retry-After`·rate-limit reset을 지키고, 401 인증 거부 시 반복 재시도 없이 중단한다. **12회 조회마다 1회** 비민감 `WATCH_HEARTBEAT`(관측 최소/최대 간격·백오프 유무)을 기록한다.

## 사용자 직접 C급 설정 전 확인할 실제 조건

- **호스트와 사용자:** PC는 `DESKTOP-N62L0NG`이어야 한다. 별도 저권한 Windows 사용자로 로그인할 때 자동 실행하는 태스크를 선택한다. 이미 등록된 GitHub Runner 서비스·6개 운영 Runner에는 변경하지 않는다.
- **실행 source:** 운영 checkout/Runner의 일회성 `_work`가 아닌, 사용자 승인된 고정 읽기 전용 소스 위치에 **정확한 검증 SHA**의 `agent-handoff/` 파일과 필요한 import 모듈이 있어야 한다. 실제 경로/Node 위치가 확인될 때까지 `C:\...`나 운영 PC `E:\...` 경로를 임의로 기입하지 않는다.
- **Node:** 위 사용자/부팅 컨텍스트에서 실행 가능한 고정 Node22 실행파일의 실제 경로·실행 해시를 확인한다. Actions의 `setup-node` 성공만으로 상주 실행이 가능한지 판단하지 않는다.
- **인증:** 동일 Windows 계정의 공식 GitHub CLI 설치 여부·인증 상태·저장 방식 확인. `gh auth status --hostname github.com`에 저장 방식이 안전한 Windows 자격 저장소인지 확인하고, 평문 파일 저장 또는 인증 불명확 시 **STOP**. 최소한 해당 private 제어 저장소의 `Issues: read` 권한만 사용해야 하며, 광범위 OAuth `repo` 권한을 새로 부여하는 것은 기본값이 아니다. GitHub CLI 설치/로그인이 없으면 이 경로는 사용 불가이며 미설치로 판정한다.
- **Windows 작업 스케줄러:** 사용자 직접 `ZGMINI-HANDOFF-WATCH`라는 별도 `ONLOGON` 작업을 최소 권한(`LIMITED`)으로 등록한다. **기존 항목 있으면 덮어쓰지 않고 중단**. 실행 파일은 확인한 Node22 절대경로, 인수는 고정 소스의 `agent-handoff/intake-watch-5s.mjs`만. 작업 시작 시 **중복 인스턴스 실행 금지**, 오류 시 제한된 횟수·간격으로만 재시작, 부팅/로그인 재개를 구성한다. 이 등록은 C급 사용자 직접 설정이며 GitHub PR/ChatGPT 도구가 대신하지 않는다.
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
