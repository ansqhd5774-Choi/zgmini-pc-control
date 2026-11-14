
# ZGMINI 독립 지원 4차 — Watchdog GitHub 결과 댓글 재전송 차단 결함 재현

- 작성: 2026-11-15 KST
- 대상: 31차 통합 PR [#1370](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1370), main merge `d01229adacc3c23f50bb119d146e291ff7e15012`
- Source pin: `tools/runner-watchdog.mjs` Git blob `aa67452df6f45ebcaa67e75467c9e9cad0d2e198`
- 범위: `SUPPORT_ONLY / ISOLATED_SOURCE_FUNCTION_REPRO / NO_WINDOWS_OPERATOR / NO_OWNER_CODE_CHANGE`
- 주의: 실제 운영 Watchdog 업그레이드, 유지보수기 7→7, Controller B 설치는 아직 원격 PC 성공 증거가 없다. 아래 결함은 **구현된 신규 코드의 논리 재현**이지 생산 PC 사고 발생 증거가 아니다.

## 1. 관측한 결함과 영향

새 브리지는 성공한 인계 영수증을 영구 단회 원장(`handoff-attempts/<requestId>.json`)에 먼저 기록한 후 GitHub Issue 댓글을 전송한다. GitHub 댓글 게시가 실패할 경우 운영 인계를 **다시 실행하지 않고 영수증만 재전송**하려는 구조다.

그러나 코드에서 호출 순서는 아래와 같다.

1. `pollHandoff()`가 이미 열린 요청 Issue를 선택, 내용을 읽음.
2. **`const plan=prepareHandoff(issue)` 호출.**
3. 그 다음 `receiptFile=...` 및 `if(fs.existsSync(receiptFile))`로 기존 원장을 확인하고 `postHandoffReceipt`를 재전송함.
4. `prepareHandoff`는 `MAINTENANCE_INSTALL.sourceSha`가 V2 승인 문서의 **이전 설치 SHA** `16064e29...`와 같아야만 통과함.
5. 7→7 인계가 이미 성공했다면 설치 SHA는 **목표 SHA** `c2e6744...`로 바뀜.
6. 댓글 업로드가 실패한 뒤 다음 Watchdog poll에서 **이미 완료된 원장 재전송보다 먼저** `HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH`가 발생함.

결과적으로 **설치 자체 성공 + 로컬 원장 PASS + GitHub 결과 댓글 누락** 상황에서, 이후 자동 댓글 재전송이 도달 불가능해진다. 원본 운영 파일 손상이나 중복 설치를 입증하는 내용은 아니다. 즉시 실패가 난 경우에 원장 없이 인계를 다시 실행하는 일과도 다르다.

**위험:** 중앙 담당자는 실PC에 설치가 끝난 사실을 원격으로 회수하지 못해 `NOT_RUN`/불명확으로 오판하고 Controller 후속 단계를 계속 기다릴 수 있다. 새 영수증을 강제로 만드는 우회·재실행은 허용하지 않는다.

## 2. 실제 근거와 독립 재현

- [신규 Watchdog 원본](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/d01229adacc3c23f50bb119d146e291ff7e15012/tools/runner-watchdog.mjs): `pollHandoff`에서 `prepareHandoff`가 기존 영수증 조회보다 먼저 호출됨.
- 동일 원본의 `prepareHandoff` 내부는 `validateHandoffIntent(issue,body,approval,installed,rawDigest)`로 현장 설치 source와 `approval.installedSha`를 대조.
- 성공한 인계 실행 코드 `handoff-maintenance.mjs`는 목표 `MAINTENANCE_INSTALL.sourceSha=c2e6744...`를 정상 결과로 기록하도록 설계됨.
- [전담 support 브랜치의 재현 테스트](../../tests/support/watchdog-handoff-ack-replay-regression.test.mjs)는 **실제 기존 소스에서 `validateHandoffIntent`, `prepareHandoff`, `postHandoffReceipt` 함수를 추출**하여, Windows/실GitHub/실파일을 대신한 격리 모형에서 실행.
- V8 실행기에서 GitHub에 저장된 시험 파일을 재조회·모형의 Node I/O를 대체해 직접 실행한 결과 **기존 코드 기반 테스트 4/4 PASS, 원하는 수정 후 기대 동작 TODO 1건**. Node.js CI 또는 Windows 원본 Watchdog main 전체 실행은 수행하지 않음.

| 시나리오 | 실제 함수 반환 | 판정 |
|---|---|---|
| 이전 설치 SHA로 유효 Issue 사전검증 | 정상 승인 | 기대 동작 |
| `pollHandoff`의 호출 순서 | 새 설치 preflight → 기존 receipt 조회 | **원인 확정** |
| 성공 이후 source SHA가 목표로 바뀐 상태에서 동일 Issue 사전검증 | `HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH` | **결과 재전송 차단 재현** |
| 기존 결과만을 `postHandoffReceipt`에 직접 전달 | 기록 전송 가능(격리 모의 GitHub) | 재전송 함수 자체보다 **호출 순서/승인 단계 분리** 문제 |

## 3. 수정 제안 — 기존 Owner의 결정용, 새로운 운영 승인 아님

**핵심:** '새로 7→7을 실행할지 승인'하는 엄격한 preflight와, '동일 요청에서 이미 영구 저장된 결과만 재전송'하는 read-only reconciliation을 분리해야 한다.

제안되는 안전한 처리 순서:

1. GitHub Issue의 **인증된 작성자·기존 라벨·OPEN·고정 제목 및 exact 5필드 body**를 확인하고, requestId UUID/target SHA/manifest digest 구문을 검증한다. 이 단계에서 임의 명령, path, 실행 source를 입력으로 받지 않는다.
2. 승인된 requestId로 **기존 로컬 단회 원장 존재 여부를 먼저 조회**한다.
3. 원장이 있으면 `issueNumber/requestId/targetSha`를 **정확히 대조**하고, 이전 소스 SHA 기준의 신규 실행 preflight를 요구하지 않는다. `PASS`/터미널 결과는 위조·drift 없는 기존 고유 영수증의 재전송만 허용하고 **새 Windows Operator를 호출하지 않는다**. `RUNNING`이면 기존 코드의 `STATE_UNKNOWN` 보수적 보존 규칙을 유지한다.
4. **영수증이 아예 없는 경우에만** 기존 전체 `prepareHandoff(issue)`를 호출해 구형 설치 SHA·V2 raw 승인·현재 PC lease·main checkout/ancestry·Operator source 해시를 검증한 후 기존 `wx` 단회 원장을 만들고 실행한다.
5. 재전송 실패는 **댓글 결과 회수 문제**로 분류하고, 실제 원본 파일·수집기·Runner·Controller 설치를 건드리거나 기존 C 복구를 재실행하지 않는다.

**경계:** '영수증 존재'만으로 인증 없이 요청을 승인하면 취약해질 수 있으므로 **작성자/라벨/요청 필드/원장 바인딩 검증은 항상 수행**한다. 단순히 `prepareHandoff` 호출을 주석 처리하는 식의 우회 금지. 새 Watchdog 코드 변경은 원래 #1370 source 및 승인된 Watchdog 업그레이드 SHA를 변경하므로 기존 설치 승인 pin을 무단 재사용하지 않는다.

## 4. 현재 운영 작업과의 비중복

- 31차 Owner가 Watchdog의 신규 capability를 설치해야 하는 선행 조건을 다루는 중이며, 이 지원은 **향후 댓글 전송 실패의 종단 중복방지**만 검증.
- 원본 29/30차 #996 복구, 15파일 B manifest, Watchdog 소스 구현, 기존 isolated Windows CI를 재실행하지 않음.
- 이 지원 브랜치에서 원본 `tools/runner-watchdog.mjs`, `tools/install-runner-watchdog.mjs`, Watchdog INSTALL.json/Runner/Controller/Workflow/DB/D1/예약을 수정하지 않음.
- 지원 발견을 중앙 #68에 한번 인계하되, 실제 기존 총괄/운영 Owner가 이를 수신·승인·패치·실PC 적용했다는 증거로 간주하지 않는다.

## 5. 다음 실제 Owner 확인 및 지원 후속

- 현재 Watchdog upgrade **NOT_RUN**, 7→7 인계 **NOT_RUN**, Controller B 설치 **NOT_RUN**. 이 이슈는 향후 인계 결과 댓글이 실패할 때 임시로 막힐 수 있는 안전성 버그이며, **새 전역 설치 Gate를 이 문서가 자동 생성하지 않는다**.
- Owner가 실제 Watchdog upgrade source와 승인 pin을 고정할 때 본 이슈의 최소 수정 여부를 결정. 적용했다면 회귀시험은 ① 기존 terminal receipt ② 이미 target source 설치 ③ lost Github ACK ④ 재전송만 1회 ⑤ child process spawn 0회까지 반드시 확인.
- 지원자는 그 전까지 동일 승인·해시 검사를 반복하지 않고, 별도 신규 Watchdog 업그레이드 preflight/rollback 계약의 미검증 구간을 지원한다.

**판정:** `SOURCE_ORDER_DEFECT_REPRODUCED / OLD_SHA_REPLAY_BLOCK / SUPPORT_TEST_4_OF_4 / OWNER_PATCH_PENDING / NO_PC_MUTATION`.
