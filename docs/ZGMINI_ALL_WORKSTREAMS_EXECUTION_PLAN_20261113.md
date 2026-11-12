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
