# ZGMINI #1378 원담당 실행 — 독립 지원 사전 자료 (2026-11-15)

목표는 기존 Watchdog/유지보수기 7→7 인계 완료이다. 다른 기능 업무로 변경하거나 이미 완료한 조사를 반복하지 않는다. 기존 단일 Owner만 운영 실행을 담당한다.

## 재사용할 정확한 기존 증거

- #1376 Run 43633660101: Watchdog R2 STAGED, 당시 비활성.
- #1387 Run 43637418425: R2 Guardian 인증 신규 Watchdog 프로세스 PASS.
- #1389 A 원본: HEALTHY_NEW_SCOPE / #1378 NOT_CLAIMED / receiver PRIOR-LISTENING / BLOCKED-ENOENT / 개발 checkout MAIN_TARGET_NOT_ANCESTOR / 설치 lock FREE / STOP_REQUEST ABSENT / writes 0.
- #1390 source PR: merged. 새로운 Watchdog 소스는 공유 개발 checkout을 변경하지 않고 TEMP의 고유 requestId 하위에 원본 private main clone을 만들고 승인 9개 파일을 확인한다.
- #1392 R3 B PR: merged. R3 source commit a2ec241d98a2ca93508443deb5b4688ecbccb905, 새 JS raw SHA256 3f99ea3357c6731cc9000bde1273db915cb07ba5fa480718194deb6330c29072.
- #1393 Run 43639988809: R3 WATCHDOG_B_APPROVED_SOURCE_STAGED_AWAITING_NATURAL_RESTART, writes 2. 아직 R3가 실행된다는 증거 없음.
- 원격 main과 목표 승인 source commit c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7의 승인 소스 9파일은 Git 본문과 blob SHA가 9/9 같다. 승인 Manifest는 목표 커밋 이후 main에 추가됐고, Git 원본 raw LF SHA256은 #1378 승인 값 458bd775e2f50fef4212713f859bc601205159fe503d4cdb697786256663c4cb과 일치.

## 독립 지원 사전 준비 완료

- watchdog-b/handoff-1378-source-preflight.mjs: 원래 #1389의 정확 증거 신원, 독립 clone GitHub origin, branch main, target ancestry, 정확 9개 source와 승인 Manifest raw SHA256, target Git object bytes, 10개 허용 경로 clean을 한 번에 source-only 판정. 어떠한 git clone/fetch/reset, 운영 실행, 쓰기도 하지 않는다.
- tests/watchdog-handoff-source-preflight.test.mjs: 실제 Git 승인지문 검증과 입력 위조, manifest 누락, 소스 변조, 대상 원본 SHA drift, non-main, dirty checkout 및 다중 실패를 부정시험.
- CI Run 43640137910: Windows 격리 source-only 137/137 PASS, fail0/skip0. C996 R5 Run 43640137892 success. 정규 운영 PC 실행은 아니다.
- Windows CI 최초 실패는 GitHub Actions 작업트리의 Manifest CRLF 변화로 발생했다. 고정 승인 SHA를 바꾸지 않고 테스트 fixture만 Git HEAD 원문 바이트로 고쳐 CI PASS. 신규 Guardian 독립 clone은 원래 core.autocrlf=false를 유지한다.

본 source-only 도구는 기존 #1390 런타임 verifyHandoffIsolatedSource에 새 의무 Gate를 만들지 않는다. 그 검증이 성공하면 동일 source 체크를 다시 실행하지 않는다.

## 지금 원담당이 해야 할 다음 실제 작업

1. 이미 STAGED인 #1393 R3 Watchdog 소스를 기존 독립 Guardian 정규 단회 승인·활성화 절차로 연결하고 새 PID/부모 WScript/사용자 SID/실제 JS SHA/scope 증거를 확보한다. 원래 사용 완료 V2 #1387 재실행 금지.
2. R3 활성화 PASS 뒤 새로운 handoff Issue를 만들지 말고 원래 #1378에 대한 자연 poll/단회 실행만 허용한다. R3는 승인된 TEMP 독립 main clone을 사용하므로 오래된 공용 개발 checkout을 강제로 갱신할 필요 없다.
3. terminal 결과는 기존 #1378 영수증, 설치 Receiver 정확 source SHA c2e6744..., 실제 7→7 로컬 원장, 새 Receiver 독립 원본 증거를 결합해 판정한다. STAGED, CI PASS, GitHub 성공 댓글만으로 인계 완료를 선언하지 않는다.
4. Controller 15파일 B는 이 7→7이 실제 PASS인 뒤 별도 정규 승인 범위에서 실행한다. Controller/Writer/Core/SQLite/D1/예약/Task는 이번 지원 작업으로 변경하지 않는다.

## 정확한 실패 1개에 대한 후속 분기

- R3 Guardian WMI origin 실패: 정확 최초 불일치 predicate 하나만 수정, 새로운 승인 원문 지문 확인 후 Owner 결정. 강제종료/반복 B 금지.
- 원본 #1378의 HANDOFF_SOURCE_CLONE_FAILED: private origin 및 승인된 클론 접근 조건 하나만 조치. 개발 repo reset 금지.
- HANDOFF_SOURCE_ISOLATED 계열: 첫 실제 source/Manifest/checkout mismatch 범주만 수정. 승인 SHA 완화나 checkout 임의 덮어쓰기 금지.
- 이미 RUNNING/receiver TARGET: 원본 receipt 및 독립 installed origin으로 reconcile. 동일 operator 재실행 금지.
- 인계 PASS 주장과 현장 ledger/origin 불일치: STATE_UNKNOWN/복구 요구로 보호 정지. Controller B 추진 금지.

진행률은 독립 지원 사전 구현 완료와 실제 7→7 및 Controller B 완료를 반드시 분리해 보고한다.
