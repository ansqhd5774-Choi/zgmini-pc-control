# ZGMINI A/B 자동 승인 시스템 — 전체 잔여 작업 실행계획 R2

- 최초 작성: **2026-11-27 KST**
- 담당: 자동화 프로세스 전문가
- 관리 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 전용 계획 브랜치: `codex/pc-automation-process-improvement-20261119`
- 소스 기준: 수정 직전 양쪽 최신 `main`; 공통 지침 `AGENTS.md`, `docs/PC_AUTOMATION_STANDARD.md`
- 최초 설계: [`docs/CI_AUTO_APPROVAL_DESIGN_R1.md` (`main`, 2026-11-25 최초 작성)](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/CI_AUTO_APPROVAL_DESIGN_R1.md)
- 본 문서의 역할: 원본 설계 5·6단계의 Controller B 파일럿을 **전체 A / Controller B / Writer B 운영 완료**까지 연결하는 실행 관리 원장. 원본 승인/설치/완료 기록을 초기화하거나 새 운영 권한을 생성하지 않는다.
- **최종 목적:** 기존 승인된 A급 및 두 B급을 GitHub CI 이벤트로 자동 검증·명세 발행·정규 제출·PC 실행·결과 회수까지 운영한다. Controller B 1건 성공은 중간 실증일 뿐 전체 완료가 아니다.

## 1. 검증된 현재 기준과 진행률

| 영역 | 기존 확보한 사실 | 운영 잔여 |
|---|---|---|
| 원본 R1 설계 | 2026-11-25 작성. CI 주체·기존 승인 재사용 확정 | 전체 A/B 종단 결과 필요 |
| Controller B 소스 | CI publisher `PR #3970` 병합, 정책-only 유지보수기 `#4024` 및 읽기 검증 `#4025` 완료 | **자동 발행·정규 제출·Windows 실행 증거 미확보** |
| Controller B 설정 | #4029: `ZGMINI_CI_CONTROLLER_B_ENABLED=false`, `ZGMINI_CI_CONTROLLER_B_POLICY` 미구성 | 승인 원본/독립 신뢰 정책 검증 및 정규 활성화 |
| 중복 방지 | R2 기존 Controller B `#4036`이 수동 접수됨 | 기존 요청 재발행·가짜 무인 성공 금지 |
| 수동 Owner 댓글 | `#4038`은 불필요한 수동 Gate로 2026-11-27 종결 | 재개·재요구하지 않음 |
| A 자동 발행 | 기존 `pc-job`/Runner·허용 operation 존재 | CI 무인 자동 발행·결과 회수의 실제 증거 필요 |
| Writer B 자동 발행 | 기존 Writer B 검증기/신뢰 수신기 존재 | CI 무인 자동 발행·설치·결과 회수의 실제 증거 필요 |

과거 **75%는 개발 진행 추정치**이며 운영 완료율이 아니다. 현재 A·Controller B·Writer B 각각의 **신규 CI 무인 종단 완료 증거는 미확인**이다. 별도 증거 없이 정량적 완료율을 부여하지 않는다.

## 2. 작업 패키지 및 순서

### P0 — 마지막 유효 완료점·자동화 권한 지도

1. 원본 설계 5·6단계, 최신 main과 실제 설치된 Runtime, 기존 승인/요청/영수증을 비교한다.
2. A / Controller B / Writer B별 자동 발행 진입점, 인증된 제출 주체, 기존 수신기, 단회 원장, 현재 장애 입력을 도식화한다.
3. 기존 PASS·설치·CI 증거를 재사용하고, 동일 A 조회·소스 검사를 반복하지 않는다.
4. 완성된 코드와 실행하지 못한 코드를 구분한다. 단순 권한·정책 미구성을 설치 결함으로 단정하지 않는다.

**종료 증거:** 세 효과의 연결/미연결 지점과 정확한 원본 코드 조건.

### P1 — 기존 승인 원본·공통 인증 검증

1. 기존 Owner 업무 승인, 보호된 승인 핀, SHA256, 범위·파일·브랜치·버전, 실제 CI 계보를 필요한 효과별로 검증한다.
2. CI 자체를 Owner로 가장하지 않고 기존 정규 수신기·auth·manifest·CAS·lease·복구 계약을 보존한다.
3. `owner-delegation.mjs`의 특정 댓글 증거 형식을 전 업무의 유일한 필수 신규 Gate로 전제하지 말고, **기존 승인 증거의 신뢰성 있는 공급 방식**과 독립 검증 가능한 실제 경로를 구분한다. 검증기 삭제, 위조, 임의 정책 pin 발급은 금지한다.
4. 기존 권한 내 해결 가능한 부분을 최소 코드 변경 및 회귀시험으로 해결한다. 새로운 관리자·보안 권한이 필요한 정확한 효과만 별도 BLOCKED로 둔다.

**종료 증거:** 범위 내 업무 PASS / 범위 밖·위조·누락 REJECT 회귀 및 실제 원본.

### P2 — Controller B 단회 자동 발행 파일럿

1. 현재 CI publisher/Workflow/정규 유지보수기를 재사용한다.
2. 정확한 `ZGMINI_CI_CONTROLLER_B_POLICY`와 `ENABLED`의 신뢰 출처·권한·변경 효과를 검증한다. 허가 없이 변경하지 않는다.
3. 새 자연 CI 이벤트의 승인 업무만 정확한 명세 발행 → 원본 readback → 기존 B 요청 단회 제출한다.
4. 독립 유지보수기 Windows 수신, 설치 CAS·lease·백업·rollback·사후검사 및 JSON/TXT 원장을 확인한다.
5. **#4036 수동 제출을 신규 자동 실증으로 계산하거나 재발행하지 않는다.**

**종료 증거:** GitHub CI 무인 발행 Run과 실제 Controller B 설치/영수증, 중복 0.

### P3 — A급 자동 승인·실행

1. 등록된 기존 고정 `pc-job` operation을 CI 이벤트에 연결한다.
2. A는 업무에 필요한 허용목록·인증·범위만 검사하고 Controller B 전용 설치 게이트를 강제하지 않는다.
3. 신뢰된 단회 발행, 기존 Runner 실행, JSON/TXT readback, 취소/중복/불명 상태 reconcile을 구현한다.

**종료 증거:** 승인된 실제 A급 업무의 CI 무인 요청 → Runner 실행 → 결과 검증.

### P4 — Writer B 자동 승인·설치

1. 기존 Writer B manifest 검증·제출기·운영 수신기 계약을 사용한다. Controller의 auth를 Writer에 무조건 복제하지 않는다.
2. 실제 Writer 소스·CI·overlay·preimage·설치/복귀 조건을 독립 검증한다.
3. 자동 명세 발행 → 정규 단회 제출 → Windows Writer 설치 → 사후 검사·영수증 readback을 구현한다.

**종료 증거:** 승인된 실제 Writer B 업무의 CI 무인 설치·결과 검증.

### P5 — 공통 결과·단회성·오류 관리 통합

- 기존 등록기·수집기·계산기·게시기·Runner를 재사용하고 새 예약/상주 서비스/Runner를 생성하지 않는다.
- 요청 및 효과 단위 중복을 막고, 수신 후 `RUNNING`·`STATE_UNKNOWN`·`BLOCKED`·`RUNTIME_FAILED`·`DONE`을 구분한다.
- 공유 쓰기·설치만 lease로 직렬화한다. 독립 작업을 무관한 전체 Runner 상태에 묶지 않는다.
- 승인 외 업무 실행 0, 운영 결과 불명 시 새 POST 0, 기존 영수증/체크포인트 보존.

**종료 증거:** A·Controller B·Writer B의 정상/위조/중복/취소/실패/불명 회귀와 실제 대표 경로.

### P6 — 전체 운영 종단 검증 및 인수

| 합격 항목 | A | Controller B | Writer B |
|---|---|---|---|
| 원본 업무 승인·정확 범위 검증 | [ ] | [ ] | [ ] |
| GitHub CI 무인 발행·정규 제출 | [ ] | [ ] | [ ] |
| 실제 PC 실행·영수증 readback | [ ] | [ ] | [ ] |
| 설치 SHA·사후검사/복귀 | 해당 없음 | [ ] | [ ] |
| 중복·권한 범위 밖 실행 차단 | [ ] | [ ] | [ ] |

각 효과의 명세 발행·단회 접수·실제 실행 증거를 구분한다. 관련 정확 HEAD CI, merge SHA, 운영 설치 SHA, JSON/TXT, Runtime과 시간·버전이 맞아야 합격한다. 하나라도 미입증이면 전체 자동 승인 운영 DONE을 선언하지 않는다.

## 3. 실행·소스 보호

- 관리 문서는 이 전용 브랜치에 보존한다. 코드 변경은 **해당 시점 최신 `main` 기반 별도 최소 작업 브랜치**에서 수정하고 관련 CI를 통과한 PR만 정규 통합한다. 오래된 관리 브랜치를 main에 통째로 병합하지 않는다.
- 사용자·다른 담당자의 수정, 유효 승인·설치 이력, 기존 DB/D1·DNS·배포·원자료·예약을 보호한다.
- 사용자에게 수동 JSON 댓글을 작성하게 하거나 새 승인 Gate를 반복 만들지 않는다. 신규 운영 권한/보안 변경은 정확한 대상만 별도 승인으로 분리한다.
- 보안 검사 삭제, GitHub App의 Owner 위장, 가짜 승인값/가짜 PASS, 동일 효과의 중복 설치는 금지한다.
- 수집/계산/저장/게시 등 승인 범위 밖 효과를 자동 승인 계정에 추가하지 않는다.
- 모든 변경은 관측 사실 → 재현된 실패 조건 → 최소 수정 → 정확한 시험/Runtime 검증 순으로 진행한다.

## 4. 최초 실행과 상태 관리

1. 본 문서 관리 브랜치 커밋 후, 실제 구현은 최신 main의 소스와 승인된 증거에서 시작한다.
2. 우선 공통 P1의 **기존 승인·신뢰 원본 자동 연결이 실패하는 정확한 코드 조건**을 판별한다. 시험으로 구분 가능한 최소 실패를 수정하고 CI를 확인한다.
3. 조건이 충족된 효과는 P2/P3/P4를 독립 병렬 진행한다. 신규 권한 변경만 해당 효과에 한정해 대기한다.
4. 현재 작업 완료율은 **P0~P6 7패키지 가운데 확정 종단 PASS 건수 기준**으로만 계산하며, 미확인 항목은 UNKNOWN으로 표시한다. 실행할 때마다 `관측/수정/검증/미완료/다음 행동`을 간단히 원장에 기록한다.
5. **최종 종료 조건은 세 A/B 유형의 실제 CI 무인 운영**이며, Controller B 1건 실증만으로 종료하지 않는다.

## 5. 첫 실행 기록 — 2026-11-27 KST

### 실제 확인한 첫 차단 조건

- **A급:** `.github/workflows/pc-job.yml`의 `approved-pc-job`는 `github.actor`와 `github.event.issue.user.login`이 모두 `ansqhd5774-Choi`인지 검사한다. 일반 `github-actions[bot]`이 생성한 Issue는 기존 Owner-only 경로에 직접 진입하지 못한다.
- **Writer B급:** `.github/workflows/pc-writer-b-source-once.yml`도 `github.actor`, `github.event.sender.login`, `github.event.issue.user.login`이 Owner여야 한다. CI 봇 Issue를 기존 Writer 소유자 요청처럼 취급하는 방식은 승인 범위 외 인증 변경이다.
- **Controller B급:** 고정 CI 수신 영수증 경로가 별도로 개발되어 있으나 운영 자동 발행 정책은 #4029 시점에 미구성이었으며, CI 코드를 병합한 사실만으로 Windows 설치 성공을 주장할 수 없다.
- **공통 오판:** 기존 `ci-approval/shadow-decision.mjs`의 합성 PASS는 **수신기가 실제 CI 발행자를 인증하는지** 확인하지 않고 `WOULD_MATCH_EXISTING_AUTHORITY`를 낼 수 있었다. 이 상태를 자동 발행 준비 완료로 해석해서는 안 된다.

### 직접 수정한 범위

