# ZGMINI 자동화 프로세스 전문가 — 잔여 작업 실행 지시 R3
2026-11-28 · 사용자 요청에 따른 전용 브랜치 실행 지시

- 담당: 자동화 프로세스 전문가
- 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 관리 브랜치: `codex/pc-automation-process-improvement-20261119`
- 누적 계획/진행 원장: `docs/CI_AUTO_APPROVAL_COMPLETION_PLAN_R2_20261127.md`
- 공통 지침: `AGENTS.md`, `docs/PC_AUTOMATION_STANDARD.md`, `docs/AUTOMATION_PROCESS_EXPERT_WORK_STANDARD.md`
- 중앙 공유 조정: Issue #68

## 목적·완료 정의
기존 승인 범위에서 A급, Controller B급, Writer B급을 **인증된 GitHub CI 이벤트 → 정확 승인 원본 검증 → 단회 발행 → 정규 PC 실행 → 원본 JSON/TXT readback**까지 실증한다. 세 유형 각각 운영 종단 성공 증거가 있어야 전체 완료(3/3)이다. 소스 CI/병합, 수동 설치 성공 및 단순 Issue 접수는 운영 종단으로 계산하지 않는다. 2026-11-28 확인된 실제 신규 무인 종단은 **0/3**이다.

## 마지막 유효 진행·증거
- #4276 Public B 소스 PR: `d4e7b7130a558a380ae0be80bc8a20fc8031a86f`에서 정규 **merge commit** 병합 완료, `main@da52580380885ea6c4ba3d68757b79cbe848ac0b` (병합 당시). 승인 위임 범위 기록: #4276 댓글 7227666796.
- 병합 직후 Public checkout 고정 SHA `4d3fe664a90f2e8c3dea885559b1ec263df66a24`는 main 조상임을 GitHub compare `ahead=46,behind=0`, merge-base 일치로 확인. Private B pin은 불변.
- #4276 정확 HEAD public-source-only CI Run #46063748322 SUCCESS, Windows source-only SKIPPED.
- 병합 후 CI Controller B Submission Run #46065042920: `submit-controller-b`·`observe-public-source` 모두 SKIPPED. **B 실제 제출·설치의 성공 증거 아님.**
- workflow `.github/workflows/ci-approval-controller-b.yml` Git blob `887cd36ee5ad438e634897f937b1a7c8958962e1` (병합 직후 readback). 독립 설치 Windows V2 정책의 Workflow ID/blob 일치 readback은 아직 없음.
- #4283 Controller 정확 2파일 효과 및 #4287 Public A Workflow 효과는 기존 승인·병합 기록을 우선 재조회해 재승인 요청을 반복하지 말 것. 과거 #4152/4160 사용자 정책 보류 및 R6 복구 관련 제한은 **정확 효과·승인 시각·최신 증거**로 비교하고 무조건 해제됐다고 추정하지 않는다.
- 별도 기존 프로세스 개선 R2 #2310 CLOSED는 원래 장애 개선 완료 증거이며 신규 A/B 무인 종단 완료가 아님.

## 필수 실행 순서 (P0~P6)
### P0. 관리 원장 최신화
이 문서와 R2 계획/원장에 #4276 병합 및 ancestry 해결을 연결하고, 유효한 기존 승인·보류·영수증 및 실제 Runtime 상태를 구분한다. 관리 브랜치는 main과 크게 diverged이므로 **전체 브랜치 병합 금지**. 새 소스 변경은 당시 최신 main 기반 최소 작업 브랜치를 사용한다.
종료 증거: 기록 커밋/원격 파일 readback.

### P1. Controller B 독립 Windows 정책/설치
#4283/#4287 현재 상태와 실제 효과 승인·보류를 재조회한다. 보호된 `MAINTENANCE_INSTALL.json`, 독립 V2 7파일 SHA256, Workflow ID/blob, 정확 target/manifest/installed baseline, 현행 CAS·lease·백업/복구 원장을 검증한다. 기존 정규 유지보수기/정식 Windows 보호 경로만 사용하며 미설치/미승인/불일치일 때는 해당 쓰기만 차단한다. 임의로 독립 정책 생성·설치 성공 선언 금지.
종료 증거: 실제 설치 SHA, 파일 해시 및 사후검사, JSON/TXT readback.

