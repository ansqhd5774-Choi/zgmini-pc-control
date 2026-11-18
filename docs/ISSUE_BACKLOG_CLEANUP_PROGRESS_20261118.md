# ZGMINI GitHub Open 이슈 누적 정리 진행 원장 — 2026-11-18

- 담당 브랜치: `codex/issues-lifecycle-manager-20261118`
- 기준: [ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md](ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md) R1
- 우선순위(2026-11-18 전환): **최신 실제 장애·차단(P0) → 최신 완료 요청 검증·종료(P1) → 최근 중복·미확정(P2) → 과거 누적 잔량(P3)**. 신규 자동 종료 코드는 기존 누적 정리의 선행 조건이 아니다. 상세 계약은 기준서 1A를 따른다.
- 관측 기준: 사용자 최초 화면 Open 1,198 / Closed 19(시점성 과거 수치). 1차 완료 뒤 Closed 48건을 조회했고, 이번 2차 배치 뒤 Closed **81건**을 조회했다. GitHub 검색 응답의 Open 쪽은 100건 제한이 있어 실시간 Open 총수는 미확정이다.
- 변경 효과: 이번까지 GitHub 이슈 상태 전환 **직접 누적 167건**(1차 28건 + 2차 33건 + 3차 43건 + 4차 32건 + 5차 11건 + 최신 전환 2건 + 이번 18건). #2128은 동시 다른 작업 종료로 **우리 직접 종료 건수에 포함하지 않음**. 운영 PC/Controller/Runner/DB/D1/Task/예약/source 변경 0건, Issue 삭제·PC 재실행 0건.

## 1. 1차에서 Closed한 28건

아래는 소유자 원본 Issue를 재조회하고, `pc-job` schema·requestId, 실제 Run의 최종 성공, `results/*.json` 및 `results/*.txt` **양쪽 원격 readback**, status/code/내용 일치 검증 후 Close한 **단회 실행 요청**이다. 이것은 관련 기능 자체가 Production 배포까지 완료됐다는 뜻이 아니다.

