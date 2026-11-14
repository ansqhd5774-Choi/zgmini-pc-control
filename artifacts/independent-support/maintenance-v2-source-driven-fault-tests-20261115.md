# ZGMINI 독립 지원 2차 — V2 인계 STOP→Journal 실패 경계 실증 보강

- 일자: 2026-11-15 KST
- 기존 운영 Owner: 중앙 #68의 29차 COORD 및 지정 단일 Windows Operator
- 유형: `SUPPORT_ONLY / SOURCE_STATIC_CHECKS / ISOLATED_NODE_FS_FIXTURE`
- **실제 운영 인계·Controller 설치·Windows Runner CI 아님.** 정규 작업자의 승인·실행·배포를 선점하지 않는다.
- 지원 브랜치: `support/maintenance-v2-prejournal-audit-20261115` (기존 29차 브랜치 및 main 불변)
- 고정 대상: `tools/handoff-maintenance.mjs@c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7` (blob `5ab6339c4a28329c8b39d37d007ac6428f8c7e0f`), `tools/maintenance-agent.mjs@c2e6744...`
- 재사용한 과거 성과: #996 C 복구, #1365/#1366 유지보수기 승인, #1367 안정성, #1368 Controller 15파일 승인 source main 병합, 29차 source diff dry-run. 모두 재실행하지 않음.

## 1. 실제 실행한 새로운 검증(원본 코드와 합성 fixture 분리)

### A. GitHub의 **실제 코드 텍스트** 10개 정적 검사 — 10/10 조건 일치

1. STOP_REQUEST 기록이 90초 종료 대기보다 앞에 위치
2. STOP 이후 종료 대기 구간이 최초 handoff journal `persist()`보다 앞에 위치
3. 백업 디렉터리 생성과 원본 파일 copy가 최초 journal보다 앞에 위치
4. Startup snapshot이 최초 journal보다 앞에 위치
5. 주 `try/catch` 시작이 journal `persist()` 다음에 위치
6. Receiver 코드는 controller-install lease가 있으면 협조 STOP 수락 거부
7. Receiver는 STOP을 수락하면 `STOP_REQUEST.json`을 `STOP_HANDLED-<nonce>.json`으로 이름 변경
8. Receiver polling 종료 대기 60초가 존재
9. 기존 `tests/maintenance-handoff.test.mjs`는 main 전체 호출 기반 STOP/백업/저널 실패 주입을 포함하지 않음(이 한 파일의 확인 결과)
10. 별도 핀 source와 조회 시점 `main`의 handoff 파일 blob SHA가 동일

**이 10/10은 안전 PASS가 아니라 위험 경계의 소스상 존재 여부가 일치한다는 뜻이다.**

### B. 임시 디렉터리 기반 Node.js 22 격리 실패 주입 — 7/7 실행

[재실행 가능한 **합성 source-order fixture**](../../tests/support/maintenance-prejournal-fault-injection.test.mjs) (테스트 전용으로 직접 구성한 순서 모형이며 `handoff-maintenance.mjs` 자체를 실행하지 않음)

실행 명령(별도 지원 브랜치를 로컬에서 확인할 때에만):
`node --test tests/support/maintenance-prejournal-fault-injection.test.mjs`

| 시나리오 | 시험 출력 | 사후 모형 관측 |
|---|---|---|
| STOP 후 종료 대기 timeout | PASS(예상 예외) | STOP_REQUEST 존재, journal 없음; Receiver의 추후 STOP 가능 |
| 백업 mkdir 실패 | PASS(예상 예외) | Receiver 종료 모델, journal 없음 |
| runtime 사본 세 번째 이후 실패 | PASS(예상 예외) | 부분 백업 생성, journal 없음 |
| Startup 사본 실패 | PASS(예상 예외) | Receiver 종료 모델, journal 없음 |
| 최초 journal persist 실패 | PASS(예상 예외) | Receiver 종료 모델, journal 없음 |
| 정상 baseline | PASS | 최초 journal 존재 |
| **90초 timeout 후 늦은 Receiver STOP 수락** | PASS | 먼저 종료 대기 실패 → 이후 STOP_HANDLED 파일이 생성돼도 journal 없음 |

실행환경: **Linux 임시 디렉터리의 Node v22.16.0**, `node:test`, 파일 I/O는 OS temp 파일만 사용, Windows Receiver·운영 ROOT·운영 프로세스 미접근. 마지막 테스트는 Receiver polling 코드에서 수락된 STOP 파일 rename을 **모형으로 재구성한 것**이며 진짜 운영 프로세스를 중지시키지 않음.

결과: **7 tests, 7 pass, 0 fail**, 합성 fixture에 의한 기대 실패 경계 재현. **기존 승인 V2 실제 Windows 인계 코드/실PC 안정성 PASS를 의미하지 않는다.**

## 2. 추가로 분리한 구조적 위험

### R1 — 에러 반환 뒤 늦은 STOP 수락

