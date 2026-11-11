# ZGMINI 두 물리 PC 운영 명세 — 장비·프로세스·실행·복구

기준일: 2026-11-12 KST. **이 문서는 신규 일반챗이 먼저 읽을 장비별 운영 정본**이다. 기능별 승인·해시·자원 잠금·실행 절차는 기존 AGENTS.md, PC_AUTOMATION_STANDARD.md가 우선한다. 장비 정보는 **당시 관측값**이며 현재 상태의 영구 보장이 아니다.

## 0. 두 PC 및 증거 분류
- 기존 운영 PC: 호스트 PC, Windows 11 Pro, 데이터 수집·저장·계산·승인된 게시가 실제 수행되는 PC.
- 공통 대기열 PC: 호스트 DESKTOP-N62L0NG, Windows 10 Home, GitHub 메타데이터 전용 자동 장애 접수·검증·인계 및 격리 CI 실행 PC.
- 공통점: private ansqhd5774-Choi/zgmini-pc-control GitHub Issue/Actions → 지정 self-hosted Runner → 인증된 결과 JSON/TXT+Issue 보조 댓글.
- 차이점: 역할·Runner 라벨·Windows 버전·Node/실행기 설치·부팅/프로세스 관리가 다르다. 대상 PC와 역할을 구분하지 않고 기존 CMD/ZIP를 새 기본 실행 경로로 만들지 않는다.

증거 구분: [실PC 관측]은 실제 Issue/Run에서 반환된 결과, [운영 계약]은 GitHub 정본 소스/문서에 명시된 규칙, [미확인]은 관측되지 않은 항목이다. 설계/CI PASS는 실PC 설치·자동 복구 PASS를 뜻하지 않는다.

## 1. 하드웨어 및 기본 소프트웨어 — 각 Runner 실측

| 항목 | 기존 운영 PC | 공통 대기열 PC |
| --- | --- | --- |
| PC 호스트 | PC | DESKTOP-N62L0NG |
| OS 버전 | Windows 11 Pro, 10.0.26300 x64 | Windows 10 Home, 10.0.19045 x64 |
| CPU | Intel Core i5-11400H 2.70GHz | Intel Core i5-7300HQ 2.50GHz |
| 논리 CPU | 12 | 4 |
| RAM 총량(MiB) | 16122 | 16301 |
| 가용 RAM(MiB; 관측 순간) | 1036 | 4632 |
| C: 총량 / 가용(MiB) | 487153 / 46064 | 243306 / 53797 |
| E: 총량 / 가용(MiB) | 1907694 / 1580840 | 198690 / 173364 |
| 해당 Run의 Node | v24.19.0, 고정 운영 Node | v22.23.4, 격리 Actions setup-node |
| E:\ZGmini 운영 루트 | 존재 | 없음 |
| E:\ZGmini\runtime\node.exe | 존재 | 없음 |
| E:\ZGmini\automation\pc-control | 존재 | 없음 |
| E:\ZGmini\projects\zgmini-pc-control | 존재 | 없음 |

[실PC 관측] 운영: Issue #1249 / Run 43102349724 / results/pc-host-inventory-43102349724-1-operating.json 및 .txt.
격리: Issue #1245 / Run 43101563767 / results/pc-host-inventory-43101563767-1-handoff.json 및 .txt.
메모리/스토리지 가용량은 수시로 바뀐다. 장비 모델·프로세스 소유권·관리 권한을 운영 계정 이름으로 추정하지 않는다.

## 2. Runner 좌석·호스트·권한·경로

| 항목 | 기존 운영 PC | 공통 대기열 PC |
| --- | --- | --- |
| 고정 GitHub label | self-hosted, Windows, X64, zgmini-pc-control | self-hosted, Windows, X64, zgmini-handoff-ci-isolated |
| 전용 Runner | zgmini-pc-01 ~ zgmini-pc-06 (6좌석 구성) | zgmini-handoff-ci-spare-01 (1좌석 확인) |
| 대표 실행 검증 | #1249 zgmini-pc-03, #1255 zgmini-pc-02 | #1245/#1254 zgmini-handoff-ci-spare-01 |
| 업무 경계 | 고정 Controller A급 진단, 승인된 독립 Writer/유지보수기 B급, 로컬 기능 실행 | 검증된 원본 GitHub Issue/Run/JSON/TXT 읽기·사건 분류·중복 제거·제한된 GitHub 기록 및 격리 테스트 |
| 기본 명령 실행 | 운영 설치 Node를 사용하는 기존 고정 Controller entry | checkout + pinned setup-node 22 + GitHub 전용 모듈 |
| 운영 데이터·DB·파일 갱신 | 별도 실제 업무 승인 및 보호 계약이 있을 때만 | 장애 인계/격리 CI 워크플로에서는 금지 |
| C급 시스템·보안·관리자 변경 | 사용자 직접 수행; 사전 계약·승인 필요 | 같은 제한, 자동 권한 없음 |
| 산출물 | 고유 Issue/Run/seat별 JSON/TXT, 원본 보호·승인 이력 | 고유 Issue/Run별 JSON/TXT, agent-handoff Issue 및 검증 댓글 |

