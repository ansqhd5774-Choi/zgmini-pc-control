# ZGMINI 전체 작업 통합 실행계획 — 2026-11-13 (R1)

> **용도:** 프로세스 총괄 브랜치의 실행 순서·역할·완료 기준을 한곳에 고정한다. 이 문서는 **업무 조정 문서**이며 운영 PC 설치, B/C 승인, 기존 산식·수집 주기·DB·D1·Cloudflare 배포 또는 타 대화 실행을 승인하지 않는다. 실제 실행·관측·출처는 최신 제어 `main`의 `AGENTS.md`, `docs/GENERAL_CHAT_START.md`, `docs/PC_AUTOMATION_STANDARD.md`, `docs/PC_OPERATING_SYSTEMS_CANONICAL.md`, 기존 기능별 브랜치/승인, 정확한 PC JSON/TXT·Runtime·D1/API/UI를 우선한다.

## 0. 최종 목표와 작업 분류

- **기능 완료의 실체:** 승인된 PC 공급자 원자료 GET → 원자료와 관측일·source SHA·checkpoint를 로컬에 저장·재조회 → 저장 원자료만으로 계산 → 로컬 결과 저장 → 승인된 공개 결과만 D1 게시 → Production API 및 PC/모바일 UI의 값·단위·결측·날짜·sourceVersion·storedAt 검증. 데이터가 없는 경우 0으로 위장하지 않는다.
- **총괄의 실제 역할:** 공통 장애 인계, 범위가 겹치는 Controller/Writer/DB 자원 조정, 정확한 인계 기록·원본 소스/실행 결과 반환. 각 기능의 구현·공급자 수집·계산·게시·화면 완료는 **기능별 원담당**의 책임이다. GitHub Issue 댓글은 **다른 일반 ChatGPT 대화의 자동 수신·실행**이 아니다.
- **상태 정의:** `DONE`=해당 승인 기능 범위의 실측 완료; `RUNNING/READY`=실제 실행 또는 승인된 독립 실행 가능; `APPROVAL_PENDING`=정확한 신규 효과에 필수 승인 없음; `NOT_REGISTERED`=원하는 operation만 운영 Controller에 없음; `STATE_UNKNOWN`=증거가 부족함; `BLOCKED`=해당 필수 실행에 실제 권한/자원/검증 실패; `DEFERRED`=자연 사건/장래 관찰을 요구하는 별도 후속.
- **진행률 비혼합:** 아래의 %·n/m은 각 기능 담당자가 확정한 고유 분모다. 서로 평균하거나 PR/CI/문서/예약 결과를 원자료·공개 점수 완료로 환산하지 않는다. 완료 증거의 재검증은 source·config·Runtime 변경 또는 충돌 증거가 있는 범위에서만 한다.

## 1. 전체 상태판 — 실제 다음 단계의 출발점

