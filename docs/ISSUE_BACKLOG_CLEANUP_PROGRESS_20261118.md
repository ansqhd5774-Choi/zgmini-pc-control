# ZGMINI GitHub Open 이슈 누적 정리 진행 원장 — 2026-11-18

- 담당 브랜치: `codex/issues-lifecycle-manager-20261118`
- 기준: [ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md](ISSUE_LIFECYCLE_MANAGEMENT_STANDARD_20261118.md) R1
- 우선순위: **기존 Open 이슈 처리 → 분류되지 않은 원본/차단 증거 조사 → 신규 자동 종료 기능 개발**. 코드 개선을 기존 누적 정리의 선행 조건으로 만들지 않는다.
- 관측 기준: 사용자 최초 화면 Open 1,198 / Closed 19(이전 시점). 이번 조사 중 별도의 #2094 종료 등 타 작업 변경이 있었음. 최신 GitHub `is:issue is:closed` 검색으로 **48건 전부 조회되었고**, 아래 이번 28건 전원이 그 목록에서 재확인됨. 정확한 실시간 Open 전체 건수는 100건 검색 제한 때문에 아직 미확정이며 **추정치를 확정값으로 표기하지 않는다**.
- 변경 효과: GitHub 이슈 상태 28건을 `closed/completed`로 갱신. PC/Controller/Runner/DB/D1/예약/source 변경 0건, Issue 삭제 0건, 원본 실행 재요청 0건.

## 1. 이번에 실제 Closed한 28건

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

## 2. 확인했지만 닫지 않은 사례

| Issue | 실제 확인 | 보존·후속 |
| --- | --- | --- |
| [#4](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/4) | Run 41447178996 PASS 및 TXT 존재, **원격 JSON 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지. 기존 결과 게시/원장과 대조 |
| [#6](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/6) | Run 41447183444 PASS 및 JSON 존재, **원격 TXT 404** | `STATE_UNKNOWN/RESULT_PAIR_INCOMPLETE`; Close 금지 |
| [#8](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/8) | `FAIL/ENOENT` | 후속 조치 확인 전 Close 금지 |
| [#9](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/9) | 의도된 실패 fixture `FAIL/CONTROLLED_FIXTURE_FAILURE` | fixture 성공 판정/결과 인수 확인 전 자동 종료 금지 |
| [#10](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/10) | `FAIL/JOB_EXECUTION_TIMEOUT` | timeout 결과와 후속 확인. PC 재실행 금지 |
| [#12](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/12) | `BLOCKED/OPERATION_NOT_ALLOWED` | 보호 거부 자체가 요구한 시험인지 원담당 인수 후 개별 판정 |
| [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) | 공유 Controller 중앙 원장, 다수 조정 댓글 | 영속 조정 원장으로 유지. 일괄 Close 금지 |

## 3. 다음 필수 작업

1. [#40](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/40)부터 **기존 Open 작은 번호 순서**로 조회하고, 조회용 실행 PASS/JSON/TXT 증거가 온전한 단회 요청만 안전 종료.
2. 결과쌍 결손(#4/#6)은 기존 Run/댓글·결과 게시 저장소를 읽기 전용으로 대조. 한쪽이 없어도 실행을 재시도하거나 성공으로 위장하지 않는다.
3. 실패/차단(#8/#9/#10/#12)은 원담당의 실제 처리·후속 이슈 확인 후 별도 정리. Core/실행기 오류를 이슈 담당자가 임의 수리하지 않는다.
4. 같은 작업의 원격 결과를 반복 검사하지 않도록 이 원장과 Close 상태를 재사용하고, 정리 결과가 충분히 축적된 뒤 신규 요청 자동 Close를 개발한다.
5. 완료 시 실제 `open/closed` 건수와 이번 `closedReadbackVerified` 건수, 진짜 미해결·보류 수를 별도 보고한다.
