# #917 최신 Writer 후속 계약 및 C급 승인 후보

## 상태와 정확한 소스

- 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 작업 브랜치: `codex/controller-917-writer-followup-contract-20261110`
- 통합 기준: #1160 `c1d8c43c1aa4d2280cb1c50a7d7c04aea475ef1b`
- C 실행 코드 source: `d82b66206d78b1f9d90f846dce1b67b7f36f6719` (16개 모듈의 고정 해시)
- #1088 및 #1160 원담당 브랜치와 main은 수정/병합하지 않았다.
- Controller 7/8, 공통 대기열 4/5 유지. 운영 C 복구는 미실행이다.

## 이번 실제 증거

1. 기존 사용자 Windows 보호 PASS(source c1d8c43)는 해당 관측의 유효 증거로 재사용했다. #1210은 `WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED`로 중단된 것이므로 성공 이력에 추가하지 않았다.
2. 기존 #1213은 생성 당시 pc-job 라벨이 없어 workflow `42726083946`, attempt 1, job `129531955402`가 **skipped**, steps 0개다. 좌석/결과 JSON/TXT/실제 활성 Core source 증거는 없다. 이 사실을 Core 장애나 `CORE_NO_ACTIVE_TASK_ENGINE`으로 바꾸지 않는다. 새 요청/재실행 0건.
3. 수정 소스 d82b662의 Windows 읽기 전용 `launcher prepare`를 한 번 실행했다. 결과 `POSTSWITCH_APPROVAL_CANDIDATE_READONLY`, `operationalWrites=0`, `recoveryAuthorized=false`. 7개 material·16개 모듈·보호 계약·전용 6 Runner·Supervisor·Workflow와 원본 #919 단일 계획이 준비 검사를 통과했다. 이 증거는 라이브 Core 실행 소스를 증명하지 않는다.
4. 관련 Windows 로컬 Node 테스트 120/120 통과. pinned JSON fixture의 Windows CRLF 자동변환 실패를 발견해 해당 fixture만 -text로 고정했다. fixture 원문 및 Blob 해시는 변경하지 않았다.

## 검토할 승인 후보

`approvals/maintenance-recoveries/pc-update-877e10c8-8580-4095-a675-bef9ec032193.postswitch.json`

- 최초 후보는 `approved:false`로 생성했으며 `.postswitch.candidate.json`에 원문 그대로 보존한다.
- 원문 SHA-256: `cdebcc4c1d83fa566b136f767ffd0d874fbd34a1f11fb09ea17137cd900c8d57`
- 원본 #917 보호 기준선과 `writerTransition`은 그대로 보존한다.
- 독립 `writerFollowup`은 승인 B #1155/#1164/#1172/#1195의 고정 원문/Blob/manifest/source 순서와 최신 config `0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453`에만 한정한다.
- 4ec 단계는 DERIVED_ONLY로 유지하며 라이브 Core 검증 또는 과거 A 실측으로 승격하지 않는다.
- 사용자 새 C 승인 후에만 approved 값을 변경해 커밋한다. 변경된 **승인 원문 해시를 다시 계산**하고 실행 인수로 고정한다. 승인 후보의 현재 해시를 승인된 새 원문 해시로 재사용하지 않는다.

## 승인 시 예상 효과와 순서

1. 사용자 직접 Windows TTY에서 승인 원문/코드 해시/원래 7개 material/현재 보호 상태를 먼저 검증한다. TTY 확인은 승인된 사용자 입력을 대체하지 않는다.
2. 원본 #917 ledger·backlog·백업을 덮어쓰지 않고 별도 recovery claim과 append-only 원장을 만든다.
3. 원본 #919의 실제 결과와 정확히 일치하는 recovery replay를 전수 조회한다. 이미 결과가 있으면 재사용하고, ACK 불명확·중복이면 중단한다. 미처리임이 증명된 원본에 한해서만 영속 POSTING intent 후 정규 pc-job 복구 전달을 1회 수행한다. 새 독립 업무로 원본 ID를 재활용하거나 원본 #919를 무조건 재실행하지 않는다.
4. 별도 core-status postcheck와 봇 결과를 재조회하고 실제 Controller SHA·전용 6 Runner·Supervisor·Workflow·보호 상태를 재검증한다.
5. 성공한 경우에만 recovery claim을 먼저 보관한다. 원본 install lease는 삭제하지 않고 마지막 공유 상태 변경으로 보관하며 원본 ledger 해시와 보관된 owner/marker 해시를 재조회한다.
6. Controller/Writer 재설치·Core 기동/중단·Task 수정·DB/D1 변경은 포함하지 않는다.