- 실제 소스 브랜치: `codex/ci-auto-approval-receiver-admission-failclosed-20261127` (최신 main `0560970d0bcca0d223ef12a61a9ee1fd36290e1d` 기반).
- [PR #4044](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4044): 합성 판정의 수신기 인증 증거 누락 시 `EVIDENCE_MISSING/CI_RECEIVER_ADMISSION_NOT_PROVEN`으로 반환. A / Writer B / Controller B 음성 회귀 4건 추가.
- 코드 HEAD `85066e3ca47864229a81e38fb457e2b8e8d047e6`, 변경 파일 2개. **관련 정확 HEAD CI 3/3 SUCCESS**: C996 [45875962218](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45875962218), PC Secret Scan [45875962227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45875962227), Controller Maintenance Source Tests [45875962206](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45875962206). [PR #4044](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4044) `main` 병합 SHA **`422cd4044973154038fa0575ad30cc1bd8791c1c`**; main 실제 파일 두 개 blob `44451bb808cf3a2353dd6d84674814f32f68b87b` 및 `37db824e3a46a85654c088ef0cd9984ba98693f6` readback 완료.
- 실제 Owner-only Workflow, Writer 수신기, A 허용목록, CI 인증 정책, GitHub 변수, PC Runtime **변경 0**. PR #4044의 모의 판정 개선을 실제 무인 실행 완료로 세지 않는다.

### 다음 필수 코드 작업

1. A·Writer B 각각의 기존 Owner 인증과 신규 CI 제출 주체를 **동일한 신원으로 가장하지 않고** 분리할 실제 허용 수신·서명/영수증 계약을 특정한다.
2. 독립 검증·계정 범위·단회 요청/기존 영수증·재생 방지를 만족하는 공식 경로만 최소 변경한다. 인증/관리자 권한 변경이 필요한 범위는 별도 근거로 분리한다.
3. PR #4044 정확 HEAD CI·병합·main readback은 완료. **운영 동작이나 자동 승인 활성화를 변경하지 않았다.** 실제 A·Writer 종단 실증 0건으로 보존하고, 다음 구현의 검증된 코드 결과와 분리한다.

## 6. 두 번째 실행 기록 — 2026-11-27 KST

### 확인된 실제 원인과 완료 증거

- 일반 `GITHUB_TOKEN`으로 생성한 Issue가 후속 `issues` workflow를 시작하지 않는다는 GitHub 공식 실행 계약을 확인했다. 기존 A `.github/workflows/pc-job.yml`, Writer B `.github/workflows/pc-writer-b-source-once.yml`의 Owner-only 이벤트·요청자 인증은 보호한다.
- 별도 R2 Controller B 사용자 요청 [#4036](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4036#issuecomment-7200174075)은 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, 실제 Controller `3c7d4cfefacf072fd35cb19706b352c64c5e4fd2` 설치, 백업/보호 상태 유지, JSON/TXT 업로드 확인. 이 요청은 **수동 제출**이므로 자동 승인 종단 1건으로 계상하지 않는다.
- 사용자 직접 댓글은 필요하지 않으며 #4038 수동 Gate를 재개하지 않는다.

### 소스 변경 및 범위

- 새 소스 브랜치: `codex/ci-a-writer-native-dispatch-20261127`, 최신 당시 main `aed6469b65940d59813daf290106c819cd2737ba` 기준.
- [PR #4050](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4050): `ci-approval/native-dispatch.mjs`에 **A·Writer B 전용, 정확한 수신 workflow_dispatch 호출 계약**을 분리 구현. 임의 경로·C 효과 제외, 소스 Run/수신 workflow Blob/설치된 독립 수신 정책 대조 후 A·Writer B 전용 영구 효과 원장에 배타 claim → 단회 API 호출 → 204 확인. 독립 저장기 재생성·손상 원장·volatile 경로를 구분하며 Controller B 원장 스키마는 변경하지 않는다. POST 상태 불명은 재발행 금지. **PC 설치나 승인 판정은 하지 않는다.**
- 현행 Owner-only 운영 Workflow, A 실행기, Writer 설치기, Controller B 정책, GitHub 변수, PC Runtime, DB·D1·예약 **변경 0**.
- 정책 Revision 변경에도 동일 승인 효과를 재발행하지 않도록 효과 키를 `effect + businessApprovalSha256 + approvedRequestSha256`로 고정. 추가한 단일 회귀까지 로컬 Node 시험 **22/22 PASS**.
- HEAD `e0c68781f10e5b66908285778a357dde88507fe6`; 해당 HEAD의 CI Run: Controller Maintenance `45877724129`, C996 `45877724163`, Secret Scan `45877724130` (**최종 결과 확인 전 QUEUED/PENDING**), 현재 소스 PR 작성이 운영 적용은 아니다.

### 다음 필수 실행

1. PR #4050의 정확 HEAD 소스 CI 결과를 회수하여 정상 검증된 코드만 병합하고 원장에 SHA를 남긴다.
2. A·Writer B 각각의 **독립 CI 전용 수신 workflow 및 PC측 인증·효과 원장·사후검사**를 기존 공통 엔진과 연결한다. owner-only 경로를 우회하지 않는다.
3. 실제 인증된 발행 주체가 기존 승인 원본을 독립 검증한 뒤 정규 단회 호출하도록 연결한다. 새 권한이 필요한 경로는 정규 승인 없이 활성화하지 않는다.
4. A / Controller B / Writer B 실제 CI 무인 종단 검증은 여전히 **0/3**이다. 이 PR을 운영 DONE으로 계산하지 않는다.

## 7. 세 번째 실행 기록 — 2026-11-27 KST

### 기존 완료·운영 근거

- 직전 [PR #4044](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4044)는 CI 3/3 SUCCESS 후 `main@422cd4044973154038fa0575ad30cc1bd8791c1c` 병합되었으며 shadow-only receiver admission 증거 누락 오판을 차단했다. 운영 활성화 효과는 없다.
- [#4036 수동 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4036#issuecomment-7200174075)는 `SUCCEEDED`, 실제 설치 SHA `3c7d4cfefacf072fd35cb19706b352c64c5e4fd2`, 결과 JSON/TXT VERIFIED. 무인 CI 자동발행 실증으로 오인하지 않는다.
- [GitHub 공식 GITHUB_TOKEN 이벤트 계약](https://docs.github.com/en/actions/concepts/security/github_token): 토큰-created Issue가 다른 `issues` workflow를 실행하지 않으므로 A·Writer B에는 `workflow_dispatch`의 별도 정규 호출·수신 인증이 필요하다. 사용자 수동 댓글 Gate #4038은 폐기 유지.

### 현재 소스·위험 구분 및 실제 변경

- [PR #4050](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4050) — 실제 대상 코드 브랜치 `codex/ci-a-writer-native-dispatch-20261127`, `ci-approval/native-dispatch.mjs`, `tests/ci-native-dispatch.test.mjs`, 기존 Controller CI workflow의 테스트 연결 3파일.
- **이번 실행에서 실제 수정한 문제:** 소스 Run 성공만 보고 소스 Workflow Git Blob을 독립 검증하지 않던 문제와, 설치된 receiver 정책을 업무 승인 SHA·source run·원본 branch·receiver 경로까지 전부 비교하지 않는 문제를 확인해 모두 fail-closed로 보완했다.
- 원본 source Workflow의 SHA-1 Git blob 및 raw content를 해당 `head_sha`에서 다시 읽어 고정한다. 신뢰 설치 readback의 12개 주요 필드와 기 설정 정책을 대조하며 위조 승인·source run·path를 거부한다.
- `workflow_dispatch` 응답은 구형 204(실행 ID 없음) 및 2026-03-10 API의 200(정확 `workflow_run_id`, API URL, HTML URL)만 허용한다. 발행 결과가 확인되어도 **PC 실행 성공은 별도 증거**다. [공식 GitHub 변경 기록](https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/).
- 기존 A/Writer Owner-only workflow·PC Runner 권한·설치 정책·운영 DB·D1·예약 **변경 없음**. 신규 readback 전송 함수는 실제 Workflow/PC측 receiver 연결이 없으므로 운영 호출 0.
- 이번 HEAD **`dee4fa414b94777156817a28dd9a95872b2bd00a`**, 신규 GitHub CI Run C996 **#45878463061**, Controller Source **#45878463073**, Secret Scan **#45878463236** (2026-11-27 KST 최신 확인: Secret Scan **SUCCESS**, C996·Controller Source는 **QUEUED**; 3/3 확인 전 병합·운영 완료 주장 금지). 로컬 기존 22개 시험에 추가로 소스 Pin·설치 인수 인증 등 9개 테스트를 추가했다. **GitHub CI 전체 결과를 이 파일럿의 합격 기준**으로 사용한다.

### 남은 실제 구현 순서

1. 정확 HEAD CI 3종 완료와 오류 코드를 대조하여 PR #4050의 문제를 수정·검증 후 안전한 경우만 병합.
2. 실질적인 CI A/Writer B receiver workflow·PC측 독립 인증·업무 승인·파일 원본 CAS·실제 실행 계약을 기존 권한 범위에서 구현/검증. 테스트용 transport 신호만으로 운영 완료 처리 금지.
3. Controller B 기존 인증·정본 정책의 미구성과 겹치는 인증 변경은 효과별로 분리하며, 기존 승인된 실제 신규 업무가 확인된 경우에만 자연 CI 이벤트·단회 요청·PC 결과로 실증.
4. 세 지원 유형 **운영 종단 0/3 확인 상태 유지**, 정확한 다음 미완료 구간 이외에 새 Gate나 예약을 추가하지 않는다.

## 8. 네 번째 실행 기록 — 2026-11-27 KST

### 검증 및 정규 통합

- [PR #4050](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4050) 정확 HEAD `dee4fa414b94777156817a28dd9a95872b2bd00a`: C996 [#45878463061](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45878463061), Controller Maintenance Source [#45878463073](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45878463073), Secret Scan [#45878463236](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45878463236) **3/3 SUCCESS**.
- `main` 병합 SHA: **`df779b037b5847574385104a9015c8eb33714edf`**. 병합 후 `main` 재조회 및 모듈 blob `122a048dcd9f3f730abfb5d3384881db27cea3e2`, 회귀시험 blob `e7c0f91eb324e482ee027fbbca167093ff57bb40` 일치 확인. 운영 실행 권한을 추가하지 않은 **자동 전송 소스 통합 완료**.

### 다음 실제 수신 측 코드 연결

- 신규 최소 소스 브랜치 `codex/ci-native-receiver-contract-20261127`: 실제로 발행할 때 기존 Owner-only Workflow를 호출하는 방식을 사용하지 않고, **CI 전용 수신기의 별도 독립 검사**를 구현한다.
- [PR #4065](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4065): `ci-approval/native-receiver-contract.mjs` + `tests/ci-native-receiver-contract.test.mjs` + 기존 Controller source-only CI 시험 연결(3파일). `workflow_dispatch` 입력·Bot ID·private 저장소·main/attempt, source CI Run과 raw Git blob, 현재 receiver workflow raw Git blob, 독립 설치된 승인 원문·요청 원문의 해시, A 읽기 전용 operation 및 Writer B 승인 manifest 기존 계약을 **독립 대조**. C급/위조·범위 밖 입력은 거부한다.
- 수신 측 검사 결과는 **`CONTRACT_MATCH_ONLY`, `canExecute=false`**로 고정. 독립 승인 주체 신원·설치 상태·PC 작업 효과를 자가 발급하지 않는다.
- PR #4065 신규 20개 사례를 정확 source-only CI에 연결했다. HEAD `9a82695e1683c62549a22758b2a8457fffe93a66`에서 **CI 3/3 SUCCESS**: Controller Maintenance Source [#45879612417](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45879612417), C996 [#45879612516](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45879612516), Secret Scan [#45879612421](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45879612421). [PR #4065](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4065) **`main` 병합 SHA `9470859403d9bc0cb706797b7fdab61fcb28806c`**, 병합 소스·시험 파일 blob `64565d72b77f44fc3f0c0efcb7bf5cce4c5defc4` / `1f256cbde27a4028d113cd70e83549948835e72f` readback 완료.
- 기존 Owner-only A/Writer workflow, Controller 설치기, Worker/Runner, 운영 PC 설정, GitHub 변수, 공급자/DB/D1, 예약 **변경 0**.

### 지금 남은 종단 필수 작업

1. PR #4065 소스·시험 CI·병합은 완료. **다음 실제 코드 대상은 수신 Workflow 실행 진입점과 고정 권한·현재 PC preimage·효과 원장 사이의 미연결 구간**이다. 정확한 신뢰 설치·권한 근거와 실제 Runtime을 구분한다.
2. **실제 수신 Workflow와 인증된 호스트의 설치·정규 실행 진입점을 연결한다.** 이벤트·읽기 전용 검증 PASS만으로 PC 실행 권한이 되지 않도록 수신기 독립 policy/CAS/claim/backup/postcheck를 유지한다.
3. CI 발행자 인증의 독립 증거 및 기존 승인 원본 공급과 실제 운영 정책 활성화는 기존 승인 범위와 추가 권한 효과를 분리해 진행한다. #4038 사용자 댓글 재요구나 Owner 위조는 금지한다.
4. A / Controller B / Writer B **실제 무인 CI 실행 종단 완료 0/3**을 유지한다. PR 병합은 운영 완료와 구분한다.

## 9. 다섯 번째 실행 기록 — 2026-11-27 KST

### 실제 연결 지점 발견

- Controller B 기존 운영 B 설치 #4036은 성공, A/Writer B 무인 종단 인증은 아직 미완료인 상태를 보존한다.
- [PR #4050](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4050) 전송 모듈과 [PR #4065](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4065) 독립 수신 검증 모듈은 CI 3/3 성공 후 각각 병합됐다.
- 하지만 두 모듈이 지칭한 `.github/workflows/ci-approved-a-once.yml`, `.github/workflows/ci-approved-writer-b-once.yml`은 실제 `main`에 없고, 실 GitHub 이벤트·REST evidence·PC 설치 Scope를 읽는 실행 진입점도 없어 전송→수신이 동작하지 않는 **직접 미연결 코드 조건**을 확인했다.

### 실제 변경

- 최신 당시 `main@42436298d20d8828bf5dcd4900a8b14fff791849`에서 새 소스 브랜치 `codex/ci-native-receiver-runtime-20261127` 생성.
- [PR #4070](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4070): 수신 Workflow 2개를 각각 **`workflow_dispatch` 전용, 실제 Bot ID/repo private/main 확인, 효과별 기본 비활성**으로 등록.
- `ci-approval/native-receiver-observe.mjs`: 실제 이벤트 바이트와 독립 설치된 **고정 경로**의 로컬 읽기 전용 Scope, 과거 Source Run, 원본 Workflow 및 현재 Receiver Workflow Git blob을 읽어 기존 `inspectNativeReceiver`에 전달. 응답은 `CONTRACT_MATCH_ONLY` 또는 실패 상태일 뿐 PC 실행·설치·추가 Github POST 권한이 아니다.
- `tests/ci-native-receiver-observe.test.mjs`와 기존 Windows Source CI 단계 연결. 위조 Bot, Source/Receiver 경로 변조, 설치 Scope 누락, symlink, CRLF Workflow 검증을 포함한다.
- 최초 HEAD `d5b91b5b4210ec953ee2b64cd9e533f667b56b6b`의 C996는 Windows CRLF 줄바꿈을 고려하지 않은 **시험 코드 오판**으로 실패했다. 소스/권한 완화 없이 정적시험의 CRLF 정규화만 수정해 새 HEAD `831a2c0ef8f65ae1291a1f37ae0dd05f5253da94`로 교체. 최초 실패 증거는 보존한다.
- 신규 HEAD의 GitHub CI: C996 [#45881264817](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45881264817), Source Tests [#45881264798](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45881264798), Secret Scan [#45881264858](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45881264858) **정확 HEAD 모두 SUCCESS (3/3)**. [PR #4070](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4070) **`main` 병합 SHA `dea24f5a3b91dc088a1273c25f6e9d25ace2fe8c`**. 실제 `main`의 수신기 observer blob `70ff3dc091cecfd33e042a4b00d08a8ac4581863`, A Workflow `56d9b02df7c3157009afefad646077fdd9257c36`, Writer Workflow `18aff117556598da8a4ce77d42c20240a9c07419`, 시험 `38ea39f79cb17e7c2db5dc6247156deae82acb99` readback 완료.

### 정확한 이후 작업

1. #4070 소스 CI·병합은 완료. **다음 직접 구현:** GitHub CI 발행자 → 신규 수신 Workflow의 인증된 호출 및 설치 증거를 사용한 PC 실행 어댑터. 수신기 관측 PASS만으로 실제 PC 실행 완료로 계산하지 않는다.
2. 기존 인증된 운영 PC에 정확한 설치/원본 권한/CAS가 실제 존재하는지를 확인한다. **새 Scope 파일 생성·GitHub 변수 활성화·PC 실행은 별도 정규 승인 범위와 실제 해시/영수증 확인 전까지 하지 않는다.**
3. 수신기의 실제 PC A 작업·Writer B 설치 실행 인계에는 독립 인증/효과 claim/Engine 안전 계약을 구현한다. 검증 Workflow가 깨어나는 것을 기능 종단 성공으로 세지 않는다.
4. Controller B는 기존 CI 자동 발행 정책·인증 신뢰근거의 정확한 미구성을 분리해 정상 경로로 해결한다. 종결한 #4038 수동 댓글 요구는 복원하지 않는다.
5. A / Controller B / Writer B **무인 종단 완료율 0/3 확인 상태 유지**, 새 결과 확인 시 유형별로 실제 영수증이 있는 항목만 반영한다.

## 10. 여섯 번째 실행 기록 — 2026-11-27 KST

### 기존 완료 검증

- [PR #4070](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4070), 정확 HEAD `831a2c0ef8f65ae1291a1f37ae0dd05f5253da94`: C996 [#45881264817](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45881264817), Controller Maintenance Source [#45881264798](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45881264798), Secret Scan [#45881264858](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45881264858) **3/3 SUCCESS**, `main` 병합 SHA **`dea24f5a3b91dc088a1273c25f6e9d25ace2fe8c`** 및 main의 4파일 Git blob readback 완료.
- A·Writer B `workflow_dispatch` 수신기와 실제 source run·Workflow·고정 로컬 승인 원본 조회 진입점을 정규 등록했다. 해당 결과의 `CONTRACT_MATCH_ONLY`는 PC 실행/설치 허가가 아니다.

### 새 발행 코드 연결

- 당초 4050 전송 모듈과 4070 수신 Workflow 사이의 **운영 CI 발행 진입점 부재**를 확인했다. 신규 소스 브랜치 `codex/ci-native-publisher-runtime-20261127` 기준 당시 main `47d9a2c2c151e9bfde589ebff59cc22b6d472ba1`.
- [PR #4077](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4077): `.github/workflows/ci-native-auto-publish.yml`에서 승인된 소스 CI `workflow_run.completed` 이벤트를 A/Writer B effect별로 독립 받아, **기존 `dispatchApprovedCiEffect`에 실제 GitHub REST 발행 포트·독립 설치 결과 대조·영구 효과 receipt**를 연결한다.
- 정책·Scope는 이벤트나 생성된 PR에서 받지 않는다. 기존 B 설치 결과를 CI native 승인 근거로 사용할 때에는 **정확 효과와 정책 SHA가 포함된 명시적 결과 증거**가 필요하다. 과거 수동 설치 #4036의 성공만으로 새로운 Bot 권한이 생기지 않는다.
- 기존 `GITHUB_TOKEN`은 발행 Workflow job의 `actions:write`에만 한정, 실제 flag·정규 설치 정책이 없으면 호출 불가. 외부 Runner·새 Controller·예약·PC Task/DB/D1 효과 없음.
- 테스트 `tests/ci-native-publisher-entry.test.mjs`, 기존 Windows Source CI 단계 연결. 최신 HEAD `cd43e06c0f174d73fba6f28060d332792a1fc0c9`. 무관한 Source CI 완료를 `IGNORED`로 처리하고 잘못된 실패 표시/중복 POST를 방지하는 수정까지 반영했다. 정확 HEAD Controller Maintenance Source Tests [#45882290338](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45882290338) **SUCCESS**, C996 [#45882290310](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45882290310) **QUEUED**, Secret Scan [#45882290376](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45882290376) **QUEUED** (관측 시점). 아직 전체 CI/병합/운영 적용 아님.

### 다음 필수 실행

1. #4077 정확 HEAD의 C996/Secret/Windows Source CI를 끝까지 확인하고 실패 시 구분 증거로 최소 수정 후 3/3 확인·병합/원장 readback을 진행한다.
2. **새 운영 권한·신뢰 설치 증거가 실제로 존재하는지** 정규 B 결과와 현재 호스트 설정을 대조한다. 필요한 파일·변수·B 정책을 임의 생성하거나 사용자를 수동 댓글 Gate로 돌려보내지 않는다.
3. A·Writer B 각 지원 유형의 실제 PC 실행 어댑터/사후검사/JSON/TXT 영수증은 별도 미완료. Controller B 자동 발행 정책도 미입증으로 남긴다. 종단 완료는 여전히 **0/3**.

## 11. 일곱 번째 실행 기록 — 2026-11-27 KST

### 기존 전송 경로 통합

- [PR #4077](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4077)의 소스 HEAD `cd43e06c0f174d73fba6f28060d332792a1fc0c9`에서 C996 [45882290310](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45882290310), Windows Source [45882290338](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45882290338), Secret Scan [45882290376](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45882290376) **3/3 SUCCESS** 후 `main` 병합 SHA **`323f672335b799f830333230589042ea837733b8`**.
- `main` readback: 발행 모듈 `8feb9c369c619a3e87d51e4e794e8beb160990c9`, 발행 Workflow `9d6f5eadfb5c362a30b6bc3fe1fab584eb194c6c`, 회귀시험 `de3759e1e66bc4ed277cdcd4b41a8eaa769d7336`. **기존 CI 완료 이벤트→고정 A/Writer 수신 Workflow 전송 소스 통합은 완료**, 운영 자동 승인 실증 아님.

### 실제 PC A급 실행 연결

- 확인한 다음 원인: 신규 `ci-approved-a-once.yml`은 검증기를 실행하고 종료하며, PC에서 기존 A 엔진을 호출하지 않으므로 **무인 PC 실행 경로가 없었다**.
- [PR #4081](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4081), 소스 브랜치 `codex/ci-native-a-execute-readonly-20261127`: `ci-approval/native-a-execute.mjs`와 회귀시험 `tests/ci-native-a-execute.test.mjs`; A 수신 Workflow에 별도 명시적인 `ZGMINI_CI_NATIVE_A_EXEC_ENABLED` 활성화 조건 및 bounded JSON/TXT artifact를 연결.
- 범위: 기존 `observeNativeReceiver`의 실제 Workflow/발행/정책/원문 검증을 재수행한 다음, **독립 설치된 A 실행 허용+어댑터 SHA256+설치 Controller SHA**, 실제 9개 필수 파일 및 모든 설치 파일 원문 SHA, 로컬 `config/operations.json`과 승인 바이트를 대조한다. 기존 `controller/engine.mjs`를 설치 파일에서만 불러 `runner-smoke`, `core-status` 읽기 전용 고정 A 두 operation만 수행한다.
- 기존 엔진의 requestId 중복 원장·Supervisor 소유·lease·보호상태·Worker 실행 안전 계약을 그대로 유지한다. 결과가 PASS여도 providerCalls/d1Writes/operationalWrites가 **0이 아니면 성공으로 인정하지 않는다**. artifact는 allowlist에 든 상태·code·requestId·실행 SHA 등 요약만 담고 원자료/키/Worker raw는 포함하지 않는다.
- Owner-only `pc-job.yml`, 설치 Controller·Writer, DB·D1·수집·예약 **변경 0**. **새 GH 실행 flag·정규 B 설치 Scope·Controller SHA를 실제 확인하지 않은 상태로 운영 실행하지 않는다.**
- 개발 HEAD `07466ae3212e2109523012297463836323257287`에서 Windows Source [45883703273](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883703273), C996 [45883703340](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883703340), Secret Scan [45883703261](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883703261) **정확 HEAD 3/3 SUCCESS**. [PR #4081](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4081) **`main` 병합 SHA `c118db43f553dd62c6735b238e61c5d8df0d939c`**. 병합 소스·시험·A Workflow blob 각각 `3d9c219e5dd2edf8211a724554052f91ef7355cc`, `7ca1c949575d8d0654374af5713837175db5a4fd`, `fd611306443931a0859da05b869f9150e6f9f63e` readback 완료. **실제 A 운영 활성화·실PC 실행 증거는 없음.**

### 미완료 및 다음 실제 실행

1. #4081 CI·병합 완료. **정확한 다음 필수 단계:** 기존 승인된 실PC 실행 Scope, Adapter SHA, Controller SHA, 활성화 변수, 원장과 GitHub Actions Run을 각각 정규 경로에서 확인하여 실제 A 자동 실행을 실증한다. 현재 원장에 그 증거가 없으므로 소스 통합과 구분한다.
2. 이미 승인된 A 업무의 **실제 설치 정책/어댑터/호스트 원본 및 신뢰 실행 주체**를 기존 정규 B 계약으로 확인하고, 가능한 실제 A Runner 실증을 진행한다. 부재 시 해당 효과에만 차단 상태를 표시한다.
3. Writer B는 검증·전송과 실제 기존 Writer CAS 설치 연결 미완료, Controller B는 자동 발행 정책/신뢰 원본 활성화 미입증. 독립 작업 중단 금지.
4. **A/Controller B/Writer B 실제 무인 종단 완료율 0/3 유지**, 코드를 병합했다고 완료로 계상하지 않는다.

## 12. 여덟 번째 실행 기록 — 2026-11-27 KST

### Writer B 기존 설치기 연결 구현

- 기준: `main@c118db43f553dd62c6735b238e61c5d8df0d939c`의 A급 실행 소스와 별도 미연결 Writer B workflow를 확인했다. 새 코드 브랜치는 `codex/ci-native-writer-b-execute-20261127`.
- [PR #4083](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4083): 기존 Owner-only Issue 신원을 위조하지 않고 Writer B 원래 manifest validator와 독립 CI 수신 증거를 함께 검사한 후 인프로세스 B 인증 seal을 발급하도록 분리. `native-writer-b-execute.mjs`의 실제 GitHub 원본 조회 → 설치된 정확 승인/요청 원문 → native adapter SHA 및 **하위 설치기 전체 control commit SHA** 확인 → 후보 SHA checkout → 기존 `performWriterBInstall` / `makeWindowsBAdapter` 공유 lease·CAS·복귀 계약에 연결.
- `ci-approved-writer-b-once.yml`에 별도 `ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED` 조건을 추가. 기존 독립 설치 정책의 `nativeWriterBExecutionEnabled`와 `nativeWriterBAdapterSha256`, `nativeWriterBControlSha`까지 일치해야만 설치 진입. 실제 GitHub 변수·운영 PC 파일은 **변경하지 않음**.
- 초기 범위는 기본 Writer 소스 오버레이이며 `coreMaintenance` 연장 대기·Task 변경·DB/D1/Provider/Controller 변경은 포함하지 않음. 기존 Owner-only Workflow와 중복/lease/CAS/복귀 원장은 그대로 보존. 표준 CI 새 Workflow/Runner/예약 생성 없음.
- 회귀시험 `tests/ci-native-writer-b-execute.test.mjs` 13개(정상 합성 인가 및 가짜 객체/Source drift/Runner 오류/재실행/명세 변조/연장 승인 거부)와 기존 Windows Source CI 연결. **정확 소스 HEAD `4a392e1c7c8335e041da72e9950156d0b636be00`의 C996 [45885097758](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45885097758), Windows Source [45885097924](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45885097924), Secret Scan [45885098120](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45885098120) 3/3 SUCCESS.** C996 실제 로그에서 신규 Writer B 보안 회귀 13/13 PASS. [PR #4083](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4083) 정규 main 병합 SHA **`d7b0400b20d8091341e57881554f3517e6ccb8eb`**; main HEAD 및 5파일 실제 blob readback 완료: `writer-b/contract.mjs` `1b809cfd43f692648adff52e2ee6dac4ce9f6b85`, 실행기 `f86f28257cfd7d534a18483efbb255327b40db32`, 수신 Workflow `b1af2c63c67def7460579346d7eaede8369fe2b0`, Source CI `1d368076e96c1f20e4ba42a348b0e66cf72d823a`, 신규 회귀시험 `1b5398f4efe773470174cfc84cb673fcc3b44b27`. 실제 PC 무인 설치·영구 원장 검증은 여전히 미완료.
- 현행 아티팩트는 bounded JSON/TXT 단기 전달이며 실제 PC 영구 readback과 원본 effect 영수증의 대조는 미완료. 코드 경로 존재, CI, 병합, 운영 설치, PC 성공을 분리한다.

### 남은 실행 순서

1. PR #4083 최신 HEAD C996·Windows Source·Secret Scan **3/3 정확 결과**를 직접 회수하고 실제 실패 시 해당 조건만 수정하여 재검증한다. 안전하게 통합 가능한 경우만 병합 후 source/Workflow readback한다.
2. 기존 승인 자료의 PC 설치/정확 manifest와 native policy 원본, 운영 Runner/CI 수신 실제 상태를 대조한다. 신뢰된 설치와 새 승인 Scope가 없는 효과는 **임의로 활성화하지 않는다**.
3. A/Writer B 각각 실제 승인된 자연 CI 이벤트 → 수신 → PC 단회 실행 → 영구 결과 JSON/TXT 및 실행 SHA readback 검증. B의 source-only 병합은 설치로 오인하지 않는다.
4. Controller B 기존 승인 자동 발행/제출/Windows 설치의 독립 파일럿을 같은 식으로 완료. 새 운영 권한·정책 효과가 필요한 경우 정확한 대상만 분리해 확인한다.
5. 세 유형의 실제 무인 종단 완료 증거가 생길 때만 0/3을 갱신한다. **현재 운영 완료율 0/3 유형.**

## 13. 아홉 번째 실행 기록 — 2026-11-27 KST

### 운영 승인 원본·GitHub 실제 실행 대조 (P1)

- 최신 조회 main 기준 `0ca88b407da8fff2782f9cd802fcd8c86b68e8ed`. Native A/Writer 발행 [Run 45885408073](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45885408073)의 두 job은 실제 `skipped`(steps 0); Controller B 발행 [Run 45885408234](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45885408234)도 `skipped`. `skipped`만으로 정확한 GitHub 변수 원인을 확정하지 않는다.
- Controller B 실제 최신 공개 진단 근거는 과거 #4029/Run 45871432737의 `PARTIAL/CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED`; 이후 현재 PC 설정·로컬 Native Scope와 CI 활성화 변수 값은 직접 실측되지 않았다.
- **독립 설치 증명 생성 경로 누락 확인:** `ci-approval/native-publisher-entry.mjs::verifyNativeInstalledProof`는 기존 B 결과 `ZGMINI_PC_MAINTENANCE_RESULT_V1`에 `ciNativeEffect`·`ciNativePolicySha256`를 요구하지만, 현재 운영 생성 경로 `tools/maintenance-agent.mjs::normalizedResult`는 해당 필드를 생성/보존하지 않는다. 저장소 코드 검색에서도 두 필드는 verifier와 합성 시험에만 나타나 실제 producer가 없다. 따라서 기존 성공한 B 영수증을 그대로 사용해도 이 native proof 검증을 통과할 수 없다. **검사를 삭제하거나 과거 설치를 자동 위임으로 승격해서는 안 된다.** 정확한 기존 B manifest/원문 해시와 실제 native policy 설치를 독립적으로 묶는 producer/readback 구현이 잔여 핵심 코드 과제다.

### 실제 최소 수정 — A급 성공 영수증 증명 강화

- 새 소스 브랜치 `codex/ci-native-a-result-proof-20261127`, 당시 main `0ca88b407da8fff2782f9cd802fcd8c86b68e8ed`.
- [PR #4085](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4085) HEAD `79cf7661e4e3c3fa3b6969ef4a71eea8d0e1fe54`: 기존 native A `PASS`의 provider/D1/operational write 0 조건에 더해 **실제 설치 Controller SHA, 보호 상태 불변, 정확한 run/attempt/seat Job ID**를 필수 대조. 기존 2파일 수정, 위조·누락 5개 회귀 사례 추가. A 작업의 다른 승인·설치·실행 권한 추가 없음.
- 정확 HEAD C996 [45886304905](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886304905), Windows Source [45886304836](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886304836), Secret Scan [45886304824](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886304824) 최초 확인 시 3/3 `queued`, 따라서 **병합·운영 적용 아님**.
- PC·GH 활성화 변수·새 Scope 파일·운영 DB/Task 변경 0. **실제 CI 무인 실행 종단 완료 0/3 유지.**

### 다음 실행

1. #4085 정확 HEAD CI 3/3 종료를 실제 readback하고, 성공 시에만 main 병합/소스 확인, 실패 시 실제 원인만 수정한다.
2. Native A/Writer의 실제 사용 가능한 **정규 설치 승인 원본**에 per-effect 정책·원문 해시를 결합하는 **운영 영수증 producer/검증**의 미연결 지점을 최소 구현한다. 단지 verifier가 기대하는 두 필드를 임의 채우거나 새 로컬 정책 파일을 스스로 생성해서는 안 된다.
3. 각 효과의 현재 PC native scope·설치 SHA·활성화 변수·CI Run을 기존 정규 읽기 경로로 확인한다. 확인한 허가 효과부터 자연 이벤트→수신→PC 단회 실행→지속 JSON/TXT readback; Controller B 독립 파일럿을 병행하되 자원 쓰기만 직렬화한다.
4. 확실한 운영 영수증이 생기기 전까지 유형별 0/3을 유지한다.

## 14. 열 번째 실행 기록 — 2026-11-27 KST

### #4085 CI 및 실제 main 변동

- A 결과 증명 강화 [PR #4085](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4085), HEAD `79cf7661e4e3c3fa3b6969ef4a71eea8d0e1fe54`: Run 45886304836 Windows Source 진행(관측 시 91단계 중 90 완료), C996 45886304905 / Secret Scan 45886304824는 queued. 신규 native A 관련 Windows Source 단계 PASS. **3/3 최종 성공 전 병합 보류**.
- 다른 담당자의 S6 PR #4084가 최신 main `9aa64971ecac09f3832f77ad3b377f93a021de94`에 병합됨. 변경 2파일(`tools/pc-process-inventory-readonly.mjs`, 해당 시험)이고 이번 범위와 분리·보존한다.

### #4086 — B 명시 승인 정책과 실행 결과 영수증 생산 경로 연결

- 신규 소스 브랜치 `codex/ci-native-b-approved-receipt-20261127` (당시 main `0ca88b407da8fff2782f9cd802fcd8c86b68e8ed`) 및 [PR #4086](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4086). HEAD `076d7a46893fff8e44bdd8c979954c6e926f2b87`, 현재 main 대비 mergeable.
- 정확 원인: native publisher는 B 결과 `ciNativeEffect`·`ciNativePolicySha256`를 반드시 확인하지만 기존 maintainer는 해당 값 producer가 없었다. 기존 B 성공 증거를 임의 native 효과로 승격할 수 없어 소스상 연결 결함.
- `tools/maintenance-contract.mjs`: **기존 Owner가 직접 승인한 정확 B manifest에 한해** 선택적 `ciNativeApproval`(schema/effect/policy SHA256)을 검증한다. `A_READONLY` 또는 `B_WRITER_SOURCE`만 가능, `pc-controller-maintenance` + `controllerOnlyInstall` + `selectiveSource` 한정. CI bot 자체에 권한 부여 불가. 원문 SHA와 기존 인증·CAS·복귀 계약 보존.
- `tools/maintenance-agent.mjs`: 검증된 Owner B manifest와 실제 동일 request/target의 `SUCCEEDED`, `protectedStateUnchanged=true`, 설치 SHA 일치 시에만 기존 유지보수기 영구 결과 JSON에 native effect/policy hash를 첨부. updater stdout, 과거 B 영수증, 일반 승인 manifest는 이 권한을 생성할 수 없다.
- `tests/maintenance-contract.test.mjs`, `tests/maintenance-agent.test.mjs`: 범위 밖, 변조, Bot, 설치 SHA drift, 실패·UNKNOWN, 중복 실행, 업데이터 위조 입력을 거부하는 회귀시험 추가. 정확 4파일 blob readback 완료.
- 정확 HEAD CI 등록: C996 [45886695741](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886695741), Windows Source [45886695686](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886695686), Secret Scan [45886695672](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886695672). 관측 시 **3/3 queued**, 병합·운영 설치 전.
- 이 소스 수정은 새 Owner 승인 원본, 로컬 독립 native Scope/proof, GitHub 변수 권한 및 설치 영수증의 실제 존재를 **자동 생성하지 않는다**. PC·GH 변수·업무 쓰기·새 Issue/Runner/예약 변경 0.

### 다음 필수 실행

1. #4085, #4086 각각 정확 HEAD의 CI 3/3 결과를 회수하고, 실패에 해당하는 최소 코드만 정정한다. 정상일 때만 main 병합 및 실제 blob 확인.
2. 실제 승인된 개별 A/Writer/Controller 업무에서 동일 B 명세의 명시 native 정책 해시, 독립 로컬 Scope/proof 설치, 활성화 변수와 실제 PC 버전을 **현재 Runtime으로 검증**한다. Source-only 개발을 실행 완료로 세지 않는다.
3. A, Writer B, Controller B의 실제 자연 CI 이벤트 → 원본 인증 → PC 단회 실행 → JSON/TXT 지속 영수증 및 설치 SHA readback. 특히 Controller B 기존 미구성 정책은 무단 활성화하지 않는다.
4. 운영 무인 완료 증거 없음: **0/3** 유지. 구형 성공·CI PASS·PR 자체를 신규 무인 성공으로 승격하지 않는다.

## 15. 열한 번째 실행 기록 — 2026-11-27 KST

### PR #4086의 종단 보고 누락 조건 재현 및 최소 보완

- 초기 4파일 변경 검토 중 실제 `tools/maintenance-agent.mjs::deliverReports`가 `persistResult` 원장 `entry.result`를 다시 `normalizedResult`에 넣어 GitHub JSON/TXT를 생성하며, 처음 첨부한 `ciNativeEffect` 및 `ciNativePolicySha256` 두 필드를 제거하는 **후단 직접 결함**을 발견했다. 원장에만 증명을 남겨서는 native publisher의 외부 결과 조회에 도달하지 않는다.
- 같은 [PR #4086](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4086)에서 **원장에 먼저 저장된** Owner 요청, 동일 operation, 안정적인 body/fingerprint SHA, 정확 requestId, `SUCCEEDED`, 설치 SHA 일치 및 `protectedStateUnchanged=true`를 확인한 경우에만 최종 JSON/TXT를 생성하는 시점에도 해당 두 필드를 제한적으로 보존한다.
- `tests/maintenance-agent.test.mjs`가 실제 create-only 원격 두 파일의 JSON native effect/policy hash, TXT 대응 값, reportUploadStatus VERIFIED, 중복 apply 0을 검사. 일반 B/업데이터 임의 stdout는 원래 필터에서 제외하는 시험 유지.
- 최종 소스 브랜치 HEAD **`0a586c1416cf27180a9071ddd71be579ceb5cf60`**. [C996 45886928744](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886928744), [Windows Source 45886928698](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886928698), [Secret Scan 45886928655](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886928655)은 최종 HEAD 기준 관측 시 **queued/pending**, CI 완료·병합·운영 적용 아님.
- PR #4085 HEAD `79cf7661e4e3c3fa3b6969ef4a71eea8d0e1fe54`: Windows Source Run 45886304836 **SUCCESS**, Secret Scan 45886304824 **SUCCESS**, C996 45886304905 **queued**; CI 2/3 통과로 병합 보류.
- Runner 관련 직접 관측: C996 Job 140137746766은 `queued`/runner_name 미배정이고 요구 label은 `self-hosted, Windows, X64, zgmini-handoff-ci-isolated`. GitHub API로 Runner 등록 실시간 조회는 권한/지원 미확보. 소스 실패·운영 PC 실패로 단정하지 않는다.

### 정확한 이후 작업

1. #4085와 #4086 각각 현재 정확 HEAD CI 3/3 결과 회수 및 성공 시 정규 병합 후 main readback. CI 대기는 중복 재실행·Gate 삭제 없이 원래 Run을 재조회.
2. 실제 승인된 native policy·B 명세와 독립 설치 Scope/proof의 설치 여부를 현재 PC 정규 읽기 경로에서 확인한다. #4086의 source producer 구현은 실제 승인 manifest/정규 B 설치/현재 GitHub 변수 활성화가 아니다.
3. 권한이 확인된 A/Writer B/Controller B의 자연 CI 무인 작업과 결과 JSON/TXT, SHA 및 중복 효과 0 검증. **실제 운영 완료율 0/3 유지**.

### #4085 완료 반영 — 정확 HEAD CI 및 main 읽기 확인

- #4085 HEAD `79cf7661e4e3c3fa3b6969ef4a71eea8d0e1fe54`의 C996 [45886304905](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886304905), Windows Source [45886304836](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886304836), Secret Scan [45886304824](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886304824): 모두 **SUCCESS 3/3**.
- #4085 정규 merge SHA **`f4a1152f77419a5737fd3b8ba167c3481a99a8e6`**, latest main 일치. `ci-approval/native-a-execute.mjs` blob `82980e54423bf99d65212324489d757205bfeb1f`, `tests/ci-native-a-execute.test.mjs` blob `b4584e1a06357b5d54fbd0efa6a221faee86b251` readback 완료.
- 병합은 **A 결과 증명 소스 검증 완료**이고 native scope 설치·활성화 및 실제 PC 무인 완료가 아니다.
- PR #4086 최신 HEAD는 `0a586c1416cf27180a9071ddd71be579ceb5cf60`. 선행 main 이동은 다른 병합을 보존하여 검증하고, 정확 HEAD CI 완료 이전 병합하지 않는다.

## 16. 열두 번째 실행 기록 — 2026-11-27 KST

### Native A / Writer B 정책 증명 연결 소스 최종 통합

- [PR #4086](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4086), 정확 HEAD `0a586c1416cf27180a9071ddd71be579ceb5cf60`: Windows Source [45886928698](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886928698), C996 [45886928744](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886928744), Secret Scan [45886928655](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45886928655), **정확 HEAD CI 3/3 SUCCESS**.
- 정규 병합 `main=a9c974ff32f91878fcf7f42c4afb2e997973a0a6`. PR 상태 `closed/merged`, main HEAD 및 4파일 Git blob 재조회 확인:
  - `tools/maintenance-contract.mjs`: `caa5209ad1a84fb6cc299c7a5d3c0805ad191dc4`
  - `tools/maintenance-agent.mjs`: `2fcd599f3b5755b05d0ec45a00c1dcdee921b538`
  - `tests/maintenance-contract.test.mjs`: `0d41dd376bb2c9c3dd92d99ba1d02f6e02e38640`
  - `tests/maintenance-agent.test.mjs`: `d024f4a579356ebef1ea28b8ed41f7cc39d7f1fb`
- 직접 결함 해결 범위: 새 Native B policy effect가 기존 B Owner 승인 명세와 실제 독립 설치 성공에 정확히 연결될 때만 `ciNativeEffect`·`ciNativePolicySha256`를 원장 및 원격 JSON/TXT에서 보존. 과거 B 성공/임의 updater 응답은 자동 위임으로 승격 불가.
- 코드 병합은 실제 운영 PC 유지보수기 source 교체·별도 local native Scope/proof 설치·권한 활성화·실제 무인 발행을 포함하지 않는다.

### 잔여 실제 실행 증거·비충돌 범위

- 운영 A [Run 45883221676](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883221676) 조회 시 `operating-process-snapshot` Job 140127435932는 `queued`, runner_id=0/runner_name 없음. 따라서 현재 native scope·PC 설치 버전 readback과 3종 무인 실증 아직 미확보; 원래 요청 재발행/새 승인 우회 금지.
- 별도 S6 [Draft PR #4087](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4087)에서 `tools/maintenance-agent.mjs` 변경 중이므로 후속 수정 시 이 공유 파일 병합 충돌을 독립 보호한다. S6 실제 UNKNOWN의 원인을 이번 CI 작업 완료로 전환하지 않는다.
- 자동 승인 관련 현재 `approvals/` 코드 검색에서 `ciNativeApproval`의 실제 승인된 manifest 증거를 확인하지 못했으며(검색 인덱스 범위 한계), Controller B #4029의 마지막 PC 정책 `false/not configured`는 과거 실증이다. **새 수동 Owner JSON 댓글 Gate를 추가하지 않는다.**
- 실제 완료율 **0/3** 유지.

### 다음 실행 (즉시 필요한 순서)

1. 기존 현재 운영 PC 읽기 전용 Run 및 원장을 회수해 설치 유지보수기 `tools/maintenance-agent.mjs`의 실제 런타임 SHA, 독립 Native Scope/proof, GH 활성화 변수, effect별 기존 업무 승인 원문을 확인한다. 현재 미접수 Runner Job은 중복 발행하지 않는다.
2. 인증된 PC B 설치·Scope 설정이 기존 승인 범위와 정확히 맞는 경우에만 기존 정규 승인/CAS/백업/복귀 절차로 적용하고 설치·결과 JSON/TXT readback 후 운영 소스 버전을 확정한다. C/새 보안 권한/승인 외 효과는 사용자 추가 승인 없이는 실행하지 않는다.
3. A/Writer B/Controller B의 자연 CI 완료→기존 승인 판정→정규 단회 제출→PC 실행→저장·영수증 종단 검증. 현재 실증이 없는 유형은 미완료로 유지한다.

## 17. 열세 번째 실행 기록 — 2026-11-27 KST

### 현재 운영·CI 진단

- 운영 A Run [45883221676](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883221676) Job 140127435932 `queued`, runner_id=0, runner_name 없음. PC Runtime 설치 SHA·Native Scope·활성화 설정은 아직 실측 불가. 원래 A 요청을 중복 발행하지 않음.
- #4078은 `pc-job` Workflow Run 미생성, #4082는 Run 생성 뒤 `queued/pending`; 둘을 동일 장애 원인으로 합치지 않으며 S6의 workflow pause는 journal 없이는 미입증.
- 최신 main에서 시작: `a9c974ff32f91878fcf7f42c4afb2e997973a0a6`; 다른 담당자의 S6 #4087 공유 쓰기와 무관한 Native 소스만 변경.

### 신규 실제 코드 결함 — 미래 CI Run ID 사전 고정 불가능

- 기존 Native A/Writer 발행 정책은 설치 시 `sourceRunId`를 요구하면서 오직 **CI 완료 이벤트**에서 자동 발행한다. 새 Run ID는 실행 생성 이후에 결정되므로, 이미 지난 완료 이벤트에 맞추어 정책을 설치하는 방식으로는 완전 자동 운용이 연결되지 않는다.
- [PR #4088](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4088), 전용 소스 브랜치 `codex/ci-native-event-run-bind-20261127`, HEAD `fb0fe5fedf337b5f509ab920aaa2e80e54af0142`.
- 기존 고정 Run-ID 모드는 유지하고 명시 사전 설치 승인 정책 `sourceRunMode: EVENT_COMPLETION_V1`에서만 Run ID를 제외한다. source commit SHA, CI Workflow ID/path/blob, 승인 원문 SHA256, 요청 SHA256, receiver blob/revision은 독립 B 승인 정책에 고정한다.
- 실제 `workflow_run.completed`의 repository/actor/commit/workflow/first attempt/success를 먼저 검증한 뒤 실제 Run ID를 메모리에서 바인딩한다. 기존 REST 원문 재조회·독립 설치 proof·단회 effect-key 영구 claim을 사용하고 receiver에서 GitHub Bot 원본·입력·소스 Run과 workflow blob을 재검증한다. 허위·범위 외·중복 효과는 거부.
- 변경 8파일(기존 Native 발행·디스패치·수신 4 + 관련 회귀시험 4), GitHub 변수, 운영 소스, PC Task, DB, 예약, 신규 승인·요청 없음.
- 정확 HEAD CI: Windows Source [45888064051](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888064051), C996 [45888063831](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888063831), Secret Scan [45888063915](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888063915), 최초 확인 시 `queued`, 병합 아님.

### 다음

1. #4088 정확 HEAD CI 3/3 확인; 실패 시 실제 원인 최소 수정, 성공 시 main 병합 및 blob readback.
2. 기존 정규 A 운영 Run에서 PC 설치/정책 source를 확보하고 사용 가능한 승인 Scope만 실제 활성화; 정책 코드가 자동으로 승인 원본을 생성하는 것으로 해석하지 않는다.
3. 승인된 A/Writer/Controller B 각 자연 CI 완료→정규 단회 제출→PC 실행·사후 검사→원격 JSON/TXT readback. 현재 무인 운영 완료율 **0/3**.


### #4088 후속 — 전 필드 설치 권한 대조 및 정확 HEAD 갱신

- 처음 구현의 `dispatchApprovedCiEffect`는 정책 설치 proof와 발행 Scope 사이에 Workflow/업무 해시 등 주요 필드만 비교하고, `nativeAExecutionEnabled`, `nativeWriterBExecutionEnabled`, `nativeAAdapterSha256`, `nativeWriterBAdapterSha256`, `nativeWriterBControlSha`, `installedControllerSha` 같은 **실제 실행 권한 필드**는 별도로 비교하지 않았다. 실행 권한이 다른 로컬 Scope를 일부 필드 일치만으로 승인하면 독립 B proof 결합이 약해질 수 있다.
- 기존 effect-key/receipt-claim 및 Runtime origin 검증과 함께, 이제 `JSON.stringify(installedPolicy)`와 현재 정책 전체를 대조한다. `EVENT_COMPLETION_V1`에서는 검증한 현재 Run ID **하나만** 제거하고 비교하며 나머지 모든 권한·어댑터/설치 SHA 항목은 정확히 일치해야 한다. 기존 고정 모드의 sourceRunId 검증도 유지한다.
- 고정/이벤트 모드별 각 실행 플래그·어댑터/Controller SHA 변조를 차단하는 회귀 12가지 사례 추가. [PR #4088](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4088)의 **최신 HEAD는 `0cd02981418984d7392537b0e45f56040656c1b1`**, 이전 `fb0fe5fe...` CI를 새 HEAD 합격 증거로 재사용하지 않는다.
- 신규 정확 HEAD CI: [C996 45888305188](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888305188), [Windows Source 45888305199](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888305199), [Secret Scan 45888305340](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888305340), 최초 관측 `queued/pending`. 병합·운영 활성화·PC 설치는 실행하지 않았다.

### #4088 후속 보완 — 전체 설치 정책 구조 동등성 검증

- 정확 비교 조건의 추가 확인: 독립 설치된 `proof.policy`와 `scope.policy`는 동일 권한이더라도 JSON 객체 필드 순서가 다를 수 있다. 원문 `JSON.stringify` 비교는 유효한 승인을 오탐 거절한다. `isDeepStrictEqual`로 구조·자료형·추가 권한 필드까지 정확 비교하도록 수정하고 JSON 필드 순서 차이의 정상 통과 회귀시험 2건 추가. 기존 권한 변조 12종 차단 시험 유지.
- [PR #4088](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4088)의 **최신 HEAD `cd20a96ac6f71dd079014135e991102df0223768`**. 정확 HEAD 테스트 세 종류: Windows Source Run [45888649625](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888649625), C996 [45888649626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888649626), Secret Scan [45888649590](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888649590), 관측 시 3종 `queued`. 이전 HEAD 시험 결과 재사용하지 않음.
- 이 조치는 승인 정책 설치/승인 확대가 아닌 읽기 정확성 수정이다. C996/Windows/Secret 3/3 결과 전에는 병합하지 않고, 실제 PC 운영 무인 완료는 **0/3**을 유지한다.

### #4088 추가 실제 결함 및 현재 최신 HEAD — 2026-11-27 KST

- 기존 `dispatchApprovedCiEffect`의 설치 정책 비교가 transport 주요 필드만 포함해 Writer/A 실제 실행 활성화·어댑터 SHA·Controller SHA 권한 차이를 거르지 못할 수 있었다. 전체 정책 구조 동등성(`isDeepStrictEqual`) 검사로 보강하여 출처/필드 순서가 달라도 동일 정책은 수락, 실행 권한 drift는 거부. 기존 `sourceRunId` 고정 방식 유지, `EVENT_COMPLETION_V1`만 GitHub에서 재검증한 동적 Run ID 한 필드를 제외한다.
- 또 `publishNativeCompletion`이 B-signed 승인 원문과 현재 로컬 `approvalBytes`의 SHA-256을 검사하기 전에 단회 dispatch claim을 소모할 수 있음을 확인했다. 수신기에서 실패할 변경된 승인 bytes를 발행 단계에서 `CI_NATIVE_PUBLISH_APPROVAL_BYTES_DRIFT`로 막고, 단회 POST 0회 유지하도록 수정. 해당 코드와 정확 회귀시험을 기존 #4088에 통합.
- [PR #4088](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4088) **현재 HEAD `535f38c3584ec81d4f4eddfd33ecdd6599a62ff5`**. 정확 HEAD CI: Windows Source [45888855283](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855283), C996 [45888855342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855342), Secret Scan [45888855329](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855329), 모두 최초 관측 시 `queued`. **이전 HEAD의 실행 결과로 병합하지 않는다.**
- 같은 시간 다른 S6 담당자의 main 변경 HEAD `d2e8fece77c8aa01cf54669800e0a36154e8e2d1`가 들어왔다. `maintenance-agent.mjs`, `maintenance-apply.mjs`와 두 관련 시험 파일만 변경되었으며 #4088의 native 8파일과 겹치지 않는다. shared source 보존 및 추후 mergeability 재검증.
- 기존 운영 PC A Run 45883221676 `queued`, runner_id 0; A/Writer B/Controller B 실제 무인 작업 증거 **0/3** 유지. 변경은 소스·시험·Plan만이며 PC install/승인 flag/정책 원본 운영 효과 0.

다음 필수 실행: #4088 최종 CI 3/3 결과 → 성공 시 정확 SHA로 병합/main blob readback, 아니면 실패한 테스트만 최소 수정 → 실제 PC 승인 Scope 확인 및 효과별 자연 무인 종단 증거 회수.

### #4088 검증 원장 갱신 — 최종 소스 HEAD의 실행 증거

- 최종 PR HEAD `535f38c3584ec81d4f4eddfd33ecdd6599a62ff5`의 [Windows Source Run 45888855283](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855283) Job 140146244434, **completed/success**, 전체 source-only 단계 및 native publisher/dispatch/receiver 회귀시험 PASS.
- [Secret Scan Run 45888855329](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855329) **completed/success**.
- [C996 Run 45888855342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855342) 마지막 관측 `queued`, runner 아직 미배정. 따라서 **2/3 성공, #4088 병합 전**. 다른 SHA의 C996 결과 재사용 금지.
- 별도 S6 소스 main 변경 `d2e8fece77c8aa01cf54669800e0a36154e8e2d1`은 4개 maintenance 파일이고 native PR 변경 8파일과 분리 확인; 변경 보존.
- 기존 PC 운영 A [Run 45883221676](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883221676) Job 140127435932도 `queued`/runner_id 0으로 실제 Native 설치·활성 Scope readback 불가; 무인 운영 완료 **0/3** 유지.
- 다음 필수 실행: 같은 C996 정확 HEAD 종료 확인 → 3/3 성공 시 #4088 squash merge 및 main blob 재조회 → 유효 기존 승인 정책과 실제 Runtime에서의 각 효과 종단 실증. `queued` 상태에서 수동 검사 완화나 중복 작업 생성 금지.

## 18. 열네 번째 실행 기록 — 2026-11-27 KST

### 이벤트 기반 A/Writer B 자연 CI 발행 소스 통합 완료

- [PR #4088](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4088) 정확 최종 HEAD **`535f38c3584ec81d4f4eddfd33ecdd6599a62ff5`**.
- 세 CI의 정확한 commit `head_sha`, `completed/success`를 각각 GitHub Actions Run 원본으로 확인:
  - Windows Source [45888855283](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855283) **SUCCESS**, native Publisher/Dispatch/Receiver 정규 회귀시험 포함
  - Secret Scan [45888855329](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855329) **SUCCESS**
  - C996 [45888855342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855342) **SUCCESS**
- 정확 HEAD CI 3/3 이후 정규 squash **main 병합 `5b8c751d4c8b711797c36b1a461b543abc11298e`**, PR `closed/merged` 및 main HEAD 확인. S6 변경 `d2e8fece77c8aa01cf54669800e0a36154e8e2d1` 보존.
- main 8개 파일 readback blob:
  - `ci-approval/native-publisher-entry.mjs` `d2a6f9c33ba45a78dcff09460ea0042791baad47`
  - `ci-approval/native-dispatch.mjs` `c32743e9c8db2c7b5b4b94064976bbb591a22b76`
  - `ci-approval/native-receiver-observe.mjs` `c924982ba0766fd3e2341429952d3b54b473bb25`
  - `ci-approval/native-receiver-contract.mjs` `b9690c22cffd1e18ea529c210bb7fe6bcb8854dc`
  - `tests/ci-native-dispatch.test.mjs` `43c6f96e1dc7b7f3e1f3eeee6908d181dced4618`
  - `tests/ci-native-publisher-entry.test.mjs` `b3b827da64613a43f673e2c12ac88b4f381695a4`
  - `tests/ci-native-receiver-observe.test.mjs` `da867bd629f5c468f4dd8b11690331b931472535`
  - `tests/ci-native-receiver-contract.test.mjs` `45f99107adbfbf5b7304770fc3c663631c7ee069`

### 변경 경계 및 운영 잔여

- 기존 고정 source Run 방식 및 Auth/Controller/Writer 효과·lease·CAS·rollback은 유지. 사전 승인 scope에서 선택한 `EVENT_COMPLETION_V1`에만 실제 완료 Run ID를 인증 결합해 매번 신뢰된 source SHA/workflow/approval/receiver pin을 검사한다.
- 전체 설치된 B-native 정책의 실행 플래그·어댑터 SHA 등 필드와 발행 scope의 동등성 검증(`isDeepStrictEqual`). 승인 원문 SHA drift는 발행 **이전** 거부하여 단회 claim을 소모하지 않는다. 별도 승인 없이 새 권한 생성/활성화하지 않는다.
- 운영 PC 설치·변수·독립 정책의 현재 readback은 미입증. 기존 운영 A [45883221676](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883221676)는 앞선 관측에서 계속 `queued`/runner_id 0이었으며, 해당 실행을 다시 발행하지 않는다.
- **종단 운영 완료율 A/Writer B/Controller B = 0/3**. PR·CI·GitHub 병합을 실PC 무인 실행 영수증으로 계산하지 않음.

### 다음 필수 작업

1. 기존 운영 A Run 및 실제 PC Native scope/독립 proof/승인 원문/설치 소스를 readback. 불가능하면 해당 효과의 미확인만 보류.
2. 이미 승인된 운영 설치 권한이 정확히 입증되는 범위에서만 기존 정규 B(lease/CAS/백업/복구)로 실제 필요한 파일/정책을 설치하고 SHA·영구 결과 확인. 승인 없이 보안 변수나 C급 변경 금지.
3. A, Writer B, Controller B의 자연 CI 완료→독립 승인 판정→정규 단회 발행→Windows 수신/실행→JSON/TXT 영구 영수증·원본 readback. 다른 범위의 S6 장애를 전역 완료 조건으로 확대하지 않음.

## 19. 열다섯 번째 실행 기록 — 2026-11-27 KST

### 운영 PC Runner 배정과 CI 활성화의 독립 장애 구분

- 최신 `main` `5b8c751d4c8b711797c36b1a461b543abc11298e`, PR #4088 완전 병합 상태 보존. 새 코드/운영 설정 변경은 필요 증거 없이 수행하지 않음.
- 정상 운영 PC A 원본 [Run 45881716545](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45881716545) Job 140122406010: `zgmini-pc-03`, 레이블 `self-hosted, Windows, X64, zgmini-pc-control`, **2026-11-26 19:11:12~19:11:44 UTC SUCCESS**.
- 그 뒤 기존 운영 PC A [Run 45883221676](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883221676) Job 140127435932: **queued, runner_id=0, runner_name 공백**. 별도 W06 PC Job [45884082348](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45884082348)도 `queued`, 같은 운영 label. S6 #4069 정확 `pausedAt/resumedAt`와 Runner Online·Busy·Watchdog 상태는 여전히 미확인. '오프라인' 또는 'S6가 원인'이라고 확정할 증거 없음.
- **격리 CI는 별도 정상:** PR #4088 C996 [Run 45888855342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855342) Job 140146247627이 격리 Runner **`zgmini-handoff-ci-spare-01`, runner_id=27**, `zgmini-handoff-ci-isolated` label에서 **2026-11-26 20:12:19~20:12:47 UTC SUCCESS**. 따라서 GitHub 전체 CI 중단이나 모든 Windows Runner Offline이라는 주장은 반증됨. 격리 Runner를 운영 PC A/B 대체 실행기로 오인하지 않는다.
- 자동 승인 이벤트 실행도 구분: Native A/Writer 발행 [Run 45889169501](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45889169501) 두 Job **skipped**; Controller B 제출 [Run 45889409938](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45889409938) **skipped**. 반면 기존 Approval Event Intake [Run 45889169522](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45889169522)는 SUCCESS. CI 트리거 인프라 전체 실패가 아니라 독립 활성화/업무 승인 Gate를 계속 확인할 필요가 있다.
- 연결된 GitHub Actions Variables 사용자 세션의 **이전 브라우저 탭 스냅샷**(마지막 열람 2026-11-26 14:37 UTC)에서 `ZGMINI_CI_CONTROLLER_B_ENABLED=false`; `ZGMINI_CI_NATIVE_A_ENABLED`, `ZGMINI_CI_NATIVE_WRITER_B_ENABLED` 및 효과 실행 플래그는 목록에 보이지 않음. 이것은 **과거 UI 스냅샷이고 최신 변수의 실시간 조회가 아님**. GitHub Connector에서 repository runner/settings read 경로가 지원되지 않아 현시점 Online/Busy와 변수 값을 현재 시점으로 확정하지 않는다. 새 보안 권한/활성화 변수를 임의 설정하지 않는다.
- 과거 격리 PC 진단 [Run 45871432737](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45871432737) `2026-11-26T17:56:54Z`는 `CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED`; 그때 독립 Owner Scope와 installed receiver 미입증. 최신 정책 생성/설치는 아직 증거 없음.
- #4078 Workflow Run **미생성**(19:14:52 UTC)과 #4082/4080 **Run 생성 후 운영 Runner 미배정**은 서로 다른 실패 단계다. #4069의 S6 중지창과 #4078 공백 연계는 실제 local journal 없이 가능성만 유지하며, 이미 별도 S6 담당 Issue에서 조사 중인 범위에 중복 운영 쓰기를 만들지 않는다.

### 판정·다음 직접 실행

1. **소스 개선 완료:** native A/Writer B 사전 승인 결합, Owner B installed-result proof, 영구 effect claim, 이전 #4085/#4086/#4088 정확 CI 3/3 및 main 병합 유효. 해당 부분 추가 소스 재작성은 새 실패 증거 없이는 하지 않는다.
2. **현재 필수 원인 관측:** 기존 공식 경로에서 6개 `zgmini-pc-0{1..6}` 등록·Online/Busy 및 현장 Watchdog/Supervisor S6 journal phase, 승인된 Native Scope/proof·정확 설치 SHA 확인. 운영 PC 연결이 없어 A Run 재발행/격리 Runner로 PC 실행 대체 금지.
3. **CI 권한 활성화:** 현재 Actions vars와 실제 Owner-승인 business grant/independent B policy installer의 정확 원문을 대조한다. 이전 UI false/absent와 CI skipped를 원인 후보로 구분한다. 새 권한·보안 변경은 승인 없는 설정 변경 금지.
4. 권한과 실행기가 검증된 효과만 자연 CI→단회 dispatch→PC A/Writer B/Controller B→JSON/TXT 원본 readback. **무인 실운영 완료 0/3**을 유지한다. 각 고유 효과는 독립적으로 다음 단계 진행.

## 20. 열여섯 번째 실행 기록 — 격리 Publisher 정책 경로 불일치 확인 (2026-11-27 KST)

### 근거와 실패 조건

- 최신 main `5b8c751d4c8b711797c36b1a461b543abc11298e`, Native Publisher는 분리된 물리 PC의 `zgmini-handoff-ci-isolated` Runner에서 실행한다. 실적: 격리 `zgmini-handoff-ci-spare-01` C996 Job [45888855342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45888855342) PASS.
- 그런데 `ci-approval/native-publisher-entry.mjs::main`은 `readNativeScope(effect)`와 `readNativeInstalledProof(effect)` 기본 경로를 그대로 호출하여 **운영 PC용 `E:\\ZGmini\\data\\pc-writer\\ci-native`**를 격리 PC에서 찾는다. `docs/PC_OPERATING_SYSTEMS_CANONICAL.md` 2026-11-12 원본 실측에서 격리 장비에는 `E:\\ZGmini` 운영 루트가 없음. **현재 2026-11-27의 해당 경로가 여전히 없는지 현장 재실측은 불가**; 이전 장비 구조와 최신 소스 기본값의 불일치는 확정.
- 실제 C급 영수증 저장소는 격리 PC의 기존 `C:\\ProgramData\\ZGMINI-CI\\ControllerBReceipts`에서 2026-11-26 승인된 독립 파일 [#3925](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3925) write 및 [#3926](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3926) 다음 Run readback PASS 이력이 있다. 이는 **CI Native 전용 scope/proof 설치나 Controller B 활성화 증명이 아니다**.

### 최소 소스 수정 — PR #4089

- 대상 브랜치 `codex/ci-native-isolated-policy-root-20261127`. [PR #4089](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4089), 정확 최초 HEAD `d265e6c01a82293555584f06c8ad03a13b08643f`.
- 격리 Publisher의 Owner-B 승인 Scope/Proof read-only 위치를 **별도 사전 준비된 `ZGMINI_CI_NATIVE_SCOPE_ROOT`**로 받는다. 기존 쓰기 가능한 영구 단회 발행 영수증 `ZGMINI_CI_NATIVE_RECEIPT_ROOT`는 그대로 사용하고, 두 root의 같음·상하위 포함·symlink/reparse·실경로 치환·TEMP/Runner Checkout policy 위치를 거부. 디렉터리 자동 생성·파일 복제·새 승인 원본 생성 없음.
- 모든 B 증명 보호(`nativePolicySha256`, 완료 영수증 `requestId/effect/actualControllerSha/protectedStateUnchanged` 일치) 및 업무 승인 byte hash, 독립 workflow/run/blob 검사는 유지. 기존 Controller/Writer 효과·Runner 라벨·실행 옵션·데이터 변경 0.
- `tests/ci-native-publisher-entry.test.mjs`: 두 effect 격리 local scope+proof readback, 사용하지 않는 receipt root, 정책 위치 겹침·임시/미존재/root 없는 경우 거부, workflow disabled opt-in 회귀 추가. 정확 HEAD CI [Windows Source 45890326250](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890326250), [C996 45890326238](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890326238), [Secret Scan 45890326194](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890326194), 최초 관측 queued/in_progress로 **병합 전**.

### 다음 실제 완료 의존성

1. #4089 정확 HEAD CI 3/3을 확인하여 source 실패 시 원인 최소 정정, 성공 시 main 병합 및 3파일 readback. 사전 승인 없는 runtime 설치로 해석 금지.
2. **별도 격리 PC의 Native 읽기 전용 정책·B-installed proof 위치와 파일 바이트/권한/출처**를 실제 독립 승인 경로에서 설치하고 `ZGMINI_CI_NATIVE_SCOPE_ROOT` 설정; 새 보안 권한/수동 관리자 변경은 별도 승인 없이 자동 수행하지 않는다. 기존 receipt root 영수증 파일을 정책 원본으로 승격하지 않는다.
3. 운영 PC 6 Runner 현재 실제 Online·Busy/Watchdog/S6 journal readback은 여전히 공식 조회 미지원, 기존 `#4080` queued 요청을 재발행하지 않음. A/Writer B/Controller B 실제 무인 종단 완료 **0/3**.

### #4089 완료 증거 — 정확 HEAD CI 및 main 반영

- [PR #4089](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4089) 최종 HEAD `d265e6c01a82293555584f06c8ad03a13b08643f` 원본 3 CI의 `head_sha`, `completed/success` 재검증:
  - Windows Source [45890326250](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890326250) **SUCCESS**, 신규 Native isolated scope/proof readback 및 경로 겹침/임시 root 차단 시험 포함
  - C996 [45890326238](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890326238) **SUCCESS**
  - Secret Scan [45890326194](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890326194) **SUCCESS**
- **CI 3/3 후 main squash 병합 `d73340a799162eb74060374f5f43170f65b4fe76`**, PR 상태 `closed/merged`, main HEAD와 변경 3파일의 Git blob 원본 재조회:
  - `.github/workflows/ci-native-auto-publish.yml` `4f8babf82910d3286d975bfbbb9218c193137759`
  - `ci-approval/native-publisher-entry.mjs` `93fdf1585c10c70229fec2987b05228450f1da5b`
  - `tests/ci-native-publisher-entry.test.mjs` `a7365b6c26f68a0767822d26fb4bf13f908411ca`
- **기능 범위 완료:** 이전 운영-PC E: 기본경로를 별도 격리 PC Publisher에서 무조건 사용하던 source 결함 수정. `ZGMINI_CI_NATIVE_SCOPE_ROOT`는 **독립적으로 설치·관리하는 읽기 전용 B-approved 정책 루트**이고, 기존 `ZGMINI_CI_NATIVE_RECEIPT_ROOT`는 단회 발행 영수증 전용 쓰기 root로 유지. 두 path의 포함/중첩·symlink·checkout/TEMP 정책 사용 거부. 실제 Owner-B 승인 증명 및 A/Writer receiver 기존 source/실행/권한 검사 유지.
- **운영 적용 미완료:** 해당 새 변수의 실제 등록·격리 PC 경로/ACL/정확한 Owner-approved Scope·proof 설치를 소스 변경만으로 단정하지 않는다. 정책·파일·GH 변수·Controller·Core·DB를 운영 변경한 적 없고 신규 A/B 요청도 발행하지 않았다. Native/Controller B 활성화 여부와 실제 운영 Windows Runner 6개 상태는 여전히 직접 실측하지 못했다. 운영 무인 완료율 **0/3** 유지.
- **다음 직접 필수 실행:** 기존 독립 승인 계약에서 격리 PC의 승인 정책 root를 실제 준비/검증하고 `ZGMINI_CI_NATIVE_SCOPE_ROOT` 변수를 허가된 범위에서 연결 → 운영 PC Runner와 설치 승인 SHA 확인 → A/Writer B/Controller B의 각 실제 단회 원본 결과 JSON/TXT까지 확인. 새 관리자/보안 범위 승인이 필요하면 효과·정확 경로/해시를 분리해 처리하고 설정 변경으로 승인 증거를 대체하지 않는다.

## 21. 열일곱 번째 실행 기록 — 운영 Runner 6/6 실제 복구 및 Native 활성화 계약 분리 (2026-11-27 KST)

### 현장 Runner/기존 A 완료 증거

- 사용자 제공 GitHub Runners 화면(2026-11-27 오전): `zgmini-pc-01..06` 6/6 **Idle**, 격리 `zgmini-handoff-ci-spare-01` **Active**. UI 스냅샷을 전 기간의 동작으로 확대하지 않음.
- 기존 원본 [#4080 A Run 45883221676](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883221676), Job 140127435932가 운영 `zgmini-pc-03`에서 **completed/success** (2026-11-26 21:09:46~21:11:18 UTC). 기존 #4080 Issue 댓글 [7203475101](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4080#issuecomment-7203475101)에서 고유 원격 결과 `results/pc-process-inventory-45883221676-1-operating.json/.txt` 2/2 readback PASS.
- 원본 JSON blob `9c204f8a5d427826d8d5b82777432967049ac2de` / TXT `801ac65dc0a20a2f5fd54e25b436481f80e47465`: `PROCESS_INVENTORY_COLLECTED`, 실제 `observedAtUtc=2026-11-26T21:10:54.821Z`, `maintenance.runtimeState=HEALTHY`, `automationState=HEALTHY`, `workflowState=active`, `runtimeSignals` Controller source verified/Supervisor identity·fresh heartbeat/6 children/allSixOnline **각 true**, `installLockHeld=false`. Runner roster `QUERY_RETURNED`: 6/6 online, 당해 실행 중 03만 Busy. 0 operational writes/retries.
- 실제 설치 `actualControllerSha=3c7d4cfefacf072fd35cb19706b352c64c5e4fd2`, `maintenanceSourceSha=5a85f803fd9cb280561395f88a3544ee8e7d4660`. **main 최신 SHA와 운영 설치 SHA를 혼동 금지**.
- 기존 [#4082 W06 Run 45884082348](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45884082348) Job 140130350496 `zgmini-pc-01`에서 **completed/success**, 단 실제 JSON/TXT `results/45884082348-1-seat-1.json/.txt` (blob `86a310ecefbe9e7c39f76e91436297dc699203f0` / `528a850e66df6ffaea4faee6f490c26c21df8fbe`)는 **STATE_UNKNOWN / CNN_APPROVED_D1_READ_UNVERIFIED**, `firstFail=ALLOWLISTED_OPERATION`, SQLite opened/보호 hash 불변, D1/API NOT_CHECKED. W06 원담당 범위로 분리; 동일 요청 재실행하지 않는다. #4082 opened+labeled 이중 Run 중 후발 [45884083567](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45884083567)은 skipped.

### Runner 복구와 Native 무인 승인 0/3의 분리

- 기존 S6 #4069은 원본 `UNKNOWN`; 소스/수동 읽기 원장에서 `RECOVERY_REQUIRED`, `failedAt=WATCHDOG_RELEASE_OUTCOME_UNVERIFIED` 확인 이력이 있으며, 새로운 운영 Runner 정상화만으로 **원래 S6 승격 종단 성공/원장 소급 완료로 판단하지 않는다**. S6 총괄이 담당하는 원본 CAS/lease 보존. main 최신 `b08f3a482e9bb39523f47675ae06bc6e02e01d2d`는 신규 S6 시작 전 독립 crash-safe 복구 증명을 요구하는 fail-closed 소스 병합, 기존 운영 설치와 구분.
- **Native Controller B 실측 미승인**: #4080 JSON의 `ciControllerBReceiver.policyState=PRESENT_FORMAT_ONLY`, `approvedV2PinMatches=false`, `approvedReceiptGuardPinMatches=false`, `executionAuthorized=false`, `installedSourceIntegrityAsserted=false`. 이것은 단순 Runner OFFLINE 문제가 아니라 **독립 설치 승인/pin이 실제로 안 맞는 별도 실행 경계**. 임의 GitHub 설정 true/미승인 재설치 금지.
- Native A/Writer Publisher [Run 45890646874](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890646874) 2개 Job 모두 skipped, Controller B [45890736341](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45890736341) skipped. CI opt-in bool의 현재 값은 GitHub 연결에서 조회 불가; skipped를 승인 증명으로 해석하지 않는다.
- 지난 PR #4085/#4086/#4088/#4089의 source-only 3/3 및 main 병합은 유효. 그러나 격리 PC의 `ZGMINI_CI_NATIVE_SCOPE_ROOT`·영구 claim root 및 B-installed proof/업무 원문 실측은 미확인. 원본 Owner-B 정책/영수증 외 다른 파일을 승인 source로 대신 쓰지 않는다.
- 무인 실제 A·Writer B·Controller B **0/3 (0%)** 유지. 운영 Runner 복구를 이 분모에 자동 추가하지 않는다. 새 A/B 요청·CI 재실행·정책 발행·GitHub 변수/파일/DB/Task 변경 **0건**.

### 다음 필수 실행

1. 운영 Runner 재배정은 **회복됨**으로 최신 결과 반영하고 불필요한 Runner 복구/재등록 조사 중단.
2. A·Writer B: 격리 PC native read-only scope + Owner-B installed proof + 저장된 request/approval SHA + 발행 영구 receipt root의 실존/신뢰/원본 readback 확인. 없으면 허위 정책 생성 금지; 해당 효과의 승인 범위/원본이 갖춰진 뒤에만 기존 Workflow 조건을 허용.
3. Controller B: 현재 `approvedV2PinMatches=false`·`approvedReceiptGuardPinMatches=false`의 **설치/원본 정확 SHA 차이**를 승인된 읽기 경로로 구분하고 기존 Owner B 설치/승인 계약으로만 처리. 다른 B 효과와 공유 lease가 실제 충돌할 때만 직렬화.
4. 검증 가능한 효과부터 자연 CI 완료 → exact dispatch/원장 → 운영 A·Writer/Controller B 실행 → 설치 SHA와 JSON/TXT remote 결과를 동일 requestId/effect에 대조. 각 효과 종료 PASS만 실제 1/3 카운트.

## 22. 열여덟 번째 실행 기록 — 운영 A 정책 CAS 실측 및 이전 핀 판정 정정 (2026-11-27 KST)

### 운영 Runner 복구 후 추가 원본 증거
- 기존 총괄의 독립 A #4092 [Run 45896563100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45896563100) `results/pc-process-inventory-45896563100-1-operating.json/.txt`: `READ_ONLY_OBSERVED/S6_ONCE_JOURNAL_PHASE_OBSERVED`, 운영 `zgmini-pc-05`, 원본 claim 존재, journal `RECOVERY_REQUIRED`/`WATCHDOG_RELEASE_OUTCOME_UNVERIFIED`/`S6_PORT_PROMOTION_UNVERIFIED`, `leaseReleaseAcknowledged=true`, `backlogState=RESUMED`, `successEstablished=false`, `originalRequestRetried=false`. Git blob JSON `681976a4681d44f34f831b57bc231b2e507c8a8f`, TXT `9343616c9a498675eef3e1303c0deeacd369cbcd`. Runner 재연결과 S6 과거 승격 완료 구분, 총괄 원본 CAS 복구 권한 보존.
- 운영 복구 뒤 실제 #4080 [Run 45883221676](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45883221676) `PASS/PROCESS_INVENTORY_COLLECTED`: `zgmini-pc-01..06` 6 Online, Supervisor heartbeat/identity 정상, Controller SHA `3c7d4cfefacf072fd35cb19706b352c64c5e4fd2`, 유지보수기 source `5a85f803fd9cb280561395f88a3544ee8e7d4660`, lease 없음, Workflow active. 이 증거는 Native 자동화 B 승인 영수증이 아니다.

### Controller B 설치 승인 진단 오류의 정확한 구분
- 이전 §21에 적힌 `#4080 ciControllerBReceiver.approvedV2PinMatches=false`, `approvedReceiptGuardPinMatches=false`는 **현재 설치 정책의 무효 판정이 아니며**, `tools/pc-process-inventory-readonly.mjs::inspectCiControllerBReceiverReadOnly`에 하드코딩된 **두 과거 설치 버전** `08c0df1c...`/`73f70de9...` 및 당시 Workflow blob을 대상으로 하는 비교값이다. `executionAuthorized=false`는 이 **읽기 전용 응답의 고정 필드**이지 검증된 실제 보안 권한 무효 사건의 리턴이 아니다.
- 앞선 독립 A #4025 [Run 45870801994](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45870801994), 원본 `results/pc-process-inventory-45870801994-1-operating.json/.txt`: `PASS/CI_POLICY_CAS_READONLY_OBSERVED`; 실설치 maintainer `5a85f803fd9cb280561395f88a3544ee8e7d4660`, 설치 manifest SHA256 `0e1903fd9052b1e2c72812fde07c6338a79287e673a4cd9e715dedf23883f589`, workflowId `430972394`, 설치 정책 blob `27e48ecde81bdf6f15cccffcffd9b3e70482a5f3`, enabled shape PASS. 같은 blob은 현재 `main`의 `.github/workflows/ci-approval-controller-b.yml`과 정확 일치하며 승인 명세 `approvals/maintenance-handoffs/5a85f803fd9cb280561395f88a3544ee8e7d4660.json`과도 일치한다.
- 다만 #4025은 S6 #4069 이전이므로 **현재 설치 manifest 바이트 동일성은 미확인**. 사용자 지시 범위의 고정 A [#4100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100), requestId `62d2bc4c-412a-4c56-a943-bdfc0479f019`, operation `process-inventory-readonly`, probe `ci-controller-b-policy-cas-readonly`를 **1회** 발행. [Run 45897081642](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897081642) 등록, 운영 Reader 실제 실행 확인, 최초 조회 당시 `in_progress`; 최종 JSON/TXT·현재 manifest SHA 결과는 아직 반환되지 않았으므로 PASS/FAIL을 만들지 않는다. 중복 요청·재시도 금지.
- 별도 격리 PC 자동 발행 진단 #4029 [Run 45871432737](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45871432737): `CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED`, `ZGMINI_CI_CONTROLLER_B_ENABLED=false`, `policyConfigured=false`, 독립 Owner 업무 허가 미입증. 이는 **현재 검증 가능한 자동 B 발행 차단 범위**로, 설치 정책 CAS PASS와 별개의 효과다. 현 시점 활성화 변수 값 직접 readback은 없으며 과거 결과와 Source skip만 이용해 현재 상태를 단정하지 않는다.
- Native A·Writer B 별도 격리 `ZGMINI_CI_NATIVE_SCOPE_ROOT`/영구 영수증 root의 실제 설치 원본과 독립 B proof readback은 미확인. GitHub `main`의 자동화 Source 병합·CI PASS는 보존하며 별도 새로운 비즈니스 권한/설치 증명을 제조하지 않는다.

### 다음 실제 실행
1. **기존 #4100 Run 45897081642** 완료를 확인해 소진된 A의 JSON/TXT·source SHA·raw manifest SHA와 #4025를 대조하고 변경이면 원본 설치 계약으로만 분기한다.
2. Controller B Publisher: 기존 owner-approved business grant와 정확 GitHub 변수 및 격리 PC 정책 구성의 readback을 공식 승인 경로로 확인, 새 효과/보안 권한을 임의 생성하지 않는다.
3. Native A/Writer B: 격리 PC read-only 정책/설치 proof/claim roots의 실제 preimage가 확보된 뒤에만 독립 실행 권한 평가; 동일 Run 재발행 금지. 각 효과별 자동 CI→단회 발행→Windows 실행→JSON/TXT 결과가 실제로 성립할 때에만 운영 0/3을 올린다.

### #4100 최종 영수증 — S6 이후 설치된 승인 정책 불변 입증

- 단회 [Issue #4100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100) / [Run 45897081642](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897081642) Job `operating-process-snapshot` `completed/success`; 실제 `zgmini-pc-04`, observedAtUtc `2026-11-26T21:19:57.158Z`.
- `results/pc-process-inventory-45897081642-1-operating.json` blob `cd2606983db3726538bb693acdef4f55bad5ee29`, 동일 stem TXT blob `8cbc04bc3657d2310af7d301d64daa76995bbfc7`. 실제 `PASS / CI_POLICY_CAS_READONLY_OBSERVED`, 0 operational writes/retries/provider calls.
- `sourceSha=5a85f803fd9cb280561395f88a3544ee8e7d4660`, `installedManifestSha256=0e1903fd9052b1e2c72812fde07c6338a79287e673a4cd9e715dedf23883f589`, `workflowId=430972394`, `workflowBlobSha=27e48ecde81bdf6f15cccffcffd9b3e70482a5f3`, fixed Workflow path/설치 정책 형식 PASS. 기존 S6 전 [#4025](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4025)의 **동일 4개 값과 현재 설치 정책 manifest SHA까지 정확 일치**. 현재 main Workflow blob과 승인된 #4024 B manifest pin도 일치.
- **검증 결론:** 이 범위에 한해 S6 이후 Controller B 독립 설치 정책을 다시 B로 설치할 필요 없음. `ciControllerBReceiver.approvedV2PinMatches=false`는 구형 두 설치의 비교 필드일 뿐이고 현재 설치 무결성 위반이 아님. `executionAuthorized=false`는 A 읽기 응답 고정값이므로 Publisher에 실제 business grant가 있는지 판단하지 못함.
- [Issue #4100 결론 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100#issuecomment-7203640152) 게시 후 `closed/completed` 확인. 기존 요청을 반복 발행하지 않는다.
- **남은 실제 자동화 범위:** 격리 CI Controller B의 `ZGMINI_CI_CONTROLLER_B_POLICY`와 `ENABLED` 변수는 기존 #4029에서 미구성/비활성이고 현재 재설정 증거 없음. 새 Owner 업무 위임·실제 A/B 후보 승인·본래 business effect가 독립적으로 검증된 경우에만 정규 자동 발행을 할 수 있다. Native A/Writer B의 Owner-B-installed scope/proof root도 현장 확인되지 않았다. **A·Writer B·Controller B 실제 무인 종단 완료율 0/3 유지**. S6 0/1도 과거 journal 원본 보존.

## 23. 열아홉 번째 실행 기록 — Native 격리 PC 고정 A 조회 개선 (2026-11-27 KST)

### 관측 필요성과 기존 완료점

- Native A/Writer B source PR #4085/#4086/#4088/#4089는 정확 CI 및 main 병합 완료. Runner 6/6 정상 복구·공통 A #4080 PASS와 Controller B 정책 CAS #4100 PASS는 별개 실제 증거로 보존. 자동 무인 A·Writer B·Controller B 종단은 **0/3**.
- 격리 PC에 설치된 Native 정책·B-installed proof 및 단회 receipt root의 현재 상태를 읽는 기존 Owner A probe가 없었다. CI의 Native 발행 Job skipped는 실행 조건 불충족만 나타내고 실제 PC 설정/파일 존재를 입증하지 않는다. 읽기 결함을 신뢰된 기존 장비 조회기로 최소 보완.
- 별도 S6 담당자의 [PR #4098](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4098)은 공통 `tools/pc-process-inventory-readonly.mjs`의 S6 원장 3003·3056 부근을 수정 중이나, 아래 Native 수정과 hunk가 겹치지 않는다. 타 담당 파일 변경 보존, 강제 reset/rebase 없음.

### Native A/Writer 독립 로컬 정책 관측 PR #4107

- 신규 브랜치 `codex/ci-native-local-preflight-a-20261127`. [PR #4107](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4107) 최초 HEAD `48fa90d729e5bad1a5de4ce558d85138328bde76`.
- 기존 Owner 인증 고정 A `pc-process-inventory-readonly`의 격리 PC `role=handoff`에 `probe=ci-native-publisher-local-readonly`를 추가. 임의 path/command/추가 Issue 필드 수용 없음.
- `tools/ci-native-publisher-local-readonly.mjs`는 이미 구현된 공식 `createNativePublisherLocalPolicyPorts` 및 `readNativeScope/readNativeInstalledProof`를 재사용한다. Native A 및 Writer B 두 효과에 대해 정책·원문 SHA·별도 proof 형식과 일치성, 설정된 policy/receipt 루트의 분리·심볼릭 링크·임시 경로 차단을 읽기 전용으로 관측한다.
- 결과는 루트 구성/분리 여부, 두 효과의 `CI_NATIVE_LOCAL_*` 고정 상태 코드와 불리언, Native publisher/execution flag의 ENABLED/DISABLED/UNSET_OR_INVALID 값만 포함. 실제 경로·환경변수 원문·승인 JSON/base64 bytes·secret·실행 인증정보는 반환하지 않는다.
- **이 읽기 진단은 독립 GitHub B 설치 영수증을 확인하지 않음.** `independentGitHubInstallationReceiptVerified=false`, `canPublish/canExecute/canInstall=false` 고정. 실제 발행·설치·승인 효과 없음.
- 변경 4파일: 기존 `.github/workflows/pc-process-inventory-readonly.yml`, `tools/pc-process-inventory-readonly.mjs`, 신규 `tools/ci-native-publisher-local-readonly.mjs`, `tests/ci-native-publisher-local-readonly.test.mjs`. 배정된 Runner/업무 스키마/DB/D1/운영 설정/Native 수신기는 불변.
- 테스트: 정상 2효과·루트 누락/불신·scope/proof 누락·승인 바이트 변조·비활성 정책·Owner/role/입력 범위·TXT/JSON 기밀 redaction 및 기존 발행 gate 유지.
- 정확 HEAD CI [Process Source 45897985942](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897985942), [C996 45897985931](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897985931), [Secret 45897985992](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897985992). 최초 조회 queued 3건으로 병합 전; 이전 HEAD 성공 재사용 금지.

### 다음 필수 실행

1. #4107 정확 HEAD CI 실제 결과 회수, 관련 시험 실패면 최소 수정 후 재검증. 3/3 성공 시 최신 main 및 동시 작업 원문 보존해 병합·변경 blob 확인.
2. 기존 정규 Owner A로 격리 PC fixed probe 1회 Issue→실행→JSON/TXT 원본 readback, 현재 Native 설정과 설치된 파일의 존재·동등성 대조. 중복 Job 생성 금지.
3. 별도 검증된 B 승인 원본·독립 설치 영수증·원자 단회 receipt 및 실제 Owner 범위가 정확히 갖춰진 효과만 자동 CI 발행/PC 실행으로 연결. 현행 운영 종단 0/3 유지; 새 보안 권한/승인 원본/설치 파일을 진단 결과로 자동 생성하지 않는다.

## 24. 스무 번째 실행 기록 — #4107 병합 및 격리 PC 실제 Native 설치 경로 판정 (2026-11-27 KST)

### 정확 HEAD 소스·CI 통합

- [PR #4107](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4107) 최종 HEAD `48fa90d729e5bad1a5de4ce558d85138328bde76`: 세 개의 실제 GitHub Actions Run이 같은 `head_sha`에서 `completed/success`인 것을 확인.
  - [C996 Run 45897985931](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897985931) SUCCESS
  - [Process Source Run 45897985942](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897985942) SUCCESS (기존 고정 A 검증 및 신규 Native 격리 정책 진단 회귀시험 포함)
  - [Secret Scan Run 45897985992](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45897985992) SUCCESS.
- 정규 squash **main 병합 `524dd05f42fa921ff80a09b2a9a65d4ee729b99e`**. PR closed/merged·main HEAD 및 4개 파일 Git blob readback 완료:
  - `.github/workflows/pc-process-inventory-readonly.yml` `cec9d983dec0bcc816ada5f063a8aa21315cce50`
  - `tools/ci-native-publisher-local-readonly.mjs` `c77c0f58d78827634a8e66a3181e1f5e332168ee`
  - `tools/pc-process-inventory-readonly.mjs` `4340c884dd3ca1e0c06b3ba8031a695ad5c4c88a`
  - `tests/ci-native-publisher-local-readonly.test.mjs` `0795f629dd1775e85bb5c8c75cbafb059ab9415`.
- 동시 S6 Watchdog #4095 main 변경 및 별도 S6 조회 #4098 작업 보존. 기존 Writer/Controller 코드·정책/DB/설치 파일/실제 GitHub vars 변경 없음.

### 운영 격리 PC 단회 A 실측 — #4113

- [Issue #4113](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4113), 인증된 기존 `process-inventory-readonly`, `role=handoff`, 고정 `probe=ci-native-publisher-local-readonly`, requestId `4f9a148f-674d-4b35-a60e-2f1da75b15bd` **1회 생성**.
- 실제 [Run 45898829611](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45898829611) source HEAD `b441848f5295484b34e1141b8471e57cdb1be865`에서 격리 `zgmini-handoff-ci-spare-01` Job 140179327278 실행. 관측 `2026-11-26T21:33:18.936Z`.
- 원격 **2/2 원본 readback**: `results/pc-process-inventory-45898829611-1-handoff.json` blob `b2dda9cf0fc370f4ba92993d7a70cfee53f50e8f`, 대응 TXT blob `801ce188e9fe14d029a23fa41b6c8af91ab17b4e`. 해당 고유 Issue 댓글 [7203838960](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4113#issuecomment-7203838960)이 동일 result stem을 확인함.
- 실제 Native 관측 `READ_ONLY_OBSERVED / CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED`:
  - `scopeRootConfigured=false`, `receiptRootConfigured=false`, `independentRootsVerified=false`.
  - Publisher A/Writer B, execution A/Writer B 4개 opt-in 모두 `UNSET_OR_INVALID`.
  - A와 Writer B의 `scopeFormatObserved=false`, `installedProofFormatObserved=false`, `policyBytesMatched=false`; 이들은 **Root 미설정으로 아직 관측하지 않은 상태**이지 파일 손상을 입증한 값이 아님.
  - `independentGitHubInstallationReceiptVerified=false`, `canPublish/canExecute/canInstall=false`, `operationalWrites=0`, 재시도 0. 실효과 실행/새 승인 없음.
- Workflow는 `completed/failure`이며 Job의 `Collect read-only runtime process snapshot on isolated handoff PC`가 `failure`. 로그 `PROCESS_INVENTORY_VERIFIED role=handoff status=READ_ONLY_OBSERVED code=CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED` 이후 `exit code 2`. 원본/댓글 업로드 실패가 아니라 기존 `tools/pc-process-inventory-readonly.mjs`의 `status !== 'PASS'`이면 2로 fail-closed하는 계약의 정상 차단 동작. 안전 검사 완화나 가짜 PASS 처리하지 않음.
- 해당 A 진단 고유 결과 및 차단 범위를 [#4113 판정 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4113#issuecomment-7203853496)에 기록하고, 읽기 진단 Issue #4113을 **closed/completed**. 실제 자동화 승인 활성화가 완료된 것으로 표시하지 않음.

### 남은 실행

1. 격리 PC Native read-only scope 정책/독립 B-installed proof, 영구 단회 receipt root는 현재 Workflow 환경에서 모두 **미설정**. 기존 Owner 업무 승인 원본과 정확한 B 설치 proof 및 격리 PC 실제 Root/ACL preimage가 따로 증명되는지 확인하고, 기존 정규 설치/설정 변경 권한이 있는 범위에 한해서만 연결. 신뢰 root나 승인 원본을 GitHub Source fixture, 타 효과 영수증, CI 성공만으로 생성하지 않는다.
2. 실제 설정이 검증된 효과만 **Native A / Writer B** 자연 CI → 단회 발행 → 정규 Windows Receiver 실행 및 원본 JSON/TXT 확인. Controller B는 독립 #4100 CAS PASS를 유지하되 자동 발행 정책(#4029 미구성 당시)과 업무 Owner proof는 별도 검증.
3. 현재 Native/Controller B 실제 무인 종단 **0/3**. Runner 6/6 복구와 원래 S6 과거 UNKNOWN을 분리 유지. 이번 소스 CI/고정 A 발행 성공을 3개 무인 효과로 계산하지 않는다.

### Controller B 별도 현재 활성화 상태 — 중복 금지 대기 요청

- Native A/Writer B의 격리 Root 미설정과 **다른 효과**인 Controller B 자동 발행 상태를 구분하기 위해 기존 고정 Owner A `role=handoff`, `probe=ci-controller-b-activation-readonly` 단회 [Issue #4117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117)를 requestId `b0d6a8ce-c503-4651-b21c-7c830ce38c51`로 1회 접수.
- 등록된 [Run 45899164961](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45899164961)의 `handoff-process-snapshot`은 마지막 확인 시 `queued`/미배정, 원격 결과 댓글 0. 기존 #4029의 과거 `CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED`를 **현재 설정의 직접 증거로 재사용하지 않음**.
- 이 Job이 실제 PC에서 완료되면 같은 Issue의 고유 JSON/TXT와 실제 상태코드를 읽고, Controller B의 현재 변수/업무 정책 상태만 판정한다. 같은 진단 이슈 반복 발행·CI 강제 재시도·활성화 변수 임의 설정 금지.

## 25. 스물한 번째 실행 기록 — Controller B 격리 변수 현재 로그 및 A ref 충돌 (2026-11-27 KST)

### 정확한 현장 관측 — #4117

- [Issue #4117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117) 고유 requestId `b0d6a8ce-c503-4651-b21c-7c830ce38c51`, `role=handoff`, `probe=ci-controller-b-activation-readonly`; 기존 단회 A read-only 요청 1회만 등록. [Run 45899164961](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45899164961), Job `140180412269`, checkout/setup-node 성공 후 **`completed/failure`**.
- GitHub Actions 실제 해당 격리 Job 로그: `ZGMINI_CI_CONTROLLER_B_ENABLED=false`, `ZGMINI_CI_CONTROLLER_B_POLICY` 값은 **빈 문자열**. 과거 #4029 결과를 소급 재사용하지 않고 실제 현재 실행의 설정 제공값을 확인. 값 자체에 비밀 원문/승인 데이터는 없음. 현재 정책 검사 `tools/ci-controller-b-activation-readonly.mjs` 기준 예상 진단은 `CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED`이나, **정규 결과 JSON/TXT 미확보로 A 읽기 PASS 판정하지 않음**.
- 원격 결과 실패는 `RESULT_PAIR_REF_CONFLICT_UNTOUCHED`, 종료코드 1. 코드 `writer-config-b/result-pair-atomic.mjs`의 비강제 main ref/CAS, 변경 HEAD·목적지 비존재를 검사한 bounded 1회 조건부 새 커밋 경로에서도 성공 확인되지 않아 fail-closed. **두 대상 경로 `results/pc-process-inventory-45899164961-1-handoff.json/.txt` 모두 GitHub contents 404**. 댓글 인증 영수증도 0.
- 해당 오류는 Controller B 비즈니스 승인이 거부된 코드가 아니라, **업로드 CAS/영수증 생성 실패**. 정확 경쟁 시각 및 어떤 CAS 분기 실패인지는 미입증. 뒤이어 같은 요청의 새 Issue/Run을 만들거나 Writer 안전 검사를 제거하지 않는다. 기존 정상 #4100 설치 정책 CAS와도 별개.
- 원인/미완료 범위를 [#4117 실행 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117#issuecomment-7203943021)에 기록. #4117은 원격 2/2 영수증이 없는 동안 열린 상태 유지; 실제 진단 완료로 잘못 종료하지 않는다.

### Native A·Writer B와 Controller B의 남은 운영 경계

- [#4113 Native A/Writer 격리 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4113) 원본 readback 2/2 `CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED`: 읽기 전용 Owner-B 설치 scope root, 영구 claim receipt root 변수 미설정, A/Writer 두 Publisher/Executor flag 모두 `UNSET_OR_INVALID`. 정책/증명 내용 자체는 **미관측**.
- Controller B는 **별도 설정이 명시적으로 비활성 `false`, business policy 변수 빈 값**. 기존 설치된 유지보수기 정책 #4100의 CAS/Workflow blob PASS는 유지하고, 자동 Publisher grant 또는 사용자의 실제 Owner 업무 승인과 구분. 소스 CI/병합을 정책 활성화 증거로 대체 불가.
- GitHub repository Actions variables의 직접 현재 관리자 조회는 연결된 GitHub 도구가 API `actions/variables`를 거부. 주어진 도구에서 현재 실제 설정을 변경할 정규 GitHub Actions 변수 API도 제공되지 않음. 별도 인증된 B 설치 proof/Owner grant 및 승인된 설정 경로 확인 전 `enabled=true`/임의 정책 파일 쓰기/보안 해제/자동 승인 생성 금지.
- 실제 무인 종단 **A·Writer B·Controller B = 0/3** 그대로. 금회 PC 운영 파일/DB/Task/보안 값 변경·추가 업무 실행 효과 0. 공통 Runner와 Native 소스 재개선 불필요.

### 다음 필요한 실제 행동

1. A/Writer: 기설치 B-native Owner scope/proof 원본·영수증의 존재/업무 승인 범위를 확인하고, **신규 권한 생성 없이** 독립 루트 설정을 기존 승인된 운영 경로로 연결할 수 있는지 판정. 현재 원본은 미관측이므로 실효과 없는 경로 플래그만 설정하는 작업 금지.
2. Controller B: 기존 승인 업무 grant의 정확한 정책 JSON 및 Installed Receiver pin과 현재 GitHub 자동 발행 Policy 변수의 **빈 값**을 구분. 실효과와 업무 원본이 명확한 경우에만 정규 설정 경로로 정확 등록; 비슷한 서류/CI PASS로 grant 허위 생성 금지.
3. 세 효과 중 승인·실제 설치·정규 CI 권한이 완전히 입증된 것부터 실제 workflow_run → 단회 dispatch → 운영 PC 수신·효과 적용 → 결과 JSON/TXT 및 설치 SHA readback으로 효과별 DONE을 판정. #4117은 업로드 실패의 고유 증거를 보존하고 **확실한 환경 변화 없이 동일 PC A를 재발행하지 않음**.

## 26. 스물두 번째 실행 기록 — 검증된 두 번째 Git ref 경합에서 결과 쌍 보존 (2026-11-27 KST)

### 현재 운영 상태 및 결과 업로드 실패 조건

- [#4117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117) [Run 45899164961](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45899164961) 고정 Controller B handoff A는 조회 PC에 제공된 `ZGMINI_CI_CONTROLLER_B_ENABLED=false`, `ZGMINI_CI_CONTROLLER_B_POLICY` 빈 값을 job 로그로 확인. 그러나 `RESULT_PAIR_REF_CONFLICT_UNTOUCHED`로 JSON/TXT 결과가 main에 0/2, Issue readback 미완료. 기존 A 영수증 PASS 또는 실제 Controller B 실효과 승인/실행으로 계산하지 않는다.
- Git main에서 결과 업로더 오류 2026-11-26 21:38:07 UTC 전, 21:37:52/54 및 21:38:00/02 UTC에 정상 결과 보고 커밋 `952dbfd`, `bbc1e52`, `5c5baac`, `66dd011` 4건 연속 반영 확인. 경쟁적인 head 이동 가설에 실증 근거는 있지만 정확 어떤 PATCH 반환 분기에서 첫/두 번째 422가 발생했는지는 당시 로그에 없으므로 **운영 원인 확정 아님**.
- `writer-config-b/result-pair-atomic.mjs` 원본은 처음 422 때만 후손 HEAD 증명/목적지 JSON/TXT 미존재를 검사한 뒤 ref rebuild 1회 허용. 재검증된 **두 번째 서로 다른 HEAD 이동**에는 재구성 경로가 없어 422 반환 시 최종 `RESULT_PAIR_REF_CONFLICT_UNTOUCHED`. 이 부분은 소스에서 안전하게 구별·재현 가능.

### 최소 소스 변경 PR #4126

- 별도 브랜치 `codex/ci-proof-pair-double-cas-20261127`; [PR #4126](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4126), 최초 정확 HEAD `7c4dde3ff0e472f96a4b356804dd617de898996d`.
- **변경 3개:** `writer-config-b/result-pair-atomic.mjs`, 동일 `result-pair-test-fixture.mjs` 및 `result-pair-atomic.test.mjs`. 운영 파일·PC 설치·DB·보안변수·승인 Owner/effect 비변경. Shared 결과 업로더 기존 JSON/TXT 스키마·소스 계약·non-force CAS·단회 requestId·보호 원장 유지.
- **증거에 따른 추가 1회만:** 첫 번째와 두 번째 각각 이전 기준 SHA보다 새로운 Git `main` HEAD가 확실한 후손 `compare.status=ahead`이고 대상 두 경로가 둘 다 404인 것을 재검증하면 같은 결과 쌍을 신규 base tree/commit으로 재구성. 최대 3번의 non-force PATCH. 같은 HEAD에서 다시 422·비후손·기존 목적지·증명 실패·PATCH 결과 불명/네트워크 오류는 즉시 fail-closed, 응답 불명 시 읽기 전용 reconcile만 수행. A/B 업무 작업 자체는 재실행하지 않는다.
- 회귀 추가: **2회의 독립 HEAD 이동 → JSON/TXT 2/2 readback**, **두 번째 이동 시 하나라도 기존 파일 → 작성 0**, **세 번째 확정 ref 거절 → 재구성 없이 종료**. 기존 `same HEAD 422`에서 두 번만 PATCH, lost PATCH/중복 파일/비후손/권한 오류 계약 보존.
- 정확 HEAD CI: [Secret Scan 45900597757](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45900597757) **completed/success**, [C996 45900597687](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45900597687) `queued`, [Process Source 45900597719](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45900597719) `queued` (최초 관측). CI 결과 전 main 병합/운영 적용 없음.
- [#4117 보완 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117#issuecomment-7204098323)에 독립적인 경합 증거·source PR·과거 영수증 미복구 경계를 연결. 동일 Issue 재실행 또는 기존 결과 바이트 재구성 금지.

### 남은 정규 필수 실행

1. 정확 HEAD의 Process Source/C996 결과 회수 → 검증 성공 시 타 담당자 main 변경을 보존하여 PR 병합·Git blob 확인, 실패 시 해당 source 원인만 최소 수정.
2. 새로운 소스 CI PASS를 기존 #4117 영수증 복구로 오인하지 않는다. 그 고유 원본은 불명/미발행 유지. 새 승인·변수/정책 root 생성/설치 없이 독립 원본 존재를 추가 읽기.
3. Native A/Writer B의 격리 PC 루트·Publisher/Executor 플래그 미설정(#4113)과 Controller B policy empty/flag false(#4117)를 별도 보존. 승인된 독립 policy root/업무 Owner grant 및 실제 적용 명세가 확인된 범위에서만 정규 활성화·실효과 종단 검증. **무인 A/Writer B/Controller B 0/3** 유지.

### #4126 동시 소스 PR 경합 정리 — #4125 선병합 확인

- 동일한 공유 결과 업로더 3파일을 다른 담당자가 먼저 [PR #4125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4125)로 검증·병합. 원본 PR 최종 HEAD `e23880d6714bfb474431a50696b7181174f861b7`, 정확 3 CI **SUCCESS**: [Secret 45900499978](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45900499978), [Process Source 45900499948](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45900499948), [C996 45900500055](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45900500055). 병합 `main=2022e2270690d83bbabda9196abcf7bc38ceeaf6`, `writer-config-b/result-pair-atomic.mjs` Git blob `1b89a7232d931ad8d6b185ca67f941fada16e6f7`.
- 해당 구현도 최초 422 후 매번 최신 SHA가 검증된 후손 `ahead`인 경우에만 재구성하며 두 결과 경로 404·non-force CAS·응답 불명 시 읽기만·기존 경로 보존을 유지한다. 소스의 `MAX_PROVEN_REBASES=3`은 우리 PR #4126의 2회보다 **기존 범위에서 추가 1회** 더 수용하지만, 횟수가 유한하고 매번 독립 조건을 확인한다. PR #4125의 시험과 exact head CI 3/3은 이미 운영 전 source 검증으로 유효.
- 우리 [PR #4126](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4126)은 최신 main과 `dirty` 충돌임을 확인해 무리한 동기화·소스 덮어쓰기/중복 병합 대신 [superseded 판정 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4126#issuecomment-7204145981)을 게시한 뒤 **closed/unmerged** 확인. 전용 브랜치 기록은 보존. 위 §26의 #4126 `queued` 상태는 최초 관측 기록이며 현재 정본은 #4125 main 구현.
- 해당 source fix는 #4117 과거 `RESULT_PAIR_REF_CONFLICT_UNTOUCHED` 결과 0/2를 소급 복원하지 않으며, 현재 Native A/Writer B root·플래그 미설정과 Controller B `false/empty` 업무 승인 미구성도 해소하지 않는다. 사용자 C급/보안 변경 추가 승인 없이 정책·변수를 작성·활성화하지 않는다. **실제 무인 종단 A·Writer B·Controller B 0/3** 유지.
- 다음 필수 실행: 기존 #4117 결과 미확정 보존 및 새로운 정규 승인 업무의 정확 소스/업무 원본과 독립 Owner B installed policy/proof readback. 기설치 승인·보안설정 범위가 실제로 입증된 효과부터 정규 workflow_run → 영구 단회 dispatch → PC 실행 → JSON/TXT 효과 원본을 확인. 미확인 효과를 다른 운영 프로세스의 복구 대기로 확대하지 않음.

## 27. 스물세 번째 실행 기록 — 승인 근거 경로와 실제 자동 발행 구현의 불일치 확인 (2026-11-27 KST)

### 원본 readback — Source PASS와 업무 승인 미연결 구분

- 담당 브랜치 시작 HEAD `a6677ef9f0266d99f2db921e4e9f1321c5e12d97` 및 계획 §26을 계승. [PR #4125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4125) 병합 `2022e2270690d83bbabda9196abcf7bc38ceeaf6`은 기존 결과 업로더의 source-only 수정이며 과거 [#4117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117)의 JSON/TXT 0/2를 복원하지 않는다. 원본 #4117 OPEN/결과 미발행 보존, 재실행 0.
- Native A/Writer B 실측 [#4113](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4113) `CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED`는 독립 scope/receipt root, 4개 플래그의 미설정 증거이며 그 안의 승인 원본 파일이 존재하지 않는다고 단정하지 않는다.
- Controller B 현장 [#4117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117) 로그는 `ZGMINI_CI_CONTROLLER_B_ENABLED=false`, `ZGMINI_CI_CONTROLLER_B_POLICY` 빈 값. 설치된 Receiver 정책 CAS [#4100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100) PASS와 구별. 설정 false/empty를 원본 승인 부재 또는 설치 실패로 치환하지 않는다.
- [#4038](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4038)은 `closed/not_planned`. 단일 Owner-native 수동 JSON 댓글을 기존 자동화의 필수 신규 Gate로 요구하지 않는다는 정정 댓글을 확인했다. 이를 재개하거나 사용자에게 수동 댓글을 요구하지 않는다. 다만 이 종결 자체가 운영 Publisher에게 신뢰 권한을 부여하지도 않는다.
- **현 소스에서 실질 조건 불일치 확인:** `ci-approval/completed-run-intake.mjs`의 `createAutoApprovalContextReader`, `createConfiguredSelectivePreparer`는 `policy.delegationPin`의 issue/comment/body SHA를 필수로 요구하고; `ci-approval/controller-candidate-review.mjs::prepareSelectiveApprovalPublication`은 `collectDelegatedScope`로 수동 Owner 출처·활성 Issue 및 시간/바이트를 대조한다. `tools/maintenance-request.mjs`의 자동 Controller B 제출은 `ctx.delegation` 없이 진행하지 않는다. **이것은 현 파일럿 경로의 소스 요구조건이지 기존 사용자 승인 A/B 전체의 유일하게 적법한 증명 방식이라는 뜻이 아니다.** 검사를 삭제하거나 CI/앱 댓글을 Owner로 위장하는 수정은 금지한다.
- [#4036](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4036)은 `SUCCEEDED / APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, 실제 Controller `3c7d4cfefacf072fd35cb19706b352c64c5e4fd2`, JSON/TXT 발행이 확인된 **기존 수동 승인 운영 설치**다. 이 효과에 신규 CI 자동 발행 Issue를 제출하면 중복 실행 위험이 있으므로 최초 무인 실증에 사용하지 않는다.

### 후속 필수 실행 순서

1. **P1 소스 연결 최소 보완:** 기존 운영 Owner 승인·독립 설치 영수증·정확한 B manifest/업무 범위를 보호된 원본 바이트로 대조할 수 있는 경로가 있는지 확인한다. 기존 `delegationPin`만 강제하는 파일럿 경로와 별도로, 기존 수신기의 실제 인증/승인 증명을 그대로 충족하는 최소 구현이 가능할 때만 해당 코드와 범위별 거절 회귀를 추가한다. 검증 없이 위임 검사를 생략하지 않는다.
2. Native A/Writer B는 기존 승인된 B-installed proof와 독립 scope/receipt root의 운영 실체·Owner 범위가 확보된 효과부터 정규 설정 연결을 검증한다. 단순 `ENABLED=true` 또는 빈 root 생성으로 해결하지 않는다.
3. Controller B는 현재 설치된 정책 CAS PASS를 재사용한다. 새 **이미 승인된 미실행 업무**와 독립 업무 승인 원본, 정규 Publisher 인증·영구 receipt root가 검증될 때에만 정확 설정을 반영하고 자연 CI→단회 발행→독립 유지보수기 실행→JSON/TXT·SHA readback을 수행한다. #4036/#4117 재발행 금지.
4. 세 효과 모두 승인·발행·실제 실행이 관측된 경우에만 실운영 분자를 증가시킨다. 현시점 **실제 CI 무인 종단 0/3 (0%)**. 신규 PC 운영 쓰기/보안 설정 변경/Runner 재설치/새 예약 0.

**판정:** 진단으로 추가된 것은 특정 파일럿의 승인 증명 구현과 사용자 결정의 불일치다. 소스 교정·운영 설정 연결·신규 무인 실증은 각각 미완료이며, 현재 확인된 정보만으로 임의 정책을 발행하지 않는다.

## 28. 스물네 번째 실행 기록 — 기존 Owner 병합 승인 경로 재확인 및 불필요한 소스 교정 제외 (2026-11-27 KST)

### 실제 소스·테스트 경로 재확인 — §27의 과대 분류 정정

- §27의 "`delegationPin` 요구"는 **CI가 스스로 승인 PR을 생성/병합한 경로**에만 해당한다. 이를 Controller B 자동화 전체 또는 기존 Owner 승인 B 요청의 공통 필수조건으로 표현한 것은 범위가 지나쳤다.
- 현재 `tools/maintenance-request.mjs::submitExistingControllerApprovalFromCi`는 실제 승인 PR의 `merged_by`가 Owner로 확인되는 경우, `resolveControllerApprovalCI`를 사용해 기존 승인 source CI·정확 manifest·병합 provenance를 검증하고 **수동 Owner-native 위임 댓글/인증 pin 없이** 기존 요청 제출 경로로 진행한다. bot-merged approval PR은 별도 `readAutoApprovalContext`와 독립 `delegationPin` 검증을 유지한다. **이 구분은 신규 권한 우회가 아니다.**
- `tests/maintenance-request.test.mjs`의 `workloadPublisherFixture` 및 첫 `CI publisher creates exact existing B request once` 테스트는 Owner-merged PR을 사용하고 `readAutoApprovalContext` 없이 `REQUEST_READBACK_VERIFIED`·단회 등록·동일 효과 `EXISTING_REQUEST_REUSED`를 검사한다. 이미 유효한 테스트이므로 새로운 동등 테스트/소스 변경을 만들지 않는다.
- [#4038](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4038)의 수동 Owner 댓글 필수화 철회는 이 기존 Owner-merged 경로와 양립한다. bot-merged 경로의 독립 승인 검사를 단지 불편하다는 이유로 삭제하지 않는다.
- [#4036](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4036) B는 이미 `SUCCEEDED`/원격 JSON·TXT 완료되어 **새 CI 무인 발행 실증으로 재사용하지 않는다**. 최신 [PR #4130](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4130)은 **Writer B 승인 명세 source-only `main` 병합**이다. 원본 R2 설치 경로·Owner·운영 lease는 원담당 범위에 남으며, 해당 PR 병합을 CI native Writer B 발행/설치 PASS로 계산하지 않는다.

### 현재 실제 미연결과 다음 단계

1. **Native A/Writer B:** 이미 완료된 [#4113](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4113) 실제 격리 조회에서 scope/receipt root 모두 미설정, 4개 opt-in 플래그 모두 유효한 활성값 없음. 설치된 독립 B receipt/승인 request·approval 원본은 루트가 없어 미관측. 먼저 **기존 인가된 설치 원본·proof가 있는지** 정규 경로에서 확인하고, 증명 없는 policy 파일 생성이나 단순 `true` 변경을 하지 않는다.
2. **Controller B:** [#4100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100) 현 설치 Receiver 정책 CAS PASS 재사용. [#4117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117)의 독립 격리 환경은 `ENABLED=false`, 정책 empty (Job 로그 관측), 고유 JSON/TXT는 ref 경합으로 미발행. 기존 [#4125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4125) source 수정 병합은 이 원본 결과를 소급 완료하지 않는다. 새로운 기존 승인·미실행 비즈니스 효과, 정규 CI Publisher 인증 및 독립 영구 영수증 root가 있는 경우에만 전용 변경/활성화 범위를 판단한다.
3. **작업 선택 수정:** 이미 존재하는 Owner-merged 승인 검증 코드를 재작성하는 PR은 생성하지 않는다. 신규 CI 승인/설치/보안 권한 없이 원본이 미충족된 경우에는 그 효과에만 `AUTOMATION_BLOCKED`를 적용하고, 다른 승인 업무를 중지시키지 않는다. Owner-native 댓글 #4038의 재개, #4036/#4117 재실행, 기존 GitHub 예약 변경 금지.

**현행 실제 무인 CI→발행→PC 효과→원격 영수증: A/Writer B/Controller B 0/3 (0%).** 이번 실행은 소스 경로 판별과 원장 정정이며 운영 변수·보안 설정·업무 파일/DB/D1/Task·요청 중복 생성 0건.

## 29. 스물다섯 번째 실행 기록 — 기존 Owner 병합 Controller B 진단 범위 최소 수정 (2026-11-27 KST)

- 직접 소스 재확인: `.github/workflows/ci-approval-controller-b.yml`에서 기존 Owner-merged 승인 `push` 이벤트는 `ENABLED=true`를 요구하지만 별도 `ZGMINI_CI_CONTROLLER_B_POLICY` 내용은 필수 조건이 아님. 그 변수는 `workflow_run` 자동 생성 승인 PR 경로에서 별도로 검사한다. `ci-approval/completed-run-intake.mjs`는 `push`의 기존 승인 readback 분기를 갖고 `tools/maintenance-request.mjs`는 `ownerMerged` 출처와 bot-merged 출처를 분리한다. 따라서 §27의 무차별 `delegationPin` 차단 판단을 §28에서 바로잡았다.
- 실제 표시 결함: 기존 고정 A `ci-controller-b-activation-readonly`가 `CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED`만 보고할 때 `push` 기존 Owner 승인 효과의 POLICY 비필수성을 표현하지 못해 외부 의사결정이 불필요한 수동 댓글/새 정책을 요구할 수 있다.
- 기준 main `4ecf6e51c1d81f4c63dbf00c912f751aa9ac4da0`에서 별도 전용 소스 브랜치 `codex/pc-automation-process-improvement-20261119-b-push-policy-20261127`를 생성하고 [PR #4136](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4136), HEAD `a220a19de81cb60b87518d90866fe14f4d4ed861`을 발행. 수정 **2파일**: `tools/ci-controller-b-activation-readonly.mjs`, `tests/ci-controller-b-activation-readonly.test.mjs`.
- 읽기 결과에 고정 비민감 필드 `ownerMergedExistingApprovalPolicyRequired=false`, `ciGeneratedApprovalPolicyRequired=true`, `ownerMergedExistingSubmissionVerified=false`를 추가하고, 실제 Workflow 이벤트 분기와 Owner 승인 제출 소스에 묶인 회귀를 등록. 기존 `status/code`·보안 검증·root/flag·읽기 전용/미승인 필드 불변, PC 실행·운영 설정 변경 0.
- PR의 첫 Actions 조회 시 `ZGMINI PC Secret Scan` Run `45902012331` 및 `ZGMINI Two-PC Process Inventory Readonly` Run `45902012288` 둘 다 `queued`; **source CI PASS/병합·실PC 검증 미주장**. 정확 HEAD와 해당 파일을 실제 검사하는 CI의 완료 결과를 확인한 뒤 소스 병합 여부를 판단한다.
- 다른 효과: Native A/Writer B #4113 root 미설정과 Controller B #4117 ENABLED=false·empty 정책, #4100 Receiver CAS PASS는 각각 유지. `#4036`은 기존 완료된 B, `#4130`은 Writer B 명세 병합이고 새 자동 종단 영수증이 아니다. #4117 원본 0/2 및 #4125 소스 수정 구분 유지.
- **운영 자동 승인 실제 종단 0/3 (0%)**, CI 변수/권한/로그인/운영 PC·DB·D1/Task/승인 원본·기존 Issue 재실행 0.

**다음 필수 단계:** #4136의 정확 HEAD 검사 완료 → 안전한 소스 PR 병합(가능한 경우) → 기존 독립 설치 증명과 정확 Owner 승인 대상이 갖춰진 효과만 정규 발행 검토. 활성화는 이 PR의 자동 효과가 아니다.

### #4136 정확 HEAD CI 3/3 및 main 병합 확정

- [PR #4136](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4136) 최종 HEAD `a220a19de81cb60b87518d90866fe14f4d4ed861` 정확 일치:
  - [Secret Scan 45902012331](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45902012331): `completed/success`.
  - [C996 45902012311](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45902012311): `completed/success`.
  - [Two-PC Process Source 45902012288](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45902012288): `completed/success`; 해당 `process-source-tests` Job `140189790556`의 **Controller B policy read-only/redaction 회귀 스텝 성공** 포함. 나머지 Issue-only snapshot Job의 skipped는 이 PR의 소스시험 실패가 아니다.
- 정규 squash **`main` 병합 SHA `2a3344afd3e36fd797162620a49596cb1bfc44cc`**: PR `merged=true`, 최신 main 일치 재조회 확인.
- 정확 2파일 Git blob 원격 readback:
  - `tools/ci-controller-b-activation-readonly.mjs` — `6e9160954f055786bffba9b558362ddb1e34f52d`
  - `tests/ci-controller-b-activation-readonly.test.mjs` — `0464e1039672a838f84e8e29bd9bbedc8005f3bb`
- 기존 `CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED` 상태 코드는 유지했으나 Owner-merged 기존 명세의 POLICY 비필수성 및 신규 CI 생성 승인 경로 POLICY 필수성을 **고정 비민감 필드로 분리**. 이 소스 정정은 자동 승인 활성화/업무 설치나 #4117 원본 JSON/TXT 복원 증거가 아니다.
- 운영 승인·GitHub variables·독립 scope/receipt roots·기존 maintenance 정책·PC 데이터/DB/D1/Task·예약 변경 **0건**. **무인 자동화 실제 효과 A/Writer B/Controller B 0/3(0%)**, 신규 요청 중복 0.
- 다음 직접 필수 실행은 효과별 **실제 B-installed 독립 정책/업무 원본·영구 claim root 확인**과 기존 허가된 실행 연결이다. Controller B는 이 수정을 이유로 수동 Owner 댓글을 새로 요구하거나 정책 변수를 강제 생성하지 않는다. 활성화 권한은 source-only PR과 별개.

### #4138 실제 격리 PC 신규 읽기 증거 및 라벨 오류 정정

- [Issue #4138](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4138) 새 고유 `process-inventory-readonly` handoff A (`requestId=a220a19d-e81c-4b60-b875-18d90866fe14`)는 PR #4136의 새 소스·기존 #4125 원격 결과 저장 구현이 main에 병합된 후 등록. 과거 #4117 동일 고유 요청 재실행이 아님.
- 정규 [Run 45902346176](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45902346176) `handoff-process-snapshot`, 격리 `DESKTOP-N62L0NG`/`zgmini-handoff-ci-spare-01`; 원격 `results/pc-process-inventory-45902346176-1-handoff.json` Git blob `e69e150e94120b91aa841fa5be850f3d98dc5635` 및 동명 TXT blob `d3a04f071ec16e7add91b2bc010b8ca8d416f8eb` **2/2 readback**. 2026-11-26T22:05:17.143Z 관측.
- 실제 응답 `PARTIAL/CI_CONTROLLER_B_AUTO_POLICY_NOT_CONFIGURED`: `variableEnabledVerified=true` (false 구성 확인), `policyConfigured=false`, `ownerMergedExistingApprovalPolicyRequired=false`, `ciGeneratedApprovalPolicyRequired=true`, `ownerMergedExistingSubmissionVerified=false`; `activationAuthorized=false`, operationalWrites/retries/provider/D1 모두 0. Workflow Job `completed/failure`는 PARTIAL 상태 시 기존 읽기 runner가 nonzero 종료하는 계약으로, **JSON/TXT 2/2 업로드 실패나 운영 B 실패가 아님**. 이 신규 영수증은 #4117 과거 결과 0/2를 소급 복원하지 않는다.
- **요청 생성 단계에서 제 책임인 범위 오류:** #4138에 불필요한 `pc-job` 라벨을 붙여 범용 [Run 45902346031](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45902346031)도 동시에 트리거. 이 요청은 정상적으로 `BLOCKED/REQUEST_FIELDS`(다른 스키마)로 거절됐고 operationalWrites 0. 해당 라벨을 곧바로 제거. 고정 process-inventory 워크플로는 **title·body로 접수하며 pc-job 라벨이 필요 없음**. 이후 같은 종류 요청에 라벨을 추가하지 않는다. 스키마 안전 검증을 완화하거나 재발행하지 않았다.
- 원본 [#4138 정정·종결 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4138#issuecomment-7204358435)에 두 실행 분리와 원격 blob 증거 연결; Issue `closed/completed`는 **읽기 진단 2/2 완료**를 뜻하며 자동 Publisher 활성화/설치 성공 아님.
- **실제 무인 CI 자동 발행→PC 효력→결과 대조: A/Writer B/Controller B 0/3 (0%)**. 새로운 보안 설정/승인 원본/운영 B 설치/Controller·Writer 교체/DB·D1/Task 변경 없음.

**다음 필수 실행:** 이미 확인된 Controller B Receiver CAS #4100 재사용, 기존 승인된 아직 실행되지 않은 업무의 원본·독립 영수증 저장 루트/인가된 opt-in 변경 경로가 실제로 확인될 때만 `push` 기반 기존 Owner 승인 업무의 CI 자동 발행 검증 진행. 별도 native A/Writer B의 #4113 루트·proof 미구성은 독립 대상이며 기존 원본 없이는 정책이나 `true`를 제조하지 않음. #4117 기존 실패는 개별 OPEN 원장으로 보존.

## 30. 스물여섯 번째 실행 기록 — Native 후보 경로 원본 관측으로 미설정과 미설치 구분 (2026-11-27 KST)

### 기존 구성 누락과 로컬 파일 부재를 구분한 최소 수정 및 실측

- 실측 기준 [#4113](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4113)에서는 handoff host의 `ZGMINI_CI_NATIVE_SCOPE_ROOT`·`ZGMINI_CI_NATIVE_RECEIPT_ROOT`와 Native A/Writer B publisher/execution opt-in 변수 미설정만 관측했으며, **실제 파일 부재는 미관측**이었다. 같은 A를 반복하지 않고 판단을 바꿀 고정 경로 존재 관측을 최소 추가.
- `main` `604cd8e22cf961521218e84f14af5193133a7754` 기준 별도 최소 소스 브랜치 `codex/pc-automation-process-improvement-native-scope-presence-20261127`에서 [PR #4142](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4142), 정확 HEAD `fab744e1e78d5668d2d74409e37622d290e8ea35`. 수정 2파일: `tools/ci-native-publisher-local-readonly.mjs`/해당 테스트. 이미 `readNativeScope`의 **표준 기본 후보**로 사용한 경로만 Windows `lstatSync`로 확인하며 symlink/reparse 및 파일 크기 검사, 경로·파일명·승인 원문·토큰 결과 출력 금지. 이 후보는 **권한 출처/실제 구성 root 자체가 아님**. 기존 `status/code`/검증기/opt-in/PC 동작 불변.
- exact HEAD CI **3/3 SUCCESS**:
  - [Two-PC Source Run 45903203736](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45903203736): `process-source-tests` 신규 고정경로 메타데이터 테스트 포함 SUCCESS.
  - [Secret Scan Run 45903203726](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45903203726): SUCCESS.
  - [C996 Run 45903203732](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45903203732): SUCCESS.
- `main` squash 병합 SHA **`82a44e22eeef153b06a7c9f196d39f5e7237f186`** GitHub readback. 본문 Git blob `aa22ed3dbd280dc02f7941cff810e9fa167e6b16`, 테스트 Git blob `806284b2ef3b39c8ece2e602409041b78deedfc1`; 원격 재조회 일치.

### 원본 격리 PC A — 추가 증거

- 새 고유 [Issue #4143](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4143)는 기존 `process-inventory-readonly`의 `role=handoff, probe=ci-native-publisher-local-readonly`를 **불필요한 pc-job 라벨 없이** 단회 요청. requestId `947b58c3-8fe4-4950-a85e-6e419d83da72`.
- 실제 [Run 45903559854](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45903559854), `DESKTOP-N62L0NG`/`zgmini-handoff-ci-spare-01`, observedAtUtc `2026-11-26T22:15:27.718Z`. GitHub `main` JSON `results/pc-process-inventory-45903559854-1-handoff.json` **Git blob `9df0aa76cde60559b36fdc8998f39c6ca47f1635`**; 대응 TXT **blob `c45c9656fd35c20ec2273e5bccea8c5115ca1101`**, 동일 고유 요청·상태 원격 **2/2 readback**.
- 관측 `READ_ONLY_OBSERVED/CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED`: `scopeRootConfigured=false`, `receiptRootConfigured=false`, native opt-in **4개 모두 `UNSET_OR_INVALID`**. 추가한 `standardScopeCandidate.state=ROOT_ABSENT`는 **기존 default 후보 경로 또는 그 부모가 현재 격리 PC에 없음**을 실제 lstat으로 구분했다. **다른 비표준 경로에 설치된 승인 파일의 존재/미존재를 증명하지 않음.** 실제 독립 policy/설치 proof 바이트 및 GitHub B 설치 결과 검증은 여전히 미수행.
- `independentRootsVerified=false`, `independentGitHubInstallationReceiptVerified=false`, `canPublish/canExecute/canInstall=false`, `operationalWrites/providerCalls/d1Writes/retries=0`. A 상태가 PASS 아닌 까닭의 Job `completed/failure`는 원격 JSON/TXT 저장 실패가 아니라 fail-closed 종료 계약. #4143 정정 댓글 [#7204516561](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4143#issuecomment-7204516561), 조회 목적만 `closed/completed`.

### 업무 목표로 돌아가는 다음 실행

1. **Native A와 Writer B 개별:** `approvals/controller-updates/`의 기존 실제 Owner 승인 및 `ciNativeApproval` 연계 설치 원본이 존재하는지 대상 바이트/효과 단위로 판별. 단순 코드 검색에서 `ciNativeApproval`은 현행 validator/agent·테스트만 발견돼 **실제 설치 grant의 존재를 입증하지 못함**. 소스 검색 부재를 DB나 PC 파일 부재로 오판하지 않는다.
2. 기존 승인 효과가 실제 고정되면 **각 효과별** 독립 B 설치 결과(`ciNativeEffect`, `ciNativePolicySha256`), 권한 있는 격리 설치·readback, 분리된 영구 receipt root를 정규 CAS/lease/backup 계약으로 연결. 일반 CI PR 소스·디폴트 경로를 trust root로 승격시키지 않고, setup 인증·환경 변수 변경 등 권한 밖 효과는 독립 확인 전 실행 금지.
3. Controller B는 Owner-merged 기존 승인 `push` 경로에 별도 자동 생성 정책이 필요 없다는 #4136 수정 재사용. 다만 실제 `ENABLED=false`, 영구 receipt root/새 승인 미실행 효과 미확보 상태는 지속; #4036/#4117 재발행 금지.
4. 각 효과의 실제 자연 CI→고유 정규 발행→PC 실행→본 결과 검증에서만 0/3 분자 증가. 추가 리플레이·빈 정책 제조·보안 값 변경·임의 폴더 생성 금지.

**종료 진행률: 실제 무인 자동화 0/3(0%). 이번 턴 완료는 source CI/merge + 새 읽기 A 2/2 및 표준 후보 경로 부재의 근거 확보이며 운영 적용/승인 권한 부여/실제 PC 효과가 아니다.**

## 31. 스물일곱 번째 실행 기록 — Native 승인 설치 원본과 Controller B Root 문제 분리 (2026-11-27 KST)

### 원본 비교 — 실제 설치 성공과 CI Native 독립 설치 증명을 분리

- 현재 `main` 검토 기준 SHA `cb108b0ec62e72ccaee38db51f5d77a945c31973`. 정규 [#4036](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4036)의 실운영 B 결과 `results/maintenance-pc-update-86b98541-34f9-45f7-bfbb-62d278f00b46.json` Git blob **`6f95e0c7abb56dcc63b62ec22aba14baab203fa0`** 직접 재조회. `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, target/actual Controller `3c7d4cfefacf072fd35cb19706b352c64c5e4fd2`, `protectedStateUnchanged=true`; **`ciNativeEffect`·`ciNativePolicySha256`은 이 실제 영수증에 없음**. 정상 B 설치는 유지하되 Native A/Writer B 발행 권한 또는 신규 설치 증명으로 재분류하지 않는다.
- `tools/maintenance-contract.mjs`는 Controller-only/selected B 승인 명세의 `ciNativeApproval`에 정확 `effect`와 `nativePolicySha256`를 요구하고, `tools/maintenance-agent.mjs::attachApprovedNativeBReceipt`는 **실제 Owner actor + Controller B SUCCESS + protected state + 정확 승인 annotation**을 만족한 결과에만 Native 필드를 추가한다. `ci-approval/native-publisher-entry.mjs::verifyNativeInstalledProof`는 GitHub에 저장된 동일 Native B 설치 영수증과 정책 해시를 다시 요구한다. unrelated #4036 성공 결과는 의도적으로 거절된다.
- 현재 저장소 코드 인덱스에서 `ciNativeApproval path:approvals/controller-updates`, `ciNativePolicySha256 path:approvals/controller-updates`, `ciNativeEffect path:results`, `ciNativePolicySha256 path:results`, `ci-native-a-approved.json path:approvals`, `ci-native-writer-b-approved.json path:approvals`는 **각 검색 결과 0건**. 파일 트리의 전체 Controller update 명세 **181개**, 유지보수 JSON 결과 **203개**를 확인했지만 모두 원문 바이트 단위 전수 검증한 것은 아니므로 **검색 미발견 = 전체 무존재**로 주장하지 않는다. 현 시점 사용 가능한 **정확 Native B 승인·성공 영수증은 미확보**.
- [#4143](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4143) 표준 후보 루트 `ROOT_ABSENT` + Native scope/receipt 변수 미구성 4 opt-in 확인은 Native A/Writer B에만 적용한다.

### 반대 증거 — Controller B의 receipt root를 일괄 미구성으로 취급하지 않음

- 기존 고유 [#3913](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3913) / [Run 45841959058](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45841959058) 2026-11-26T14:44:23Z 격리 PC 현장 결과 재사용. JSON `results/pc-process-inventory-45841959058-1-handoff.json`, blob **`696b3aaba9158e1bd94da705582fdbcb123a6f1a`**. 당시 `ciControllerBReceiptRoot: PARTIAL/CI_RECEIPT_ROOT_DIRECTORY_PRESENT_READONLY`, `configured=true`, `directoryPresent=true`, `readable=true`. 이전 사용자 직접 C 경로 준비 및 변수 등록을 거친 **Controller B root 후보는 그 시점 실제 존재·읽기**가 확인됐다. 따라서 Native A/Writer B의 별개 ROOT_ABSENT를 Controller B에 전파하지 않는다.
- 같은 결과에서 Controller B **`writableVerified=false`, `durableAcrossRunsVerified=false`**, 즉 한 번 읽기 확인이 지속 가능한 고유 영수증 저장 보장은 아니다. 이후 [#4138](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4138) 2026-11-26T22:05:17Z 격리 PC 조회에서는 `ZGMINI_CI_CONTROLLER_B_ENABLED=false`, 생성 승인 `POLICY` 미구성으로 확인됐고 새 읽기는 receipt root를 재조회하지 않았다. 과거 root 존재를 **현재 쓰기/내구성 PASS**로 승격시키지 않는다.
- [#4136](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4136)의 소스 교정대로 **Owner-merged 기존 B `push` 경로는 generated approval POLICY 값 없이도 소스 계약상 가능**하지만, 현재 `ENABLED=false` 및 지속 claim 영수증 쓰기, 실행되지 않은 승인 효과의 실제 이벤트가 별개 미충족. 보안/Actions 변수 임의 변경·기존 완료 B #4036 재실행 금지.

### 실행 결정 및 남은 실제 작업

1. Native A/Writer B는 기존에 사용 가능한 Native 전용 Owner B 승인 원본·CI policy exact hash·독립 proof를 먼저 확보해야 하며, 실제 무인 실행 권한 없이 임의 manifest·독립 scope 파일·해시를 제조하거나 단순 `true`로 바꾸지 않는다. 범위 밖 운영 인증·GitHub Actions 변수·격리 host trust-root 설치가 필요하면 기존 C급 직접 인증 계약을 보존한다. 관련 승인 없는 작업의 `AUTOMATION_BLOCKED`만 유지.
2. Controller B는 **과거 root 읽기 확인은 재사용**, 최신 ENABLED와 별도로 root 쓰기·내구성/정확 사용 가능성의 독립 증거가 있을 때만 기존 승인 자연 `push` 실증 진행. 현재 새로운 원본 B 효과와 CI receipt 설치/실행 승인 경계가 없으므로 완료된 #4036을 재발행하지 않는다. 무관한 B 업무/Runner 복구 중단 금지.
3. 이번에는 소스 변경·불필요한 PC 반복 A/B 요청·보안 변수 변경 없이 이미 있는 원본과 현행 코드의 실패 조건을 구분했다. **실제 무인 CI→승인 명세 발행→PC 실행→영수증 A/Writer B/Controller B 0/3 (0%)** 유지. 새로운 PR/설치 성공을 주장하지 않는다.

**다음 필요 행동:** 독립 Native B 설치·승인 원본이 있는 정확한 운영 scope 확보 또는 승인된 정규 설치 절차로 증명을 실제 생성·검증. Controller B는 현행 저장 root를 다시 만드는 대신 기존 경로의 영구 쓰기 검증 및 아직 실행되지 않은 구체 승인 효과 이벤트 확인. 보안/권한 변경의 직접 사용자 단계와 개발 단계는 구분한다.

## 32. 스물여덟 번째 실행 기록 — Controller B 격리 영수증 root Cross-Run 검증 기완료 증거 복원 (2026-11-27 KST)

### §31의 미검증 판정 명시 정정 — 역사적 실제 실행 로그 우선

- 앞선 §31 및 이전 응답에서 Controller B 수신/발행 영수증 root의 `writableVerified=false`/`durableAcrossRunsVerified=false`를 현재까지 **미검증**으로 보고한 판단은 잘못됐다. [#3913](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3913)처럼 *읽기 전용 A* 자체만으로는 증명되지 않지만, 그 이후 **동일 격리 Runner에서 이미 수행·종결된 C급 단회 쓰기와 별도 실행 A 검증**이 존재했다. 과거 조회 범위 누락이 원인이며, 이 수신 경로를 반복 검증해서는 안 된다.
- 실제 격리 PC `DESKTOP-N62L0NG`에서 Owner 직접 [#3925](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3925) 요청 `ZGMINI_CI_RECEIPT_PROOF_REQUEST_V1 / phase=write`, [Run 45846542819](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45846542819), Job `140001583324`, **completed/success**. Job 원문 `2026-11-26T15:12:08.043Z`: `PARTIAL/CI_RECEIPT_PROOF_WRITE_READBACK_VERIFIED`, `writableVerified=true`, `operationalWrites=1`, `controllerBPublished=false`, `recordSha256=9634b116be57dea2686d3f0d0dcd7a97e0ec650219ed357cc52878b7c111a1ab`. 승인된 고정 증명 파일 1개만 `wx + fsync + readback`했고 새 Controller B 효과/공급자/D1 쓰기 0.
- Owner [#3926](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3926) `phase=verify, sourceIssueNumber=3925`, **서로 다른 Run [45846758798](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45846758798)**, Job `140002327690`, **completed/success**, Job 원문 `2026-11-26T15:12:56.476Z`: `PASS/CI_RECEIPT_PROOF_CROSS_RUN_VERIFIED`, `writableVerified=true`, `durableAcrossRunsVerified=true`, `sourceRunId=45846542819`, `verificationRunId=45846758798`, **동일 SHA256** `9634b116be57dea2686d3f0d0dcd7a97e0ec650219ed357cc52878b7c111a1ab`, 2차 실행 operationalWrites=0. 두 Issue 모두 closed. 소스 `tools/ci-controller-b-receipt-proof.mjs`는 기존 고정 `C:\\ProgramData\\ZGMINI-CI\\ControllerBReceipts`, 고정 호스트·Runner·Owner·`ENABLED=false`를 강제하므로 이 결과는 **Controller B 격리 root에만** 해당한다. Native A/Writer B `E:` 후보 루트 부재를 해결한 것이 아님.
- Controller B 현 설치 receiver 정책 CAS [#4100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100) **PASS**, Workflow blob `27e48ecde81bdf6f15cccffcffd9b3e70482a5f3`, 설치 소스 SHA `5a85f803fd9cb280561395f88a3544ee8e7d4660`. 현재 `.github/workflows/ci-approval-controller-b.yml`는 기존 고정 publisher checkout `cfe57f3d720219613c87eff21338de0d35edbf6b`; 그 checkout의 `ci-approval/completed-run-intake.mjs` Git blob `2ace916847a47a22ee36bd558c76a6f932f3dc2d` 및 `tools/maintenance-request.mjs` `057fcd5892fda4bda91305a8b20f16f88f3399ad`는 현재 main 파일과 실제 동일. 최신 읽기 전용 설명 변경과 운영 고정 게시기 사이 소스 누락을 새 차단으로 만들지 않는다.
- Controller B **확정 보유 증거:** 승인된 설치 Receiver와 원격 workflow/manifest pin CAS + 격리 PC에서 영수증 root 쓰기·다른 Run에서 지속성 확인. 운영 PC #4036의 실제 B 성공은 Native 전용 설치 grant가 아니라는 §31 결과는 그대로 유효.
- Controller B **정확 남은 효과:** [#4138](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4138) 실제 격리 `ENABLED=false`; `ZGMINI_CI_CONTROLLER_B_POLICY`는 CI 신규 생성 승인 PR 경로용으로 미구성. 기존 **Owner-merged** 승인 manifest `push`는 §29/PR #4136대로 생성승인 policy 값 없이도 소스상 처리할 수 있지만, 활성 `ENABLED` 및 **이미 실행되지 않은 정확한 승인 B 대상이 향후 정상 이벤트로 나타나는지**를 별도로 확인해야 한다. 기존 성공 #4036 재발행·기존 #4117 실패 재실행 금지. 자동 활성 변수는 보안/운영 권한 조건 확인 전 임의 수정하지 않는다.
- **Native A/Writer B 별도:** #4143 표준 E: 후보 `ROOT_ABSENT`와 독립 scope/receipt root 미구성, 관련 Owner Native B 승인 설치 proof/효과의 확보가 실제 잔여. 이를 Controller B 발행 root 완료 증거로 해결했다고 주장하지 않는다.
- 이 실행은 완료된 정확한 두-run 증거를 회수·검증하고 잘못 분류한 차단을 바로잡은 작업이다. 새로운 GitHub/PC 설정·C급 쓰기·운영 파일·DB/D1·승인 Issue 재요청·source PR/CI 재실행 **0건**. **운영 CI 자동 발행→PC 효과→원격 영수증의 실제 종단 0/3 (0%)**는 유지한다.

**이후 실행:** Controller B에 새로운 구체 **Owner 승인·미실행** 자연 B 효과 및 기존 보안 활성화 경로가 확보되면 이미 유효한 root·receiver 증명은 재사용하고 단회 CI 발행/운영 설치 결과를 확인한다. Native A/Writer B는 B-installed 독립 scope·proof의 정규 설치 근거가 먼저 필요하다. 본문 31절의 과거 root 미검증은 이 32절 원본 로그로 정정한다.

## 33. 스물아홉 번째 실행 기록 — 기존 Owner 승인 PR의 늦은 Source CI 이벤트 누락 최소 수정 (2026-11-27 KST)

### 실제 코드 실패 조건

- `ci-approval/completed-run-intake.mjs::observePublishedControllerApprovals`의 기존 `main push`는 manifest가 추가된 시점에 **해당 PR 소스 CI SUCCESS**가 있어야 `submitExistingControllerApprovalFromCi`를 호출한다. Owner가 PR을 병합했을 때 source CI가 아직 진행 중이면 `SOURCE_CI_UNVERIFIED` → `NOT_SUBMITTED`로 종료된다.
- 해당 CI가 나중에 SUCCESS로 끝나도 기존 `workflow_run` job은 `ZGMINI_CI_CONTROLLER_B_POLICY != ''`를 추가 요구하고, 고정 실행기 `main({publish:true})`은 `workflow_run`을 오직 독립 자동 생성 정책 경로로 처리했다. **기존 Owner-merged 명세에는 별도 생성 정책이 필수 아님**(이전 #4136), 따라서 push/CI 완료 이벤트 순서가 바뀌면 승인 효과를 놓치는 구조적 공백. 이 오류는 현재 ENABLED=false/Owner 신규 효과 미확보 등 운영 차단과 독립된 **소스 경로 문제**로 분류한다.
- 이 수정은 [#3925/#3926](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3926)의 영수증 root CROSS_RUN PASS를 재사용하고, 기존 운영 설치에 관한 새 재진단·A 재요청/Owner 명세 재발행을 요구하지 않는다.

### 최소 소스 수정 및 HEAD CI

- 최신 `main` `25f1861392e1bc6caee08d8925d1457958b5101f`에서 별도 `codex/pc-automation-process-improvement-late-owner-ci-20261127` 소스 브랜치 생성. [PR #4147](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4147)에서 정확 **2파일**만 수정 (`ci-approval/completed-run-intake.mjs`, `tests/ci-approval-completed-run-intake.test.mjs`).
- 추가 `observeLateOwnerMergedControllerApproval`는 완료 event를 **실제 GitHub Actions REST `actions/runs/{id}`로 재검증**, 고정 Source CI `workflowId=416355595`, PR 이벤트, 비공개 저장소, 성공 run/head SHA와 run attempt 정합성 확인. `commits/{head_sha}/pulls` 결과는 단지 후보로 사용, 실제 PR `merged_by` Owner login+ID+type, base=head 저장소·main·head SHA, 승인 JSON `added` 상태, 정확 Git blob, **병합 SHA 시점과 현재 main의 동일 승인 원문 바이트** 및 manifest.target/ref 확인. URL/Issue 또는 bot/branch text를 Owner 승인으로 승격하지 않음.
- `publishLateOwnerMergedControllerApproval`는 위 exact 결과만 기존 `submitExistingControllerApprovalFromCi`로 전달하고, 실제 재검증·effect key·durable claim·Issue prior inventory 및 **unknown 시 재POST 금지**는 기존 엔진을 재사용. 관련 Owner 미병합/타 계정/타 저장소/변경 승인/CI 실패/불완전 API는 fail-closed, PC 설치·Provider·DB/D1 호출 없음.
- 첫 소스 CI 실패에서 새 정규식·Git blob NUL 구분자 표현 오류를 발견 후 수정. 두 번째 CI는 **배포 gating을 검사한 신규 테스트의 escape 오류**였고 기능 test는 통과했음. 해당 테스트 수정 후 정확 최종 HEAD **`14a86d57ee30c3223bbb6daf51a2399eed143169`**:
  - [ZGMINI Controller Maintenance Source Tests 45905381816](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45905381816) **completed/success**, 신규 owner/CI/manifest byte·가짜 Owner 거부 테스트 포함.
  - [ZGMINI PC Secret Scan 45905381781](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45905381781) **completed/success**.
  - [C996 R5 Readonly Source Checks 45905381812](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45905381812) **completed/success**.
- **exact HEAD CI 3/3 성공 → PR #4147 ready → squash merge `main` SHA `fcbbf12cd662544ee308295c13076d4ca2f4aeba`**. `main` readback에 신규 함수를 확인, source Git blob **`68045e68cd94635ea9fb4ba0e7a9bf486e062438`**, tests blob **`33f0033adb59894ba2a79544943f8d6489c1d04d`** 일치.

### 배포/운영은 별개의 정확 단계

- 현재 **Production** `.github/workflows/ci-approval-controller-b.yml` Git blob **`27e48ecde81bdf6f15cccffcffd9b3e70482a5f3`**, publisher **고정 checkout SHA `cfe57f3d720219613c87eff21338de0d35edbf6b`** 및 `workflow_run`의 `vars.ZGMINI_CI_CONTROLLER_B_POLICY != ''` gating을 **변경하지 않았다**. 따라서 `main`의 소스 수정만으로 이 늦은 Owner CI 경로가 **실운영에서 활성화되지 않는다**. 이 불변성은 receiver 기존 승인 Workflow pin/CAS를 깨뜨리지 않기 위한 보호다.
- 남은 정확 실행은 현재 Receiver pin과 대상 소스/설정의 정규 B approval, `ci-approval-controller-b.yml` job gate를 **기존 Owner-merged branch와 생성 approval branch로 구분**한 후 새 exact Workflow/blob·고정 publisher checkout의 공식 운영 설치·CAS/readback. 보안/Actions 변수 `ZGMINI_CI_CONTROLLER_B_ENABLED` 변경은 별도 기존 C급 권한 규칙 준수, 현재 false 임의 활성화 금지. 실제 신규/미소진 Owner 승인 B 효과 없으면 운영 POST/설치 완료로 오판하지 않는다.
- Native A 및 Native Writer B의 별개 Scope/root/Owner B-installed proof 미구성은 #4143 원본대로이며 이번 수정으로 완료되지 않았다. 이미 완료된 #4036 및 과거 #4117 재실행·영수증 소급 생성 금지.

**종료: 소스 결함 수정·관련 CI/병합 완료. 실제 무인 CI 자동 승인 발행→PC 실행→결과 검증 여전히 A·Writer B·Controller B `0/3 (0%)`이며, 이 기록 자체가 추가 인가·설치·활성화 완료가 아니다.**

## 34. 서른 번째 실행 기록 — #4147 늦은 Owner Source CI 발행기 Production 후보 Draft 완료 (2026-11-27 KST)

### 이번 실제 진전 — Source-only 배포 후보 exact HEAD 3/3

- #4147의 source function `publishLateOwnerMergedControllerApproval`는 병합·source CI 완료 순서 경합을 해결하지만, Production Workflow `.github/workflows/ci-approval-controller-b.yml`의 이전 고정 checkout `cfe57f3d720219613c87eff21338de0d35edbf6b` 및 `workflow_run`의 `ZGMINI_CI_CONTROLLER_B_POLICY != ''` 조건 때문에 실제 호출될 수 없었다. 생성 승인 policy가 없는 기존 Owner-merged approval PR의 지연 CI는 별도 정규 source event가 필요하다는 **배포 계약의 결합**을 확인.
- 현재 `main` `fcbbf12cd662544ee308295c13076d4ca2f4aeba`에서 신규 **격리 후보** 브랜치 `codex/pc-automation-process-controller-b-late-ci-workflow-20261127`를 생성하고 [Draft PR #4152](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4152)를 등록. **정확 2파일** 수정:
  1. `.github/workflows/ci-approval-controller-b.yml`에서 `workflow_run`용 추가 generated-policy 선행 Gate만 제거. 기존 `ENABLED == 'true'`, 정확 repo/private/main, CI 성공/원본 PR event/같은 repo, 격리 Windows 고정 host, 리소스/권한/의도된 concurrency 불변. 생성 approval branch의 실제 독립 policy pin/Owner 승인 범위/원본 바이트 검증은 **고정 게시기 내부에서 여전히 필수**.
  2. 고정 `checkout ref`를 source·CI 검증 완료된 **`fcbbf12cd662544ee308295c13076d4ca2f4aeba`**로 교체. `tests/ci-approval-completed-run-intake.test.mjs`의 동일 fixed pin, workflow gate, 원본 Owner/자동 생성 승인 정책 구별 회귀 추가. `actions/checkout` digest, `persist-credentials:false`, 타 PC/Token/DB/D1/승인 업무 계약 유지.
- **Draft HEAD `b8756c349043616a8d96de2bc1735537f37ebc46`**. GitHub 원격 파일 readback 후보 새 Workflow blob **`a31972f47badcd35b0ffffa61721a93308d23067`**. 이전 실제 설치 pin과 다른 값이며 아직 운영 승인·설치 정책 아님.
- 정확 HEAD 소스 CI:
  - [Controller Maintenance Source Run 45906181531](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45906181531) **completed/success**.
  - [C996 Run 45906181522](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45906181522) **completed/success**.
  - [Secret Scan Run 45906181496](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45906181496) **completed/success**.
- 이 3/3은 *오직* 해당 Draft HEAD 소스 검증이다. **PR #4152는 Draft/open을 유지하며 main 병합·Windows 정책 설치·GitHub 설정 활성화·새 Controller B effect POST를 실행하지 않았다.** 현재 Production blob은 앞선 #4100 정책 원본 `27e48ecde81bdf6f15cccffcffd9b3e70482a5f3`로 남는다.

### 실제 인계용 target SHA 선택의 추가 필수 주의

- 설치된 정책은 [#4100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100)의 `workflowId=430972394`, Workflow blob `27e48ecd...`, 설치 유지보수기 source SHA `5a85f803fd9cb280561395f88a3544ee8e7d4660` 및 유지보수기 manifest hash `0e1903fd9052b1e2c72812fde07c6338a79287e673a4cd9e715dedf23883f589`. 기존 [#3925/#3926](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3926) 격리 receipt root 쓰기·cross-run PASS 재사용.
- GitHub `compare_commits(5a85f803..., fcbbf12c...)`는 **ahead 245, behind 0**, `tools/maintenance-agent.mjs`, `tools/maintenance-apply.mjs`, `tools/maintenance-contract.mjs` 등 보호된 runtime source가 변경됐음을 보여준다. `fcbbf12...`은 **CI publisher checkout pin**이지 자동으로 안전한 정책-only `SEVEN_TO_SEVEN` **유지보수기 설치 target SHA가 아님**. 이를 source target으로 붙이면 원치 않은 유지보수기 실행 파일 교체 범위가 섞인다.
- 이전 [#4024/#4025](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4025)의 B 승인 명세 `approvals/maintenance-handoffs/5a85...json`은 **기존 `b568...`→`27e48...` 정책 pin 1회 교체만 허가**하고 이번 신규 `a31972...` pin 전환·보안 변수 ON·신규 B 업무 승인을 포함하지 않는다. 그 승인 효과를 임의 재사용하지 않음.
- 실제 다음 필요 단계는 설치된 **현재** maintainer SHA/manifest+9개 source 파일 CAS를 기준으로, 원본 실행 파일 바이트가 동일한 별도 immutable `targetSha`(installed와는 다른 SHA)를 찾거나 범위 명시한 새 B 변경 승인을 별도로 확보하는 것. `approvedPolicyOnlyHandoff`는 `installedSha !== targetSha`, 기존 root와 정확한 schema/ID/path/authorized policy pin만 교체할 때 `writes=[]`를 허용하며 실행 전 현재 lease·백업/rollback·원본 증거 필수. 후보 임의 Approved flag·과거 PC 성공 재사용 금지.
- 새 정확 Git workflow blob에 대한 **Owner의 독립 운영 정책 변경 승인 → 기존 정규 B 유지보수기 7→7 인계 원본 승인/설치/readback → 새 Production Workflow Draft PR 머지 → Source event/원격 B 영수증** 순서. 실제 CI B 활성화 `ZGMINI_CI_CONTROLLER_B_ENABLED=false`는 별도 권한 승인 없이는 불변. 타 자동화 A/Writer B의 미설치 root와 Owner Native grant 미확보도 변동 없음.

**이번 종료 증거:** Source Draft PR #4152 exact HEAD CI 3/3, 후보 blob·고정 source SHA 도출, 위험한 단순 설치 target 재사용을 차단. 실제 무인 A·Writer B·Controller B 종단 **0/3 (0%)** 변동 없음. 신규 PC A/B 요청·운영 설치·DB/D1·수집/게시·Runner 변경·기존 B 반복 실행 **0건**.

### §34 보충 — 정책-only 7→7 별도 설치 source 후보 정확 검증 (이번 실행에 이어 확인)

- `main` GitHub commit 목록에서 기존 격리 인계 정책 설치 SHA `5a85f803fd9cb280561395f88a3544ee8e7d4660`의 후속 **`5f085175e674b47f6c386ac5ab819875bc43242f`**(후속 Source 1 commit)를 찾아 실제 `compare_commits` 재조회. `status=ahead,ahead_by=1,behind_by=0`, 변경 파일은 오직 `results/pc-process-inventory-45865149029-1-operating.json` 및 `.txt` 2개로 **유지보수기 승인 source 9개 파일 불변**. 이어 `compare_commits(5f085...,fcbbf12...)`는 `ahead_by=244,behind_by=0`로 `#4147 main` 계보에도 속한다. 반대로 `fcbbf12`는 설치 기반 `5a85` 대비 보호 maintainer source 3개 이상 변경돼 정책-only target으로 사용 금지.
- **B 운영 정책-only target 후보 `5f085175e674b47f6c386ac5ab819875bc43242f`**와 **CI publisher 고정 checkout SHA `fcbbf12cd662544ee308295c13076d4ca2f4aeba`**를 명확히 분리. 후보 target용 기존 `approvals/maintenance-handoffs/5f085...json`은 GitHub main에 **없음**을 확인. 따라서 아직 Owner의 이번 정확 효과 승인/신규 manifest/원본 CAS/실행 권한이 존재하는 것으로 간주하지 않는다.
- 현재 운영 PC 설치 source SHA가 이전 [#4100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4100)의 `5a85` 상태 그대로인지 **신규 live readback은 수행하지 않음**. 운영 B 실행 직전 현재 source/manifest/9파일 CAS 검증은 필수. 안전 후보라 해도 Owner 이번 새 policy blob `a31972...` 승인, 새 정확 7→7 manifest·lease·backup/rollback, Windows 설치/readback 없이 [Draft PR #4152](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4152) 병합 금지.
- 본 보충 내용을 Draft PR #4152에도 원본 commit 비교·후보 SHA와 함께 반영하여 원격 저장을 확인. 실제 무인 0/3은 그대로, 기존 PC/Controller/Writer/승인 파일/활성화 변수 변경 **0건**.

