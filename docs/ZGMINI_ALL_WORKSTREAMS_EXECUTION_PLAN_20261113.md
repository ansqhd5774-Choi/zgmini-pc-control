# ZGMINI 전체 작업 통합 실행계획 — 2026-11-13 (R1)

> **용도:** 프로세스 총괄 브랜치의 실행 순서·역할·완료 기준을 한곳에 고정한다. 이 문서는 **업무 조정 문서**이며 운영 PC 설치, B/C 승인, 기존 산식·수집 주기·DB·D1·Cloudflare 배포 또는 타 대화 실행을 승인하지 않는다. 실제 실행·관측·출처는 최신 제어 `main`의 `AGENTS.md`, `docs/GENERAL_CHAT_START.md`, `docs/PC_AUTOMATION_STANDARD.md`, `docs/PC_OPERATING_SYSTEMS_CANONICAL.md`, 기존 기능별 브랜치/승인, 정확한 PC JSON/TXT·Runtime·D1/API/UI를 우선한다.

## 2026-11-14 31차 실증 반영 — 운영 PC 실행 차단의 정확한 경계

- **30차 코드 완료를 재사용:** #996 과거 C 동의 영수증의 일반 감사 문장 오판 수정 [PR #1357](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1357)은 **C 전담 브랜치에 병합**됐다. 전담 HEAD `91b317f6b8070aa48f762516f4e1d60b6e90bb8c`; 기존 격리 CI [Run #43473278180](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43473278180), Job `132050467994`, `DESKTOP-N62L0NG` **40/40 PASS, 0 fail/skip**. source fix는 `DONE`; 실제 운영 C 복구 **80%/NO-GO**. 구체적으로 신규 continuation Owner C 승인·trust/revocation, 독립 offline namespace exclusive 및 native preimport/CAS의 현재 운영 증거가 없어 #1222는 Draft/main 미병합. WinPE 6/6·기존 29/29·새 40/40 재시험 금지.
- **#1351 고유 PC Job 최신:** [Run #43429486924](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43429486924) Job `131899103441`는 `queued, runner_id=0, runner_name=""`. 이 Job은 이미 `issues.opened`로 생성됐으며 [.github/workflows/pc-job.yml](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/.github/workflows/pc-job.yml)의 `pc-request-<issueNumber>` 고유 그룹을 사용한다. 요청 중복이나 후행 라벨 문제로 판단하지 않는다. GitHub 연결에서 Runner online/busy 관리 목록 API는 열리지 않아 운영 PC의 **현재** Windows 로그인/Guardian/Watchdog/lease 소유는 `AUTOMATION_BLOCKED/READBACK_PENDING`. 기존 [RUNNER_RECOVERY.md](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/RUNNER_RECOVERY.md)는 전원·로그인 세션 없이는 watchdog이 동작하지 않는다고 설명한다. 이 구조를 강제 종료·잠금 삭제·새 예약·PC 재등록으로 우회하지 않는다.
- **#1352 독립 대기:** [Draft PR #1352](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1352)의 late-label 수집은 격리 98/98 PASS이지만 Controller 동시 설치 SHA·기존 B 승인과 `ZGMINI_PC_JOB_LATE_LABEL_ENABLED` opt-in 전 **Draft 유지**. 이미 queued인 #1351 작업을 해결하는 변경이 아니므로 이를 미배정 원인 수정으로 병합하지 않는다.
- **공통 중앙 처리:** 8/8 DONE, open `agent-handoff` 0건; 신규 자연 Writer B E2E 4/5 DEFERRED. 과거 완료 실증을 다시 실행하거나 자연 실패를 만들지 않는다.
- **#434 사용자 지시 우선:** 2026-11-08 제외된 E: 중복 보고서 신규 0건 확인은 필수 Gate가 아니다. 다음 구체 작업은 이미 등록된 Runner/Guardian 상태의 승인된 원본 재조회이며, 가능할 때만 영속 원장 관련 읽기 증거를 얻는다. #434의 대기는 독립 기능 작업의 전역 Gate가 아니다.
- **PC별 다음 실제 단계:** 운영 `PC`: 기존 6 Runner/로그인/Watchdog 현재 상태의 **승인된 읽기 경로** 확보 후 기존 #1351 결과 2/2 회수(미확보 시 해당 Lane만 `AUTOMATION_BLOCKED`). 별도 격리 `DESKTOP-N62L0NG`: 이미 승인된 서로 독립인 source CI만 필요한 변경에서 활용. C 전담 Owner: 정확한 continuation C 승인 및 보호 안전 증거 전 실제 C 실행 금지. 총괄: 독립 원담당 기능의 수집·계산·게시를 #1351·#996 대기로 일괄 중지하지 않는다.

> 이 상단 정본이 아래 2026-11-13 원본 R1의 당시 WinPE 미실행·이전 Source SHAs·#434 E: Gate 등의 역사 상태보다 **후속 업무 판정에서 우선**한다. 아래 과거 증거와 승인 이력을 삭제하지 않는다.

## 2026-11-14 후속 실행 정정 — 사용자 삭제한 #434 검증 Gate 재도입 금지

**사용자 이전 직접 지시 재적용:** 2026-11-08 `#434 E: 중복 보고서 생성 0건 확인 삭제`. 이 의미는 **E: 원본 파일 삭제 명령이 아니라, E: 중복 보고서 신규 0건을 실측 확인하는 검증 항목을 #434 작업 목록에서 제외**하는 것이다. 해당 값이 실제로 검증됐다고 주장하지 않으며, 과거 원장·파일을 임의 수정/삭제하지 않는다. 아래 2026-11-06/11-13 역사적 계획의 해당 선행 조건은 **현재 실행 지시로 사용하지 않는다**.

**#434의 다음 실제 판정:** [#476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476)의 자연 승인 B는 2026-11-06 유지보수기 V2 전환보다 나중에 실행됐고, 해당 Issue의 봇 결과와 원격 JSON/TXT 2/2가 `SUCCEEDED / REPORT_UPLOAD: VERIFIED` 및 동일 요청 댓글 1건을 보인다. 설치 당시 참조 source `4f076a…`의 `tools/maintenance-agent.mjs` Git blob `63cfde736d20f2b166c01b477adfdc010962c8d1`에는 원격 업로드 readback 후 영속 원장 `reportUploadStatus=VERIFIED`를 저장하는 계약이 있다. **PC 영속 ledger의 직접 readback은 아직 없으므로 이것을 실물 PASS라고 선언하지 않는다.** 이미 승인된 운영 PC 진단이 정상 기동해 해당 필드를 제공할 때에만 별도 확인한다. 새 B, 새 범용 A, 사용자 CMD, 외부 원격 데스크톱 도구, 새 Runner/예약을 만들지 않으며, **#434 4/5(DEFERRED)를 다른 기능의 Gate로 다시 배치하지 않는다.** 삭제된 E: 0건 검증을 다음 필수 행동에 포함하거나 자동화로 부활시키지 않는다.

