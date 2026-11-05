# ZGMINI — 대화 간 작업 인계 (WORK_HANDOFF)

- 기록 기준일: **2026-11-05 KST**
- 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 전용 보관 브랜치: `codex/controller-ops-lessons-20261105`
- 성격: **대화가 바뀔 때 이어받기 위한 상태 요약**. 운영 실행·변경 승인 또는 실시간 상태를 대신하지 않는다.
- 필독 정본: [AGENTS.md](AGENTS.md) · [새 일반챗 시작](docs/GENERAL_CHAT_START.md) · [PC 자동화 공통 기준](docs/PC_AUTOMATION_STANDARD.md)
- 누적 경험: [Controller·6 Runner 운영 노하우](docs/CONTROLLER_OPERATIONS_LESSONS.md)

## 1. 현재 업무의 목적

여섯 개 일반챗과 자체 PC Runner의 병렬 작업에서 **Controller가 독립 업무를 불필요하게 전체 차단하지 않도록 유지**하고, 실제 문제를 해결한 근거를 재사용한다. 이 인계 문서 자체가 새로운 기능 개발이나 Controller 개편의 작업 지시서는 아니다.

별도 일반챗이 담당하는 시장 캘린더·미국 등락 지수·테마·물가지표·고용지표 등 **각 기능의 미완료 목표와 승인·상태는 원래 대화/브랜치/Issue**에 남아 있다. 이 문서는 그 작업들의 완료를 선언하지 않고 공통 운영의 노하우와 연결점만 제공한다.

## 2. 마지막으로 확인된 완료 지점

