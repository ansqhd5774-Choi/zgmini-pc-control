# ZGMINI 공통 실행 효율화 R1 — 실행·증거 원장

> 2026-11-07 KST 착수. 이 문서는 **신규 R1 진행 기록**이다. 과거 5건의 완료율 80%와 합산하지 않는다.
>
> 중앙 Issue [#526](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/526) · Draft PR [#527](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/527) · [계획서](PROCESS_PLATFORM_R1_PLAN_20261107.md)

## 0. 판정 방법

- M0~M4 각각 20%. **증거가 있는 DONE만 반영**. M0+M1 DONE = 신규 프로젝트 **40%**, M2~M4는 단계 미완료.
- 각 단계: `상태 / 이전 PASS / 첫 미완료·오류 / 근거(원본 링크·관측시각·SHA) / 실제 PC 실행·설치 효과 / 담당 / 다음 한 행동`.
- `STATE_UNKNOWN`을 PASS로 바꾸지 않음. 기존 성공은 업무 완료 재검증이 아니라 선행 증거로 재사용.
- 원담당에게 남긴 GitHub 기록은 실제 수신 ACK가 아니다. 별도 일반챗의 기능 재개는 주장하지 않음.

## 1. 신규 R1 체크포인트

| 시점(KST) | 단계 | 상태 | 이번 수행/증거 | 실제 효과 | 다음 실행 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-07 | M0 | **DONE** | 기준 `codex/controller-ops-lessons-20261105`→전용 `codex/controller-process-platform-r1-20261107`, 프로젝트 계획, 이 원장, Issue #526, Draft PR #527 | **소스 문서·원장만 작성**. Controller/PC/DB/API/예약/게시 변경 0 | M1 현재 관측 경로의 읽기 가능성/실제 설치 여부 대조 |
| 2026-11-07 | M1 | **DONE** | 기존 A·quota ledger·fetch-wrapper와 PR #524 현재 11/11 상태 비교. FILE_INVENTORY/LOGGED_FETCH/SAVED_CHECKPOINT/ACTIVE_RUNTIME을 구분하는 단일 계약 확정 | 실제 Windows 실행 **없음**, 수집기 하루 1 GET 보장·설치 **미확인** | M2 공통 소비자가 확인될 때만 집중 구현 |
| 2026-11-07 | M2 | **RUNNING / 미완료** | PR #524·R17·Alpaca·asset R10 A의 고정 경로 안전 읽기 중복 확인. 형식·크기·상태 차이 때문에 범용 리더의 성급한 분리 보류 | 신규 코드·PC 0 | 실제 공통 소비자 1건·기존 테스트 파악 후 최소 계약/fixture만 구현 |
| 2026-11-07 | M3 | **사전 조사 DONE / 단계 미완료** | `tools/update.mjs` 전체 diff+allowFiles exact·목표 전체 트리 교체 확인. #445/#449/#454/#476 정상 순차 B, 마지막 실측 Controller SHA `0492f6f5…` | 본 조사 Windows 교체 0, 마지막 실측 이후 변경은 별도 재확인 필요 | 실제 적용 후보가 있을 때만 #68 조정·격리 시뮬레이션 |
| 미시작 | M4 | **DEFERRED** | 실제 재개·운영효과의 신규 증거 없음 | 0 | 앞 단계 결과 후 |

## 2. M1 첫 진단 — 기존 소스의 능력과 한계

| 확인대상 | LAST PASS / 실제로 확인된 것 | FIRST GAP / 증명되지 않은 것 | 처리 |
| --- | --- | --- | --- |
| `tools/automation-status.mjs` ([main](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/tools/automation-status.mjs)) | 고정 E: 경로의 설치 파일 해시, Supervisor·Runner, 설치 operation, 유지보수 상태를 읽기 전용 요약하도록 작성되어 있음 | **일반 pc-job allowlist에 없음**; 이 채팅에서 현재 PC 설치/실행 여부 확인하지 않음 | 설치/접근 구분. 기존 수단 재사용 가능성 검토 |
| `controller/operations.mjs` 및 `config/operations.json` ([main](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/config/operations.json)) | 고정 A operation과 리소스·실행기가 분리되어 있음. `release-calendar-runtime-readonly` 및 `market-calendar-er1-saved-status` 등록 | 등록되지 않은 경로/임의 코드 호출 불가; 날짜별 EarningsAPI 요청 수를 직접 반환하는 기존 op 확인되지 않음 | 신규 범용 파일 reader 금지, 필요한 최소 고정 어댑터만 검토 |
| [PR #524](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/524) | Draft, 파일 2개, 11/11 테스트; 후보 파일 메타데이터 + 고정 `collection-events.jsonl`의 KST 날짜별 fetch-wrapper 호출 관측, PC 미설치 | ACTIVE runtime 소스·모든 GET·내구성 checkpoint·일일 차단 증거 **없음**, 부분 로그 `STATE_UNKNOWN` | 원담당 PR 보존. 중복 코드 편집/전체 설치 Gate 금지 |
| [#520](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/520#issuecomment-6689594993) | 기존 ER1 점수 B `NOV30_ER1_D1_VERIFIED`, D1 재조회 해시 일치, 공급자 호출 0 | 하루 1 GET 검증 증거로 사용할 수 없음 | EPS 운영 완료 보존, 관련 없는 계산·게시 재실행 금지 |
| [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)와 공통 적용 규정 | SHA→manifest, 단일 적용 담당, lease, 원본 보호, 결과 회수의 지원 경로 | 부분 변경 패키지 지원·현재 설치 SHA는 대상 결정 전 **미확인** | 실제 적용 시만 정확한 SHA/승인 범위 확인 |

**추가 소스 확인(2026-11-07):** `zgmini/main/scripts/pc-writer/quota-policy.mjs`에 **EarningsAPI 공급자 등록이 없다**. `quota-ledger.mjs`는 등록 공급자만 영속 원장에 반영한다. `collect-local.mjs`의 공통 fetch wrapper는 호출 호스트를 기록할 수 있지만, PC 비공개 `earnings-api-local.mjs`가 해당 wrapper를 경유하는지는 이번 조사로 확인하지 못했다. 따라서 **공통 quota-ledger 요청 0회 = 실제 EarningsAPI 0회**라고 단정할 수 없다. 코드 기록만 추가했고 공급자 호출/PC 실행은 0회.

**진단 판정:** 실제 공급자 호출 실패·Controller 오류는 이번 소스 조사에서 발견되지 않았다. 관측 정보의 부족이 명확한 현재 개선 대상이며 운영 장애 `BLOCKED`로 확장하지 않는다.

## 3. 중복 방지·기존 과제 분리

- `#433/#435/#437/#442 = DONE`, `#434 = EFFECT_RUNTIME_PENDING`; 기존 4/5(80%) 그대로 유지. #434 자연 정상 B만 관찰하고 별도 테스트 B 금지.
- R54 V3/V4 E: 결과 TXT는 공통 Controller가 아니라 패킷 개별 하드코딩 원인. 백업 보존·출력 경로 분리의 **R54 원담당 소유**, 본 프로젝트에서 V4 재실행·패킷 전면 재작성 없음.
- EarningsAPI 하루 1 GET 내부 로직, EPS 산식·DB·게시 구현도 **원담당 소유**. 총괄은 공통 실행·관측 구조만 담당.
- 최신 GPT 프로젝트 지침과 main 정본은 별도 레이어; 이 브랜치의 문서 작성이 두 지침을 자동 반영하거나 다른 채팅을 깨우지 않는다.

## 4. M1 확정 계약 / M3 사전 판정

- **M1 확정:** 후보 파일 `FILE_INVENTORY_ONLY`, fetch-wrapper 로그 `LOGGED_FETCH_WRAPPER_CALLS_ONLY`, 별도 저장 checkpoint `SAVED_CHECKPOINT_ONLY`, 실제 프로세스가 사용하는 소스 `ACTIVE_RUNTIME_VERIFIED`는 독립 증거. 상위 수준으로 임의 승격하거나 누락을 PASS 처리하지 않는다. 하나의 고정·비민감 A 응답에서 출처/범위/시간/UNKNOWN을 설명한다.
- **M2 실제 공통화 후보:** PR #524, R17, Alpaca quota, asset R10 읽기 전용 A의 `lstat/realpath/symlink/용량/안정적 파일 읽기` 코드. 파일 타입과 범위가 달라 **두 번째 실제 소비자가 확인되기 전 범용 reader 리팩터링 금지**. PR #524는 원담당 소유.
- **M3 지원 판정:** 현재 `tools/update.mjs`의 installed→target 모든 controller/config diff와 manifest.allowFiles 완전일치, 전체 디렉터리 교체. 임의 1~2파일 발췌 설치 미지원(`ALLOWFILE_DIFF_MISMATCH`). 승인된 명세와 정확한 목표 SHA를 따라 순차 적용은 실증됨.
- **M3 실증 근거:** [정규 B #445](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/445#issuecomment-6664737429)(4파일), [#449](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414)(5파일), [#454](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623)(2파일), [#476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476#issuecomment-6685444328)(3파일). 전부 전체 diff에 대한 정확한 승인 후 정규 B 성공. 최신 마지막 정상 B 당시 Controller `0492f6f5bb16769e914ca85c63db119979fcf0a6`; **실시간 PC 현재값이라고 단정 안 함**. 유지보수기 별도 `4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4`.

## 5. 다음 필수 행동

**M2 총괄:** 기존 읽기 전용 A 중 공유 안전 읽기 코드의 실제 재사용 소비자를 선정하고, 사용자가 검증하지 않아도 될 `UNKNOWN` 경계 시뮬레이션을 좁은 fixture로 정의·실행한다. 실제 소비자가 없는 독립 모듈을 양산하지 않는다.

**M3 적용 담당:** 실제 후보 변경과 승인 명세가 존재할 때 #68에서 설치 SHA→정확 목표 SHA의 누적 diff, 백업/lease/drain/6 Runner 연결을 검토한다. 지금 본래 기능 작업의 정상 A 조회에 전역 Controller 설치 Gate를 추가하지 않는다.

**현재:** 신규 R1 **40%**, 실제 PC/Controller/DB/API/예약 변경 0, 운영 효과 별도 미실증. 예약 검증은 본 작업 후속.

## 6. M3 격리 시뮬레이션 — 과거 승인 명세 대 누적 diff (2026-11-07)

검사 방식: 각 승인 manifest의 `installedSha→targetSha` GitHub compare에서 `controller/`·`config/` 변경 경로만 추출하여 manifest `allowFiles[].path`와 **정확한 집합 일치** 비교. 이번 비교 결과는 모두 300파일 상한 미만(최대 152파일)이며 실제 PC·유지보수기 실행은 없음.

| 기존 설치 기준→목표 | 전체 GitHub 변경 파일 | Controller/Config 변경 | 승인 목록 | 차이 | 원래 정규 B 증거 |
| --- | ---: | ---: | ---: | ---: | --- |
| `69c83027→364c59b9` | 152 | 4 | 4 | **0** | [#445](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/445#issuecomment-6664737429) |
| `364c59b9→ac1f5c22` | 16 | 5 | 5 | **0** | [#449](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414) |
| `ac1f5c22→797f5a80` | 20 | 2 | 2 | **0** | [#454](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623) |
| `797f5a80→0492f6f5` | 26 | 3 | 3 | **0** | [#476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476#issuecomment-6685444328) |

**판정:** 경로 집합 4/4 PASS, 비교상 누락·추가 경로 0. `status=ahead`, `behind_by=0`으로 연결된 목표 SHA의 순차 적용 가능성을 뒷받침한다. 이 확인은 **manifest 경로 집합과 GitHub 역사에 대한 정적 비교**로서 각 파일의 실제 설치 바이트 재검증, 승인 자체의 유효성 재심사, Windows 백업/드레인/실패 복원 시험이 아니다. 운영 설치 성공은 각 기존 정규 B 원본 증거로만 보존한다.

**남은 M3:** 실제 새 변경의 installed/target SHA와 승인 범위가 정해질 때만 후보별 diff·해시·실패 복구 시나리오를 검증한다. 별도 신규 B는 만들지 않는다. 신규 R1 완료율 **40% 유지**.
