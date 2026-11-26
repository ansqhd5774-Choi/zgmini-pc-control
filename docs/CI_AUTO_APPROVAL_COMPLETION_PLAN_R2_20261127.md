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
- 코드 HEAD `85066e3ca47864229a81e38fb457e2b8e8d047e6`, 변경 파일 2개. 해당 PR의 격리 실제 CI 결과·병합 여부는 **별도 확인 전 미입증**.
- 실제 Owner-only Workflow, Writer 수신기, A 허용목록, CI 인증 정책, GitHub 변수, PC Runtime **변경 0**. PR #4044의 모의 판정 개선을 실제 무인 실행 완료로 세지 않는다.

### 다음 필수 코드 작업

1. A·Writer B 각각의 기존 Owner 인증과 신규 CI 제출 주체를 **동일한 신원으로 가장하지 않고** 분리할 실제 허용 수신·서명/영수증 계약을 특정한다.
2. 독립 검증·계정 범위·단회 요청/기존 영수증·재생 방지를 만족하는 공식 경로만 최소 변경한다. 인증/관리자 권한 변경이 필요한 범위는 별도 근거로 분리한다.
3. PR #4044 정확 HEAD 격리 CI 완료 시 기존 증거와 통합 여부를 확인한다. 그 결과와 무관하게 실제 A·Writer 종단 실증은 아직 0건으로 보존한다.
