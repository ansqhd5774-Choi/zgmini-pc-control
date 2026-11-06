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
| M1 읽기 전용 A | RUNNING (source 병합, PC 미검증) | 20% 유지 | PR #625 main 병합·18/18 fixture PASS; 실제 A operation 설치·실PC 체크아웃/해시 회수 미확인 |
| M2 공통 Writer B | RUNNING (Windows receiver 소스·시뮬 준비, 실PC 미검증) | 20% 유지 | Draft PR #626 head 846285b6, 신규 14파일(README 포함), 격리 28/28 PASS; Task XML/Core drain·복구 fixture와 기능 담당 재사용 안내, 실제 Runner/설치/Sidecar 동적 호환 미확인 |
| M3 실패·정상 회귀 | RUNNING (격리 시나리오 일부 PASS) | 20% 유지 | 파일 dirty/원본 SHA/부분 전환/Task 종료 대기 등 모의 실패 검증; 실 Windows 정상 1건·rollback 증거 미확인 |
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
