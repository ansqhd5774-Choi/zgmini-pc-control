# ZGMINI 독립 지원 6차 — #1372 Watchdog B 첫 실행 BLOCKED, 보호 상태 Drift 원인 식별 지원

**관측 기준:** 2026-11-15 KST · GitHub [#1372](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1372), [실제 Run 43631797304](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43631797304), [B source PR #1371](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1371), `main@1daca29218f396a1cad9e8cc9a32419888b290e3`.

**작업 소유권:** 기존 총괄/단일 운영 Owner가 Watchdog B 승인·실행·향후 Watchdog 자연 재기동·유지보수기 7→7·Controller B 설치를 계속 소유한다. 이 지원 담당은 **첫 운영 실패의 코드 분기 판정 및 최소 비민감 진단 도구만** 제공한다. 메인 소스, 승인, 원래 #1372 요청, Runtime PC/Runner/DB/D1/예약을 변경하지 않는다. 동일 Job 재실행 또는 신규 B 요청·Owner 변경을 지시하지 않는다.

## 1. 이번에 바뀐 사실: '실행 경로 없음' → '실제 첫 B 실행, 사전 보호 검사 BLOCKED'

1. [#1371](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1371)이 `da26caaa9ebe26a6c6f6fb1e8abcbfae3161972b`로 main에 병합되어 **정해진 기존 Windows Runner의 Watchdog B 파일 2개 staging** 경로가 생김. 유지보수기 7→7 자체 인계와는 권한/실행 분리.
2. 실제 인증된 기존 Issue **#1372**, `requestId=pc-watchdog-b-5ed1f075-428c-45d5-a610-14ce6ff082bf`로 Workflow Run **43631797304** 실행. checkout SUCCESS, B apply FAILURE, 기존 report step SUCCESS, 전체 workflow FAILURE.
3. [실제 JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/watchdog-b-pc-watchdog-b-5ed1f075-428c-45d5-a610-14ce6ff082bf.json)와 [원본 이슈 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1372#issuecomment-6882943633):
   - `status=BLOCKED`, `code=WATCHDOG_B_PROTECTED_STATE_DRIFT`, `writes=0`, `targetSha=d01229...`, `attempt=1`
   - **STAGED가 아님**, bridge 실PC 활성화 아님, 기존 Watchdog 자체 종료/교체 아님.
4. 실제 [`watchdog-b/upgrade.mjs@da26caaa` 102~104행](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/da26caaa9ebe26a6c6f6fb1e8abcbfae3161972b/watchdog-b/upgrade.mjs#L99-L125)에서 원본 `PROTECTION_BEFORE.json`과 동적으로 생성한 `protection()`을 `JSON.stringify`로 비교하다 에러를 던짐. **이 비교는** `owner/status` 조회, `upgrades` claim 디렉터리·단회 journal 생성, 백업 및 install 2파일 교체 **이전에 위치**함. 따라서 해당 분기에서는 Watchdog 설치 원본 변경 전에 중단한 것으로 소스와 `writes=0`가 일치.
5. 실제 전/후 보호 스냅샷 원본은 #1372의 sanitized 원격 JSON/TXT에 없음. **어느 보호 필드가 달랐는지 확인 불가**. source/hash ACL/Task/Writer 중 특정 원인을 확정해선 안 됨.

## 2. 원본 보호 범위 — 기존 코드 그대로 파악

`tools/install-runner-watchdog.mjs`의 `protection()`는 다음 기존 항목을 관측한다.

| 비민감 범주 | 원본 측정 | 변화가 의미할 수 있는 것 |
|---|---|---|
| `CORE_TASK_XML` | `ZGMINI-PC-Local-Core` Task XML raw SHA-256 | 실제 예약 Task XML 변화 또는 직렬화 차이 |
| `KOREA_TASK_XML` | `ZGMINI-PC-Local-Korea` Task XML raw SHA-256 | 같은 종류의 원본 변화 |
| `RETIRED_TASK_ABSENCE` | retired Iran 작업 부재 확인 결과 문자열 | 부재 보호 계약 불일치 또는 잘못된 스냅샷 |
| `WRITER_CONFIG` | Writer `config.json`이 존재할 때 원문 해시 | Writer 설정 변화 또는 파일 출현/소실 |
| `WRITER_QUOTA_SCRIPT` | `quota-runner.cmd` 파일 존재·해시 | 같은 종류의 변화 |
| `WRITER_LOCAL_SCRIPT` | `run-local.cmd` 파일 존재·해시 | 같은 종류의 변화 |
| `CONTROLLER_HOST_MANIFEST` | Controller `host.json` 파일 존재·해시 | Controller 호스트 메타데이터 변화 |

**분류에서 출처와 의미를 과장하지 않음:** `JSON.stringify(before)!==JSON.stringify(after)`는 값 변경, 파일 경로 추가/누락, 키 삽입 순서만 바뀐 경우를 구분하지 않는다. 이 가운데 **어느 사례가 실제 #1372에서 발생했는지는 증거 부족**.

## 3. 신규 지원 도구 및 격리 시험 결과

- [보호값 비노출 순수 비교기](../../tests/support/watchdog-b-protection-drift-audit.mjs)
- [synthetic-only 재현 시험](../../tests/support/watchdog-b-protection-drift-audit.test.mjs)

`compareWatchdogProtectionSnapshots(original,current)`는 다음만 반환한다:
`NO_DRIFT`, `PROTECTED_VALUE_OR_PRESENCE_DRIFT`, `ORDER_ONLY_SERIALIZATION_DRIFT`, `SNAPSHOT_INVALID`과 7개 **고정 범주 라벨**의 상태(`MATCH`/`VALUE_CHANGED`/`NEWLY_PRESENT`/`MISSING_FROM_CURRENT`/`ABSENT_BOTH`). 코드에는 파일 접근·Windows 명령·GitHub API·실 데이터 출력/업로드 기능이 없다. **원본 해시/Task XML/계정/개인 경로/토큰 값은 결과에 포함하지 않는다.** 

- GitHub에 저장한 실제 비교기/테스트 원문을 다시 가져와 V8에서 실행: **13/13 PASS**.
- 고정 정적 시험은 임시 합성 해시로 일치/6개 범주 변경/새 파일 출현/파일 누락/키 순서만 변경/필수 Task 증거 누락/잘못된 출처 데이터/비민감 결과만 출력 등을 분리.
- **이 13/13은 단지 비교기 자체의 논리/비노출 회귀 결과**. #1372 운영 원인을 특정했다거나 Watchdog B를 다시 실제 적용했다는 뜻이 아님.

## 4. 기존 운영 Owner에게 필요한 최소 하나의 정보

**질문:** 정확한 #1372 실행 시각과 동일한 보호 원본 기준에서, 어떤 범주가 `VALUE_CHANGED`, `NEWLY_PRESENT`, `MISSING_FROM_CURRENT`, `ORDER_ONLY_SERIALIZATION_DRIFT`인가?

원본 저장은 보호된 Windows에서 기존 승인 A/read-only 경로를 사용하고, 이미 존재하는 실PC readback이 있으면 **그것을 재사용**한다. 새로운 무승인 진단 명령·pc-job/수동 CMD·보호 파일 덮어쓰기·실DB/Task 수정은 금지. 공개 GitHub에 raw `PROTECTION_BEFORE.json`, 새 보호 해시 목록, Task XML, 민감 설정을 게시하지 말고 **허용된 범주와 변경 유형만** 인계한다. 지원 순수 함수는 승인된 실행 경로가 두 객체를 직접 전달받을 때만 참고 도구로 활용할 수 있음.

### 증거가 확보됐을 때 기존 Owner의 결정 트리(권고)

- **값 또는 존재 여부 진짜 변화:** 해당 범주의 변경이 기존 승인된 운영 변경인지 원본 Issue·설치/Task/Writer 로그와 비교. 승인되지 않은 변화면 원본 보호 및 자체 전이 중단을 유지.
- **승인된 과거 변경:** 무조건 `PROTECTION_BEFORE.json` 재생성/수정하거나 guard를 꺼 버리지 않는다. 승인된 새 baseline 계약·old/new 해시 pin·Owner/복구 경로를 별도 명시한 후 정규 B 진행 필요 여부 판단.
- **키 순서만 차이:** 원본 `JSON.stringify` 비교기의 표현 차이. 의미를 훼손하지 않는 canonical key 비교 및 기존 승인/적용 범위 검토 후보. 바로 PROD 코드 수정 금지.
- **스냅샷 부족/오류:** `SNAPSHOT_INVALID`로 기록하고 실증 없는 정상 판정·무조건 재실행 금지.

**중복·재실행 보호:** 최초 Issue #1372는 이미 1회 run, 결과 반환까지 끝났다. 동일 이벤트/요청을 다시 열거나 B Workflow 재실행하지 않는다. 기존 승인 계약을 통해 **새 원인 해결과 새로운 고유 실행 요청이 적격한지** Owner만 판정한다. `writes=0`은 해당 Watchdog B 2개 설치 파일 쓰기 0을 뜻하며, GitHub 보고서 출력까지 전혀 없다는 뜻이 아님.

## 5. 본 회차 완료와 후속

- #1372 실제 운영 결과·실행 Run·정확한 첫 실패 코드: **확인**
- 원본 실행 소스 단계 및 Watchdog 2개 파일 미교체 상태: **소스/원격 결과 대조**
- 보호 분야별 실제 mismatch 키: **미확인** (원본 전/후 스냅샷 미제공)
- 비교기 소스·격리 시험: **구현/13 PASS**, live 데이터 미접근
- 실Windows 업그레이드 재시도·Controller 설치·유지보수기 7→7·예약/Runner/DB/D1/Cloudflare 변경: **0건**.

**지원 다음 행동:** 해당 차이 범주에 대한 기존 운영 Owner의 읽기 결과를 기다리되, 단순 대기 대신 **원격 보고/승인 상태와 설치된 Watchdog 프로세스 상태를 구분하는 최종 증거 계약**을 독립 사전 준비한다. 기존 30/31차 총괄이나 W01~W07의 운영 실행/원본 결과 회수는 선점하지 않는다.

**판정:** `WATCHDOG_B_1372_BLOCKED_PRECLAIM / WRITES_ZERO / FIRST_FAIL_PROTECTION_DRIFT / CATEGORY_UNKNOWN / READONLY_COMPARISON_READY`.