실제 `tools/handoff-maintenance.mjs`는 `STOP_REQUEST`를 기록하고 최대 90초 기다린 후 `requirePriorStopped`를 호출한다. 그 시점에 Receiver가 여전히 생존이면 예외가 본 journal 생성 전 구간에서 발생한다.

`tools/maintenance-agent.mjs`는 `pollOnce()` 전후 또는 다음 60초 polling 주기에 STOP_REQUEST를 처리할 수 있다. **종료 대기 timeout 이후 잔류 STOP_REQUEST가 처리되어, 오류 응답이 반환된 다음 Receiver가 중단될 가능성**이 있다. 코드 경계에서 가능성을 찾았지만 운영에서 관측된 사건은 아니다.

### R2 — STOP 성공 이후 snapshot/journal 생성 실패

인계 소스 320~335행의 동작은 주 `try/catch` 진입 전이다. 백업 생성 또는 snapshot write의 동기 실패가 원장 `handoff-<SHA>.json` 생성 전에 발생하면:
- Receiver는 이미 중단됐을 수 있음
- 백업은 없거나 일부만 존재할 수 있음
- 해당 handoff journal이 전혀 없을 수 있음
- 설치 런타임 원본은 아직 교체되지 않은 단계일 수 있음
- 기존 `requireNoUnfinishedHandoff`는 `handoff-*.json` 중심이므로 **없어진 journal만으로 정상 무변경을 증명할 수 없음**

### R3 — 운영용 상태 분류 오판 우려

현재 모듈의 CLI 최상위 예외 처리에서는 `{status:'AUTOMATION_BLOCKED',code:...}` 출력을 사용한다. 이 분류는 **사전환경 차단**과 **STOP 요청 후 발생한 예외**를 구분하는 영구 기록이라고 볼 수 없으므로, 출력 한 줄만으로 원본 Receiver 생존·백업 정상·무부작용을 단정하면 안 된다. 진짜 상태는 Windows owner/STOP_HANDLED/backup/journal/lease 실측으로 확인해야 한다.

## 3. 기존 29차 담당자에게 권고할 최소 작업

**현재 운영 Owner 업무를 대체하지 않는 기술 검토 제안:**

1. 정규 V2 인계 전에 `STOP_REQUEST` 이후 `BACKUP`/최초 journal 단계의 복구 판정을 정리하되, **실제 이 구간의 예외가 기존 계약으로 안전하게 처리된다는 증거가 없다면 무조건 무변경으로 간주하지 말 것**.
2. 가능한 최소 설계 보완: 종료 요청 이전 원자적 단계 기록(고유 journal + 충돌 방지), 사본 쓰기 오류의 단계 구분, STOP timeout시 늦은 수락과 재실행 경합의 명시 처리. 특정 순서·대체 구현은 실제 소스 소유자가 승인 계약을 확인해 결정.
3. 만약 런타임 source 코드 패치를 필요로 한다면 **V2 target SHA c2e6744...와 9파일 pinned manifest가 함께 달라질 수 있으므로**, 기존 승인 문서를 변경 없이 새 코드에 적용하지 않는다. 별도 심사/승인/새 target pin 필요.
4. 29차가 정규 Operator 경로를 확보하지 못해 인계가 계속 `NOT_RUN`이면, 인계 재시도를 만들지 않고 설치 후 판정표·기능 원담당의 독립 준비 업무를 이어 간다.
5. 기존 #996 C 복구, #1368 Controller 승인, B raw SHA 확보 및 #1368 시뮬레이션을 반복하지 않음.

## 4. 후속 수신·진행 추적

| 구분 | 판정 |
|---|---|
| S0 담당/업무 중복 감사 | 완료 |
| S1 인계 사전 리스크 | 새로운 위험 3개(R1~R3) 기술적 가능성 확인, 운영 미재현 |
| S3 source 순서 시험 | 실제 GitHub 원본 정적 10/10, 격리 Node fixture 7/7 |
| S4 설치 후 상태 분류 매트릭스 | 이미 작성되어 링크 재사용 |
| 29차 7→7 운영 인계 | 최신 #68상 `NOT_RUN` |
| 29차 Controller 설치 | 최신 #68상 `NOT_RUN` |
| 29차 승인 15파일 | 별도 B 승인 source main **완료**, 재조사 금지 |
| 향후 지원 | 위험별 승인 소유자의 검토·처리 여부 추적, 미검증 다른 범위의 조사로 이동 |

기존 읽기 전용 지원 문서:
- [원장 이전 소스 위험 감사](maintenance-v2-prejournal-risk-review-20261115.md)
- [운영 결과 판정표](maintenance-v2-outcome-readback-matrix-20261115.md)

**최종 상태**: `SUPPORT_FAULT_BOUNDARY_CHECKED / STATIC_10_OF_10 / ISOLATED_FIXTURE_7_OF_7 / RUNTIME_NOT_RUN / NO_OPERATING_MUTATION`.
