# ZGMINI 프로세스 총괄 — 2026-11-07 잔여 실행 계획

## 0. 2026-11-13 실행 기준 — 기존 이력보다 우선하는 현행 계획

> **목표 고정:** 수리 가능한 실제 PC Job/Writer B 공통 장애를 GitHub 원본 증거로 접수하고 **단일 중앙 ChatGPT**가 원인 확인·최소 수정·회귀/PR·CI·원본 Issue 결과 영수증까지 책임지는 기존 공통 대기열을 운영한다. 문서 정리나 #996 복구, 여섯 기능 개발을 중앙 장애 인계의 완료조건에 끼워 넣지 않는다. 이 절은 옛 §1~4의 기록을 삭제하지 않고 **현재 판정만 대체**한다. 정본은 최신 `main`의 AGENTS.md·docs/GENERAL_CHAT_START.md·docs/PC_AUTOMATION_STANDARD.md·docs/PC_OPERATING_SYSTEMS_CANONICAL.md와 Issue #68이다. 작성 시 확인한 `main` SHA `445509c06555d179b33dfbc04cbf90c2f4091b46`; 현 브랜치는 크게 분기되었으므로 재기준화·강제 병합·reset/rebase 없이 **이 계획 파일만 수정**한다.

### 0.1 완료 근거 / 진행률 / 범위

| 독립 범위 | 기존 완료 증거 | 현재 판정 | 기능 완료와 혼동 금지 |
| --- | --- | --- | --- |
| 단일 중앙 공통 장애 인계 | 자연 Writer B #1063→#1068, 수정 PR #1086·성공 CI·중앙/원본 bot 결과 2/2, 중앙 인계 정본 | **8/8=100%, DONE** | 다른 일반 ChatGPT 자동 수신·PC 운영 설치는 별도 |
| 격리 Windows 자동 Writer B intake | 격리 Runner 정규 트리거, 원본 인증·안전대기/중복, 소스 교차흐름; 격리 실PC #1210→Run #42725636209 WAIT_RECORDED | **4/5=80%, 5단계 자연 적격 실패 왕복 DEFERRED** | 없는 장애를 인위적으로 만들지 않음 |
| 공유 자원 수명주기 | PR #1274 main, 격리 source-only 59/59 PASS, Issue #68 | **4/5=80%, 자원 대기→실제 해제→원담당 재계획 DEFERRED** | 중앙 격리 인계의 4/5와 다른 분모 |
| #996 C급 복구 | #996/#68 원본, 후속 읽기 전용 #1295 Run #43164525583 | **NO-GO/STATE_UNKNOWN**, 동일 공유 설치만 한정 | A급 전체·Writer B 전체 금지 아님 |
| R10 Alpaca 제외 | PC B #1320, A #1321/#1323, Production Run #43234497571 | **5/5=100%, DONE** | 재검증·재설치 불필요 |

