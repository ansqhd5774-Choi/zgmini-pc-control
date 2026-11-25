# ZGMINI CI 기반 A/B 승인 자동화 설계 R1
기준: 2026-11-25 KST. 상태: DESIGN_CANDIDATE / 실행 비활성.
사용자 목표: 사전 정의된 조건을 충족하는 승인된 업무는 담당자의 반복 승인 판단 없이 CI가 판정하고 정규 실행까지 연결한다. 이 설계 문서는 신규 운영 승인 또는 승인 정책 변경 그 자체가 아니다.

## 0. 2026-11-25 사용자 확정 — CI 실행 주체 및 최소 검증 (현행 우선)

- 사용자 직접 결정: 기존 승인 A/B급 업무의 자동 승인 명세 발행 및 단회 제출을 위임하며, 실제 효과에 필요한 사실만 정확히 검증한다. 이후 실행 주체가 **GitHub CI**임을 명확히 정정했다. ChatGPT는 설계/개발/오류 수정 담당이며 런타임 판정·승인 발행·정규 제출의 필수 주체가 아니다. ChatGPT 예약, 일반챗 응답, 모델 댓글, 주기적 사용자 호출을 자동 승인 전제에서 제외한다.
- 실행 목표: 관련 CI 완료 이벤트 → 신뢰된 기본 브랜치의 고정 판정 경로 → 기존 업무 승인 및 필요한 증거 대조 → 기존 명세 생성/검증 → 인증된 정규 제출 경로 단회 실행 → 기존 Controller/Writer 수신·검증·결과 회수. 이벤트 기반이며 별도 ChatGPT 예약이 필요하지 않다.
- 기존 A급은 등록 operation, 인증, 정확 요청 범위와 해당 자원 조건만 적용한다. 일괄 CI·설치 CAS·복귀·전체 Runner 검사를 추가하지 않는다. B급은 기존 승인 효과, 정확 변경 파일/target/manifest, 관련 CI, 실제 변경 직전 CAS 및 공유 자원, 기존 복귀/사후검사와 단회 원장만 확인한다. 동일 신뢰 사실은 재사용하며 고정 읽기 진단의 correlation metadata를 실제 checkout 전제와 혼동하지 않는다. 무관한 업무 실패나 과거 사고를 전역 Gate로 만들지 않는다.
- CI의 소스 시험 환경은 읽기 전용으로 유지한다. 권한 있는 후속 경로는 후보 PR 코드를 권한 있는 환경에서 실행하지 않으며 실제 인증된 주체와 기존 수신 계약을 대조해야 한다. CI 자체를 owner로 가장하거나 owner 자격증명을 PR 환경에 노출하지 않는다. GITHUB_TOKEN이 기존 owner 인증과 동일하다고 가정하지 않는다. 자동 승인 엔진의 자기승인, C급·신규 업무 승인·DB/D1/게시/배포·보안/관리자 변경·권한 확대는 제외한다.
- 이번 사용자 결정은 위임의 방향과 범위를 명확히 하는 원문이며 개별 업무 승인 원본이나 독립 pin의 기계 판독·공급이 완료된 것은 아니다. 기존 권한 내 구현 가능 여부를 먼저 확인하며 별도 권한 확대나 인증 변경을 임의 실행하지 않는다. 기존 유효 명세/요청은 재발행하지 않는다.
- 현재 소스 회귀 CI 성공과 실제 무인 CI 발행/제출은 별개다. 기존 shadow 결과는 승인으로 승격하지 않는다. 다음 구현: 기존 GitHub workflow 완료 이벤트·기존 권한/수신기 계약의 실측을 바탕으로 CI 후속 실행 경로의 최소 설계 및 관련 테스트를 구현하고, 정규 인증·원장 연결이 입증된 경우에만 활성화한다. 기존 예약 변경은 불필요하다. 본 절은 아래 역사적 기록의 ChatGPT 담당 실행 해석보다 우선한다.

## 0-A. 제한 인증 계약 R2 — 운영 비활성 검토안

현행 46% 추정, 실제 무인 운영 0%. 이후의 역사적 75% 등은 당시 모의 구현 추정으로 현재 완료율이 아니다. CI 판정·기존 명세 검증·정규 제출 함수/CLI의 개발은 진전됐지만 실제 업무 승인 자동 발행과 실행 인증은 완료되지 않았다.

