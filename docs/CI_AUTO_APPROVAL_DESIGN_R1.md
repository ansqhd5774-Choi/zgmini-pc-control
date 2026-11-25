# ZGMINI CI 기반 A/B 승인 자동화 설계 R1
기준: 2026-11-25 KST. 상태: DESIGN_CANDIDATE / 실행 비활성.
사용자 목표: 사전 정의된 조건을 충족하는 승인된 업무는 담당자의 반복 승인 판단 없이 CI가 판정하고 정규 실행까지 연결한다. 이 설계 문서는 신규 운영 승인 또는 승인 정책 변경 그 자체가 아니다.

## 1. 기존 계약 승계
- 정본: PC_AUTOMATION_STANDARD.md §5, CONTROLLER_AUTO_UPDATE.md, GENERAL_CHAT_START.md, writer-b/README.md, AGENTS.md.
- A: 등록된 고정 operation과 pc-job Issue → Actions → Controller → TXT/JSON. 이미 가능한 작업에 새 Gate를 추가하지 않는다.
- B Controller: 정확한 승인 manifest와 pc-maintenance Issue → 독립 유지보수기. pc-job.yml에 B 쓰기를 활성화하지 않는다.
- B Writer: 기존 승인 manifest, 공통 Writer B workflow와 실제 설치/보호 검사를 유지한다. #2234/2235/2236은 선례이지 신규 승인이나 현재 preimage가 아니다.
- C(관리자/보안/시스템 설정)는 기존 사용자 직접 실행 경계를 유지한다.
- 기존 사용자 업무 승인과 필수 유지보수 상시 승인을 구분한다. CI PASS, PR merge, 요청 작성자, 자유 텍스트, 모델 출력은 그 자체로 권한 근거가 아니다.

## 2. 판정과 실행의 분리
요청(기존 고유 ID 및 실제 효과) → 신뢰된 정책/승인 근거 대조 → 효과별 CI/출처 증거 확인 → 결정(범위 및 이유) → 기존 형식의 manifest 생성/검증 → 기존 승인 게시 및 요청 생성 경로 → 실제 실행기 재검증 → 결과 회수.
A는 기존 정규 접수/판정에 필요한 확인만 재사용한다. B는 기존 명세서의 정확한 필드를 자동 채우되 기존 승인 근거가 완전히 대조되는 경우에 한한다.
첫 구현은 격리된 순수 판정 및 후보 생성이며 외부 쓰기·Issue 제출·운영 실행 없음. 신뢰된 정책/승인 원문이 기계적으로 대조될 수 없는 경우 수동 검토 유지. 자동 생성된 후보를 기존 APPROVED_B로 오인하지 않는다.

## 3. 효과별 조건 및 결정
| 효과 | 조건 | 결과 |
|---|---|---|
| A 고정 순수 조회 | 기존 허용 operation, 요청 인증/스키마/scope, 해당 자원 조건 | 기존 A 접수 |
| B Controller 필수 등록/설치 | 기존 업무/상시 승인 일치, 정확 target SHA/실제 설치 SHA, diff/파일/manifest 해시, 관련 CI 증거, rollback 및 사후 검사 | 기존 Controller B 명세서 후보 및 정규 경로 |
| B Writer source 설치 | 기존 업무 효과 승인, 정확 후보/실제 HEAD=config.source, 변경 파일/preimage/after, 관련 테스트, 원본 Task·의존성 해당 범위, 기존 복귀/lease 계약 | 기존 Writer B 명세서 후보 및 정규 경로 |
| B 수집/DB/D1/게시/배포 | 해당 효과의 별도 기존 업무 승인 및 정규 계약 | 해당 기존 경로만; 초기 파일럿 자동화 제외 |
| 범위 초과/C/근거 부족 | 위임된 승인과 불일치 또는 미지원 | 해당 효과만 보류/기존 담당자 검토 |
기존 승인 범위 내 증거 미비는 준비·조회로 해소하고 사용자 재승인과 혼동하지 않는다. 실제 신규 효과만 사용자 결정 대상이다. 독립 작업은 계속한다.

## 4. 신뢰 경계
- 승인 근거는 보호된 정본의 정확한 revision 및 사용자 승인 범위/효과/대상과 연결한다. 요청/PR/Issue 본문이 자신을 승인할 수 없다. 기계 판독 가능 정책의 변경·위임 권한은 기존 권한자를 통해 별도로 검토한다.
- 판정 코드는 후보 PR의 임의 코드/워크플로/자유 텍스트를 권한 근거로 실행하지 않는다. 정확한 소스 SHA/신뢰 CI workflow 및 실제 성공 결과를 확인하고 stale/skip/취소/불명은 성공으로 인정하지 않는다. PR의 CI 검사는 권한 없는 격리 환경으로 제한한다.
- 초기 검증은 읽기 전용 토큰, 기존 무료 격리 실행기 재사용. 권한 있는 게시/제출 연결은 별도 검토 대상으로 두고 기존 owner 인증/보호된 브랜치/manifest 검증을 우회하지 않는다. 승인 엔진 스스로 정책/권한/검증 코드를 바꾸거나 자신의 변경을 승인할 수 없다.
- 승인 후 실제 실행기에서 원본 바이트/현재 상태/CAS/공유 lease/복원 조건을 재검증한다. 판정 이후 상태가 변하면 원래 승인 범위를 유지하면서 해당 요청만 중단 또는 재계획한다.
- 기존 requestId/원장으로 단회 실행. 결과 불명 시 기존 영수증 reconcile, 새 POST/자동 재실행 금지. 기존 복귀 및 독립 복구 경로 유지.
- 관리자 권한, 임의 shell/SQL/경로, 새 Runner/서비스/예약, 운영 데이터·공급자 호출 권한을 추가하지 않는다. 비밀/원자료는 결과나 commit에 포함하지 않는다.

