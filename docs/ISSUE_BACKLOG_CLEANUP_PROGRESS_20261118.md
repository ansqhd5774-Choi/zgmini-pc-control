# ZGMINI GitHub Open 이슈 누적 정리 진행 원장 — 2026-11-18

- 담당 브랜치: `codex/issues-lifecycle-manager-20261118`
- 기준: [ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md](ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md) R1
- 우선순위(2026-11-18 전환): **최신 실제 장애·차단(P0) → 최신 완료 요청 검증·종료(P1) → 최근 중복·미확정(P2) → 과거 누적 잔량(P3)**. 신규 자동 종료 코드는 기존 누적 정리의 선행 조건이 아니다. 상세 계약은 기준서 1A를 따른다.
- 관측 기준: 사용자 최초 화면 Open 1,198 / Closed 19(시점성 과거 수치). 1차 완료 뒤 Closed 48건을 조회했고, 이번 2차 배치 뒤 Closed **81건**을 조회했다. GitHub 검색 응답의 Open 쪽은 100건 제한이 있어 실시간 Open 총수는 미확정이다.
- 변경 효과: 이번까지 GitHub 이슈 상태 전환 **직접 누적 207건**(1차 28건 + 2차 33건 + 3차 43건 + 4차 32건 + 5차 11건 + 최신 전환 2건 + 6차 18건 + 7차 21건 + 8차 19건). #2128은 동시 다른 작업 종료로 **우리 직접 종료 건수에 포함하지 않음**. 운영 PC/Controller/Runner/DB/D1/Task/예약/source 변경 0건, Issue 삭제·PC 재실행 0건.

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

## 8. 7차 최신순 직접 정리 — 21건 종료 (2026-11-18 KST)