**권한자 결정 대기.** 아래 제안은 새로운 운영 승인 원본이 아니다. 기존 A/B 업무 위임만으로 인증 정책 변경을 승인된 것으로 간주하지 않는다. 반복적인 "계속" 지시는 개발 계속으로 처리하고 신규 운영 권한을 임의 활성화하지 않는다.

### 하나의 실행 흐름 및 최소 변경

1. 기존 CI와 main의 승인 명세 반영 이벤트를 사용한다. 읽기 전용 intake는 정확 관련 CI, 승인 범위, 소스와 파일 원본을 확인한다. 신규 업무 승인 또는 과거 승인 재발행은 금지한다.
2. 권한이 있는 고정 실행 경로만 기존 업무 승인 원본으로 승인 명세를 발행한다. 명세를 쓰는 권한과 운영 요청을 제출하는 권한을 효과별로 구분한다. 일반 PR의 CI 토큰에는 쓰기 권한을 부여하지 않는다.
3. 최초 운영 대상은 Controller B로 한정한다. 기존 독립 유지보수기의 폴링·정규 manifest·CAS/lease·복구·사후검사·효과 중복 원장을 재사용한다. 새 자동 승인 경로의 인증은 기존 owner 경로와 구분하고 운영 수신기에서 독립 검증한다. 기존 owner로 가장하지 않는다.
4. 승인 주체와 실행 주체를 인증할 수 있는 실제 자격 또는 신뢰 근거의 설치·설정은 권한자의 별도 결정으로만 수행한다. 보호되지 않은 main에 임의로 추가된 JSON, 봇 작성자 이름, CI PASS만으로 권한을 인정하지 않는다. 실행 가능한 권한이나 비밀을 이 Draft PR에 추가하지 않는다.
5. 동일 승인 효과의 원본 requestId/영수증을 재사용하고 결과 불명 시 동일 요청만 reconcile한다. GitHub Actions 두 이벤트가 각각 독립 POST를 수행하지 않도록 한다. 승인 발행/요청 접수/실제 설치 완료를 각각 별도 결과로 보고한다.
6. Controller B 실제 자연 업무 실증 이후 A와 Writer B를 기존 인증·이벤트 계약에 맞추어 별도 적용한다. Controller의 폴링 계약을 Writer/A에 일반화하지 않는다.

### 운영 권한 결정 대상 (한정)

- CI 전용 인증된 제출 주체 등록 및 해당 주체의 정규 수신 계약 변경: **Controller B의 기존 승인 업무에 한함**.
- 필요한 고정 권한 경계 및 실제 기존 업무 승인 원본의 신뢰 가능한 공급 방식 확인. 운영 권한 활성화 및 설정은 권한자 결정 전 금지.
- 기존 owner 인증, 개별 승인 효과, 기존 실행기 검증 및 보호 조치 유지. 신규 승인 업무, C급, 관리자·보안 정책 자체 변경, DB/D1/게시/배포 권한 확대, 소유자 자격증명 복제는 제외.
- 합격 기준: 실 CI 주체로 기존 승인된 Controller B 1건의 명세 발행·단회 제출·원본 readback·독립 유지보수기 접수·실제 설치와 사후검사 검증. 동일 요청 중복 0. 범위 밖 입력의 실행 0. 이후 동일 권한의 범위 확장은 별도 결정.

실제 승인 원본과 정규 인증을 확보하지 못했다면 추가 shadow 검증으로 전체 진행률을 올리지 않는다. 운영 활성화 결정이 남은 상태에서 기존 승인된 다른 업무를 멈추거나 새 전역 Gate를 추가하지 않는다.

## 0-B. 2026-11-26 사용자 승인 및 비동기 인증 정정 (현행 우선)