## STOP 및 재진입

- 승인 없음/원문 해시 불일치/source 드리프트/16개 의존성 누락/현재 config 변경/기타 보호 파일 및 Core·Korea Task 변경/승인 제거 이란 Task 재생성 시 중단한다.
- 원본 material 변경, 기존 claim 또는 복구 기록 존재, #919 중복/ACK 불명확, 실제 A 결과 실패, postcheck·최종 보호 검사 실패 시 자동 재시도/원장 덮어쓰기/lease 해제 금지다.
- 재진입은 기존 append-only 기록·원본 ledger·원격 Issue/결과를 읽기 전용으로 먼저 대조한다. 원인과 잔여 효과를 분류하기 전 동일 실행을 반복하지 않는다. 기존 실행기 역시 preexisting claim/record를 거부하며 자동 resume하지 않는다.
- 다음 자연 예약 검증을 이 C 복구의 추가 선행 조건으로 만들지 않는다.

## 최종 완료 판정

새 사용자 명시 C 승인 및 단회 실제 복구 성공, #919 중복 없음, 원본 원장/백업 보존, install lease/claim 보관 재조회, Controller·Supervisor·전용 6 Runner·후속 결과 확인, RECOVERY_REQUIRED 해소가 모두 필요하다. 현재는 **준비 통과/사용자 승인 완료/사용자 직접 실행 대기**이며 복구 완료가 아니다.

## 2026-11-10 사용자 명시 승인 반영

- 사용자가 이 후보 범위의 C급 단회 복구에 명시적으로 “승인”했다.
- 실행 승인 파일 `.postswitch.json`은 후보의 `approved`만 true로 변경했다. 기존 코드 source 및 16개 파일 해시, 7개 원본 해시, 보호 기준선, 후속 계약, #919 범위는 바꾸지 않았다.
- 승인된 원문 SHA-256: `348d69a0662649f93a9de45996647e364dc9a8bfe5891917bd13b128fe1653d2`. 최초 후보 해시와 구분한다.
- 승인 반영 직전 읽기 전용으로 7개 material 불변, 현재 config digest 일치, 기존 recovery claim/record 부재를 확인했다. 실제 C 복구는 아직 실행하지 않았다.
- 기존 사용자 직접 Windows TTY 및 RECOVER-917 입력 조건은 그대로 유지한다. 승인된 실행물이 준비됐다는 사실을 C 복구 성공으로 보고하지 않는다.
## 2026-11-10 실제 C 실행 및 #1215 결과 회수

