# ZGMINI 독립지원 S4 — 유지보수기 인계 영수증 판정 자동화 검증

- 기준일: 2026-11-15 KST
- 업무 유형: SUPPORT_ONLY, SOURCE_TESTED_WITH_V8, READ_ONLY_INPUT, NO_WINDOWS_OPERATOR
- 소유자 분리: 30차 COORD/기존 단일 Windows Operator가 7→7 인계와 후속 Controller 설치의 유일 실행 Owner. W01~W06는 기능 운영 담당. 본 지원 코드는 운영 명령/승인/manifest가 아니다.
- 이전 완료점 승계: #996 C 복구 완료, #1365/#1366 V2 유지보수기, #1367 안정성, #1368 Controller 15파일 B 정규 승인 명세 병합 완료, #1369 R30 반복 검사 방지 지침, 기존 #68의 29/30차 결과를 **다시 실행하지 않았다**.
- 실제 V2 source pins: 유지보수기 old `16064e29fea0e53e7769a24d93d75b6f5292cfc0`, target `c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7`. 사용자 운영 실측 완료 증거는 아직 미입수.

## 1. 신규 구현

- [소스: 읽기 전용 자동 상태 판정기](../../tests/support/maintenance-v2-receipt-classifier.mjs): `classifyHandoffReceipt(observation)`, 반환 `{status, reason, next, operationalPass}`.
- [실행 가능한 표준 Node 테스트](../../tests/support/maintenance-v2-receipt-classifier.test.mjs): 실수·불완전한 보고에서 `HANDOFF_VERIFIED` 오분류를 막는 고정 테스트 27건 및 필수 증거 조합 256건.
- **수정된 운영 코드 0개.** 테스트·판정기는 새 `support` 브랜치에만 있고 `main`, 유지보수기/Controller 소스, 설치 manifest, 워크플로·예약에서 미참조.
- **검증 실시:** GitHub에 저장된 판정기 파일과 테스트 파일을 원격 재조회하여, 연결된 V8 실행 환경에서 모듈 함수와 테스트 본문을 실행. `28/28` 테스트 PASS (고정 27 + 조합시험 1), 조합시험 내부 `256/256` 판정 일치. **실제 Node.js Test Runner CI나 운영 Windows에서 실행한 것은 아니며, GitHub 등록된 Node 테스트 파일은 후속 재현용**.

## 2. 보수적인 핵심 판정

`HANDOFF_VERIFIED`는 다음 모든 필드가 실제 기존 Owner가 인증한 **동일 인계 건의 원본 증거**로 확인될 때에만 반환한다.

| 입력 | 완료 요구 |
|---|---|
| `attemptObserved` | `true` |
| `journalPresent`, `journalStatus` | `true`, `PASS` |
| `installedSourceSha` | 정확 V2 target `c2e6744...` |
| `runtimeHashesVerified` | 7개 유지보수기 runtime raw bytes 실증 `true` |
| `receiverOriginVerified` | 새 Windows Receiver CAPTURE/nonce/origin 실증 `true` |
| `protectionPreserved` | 원본 Controller/Core/Workflow/Runner/DB/D1/#996 보관 보호 확인 `true` |
| `runnerSeatsVerified` | 운영 6 Runner 상태 실증 `true` |
| `installLeaseClear` | 해당 인계 이후 공유 lease 해소 실증 `true` |
| `remoteReportPresent` | 고유 원격 결과 회수 `true` |
| `ownerReceiptVerified` | 기존 Owner가 출처·시각·실행식별·원본 일치 확인 `true` |

**중요:** 이 코드는 증거를 **직접 수집/서명검증하지 않는다.** `true`라는 입력 자체는 출처 증명이 아니다. 원본 Owner가 실제 JSON/TXT, Receiver Windows Origin, 원본 해시 및 보호를 검증한 뒤에만 해당 필드를 입력한다. 입력 신뢰성을 제3자가 보증하지 않으면 `operationalPass`를 최종 서비스 완료로 승격하지 않는다.

## 3. 경계 상태