## 5. 단계별 구현 및 합격 기준
1. [x] 현행 승인/요청/실행 경로 대조 및 설계 R1.
2. [ ] 기존 정책/manifest 스키마/검증기를 대상으로 효과별 기계 판독 모델과 순수 판정기 구현. 승인 근거가 보호된 출처에서 실제 검증되지 않으면 후보만 반환. 상태: ALREADY_AUTHORIZED / EVIDENCE_MISSING / OUT_OF_SCOPE / INVALID / WAIT_RESOURCE, 운영 실행 상태와 구분.
3. [ ] 기존 명세서 생성/검증기 어댑터 및 정확 SHA/해시 연결. 승인 후보와 운영 승인 상태 구분. A에 불필요한 새 절차 추가 금지.
4. [ ] 격리 CI shadow 검증: 기존 성공/거절 fixture, 근거 위조, CI 위조/누락/stale, 다른 업무/파일/호스트, C, PR의 정책 자기변경, 재생, CAS drift, 동시 실행, 실패 복구 및 결과 불명. 정상 A/B 후보와 음성 케이스를 검증하고 실제 요청/쓰기 0을 증명.
5. [ ] 기존 권한자·정본과 자동 승인 위임/정확한 게시·제출 인증을 검토한 뒤 정규 실행 경로 연결. 일반챗이 재승인 없이 준비할 수 있는 기존 상시 승인의 효과에 한정. 새 업무 승인이나 C 권한 자동 부여 없음.
6. [ ] 실제 필요한 승인 업무에서 제한된 A/B 순차 파일럿 및 원본 Issue/Run/설치 SHA/사후검사/JSON/TXT 회수. 인위적 B를 만들지 않으며 실제 업무 없는 상태를 운영 성공으로 표기하지 않는다. 운영 rollout은 현재 활성 경합/승인에 맞춰 기존 적용 대기열을 사용한다.

## 6. 진행 원장 및 다음 행동
- 2026-11-25: 설계 R1. 대상 저장소 main 기반의 격리 설계 브랜치 사용. 담당 브랜치와 운영 정본 변경 없음.
- 근거: .github/workflows/pc-job.yml, tools/maintenance-request.mjs(요청 생성/제출이며 승인 주체 아님), tools/maintenance-contract.mjs, writer-b/README.md, PC_AUTOMATION_STANDARD.md §5.
- 전체 6단계 중 설계 1단계만 완료(약 17%, 단계 기준; 운영 0%). 구현/CI/통합/실PC 검증 미실행.
- 다음 필수 행동: 기존 A/B 승인 검증 코드와 스키마의 입력/출력 매핑, 보호된 승인 출처 검증의 설계 및 순수 판정기/회귀 테스트 작성. main 및 운영 Workflow/PC/Task/DB/Writer/Controller는 이번 설계 작업에서 변경하지 않는다.

### 2026-11-25 후속 — 순수 모의 판정기 구현
- `ci-approval/shadow-decision.mjs` 및 `tests/ci-approval-shadow-decision.test.mjs` 추가. 기존 Controller/Writer 계약의 효과, SHA/범위, CI, preimage, 복귀, 중복 조건을 모델링했다. 모든 판정 결과는 SHADOW_ONLY이며 canPublish/canExecute는 항상 false다.
- 동일 함수와 30개 fixture를 JavaScript V8 환경에서 실행: 30/30 PASS. 저장소 파일 두 개를 원격 재조회했다. 저장소 Node CI 및 실제 검증기 연동 시험은 아직 미실행이다.
- 신뢰 출처 및 CI provenance는 현재 합성 fixture로만 표현한다. 실제 증거 인증이 아니며 자동 승인 권한은 생성하지 않았다. 새 운영 정책/Workflow/Issue 실행/PC 변경 없음.
- 단계 2는 순수 모의 판정기 구현 완료, 실제 보호된 근거 수집 및 기존 검증기 연동 미완료. 6단계 기준 1단계 완료 + 2단계 진행 중(약 25%, 추정). 운영 적용 0%.
- 다음: 기존 validateRequest / validateUpdateRequest / validateWriterBManifest에 대응하는 읽기 전용 증거/후보 어댑터를 구현하고 실제 Node 회귀 및 격리 CI 실행 경로를 검토한다. 권한 발행이나 실행 연결은 하지 않는다.