- 사용자가 신규 개발 지시 자체를 최초 업무 승인으로 인정하고 승인 범위의 A/B 자동 승인·실행을 명시 승인했다. 단계별 재승인은 제거한다. 범위 외 효과/C/관리자 권한 확대는 제외한다. 이 대화 기록은 운영 수신기에 공급된 기계 판독 승인 원본과 구분한다.
- 기존 OIDC 직접 검증 후보는 미활성 상태에서 교체한다. 독립 유지보수기의 비동기 Issue polling에 단명 bearer proof를 넣으면 만료/노출 문제가 생긴다. 토큰 저장, 사용자 자격증명 복제, 새로운 네트워크 서비스, 추가 예약을 하지 않는다.
- 제한 Controller B 경로: 고정 신뢰 workflow가 정확 Issue를 생성하고 readback 후 Issue 번호와 원문 SHA-256만 작업 로그에 기록한다. 유지보수기는 기존 인증된 GitHub API로 해당 run/attempt, 고정 workflow blob 원본, 성공한 job 및 실제 receipt를 대조한다. workflow pin은 독립 설치 정책에서 제공하며 후보 PR/Issue가 설정하지 않는다. pin이 신뢰하는 workflow 및 전이 실행 코드의 고정 SHA 검토가 선행되어야 한다. 관련 CI와 업무 승인, 기존 manifest/CAS/lease/rollback/효과 원장은 별도로 유지한다.
- 현행 구현은 receipt 생성/검증 계약과 회귀시험이며 실제 workflow 발행/수신기 통합/독립 pin 설치/운영 적용은 미완료. 이전 OIDC 파일은 운영에 반영된 적 없다. 기존 소유자 제출 경로는 변경하지 않는다.

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
5. [ ] 기존 권한자·정본과 자동 승인 위임/정확한 게시·제출 인증을 검토한 뒤 GitHub CI의 이벤트 기반 정규 실행 경로 연결. 기존 상시 승인 효과에 한정하며 ChatGPT/예약을 실행 주체로 요구하지 않는다. 새 업무 승인이나 C 권한 자동 부여 없음.
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

### 2026-11-25 후속 — 승인 원본 무결성 확인
- HEAD c85dc294f5150f836b09f350de930b0ecf5fff8e의 Controller CI 45596459687 job 139143696525: 기존 승인 판정/후보 단계 7 및 CI evidence 단계 8 SUCCESS. 전체 실행 종료는 별도 확인한다.
- 운영 정본 §5에서 이미 승인된 업무의 필수 유지보수는 정확한 효과 범위 내 재승인 없이 가능함을 확인. 변경 불가능한 승인 원본 확인은 신규 자동 승인 경로에만 적용하며 기존 승인이나 실행기의 전역 Gate로 사용하지 않는다.
- approval-source-integrity.mjs: 독립적으로 제공된 pin의 repository/revision/path/Git blob SHA/SHA256과 원본 바이트를 모두 비교. 일치해도 PIN_MATCH_ONLY이며 업무 승인 또는 발행 권한으로 해석하지 않는다. 외부 신뢰 pin의 설정·현재 유효성·권한 범위 매핑은 미완료. PR/Issue/변경 가능한 main 자체를 신뢰 root로 사용하지 않는다. 별도 신규 비밀키/서비스/관리자 권한을 요구하지 않는 방향으로 설계했다.
- 16건 회귀시험 추가 및 기존 격리 CI 연결. 총 승인 관련 시험 80건 + 기존 CI 연결 회귀 1건. 신규 16건 실제 Node 결과 미확인. 기존 CI 진행을 보존하기 위해 준비 변경을 별도 commit으로 유지한다. 실제 운영 승인/발행/실행 미활성.

### 2026-11-25 후속 — 정확한 기존 B manifest 범위 대조
- pinned-manifest-scope.mjs: 기존 승인 원본 무결성 검사와 Controller/Writer 계약 검사를 하나의 읽기 전용 경로로 연결. 효과, 승인 원본 경로, raw SHA256, target SHA, 요청 계약, 현재 설치/base-config 대조 및 기존 요청 상태를 비교한다. 역사 fixture는 과거 범위 대조용이며 신규 승인이나 실제 현재값이 아니다. selective Controller 별도 pin 및 다른 B 효과는 이번 기본 범위 대조에서 제외한다.
- EXACT_MANIFEST_SCOPE_MATCH_ONLY는 원본과 요청의 일치 관측이며 자동 승인 발행의 근거 자체가 아니다. 독립 trust pin 출처, 신규 업무의 기존 사용자 승인과 필수 유지보수 매핑, 실제 CI tree/현재 상태 및 one-shot claim의 독립 확인은 미완료. A의 기존 경로 및 기존 B 승인 실행기는 변경하지 않는다.
- 17건 회귀시험을 기존 격리 CI에 연결(승인 관련 총 97건, 기존 wiring 회귀 1건 별도). 신규 테스트 실행 결과 미확인. 운영 변경/권한 확대 없음. 기존 PR CI 중에는 준비 브랜치에서 유지하고 종료 후 원래 PR에 fast-forward한다.