| 업무 / 책임 | 마지막 인정 완료점(원본 출처) | 잔여 비율 / 상태 | 다음 실제 필수 실행 1개 | 범위 밖 병목 |
|---|---|---|---|---|
| **물가지표** / 물가 원담당 | 전체 **42%**; 26개 중 23개 원자료, 신규 공개 7개 중 4개 유효; [A #1334](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1334) | 58% 미완료 · **APPROVAL_PENDING**은 정확한 단회 B에 한정 | [B manifest Draft #1336](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1336)의 동일효과·현재 PC source PIN 승인 여부 결정 | #996 C 복구 완료, 09:00 수집 제한, 신규 observer 설치를 일반 Gate로 추가하지 않음 |
| **시장 캘린더** / 캘린더 원담당 | **95%**; 기존 Treasury 365일 수집·계산·게시·공개 검증 보존; [기능 Draft #1051](https://github.com/ansqhd5774-Choi/zgmini/pull/1051) | 5% 미완료 · 원문 독립 감사 A만 **NOT_REGISTERED** | `source-inventory-runtime-readonly`의 운영 미등록 여부/정확한 승인 최소 설치 범위를 공통 적용 담당과 확정 | 기존 공개 수집·게시를 C 복구 때문에 중단하지 않음 |
| **테마 공포탐욕** / 테마 원담당 | **20%**; 기존 공개 10개, PC 피드 6개 식별, 공개 정상 **0/10**; [원담당 #1009](https://github.com/ansqhd5774-Choi/zgmini/issues/1009) | 80% 미완료 · **EVIDENCE_PENDING** | 설치된 승인 읽기 경로로 6개 피드/R178 checkpoint와 R181 정확한 FIRST FAIL 확인 | 익명 가격 API·재배포 권한 미검증 시 수집·게시로 확대 금지 |
| **고용 R6** / 고용 원담당 | **7/8(87.5%)**; 최종 29/29 점수 READY 목표; [기능 Draft #1036](https://github.com/ansqhd5774-Choi/zgmini/pull/1036) | 1/8(12.5%) 미완료; 마지막 단계 내부 운영 검증 **0/5** | 기존 #1217·#1227 미접수 결과 보존 후 **현재 승인된 R6 원자료 조회 경로**에서 DOL 결손 위치 확인 | 과거 실패 요청 ID 재발행·#996 C 완료를 모든 독립 작업 선행으로 강제하지 않음 |
| **R10 Alpaca 제외** / R10 원담당 | **5/5(100%) DONE**; [B #1320](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1320), [A #1323](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1323), [종료 원장](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6826099930) | **0% 잔여** | **없음**. 승인된 금지 효과/마지막 유효 결과 보존을 종료 | 장래 자동 갱신·D1 관리자 SQL을 기능 재개 Gate로 추가하지 않음 |
| **D05 원자료 계보** / D05 원담당 | 승인 Writer 소스 **12/12 설치**, [B #1234](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1234); 진단 소스 [PR #1236](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1236) **병합** | 실제 1년치 기록 **0/68(0%)**, 운영 진단 **NOT_REGISTERED/UNKNOWN** | 병합된 `d05-lineage-readonly`의 **실제 운영 Controller 등록·승인 설치 여부** 확인 → 최초 실PC A 원본 조회 | PR 병합=PC 설치/JSONL 68건 성공 아님 |
| **단일 중앙 인계** / 프로세스 총괄 | 자연 Writer B #1063→#1068, 수정·성공 CI·원본/중앙 영수증; **8/8(100%)** | DONE; 신규 인계 대기 0건(마지막 조회) | 유효한 새 인계가 있을 때만 최대 1건 원본 인증→수리→반환 | 과거 완료 인계를 재선정하거나 타 대화 자동 수신을 가정하지 않음 |
| **격리 Writer B intake 확장** / 프로세스 총괄 | **4/5(80%)** · 기존 격리 Windows 실행/접수 증거 | 마지막 자연 적격 실패 전 과정 **DEFERRED** | 실제 수리 가능한 자연 실패 1건이 접수될 때만 실증 | 시험용 장애/원본 B 재실행 만들지 않음 |
| **공유 자원 수명주기** / 총괄·공통 적용 담당 | **4/5(80%)** | 실제 소유권 해제→대기 작업 재계획 증거 **DEFERRED** | 기존 owner·lease와 실제 해제 증거 발생 시만 마지막 단계 판정 | 다른 기능의 독립 작업 Gate가 아님 |
| **#996 Controller C 복구** / 단일 C 원담당 | 기존 R3/R4 읽기 증거·native 부정 시험, [#996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996), [Draft #1222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1222) | **NO-GO / STATE_UNKNOWN**, 실제 C 복구 성공 0 | 마지막 실제 C 시도 후 Workflow/backlog/claim/lease 보호 원본 결과의 승인된 읽기 확인·독립 C 경쟁 삽입 보호 설계 | C 실행 권한·원본 보호 미확정 동안 추가 C·강제 unlock·lease 삭제·기존 requestId 재실행 금지 |

**예약 검증 판정(2026-11-13 사용자 지시):** `PASS — USER_ACCEPTED` / **완료 100%**, 기능별·공통 필수 잔여 작업 및 전체 완료 Gate에서 **제외**. 이는 사용자의 **검증 종료 승인**이지 미관측 정기 Run이 성공했다는 Runtime 증거가 아니다. 기존 매시간 중앙 예약의 활성 상태/원래 일정은 유지하며, 예약 자연 갱신을 새 선행 단계로 만들거나 별도 예약을 생성하지 않는다.

## 2. 실행 순서 — 전체 공통 Critical Path와 병렬 Lane

### P0 — 지금 가능한 독립 실행을 동시 진행 (각 원담당)

1. **물가:** 운영 PC 현재 source `05d7ae49e0a84cbeebd90ef4de6dd7284094bf97`와 [A #1326](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1326) source/config/checkpoint·4파일 해시 PASS를 재사용하여 **#1336 동일효과 1회 승인 결정**을 요청. 검토 중에는 기존 공식 BLS/Census 원본·값/결측·계산 계약을 소스·읽기 전용으로 점검 가능.
2. **테마:** 승인된 기존 Reader·Writer read-only 경로가 읽을 수 있는 6개 피드와 R178 checkpoint를 분리 조회하고, R181 정확한 실패 로그·코드·첫 오류를 확보. 공급자 보유 데이터/이용권/공개 허가가 없는 경우 **추정 계산·게시 금지**.
3. **고용:** 과거 A [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217)/[#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227)는 원래 결과 JSON/TXT 없이 `PC_JOB_INTAKE_NOT_OBSERVED`로 구분하되, **이미 정상 실행한 A**와 기능 저장소의 공식 DOL source을 재사용해 결손 주/지역 위치 확인. 신규 operation이 미설치면 **그 operation만** #68 공통 적용 대상으로 인계.
4. **시장 캘린더:** Treasury 365일 원문 증거 요건(기간·행수·원문 지문·중복·WAL/checkpoint)과 기존 결과를 비교; 필요한 미등록 `source-inventory-runtime-readonly` 설치 승인 범위만 정밀화.
5. **D05:** 이미 완료된 12파일 B 설치 및 진단 PR 병합을 재사용해 **실제 설치 Controller의 operation 지원 여부**를 점검하고, 신규 A 적용이 필요할 때 그 파일·해시만 #68에 신청.
6. **R10:** 5/5 완료 보존. 원자료 재수집·R10 공급자/건강도 재검증·개별 앱 재배포 작업 생성 금지.

**병렬화 규칙:** GitHub 읽기·독립 source 분석·fixture/회귀 CI·타 기능의 승인 범위 검토는 병렬 진행할 수 있다. 실제 같은 `E:\\ZGmini\\data`/Core lock/Writer checkpoint/Controller·Scheduler 공유 파일의 **쓰기만 기존 lease/단일 적용 owner로 직렬화**. 6개 운영 Runner 전부 유휴·#996 C 복구를 P0의 전역 전제조건으로 요구하지 않는다.

### P1 — 승인·기존 등록 확인이 필요한 정확한 실행

- **물가 단회 B:** [#1336](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1336) `DRAFT_NOT_APPROVED` 상태인 신규 manifest를 기존 승인된 효과에 한해 owner 판정. 기존 B [#1177](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1177)는 소유권 관측 STOP으로 **소비됨**. 명시 승인·원본 SHA256·변경 4파일 해시·기존 Writer 독점 잠금·Workflow opt-in이 맞을 때만 **새 고유 단회 requestId 1건**; 미승인 opt-in 변경/재시도 금지. Core Task→Node→실제 E: lock 소유권 관측은 **기존 B 내부 12분 보호 로직**을 재사용하고, 못 보면 STOP. A/heavy 210초 observer 설치·#996 C 복구·09:00 실행 시각은 기본 Gate가 아님.
- **Controller 읽기 operation (2026-11-13 실제 Git 바이트 감사 완료):** 운영 설치 Controller `badad9124157879d7a645b64f2768113d632355b`의 `config/operations.json`은 **31개**, 제어 `main=1ab6a6147b62f265aeafdd32af0db545e5ba48c7`은 **37개**. 추가된 6개 A는 **`d05-lineage-readonly` / `employment-r6-collection-evidence-readonly` / `inflation-core-lock-observation-readonly` / `shared-resource-release-readonly` / `source-inventory-runtime-readonly` / `writer-b-1063-recovery-readonly`**; 기존 31개 operation 삭제/내용 변경 **0개**. GitHub `controller/` 디렉터리 두 ref의 파일 blob 직접 대조는 **13개 파일 차이(기존 5개 변경·신규 8개, 이 중 `.test.mjs` 1개 비배포)**, 추가 `config/operations.json` 1개. 핵심 `controller/operations.mjs`가 새 모듈을 정적 import하므로 3개 기능의 신규 파일만 선별 덮어쓰기 불가. 테스트 비배포 처리는 기존 [PR #1333](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1333) main 병합 범위를 재사용. **이는 SOURCE_ONLY 설치 차이 확인이지 12개 Runtime 파일+설정의 승인·실설치나 #996 lock 해제 증거가 아니다.** 공통 단일 owner가 실제 설치 Maintainer/현재 lease·원본 해시·기존 승인·최소 누적 영향과 정확한 manifest를 판단; 실제 #996과 겹치는 공유 쓰기만 보류하고 이미 설치된 A·독립 개발은 지속.

### P1.1 — 2026-11-13 실행 전 정적 차단 판정: Controller 6개 A 등록

**현재 권한·실설치 판정이 아닌 GitHub 바이트/계약 감사** ([공통 원장 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)):

1. 운영 Controller 마지막 원본 `badad9124157879d7a645b64f2768113d632355b`의 `config/operations.json` **31개**, 승인 제어 source의 같은 설정 **37개**. 기존 31개 operation 및 보호 정책 필드 모두 바이트/값 동일. 신규 6개 중 5개는 A/light/60초, `inflation-core-lock-observation-readonly`는 A/heavy/**240초·minimumFreeMiB=1536**.
2. 제어 `main/tools/maintenance-contract.mjs::validateControllerConfigTransition`의 실제 조건을 고정 데이터에 독립적으로 대입하면 **`purpose=pc-controller-maintenance`는 예상 `CONTROLLER_NEW_OPERATION_NOT_READONLY_A` 거부**, **`purpose=pc-controller-heavy-readonly`는 신규 operation 등급·시간·메모리 형식 검사는 통과**한다. 이는 **정적 조건 모의 판정**일 뿐 manifest 전체 승인·새 유지보수기/PC 실행·실제 Runner 결과 PASS가 아니다. heavy scope는 별도 정확한 기존 B 승인 계약을 요구한다.
3. 설치본과 제어 source의 `controller/` 차이는 **신규 8·기존 변경 5 = 총 13 Git 경로**, 그중 `controller/inflation-core-lock-observation-readonly.test.mjs` 하나는 **소스 테스트/비배포**. 따라서 **배포 경로 = Controller 실행 모듈 12 + `config/operations.json` 1 = 13개**(신규 모듈 7 + 변경 기존 모듈 5). `controller/operations.mjs`의 정적 import 때문에 Treasury·D05·고용 3개만 독립 복사할 수 없다.
4. 오래된 `badad912...` **저장소 소스**의 `tools/update.mjs`는 `*.test.mjs`를 `ALLOWFILE_DIFF_MISMATCH`/디렉터리 `TARGET_TREE_PATH` 검증에서 제외하지 못한다. 최신 `main`은 승인된 [PR #1333](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1333)으로 이를 수정했다. **실제 PC의 독립 유지보수기 설치 바이트·버전은 아직 미확인**이므로, 구형 소스가 실제 실행된다고 단정하지 않되 확인 없이 현재 배포 manifest를 실행하면 안 된다.
5. **정확한 후보와 새 유지보수기 코드 구분:** `d2f0832e9afa8ab924343544ac30da045eb0307b`는 **Controller/`config/operations.json` 변경 최종 후보 조상**이다. 해당 SHA부터 이전 점검 HEAD `08d64f82ddf85380c1786b82313412ef9620a1fc`까지 후속 6커밋은 결과 JSON/TXT만 추가했다. **이후 현재 제어 `main`은 [PR #1050](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1050)의 source-only `tools/update.mjs` 수정 병합 SHA `d73483e2a37fef4dd38d1313088efc9c20b82219`로 변경됨.** 변경은 정규 7필드와 승인된 writer-preimage 9필드의 두 기존 backlog 재접수 경로 공유 검증으로 한정; 격리 Windows [CI #43297607965](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43297607965) **83/83 PASS, fail 0**, PR Squash 병합 원격 readback PASS. **이 새 유지보수기 소스는 운영 PC 실설치/사후 lease 복구를 의미하지 않는다.** Controller target PIN을 무조건 최신 결과 SHA로 옮기거나, `d2f0832e...`를 **새 유지보수기 설치 SHA**로 오인하지 않는다. 실제 `git merge-base`, 승인 PR·manifest 조상, 운영 PC의 **독립 유지보수기 실설치 version**, owner·lease·보호 원본 및 B 범위가 명확해지기 전 새 Controller B 실행 금지. `.github/workflows/pc-job.yml` 소스와 정규 `controller/config` 배포 대상은 이 fix로 변경되지 않았다.
6. **다음 필수 실행은 단 하나:** 공통 단일 적용 owner가 운영 PC의 실제 독립 유지보수기 source/계약(테스트 비배포 수정 포함 여부)과 **#996 C 원본 claim/lease 공유 설치 충돌 여부**를 승인된 읽기 경로로 확인한 뒤 필요한 B 범위·immutable source/실제 before 파일 해시를 선택. 구형 source/보호 상태 미확정이면 **해당 공유 설치만 `BLOCKED/STATE_UNKNOWN`**, 독립 기능/기존 31개 A의 실행은 지속. 단순 CI·이 정적 모의 판정으로 설치/승인/실시간 보호 PASS를 선언하지 않는다.

### P1.2 — #917 완료 증거와 #1050 후행 소스 수정의 시간축 분리 (2026-11-13 원장 재대조)

- **#917 과거 실제 복구는 이미 완료(관측 2026-11-10T01:07:07.208Z):** [원본 독립 읽기 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-917-writer-followup-contract-20261110/results/controller-917-finalization-readback-20261110.json)에서 `completionStatus=RECOVERY_COMPLETED`, `PASS/CONTROLLER_POSTSWITCH_FINALIZATION_READBACK_VERIFIED`, 보호 38/38, #1215/#1216 단회 결과 4파일, `originalInstallLeaseReleased=true`, `originalRecoveryClaimReleased=true`, `originalActiveRecoveryMarkerAbsent=true`를 확인. **원본 실패 ledger의 `RECOVERY_REQUIRED` 값은 역사적 원문 보존**이고 이 완료 결과의 현재 활성 실패 증거가 아님. [#1214 Draft PR](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1214)은 병합되지 않았으나, 위 별도 실Windows 완료 및 readback 증거와 구분한다.
- **#1050은 새 유지보수 소스의 미래 재접수 호환 수정:** 2026-11-13(KST) `d73483e2`에 병합된 7/9필드 validator는 #917 원래 FIRST FAIL의 코드 원인을 설명하고 **향후 동일 요청 재접수**를 고친다. 이 소스만으로 #917의 과거 완료를 취소하거나 다시 복구·원본 요청을 재실행하지 않는다. 최근 #917 댓글의 `#917_RUNTIME_RECOVERY_NOT_DONE` 문구는 **11/10 원본 완료 검증과 불일치**하므로 `#917_HISTORICAL_RECOVERY_COMPLETED / NEW_MAINTAINER_SOURCE_NOT_RUNTIME_VERIFIED`로 분리 판정한다.
- **#996은 독립 사고로 계속 NO-GO:** #917의 당시 원본 lease 해소가 #996의 이후 C 잠금까지 해제했다는 뜻은 아니다. #996의 사후 claim·현재 install lease/Workflow/Backlog·Owner는 최근 원본 PC에서 **재확인 전 UNKNOWN**, C native namespace 안전 미입증·새 승인 부재는 유지한다.
- **실제 다음 한 단계:** 공통 설치 단일 Owner가 기존 승인된 Windows 읽기 경로로 **현재 유지보수기 설치 SHA/7파일 해시·원본 #996 lease/claim/소유권·현재 Controller beforeSHA**를 확인. 기존 설치 `config/operations.json`에 총괄 진단 A가 없으므로 현 31개 일반 pc-job A로 유지보수기 현재 설치 확인을 주장하거나 미등록 A를 제출하지 않는다. 정규 고정 승인 진단 경로가 없으면 **해당 설치 확인만 `AUTOMATION_BLOCKED/READBACK_PENDING`**으로 남기고, 기존 기능 A·독립 기능 업무는 계속한다. 새 유지보수기 B 적용은 위 확인·정확한 효과 승인·보호 완료 후에만 검토.

### P2 — 기능별 실제 수집·계산·공개 완료 (공유 쓰기는 순차)

- 물가 승인 B 결과 / 테마 승인 Reader / 고용 DOL / Treasury 감사 / D05 원본 모두 **기존 공급자·수집기·계산기·Writer**로 연결. PC 원자료와 결과는 로컬에 보존하고 D1에는 승인된 공개 projection·최소 checkpoint만 게시한다.
- 로컬 원본 `sourceVersion/sourceStoredAt`, 관측일, 계산일, 게시일, checksum을 분리한다. 변경·결측·stale을 구분하고 마지막 유효 공개 점수 보존.
- 게시 `DONE`은 원본 저장/readback → 계산 readback → 정식 게시 ledger → D1/API raw·score source/시각 일치 → PC/모바일 UI 값·단위·결측·마지막 점/날짜 확인 후에만 기록. HTTP 200만으로 완료 금지.

### P3 — 공통 C #996은 독립 별도 소유

- 단일 #996 담당은 이미 얻은 R3/R4, 격리 native 부정 시험을 재사용하고 `C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID`(과거 C 실행의 FIRST FAIL)과 독립 native namespace 삽입 미봉쇄(`C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED`)의 실제 원본·원인을 구분.
- 사후 Workflow/backlog/claim/lease/protected before/after가 현재 **확인되지 않은 효과**는 `STATE_UNKNOWN`으로 보존. 기존 C 승인 이력을 새 무제한 승인으로 해석하지 않는다.
- 안전한 original owner 보호·경합 CAS·권한·manifest·독립 음성 시험이 정식 검증되고 **명시적인 새로운 C 승인**이 있을 때만 실제 복구 검토. PC 백업/잠금/DB/원장 삭제, 강제 rebase/clean, 다른 도구로 안전 거부 우회 금지.

### P4 — 종료 후 후속 (기능 완료의 별도 Gate 아님)

- **예약 검증 `USER_ACCEPTED_PASS`**: 해당 검증은 닫음. 정규 갱신을 또 기다리거나 재실행 성공을 인위적으로 만들지 않음.
- 격리 자연 장애 5/5 및 공유 lease 해제 5/5: 자연 인증 사건/해제 실증이 *실제로 도착할 때만* 원본과 함께 판정. 데이터 기능·#996 C와 분모를 섞지 않음.

## 3. 기능별 세부 실행 체크리스트와 완료 판정

### 3.1 물가지표 — 42% → 원자료 26/26·신규 공개 7/7·정식 26개 점수

| 단계 | 실제 실행/증거 | 담당·판정 |
|---|---|---|
| I-01 (완료) | PC A #1334에서 유효 4/7, CPI #22/#23 `INVALID`, Census #28 `MISSING`, PPI #24 **203개 valid observations** 확인. [#1326](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1326) 등 현재 PC source/4파일 해시 PASS | 물가 원담당 · DONE / 재사용 |
| I-02 (필수 승인) | #1336의 `05d7...` / 4개 pin source file SHA / 공식 BLS·Census 원본 URL 2개 / 대상 저장 JSON 2개 / 1회 실행·40초 제한·기존 잠금 효과만 승인 판정. [공통 XLSX Draft #1061](https://github.com/ansqhd5774-Choi/zgmini/pull/1061) CI 성공은 선택적 독립 호환성 개선, **기존 B 승인 필수조건 아님** | B 승인 owner · APPROVAL_PENDING |
| I-03 | 승인된 기존 B에서 동일 Task/Node/E: lock owner 확인 → BLS `CUSR0000SEHA`, `CUSR0000SEHC01` 및 Census `AMTMTI` 공식 파일 2GET → 실제 XLSX sheet/월열 확인 → 원자료·아카이브·SHA256 보존, PPI #24 203건 불변 증명 → 로컬 readback/JSON-TXT 2/2 | 물가 원담당 · 미실행 / fail이면 STOP |
| I-04 | 저장 원자료로 기존 26개 계약 산식 계산·결과 저장, 결측/stale 구분, 원자료 개수 **23→26/26**, 신규 7개 모두 유효; 임의 0/보간 금지 | 물가 원담당 · 미실행 |
| I-05 | 승인된 Writer/D1 게시, API의 26개 값·score/version/time 일치 및 PC 1440px/모바일 390px UI 검증 | 물가 원담당 · 미실행 / 증거시 완료 |

### 3.2 시장 캘린더 — 95% → 100%

| 단계 | 실제 실행/증거 | 담당·판정 |
|---|---|---|
| M-01 (완료) | TreasuryDirect TA_WS 365일 수집→로컬 비공개 SQLite/계산→Writer/D1→API/UI 기존 PASS 증거 재사용, 해당 기간·checkpoint 보존 | 시장 원담당 · DONE |
| M-02 | 운영 설치 `badad912...`에 `source-inventory-runtime-readonly` **미등록**인 차이와 현 source/기존 승인 PR #1191 범위 대조; 정확한 Controller 등록을 #68의 단일 적용 owner와 합의 | 공통 적용 + 시장 원담당 · NOT_REGISTERED |
| M-03 | 승인된 최소 A 적용·등록 확인 후 1회 A에서 실제 Treasury 비공개 365일 원문 기간·행수·원본 지문·저장 DB·WAL/checkpoint 일관성 readback, 반환 JSON/TXT 2/2 | 시장 원담당 · 미완료 |
| M-04 | 관측치·기간 일치 시 95→100%; 불일치 시 해당 범위만 실제 재수집·계산·게시 및 API/UI 재검증, 과거 결과 삭제/재수집 기본값 금지 | 시장 원담당 · 미완료 |

### 3.3 테마 공포탐욕 — 20% → 10/10 공개

| 단계 | 실제 실행/증거 | 담당·판정 |
|---|---|---|
| T-01 (완료) | 기존 10개 테마를 구성하는 PC 저장 피드 6개 식별, 원담당 #1009; GetMarketHistory 공개 카탈로그 14/14 종목 존재는 **가격 품질/공개 라이선스/701일 동일 세션/공급자 이용권 증거가 아님** | 테마 원담당 · DONE |
| T-02 | **기존 승인 A 진단 실행 완료**: [#1338](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1338) / [Run #43293983366](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43293983366) `PASS/L7_RUNTIME_READONLY_INVENTORY`, 원격 JSON/TXT 2/2, 보호·원자료·D1 쓰기 0. 이전 [#1298](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1298) 대비 R181 source SHA·Task SHA·R181 STOP ledger 바이트/시각 **동일**(2026-11-12T05:00:14.317Z), reason 고정 안전 단서 `HTTP/R181/SPY`, 정확한 HTTP code/FIRST FAIL은 **미노출**; R179 `PUBLIC_API_ROLLING_MISMATCH`, R183 `PUBLISHER_CHILD_FAILED_REVIEW`도 그대로. 다음은 원담당이 승인된 원본 진단 경계 내 안전한 실패 code/stage와 **독립 6개 피드·R178 checkpoint** 증거를 확보. 일반 [#1337](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1337)의 **R7 archive** score/이력 갱신은 이 **L7 테마** 작업의 실증으로 합산 금지. | 테마 원담당 · **A 조회 DONE / 실제 원인·6피드 EVIDENCE_PENDING** (20% 유지) |
| T-03 | 기존 PC 공급자와 승인 API 권한/무료 사용·재배포 적법성·14종×701 거래일 동일 세션/마지막 뉴욕 정규장 1h 봉 완전성·조정주가를 검증; 모호하면 출시 STOP, 무단 가입/유료 과금 금지 | 테마 원담당 · 미완료 |
| T-04 | 승인 원본만 수집→SQLite 원자료 보존→기존 10테마 산식으로 저장자료 계산→로컬 결과 readback(각 0/null/stale 구분) | 테마 원담당 · 미완료 |
| T-05 | 기존 Writer/D1→`/api/theme-fear-greed`와 PC/모바일 공개 10/10 정상 여부·날짜/version·축/마지막 점 검증 | 테마 원담당 · 미완료 |

### 3.4 고용 R6 — 7/8 → 8/8 (29/29)

| 단계 | 실제 실행/증거 | 담당·판정 |
|---|---|---|
| E-01 (완료) | 기존 원자료/점수 **28/29 scored** 확인과 승인 R2 산식·원담당 기존 7/8 완료 보존. 공개 UI 22/29는 **별도 시점·분모**이므로 29/29 완료로 오인하지 않음 | 고용 원담당 · DONE |
| E-02 | 과거 #1217/#1227 `PC_JOB_INTAKE_NOT_OBSERVED` 원본/고유 requestId 보존, 새 PC 요청은 실제 현 승인 범위가 필요할 때만. 기존 R6 원자료 A 지원 여부/설치/현재 HEAD·checkpoint 확인 | 고용 + 공통 적용 owner · 부분 미완료 |
| E-03 | 공식 DOL 주별 10년·51개 지역 관측의 첫 실제 결손과 월/주 시점·수정 발표 여부를 저장 데이터에서 정밀 조회. 코드·시뮬레이션 13/13 PASS를 실물 데이터 PASS로 전환하지 않음 | 고용 원담당 · 미완료 |
| E-04 | 결손 구간만 기존 승인 공급자/수집기 B로 수집→원본 저장·readback→보호 이력·checkpoint 전진 확인(기존 완료 관측을 임의 덮어쓰기 금지) | 고용 원담당 · 미완료 |
| E-05 | 승인 산식으로 `STATE_CLAIMS_BREADTH`까지 로컬 29/29 계산·점수 READY→D1 게시 재조회→API/UI에서 29개 source/time/값과 결측 표시 확인 | 고용 원담당 · 미완료 |

### 3.5 R10 Alpaca 제외 — 5/5(100%) DONE (재개 금지)

- 승인된 금지 범위: Alpaca Basic/IEX **신규 호출 및 과거 Alpaca 원자료의 신규 R10 점수 재사용/게시 금지**.
- 실측: B #1320 로컬 Writer health 1파일 설치, A #1321 및 #1323 운영 source/Writer 확인, [실제 Production API·모바일 검증 원장](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6826099930) **기존 유효 결과 보존·건강도 퇴역 job 제외 PASS**.
- 남은 승인 기능 단계 **없음**. 타 기능 건강도의 unknown 3건·장래 예약 자연 검증·#996 C는 R10의 종료 조건 아님. 진단 Draft #1058 미병합은 운영 소스 설치를 무효화하지 않음.

### 3.6 D05 원자료 계보 — 설치 완료 / 실제 0/68

| 단계 | 실제 실행/증거 | 담당·판정 |
|---|---|---|
| D-01 (완료) | 승인 B #1234 / Run #42926880769 `WRITER_B_INSTALLED_VERIFIED` 소스 12/12, 사후 A #1235 설치 source 확인 | D05 원담당 · DONE(설치만) |
| D-02 | `d05-lineage-readonly` 신규 A의 [PR #1236](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1236) **main 병합** 확인; 운영 설치 Controller에 정확한 operation이 등록됐는지 검증, 없으면 최소 파일/allowlist/승인/lease 계획으로 #68 접수 | D05 + 공통 적용 owner · NOT_REGISTERED/UNKNOWN |
| D-03 | 승인·실제 설치된 A로 D05 JSONL의 존재·건수·최초/마지막 관측일·중복·source lineage·NTFS 접근·백업 포함·checkpoint 원본을 읽기, JSON/TXT 2/2 원격 회수 | D05 원담당 · 미완료 |
| D-04 | 저장 원자료에서 실제 첫 누락을 확인하고 승인된 공통 Writer/Core로 부족한 1년치 구간만 backfill, 처리량·storedAt·checkpoint 전진으로 `RUNNING` 판단 | D05 원담당 · 미완료 |
| D-05 | **68/68** 원본·계보 계약의 실물 기록과 보호 검증 후 승인된 공개 계약이 있는 범위의 로컬 결과/D1/API/UI 검증. 승인 계약에 없는 게시 필드를 새로 만들지 않음 | D05 원담당 · 미완료 |

## 4. 공통 도구·원장·인계 역할 배정

| 책임 구분 | 다음 실제 업무 | 증거·종료 조건 |
|---|---|---|
| **중앙 프로세스 총괄** | 기존 시간당 단일 중앙 예약/새 `agent-handoff` 처리, 실제 신규 수리 실패만 최대 1건 선택. 무관한 성공/WAIT/UNKNOWN은 재접수 금지 | 인증 원본 Issue/Runner Run/JSON-TXT/manifest/PR 동일 HEAD 성공 CI/원본 및 중앙 bot 영수증 `RUNTIME_VERIFICATION_PENDING` |
| **공통 Controller 적용 owner** | 기존 설치 Controller vs 현재 승인 source/등록 operation 비교 후 Treasury·D05·고용에 필수인 **실제 미등록 것만** 정확한 file manifest·backup·CAS·owner lease로 적용 | 별도 실PC 설치 SHA, 전후 해시/Runner·operation·JSON/TXT/실제 A PASS. 소스 CI만으로 설치 DONE 금지 |
| **#996 단일 C owner** | 과거 C의 정확한 LAST PASS/FIRST FAIL·보호 원본·안전한 native namespace CAS·새 C 승인을 독립 처리 | 인증된 실PC 사후 원본/안전 복구 증거 전에는 `NO-GO`; 다른 기능의 독립 작업 차단 금지 |
| **각 기능 원담당** | 자기 기능의 이미 입증된 완료점 이후 실제 원본 GET/저장·계산·게시/PC·모바일 UI 검증 | 원본 출처·시각·버전·고유 Request/result와 체크포인트·실제 값·누락·DONE 기준을 각 기능 계획에 갱신 |
| **격리 CI Runner** | `DESKTOP-N62L0NG` / `zgmini-handoff-ci-spare-01`의 승인된 source-only 회귀·인계 검증만 | 원본 `PC` 운영 6 Runner(`zgmini-pc-01..06`)와 물리/라벨/저장·쓰기 분리. 새 Runner·독립 CMD/ZIP/예약 만들지 않음 |

## 5. 종료 판정·진행률 갱신 규칙

1. 한 단계가 완료되면 **대상·원본 ID·실행일/시각·실제 source/설치/게시 SHA·checkpoint·실물 수치·JSON/TXT/Production readback**을 기능 원장에 1회 남기고 종전 증거를 재사용한다. 완료 단계 반복을 다음 Gate로 만들지 않는다.
2. `APPROVAL_PENDING`, `NOT_REGISTERED`, `STATE_UNKNOWN`, `DEFERRED`, `NO-GO`는 서로 다른 사유이며 전체 대기·완료로 합산하지 않는다. 실제 공유 리소스 충돌이 있는 쓰기만 정확히 직렬화한다.
3. 본 통합 문서는 **현행 6개 기능과 세 공통 작업/별도 C**에 대한 최신 우선순위 안내다. 새 승인·실제 런타임 증거가 기존 단계를 변경하면 해당 기능 담당 계획과 이 상태판을 함께 갱신하되, 다른 채팅에 자동 전달됐다고 주장하지 않는다.
4. **다음 작업 한 개를 선택하는 기준:** (a) 지금 승인된 실행이 가능하면 그 기능의 저장/readback을 즉시 진행; (b) 승인만 필요하면 해당 Owner에게 정확한 PR/manifest·효과 범위 전달하고 다른 독립 Lane을 진행; (c) 해당 operation 미등록이면 공유 설치 owner의 정확한 소규모 적용 작업을 진행; (d) 자연 예약/장래 사건은 `DEFERRED`.
5. 현 시점 최우선 손실 없는 연결은 **물가 B #1336 승인 판정과 테마 T-02, 고용 E-02/E-03, 시장 M-02, D05 D-02를 병렬로 진행**하는 것이다. 총괄이 자료 수집 담당의 권한을 대리하지 않으며, 모든 작업자는 승인된 기존 실행기/원본 보존 구조를 우선한다.

## 6. 관련 정본·변경 금지 영역

- 총괄 브랜치 기존 경과 원장: [PROCESS_COORDINATOR_NEXT_EXECUTION_20261107.md](PROCESS_COORDINATOR_NEXT_EXECUTION_20261107.md); 공통 적용 협의 [Issue #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68).
- 기능별 상세 계획: [물가](https://github.com/ansqhd5774-Choi/zgmini/blob/fix/economic12-inflation-legacy4-r35-20261021/docs/INFLATION_26_SOURCE_AND_PUBLICATION_EXECUTION_PLAN_R1_20261110.md), [시장 캘린더](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/market-calendar-treasury-cache-private-code-r1-20261109/docs/market-calendar-treasury-annual-execution-plan-r1.md), [고용](https://github.com/ansqhd5774-Choi/zgmini/blob/feat/bls-registered-v2-20261109/docs/employment-r6-manual-backfill-20261110.md), [R10](https://github.com/ansqhd5774-Choi/zgmini/blob/fix/asset-r10-alpaca-exclusion-runtime-20261110/docs/R10_ALPACA_EXCLUSION_EXECUTION_PLAN_20261110.md), [테마 원장 #1009](https://github.com/ansqhd5774-Choi/zgmini/issues/1009), [D05 원본 #1234](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1234).
- **절대 임의 변경 금지:** 원래 승인 산식·가중치·원자료/SQLite·D1 schema/TTL·수집 주기·Cloudflare/DNS/배포·6 Runner·운영 PC Controller/C lock·기존 reservation, 키/보안 설정·원본 B/C request ID·사용자 파일·backup/claim/lease.
