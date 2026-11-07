# ZGMINI 공통 실행·설치 경로 개선 R2 — 진행 원장

- 시작일: 2026-11-07 KST
- 이슈: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/622
- 계획: [PROCESS_PLATFORM_R2_PLAN_20261107.md](PROCESS_PLATFORM_R2_PLAN_20261107.md)
- 전용 브랜치: codex/controller-ops-lessons-20261105
- R1 완료 기록: #526 / R1 M0–M4 100% 보존
- 기준: 단계마다 20%, **증명되지 않은 운영 상태를 점수에 반영하지 않음**
- **현재 진행률: 20% (M0 DONE, M1–M4 미완료)**

## 최신 상태

| 단계 | 상태 | 누적 진행률 | 이번 확인 / 남은 증거 |
|---|---|---:|---|
| M0 계획·기준·지침 | DONE | 20% | Issue #622 + 계획·원장 전용 브랜치 저장. 최신 main 지침 PR #624 병합, 3개 파일 원격 재조회 본문 정확 일치 |
| M1 읽기 전용 A | RUNNING (신규 Controller 실PC 설치, 모듈 목록 조회 미회수) | 20% 유지 | 공통 A 보완 PR #658 병합·#660 설치 PASS·#661 A 진단 PASS. #662 모듈 목록/동적 Core Runtime 연결 아직 미확인 |
| M2 공통 Writer B | RUNNING (정상 실PC 적용 입증, 의존성 최소 보완 중) | 20% 유지 | 일반 Writer B #651 정상 적용·A #652 사후 PASS. #657에서 preview 의존성 누락을 안전 중단; 실PC lib/worker 목록 확인 후 새 manifest 범위 확정 |
| M3 실패·정상 회귀 | 독립 시나리오 5/5 PASS (M1/M4 실운영 증거 별개) | 20% 유지 | 현행 main 원문 8파일 Git blob 일치·집중 Node 40/40 PASS, 실PC #651 정상 B·#646 원복·#657 의존성 STOP 증거. Windows Runtime 연결·인계는 M1/M4에 남음 |
| M4 실PC 적용 경로·인계 | DEFERRED | — | 승인 실PC 결과, requestId/보호 상태 및 원담당 실제 수신 |

**진행률 원칙:** M0가 모두 검증되면 20%; M1 40%; M2 60%; M3 80%; M4 100%. 코드 작성·PR 병합은 설치·운영 완료의 대체 증거가 아니다.

## 2026-11-07 — 신규 프로젝트 수립

### 기존 증거 재사용 (새로운 설치 성과 아님)
- Inflation19 기능: https://github.com/ansqhd5774-Choi/zgmini/pull/981 — PC 설치·자동 갱신 성공 아님.
- 물가지표 A거부: #353/#356/#362 (SCRIPT_REFERENCE_UNRESOLVED / LAUNCHER_FORMAT_UNSUPPORTED), #614 (OPERATION_NOT_ALLOWED).
- PC Controller 이전 실제 설치: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/608 — 당시 설치 SHA db8924162d42adf6ee6aa27a04ce1719c8fe96c2.
- R17 통합 승인 manifest: https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/615 — GitHub 준비/병합과 PC 설치는 다름.
- Controller B 운영 적용은 #68의 기존 단일 담당이 처리. R2의 중복 B 제출 0건.
- R1 Issue #526 CLOSED, 기존 프로젝트 완료 증거 보존.

