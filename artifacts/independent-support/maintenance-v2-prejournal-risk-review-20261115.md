# ZGMINI 독립 기술지원 S0/S1/S3 — 유지보수기 V2 인계 전 원장 미기록 구간 사전 감사

- 날짜: 2026-11-15 KST
- 구분: `SUPPORT_ONLY / SOURCE_READ_ONLY_AUDIT / SYNTHETIC_FAILURE_MODEL`
- 기존 총괄: 29차 COORD; 중앙 [#68/6881854907](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6881854907)
- 독립 작성 위치: **전담 29차 브랜치 아님**. 본 파일만 별도 `support/maintenance-v2-prejournal-audit-20261115` 브랜치에 작성. 운영 설치·승인·manifest·Controller 코드·기존 기능 브랜치 미변경.
- 근거 source pin: `tools/handoff-maintenance.mjs@c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7`, Git blob `5ab6339c4a28329c8b39d37d007ac6428f8c7e0f`; receiver `tools/maintenance-agent.mjs` blob `44835f5b0ba96178b8ede60097ebe0a2346960a7`
- 검사 범위: 소스 구조·기존 테스트/승인·공개된 GitHub 증거·독립 **합성 상태모형**. **운영 Windows 인계도 실제 소스 전체를 실행한 Windows 시험도 아니다.**

## 1. 29차와 업무 소유권 충돌 방지

29차가 이미 #996 복구 완료, #1365/#1366/#1367 병합, 유지보수기 V2 정규 승인 manifest, [Draft #1368](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1368)의 Controller 15파일 raw SHA 15/15·old raw SHA 8/8 및 Controller-only source simulation 6/6을 완료했다. **이 증거를 재생성·중복 테스트하지 않았다.** 29차의 소스 계보/승인 분리와 설치 후 A 검증 인계는 해당 담당 소유이며 이 보고서는 별도의 Windows 유지보수기 **종료·백업·인계 원장 이전의 경계**만 다룬다. 이번 지원 기록은 B 승인이나 배포 GO/HOLD를 자동 판정하지 않는다.

## 2. 주요 신규 관측 — 종료 요청과 인계 원장 사이 실패 처리 경계

정확한 [인계 source](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7/tools/handoff-maintenance.mjs#L315-L338) 상:
1. **320행** 기존 Receiver PID/nonce/source에 맞는 `STOP_REQUEST.json`을 `wx` 기록(기존 Receiver 살아 있을 경우).
2. **321행** 최대 90초 동안 `alive(priorPid)` 종료 대기.
3. **323행** `requirePriorStopped` 검사.
4. **325~333행** 백업 경로 생성, 기존 7개 runtime·manifest·Startup·snapshot 기록.
5. **335행** `handoff-<targetSHA>.json` 최초 생성.
6. **336~337행 이후** 첫 주된 `try/catch` 실행. 즉 위 1~5단계 중 동기 예외는 이 블록의 상태 기록·rollback 처리 밖에서 발생할 수 있다.

[Receiver source](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7/tools/maintenance-agent.mjs#L748-L783)의 `cooperativeStopRequested`는 `STOP_REQUEST.json`을 읽으며, **controller-install lease가 존재하면 종료 요청을 무시한다**. 정상 수락 시 요청을 `STOP_HANDLED-<nonce>.json`으로 이름을 바꾸고 루프를 종료한다. 정상 polling 간격은 60초이나 외부 `pollOnce()` 시간이 더해질 수 있다.

### 위험 후보 분류

| ID | 가정된 실패 시점 | 소스로부터 판단 가능한 결과 | 판정 |
| --- | --- | --- | --- |
| S1-R1 | STOP 요청 후 최대 90초 경과에도 Receiver 생존 | `requirePriorStopped`의 예외가 335행 원장 생성 전에 발생 가능. 늦게 STOP을 수락하는 시나리오는 별도 확인 필요 | **잠재 위험 / 운영 미재현** |
| S1-R2 | STOP 성공 후 `fs.mkdirSync(backup)` 실패(EACCES, 디스크 부족 등) | Receiver가 이미 종료된 상황에서도 본 `try/catch` 진입 전에 함수 종료. 최초 인계 원장 존재 보장 없음 | **소스상 에러 경계 공백** |
| S1-R3 | STOP 성공 후 사본 `fs.writeFileSync(dest,...)` 실패 | 원본 파일은 아직 교체하지 않았으나 Receiver 중단/백업 일부 생성/인계 원장 미기록이 가능 | **소스상 에러 경계 공백** |
| S1-R4 | Startup 또는 `SNAPSHOT.json` 쓰기·해시 검증 오류 | 335행 원장 생성 전 중단 가능, 이전 Receiver 재시작 성공 증거 없음 | **소스상 에러 경계 공백** |
| S1-R5 | 335행 최초 `persist()` 실패 | 기록이 없거나 불완전할 수 있으며, 본 `try/catch`보다 먼저 실행됨 | **소스상 에러 경계 공백** |
| S1-R6 | 336행 이후 reservation 실패 | 별도 catch·`RECOVERY_REQUIRED` 로직 존재; 이전 구간과 구분 | **기존 처리 있음** |

이 보고는 이러한 문제가 **실제 PC에서 발생했다거나 영구 손상이 확정됐다는 주장 아님**. 원본 제어파일 변경 가능성, 원장 미기록, Receiver 재시작 미증명을 구별한다. 기존 #996 복구와 다른 신규 취약 구간이다.

### 기존 테스트 범위(코드 직접 대조)

`tests/maintenance-handoff.test.mjs@c2e6744...` 총 391행에는 `requireReceiverOrigin`·`reserveReceiverSlot`·`requireRollbackWindow` 등 개별 helper의 정적/fixture 시험이 있다. 하지만 **`STOP_REQUEST` 쓰기 이후 90초 timeout, backup mkdir/write 실패, 인계 journal 최초 persist 실패를 함께 호출하는 통합 실패 주입 시험은 해당 파일에서 찾지 못했다.** 다른 전체 test suite의 포괄 여부는 미확인.

## 3. 독립 합성 상태전이 모형 (실제 Windows 실행 아님)

`handoff-maintenance.mjs`의 320→321→323→325→329→332→335→336 순서를 복제한 순수 모형에서 아래 7가지 분기를 점검했다.

| 사례 | 모형 분기 | journal 유무 | 판정 |
| --- | --- | --- | --- |
| 정상 기준선 | terminal PASS 모델 | 생성 | 모델 정상 |
| 90초 종료 대기 실패 | journal 이전 예외 | 없음 | 구간 위험 표시 |
| 백업 디렉터리 생성 실패 | Receiver STOPPED, journal 이전 | 없음 | 구간 위험 표시 |
| runtime 사본 쓰기 실패 | Receiver STOPPED, 부분 백업, journal 이전 | 없음 | 구간 위험 표시 |
| Startup 사본 쓰기 실패 | Receiver STOPPED, journal 이전 | 없음 | 구간 위험 표시 |
| 최초 journal 기록 실패 | Receiver STOPPED, journal 생성 실패 | 없음 | 구간 위험 표시 |
| journal 이후 reservation 실패 | catch 내 처리 | 있음 | 구간 구별 |

**모형 단언 7/7 일치.** 이것은 함수의 순서·경계로부터 구성한 자체 모델이며 실제 Node/Windows 함수, Windows ACL, 디스크, Receiver 프로세스 또는 운영 레저를 대상으로 실패 주입한 것이 아니다. 실제 도구에 대한 회귀 시험 PASS로 표기 금지.

## 4. 29차 Owner가 고려할 비침습적 다음 행동 제안

**즉시 소스 검토 대상(운영 설치 중단을 자동 강제하는 새로운 Gate 아님):**
- 현재 29차가 승인된 독립 Windows Operator로 단회 7→7 인계를 준비할 때, 기존 코드의 **Receiver 종료 요청 전 내구성 있는 단계 기록** 여부를 소스 소유자에게 확인. 실제 수정이 필요하다면 기존 V2 승인 SHA의 변경이 발생하므로 **기존 c2e674 고정 manifest를 그대로 새로운 source에 사용해서는 안 됨**.
- 종료 요청 후 백업 실패/90초 timeout/최초 journal 쓰기 실패 시, 상태를 무조건 `AUTOMATION_BLOCKED`로 오분류하지 않고 **중단된 Receiver, STOP 요청, 백업, 원장, lease를 읽기 전용으로 함께 조회**할 수 있는 사고 판정표 준비. 원본 요청 재실행·임의 파일/lease 삭제·무조건 수동 Receiver 재시작은 안전성 입증 없이 금지.
- **별도 격리 테스트 후보:** 실제 함수의 경계에서 `fs.mkdirSync`/snapshot `writeFileSync`/persist 실패를 주입해 durable journal/receiver state 기대값을 검증. 현재 테스트 파일에 없는 통합 fixture를 고려하되 다른 담당자의 동일 신규 시험과 겹치면 재수행하지 않는다.
- 테스트에서 원장 이전 종료 후 안전 증거 미흡이 확인되면 Owner가 승인된 최소 안전 수정과 추가 V2 manifest 절차를 결정. 소스/운영 수정은 이 지원자가 임의 진행하지 않는다.

**실제 설치 전 확인 후보(재검증 루프 아님):**
1. 현재 운영 source `16064e29...`과 대상 `c2e6744...`, 9개 pinned source 파일(실제 인계 runtime 7개), 승인 V2 문서 정합.
2. Receiver PID·nonce·origin·cooperativeStop capability, existing `STOP_REQUEST` 또는 `STOP_HANDLED` 잔재, controller-install lease·백업 디렉터리 접근 여부.
3. `main` checkout, 인계 대상 파일 dirty, Windows medium integrity token, Startup bytes/ACL, 현재 권한, 충분한 디스크 가용성.
4. 실패 시 **원본 Receiver 생존 여부**와 journal·reservation·backup을 먼저 읽기 전용 판정한 뒤 승인 절차로 이동.

## 5. 다음 사전작업 — 29차 설치 완료 기다리지 않음

- **S1-FOLLOWUP:** 현재 코드의 사전 STOP 단계와 backup/journal 단계에 대한 기존 코드-시험 매핑 확대; 이미 검증된 helper는 재시험하지 않음.
- **S3-FOLLOWUP:** 이 위험에 대한 실제 소스 함수 기반의 격리 실패 주입 시험 설계(현지 Windows 미필요). 개선 코드는 별도 승인 범위로만 제안.
- **S4-FOLLOWUP:** 실제 인계 후 결과에 적용할 판정 행렬 작성: `PASS`, `BLOCKED`, `RECOVERY_REQUIRED`, `STATE_UNKNOWN` 및 `PC_NOT_RUN` 분리.
- **S2:** #1368에서 이미 15/15 해시·6/6 dry-run을 완료했으므로 중복 없음. W07이 기존 승인 계보 조사 수신·착수했다면 해당 업무 양보, 아니면 사용자/COORD 지정 없이 동일 작업 선점하지 않음.

**지원 업무 진행:** 이 보고 범위 S0 중복 감사 완료, S1 pre-journal 위험의 첫 소스 조사 완료, S3 순수 모형 7/7 실행. S4 실제 운영 검증은 설치 미완료라 미실행. 전체 사업 제품 완성률 및 운영 실설치율 변화 0. GitHub 원격 코드/Owner/Workflow/예약/운영 PC/DB/D1·Cloudflare 변경 0.

## 6. 읽기 전용 추적 링크

- [29차 중앙 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6881854907)
- [29차 누적 15파일 후보](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6882025650)
- [원본 인계 실행 코드](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7/tools/handoff-maintenance.mjs#L315-L337)
- [Receiver 협조 종료 코드](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7/tools/maintenance-agent.mjs#L748-L783)
- [기존 회귀 파일](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7/tests/maintenance-handoff.test.mjs)
- [실제 V2 승인 문서](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/0358dfcb1134c2eff5ab7e2d1a331883cea83a73/approvals/maintenance-handoffs/c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7.json)

**판정:** `SUPPORT_REVIEW_RECORDED / SOURCE_CONTROL_FLOW_RISK_IDENTIFIED / RUNTIME_NOT_REPRODUCED / NO_OPERATING_CHANGES`.