- 사용자의 명시 승인 및 직접 수행 지시에 따라 승인 source d82b662/원문 348d69a0를 실제 Windows TTY에서 한 번 실행했다. 기존 C 확인/사전검사/보호 조건을 제거하거나 isTTY를 위조하지 않았다.
- 결과는 `RECOVERY_REQUIRED / POSTSWITCH_BACKLOG_POST_OUTCOME_UNKNOWN`. 독립 claim과 append-only 원장 5건은 보존됐고, 원본 install lease도 유지됐다. 공유 잠금 삭제나 최초 C 실행의 재시도는 하지 않았다.
- 실제로는 복구 전달 Issue #1215가 한 번 생성됐고, Actions `42729529997`, attempt 1, seat 5에서 `PASS / WRITER_APPROVED_PREIMAGE_READONLY`로 끝났다. 실제 Controller badad912, 운영 쓰기·공급처 호출·D1 쓰기 0, 보호 불변이다. JSON/TXT 두 원본 파일의 Blob/SHA-256을 각각 재조회했다. #919 본문과 #1215 본문도 정확히 일치한다.
- 원본 #917 ledger 원문 SHA-256은 승인값 `321be375...`와 일치한다. 최초 C 실패 결과의 `originalLedgerPreserved:false`는 성공 경로 마지막에서만 true로 설정되는 보고 필드이며, 원장 변경을 관측했다는 뜻이 아니다. 실제 원문 해시 비교를 우선한다.
- 최초 POST 직후 확인이 UNKNOWN인 정확한 네트워크/목록 지연 원인은 당시 원문 응답이 보존되지 않아 확정하지 않는다. 현재 원격에서는 동일 replay가 #1215 한 건으로 확인된다.

## 제한된 후속 C 후보 — 아직 미승인

- source: `776cfcf8a77b9b48f813c59d030fac01922e044d`
- 후보: `approvals/maintenance-recoveries/pc-update-877e10c8-8580-4095-a675-bef9ec032193.postswitch.resume1215.candidate.json`
- 후보 원문 SHA-256: `88db817122118a185fdc0aa707bdf4230e3412ad048065b21286e9af83474312`, `approved:false`
- 새 `resume` 계약은 이전 승인 원문/commit/source, 기존 claim owner 해시, 5개 기록의 chain tail, #1215 본문과 JSON/TXT 해시를 고정한다. 기존 기록/owner/ledger는 바꾸지 않고 원래 claim 안에 별도 atomic continuation claim을 추가해 이중 이어받기를 차단한다.
- #919에 대한 신규 POST는 허용하지 않는다. #1215가 유일하고 기존 성공 결과가 일치할 때만 `LINK_LOST_ACK`로 연결한다. 기존 backlog 파일은 쓰지 않으며, 필요한 후속 core-status와 최종 보호/Runner 확인 후 원래 승인된 보관 절차를 수행한다.
- 기존 claim이 존재하면 무조건 거부하던 일반 경로는 유지한다. 정확한 새 resume 계약이 없는 실행, 기존 owner 생존/불명확, 기록/결과/원본 드리프트, 중복 clone, 두 번째 continuation은 계속 거부한다.
- 관련 Windows 로컬 테스트 **126/126 PASS**. 새 source의 실제 Windows 읽기 전용 prepare 1회도 `POSTSWITCH_APPROVAL_CANDIDATE_READONLY`, `operationalWrites=0`으로 통과했다. 새 C 실행은 0회다.
- 최초 승인은 d82b662의 16개 해시를 고정했다. 새 코드를 기존 승인 원문에 몰래 대입하지 않는다. 새 source/해시의 명시적 C 동의 후에만 해당 후보를 활성 승인으로 고정해 이어받을 수 있다.
- Controller **7/8**, 공통 대기열 **4/5** 유지. 아직 최종 postcheck/원장 연결/install lease 보관은 완료되지 않았다.
## 2026-11-10 후속 C 계약 사용자 명시 승인

- 사용자가 #919 재실행 없이 기존 #1215 성공 결과 연결·후속 검사·잠금 보관만 하는 후속 C 계약을 명시적으로 승인했다.
- 실행 코드 source `776cfcf8a77b9b48f813c59d030fac01922e044d` 및 candidate 원문 `88db8171...`의 나머지 항목을 바꾸지 않고 approved만 true로 고정했다.
- 새 실행 승인 원문 SHA-256: `fbea40ba0ead0961088891d1187ea9b8a50e352b73fd87ac03616d49940dc860`.
- 승인 적용 직전 기존 journal 5건/tail, claim owner, 원본 ledger, 최신 config 일치 및 continuation 미시작을 확인했다. 승인 계약 집중 검사 10/10 PASS. 실제 후속 C 실행 결과는 아래 후속 증거로 구분한다.
## 2026-11-10 후속 C 실제 실행과 최종 정리 전용 후보

