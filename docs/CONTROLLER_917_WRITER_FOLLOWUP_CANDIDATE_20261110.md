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

- 현재 `approved:false`이며 실행 승인이 아니다.
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

새 사용자 명시 C 승인 및 단회 실제 복구 성공, #919 중복 없음, 원본 원장/백업 보존, install lease/claim 보관 재조회, Controller·Supervisor·전용 6 Runner·후속 결과 확인, RECOVERY_REQUIRED 해소가 모두 필요하다. 현재는 **준비 통과/승인 대기**이며 복구 완료가 아니다.