### 2026-11-25 후속 — 기존 실행 요청 형식 연결
- 754ecd4f97c991960c0eb48995bb7da9dcf8b273의 CI 3종 SUCCESS(45597113597/45597113616/45597113786); 승인 관련 80건 통과. 기존 준비 커밋 bec6be792de14b3eec17c0e578b3eed14cc566d2을 원래 Draft PR #3545에 fast-forward, 97건 CI 등록.
- request-preview.mjs는 정확한 기존 B manifest 범위 검사에 성공한 경우 기존 Controller/Writer 제목·라벨·본문을 구성하고 기존 requestId/본문 SHA256을 보존한다. Writer 유지보수 모드별 라벨을 기존 계약에 따라 결정한다. Controller 기존 readback 검증기와 형식 호환 회귀시험 포함. REQUEST_PREVIEW_ONLY, 외부 제출/승인 발행/권한 부여 없음.
- 신규 12건 시험(승인 관련 총 109건), 기존 격리 CI에 연결 준비. 원래 PR의 진행 중 CI를 취소하지 않도록 준비 브랜치에서 보존한다. 실제 CI 결과 미확인. 신뢰 pin 발급 출처 및 현재 유효성, 독립적인 one-shot claim, 기존 승인 범위 내 신규 manifest 발행은 미완료. 기존 Controller/Writer 제출/복구 계약을 변경하지 않는다.

### 2026-11-25 후속 — 실제 CI checkout 계보 검증
- bec6be792de14b3eec17c0e578b3eed14cc566d2 CI 3종 SUCCESS(45598053306/45598053303/45598053322), Controller job 139149268312 단계 7~10 SUCCESS. 승인 관련 97건 PASS. cbab8ab244a6efe1431d443cce0697c3726d93b7을 기존 PR #3545에 통합, 신규 109건 CI 등록.
- 실제 장애 변수: Run 45598053306의 immutable head_sha는 bec6be7이나 조회 시 pull_requests[0].head.sha는 후속 cbab8ab, base.sha는 501668e. 원본 job 로그의 checkout/CI_TESTED_INTEGRATION_SHA는 ca195cf12196f5e1e2cd294fa239ce721712706a이며 Git commit 부모는 cedca8c41b35dd75bed87a7951f128bef137c80b와 bec6be7이다. 해당 통합 tree 7b6863225be931a355115faf9b9eadd5b9972e80의 workflow blob dc5fbfb12cb45bae86d6ddb24408c5e47635fea8은 PR head workflow blob e447bcc4bf5de137fa82e0bb08e8b771ade64dd2와 다르다. 현재 PR association을 역사 checkout의 증거로 재사용하지 않는다.
- integration-tree-evidence.mjs: 실제 checkout 로그와 고정 marker, 정확한 run/job/attempt, 성공 단계, 통합 commit/tree와 양 부모, 독립 workflow blob pin을 대조한다. INTEGRATION_TREE_MATCH_ONLY는 관측이며 현행성/신뢰 pin 발급/업무 승인 보증이 아니다. 신규 13건 시험 및 기존 CI 연결(총 122건), 실제 신규 CI 결과 미확인.
- 기존 Writer B는 owner actor/sender/issue user 및 opened event, Controller B는 owner actor와 기존 승인 manifest를 요구한다. 연결 계정 조회는 owner login으로 확인되었으나 CI의 자동 실행 주체 인증과 별개다. 기존 owner 인증을 가장하거나 GITHUB_TOKEN만으로 정규 요청 발행을 보장하지 않는다. 보호된 권한 위임 출처를 확립할 때까지 실제 자동 승인 발행 및 제출 미활성. 기존 main/운영 설정/권한 변경 없음. 기존 CI를 취소하지 않기 위해 준비 브랜치에 보존한다.

