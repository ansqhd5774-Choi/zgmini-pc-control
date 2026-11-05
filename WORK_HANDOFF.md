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
- **운영 설치의 최신 유효 증거:** Controller `ac1f5c22e6b06fafbc45ef6c4d6cacdb309a110a`([#449 통합 5파일 정규 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414) `SUCCEEDED`·[#451 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127) PASS). 이전 `364c59…`는 #431의 [#445 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/445#issuecomment-6664737429)·[#447 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/447#issuecomment-6664782626) 완료 시점의 이력 증거. 독립 유지보수기 마지막 관측 `c66a629f2a52b232e92b90e42906795afa4cb657`는 #434 Windows 인계 후속 실측 없음.
- **실제 미해결:** #431 승인 4파일 설치(#444→#445→#447) 뒤, 사용자가 명시 승인한 #433·#435 통합 5파일을 [PR #448](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/448) 정확한 manifest로 설치([#449 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414))하고 [#451 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127)·[#452 R54 6파일 인벤토리](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226) PASS를 확인. #433·#435 기능은 실제 원격 TXT/JSON GET과 6/6 파일 SHA 수집으로 완료. **R54 예약 Task 바인딩·Worker B 설치 승인은 이 검증 범위가 아님.** #434 Windows-local 유지보수기 인계와 #442 임시파일 삭제 기능 운영 검증만 미완료. #437 KPI 측정 기능은 기존 실데이터 17/17 PASS(개선 효과 별도).
- **#434 사용자 지정 전담 인계·준비:** #434 독립 유지보수기 인계 전담 `b434_installer`와 별도로, 사용자가 #431 및 후속 B를 항상 전담 인계하도록 명시해 #431은 `r17_handoff_ready`, #433·#435는 `fivefile_b_installer`가 각각 단회 적용 완료. #434 유지보수기 `c66a629f…` 대비 8파일 중 `tools/maintenance-agent.mjs` 1파일 변경, [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 8파일 SHA 명세 `main` 병합(`14fa522c0b051801f6a12b64d872d7a50532d39e`) 완료. **Windows-local Receiver 인계·중복 보고 방지 효과는 아직 미검증**. #431/#449 Controller 설치 성공을 #434 유지보수기 설치로 확대하지 않음.


- **#431 설치 이전 7파일 누적 계획 — 역사 기록:** [#68 비교 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6664241790)의 `69c830…`→`ac1f5c22…` 7파일 통합은 당초 후보였고, 실제로는 #431 4파일 `364c59…` 후 #433·#435 증가분 5파일을 [#448 승인 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/448)·[#449 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414)로 **각 한 번씩 적용·검증**했다. 이전 후보 해시·승인 계획을 현행 작업으로 재사용하거나 #431/#449 B를 반복 접수하지 않음.

| 남은 5개 항목 | 2026-11-06 소스 결과 | 운영 확인과 다음 담당 |
| --- | --- | --- |
| [#433 R54 6파일 SHA 진단](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/433) | `main` 병합·8/8 테스트, [#448 통합 B 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/448) 병합 | [#449 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414)·[#451 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127) 뒤 [#452 실PC A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226) `PASS/R54_SIXFILE_INVENTORY_COMPLETE`, 실제 6/6 파일 PRESENT·SHA 회수·원격 TXT/JSON 재조회. **이 기능 FINAL PASS**; R54 Task 바인딩·Worker 설치 승인과 구분 |
| [#435 TXT·JSON 재조회](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/435) | `main` 병합·8/8 테스트, #448 통합 5파일 설치 | 새 `controller/upload.mjs`의 GET 바이트 확인 후 댓글 경로를 #451·#452 실제 A 요청으로 실행, 각 TXT·JSON 원격 재조회 PASS. **이 기능 FINAL PASS**; 유지보수기 자체 결과 업로더와 구분 |
| [#434 E: 중복 보고 방지](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434) | `main` 병합·30/30 테스트, [#443 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 병합 | **명세 누락 해소**. 실제 Windows checkout 내 승인파일·설치 SHA·Receiver·인계/효과 확인 필요. #431 완료는 기술적 Gate 아님 |
| [#442 E: 임시 출력 정리](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/442) | Draft·19/19 소스 테스트, 원격 코드 일치 | 선행 #435 실제 TXT/JSON 동일바이트 GET은 #451·#452로 **충족**. 다만 E: 삭제 경로가 포함돼 별도 승인된 정확한 설치·Windows 임시파일 보존/삭제 확인 전 Draft 유지 |
| [#437 대기·실행시간 KPI](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/437) | `main` source 병합 `ac1f5c22e6b06fafbc45ef6c4d6cacdb309a110a`·14/14, 실 GitHub 17건(12 PASS·5 BLOCKED, 제외 0) | Issue 생성→Controller 시작 중앙값 **18,495ms**, 전체 처리 중앙값 **5,718ms**, 관측 겹침 최대 2. 순수 Runner 대기·worker 시간 아님. **KPI 측정 기능 FINAL PASS**(14/14·실제 17/17, CLI exit 0), 처리시간 개선 효과는 전후 비교 후 별도 판정 |

**다음 필수 실행 하나:** 설치된 Controller `ac1f5c22…`와 #433·#435의 [#449](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414)·[#451](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127)·[#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226) 성공 증거를 재사용한다. #434 전담은 기존 Windows-local operator-only 인계 경로를 확인한 뒤 정확한 8파일 명세로 단회 인계·새 중복 보고서 방지 효과를 검증한다. 독립적으로 #442는 #435 성공 증거를 전제로 임시파일 삭제 안전성·별도 승인 범위를 검토하되 기존 E: 원장/백업을 임의 정리하지 않는다.

**이 인계의 한계:** 브랜치 문서 갱신은 `main` 병합·B 승인·PC 설치·E: 삭제를 수행한 것이 아니다. 최신 운영 판단에는 #68과 실제 원본 결과를 다시 대조한다.

**기존 5건 범위별 최종 판정:** **3/5 FINAL PASS** — #437 KPI 측정(실 GitHub 17/17·14/14), #433 R54 설치 6파일 SHA 회수([#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226)), #435 실제 원격 TXT/JSON 동일바이트 재조회([#451](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127)·[#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226))가 기능별 완료 기준에 도달. #434 유지보수기 Windows 인계·중복 보고서 효과 및 #442 E: 임시 결과 정리 운영 시험 **2건 미완료**. KPI 전후 성능 개선과 R54 Task 바인딩은 별도 미검증; 완료를 확장하지 않는다.
