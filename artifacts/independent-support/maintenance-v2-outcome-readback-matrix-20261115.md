# ZGMINI 독립 지원 S4 사전 준비 — 유지보수기 V2 단회 인계 결과 해석 매트릭스

- 일자: 2026-11-15 KST
- 상태: `SUPPORT_ONLY / READBACK_DECISION_TABLE / NO_LIVE_WINDOWS_OBSERVATION`
- 범위: **7→7 유지보수기 인계 상태 판정**. 29차 단일 Owner의 인계 실행·Controller 15파일 설치·W01~W06 기능 A/SQLite/D1/배포 검증을 대신하지 않음.
- 근거 [source](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7/tools/handoff-maintenance.mjs#L248-L445), [receiver](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7/tools/maintenance-agent.mjs#L748-L783), [V2 manifest](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/0358dfcb1134c2eff5ab7e2d1a331883cea83a73/approvals/maintenance-handoffs/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7.json)
- 본 문서는 **새 STOP/GO 승인·PC 실행·복구 명령이 아니다.** 운영 실측 기록이 들어오기 전까지 모든 실제 상태는 미확인.

## 1. 최소 영수증 입력(실제 운영 Owner가 정규 Windows 경로에서 제공할 수 있는 기존 원본만)

| 항목 | 확인할 값 | 목적 |
|---|---|---|
| Operation | 정확한 요청/실행 시각·호스트·Operator 원본 | 중복 인계 방지 |
| Source identity | `MAINTENANCE_INSTALL.sourceSha`, 기존 `16064e29...` 또는 목표 `c2e6744...` | 실제 설치 확인 |
| Runtime bytes | 유지보수기 7개 실제 파일 SHA-256·manifest 7/7 | 소스 원장과 실바이트 구분 |
| Receiver | `leases/receiver/owner.json`, PID/nonce/bootAt, 살아 있는지, CAPTURE proof | 실제 Windows origin 증명 |
| Cooperative stop | `STOP_REQUEST.json`, `STOP_HANDLED-<nonce>.json` 존재 여부 | STOP 요청 전후 단계 판정 |
| Handoff journal | `handoff-<targetSHA>.json` status/code·backup | 지연/부분실패 인식 |
| Shared guard | `leases/controller-install`, `HANDOFF_RECEIVER_PROBE_GUARD.json` | 다른 B와의 경합·복구 확인 |
| Protection | 기존 Controller·Core·Workflow·Runner6·SQLite/D1·#996 archive 원본 | 기존 보호 보증 |

위 항목을 임의 출력/추측으로 채우지 않는다. 실제 부재를 확인하지 못했으면 `UNKNOWN` 처리한다.

## 2. 관측 기반 분류표

| 분류 | 관측 조건(예시) | 가능한 판정/조치 경계 |
|---|---|---|
| `NOT_RUN` | 29차·Owner의 실제 인계 원본 Issue/Windows 결과 없음 | 설치 0. 별도 진단을 임의 실행하지 않음 |
| `PREFLIGHT_BLOCKED_UNTOUCHED` | 원본 Receiver 여전히 생존·정확 기존 source/bytes, STOP 요청도 없고 보호 동일 | 사전검사 거부로 한정. 오류 인수/원본만 담당자에 전달 |
| `STOP_PENDING_OR_TIMEOUT` | STOP 요청 있음, 원장 없음, Receiver PID 살아 있거나 미확정 | `AUTOMATION_BLOCKED` 출력만으로 무변경 단정 금지. 늦은 STOP 가능성 때문에 원본 상태 추적 |
| `STOPPED_PREJOURNAL_UNKNOWN` | STOP_HANDLED/Receiver 종료 증거, 원장 없음, 백업 없거나 부분 생성 | **중간 상태 위험**. 새 인계 실행·파일 삭제·잠금 강제 해제 금지, 기존 Owner에게 source+Windows 원본으로 특화 복구 판정 요청 |
| `HANDOFF_IN_PROGRESS` | 인계 journal RUNNING, lease/guard 존재 | 기존 Operator 생존·진행/종료 확인; 다른 인계 금지 |
| `RECOVERY_REQUIRED` | 원장 오류, 새 Receiver 검증 실패, lease·guard 보존 또는 부분 파일 복원 | 원본 보존, 기존 검증된 복구 계약 적용 전 조사; 자동 재실행 금지 |
| `PARTIAL_ROLLBACK_UNVERIFIED` | 파일 백업 복원됨, Receiver 재접속/Origin 미검증 | `ROLLED_BACK`으로 오판 금지 |
| `PASS_BUT_RECEIVER_UNVERIFIED` | source SHA target·journal PASS 일부만 확인, Receiver LIVE origin/bytes 미제공 | 설치 성공 미확정. 원래 고유 영수증 더 확인 |
| `HANDOFF_VERIFIED` | 목표 SHA·runtime bytes 7/7·새 Receiver CAPTURE·원본 보호·journal PASS 일치 | **유지보수기 인계만** 완료; Controller 설치와 별개 |
| `UPLOAD_GAP` | 로컬 journal 원본은 있지만 GitHub 결과 누락 | Owner가 원본 기록 회수. **동일 인계 자동 재실행 금지** |

**주의:** 관측값의 실제 의미는 기존 코드와 운영 승인 계약을 따라 확정한다. 본 표의 이름은 지원용 해석 범주이지 Runtime schema를 새로 정의하거나 설치 중단 조건을 추가하지 않는다.

## 3. 특히 조심할 상태 중첩

`handoff-maintenance.mjs`는 source line 320~335에서 Receiver STOP 요청 후 백업·journal을 쓰며, main 함수 바깥 오류 처리(파일 하단)는 `AUTOMATION_BLOCKED` JSON을 출력한다. **이 출력 하나만으로 기존 Receiver가 계속 살아 있거나, STOP 요청이 남지 않았거나, backup이 완전함을 증명하지 않는다.** 실제 Receiver가 종료됐는지와 journal·STOP/lease를 함께 판단해야 한다. 이 소스상 위험은 별도 [독립 감사](maintenance-v2-prejournal-risk-review-20261115.md)에 기록.

## 4. 실행 완료 이후 자동 진행 가능한 지원업무

- `HANDOFF_VERIFIED` 원본이 제공되면 지원자는 기존 증거의 source·byte·origin·보호 **읽기 전용 교차검증**만 수행. 29차 Owner의 승인·설치 수행을 중복하지 않음.
- 설치가 `NOT_RUN`이거나 기록이 미입수되면 **동일 조회를 무한 반복하지 않고**, 이미 존재하는 #1368·기능별 마지막 실증과 비교해 별도 미검증 계약/표준의 분석으로 이동.
- `STOPPED_PREJOURNAL_UNKNOWN` 또는 `RECOVERY_REQUIRED`가 실제 관측되면 기존 #996 복구를 재실행하지 않고, 정확한 고유 오류와 원본을 COORD에게 알려 별도 승인·지원 복구 경로로 연결.
- Controller 설치가 완료되지 않았으면 W01~W06의 독립 공식원자료·소스·Mock Browser 조사는 계속 가능. 실제 변경은 각 원담당 소유.

## 5. 인계 메타

- 지원 결과: `S4_MATRIX_READY` (운영 결과가 발생한 것은 아님)
- 지원 역할: 신규 일반챗/새 Runner/기존 전담 Owner 생성하지 않음
- 신규 GitHub 운영 설치·DB/D1/Production·예약 작업/Workflow 실행: **0건**
- 검토 다음 단계: 원본 Windows 인계 실행 결과가 없으면 S1 나머지 독립 소스 감사 또는 S3 정규 격리 테스트 설계, 이미 다른 담당이 동일 작업을 수행했다면 중복하지 않음.