### 2026-11-25 후속 — 상시 승인 위임 계약
- cbab8ab244a6efe1431d443cce0697c3726d93b7의 CI 3종 SUCCESS(45598854163/45598854185/45598854166), Controller job 139152057137의 요청 preview 단계 11 SUCCESS. 승인 관련 109건 PASS. 553424e376e4600d2709db25776acd0ce4b47d19를 기존 PR #3545에 통합, 122건 CI 등록.
- 신규 owner-delegation.mjs는 기존 사용자 업무 승인 SHA256, 정책 revision, 제한 효과/소스/전용 브랜치/정확 파일 목록/유효기간이 고정된 구조화 위임 원문을 검증한다. GitHub 실제 저장소 ID와 Owner ID, 댓글 ID/raw SHA256/미편집, 원본 Issue 상태를 대조한다. 같은 업무/파일 범위 안에서 후속 target SHA는 새 사용자 승인 없이 검증할 수 있도록 모델링했다. 사용자 계정/댓글을 CI로 가장하지 않는다. C, 범위 밖 파일/브랜치/업무, 권한 변경은 제외한다.
- 이 구조는 기존 승인 증거의 기계 판독 후보이다. 실제 Owner 원문이나 독립 설정 pin은 발행하지 않았다. 조회용 객체나 caller pin만으로 운영 위임을 생성하지 않으며 권한 변경 여부와 실제 diff는 별도 신뢰 출처에서 검증해야 한다. 현재 반환 DELEGATION_SCOPE_MATCH_ONLY, canPublish/canExecute=false. 18건 신규 시험, 총 승인 시험 140건 준비.
- 실행 경로 선택: CI는 정확한 증거만 제공하고, 기존 owner 인증을 가진 신뢰된 제출 경로가 위임/현재 상태/manifest를 다시 검증하여 정규 제출한다. 기존 owner 인증을 격리 PR CI에 노출하거나 bot을 owner로 인정하지 않는다. 해당 제출 주체의 상시 운용과 독립 pin 공급 경로가 확립되지 않아 자동 발행은 미활성이다. 기존 정규 실행기·main·운영 PC·권한 변경 없음. 기존 PR의 실행 중 CI를 취소하지 않도록 준비 브랜치에 보존한다.

### 2026-11-25 후속 — 위임 원본·변경 파일 읽기 연결
- 553424e376e4600d2709db25776acd0ce4b47d19 CI 3종 SUCCESS(45600394003/45600394095/45600394040), 승인 관련 122건 PASS. 2cd580251b4658a991e0d1e81981713e6caea61a를 기존 PR #3545에 통합, 140건 CI 등록.
- delegation-evidence-reader.mjs: 읽기 전용 GitHub adapter로 repo/Issue/댓글/현재 branch/정확 base...target compare를 수집하여 실제 변경 경로를 기존 위임 검사기에 전달. 누락된 commit, divergent base, rename/delete, 변경된 원본 또는 branch, 범위 외 파일을 거부. 파일 경로만으로 권한 변경 부재를 주장하지 않는다. 실제 파일 바이트·권한 의미 검증과 독립 pin 공급은 별도 미완료. 10건 시험 추가(총 150건 준비), 기존 CI 결과 보존을 위해 준비 브랜치 사용.
- 실제 GitHub open Issue 검색에서 ZGMINI_CI_STANDING_DELEGATION_V1 일치 결과 0건. 검색 결과는 승인 부재의 완전한 증명이 아니며 기존 자연어 업무 승인과 구분한다. 실제 기계 판독 위임 원본과 독립 pin은 아직 확보되지 않았다. 승인 발행 및 운영 실행 미활성. 진행률은 전체 자동 승인·실행 기준으로 기존 75% 추정치를 유지하며 시험 파일 증가를 운영 완성으로 계산하지 않는다.

