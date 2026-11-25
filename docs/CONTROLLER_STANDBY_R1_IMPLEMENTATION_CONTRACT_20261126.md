# ZGMINI Controller Standby R1 — 구현·Windows 격리 검증 계약

- 기준일: 2026-11-26 KST
- 총괄 책임: 프로세스 총괄
- 구현 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 전용 브랜치: `codex/controller-standby-r1-20261126`
- 최초 브랜치 기준: 2026-11-26 조회 `main@f662144cc076e7944d14f78bd5d2a8b4cce1fa8d`
- R2: [총괄 연구 계획](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/controller-ops-lessons-20261105/docs/CONTROLLER_HA_RESEARCH_PLAN_R2_20261126.md)
- R3: [사용자 승인 범위 및 6단계 실행계획](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/controller-ops-lessons-20261105/docs/CONTROLLER_STANDBY_R3_EXECUTION_PLAN_20261126.md)
- 구현 목표: **동일 운영 PC Active 1 + Standby 1**, 별도 Standby/서비스/quorum 불필요
- 현재 증거: 코드 범위·원본 검토 및 브랜치 생성. 설치·전환·Windows 격리 시험 증거 없으면 해당 항목을 DONE으로 쓰지 않는다.

## 1. 기술 진입점 (기존 공통 모듈 재사용)

1. 기존 유일 복구 소유자는 `tools/runner-watchdog.mjs`의 `tick()`이다. `decide()`가 `RECOVER`를 반환해도 기존 Workflow/PAUSE/DRAIN/install lease/업무 lease/재시작 횟수/source hash/owner 재확인을 통과하기 전에는 승격하지 않는다.
2. `controller/supervisor.mjs`는 실제 `exclusive(leases,'supervisor')` 획득에 성공한 인스턴스만 Runner 6개를 실행한다. Standby 프로세스는 해당 lease를 직접 steal/delete 하지 않는다.
3. `controller/common.mjs`의 `owner.json` nonce/PID/bootAt를 바꾸지 않고 검증한다. Heartbeat 지연·PID 불명은 기존 `BLOCKED_LIVE_OR_UNKNOWN`이다.
4. `controller/entry.mjs`와 `controller/engine.mjs`의 고정 7-key/allowlist·requestId·seat/resource·원장 정책을 그대로 둔다. Standby 승격으로 기존 `STATE_UNKNOWN` Worker 작업을 재실행하지 않는다.
5. Standby를 기동해 `READY`로 관측하는 기능과 Watchdog 1개 승격 결정을 별개로 검증한다. Active가 정상인데 Standby가 업무·Runner를 spawn하면 즉시 실패다.
6. 기존 유지보수/설치/복구의 lease·PAUSE·DRAIN을 인수하지 않는다. 기존 정상 설치 source를 개발 브랜치로 무단 적용하지 않는다.

## 2. 변경 후보와 순서

| 단계 | 파일/함수 | 실제 구현 조건 |
|---|---|---|
| 1 실행 경계 확정 | `tools/runner-watchdog.mjs`, `controller/supervisor.mjs`, `controller/common.mjs` | 단일 승격 책임, pid/nonce/boot, 작업 시작 경계 확인 |
| 2 준비 상태 구현 | 필요 최소 `controller/standby-*.mjs`와 시험 | 자체 Runner/Worker spawn 0, owner 불명 시 차단 |
| 3 승격 연결 | 기존 Watchdog 단일 recovery branch와 Supervisor exclusive | 두 독립 recovery 루프 금지, 동일 lease 정규 취득 |
| 4 업무 인계 | 기존 `ledger/`, report pointer, owner/seat/resource lease | 결과 재사용, unknown 개별 보류, 완료 작업 재실행 금지 |
| 5 Windows 격리 | 기존 `tests/`, 정규 Windows CI/격리 Runner | 두 후보 경합·중간 종료·원장·Worker 10종 |
| 6 정규 운영 적용 | 정규 B maintenance/C급 OS 변경 승인 시 정확한 경로 | 실제 SOURCE SHA/파일 해시/계정/시작·롤백·후검사/실제 전환 |

**추가 코드가 기존 공통 기능과 중복되면 새 모듈을 만들지 않는다.** 이번 R1 구현 작업의 첫 단계는 본 계약을 기준으로 소스의 실제 중단 조건을 제거하는 것이다. CI/PR 및 Windows 검증과 운영 설치는 별개다.

## 3. 10개 Windows 격리시험

- T01 죽은 Active: 소유권 정규 취득 한 번
- T02 살아 있는 Active + 오래된 heartbeat: 승격/강제종료 없음
- T03 후보 둘 동시: 실효 Active 하나
- T04 이전 Active 복귀: nonce 불일치 신규 작업 거부
- T05 중간 종료: 기존 소유권/원장 안전 복구
- T06 살아 있는 Worker: 해당 requestId 자동 재실행 없음
- T07 설치/복구 중: 관련 승격 유보
- T08 upload·원장 누락: 로컬 결과 재사용, 허위 PASS 금지
- T09 무관 독립 읽기: 전역 차단 없음
- T10 Standby 프로세스 종료: 기존 Active 정상 지속

실제 운영 Runner·Core·DB·Writer를 시험 목적으로 중단하지 않는다. 격리 환경만으로 운영 효과를 증명하지 않는다. Windows 격리 결과는 각각 실행 Run/상태/테스트 수/조건/시간/CPU/RAM과 함께 기록한다.

## 4. 안전 STOP·운영 출처

- 실효 두 Active 가능성, owner 생존 불명, manifest drift, 업무 lease 보존 불명, Worker 종료 불명, 승인된 B/C 효과 범위 불일치 시 **그 자원 전환만 보류**.
- 임의 lease 강제삭제·기존 Worker/Runner 종료·무단 서비스/계정/예약 생성·전체 데이터 초기화 금지.
- 운영 적용 직전 새로운 정확한 source SHA·승인 manifest·해시·CAS/lease·Windows user/startup·원본 백업 확인. 최신 `main`이 자동으로 설치 source는 아님.
- 새 사업 공급자/DB/D1/Cloudflare/유료 서비스/외부 서버 변경 없음.

## 5. 단계별 보고 / 완료 기준

| 증거 | 계획 | 코드 | Windows | 운영 |
|---|---|---|---|---|
| 브랜치/계약 | 해당 범위 완료 시 DONE | N/A | N/A | N/A |
| 보조 Controller 실제 준비·승격 코드 | 계획만으로 DONE 금지 | 빌드·Unit/CI PASS 필요 | 경합·중간 종료 실측 | 설치 source readback |
| 1회 안전한 실제 전환·업무·복귀 | 계획 아님 | 코드만으로 입증 불가 | 시험 결과와 구분 | **실제 Controller/Runner/원장·JSON/TXT·기능 성공 필수** |

표본이 없으면 RTO/p95/CPU/RAM·조회량은 `미측정`으로 기록한다. **다음 필수 실행은 격리 Standby 최소 구현과 10개 시나리오 시험이다.**