### P2. Public Controller B 무인 발행 파일럿
실행 직전 checkout SHA가 당시 main 계보에 포함되고 설치 정책의 workflow identity와 일치하는지 재확인한다. 실제 승인된 **미소진 단일 효과**와 CI 원본 Run/Job/receipt만 정규 수신한다. 신규 승인 효과가 없다면 기존 완료 B 재실행 금지.
종료 증거: 자연 CI→인증 단회 Issue→Windows 효과→원본 JSON/TXT, 중복 0.

### P3. A급 CI 무인 실행
기존 `pc-job` operation·Runner·CI 전용 발행기/수신기를 재사용한다. GitHub Actions Bot을 Owner로 가장하지 않고 독립 인증/승인 원본 검증, 영구 효과 claim 및 결과 불명 시 재발행 차단을 유지한다.
종료 증거: 실제 CI 무인 발행→정규 A 실행→JSON/TXT 원본 확인.

### P4. Writer B CI 무인 설치
기존 Writer manifest·발행기·수신기·공통 Writer 설치 엔진과 source/preimage/CAS/lease/backup/rollback을 재사용한다. Controller 권한을 Writer로 복제하지 않는다.
종료 증거: 미소진 승인 Writer 단회 제출→실제 Windows 설치→설치 SHA/사후검사/JSON/TXT.

### P5. 공통 중복·오류/결과 처리
기존 공통 모듈에서 중복 효과 0, 위조/범위 초과 실행 0, 결과 미확정 재발행 0을 확인한다. RUNNING·STATE_UNKNOWN·AUTOMATION_BLOCKED·RUNTIME_FAILED·DONE을 분리하고 실제 충돌 공유 쓰기만 lease로 직렬화한다. 이미 유효한 CI/운영 증거를 재사용하고 발견된 결함만 최소 수정한다.
종료 증거: 범위 내 긍정/부정 회귀와 관련 실제 경로.

### P6. 전체 운영 종단 인수
A/Controller B/Writer B 각각 승인 원본, CI Run/Job, 실제 PC 실행, 원본 결과, B 설치 SHA·보호/사후검사 및 권한 경계의 5증거를 연결한다. **3/3 운영 종단 증명이 될 때만 DONE**.

## 실행 보호·우선순위
- 이전 승인·실행·원장·운영 파일 및 다른 작업자 변경 보존. 승인 없는 source·DB/D1·산식·DNS·배포·예약·Runner/Watchdog/Controller/Writer 변경 금지.
- 유효한 R6 복구 보류나 Controller 담당 완료 통보 조건을 새로운 근거 없이 해제하거나 무관한 A·Writer의 전역 차단으로 확대하지 않는다.
- 안전 거부·원본 인증·CAS·lease·backup·rollback 우회 금지, 임의 shell·설치기 대체·Owner 위장·가짜 PASS·중복 실행 금지.
- 종료된 GitHub Actions 15분 예약 장애 조사 및 사용자 직접 CMD 작업 전가 금지.
- 정확한 현재 승인 범위의 필수 작업을 진행하고, 별도 승인 효과만 정확히 분리해 보류한다.

## 진행 원장 기록 계약
각 실행 시 `관측/실제 실패 조건/최소 변경/CI 및 Runtime 검증/운영 영향/미완료/다음 필수 행동`을 기존 R2 문서에 append하고, PR·Issue·Run·SHA·결과 URL을 남긴다. historical SHA를 현재 Runtime SHA로 단정하지 말 것. 상태 및 진행률은 **P0~P6 작업 단계와 운영 종단 N/3을 별도로 표시**한다.

## 즉시 다음 행동
(1) 이 문서와 R2 원장 변경을 원격 재조회, (2) #4283/#4287 승인·병합 및 Controller B 현 설치 readback을 검토, (3) 최신 유효 보류·보호 조건 안에서 P1→P2를 진행하고 독립 A/Writer P3/P4도 병행한다. 문서/소스 병합은 전체 운영 완료가 아니다.
