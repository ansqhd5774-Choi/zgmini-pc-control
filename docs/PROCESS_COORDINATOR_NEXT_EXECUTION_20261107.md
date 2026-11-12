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