- 승인된 source `776cfcf8a77b9b48f813c59d030fac01922e044d`/승인 원문 `fbea40ba...`를 실제 Windows TTY에서 단회 실행했다. 기존 #1215를 연결해 `backlogVerified=true`까지 통과했고 #919 신규 POST는 0건이다.
- 사후 진단 #1216은 한 번 생성됐으며 Actions `42731249968`, attempt 1, seat 3에서 `PASS / CORE_READONLY_DIAGNOSIS`로 완료됐다. 실제 Controller badad912, 보호 불변, 운영/공급처/D1 쓰기 0. JSON/TXT 원본 두 파일의 Blob·SHA-256도 재조회했다.
- 다만 C 실행기는 postcheck Issue 생성 직후 `POSTCHECK_OUTCOME_UNKNOWN`으로 중단했다. 원본 ledger 해시는 여전히 동일하며 install lease/원래 claim/후속 claim과 13개 journal 기록은 모두 보존했다. 재제출·자동 재시도·잠금 삭제는 0건이다.
- 원격 성공 결과가 확인됐으므로 신규 replay/postcheck 없이 보관만 수행하는 별도 finalization 경로를 준비했다. 이전 결과 연결 경로 보완 시 postcheck의 같은 중단 경로까지 함께 대비하지 못했으며, 이번 후보는 Issue 생성 함수를 호출하는 포트 자체를 전달하지 않는다.
- 코드 source: `e0cf3382b0dc4c8a6d6e2e6bacc171500f318742`. 관련 Windows 로컬 Node 테스트 **131/131 PASS**. 실제 Windows 읽기 전용 prepare 1회도 `POSTSWITCH_APPROVAL_CANDIDATE_READONLY`, `operationalWrites=0`으로 통과했다.
- 미승인 후보: `approvals/maintenance-recoveries/pc-update-877e10c8-8580-4095-a675-bef9ec032193.postswitch.finalize1216.candidate.json`, `approved:false`, 원문 SHA-256 `e2f4ca8a306ab48eaebaaf3a6996b0f8ec1aaf1f7805a8418b542c1953d063d2`.
- 이 후보는 원래 owner와 종료된 후속 owner, 기존 13건의 chain tail, 기존 승인 원문/commit/source, #1215/#1216의 유일한 Issue 및 JSON/TXT 4개 원본을 고정한다. `finalize-1216` 하위 claim으로 이중 정리를 차단하고 기존 owner/기록을 덮어쓰지 않는다.
- 새 사용자 C 승인 후에만 활성 승인 파일의 source/tool hashes를 해당 후보로 고정할 수 있다. 이전 승인을 새 source의 실행 승인으로 자동 확대하지 않는다.
- 승인 시 효과는 기존 결과 검증 → 현재 보호/전용 6 Runner/Supervisor/Workflow 및 원본 불변 확인 → recovery claim 보관 → install lease 보관 → completion 원문 재조회뿐이다. #919 재실행·새 사후 진단·Controller/Writer 재설치·Core/DB/D1 변경은 없다.
- 정리 중 결과 불명확이면 `archiveOutcomeUnknown`으로 유지하고 기존 원본/보관 위치를 조회한다. 재실행/삭제/롤백으로 정상처럼 만들지 않는다.
- 아직 마지막 잠금 보관과 completion 검증이 남아 있어 Controller 7/8, 공통 대기열 4/5 유지다.
## 2026-11-10 최종 보관 전용 C 승인 반영

- 사용자가 source `e0cf3382b0dc4c8a6d6e2e6bacc171500f318742`로 기존 두 성공 결과의 재검증과 최종 보관만 직접 수행하도록 명시 승인했다.
- 최초 finalize 후보 원문 `e2f4ca8a...`는 보존하고, 활성 실행 승인에는 approved만 true로 반영했다. 새 승인 원문 SHA-256은 `7afdef3353db724e69d9717671986ea9a31738d049343cd13dde6a7ac43e45a8`이다.
- 적용 직전 기존 journal 13건/tail, 두 이전 owner, 원본 ledger, 현재 config 일치와 최종 claim/completion 미생성을 확인했다. 승인계약 집중 검사 11/11 PASS. 실제 C 실행 결과는 별도 후속 증거로 판정한다.
## 2026-11-10 최종 복구 완료 — 실제 C 실행 및 독립 재조회

