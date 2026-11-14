# W02 시장 캘린더 — Treasury 365일 마지막 5% A 원문 감사 단회 인계

**작성:** 2026-11-15 KST · 독립 지원자 · `SOURCE_ONLY / NOT_SUBMITTED`

> **역할 한정:** 시장 캘린더 원담당(W02)이 정상 승인 A 읽기 전용 작업을 최초 1회 실행할 때 필요한 입력/결과 계약만 제공한다. 이 문서가 새 실행/승인 Gate, 새 pc-job, 운영 설치, 원담당의 자동 실행을 뜻하지 않는다. 최초 요청 작성과 실행, 최종 100% 판정은 W02 원담당에게 남긴다.

## 1. 마지막 완료점 (재확인·재실행하지 않음)

| 이미 증명된 단계 | 재사용할 정확한 증거 | 이 증거의 한계 |
| --- | --- | --- |
| W02 실제 Treasury 365일 수집·로컬 저장·게시 및 2025-11 월간 UI | [W02 원담당 PR #1051](https://github.com/ansqhd5774-Choi/zgmini/pull/1051), [B #1132](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1132), [A #1135](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1135) | #1135는 `release-calendar-runtime-readonly`로 원문 저장 *행/해시*를 직접 출력하지 않았다 |
| 당시 D1 게시·공개 API 동치 | W02 PR #1051의 2026-11-09 증거: `D1 stored_at=1794255759536`과 공개 `updatedAt=2026-11-09T20:22:39.536Z` 일치 | 이 값/해당 날 낙찰 **436건**은 11/09 스냅샷 기준; 이후 날짜의 새 원본 값과 무조건 비교 금지 |
| 공통 Controller 15파일 설치 | [#1396](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1396#issuecomment-6884221298), [실제 B 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/maintenance-pc-update-a9ec72de-8191-42d7-a843-70061ab212ca.json) | 설치와 해당 개별 A 실제 실행을 구분 |
| Controller postcheck | [#1397](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1397#issuecomment-6884218522), [A JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/43641123734-1-seat-1.json) | `core-status PASS`만 실행; `source-inventory-runtime-readonly` 미실행 |

- 실제 설치 Controller SHA: `8e2736a62a90798afe159ef4d96a8713265ca021`.
- 운영 PC Core `config.source` 승인 SHA는 **별개**: #1397 당시 `05d7ae49e0a84cbeebd90ef4de6dd7284094bf97`. 과거 #1135 당시 `70d2d1...`과 혼동하지 않는다.
- 2026-11-15 조회 시 기능 저장소 `zgmini/main`: `643b7c7c4372ffad552443fc312c6cb1b944e2fc`. 이는 **조회 시점** 값이며, W02가 실제 신규 요청 시 기존 워크플로 규칙에 따라 branch head와 일치시키고 본 문서값을 영구 pin하지 않는다.
- [설치 target A 허용목록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/8e2736a62a90798afe159ef4d96a8713265ca021/config/operations.json): `source-inventory-runtime-readonly` **A/light, timeoutSeconds=60**. [정확한 Controller 분기](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/8e2736a62a90798afe159ef4d96a8713265ca021/controller/operations.mjs#L109-L114): `inspectSourceInventory(dataRoot)`. `mutationsEnabled=false`, 자동 재시도 0.
- 기존 #1023의 `OPERATION_NOT_ALLOWED`는 **과거 설치 Controller**에서 발생한 실패다. #1396 이후의 현 설치 판정 대신 재활용하지 않으며 그 요청을 재실행하지 않는다.

## 2. W02 담당자가 직접 한 번 사용할 pc-job 원문 구조

**아래는 템플릿이며 제출하면 안 되는 원본 예시다.** 원담당은 신규 요청이 이미 생성됐는지 기존 원장에서 먼저 확인해 존재하면 그 Issue/Run을 **재사용**한다. 없을 때에만 기존 승인 범위에서 자신의 실제 현재 `chatId`, 새 고유 `requestId`, 현재 승인된 `sourceSha`로 하나를 만든다. 원담당 아닌 독립 지원자는 이를 생성·실행하지 않는다.

```json
{
  "schema": "ZGMINI_PC_JOB_V1",
  "requestId": "pc-<새로운 UUID v4>",
  "chatId": "<W02 원담당의 현재 유효 chatId>",
  "operation": "source-inventory-runtime-readonly",
  "sourceRepository": "ansqhd5774-Choi/zgmini",
  "sourceBranch": "main",
  "sourceSha": "<실제 제출 시점의 해당 branch head SHA40>"
}
```

- GitHub `pc-job` Issue → 기존 `pc-job.yml` → **운영 PC** `zgmini-pc-01~06` → 설치 Controller로 단회 A. 격리 `DESKTOP-N62L0NG`나 유지보수기/Writer B로 대체하지 않는다.
- 이 operation은 **로컬 저장 메타데이터 조회**로 새 공급자 API 호출/원문 재수집/SQLite·D1 쓰기·Task 변경을 하지 않는다. **A 출력을 읽기 위해 365일 Provider 재수집을 시키지 않는다.**
- 기존 W02 [#1135 요청 schema](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1135)와 필드 형태 확인. 이 템플릿의 `<...>`은 유효 실행 값이 아님.
- 운영 인증 actor, 기존 승인·정상 PC lease/리포트 정책은 계속 적용되지만 이 문서 때문에 기존 기능 전체를 멈추거나 Controller/Watchdog/7→7 설치 검사를 다시 하는 것은 금지.

## 3. 한 번의 원격 결과에서 읽을 정확한 필드

1. **원격 결과 일치:** 원본 Issue `requestId` ↔ Actions `runId/attempt/seat` ↔ 원격 `results/<run>-<attempt>-seat-<seat>.json` 및 `.txt` **2/2**와 고유 원본 Issue 댓글. 실패하면 동일 requestId 재제출하지 말고 원본 업로드/댓글의 첫 실패만 좁혀 읽는다.
2. **상위 A 계약:** `operation=source-inventory-runtime-readonly`; `controlSourceSha/actualExecutionSha=8e2736...` (이후 별도 승인된 설치가 없다면); `status=PASS`, `code=SOURCE_INVENTORY_STORED_READONLY`, `firstFail=null`. `result.status=PASS`, `result.core.status=PASS` 확인. 오래된 `pcOperationalApprovedSha`를 Controller SHA로 비교하지 않는다.
3. **고정 private raw 1건:** `result.core.treasuryTawsInput`은 `status=OBSERVED`일 때에만 아래 해석 가능:
   - `storedAt` 숫자, `fromDate`/`toDate` 실제 날짜, `rawRowCount`, `storedAwardedCount`, `eligibleAwardedRows`, `eligibleCountMatchesStored`, `textBytes`, `textSha256` (64자리 소문자 hex).
   - **365일 목표:** 양끝 포함 `toDate-fromDate=364일`. 새로운 날짜의 저장이면 그 날짜에 해당하는 저장·게시 버전과 비교하고, 11/09의 436건/공개 행사 수 2,288건을 변동 없는 상수로 사용하지 않는다.
   - `eligibleCountMatchesStored===true` 및 양의 낙찰수·원본 해시/기간이 함께 확인될 때에만 **저장 원문에 대한 계수 감사** 충족.
   - `scope=ELIGIBLE_RESULT_COUNT_NOT_FULL_PARSER_REVALIDATION`: 이 A는 CUSIP·종목·공고/낙찰 세부 변환까지 다시 증명하지 않는다. 이미 정상 작동한 [W02 #1051](https://github.com/ansqhd5774-Choi/zgmini/pull/1051)의 parser/Writer 실제 증거와 **동일한 저장 기간 기준**으로 연결해 최종 판정한다.
4. **프라이버시:** 이 조회기는 원본문, 원래 JSON 행, CUSIP, 임의 DB 경로, token, 사용자 비밀을 출력하지 않는다. 회수는 집계·해시·날짜·상태만. 자료가 잘못됐다고 원문을 Issue에 첨부하거나 독립 지원자에게 전달하지 않는다.

**공통 착오 방지:** `source-inventory-runtime-readonly`는 `core.sqlite`와 `history.sqlite`를 각각 strict read-only로 연다. 기존 WAL 파일이 체크포인트로 제거되어 `-wal`/`-shm`가 없으면 `STATE_UNKNOWN/WAL_SIDECARS_ABSENT_UNVERIFIED`가 발생할 수 있으며 **데이터가 손상됐다고 결론내릴 수 없다**. Owner가 오로지 감사 완료를 위해 WAL 파일을 생성하거나 Task/Writer를 강제 구동해서는 안 된다.

## 4. 결과별 단일 다음 행동 (새 전역 Gate 없음)

| 새 원본 결과 | 분류 | W02 Owner가 이어서 할 일 |
| --- | --- | --- |
| PASS + `core.treasuryTawsInput.status=OBSERVED` + 기간 365일 + 건수 동치/해시 정상 + 기존 실제 게시 증거와 같은 버전 연결 | `FINAL_INPUT_AUDIT_REVIEWABLE` | **기존 성공 증거**와 원담당이 대조해 최종 5% 완료 여부 판단. 이 표 자체가 운영 100% 인증은 아님 |
| PASS + `status=NOT_STORED` | `PRIVATE_INPUT_NOT_STORED` | 해당 날짜·원래 저장 경로/기존 원장만 좁혀 확인. 과거 436건으로 빈 원문을 대신하지 않음 |
| PASS + `status=UNREADABLE_OR_INVALID` | `PRIVATE_INPUT_CONTRACT_INVALID` | 공급자 호출부터 다시 하지 말고 `toDate/sourceUrl/ratio` 등 코드상 고정 규칙과 기존 저장 기준의 첫 불일치만 Owner가 조사 |
| PASS + `eligibleCountMatchesStored=false` | `COUNT_DISAGREEMENT` | `storedAwardedCount`·`eligibleAwardedRows`의 차이만 남기고 100% 보류. 기존 원문/계산기 변경 금지 |
| `STATE_UNKNOWN` + `WAL_SIDECARS_ABSENT_UNVERIFIED` | `READONLY_ENVIRONMENT_UNKNOWN` | 손상으로 판정하거나 DB를 조작하지 않음. 기존 정상 Core 수명주기/후속 증거와 연결하되 무의미한 A 중복 실행 금지 |
| `BLOCKED` 또는 `OPERATION_NOT_ALLOWED` | `CONTEXT_GATE` | 같은 requestId 재발행 대신 원본의 실제 Controller SHA·허용목록·첫 실패 1개를 확인. #1023 옛 요청 반복 금지 |
| Run 실패/댓글 또는 JSON·TXT 일부만 존재 | `RESULT_INCOMPLETE` | 원본 결과 전달 경로만 확인. 동일 요청을 새 Issue로 자동 복제하지 않음 |
| `OBSERVED`인데 새 날짜·Core source와 기존 D1/API 기준일 다름 | `CROSS_PERIOD_COMPARISON_DENIED` | 저장일별로 같은 원본→게시 단위를 맞춰 검토. 이전 11/09 낙찰수·공개 화면 수를 현재의 고정 기대값으로 강제하지 않음 |

## 5. 사전 소스 계약 대조 (운영 영향 없는 독립 확인)

- 수집기 [`release-calendar.mjs` 기존 W02 브랜치](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/market-calendar-treasury-cache-private-code-r1-20261109/scripts/pc-writer/release-calendar.mjs)는 `release-calendar:treasury:taws` raw text를 `marketOperationalStore.writeInput`으로 **날짜 접미어를 붙여** gzip 저장, 읽기한 동일 `text`와 `awardedCount`를 검사한 뒤 parser를 사용한다.
- 공식 parser [`treasury-auction-history-taws.mjs`](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/market-calendar-treasury-cache-private-code-r1-20261109/lib/treasury-auction-history-taws.mjs)는 결측·`"null"` 비율을 제외하고 **문자열 숫자 형태**인 `bidToCoverRatio`만 낙찰로 인정하며, 나머지 CUSIP/날짜/종목 검증은 별도 수행.
- [정확한 설치 Controller의 감사 구현](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/8e2736a62a90798afe159ef4d96a8713265ca021/controller/source-inventory-runtime-readonly.mjs)은 같은 `bidToCoverRatio` 문자열 결과와 날짜 필터를 집계하되 **전체 parser 결과 동치 검사는 의도적으로 미실시**. 요약을 FULL_PARSER_PASS로 오인하면 안 된다.
- 해당 A는 `marketOperationalStore.readInput()`을 사용하지 않는다. 그 메서드는 초기화 과정에서 DDL을 실행할 수 있어 엄격한 비변경 검증과 맞지 않음. 고정 `node:sqlite` read-only/WAL preflight를 사용한다.
- **W02 입력 계약 자체를 변경해야 할 새로운 소스 결함은 이번 사전 조사에서 확정되지 않음.** 소스 변경과 신규 PR을 기계적으로 요구하지 않는다.

## 6. 사전지원 종료·인계

완료된 사전지원은 **Owner용 정확한 7필드 요청 구조, installed operation·dispatcher/source 교차대조, private row 결과 필드, 오류별 결론 제한, 시점이 다른 436건 오비교 방지**이다. 이 문서의 작성은 신규 운영 A 요청이나 최종 100% 판정이 아니다.

- **지원자가 수행하지 않은 것:** 운영 pc-job 발행/재발행, Workflow·Runner 가동, Controller/Writer/DB/D1/Cloudflare 변경, 원자료/보안파일 열람, 예약 변경, W02 장기 브랜치 또는 PR #1051 변경.
- **Owner 완료 트리거:** W02가 실제 최초 A 결과를 회수했을 때 해당 최초 실패(있으면 1개)만 지원자에게 인계하면 추가 환경 전체 진단 없이 정밀 원인 분석·최소 보완을 지원한다. A 성공이라면 별도 PR/코드 수정을 추가할 이유는 없다.
- **보고율:** W02는 최종 감사를 원담당이 실증하기 전까지 95%; ZGMINI 전체 여섯 기능은 마지막 확정 57.4% 유지.