### 2026-11-25 후속 — Controller B 통합 모의 판정
- 2cd580251b4658a991e0d1e81981713e6caea61a CI 3종 SUCCESS(45601617713/45601617937/45601617740), 승인 관련 140건 PASS. 05808ce9b47a8ea03cbfc1067ce180bb3bc0c45e을 기존 PR #3545에 통합하여 150건 CI를 시작했다.
- controller-candidate-review.mjs: 후보 생성기, live 전제, 위임·diff 수집기, CI 통합 tree 검증기를 한 경로로 연결. 정확 target/base/파일 manifest digest, 실제 diff 파일 목록 및 후보/통합 tree 양쪽의 파일 SHA256을 대조한다. 신규 10건 통합 모의 시험(총 160건 준비). 모든 결과 SHADOW_ONLY; 승인 발행/제출 없음. Writer는 별도 본체 저장소 CI 증거와 로컬 합성 SHA 계약 때문에 동일한 Controller CI를 전용하지 않는다. A 기존 조회 경로 변경 없음.
- 최종 운영 활성화의 핵심 미해결 조건: (1) 기존 사용자 업무 승인에 연결된 실제 구조화 위임 원본 및 독립 pin, (2) 신뢰된 실행 주체가 독립 확인한 실제 CI 대상과 필요한 업무별 단계, live 상태, 권한 변경 부재, (3) 기존 소유자 인증과 원자적 단회 제출 원장의 상시 운영 연결. 이 통합 모의 판정은 위 조건을 인증하지 않으며, 자동 발행 권한을 자체 생성할 수 없다. 명세서 후보를 APPROVED_B로 간주하지 않는다. 운영 0%, 전체 추정 75% 유지. 기존 PR 실행 중 CI를 보호하기 위해 준비 브랜치 보존.

### 2026-11-25 후속 — Writer B 통합 모의 판정
- 05808ce의 Controller job 139163617160 위임 수집 단계 14 SUCCESS 확인. C996 및 Secret Scan SUCCESS. 전체 Controller CI 종료 및 후속 통합은 별도 확인한다.
- 본체 실제 Node CI 45583189319 / job 139098078904의 push head 249dd6ab57561fe3a512906a770f402918e8c376, workflow ID 377770281, repo ID 1398455648, checkout log의 git log -1 --format=%H 직후 동일 SHA를 확인. Writer는 Controller CI 결과를 재사용하지 않는다.
- writer-candidate-review.mjs: 본체 정확 push CI 및 workflow blob pin, 원격 diff, 로컬 HEAD/config·파일별 preimage·보호 파일, 후보 SHA256을 대조한다. 원격 diff base와 운영 로컬 overlay base는 분리한다. 초기 신규 자동화 후보는 자연 유휴 전체 파일 overlay에 한정하고 기존 승인된 insertion/유지보수 창 경로는 그대로 유지한다. 실제 자동 발행 없음. 12건 추가(총 172건 준비), 신규 Node 시험 미확인.
- 실질 차단: 구조화 위임 원본/독립 pin, 검증된 상시 제출 주체와 실제 PC 상태가 아직 미확보. 추가 모의 시험 수로 진행률을 올리지 않는다. 기존 승인 범위/실행기/운영 PC/main 변경 없음. 자동화 권한이 자체적으로 자신을 승인하지 않도록 한다.

### 2026-11-25 후속 — 기존 Controller 단회 제출기 연결
- 89934759816e48b9f4ded66d4af7fcfa3896bc15 Controller job 139167908223의 Writer 후보 검증 단계 16 SUCCESS 관측. 전체 CI 종료는 별도 확인한다.
- 기존 tools/maintenance-request.mjs에 opt-in submit-prepared 경로 및 submitPreparedMaintenanceIssue를 추가한다. 기존 정확 requestId/제목/라벨/본문을 변경하지 않고 Owner 인증·비공개 저장소·main 승인 manifest raw bytes·실제 설치 SHA를 기존 validateUpdateRequest로 재검증한 뒤 기존 submitMaintenanceIssue의 영수증/단회 POST/readback을 사용한다. 후보 wrapper나 모의 판정 자체는 허용하지 않는다. 실패/응답 불명은 기존 동일 receipt reconcile, 새 POST 금지. 기존 prepare/submit/reconcile/verify 및 운영 실행기는 유지한다.
- 기존 maintenance-request 회귀시험에 6건 추가. 실제 네트워크 제출·운영 설치·권한 변경 없이 fixture로 검증한다. 기존 승인 원본이 main에 존재하는 Controller B 요청에만 해당한다. 신규 자동 승인 발행 권한이나 무인 CI Owner 인증은 생성하지 않는다. 기존 CI 결과 보존을 위해 준비 브랜치에서 검증 대기. 사용 가능한 CLI 경로와 실제 자동 실행 활성화를 구분한다.

