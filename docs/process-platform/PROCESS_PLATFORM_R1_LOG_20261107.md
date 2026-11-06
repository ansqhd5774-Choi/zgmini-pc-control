# ZGMINI 공통 실행 효율화 R1 — 실행·증거 원장

> 2026-11-07 KST 착수. 이 문서는 **신규 R1 진행 기록**이다. 과거 5건의 완료율 80%와 합산하지 않는다.
>
> 중앙 Issue [#526](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/526) · Draft PR [#527](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/527) · [계획서](PROCESS_PLATFORM_R1_PLAN_20261107.md)

## 0. 판정 방법

- M0~M4 각각 20%. **증거가 있는 DONE만 반영**. M0 DONE = 신규 프로젝트 **20%**, M1~M4는 현재 미완료.
- 각 단계: `상태 / 이전 PASS / 첫 미완료·오류 / 근거(원본 링크·관측시각·SHA) / 실제 PC 실행·설치 효과 / 담당 / 다음 한 행동`.
- `STATE_UNKNOWN`을 PASS로 바꾸지 않음. 기존 성공은 업무 완료 재검증이 아니라 선행 증거로 재사용.
- 원담당에게 남긴 GitHub 기록은 실제 수신 ACK가 아니다. 별도 일반챗의 기능 재개는 주장하지 않음.

## 1. 신규 R1 체크포인트

| 시점(KST) | 단계 | 상태 | 이번 수행/증거 | 실제 효과 | 다음 실행 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-07 | M0 | **DONE** | 기준 `codex/controller-ops-lessons-20261105`→전용 `codex/controller-process-platform-r1-20261107`, 프로젝트 계획, 이 원장, Issue #526, Draft PR #527 | **소스 문서·원장만 작성**. Controller/PC/DB/API/예약/게시 변경 0 | M1 현재 관측 경로의 읽기 가능성/실제 설치 여부 대조 |
| 2026-11-07 | M1 | **READY** | 첫 소스 조사: 현행 `tools/automation-status.mjs`와 `controller/operations.mjs`, `config/operations.json` 대조. 해당 상태 도구는 일반 `pc-job` 허용목록에 **등록되어 있지 않음** | 실제 Windows 실행 **없음**, 배포 여부 **미확인** | 아래 M1 액션 1 |
| 미시작 | M2 | **DEFERRED** | M1 최소 계약을 확정한 후 집중 구현/시험 | 0 | M1 완료 후 |
| 미시작 | M3 | **DEFERRED** | 실제 설치 SHA·#68 담당·선별 배포 지원 범위를 확인해야 함 | 0 | M2 설계/검증과 독립적으로 사전 조사 가능 |
| 미시작 | M4 | **DEFERRED** | 실제 재개·운영효과의 신규 증거 없음 | 0 | 앞 단계 결과 후 |

## 2. M1 첫 진단 — 기존 소스의 능력과 한계

| 확인대상 | LAST PASS / 실제로 확인된 것 | FIRST GAP / 증명되지 않은 것 | 처리 |
| --- | --- | --- | --- |
| `tools/automation-status.mjs` ([main](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/tools/automation-status.mjs)) | 고정 E: 경로의 설치 파일 해시, Supervisor·Runner, 설치 operation, 유지보수 상태를 읽기 전용 요약하도록 작성되어 있음 | **일반 pc-job allowlist에 없음**; 이 채팅에서 현재 PC 설치/실행 여부 확인하지 않음 | 설치/접근 구분. 기존 수단 재사용 가능성 검토 |
| `controller/operations.mjs` 및 `config/operations.json` ([main](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/config/operations.json)) | 고정 A operation과 리소스·실행기가 분리되어 있음. `release-calendar-runtime-readonly` 및 `market-calendar-er1-saved-status` 등록 | 등록되지 않은 경로/임의 코드 호출 불가; 날짜별 EarningsAPI 요청 수를 직접 반환하는 기존 op 확인되지 않음 | 신규 범용 파일 reader 금지, 필요한 최소 고정 어댑터만 검토 |
| [PR #524](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/524) | Draft, 파일 2개, 7/7 테스트(작업자 증거), PC 미설치; 후보 수집기 파일 메타데이터만 출력 | ACTIVE runtime 소스·일일 GET·checkpoint 동작 증거 **없음** | 원담당 PR 보존. 중복 코드 편집/설치 Gate 금지 |
| [#520](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/520#issuecomment-6689594993) | 기존 ER1 점수 B `NOV30_ER1_D1_VERIFIED`, D1 재조회 해시 일치, 공급자 호출 0 | 하루 1 GET 검증 증거로 사용할 수 없음 | EPS 운영 완료 보존, 관련 없는 계산·게시 재실행 금지 |
| [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)와 공통 적용 규정 | SHA→manifest, 단일 적용 담당, lease, 원본 보호, 결과 회수의 지원 경로 | 부분 변경 패키지 지원·현재 설치 SHA는 대상 결정 전 **미확인** | 실제 적용 시만 정확한 SHA/승인 범위 확인 |

**진단 판정:** 실제 공급자 호출 실패·Controller 오류는 이번 소스 조사에서 발견되지 않았다. 관측 정보의 부족이 명확한 현재 개선 대상이며 운영 장애 `BLOCKED`로 확장하지 않는다.

## 3. 중복 방지·기존 과제 분리

- `#433/#435/#437/#442 = DONE`, `#434 = EFFECT_RUNTIME_PENDING`; 기존 4/5(80%) 그대로 유지. #434 자연 정상 B만 관찰하고 별도 테스트 B 금지.
- R54 V3/V4 E: 결과 TXT는 공통 Controller가 아니라 패킷 개별 하드코딩 원인. 백업 보존·출력 경로 분리의 **R54 원담당 소유**, 본 프로젝트에서 V4 재실행·패킷 전면 재작성 없음.
- EarningsAPI 하루 1 GET 내부 로직, EPS 산식·DB·게시 구현도 **원담당 소유**. 총괄은 공통 실행·관측 구조만 담당.
- 최신 GPT 프로젝트 지침과 main 정본은 별도 레이어; 이 브랜치의 문서 작성이 두 지침을 자동 반영하거나 다른 채팅을 깨우지 않는다.

## 4. 다음 필수 행동 하나

**M1-1 / 담당: 프로세스 총괄 / 상태: READY.**

입력: 현행 `automation-status.mjs`·A operation allowlist·기존 fixed ledger/체크포인트의 출력 계약, #524 원담당이 이미 확보한 소스·운영 증거.

행동:
1. 필수 운영 관측 필드를 `기존 A로 즉시 가능 / 소스에 있으나 일반 A 미설치 / 원장 데이터 없음 / 미확인`으로 정확히 분류한다.
2. 그 결과로 **사용자 파일 제출과 불필요한 Controller 전체 업데이트를 피할 단 하나의 최소 관측 계약**을 고른다.
3. 대상의 원본·키·임의 경로를 출력하지 않는 격리 fixture 테스트를 정의하고 M2에 인계한다.

통과: 필요 필드·출처·기존 installed 여부·UNKNOWN 조건·변경 파일·담당이 표로 확정되고, 기존 정상 독립 기능의 추가 Gate가 생기지 않음.

지금은 위 정보를 위해 **새 pc-job/B 이슈를 생성하지 않는다**. 실제 설치/권한 검증이 필수로 바뀌는 단계에서만 기존 승인·고유 ID·#68 조정 절차를 사용한다.