| 상태 코드 | 해석 | 후속 |
|---|---|---|
| `NOT_RUN_UNCONFIRMED` | 인증된 실행 자료 없음 | 기존 실행 결과 수신 대기·다음 사전작업 진행 |
| `EVIDENCE_CONFLICT` | 원장/소스·실행 주장 상충 | 기존 Owner에게 원본 요청 |
| `STOP_PENDING_OR_TIMEOUT` | STOP 잔재 및 늦은 처리 가능 | 원본 Receiver alive·handled 재확인 |
| `STOPPED_PREJOURNAL_UNKNOWN` | Receiver 정지 가능, 최초 journal 없음 | 임의 재실행 금지·Owner 복구 판정 |
| `HANDOFF_IN_PROGRESS` | journal RUNNING·operator 생존 | 다른 인계 실행 금지 |
| `INCOMPLETE_JOURNAL` | RUNNING journal·operator 미생존 또는 미확정 | 원본 작업·lease 확인 |
| `RECOVERY_REQUIRED` | 원본 인계 코드 복구 필요 | 기존 승인 복구 Owner |
| `ROLLBACK_REATTESTATION_REQUIRED` | rollback 기록만으로 origin 입증 불가 | 원본 Receiver 재인증 |
| `PASS_BUT_RECEIVER_UNVERIFIED` | journal PASS이지만 새 Receiver 출처 입증 부족 | 외부 정상 판정 금지 |
| `PASS_EVIDENCE_INCOMPLETE` | 파일·보호·lease·Owner 인증 등 필수 증거 누락 | 정확히 누락된 원본만 회수 |
| `UPLOAD_GAP` | 로컬 PASS 증거 있으나 원격 보고 누락 | 고유 영수증 회수, 인계 재실행 금지 |
| `HANDOFF_VERIFIED` | 모든 완료 근거 확인 | **유지보수기 인계만** 완료, Controller 설치 별개 |

**중대한 안전 규칙:** CLI `AUTOMATION_BLOCKED` 또는 원장 `BLOCKED`가 단독 확인됐다고 Receiver가 살아있거나 운영 상태가 불변이라고 가정하지 않는다. #996 C 복구 원본을 다시 실행하지 않으며 파일·lease 임의 삭제/승인하지 않는다.

## 4. 이번 자동 테스트 분모

- 일반 고정 테스트 **27/27 PASS**: 원장 없음, 실행 증거 부재, 모순, 과거 SHA, Receiver 미인증, 공유 lease, 원격 결과 누락, STOP 미처리·처리완료, 회복 필요 등.
- 8개 필수 입증 플래그 전체 **256/256 속성 확인**: 증거가 모두 참인 1개 조합만 `operationalPass=true`; 어느 하나라도 거짓이면 `false`.
- 테스트 파일 총 `28/28 PASS`. 실행 엔진은 **V8 Code Mode의 순수 JavaScript**, 기존 검증 결과와 구분. Linux Node 직접 실행이 완료됐다는 주장은 하지 않는다.
- 과거 별도 STOP→prejournal 격리 Node Fixture **7/7 PASS**는 이전 지원 기록의 재사용 증거이며 이번 회차 새 설치 결과가 아니다.

## 5. 앞으로 실제 Owner 결과가 도착하면

1. 기존 30차/Owner가 승인된 독립 Windows 경로에서 실행한 **고유 원본 실행식별자**와 수신 시각을 먼저 교차 확인.
2. 원본 기록에서 실제 검증된 관측값만 `observation`에 입력. 확인할 수 없는 필드는 `null`로 두고, 증거가 없다고 무조건 `false` 쓰지 않음.
3. 판정기가 `HANDOFF_VERIFIED`를 반환해도 **유지보수기 인계만 성공**이며 #1368 Controller 15파일 단회 B 설치 및 기능 A/SQLite/D1/Production 검증을 자동 완료로 처리하지 않음.
4. 실제 결과가 없으면 이 상태 검사를 반복하지 말고 **다음 독립 기능별 사전 예방·원본 계보 조사**로 이동. 30차 Owner의 인계·Controller B·수집·배포 실행을 선점하지 않음.

## 6. 사용자 요청 도구 활용/금지

- GitHub connector: 최신 정본 확인, 지원 브랜치 code/test/docs 저장, 중앙 인계.
- 코드 실행: V8에서 GitHub 저장 판정기와 테스트를 직접 다시 읽어 실행, 27개 표본+256개 상태 전수 검사.
- 기존 Runner/Actions 통한 Windows 유지보수기 자체 업데이트 또는 승인 없는 Workflow 실행: **사용하지 않음**. 이미 owner가 금지한 경로이며 신뢰성 이점 없음.
- 원격 데스크톱 플러그인: **사용하지 않음**.
- 브라우저 CDP/Google Drive/Notion/Slack/Canvas: 이 판정기 증거에 추가 정확성을 주지 않거나 다른 담당 범위를 침범하므로 사용하지 않음. 현재 본 지원 작업의 원장 정본은 GitHub #68이며 별도 인계 플랫폼으로 중복 기록하지 않음.

**완료 판정:** 지원 코드+원격 검증+실행 가능한 테스트+정본 인계 준비 `DONE`; 실제 유지보수기 인계 `NOT_RUN`; 신규 Controller 설치 `NOT_RUN`; ZGMINI 전체 완료율 상승 0.
