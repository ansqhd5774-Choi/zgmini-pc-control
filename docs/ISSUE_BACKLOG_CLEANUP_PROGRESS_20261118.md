# ZGMINI GitHub Open 이슈 누적 정리 진행 원장 — 2026-11-18

- 담당 브랜치: `codex/issues-lifecycle-manager-20261118`
- 기준: [ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md](ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md) R1
- 우선순위: **기존 Open 이슈 처리 → 분류되지 않은 원본/차단 증거 조사 → 신규 자동 종료 기능 개발**. 코드 개선을 기존 누적 정리의 선행 조건으로 만들지 않는다.
- 관측 기준: 사용자 최초 화면 Open 1,198 / Closed 19(시점성 과거 수치). 1차 완료 뒤 Closed 48건을 조회했고, 이번 2차 배치 뒤 Closed **81건**을 조회했다. GitHub 검색 응답의 Open 쪽은 100건 제한이 있어 실시간 Open 총수는 미확정이다.
- 변경 효과: 이번까지 GitHub 이슈 상태 전환 **누적 104건**(1차 28건 + 2차 33건 + 3차 43건). 운영 PC/Controller/Runner/DB/D1/Task/예약/source 변경 0건, Issue 삭제·PC 재실행 0건.

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
- 종료 후 GitHub `is:issue is:closed` 최신순 100건 목록에서 신규 **43건 전부 Closed 재조회 PASS**. 전체 Closed/Open 정확한 총계는 검색 조회 상한으로 미확정
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

## 4. 확인했지만 닫지 않은 사례

| Issue | 실제 확인 | 보존·후속 |
| --- | --- | --- |
| [#4](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4) | Run 41447178996 PASS 및 TXT 존재, **원격 JSON 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지. 기존 결과 게시/원장과 대조 |
| [#6](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/6) | Run 41447183444 PASS 및 JSON 존재, **원격 TXT 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지 |
| [#8](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/8) | `FAIL/ENOENT` | 후속 조치 확인 전 Close 금지 |
| [#9](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/9) | 의도된 실패 fixture `FAIL/CONTROLLED_FIXTURE_FAILURE` | fixture 성공 판정/결과 인수 확인 전 자동 종료 금지 |
| [#10](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/10) | `FAIL/JOB_EXECUTION_TIMEOUT` | timeout 결과와 후속 확인. PC 재실행 금지 |
| [#12](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/12) | `BLOCKED/OPERATION_NOT_ALLOWED` | 보호 거부 자체가 요구한 시험인지 원담당 인수 후 개별 판정 |
| [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) | 공유 Controller 중앙 원장, 다수 조정 댓글 | 영속 조정 원장으로 유지. 일괄 Close 금지 |

## 5. 다음 필수 작업

1. [#220](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/220) 이후 기존 Open 요청을 순서대로 검증한다. 별도 B급·수집·게시·등록 계약은 독립적인 실제 결과·효과 확인 전 종료하지 않는다.
2. 결과쌍 결손(#4/#6)은 기존 Run/댓글·결과 게시 저장소를 읽기 전용으로 대조. 한쪽이 없어도 실행을 재시도하거나 성공으로 위장하지 않는다.
3. 실패/차단(#8/#9/#10/#12)은 원담당의 실제 처리·후속 이슈 확인 후 별도 정리. Core/실행기 오류를 이슈 담당자가 임의 수리하지 않는다.
4. 같은 작업의 원격 결과를 반복 검사하지 않도록 이 원장과 Close 상태를 재사용하고, 정리 결과가 충분히 축적된 뒤 신규 요청 자동 Close를 개발한다.
5. 완료 시 실제 `open/closed` 건수와 이번 `closedReadbackVerified` 건수, 진짜 미해결·보류 수를 별도 보고한다.