**핵심 다음 행동의 순서(전역 차단 금지):** 운영 `PC`의 기존 [#1351 Run 43429486924](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43429486924)는 `queued/runner_id=0`이므로 해당 원본 작업만 `AUTOMATION_PENDING`; Runner 배정 시 기존 고유 증거 회수. 독립 격리 `DESKTOP-N62L0NG`은 source-only 승인 CI/검증 지속. #996 실제 C 복구는 기존 Owner의 오프라인 독점·신뢰 서명/철회·원자적 CAS 증명 전 `NO-GO`. 중앙 8/8 완료, 신설 Writer B 4/5 자연 사건 DEFERRED는 변경 없음.

## 2026-11-14 실행 보정 — 신규 실제 증거 (기존 R1 기록 보존)

> **대상:** 프로세스 총괄 작업, 최신 control `main=ce23591b2ae6606556ca0069125b1538882b4023`. 이 보정은 기존 완료 업무를 재시작시키거나 운영 C/B 권한을 확대하지 않는다. 이 브랜치의 계획은 실PC Runtime의 정본이 아니며, 공유 작업은 원래 #68의 단일 담당을 따른다.

| 실행 Lane | LAST PASS / 새 관측 | 미확보 FIRST FAIL·상태 | 다음 필수 행동 / 담당·PC |
|---|---|---|---|
| 중앙 공통 인계 | 기존 8/8 DONE 유지. bot 종료 사건 PR [#1354](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1354) 및 owner 종료 사건 PR [#1355](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1355) **main 반영**, #1355 격리 [Run #43455350868](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43455350868) **317/317 PASS**, open `agent-handoff` 0건 | 신설 격리 Writer B 신규 자연 유효 실패 왕복 **4/5 DEFERRED** (신규 사건 0) | 인증된 자연 장애가 실제 접수된 때만 총괄이 수정→CI→원본 반환. 평시 `NO_WORK`; 인위적 장애·재요청 금지. 실행 PC: GitHub + 별도 격리 PC `DESKTOP-N62L0NG` |
| #1351 운영 A | 기존 [Issue #1351](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1351) / [Run #43429486924](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43429486924), job `131899103441`, label `zgmini-pc-control`, `queued / runner_id=0`. 과거 #1342의 실Runner `zgmini-pc-04` 성공은 별도 시점 | 현재 운영 6 Runner 온라인/세션·Watchdog 원인 **UNKNOWN**; GitHub 접수 완료 ≠ 실Windows 실행. 원격 데스크톱 사용 필요 증거 없음 | 원래 Job의 상태 변경 시 고유 Runner·기존 Issue 결과 TXT/JSON 2/2 확인. 승인된 관리/건강 조회 이외 다른 도구를 통한 PC 조작 금지. 담당: 공통 실행·운영 PC `PC` |
| #996 C | 격리 실제 NT class 10 경쟁 시험 [Run #43439435316](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43439435316) **29/29 PASS**, 경쟁시 `STATUS_ACCESS_DENIED` 실측 | `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN`; `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`. **80% NO-GO**, 운영 복구 미실행 | C Owner가 오프라인 독점·신뢰된 승인 서명/시각/철회·실제 CAS 보호 증거를 별도 확보. 격리 source/TEST_ONLY는 `DESKTOP-N62L0NG`, 운영 C는 정확한 별도 승인 후 `PC`에서만. 총괄은 공유 조정만 |
| #1352 후행 라벨 | [Draft PR #1352](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1352) source-only 회귀 PASS | 운영 설치/Controller compatibility 미증명 | C Owner/단일 적용 owner가 source–runtime diff 및 실제 적용 필요성 검증. 다른 활성 Controller 공유 설치 쓰기와 병렬화 금지 |
| #434 유지보수기 중복 보고 | **신규 확보된 자연 B 후보 증거:** [#476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476), [#538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/538), [#637](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/637), [#703](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/703)의 기존 정규 B 댓글은 각 1건씩 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, `REPORT_UPLOAD: VERIFIED`. #476/#637/#703 실제 `results/maintenance-<requestId>.json` + `.txt` **각 2/2 재조회** 및 요청/설치 SHA 일치 | `reportUploadStatus=VERIFIED` **PC 영속 원장 내부값** 및 `E:\\ZGmini`의 요청별 `MAINTENANCE_<requestId>.{txt,json}` **신규 0건**은 원격 결과와 댓글만으로 미입증. #464 자기 인계와 각 후보의 실제 설치 source/시점 일치도 최종 증거로 별도 확인 필요 | **새 B 생성 금지.** 기존 정상 B의 해당 `requestId` 한 건을 선택해 승인된 Windows 읽기 증거로 원장/정확한 E 파일 존재만 확인하면 #434 최종 판정. 담당: 공통 유지보수기 Owner / 운영 PC `PC`. 조건 미확보 시 4/5(80%) 유지 |
**#434 역사 증거 중복 조사 정정 (2026-11-14):** #476은 이미 #68 댓글 [6685983473](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6685983473)에 2026-11-06 13:30 UTC `SUCCEEDED`/JSON/TXT 2/2와 미완료 E 신규 파일 0·ledger 상태가 기록됐던 표본이다. 실제 유지보수기 자체 인계 `4f076a… HANDOFF_HELPER_PASS`의 #68 댓글 [6682285515](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6682285515)은 10:03 UTC, #476 생성 12:57 UTC로 **인계가 먼저**다. 그 source의 `maintenance-agent.mjs` blob `63cfde736d20f2b166c01b477adfdc010962c8d1`과 #476 Controller source의 같은 파일 blob이 일치한다. 코드상 원격 결과 검증→영속 원장 VERIFIED 저장→Issue 댓글이고 E 보고 파일 생성 함수는 없다. 그러나 **설치 시점 실제 원장 내부값과 NTFS 신규 파일 0건 직접 검증은 하지 못했다**. 기존 `pc-process-inventory-readonly` / `automation-status.mjs`는 이 두 값을 노출하지 않는다. 새 검증 전용 B/A/외부 원격 조회는 만들지 않고, #434는 4/5 DEFERRED로 보존한다. 같은 역사 증거를 다시 신규 성과로 보고하지 않는다.

| 6개 기능 독립 Lane | 원본 R1 각 기능의 LAST PASS 보존; R10 Alpaca 제외 5/5 DONE | #996/자연 대기·타 대화 미수신은 기능 전체 차단 사유 아님 | 물가/테마/고용/시장 캘린더/D05 담당이 각 고유 마지막 checkpoint부터 허용된 P0 원자료·소스·조회/계산·게시를 계속. 실제 동일 PC 파일/lease 공유 쓰기만 단일 조정 |

**운영 방식 고정:** 기본 경로는 GitHub Issue → 기존 Actions/자체 Runner → 정확한 JSON/TXT·댓글 원격 회수. `Remote Desktop Commander` 같은 외부 원격 도구를 임의 진단·복구 우회로 사용하거나 사용자 승인 요청을 반복하지 않는다. C급 효과·보호 잠금·Worker/Core/DB/예약·운영 데이터·D1/DNS를 임의 변경하지 않는다. 구역별 완료 기준을 합산해 가짜 전체 완료율을 만들지 않는다.

## 0. 최종 목표와 작업 분류

- **기능 완료의 실체:** 승인된 PC 공급자 원자료 GET → 원자료와 관측일·source SHA·checkpoint를 로컬에 저장·재조회 → 저장 원자료만으로 계산 → 로컬 결과 저장 → 승인된 공개 결과만 D1 게시 → Production API 및 PC/모바일 UI의 값·단위·결측·날짜·sourceVersion·storedAt 검증. 데이터가 없는 경우 0으로 위장하지 않는다.
- **총괄의 실제 역할:** 공통 장애 인계, 범위가 겹치는 Controller/Writer/DB 자원 조정, 정확한 인계 기록·원본 소스/실행 결과 반환. 각 기능의 구현·공급자 수집·계산·게시·화면 완료는 **기능별 원담당**의 책임이다. GitHub Issue 댓글은 **다른 일반 ChatGPT 대화의 자동 수신·실행**이 아니다.
- **상태 정의:** `DONE`=해당 승인 기능 범위의 실측 완료; `RUNNING/READY`=실제 실행 또는 승인된 독립 실행 가능; `APPROVAL_PENDING`=정확한 신규 효과에 필수 승인 없음; `NOT_REGISTERED`=원하는 operation만 운영 Controller에 없음; `STATE_UNKNOWN`=증거가 부족함; `BLOCKED`=해당 필수 실행에 실제 권한/자원/검증 실패; `DEFERRED`=자연 사건/장래 관찰을 요구하는 별도 후속.
- **진행률 비혼합:** 아래의 %·n/m은 각 기능 담당자가 확정한 고유 분모다. 서로 평균하거나 PR/CI/문서/예약 결과를 원자료·공개 점수 완료로 환산하지 않는다. 완료 증거의 재검증은 source·config·Runtime 변경 또는 충돌 증거가 있는 범위에서만 한다.

## 0.1. 매 작업의 실행 PC·환경 명시 (2026-11-13 사용자 지시)

- **프로젝트·대화의 실행 PC를 한 대로 고정하지 않는다.** 각 작업을 계획하거나 다음 단계를 보고할 때 실행 장소를 작업 단위로 지정한다. 실제 실행을 관측하지 못한 경우 '완료' 대신 `미실행/미확인`으로 표시한다.
- 보고 형식은 **`작업 / 실행 PC 또는 환경 / 실제 결과·증거 / 현재 문제 / 다음 필수 실행 / 범위별 진행률`**. 두 PC를 연달아 사용하는 업무는 작업을 둘로 나누고 각각 명시한다. 채팅 접속 PC, Remote Desktop Commander 등록 이름, GitHub Runner 호스트 이름을 검증 없이 같은 장치라고 가정하지 않는다.
- **운영 PC `PC`:** Windows 11 Pro, `zgmini-pc-01..06` (`zgmini-pc-control`), 승인된 운영 원자료·Controller·Writer 설치/조회. 단, 승인·등록·공유 lease 충돌 상태는 별도 확인한다.
- **공통 대기열 PC `DESKTOP-N62L0NG`:** Windows 10 Home, `zgmini-handoff-ci-spare-01` (`zgmini-handoff-ci-isolated`), 승인된 격리 인계/읽기·소스 시험 및 #996 **TEST_ONLY** WinPE VM 시험. 운영 PC의 E:·Controller/lease/DB에 접근시키지 않는다.
- **GitHub/웹:** 브랜치·PR·이슈·실행 원장·CI 결과·공개 API/UI 조회 등 특정 물리 PC가 필요한 작업이 아닐 때 `GitHub/웹(특정 PC 없음)`으로 기록한다.
- **대상 불명확·접근 불가:** `대상 PC 미확정` 또는 `DESKTOP-N62L0NG 원격 조작 경로 미확인`처럼 실제 문제를 적는다. 외부 원격 제어에서 한 장치가 오프라인이라는 이유만으로 다른 GitHub Runner 오프라인이나 사용자 현재 채팅 PC 부재를 확정하지 않는다.

**현재 #996 후속 작업별 PC 지정 (사용자 TEST_ONLY 승인 후):**

| 순서 | 다음 작업 | 실행 PC/환경 | 현재 판정 |
|---|---|---|---|
| 1 | 승인 범위·기존 이미지/펌웨어/Runner readback 재사용 | GitHub(물리 PC 없음) | 기존 증거 있음·반복 시험 불필요 |
| 2 | 원래 사용자 계정의 기존 VM 설치·ISO 정상 접근·해시 확인 | **공통 대기열 PC `DESKTOP-N62L0NG`** | VM 표준 6경로 없음·원본 TEMP Runner EPERM·직접 조작 경로 미확인 |
| 3 | 필요한 경우 무료 VirtualBox Base 공식 서명·버전 확인 후 설치 | **공통 대기열 PC `DESKTOP-N62L0NG`** | 사용자 TEST_ONLY 효과 승인 확보·실제 설치 미실행 |
| 4 | 호스트 디스크·네트워크·USB 격리 VM 1개, 고정 SHA ISO 읽기 전용 부착 및 1회 부팅·CNG 6건 | **공통 대기열 PC `DESKTOP-N62L0NG`** | 미실행·WinPE boot PASS 주장 금지 |
| 5 | 호스트 원본 해시 불변·게스트 결과·종료 상태 회수, 원장 갱신 | 공통 대기열 PC(원본 증거) → **GitHub**(회수·인계) | 실물 시험 이후에만 판정 |
| 6 | 운영 #996 C 원본 claim/lease 및 승인된 복구의 별도 독립 판단 | **기존 운영 PC `PC`**(승인된 원본 조회만) | C `NO-GO`·TEST_ONLY 승인으로 운영 복구 불가 |

- 현재 사용자 진술은 **이 ChatGPT 채팅이 공통 대기열 PC에서 진행 중**이라는 것이며, 이 사실이 별도 Remote Desktop Commander 연결·관리 권한·파일 접근을 보증하지 않는다. 대상 PC를 분명히 밝혀야 하지만 작업/대화를 한 호스트로 고정하지 않는다.
- #996 사용자 TEST_ONLY 승인: [원장 #996 승인](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6837208822). 대상 PC 정정: [#996 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6837339312). 승인된 범위 밖 관리자 원격 명령·ISO/ACL 우회·운영 C급 변경 불가.

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

### P1.3 — 기존 승인 A Workflow 재사용으로 실제 유지보수기 상태 조회 연결 (2026-11-13)

- **실제 확인된 조회 공백:** 고정 `tools/automation-status.mjs`는 운영 PC의 `MAINTENANCE_INSTALL.json` source SHA·파일 해시·Controller SHA·설치 lease·receiver/workflow를 **읽기 전용**으로 관측하지만, 일반 `pc-job` 31개 A 목록에 등록되지 않았다. Remote Desktop Commander 연결 장치는 이번 조회 시 `pc` **Offline**으로 확인; 이것은 GitHub self-hosted 6 Runner의 Offline 증거가 아니며 RDC 설치·접속을 요구하지 않는다. 기존 `pc-process-inventory-readonly`는 운영 PC용 등록 Workflow이며 특정 운영 파일을 직접 변경하지 않는 고정 A 원본 조회를 제공한다.
- **기존 경로 최소 source 보강:** [Draft PR #1339](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1339), 브랜치 `fix/pc-process-maintainer-readonly-20261113`. 기존 `.github/workflows/pc-process-inventory-readonly.yml`/자체 운영 Runner를 재사용하고, `tools/pc-process-inventory-readonly.mjs`에서 기존 `collectAutomationStatus([])`의 값 중 정확히 허용된 SHA40, integrity boolean, readback-verified lease held/recoveryRequired, Receiver/Workflow 상태만 투영. 원본 nonce/owner/경로/명령행/키/환경변수 미공개. 위조 fallback lease는 `STATE_UNKNOWN` 처리; 단위 검사 두 건 추가.
- **실제 소스 검증/병합 완료:** 첫 커밋 `4851d601`의 테스트 정규식 문법 실패를 수정한 `f1b344c5`에서 [격리 Windows process CI Run #43300786055](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43300786055) `process-source-tests` PASS, [독립 C996 source CI #43300786073](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43300786073) success, PR 변경 파일 2개/mergeable clean. PR #1339 Ready 전환→**squash main 병합 `1803f44315549152989013c4695e046aea9eb2a0`**, 최신 main HEAD 및 source/test blob 2개 재조회 PASS. 이것은 A 진단 소스 배포이고 Windows 실측 PASS가 아니다.
- **운영 PC A 원본 요청 실제 생성:** 신규 [Issue #1340](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1340) 고정 4필드 `ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1`, role=operating, requestId=`d8e416d2-6f78-4a1e-a621-909d25e9dca8`, 원본 actor owner 확인. 기존 Workflow [Run #43301164726](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43301164726)이 `zgmini-pc-04` 운영 전용 좌석에서 in_progress 체크아웃 관측. **원격 JSON/TXT 결과 및 PC maintainer SHA·lock readback은 아직 미확인**, 중복 요청하지 않는다. PC 유지보수/Controller 설치·C/lease 쓰기 0.
- **다음 실행:** 격리 PR CI의 새 HEAD PASS 및 변경 파일을 readback → 승인된 최소 main 반영 → 기존 `pc-process-inventory-readonly` **운영 role 1회 Issue**를 owner·fixed schema·새 requestId로 접수 → 운영 `PC` 고유 Run + JSON/TXT 2/2 원격 readback → source·lease가 검증될 때만 #68 단일 설치 담당이 공유 자원 충돌/실제 B 범위를 판정. 이 A 결과가 C의 전체 claim/namespace 안전을 증명하지 않으며 #996은 별도 Owner NO-GO. 불명확 상태는 원본 요청 회수만, 동일 ID 재실행 금지.

### P1.4 — 기존 운영 PC 실측 완료: 구형 유지보수기와 활성 공유 설치 복구 잠금 (2026-11-13 KST)

- **실제 결과:** [A #1340](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1340), [운영 Run #43301164726](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43301164726), `completed/success`·`zgmini-pc-04`·`PC`·attempt1, 관측 `2026-11-12T20:32:34.197Z`. [정확한 운영 JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/pc-process-inventory-43301164726-1-operating.json) blob `c85f706066c88ba6f18d635e6fbf1f0ddccaced4` + [TXT](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/pc-process-inventory-43301164726-1-operating.txt) blob `6c32ec3ea2e6f6af82d0622df0893758754a4f74` **원격 2/2 직접 재조회**. 결과 `PROCESS_INVENTORY_COLLECTED`, `maintenance.status=PASS`, `maintenanceFilesVerified=true`, `installLockReadbackVerified=true`, 운영/공급자/D1 쓰기 0.
- **설치 바이너리/잠금 실제값:** `maintenanceSourceSha=16064e29fea0e53e7769a24d93d75b6f5292cfc0` (이미 검증된 7파일 **구버전**), `actualControllerSha=badad9124157879d7a645b64f2768113d632355b`, `installLockHeld=true`, `installLockRecoveryRequired=true`, `receiverStatus=LISTENING`. `workflowState=UNVERIFIED`는 실제 workflow disabled 판정이 아니며 `controllerFilesVerified=null`도 파일 불일치 확정이 아니다. 이 조회는 #996 claim 소유자·정확한 설치 stage/원본 보호까지 공개하지 않으므로 **#996의 잠금이라고 단정 불가**.
- **정확한 Git 소스 차이 (installed source commit `16064e29` → 운영 변경 미반영 control `main`):** 유지보수기 고정 7파일 중 **2개만 Git blob 변경** (`tools/maintenance-contract.mjs` `5036475d→ff097001`, `tools/update.mjs` `b017e189→9a178a13`); 나머지 5개 동일. 누적 변경은 공통 Runner 6좌석+격리 독립 좌석 정합성, `controller/*.test.mjs` 비배포 예외, 승인 7/9필드 backlog 처리. 이는 `source diff`이며 현재 설치 파일 바이트 및 적용 승인 manifest **완료가 아님**. 현재 운영 유지보수기는 #1050 패치와 #1333 보호 수정 모두 자동 인계되지 않음.
- **위험도별 후속 판단:** 동일 공유 Controller/maintenance 설치 쓰기 **BLOCKED: ACTIVE_RECOVERY_LEASE**. #68 공통 설치 owner는 B 설치·재시도·source 교체 금지. #996 단일 C owner가 기존 승인된 정규 원본 읽기로 해당 `ownerPid`/request claim/lease/Workflow/Backlog/protected hash를 **활성 lock과 일치 여부까지** 판정한 뒤 native namespace 배타성·새 C 승인 조건을 별도로 해결. 소유권이 미입증이면 `STATE_UNKNOWN`을 보존. 기존 Controller에 설치된 31개 A의 독립 조회와 물가·시장·테마·고용·D05의 비경합 개발·수집 검증은 계속. #917은 11/10 복구 완료를 반복하지 않음.
- **중단과 실행 경계:** 운영 #1340은 이미 소비한 일회 요청이므로 재발행 금지. 첫 격리 PR 테스트의 정규식 실패는 수정 후 새 SHA에서 PASS됐으며 운영 실측의 실패로 분류하지 않음. 이 실측 후 신규 PC B/C, Workflow 전환, install lock/DB/D1/원자료/예약 변경 **0건**. 예약 검증 사용자 PASS 유지.


### P1.5 — #996 공유 설치 lease의 실제 원본 소유권 연관성 검증 완료 (2026-11-13 KST)

- **조회 경로는 기존 운영 A:** [PR #1341](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1341), 원래 `pc-process-inventory-readonly`의 source/test **2파일만** 수정. 고정된 #996 요청의 원본 `owner.json`·`RECOVERY_REQUIRED.json`·ledger를 두 번 읽어 바이트 일치 검증하고 requestId/issueNumber/targetSHA, ownerPID·nonce 동등성(원본 nonce는 미게시), marker/ledger 시각을 비교. 기존 격리 Windows process-source CI [Run #43302775393](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43302775393) `completed/success`; Squash [main `8d7c578fb962ea0d47199144e47e12541f21754b`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/8d7c578fb962ea0d47199144e47e12541f21754b), 소스/테스트 Git blob 재확인.
- **새 운영 Windows 단회 실측:** [Issue #1342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1342) / [Run #43303078533](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43303078533), `completed/success`·attempt1·host=`PC`·runner=`zgmini-pc-04`·[원본 JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/pc-process-inventory-43303078533-1-operating.json) blob `e6dc8244b74bf12b0abbcd28ca8b8ed8426ed3c4` / [TXT](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/pc-process-inventory-43303078533-1-operating.txt) blob `8bd8d6f19d0aa5c4724f0291883f427efab332e0`, 원격 2/2 직접 재조회.
- **실제 결론:** `c996LeaseCorrelation.status=CORRELATED / code=C996_LEASE_IDENTITY_CORRELATED`; 기존 #996 `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`/Issue 996/target `9db6fff6...` ledger match=true, owner/marker PID·nonce equality=true(실 PID **46568**), timestamp match=true, 연속 원본 바이트 unchanged=true. `maintenanceSourceSha=16064e29...`·`maintenanceFilesVerified=true`, `actualControllerSha=badad912...`, `installLockReadbackVerified=true / installLockHeld=true / installLockRecoveryRequired=true`, receiver `LISTENING`. 워크플로 `UNVERIFIED`/Controller 파일 확인 `null`은 미검증이고 실패 확정 아님. 원본 owner nonce/ledger body 경로 미게시, 기록된 owner/marker/ledger SHA256 지문만 공개. 운영·공급자·D1 쓰기·자동 재시도 **0**.
- **정확한 상태 갱신:** 직전 P1.4의 `#996 lock owner unknown`은 **이제 해소됨(원본 동일성에 근거한 연관성)**. 이는 owner PID의 현시점 생존/배타적 네임스페이스 보호/Workflow 전체 보존 또는 C 운영 복구 성공을 의미하지 않는다. **#996 C `NO-GO` 및 `SHARED_INSTALL_ONLY / ACTIVE_RECOVERY_LEASE` 계속.** 동일 공유 Controller/maintenance B·C 적용은 Owner의 승인·안전성 검증 전 금지; 무관한 31개 운영 A·독립 기능 수집/검증은 계속. 기존 #917 11/10 복구 완료 증거 재사용, 재실행 금지.
- **다음 담당 한 단계:** #996 단일 C Owner는 위 검증된 original fingerprint/연관성을 **재사용**하고, 기존 C 네이티브 `C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED` 실제 FIRST FAIL에 대해 OS namespace 삽입을 차단할 수 있는 정규 오프라인 WinPE 또는 증명 가능한 독점 원시 동작을 격리 검증. source/정확한 새 C 승인·C 직전 fresh owner/lease/보호 검증 뒤에만 운영 복구 검토. 총괄 Owner는 공유설치 대기만 유지하며 신규 절차·모의 사고·자원 release를 임의 Gate로 만들지 않는다.

### P1.6 — #996 온라인 부모 디렉터리 독점 핸들 대안도 부정 실증 (2026-11-13 KST)

- **실행:** 단일 C 원담당 기존 후보 브랜치 `codex/controller-996-intake-c-candidate-r1-20261110`에 [commit `3744fa1e`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/3744fa1e13ffee2ee4458f04604429fbb2d95652). 변경은 **기존 소스 전용 네이티브 부정 테스트 파일 1개(+66행)**만; C 후보 실행기 원래 blob `2708a3a93d3b1be8ef10ff4e36f62d71d15d9b20` 및 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`, `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` 두 STOP 불변.
- **기존 격리 Windows 실증:** [Run #43304286248](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43304286248), `completed/success`; `DESKTOP-N62L0NG`, `zgmini-handoff-ci-spare-01`에 호스트/E: 보호 가드 PASS, 기존 Source CI의 네이티브 음성 테스트 step PASS. 자체 TEMP의 C# `CreateFileW`가 **부모 디렉터리를 `dwShareMode=0`**으로 열어 핸들을 보유한 가운데 **별도 Node OS 프로세스**가 새 `independent-child.json`을 `wx`로 생성하여 검증 성공. 원본 운영 파일·archive/rename/Workflow/lease 쓰기 0. Source CI PASS는 **대안 실패의 부정 실증**이지 C 운영 복구 통과가 아니다.
- **유효한 결론:** 기존 자식 핸들의 `C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED` 외에 부모 exclusive share=0도 새 namespace 삽입 배타성을 보장하지 못함. 온라인 공유 폴더 핸들 옵션만으로 해결하는 추정은 폐기. #996 original Owner/lease 연관성은 위 P1.5의 운영 A 원본으로 이미 검증되어 있으므로 반복 확인 Gate 생성 금지. **남은 FIRST FAIL `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN`; 운영 C `NO-GO` 유지.**
- **실제 다음 필수 실행 / 담당:** #996 단일 C Owner가 기 작성 WinPE 단일 부팅 **오프라인 배타 실행** 또는 효과가 입증되는 OS namespace 독점 대안을 기존 승인 경로에서 좁혀 검증. WinPE/부팅/관리자 작업 및 신규 C continuation은 원본 장치·owner·신규 승인 등 C급 조건 충족 전 실행 금지. 격리 PC 고정 VM 프로그램 부재 실측은 운영 PC 단일 부팅 WinPE의 불가 판정이 아니다. #68 공통 설치 Owner는 활성 #996 복구 잠금과 동일 공유 파일 쓰기만 대기, 6개 기능의 독립 작업을 차단하지 않음.

### P1.7 — #996 WinPE 단일 부팅 정본 결정과 C 효과 승인 경계 (2026-11-13 KST)

- **현재 선택·소스 검증:** C 원담당 브랜치 `codex/controller-996-intake-c-candidate-r1-20261110`의 기존 `tools/controller-996-windows-archive-adapter.mjs`는 `plan996OfflineRecovery(...,'EXISTING_ZGMINI_PC_WINPE_BOOT')`에서 **`SINGLE_WINPE_BOOT_BOUNDED_SIGNED_OFFLINE`**을 이미 선택했다. 2회 WinPE 부팅은 비선택 대안이며 기존 Owner 승인·부팅·원본 보호를 갖춘 실제 C 실행기가 아니다. 단일 부팅 시 원래 Windows에서 정확한 공유 Writer/작업 원본, 6개 전용 Runner drain 및 `pc-job` 대기열 억제·서명 handoff를 먼저 검증 → WinPE에서 원본 구 C→신규 continuation C→**install lease 마지막** 순서의 무교체 보관 → Windows 복귀 뒤 모든 보호 상태/4개 원본 요청·GitHub/Runner 재조회. 단계별 효과가 새 C 승인 전에는 **0건**임을 유지한다.
- **유효한 실PC 증거 재사용:** 운영 PC [#1265 / Run #43124923743](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1265) 고정 E: GUID·volumeSerial·7개 directory fileId128 **PASS** (이것은 온라인 값, WinPE 재바인딩 아님). [#1342 / Run #43303078533](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1342) 활성 #996 owner/marker/ledger **CORRELATED**. 격리 PC [#1270 / Run #43130418963](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43130418963) CPU VT/SLAT/firmware enable PASS, 6개 고정 경로 VM 실행물 **ABSENT_AT_FIXED_PATH**, 휴대형 미확인, 실제 VM/WinPE 부팅 0. [WinPE 격리 결정보고](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/docs/CONTROLLER_996_WINPE_ISOLATED_RUNTIME_APPROVAL_20261112.md) 고정 시험 ISO `ISO_ONLY_PASS`이나 WIM metadata drift 원인 미확정·기존 사용자 TEMP ISO에 대한 Runner `EPERM`. 이를 WinPE 실행 가능으로 표현하지 않는다.
- **명확한 미완료 C 조건:** 선정된 WinPE 부팅 이미지의 실제 부팅/원본 볼륨 GUID+FILE_ID_INFO 재바인딩, native exe 운영 호환·C 서명 검증, *실사용* Owner SPKI 신뢰 앵커, 승인/철회 최신성 및 오프라인 신뢰 시각, 원래 Windows 프로세스·6 Runner/재시작 억제와 24시간 GitHub 큐 한도, 영구적 handoff와 최종 postcheck **미입증**. `tools/controller-996-winpe-volume-rebind-review.mjs`는 **caller-supplied 합성** 비교일 뿐 운영 WinPE native evidence collector가 아니다. 운영 C 코드의 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`와 `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` 양쪽 STOP 그대로. 기존 격리 부정 실증 [Run #43304286248](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43304286248)은 online handle 경로만 배제한다.
- **승인 분리:** 격리 PC의 선택적 VirtualBox Base 설치(드라이버·관리자 효과), VM 생성·ISO 1회 부팅은 **독립 사용자 승인** 필요하며 **원본 PC 실제 C복구 전역 선행 Gate로 임의 승격하지 않음**. 기존 운영 PC의 중단·부팅 변경·WinPE 원본 볼륨 접근·Claim/Lease 보관은 별도의 **정확한 신규 Owner C scope/해시/원본 보존/원복·중단 조건** 승인 대상. 사용자의 일반 `계속해라`를 관리자·실물 재부팅/복구 허가로 간주하지 않는다. 승인·WinPE runtime 증거 없으므로 `C_NO_GO` 및 `SHARED_INSTALL_ONLY` 유지.
- **남은 단일 실행·담당:** #996 C 원담당은 현재 source-only 단일 부팅 계획과 이미 확보된 해시·Runner/볼륨/lease 증거를 재사용해 **실행 효과가 정확히 열거된 승인 요청/미달 native runtime 증거**를 소유자에게 제출, 명시 승인 후에만 격리 지원시험 또는 운영 WinPE 준비. 프로세스 총괄은 공통 자원 충돌·진행 인계만 담당하며 6개 기능의 독립 수집·계산·게시를 C 완료까지 막지 않는다. 새 WinPE VM 설치·ISO 재작성·운영 재부팅·C·lease·Workflow·DB/D1 변경 **0건**.

### P1.8 — #996 실측 SHA 3/3 연결: 기존 C 승인 검토 소스의 읽기 전용 연속성 개선 (2026-11-13 KST)

- **상태와 실제 증거:** 기존 운영 A [Issue #1342 / Run #43303078533](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43303078533) `completed/success`, host `PC`/runner `zgmini-pc-04`/attempt1, JSON/TXT 2/2 원격 확인. 원본 sha256 `owner=d6329b4d...`, `RECOVERY_REQUIRED=4dc51f7e...`, `ledger=c6276bcf...`는 기존 C 전담 브랜치 `tools/controller-996-native-approval-readiness.mjs` 및 해당 테스트 파일에 고정된 R1 과거 원본 3개와 정확히 동일. 원본 #996의 변조/교체 흔적이 **해당 3개 바이트 범위에서는 없음**. 이것은 새 현재 Writer·Workflow·원본 4 Job 및 OS owner process 생존 증명이 아니다.
- **실제 구현:** 기존 C Owner 브랜치 `codex/controller-996-intake-c-candidate-r1-20261110`에 read-only `review996LatestOperatingLeaseEvidence`를 기존 approval-readiness module에 추가. Source `74624bc5` → 해당 테스트 `9d68204c` → 기존 CI Workflow 재사용 `93a7453d0e96d9a417bfac08b93bd1dcac22270d`. 기존 고정 원본 3개, 운영 PC host/Runner/1회 요청, controller/maintainer source, 활성 lease 및 새 원본 연관성 입력이 정확히 맞을 때만 `SOURCE_ONLY_ORIGINAL_LEASE_FINGERPRINTS_MATCH`를 반환. 모든 반환은 `callerReceiptAuthenticated=false`, `ownerPidCurrentlyAliveVerified=false`, `ownerCConsentVerified=false`, `offlineNamespaceExclusiveVerified=false`, `executionAuthorized=false`. 위조·변경·비운영 호스트 입력은 source-only `BLOCKED` 처리. 운영/공급자/D1 쓰기 및 자동 재시도 0.
- **격리 CI:** 정확한 [Run #43306796062](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43306796062) `completed/success`/격리 `zgmini-handoff-ci-spare-01`; 실제 job 원본 로그 `15 tests / 15 pass / 0 fail`. C 첫 진입 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED` 및 native `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` 두 STOP 그대로, production 후보 소스 blob `2708a3a93d3b1be8ef10ff4e36f62d71d15d9b20` 불변, [Draft PR #1222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1222) **미병합**. 운영 Controller/maintenance는 변경되지 않았다.
- **실제 남은 C 차단:** `docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json`은 C Owner 전담 브랜치에 **없음(실제 Git 경로 readback 404)**; 이것을 임의로 `approved:true`로 생성하지 않는다. 선택된 WinPE 단일 부팅의 실제 이미지/boot/native source trust/오프라인 서명·소유자 신뢰·fresh 보호/6 Runner drain 증명 또한 없음. 따라서 **#996 80% C NO-GO 유지**. #68 단일 공유 설치만 `BLOCKED_ACTIVE_RECOVERY_LEASE`; 독립 기능 작업은 계속.
- **다음 한 단계:** #996 C 원담당은 위 실측 3개 원본 해시 및 새 검토 함수를 재사용하여 반복 조사 없이 **정확한 미승인 C 효과·신뢰 WinPE 런타임을 분리해 Owner에게 정식 승인 범위를 제시**. 승인 전 실제 Windows 부팅·Claim/Lease·Workflow·DB/D1 변경 금지. PR/소스/CI를 C 운영복구 성과로 계산하지 않음.

### P1.9 — #996 기존 7개 온라인 효과와 WinPE 효과 구분·Owner 승인 제안서 (2026-11-13 KST)

- **실제 차이 확인:** C 원담당의 `tools/controller-996-continuation-gate.mjs`/consent reader는 `CONTINUATION_EFFECTS` 7개 (`CREATE_AND_PRESERVE_FIXED_C_RESERVATION_VIA_ATOMIC_PROPOSAL_MOVE`, `RESERVE_INDEPENDENT_CONTINUATION_C_CLAIM`, `WRITE_SCOPED_DURABLE_RECOVERY_MARKERS`, `ARCHIVE_ABANDONED_C_CLAIM_NO_DELETE`, `ARCHIVE_INDEPENDENT_CONTINUATION_C_CLAIM`, `VERIFY_DURABLE_READY_TO_RELEASE_INSTALL`, `ARCHIVE_ORIGINAL_INSTALL_LEASE_LAST_NO_DELETE`)의 **기존 Windows 연속 C proposal**만 승인 검토. 새 선택 `plan996SingleBootRecovery`의 **원래 운영 Windows drain·off/WinPE 부팅·원래 E: GUID/FILE_ID 재바인딩/서명·3개 별도 archive 후 Windows 복귀·후검증** 효과는 해당 승인 계약만으로 허가되지 않음. 기존 계약 assertion 삭제나 `approved:true` 임의 문서 생성 금지.
- **유효 완료:** C 전담 브랜치 `codex/controller-996-intake-c-candidate-r1-20261110`에 [정확한 신규 C 효과 승인 **미승인 제안서**](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/docs/CONTROLLER_996_SINGLE_BOOT_C_APPROVAL_SCOPE_PROPOSAL_20261113.md) 1파일을 [commit `f2f7b508`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/f2f7b50881a4b9c0082e8f5f435687738d1991f7)에 추가, 실제 원격 blob `f937d2e67cfb4b6ac21c42678a416cc50a1d5b0b` 재조회. 변경은 승인·런타임 파일/Workflow/테스트가 아닌 **문서 1개**. 기존 C STOP 두 개 및 소스 계약/WinPE 운영 무허가 불변.
- **효과와 증거 분리:** ① 운영 PC 6 Runner drain/재시작 억제 및 GitHub pc-job 큐/24시간 bound, ② 정확한 새 C claim/영속 handoff, ③ 운영 Windows 재부팅→단일 WinPE 부팅, ④ 승인된 WinPE native x64·Owner SPKI/오프라인 시계·권한 및 실제 동일 볼륨 재바인딩, ⑤ `oldC → continuation → install LAST` 무교체 3개 archive, ⑥ Windows 복귀 원본 4 Job/Writer/Controller/Workflow/Backlog/원본 보호 postcheck. **모두 미승인 효과**이며 Source-only manifest 승인/검사와 runtime 완료를 혼동하지 않는다. 기존 #1265·#1342·#1270·WinPE ISO_ONLY 및 #43304286248·#43306796062 증거는 재사용. WIM metadata drift/원본 사용자 TEMP EPERM, production native x64/선택 이미지 boot·actual Owner SPKI/검증된 offline clock·신규 C 동의 manifest 부재를 미완료로 분리.
- **실제 다음 필수 행동:** #996 단일 C 원담당이 source-only 제안서의 **미정 source/image/native/신뢰 Anchor/기간/PC 운영 효과/보호 checksum**을 정규 실행 가능 근거로 확정하고 Owner의 명시적 C 승인 요청을 진행한다. 승인이 없으면 STOP 유지. 선택적 격리 VM 시험 설치와 필수 원래 PC C 승인 서로 다름. 총괄 #68 설치 Owner는 #996과 직접 겹치는 공유 설치만 계속 `BLOCKED_ACTIVE_RECOVERY_LEASE`, 독립 기능 작업은 계속. 이번 운영 Windows/WinPE 재부팅·C·lease/claim·Workflow/원자료/DB/D1·Controller 설치 **0건**. 전체 #996 운영 완료율 **4/5=80% 유지 / NO-GO**.

### P1.10 — WinPE 재바인딩 선행 네이티브 파일 ID 증거: 격리 Windows 실측 (2026-11-13 KST)

- **단일 범위 실행:** 기존 #996 C 원담당 브랜치 `codex/controller-996-intake-c-candidate-r1-20261110`의 `tests/controller-996-c-native-owner-namespace-negative.test.mjs`만 [commit `f83c5f2469ea4b2411c71612739ff76126083f28`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/f83c5f2469ea4b2411c71612739ff76126083f28)에서 수정. 기존 격리 CI `c996-owner-native-boundary-source.yml`를 그대로 재사용하고 프로덕션 C 실행기·두 STOP·Workflow/승인 manifest/윈도우 원본은 변경하지 않음.
- **네이티브 API 실측:** 기존 격리 [Run #43308902773](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43308902773), `DESKTOP-N62L0NG`/`zgmini-handoff-ci-spare-01`, `completed/success`/1회. 고유 `C:\%TEMP%\zgmini-996-native-id-fixture-*` 안에서 Windows `CreateFileW`+ `GetFileInformationByHandleEx(FileIdInfo)`를 실제 호출하여 **같은 실제 디렉터리를 이름 변경해도 `FILE_ID_128` 및 volume serial이 동일**, 원본 archive 보존 상태에서 동일한 이름의 새 디렉터리 생성 시 **원래 파일 ID와 달라지는 것**을 assert. 원본 native 반환값·TEMP 경로는 운영 Git 결과로 게시하지 않음. 정확한 격리 job 로그 `16 tests / 16 pass / 0 fail` 및 `C996_SOURCE_ONLY_ISOLATED_HOST=TRUE` 직접 확인.
- **검증 가치/한계:** #1265 기존 운영 E: 고정 7개 FILE_ID 관측과 선택된 WinPE 단일 부팅의 *ID 비교 원리*를 실제 Win32 API 시험으로 연결했으나 이 TEMP 시험은 오직 C: 격리 호스트에서 시행. **WinPE native 8개 디렉터리 실측 리더, 실제 원래 E: WinPE 볼륨 GUID/FILE_ID 재바인딩, 부팅/Owner 신뢰·서명·시간/실제 C 승인**은 여전히 미완료. 다른 복구 단계의 승인 또는 위 테스트 자체를 새로운 기능 전체 Gate로 추가하지 않음.
- **다음 필수 행동:** #996 C Owner는 테스트 증거를 재사용해 현재 유일한 C 방향인 **단일 WinPE 부팅의 신뢰 native readback/이미지/서명 및 정확한 C 승인**을 확정할 것. 새 운영 C/Installer/Claim/Lease/Workflow/SQLite/D1/Runner 중단 0, #996 **80% / NO-GO**, #68 공유 설치만 차단; 독립 기능은 계속.

### P1.11 — #996 WinPE 8개 고정 디렉터리 네이티브 리더 source-only 구현 + 격리 x64 컴파일·직접 실행 (2026-11-13 KST)

- **실제 소스 구현:** C Owner 브랜치 `codex/controller-996-intake-c-candidate-r1-20261110`에 `tools/controller-996-winpe-native-volume-ids-readonly.c` **신규**. 고정 `VOLUME_ROOT, ZGMINI, AUTOMATION, MAINTENANCE, LEASES, OLD_C, INSTALL, CONTINUATION` 8개 경로만, caller-supplied canonical `\\\\?\\Volume{UUID}\\`와 정확한 continuation UUID·volume serial 검증 뒤 Win32 `CreateFileW(FILE_READ_ATTRIBUTES, FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT)`·`GetFileInformationByHandleEx(FileAttributeTagInfo/FileIdInfo)`로 각 directory SERIAL/128bit ID 읽음. reparse/비디렉터리/serial mismatch/중복 ID/누락을 fail-closed. C source Git blob `116c16db8efad6621c96ebc02b2636287fb23b96`, **`main()` 없음**, `C996_ENABLE_C_GRADE_OPERATOR` 정의 시 컴파일 강제 오류, 성공 반환도 `C996_NATIVE_ID_READ_COMPLETE_UNTRUSTED`이며 `winpeBootAuthenticated/ownerSignatureVerified/offlineClockTrusted/volumeGuidAuthenticated/cExecutionAuthorized` 모두 false.
- **실제 C x64 toolchain 검증:** 기존 격리 CI `c996-owner-native-boundary-source.yml`의 동일 `zgmini-handoff-ci-spare-01`·`DESKTOP-N62L0NG` 인증을 재사용. MSVC `cl.exe /W4 /WX /TC /c`로 C 소스를 실제 컴파일 PASS. 신규 `tests/c996_winpe_native_volume_id_temp_harness.c`(blob `92072aa25fd0e3b460c64098db95ac3176e38233`)는 원본 운영 E:/다른 PC 금지·고정 `C:\%TEMP%\zgmini-996-native-reader-fixture-*`의 `source/archive`만 read-only. 격리 호스트에서 **MSVC x64 native EXE를 직접 컴파일/실행**하여 원본 FileId128·serial → 이름 변경 후 same ID → 같은 이름 새 디렉터리는 distinct ID, 잘못된 serial은 `STOP` 실증. 시험 후 소유한 고유 TEMP fixture만 정리, 운영 쓰기/재시작/lease 이동 0.
- **정확한 회귀:** 최종 C branch HEAD [`233fbdb82cbf9662b76c9c1e8ec92e7278087ef3`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/233fbdb82cbf9662b76c9c1e8ec92e7278087ef3), [Windows Run #43311425356](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43311425356) attempt1 `completed/success`; 실제 job 로그 `19 tests / 19 pass / 0 fail / 0 skipped`. 기존 18/18 C 컴파일과 신규 19/19 native 실행 확인. 중간 (1) MSVC 공백 경로 CMD 인용 (17/18), (2) Node `TEMP`/Win32 `TMP` 우선 순위 충돌 (18/19)는 각 원인만 수정 후 **같은 고정 보안 가드 유지한 새 HEAD**에서 합격. 신규 Runner/Workflow 생성 없음, 기존 workflow에 변경된 C source와 fixture 경로만 트리거로 추가.
- **한계 및 실제 남은 실행:** C 모듈은 **인증되지 않은 GUID/UUID/serial을 읽는 라이브러리 코어**이지, WinPE에서 인증된 호출을 하거나 `ZGMINI_CONTROLLER_996_WINPE_HANDLE_IDS_V1` JSON/TXT를 생산하는 설치 실행기가 아니다. 실제 운영 E: 7+1 ID WinPE 읽기, 선택된 WinPE ISO의 실제 부팅·WIM metadata drift, Owner SPKI/서명·trusted offline clock, Windows 6 Runner drain/queue/원본 보호/postcheck, **정확한 신규 C approval manifest/동의**는 여전히 미증명. 설치 원본 SHA/Controller·승인된 C 실행기/Workflow/DB/D1/Claim/Lease 전부 불변. 기존 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`, `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` STOP **유지**; #996 **80% / C NO-GO**·#68 공유 설치만 차단.
- **다음 필수 담당 행동:** #996 Owner는 본 reader source x64 테스트 증거를 재사용하고 **선택 WinPE에서 실제 native 8개 ID 수집/서명 증거 경로와 별도 C 효과 승인**에 필요한 미구현 신뢰 경계만 해결. 격리 VM TEST_ONLY 설치는 선택적 별도 승인이고 전체 기능 Gate로 승격하지 않음.

### P1.12 — #996 WinPE 네이티브 소스 영수증과 기존 고정값 비교 연결 (2026-11-13 KST)

- **실제 구현:** C Owner 브랜치 `codex/controller-996-intake-c-candidate-r1-20261110`의 [HEAD `bfa5bc8b`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/bfa5bc8badca447657bda68ebb1a01e464934c52). 운영 실행기·두 C STOP·승인 manifest는 변경하지 않음.
- **중간 reparse 경로 보호 수정:** `tools/controller-996-winpe-native-volume-ids-readonly.c` blob `2904cf6a72ce87e836efca47c7f6b68821581549`에서 기존 최종 디렉터리만 검사하던 누락을 `c996_read_fixed_component_chain`으로 보완. root부터 매 고정 component의 `FileAttributeTagInfo/FileIdInfo`·serial을 읽고 reparse/비디렉터리/serial mismatch 거부. 이는 현재 읽기 보호이고 동시 namespace 삽입의 원자적 차단/WinPE 실부팅 검증이 아님.
- **Native C → JS 영수증 연결:** C source가 `ZGMINI_CONTROLLER_996_NATIVE_IDS_UNTRUSTED_V1` JSON을 8개 고정 key·native ID·Serial·GUID 및 전부 false/0 신뢰 필드로만 serialize. Node `tools/controller-996-winpe-native-receipt-review.mjs` blob `28cacf11e31832d641598768f292fb7f2647ecef`는 raw length·UTF-8·중복 JSON key/canonical·8개 정확한 key·원본/reparse/serial·false trust를 fail-closed 검사. 이후 기존 `review996OnlineVolumePinsForHandoff`와 `review996WinpeVolumeRelativeMoves`를 **SOURCE_ONLY**로 재사용해 고정 7개 원본+continuation ID 비교. C source 출처는 `WIN32_NATIVE_SOURCE_ONLY_UNTRUSTED`로 보존하고 위조된 WinPE source로 승격하지 않음. 성공도 `SOURCE_ONLY_UNTRUSTED_EIGHT_IDS_MATCH_PINNED_INPUTS`; `nativeReceiptAuthenticated/offlineBootVerified/ownerTrustAnchorVerified/ownerApprovalVerified/offlineClockTrusted/executionAuthorized=false`.
- **실제 격리 Windows:** 기존 `DESKTOP-N62L0NG` / `zgmini-handoff-ci-spare-01`, 기존 `c996-owner-native-boundary-source.yml` 그대로. C TEMP x64 fixture는 **실제 단일 네이티브 FileIdInfo**를 읽어 rename/replace를 검증하며, 추가 8개는 명시적으로 **SYNTHETIC source-only JSON**으로 serialize. Node test는 해당 C JSON과 source-only parser를 직접 연결하고 가짜 boot/Owner approval, 중복·변조·잘못된 serial·GUID, continuation mismatch를 거부. 과거 C branch에 없는 운영 결과 파일 #1265 직접 참조로 실패한 시험은 원본을 복제하지 않고 합성 fixture로 수정. **정확한 [Run #43313789751](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43313789751) `completed/success`, job `131516392875`, 21 tests / 21 pass / 0 fail / 0 skipped** 원본 로그 확인. 두 C STOP/비운영 호스트 가드 삭제 없음.
- **남은 범위와 차단:** 본 코어의 원본 C: TEMP/합성 JSON 테스트는 실제 WinPE boot·운영 E: 8개 native ID·신뢰된 Owner SPKI/서명·오프라인 시각/전원 중단·원본 6 Runner drain·Workflow/원본 Jobs·새 C 명시 승인 및 postcheck를 증명하지 않음. [Draft PR #1222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1222) 미병합. `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED` 및 `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` 두 STOP 유지. #996 **80% / C_NO_GO**, #68 공유 설치만 `BLOCKED_ACTIVE_RECOVERY_LEASE`, 운영 Controller/WinPE/Claim/Lease/Workflow/DB/D1/예약 변경 0.
- **다음 한 단계:** #996 단일 C Owner는 추가 격리 TEMP 합성 시험을 임의 완료 Gate로 늘리지 말고, 기존 **단일 WinPE 이미지 실제 boot와 인증된 native 영수증·Owner trust·정확한 운영 C 효과 승인**의 미확정 근거를 분리해 처리. 타 기능 독립 업무는 계속.

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
