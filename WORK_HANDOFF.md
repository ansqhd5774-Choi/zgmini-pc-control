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


## 10. 2026-11-06 #434 R3 실제 HEAD 및 FF V2 준비

- **LAST PASS:** 사용자 R3 실PC에서 E: 제어 저장소 `GIT_WORKTREE=true/EXIT=0`, `GIT_TOPLEVEL=E:/ZGmini/projects/zgmini-pc-control`, `main/EXIT=0`, 실제 HEAD `91a6e085d69d35164c28cdfb8ff74cc67a6efd3b/EXIT=0`, 승인 manifest 없음 확인. R2의 `NOT_GIT_REPOSITORY`는 진단기 결합 판정 오류였음. 이전 FF 후 HEAD 진전 없음이나 이전 호출 여부 자체는 UNKNOWN.
- **개선:** 기존 [PR #458](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/458) Draft branch에 V2 파일 추가, commit `2346d8023b91938d20bf783f9c23bddb35be82e9`, CMD blob `7284a685303ec3ba37b64a6d33addf790e6c7962`. 보고서 TEMP/메모장/콘솔 pause, Git 판정 파이프 제거, branch byte exact, 불필요한 cached origin SHA equality 제거. 16 승인 경로·10 신규 충돌·install lease/filter/hook/목표 SHA 보호 유지. CRLF·ZIP hash/압축·독립 SOURCE GO.
- **NEXT:** Windows 일반 사용자에서 신규 V2 단회 수행 후 `ZGMINI_MAINTENANCE_434_PINNED_FF_V2_RESULT.txt`로 `SOURCE_FF_PINNED_PASS`+HEAD/manifest 추적 증명. V1/R2 재실행 금지. 이후 V2 유지보수기 자체 인계는 별도 승인된 operator-only 절차와 실제 E 중복 보고 0 검증. 전체 4/5 운영 PASS 유지.


## 11. 2026-11-06 #434 FF 실PC 성공과 유지보수기 인계 준비

- **LAST PASS — Windows 소스 FF:** 사용자 원본 `ZGMINI_MAINTENANCE_434_PINNED_FF_V2_RESULT.txt`는 `PREFLIGHT=PASS`, `FF_PROCESS_EXIT=0`, `ACTUAL_HEAD_BEFORE=91a6e085d69d35164c28cdfb8ff74cc67a6efd3b`, `ACTUAL_HEAD_AFTER=14fa522c0b051801f6a12b64d872d7a50532d39e`, `SOURCE_FF_PINNED_PASS`, 16파일 FF를 실증함. `HANDOFF_INVOKED=NO`. 승인 manifest tracked/exist는 V2 사후 성공 조건에 포함.
- **새 V2 설치 인계 source:** [Draft PR #456](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/456) head `4bf5e6606e5228c996ced7882b4be554ea9011b9`, `tools/operator-packets/MAINTENANCE_434_HANDOFF_V2_ONCE.cmd` Git blob `e243c0ffae1c182df637518f0beeb777993c605e`, Windows CRLF, 독립 SOURCE GO. 정확 HEAD `14fa…`/tracked manifest preflight 후 기존 `tools/handoff-maintenance.mjs --source-sha 1d6f…` **operator-only 1회**, 결과 `%TEMP%` 신규 TXT+Notepad+CMD pause. 기존 helper 설치 SHA/Receiver/lease/8해시/rollback 검사 재사용. 이전 #456 V1 CMD/TXT와 #458 FF V1/V2 재실행 금지.
- **NEXT:** 다운로드 가능한 실행 파일 패키징(현재 로컬 executor 미가용 시 GitHub 소스 준비 완료만 보고) → 승인된 Windows operator-only 인계 1회 → 새 설치 SHA `1d6f…`·Receiver Origin 실증 → 다음 통상 승인 B의 E 신규 `MAINTENANCE_<requestId>.txt/json` 보고서 0 및 GitHub TXT/JSON 회수 확인. 새 B를 검증만 위해 중복 발행 금지. **#434 FINAL 미완료/전체 4/5.**


## 12. 2026-11-06 유지보수기 실제 인계와 잔여 효과 검증

- **LAST PASS — Windows 유지보수기 인계:** 사용자 직접 반환 `SCHEMA=ZGMINI_MAINTENANCE_434_HANDOFF_OPERATOR_V2`, local HEAD `14fa522c0b051801f6a12b64d872d7a50532d39e` / `PREVALIDATION=PASS`, 기존 installed `c66a629f2a52b232e92b90e42906795afa4cb657`, `targetSha=1d6f66d87c0ff247ba75b4c98682c07c646e79cc`, helper `status=PASS` / `code=STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED`, `receiverPid=40796`, exit0, `HANDOFF_HELPER_PASS`. 백업 보존. Controller 자체 source SHA와 구분.
- **현재 미완료 — 실제 신규 E 결과 파일 0 검증:** [PR #434](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434) 소스는 E per-request 새 TXT/JSON 대신 영속 request ledger에서 비식별 결과 재구성/ GitHub upload+GET 검증, 관련 fixture 테스트 PASS. **실제 Windows 신규 B 처리 증거는 아직 못 찾음**. #454/#449/#445/#428 기존 pc-maintenance Issue는 이번 인계 이전 결과로서 새 효과 증거 재사용 불가.
- **NEXT 1건(자연 발생 대기):** 다음 통상 승인 B 1건의 `requestId`로 `reportUploadStatus=VERIFIED`, GitHub 원격 TXT/JSON GET 일치, E `reports/MAINTENANCE_<requestId>.txt/json` 신규 생성 없음 확인. 과거 E 파일의 존재/보존은 실패 아님. 별도 테스트용 신규 B·재설치·인계 재시도·과거 파일 삭제 금지. `#434 INSTALL_HANDOFF_PASS/EFFECT_RUNTIME_PENDING`, 전체 4/5 FINAL PASS 유지.


## 13. 2026-11-06 R54 승인 목표 SHA 정밀 대조 — 5/6 일치, 1파일 출처 확인 대기

- **LAST PASS:** [#452 실PC 조회](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226)는 R54 대상 6파일 모두 `PRESENT`(실측 SHA+크기)였으나 **승인 manifest 목표 SHA 일치 검증이 아니라 존재성 검증**이다. 원격 `main` `approvals/theme-nine-r54/sixfile-source.json`의 `APPROVED_B` V2 `old/next`와 실측 6개 SHA를 개별 매핑 대조한 결과 `next` 5/6, `old` 0/6이다.
- **FIRST FAIL / 정확 대상:** `worker/theme-nine-r37-public.mjs`만 관측 `30d47abdb99dc0c73c3daf54fa268e94067a9b632c70e633511c929925e794d0`, 승인 `next=30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85`, 승인 `old=e6768dd37ebe65b9015aeb37b4a088c568ab839f085936cec8305c56ea36ce33`으로 양쪽 모두 불일치. 나머지 5개는 승인 `next` 정확 일치한다. **파일 존재 6/6=설치 완료 6/6 아님.** 원인·출처는 아직 미확정이다.
- **과도한 Gate 정정:** `controller/r54-sixfile-inventory-readonly.mjs`의 `runtimeTaskBindingVerified=false`·`approvedForInstallation=false`는 읽기 전용 A 결과에 고정된 미검사 범위 값이지 사용자 조건부 승인 부재/실제 task binding 실패 증거가 아님. manifest `APPROVED_B`와 사용자 조건부 예약 태스크 일시 비활성화/원상복구 승인 범위를 별도 대조해 재사용한다.
- **명시 NEXT/담당:** 기존 R54 담당자가 **불일치 1파일의 변경 출처·현재 허용 대상 및 실제 예약 task binding**만 기존 기록과 대조하고 필요한 경우 정확한 수정 manifest를 승인 범위에서 준비한다. 이미 `next`인 5개를 `old→next`로 반복 설치하거나 기존 #428 실패 요청을 재실행하지 않는다. 현재 새 B를 #434 실증 목적으로 인위적으로 만들지 않는다. 조정: [R54 #428 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/428#issuecomment-6667972543), [공용 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6667929412).
- **#434 분리:** #434 독립 유지보수기 Windows 인계 자체는 `PASS`, 신규 정상 승인 B 실행 이후 E 요청별 보고서 미생성과 GitHub GET+ledger VERIFIED 실증은 여전히 `PENDING`. 전체 5건 중 **4/5 FINAL PASS (80%)**. 이번 교정의 PC 설치·E 쓰기·신규 B 요청은 0건.

- **공용 정본 반영 완료(2026-11-06):** 별도 브랜치 `codex/controller-apply-queue-sha-state-r1-20261106`의 [PR #460](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/460)을 독립 검토 후 정규 검토 상태로 전환·squash 병합했다. 원격 `main` 병합 commit **`062e9ed4dfb1e91128357037ef2b309b91f82d65`**, 변경은 `docs/CONTROLLER_APPLY_QUEUE.md` **1파일 +10/-0**, 원격 `main`에서 `파일별 적용 상태와 진단 범위 해석` 절 존재를 재조회했다. `OLD/TARGET/OTHER/MISSING/UNKNOWN` 구분, `PRESENT`와 승인 SHA 검증 분리, 읽기 전용 `false/null`의 해석 제한, 기존 승인·백업·잠금 보존 규칙이 정본에 반영됐다. **문서 반영 완료 ≠ PC 운영 설치 ≠ #434 효과 최종 검증**이며 #434은 통상 승인 B 실측 대기, 전체 4/5 FINAL PASS(80%) 유지.


## 14. 2026-11-06 인계 기록과 실제 수신 구분 — 프로세스 정체 오판 교정

- **신규 발견:** 공용 #68 댓글은 다른 ChatGPT 일반챗을 자동 깨우거나 PC `pc-job`/`pc-maintenance` 요청을 접수하는 실행 이벤트가 아니다. 기존 `.github/workflows/pc-job.yml`은 신규 `pc-job` Issue를 처리하고 B 독립 유지보수기는 별도 `pc-maintenance` Issue를 처리한다. 그러므로 원장에 다음 담당·행동을 썼다는 사실은 `HANDOFF_RECORDED` 증거이며, 수신 ACK·실제 재개·설치 진행은 별도 증거가 필요하다.
- **정본 개선 완료:** [PR #461](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/461)에서 `docs/CONTROLLER_APPLY_QUEUE.md` 1파일 **+2/-0**만 변경, squash 병합 `main` **`c21c249926dc2059e4be298ded8816efb36648c3`**. 원격 main의 `인계 전달과 실행 재개는 별도 상태다` 문단을 재조회했다. 기존 작업 채널로 한 번 명시 전달하고 수신·다음 실행을 확인할 수 있으면 확인하되, 경로가 없으면 `인계 기록 완료/수신 미확인`으로 표기한다. 새 설치·승인 Gate, 검증용 B 요청, 중복 댓글을 만들지 않는다.
- **현재 실제 상태:** R54 #428은 인계는 기록됐으나 **기존 작업자의 수신/재개 증거가 없음**. `worker/theme-nine-r37-public.mjs` 1파일 OTHER 출처·예약 task binding 대조가 담당자에게 남아 있다. #434은 인계 자체 PASS/신규 정상 B 실운영 효과 PENDING; **4/5 FINAL PASS(80%)** 유지. 인계 댓글만으로 재개/효과 검증 PASS 처리 금지.
- **NEXT:** 기존 R54 담당 대화/업무 채널에 실제 전달이 가능한 주체가 한 번 인계하고 수신·1파일 provenance 확인 여부를 기록한다. 현재 이 총괄 대화에는 별도 일반챗으로 메시지를 직접 전달할 API가 확인되지 않아 자동 재개됐다고 주장하지 않는다. 정상 승인 B 발생 시 기존 #68의 동일 requestId 결과/원장/E 중복보고0 검증을 수행한다. 설치·PC 쓰기 0건.


## 15. 2026-11-06 전담 서브에이전트 인계 실증과 실패변수 모형 검증

- **실제 팀 내 인계 PASS:** 총괄이 활성 서브에이전트 `handoff_pilot_worker`에 `CASE=ZG-HANDOFF-PILOT-20261106-A`를 고유 지정하여 읽기 전용 `main` 지침 확인을 명시 인계했다. 별도 `ACK CASE=... RECEIVED=YES` 메시지를 먼저 받고, 이어 `RESULT ... STATUS=PASS`를 수신했다. 증거 대상 `docs/CONTROLLER_APPLY_QUEUE.md` 원격 `main` blob `79b2184128221829794dc64018afc631c6cf4f38`. **동일 활성 에이전트 팀 내부 전달·응답만 실증**되었으며 다른 독립 일반챗 자동 재개·PC 운영 실행 증거로 확대하지 않는다.
- **실패 변수 4건 모델 PASS:** `handoff_failure_sim`의 메모리 내 상태 전이 검토에서 ① 정상 `RECORDED→DELIVERED→CLAIMED→VERIFIED`, ② 별도 대화 전달 불가 `DELIVERY_UNAVAILABLE/NO_ACK`, ③ 동일 ID 재전달 `DUPLICATE_SUPPRESSED`, ④ 수신 뒤 중단 `STATE_UNKNOWN`을 구분했다. **모형 4/4 PASS**이며 실제 타 대화 간 중복 차단 또는 Windows 운영 재개 검증은 아니다. 중단·불명확 상태에서 원장/원격 결과를 먼저 조회하고 무조건 재실행하지 않는다.
- **웹디버그 연결 한계:** 연결된 로컬 브라우저 확장 접근은 `originating browser context` 부재로 거부되었고 대체 클라우드 브라우저는 빈 탭만 보여 기존 사용자 ChatGPT 일반챗을 특정/재개할 수 없었다. 현재 총괄 도구에 **별도 독립 일반챗 직접 메시지·자동 깨움 경로가 검증되지 않음**. 댓글·GitHub Actions가 그 경로를 제공한다고 주장하지 않는다.
- **불필요한 구현 제외:** A `pc-job`는 신규 Issue `opened`→기존 self-hosted Runner→requestId 원장/lease→결과 TXT/JSON, B `pc-maintenance`는 독립 Windows receiver `poll`→`claim`/원장→GitHub GET/`VERIFIED`를 이미 갖춘다. 새 큐/Runner/DB/승인 Gate 및 #434 검증용 가짜 B는 만들지 않는다. 독립 ChatGPT 담당에게 전달할 수 없는 상태는 `HANDOFF_RECORDED/ACK_UNCONFIRMED`로 정확히 보고하며 독립 업무를 계속한다.
- **남은 NEXT:** 지원되는 실제 담당 채널이 확인되는 경우 기존 R54 담당에게 **단 한 번** 명시 인계·ACK를 요청하고 `worker/theme-nine-r37-public.mjs` 1파일 provenance/task binding만 회수한다. 유효한 새 정상 승인 B 실행 후에만 #434 E 신규 요청별 보고서 0·원장 VERIFIED·GitHub GET 실증 판정. 전체 **4/5 FINAL PASS(80%)** 유지. 이번 회차 PC/GitHub Issue/설치 변경 0건, 이 인계 기록 문서만 갱신.


## 16. 2026-11-06 R54 1파일 출처 조사 — 전담 서브에이전트 인계 결과

- **실제 인계·수신:** `r54_provenance_worker`(CASE `R54-ONEFILE-PROVENANCE-20261106`) 및 `r54_manifest_reviewer`(CASE `R54-ONEFILE-MANIFEST-20261106`)를 분리 지정하고 각각 선행 `ACK`와 독립 결과 회신을 확보했다. 총괄은 작업자의 조사 결과를 검토했으며 PC 작업·B 설치를 직접 대행하지 않았다.
- **승인 대조 재사용:** 원격 `main` `approvals/theme-nine-r54/sixfile-source.json` `APPROVED_B`/`R54_FIXED_SIXFILE_SOURCE_ONLY`/`runCount=1`/예약 작업 단회 disable+restore. PC #452의 6파일 중 5개는 `TARGET`, `worker/theme-nine-r37-public.mjs`만 `OTHER`: PC SHA256 `30d47abdb99dc0c73c3daf54fa268e94067a9b632c70e633511c929925e794d0`(11,993 bytes), 승인 `old=e6768dd37...`, `next=30326c94...`.
- **실제 새 조사:** `zgmini/main`과 R37·R38·R39 관련 GitHub 브랜치의 해당 경로를 읽기 전용 비교했으나 PC의 실제 SHA256을 어느 source에 연결할지 **입증 실패(`SOURCE_NOT_PROVEN`)**. Git blob SHA1과 PC SHA256 직접 비교 금지, GitHub 텍스트 길이·크기 차이만으로 출처 확정 금지.
- **한 번의 명시 기록 인계:** 기존 R54 작업 Issue [#428 최신 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/428#issuecomment-6668826391)에 새 조사·확정/미확정 근거·다음 필요 행동만 기록. **별도 ChatGPT 담당의 직접 수신/재개 ACK는 미확인**이며 댓글만으로 전달 완료라고 확정하지 않는다. #68에 중복 댓글·새 검증용 B는 만들지 않았다.
- **원담당 NEXT:** PC 운영 설치본 1파일의 바이트 지문·설치/인계 원장·백업과 예약 task action binding을 지원되는 읽기 전용 경로로 대조한다. 프로젝트 Git HEAD/dirty만으로 운영 복사본 출처를 확정하지 않는다(§18). 변경 출처가 확인되면 `OTHER` 보존·기존 승인 범위를 따져 최소 1파일 manifest를 준비한다. 기존 정상 5파일 재설치나 과거 #428 B 재실행 불가. 정상 B 발생 후 #434 동일 requestId GitHub GET·ledger VERIFIED·E 신규 보고서 0 검증은 별도 유지. 전체 4/5 FINAL PASS(80%).

## 17. 2026-11-06 R54 원격 A급 진단 범위 확인

- **독립 전담 조사 결과:** CASE `R54-READONLY-CAPABILITY-20261106`에서 현재 등록된 승인 A급 operation을 비교하여, R54 `worker/theme-nine-r37-public.mjs` **운영 설치본 1파일의 설치/복사 출처·원장/백업 및 예약 작업 binding을 함께 검증하는 기존 A급 계약이 없음(`NOT_AVAILABLE`)**을 확인했다. 진단 불충분은 Controller·Runner 장애나 승인 철회를 의미하지 않는다.
- `r54-sixfile-inventory-readonly`는 [#452 실PC 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226)에서 파일 존재·SHA256은 검증했으나 `runtimeTaskBindingVerified=false`. 이 결과를 운영 설치 이력/작업 연결 확인으로 확대하지 않는다.
- `pc-source-origin-readonly`는 저장소 후보의 HEAD/전체 dirty 위주이며 해당 E: 운영 복사본의 변경 이력·R54 예약 연결은 미지원. [#400 실PC 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/400#issuecomment-6643819841)의 `candidateCount=0`/`inventoryTruncated=true`는 출처 증거가 아니다. `pc-source-preflight`는 Core 대상, `source-audit`는 GitHub 원격만 확인한다.
- **불필요한 재실행 금지:** 기존 A operation을 같은 입력으로 반복하거나 새 진단용 B 설치를 필수 선행 조건으로 만들지 않는다. 기존 R54 담당은 현재 승인 범위에서 **운영 설치본 1파일·승인 원본/백업·설치 원장·Task binding 최소 읽기 전용 대조**를 수행할 수 있는 실제 지원 경로를 먼저 확인한다. 승인·도구가 지원되는 경로가 없으면 정확한 부족 권한/기능만 제시하고 독립 업무는 계속한다. `OTHER` 파일의 보존·승인 경계, 5개 `TARGET` 보존, #434 정상 B 실효과 대기는 §16 그대로 유지한다. 전체 4/5 FINAL PASS(80%).


## 18. 2026-11-06 R54 운영 설치본 출처 교정 — 이전 §16·17 NEXT보다 우선

- **근본 원인 정정:** [`controller/r54-sixfile-inventory-readonly.mjs`](controller/r54-sixfile-inventory-readonly.mjs)의 고정 경로상 #452가 측정한 대상은 **Git checkout 파일이 아니라** `E:/ZGmini/data/pc-writer/theme-nine-r54/worker/theme-nine-r37-public.mjs` 운영 설치 복사본이다. `pc-source-origin-readonly`는 `E:/ZGmini/projects`의 Core Git 후보를 찾는 기능이므로 PC 프로젝트 Git HEAD/branch/dirty/tracked 조회를 이 설치 파일 출처의 필수 선행이나 단독 증거로 삼은 이전 지시는 잘못된 대상이었다. 다른 문맥의 Git 점검은 보조 증거일 뿐이다.
- **원본 대조:** 원격 `zgmini/main`의 해당 worker 소스 SHA256 `30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85`(12,078 bytes)는 승인 manifest의 `NEXT`다. #452의 PC 운영 복사본 SHA256 `30d47abdb99dc0c73c3daf54fa268e94067a9b632c70e633511c929925e794d0`(11,993 bytes)은 승인 `OLD`·`NEXT`와 모두 다르다. 나머지 5파일은 `NEXT`. 출처·변경 이유는 아직 미확정이며 복사나 초기화로 추정 복구하지 않는다.
- **이미 구현된 검사 재사용:** 기존 `tools/update.mjs`에는 `inspectR54BOriginalSource()`(운영 파일 지문)와 `inspectR54TaskXml()`(R54 예약 action/원본 보호) 개별 검사가 있다. 하지만 설치된 승인 A operation 하나로 이 둘과 원장·백업을 연계한 **끝단 읽기 전용 조회 경로는 미확인**이다. 기존 R54 B는 최초 OLD 여섯 파일을 요구하므로 실패한 #428 재실행 금지. 새 A 모듈 개발·B 설치를 자동 선행조건으로 만들지 않는다.
- **원담당 NEXT 한 가지:** 현 운영 복사본 1파일과 검증된 설치·인계 원장, 승인 원본, 관련 백업 및 실제 R54 예약 XML/action binding을 **안전한 읽기 전용 수단으로 최소 대조**한다. 차이 원인과 승인 범위가 확인된 경우에만 정상 5파일을 보존하면서 한 파일의 실제 설치 필요성·정확한 manifest를 결정한다. 기존 B를 우회하거나 파일을 덮어쓰지 않는다. 사용자에게 CMD 반복 요청, 신규 검증용 B 요청, 전역 Controller 복구를 강요하지 않는다. #434 정상 B 실효과 대기 및 전체 4/5(80%)는 동일하다.


## 19. 2026-11-06 R54 원장 조회 한계 및 #434 증거 회수 최소화

- **R54 기존 실행 인터페이스 실사:** `tools/update.mjs`의 `r54-b-status --request-id <기존ID>`는 기존 B 요청의 journal phase·백업 존재 상태 등 **상태 조회**이며 운영 파일 `OTHER`의 byte provenance·백업 내용·예약 task XML을 종단 입증하지 못한다. `r54-b-apply`는 운영 B 설치 진입점이므로 #428에 재호출할 수 없다. 현재 `inspectR54BOriginalSource()`와 `inspectR54TaskXml()` helper는 소스에 있지만 해당 항목만 조회하는 설치된 승인 A operation은 없다. #428 [기존 차단 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/maintenance-pc-bcb696d5-6a3f-452d-8201-58a6b6eb7ac9.json)는 `BLOCKED/R54_B_ORIGINAL_SOURCE_SHA_DRIFT`이고 그 실행의 백업 내용/출처 증거를 제공하지 않는다.
- **NO-GO 판정(추가 조사):** 현재 `tools/maintenance-agent.mjs` GitHub Issue receiver가 받는 것은 `controller-update`, `employment-r6-host-register`, `theme-nine-r54-sixfile-install` B 작업뿐이다. `r54-b-status`는 Receiver 내부에서 기존 B 요청의 상태/복구 확인용으로 쓰이는 CLI이며 독립 승인 A/Issue 호출이 아니다. status 출력을 넓혀도 추가 receiver 계약·유지보수기 self-handoff가 필요하며 운영 복사본 provenance는 여전히 자동 증명되지 않는다. **파일 1개 진단을 위해 공통 유지보수기 기능/설치 자체를 새 Gate로 만들지 않는 것으로 결정(`NO-GO`)**; 다른 A 업무는 독립 진행한다.
- **R54 NEXT 범위:** 5 `TARGET`·1 `OTHER` 설치본 보존. `r54-b-status`를 중복 조회해 provenance 확인을 대체하지 말고 원담당이 실제 존재하는 과거 설치 원장/백업의 **내용**·승인 원본 지문·R54 예약 XML action 경로를 지원되는 읽기 전용 경로에서 확인한다. 원장·백업이 존재한다는 사실은 가정하지 않는다. 지원 경로가 없으면 `NO_APPROVED_END_TO_END_READONLY_PATH`와 필요한 최소 기능/승인만 보고하고, 이를 모든 일반 A 업무의 새로운 Gate로 삼지 않는다.
- **#434 최소 후속 검증:** 현재 설치된 V2 `tools/maintenance-agent.mjs`는 E: 요청별 TXT·JSON 작성을 제거하고 영속 request ledger에서 GitHub 결과를 재구성하여 GET 동일바이트 후 `reportUploadStatus=VERIFIED`를 기록하며 댓글에 `REPORT_UPLOAD: VERIFIED`를 남긴다. 테스트의 임시 E 보고서 부재는 fixture 증거이지 실제 PC 파일 0건 관측이 아니다. **다음 진짜 승인 B 1건**에 한해 설치 SHA/결과 상태→GitHub TXT·JSON GET→원장 `VERIFIED`를 기존 결과로 회수하고, 실제 E 신규 중복 보고서 0건은 지원되는 해당 requestId 읽기 전용 증거가 있을 때만 확인한다. 별도 결과 회수기·진단용 B·매번 CMD·새 A 모듈을 기본 선행조건으로 만들지 않는다. 실효과 직접 관측 전 #434 `EFFECT_RUNTIME_PENDING`, 전체 4/5(80%) 유지.


## 20. 2026-11-06 R54 OTHER 역사 소스 바이트 출처 발견 — 독립 검산 PASS

- **기존 `SOURCE_NOT_PROVEN` 증거 단계 갱신:** 별도 소스 조사자가 `zgmini` 과거 커밋 25개(실제 파일 24개)를 raw base64 → 원본 바이트 → SHA256으로 대조했고, 독립 검증자가 SHA256 구현 self-test 후 재검산했다. PC [#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452#issuecomment-6665267226)의 `worker/theme-nine-r37-public.mjs` `OTHER` SHA256 `30d47abdb99dc0c73c3daf54fa268e94067a9b632c70e633511c929925e794d0`/11,993B은 [zgmini PR #971 병합 `0bd36c732e282f3919ee414908e1ae89c0422271`](https://github.com/ansqhd5774-Choi/zgmini/commit/0bd36c732e282f3919ee414908e1ae89c0422271)의 파일 원본 바이트와 **정확 일치**. 동일 해시의 다른 역사 커밋 `d79ac13...`, `6f6ec67...`도 조사자 확인. **판정 `GITHUB_HISTORICAL_SOURCE_MATCHED`**; 이전 §16–19의 `SOURCE_NOT_PROVEN`은 당시 조사 범위 결과이며 현재 최종 파일내용 출처 판정으로 재사용하지 않는다.
- **목표 소스 이중 검산:** 승인 manifest `next=30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85`/12,078B은 [zgmini PR #978 병합 `73746cff927baa67115d8e85bb6498ba41b89759`](https://github.com/ansqhd5774-Choi/zgmini/commit/73746cff927baa67115d8e85bb6498ba41b89759)의 원본 바이트와 정확 일치. 이는 승인 목표 source 지문 확인이며 **PC 실제 설치 이력/예약 task binding 검증은 아니다**.
- **업무 범위 축소:** R54 6파일 중 5개는 승인 `NEXT`, 남은 1개는 악성/임의 변경이라고 단정할 수 없는 **공식 역사 source**. 기존 B의 '6개 모두 OLD' 사전조건을 맹목 재적용하지 말고 원담당은 **5개 NEXT 보존+역사 1개를 목표로 갱신할 실제 필요성**을 기존 승인 계약과 대조한다. 정확한 역사해시를 새 승인 `OLD`로 자동 간주하거나 기존 #428 B 재실행/강제 덮어쓰기는 금지. 원장·예약 실행 경로는 여전히 미검증이다.
- **다음 단일 결정:** 원 R54 담당이 고정 `APPROVED_B` sixfile manifest의 기존 precondition과 실제 mixed state의 차이를 확인해 **최소 1파일 변경 방식·승인 적합성·실제 task binding 검증**을 결정한다. Controller 총괄은 필요 시 엄격한 혼합상태 허용 패치의 안전성만 지원하고 실행/설치는 원담당이 한다. #434 정상 B 효과 검증과 전체 4/5 FINAL PASS(80%)는 여전히 별도.


## 21. 2026-11-06 R54 혼합상태 B 설치 설계·승인 경계

- **실제 계약의 구조:** `tools/maintenance-contract.mjs`는 R54 V2 고정 6개 OLD/NEXT 배열과 승인 manifest의 정확 일치를 강제하고, `tools/update.mjs`의 `inspectR54BOriginalSource`·`applyR54BPinnedSixConnectorLast`는 6파일 OLD 사전검사/CAS·connector 격리·백업/롤백을 전제로 한다. 따라서 5 `NEXT`+1 공식 역사 소스 `30d47abd...` 상태에서는 기존 #428 B 재실행이 PREVALIDATION에서 다시 차단되며, **V2 manifest의 OLD 해시 한 줄만 바꿔 해결되지 않는다**.
- **정확한 사용자 승인 범위:** 기존 사용자 R54 조건부 B의 기능 목적·6파일 대상·최종 NEXT·단회 예약 disable+restore는 유효한 기존 승인 증거다. 다만 V2의 정확한 OLD source 계약은 현 PC와 다르므로 새 혼합상태 계약/manifest/파일 해시·테스트를 준비한 뒤 기존 승인과의 동일성·보호 조건을 확인해야 한다. **같은 목적의 후속 오류 수정이면 무의미한 재승인은 생략**, 새 범위·운영 영향이 생기거나 확인되지 않을 때만 정확한 차이를 명시해 사용자 결정을 받는다.
- **원담당의 단계:** 우선 R54 서비스의 실제 공개/예약 기능에 추가 설치가 필요한지 판단한다. 설치 필요가 입증되면 `5 NEXT` 불변 + 정확한 역사 `1 old=30d47...`→`next=30326...` 전용 계약, 실제 task action binding, 원본/복구 백업, 단회 pause/drain·stage/CAS·6 NEXT 사후 검사·원상 복구를 설계/검증한다. 이는 `tools/update.mjs`·계약/테스트·유지보수기 인계가 필요한 **별도 B 업무**이며 총괄이 원담당의 운영 설치를 대신 실행하지 않는다. 현재까지 새 B·운영 변경 0건, #434 4/5 FINAL PASS 상태 유지.


## 22. 2026-11-06 R54 목표 Worker 1줄 기능 차이·공개 Runtime 7/9 관측

- **독립 source 차이 판정:** `zgmini` worker `theme-nine-r37-public.mjs`의 PC와 정확 일치한 [공식 역사 커밋 `0bd36c7`](https://github.com/ansqhd5774-Choi/zgmini/commit/0bd36c732e282f3919ee414908e1ae89c0422271) → 승인 [`NEXT 73746cf`](https://github.com/ansqhd5774-Choi/zgmini/commit/73746cff927baa67115d8e85bb6498ba41b89759)는 200줄 중 **동작 1줄** 차이. 독립 확정일 전진을 검증할 때 데이터센터·전력, 우주·위성 테마를 현재 일반 visible 목록에 없어도 수용하는 조건이며 [원본 PR #978](https://github.com/ansqhd5774-Choi/zgmini/pull/978)은 관련 Reader 20건 PASS를 기록했다. 이는 단순 형식 변경이 아닌 R54 대상의 **실질적 오류 수정**이어서 설치 필요성 `PROBABLY_NEEDED`; PC 실제 task 바인딩 및 해당 입력 통과 여부는 미확인이다.
- **공개 Runtime 직접 관측(2026-11-06 KST):** 브라우저에서 [`https://zgmini.kr/theme-fear-greed/`](https://zgmini.kr/theme-fear-greed/)를 열어 기존 7개 테마 점수 렌더링은 확인했으나 **R54 목표 9개 중 7개만 공개**, 표시 기준일 2026-10-28, 차트 마지막 관측일 2026-10-29. 9개 게시·최근 갱신의 Runtime PASS 증거는 없음. 사이트 상단 전체 8일 수집 26/26 건강 배지는 R54 9개 게시의 증거가 아니다. 7/9 공개 결과의 직접 원인이 역사 Worker인지, 예약 task binding/로컬 저장·계산·게시 경로인지 지금은 `NO_RUNTIME_EVIDENCE`로 구분한다.
- **업무 진전과 책임 분리:** 실PC 5 `NEXT`+1 역사 worker와 공개 7/9은 **서로 다른 증거**다. 총괄은 비즈니스 로직·게시를 직접 수정하지 않는다. **R54 원담당 NEXT:** 기존 Task XML/action binding·최근 로컬 실행/checkpoint·게시 ledger/API를 필요한 범위에서 읽기 전용으로 확인해 '2테마 누락·갱신 지연'의 최초 실패 단계를 확정한다. 해당 역사 Worker의 검증 조건이 실제 원인이면 §21의 정확한 1파일 B 계약과 승인/보호 검증을 재사용한다. 확인 전 기존 6파일 B 재실행·무관한 재수집/재계산/재게시·임의 강제 교체 금지. #434 조건부 실효과 검증 및 Controller 4/5(80%)는 별도 유지.


## 23. 2026-11-06 R54 Task/Action 관찰 A 후보 — 소스 리뷰 완료, 운영 미설치

- **진단 공백의 최소 해소 후보:** 기존 설치 A `r54-sixfile-inventory-readonly`는 실제 운영 파일 SHA만 반환하고 `runtimeTaskBindingVerified:false`가 상수라 R54 Task 연결 실패의 증거가 아니다. Core/global writer ledger와 과거 B용 `r54-readiness-once`도 현재 R54 Task 연결과 전용 게시 성공을 종단 증명하지 않는다. 실제 공개 7/9의 원인은 여전히 `NO_RUNTIME_EVIDENCE`.
- **전담 분리 실행:** 설계/위험 독립 검토 → 소스 구현 담당 → 독립 코드 리뷰 순으로 명시 인계. [Draft PR #462](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/462), `codex/r54-runtime-binding-readonly-20261106`, 수정 정확히 4파일(`controller/r54-runtime-binding-readonly.mjs` 신규, `controller/operations.mjs`, `config/operations.json`, 테스트). 고정 Task `ZGMINI-PC-Theme-Nine-R54-Public` 1개와 고정 CMD Action의 XML/Enabled/바이트 SHA256만 A/light/60초 읽기 전용 조회; 임의 요청 인수·전용 게시 외부호출·Task 변경·B 설치 없음.
- **검증:** Linux/Node 격리 fixture 11/11 PASS(구현자 관측), 독립 재리뷰 `P0=0/P1=0` **source-only GO**. R54 Action 경로 각 세그먼트 lstat/realpath containment와 읽기 전후 stat 비교, XML UTF-8/UTF-16LE 및 오류 구분, `WorkingDirectory`의 경로 원문 미노출 및 `bindingVerified=false` 별도 관측. 완전 매칭/Enabled/Action 파일 SHA 적합일 때만 `bindingVerified=true`. `lastRun`/`lastResult`는 `UNKNOWN`, R54 전용 ledger는 `UNVERIFIED_PATH`이며 진단 성공도 9/9 게시 성공 아님.
- **운영과 승인 경계:** Draft PR은 병합·Controller 설치·Windows 실제 A 실행 증거가 아니다. 독립 프로세스 개선 후보로 유지하며 공용 업무의 새로운 필수 Gate로 강제하지 않는다. 실제 A 사용은 원래 Controller 설치 담당이 현재 SHA/변경 파일/기존 승인과 정확한 manifest를 대조한 **정규 B Controller 업데이트 후** 가능. R54 6파일 B #428을 자동 재실행하거나 5개 NEXT·1 역사 소스를 덮어쓰지 않는다. 기존 R54 원담당은 설치 후 A 관측과 최근 R54 전용 실행/checkpoint·API/Reader를 연결해 첫 실패 지점을 판단한다. 전체 Controller 프로세스 과제는 #434 실운영 E 중복파일 0 실증 대기, **4/5=80%** 유지.


## 24. 2026-11-06 GitHub 댓글 및 유지보수기 결과 회수 병목 개선

- **실측과 원인 구분:** 공용 조정 이슈 #68에 댓글 194개·본문 291,141자가 누적됐고, 일반챗의 전량 반복 조회는 불필요하다. 정상 PC #452의 실제 Actions 로그에서는 실행 약 4.7초·업로드/댓글 약 7.3초이므로 해당 사례의 댓글 POST 자체는 수시간 병목이 아니다. 실제 장시간 대기 인과는 미확정이다.
- **독립 유지보수기 구조 병목:** 기존 `tools/maintenance-agent.mjs`가 60초 주기마다 OPEN `pc-maintenance` 38건을 조회한 다음 각각 순차 `gh issue view --json ...comments`를 호출해 이미 완료된 건까지 매번 다시 읽었다. 공용 `pc-job.yml`은 Issue별 concurrency이므로 6개 요청의 공용키 취소 가설은 현재 소스에서 배제했다.
- **최소 개선 [Draft PR #464](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/464):** 신규 Issue 번호 우선, `updatedAt` 불변·정확한 영속 원장·확정 status(SUCCEEDED/FAILED/BLOCKED)·원격 업로드 VERIFIED·댓글 완료까지 일치한 요청만 수신기 메모리에서 반복 상세조회 생략. 본문/시각 변경·UNKNOWN/RECOVERY_REQUIRED·댓글/원장 불완전 시 기존 상세인증 및 재조정 보존. 재시작 첫 주기 재검사. 코드+기존 테스트 2파일, 구현자 Node 33/33 PASS, 독립 리뷰 P0/P1 미해결 0. 운영·self-handoff 미실시.
- **일반챗 인계 개선 [Draft PR #463](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/463):** 문서 2개, 6/6 정책 흐름, 독립 리뷰 GO. #68 과거 댓글 전체 조회 대신 고유 Issue/requestId·검증된 TXT/JSON, `pc-job` Actions와 `pc-maintenance` 독립 원장 구분. 댓글은 보조 알림이지 다른 ChatGPT 대화를 기상시키지 않는다. 실행 결과와 전달 UNKNOWN 분리. 두 PR 모두 Draft/미병합.
- **대형 운영 사례:** [GitHub 공식 이벤트 규칙](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)은 기본 GITHUB_TOKEN 댓글로 후속 workflow가 자동 실행되지 않음을 명시한다. [GitHub REST 모범 사례](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)의 좁은 요청/유한 조회·조건부 GET과 [Amazon 멱등 API 설계](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)의 caller request ID를 기존 ZGMINI requestId·ledger에 적용한다. 유료 큐·Webhook 서버·Runner 증설·전역 필수 Gate 추가는 보류.
- **다음 실제 적용:** #463/#464를 최신 main·기존 상시 승인 및 변경 범위에 대조해 병합 판단. #464는 목표 main SHA·실제 유지보수기 설치 SHA·8개 허용 파일 해시·승인 manifest·원본 백업·정규 Windows 독립 self-handoff 조건을 충족한 경우에만 적용한다. 호스팅 PR CI가 구성·실행되지 않은 상태(Check Runs=0)는 실패가 아니며 구현자 33/33·독립 리뷰를 source 검증으로 정확히 표시한다. 이후 주기별 상세 조회 수, 정상 B 접수→원격 JSON/TXT 동일바이트 VERIFIED 시간, 중복 실행/댓글, 신규 E: per-request 보고서 생성 0건을 실제 측정한다. #434의 E 파일 미생성은 의도된 개선이며 단독 실패 조건이 아니다. 다음 자연 발생 B의 원장+원격 결과+E 보존까지 확인 전 EFFECT_RUNTIME_PENDING, 전체 4/5=80% 유지.