### 2026-11-25 후속 — Writer 정규 소유자 제출 연결
- 8993475의 CI 3종 SUCCESS(45603404536/45603404651/45603404701), 172건 PASS. Controller 제출기 2abe746을 기존 PR #3545에 통합했다.
- tools/writer-request.mjs: 이미 승인된 main 원본과 정확 requestId/본문을 사용하는 opt-in submit-prepared 및 reconcile. 기존 Writer 수신기에서 순수 요청/manifest/라벨 검증만 분리하여 동일 계약 재사용. 실제 opened event/owner 인증 및 process-local seal은 수신기에서만 생성한다. 소유자 인증, 비공개 repo, raw hash, PC HEAD/config 대조, requestId 고정 receipt 및 단회 POST/readback을 적용한다. 무인 승인 발행이나 CI의 소유자 권한은 부여하지 않는다. 8건 신규 시험 및 기존 Writer 계약 시험 연결. 실제 제출/설치 없음. 운영자 receipt-directory는 고정된 기존 신뢰 실행 주체에서 관리해야 하며 다른 디렉터리 사용에 의한 중복 제출은 별도 원장 검증이 필요하다. 새 CI 결과 확인 전 준비 브랜치에 보존한다.

### 2026-11-25 후속 — CI 실행 경로의 실제 인증 경계 및 최소 연결 결정
- HEAD 6e2af54b919429d55aeacdddbf699376e8a270e1 CI 3/3 SUCCESS: Controller Maintenance 45625447231, C996 45625447255, Secret Scan 45625447171. 완료 이벤트 수신 14건 회귀를 실제 source-only CI에서 통과했다. 기본 브랜치 workflow_run 실제 실행은 아직 미검증.
- 기존 main의 config/operations.json allowedActors, tools/maintenance-agent.mjs ALLOWED_ACTORS, writer-b/contract.mjs opened sender/issue actor는 owner만 허용한다. agent-handoff/bot-direct-route.mjs의 기존 정본은 GITHUB_TOKEN으로 생성한 Issue가 후속 Issue 이벤트 workflow를 시작하지 않는 점과 동일 격리 job의 메타데이터 직접 라우팅을 명시한다. 이 경로는 운영 요청 승인 권한이 아니다. 따라서 CI token을 owner로 가장하거나 bot을 기존 전역 allowedActors에 추가하는 방식, bot Issue가 Writer/A workflow를 자동 실행한다고 가정하는 방식은 제외한다.
- 최소 구현 후보: CI는 완료 이벤트와 실제 업무 승인 원본 및 범위에 따라 정확 manifest/요청 후보를 생성하고 기존 인증된 제출 경로에 연결한다. 기존 owner 인증을 가진 정규 제출 주체를 자동 기동할 수 있는 이미 승인된 경로가 있는지 확인한다. 있다면 기존 submit-prepared/receipt를 그대로 사용하고 ChatGPT/새 예약/새 토큰/별도 서비스는 요구하지 않는다. 없다면 CI 전용으로 한정된 실제 발행·제출 인증 계약을 사용자 승인 범위와 보안 경계에 맞춰 별도 설계·검토해야 하며, 기존 운영 수신기의 owner-only 검사나 CI 권한을 임의 변경하지 않는다. CI가 판정 주체이며 인증된 제출기와 실행기는 구현 구성요소로만 역할을 구분한다.
- 남은 핵심은 독립적인 기존 업무 승인 원본의 실제 공급 및 자동 기동 가능한 정규 제출 인증이다. 현재 추가 승인 근거나 새 권한을 임의 발행하지 않는다. 무관한 업무 및 기존 A/B 경로에는 새 Gate를 추가하지 않는다.