| Issue | 기존 PC Run | 작업 결과 코드 | 최종 GitHub |
| --- | --- | --- | --- |
| [#1](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1) | [41446967748](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41446967748) | `RUNNER_COMMAND_EXECUTED` | `Closed / completed` |
| [#2](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2) | [41447177390](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41447177390) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#3](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3) | [41447177999](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41447177999) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#5](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/5) | [41447180327](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41447180327) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#7](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/7) | [41447187389](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41447187389) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#11](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/11) | [41447535282](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41447535282) | `CORE_WRITE_GATE_BLOCKED_WITHOUT_LOCK_CHANGE` | `Closed / completed` |
| [#13](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/13) | [41447531346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41447531346) | `DUPLICATE_REUSED_NO_EXECUTION` | `Closed / completed` |
| [#14](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/14) | [41448688985](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448688985) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#15](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/15) | [41448687779](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448687779) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#16](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/16) | [41448691603](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448691603) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#17](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/17) | [41448693958](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448693958) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#18](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/18) | [41448695720](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448695720) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#19](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/19) | [41448698805](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448698805) | `ISOLATED_WORKSPACE_VERIFIED` | `Closed / completed` |
| [#20](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/20) | [41448700606](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448700606) | `APPROVED_TESTS_PASS` | `Closed / completed` |
| [#21](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/21) | [41448703538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41448703538) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#22](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/22) | [41451548684](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41451548684) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#23](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/23) | [41452078442](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41452078442) | `APPROVED_TESTS_PASS` | `Closed / completed` |
| [#24](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/24) | [41452080240](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41452080240) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#25](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/25) | [41452506875](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41452506875) | `SOURCE_COMMIT_READONLY_VERIFIED` | `Closed / completed` |
| [#26](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/26) | [41452530736](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41452530736) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#27](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/27) | [41453641804](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41453641804) | `SOURCE_COMMIT_READONLY_VERIFIED` | `Closed / completed` |
| [#29](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/29) | [41453727959](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41453727959) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#31](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/31) | [41455600390](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41455600390) | `SOURCE_COMMIT_READONLY_VERIFIED` | `Closed / completed` |
| [#34](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/34) | [41463781746](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41463781746) | `SOURCE_COMMIT_READONLY_VERIFIED` | `Closed / completed` |
| [#35](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/35) | [41465678618](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41465678618) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#36](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/36) | [41479728374](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41479728374) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#38](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/38) | [41497943158](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41497943158) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |
| [#39](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/39) | [41501509843](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41501509843) | `CORE_READONLY_DIAGNOSIS` | `Closed / completed` |

- 예외 #13: 중복 요청 차단 fixture `DUPLICATE_REUSED_NO_EXECUTION`의 `PASS` 및 원본 #1의 성공·종료를 확인. **중복 실행을 수행하지 않았다는 것이 검증 목표**이며 새로운 PC 작업 성공으로 계산하지 않음.
- 예외 #11: `CORE_WRITE_GATE_BLOCKED_WITHOUT_LOCK_CHANGE`는 의도된 충돌 보호 fixture의 **PASS**로서 Core 쓰기·잠금 변경 성공이 아님.
- 종료 직전 각 Issue의 Open·요청 ID·댓글 수·`pc-job` 라벨을 재조회했고, 종료 후 전체 Closed 목록에서 28건을 다시 확인함.

## 2. 2차 누적 정리: 이번 후속 작업에서 Closed한 33건

- 범위: 이슈 #40~#101 중 **원본 단회 실행/설치 결과를 최종 검증한 건만** 종료. 기존 28건의 증거·상태는 재사용하고 재실행하지 않음.
- 검증 결과: **PC A급 단회 조회·진단 22건 + 정규 Controller 유지보수 11건 = 33건** 신규 `Closed / completed`, 전부 GitHub Closed 재조회 PASS.
- 2026-11-18 조사 시점 GitHub `is:issue is:closed` 검색은 **81건**(이전 원장 48건 이후 본 배치 33건 추가), 아래 전체 33건을 포함. 실시간 Open 전체 개수는 계속 미확정.
- 운영 효과: 이 회차에 **운영 PC·DB·D1·Task·Controller 수정/재실행 0건**, GitHub Issue 상태 전환 33건, 실제 결과 데이터 삭제 0건.

### 2.1 단회 `pc-job` 정상 완료 22건

모든 행은 정확한 Issue schema/`requestId`, 댓글의 고유 Run/seat/attempt, `results/*.json` + `results/*.txt` **2/2**, JSON/TXT status·code·operation, 완료된 Actions Job 결론 `success`, 종료 직전 Open/댓글 수/라벨 재조회를 통과했다.

| Issue | 최종 실행 Run | 검증된 결과 |
| --- | --- | --- |
| [#40](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/40) | [41503928265](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41503928265) | `SOURCE_COMMIT_READONLY_VERIFIED` |
| [#43](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/43) | [41508297091](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41508297091) | `FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` |
| [#45](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/45) | [41510318443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41510318443) | `FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` |
| [#47](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/47) | [41514524739](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41514524739) | `CORE_READONLY_DIAGNOSIS` |
| [#48](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/48) | [41514532579](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41514532579) | `SOURCE_COMMIT_READONLY_VERIFIED` |
| [#51](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/51) | [41516118153](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41516118153) | `CORE_READONLY_DIAGNOSIS` |
| [#55](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/55) | [41517737829](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41517737829) | `CORE_READONLY_DIAGNOSIS` |
| [#56](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/56) | [41517980058](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41517980058) | `ER1_SAVED_INPUT_READONLY` |
| [#58](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/58) | [41518719291](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41518719291) | `FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` |
| [#61](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/61) | [41519837144](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41519837144) | `CORE_READONLY_DIAGNOSIS` |
| [#67](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/67) | [41541055596](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41541055596) | `CORE_READONLY_DIAGNOSIS` |
| [#71](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/71) | [41594042670](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41594042670) | `CORE_READONLY_DIAGNOSIS` |
| [#72](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/72) | [41594237276](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41594237276) | `PC_SOURCE_READONLY_DIAGNOSIS` |
| [#73](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/73) | [41594245590](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41594245590) | `PC_SOURCE_READONLY_DIAGNOSIS` |
| [#76](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/76) | [41595480896](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41595480896) | `FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` |
| [#82](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/82) | [41597423589](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41597423589) | `FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` |
| [#85](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/85) | [41598874529](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41598874529) | `FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` |
| [#86](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/86) | [41599044283](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41599044283) | `PC_SOURCE_ORIGIN_CANDIDATE_INVENTORY` |
| [#90](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/90) | [41600750246](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41600750246) | `CORE_READONLY_DIAGNOSIS` |
| [#91](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/91) | [41601296622](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41601296622) | `PC_SOURCE_READONLY_DIAGNOSIS` |
| [#97](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/97) | [41602241390](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41602241390) | `FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` |
| [#101](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/101) | [41604668000](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41604668000) | `CORE_READONLY_DIAGNOSIS` |

### 2.2 정규 `pc-maintenance` Controller 업데이트 완료 11건

단순 postcheck 성공만 근거로 삼지 않았음. 각각 원본 요청 schema/`requestId`, 운영 유지보수 결과 JSON/TXT **2/2**의 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, target SHA=actual SHA, `protectedStateUnchanged=true`, `workflowEnabled=true`, 원본 댓글 `REPORT_UPLOAD: VERIFIED`, 연계 사후 읽기 진단(이미 위 A급에서 검증)을 대조한 뒤 해당 **과거 단회 요청의 수명주기만** 종료. 이들이 현행 Controller 활성 SHA라는 뜻이 아니며 재설치하지 않는다.

| Maintenance Issue | 정확한 결과 requestId | 연계 postcheck |
| --- | --- | --- |
| [#49](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/49) | `pc-update-986a7ef8-98e9-476d-8af8-250c9daf61c1` | [#51](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/51) |
| [#54](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/54) | `pc-update-5e97310f-b7e6-45d3-947c-ccca28fef3cc` | [#55](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/55) |
| [#57](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/57) | `pc-update-07f19c64-3c24-4a06-9bd9-f00e3847df81` | [#58](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/58) |
| [#60](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/60) | `pc-update-f4f5e231-e262-4ec8-a477-92295e7e032c` | [#61](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/61) |
| [#70](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/70) | `pc-update-2c7b6947-afa2-4a9b-9254-5ae00cc79bea` | [#71](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/71) |
| [#74](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/74) | `pc-update-b238e4d2-fd94-4108-881c-5084219aef4a` | [#76](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/76) |
| [#80](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/80) | `pc-update-e17b6782-81ba-4cec-b5e0-0261302348dd` | [#82](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/82) |
| [#84](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/84) | `pc-update-aa7e9032-aee5-4656-bdcb-1da2215a7d26` | [#85](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/85) |
| [#89](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/89) | `pc-update-54b802be-b1ca-4cdb-8f42-7682c3f5e71a` | [#90](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/90) |
| [#94](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/94) | `pc-update-b4d22705-4bfd-44ba-bf55-e9b5eab0fa84` | [#97](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/97) |
| [#100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/100) | `pc-update-0e6cc5d8-86f5-4199-a3c2-b76275e38dbe` | [#101](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/101) |

### 2.3 보존한 실제 미해결·미확정 항목

- [#52](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/52) `BLOCKED / ALPACA_LEDGER_ABSENT`: 요청은 종료됐다는 추정으로 닫지 않고, 해당 담당자의 실제 원장 상태·후속 증거를 기다림
- [#62](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/62)·[#63](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/63) `FAIL / ERR_INVALID_ARG_TYPE`: 기존 실패 기록·후속 수정/인수 근거 확인 전 Close 금지
- 기존 [#4](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4)·[#6](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/6) 한쪽 결과쌍 결손 및 #8/#9/#10/#12, 중앙 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)은 원래 보존 판정을 유지
- **미확정은 PC 실행을 재실행하여 보정하지 않는다.** 원본 자료 재조회 또는 담당 인수가 필요한 범위만 추적

## 3. 3차 작업 — 실증 완료 이슈 43건 추가 종료

- 범위: 이슈 #102~#220의 원본 요청 중 **단회 `pc-job` 32건 / `pc-maintenance` Controller 유지보수 11건**만 이번에 Close
- 누적 직접 종료: **104건** = 1차 28 + 2차 33 + 3차 43
- 종료 전 요청 schema/requestId/operation/원본 댓글, 결과 JSON+TXT `2/2`, Actions Run 최종 성공(`pc-job`), 유지보수 target SHA=actual SHA와 보호 상태 유지(`pc-maintenance`), 최신 이슈 Open/라벨/댓글 일치 확인
- 종료 후 GitHub `is:issue is:closed` 최신순 100건 목록에서 신규 **43건 전부 Closed 재조회 PASS**. Closed 전체는 생성일 구간별 독립 검색(11/02 47건, 11/03 53건, 11/04 9건, 11/06~10 12건, 11/16~19 3건; 다른 기간 0건)으로 **124건** 확인. Open 전체는 100건 조회 상한으로 미확정
- PC/Controller/SQLite/D1/Task/예약 변경, 원본 재실행, 증거 삭제 0건. 이슈 Close는 **과거 단회 요청의 수명주기 종료**이며 기능 전체의 성공과 구분

### 단회 진단·조회·사후 확인 32건

| Issue | 검증한 Run |
| --- | --- |
| [#102](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/102) | [41604809756](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41604809756) |
| [#107](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/107) | [41613295348](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41613295348) |
| [#108](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/108) | [41613571172](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41613571172) |
| [#109](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/109) | [41613644238](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41613644238) |
| [#111](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/111) | [41616217717](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41616217717) |
| [#113](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/113) | [41626464872](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41626464872) |
| [#117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/117) | [41649418304](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41649418304) |
| [#119](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/119) | [41650475079](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41650475079) |
| [#121](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/121) | [41651973237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41651973237) |
| [#124](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/124) | [41657164974](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41657164974) |
| [#125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/125) | [41658114507](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41658114507) |
| [#131](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/131) | [41682083909](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41682083909) |
| [#135](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/135) | [41685614927](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41685614927) |
| [#137](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/137) | [41686142853](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41686142853) |
| [#141](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/141) | [41688113905](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41688113905) |
| [#142](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/142) | [41688297709](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41688297709) |
| [#147](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/147) | [41691604831](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41691604831) |
| [#150](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/150) | [41692089868](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41692089868) |
| [#160](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/160) | [41694567252](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41694567252) |
| [#164](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/164) | [41696452596](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41696452596) |
| [#174](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/174) | [41698893881](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41698893881) |
| [#180](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/180) | [41699968514](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41699968514) |
| [#181](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/181) | [41700101034](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41700101034) |
| [#186](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/186) | [41700816223](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41700816223) |
| [#188](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/188) | [41701583808](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41701583808) |
| [#190](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/190) | [41702404095](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41702404095) |
| [#191](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/191) | [41702558766](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41702558766) |
| [#198](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/198) | [41772898398](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41772898398) |
| [#200](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/200) | [41773465574](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41773465574) |
| [#201](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/201) | [41773483870](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41773483870) |
| [#208](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/208) | [41774477791](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41774477791) |
| [#214](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/214) | [41775433207](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41775433207) |

### Controller 유지보수 11건

요청의 `ZGMINI_PC_MAINTENANCE_RESULT_V1` 원격 JSON/TXT 2/2에서 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, 목표=실제 SHA, `protectedStateUnchanged=true`, `workflowEnabled=true`를 확인. 표의 사후 검사 Issue는 위의 별도 `pc-job` PASS를 검증한 건이다.

| Maintenance Issue | 후속 사후검사 |
| --- | --- |
| [#123](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/123) | [#124](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/124) |
| [#134](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/134) | [#135](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/135) |
| [#140](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/140) | [#141](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/141) |
| [#146](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/146) | [#147](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/147) |
| [#159](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/159) | [#160](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/160) |
| [#163](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/163) | [#164](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/164) |
| [#171](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/171) | [#174](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/174) |
| [#177](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/177) | [#180](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/180) |
| [#197](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/197) | [#198](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/198) |
| [#204](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/204) | [#208](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/208) |
| [#213](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/213) | [#214](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/214) |

### 미완료·추가 확인이 필요한 사례

- [#103](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/103) `ALPACA_LEDGER_ABSENT`, [#122](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/122) `CONTROL_DIRTY`, [#136](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/136)·[#148](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/148) 소스 미검증, [#185](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/185) 메모리 부족, [#217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/217) WAL 사전조건 등 실제 `BLOCKED`
- [#106](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/106), [#118](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/118), [#120](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/120)의 과거 유지보수 `UNKNOWN`은 후속 복구 댓글과 별개로 원본의 정확한 최종 상태·인수 확인 필요
- [#126](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/126) B 결과 불일치. [#129](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/129), [#145](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/145), [#182](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/182), [#192](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/192), [#194](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/194), [#210](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/210), [#215](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/215) 등 별도 수집·게시·등록 계약은 해당 결과 pair와 실제 효과를 개별 확인하기 전 보류
- **반례 [#155](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/155):** 자동 댓글은 `PASS`지만 후속 원담당 댓글에 `records=0`·실제 일정 확보 미완료/`PARTIAL` 명시. 결과 외피 PASS만 보고 종료하면 안 됨
- [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) 중앙 공유 조정 원장은 계속 Open 유지

## 4. 4차 작업 — 원격 증거 확인 후 32건 Closed

- 2026-11-18 KST 기준 후속 정리: 기존 직접 종료 104건 재사용, 이번 **32건**(일반 `pc-job` 25건 + 정규 Controller `pc-maintenance` 7건) 상태 전환 완료
- 직접 종료 누적: **136건** = 1차 28 + 2차 33 + 3차 43 + 4차 32
- 2026-11-18 KST GitHub `is:issue is:closed` 생성일 범위 분할 조회: 11/02 47건, 11/03 53건, 11/04~06 43건, 11/07~19 14건, 합계 **Closed 157건**. 모든 구간 100건 미만·중복 없는 Issue 번호로 집계, 이번 32건 전부 Closed readback PASS. 이번 직접 종료 외 타 작업의 Closed는 분리
- 증거 일치: 원본 Issue schema·requestId·operation·단일 댓글, Actions Run 최종 `completed/success`, 결과 원격 JSON/TXT 2/2 및 status/code/seat/jobId 일치. Maintenance는 별도 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, target=actual SHA, 보호 상태·Workflow 활성, 연결된 postcheck 확인
- PC 실행·배포·source 교체·SQLite/D1·Task·원본 Issue 삭제 **0건**. 수명주기 종료는 개별 단회 요청의 과거 성과만 의미하며 연결 기능 전체 완료가 아님

### 4.1 일반 단회 실행 25건

| Issue | 원본 GitHub Actions Run |
| --- | --- |
| [#222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/222) | [41777944196](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41777944196) |
| [#228](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/228) | [41781136618](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41781136618) |
| [#229](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/229) | [41781137867](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41781137867) |
| [#241](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/241) | [41782254756](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41782254756) |
| [#242](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/242) | [41782409948](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41782409948) |
| [#270](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/270) | [41792103468](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41792103468) |
| [#275](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/275) | [41795874903](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41795874903) |
| [#346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/346) | [41898736066](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41898736066) |
| [#347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/347) | [41900011696](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41900011696) |
| [#349](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/349) | [41905147261](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41905147261) |
| [#390](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/390) | [41923602585](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41923602585) |
| [#395](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/395) | [41925521146](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41925521146) |
| [#398](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/398) | [41925818546](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41925818546) |
| [#399](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/399) | [41925821772](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41925821772) |
| [#400](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/400) | [41925977826](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41925977826) |
| [#406](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/406) | [41927370388](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41927370388) |
| [#407](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/407) | [41927531192](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41927531192) |
| [#408](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/408) | [41927838012](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/41927838012) |
| [#432](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/432) | [42019572689](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42019572689) |
| [#444](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/444) | [42074412544](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42074412544) |
| [#446](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/446) | [42075344610](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42075344610) |
| [#447](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/447) | [42075710849](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42075710849) |
| [#450](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/450) | [42078874438](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42078874438) |
| [#451](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/451) | [42079358716](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42079358716) |
| [#455](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455) | [42083302971](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42083302971) |

### 4.2 Controller 유지보수 7건

| 요청 Issue | 독립 검증된 사후 진단 |
| --- | --- |
| [#220](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/220) | [#222](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/222) |
| [#226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/226) | [#229](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/229) |
| [#236](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/236) | [#241](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/241) |
| [#345](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/345) | [#346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/346) |
| [#445](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/445) | [#446](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/446) |
| [#449](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449) | [#450](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/450) |
| [#454](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454) | [#455](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/455) |

### 4.3 계속 Open으로 보존한 사례

- [#227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/227)는 유지보수 일시 정지 중 #228에 연결된 backlog replay 안내만 존재. 원본 요청과 대체 작업의 **실제 operation 일치·효과**가 충분히 입증되지 않아 원본 종료 보류
- [#240](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/240) `UPDATE_INSTALLED_SOURCE_DRIFT`, [#319](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/319) `UPDATE_UNEXPECTED_FAILURE/UNKNOWN`, [#339](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/339) `UPDATE_ENVIRONMENT_ERROR`, [#428](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/428) `R54_B_ORIGINAL_SOURCE_SHA_DRIFT`: 원담당 복구·효과 확인 전 Close 금지
- [#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452) `PASS/R54_SIXFILE_INVENTORY_COMPLETE`는 파일 6개 **존재** 증거. [#428](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/428) 후속 댓글에 승인 해시와 불일치 기록이 있으므로 승인된 6파일 **설치 완료**로 확대 해석하지 않고 보류
- [#258](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/258)은 최초 자동 실패 댓글에 대한 후속 정정이 존재. 댓글의 단일 결과 상태만 사용하지 않고 최종 Run·원장 검증 필요
- [#371](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/371)처럼 B급 전용 요약 `PASS`·`RESULT_UPLOAD: 2/2`가 있는 경우도 별도 결과 경로·실제 계약 및 현재 Issue 범위까지 확인해야 함
- [#155](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/155) `PASS`지만 `records=0`·목표 미달 정정, 중앙 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) 유지 등 기존 보류 유지

## 5. 5차 작업 — 기존 Open 11건 추가 종료

- 작업 대상: 이슈 #468~#495 중 **검증 완료된 일반 `pc-job` 10건**, Controller 유지보수 **1건**만 `Closed / completed`
- 2026-11-18 KST 누적 직접 종료: **147건** = 28 + 33 + 43 + 32 + 11. 과거 최초 Open 1,198건 대비 직접 정리 약 12.3% (현재 Open 총수와 다름)
- 정합성: 일반 요청의 `schema/requestId/operation`, Run `completed/success`, 원격 JSON/TXT 2/2, `PASS`·code·jobId 일치 확인. 정규 유지보수 #476은 `SUCCEEDED`·target=actual Controller SHA·보호 상태·Workflow 활성과 연계 #477 사후검사를 검증
- GitHub Closed 생성일 분할 재조회: 11/02 47건, 11/03 53건, 11/04~06 54건, 11/07~19 14건, **총 Closed 168건**. 모든 조회 구간 100건 미만이고 이번 11건 전체 Closed 일치
- GitHub 이슈 상태 외의 PC 실행·설치·SQLite/D1·예약·공개 게시 변경 0건. 원본 댓글·결과·실행 이력은 보존

| 분류 | 이슈 | 원본 근거 |
| --- | --- | --- |
| `pc-job` | [#468](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/468) | [Run 42216452150](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42216452150) |
| `pc-job` | [#469](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/469) | [Run 42217648660](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42217648660) |
| `pc-job` | [#470](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/470) | [Run 42218229009](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42218229009) |
| `pc-job` | [#477](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/477) | [Run 42222240510](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42222240510) |
| `pc-job` | [#478](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/478) | [Run 42222496073](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42222496073) |
| `pc-job` | [#479](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/479) | [Run 42222523422](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42222523422) |
| `pc-job` | [#489](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/489) | [Run 42233076653](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42233076653) |
| `pc-job` | [#492](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/492) | [Run 42235267871](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42235267871) |
| `pc-job` | [#493](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/493) | [Run 42237932188](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42237932188) |
| `pc-job` | [#495](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/495) | [Run 42240944697](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42240944697) |
| `pc-maintenance` | [#476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476) | 실제 Controller 유지보수 결과 JSON/TXT + [#477](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/477) 사후 PASS |

### 다음 조사에서 유지할 보류 조건

- [#504](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/504) 원격 결과 댓글 부재, [#521](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/521) `ALPACA_LEDGER_ABSENT/BLOCKED`는 이번 종료 대상에서 제외
- [#227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/227) backlog replay 안내는 대체 #228의 `runner-smoke` 결과만으로 원본 업무 목표 달성이 입증되지 않으므로 Open 유지
- [#452](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/452) 6개 파일 존재 결과와 승인된 목표 SHA 정합성이 다를 수 있다는 원담당 기록을 우선 적용, Open 유지
- 실제 기능 수집·게시·승인 대기는 담당자의 최종 효과 검증 없이 일반 단회 읽기 요청과 함께 일괄 종료하지 않음

## 6. 최신 이슈 우선 전환 — 2026-11-18 KST

- 기존 **과거 #502 이후 오래된 순서** 정리는 즉시 **P3 보조 대기열**로 전환. `created desc` + `updated desc` 상위 Open을 각각 조회해 최신 활동 이슈 및 오래된 활성 장애를 함께 확인.
- 최신 Open 확인: [#2130](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2130), [#2129](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2129), [#2128](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2128), [#2125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2125), [#2124](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2124), [#2122](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2122) 등. 중앙 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)도 updated 상위에 있으나 영속 원장으로 보존
- **이 대화 직접 Close 2건**: [#2124](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2124) (L7 `PASS/L7_RUNTIME_READONLY_INVENTORY`, Run 44249899179)와 [#2122](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2122) (Census runtime `PASS/INFLATION_CANDIDATES_RUNTIME_READONLY_EVIDENCE`, Run 44248897539). 각 원격 JSON+TXT 2/2, requestId/operation/jobId, Actions `completed/success` 확인 후 Close. 단회 **조회 요청 종료**이지 실제 테마 점수/물가지표 전체 완료 아님
- [#2128](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2128): 원격 JSON+TXT 2/2 및 Actions 성공 검증까지 통과했으나 **종료 직전 재조회에서 이미 `closed`이고 댓글이 2개로 변경**됨. 동시 변경으로 판단하여 no-op. 우리 직접 종료 149건에는 미포함
- [#2129](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2129)·[#2125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2125): 최신 Writer B 요청에 **결과 댓글 0건**. 실제 Run·저장·수신 여부 확인 전 완료로 간주하지 않고 Open 유지
- [#2130](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2130): `PASS/PC_SOURCE_READONLY_DIAGNOSIS` 댓글이지만 **`SUMMARY_ONLY`—원격으로 전체 파일 inventory/해시 검증 불가**. 요약 증거와 실제 요청 목표를 구분하여 추가 검증 전 Open 유지
- 총계 주의: 이전 5차 종료 때의 GitHub 전체 Closed **168건**은 그 시점의 스냅샷이다. 이번 동시 타 작업 Close가 발생했으므로 이를 실시간 현황이라고 반복 표기하지 않음. `openTotal` 최신 전체 집계는 별도 독립 분할 조회 전 미확정
- 현재 이번 전환 과정에서 **운영 PC·Controller·원본 DB/D1/Task 변경 0건**, 전체 재실행 0건

## 7. 6차 최신순 직접 정리 — 18건 종료 (2026-11-18 KST)

- **사용자 승인 우선순위**: 신규 Open·최근 갱신 중 실제 P0 장애 먼저 분류 → 최신 단회 PASS 수명주기 완료 검증 후 종료 → 과거 이슈는 P3로 유지
- 이번 대화에서 **18건만 직접 Close**. 누적 직접 종료 **167건** = 28 + 33 + 43 + 32 + 11 + 최신 전환 2 + 이번 18. 다른 대화가 닫은 [#2128](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2128), [#2130](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2130) 등은 직접 실적에 포함하지 않음
- **완료 증거**: 표의 각 요청은 GitHub 원본 Issue의 고유 requestId·schema·operation, 원격 `results/*.json` 및 `*.txt` **2/2**, 기록된 Run 성공, 현재 상태를 대조했고, 실제 이번 18건 전부 `Closed` 재조회 PASS. Host/Process는 별도의 결과 schema와 역할 operating/handoff·관측 ID·0 operationalWrites를 확인
- 최신 [#2133](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2133)은 **기존 D1 seed 읽기 전용 비교 1,624개 중 불일치 0**의 범위로만 PASS. 결과에 `publicationAuthorized=false`, `d1SeedCasVerified=false`, `r32NonRegressionVerified=false`이므로 신규 게시·승인된 공개 성공으로 표현하지 않는다
- GitHub Closed **191건**: 생성일 기준 11/02 47, 11/03 53, 11/04~06 54, 11/07~10 10, 11/11~15 0, 11/16~17 2, 11/18 25건. 검색 7구간 모두 100건 이하, 중복 없는 Issue 번호 기준. **Open 전체 수는 아직 미확정**이다
- GitHub 이슈 상태 외 운영 PC·Controller·SQLite/D1·Task·배포·원본 결과 삭제·PC 작업 재실행 **0건**

### 7.1 표준 `pc-job` 성공 10건

| 이슈 | 원본 Run |
| --- | --- |
| [#2117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2117) | [44245593729](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44245593729) |
| [#2100](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2100) | [44238822587](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44238822587) |
| [#2099](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2099) | [44238275189](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44238275189) |
| [#2096](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2096) | [44236563194](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44236563194) |
| [#2095](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2095) | [44236404405](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44236404405) |
| [#2091](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2091) | [44235695757](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44235695757) |
| [#2090](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2090) | [44233733220](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44233733220) |
| [#2088](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2088) | [44230284284](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44230284284) |
| [#2081](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2081) | [44226161984](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44226161984) |
| [#2080](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2080) | [44224927060](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44224927060) |

### 7.2 Host/Process 인벤토리 읽기 전용 5건

| 이슈 | 원본 Run | 유형 |
| --- | --- | --- |
| [#2114](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2114) | [44243383920](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44243383920) | `process-inventory-readonly` |
| [#2108](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2108) | [44240685942](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44240685942) | `process-inventory-readonly` |
| [#2086](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2086) | [44226960547](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44226960547) | `host-inventory-readonly` |
| [#2085](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2085) | [44226841374](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44226841374) | `host-inventory-readonly` |
| [#2084](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2084) | [44226687240](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44226687240) | `process-inventory-readonly` |

### 7.3 W03 전용 결과 계약 3건

| 이슈 | 원본 Run | 검증 완료 범위 |
| --- | --- | --- |
| [#2133](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2133) | [44251904069](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44251904069) | W03 D1 seed read-only / 1,624 scores, mismatch 0 |
| [#2121](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2121) | [44248537680](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44248537680) | W03 R51 stored-date read-only |
| [#2119](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2119) | [44246366950](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44246366950) | W03 R48 private SHA readback |

### 7.4 최신 보류 및 다음 판단

- [#2129](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2129), [#2125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2125): W03 D1 seed 별도 고유 요청으로 댓글 **0건**. #2133이 성공했어도 다른 requestId를 동일 결과로 재사용하지 않음. 실제 Run/저장/수신 증거 확인 전 Open
- [#2115](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2115): 최초 **`EXACT_ISSUE_TITLE_REQUIRED` 미접수** 댓글과 이후 `PRIVATE_RESULT_PAIR_AND_MANIFEST_SHA_VERIFIED` 전용 readback 결과가 모두 있음. 대체 경로의 정확한 수신·원본 효과/담당 인수 확인 전 Open
- [#2107](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2107): 원본 `BLOCKED/RESOURCE_WAIT_MEMORY`, 기능 진입 전 중단. 1차 admission 통과 후 2차 메모리 검사에서 거부되는 소스 구조가 공통 담당자에 의해 조사됨. 완료로 위장하거나 임의 실행하지 않음
- [#2106](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2106): Task RUN_REQUEST_ACCEPTED와 Task/DB 실제 완료는 구별. 수집·DB 후속 증거 없이 Closed 금지
- 최신 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) 중앙 Controller 조정 원장, [#1818](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1818) Census M3 등 최근 갱신된 오래된 업무는 P0/P2 활동 여부를 별도로 검토하며 자동 Closed 금지

## 8. 확인했지만 닫지 않은 사례

| Issue | 실제 확인 | 보존·후속 |
| --- | --- | --- |
| [#4](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4) | Run 41447178996 PASS 및 TXT 존재, **원격 JSON 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지. 기존 결과 게시/원장과 대조 |
| [#6](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/6) | Run 41447183444 PASS 및 JSON 존재, **원격 TXT 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지 |
| [#8](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/8) | `FAIL/ENOENT` | 후속 조치 확인 전 Close 금지 |
| [#9](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/9) | 의도된 실패 fixture `FAIL/CONTROLLED_FIXTURE_FAILURE` | fixture 성공 판정/결과 인수 확인 전 자동 종료 금지 |
| [#10](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/10) | `FAIL/JOB_EXECUTION_TIMEOUT` | timeout 결과와 후속 확인. PC 재실행 금지 |
| [#12](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/12) | `BLOCKED/OPERATION_NOT_ALLOWED` | 보호 거부 자체가 요구한 시험인지 원담당 인수 후 개별 판정 |
| [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) | 공유 Controller 중앙 원장, 다수 조정 댓글 | 영속 조정 원장으로 유지. 일괄 Close 금지 |

## 9. 다음 필수 작업

1. 최신 P0 원장(#68, #2107, #1818)과 결과 미수신(#2129, #2125)의 현재 계약·Run을 **조회만** 하고 원담당과 연결한다. 다음 최신 Open #2079 이하의 단회 성공 후보는 원본 JSON/TXT와 Run 검증 후 개별 종료한다. 이미 Closed된 #2128/#2130/이번 18건의 완료 증거 재검증과 PC 재실행은 금지하고, 과거 누적은 P3 보조 대기열로 유지한다.
2. 결과쌍 결손(#4/#6)은 기존 Run/댓글·결과 게시 저장소를 읽기 전용으로 대조. 한쪽이 없어도 실행을 재시도하거나 성공으로 위장하지 않는다.
3. 실패/차단(#8/#9/#10/#12)은 원담당의 실제 처리·후속 이슈 확인 후 별도 정리. Core/실행기 오류를 이슈 담당자가 임의 수리하지 않는다.
4. 같은 작업의 원격 결과를 반복 검사하지 않도록 이 원장과 Close 상태를 재사용하고, 정리 결과가 충분히 축적된 뒤 신규 요청 자동 Close를 개발한다.
5. 완료 시 실제 `open/closed` 건수와 이번 `closedReadbackVerified` 건수, 진짜 미해결·보류 수를 별도 보고한다.