2026-11-12 [#68 공통 차단 범위 정정](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6815766251), [#996 후속 확인](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6815967006), [R10 완료](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6826099930), [중앙 자동화 상태](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6827035097) 참조. 과거 #434의 E: 0건 자연 B 실증은 사용자 지시로 완료 Gate에서 **REMOVED_BY_USER**이며 새 관측 대기를 부활시키지 않는다.

### 0.2 실행 순서 — 다음 필수 작업과 검증 기준

| 순서·담당 | 즉시 실행할 입력 및 최소 조치 | PASS와 STOP/다음 분기 |
| --- | --- | --- |
| **P0 총괄 / 지금** | #996 기존 C 시도 원본 Issue·Run·결과와 GitHub Workflow/Backlog의 **현재** 읽기 전용 상태, 기존 A #1295의 bot 결과·JSON/TXT를 대조. LAST_PASS/FIRST_FAIL, 현재 실제 변경 여부, PC 현장 미확인 부분을 분리. 기존 #1217/#1219/#1226/#1227 자동 재발행 금지 | GitHub readback은 `GITHUB_READBACK_ONLY`; 원본 Windows 운영 상태 미확인은 `PC_READBACK_PENDING`으로 보존. Workflow PUT/백로그 종료 **시도**를 실제 성공으로 승격하지 않음 |
| **P1 총괄 / 실행 가능한 범위** | C 재실행 전에 설치된 기존 허용 A급만 확인하고, 이미 존재하는 원본 PC readback에서 post-C Workflow·claim·lease·marker·ledger/보호 fingerprint를 대조. 추가 PC 조회가 필수이지만 설치 지원/접수 불명확하면 그 operation만 `AUTOMATION_BLOCKED` | 변경 전후 바이트·원본 ID·Owner/승인·복구 경로 모두 확인해야 다음 C 후보를 평가. #996 같은 명령 재실행·lock 강제 해제·C 추가 요청·보안 우회 금지 |
| **P2 중앙 예약 담당 / 별도 점검** | 기존 「ZGMINI 공통 인계 중앙 처리」 예약의 `is_enabled=true` 복원 증거를 재사용. 이전 `requires_user_action=true`는 그대로 보존, **복원 이후 새로운 Run ID와 결과**만 1회 확인. 기존 task/프롬프트·시간당 일정 유지 | 새 실행의 실제 NO_WORK/처리 증거가 있어야 RUNNING 판정. 활성 토글만으로 매시간 성공이라고 단정하지 않음. 새 자동화 생성 금지 |
| **P3 단일 중앙 / 자연 사건 발생 시만** | 격리 Writer B intake의 신규 인증 적격 실패 1건: 원본 Issue/Run·bot receipt·고정 manifest SHA·JSON/TXT 2/2 검증 → 최소 수정/관련 회귀·PR/성공 CI → 중앙 및 원본 bot `HANDOFF_RESULT_RECORDED` readback | 실제 E2E 전체 왕복이면 격리 경로 5/5. `WAIT_RECORDED`·성공·UNKNOWN은 제외, 인위적 B·같은 ID 재실행/새 수신함 생성 금지. **DEFERRED는 다른 작업의 Gate가 아님** |
| **P4 공통 Controller 도구 담당 / 실제 필요 시** | 시장 Treasury `source-inventory-runtime-readonly`, D05 `d05-lineage-readonly`의 설치 Controller 미지원 범위를 확인. 이미 승인된 공통 등록/유지보수 정본을 재사용해 미지원 operation만 source-only 수정·테스트·별도 manifest/승인 경로로 검증 | 지원되지 않는 A만 `NOT_REGISTERED`. 문서/PR/CI는 PC 설치 PASS가 아니다. #996 동일 공유 설치와 충돌할 때만 해당 변경 직렬화 |

### 0.3 #996 오류에 대한 현재 분리 판정

- **실제 LAST PASS:** #1295 pc-job Issue→Workflow→Runner Job→bot receipt 및 원격 JSON/TXT 2/2까지 전송 경로 실증. 해당 operation 자체는 `STATE_UNKNOWN/CORE_NO_ACTIVE_TASK_ENGINE`이므로 `runtimeSourceVerified=false`. 이 결과는 공유 설치 잠금 해제도 Core 정상 동작 증거도 아님.
- **실제 FIRST FAIL:** #996 C 시도 `C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID`, 단계 `ORIGINAL_JOB_DISPOSITIONS` 보고. Workflow 변경 1회·Backlog 종료 1회 **시도**했으나 실제 성공 미확정. 과거 원장에 `RUNNER_SET_DRIFT` 및 `INTAKE_PAUSED`가 있으며 서로 다른 관측 범위를 섞지 않는다.
- **필수 증거:** 같은 고유 C claim/Owner·원본 lease·Workflow 상태·각 backlog Issue 현재 state/label/body/댓글·복구 marker/ledger와 현장 보호 원본. GitHub 기록만 확인되는 경우 PC 현장 복구 완료 주장 금지.
- **안전 제한:** 기존 C 실행 패키지 재실행·추가 C 승인 추정·원본 requestId 복제·강제 unlock/rollback/Workflow PUT·보안정책 수정·운영 PC/DB/D1 변경 금지. 보호 조건 불명확이면 정확한 해당 단계만 `BLOCKED`.

### 0.4 원담당 여섯 기능의 비차단 진행 기준

| 기능 | 마지막 유효 완료 지점 | 원담당이 #996 없이 지금 할 수 있는 다음 실행 | 실제 선행조건이 필요한 효과 |
| --- | --- | --- | --- |
| 물가 | 보고 42%; 19개 기존+신규7개 중 4개 값 확보 | BLS 2·Census 1 공식 파일의 발표/관측일과 로컬 결손 정리, 허용된 단회 수집 준비 | 실제 공유 DB 쓰기/PC 수집에 충돌 확인 시 해당 lane만 판단 |
| 시장 캘린더 | 보고 95%; 수집·게시 기존 증거 | Treasury 1년 원본 감사 범위·건수·지문을 기존 결과와 대조 | 설치 미지원 `source-inventory-runtime-readonly`는 승인된 공통 등록 뒤 1회 |
| 테마 공포탐욕 | 보고 20%; 6개 저장 피드 식별, 공개 0/10 | R178 체크포인트/6개 피드 Reader 기존 코드 검토, R181 첫 실패 원인 분리 | 실제 Reader/Writer/D1 적용 때 해당 권한·source 검증 |
| 고용 R6 | 보고 87.5%; DOL 진단 13/13 PASS | 미접수 구 #1217/#1227 재실행하지 않고 신규 접수 상태/공식 DOL 관측 진단 | 필요한 신규 A 결과가 실제 거부되면 해당 operation만 차단 |
| R10 | #1320 B·#1323 Writer·공개 결과 | **완료**, 추가 필수 작업 없음 | 자연 예약 갱신은 별도 후속 |
| D05 | Writer B #1234·A #1235 성공, 1년치 0/68 | 기존 소스 12파일·Task 증거 재사용, #1236 A Reader 후보/회귀 검토 | `d05-lineage-readonly` Controller 등록과 실제 PC 조회 후 수집/저장 |

### 0.6 실제 실행 기록 — #996 GitHub 원본 readback (2026-11-13 기준)

**실행 1/2: GitHub 측 P0 완료 — `GITHUB_READBACK_ONLY`.** 작업은 읽기 전용이며 운영 PC·Workflow·Backlog·DB/D1·Runner 쓰기와 과거 requestId 재실행은 0건이다.

1. 원본 [#996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996)는 `open`/`pc-maintenance`, 마지막 저장 댓글은 [2026-11-12 원본 조회 분리 판정](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6815967006). 현재 GitHub Issue 본문·댓글에는 **새로운 C 실행 사후 PC 현장 snapshot/복구 PASS가 없음**. 이 부재는 Windows 상태를 직접 판정한 것이 아니다.
2. 기존 Backlog 원본 [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217) / [#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219) / [#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226) / [#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227) **4/4 GitHub Issue open, 현재 label `pc-job`, 원본 JSON schema `ZGMINI_PC_JOB_V1`**. GitHub bot PC 결과 영수증은 0/4; #1217과 #1227의 사용자 진단 댓글은 실행 결과 영수증이 아님. 4개 원본 Issue를 새 요청으로 복제·재발행하지 않았다. **GitHub 문제 형식 일치만으로 C 실행 당시 body bytes/error 원인을 확정하지 않음**.
3. 독립 [A급 #1295 / Run #43164525583](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1295)는 bot 댓글·[JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/43164525583-1-seat-1.json)·[TXT](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/43164525583-1-seat-1.txt) **2/2 원격 재조회**. 동일 requestId·`STATE_UNKNOWN/CORE_NO_ACTIVE_TASK_ENGINE`, LAST_PASS `ALLOWLISTED_WORKER_STARTED`, FIRST_FAIL `ALLOWLISTED_OPERATION`, `runtimeSourceVerified=false`, `operationalWrites=0`, `protectedStateUnchanged=true`. **GitHub 접수/Runner 실행은 PASS 범위지만 live Core source는 미입증**.
4. 과거 #996 [maintenance JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/maintenance-pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404.json) 재조회: `UNKNOWN/RUNNER_SET_DRIFT`, LAST_PASS `RECOVERY_REQUIRED`, FIRST_FAIL `INTAKE_PAUSED`, `protectedStateUnchanged=false`. 이는 **후속 C 시도 이후 live 복구 결론이 아닌 당시 결과**다.
5. GitHub 커넥터에서 현재 `pc-job.yml` Workflow enable/disable의 **관리 상태 직접 조회는 미지원**이었다. 4개 backlog 현재 `open`과 새 A급 성공 이력으로 현재 workflow 전체 활성·C 시도 부작용 없음·PC 설치 잠금 해제를 추론하지 않는다.

**실행 2/2 — 다음 하나의 필수 작업 (P1):** #996 원본 Windows에서 **이미 승인된 기존 읽기 전용 진단 경로**가 현재 C 시도 이후 claim/lease·Workflow·Backlog·원장·보호 fingerprint를 제공하는지 설치 기능/승인·last result를 먼저 대조한다. 접근 가능하면 **새 작업 재실행이 아니라**, 필요한 새 고유 A 요청 1회에 한해 원본 Issue·Run·JSON/TXT를 회수하고 현장과 GitHub 양쪽의 변경 시도/실제 결과를 매칭한다. 설치된 allowlist에 적합한 조회가 없거나 승인 경계가 불명확하면 **P1만 `AUTOMATION_BLOCKED/PC_READBACK_PENDING`**, C급 조작·새 도구 설치·동일 C requestId 재실행은 금지하고 P2/P4 독립 업무를 이어간다.

### 0.5 종료·보고 규칙

- 중앙 인계 전체 **8/8 DONE**과 새 격리 경로 **4/5 DEFERRED**를 섞거나 둘 중 하나를 다른 기능 전체 진행률로 표현하지 않는다.
- 이번 실행의 완료 여부는 **(1) 이 계획 실제 Git 커밋, (2) 변경 파일 원격 readback, (3) P0 기존 GitHub 원본 readback 및 미확인 범위 기록**으로 평가한다. P1 현장 접근이 없더라도 P2/P4 등 독립 일을 계속한다.
- 새 사건·권한·소스 변화가 없는 한 오래된 성공 재검증, 문서만 반복 갱신, 정규 예약 검증을 기능 완료 선행조건으로 만들지 않는다.
- 최종 보고: 이번 작업의 수행/검증/실제 문제/다음 **단일 필수 행동**, 원본 링크와 단계별 진행률. 다른 ChatGPT 대화의 자동 수신이나 Production 배포 완료 추정 금지.


### 0.7 2026-11-13 후속 실행 — 중앙 자동화 재검증·Runner 조회기 수정

**P2 중앙 예약 첫 재개 실행 실증:**
- 기존 자동화 `Automation_9a403a04a8ac8191a331e94f9abeb1b4`는 `is_enabled=true`. 2026-11-12T15:18:25Z~15:22:08Z **첫 재개 후 Run `0f2947c8-2bbc-8329-a5a8-3735717a5cb3` `completed`, `requires_user_action=false`**. 신규 `agent-handoff` 없음(기존 8개 사건만), GitHub/PC 수리 쓰기 0건. 결과 전달 상태는 `unknown`이며 타 일반챗 자동 재개는 증명되지 않음.
- 자동화 최초 Run은 접수 Workflow 실패·시간초과 조회가 미완료라 완전한 `NO_WORK`를 보장하지 않았다. 총괄이 별도 읽기 전용으로 저장소 `actions/runs?status=failure&per_page=100`, `...status=timed_out&per_page=100`를 조회했다. failure 전체 140개 중 조회 100개, 100번째 실행 시각 2026-11-04T22:29:35Z(요구한 최근 24시간보다 이전), timed_out 전체 0개. **2026-11-11T15:23Z~2026-11-12T15:23Z 접수 Workflow 2개(PC/Writer B) 중 failure/timed_out 0건**. 이 범위에서 검증된 신규 수리 대상 없음, 과거 11/09 실패는 최신 사건으로 소급 선정하지 않음.
- 기존 중앙 자동화 **새 예약 없음·기존 시간당 일정 유지**. 효율 개선을 위해 실패/시간초과 API 상태 필터→workflow 이름·24시간 경계→결과/receipt 확인, 첫 페이지가 조회 범위를 다 덮지 못하면 추가 페이지·미확정 처리 규칙만 동일 작업 프롬프트에 삽입·저장·재조회했다. 자연 발생 신규 실패 확인 의무와 보안 제한은 불변.

**공통 진단기 실제 오류에 대한 최소 수정:**
- 최신 `main` `tools/automation-status.mjs`의 `rows?.length===6`은 GitHub에 전용 운영 Runner 6좌석과 별도 격리 Runner 1대가 등록된 상황에서 `runnerSetOnline=false` 오탐이 될 수 있다. 동일 `main`의 `tools/update.mjs::dedicatedPcRunnerRows`는 이미 **운영 6개 이름 정확히 한 번씩** 확인해 독립 격리 Runner를 제외하는 정본 구현이다.
- main 기준 별도 브랜치 `codex/automation-status-dedicated-six-r1-20261113`에 해당 구현을 재사용하고 `tests/automation-status.test.mjs`를 보강. 기존 격리 PC의 무료 CI만 사용하는 `.github/workflows/automation-status-readonly-source-tests.yml` 최소 1개 추가. **[Draft PR #1324](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1324)** 최종 HEAD `f7a52fde359aa574c803449ab9f0fa2547482592`, 3파일 변경, FORCE push/rebase 없음.
- 새 전용 [Run #43247186728](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43247186728) **14/14 PASS**, `AUTOMATION_STATUS_SOURCE_ONLY_ISOLATED_HOST=TRUE`, 여섯 운영 Runner + 격리 Runner 정상/운영 누락·오프라인·중복 거부 검사 포함. 기존 [#996 source CI Run #43247186807](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43247186807) **27/27 PASS**. 두 결과는 같은 새 HEAD의 SOURCE_ONLY 검증이지 `main` 병합·Windows 운영 설치/복구는 아니다.
- PC 설치 정책/Source/계산기·DB/D1/예약/Workflow 실행 경로 변경 0건. 병합·실제 Windows 유지보수기 등록은 **별도 적용 담당의 기존 승인 절차**로만 진행한다. 즉시 #996 C급 NO-GO를 해제하거나 `AUTOMATION_STATUS`를 설치 A급으로 간주하지 않는다.

**남은 단일 필수 행동과 종료조건:** #996 이전 C 시도의 **post-C Windows 원본 상태**를 기존 승인된 정규 읽기 전용 수단으로 회수해 `claim/lease/Workflow/backlog/ledger/protected fingerprint`를 GitHub 원본과 대조한다. 현재 설치 Controller config에는 이를 완결하는 A급 operation이 없어 `PC_READBACK_PENDING / AUTOMATION_BLOCKED`로 한정한다. 새 임의 shell/C재실행/lock 해제는 하지 않는다. 자연 Writer B 5번째 실증 및 자원 수명주기 5번째 실증은 `DEFERRED`로 유지하고 독립 기능 진행을 차단하지 않는다.


---


- 기준 브랜치: `codex/controller-ops-lessons-20261105`
- 판정 기준: GPT R6.0 + 제어 저장소 `main`의 AGENTS.md, GENERAL_CHAT_START.md, PC_AUTOMATION_STANDARD.md, GENERAL_CHAT_PREWORK.md
- 이번 기록은 실제 소스/원장 읽기 전용 조사다. Controller/Reader/PC/DB/게시/예약을 수정하거나 새 요청을 제출하지 않았다.

### 0.8 2026-11-13 완료 전환 — 운영 상태 조회기 main 병합

**이번 확정 완료:** [#1324](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1324) 3파일 SOURCE_ONLY 개선은 Draft→검토 가능→정규 squash merge까지 완료. `main` **`5c65bd0944004c4620483386889039a864f95dd3`**로 실제 반영되고 3파일 blob 원격 재조회가 일치했다. 격리 CI [#43247186728](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43247186728)의 `tests/automation-status.test.mjs` **14/14 PASS** 및 독립 격리 호스트 증명, [#43247186807](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43247186807) 기존 C996 소스 시험 **27/27 PASS**. 전체 GitHub Runner 개수로 운영 여섯 좌석을 잘못 판정하던 코드를 기존 `dedicatedPcRunnerRows` 함수로 한정 변경했다. [#68 최종 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6828002969).

**운영 적용 여부:** PC 설치·Controller/maintainer source 교체 **없음**. 기존 설치 SHA와 운영 상태를 이 `main` SHA로 바꾸어 주장하지 않는다. 이 소스 수정은 #996의 이전 C 시도 원장/잠금 해제·Workflow 복구를 실행하지 않는다.

**다음 필수 실행 하나 — #996 원본 C 담당:** 기존 C 시도 이후 original Windows claim/lease·Workflow·Backlog·ledger/보호 fingerprint의 인증된 읽기 결과를 확보한다. 설치 Controller `badad912…`에는 이를 일괄 제공하는 A급 없음. 소유자/실행기에서 **기존 승인된 경로가 실제 확인될 때만** 고유 read-only 요청을 등록·Run/JSON/TXT 2/2 반환 확인; 접근 불가능하면 이 하나만 `PC_READBACK_PENDING/AUTOMATION_BLOCKED`로 보존. 새 C 명령, 기존 requestId 재요청, 기존 잠금 해제, Workflow PUT, 임의 새 CMD·임의 shell, 새 감시 예약 금지. 기타 독립 작업과 기존 중앙 자동화(8/8)는 진행한다. 격리 Writer B 자연 적격 실패 E2E 및 자원 실제 해제 관측은 **별도 DEFERRED 4/5**이고 전체 업무 선행조건이 아니다.

### 0.9 2026-11-13 원본 C 사후 검증 완료점 재사용 및 실제 잔여

> **이번 작업에서 확인한 기존 완료 증거 — 구 §0.2 P1·§0.8의 `#996 post-C Windows 증거 전체 미확보`를 정정한다.** 이 항목들은 새로운 운영 수행이 아니라 **기존 C 담당 브랜치의 원본 사용자 Windows 보고를 교차 재조회하여 증거를 재사용**한 것이다. 다시 R1/R2/R3/R4 CMD를 요구하거나 84개 파일 재검증을 진행하지 않는다.

| 사실·최초 관측 | 원본 증거 및 확인 범위 | 현재 판정 |
| --- | --- | --- |
| **R3 기존 ZGMINI PC 사후 읽기 성공** (2026-11-10 KST) | [#996 C 전용 사후 원장](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/docs/CONTROLLER_996_C_INTERRUPTED_DISPOSITIONS_20261110.md#r3-원본-windows-실증-성공-및-기존-issue-재계획-판정--2026-11-10-kst) `READONLY_EVIDENCE_SNAPSHOT_CONSISTENT`, Controller 38/Stage 39/Maintainer 7 manifest, 원본 replay journal `{}` SHA256 및 `replayCount=0` 실PC 콘솔 보고. 이전 #996 C claim/원장·source manifest 일치 범위 확인 | **이력 확인 DONE**; 신규 소유자 claim 외부 provenance·전체 파일 원본 바이트 postcheck는 당시 미확인 |
| **R4 원본 Windows Git source 검증** (2026-11-11 KST) | [R4 비민감 원본 화면 전사](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/artifacts/controller-996/zgmini-996-r4-windows-screenshot-readback.json) `SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS`, 38+39+7 **84/84**, 오프라인 SHA256 manifest/source digest 일치 | **해당 시점 파일 바이트 검증 완료**. 실행 ZIP/CMD 자체·화면의 물리 PC 신원/현재 시각까지의 불변은 보장하지 않음 |
| **운영 PC Workflow·Receiver 조회** (2026-11-11T14:18:15Z) | 동일 [C 중단 인계 원장](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/docs/CONTROLLER_996_C_INTERRUPTED_DISPOSITIONS_20261110.md): `workflowState=active`, `maintenanceState=HEALTHY`, `receiverStatus=LISTENING`, 전용 6 Runner online·idle | **해당 시점 실제 PC 조회 PASS 범위**; `installLock.held=true,recoveryRequired=true`였으므로 C 복구/잠금 해제는 NO-GO |
| **별도 Windows TEMP 단독 원자 이동 fixture** (2026-11-11 KST) | [7/7 cases·29/29 checks 화면 전사](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/artifacts/controller-996/zgmini-996-windows-c-stage-native-7of7-20261111.json) | 합성 TEMP 환경 PASS; 원본 운영 E: 이동·정전 내구성·native production operator PASS 아님 |
| **원본 미실행 요청 4건** (이번 GitHub 직접 재조회) | [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217)·[#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219)·[#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226)·[#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227): **4/4 OPEN**, `pc-job` 라벨, 원래 요청 schema 존재, 인증된 PC result bot 영수증 **0/4** (진단 댓글은 결과가 아님). 실PC R3에는 pause 구간 중 원본 job **0건 실행**과 backlog replay `0` 보고 | **`OWNER_REPLAN_REVIEW_REQUIRED` 후보**, 원본 requestId를 다시 제출하지 않음. 기능 원담당이 현재 실행 필요성·승인/source/operation 확인 후 **새 고유 ID만** 결정 |

**실제 남은 C급 차단점(정확히 이 범위):** (a) 기존 C claim의 새로운 프로세스에 대한 **독립 소유권/provenance 검증과 원자적 continuation 배타권**, (b) C 변경 직전의 **신선한 원본 PC lease/Workflow/Backlog·Writer 충돌·보호 fingerprint 재조회**, (c) 기존 코드를 수정한 독립 C 네이티브 실행기의 봉인·보호·충돌/복구 검증, (d) 위 효과와 정확히 일치하는 **신규 사용자 C급 명시 승인**. 이전 `ZGMINI_CONTROLLER_996_C_CONSENT_V1`를 새 복구 권한으로 자동 전환하지 않는다. 기존 백업/lease/claim 보존, C 명령 재실행·Workflow PUT·기존 원본 job 재실행 금지.

### 0.9.1 담당 분리 및 실행 순서

1. **중앙 총괄·GitHub 접수(즉시 독립):** 기존 단일 ChatGPT 시간당 자동화·격리 Runner의 정상 접수 유지. 최근 적격 실패 증거가 확인되면 그 고유 원본 1건만 중앙 처리하고 성공 CI·원본 Issue bot 영수증까지 1회 검증한다. **자연 인증 실패 5번째 실증은 미래 DEFERRED**. GitHub 실패 History `NO_PUBLISHED_RESULTS`은 예외/실패 원본으로 분류하고 임의 새 Incident를 만들지 않는다.
2. **#996 단일 C 담당(병렬, 범위 한정):** 2026-11-10 R3, 11-11 R4/7·29 TEMP를 **LAST PASS로 고정**. 과거 사후 관측이 없다는 이유로 PC/CMD 반복 요청 금지. 기존 [#1222 Draft](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1222)의 안전 하드 STOP/원장/Native 후보를 평가해 위 (a)-(d) 실제 결손만 처리한다. 새 C 효과 승인·신선한 원본 PC 증거 전 운영 변경 **0**.
3. **각 기능 원담당(독립 병렬):** 원본 4건의 필요성을 자기 기능의 완료 지점에서 판단. `core-runtime-source-readonly` 3건, `core-status` 1건의 **이전 요청**을 재발행하지 않고 필요 시 현재 설치 allowlist/승인 SHA·새 고유 requestId로 정규 A 1회 신청한다. 이 요청들을 전부 해야 중앙 #996가 완료된다고 간주하지 않음. 완료된 R10 재작업 없음.

**진행률 유지:** 공통 중앙 8/8 DONE(100%), 격리 Writer B 4/5 DEFERRED(80%), 공유 자원 수명주기 4/5 DEFERRED(80%), #996 C NO-GO. 위 R3/R4를 새 완료 건수로 중복 산정하지 않는다.

### 0.10 2026-11-13 #996 Native Owner C 안전 차단 정확 판정

**실제 코드 조사(운영 효과 0):** 기존 C Owner [Draft #1222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1222) `tools/controller-996-c-native-owner-operator.mjs`의 현재 소스를 직접 읽고 서로 독립인 두 실행 거부가 있음을 확인했다. `run996NativeOwnerCOnce`는 첫 dynamic import 이전 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`를 무조건 반환한다. 별도로 native `handleArchiveScript(fixture=false)`는 `Need(Fixture,"C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN")`로 실제 운영 경로의 디렉터리 이동을 거부한다. 첫 STOP만 제거해도 두 번째는 남고, 이 보호를 무단 제거해서는 안 된다. Native child는 원래 파일들의 핸들·해시를 보유하지만 **새 자식 파일명의 동시 추가 차단**은 입증되지 않았다. 기존 테스트의 FIRST STOP assertion은 확인했고 SECOND STOP assertion은 미구현; 격리/합성 시험으로 namespace·경합·중단 복구 안전을 먼저 평가해야 한다.

**실행 인계:** [#996 Owner 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6828414347)로 정확한 파일/차단코드/최소 다음 소스 검토를 전달. GitHub 댓글은 원담당 ChatGPT 대화가 자동 수신했다는 뜻이 아니다. C 담당의 신규 명시 승인·현재 원본 Windows 실측·신뢰된 package/source 전부 미확정; 기존 승인 `ZGMINI_CONTROLLER_996_C_CONSENT_V1`는 신규 continuation 효과 승인으로 승계 불가. 수집/계산/게시 및 다른 독립 업무는 계속한다.

**종료 범위:** 새 권한·Runner/PC 작업·C 실행·Workflow/Backlog·Claim/Lease·DB/D1 변경 0. 중앙 인계 8/8 DONE, 격리 자연 E2E 4/5 DEFERRED, C NO-GO. 추가 문서 Gate나 무조건적 전체 Runner 대기는 생성하지 않는다.

### 0.11 2026-11-13 #996 이중 STOP 소스 회귀 실측

**완료 범위: 기존 단일 C 담당의 SOURCE_ONLY 보안 회귀, 실제 운영 C 복구 아님.** Draft [#1222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1222) 코드는 `run996NativeOwnerCOnce` 첫 import 전 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`가 항상 정지하고, `handleArchiveScript(fixture=false)`에는 `Need(Fixture,"C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN")`이 있어 production rename을 독립적으로 차단한다. 보호를 **변경·제거하지 않고** 이전 테스트가 놓친 두 번째 분기를 회귀 테스트 한 건으로 추가: [test commit `c89cd79d`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/c89cd79d81a229ddfe19e46007be2b6223d9d70a). CI의 신뢰 경계를 격리 Runner `DESKTOP-N62L0NG` 하나로 고정하고 checkout 전 호스트·E:\ 경로 가드를 실행: [workflow commit `489f7b06`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/489f7b0639bdec45a4ed650e0bb530abf152255d).

**실제 Runner 검증:** [Run #43253442308](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43253442308), job 131305193969 `completed/success`, `C996_SOURCE_ONLY_ISOLATED_HOST=TRUE`, 원담당 관련 Node tests **4/4 PASS, fail 0**. GitHub 원본 테스트/Workflow는 최종 HEAD의 원격 SHA로 재조회했다. 이 값은 C급 운영 원자 보관·native 경합 해결·실제 OS 파일 이동 PASS가 아니고 **fail-closed 분기의 지속 확인**이다. [원본 #996 owner 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6828659175) 완료; 다른 ChatGPT 일반챗이 자동 수신한 것은 아님.

**현재 실제 LAST PASS/FIRST FAIL:** LAST PASS 기존 original Windows R3·R4 84/84 + 별도 TEMP fixture 7/7·29/29 + 이번 소스 안전검사 4/4. FIRST FAIL은 네이티브 namespace에 새 파일을 동시 추가하는 시나리오의 원자적 보호 부재(`C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN`), 독립 provenance·continuation C 신규 승인/실시간 OS 증거 미확보. 해결 가능한 구현 효과는 **단일 C Owner**에게 한정. 동일 공유 설치 보호 범위 외 일반 기능은 기존 승인 업무 진행, 인위적 실패 사건 생성/구 C 명령 반복·lock 변경 불필요.

**상태 불변:** 중앙 인계 8/8 DONE, 격리 Writer B E2E 4/5 DEFERRED, 공유 자원 수명주기 4/5 DEFERRED, #996 C NO-GO, 실운영 쓰기 0. 다음 필수 C step은 **새 namespace entry 경합을 봉쇄할 수 있는 승인 가능한 OS 배타 구조를 source-only/격리 PC에서 실증하고, owner 신규 C 승인 전 두 STOP 유지**.

### 0.12 2026-11-13 C996 TEMP 네이티브 namespace 삽입 경합 재현

**C 원담당/격리 Runner 실증 결과 — 운영 실행과 분리.** 원본 `tools/controller-996-c-native-owner-operator.mjs`를 **수정하지 않고** `build996OwnerArchiveFixtureScript()`의 `Fixture=true` 모드로 공통 대기열 PC `DESKTOP-N62L0NG`의 고유 `%TEMP%` fixture만 사용. 기존 `owner.json` 열린 SHA/identity 핸들이 있어도 `simulateNamespaceInsert:true`가 **새 `competing.json` 파일을 생성**할 수 있음이 실측됐다. C# 결과 `C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED`, `moveOccurred=false`·원본 JSON 동일·목표 디렉터리 미생성을 Node assertions 확인. 실제 두 개 외부 Writer의 병렬 경합 시험은 아니며, 코드 자체에 삽입을 시뮬레이션한 실물 Windows 파일 시스템 음성 사례다.

- 신규 TEMP-only 재현 [테스트 커밋 `d44eb0c8`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/d44eb0c8d3db57795fe3def4073a75375e91bc63), 격리 CI 경로 반영 [`7a0a11e0`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/7a0a11e0cc4fac62272b9bc5c06382209a89774a).
- 실제 [Windows Run #43254827851](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43254827851), Job 131310108901 **COMPLETED/SUCCESS**; host guard PASS, Node **5/5 PASS / 0 FAIL**. **이 PASS는 결함 재현/운영 차단 유지 PASS**이며 운영 C급 설치·배타성 해소 아님.
- [#996 담당 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6828878228) 완료. `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`, `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` **두 안전 STOP 불변**. 원본 PC C/Workflow/Backlog/lease/Claim·원본 요청 재실행 변경 0.

**다음 단일 필수 결정(#996 C Owner):** 온라인 디렉터리 핸들만으로는 배타성이 성립하지 않으므로, 기존 **동일 기존 ZGMINI PC를 WinPE로 부팅하는 오프라인 독점 설계** 또는 독립적으로 입증 가능한 실제 namespace 단독 접근 수단 중 하나를 선택하여 **격리 시뮬레이션/원본 신원·Owner C 승인 조건**을 검증한다. 기존 R3/R4와 지난 7/7·29/29은 재사용하며 동일 명령·기존 requestId를 다시 실행하지 않는다. #996 C NO-GO는 이 공유 설치 효과에 한정; 중앙 8/8 DONE, 신규 격리 자연 Writer B E2E 4/5 DEFERRED, 다른 기능 무관 독립 진행 유지.

### 0.13 2026-11-13 중앙 NO_WORK와 WinPE 승인 경계

**원래 중앙 목표 판단:** 기존 중앙 인계 8/8 DONE이며, 4/5 격리 Writer B 자연 적격 장애 실증은 미래 DEFERRED로 유지한다. [기존 중앙 자동화](https://chatgpt.com/) `Automation_9a403a04a8ac8191a331e94f9abeb1b4` 최신 2026-11-13 KST 실행은 `completed/NO_WORK`, 새 적격 인계 0, 새 처리 0, 운영 쓰기 0. 기존 `agent-handoff` 열린 사건 8건은 역사적 분류·원담당 처리 기록이며 `handoff-agent-pending` 미처리 0건. 최근 24h PC/Writer B intake workflow `failure/timed_out` 0건은 원본 자동화가 조회 범위를 완성한 결과다. 새 사건을 만들어 5/5 실증을 앞당기지 않는다.

**#996 C 담당으로 넘길 실제 미완료 범위(중앙 업무 선행조건 아님):** C 원담당 Draft [#1222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1222)의 namespace 동시 삽입 결함은 [기존 격리 Windows native #43254827851](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43254827851)에서 TEMPorary synthetic fixture 음성시험으로 재현, 생산 C 진입/이동 두 STOP 불변. 그 다음 기존 ZGMINI PC **WinPE 오프라인** 설계로 전환하려면 [별도 C WinPE TEST_ONLY 승인/운영 현황 문서](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/docs/CONTROLLER_996_WINPE_ISOLATED_RUNTIME_APPROVAL_20261112.md)를 따름. 공통 대기열 PC ISO `ISO_ONLY_PASS`, 가상화 펌웨어 `VirtualizationFirmwareEnabled=true`는 이전 실측 완료. **실제 VM boot·WinPE CNG 6/6은 NOT_TESTED**, 기존 VM 고정 경로 6/6 ABSENT지만 portable 전수 미조사, 원본 사용자 TEMP 접근 `EPERM`. 새 VM 설치·드라이버·호스트 부팅/사용자 ISO ACL 변경은 별도 사용자 승인 없이는 불허. 이번 사용자 ‘계속해라’는 범위 밖 C 관리자 효과에 대한 별도 승인으로 해석하지 않는다.

**WinPE 이미지 별도 원본 문제:** [WIMGAPI 비민감 비교 JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/artifacts/controller-996/zgmini-996-wim-metadata-readonly-20261112.json)은 ADK SOURCE XML 2306 bytes → FINAL WIM XML 1708 bytes, `EDITIONID/INSTALLATIONTYPE/PRODUCTTYPE/PRODUCTSUITE/LANGUAGES/DEFAULT` 누락 및 `VERSION.BRANCH` 소실이 `IMAGE_METADATA_DRIFT_CONFIRMED`임을 입증하나 **최초 변경 단계와 WinPE 부팅 실패는 입증하지 않는다**. Microsoft [DISM 공식 image mount/commit/export 명세](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/mount-and-modify-a-windows-image-using-dism)는 image modification·commit·export를 개별 단계로 분리한다. 실제 이 ISO의 export 단계 수행 여부는 불명확하므로 export가 원인이라고 단정하거나 원본 WIM을 재생성·보정하지 않는다. C 담당이 후속 승인을 받아 실제 원본 WIM 단계 진단이 필요할 때는 **기존 source SHA·검증된 원본 해시·동일 사용자의 정상 허용 읽기 전용 경로**에서만 최초 drift 위치를 찾는다. 새 Gate 추가나 자동 VM 설치와 묶지 않는다.

**단일 다음 작업 선정:** 총괄은 본래 업무에서 신규 인증된 자연 인계 사건이 나타날 때까지 `NO_WORK/DONE` 유지; C 복구는 **#996 Owner의 별도 승인/독립 실행기 정본 작업**으로 계속한다. 과거 R3/R4·CI 성공 재실행, #996 C 원본 Windows 명령 재실행, WinPE VM 설치·리부트, 새로운 예약/Runner/Controller 불필요. 주기가 도래하는 자동화만 기존 한 개를 재사용한다.

### 0.14 2026-11-13 후속 직접 재조회 — #996 R5 읽기 실패 범위 및 중앙 무작업 판정

- **중앙 큐 현재 GitHub 검색:** `label:handoff-agent-pending is:open` 0건, `label:agent-handoff is:open` 8건. 새 인증된 수리 가능 Incident의 원본이 없으므로 중앙 본업은 `NO_WORK`; 8건의 과거 이력을 새 사건으로 다시 접수하거나 Writer B 실패를 인위적으로 만들지 않는다. 4/5 자연 실증은 `DEFERRED`이며 완료를 허위로 선언하지 않는다.
- **C996 R5의 정확한 실패 경계:** 원본 [Issue #1252](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1252)의 [Run 43103166518](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43103166518) 원격 [JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/c996-r5-43103166518-1.json)과 TXT는 `STOPPED/EPERM`, `PRE_INPUT_HASH → FINAL_WIM → PATH_LSTAT`, `pinCount=0`, `logCount=0`, `rootCauseStage=UNKNOWN`, `operationalWrites=0`, `automaticRetries=0`을 확인한다. **이 실행은 원인 분석 완료나 WIM 변형 단계의 실측이 아니다.** 같은 Runner·경로에서 재시도하지 않고 기존 ID·실패 증거를 보존한다.
- **이미 존재하는 소스 범위:** C Owner 브랜치 `tools/BUILD_996_WINPE_CNG_TEST_ONLY.cmd`는 EXE 컴파일·dumpbin·해시 생성만 수행한다. 이 소스가 WIM mount/commit/export 또는 ISO 제작을 수행했다는 증거는 없다. `tools/c996-r5-evidence-readonly.mjs`는 기존 파일/로그 확인 전용이지만 실제 Runner는 첫 WIM 경로에서 `EPERM`으로 종료됐다. 원본 사용자 세션에서 시행된 ISO 생성의 정확한 DISM 단계 순서·중간 WIM 관측값은 현재 제공된 GitHub 증거로는 확인되지 않는다. `IMAGE_METADATA_DRIFT_CONFIRMED`와 `ISO_ONLY_PASS`를 보존하고 부팅 실패·원인 단계 추정을 하지 않는다.
- **다음 필수 행동의 담당/승인 분리:** 중앙은 현재 `NO_WORK/DONE`이며 기존 자동화만 유지. 별도 단일 #996 C Owner는 **새 승인 없이 운영 복구/VM 설치·부팅을 하지 않고**, 기존 원본 단계별 로그·해시가 정상 인가 경로로 이미 존재하는 경우에만 최초 drift 단계를 추적한다. 그러한 증거가 없다면 기존 WinPE TEST_ONLY 별도 효과 승인 결정 또는 다른 검증된 배타 설계를 우선해야 한다. 안전 STOP 2개, 원본 Claim/Lease·Workflow/Backlog, 운영 PC/DB 보호 유지. #996는 독립 기능들의 전역 Gate가 아니다.

### 0.15 2026-11-13 5개 기능의 승인된 독립 경로 검증·실제 인계

- **GitHub 실제 원장 인계 완료:** 기존 [#68 댓글 #6829732572](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6829732572)에 물가·시장 캘린더·테마 공포탐욕·고용·D05의 마지막 증거, 실행 가능한 다음 한 단계, 정확한 STOP, 담당을 기록. 타 ChatGPT 대화의 자동 수신·실제 5개 실행 성공이 아니므로 인계 기록과 원담당 실행을 분리한다.
- **실제 설치 SHA의 등록 범위 시뮬레이션(소스만):** 기존 운영 결과에서 확인된 Controller `badad9124157879d7a645b64f2768113d632355b`의 `config/operations.json` blob `d22d18bd9b252cbaa5e6b8e082377a872630b2b3`와 `main=5c65bd0944004c4620483386889039a864f95dd3` config blob `c906683afd487762f5bc32f50a199679df200dc3`를 비교. 설치 A: `inflation-candidates-runtime-readonly`, `release-calendar-runtime-readonly`, `theme-l7-runtime-readonly`, `employment-r6-candidate-stage-readonly` (4개). **운영 미등록**: `source-inventory-runtime-readonly`, `employment-r6-collection-evidence-readonly`, `d05-lineage-readonly` (3개). 이 소스 비교는 현재 실제 PC 등록·실행을 새로 검증한 것이 아니다; 설치 안 된 operation만 `AUTOMATION_BLOCKED` 대상으로 구분하고 모든 기능의 전역 BLOCKER로 확장하지 않는다.
- **기존 A 증거 중복 실행 배제:** 물가 [#1297](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1297) 4/7 유효(CPI 2 INVALID, Census 1 MISSING), 테마 [#1298](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1298) R181 STOP 및 비민감 오류 흐름, D05 기존 Writer [#1234](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1234) 설치 VERIFIED/Controller 신규 진단 [PR #1236](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1236) main 병합을 각각 기존 LAST PASS로 재사용. 새 PC 요청·무의미한 동일 CI 재실행 0건.
- **공식 파일 외부 공개 경로 점검(운영 수집 아님):** BLS 고정 원문 `https://download.bls.gov/pub/time.series/cu/cu.data.12.USHousing`을 공용 웹 읽기로 확인하였고 `CUSR0000SEHA` 및 `CUSR0000SEHC01` 행이 실제 존재한다. 현재 원본 PC CPI INVALID를 공급자 소실이라고 단정하지 않는다. Census 고정 XLSX는 사용한 웹 문서 읽기 도구가 바이너리 형식으로 지원하지 않아 **원문 파싱 검증 미실시**; 이를 공급자 다운로드 실패나 원자료 비정상으로 판정하지 않는다. [기존 manual-B 정본](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/inflation-manual-b/README.md)의 Task→Node→E: lock owner 관측 결손이 먼저 해결되어야 기존 승인 1회 B를 안전 실행 가능. 09:00 시각 Gate는 없다.
- **중앙 자동화 직접 점검:** 기존 `Automation_9a403a04a8ac8191a331e94f9abeb1b4` 활성 `true`, 최신 Run `8000c8d1-a4d8-8329-b5c9-96c87dd8db05` `completed/NO_WORK`, `requires_user_action=false`. 추가 예약·인위적 실패·#996 C 실행/Workflow/Backlog/Claim/Lease 변경 0. 중앙 8/8 DONE, 격리 E2E 4/5 DEFERRED, #996 80% NO-GO 유지.


### 0.16 2026-11-13 물가 B #1336 교차 검토 및 중앙 대기열 현행 판정

- **현행 GitHub 교차 검사:** 제어 저장소 `main=1ab6a6147b62f265aeafdd32af0db545e5ba48c7` 시점의 기존 `APPROVED_B` 승인 JSON과 [Draft PR #1336](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1336)의 새 JSON을 필드 전수 대조했다. 키 목록 동일; 변경은 `status: APPROVED_B→DRAFT_NOT_APPROVED`, `sourceSha: 48d3478030590ca63aaab2435e88c896608c70d3→05d7ae49e0a84cbeebd90ef4de6dd7284094bf97` 정확히 2개뿐. sourceFiles 4/4, providerUrls·targetFiles·단회·Core lease·모든 제한 쓰기 플래그 불변. PR은 OPEN/DRAFT, 승인 리뷰/운영 실행 아님.
- **source provenance 오판 정정(실제 좁은 검증):** 운영 PC [A #1326](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1326)의 원격 JSON에서 `historicalCheckoutCandidate`는 고정 `projects/zgmini-earnings-history-pc-release`, `gitVerified=true`, `trackedDirty=false`, HEAD=`config.source`=`Writer checkpoint`=`05d7...`, Writer 파일 169개·모듈 159개 SOURCE_ONLY 검증을 기록한다. 동시에 `sourceResolved=false` 및 `runtimeSourceVerified=false`이므로 이 후보가 **실제 Core Task 실행 source**라는 근거로 확대하지 않는다. 고정된 물가 B `SOURCE_ROOT` 후보의 존재/파일 해시와 Core 런타임 증명은 별개다. 설치 A [#1332](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1332)는 `inventoryTruncated=true`, `candidates=[]`로 전체 디렉터리 탐색 한계가 있어 반복하지 않는다. `zgmini` REST commit 조회에서 **현재 `05d7...`뿐 아니라 기존 `APPROVED_B`의 `48d347...` 및 더 오래된 `427313...`도 모두 422**이므로, 원격 커밋 접근 가능성을 현 B 신규 승인만의 추가 필수 Gate로 만들지 않는다. 대신 이미 실PC [#1327/#1328](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1327)에서 일치한 정확한 4파일·고정 효과·신뢰된 로컬 Git provenance 및 잠재 영향 범위를 기존 승인 계약으로 Owner가 판정한다. 검토 정정은 [PR #1336 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1336#issuecomment-6832748982)에 남김. `APPROVED_B` 승인 및 Workflow opt-in은 여전히 미완료.
- **활성 조건·영향 범위:** 격리 [Run #43279174086](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43279174086)의 B Workflow 조건은 false. [#1334](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1334) CPI #22/#23 INVALID·Census #28 MISSING, PPI #24 203건 유효 보존. #996 C 설치 NO-GO는 Writer B 전역 Gate가 아니며 B 자체 Core 소유권·원본 보호 검사 유지. 원래 B [#1177](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1177) 재접수 금지. 물가 기능 42%, 23/26 raw·4/7 공개 변동 없음.
- **실제 인계 행동:** 총괄이 [PR #1336](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1336)에 GitHub **COMMENT review #5880042912**를 등록하여 두 필드 승인 범위와 원격 출처 미입증·중복 A 배제를 명시했다. 이것은 `APPROVE` review가 아니며 PR 상태·manifest·Workflow·Runner·PC·DB·D1를 바꾸지 않는다. 댓글은 다른 ChatGPT 원담당의 실제 수신/기동을 증명하지 않는다.
- **중앙 현재 상태:** `repo:... is:open label:handoff-agent-pending` 검색 0건, 기존 `agent-handoff` open 8건은 역사적 건. 공통 중앙 **8/8 DONE**, 신설 격리 Writer B 자연 전체 왕복 **4/5 DEFERRED**, 공유 자원 수명주기 **4/5 DEFERRED**, #996 C **NO-GO** 각각 유지. 자연 수리 사건 0건인데 인위적 B/장애 생성·전역 업무 중지 금지.
- **다음 필수 실행(물가 B 원담당/승인 Owner):** 현 PC `05d7...` 신뢰 출처·기존 동일 효과·정확한 승인 source 해시 검토 → 신규 `APPROVED_B` 여부 명시 결정. 실제 승인 이후에만 manifest Git blob/SHA256 및 B opt-in 정규 활성 확인 → 새 고유 단회 B에서 내장 12분 Core owner 검사→공식 BLS·Census GET→CPI 복구/PPI 203건 보존/Census 저장·readback. 총괄의 중앙 8/8을 이 승인에 대한 추가 Gate로 만들지 않는다. 예약 자연검증은 기능 완료 후 후속이다.


### 0.17 2026-11-13 Census XLSX 관계 속성 순서 수정 — 실제 PR CI PASS

- **기존 실패의 실질적 범위:** `zgmini/main`의 공통 `lib/diagnostic-layer/xlsx-lite.mjs`는 `Id` 뒤에 `Target`이 나와야 `<Relationship>`을 파싱하는 형식 의존성을 가졌다. openpyxl 유효 XLSX 합성 fixture에서 `Target→Id`가 나타나면 기존 관계 검색 **0건**이고 순서 독립 판독은 **3건**인 점을 재현했다. 실제 Census 공식 `naicsinvp.xlsx` 바이너리 자체를 현 웹 도구로 열 수 없어 **공식 파일도 같은 실패였는지는 미검증**. 이를 수집 실패 확정·추가 전역 Gate로 오인하지 않는다.
- **독립 개발·실제 무료 CI:** `zgmini` 공개 main `643b7c7c4372ffad552443fc312c6cb1b944e2fc`에서 독립 브랜치 `codex/xlsx-lite-relationship-order-safe-20261113` → [Draft PR #1061](https://github.com/ansqhd5774-Choi/zgmini/pull/1061) HEAD `d68a3cce93ef26b3029a49462fc10fdff5c73f7e`. **변경 정확히 3파일**: 공통 XLSX 파서 속성 순서 무관 처리 / 기존 물가 공식 압축 XLSX 테스트에 `Target` 선행 fixture 1건 / 기존 `tests/*.test.mjs` 표준 CI 진입점에 기능 테스트 연결. 새 Workflow·유료 Runner·운영 source/PC 설치 없음. 실제 [CI Run #43285591364](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/43285591364) `completed/success`: 빌드·Typecheck PASS, Node 회귀 4192개(4183 PASS, 실패 0, skip 6, todo 3), 기존 PC 게시 복구 11/11, Cloudflare candidate 69/69 PASS. Job 로그에서 Census 기존 압축 XLSX end-to-end PASS 및 신규 Target-before-Id 테스트 PASS를 직접 확인. Source fixture·CI 결과가 **실제 공식 Census 다운로드/운영 B 실행 성공은 아니다**.
- **원담당 인계 및 차단 조건 분리:** [#1177 결과 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1177#issuecomment-6833153530)는 변경 SHA·테스트 증거·Owner 검토 경계를 기록한다. [현재 물가 B Draft PR #1336](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1336)은 기존 PC 로컬 HEAD `05d7…`/4파일 SHA 4/4 동일효과의 승인 검토로 **별개 진행 가능**. 새 파서 후보 #1061 반영을 `#1336` 승인 선행 Gate로 만들지 않는다. 반대로 새 파서를 운영에 실제 적용할 때는 그 변경 파일의 정확한 source/file SHA와 기존 승인 manifest/보호 조건을 업데이트·검증하지 않은 채 old 4/4 승인으로 몰래 실행하지 않는다. Draft PR 2건 모두 미병합이고 현재 `ZGMINI_INFLATION_MANUAL_B_ENABLED` 조건 false; B 신규 Issue/운영 PC 수집/DB/D1 쓰기 0.
- **현재 판정/다음 필수 단계:** 총괄 중앙 8/8 DONE, 격리 자연 인계 왕복 4/5 DEFERRED, 공유 자원 수명주기 4/5 DEFERRED, #996 C NO-GO 유지; 물가 전체 42%, 원자료 23/26, 공개 4/7 유지. 물가 원담당 Owner는 **#1336 기존 동일효과 B source PIN의 승인 가능성**을 먼저 판정하고, 적법한 승인 후에만 opt-in과 고유 B 단회(자체 12분 Core owner 관측·공식 2GET·CPI 수리/PPI 203건 보존/Census 저장/readback)를 실행한다. #1061 파서는 독립 유지보수 후보로 승인·적용 판단. 예약 자연갱신 검증은 기능 완료 이후 후속.

## 1. 기존 5건 판정 — 4/5 완료(80%)

| ID | 상태 | 재사용 근거 |
| --- | --- | --- |
| #433 | DONE | #449 B·#451 A 이후 #452 실PC R54 6/6 SHA 및 원격 결과 |
| #435 | DONE | #451/#452 실제 TXT·JSON 원격 GET 검증 |
| #437 | DONE | 소스 14/14, 실제 GitHub 17/17 KPI 분석 |
| #442 | DONE | #454 B·#455 A, Actions cleanup `CLEANED/5` |
| #434 | EFFECT_RUNTIME_PENDING | 유지보수기 자체 인계 PASS, 소스 30/30; 신규 E: 파일 0 및 요청 ledger 실측 미완료 |

이 5건은 기존 운영 개선 원장의 범위다. 일반 기능 구현·R54 게시·미래 별도 개선은 5건 완료율에 섞지 않는다.

## 2. P0 — R54 일회성 결과 TXT의 E: 생성 원인 **확인됨**

증거: 사용자 보관 `ZGMINI_R54_READER_ONEFILE_INSTALL_ONCE_V4_20261106.zip`, ZIP SHA-256 `1a9263348cbc55537e50b0483e4d48562cfc901b1f16c9318d76a8ddd983c0ec` 내부 `r54-reader-onefile-v4.mjs` SHA-256 `df2b15fe97b97fa3cb0b880245fb86e715f2d08d5415e5417a55bed9c4767d97`. 실제 원본 결과 `R54_READER_ONEFILE_INSTALL_RESULT_V4.txt`: `READER_INSTALLED_VERIFIED`, target AFTER `30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85`.

원인 위치:
1. `ROOT = E:\\ZGmini\\data\\pc-writer\\theme-nine-r54`.
2. `apply()`에서 `reportDir = path.win32.join(ROOT,'maintenance','r54-reader-onefile-v4-'+stamp)`로 생성.
3. 이 경로의 `theme-nine-r37-public.before.mjs`는 검증된 **복구 백업**이므로 E: 보존이 맞다.
4. `finally`에서 **일회성** `R54_READER_ONEFILE_INSTALL_RESULT_V4.txt`까지 같은 `reportDir`에 `fs.writeFileSync(...,{flag:'wx'})`하여 E:에 남긴다. 조기 중단 보고서는 `HERE`(압축 해제 위치)에 저장한다.
5. `README_V4.txt`도 해당 E: 결과 경로를 사용자에게 안내한다. 이는 공통 규칙 누락이 아니라 **이 패킷의 출력 경로 구현** 문제다. #434 유지보수기 결과 저장 경로와는 별개다.

**반복성 확인(2026-11-07):** 이전 V3 ZIP(`ZGMINI_R54_READER_ONEFILE_INSTALL_ONCE_V3_20261106.zip`)의 `r54-reader-onefile-install.mjs`도 `backupDir = path.join(HOME,'maintenance',...)`에 일회성 `R54_READER_ONEFILE_INSTALL_RESULT.txt`를 함께 저장한다. V3→V4 반복은 확인됐지만 이 둘은 독립 일회성 패킷이며, **하나의 공통 생성기 소스는 아직 발견되지 않았다.** 반면 제어 저장소의 `calendar-b-twofile/install.mjs`·`calendar-cache-hotfix/installer/install.mjs`는 이미 `RUNNER_TEMP ?? os.tmpdir()`를 사용한다. 중앙 Controller 경로의 신규 전역 차단/재작성은 불필요하며, 실제 재사용되는 R54 패킷 생성 원본 또는 템플릿에서만 출력 기본값을 개선한다. 원본 V4 성공 패킷을 수정·재발행해 재설치를 유도하지 않는다.

**다음 필수 실행 한 건 — 담당: R54 일회성 설치 패킷/공통 출력 템플릿 소스 담당.**
- 이 V4 패킷의 생성·재사용 템플릿이 실제로 있는지 원본 저장소/담당에서 식별한다. 현재 조사로는 R54 V4 패킷 내부 직접 하드코딩만 확인됐고 공통 생성기 경로는 **미확정**이다.
- 재사용 템플릿이 확인되면 기본값에서 `backup`은 기존 E: 복구 위치로 유지하고 결과 TXT/JSON·실패 보고는 `os.tmpdir()`(Windows 사용자 `%TEMP%`)의 고유 파일 또는 기존 승인 원격 결과 경로로 분리한다. 별도 생성기가 없으면 **향후 일회성 패킷의 실제 출력 함수**만 최소 수정한다. `console.log` 결과/업로드 호환은 보존.
- 정상 완료·사전 STOP·rollback 오류의 **격리 fixture**에서 E: 일회성 결과 생성 0, 복구 백업 원본/해시 보존, 결과 회수 가능, 기존 CAS·rollback 보호 유지 여부만 관련 테스트한다.
- 이미 성공한 V4 재실행·재설치·E: 기존 파일/백업 삭제 금지. 공용 Controller/Runner/예약/DB/게시 변경이나 새 전역 Gate 금지.

## 3. P1 — #434 자연 B 효과: 기존 #476을 후보로 범위 한정 검증

[Issue #476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476) (2026-11-06 12:57 UTC 생성)의 기존 `pc-maintenance`:
- requestId `pc-update-1d8e5eaf-9d8d-4b22-99f8-c59b3116ac54`
- 저장된 JSON `SUCCEEDED`, 실제 Controller `0492f6f5bb16769e914ca85c63db119979fcf0a6`, 보호/Workflow 양호
- TXT·JSON 원격 결과 경로 존재, 댓글 `REPORT_UPLOAD: VERIFIED` 1개 확인. 이 원격 사실은 신규 E: 파일 0이나 로컬 ledger 검증을 대체하지 않는다.
- 확인할 두 조건: (a) 해당 요청이 실제 수정 유지보수기 인계 **후** 처리됐음을 요청 시각/installed source로 확인, (b) 기존 승인 읽기 전용 경로로 같은 requestId의 영속 ledger `reportUploadStatus=VERIFIED` 및 E: `reports/MAINTENANCE_<requestId>.txt/json` 신규 생성 **0**을 확인.
- 실제 확인 경로/권한이 없으면 `EFFECT_RUNTIME_PENDING` 유지. 신규 시험 B·이전 B 재접수·유지보수기 재인계·범용 E: 조회기 추가·기존 로그 삭제 없음. 다음 정규 B에서 이미 제공되는 증거를 재사용한다.
- #434 대기는 R54·R17·ER1 등의 독립 기능에 **NON_BLOCKING**.

## 4. 마감 기준과 제외

- 프로세스 5건 완료율은 #434 위 최소 효과 증거 전까지 80% 유지. B 작업 성공이나 원격 파일 존재만으로 100% 주장하지 않는다.
- R54 실제 9테마 공개 checkpoint→D1→API는 **R54 원담당 업무**이며 총괄이 설치·게시를 대신하지 않는다.
- GPT R6.0과 GitHub main의 E: 규칙 및 역할 분리는 정합하다. 신규 중복 규정·상시 Controller 전체검사·미래 자연 실행 대기 Gate는 추가하지 않는다.
- 이 문서의 저장만으로 다른 일반챗 수신, Windows 적용, GitHub main 반영, 실제 PC 검증이 이뤄진 것은 아니다.