- 최종 승인 source `e0cf3382b0dc4c8a6d6e2e6bacc171500f318742` / 승인 원문 `7afdef3353db724e69d9717671986ea9a31738d049343cd13dde6a7ac43e45a8`를 실제 Windows TTY에서 단회 실행했다.
- 실제 결과: `RECOVERY_COMPLETED / POSTSWITCH_FORWARD_RECOVERY_COMPLETED`, `originalLedgerPreserved=true`, `originalRequestRetried=false`, `leaseArchived=true`. 기존 #1215/#1216을 재사용했으며 신규 replay/postcheck 생성은 0건이다.
- 이후 별도 읽기 전용 재조회가 `PASS / CONTROLLER_POSTSWITCH_FINALIZATION_READBACK_VERIFIED`, 실패 항목 0으로 완료됐다. 원문 증거는 `results/controller-917-finalization-readback-20261110.json`이다.
- Controller `badad9124157879d7a645b64f2768113d632355b` 및 백업 `c09bf6a6f66f229016135020d6ba553ba9a94676`의 정확한 38/38 파일, 승인된 C 실행기 16개 의존 파일의 Git/실파일 해시를 재조회했다.
- 원래 7개 material은 보관된 owner/marker 경로까지 포함해 모두 승인 해시와 일치한다. 원본 ledger/backlog/백업은 변경되지 않았고 이전 두 owner 파일과 13개 journal prefix도 보존됐다. 현재 journal은 18건이며 전체 hash chain 검증 PASS다.
- Core/Korea Task 및 설정 외 보호 파일 불변, 승인된 Writer config 후속 계약 일치, 이란 예약 승인 제거 상태 유지. Supervisor 정상·전용 6 Runner Online·pc-job Workflow active를 독립 조회했다.
- 원래 install lease와 recovery claim은 삭제하지 않고 `recovery/post-switch/<requestId>.install-lease` 및 `.recovery-claim`에 보관됐다. 해당 원본의 활성 install lease/RECOVERY_REQUIRED marker와 recovery claim은 더 이상 남아 있지 않다. 별도 `.complete.json`의 설치 SHA·원본 ledger 해시·완료 상태도 재조회했다.
- 원본 실패 ledger의 역사적 `RECOVERY_REQUIRED` 값은 바이트 보존 계약에 따라 남아 있다. 이를 현재 활성 장애로 재분류하지 않으며 별도 완료 기록·보관 검증으로 해소를 판정한다.
- #919 복구 전달 #1215 한 건과 사후 진단 #1216 한 건을 원격 전수 조회하고 두 JSON/TXT 결과쌍 4개 원문 해시를 재검증했다. 신규 PC 작업·Controller 재설치·Writer 변경·Core 기동/중단·DB/D1 변경은 이 최종 보관에 포함되지 않았다.
- **#917 Controller 복구 8/8 완료. 해당 공용 설치 대기열 복구 게이트 5/5 완료.** 다른 기능의 개발/설치/게시 완료를 의미하지 않는다.
- #1213은 skipped였으므로 라이브 Core 실행 source SHA는 별도 미확인으로 유지한다. 이 복구는 해당 증거를 생성하거나 수동 checkout 관측을 라이브 Core 증거로 바꾸지 않았다.
- #1088/#1160 원담당 브랜치와 main 코드를 직접 수정하거나 PR 병합하지 않았다. 정규 A 결과 업로더의 main 결과 파일 추가는 별개다. 이 PR은 통합 검토용 Draft이며 실제 승인 C 복구 성공과 소스 통합은 구분한다.
