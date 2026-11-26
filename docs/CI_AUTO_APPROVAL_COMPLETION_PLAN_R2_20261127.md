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