### 수행·영향
- 새 추적 Issue #622 생성.
- 기존 프로세스 총괄 브랜치에 R2 계획·원장을 신규 생성. 기존 R1 기록·기능 소스 수정 없음.
- 공통 지침 수정: [PR #624](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/624) 병합, merge commit a842f4225ce062dce6ce3dc85d8e15c750ca4220. 최신 main 기준 3개 Markdown 파일만 변경(AGENTS.md, docs/GENERAL_CHAT_PREWORK.md, docs/PC_AUTOMATION_STANDARD.md). main 원격 파일 3개 내용이 PR 브랜치의 목표 본문과 정확히 일치하는 것을 확인.
- §2 신규 기능 초기 공통 A/B 경로 매핑, §5 범위 제한 Writer B 계약, §8 반복 문제 구조 개선 기준 반영; 원담당 대리 설치·프로세스 Gate 추가 없음.
- 새 예약·PC A/B 실행·DB/D1/운영 Writer 변경 0건.

### 다음 필수 행동
- M1: 기존 operation 지원·실제 PC 허용목록·VBS 다단 래퍼의 읽기 전용 진단 계약을 필요한 범위에서 대조. 최신 Controller 실제 설치 결과가 나오면 #614 거부 원인과 구분해 실PC checkout/HEAD/config.source/세 파일의 SHA/dirty를 회수한다.
- M2: 공통 Writer B의 기존 자산·승인 범위와 3파일 manifest 수신 경로를 병렬 준비한다. 실제 운영 쓰기는 기존 #68의 단일 담당/lease로만 진행한다.

### 명시적 미확인
- 현재 Controller/PC Writer 설치 SHA와 실제 Core 승인 source는 본 실행에서 새로 조회하지 않음.
- #614 A거부 해결, Writer B 경로 설치, 19개 지표 자동 게시 성공, ER1 B 설치 성공 모두 **미확인**.

## 2026-11-07 — M1 읽기 전용 코드 감사 착수 (아직 M1 PASS 아님)

- 현재 main의 [controller/pc-source-readonly.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/controller/pc-source-readonly.mjs) (blob e12b2ed6a282b450ba0fbbfef03ef4e88b0f57c4): Task XML의 cmd/bat/vbs/mjs 파일 경로를 bounded 정적 추적하지만, 소스 파일 해시 목록은 기존 여섯 경로로 고정되어 PR #981의 물가지표 3개는 포함되지 않는다. 반환 증거도 STATIC_LAUNCHER_TRACE_ONLY로 실제 실행 원본 확정과 구별한다.
- [controller/core-runtime-source-readonly.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/controller/core-runtime-source-readonly.mjs) (blob 6e11effce48a1bf6c4d85493cd23523746d49dc2): 실행 프로세스 체인을 read-only로 연결하는 데 유효하지만 파일 해시 목록은 수익·캘린더 3개로 고정됨; Inflation19 파일 해시·운영 HEAD/config.source/dirty 통합 조회를 바로 제공하지 않는다.
- [config/operations.json](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/config/operations.json) (blob 0b8f8ae3645f2a0d2b54f7ad5ac4f1ebaf5d0cb5): core-runtime-source-readonly A operation은 source에 등록됨. 그러나 #614의 실제 PC 요청 OPERATION_NOT_ALLOWED는 별도 설치·허용목록 불일치 증거로 보존한다. **GitHub 등록을 실PC 활성으로 보지 않는다.**
- 분리된 최소 개선 과제: (1) 다단계 VBS에 대한 고정 허용 경로의 read-only 해석, (2) 공통 승인 manifest 대상 파일 목록의 bounded SHA256/dirty 조회, (3) 실제 PC A 허용목록 활성 후 고유 requestId로 확인. Controller #68 기존 설치를 반복 제출하지 않는다.
- 보존: Runtime·원자료·DB·D1·운영 파일 수정 0건. 새 검사나 전역 Gate 추가 0건.
- **LAST PASS:** source 코드·현재 GitHub 허용목록의 정적 지원 범위 확인.
- **FIRST FAIL / 남은 조건:** 실제 PC A operation 활성/세 파일 read-only 해시를 획득하지 못함(#614 이전 거부 증거). 다음: 기존 Controller 설치 담당의 실제 설치 결과 대조 후 허용된 A 요청; 동시에 source의 bounded 진단기 개선·관련 fixture 테스트.

## 2026-11-07 — M1 공통 A 코드·회귀 완료 (Runtime 별개)

- [PR #625](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/625) 최신 main 병합: merge SHA **6348be5201801e008be10867fd68add4ddeca52c**, 변경 파일 2개만.
- [controller/pc-source-readonly.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/controller/pc-source-readonly.mjs) blob **3ab1095a61e3c1b22918689e7cafc0950f7e1022**, [tests/pc-source-r2-readonly.test.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/tests/pc-source-r2-readonly.test.mjs) blob **d2f1e10a4ff0cb954d7d9eb27b759b0766253c21** 원격 main 재조회.
- 다단계/UTF-16LE VBS read-only 정적 추적, bounded scripts/pc-writer/*.mjs 파일명/SHA256/dirty inventory, config.source SHA↔HEAD 비교. 무관 파일의 2MB 초과·비정상/심볼릭 링크 오류는 partial issues[]로 분리해 정상 파일의 해시를 보존한다.
- 관련 격리 테스트 **18/18 PASS**, 부모 총괄 독립 재실행 exit=0. 초기 UTF-16LE 1건 실패와 무관 파일 전역 차단 설계를 발견해 수정한 뒤 병합했다.
- **LAST PASS:** source 병합·원격 재조회·격리 18/18 PASS.
- **FIRST FAIL / 미확인:** 해당 수정은 PC 설치 증거가 아니며, #614 운영 Controller A 허용목록과 실제 조회 요청·writer checkout/HEAD/config.source/PR #981 세 파일 해시·dirty 회수 미완료. M1 **RUNNING**, R2 **20% 유지**.
- **다음:** #68 원담당의 실제 Controller 설치·A 활성 결과를 확인한 뒤 같은 요청 ID를 재사용하지 않는 승인 A 1회로 대상 PC 증거 회수. 별도 기능 CMD·새 예약·중복 Controller B 제출 금지.

## 2026-11-07 — M2 공통 Writer B 코드 초안 (수신 미완성)

- [Draft PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) (브랜치 codex/controller-process-platform-r2-writer-b-20261107), 신규 4파일만: writer-b/contract.mjs, installer.mjs, 각 테스트.
- 재사용 근거: r17-writer-b/r17-b-claim.mjs(공유 writer-source-install.lock/요청 원장), r17-b-git-stage.mjs(격리 commit/해시 검산), r17-sip-refresh-b/install-core.mjs(대상 dirty/backup/Core drain/config.source CAS/rollback). 고정 R17/calendar 설치기와 Controller-only maintenance를 다른 기능 설치로 우회 사용하지 않음.
- 계약: private owner Issue/요청 SHA/승인 manifest 원문 해시, source HEAD=config.source, 파일 1~32개 변경 전/후 해시·허용 경로, 단일 Writer lock, backup/restore/RECOVERY_REQUIRED, provider/DB/D1/Task definition write 금지. 원격 입력 임의 shell 실행 없음.
- 로컬 fixture **14/14 PASS**, 부모 독립 재실행 exit=0. 인증된 authorizeWriterBIssue 결과만 installer coordinator가 받는 내부 seal 보완 포함.
- **LAST PASS:** SOURCE_READY / FIXTURE_PASS / 4파일만 격리 PR.
- **FIRST FAIL / 미완성:** Windows adapter + 실제 B 요청 수신 Workflow/Runner 연결·결과 원장/실PC 적용이 구현·검증되지 않아 일반 Writer B 설치 가능 상태를 주장할 수 없음. M2 **RUNNING**, 전체 R2 **20% 유지**.
- **다음:** 기존 자체 Runner 승인 B 전달 방법과 보존된 Windows 자산을 좁게 재사용한 adapter/receiver 구현·관련 격리 테스트. 실제 운영 적용은 #68 단일 담당·승인 경로에서만 수행.

## 2026-11-07 — M1 실설치 연계 정밀 분기 (READ-ONLY)

- #608에서 실제 설치 확인된 Controller SHA db8924162d42adf6ee6aa27a04ce1719c8fe96c2, #614에서 그 설치 SHA의 A core-runtime-source-readonly가 OPERATION_NOT_ALLOWED(2026-11-07 05:33 KST).
- #615(기존 Controller R17 통합) 승인 manifest는 **db892→f6338ee4**의 고정 **5파일**이며, R2 PR #625의 추가 A 진단 코드 controller/pc-source-readonly.mjs는 포함하지 않는다. 기존 승인서를 6파일로 읽거나 수정해서 재목적 사용하지 않는다.
- **현재 설치가 db892라면:** 해당 5+신규 1파일의 누적 실제 변경·각 소스 SHA/승인 범위를 대조한 불변 6파일 통합 B manifest 후보를 #68 단일 적용 담당이 준비·확정.
- **이미 f633 설치가 성공했다면:** 실제 설치 SHA/target 누적 diff에 맞춰 신규 A 파일 1개만의 범위형 후속 manifest 판단.
- **다른 설치 SHA면:** 실제 PC 값에서 다시 누적 diff 작성. 기존 유지보수기의 Controller 파일 allowpath가 R2 A 파일을 지원하므로 별도 B 설치기/예약 불필요.
- 다음 실PC 단계: #68 B 담당의 실제 requestId·설치 SHA·A operation 활성 확인 후 고유 A pc-source-preflight로 정적 checkout/file hash 확인, core-runtime-source-readonly의 WMI runtime 체인과 비교. 두 A의 증거 수준 혼동 금지.
- **LAST PASS:** 소스/manifest 범위 차이와 기존 B 경로 지원을 read-only 확인. **FIRST FAIL:** 현재 실제 설치 SHA와 #68 활성 lease 미조회; R2의 실PC 진단 결과 없음. 중복 B 요청 0, 운영 수정 0.

## 2026-11-07 — M2 범용 Writer B 수신 초안 확장 및 독립 재검증

- [Draft PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) 현재 **신규 11파일**, 기존 공용 Controller/R17/캘린더 운영 파일 수정 **0건**. 범위형 계약·staging/commit·Windows 어댑터·기존 R17 공유 Writer lock/Task probe·일회성 승인 Issue Workflow·위변조 방지 결과 보고 포함. PR은 Draft 상태 유지, 실행 등록/설치 없음.
- 자체 개발 코드의 세 그룹 테스트를 총괄이 독립 재실행: `node --test r2-writer-b/contract.test.mjs r2-writer-b/installer.test.mjs r2-writer-b/receiver.test.mjs` **22/22 PASS, exit 0**. Windows 어댑터/결과 보고/사전 검사/격리 Git stage 구문 검사 PASS.
- false PASS 예방: WeakSet 봉인 인증으로 호출자가 승인 boolean을 위조하지 못하게 함; 승인 파일 SHA와 보호 파일 SHA/dirty를 검증, 무관 대용량 파일은 정상 설치의 무의미한 전역 Gate가 되지 않게 bounded metadata로 보존; 외부 결과 2개 중 하나라도 확인 불가 시 성공 댓글 대신 `WRITER_B_STATE_UNKNOWN / RESULT_DELIVERY_UNVERIFIED`.
- 기존 `r17-b-windows-probe.js`는 `ZGMINI-PC-Local-Core` Task와 `local-cycle.mjs/run-local.mjs` process tree를 수치 기반으로 점검. 일반 Writer B도 정확히 동일 Core Task를 명시적으로 고정하는 계약이고 임의 명령을 실행하지 않는다.
- **LAST PASS:** Draft source/테스트 22/22, no live operational writes. **FIRST FAIL/미증명:** Windows host 실제 Runner·Task·config.source/checkout 경로 적합성 및 승인 manifest를 통한 일회성 수신·백업·복구·실설치 해시 확인. M2 RUNNING, 전체 **20% 유지**. Windows 실증 없이는 PR을 운영 main에 자동 병합하거나 운영 설치 완료로 주장하지 않는다.
- **다음 필수 행동:** Draft PR #626 실제 Windows 환경 적합성과 설치/rollback 실패 시나리오를 승인된 경로에서 검증한 뒤 최종 머지·원담당 경로 인계 판단. M1은 #68 기존 Controller 설치 담당의 실제 설치 SHA·A 활성 결과 확보 후 고유 read-only 요청으로 확인. 신규 예약/중복 B 제출/기능 담당 대리 설치 없음.

## 2026-11-07 — M2 독립 안전 감사 및 MUST-FIX 보완

- 추가 감사에서 초기 수신기 초안의 Task 재활성 검사 전 rollback 플래그 조기 해제를 발견. `schtasks /Enable` 반환이 0이어도 실제 Task가 disabled로 남는 시뮬레이션에서 원본 HEAD/config 및 Task 재활성 확인 후에만 안전 복구 판정하도록 **실행기 코드와 fixture 수정**.
- R6 공통 정본의 Writer B 계약은 실행 래퍼·Sidecar 영향 명세를 요구. 공유 `run-local.mjs/local-cycle.mjs` 변경 시에 한하여 승인 manifest에 Task XML SHA 및 실제 연관 VBS/CMD/Sidecar 파일의 byte SHA·dependsOn 기록 필수; 선언한 소비자만 read-only 해시 및 E: realpath 확인. 무관한 단독 파일 변경은 빈 목록 허용하여 새로운 전역 Gate를 만들지 않음.
- [Draft PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) 현재 head **`6fcc7c53f8ac00de4fd1b0829e0cbd4e145de905`**, 신규 **11파일만**, main 기존 파일 변경 0. 총괄이 소스 재조회 후 격리 **24/24 PASS, exit=0** 독립 재실행. `node --check` PASS. Draft 상태, 미병합/미설치.
- R17 공유 lock/Task probe/XML 비교는 계약상 고정된 `ZGMINI-PC-Local-Core` Task와 일치. 다단계 VBS 실제 chain 및 Sidecar가 신규 source SHA를 받아들이는지의 동적 적합성은 아직 A 실측·원담당 영향 검토가 필요하며 **SOURCE_ONLY**에서 확정 불가.
- 공용 [#68 조정 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6696727102)에 #608 현재 마지막 PC Controller 설치 SHA `db892416…`, #615 승인 5파일과 R2 PR #625의 1파일 차이 및 기존 단일 B 담당 설치 분기를 기록. 이 댓글은 다른 GPT 대화의 실제 인수/PC 적용 증명이 아님.
- #68 최근 기록 재확인: #615 목표 `f6338ee4…`의 신규 설치 SUCCEEDED/requestId 및 `core-runtime-source-readonly` 활성 결과는 확인되지 않음. #614 거부 이후 R2 A operation의 PC 성공 증거 없음. R2의 중복 B 요청 0, 운영 변경 0.
- **LAST PASS:** source B 수정본·격리 24/24, 승인 범위 한정 계약/공유 자원 조정 기록.
- **FIRST FAIL/미확인:** 실제 PC sourceRoot/config.source 형식/Runtime 실행 래퍼 및 Sidecar bytes, Windows Runner B 적용·rollback·원격 결과쌍·requestId. M1, M2는 RUNNING; 전체 **20%**.
- **다음 필수 단계:** #68 기존 설치 담당의 B 결과 확보→A 고유 read-only request로 실제 source와 runtime 소비자 목록 확보→기능별 승인 manifest 생성→Draft B Windows 환경 집중 실증·검증 후 통합 여부 판단. M3/M4 선행 완료로 간주하지 않음.

## 2026-11-07 — M1 구형 A operation 재사용 가능 범위 확정 (READ-ONLY)

- #608 설치 SHA `db8924162d42adf6ee6aa27a04ce1719c8fe96c2`의 operations/dispatcher에 이미 `core-status`, `pc-source-preflight`, `pc-source-origin-readonly` 등록. 반면 `core-runtime-source-readonly`는 구 설치 허용목록 밖(#614의 `OPERATION_NOT_ALLOWED`와 정합).
- 기존 `pc-source-preflight`는 다단계 VBS에서 실제 live checkout 추적 실패 가능성이 있고 고정 6파일 해시만 조회. 물가지표 PR #981 대상 3개 중 `run-local.mjs`만 포함; `inflation-causal-public-auto-publication-r1.mjs`, `.test.mjs`는 없음. `config.source`와 3파일별 dirty를 한 번에 제공하지 못함.
- 기존 [#531](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/531) A PASS(KST 2026-11-07 02:09)도 `sourceResolved=false`, `runtimeSourceVerified=false`, 역사적 checkout 후보 HEAD `d7bc4948…` 및 dirty=true였으므로 실 실행 checkout 증거가 아님. [#530](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/530) configApprovedSha 후보 `d7bc…`와 이후 #609 운영 source `f7ed…`의 시점/범위도 구분.
- **결정:** 구형 A를 동일 목적에 재요청해도 M1 목표인 현재 PC live checkout/HEAD/config.source/3개 파일 SHA·dirty를 확보할 수 없다. 일부 보조 조회 가능은 유지하되 새 전역 Gate나 무효한 요청을 추가하지 않음.
- **LAST PASS:** 기존 설치 operation 정적 계약 및 #530/#531 당시 실제 A 범위 확인. **FIRST FAIL:** 신규 A 코드 #625는 main source 병합만 되었고 PC 등록/실행 미증명. #68 단일 B 담당이 기존 승인 누적 diff와 실제 SHA를 반영해 설치한 후 고유 A 요청 + Runtime 체인을 검증해야 M1 완료. 새로운 A/B Issue 0, PC 쓰기 0, R2 20% 유지.

## 2026-11-07 — M2/M3 무쓰기 Windows guard 시뮬 보강

- [Draft PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) head **`884aeee1f535c7808574f56cb4e5d9c373578a32`**, 신규 **13파일**, 기존 운영 파일 수정 0. 운영 수신기 미등록/미설치, Draft 유지.
- Windows adapter 실제 사용 경로에서 Task XML byte decoder·Core quiet 순수 guard를 공용 함수로 추출: UTF-8/BOM/UTF-16LE 정상, 손상/비지원 UTF-16BE 안전 거부, Task disabled+running instance/process/ambiguous 0+Core cycle lock 없음만 drain 판정.
- fixture 추가: Task pause 부분 적용 실패 또는 Core 자연 drain timeout 시 승인 파일/HEAD/config 원본 유지, Task 재활성 및 공유 Writer lock 회수 확인. `/Enable` 정상 반환·실제 disabled 실패 복구 fixture도 유지.
- 총괄 독립 재실행: `node --test r2-writer-b/{contract,installer,receiver,windows-guards}.test.mjs` **28/28 PASS, exit 0**. PR head/13파일·신규 guard 2파일 원격 재조회. source-only simulation은 **실 Windows Scheduler/Runner 설치 실증이 아님**.
- M3 모의 시나리오 일부 RUNNING으로 진전했으나 실제 Windows 정상/충돌/복구 요청 ID 증거가 아직 없어 완료 아님. R2 전체 **20%** 유지. 실제 PC/Controller/Calendar/DB/D1/예약 변경 0.
- **NEXT:** #68 기존 단일 담당의 Controller 설치 성공·신규 A 활성 증거 → 실제 Writer source/Task/VBS/Sidecar read-only 인벤토리 → 승인된 Writer B manifest 확정·Windows 한정 실증. 실제 설치는 원담당 역할을 유지하며 자동 재시도/새 Gate 금지.

## 2026-11-07 — Writer B 공통 경로 셀프서비스 인계 안내 (SOURCE_ONLY)

- [Draft PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) head **`846285b6c4b741cb2b34dc21a9f33cf947d1335c`**, 기존 공용/기능 파일 수정 **0**, 신규 **14파일**(문서 1파일 추가), Draft/미병합 유지.
- [writer-b/README.md](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-process-platform-r2-writer-b-20261107/writer-b/README.md) 신설: 기능 원담당 A 실증 → 정규 승인을 받은 manifest의 원본바이트 SHA → 소유자 1회 B Issue → 원격 JSON/TXT 2/2·실 source/Task 재조회 → 원담당 운영 실증의 자가 재사용 절차를 단계별 기록. 실패·RECOVERY_REQUIRED·STATE_UNKNOWN STOP 및 총괄/기능 역할 구분.
- 실 설치 SHA·경로를 예시에서 추정하지 않고 플레이스홀더/비실행임 명시. 기존 코드 변경 0, 이전 격리 28/28 PASS 증거 그대로 유지. GitHub 원격 README blob **`2ab7f1b1b3e2eb4648d2bd56931f11cdbb950590`** 재조회. 운영 변경 0.
- **LAST PASS:** 공통 수신기 source·순수함수 모의 검증·반복 기능용 사용 안내까지 Draft에서 준비됨.
- **FIRST FAIL/남은 조건:** 실제 Controller A 활성/Writer PC read-only 지문, Windows Runner에서 B 수신/복구 실증, manifest 정규 승인/실행 requestId, 원담당 실제 수신은 아직 없음. M2/M3/M4 완료 아님, 전체 **20% 유지**.

## 2026-11-07 — Writer B 수신기 구조 결함 2건 수정 / 2건 보완 진행

- Draft [PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) head `bd5ebcb0487bf072b57291f5d3f9507acbaddd77`, 신규 14파일, 기존 Calendar/Controller/R17 운영 파일 변경 0, PR 미병합·실PC 미설치 유지.
- 공유 R17 B lock/claim이 발생시키는 정확한 Busy/AlreadyClaimed/LockDrift 코드가 generic B 결과에서 소실되던 결함을 공통 허용코드 1:1로 보존하도록 수정. 임의 오류 문자열 공개는 계속 금지.
- `git status --porcelain=v1 -z`의 무관 rename/copy 두 경로를 무조건 거부하던 불필요한 전역 Gate 제거; 두 경로를 모두 기록하되 승인 target/protected와 충돌하면 그대로 STOP.
- 총괄 독립 재실행 `node --test r2-writer-b/{contract,installer,receiver,windows-guards}.test.mjs` **34/34 PASS (exit 0)**. 실행 결과는 격리 fixture이며 운영 Writer/Task 설치 증거가 아니다.
- 추가 MUST-FIX 검토: 공유 진입점 변경 시 Task XML의 첫 Exec→실제 launcher 경로가 승인 manifest의 LAUNCHER/SHA에 연결되는지 확인(상대 경로는 유효한 Task WorkingDirectory로만 정적 해석; 미확정 시 해당 변경만 STOP). 전체 다단계 VBS/Sidecar dynamic PASS와 구분.
- 기존 R17과 같은 PC local-only 합성 Git commit 사용은 유지하되 운영 SHA를 GitHub 원격 SHA로 오해하지 않도록 Task pause 전 불변 `LOCAL_OVERLAY` 계보 원장(base/tree·manifest·로컬 SHA/tree/ref·대상 파일 해시) 기록 및 결과 명시를 진행 중. 별도 원격 push Gate 추가 금지.
- **LAST PASS:** source 초안 안전 보완 2건/34 fixture. **FIRST FAIL/남은 검증:** first-hop·local overlay provenance 코드/fixture 최종 확인, 실 Windows Runner·Task/Sidecar·A 활성·B requestId/rollback 증거. R2 **20% 유지**, 새로운 PC B 요청·원자료·DB/D1·예약 변경 0건.

## 2026-11-07 — M2 첫 실행 파일·로컬 source 계보 보완 원격 반영

- [Draft PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) **head `03518a89f1c95f5b628642ce84dca889b46c0c95`**, 최신 main 대비 **신규 15파일, 기존 파일 변경 0**, main보다 1커밋 뒤처진 분리 브랜치. 이번 9개 수정·추가 파일 원격 9/9 재조회 일치, Draft/미병합 유지.
- M2 첫-hop 실증 계약: 공유 `run-local.mjs`/`local-cycle.mjs` 변경에서만 실제 Core Task XML의 정확히 한 `Exec`, 고정 WSH/CMD 및 승인 `LAUNCHER` 경로·원본 SHA-256 정합성 검사. Task의 명시적 WorkingDirectory에서만 상대 경로 VBS/CMD를 정적 결합; C: 호환 junction은 E: data 실경로 확인 때만 허용. 모호한 경로·다중 Exec·다른 경로의 동일 basename은 STOP. 다른 기능 파일에 전역 Gate 없음. 결과는 `FIRST_HOP_TASK_LAUNCHER_MATCH`이지 전체 VBS/Sidecar 동적 실행 증거가 아님.
- R17 선례인 로컬 합성 Git 오버레이 유지: Task pause 전 `provenance.json`을 create-only → fsync → 정확한 바이트 재조회로 고정. `requestId`/manifest·base HEAD/tree/candidate SHA/prepared local SHA/tree/로컬 ref/변경 파일별 이전·목표 SHA 기록. 결과 JSON/TXT에 `LOCAL_OVERLAY`, `localOnly=true`, `provenanceSha256`만 승인 범위로 산출; GitHub 원격 commit 존재를 주장하거나 원격 push Gate를 만들지 않음.
- 전체 관련 격리 회귀 `node --test r2-writer-b/{contract,installer,receiver,windows-guards}.test.mjs` **42/42 PASS, exit 0 (총괄 독립 재실행)**. 앞서 공유 lock 오류 코드 매핑 및 무관 rename/copy 보존 수정도 포함. 실제 PC 설치·Windows Task 실행·다단 Sidecar Runtime 테스트 대체 아님.
- **상태/진행률:** M1/M2/M3 여전히 RUNNING, M4 미착수, **R2 20%**. GitHub main 지침 PR #624 완료/PR #625 A source 병합만 기존 성과. PC 운영 A/B 활성·manifest 승인·B 결과 requestId·백업/복구 실증 미확정. 대상 Writer/Controller/Calendar·SQLite/D1·예약 신규 변경 0.
- **다음 필수 행동/소유자:** 기존 #68 Controller 단일 설치 담당의 실제 설치 SHA·core-runtime-source-readonly A 활성 증거 확보 → 승인된 고유 A read-only 1회로 Writer checkout/Task/VBS/Sidecar/파일 해시 확보(총괄 진단) → 기능 원담당 승인 manifest 확정 및 정규 Writer B Windows 한정 실증·실제 requestId/원격 2/2/보호 재조회 → 원담당 운영 적용. #68 기존 B 재제출 금지, 예약 자연 검증을 선행 조건으로 추가 금지.

## 2026-11-07 — M2 공통 Writer B source main 병합 (운영 설치 아님)

- [PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) 독립 Source-only 감사: 15파일 전부 신규, 기존 Controller/R17/Calendar/기능 파일 변경·충돌 0, 42/42 격리 PASS, 공유 R17 lock/xml/probe 및 최신 main A `taskAction` 정확 호환. 조건부 source GO와 Windows 운영 NO-GO 구분.
- PR 리뷰 준비 전환 후 **2026-11-07 KST main 병합 완료**, merge SHA **`5fb5a7c4b434e55a319d1b00f0193900a04b8ca3`**. 병합 전 main `6348be5201801e008be10867fd68add4ddeca52c`와 compare에서 변경 **신규 15파일만** 원격 확인. main의 `writer-b/provenance.mjs` blob `d9c596be2042558e9f243c36450b0e5a5ef9ccf5`, `.github/workflows/pc-writer-b-source-once.yml` blob `3cf525b4f8cb6335ff36245c9afe088d8a0adda8` 재조회.
- **구분할 실제 운영 효과:** merge로 기본 브랜치에 `issues: opened` 기반 Writer B 1회 수신 Workflow source가 활성화됨. 단, owner/private Issue/정확한 title·label·UUID·control SHA·승인 manifest 원본 SHA·파일 해시 등 복합 계약이 있고 **현재 승인 `approvals/writer-updates/*` manifest 0개**라 승인된 설치 요청을 생성하지 않았다. 활성화된 이벤트 수신 ≠ Windows Runner 실설치 검증·운영 Writer 적용 성공.
- **새 PC B Issue / requestId / PC Writer 교체 / Task·예약 / SQLite·D1 / 기능 산식 변경 0**. 미검증 상태를 PASS로 보고하지 않음. M2 RUNNING, R2 **20% 유지**.
- **다음:** 기존 #68 단일 Controller 설치 담당의 실설치 SHA·신규 A 활성 증거 확보 → 고유 A read-only PC 조회로 Writer 현재 HEAD/config.source/Task XML/first-hop·Sidecar/세 파일 SHA·dirty 확인 → 원담당 범위형 승인 manifest + Windows 관련 집중 검증 후 단회 B 경로 사용. source merge를 재설치·새 전역 Gate로 확대 금지.

## 2026-11-07 — M1 증분 운영 확인 / M2 기존 Windows 무쓰기 검증 계약 판별

- **2026-11-07 09:26 KST** #68 공용 원장 댓글 225→225 신규 0, 이후 신규 Controller `pc-maintenance` B request/실제 목표 `f6338ee4...` `SUCCEEDED`/신규 `core-runtime-source-readonly` 또는 `pc-source-preflight` A 결과 0. 마지막 **확인된 과거** PC Controller #608 SHA `db8924162d42adf6ee6aa27a04ce1719c8fe96c2`; 현재 실PC 새 실측은 아님. 구형 #531 A의 `sourceResolved=false` 재요청으로 Inflation19 3파일 지문을 확보할 수 없음.
- 최신 main `config/operations.json` 및 기존 고정 워크플로 범위 감사: `runner-smoke`, `core-status`, 구 `pc-source-preflight`, 소스 등록만 된 `core-runtime-source-readonly` 중 **범용 Writer B `windows-adapter.mjs`의 실제 Task/checkout/manifest/rollback에 대해 독립 Windows 무쓰기 dry-run을 제공하는 승인 operation 없음**. R17/inflation 고정 전용 워크플로도 범용 B 동적 검증의 대체 아님.
- **결정:** 기능별 새 CMD·A operation·시험용 B Issue/예약을 만들어 확인하는 경로는 비용·권한 및 오검증 위험이 커서 추가하지 않음. 기존 #68 단일 설치 담당의 유효 Controller B 결과/신규 A 활성→실 Writer 지문→원담당 정규 B manifest/최초 정상 업무 1회 실증을 재사용. 다른 독립 업무는 NON_BLOCKING.
- **LAST PASS:** PR #626 source main 병합/42 fixture, PC 과거 #608 설치 결과 보존, A 정적 지원 계약 분기 확정. **FIRST FAIL/현재 필수 의존:** #68 원담당의 신규 Controller 실제 B install result/requestId 및 R2 A 활성 증거 없음. R2 **20% 유지**. PC/Writer/DB/D1/예약 신규 쓰기 0건.

## 2026-11-07 — M2/M3 Writer B 독립 감사 MUST-FIX 2건 수정·main 반영

- #68 실제 Controller 후속 B/A 증거 없음(마지막 확인 #608); 소스 대기 동안 PR #626의 핵심 안전 경로만 독립 검토했고 두 구체적 결함을 확인. 기존 코드에서 정상 경로가 이미 성공했다고 주장하지 않음.
- **보고기 허위 PASS:** `writer-b/report.mjs`는 임시 설치 결과의 `manifestSha256`가 64-hex인지 검사했지만, 결과가 실제 owner Issue의 `approvalManifestSha256`과 같은지 비교하지 않았음. 비정상/오염된 결과가 다른 유효 해시를 담아도 원격 2/2 성공 댓글로 올라갈 수 있는 증거 결함. 수정 후 정확 해시 일치 때만 `WRITER_B_INSTALLED_VERIFIED`; 불일치는 `WRITER_B_STATE_UNKNOWN`으로 기록, 원격 2/2라도 성공으로 올리지 않음.
- **Core Task 종료 판정:** 기존 `coreQuietFromProbe`가 Task state `4=RUNNING`만 배제해 `0=UNKNOWN`, `2=QUEUED`도 종료로 오판할 수 있는 결함. Windows 공식 `TASK_STATE` 정의([Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/ne-taskschd-task_state))를 확인, `state=1(DISABLED)`·`3(READY)`만 기존 enabled=false/instances=0/process=0/lock=absent 조건에서 인정. queued/unknown은 STOP, 새로운 일반 작업 Gate 아님.
- [PR #627](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/627) **main 병합** SHA `8df0a81e7e21c72ffbb51e9af528993ecd8ca2eb`. 정확히 4파일만 변경 (`writer-b/report.mjs`, `writer-b/receiver.test.mjs`, `writer-b/windows-guards.mjs`, `writer-b/windows-guards.test.mjs`), 기존 Controller/Calendar/R17/물가지표 파일·Workflow 변경 0. `main` 원격 4파일 compare/핵심 코드 재조회 확인.
- 독립 `node --test r2-writer-b/{contract,installer,receiver,windows-guards}.test.mjs` **43/43 PASS, exit 0**. 실제 Windows `enabled=false, state=2` 재현 여부·Task pause/복구·Sidecar 전 체인 실증은 이 테스트로 확정되지 않음.
- **LAST PASS:** source main 안전 결함 수정/43 fixture. **FIRST FAIL/운영 의존:** #68 기존 단일 담당의 실제 Controller 설치·신규 A 활성, PC Writer Task/파일 지문, 원담당 B 승인 manifest 및 첫 실PC 정규 1회 설치/복구 결과 부재. **R2 20% 유지**, 신규 A/B 요청·PC/원자료·SQLite/D1·예약 쓰기 0.

## 2026-11-07 — 사용자 승인 R17 설치 인수 및 실PC 정규 B 1회 요청

- 명시적 사용자 변경: R17 단일 B 설치 책임 → 현재 R2 총괄. [#68 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6699762305). 다른 일반챗 수신 ACK는 별도.
- 실PC A [#628](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/628#issuecomment-6699772094) PASS/CORE_READONLY_DIAGNOSIS, Controller db8924162d42adf6ee6aa27a04ce1719c8fe96c2, 보호 전후 해시 동일, 원자료/API/D1 운영 쓰기 0, 결과 JSON/TXT 원격 2/2 재조회.
- db892→6348 누적 Controller/config 6파일(기존 R17 5파일 동일 바이트 + 신규 pc-source-readonly 1파일), workflow 설치 변경 없음. 독립 감사 GO: 파일 SHA 6/6, 기존 fingerprint 521548 재현, 신규 fingerprint 9aac7af1a1f00d31dd2ba63f54236ea878ec7055ec7caa99b979f12a8b1763e9, heavy scope/purpose/controllerOnlyInstall 계약 유효.
- 새 불변 manifest [PR #629](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/629) main merge 2ca6204f5653d1da66ced2ecf64bff4a141a7272, 승인 RAW SHA256 75aebe1445b2c40e49ea852ec7ef86fac2b152c7202b82f0abfa9b93f1fb24e1, 원격 바이트 일치. 기존 #615 수정 없음.
- **정규 B 신규 단회 요청 [#630](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/630)** requestId pc-update-2b963307-a5dd-4225-9366-29d0687e6a24, pc-maintenance/controller-update, target 6348be5201801e008be10867fd68add4ddeca52c. 결과/원장/설치 SHA/보호 상태는 아직 미확정; 동일 ID만 추적하고 재요청 금지.
- LAST PASS #628 실제 사전 A 및 #629 승인 main; FIRST PENDING #630 독립 유지보수 결과와 새 A operation 실증. **R2 20% 유지**. Core/Writer/Calendar·SQLite/D1·예약 변화 확인 안 됨.

## 2026-11-07 — Controller 실설치 PASS, 후속 A 진단 한계 확인 및 R2 최소 수정 PR

- 실제 단회 B [#630](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/630#issuecomment-6699853428) **SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED**, requestId `pc-update-2b963307-a5dd-4225-9366-29d0687e6a24`. `actualControllerSha=targetControllerSha=6348be5201801e008be10867fd68add4ddeca52c`, `protectedStateUnchanged=true`, `workflowEnabled=true`, `recoverySha=null`, 업로드 2/2 확인. 이전 단락의 '#630 RUNNING/미확정'은 이 새 증거로 해소됐으며 중복 B 요청 없음.
- 설치된 A [#632](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/632#issuecomment-6699866073) `core-runtime-source-readonly`: 실제 동일 Controller SHA에서 실행됐으나 당시 Core 프로세스 부재로 `STATE_UNKNOWN/CORE_NO_ACTIVE_TASK_ENGINE`. 설치 실패나 source 불일치 아님. 재시도·새 예약을 만들지 않는다.
- A [#633](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/633#issuecomment-6699867141) `pc-source-preflight`: 다중 VBS/Sidecar 11파일 정적 추적, `PASS`, protected unchanged/operationalWrites 0. `sourceResolved=false`, `runtimeSourceVerified=false`. 하지만 고정된 과거 Writer checkout `projects/zgmini-earnings-history-pc-release`의 Git HEAD, 승인된 config.source, 마지막 Writer checkpoint source가 모두 `f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5`, `trackedDirty=false`로 교차 일치. 실제 활성 Task-to-checkout 증명은 별도.
- 다른 허용 A [#634](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/634#issuecomment-6699881317) `pc-source-origin-readonly`: `PASS`, `inventoryTruncated=true`, `candidateCount=0` (탐색 상한), 따라서 물가지표 3파일의 해시 미확보. 오류를 숨겨 PASS 승격하지 않으며 #634 재요청도 하지 않는다.
- **개선 코드 [PR #635](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/635) SOURCE_PREPARED/TESTED, PC 미설치:** #633에서 이미 Git/HEAD/config/checkpoint가 일치한 고정 역사적 checkout에 한해 기존 bounded `inspectWriterSourceInventory`를 재사용하여 Writer JS 파일별 존재/sha256을 조회; Git dirty 여부가 unknown/dirty면 개별 상태 null, 절대 `runtimeSourceVerified`를 true로 올리지 않음. 추가 단위/보안 fixture 포함 관련 20/20 PASS. 변경 2파일, 원자료/Writer/DB/캘린더 변경 없음.
- **LAST PASS:** #630 B 실제 설치와 #633 A 검증·후보 일치, #635 로컬 fixture. **FIRST FAIL:** #633의 원본 runtime 경로 미확정 및 3파일 각각 hash/dirty 실PC 부재. #635 리뷰→source 적용/단일 승인 Controller B의 정확한 전후 해시→새 A 단회 재실증을 다음 최소 행동으로 한다. 현재 R2 **20% 유지**. 운영 원자료·SQLite·D1 쓰기 0건.

## 2026-11-07 — 공통 A 후보 파일조회 취약점 수정, 승인 B #637 접수

- 독립 검토에서 PR #635 초기 상태의 역사적 후보 Git `--untracked-files=no` 결과가 신규 untracked .mjs까지 `trackedDirty=false`로 오인할 위험을 발견. 해당 파일별 상태를 **항상 null(UNKNOWN)**로 변경, 해시/파일 존재만 제공; 불일치 config·HEAD·checkpoint에는 inventory 자체 미생성. 신규 회귀 fixture 포함 21/21 PASS, 독립 재감사 GO.
- [PR #635](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/635) main 병합 SHA `29d667763650b5d719926034ce3583d563a35d23`. 이것은 **source-only**, 운영 A 활성 아님.
- 실제 설치본 #630 `6348be5201801e008be10867fd68add4ddeca52c`→#635 목표 29d667 간 Git diff를 검증: controller/config의 실변경은 `controller/pc-source-readonly.mjs` 1파일. 다른 Writer/workflow/result 파일을 Controller-only 배포에서 제외. 신규 target file SHA256 `4cd66eecd8305b15f7d02b88de22205e8e83634d0da33e5a68b1b5a4e1682414`.
- 새 불변 승인 [PR #636](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/636) main 병합 SHA `c3220077bb10da1ed60cdfcb4e3ed795266d5a64`. 1파일 fingerprint `cb125dacfb4ad584e62919034a7881f82d4040764f80da0cc30c0afb9defb1f7`, RAW SHA256 `cc88eeb4931acbd977c0d9d19fb13a34bcefcc18be22af953b961e6e44f0ab81`. purpose heavy/scope, rollback 6348, post core-status, exact remote bytes 및 독립 GO 검증.
- [정규 B 요청 #637](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/637) requestId `pc-update-32af4634-fa46-4235-9fef-1a5074a8dc4f` **PENDING**. 7필드 exact envelope·pc-maintenance label, 고유 요청 1회. 완료 주장 금지, 동일 requestId 결과만 대기.
- Writer B 사전 계약 별도 분석: 후보 inventory에서 해시/존재를 얻어도 per-file dirty는 UNKNOWN이며, 실제 설치기 `verifyWriterBPreimage`가 before·Task first hop·기능 대상 보호·config/HEAD를 설치 직전에 다시 검증. 원담당 PR #981 3파일 after/source 계보와 실제 운영 B approval은 별도. 신규 예약/CMD·캘린더/Writer/DB/D1 변경 없음. **R2 총 20% 유지**.

## 2026-11-07 — B #637 실제 설치 SUCCEEDED 및 새 A #639 물가지표 3파일 후보 인벤토리 PASS

- 정규 독립 B [#637](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/637#issuecomment-6700052457) requestId `pc-update-32af4634-fa46-4235-9fef-1a5074a8dc4f`: **SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED**, 목표=실제 `29d667763650b5d719926034ce3583d563a35d23`, `protectedStateUnchanged=true`, `workflowEnabled=true`, `recoverySha=null`. 원격 `results/maintenance-pc-update-32af4634-fa46-4235-9fef-1a5074a8dc4f.json/.txt` 2/2 재조회. 중복 Controller B 요청 0.
- 새 A [#639](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/639) requestId `pc-8705a50f-1ec7-4880-9361-5c1e142d2b80`, 실제 Controller `29d667763650b5d719926034ce3583d563a35d23`: **PASS/PC_SOURCE_READONLY_DIAGNOSIS**, 원격 `results/42322099022-1-seat-2.json/.txt` 2/2, 원자료·provider·D1·SQLite 쓰기/조회 0, 보호 불변.
- 고정 역사적 후보 `projects/zgmini-earnings-history-pc-release`의 HEAD=기존 승인 config.source=Writer checkpoint `f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5`, Git verified, candidate global trackedDirty=false, Writer checkpoint `2026-11-07T01:00:06.004Z` VERIFIED. **sourceResolved=false/runtimeSourceVerified=false** 유지(실제 Core-to-checkout 동적 연결은 미확정).
- 후보 bounded Writer inventory **137파일 완전 PASS**, files[*].trackedDirty=null(개별 UNKNOWN): `run-local.mjs` **exists**, SHA256 `922503baa358203521698f157db59c23af29c0072c6d8af9d52a18541d61cc0a`; `inflation-causal-public-auto-publication-r1.mjs` **absent**; 동일 `.test.mjs` **absent**. 따라서 잠정 범위 `M run-local + A 2파일` (실제 활성 Writer 적용 계약이 이 후보를 인정해야 함).
- 담당자 PR [zgmini #981](https://github.com/ansqhd5774-Choi/zgmini/pull/981) 소스 후보 after SHA: run-local `e7986e8cf120f490d83a10218cb6656fb78e6ce493c2f6b2d6d899adb77b927c`; 신규 hook `2e9bf2b817635a816cb2327efc379bb5b2bb9c55a76c50155c14b76ee9f4d725`; 테스트 `6201d1448bbe581059d31b14fbffb2d552b71a1c30e6c1906ce7b479dded37e0`. 구 브랜치 통째 병합 금지; 원담당이 최신 main/승인 영향 검산.
- **LAST PASS:** 실제 Controller B 2회(#630,#637) 정상 설치, 새 A #639 candidate file inventory 완전/무쓰기. **FIRST FAIL/잔여:** 동적 Core Runtime 실제 source binding, 대상 개별 dirty, Task XML·launcher와 Writer B 실PC 수신·source overlay 1회 정상 실증 미확정. M1 엄격 종료 기준 미충족, **R2 단계 완료율 20% 유지**. 수집/게시/사이트/캘린더·운영 Writer 파일 변경 0.

## 2026-11-07 — Writer B 수신 Workflow 활성 검증 한계와 첫 적용 인계

- **LAST PASS:** 실제 Controller 설치 #637 SUCCEEDED(실제 `29d667763650b5d719926034ce3583d563a35d23`, 보호 불변) 및 설치된 공통 A #639 PASS(Writer 후보 inventory 137/137, 운영 쓰기 0), R2 Writer B source main PR #626/#627과 43/43 격리 검증. 기존 실제 결과를 반복 실행하지 않았다.
- **FIRST FAIL/UNVERIFIED:** 범용 `.github/workflows/pc-writer-b-source-once.yml`은 최신 main 파일로 조회되지만, **GitHub Actions에서 enabled 상태인지 및 self-hosted Windows Runner가 실제 첫 B Issue를 접수·수행할 수 있는지는 미검증**. GitHub connector의 workflow-state endpoint는 `INVALID_ARGUMENT`로 지원되지 않고, 연결 브라우저는 이용 불가였으며, 비로그인 클라우드 브라우저에서는 비공개 repository workflow URL이 sign-in/404로 표시됐다. 이는 `WORKFLOW_DISABLED`나 PC 설치 실패의 증거가 아니며, `STATE_UNKNOWN / AUTHENTICATED_ACTIONS_READ_UNAVAILABLE`로 구분한다.
- **현재 사실:** 승인 `approvals/writer-updates/*` manifest 0건, 진짜 `pc-writer-source-install` 첫 단회 Issue/requestId/원격 결과 JSON·TXT 0건. PR #981에 인계 댓글은 작성됐으나 다른 원담당 대화의 실제 `OWNER_RECEIVED` ACK도 미확인. 이를 테스트용 B Issue나 Controller-only 설치, 신규 예약/CMD로 우회하지 않는다.
- **담당 / 최소 다음 행동:** 물가지표 원담당이 인증된 Actions UI 또는 승인된 관리 조회에서 위 workflow의 등록·enabled/Runner 접수 가능 여부 확인 → 현재 PC Task/XML·첫 VBS/Sidecar와 sourceRoot/HEAD/config 및 대상 3파일 after SHA 재대조 → 불변 범위형 Writer B 승인 manifest → 정규 B 첫 1회 Issue → 고유 requestId 결과·보호·부분 복구 여부 재조회. R2 총괄은 이 첫 실제 경로의 공통 수신 오류가 발생할 때만 공통 도구를 수정하고 원장/지침에 회귀 증거를 반영한다. 기능 게시/19개 갱신은 원담당 소유.
- **영향 범위:** 새 운영 Writer/Calendar/Core/Controller 변경 0, SQLite/D1/원자료·Task/예약 변경 0, 설치 Issue 중복 0. **M0 DONE=20%, M1–M4 미완료, R2 공식 20% 유지.**

## 2026-11-07 — 실제 첫 Writer B 전 공통 실패 증거 복구 및 README 정합성

- **독립 원담당 확인:** zgmini [PR #981](https://github.com/ansqhd5774-Choi/zgmini/pull/981)은 OPEN/미병합, 인계 댓글만 1건이며 owner ACK 없음. Writer B 수신 제목 `pc-writer-source-install` 또는 `pc-writer-b-install` label Issue 0, 제어 main approvals/ 하위에 `writer-updates` 디렉터리 없음. 실제 승인 manifest/requestId/Windows 설치 결과 0. 기존 실PC #637/#639 성공 검증을 반복하지 않음.
- **정본 표현 결함 수정:** 범용 Writer B가 이미 PR #626/#627로 main source 병합되었는데 [writer-b/README.md](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/writer-b/README.md)는 여전히 Draft 구현으로 안내. 최소 1파일 2줄 교정 [PR #640](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/640) main merge SHA `ae025ea8fb736b6381d037ab25bf07f78abe4891`; 문서가 Source main/Workflow enabled 미확정/Windows 실증 미완료를 정확히 구분하게 됨. 원격 본문 재조회 PASS.
- **새 공통 결함:** 기존 `writer-b/preflight.mjs`는 승인 manifest 경로/해시 사전 검사 실패 시 정확한 `WRITER_B_*` 코드만 stderr로 출력, install step skipped. 항상 실행되는 `report.mjs`는 설치 결과 파일 부재를 빈 JSON으로 처리하여 원격에는 보편 `WRITER_B_RESULT_UNVERIFIED_STOP`만 기록. 최초 실패의 FIRST FAIL을 유실하는 증거 계약 결함(운영 설치 성공 자체의 차단 조건은 아님).
- **최소 구조 수정 [PR #641](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/641):** preflight 거부 시 허용된 오류 코드만 `RUNNER_TEMP`의 `GITHUB_RUN_ID`별 `wx` create-only JSON에 기록; install 결과 없을 때만 reporter가 runId/status/code/512B 경계 검증 후 이를 원격 결과로 전달. 기존 정상 install 결과 우선·키/manifest/raw error 노출 없음·타 run ID·허위 INSTALLED 신호 거부. 변경 **writer-b/preflight.mjs, report.mjs, receiver.test.mjs 3파일**. 독립 source-only 리뷰 조건부 GO, 관련 격리 테스트 **45/45 PASS(exit 0)**, 원격 세 파일 바이트 일치, main 병합 SHA `1fee7fcb4d22a5bc1f8549b6b821172a27cfb75b`.
- **검증 경계:** 형식이 유효한 원담당 Issue에서 승인 파일/path/hash가 실패하면 정확한 code 전달 가능. Issue JSON/UUID/envelope 자체 무효는 reporter가 원격 결과 없이 거부하는 기존 fail-closed 유지. 최초 PC Windows B, Workflow enabled/Runner 접수, 실제 Core 실행 checkout/dirty 및 원담당 실제 수신은 여전히 미검증. 해당 요청의 임시 결과 디렉터리 격리가 전제며 실제 Windows 실행으로 추가 실증해야 한다.
- **LAST PASS:** 기존 실제 Controller #637 SUCCEEDED / A #639 PASS; 신규 공통 문서 #640·증거 전달 수정 #641 main 소스 반영 / 45 fixture PASS. **FIRST FAIL:** 정상 승인된 기능 Writer B manifest·첫 owner Issue/result 없고 Actions enabled 상태 인증 조회 불가. **영향:** 운영 PC/Writer/Core/Calendar·Task·예약/원자료/DB/D1 변경 0, 신규 설치 요청 0. **책임·다음 행동:** 물가지표 원담당이 실제 Actions/Runner 확인→manifest 승인→정규 1회 Writer B→requestId JSON/TXT·보호·Runtime·기능 실증; 총괄은 이 실증에서 공통 수신·복구 오류 발생 시 해당 범위만 수정. **R2 20%(M0 DONE, M1–M4 미완료) 유지.**

## 2026-11-07 10:33 KST — 범용 Writer B 워크플로의 GitHub 이벤트 수신 실증

- [GitHub Actions run #42322098882](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42322098882)를 Actions runs API와 job API로 확인: `.github/workflows/pc-writer-b-source-once.yml`, workflow ID `409924452`, `event=issues`, `2026-11-07T01:05:26Z`, job `writer-source-approved-b`의 `completed/skipped`. 대상은 A급 파일 조회 [Issue #639](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/639)로, Writer B 승인 제목/레이블과 불일치하므로 작업이 skip된 것이 정상이다.
- **확인 범위 개선:** 파일 존재만이 아니라 GitHub Actions의 이슈 이벤트에 공통 Writer B workflow가 실제 반응하여 run을 생성한 사실을 확인했다. 이전 `Actions enabled 전부 미확인`은 이 관측 시점의 **워크플로 이벤트 수신 확인**으로 좁힌다. 다만 허용된 Writer B Issue에 대해 Windows self-hosted Runner가 Writer B job을 수락·실행·복구하는지 여부는 **STATE_UNKNOWN**이며 skip된 run을 첫 설치 PASS로 취급하지 않는다. 인증 없는 UI 404는 비공개 저장소 접근 제한으로 유지한다.
- 승인 `approvals/writer-updates/*` manifest, 정규 `pc-writer-source-install` 요청, 실제 설치 result JSON/TXT는 여전히 미확인. 기능 PR #981은 OPEN. 운영/Controller/Writer/Task/DB/D1 쓰기 0, B 재요청 0.
- **다음 실제 실행:** 물가지표 담당이 최신 PR 3파일과 실제 Core Task/sourceRoot/HEAD/config·해시/dirty/first-hop 의존성을 확정해 불변 B manifest 승인 → 원담당 단회 B Issue로 Windows Runner 실제 수신·설치 및 보호·복구 결과를 검증. R2 총괄은 첫 공통 경로 결함만 처리하며 기능 자동 게시 실증은 별도. **공식 R2 20% 유지.**

- **동일 Runner 라벨 교차검증:** 같은 이슈 #639의 [공용 A 성공 run #42322099022](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42322099022)는 `completed/success`, job `approved-pc-job`이며 실행 당시 `.github/workflows/pc-job.yml`의 `runs-on: [self-hosted, Windows, X64, zgmini-pc-control]`가 공통 Writer B workflow와 정확히 일치한다. 즉 2026-11-07 10:05 KST에는 해당 라벨의 자체 Windows Runner가 **A job 1건을 수행**한 증거가 있다. B job은 아직 경로 조건을 통과하지 않았으므로 B 전용 수신기·source 설치·backup/rollback 검증은 미완료다.

## 2026-11-07 — 최초 범용 Writer B 실설치 직전 원본 드리프트 발견

- 사용자가 이번 19개 지표 Writer B 첫 실제 설치·시행착오·재발 방지까지 **R2 프로세스 총괄이 단일 적용 책임을 수행하도록 직접 지시**했다. 기존 물가지표 담당자는 새 병행 B 요청을 만들지 않는다. 범위는 PR #981의 승인된 3개 파일과 공통 A/B 설치 경로; 데이터 산식·수집기·게시 정책·일반 기능 구현 무단 변경 없음.
- **LAST PASS:** 공통 B `issues.opened` 이벤트 수신 [run #42322098882](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42322098882), 동일 라벨 Windows Runner A 성공 [run #42322099022](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42322099022), Controller #637/A #639 기존 실증.
- **FIRST FAIL/설치 전 출처 충돌:** PC [#639](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/639) 고정 후보 `run-local.mjs` SHA256=`922503baa358203521698f157db59c23af29c0072c6d8af9d52a18541d61cc0a`; PR #981 기준 `run-local.mjs` SHA256=`1c336662a36248d9fb3cf1207dc900514a4cad4e00aaf1d04d5e3be09898c6ae`; PR #981 전체 교체 목표=`e7986e8cf120f490d83a10218cb6656fb78e6ce493c2f6b2d6d899adb77b927c`. 파일 전체 오버레이는 PR의 **9줄 추가 범위 밖 기존 코드가 교체될 위험**이 있으므로 정규 manifest를 승인하지 않음.
- 실PC 승인 Git HEAD `f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5`는 GitHub `zgmini` commit/contents 조회에서 `404 No commit found`. `run-local.mjs`의 해당 SHA256은 원격 기본 브랜치 파일 변경 36개 버전에서도 일치하지 않았고, 확인한 관련 브랜치 8개 파일도 불일치. **PC 원본의 정확한 내용·미반영 변경은 아직 미확인**이며 임의로 과거 HEAD로 덮어쓰지 않는다.
- **공통 구조 문제:** 최초 Writer B는 승인 `beforeSha256`을 검증하지만 수정 파일 M의 내용은 후보 GitHub commit의 **전체 파일 바이트**를 대체한다. PC 운영 HEAD가 원격 후보와 정확히 계보 일치하지 않을 때, 승인된 변경 hunk만 보존하는 공통 경로가 부족하다. 기능별 CMD·신규 일정·Controller-only 우회로 해결하지 않는다.
- **최소 수정 방향 (R2 M1/M2 내, 새 완료 Gate 아님):** 기존 A급 읽기 전용 범위를 이용해 PC 원본과 승인된 변경 hunk의 적용 가능성·최종 해시만 확인(운영 파일/전체 원본 외부 업로드 금지) → 공통 Writer B가 `before SHA + 승인된 정확한 삽입 패치 + after SHA`로 검증된 **선별 변경**만 임시 Git 객체에 적용하도록 보완·격리 회귀 → 동일 원본·첫 launcher·Task·lease/backup/rollback 보호를 유지한 실제 B 단회 → 결과 2/2, 보호 및 기능 후속 확인. 기존 전체 파일 오버레이 경로는 변경하지 않고 선택적 패치 모드만 추가할지 계약·테스트로 검토한다.
- 신규 Writer B Issue/운영 설치·DB·D1·Task 변경 **0**. **R2 공식 20% 유지**, 안전한 설치 방식이 확정되기 전 추정 manifest 발행 금지.

## 2026-11-07 — PR #981 실제 후보 해시 재검산 및 삽입 전용 변환 격리 실험

- PR head `6ffe6bb7f3ff8faa452dc86fdcc2a44d0926b1a7`의 정확한 UTF-8 원문을 3파일 각각 GitHub fetch 후 SHA256 재계산. `run-local.mjs` **실제 목표**=`e7986e8cf120f490d83a10218cb6656fb78e6ce493c2f6b2b6d899adb77b927c`; 이전 PR/인계 `…b2d6…`는 한 글자 오기여서 [PR #981](https://github.com/ansqhd5774-Choi/zgmini/pull/981) 설명과 담당 인계서 교정. 신규 hook=`2e9bf2b817635a816cb2327efc379bb5b2bb9c55a76c50155c14b76ee9f4d725`, test=`6201d1448bbe581059d31b14fbffb2d552b71a1c30e6c1906ce7b479dded37e0`는 기존 기록과 일치.
- PR base `run-local.mjs` SHA256=`1c336662a36248d9fb3cf1207dc900514a4cad4e00aaf1d04d5e3be09898c6ae`, 실제 PC 후보 SHA256=`922503baa358203521698f157db59c23af29c0072c6d8af9d52a18541d61cc0a`. 두 원본이 다르다는 독립 재검산 유지. 최신 GitHub 원격 기록에서 PC 파일 원문을 아직 확보하지 않았으므로 **전체 파일 오버레이는 여전히 중단**.
- 공통 삽입-only 순수 변환의 로컬 격리 프로토타입 `writer-b/insert-only-patch.mjs`/테스트 작성, 4/4 PASS: 유일 anchor·정확한 UTF-8 추가만 허용, CRLF 유지, 원본 Byte 불변, 모호한 위치 거부. PR base에 두 정확한 삽입을 적용한 결과 해시도 실제 PR head `…b2b6…`와 일치. **아직 GitHub 공통 소스/Writer B에 통합하지 않았으며 실PC 적용 증거 아님**. 다음은 현재 PC 원본에 이 두 anchor가 정확히 존재하는지 읽기 전용 미리보기로 확인하고, 필요한 범위에서 범용 B 계약을 보완하는 것.
- 구조 교훈: after SHA는 수기 복사하지 않고 **실제 GitHub 후보 바이트에서 기계적으로 산출**하고 manifest와 교차 검산해야 한다. 운영 코드 변경·Task/DB/D1·B 요청 0. 공식 R2 **20% 유지**.

## 2026-11-07 — 공통 B 삽입형 실장과 A 읽기 전용 첫 실행 요청

- **공통 구조 수정 source 완료:** [PR #642](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/642) squash merge `2aada572c8d7356faeb60fc6f3655438479067ad` → control main. 이전 4-key B full-file 모드 보존; 신규 M insert 모드는 `beforeSha256`, PR 후보 `candidateSha256`, 독립 `afterSha256`, 위치·텍스트를 전부 승인 해시에 묶는다. Windows B 준비 단계는 실제 PC before bytes를 보존하면서 삽입하고 after SHA를 재계산한다. Task pause **이전** 로컬 합성 commit/hash 보호 및 기존 lock/backup/rollback 유지.
- **검증:** 순수 overlay/PC 프리뷰/요청 인증/B 기존 receiver 회귀 등 로컬 Node **30/30 PASS**. A 프리뷰 독립 정적 검토에서 무단 PC 쓰기·명백한 승인 우회 미발견. 이것은 source 검증이지 PC B 설치 성공이 아님.
- **A 승인 명세:** control main `approvals/writer-previews/infl19-r2.json` 원문 SHA-256 `1d025c2ccf032ae6638946a4d572b846f1cbf50ed5ceb3301673240838751dae`, main commit `23705e9bbaf6c850fb41121f7d1912e9d3ac0087`. PC 기존 run-local before `922503ba…`, PC base HEAD `f7ed1e44…`, PR #981에서 기계 검산된 삽입 2개만 고정.
- **Windows A 미리보기 단회 생성:** [Issue #643](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/643), requestId `e8a06f0b-2cd1-4e6f-af16-5d0d7c8d9355`; PC 원본 변경/Task 변경/DB/D1/provider calls 허용 안 함. 아직 원격 결과 JSON/TXT/실PC after SHA 미수신이므로 **STATE_UNKNOWN**. B manifest·B 실설치 Issue는 **아직 없음**.
- **다음 필수 실행:** #643 결과 확인 → 승인 PC 원본 삽입 가능성과 after SHA·Task XML SHA 확보 → 실제 launcher SHA/PC 소비자 증거와 대조 → 첫 B 정확한 manifest 및 단회 설치. 실패는 FIRST FAIL 코드로 분류, 승인 우회·무한 재요청 금지. 사용자 지시에 따라 R2 총괄이 첫 설치·개선·재발 방지 실증까지 맡고 기능 담당자 인계는 그 이후로 보류.
- **R2 공식 진행률:** 20% 유지. M1 실PC B 검증까지 아직 미완료.

## 2026-11-07 — 첫 실PC A 실패 분석과 선별 삽입 수정, 첫 B 정규 설치 요청

- **A 첫 실패 [#643](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/643):** `BLOCKED / WRITER_B_INSERT_PREIMAGE_NEWLINE_STOP`, 결과 2/2, PC/Task/DB/D1 쓰기 0. 앞단의 PC source HEAD/config/head·대상 해시 검사를 통과했으나 PC `run-local.mjs`에 마지막 줄바꿈이 없는 실제 상태가 공통 순수 삽입기의 불필요한 선행 거부 조건에 걸림. **이는 Writer B 설치 실패가 아니라 A 안전 프리뷰 내부 입력 호환성 실패**.
- **재발 방지 [PR #644](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/644):** 기존 줄바꿈 조건을 파일 전체 Gate에서 제거하고 EOF 마지막 불완전 줄의 `after` 삽입 위험만 거부, 원본 EOF 바이트 보존 테스트 추가. squash merge `da2439e5649a0a2120610820ddada0fab0a60781`; 격리 Node 회귀 **31/31 PASS**. 에러를 숨기지 않고 실제 범위를 좁힌 구조 수정.
- **A 재실증 [#645](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/645):** `PASS_READONLY / WRITER_B_INSERT_PREVIEW_VERIFIED` 및 GitHub 결과 JSON/TXT **2/2 직접 재조회**. 정확한 PC before `922503baa358203521698f157db59c23af29c0072c6d8af9d52a18541d61cc0a`, 실제 PC insert 후 after `50ee0c0863c10aa5106e18e8466517143ef3dbc75f95abc18bc359f2cbbced9e`, Task XML `dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028`, PC source HEAD `f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5`. 삽입 위치 2개 유일, source/Task/DB/D1 쓰기 0.
- PR #981 pinned commit `6ffe6bb7f3ff8faa452dc86fdcc2a44d0926b1a7`는 실제 source branch `codex/inflation19-auto-sidecar-prep-20261104`와 GitHub commit 비교 `identical` 확인. 3파일 B manifest `approvals/writer-updates/infl19-r2-pc-preserve.json` 원문 SHA256=`4f0c6893550e61ca903cb57f6cc4e44bf596671a8f7321f39f82b35c967ea4e9`를 control main 생성, 계약 검증 PASS. B 후속 설치에 기존 run-local **전체 교체 금지**, insertion-only M 및 새 hook/test A 2개만 지정.
- **B 최초 단회 실제 설치 요청 [#646](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/646):** requestId `8cdc99d1-95db-4ffe-940f-13634b737c8b` 생성. 정확한 원격 설치 결과/복구/원본 보호는 아직 **STATE_UNKNOWN**; 완료 단정하지 않음. 응답 시 LAST PASS/FIRST FAIL 판정 후 공통 결함만 고쳐서 동일 requestId 중복 실행 금지.
- **R2 공식 진행률:** 20%, 첫 B 설치 Runtime 결과 수신 전 M1 미완료.

## 2026-11-07 — #646 실제 Writer B Core 자연 종료 대기 실패 / #648·#649 원인 범위 확인 / #650 공통 수정 초안

- **FIRST FAIL — 실제 운영 B:** [#646](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/646#issuecomment-6700893887), requestId `8cdc99d1-95db-4ffe-940f-13634b737c8b`, run `42328236728` attempt1의 설치 단계에서 `WRITER_B_CORE_NATURAL_DRAIN_TIMEOUT_STOP`; 원격 JSON/TXT 2/2 재조회, `WRITER_B_INSTALL_STOP_RESTORED` 및 `ORIGINAL_VERIFIED` 근거. 이후 attempt2·3의 Actions skip을 설치 성공으로 오인하거나 동일 requestId를 재실행하지 않음. 최초 실행은 승인 manifest/preflight/candidate checkout PASS, Core 자연 종료 대기 90초에서 STOP.
- **후속 현장 근거:** [#648](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/648#issuecomment-6700944483) 승인 A read-only 진단은 Task enabled=true/state=4, active Task instances=0, Core 관련 process 2, `local-cycle.lock`=true, unknownProcessLines=0. 이는 #646 실패 **이후** 스냅샷으로 #646의 매 순간을 증명하지 않음. [#649](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/649#issuecomment-6701049434) 새 일반 A `core-status` 단회 requestId `pc-b7fa9f20-071d-45a8-8d30-afe44fef609d` PASS, 원격 JSON/TXT 2/2: cycle lock=true, 수집 `2026-11-07T02:30:08.074Z` COMPLETE, Writer `02:25:44.506Z` VERIFIED, 이전 cycle `02:26:00.773Z` COMPLETE, Task XML 승인 SHA `dd81987c...` 유지, 보호 해시 불변. 정상 수집·게시 진행 증거가 있으므로 정상 장시간 Core를 `STALE_LOCK` 고장으로 단정하거나 lock/프로세스/Task를 강제로 조작하지 않음.
- **공통 구조 불일치:** 기존 `writer-b/windows-adapter.mjs`는 `schtasks /Disable` 직후 최대 90초만 자연 종료를 기다리지만, 기존 `zgmini/scripts/pc-writer/local-cycle.mjs`는 하위 collect/publish/earnings 작업에 각각 최대 30분 `spawnSync` 경로를 포함. 90초를 넘어도 유효한 Core 작업이므로 **90초 STOP은 안전한 거부일 수 있으나 일반 업무의 설치 불가능 상태를 만들 위험**이 있음. 무조건 긴 일시중지/lock 삭제/Task 강제 종료 대신 사전 안전 구간 확보.
- **구조 수정 Draft [PR #650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/650)**: 독립 `codex/r2-writer-b-core-idle-handoff-20261107`, 정확히 Writer B 관련 5파일, 기존 Core/Controller/Task/Runner/기능 코드 수정 0. 공유 Writer lock + backup + isolated prepared commit 뒤, **Task 활성 상태에서** 최대 6분 read-only WMI/Task/lock 조회로 `READY(3)` + instances/processes/unknown 0 + cycle lock 없음 **연속 2회**를 확인한 뒤에만 pause. pause 직전 별도 재확인으로 race STOP. 안전 구간이 없으면 `WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED`와 원본 불변 검증·lock 해제로 종료. pause 이후 기존 90초 drain, config/source CAS, backup/rollback, report 결과 계약은 유지. 새 예약·Runner/Controller·provider/DB/D1·운영 Writer 쓰기 0.
- **검증 경계:** 신규 Core idle predicate 로컬 Node 6 assertion PASS, PR #650 원격 5파일 compare 및 보호/순서/timeout/race 포함 정적 계약 검사 9/9 PASS. **공통 Writer B 전체 Node 회귀 실행과 실 Windows 재실증은 아직 수행하지 않음**; PR #650은 Draft/unmerged. 별도 유료 CI/hosted runner 또는 미승인 Windows 명령 실행 없음. 현재 공식 R2 진행률 **20%** 유지; M1의 모든 동적 source binding, M2 Windows 설치 성공, M3 정상 회귀/복구 및 M4 최종 인계 미완료.
- **다음 필수 행동:** PR #650 전체 관련 격리 테스트/보안검토 → exact 5파일 source GO → main 병합 후 승인 manifest 원본/Task/Writer 보호 영향 검산 → **새 requestId로** 정상 Writer B 1회 실증(과거 #646 재실행 금지) → Core/Writer source, 결과 2/2, 게시 자동 갱신 정상 확인. 정상 Core의 긴 작업이 계속되면 안전 대기(`DEFERRED`)로 구분하고 운영을 강제로 끊지 않음.

## 2026-11-07 — PR #650 Core idle-window 대기 루프 격리 실험 보강 (운영 적용 아님)

- [Draft PR #650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/650) 최종 검토 대상은 범용 Writer B 관련 **7파일**(기존 5수정 + 순수 대기 모듈·테스트 2신규). 이전 원장에 적힌 5파일은 초기 Draft 범위. 정규 B/Controller/Core/기능 source 운영 적용 0.
- 신규 `writer-b/core-idle-window.mjs` 원격 Git blob **`ce0fc538af6188d0e6a222979e16db3b3cc4d334`**, 로컬 테스트에서 Git blob 동일함 확인. 테스트 원문 `writer-b/core-idle-window.test.mjs` 원격/blob 로컬 동일 **`489157b3b9a4e8f8326d7230056ed941341a5bbf`**.
- Node `--check` PASS, 순수 대기 모듈 6개 시뮬레이션 `node --test` **6/6 PASS**(Core active→ready, ready 중간 재시작, lock 지속, Task unknown, 시간 정지/범위, probe 오류). 기존 guard 순수 판정 6 검산 PASS + PR 원격 코드 정적 계약 9/9 PASS.
- 현재 미확인 범위: 코디네이터·Windows 어댑터·공유 수신기 통합 회귀 테스트 전체 실행과 실 Windows B 한 회 적용. 따라서 **Draft·main 미병합**, M2/M3 DONE 아님, R2 **20% 유지**. 이전 #646 B requestId의 재실행은 계속 금지.
- 다음: 같은 소스/환경의 기존 Writer B 회귀 테스트 PASS→고경계 경로와 승인 manifest 충돌 검사→source main 반영 여부 판정→신규 requestId 정규 실PC 1회/원본·Runtime 증거 회수.

## 2026-11-07 — #650 실제 테스트/새 대기 순서 보강 (운영 적용 0)

- **구조적 비효율 발견·수정:** 초기 #650 Draft는 Core가 바빨 때도 승인된 one-shot B requestId를 미리 claim하고 PC 백업/격리 임시 commit까지 생성하였음. 이를 고쳐 `acquireSharedWriterLock → readPcPreimage → readCandidate → waitForCoreIdleWindow → claimRequest → backupOriginal → prepareIsolatedCommit → pauseCore`로 정렬. **진행 중 Core**는 예약 활성/운영 원본 불변, 추가 B claim/백업/격리 commit없이 `WRITER_B_PREFLIGHT_STOP / WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED`로 보고. 적용 직전 Core 새 실행 경합은 그 다음 별도 guard에서 안전게 STOP.
- **결과:** GitHub [Draft PR #650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/650) 현재 head `e3ab5fce05a4db612f8d9f4ac3e90d84818c9390`, 공통 Writer B 7파일만 변경. GitHub 원문 `contract.mjs`, `installer.mjs`, `installer.test.mjs` V8 격리 실행 모의 Node Buffer/crypto로 설치·복구 16/16 PASS; 고유 소스로 해석한 순수 대기 모듈 6/6 PASS. 추가로 실제 **Node v22** `node --check` PASS, `node --test writer-b/core-idle-window.test.mjs` **6/6 PASS**. 해당 신규 소스 Git blob `ce0fc538af6188d0e6a222979e16db3b3cc4d334`, 테스트 blob `489157b3b9a4e8f8326d7230056ed941341a5bbf`가 GitHub 대상과 각각 일치(기존 `windows-guards.mjs` Core 판단 2함수만 동일한 격리 버전 사용).
- **미증명:** 변경된 공통 수신기 전체 정규 Node test, 실 Windows WMI/Task 기능 실증, 승인 manifest 기반 실PC B 성공, Core가 6분 동안 연속 활성인 환경에서 안전한 유휴 창을 확보할 수 있는지 등. 실PC 배포 PASS 아님, #646 같은 ID 재실행 금지. M0 DONE, M1–M4 미완료, R2 **20% 유지**.
- **다음 필수:** 전체 Writer B Node 회귀 획득(이미 검증한 순수 테스트는 재진행 불필요) → main 병합 여부 안전 판단 → 정규 실PC 단회 B 실증 → 소스/결과/원본/게시 증거 회수.

## 2026-11-07 — #650 source-only main merge / 37 Node 회귀 / #651 실제 Windows B 일회 요청

- **정규 Node 회귀:** GitHub PR #650 HEAD `e3ab5fce05a4db612f8d9f4ac3e90d84818c9390`에서 관련 소스/fixture 정확히 9파일을 로컬 Linux Node v22.16.0에 복원하고 모두 Git blob SHA를 원격과 대조함. `node --test` **37/37 PASS**, 0 fail (contract5, installer16, windows guard10, idle6). 유일한 테스트 보조물은 Controller `taskAction` XML 파서의 축약 로컬 재현으로 Windows 실제 COM/Task를 의미하지 않음. `node --check` PASS.
- **Source 병합 완료:** [PR #650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/650) Draft 해제 후 GitHub `merge` 완료, commit **`aded1623c2992ee467b08c2034bd11d125f36e7e`**. 사전 main SHA `23d685b1b457110bf40ea833c2d3bd9df0ff3b47`와 PR base가 일치하고 PR head exact, 변경은 `writer-b/core-idle-window.mjs`, `core-idle-window.test.mjs`, `installer.mjs`, `installer.test.mjs`, `windows-adapter.mjs`, `windows-guards.mjs`, `windows-guards.test.mjs` **7파일만**. 메인 소스 병합은 **PC 설치 성공이 아님**.
- **현행 불변 B 승인 재사용:** `approvals/writer-updates/infl19-r2-pc-preserve.json` 원문 Git blob `e89ac6bcc7973b48b4af46d1cd5348a62186b0e1`, approved raw SHA256 `4f0c6893550e61ca903cb57f6cc4e44bf596671a8f7321f39f82b35c967ea4e9`, PC base/config `f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5`, 3파일 M/A/A, Core Task XML/launcher 승인 SHA 불변, 신규 권한 요청/원본 덮어쓰기 없음. 기존 #646 정상 복구 결과 2/2 재사용, **#646 requestId 재시도하지 않음**.
- **새 정규 실PC B [#651](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/651)** 고유 requestId `46ca5a2a-c7c3-4b02-b88f-987e984ac2ba`, 동일 대화 chatId `5726bbbf-1af4-42e5-8a76-2ca1365dd754`, `pc-writer-source-install` owner/private/label 계약 1회 생성. Workflow run [#42332932474](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42332932474) main SHA `aded1623...`, Windows self-hosted job: control checkout/manifest preflight/candidate checkout PASS; **설치 transaction step RUNNING**(관측 시점 2026-11-07T03:12Z 이후). 아직 result JSON/TXT 및 PC runtime 검증 없음. **새 설치가 성공하거나 안전 유예될지는 원격 증거 대기**.
- **공식 상태:** R2 20%(M0 DONE, M1–M4 관련 완료 기준 미달). PC source/Task/DB/D1 실제 변경 여부는 #651 결과 회수 전 단정하지 않음. 다음: #651 unique requestId 원격 JSON/TXT 2/2 + PC source/head/config/Task/ledger 확인, PASS/DEFERRED/RECOVERY_REQUIRED 구분. 정상 Core가 6분 내내 활동해 유예되면 무한 재요청 없이 관측 근거로 협력적 유지보수 경로를 검토한다.

## 2026-11-07 — 실제 범용 Writer B 정상 적용 #651 + PC A #652 사후 대조

- **MAIN SOURCE:** [PR #650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/650) `aded1623c2992ee467b08c2034bd11d125f36e7e` merge, source-only. 변경 7 Writer B 파일, 본문과 시험 원문 Git blob 확인, Node v22 `node --test` **37/37 PASS**, `node --check` PASS. 관련 설치기/승인/Task guard/idle 회귀 포함.
- **실제 Windows 정규 B 성공:** [Issue #651](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/651#issuecomment-6701499354) requestId `46ca5a2a-c7c3-4b02-b88f-987e984ac2ba`, Actions run `42332932474` self-hosted Windows **completed/success**, 결과 `WRITER_B_INSTALLED_VERIFIED / WRITER_B_INSTALL_VERIFIED` 및 `RESULT_PAIR_READBACK_VERIFIED`. 승인 manifest RAW SHA256 `4f0c6893550e61ca903cb57f6cc4e44bf596671a8f7321f39f82b35c967ea4e9` 불변, 기준 source `f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5`; 새 로컬 source HEAD/config SHA `d50ba2630bb04c7c50911dac0a4069a8056ee469`. `LOCAL_OVERLAY/localOnly=true`; GitHub에 운영 source commit push 안 함.
- **설치 변경 대상 정확히 3파일:** `scripts/pc-writer/run-local.mjs` (삽입만, after SHA256 `50ee0c0863c10aa5106e18e8466517143ef3dbc75f95abc18bc359f2cbbced9e`), `inflation-causal-public-auto-publication-r1.mjs` (새 파일), 동일 `.test.mjs` (새 파일). ledger 결과 `results/writer-b-source-install-46ca5a2a-c7c3-4b02-b88f-987e984ac2ba.json/.txt` 원격 2/2 재조회 SHA blob `81733fef1bc47ffb25fd65fbb198b5669c12a77d`/`1bc7885b7d1e0b0e197a637003c0b5d7b2d54768`. baseTree `9407814e5de44a7e08e70e0d87c55daf4e4676d3`, preparedTree `0cf74fb4c9761598f12f60769e01d04c9360a006`, provenance SHA256 `5599eefa2403c40db3f66b7924d6b62ac701d464f70859c0aea7a969d393fc1d`.
- **실제 PC A 사후 재조회 [#652](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/652#issuecomment-6701518308):** A `pc-source-preflight` `PASS / PC_SOURCE_READONLY_DIAGNOSIS`, requestId `pc-c182300d-d039-43f6-8fa1-ae841f2369f8`, Actions `42333130078`, remote `results/42333130078-1-seat-2.json/.txt` 2/2. `pcOperationalApprovedSha=configApprovedSha=historical candidate HEAD=d50ba263...`, Git tracked dirty false, `run-local.mjs` SHA256 `50ee0c...` 승인 후 값과 일치, 기존 Task 첫 VBS `run-original-then-archive.vbs` SHA256 `9d5bc342...` 그대로, `protectedStateUnchanged=true`, data/provider/D1 writes 0.
- **정확한 증거 경계:** #652 `lastWriterEvidence.sourceHead=f7ed1e44...`, `at=2026-11-07T03:10:06.923Z`로 설치 **이전** checkpoint이며 `sourceResolved=false/runtimeSourceVerified=false`(A 정적 다단 VBS 연결 한계). 그래서 **새 source로 정규 Core가 실제 완료됐다는 증거는 아직 아님**. 설치 자체와 E: source/config/Task 정합성은 B의 CAS/복구 검증 + A로 입증. 새로운 수집 주기·강제 Task 시작 없이 정상 Writer checkpoint가 `d50ba263...`로 전진하는지 필요한 범위에서 읽기 전용 확인해야 M1(b)/M4 runtime 연계를 닫을 수 있음.
- **실패-복구 케이스:** 과거 [#646](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/646) `WRITER_B_CORE_NATURAL_DRAIN_TIMEOUT_STOP` 후 `WRITER_B_INSTALL_STOP_RESTORED`, 원본 복구 결과 2/2; #650에서 Core natural idle 전 one-shot claim/backup 차단, 별도 fixture로 확인. 동일 requestId 재사용 없음, 기타 4개 실패 시나리오 관련 모의 테스트 PASS. 신규 예약·DB/D1/원자료/Task 정의 변경 0.
- **완료 판정:** M2 Writer B 실Windows 정상 1건 **PASS**, M3 정상/해시/dirty/부분 복구 fixture **PASS**, M1 동적 Runtime 연결은 **STATE_UNKNOWN**, M4 실제 전달/기능 역할 분리 미완료. 공식 누적 **20% 유지**(계획상 순차 M1 통과 전 40/60/80으로 상승 금지). 다음 단일 작업: 기존 `core-status` A로 자연 Core Writer checkpoint `d50ba263...` 전진 및 보호 상태 확인(새 batch 강제 실행 금지) 후 R2 최종 검증 범위와 인계 판단.

## 2026-11-07 — R2 A 의존 모듈 진단 보완, 승인 Controller B #660 접수

- **FIRST FAIL/실제 결함:** [#657](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/657) preview B는 `WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`으로 안전 거부. 19개 공개 preview가 직접 import하는 `lib/inflation-causal-public-catalog.mjs` / `worker/inflation-causal-public-r1.mjs`의 실제 PC 설치·해시는 기존 A `pc-source-preflight`가 보고하지 못함. 이전 #657 재실행 금지.
- **공통 구조 수정:** [PR #658](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/658) `main` 병합 SHA `70222f9a6418225ecad962efdad1e2bc1c0fa14b`. 기존 A에 한정된 `lib/`·`worker/` 직접 하위 JS/TS 모듈 이름·SHA256 조회 추가, 경로·개수·크기 제한/심볼릭링크 거부/서브결과 PARTIAL 처리. 신규 A operation·Runner·예약 0. 테스트 원문 기반 핵심 Controller/Reader/엔진 **59/59 PASS**와 독립 코드 리뷰 GO. 확장 116개 중 113개 PASS; Linux 임시 호스트에서 Windows retired-Iran 조회가 필요한 독립 memory fixture 3개 실패(변경 파일 밖). 전체 Windows Controller/실PC 회귀 완료라고 표현하지 않음.
- **정확한 1파일 승인:** [PR #659](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/659) `main` 병합 SHA `ecb65fee73b20966104ee7dbb8e066355725517e`; 기존 성공 Controller [#637](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/637) 설치 `29d667763650b5d719926034ce3583d563a35d23` → 대상 source `70222f9a...`, Controller/config 누적 변경은 `controller/pc-source-readonly.mjs` **1파일**. 목표 파일 SHA256 `799c98fe2e60441393f4924e74b6aa1a43f097d81abad02cb70125b3fabc4d72`, 승인 manifest RAW SHA256 `d07f0f15dbd2d8a7347e51bc9f49d1e742ddfb13d67209c46a05bd1f23794b87`. GitHub main manifest 원문 재조회 일치, 기존 `validateUpdateRequest`/Controller-only diff 순수 계약 PASS. 백업 `VERSIONED_SNAPSHOT`, rollback `29d667...` 유지.
- **실제 B 단회 접수:** [#660](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/660) `requestId=pc-update-b8dc752e-70d7-4c14-a2ba-922901270bcf`, label `pc-maintenance` **한 번** 생성. 독립 유지보수기 폴링에 따른 result/댓글 아직 없음(작성 시점), **STATE_UNKNOWN / PC 설치 미확정**. 동일 ID 중복 발행 금지. #660 설치 SHA·보호·결과 TXT/JSON 회수 후 기존 A `pc-source-preflight` 1회로 실제 두 module의 존재/해시 관측; 이후에만 새 Writer B 최소 승인 범위 판단.
- **공식 R2 진행률 20% 유지:** M0 완료, M1 실제 Core runtime binding·M4 인계 등 단계 완료 기준 미달. Source 병합 및 명세 접수가 운영 완료 증거가 아님.

## 2026-11-07 — Controller B #660 실PC 완료, 개선된 A #662 결과 대기

- **B 설치 확인:** [#660](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/660) 단회 `requestId=pc-update-b8dc752e-70d7-4c14-a2ba-922901270bcf`의 독립 Windows 유지보수기 댓글 `SUCCEEDED / APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, `targetControllerSha=actualControllerSha=70222f9a6418225ecad962efdad1e2bc1c0fa14b`, LAST_PASS=PASS, FIRST_FAIL=NONE, RECOVERY_SHA=NONE, 보호 불변, Workflow enabled. 원격 결과 `results/maintenance-pc-update-b8dc752e-70d7-4c14-a2ba-922901270bcf.json/.txt` 각각 읽기 재조회 완료; 2/2 존재, requestId/상태 일치. **기존 A 1파일 교체 완료**; Writer 두 의존 모듈 실제 설치 증거는 아님.
- **다음 A 요청:** [#662](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/662) 기존 `pc-source-preflight` `requestId=pc-b198426e-605d-44f4-8c47-2cff762e8ed9` 한 번만 제출, 공개 source `zgmini/main=ce9bccd8b38939b204e8f836a50ae362960eb7af` 최신 일치 확인. 결과/댓글 미회수 관측 시 `STATE_UNKNOWN`이며 추가 A/B 재요청 금지. `historicalCheckoutCandidate.moduleSourceInventory`의 `lib/inflation-causal-public-catalog.mjs`, `worker/inflation-causal-public-r1.mjs` 존재·SHA 및 필요 시 checkout/config/Writer checkpoint 동의를 실제 JSON으로 확인할 것.
- **다음 단일 실행:** #662 고유 원격 JSON/TXT 결과 회수 → 누락 모듈의 실PC 상태를 근거로 정확한 최소 Writer B 새 manifest 결정(기존 실패 #657 재실행 금지), Core·Writer·DB/D1 미승인 변경 없음. 공식 R2 단계 진행률은 M1 Runtime binding/M4 인계 전까지 **20% 유지**.

## 2026-11-07 — #662 A 결과 미도착 관측 및 안전 중지선

- [#661](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/661) Controller B #660 자동 사후 `core-status` 결과는 Windows Actions `42339830691`에서 `PASS / CORE_READONLY_DIAGNOSIS`, `actualExecutionSha=70222f9a6418225ecad962efdad1e2bc1c0fa14b`, 보호 SHA 동일, 결과 2/2. 새 Controller가 A Runner 경로에서 실제 실행된 증거 확보.
- 신규 [#662](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/662) A `pc-source-preflight`는 2026-11-07 13:46 KST 1회 접수 후 14:56 KST까지 **댓글 0/원격 실행 결과 미회수**. `.github/workflows/pc-job.yml`은 `issues.opened`·`pc-job` label·8분 timeout 계약을 유지, Issue body/label 7키 검증됨. 원격 Actions run 목록은 현재 연결된 GitHub tool에 제공되지 않으며 private 브라우저는 로그인 부재로 404; 실행 시작/Queue/실패 자체는 **STATE_UNKNOWN**. #661 성공을 #662 성공으로 대체하거나 새 Issue로 자동 재접수하지 않음.
- 안전 다음 실행은 **기존 #662의 Actions run 존재·상태만 읽기 전용 확인**(사용자 인증된 GitHub Actions 또는 추후 제공되는 연결) → 있으면 동일 run ID 보고서/댓글 회수, 없으면 등록 경로 원인 조사 및 승인된 1회 복구 판단. 같은 A 요청의 시험 재생 금지. Runtime 원자료·PC 운영 파일 변경 없음.

## 2026-11-07 — #662 실행 원장 재확인, Writer B 최소 의존성 폐쇄 시뮬레이션

- **기존 요청 #662:** 같은 고유 Issue/requestId를 재조회했으나 `pc-job` label·요청 7필드는 유지, 댓글 **0건**, 수정 시각은 생성 시각 `2026-11-07T04:46:25Z` 그대로. **Actions runId를 확인하지 못했으므로 `STATE_UNKNOWN`**; 중복 A나 B 생성 0건. `.github/workflows/pc-job.yml`의 `issues.opened`·`pc-job` label·self-hosted Windows·8분 계약을 소스로 재확인. 과거 동일 A [#654](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/654)는 설치 전 Controller에서 `PASS / PC_SOURCE_READONLY_DIAGNOSIS`, run `42333662163`; 이는 새 확장 module inventory의 실PC PASS를 대신하지 않음.
- **실제 실패 범위:** [#657](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/657) `WRITER_B_PREFLIGHT_STOP / WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`, 결과 `2/2 READBACK_VERIFIED`, 설치/배포 없음. 기존 승인에는 `scripts/pc-writer/inflation-causal-public-preview-r1.mjs` 하나만 있었으며, preview는 `lib/inflation-causal-public-catalog.mjs`와 `worker/inflation-causal-public-r1.mjs`를 import, worker는 catalog를 import함.
- **검증된 후보 원문 해시 (zgmini `codex/inflation19-auto-sidecar-prep-20261104`, `6ffe6bb7f3ff8faa452dc86fdcc2a44d0926b1a7`):** preview SHA256 `bc458372f86faf061306ae50e2bc806534f80e4458e45dc7901a3e09cfab86cc`; catalog `db4e05baaa62b51a0a783ce66466c18bb02a924894fc3aca605f473cbe3632e5`; worker `86c5003c3b37cac16e3e5e9b5ed610f9e00f29ee6005cb2abb91fb04abea951f`. 원격 UTF-8 본문으로 해시 산출했고 preview는 이전 승인 해시와 정확히 일치.
- **기존 공통 검사기 자체 시뮬레이션:** `writer-b/import-availability.mjs` 원문을 그대로 로딩해 `existing=()=>false` 보수 가정에서 preview 1파일 `STOP`, preview+catalog 2파일 `STOP`, preview+catalog+worker 3파일 **`PASS / WRITER_B_LITERAL_IMPORTS_AVAILABLE`, 참조 3개 검사**. 추가 임의 Gate·새 operation·Runner/예약 없음. 이 검사는 정적 import 폐쇄성만 증명하며 실제 PC 파일 부재·설치 성공·Core 정상 실행을 입증하지 않음.
- **다음 필수 행동:** #662의 동일 Actions run 유무를 인증된 Actions에서 확인 → run이 있으면 JSON/TXT 조회 및 lib/worker 실제 존재·해시 확인 → 그 결과에 맞춰 `A`/`M` 및 정확한 before SHA가 들어간 최소 새 Writer B manifest 작성·정규 B 적용 여부 판단. #657 재실행 금지, 현재 운영 source/Task/DB/D1 무변경. R2 공식 **20% 유지**.

## 2026-11-07 — #662 GitHub 결과 업로드·공통 설치 검사 재검토

- **Issue 수신 증거:** #662는 2026-11-07 13:46:25 KST 생성 후 `pc-job` label과 요청 본문이 유지되지만 결과 댓글 0건. 같은 A 작업의 과거 #654는 실제 Actions `42333662163`에서 PASS 및 결과 2/2 정상 업로드. 현재 연결된 GitHub Actions 도구는 고유 runId 없는 요청의 run 목록 조회 기능이 없으므로 queued/started/completed 여부를 단정하지 않음.
- **업로드 경로 교차검증:** GitHub `main` 최근 커밋 검색에서 가장 늦은 리포트 커밋은 2026-11-07 13:45:51 KST `report: PC job 42339830691-1 seat 2`(#661); 최신 유지보수 결과 커밋은 13:46:04 KST(#660)이며 **#662 생성 시각 이후의 PC 결과 커밋은 확인되지 않음**. 업로드 설계 `controller/upload.mjs`는 TXT/JSON 2개 readback 후 댓글을 게시한다. 현재 확정 가능한 사실은 `NO_DELIVERED_RESULT`; PC 런타임 실패 `RUNTIME_FAILED` 아님.
- **독립 소스 리뷰:** 기존 `writer-b/import-availability.mjs`는 literal relative import 확인과 신규 M import만 검증하고, 테스트는 Preview→Worker→Catalog 전이 누락/승인 전체 통과를 이미 포함한다. #657은 올바른 안전 차단. 신규 Controller/Writer 검증기나 추가 Gate를 만들지 않음. 기존 `relativeModuleReferences`를 **후보 manifest 준비 시** 재귀 활용하고 PC A 실측 해시와 결합하는 것으로 재발 방지 방향을 확정.
- **LAST PASS:** Controller #660 설치·#661 A 진단·Writer #651 정상 적용·#657 안전 중단·3파일 정적 의존성 폐쇄 시뮬레이션. **FIRST FAIL/불명:** #662 Actions runId·신규 `moduleSourceInventory` 결과 부재. 기존 #662 runId/상태의 인증된 Actions 읽기 전용 확인만 필요; 새로운 A/B Issue·PC 파일/예약/검사 Gate 생성 0. 공식 R2 20% 유지.

## 2026-11-07 — M3 회귀 5/5 독립 통과·#662 트리거 판정 경계

- **검증 기준:** R2 계획의 M3 필수 다섯 시나리오(다단 VBS, 타 담당 dirty, source/file 해시 불일치, 부분 적용·원복, 승인 정상 3파일)를 현재 `main` 실제 소스·테스트에서 개별 매핑. 범위 밖 전체 Controller 테스트를 M3의 새 Gate로 만들지 않음.
- **실제 소스 원본 증명:** `controller/pc-source-readonly.mjs`, `writer-b/{contract,installer,import-availability,insert-only-patch}.mjs`, 테스트 `tests/pc-source-r2-readonly.test.mjs`, `writer-b/{installer,import-availability}.test.mjs` 합계 8파일의 로컬 Git blob SHA가 원격 main blob SHA와 **8/8 정확히 일치**.
- **독립 재실행:** Node `v24.22.1`(Linux scratch)에서 A 12, Writer B transaction 17, import safety 11 = **40/40 PASS**, 실패/skip 0. 다단 UTF-16LE VBS·한정된 module hash, 정상 3파일/HEAD/config/Task 보호, dirty·후보 hash mismatch 선거부, source/config 부분 전환 rollback, Core 자연 drain·불확실 복구/락 보관, preview→worker→catalog import 관계 및 기존 optional import 예외 포함.
- **실PC 교차증거:** Writer B [#651](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/651) `WRITER_B_INSTALLED_VERIFIED`, [#646](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/646) `WRITER_B_INSTALL_STOP_RESTORED` + 결과 pair 2/2, [#657](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/657) 미승인 import의 설치 전 안전 STOP. **M3 자체 회귀 시나리오 5/5 통과**; Linux 회귀를 PC Windows 자연 Core Runtime 연결 PASS로 오인하지 않음.
- **#662 Action 진단(공식 GitHub 문서 대조):** 자체 Runner는 미배정 시 최대 24시간 queue 상태일 수 있으며 workflow의 `timeout-minutes:8`은 *실행 시간 제한*이지 queue 8분 만료 근거가 아님. `jobs.if` 조건 false의 skipped, `issues.opened` 실행 미생성, queue/offline, 실행/업로드 실패는 현재 Run ID 없이 구분 불가. `issues:[opened,labeled]` 단순 추가는 단일 Issue에서 중복 Actions 실행 위험이 있어 금지. 참조: https://docs.github.com/en/actions/reference/runners/self-hosted-runners 및 https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows .
- **진행률 판단:** M3 독립 검증은 PASS이나 R2 공식 누적 단계는 M1 dynamic Runtime binding 및 M4 실제 인계 미확정으로 **20% 유지**. #662 재생·새 A/B 요청·운영 변경 없음. 다음 단일 필요 입력은 기존 #662의 Actions runId와 queued/skipped/in_progress/completed 상태이며, 확보 시 jobs/steps/logs 및 JSON/TXT로 해당 실패 지점만 진단.