- **이번 신규 종료 21건**: 표준 단회 `pc-job` 11건, Host/Process 읽기 전용 인벤토리 10건. 직접 종료 누적 **188건**(전 회차 167 + 이번 21).
- 원본 요청 `requestId`/schema/operation, 실제 `runId/seat`, 원격 JSON/TXT 결과쌍 **2/2**, 상태·코드·Job 성공을 검증. Host/Process는 저장된 `issueNumber`, role, `operationalWrites=0`을 추가 대조하고 종료 직전 Open/댓글 수를 재조회
- 현재 GitHub Closed는 **212건**: 생성일 구간별 11/02 47건, 11/03 53건, 11/04~06 54건, 11/07~10 10건, 11/11~15 0건, 11/16~17 17건, 11/18 31건; 모든 구간 검색 상한 100건 미만. **이번 21건 전원 Closed readback PASS**. 다른 작업의 종료 기록은 직접 종료 실적에서 제외
- 표준 요청 성공은 **그때의 읽기 전용 진단 완료**만 의미. [#2055](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2055) `R32_SAVED_RAW_SHA_CHECKPOINT_VERIFIED_NOT_CURRENT`를 최신 보강 원자료 완성이나 게시 완료로 주장하지 않음
- PC 작업 재실행·Controller 설치·Task 예약·SQLite/D1/웹 게시·원자료 삭제 **0건**

### 8.1 일반 PC 단회 진단 11건

| Issue | GitHub Actions 원본 |
| --- | --- |
| [#2072](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2072) | [Run 44221858034](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44221858034) |
| [#2060](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2060) | [Run 44212106863](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44212106863) |
| [#2058](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2058) | [Run 44211834183](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44211834183) |
| [#2055](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2055) | [Run 44210472996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44210472996) |
| [#2054](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2054) | [Run 44202609250](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44202609250) |
| [#2041](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2041) | [Run 44088646624](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44088646624) |
| [#2027](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2027) | [Run 44084002310](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44084002310) |
| [#2024](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2024) | [Run 44083636847](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44083636847) |
| [#2019](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2019) | [Run 44081956387](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44081956387) |
| [#2018](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2018) | [Run 44081708642](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44081708642) |
| [#2016](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2016) | [Run 44080920562](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44080920562) |

### 8.2 Host/Process 별도 계약 10건

| Issue | GitHub Actions 원본 | 범위 |
| --- | --- | --- |
| [#2076](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2076) | [Run 44223582023](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44223582023) | `process-inventory-readonly` |
| [#2074](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2074) | [Run 44222297628](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44222297628) | `process-inventory-readonly` |
| [#2048](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2048) | [Run 44091319308](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44091319308) | `process-inventory-readonly` |
| [#2047](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2047) | [Run 44091313042](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44091313042) | `process-inventory-readonly` |
| [#2040](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2040) | [Run 44087820370](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44087820370) | `process-inventory-readonly` |
| [#2035](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2035) | [Run 44086438586](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44086438586) | `process-inventory-readonly` |
| [#2029](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2029) | [Run 44084257054](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44084257054) | `process-inventory-readonly` |
| [#2028](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2028) | [Run 44084251128](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44084251128) | `process-inventory-readonly` |
| [#2026](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2026) | [Run 44083848852](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44083848852) | `host-inventory-readonly` |
| [#2025](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2025) | [Run 44083842514](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44083842514) | `host-inventory-readonly` |

### 8.3 보존한 실제 장애 및 미완료 요청

- [#2079](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2079): `STATE_UNKNOWN / CORE_TASK_RUNNING_INSTANCE_UNOBSERVABLE`; 실행 인스턴스의 실제 소유권이 확정되지 않아 Open 유지
- [#2077](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2077): `BLOCKED / R32_CHECKPOINT_INCOMPLETE_OR_FAILED`; 원본 checkpoint 상태 확인 전 Open 유지
- [#2071](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2071)·[#2064](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2064): `RESOURCE_WAIT_MEMORY` 차단. 안전 기준 임의 완화·재실행 금지
- [#2069](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2069): SPY/ETF 원자료 지정 구간 수집 64/64 완료 기록과 **후속 R47 계산 실패**가 공존. 별도 후속 계산이 실제 해결됐는지 원담당 확인 전 Open 유지. [#2066](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2066) 원본은 공급자 `HTTP 502 / STOP_NETWORK_OR_TIMEOUT`으로 저장 0
- [#2059](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2059)·[#2021](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2021)·[#2017](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2017): 유지보수 승인/manifest `BLOCKED`. [#2052](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2052)·[#2023](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2023) 등 `BUNDLE_REGISTERED`는 일반 진단과 달리 고유 source/승인·실제 효과 확인이 필요해 보류
- [#2034](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2034): 원본 `CONFIG_B_PAIR_INPUT_STOP`, 후속 source 수정은 존재하나 같은 요청 ID를 성공으로 덮어쓰지 않음
- 최신 [#2129](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2129)·[#2125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2125) W03 D1 별도 요청 댓글 0건, [#2107](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2107) 메모리 이중 검사 차단을 보존
- 최근 갱신된 [#1818](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1818)의 물가 Census #28는 PR #1325까지의 source 수정에도 **실PC 미완료**로 원담당 기록. [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) 중앙 인계는 영속 유지

## 9. 8차 최신순 정리 — 19건 직접 종료 (2026-11-18 KST)

- **직접 Closed 19건** = 표준 PC 단회 읽기·진단 16건 + Process 인벤토리 1건 + 당시 Controller 정규 유지보수 완료 2건. 직접 종료 누적 **207건**(기존 188 + 이번 19)
- 증거: Issue 원본 schema·requestId·operation, 결과 JSON/TXT 2/2, 원본 Actions `completed/success` 및 정확 run/seat, `PASS`·code·`jobId` 대조. 별도 인벤토리는 role/`operationalWrites=0`, Controller 유지보수는 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, 목표·실제 SHA 동일·Workflow 활성·보호 상태 유지 확인
- **GitHub Closed 232건**: 생성일 범위 분할 조회 11/02 47건, 11/03 53건, 11/04~06 54건, 11/07~10 10건, 11/11~15 0건, 11/16~17 36건, 11/18 32건. 각 범위 100건 상한 미만, **신규 19/19건 Closed 재조회 PASS**
- 최신 [#2135](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2135) `PASS/INFL19_RUNTIME_READONLY_EVIDENCE` JSON/TXT·Actions 검증 후 최종 재조회 시 이미 `closed`였으므로 중복 종료/직접 실적 미산입
- 운영 PC·Controller·Task·SQLite/D1·공개 배포·원본 재실행·이슈 삭제 변경 **0건**. 이 수치는 과거 고유 **요청 종료**이며 기능의 실시간 운영 성공률을 나타내지 않는다

### 9.1 PC 단회 조회·진단 16건

| Issue | 원본 GitHub Actions Run |
| --- | --- |
| [#2015](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2015) | [Run 44080605640](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44080605640) |
| [#2013](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2013) | [Run 44078419594](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44078419594) |
| [#2012](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2012) | [Run 44078380837](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44078380837) |
| [#2011](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2011) | [Run 44078195609](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44078195609) |
| [#2010](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2010) | [Run 44077954012](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44077954012) |
| [#2009](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2009) | [Run 44077269668](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44077269668) |
| [#2006](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2006) | [Run 44075649819](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44075649819) |
| [#1999](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1999) | [Run 44073203105](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44073203105) |
| [#1998](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1998) | [Run 44072645136](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44072645136) |
| [#1985](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1985) | [Run 44061200201](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44061200201) |
| [#1983](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1983) | [Run 44059955409](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44059955409) |
| [#1980](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1980) | [Run 44058286894](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44058286894) |
| [#1977](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1977) | [Run 44057529108](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44057529108) |
| [#1975](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1975) | [Run 44056775046](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44056775046) |
| [#1971](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1971) | [Run 44055885473](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44055885473) |
| [#1966](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1966) | [Run 44053884294](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44053884294) |

[#2013](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2013)의 `R32_SAVED_RAW_SHA_CHECKPOINT_VERIFIED_NOT_CURRENT`는 과거 무결성 PASS로만 처리. 원담당 후속 댓글의 `currentnessVerified=false`·`publicationAuthorized=false` 및 증분 저장 미관측을 그대로 보존한다.

### 9.2 Process 인벤토리 1건

| Issue | Run | 결과 |
| --- | --- | --- |
| [#1988](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1988) | [44065225067](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44065225067) | operating, `PROCESS_INVENTORY_COLLECTED`, operationalWrites 0 |

### 9.3 Controller 정규 유지보수 2건

| Maintenance Issue | 별도 완료 증거 |
| --- | --- |
| [#2004](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2004) | 원격 유지보수 결과 JSON/TXT 2/2 + [#2006](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2006) postcheck |
| [#1992](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1992) | 원격 유지보수 결과 JSON/TXT 2/2 + [#1998](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1998) postcheck |

### 9.4 그대로 Open으로 유지한 실제 미해결·범위 미확정

- [#2129](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2129)·[#2125](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2125): W03 D1 별도 요청 결과 댓글 미수신. 이슈별 원본 requestId로 별도 추적하며 신규 실행 금지
- [#1995](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1995)·[#1997](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1997): maintenance pause backlog/replay와 `STATE_UNKNOWN/CORE_TASK_RUNNING_INSTANCE_UNOBSERVABLE` 공존. 대체 요청 결과만으로 원본 성공 주장 금지
- [#1994](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1994): R47 CMD 단회 B `STOP/TASK_CMD_B_CANDIDATE_SOURCE_DRIFT_STOP`, 원담당 기능 B 미설치 판정, 후속 작업 확인 전 유지
- [#1979](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1979): Controller maintenance·backlog recovery 복수 댓글·사후 보호 기록. 명시적 동일 요청 범위 완료/효과 재확인 전 일괄 종료 금지
- [#1982](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1982)·[#1981](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1981): `PREIMAGE_MANIFEST_PATH`·부적합 원본. 정상 독립 #1983이 있어도 부적합 원본을 성공으로 바꾸지 않는다
- [#2023](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2023), [#2052](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2052), [#2002](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2002): `BUNDLE_REGISTERED`의 고유 source/승인/효과 계약은 일반 단회 조회와 구분
- 최근 갱신된 [#1818](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1818) Census #28 MISSING, [#2107](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2107) 메모리 이중 검사, [#2079](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2079) Core Task 인스턴스 미확정, [#2077](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2077) R32 checkpoint, 중앙 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)은 원담당/총괄 활성 영역으로 보존

## 10. 확인했지만 닫지 않은 사례

| Issue | 실제 확인 | 보존·후속 |
| --- | --- | --- |
| [#4](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4) | Run 41447178996 PASS 및 TXT 존재, **원격 JSON 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지. 기존 결과 게시/원장과 대조 |
| [#6](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/6) | Run 41447183444 PASS 및 JSON 존재, **원격 TXT 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지 |
| [#8](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/8) | `FAIL/ENOENT` | 후속 조치 확인 전 Close 금지 |
| [#9](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/9) | 의도된 실패 fixture `FAIL/CONTROLLED_FIXTURE_FAILURE` | fixture 성공 판정/결과 인수 확인 전 자동 종료 금지 |
| [#10](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/10) | `FAIL/JOB_EXECUTION_TIMEOUT` | timeout 결과와 후속 확인. PC 재실행 금지 |
| [#12](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/12) | `BLOCKED/OPERATION_NOT_ALLOWED` | 보호 거부 자체가 요구한 시험인지 원담당 인수 후 개별 판정 |
| [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) | 공유 Controller 중앙 원장, 다수 조정 댓글 | 영속 조정 원장으로 유지. 일괄 Close 금지 |

## 11. 다음 필수 작업

1. 최신 P0 장애 #1818 Census #28, #2107 메모리 중복 검사, #2079 Task 인스턴스 미확정, #2077 R32 checkpoint를 원담당/총괄 증거와 대조한다. 신규 Open은 최신순으로 우선 조회하고, 다음 완료 후보 #1965 이하를 JSON/TXT·Actions·정규 B 효과로 개별 검증한다. #2129/#2125 결과 미수신, #1979 다중 복구, #1995/#1997 중복·미확정은 보호하고 임의 재실행하지 않는다.
2. 결과쌍 결손(#4/#6)은 기존 Run/댓글·결과 게시 저장소를 읽기 전용으로 대조. 한쪽이 없어도 실행을 재시도하거나 성공으로 위장하지 않는다.
3. 실패/차단(#8/#9/#10/#12)은 원담당의 실제 처리·후속 이슈 확인 후 별도 정리. Core/실행기 오류를 이슈 담당자가 임의 수리하지 않는다.
4. 같은 작업의 원격 결과를 반복 검사하지 않도록 이 원장과 Close 상태를 재사용하고, 정리 결과가 충분히 축적된 뒤 신규 요청 자동 Close를 개발한다.
5. 완료 시 실제 `open/closed` 건수와 이번 `closedReadbackVerified` 건수, 진짜 미해결·보류 수를 별도 보고한다.


## 2026-11-28 추가 확인 — 최신 미해결 이슈 및 PR 분리 판정

- 조사 기준: GitHub 연결 계정의 원본 Issue/댓글, PR 검색, 최신 `main@da52580380885ea6c4ba3d68757b79cbe848ac0b` 비교. 본 전용 브랜치는 `main` 대비 `diverged`(ahead 23 / behind 3701). 본 기록 추가는 운영 소스 통합/배포가 아니다.
- [#4164](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4164): 원본 Run 45909216646 `BLOCKED/SUPERVISOR_OWNERSHIP_LOST`, 동일 요청 replay 금지. 후속 독립 [#4270](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4270) Run 46056098322는 비공개 조회로 `STATE_UNKNOWN/CNN_LOCAL_DAY_INCOMPLETE`, `local=DAY_INCOMPLETE`, `d1=NOT_CHECKED`, `api=NOT_CHECKED` 확인. 실패 단계가 달라 두 Issue 모두 OPEN 보존. 날짜별 로컬 원본/checks 정합성은 W06 소유 범위.
- [#4270](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4270): 별도 UI 1D 검증 및 #4288 소스 main 병합이 기록돼 있으나, V3 단일 B 효과의 승인/운영 설치/신규 동일 관측 SQLite→D1→API/UI 종단은 미확인. 기존 결과쌍 및 이전 실패를 소급 성공으로 취급하지 않는다. OPEN 보존.
- [#4117](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4117): 원본 Run 45899164961의 `RESULT_PAIR_REF_CONFLICT_UNTOUCHED`, 공개 JSON/TXT 0/2 유지. #4285의 추가 부정 회귀 17/17 PASS·main 병합, 테스트용 #4286 closed/unmerged는 기존 댓글에 증거가 있다. 소스 회귀 완료와 원본 요청 결과 완료를 분리하여 #4117 OPEN 보존.
- [#4156](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4156): 과거 Supervisor/Watchdog 회복 증거와 별도로 Public B 설치 및 추가 read-only 감사의 실제 결과는 미확인. 기능 종단 완료로 종료하지 않는다.
- [#4276](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4276): Public B 소스 Draft/미병합 및 고정 checkout `4d3fe664...`의 `main` 조상 조건 불충족. PR 본문에 #4283/#4287 사용자 승인 및 main 병합 정정 기록 있음. 이슈 담당자가 실행 SHA를 임의 재핀하거나 운영 B 발행·Windows 설치를 수행하지 않는다. 해당 소스 담당자의 정규 pin/검증 후 별도 인증·설치가 필요하다.
- 이번 회차 신규 Issue Close 0, PR merge 0, PC 요청·실행 0. 이전 207건 누적 직접 종료 실적은 과거 원장 기록이며 이번 회차 실적에 가산하지 않는다. 전체 Open/Closed 현행 총수는 이 제한 조회만으로 산정하지 않는다.


## 2026-11-28 후속 배치 — 최근 운영 Open 6건 원본 판정

- 본 배치는 진행 원장의 직전 2026-11-28 기록 후 별도의 원본 Issue + 전 페이지 댓글 재조회에 의한 상태 판정. `main`·운영 Runtime·결과 증거를 새로 생성하지 않았음.
- [#4159](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4159): Run 45908087228 결과 JSON/TXT 2/2 확인 댓글이 있으나 `STATE_UNKNOWN/STANDBY_WMI_EXECUTABLE_PATH_UNVERIFIED`. 현재 Controller 프로세스 출처 미확인 범위를 남김. **OPEN 유지**.
- [#4140](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4140): Run 45902843072 결과쌍 확인 댓글 존재, `STATE_UNKNOWN/WATCHDOG_R6_NATURAL_RESTART_PENDING`. 읽기 완료와 Watchdog 정상 완료 구분. **OPEN 유지**.
- [#4110](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4110): Run 45898382780 `STATE_UNKNOWN/R6_D1_QUERY_FAILED`, result `d1StoredAt=null`, `matchedToLocal=false`. D1 결과가 실제 정상인 것으로 닫지 않음. **OPEN 유지**.
- [#4082](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4082): CNN 기능의 후속 V2/V3 source 후보·CI·UI 증거는 많지만 신규 B 실제 설치/동일 관측 종단 `0/1`. 관련 #4270 후속과 결과 분리. **OPEN 유지**.
- [#4078](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4078): 승인된 read-only #4105에서 원본 요청이 S6 pause window 내 접수, `replayLedgerStatus=NOT_RECORDED`, `executionEstablished=false`; 원본 Workflow Run 및 결과 없음. **OPEN 유지**, 중복 replay 금지.
- [#3767](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3767): 과거 `STANDBY_WMI_EXECUTABLE_PATH_UNVERIFIED`와 이후 R5 소스/설치/READY 증거가 각각 확정됐으나 원래 독립 probe나 실제 S6 승격 검증 아님. 대표 추적 **OPEN 유지**.
- 이번 검토 대상 6/6 현재 Open; 완료/종료 조건을 충족하는 신규 단회 요청 **0건**. 신규 Close 0, PR merge 0, PC 재실행 0. 제한 검색으로 저장소 전체 Open 총수 확정하지 않음. 종료 누적 실적 207건은 기존 역사 기록 그대로.
- 다음: 새로 종료 가능한 후보는 `is:open`만 일괄 검색해 추정하지 말고 원본 requestId별 실제 결과쌍/Run/원장에 기반하여 확인. 위 운영 미해결은 원담당의 실제 수정/인증 이후 재판정.


## 2026-11-28 단회 실행·인계 후속 판정 — Writer/Watchdog/Backlog

- 원본 Issue와 댓글 전체를 기준으로 최신 생성 이슈의 유일한 검증용 [PR #4286](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4286)은 이미 `closed`; 재종료하지 않는다. 동일 소스 [#4285](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4285)는 이전 병합 증거를 재사용한다.
- [#4135](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4135): Writer B 결과쌍 2/2, `WRITER_B_PREFLIGHT_STOP/WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED`, 167/167 ACTIVE/READY 0. 설치 자체는 하지 않았으므로 Open.
- [#4131](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4131): Watchdog B Run 45901271597 `STAGED/WATCHDOG_B_APPROVED_SOURCE_STAGED_AWAITING_NATURAL_RESTART`; 두 파일 staged와 실제 R6 활성화 구별. Open.
- [#4122](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4122): Watchdog 원본 B `BLOCKED/WATCHDOG_B_APPROVED_CONTROLLER_SHA_DRIFT`, writes 0. 후속 다른 승인 대상과 원본 효과 혼합 금지. Open.
- [#4055](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4055): Writer B `WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`; 승인 4파일 후보와 두 개 실제 import closure 경로 불일치. Open.
- [#4068](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4068): 뒤이은 Writer B `WRITER_B_CORE_NATURAL_DRAIN_TIMEOUT_STOP`; #4055와 원인 다른 소진 요청. Open.
- [#4079](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4079), [#4075](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4075), [#4061](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4061): 각 agent-handoff 진단은 `VERIFIED_CANDIDATE_ONLY` 또는 `INSUFFICIENT_EVIDENCE`이며 원본 PC 작업 완료·타 대화 수신·운영 적용 증거가 없음. 원본 #4078/#4068/#4055의 미해결 결과와 연결 유지하고 인계 자동 종결하지 않음.
- [#3947](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3947), [#4069](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4069): Supervisor/Runner 별도 회복 readback은 존재하나 원래 S6 `RECOVERY_REQUIRED`의 Watchdog promotion·backlog reconciliation 성공은 미입증. Open.
- 이 배치 신규 종료/병합 0; 독립 운영 효과/재실행 0. 단순 과거 성공, 후속 소스 CI, stage 또는 요약 bot 댓글만으로 원본 실패 단회 요청을 완료로 바꾸지 않는다.


## 2026-11-28 최신 정정 — #4276 소스 병합 확인 및 Open 범위 재판정

- 이전 2026-11-28 기록의 **#4276 Draft/미병합 및 Public checkout ancestry 차단은 당시 관측**이다. 현재 원본 PR 댓글 [#7227708327](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4276#issuecomment-7227708327)과 GitHub commit compare를 대조한 결과, PR #4276은 원본 HEAD `d4e7b7130a558a380ae0be80bc8a20fc8031a86f`가 merge commit `da52580380885ea6c4ba3d68757b79cbe848ac0b`로 **main 병합 완료**. Public checkout `4d3fe664a90f2e8c3dea885559b1ec263df66a24` → main 비교는 `ahead 46 / behind 0`로 조상 조건 충족. 해당 이전 차단 항목을 현재 미해결로 반복 보고하지 않는다.
- **남은 단계는 별개:** 승인·설치 V2 Windows 정책 및 실제 7파일/설치 SHA·baseline CAS·lease·백업/복구, 단일 B 효과와 workflow ID/blob 연결, 실제 Public B 발행/수신 JSON/TXT readback은 **미완료**. 소스 병합과 운영 적용 성공을 혼동하지 않는다.
- 현재 GitHub `is:issue is:open` 검색 반환 24건, `is:pr is:open` 검색 반환 2건: [#4229](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4229) orphan-six 회복 Draft HOLD, [#4152](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4152) Controller B 정책 Draft HOLD. 두 후보는 현재 보류 지시/운영 조건을 해제하지 않고 Open 유지.
- 기존 최근 운영 단회 #4270/#4164/#4159/#4156/#4140/#4135/#4131/#4122/#4117/#4110/#4082/#4078/#4069/#4068/#4055/#3947/#3767은 앞 절의 정확한 개별 완료조건을 충족하지 않아 임의 종료하지 않았다. #4079/#4075/#4061 인계 기록과 #2427/#2426/#1743/#68 장기 원장도 목적상 Open 유지.
- 이번 배치 신규 Issue close **0건**, PR merge **0건**(기존 #4276 병합은 다른 담당자가 앞서 완료), 운영 파일 변경 **0건**. 기존 직접 종료 누적 207건 기록 보존. 후속은 새로운 원본 결과가 생긴 각 문제에서 필요한 정확 한 범위만 갱신한다.


## 2026-11-28 브랜치 권한 실측 및 최신 운영 대상 정정

- **권한/소속:** 역할 정본 `AGENTS.md`에 이슈 담당자 소속이 `zgmini-pc-control / codex/issues-lifecycle-manager-20261118`로 지정돼 있다. GitHub 연결에서 브랜치가 실제 존재함을 조회했고, 이 원장 파일을 기존 blob CAS로 갱신하는 방식으로 **해당 브랜치 파일 쓰기 권한만** 검증한다. 이 사실은 `main` 보호 우회, PR 병합 승인, B/C 운영 효과 승인 또는 PC 파일 접근 권한을 뜻하지 않는다.
- **main 대비 분기:** 조회 기준 `main@54491e25856c603b993fc3ea3bc5ad868dad2dee`; 이 담당 루트 브랜치는 `diverged`, ahead 27 / behind 3750. 다수 기존 고유 변경이 있으므로 `reset/force/rebase`로 소거하지 않고 대상별 최신 전용 브랜치와 PR을 유지한다.
- **PR #4312:** 실제 작업 전용 브랜치 `codex/issues-lifecycle-manager-20261128-s6-4078-plan`의 최신 HEAD `d90647a13766cc04ddd6be0bb66f27e616e73fe5`, 현재 main 대비 ahead 37 / behind 0. [정확 HEAD Actions #46085067931](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46085067931) hosted `public-source-only` SUCCESS, 43/43 PASS; Windows `source-only` SKIPPED. PR은 Draft/HOLD, #4078 원본 실제 backlog replay/PC JSON-TXT 영수증 없음.
- **#4078 승인 실측:** 기존 `approvals/controller-s6/1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141.json` 승인 효과는 `EXACT_ONE_SUPERVISOR_TREE_STOP_WITH_WATCHDOG_AUTO_PROMOTION`뿐. 새 `S6_4078_BACKLOG_ONLY_REPLAY`는 별도 정확 승인과 독립 Owner 운영 포트 미확보. 원본 #4069 RECOVERY_REQUIRED 및 #4078 OPEN 보존. [원본 이슈 판정](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4078#issuecomment-7230518770).
- **#4135 Writer B:** 원본 Run 45901622751 `WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED` (167/167 ACTIVE), 설치 전 중단. 소스 수정 PR #4314, #4315는 이미 main 병합돼 있어 중복 수정하지 않는다. 공개 저장소에서 기존 private-only B 실행 계약이 활성화되지 않고, 원본 4파일 manifest의 Runtime 효과와 최신 기능 승인/공급자 계약도 별도로 대조해야 한다. 운영 설치는 NOT DONE, 원본 요청 재실행 없음.
- **#3767:** #4156의 후속 운영 정상 감사(83/83 파일 CAS, Standby 2/2 READY)와 독립 WMI 승격 분류 검증은 다른 범위다. [대표 추적 정합 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3767#issuecomment-7230529772) 유지, 원래 #3767 R3 실패를 PASS로 소급하지 않음.
- **완료 판정:** 이 항목은 역할·브랜치·원장 정합 및 GitHub 파일 쓰기 권한의 확인이다. 신규 원본 Issue 종결/PR 병합/Windows 설치·재발행/DB·D1 변경은 0. 다음 필수 행동은 승인된 기존 실제 효과가 있는 독립 Issue를 우선 처리하고, #4078은 정확 효과 승인·운영 포트 확보 후에만 이어간다.


## 2026-11-28 #4312 최신 소스 회귀 및 운영 경계

- 이슈 담당 전용 PR [#4312](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4312)의 최신 관측 HEAD는 `404c8de4a5c6e6e1297765007973b37b29e4634c`, `main@54491e25856c603b993fc3ea3bc5ad868dad2dee` 대비 `ahead 42 / behind 0`. PR 변경 범위는 고정 S6 source/test 7파일이며 Draft/HOLD다. 동일 브랜치를 기초 없이 다시 합치거나 영구 담당 브랜치의 과거 28개 커밋을 재작성하지 않는다.
- 기존 #4078 source-only 실패 입력 결함 수정: `original.labels` 비배열/원소 null은 예외 대신 `BLOCKED/BACKLOG_4078_ORIGINAL_CAS_FAILED`로 처리. 테스트 진입점을 `tests/maintenance-agent.test.mjs`에 연결해 부정 케이스 실제 실행. 정확 HEAD 이전 [Actions #46085503666](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46085503666) hosted SUCCESS, 관련 통합 그룹 155/155 PASS.
- 최신 #4078 read-only adapter에서 승인·Supervisor owner 파일의 부모 디렉터리 심볼릭 링크 우회를 차단하도록 동일 `safeDir` 검사를 연결. [Actions #46085704726](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46085704726) 정확 HEAD `completed/success`; 운영이 아닌 GitHub hosted `public-source-only` Job #140794671042에서 신규 경로 부정 시험 **2/2 PASS**, 관련 통합 테스트 그룹 **157/157 PASS, fail 0**. Windows `source-only`는 SKIPPED.
- 승인 정본 #4069은 `EXACT_ONE_SUPERVISOR_TREE_STOP_WITH_WATCHDOG_AUTO_PROMOTION` 단회 stop만 승인. #4078 `S6_4078_BACKLOG_ONLY_REPLAY` 운영 효과·독립 Windows B/C Owner 포트의 별도 승인 및 원본 원장/lease CAS 입증 없음. #4313 현행 다른 A PASS는 원본 #4078 역사적 replay 영수증이 아님. #4078 OPEN/PR Draft 유지, 기존 원본 S6 재발행·Workflow/Task/Runner/DB/D1 변경·원본 Issue 부당 종결 0.
- 이 기록은 이미 완료된 GitHub source-only 검증의 이슈 담당 원장 정합화다. 추가 진단/새 gate/중복 CI를 완료 조건으로 만들지 않고, 새로운 정확 승인과 정규 운영 권한이 생길 때에만 해당 운영 단계에 진입한다.


## 2026-11-28 #4135 현행 R2 Core 중복 overlay 정합성

- 현행 기능 저장소 `ansqhd5774-Choi/zgmini/main@c2b61c1f3317ca71e8aff28179b43f0fd4d7a1c7`의 `scripts/pc-writer/local-cycle.mjs` Git blob `fbe255234059d8bdc49d4fc56abb4dfea9450442`를 #4135 승인 4파일 manifest와 직접 비교했다. 승인 후보의 두 번째 삽입 anchor `// Paid US full-market R2 reuses the same Core lock and previously` 앞에 현행 main의 기존 `US_BREADTH_PAID_R2_BACKFILL` 블록이 이미 존재하고 `planStoredPaidUsR2Backfill` 및 `collectPaidDaily`를 호출한다. 기존 승인 overlay를 이 main에 무검증 적용하면 유사 backfill 블록을 중복 삽입할 수 있는 **정적 구조 차이**가 있다.
- 별도 현재 MarketParquet 제외 지침 및 등록된 승인·CAS를 우선한다. 과거 #4135는 167/167 ACTIVE로 실제 overlay 시작 전 중단돼 이 **중복 실행이 운영에서 발생했다는 증거는 아니다**. 원본 요청 재실행·옛 manifest 재적용 없이 [#4135 직접 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4135#issuecomment-7230648044)에 정확 소스 비교와 해결 범위를 남김.
- #4312 PR은 최신 source CI 검증 완료 후 Draft/HOLD를 보존하며 별도 운영 승인 부재 상태가 변하지 않았다. 이 회차 신규 병합·Issue 종료·PC 실행/원자료 공급자/DB·D1 변경 0.


## 2026-11-28 #4135 Writer B 원본·후보 분리 검증 및 중복 위험 판정 정정

- 이전 절의 현행 `zgmini/main` R2 backfill 존재 관측은 맞지만 이를 근거로 **정규 Writer B가 그 파일에 삽입을 중복 수행한다고 판단한 설명은 정정한다.** `writer-b/windows-adapter.mjs::readCandidate`는 승인 후보 checkout과 **PC 원본 바이트**를 각각 읽으며 `materializeApprovedWriterFile`은 운영 원본에만 `insertions`를 적용한다. 현재 기능 `main` 후보 파일에 직접 삽입하는 코드가 아니다.
- `writer-b/insert-only-patch.mjs`의 필수 3중 고정 검증: `candidateSha256`→`beforeSha256`→`afterSha256`; 각각 `WRITER_B_INSERT_CANDIDATE_DRIFT_STOP`·`WRITER_B_INSERT_PREIMAGE_DRIFT_STOP`·`WRITER_B_INSERT_AFTER_SHA_STOP`으로 거부한다. `writer-b/insert-b-mode.test.mjs`에 3개 부정 fixture 존재. 기존 실제 운영 PC 원본이 승인 해시와 달라졌다면 정규 경로는 설치 전 차단한다. 현재 소스에서 실제 중복 설치 결함은 입증되지 않았다.
- 승인 manifest의 후보 `f7ea89305df8471ffb1827d974fc2e0c223d0b09` `local-cycle.mjs`는 현행 `zgmini/main`과 동일 Git blob `fbe255234059d8bdc49d4fc56abb4dfea9450442`이며, `paidCurrentResult`가 있지만 승인 삽입문 `paidR2DailyStart`는 없다. 후보 파일을 PC 승인 원본이나 설치 영수증으로 혼동하지 않는다.
- 실제 후속은 **MarketParquet 제외 지시와 별개 승인 효과 불일치, private-only Writer B 실행 조건, 인증된 PC Owner/원본 CAS/자연유휴 검증**이다. 원본 #4135의 설치 전 STOP 및 167/167 ACTIVE 원장을 유지하고 작업 완료를 소급하지 않는다. [#4135 정정 증거](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4135#issuecomment-7230667044). 승인 변경·신규 B/운영 설치·원장·DB·D1 변경 0.


## 2026-11-28 #4068 구형 실행 대체 종결 및 최신 Open 집계

- GitHub 연결 계정 권한 `admin` 확인. 역할 정본 §5-1의 사용자 승인된 B급 변경/독립 Windows Owner 인증 업무 권한은 유지하되 실제 PC 인증·효과별 승인과 구분한다. 담당 브랜치 `main@4fe6fc0705be0802b1674cb2cd8bec89f18f0b6d` 대비 ahead 33 / behind 3751 (쓰기 전 관측), 이력 재작성 없음.
- [#4068](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4068) Run 45880411492 원격 JSON/TXT 2/2에서 동일 requestId, `WRITER_B_INSTALL_STOP_RESTORED / WRITER_B_CORE_NATURAL_DRAIN_TIMEOUT_STOP`, `ORIGINAL_VERIFIED`, sourceSha=null, `READ_ONLY_RECONCILE_NO_REEXECUTE` 직접 대조. 후속 #4135로 대체된 소진 구형 실행만 [종결 근거](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4068#issuecomment-7230885990)를 남기고 `closed/not_planned` 처리 및 재조회 확인. 기능 설치 성공 아님. MarketParquet 제외 지시 보존.
- [PR #4312](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4312) 실제 merged=true, HEAD `404c8de4a5c6e6e1297765007973b37b29e4634c`, merge `4fe6fc0705be0802b1674cb2cd8bec89f18f0b6d` 직접 조회. #4078 closed/completed 상태이나 마지막 원본 댓글은 `SOURCE_MERGED / OPERATING_REPLAY_NOT_EXECUTED`로 기록, 실제 backlog 재발행 성공 증거로 간주하지 않는다. 현재 source 병합을 다시 수행하지 않음.
- 검색 `is:open` 반환 8→7건(신규 close 1건), Open PR 0. 실제 미해결 3건: #4135 대체 공급자 적법 입력/새 명세/설치, #4069 원래 S6 RECOVERY_REQUIRED·최신 로컬 원장 정합, #3767 실제 승격 WMI 분류 미확인. 영속 원장 #68/#1743/#2426/#2427 유지. 다음은 기존 정상 읽기 경로에서 #4069/#3767의 정확한 로컬 증거 확보, #4135는 대체 입력이 확인될 경우 정확 B 명세와 정규 적용. #4313 공개 SUMMARY_ONLY 결과로 로컬 원장 성공을 추정하지 않는다.
- 이번 신규 PR 병합 0, 원본 재실행/신규 PC 작업/Windows/DB/D1/공급자 변경 0. 기존 완료 증거 보존.


## 2026-11-28 #4078 원본 완료 상태 정정 및 직접 읽기 경계

- [#4078 정정 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4078#issuecomment-7230923109): `closed/completed`는 마지막 `SOURCE_MERGED / OPERATING_REPLAY_NOT_EXECUTED` 및 #4105 `NOT_RECORDED / executionEstablished=false`와 상충. #4312 병합 소스 `inspectS64078BacklogOnly`는 원본 `state==='open'`을 요구. 이슈 추적 상태만 `open/reopened`로 정정 후 원격 재조회. 본문·라벨·requestId 불변. pc-job workflow는 opened/labeled만 수신하므로 reopen은 실행 요청 아님. PR 병합 보존.
- 직접 기술 차단: 운영 저장소와 기능 저장소 모두 public; 기존 S6 journal/WMI process inventory Workflow는 private 전용. 설치 증거 SHA `d3764580fdb08ecddd5f9b1064051eec30f90492`의 `config/operations.json`에 해당 S6/WMI 직접 연산 없음. `controller/common.mjs::publicPcReportProjection`은 status와 고정 redacted code만 내보내며 로컬 원장 상세는 전송하지 않음. 기존 #4313 같은 공개 A 재실행은 필요한 증거를 회수하지 못함. 실제 Windows Owner/승인된 비공개 결과 회수 경로 확보가 남음. 보호조건 변경 없음.
- 신규 reopen 1건, 신규 close/merge/PC 요청/운영 변경 0. 현재 검색 Open 8건(영속 원장 4건), Open PR 0건. #4069/#4078/#3767 운영 증거와 #4135 대체 데이터 입력을 각각 분리.


## 2026-11-28 #3767 WMI 분리 관측 source 병합

- PR #4317, 정확 HEAD `eb9b4e3cd8d2ec8f5148523f18e44c581a5e448b`, 기존 Watchdog classifier 재사용, R3 원본 상태 유지, 동일 표본 JSON/TXT 고정 분류값 기록 및 직접 서비스 PID 관측 일치. 2파일만 변경. [Actions 46088307092](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46088307092) public-source-only SUCCESS, 통합 158/158 PASS, Windows skipped. squash `7d31c585a8805e686104ac4c3e2f459ce8a130cb`, 2파일 blob readback. #3767 OPEN: 실제 운영 승격 WMI 분류·계보 미확인, 기존 private 전용 Workflow/공개 summary-only 경계 유지. 신규 PR 병합 1건, PC/설치/DB/D1/Runner 변경 0. #4069/#4078/#4135는 별도 미완료.


## 2026-11-28 독립 Owner S6/WMI 로컬 읽기 경로 통합

- [PR #4319](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4319) HEAD `1b25baf12c77925549f3ab3d4013f5bd4e090063`, [Actions 46088894859](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46088894859) public-source-only SUCCESS, 통합 159/159 PASS, Windows skipped. squash main `a879f8e81049cefce9a3733d0b88544923501c57`, 2파일 blob readback. `tools/s6-local-owner-readonly.mjs`는 기존 local S6 bytes/Watchdog WMI scanner 재사용, GH Owner/Windows OPERATOR ancestry/main source byte pin, 로컬 고정 enum·boolean만 출력. 운영 쓰기/공개 raw 원장/POST/lease/설치/재발행 0. 실제 PC 실행 전임.
- 병행 [PR #4318](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4318) main `edf29d1fe748fb542b30f4096c63d81d1c016447` #4069 Public A 등록 확인. 설치 후보 `66b8a66c...`는 별도 정확 운영 승인/설치/사후 pin 미확보, 기존 설치 증거 `d3764580...` 재사용. 새 A와 독립 로컬 상세 관측의 목적 분리, 중복 설치 금지.
- [#4078 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4078#issuecomment-7231108657). #4069 동시 종결 상태 closed/completed는 마지막 원본 댓글 `7231087788`의 설치 미완료·원본 성공 미입증과 상충. 원본 B의 polling/claim 때문에 성공 판정 또는 자동 재접수 없이 상태 불일치 보존. #4078/#3767 OPEN. #4135 독립 미해결. 다음은 기존 정상 checkout/독립 Windows Owner local-only entry 1회 관측, 실제 로컬 결과 기반 정합 및 정규 A 설치와 중복되지 않는 조치. 새로운 원본 S6 실행 금지.


## 2026-11-28 09:38 KST — R4 후속 종결 근거 및 #4319 CI 정합

- #4166/#4167은 각각 [폐기 종결 근거 #7226364996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4166#issuecomment-7226364996), [#7226363511](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4167#issuecomment-7226363511)에 따라 closed/not_planned. 동일 실패 HEAD 72f3e640276bcf1a6998dcf62a817ba52e84fd05의 PR #4162 미병합 폐기이며 원본 CI FAIL 보존. 이전 파일 404를 해결되지 않은 main 결함으로 해석하지 않고 후보를 재생성하지 않음.
- #4319 merged=true, 정확 PR HEAD 1b25baf12c77925549f3ab3d4013f5bd4e090063, main 병합 a879f8e81049cefce9a3733d0b88544923501c57. [Run 46088894859](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46088894859) public-source-only Job 140804892734 원본 로그에서 신규 S6 local readback 회귀 ok 159 및 159/159 PASS, fail 0 확인. Windows source-only SKIPPED, C996/Secret Scan 해당 PR 실행도 SKIPPED. 고정 독립 Windows Owner 읽기 전용 source 통합이며 실제 PC 실행/역사적 승격/설치/재발행 증거 아님.
- #4069 원본 GitHub state=closed/completed(00:36:41 UTC), 최신 #7231087788은 신규 3파일 selective 후보 66b8a66c6112441576917e0ac9fbe4d39cbd5eea의 설치 미완료 및 OPEN이라는 설명과 상충. 원래 RECOVERY_REQUIRED 및 별도 6 Runner 복구 기록 보존, 현재 closed를 원래 S6 성공으로 집계하지 않음. 원본 상태는 추가 완료 근거/기존 담당의 종결 범위를 확인하기 전 임의 재변경하지 않음.
- #4078 open/reopened: #4312 source 병합 유지, backlog replay 효과 승인·독립 인증 포트 및 실제 원장 CAS/결과 미확인. #3767 open: #4317 source 병합 및 #4319 source-only 읽기 경로는 실제 승격 WMI 증거 아님. #4135 open: 비-MarketParquet 전체시장 적법 원자료·새 효과 승인/정규 설치 미확보. 원본 요청 재실행 0.
- 두 저장소 검색 반환: pc-control OPEN 7건(3개 운영 추적+4개 영속 원장), zgmini OPEN 0건; 양쪽 OPEN PR 0건. 검색 결과 범위 한정. 담당 루트 브랜치 main 대비 ahead 36/behind 3754(쓰기 전), 이력 재작성 없음. 신규 직접 소스 수정/테스트 실행/병합/종결/운영 변경 0, 타 담당 완료 증거는 신규 실적 미집계.
- 다음 실행: 기존 독립 Owner 로컬 읽기 경로 #4319의 실제 고정 소스 및 Windows 인증으로 journal/WMI 결과를 회수할 수 있는지 확인; #4069의 기존 3파일 후보 설치는 정확 승인·CI/정규 B 포트 확인 후에만 진행. #4078 별도 replay 승인 없이 POST 금지. #4135 적법 입력 확보 전 기존 공급처 재사용/재설치 금지.


## 2026-11-28 #4323 공통 S6 원장 projection 재사용

- PR #4323 HEAD `fd5bb716069432c0b75f033d239a80378e805bbf`, [Run 46089786773](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46089786773) public-source-only SUCCESS, 159/159 PASS, Windows skipped. squash `a561b739a45ec17ee887c1e7c29305d2ebc00343`, main source blob 일치. 기존 local projection의 legacy window/replays 부재/상한 불일치 수정, #4318 공통 함수 재사용 및 source closure pin. 운영 변경 없음.
- 병행 #4321 승인 및 #4322 exact Owner B operator/public A successor pin 병합 확인. [#4069 원장](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4069#issuecomment-7231192690): `66b8a66c6112441576917e0ac9fbe4d39cbd5eea` 실제 설치 및 readback 미완료. 중복 설치/원본 재접수 없음. 다음은 정확 승인 독립 Owner 실행 이후 고유 #4069 A job 및 JSON/TXT 결과 대조. #4078/#3767/#4135 운영 미완료.


## 2026-11-28 #4324 및 #4326 현재 설치 계보 확인

- [PR #4324](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4324) HEAD `ce900f8a63002a0f3410aecfa44b044e476b4a03`, [Run 46090285610](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46090285610) public-source-only SUCCESS, 유지보수 회귀 159/159 PASS, fail 0. squash `adfd7f954d5289923d185b359d26d780c7b37b48` 및 두 변경 blob readback 일치. 미종료 pause의 resumedAt 누락을 명시 null과 동일하게 판정. [#4078 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4078#issuecomment-7231280049). Windows source-only skipped, 원본 replay/설치/승인 변경 없음.
- 승인된 기존 selective target `66b8a66c6112441576917e0ac9fbe4d39cbd5eea`의 manifest/pin 두 blob이 승인 #4321 병합본과 현재 main에서 일치. 독립 Owner 실행기 의존 6파일도 #4322 병합본과 main 일치. updater는 이동하는 main의 파일이 아니라 고정 selective.mainSha에서 승인 bytes를 검사한다. #4324 후속 수정은 승인 target에 포함되지 않으며 이를 소급 적용하지 않는다. 기존 승인 효과는 보존, 설치·lease·실제 Owner 인증은 미확인.
- 병행 자동화 담당 [PR #4325](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4325) HEAD `8c5323bd7d68da6e2e6ac60e0b5edd16ed6f66fa`, [Run 46090349868](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/46090349868) public-source-only SUCCESS. 로그에서 effect key 신규 부정 5/5, 통합 74/74 PASS. 병합 `d9114b2156f6415930dc1f5e439bd5cb613622b2` 확인. 다른 담당의 병합으로 직접 실적에 포함하지 않음.
- 신규 승인 고정 A 조회 [#4326](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4326) 생성·readback 확인. 목적은 #4321/#4322 승인 이후 현재 실제 Controller 설치 SHA 확인이며 과거 S6 실행 또는 신규 설치 명령이 아니다. requestId `pc-issues-s6-install-readback-20261128-01`. 기존 요청 결과 대기 중; 같은 ID 재발행 금지. 실제 결과에 따라 고정 #4069 A 지원 여부 판단. #4069의 closed/completed와 RECOVERY_REQUIRED 이력 불일치, #4078/#3767/#4135 미완료 유지. 원본 B 재접수·Windows 쓰기 0.