### 2026-11-25 후속 — 실제 검증기 연결 및 승인 후보 생성
- `ci-approval/contract-adapter.mjs`: 기존 validateRequest, validateUpdateRequest, validateWriterBManifest 및 manifestFingerprint 재사용. 형식/해시/현행값 대조와 신뢰된 출처의 인증은 분리한다. 반환 상태는 CONTRACT_MATCH/CANDIDATE_ONLY 또는 거절이며 모든 결과 canPublish/canExecute=false.
- Controller 후보는 승인 기록 및 CI PASS를 만들지 않는다. Writer 후보는 기존 validator 내부 구조검사만 수행하고 승인 상태 없는 계획을 반환한다. 두 후보 모두 PROPOSED_NOT_APPROVED, 기존 approvals/에 저장하거나 실행하는 명세가 아니다.
- 테스트 17건 추가(기존 30건과 총 47건). 원격 파일 확인. 기존 Controller Maintenance Source Tests의 격리 Windows CI에서 두 테스트를 실행하도록 후보 브랜치에만 경로/단계를 연결했다. 운영 Workflow·토큰 권한·Runner 변경은 없다. Node CI 결과는 아직 미확인.
- 단계 2/3 부분 완료, 실제 보호된 승인 근거/CI 증거 수집 미완료. 전체 약 40%(6단계 진행 추정), 운영 적용 0%. 다음: Draft PR의 격리 CI 실제 결과 회수, 보호된 승인 출처 및 CI evidence adapter, 위임 검토. 실제 승인 발행/실행 연결은 아직 비활성.

### 2026-11-25 후속 — 실제 CI 증거 읽기 어댑터
- PR #3545 HEAD `52e347c15e7933445951ee8173a544adb9793200`: Secret Scan [45591949415](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45591949415) SUCCESS, attempt 1, job 139128128814, 격리 호스트 확인·Gitleaks·Oxlint 단계 SUCCESS. 기존 Controller/C996 CI 관측: ZGMINI PC Secret Scan: completed/success; ZGMINI Controller Maintenance Source Tests: completed/success; C996 R5 Readonly Source Checks: in_progress/NONE. 아직 운영 승인이나 전체 Node 회귀 PASS 아님.
- github-ci-evidence.mjs와 17개 fixture 추가. V8 17/17 통과, 실제 GitHub 읽기 호출로 위 Secret Scan의 Run/attempt/job/step 일치 관측을 반환. checkout 실제 바이트, workflow 신뢰성, 업무 승인 출처는 아직 검증하지 않음. 모든 결과 canPublish/canExecute=false. 전체 준비된 회귀 64건(기존 47 + 신규 17), Node CI 전체 미확인.
- 기존 PR의 대기 중 CI를 취소하지 않기 위해 동일 HEAD를 기반으로 한 준비 브랜치 `codex/ci-auto-approval-evidence-prep-20261125`에만 보존. 별도 PR 없음. 기존 CI 결과 확인 후 원래 작업 브랜치로 통합하고 기존 격리 CI 테스트 목록에 신규 파일 연결 예정.
- 권한 출처 조사: GitHub branches/main API의 protected=false, protection.enabled=false, rulesets 목록 빈 배열. 상세 branch-protection API는 403. 이 관측은 기존 업무 승인 폐기를 뜻하지 않으나 보호된 CI 자동 권한 발행 근거는 확립되지 않음. 정책/권한 변경 없이 신뢰된 위임 출처와 변조 방지 검증을 별도로 설계한다. CI 성공만으로 승인 명세서 발행 금지.
- 단계 2/3/4 진행 중, 전체 약 45%(추정), 운영 0%. 다음: 기존 PR 실제 CI 회수, 준비 변경 통합 및 64건 Node 시험, 보호된 승인 출처 검증 설계. 운영 PC/정책/권한/요청 실행 변경 없음.

### 2026-11-25 후속 — 준비 변경 통합 및 64건 CI 연결
- 원래 HEAD 52e347c15e7933445951ee8173a544adb9793200의 CI 3종 최종 SUCCESS: Controller 45591949395, C996 45591949481, Secret Scan 45591949415. Controller job 139128128225의 shadow/candidate 단계 7 SUCCESS. 기존 47건 소스 시험 결과를 승계한다.
- 준비 커밋 d1c807bab953d7d1a1c68d619e3449f500832c75는 원래 HEAD의 직계 후손(3 commits, behind=0)이며 변경 3파일만 확인. 기존 소스 CI에 신규 17건을 별도 단계로 연결하고 누락 방지 scope 회귀 1건을 추가한다. 기존 시험 및 운영 경로 유지. 총 승인 시험 64건 + CI wiring 회귀 1건; 새 HEAD 결과 미확인.
- 중요: Controller CI는 PR head가 아닌 github.sha 통합 트리를 checkout한다. Run head_sha 및 성공 step은 관측 증거이지 실제 checkout 바이트의 증명이나 업무 승인 근거가 아니다. 향후 신뢰된 workflow revision, 통합 SHA와 부모, 실제 실행 트리, 승인 범위의 독립 검증을 연결해야 한다. 현재 자동 승인/실행 비활성. 기존 main, 운영 PC, 권한 및 보호 설정 변경 없음.