| 항목 | 마지막 확인된 증거 | 해석 |
| --- | --- | --- |
| 공통 지침 정본 | [PR #348](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/348) main 병합, `e7337e31643fbc14a0843a4a1d4a7adbf5c9669d` | 지침 3개 파일 개정 완료. PC 운영 설치와 구분 |
| 과거 설치 실패 정리 | [#319](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/319) `ABORTED_UNTOUCHED` | 실패 lease 보관 완료. 신규 Controller 설치 성공 아님 |
| 실제 Controller 설치 | [#345](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/345), 설치 SHA `69c830275bd3fec75b17c8a98c46d689447fb1a7`, `SUCCEEDED` | 해당 시점의 설치·보호·Workflow 검증 |
| 설치 후 A급 실행 | [#346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/346)·[#347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/347) | 서로 다른 Runner의 읽기 전용 PASS. 전원·미래 안정성 증거 아님 |
| 동시 실행 격리 사례 | [#349](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/349) seat 5 PASS, [#350](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/350) seat 3 BLOCKED (동일 시작 시각) | 한 작업의 개별 차단에도 독립 작업은 완료된 관측 사례. **6개 전원 통합 PASS 아님** |
| 누적 노하우 저장 | 전용 브랜치 [docs/CONTROLLER_OPERATIONS_LESSONS.md](docs/CONTROLLER_OPERATIONS_LESSONS.md), 최초 커밋 `3d1212827cdf900c918512ccd910a1d1770ed43b` | GitHub에서 원문 재조회 검증. **main 미병합** |

## 3. 실제 미해결·확인 대기

- **#350 개별 R17 감사:** `R17_268_OPERATIONAL_CHANGE_BLOCKED` / `PATCH_TARGET_UNVERIFIED`. 과거 보호 baseline과 현재 관측의 차이는 확인됐지만 `R17_268_PROTECTED_STATE_DRIFT_UNATTRIBUTED`로 특정 #268 요청에 귀속되지 않는다. 작업 담당자가 관련 요청 원장·소유자·운영 source를 정확히 확인하기 전에는 **이 작업에 한해 BLOCKED 유지**. 임의 복구·재실행 금지.
- **6 A + 실패 B 동시 통합 시험:** 실제 실PC 통합 검증은 **미확인**. #349/#350의 2개 동시 사례를 전체 규모로 확대하지 않는다. 현재 승인 업무를 지연시키는 신규 필수 선행 조건으로 만들지 않는다.
- **다른 일반챗의 기능 완료:** 각 대화의 최신 작업 기록과 실제 저장/Reader/게시 검증을 확인해야 한다. Controller 상태가 양호하다는 이유만으로 각 기능을 완료 처리하지 않는다.
- **실시간 상태 미확인:** 본 문서는 기록 기준일의 스냅샷이며 자동 감시가 아니다. 이후 상태가 바뀌었을 수 있다.

## 4. 새로운 대화에서 바로 이어갈 방법

1. **현재 사용자 요청과 해당 담당 업무를 먼저 확인**한다. 이 브랜치에 노하우가 있다는 이유만으로 Controller 검사나 복구를 새 작업으로 시작하지 않는다.
2. main의 `AGENTS.md`, `docs/GENERAL_CHAT_START.md`, `docs/PC_AUTOMATION_STANDARD.md`를 확인하고, 이 브랜치의 `WORK_HANDOFF.md` 및 `docs/CONTROLLER_OPERATIONS_LESSONS.md`를 읽는다. 브랜치의 정본 지침이 main보다 우선하지 않는다.
3. 원래 담당 브랜치·마지막 유효 완료 SHA·요청 ID·실제 실행 결과를 **필요한 범위에서만** 최신 상태로 대조한다. source/build/PC Runtime/D1/UI/게시 증거는 따로 판단한다.
4. **마지막 완료 지점부터 다음 필수 실행 하나**를 이어간다. 이미 해결한 #319, #345 등을 매번 신규 성과로 보고하지 않는다.
5. 공유 Controller B 적용은 단일 조정자·승인 manifest/해시/lease 보호를 지킨다. 독립 A 업무는 실제 충돌이 없는 한 계속한다. `UNKNOWN`과 `BLOCKED`를 임의 `PASS`로 바꾸거나 같은 요청을 반복 제출하지 않는다.
6. 이 문서의 현황과 노하우 파일은 **검증된 신규 사건·전환·사용자 결정이 생겼을 때만 갱신**한다. 비밀정보·키·원자료·PC 내부 민감 경로는 저장하지 않는다.

### 새 일반챗에 붙여넣는 시작 지시문

> ZGMINI 제어 저장소 `ansqhd5774-Choi/zgmini-pc-control`의 현재 main `AGENTS.md`·`docs/GENERAL_CHAT_START.md`·`docs/PC_AUTOMATION_STANDARD.md`를 읽고, `codex/controller-ops-lessons-20261105` 브랜치의 `WORK_HANDOFF.md`와 `docs/CONTROLLER_OPERATIONS_LESSONS.md`를 참고하라. 이전 업무·승인·증거를 보존하고, 해당 업무의 마지막 유효 완료 지점부터 필요한 다음 실행 하나를 진행하라. 과거 Controller 복구를 반복하지 말고 공유 변경만 조정하라. 운영 source와 실제 실행 결과를 확인하지 않은 상태에서 완료라고 보고하거나 임의 PC 작업을 요청하지 마라.

## 5. 다음 갱신·인계 기준

- 현재 시점에 이 브랜치에 보관된 **노하우 문서와 인계 문서를 실제로 읽을 수 있는지 검증**하는 것까지가 이번 사용자 요청의 완료 조건이다.
- 이후 추가 작업이 없으면 **대기**한다. 사용자가 새 업무를 지시하면 그 업무의 기존 담당과 완료 증거를 확인해 실행한다.
- 향후 대화를 옮기기 직전 다음 5개 필드만 업데이트한다: **현재 목표 / LAST PASS / 미해결 FIRST FAIL / 해당 업무의 다음 행동·담당 / 근거 링크와 관측 시각**.
- 이 인계 파일의 업데이트는 `main` 자동 병합·PC 운영 변경·새 배포 승인을 의미하지 않는다.

## 6. 2026-11-06 이어받기 상태 — 기존 기록 위에 추가

이 섹션은 작성 시점의 **소스·GitHub 증거**이며 PC 실시간 상태가 아니다. 상위 2026-11-05 기록을 삭제하거나 현행 상태로 해석하지 않는다.

- **현재 목표:** Controller 공통 프로세스 장애 제거·병렬 A 유지·공용 B 설치 중복 방지. 기능별 수집·계산·게시 업무는 해당 작업자가 진행.
- **LAST PASS:** [공용 대기열 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) 상단 상태 요약 갱신·본문 5,249자 보존/7,065자 재조회. [#442](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/442) 격리 시험 19/19, 결과 불일치 삭제 중단. [#437](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/437) 14/14 및 실제 GitHub 17건 KPI 기준선 확보.
- **운영 설치의 마지막 유효 증거:** Controller `69c830275bd3fec75b17c8a98c46d689447fb1a7`([#432](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/432#issuecomment-6656893231)); 유지보수기 `c66a629f2a52b232e92b90e42906795afa4cb657`([#68 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6658289465)). 현재 상태를 보장하지 않음.
- **실제 미해결:** #431 B 적용 결과 미확인; #433·#435 Controller 기능과 #434 유지보수기 기능의 운영 설치 미확인; #442 Draft/Windows 미검증; #437 Draft/개선 효과 미측정. 과거 #339·#319 복구를 이번 신규 장애로 소급하지 않는다.
- **#434 사용자 지정 전담 인계·준비:** #434 **독립 유지보수기 인계 실행만** `b434_installer`가 총괄 관리 아래 담당하며, 기존 R17 담당은 #431 Controller 설치·공용 B 조정을 유지. 유지보수기 `c66a629f…` 대비 8파일 중 `tools/maintenance-agent.mjs` 1파일 변경. 신규 8파일 SHA 고정 명세는 [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443)으로 **main 병합(`14fa522c0b051801f6a12b64d872d7a50532d39e`) 완료**됐으나 **Windows-local 검증·B 접수·PC 인계 0건**. [#68 원장](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) 및 [#434 담당 인계 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434#issuecomment-6663610515) 근거. #431 설치 완료는 #434 기술적 Gate 아님.

| 남은 5개 항목 | 2026-11-06 소스 결과 | 운영 확인과 다음 담당 |
| --- | --- | --- |
| [#433 R54 6파일 SHA 진단](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/433) | `main` 병합·8/8 테스트 | 실제 설치·A 진단 미확인. 공유 `operations` 2파일의 #431 중첩을 기존 B 담당이 조정 |
| [#435 TXT·JSON 재조회](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/435) | `main` 병합·8/8 테스트 | 설치 후 원격 2파일·댓글 재조회 필요. #431과 기술적 파일 중첩 없음 |
| [#434 E: 중복 보고 방지](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434) | `main` 병합·30/30 테스트, [#443 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 병합 | **명세 누락 해소**. 실제 Windows checkout 내 승인파일·설치 SHA·Receiver·인계/효과 확인 필요. #431 완료는 기술적 Gate 아님 |
| [#442 E: 임시 출력 정리](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/442) | Draft·19/19 테스트, 원격 코드 일치 | #435 실제 게시 검증 뒤 운영 승인 범위로 Windows 단건 시험 |
| [#437 대기·실행시간 KPI](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/437) | Draft·14/14, 실 GitHub 17건(12 PASS·5 BLOCKED, 제외 0) | Issue 생성→Controller 시작 중앙값 **18,495ms**, 전체 처리 중앙값 **5,718ms**, 관측 겹침 최대 2. 순수 Runner 대기·worker 시간 아님. 실제 개선 효과는 전후 비교 후 판정 |

**다음 필수 실행 하나:** 기존 [#68 단일 B 설치 담당](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6657001707)이 실제 설치 SHA·lease를 확인하고 #431 정확한 4파일 명세의 단회 설치 요청·결과를 회수한다. 동시에 독립 #434 유지보수기 인계 준비와 #435 별도 승인·파일 검토는 기존 담당자가 이어가며, 총괄은 새로운 요청을 중복 생성하지 않는다.

**이 인계의 한계:** 브랜치 문서 갱신은 `main` 병합·B 승인·PC 설치·E: 삭제를 수행한 것이 아니다. 최신 운영 판단에는 #68과 실제 원본 결과를 다시 대조한다.

**남은 5건 최종 운영 판정:** 현재 `FINAL PASS` **0/5**. #433·#435·#434 소스 병합, #442 19/19 격리 시험, #437 GitHub 17건 기준선은 각각 운영 적용·효과 검증과 구분한다.
