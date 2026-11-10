# #996 `INTAKE_PAUSED` C급 복구 후보 — Source only

관측 기준: 2026-11-10 10:36:10 KST, 원본 Windows `automation-status.mjs` 1회.

## 목적과 실제 상태

- Controller #917 복구는 `RECOVERY_COMPLETED`, 독립 22/22 PASS로 이미 완료. #996과 혼동하지 않는다.
- 별도 #996 원본 `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`는 현재 `RECOVERY_REQUIRED/RUNNER_SET_DRIFT`, `FIRST_FAIL=INTAKE_PAUSED`.
- 실제 Controller SHA `badad9124157879d7a645b64f2768113d632355b`; 독립 유지보수기 SHA `16064e29fea0e53e7769a24d93d75b6f5292cfc0`.
- 유지보수기 Receiver `HEALTHY/LISTENING`, install lock held/recoveryRequired, `pc-job` workflow `disabled_manually`.
- 전용 `zgmini-pc-01..06` 6개 + 독립 spare 1개 모두 online/idle. 7개를 6개로 잘못 검사하는 기존 유지보수 소스가 현재 설치되어 있음.
- 원인 수정 [PR #1137](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1137)은 main 병합·4/4 PASS, PC에는 아직 미설치.

## 완료 범위 — 이 Draft

1. `tools/controller-996-intake-candidate.mjs`: **특정 #996 고정 ID와 source에 한정한 순수 읽기 전용 판정/후보 생성**.
2. `tests/controller-996-intake-candidate.test.mjs`: 전용 6개+별도 Runner, 원장 phase, 잠금 owner, stage·backup, 열린 backlog, Workflow, 보호 상태, 원시 해시의 부정 시나리오.
3. 후보의 `approved`와 `executionAuthorized`는 항상 `false`. 코드에 운영 쓰기/복구/네트워크 실행 경로 없음. 임의 7→7 유지보수기 변경, 임의 Controller 설치, 잠금 정리는 수행하지 않음.

## 미완료 실행 계획 — 승인되지 않은 운영 변경

| 순서 | 다음 필수 작업 | 통과 조건 | 담당·경계 |
|---|---|---|---|
| 1 | 원본 Windows 원장·lease owner/marker·stage/backlog·기존 Controller 파일·Supervisor·Core/Korea/Writer 보호 원시 증거를 **읽기 전용** 수집 | 각 원시 바이트 해시와 owner 생존/nonce/원장 시각·중복 복구 claim·기존 버전 무전환 사실 확인 | 공통 C 단일 담당. 키·원본 파일·PID/nonce 채팅 공개 금지 |
| 2 | #996의 `INTAKE_PAUSED`에서만 동작하는 독립 C 실행기와 정확한 승인 계약 구현 | 기존 완료 단계/원장 불변, 원본 Workflow 중단 주체 판정, 재실행 0, 중간 실패 fail-closed, source/owner CAS, 복구 원자 claim, 보호/백로그의 부정 회귀 통과 | **source-only 구현·시험까지**. 기존 `abort-untouched` 또는 `controller-rollback-recovery` 호출 금지 |
| 3 | C 복구 후보 확정 및 **새 사용자 명시 승인** | exact requestId/사전 source/파일 SHA/허용 효과/실패 STOP·되돌림/보관 조건을 사용자에게 제시하고 승인 수신 | 이 Draft나 이전 #917 동의는 #996 실행 권한 아님 |
| 4 | 승인된 원본 Windows에서 **단회** 복구 | 현재 증거 재조회 PASS → 비활성 접수 복원 → 해당 중단 창 원본 Issue idempotent 조정 → 후속 결과 확인 → 원본 lock 전체 보관 | 다른 Runner 우회, 무조건 재신청, DB·D1·Writer·Controller 변경 금지 |
| 5 | 독립 사후 결과 및 기능 인계 | lock 없는 상태·workflow active·Supervisor·전용6 Runner·원본 Issue 완료/보류 목록·보호/운영 source SHA/TXT·JSON 검증 | 이후 별도 [#1220](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1220) 7→7 유지보수기 handoff는 새 정확한 승인 범위로 검토 |

## STOP 기준

- #996 외의 설치 owner/원장 또는 marker가 관측되거나 owner가 생존/불명인 경우.
- Controller 실제 파일이 원본과 다르거나 stage 밖에 전환·백업 흔적이 확인된 경우.
- Workflow 비활성 주체, backlog 일시 중단 창, 원본 Issue 재실행/기존 결과 중복 여부가 불명확한 경우.
- 전용 Runner 누락·중복·오프라인, 보호 Task/Writer drift, 다른 활성 복구 claim·lease 충돌 또는 본 후보 고정 SHA 불일치.
- GitHub Issue/댓글만 있고 원본 Windows 최신 재조회·C 직접 승인·독립 종료 결과가 없는 경우.

이 후보는 복구 성공이 아니다. 전체 공통 실패→중앙 route→verified return→원담당 수신 일반화 실증은 **4/5(80%)**, #917 자체 복구는 **8/8 완료** 상태를 유지한다. 예약 자동 갱신 확인은 기능 완성 이후의 별도 후속이다.