기존 pc-job Workflow: .github/workflows/pc-job.yml → E:\ZGmini\runtime\node.exe → E:\ZGmini\automation\pc-control\controller\entry.mjs → upload.mjs. 일반 pc-job에 임의 CMD/Node/SQL, B급 운영 쓰기 또는 유지보수 명령을 삽입하지 않는다.

격리 인계 Workflow: .github/workflows/agent-handoff.yml, agent-handoff-pc-failure-intake.yml, agent-handoff-writer-b-failure-intake.yml, pc-shared-issue-admission.yml. opt-in 변수와 actor/label/schema/manifest/원격 결과 검증이 선행한다. 격리 Runner가 PC 운영 데이터에 접근한다고 가정하지 않는다.

## 3. 운영 PC의 프로세스 실행/복구 구조

[운영 계약]
1. Windows 사용자 로그인 → Startup ZGMINI_PC_CONTROL.vbs → WScript Guardian → pc-watchdog/runner-watchdog.mjs → Controller Supervisor → 전용 Runner Listener 6개. 로그인 전 무중단 실행은 보장되지 않는다.
2. 실행 요청은 ChatGPT/허용된 GitHub Issue → Actions → 기존 Runner → 고정 Controller allowlist/seat·memory/lease 검사 → 결과 TXT/JSON·Issue 댓글. A급 진단과 B급 승인 설치를 분리한다.
3. 독립 Windows Startup ZGMINI_PC_MAINTENANCE.vbs → 별도 유지보수 Receiver. Controller 갱신은 pc-maintenance Issue + 승인 manifest + 실제 설치 SHA/백업/보호 상태 검사. 일반 Runner 프로세스 안에서 자기 Controller를 임의 교체하지 않는다.
4. 정기 기능 실행은 Windows ZGMINI 예약 작업이며, Core 공유 lock, Writer/DB, 공급자 호출/TTL/D1 게시의 각 기존 보호 계약을 따른다. **GitHub 소스 병합 자체가 실제 PC 기능 배포/갱신은 아니다.**
5. Watchdog은 Supervisor PID/heartbeat·출처 해시·PAUSE/DRAIN/lease/Workflow를 확인한 뒤 제한적으로 재시작하며, 임의 Runner 전체 종료, 운영 DB 초기화, Core lock 삭제를 하지 않는다.

