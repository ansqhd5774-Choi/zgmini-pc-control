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
- **LAST PASS:** [공용 대기열 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) 상단 상태 요약 갱신·본문 5,249자 보존/7,065자 재조회. [#442](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/442) 소스 19/19 및 `main` 병합(`797f5a80d6ced9412502367bf5419f9b8fdbd086`), 결과 불일치 시 삭제 중단. [#453 승인 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/453) 2파일 검토·병합, [#454 정규 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623) `SUCCEEDED` 및 [#455 자동 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455#issuecomment-6665761836) PASS. Actions stdout `tempCleanup=CLEANED`·`removedFiles=5` 확인. [#437](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/437) 14/14 및 실제 GitHub 17건 KPI 기준선 확보.
- **운영 설치의 최신 유효 증거:** Controller `797f5a80d6ced9412502367bf5419f9b8fdbd086`([#454 정규 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623) `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`·[#455 자동 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455#issuecomment-6665761836) PASS, 실제 실행 SHA 일치). 이전 `ac1f5c22…`는 #433·#435 [#449 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414)·[#451 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127), `364c59…`는 #431의 [#445 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/445#issuecomment-6664737429)·[#447 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/447#issuecomment-6664782626) 이력. 독립 유지보수기 마지막 관측 `c66a629f2a52b232e92b90e42906795afa4cb657`는 #434 Windows 인계 후속 실측 없음.
- **실제 미해결:** #431 승인 4파일 설치(#444→#445→#447) 뒤, 사용자가 명시 승인한 #433·#435 통합 5파일을 [PR #448](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/448) 정확한 manifest로 설치([#449 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414))하고 [#451 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127)·[#452 R54 6파일 인벤토리](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226) PASS를 확인. #433·#435 기능은 실제 원격 TXT/JSON GET과 6/6 파일 SHA 수집으로 완료. **R54 예약 Task 바인딩·Worker B 설치 승인은 이 검증 범위가 아님.** #442는 [#453 정확한 2파일 manifest](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/453)·[#454 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623) 실제 설치·[#455 자동 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455#issuecomment-6665761836) 및 Actions job `127441719395` stdout의 `CLEANED/5`와 원격 TXT/JSON·댓글 확인으로 **FINAL PASS**. 새 A 수동 중복 접수 0·보호 hash 전후 동일. **실제 미해결은 #434 Windows-local 유지보수기 자기 인계·효과 검증 1건**. #437 KPI 측정 기능은 기존 실데이터 17/17 PASS(개선 효과 별도).
- **#434 사용자 지정 전담 인계·준비:** #434 독립 유지보수기 인계 전담 `b434_installer`와 별도로, 사용자가 #431 및 후속 B를 항상 전담 인계하도록 명시해 #431은 `r17_handoff_ready`, #433·#435는 `fivefile_b_installer`가 각각 단회 적용 완료. #434 유지보수기 `c66a629f…` 대비 8파일 중 `tools/maintenance-agent.mjs` 1파일 변경, [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 8파일 SHA 명세 `main` 병합(`14fa522c0b051801f6a12b64d872d7a50532d39e`) 완료. **Windows-local operator-only Receiver 인계·중복 보고 방지 효과는 아직 미검증**. #431/#449 Controller 설치 성공을 #434 유지보수기 설치로 확대하지 않음.


- **#431 설치 이전 7파일 누적 계획 — 역사 기록:** [#68 비교 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6664241790)의 `69c830…`→`ac1f5c22…` 7파일 통합은 당초 후보였고, 실제로는 #431 4파일 `364c59…` 후 #433·#435 증가분 5파일을 [#448 승인 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/448)·[#449 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414)로 **각 한 번씩 적용·검증**했다. 이전 후보 해시·승인 계획을 현행 작업으로 재사용하거나 #431/#449 B를 반복 접수하지 않음.

| 남은 5개 항목 | 2026-11-06 소스 결과 | 운영 확인과 다음 담당 |
| --- | --- | --- |
| [#433 R54 6파일 SHA 진단](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/433) | `main` 병합·8/8 테스트, [#448 통합 B 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/448) 병합 | [#449 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414)·[#451 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127) 뒤 [#452 실PC A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226) `PASS/R54_SIXFILE_INVENTORY_COMPLETE`, 실제 6/6 파일 PRESENT·SHA 회수·원격 TXT/JSON 재조회. **이 기능 FINAL PASS**; R54 Task 바인딩·Worker 설치 승인과 구분 |
| [#435 TXT·JSON 재조회](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/435) | `main` 병합·8/8 테스트, #448 통합 5파일 설치 | 새 `controller/upload.mjs`의 GET 바이트 확인 후 댓글 경로를 #451·#452 실제 A 요청으로 실행, 각 TXT·JSON 원격 재조회 PASS. **이 기능 FINAL PASS**; 유지보수기 자체 결과 업로더와 구분 |
| [#434 E: 중복 보고 방지](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434) | `main` 병합·30/30 테스트, [#443 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 병합 | **명세 누락 해소**. 실제 Windows checkout 내 승인파일·설치 SHA·Receiver·인계/효과 확인 필요. #431 완료는 기술적 Gate 아님 |
| [#442 E: 임시 출력 정리](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/442) | 소스 19/19·`main` 목표 `797f5a80d6ced9412502367bf5419f9b8fdbd086`, 정확 2파일 [#453 승인 명세](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/453) 병합 SHA `50b8a54242525754fadb04b2a172ced884052daf` | [#454 정규 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623) `SUCCEEDED`, 실제=목표 설치 SHA·보호 상태 유지·TXT/JSON 댓글 재조회. [#455 자동 사후 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455#issuecomment-6665761836) PASS, [Actions run 42083302971/job 127441719395](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42083302971) stdout `{"tempCleanup":"CLEANED","code":null,"removedFiles":5}`; 다른 E: 영속 원장 보호 및 전후 hash 일치. 자동 A 재사용으로 중복 접수 0. **이 기능 FINAL PASS** |
| [#437 대기·실행시간 KPI](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/437) | `main` source 병합 `ac1f5c22e6b06fafbc45ef6c4d6cacdb309a110a`·14/14, 실 GitHub 17건(12 PASS·5 BLOCKED, 제외 0) | Issue 생성→Controller 시작 중앙값 **18,495ms**, 전체 처리 중앙값 **5,718ms**, 관측 겹침 최대 2. 순수 Runner 대기·worker 시간 아님. **KPI 측정 기능 FINAL PASS**(14/14·실제 17/17, CLI exit 0), 처리시간 개선 효과는 전후 비교 후 별도 판정 |

**다음 필수 실행 하나 — #434 Windows-local 인계:** [#454 정규 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623)·[#455 자동 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455#issuecomment-6665761836)는 재사용하고 재접수하지 않는다. #434 전담은 기존 Windows-local operator-only 정규 경로로 [#443 승인 8파일 manifest](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443)·Receiver·lease·설치 전후 유지보수기 SHA·중복 보고 방지 효과를 단회 검증한다. Runner 자기 유지보수기 교체 우회 금지. R54 Task 바인딩은 이번 #442 Controller 설치 승인과 무관하다.

**이 인계의 한계:** 브랜치 문서 갱신은 `main` 병합·B 승인·PC 설치·E: 삭제를 수행한 것이 아니다. 최신 운영 판단에는 #68과 실제 원본 결과를 다시 대조한다.

**기존 5건 범위별 최종 판정:** **4/5 FINAL PASS** — #437 KPI 측정(실 GitHub 17/17·14/14), #433 R54 설치 6파일 SHA 회수([#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226)), #435 실제 원격 TXT/JSON 동일바이트 재조회([#451](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451#issuecomment-6665269127)·[#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226))가 기능별 완료 기준에 도달. #442 E: 임시 결과 정리 [#454 B](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623)·[#455 A](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455#issuecomment-6665761836)·Actions `CLEANED/5` 검증으로 FINAL PASS. **#434 유지보수기 Windows-local 인계·중복 보고서 효과 1건만 미완료**. KPI 전후 성능 개선과 R54 Task 바인딩은 별도 미검증; 완료를 확장하지 않는다.

## 7. 2026-11-06 #434 Windows 인계 패킷 — 운영 미적용

- **현재 최종 통과:** 기존 5개 공통 문제 중 **4/5**. #433·#435·#437·#442는 실제 기능 검증 완료. 남은 #434 독립 유지보수기 중복 보고서 방지 운영 검증만 미완료.
- **명시 인계:** 설치 패킷 담당 `b434_windows_handoff`, 별도 독립 안전 검토 `b434_manifest_audit`. #434 소스 [PR #434](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434), 승인된 8파일 명세 [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 재사용.
- **새 준비물:** [Draft PR #456](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/456)의 Windows 일반 사용자 로컬 1회 CMD+안내 2파일, 고정 커밋 `ae129ef64d2af7d8d88a8ef1d6bddac0dc6fef3d`. 승인 목표 SHA `1d6f66d87c0ff247ba75b4c98682c07c646e79cc`. 파일 원격 바이트 재조회·정적 13/13·독립 검토 GO이며 main/PC 설치·Windows 실운영 변경 0.
- **안전·운영 한계:** CMD는 기존 `tools/handoff-maintenance.mjs`를 정확히 1회 호출하고 자체 재시도·Git pull/checkout·PowerShell/RDC/Runner·관리자 권한 상승 없음. 승인/설치 SHA/lease/receiver/rollback 판정은 기존 인계 프로그램이 수행. 현재 Windows-local operator 실행 수단이 없어 `AUTOMATION_BLOCKED`, **FINAL PASS 아님**. 실행 실패/불명확 상태라면 결과 TXT 보존, 재시도 금지.
- **다음 최소 실행:** 기존 Windows PC 일반 사용자 로컬 세션에서 다운로드한 검증된 CMD 단회 실행 → `MAINTAINER_HANDOFF_PASS` 및 실제 설치 SHA·Receiver origin 확인 → 다음 정상 B 처리에서 신규 E: 중복 보고서 0건 관측. GitHub 원본 실행 파일이 필요하면 PR #456 고정 커밋에서 내려받는다. user에게 명령/SHA/경로 수정을 요구하지 않는다.
- **조정 원장:** [Issue #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68). 이미 완료된 #431/#449/#454 B는 다시 발행하지 않는다.

## 8. #434 로컬 승인 명세 미연결 — 2026-11-06 실제 Windows 사전검사

- **LAST PASS:** [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 고정 인계 명세 `main` 원격 존재·approved=true; [PR #456](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/456) Windows 1회 패킷 source/독립 정적 GO.
- **FIRST FAIL / 실제 사용자 TXT:** `OPERATOR_RESULT=AUTOMATION_BLOCKED`, `CODE=LOCAL_APPROVAL_MANIFEST_MISSING`, `HANDOFF_INVOKED=NO`. `E:\ZGmini\projects\zgmini-pc-control` 내 승인 명세 없음. Node/기존 인계 프로그램 존재 검사는 통과. **실제 유지보수기 변경 0**, #434 미완료·5건 4/5 유지. 로컬 HEAD/branch 미확인이라 원인을 stale checkout으로 확정하지 않음.
- **이번 개선:** [Draft PR #457](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/457) 읽기 전용 Git 상태 회수용 CMD+안내 2파일. 고정 source `61b15f51b5fb0e36460eec786b6198c14fd78cff`, source 정적14/14·독립 검토 GO. 승인 8파일+manifest만 검사하며 `git status` 선택적 잠금 비활성. branch 이름의 CMD 메타문자 주입 위험도 수정. **Windows 실제 진단 미실행**.
- **NEXT / 담당:** 기존 Windows 일반 사용자 로컬 operator에서 #457 read-only CMD 단회 실행, `ZGMINI_MAINTENANCE_434_CHECKOUT_PREFLIGHT.txt` 한 개 회수. 승인 파일 tracked/로컬 main HEAD·원격 추적 SHA·scoped dirty·target ancestry에 따라 필요한 경우에만 안전한 정규 source 동기화 검토. 원래 #456 CMD 및 기존 TXT 재실행/삭제 금지. 이후 신규 단회 인계→새 maintainer SHA/receiver→다음 정상 B의 E 중복 보고서 0 검증.
- **조정 증거:** [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68). 자동 pull/checkout, 임의 JSON 복사, Runner 자체 교체, RDC 사용 금지.

## 9. #434 로컬 checkout 계보 확정 — 2026-11-06

- **실제 사용자 Windows 읽기 전용 결과:** `READONLY_DIAGNOSTIC_COMPLETE`, `main` HEAD `91a6e085d69d35164c28cdfb8ff74cc67a6efd3b`, cached origin/main `50b8a54242525754fadb04b2a172ced884052daf`, approved manifest absent/untracked, 목표 `1d6f66d...` ancestor=false, 승인 9경로 scoped status clean. `HANDOFF_INVOKED=NO`, `SOURCE_UPDATE_ATTEMPTED=NO`.
- **원인 확정:** GitHub 커밋 계보에서 local main은 [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 승인 명세 병합 `14fa522c0b051801f6a12b64d872d7a50532d39e`보다 21커밋·16파일 뒤처졌으며 분기 충돌 0. 최신 remote main과는 45커밋·42파일 차이. 로컬 승인 파일 누락은 stale checkout 때문이고 JSON 1개 임의 복사로 helper의 Git ancestor/tracked 검사를 통과시키지 못한다.
- **NEXT / 승인 범위:** 활성 source·다른 변경을 보호하면서 정확한 PR#443 merge까지의 로컬 main 단회 fast-forward가 필요한지 검토하고 **16파일 변경 범위에 대한 승인/안전조건**을 확정한다. 새 패킷 준비와 실제 source FF/Windows 유지보수기 인계·E 중복 보고서 검증은 모두 별도 단계. 자동 pull/checkout·Runner 자체 교체/이전 CMD 재실행 금지, #434 및 전체 4/5 유지.
- **조정 원장:** [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68).


## 7. 2026-11-06 #434 고정 FF 인계 준비 (최신)

- **LAST PASS — 진단 실행물 개선 실증:** 사용자 Windows 반환 `ZGMINI_MAINTENANCE_434_CHECKOUT_PREFLIGHT.txt`에서 `READONLY_DIAGNOSTIC_COMPLETE` 확인. 첫 CMD는 승인 JSON 없음에서 중단돼 로컬 branch/HEAD를 확인하지 못했으나, [Draft PR #457](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/457) 별도 읽기 전용 진단에서는 `main`/`91a6e085d69d35164c28cdfb8ff74cc67a6efd3b`/`origin/main=50b8a54242525754fadb04b2a172ced884052daf`를 모두 조회(exit 0). 따라서 **진단 누락 결함은 실제 Windows 실행으로 해결**. 인계/소스 변경은 수행하지 않음.
- **FIRST FAIL — #434 본체 인계 준비:** 로컬 Windows checkout에는 [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 승인 manifest가 존재·추적되지 않음. 정확한 병합 SHA `14fa522c0b051801f6a12b64d872d7a50532d39e` 대비 로컬 HEAD는 21커밋·16파일 이전, 무분기. manifest를 임의 복사하거나 최신 원격 main 전체 pull하지 않음.
- **사용자 조건부 승인과 source 준비:** Windows 로컬 `main`의 정확한 `91a6…`→`14fa522…` **단회 고정 fast-forward만** 승인. 전담 작성·독립 정적 리뷰 GO. [Draft PR #458](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/458) head `0729e41c1dd6065a530819cde2624600dc91344e`, 2파일 패킷. CMD blob `57086d4403a5118be16655a3ee7b31cd574febac`; 기존 16경로 dirty·새 파일 충돌·install lease·HEAD CAS·cached origin·hooks/filter 검사; `fetch/pull`/무단 설치/중복 재실행 없음. **source 검증 GO ≠ Windows 실운영 실행**.
- **다음 한 단계:** 로컬 Windows 일반 사용자 환경에서 다운로드 `MAINTENANCE_434_PINNED_FF_ONCE.cmd`를 한 번 실행하고 **새 결과** `ZGMINI_MAINTENANCE_434_PINNED_FF_RESULT.txt`만 회수. `SOURCE_FF_PINNED_PASS`이면 이전 #456 CMD를 재실행하지 않고 별도 V2 유지보수기 인계 패킷 준비 → 승인된 Windows-local Receiver 인계 및 E: 새 보고서 0 검증. 실패/UNKNOWN이면 TXT 보존·재실행 금지. 전체 5건 중 **4건 FINAL PASS, #434는 최종 검증 전**.


## 8. 2026-11-06 #434 결과 TXT 미발견과 안전 진단

- **현재 사실:** 사용자는 #458 FF CMD를 ZIP 압축 해제 후 실행했지만 검은 창은 종료됐고 신규 `ZGMINI_MAINTENANCE_434_PINNED_FF_RESULT.txt`를 찾지 못함. **기존 FF를 미실행이라고 단정 불가**. 실제 E: 제어 저장소 로컬 HEAD·인계 효과는 `STATE_UNKNOWN`.
- **기존 자동 경로 검토:** A `source-audit`는 원격 GitHub만 조회하며 로컬 Windows 제어 저장소 HEAD를 검증할 수 없음. 관련 A operation 신규 설치를 강요하지 않음.
- **최소 수정:** [Draft PR #459](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/459), head `46ff128155a9254f4eae9fed86e7b60452243fb5`, CMD blob `b3f2f98c73572406cdbd6c43b7a6477ba3679b4a`, 독립 정적 리뷰 **SOURCE GO**. 새 CMD는 로컬 HEAD/branch/approval manifest의 **읽기 전용** 확인만 수행하며 출력은 `%TEMP%`의 고정 새 TXT+콘솔+Notepad와 `pause`로 보존. Windows CRLF 확인. 설치·checkout·merge·fetch/pull·Git 운영 쓰기 없음.
- **다음 한 단계:** 안전하게 다운로드 가능한 R2 읽기 전용 실행물로 실제 로컬 HEAD 분류. 전용 실행 환경 현재 불가이므로 ChatGPT 다운로드 파일 새 패키징은 미완료(원격 GitHub PR에서 소스 조회 가능). 실행 전까지 4/5 FINAL PASS 유지. **#458 FF CMD 재실행 절대 금지.**


## 9. 2026-11-06 #434 R2 실제 실패와 R3 원문 진단

- **LAST PASS:** 사용자가 R2에서 실제 `SCHEMA=ZGMINI_MAINTENANCE_434_HEAD_READONLY_R2` / `SOURCE_UPDATE_ATTEMPTED=NO` / `HANDOFF_INVOKED=NO` / `OPERATOR_RESULT=READONLY_FAILED` / `CODE=NOT_GIT_REPOSITORY` 제공. 이는 **R2 진단만 Git/E 운영 미변경**, 이전 FF 미실행의 증거가 아님.
- **FIRST FAIL 정정:** R2는 E: 저장소 폴더·Git 명령 존재 확인 후 `git rev-parse --is-inside-work-tree | findstr` 결합 판정에서 실패, stderr·Git exit 별도 없음. 실 Git 저장소 손상으로 분류하지 않음. 이전 #457은 단순 Git exit0만 봤으므로 두 진단은 모순으로 단정할 수 없음.
- **개선 source:** [Draft PR #459](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/459)에 `MAINTENANCE_434_GIT_PROBE_R3.cmd` 추가, commit `e4fe08bdd59e6702daea707ad1b9c37c3b155034`, Git blob `7f288849d4471b0037bceb05e46be9bfea378645` Windows CRLF/ZIP 내부 동일/압축 PASS/독립 SOURCE GO. Git worktree/toplevel/branch/HEAD 원문 stdout+stderr+exit 분리, manifest exists/tracked, 결과 사용자 TEMP 신규 TXT·Notepad·CMD pause. Git 쓰기/FF 재시도/인계/E: 신규 쓰기 0.
- **다음 단계 하나:** R3 실제 Windows 결과 회수 → 로컬 HEAD가 `91a6…`/ `14fa…`/그 외인지를 원문 증거로 판정. **원래 FF CMD와 R2는 재실행 금지**, #434 운영 PASS 미판정, 전체 4/5.