[실PC 관측: Issue #1255 / Run 43104881778, 2026-11-12 KST] 전체 Windows 프로세스 430개, 지정 명칭 프로세스 84개. 최초 상세 60개만 반환되어 Runner 명칭별 PID 누락: 이 부분은 #1256의 프로세스 우선순위 수정과 후속 증거를 적용한다.
- ZGMINI 예약 작업 총 15: Running 1 / Ready 11 / Disabled 3.
- Running: ZGMINI-PC-Local-Core.
- Ready: ZGMINI-PC-Breadth-R10V9-Publication; ZGMINI-PC-Breadth-R10V9-Shadow; ZGMINI-PC-Configured-Themes; ZGMINI-PC-GetMarketHistory-ETF; ZGMINI-PC-Local-Korea; ZGMINI-PC-MarketParquet-ETF; ZGMINI-PC-Theme-Biotech; ZGMINI-PC-Theme-Data-Center-Power; ZGMINI-PC-Theme-Nine-R47-Private; ZGMINI-PC-Theme-Nine-R54-Public; ZGMINI-PC-US-Breadth-R1.
- Disabled: ZGMINI-Migrate-Resume-20261015; ZGMINI-Migrate-To-E-20261015; ZGMINI-PC-Writer.
- Startup ZGMINI 항목: ZGMINI_PC_CONTROL.vbs, ZGMINI_PC_MAINTENANCE.vbs.
- 별도 관측 서비스: actions.runner.ansqhd5774-Choi-akkigo-boja.akkigo-boja-runner, Running/Auto. **이것을 ZGMINI 6좌석의 서비스라고 주장하지 않는다.**
- 예약 상태 Running/Ready는 해당 Task의 마지막 실행 성공·정상 데이터 저장·게시를 증명하지 않는다.

## 4. 공통 대기열 PC의 프로세스 실행/인계 구조

[운영 계약]
1. GitHub workflow_run 또는 승인된 GitHub Issue 수신 → 격리 self-hosted Runner → pinned checkout/setup-node → 원본 요청 및 bot receipt/manifest SHA/JSON·TXT 재검증.
2. 수리 가능한 확정 실패만 agent-handoff Incident로 등록·중복 제거; 정상 PASS, WAIT_RECORDED, 종료 불명확은 자동 수리/재실행 대상으로 승격하지 않는다.
3. 단일 중앙 ChatGPT 총괄이 해당 GitHub 사건을 조회·분석·수정·테스트·PR/CI 후 검증된 결과를 **원래 Issue**에 반환한다. ChatGPT 일반챗 자동 수신/자동 재개는 지원 사실로 주장하지 않는다.
4. 격리 PC의 Workflow는 GitHub 메타데이터·검증 중심이다. 운영 PC의 Controller·Core/Writer·DB·D1를 직접 수정하는 대체 PC가 아니다.

[실PC 관측: Issue #1254 / Run 43104715561, 2026-11-12 KST]
- 총 Windows 프로세스 275개, 지정 목록 56개(절단 없음): cmd.exe 11; conhost.exe 27; node.exe 10; powershell.exe 2; Runner.Listener.exe 5; Runner.Worker.exe 1.
- 관련 Windows 서비스: actions.runner.ansqhd5774-Choi-zgmini-pc-control.zgmini-handoff-ci-spare-01, Running / 시작 유형 Auto.
- ZGMINI 이름으로 등록된 Windows 예약 작업 0, 현재 사용자 Startup ZGMINI 항목 0. 각 조회 상태 OK.
- **5개 Runner.Listener 프로세스 중 ZGMINI 전용으로 확인된 것은 명명된 격리 Runner 1개뿐**. 다른 4개의 소속은 현재 증거만으로 확정하지 않는다.
- Service Auto는 Windows가 자동 시작하도록 *설정된 것*의 증거. 재부팅 후 자연 복구나 24시간 무중단 운영을 증명하지 않는다.

## 5. 공통 작업·오류·결과 수명주기

1. 신규 ChatGPT 일반챗은 최신 AGENTS.md, docs/GENERAL_CHAT_START.md, docs/PC_AUTOMATION_STANDARD.md 및 **이 문서와 장비 인벤토리**의 관련 부분부터 확인한다.
2. 작업별 승인·source/branch/SHA·대상 호스트·Runner label·기존 성공된 실행/결과 모듈을 대조한다. 설치되지 않은 모듈을 설치된 것처럼 간주하지 않는다.
3. 기능별 실제 실행은 운영 PC의 기존 pc-job(A) 또는 해당 승인 독립 Writer/유지보수기(B) 계약만 사용한다. 공통 인계는 격리 PC의 승인된 GitHub metadata workflow를 사용한다.
4. 중복 requestId 자동 재실행은 0회. queued/Offline/STATE_UNKNOWN/REPORT 실패를 실제 PC 실패나 PASS로 단정하지 않는다. 기존 원본 Issue·Run·JSON/TXT·원장으로 readback 한다.
5. Controller/Writer/Core 등 실제 공유 자원에서만 #68 단일 조정 원장과 승인된 lease/owner/backup 계약을 적용한다. 독립 작업을 전역 차단하지 않는다.
6. 수행 결과는 실제 요청 원본 고유 ID와 작업 코드/lastPass/firstFail, 운영 쓰기·권한·결과 전달 상태를 따로 보고한다.
7. 정상 조회에는 신규 수동 ZIP/CMD·기능 전용 실행기/예약·새 PC 설치를 만들지 않는다. 플랫폼이 독립 ChatGPT 대화를 깨울 수 있다고 주장하지 않는다.

## 6. 정본·원본 증거 링크

- 장비 실측 정본: docs/PC_HOST_INVENTORY_READONLY.md.
- 기존 PC 하드웨어: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1249; results/pc-host-inventory-43102349724-1-operating.json
- 격리 PC 하드웨어: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1245; results/pc-host-inventory-43101563767-1-handoff.json
- 기존 PC 프로세스 최초: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1255; results/pc-process-inventory-43104881778-1-operating.json
- 격리 PC 프로세스: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1254; results/pc-process-inventory-43104715561-1-handoff.json
- 실측기: tools/pc-host-inventory-readonly.mjs, tools/pc-process-inventory-readonly.mjs, 각 고정 Workflow 및 tests/.
- Startup/Watchdog 운영 계약: docs/INSTALL_AND_ROLLBACK.md, docs/RUNNER_RECOVERY.md.
- 독립 유지보수 계약: docs/CONTROLLER_AUTO_UPDATE.md, docs/CONTROLLER_RECOVERY.md.
- 중앙 사고 인계 계약: docs/AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md 및 docs/SHARED_RESOURCE_LIFECYCLE_V1.md.
- 현재 공통 동시 적용 조정: GitHub Issue #68. #996 C급 NO-GO/ISO_ONLY_PASS 유지, 이 조사로 복구/승인을 대신하지 않는다.

## 7. 조사 한계 및 비수집 정보

이 문서의 '전체'는 **운영에 필요한 범위의 확인된 PC 정보**를 뜻한다. 보안상 토큰/키, 환경변수 전체 원문, 계정 정보, 전체 명령줄, 사용자 개인 파일, IP/MAC, 시리얼번호, 운영 원자료/DB는 수집·GitHub 업로드하지 않는다. 목록은 시점성 스냅샷으로 PID·작업 수·가용 메모리는 변경된다.

현재 미검증: 격리 PC의 다른 Runner.Listener 4개 소유자, 두 PC의 각 모든 Runner 설치/시작 인과관계, 실제 부팅 후 복구 자연 시험, 현시점 전체 Windows 서비스/일반 프로세스 전체 목록, 프로세스별 실제 CPU 사용률, 실제 배포·수집·D1 성공 여부, 현재 Controller 설치 SHA. 필요한 장애가 발생했을 때만 해당 범위를 별도로 확인한다.
