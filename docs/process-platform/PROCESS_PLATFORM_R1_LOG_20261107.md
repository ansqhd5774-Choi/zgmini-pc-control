# ZGMINI 공통 실행 효율화 R1 — 실행·증거 원장

> 2026-11-07 KST 착수. 이 문서는 **신규 R1 진행 기록**이다. 과거 5건의 완료율 80%와 합산하지 않는다.
>
> 중앙 Issue [#526](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/526) · Draft PR [#527](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/527) · [계획서](PROCESS_PLATFORM_R1_PLAN_20261107.md)

## 0. 판정 방법

- M0~M4 각각 20%. **증거가 있는 DONE만 반영**. M0+M1+M2 DONE = 신규 프로젝트 **60%**, M3~M4는 단계 미완료.
- 각 단계: `상태 / 이전 PASS / 첫 미완료·오류 / 근거(원본 링크·관측시각·SHA) / 실제 PC 실행·설치 효과 / 담당 / 다음 한 행동`.
- `STATE_UNKNOWN`을 PASS로 바꾸지 않음. 기존 성공은 업무 완료 재검증이 아니라 선행 증거로 재사용.
- 원담당에게 남긴 GitHub 기록은 실제 수신 ACK가 아니다. 별도 일반챗의 기능 재개는 주장하지 않음.

## 1. 신규 R1 체크포인트

| 시점(KST) | 단계 | 상태 | 이번 수행/증거 | 실제 효과 | 다음 실행 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-07 | M0 | **DONE** | 기준 `codex/controller-ops-lessons-20261105`→전용 `codex/controller-process-platform-r1-20261107`, 프로젝트 계획, 이 원장, Issue #526, Draft PR #527 | **소스 문서·원장만 작성**. Controller/PC/DB/API/예약/게시 변경 0 | M1 현재 관측 경로의 읽기 가능성/실제 설치 여부 대조 |
| 2026-11-07 | M1 | **DONE** | 기존 A·quota ledger·fetch-wrapper와 PR #524 현재 11/11 상태 비교. FILE_INVENTORY/LOGGED_FETCH/SAVED_CHECKPOINT/ACTIVE_RUNTIME을 구분하는 단일 계약 확정 | 실제 Windows 실행 **없음**, 수집기 하루 1 GET 보장·설치 **미확인** | M2 공통 소비자가 확인될 때만 집중 구현 |
| 2026-11-07 | M2 | **DONE (코드·검토·격리)** | 최신 main 기반 전용 구현 브랜치, [Draft PR #537](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537) 4파일: helper+기존 Alpaca/asset R10 A 2개 소비자+새 테스트. 19/19 PASS, 독립 검토 회귀 1건 수정 뒤 통과 | 운영 PC·Controller·API·DB·예약 0, Windows smoke/실제 효과 미검증 | M3 Windows·배포 정확 manifest 검증 |
| 2026-11-07 | M3 | **사전 조사 DONE / 단계 미완료** | `tools/update.mjs` 전체 diff+allowFiles exact·목표 전체 트리 교체 확인. #445/#449/#454/#476 정상 순차 B, 마지막 실측 Controller SHA `0492f6f5…` | 본 조사 Windows 교체 0, 마지막 실측 이후 변경은 별도 재확인 필요 | 실제 적용 후보가 있을 때만 #68 조정·격리 시뮬레이션 |
| 미시작 | M4 | **DEFERRED** | 실제 재개·운영효과의 신규 증거 없음 | 0 | 앞 단계 결과 후 |

## 2. M1 첫 진단 — 기존 소스의 능력과 한계

| 확인대상 | LAST PASS / 실제로 확인된 것 | FIRST GAP / 증명되지 않은 것 | 처리 |
| --- | --- | --- | --- |
| `tools/automation-status.mjs` ([main](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/tools/automation-status.mjs)) | 고정 E: 경로의 설치 파일 해시, Supervisor·Runner, 설치 operation, 유지보수 상태를 읽기 전용 요약하도록 작성되어 있음 | **일반 pc-job allowlist에 없음**; 이 채팅에서 현재 PC 설치/실행 여부 확인하지 않음 | 설치/접근 구분. 기존 수단 재사용 가능성 검토 |
| `controller/operations.mjs` 및 `config/operations.json` ([main](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/config/operations.json)) | 고정 A operation과 리소스·실행기가 분리되어 있음. `release-calendar-runtime-readonly` 및 `market-calendar-er1-saved-status` 등록 | 등록되지 않은 경로/임의 코드 호출 불가; 날짜별 EarningsAPI 요청 수를 직접 반환하는 기존 op 확인되지 않음 | 신규 범용 파일 reader 금지, 필요한 최소 고정 어댑터만 검토 |
| [PR #524](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/524) | main 병합 완료, 파일 2개, 11/11 테스트; 후보 파일 메타데이터 + 고정 `collection-events.jsonl`의 KST 날짜별 fetch-wrapper 호출 관측, PC 미설치 | ACTIVE runtime 소스·모든 GET·내구성 checkpoint·일일 차단 증거 **없음**, 부분 로그 `STATE_UNKNOWN` | 원담당 PR 보존. 중복 코드 편집/전체 설치 Gate 금지 |
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

**M2 완료:** 실제 소비자 Alpaca quota/asset R10 A를 선택해 공통 고정 경로 바이트 reader를 구현하고 fixture 19/19 통과·독립 검토 회귀 수정. 코드 브랜치는 오래된 R1 문서 브랜치에서가 아니라 최신 main에서 분기한 Draft PR #537. #524의 feature reader는 손대지 않음.

**M3 적용 담당:** 실제 후보 변경과 승인 명세가 존재할 때 #68에서 설치 SHA→정확 목표 SHA의 누적 diff, 백업/lease/drain/6 Runner 연결을 검토한다. 지금 본래 기능 작업의 정상 A 조회에 전역 Controller 설치 Gate를 추가하지 않는다.

**현재:** 신규 R1 **60%**, 실제 PC/Controller/DB/API/예약 변경 0, 운영 효과 별도 미실증. 예약 검증은 본 작업 후속.

## 6. M3 격리 시뮬레이션 — 과거 승인 명세 대 누적 diff (2026-11-07)

검사 방식: 각 승인 manifest의 `installedSha→targetSha` GitHub compare에서 `controller/`·`config/` 변경 경로만 추출하여 manifest `allowFiles[].path`와 **정확한 집합 일치** 비교. 이번 비교 결과는 모두 300파일 상한 미만(최대 152파일)이며 실제 PC·유지보수기 실행은 없음.

| 기존 설치 기준→목표 | 전체 GitHub 변경 파일 | Controller/Config 변경 | 승인 목록 | 차이 | 원래 정규 B 증거 |
| --- | ---: | ---: | ---: | ---: | --- |
| `69c83027→364c59b9` | 152 | 4 | 4 | **0** | [#445](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/445#issuecomment-6664737429) |
| `364c59b9→ac1f5c22` | 16 | 5 | 5 | **0** | [#449](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/449#issuecomment-6665207414) |
| `ac1f5c22→797f5a80` | 20 | 2 | 2 | **0** | [#454](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/454#issuecomment-6665766623) |
| `797f5a80→0492f6f5` | 26 | 3 | 3 | **0** | [#476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476#issuecomment-6685444328) |

**판정:** 경로 집합 4/4 PASS, 비교상 누락·추가 경로 0. `status=ahead`, `behind_by=0`으로 연결된 목표 SHA의 순차 적용 가능성을 뒷받침한다. 이 확인은 **manifest 경로 집합과 GitHub 역사에 대한 정적 비교**로서 각 파일의 실제 설치 바이트 재검증, 승인 자체의 유효성 재심사, Windows 백업/드레인/실패 복원 시험이 아니다. 운영 설치 성공은 각 기존 정규 B 원본 증거로만 보존한다.

**남은 M3:** 실제 새 변경의 installed/target SHA와 승인 범위가 정해질 때만 후보별 diff·해시·실패 복구 시나리오를 검증한다. 별도 신규 B는 만들지 않는다. M3 당시에도 신규 R1 완료율 **40% 유지**(M2 구현 전 정적 검사 시점).

**경계 입력의 정적 모의검사(실제 설치기 실행 아님):** 같은 4개 승인 명세 각각에 대해 ① 정상 경로 목록 4/4 일치, ② 허용 파일 1개 제거 시 4/4 불일치 감지, ③ 미승인 `controller/not-approved.mjs` 1개 추가 시 4/4 불일치 감지, ④ 설치/목표 SHA 체인 4/4 일치. 총 16개 조건의 로컬 집합·문자열 비교 통과. 실제 `tools/update.mjs` 호출, Windows rollforward/rollback, 파일 바이트 SHA256 재계산은 수행하지 않았다. 이 검사는 위험한 부분 설치를 합리화하지 않는다.

## 7. M2 구현·회귀 검증 결과 (2026-11-07 KST)

| 항목 | 실제 증거 | 상태/범위 |
| --- | --- | --- |
| 코드 저장 | [최신 main 기반 M2 Draft PR #537](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537) · 코드 브랜치 `codex/controller-process-safe-read-r1-20261107` | 원격 4개 파일 재조회·로컬 동일 내용, 원래 #527 문서 PR 및 다른 작업자 PR 불변 |
| 기존 A 소비자 | `alpaca-quota-readonly.mjs` ledger, `asset-r10-source-readonly.mjs` 고정 config+2 source | 기존 기능별 상태·JSON 검증·쿼터 계산·SHA 출력 그대로 유지 |
| 신규 모듈 | `controller/fixed-readonly-bytes.mjs` | 고정 경로/verifiedRoot, size, symlink, realpath, FD inode/dev/mtime, short read. 호출자 승인/원문 비노출 유지 |
| 집중 테스트 | `node --test tests/fixed-readonly-bytes.test.mjs tests/alpaca-quota-readonly.test.mjs tests/asset-r10-source-readonly.test.mjs` | **19/19 PASS (Linux Node 24)**; 실제 공급자 GET 0, DB/D1/예약/PC 변경 0 |
| 독립 검토 | FD open 후 크기 부적격의 기존 `ALPACA_LEDGER_SIZE_INVALID`→잘못된 `CHANGED` 코드 회귀 발견·수정, 추가 테스트 1건 | **조건부 통과**: Windows 경합·symlink·정상/실패 오류코드 smoke는 M3 |
| 원담당 #524 | [#524](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/524) `main` 병합 | 기존 KST fetch-wrapper 관측 추가. 실제 1 GET/day 보증/PC 설치 증거와 구분 |
| 설치 충돌 방지 | 현재 R1 문서 브랜치가 main에서 크게 분기. M2는 최신 main 기반. 코드 PR 네 파일만 변경 | 운영 Controller 설치 전 다시 실제 installed SHA·누적 diff 승인 정합성 확인 |

**M2 확정 완료 범위는 소스·격리 테스트·독립 검토까지**다. Linux fixture 성공만으로 Windows 파일 경합 안전성 또는 정상 사용자의 수동 개입 감소를 주장하지 않는다. 기존 정상 서비스는 변경 없음.

**다음 실행(M3):** Windows A smoke가 실제로 필요한 변경만 #68 단일 적용 담당과 조정. 기존 Controller 업데이트 전체와 B 작업을 회피·우회하지 말고, 새 승인 목표 SHA와 전체 changed controller/config 파일의 정합성을 검증한다. 병합·설치·M4 효과 실증은 미완료.

**현재 신규 완료율 M0+M1+M2=60%.** 기존 5건 4/5=80% 별도. 예약 검증은 모든 실제 작업 이후 후속.

## 8. M3 후보 배포 범위 분리·검증 통로 판정 (2026-11-07 KST)

**이번 단계 증거 판정: M3 RUNNING / 신규 프로젝트 60% 유지.** 실제 Windows 실행·설치·Provider GET·DB/예약/운영 파일 변경은 없음.

- **LAST PASS / 실제 PC 이전 상태:** [A #532](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/532)에서 실측된 설치 Controller SHA `0492f6f5bb16769e914ca85c63db119979fcf0a6`. 이후 설치 여부는 새 A 또는 정규 B 원장으로 재측정해야 하며 현시점 고정값으로 사용 금지.
- **승인 1차 목표:** [PR #535](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/535)의 기존 EarningsAPI 1파일 B 후보는 `af016444b2f87f11cd468428d9235cfc257d317d`까지 누적 Controller/config diff **`controller/release-calendar-runtime-readonly.mjs` 1개**. [main 승인 manifest](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/approvals/controller-updates/af016444b2f87f11cd468428d9235cfc257d317d.json)와 경로 일치. 설치 성공은 아직 확인되지 않으며 #68 단일 담당 작업을 우선한다.
- **M2 후보 2차 목표:** 승인 목표 `af016444…` → [#537 코드 Draft 현재 HEAD `e27be6d391d738f0d446664ab9f2ca457751f624`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537) 누적 Controller/config diff **3개**: `controller/alpaca-quota-readonly.mjs`, `controller/asset-r10-source-readonly.mjs`, 신규 `controller/fixed-readonly-bytes.mjs`. 마지막 확인 설치 `0492f6f5…`에서 Draft HEAD 직행하면 4개가 되므로 **1파일 승인 manifest로는 절대로 직행 불가**. #537은 아직 승인 manifest·main 병합·Windows 실증 없음.
- **분류 계약:** OLD=`0492f6f5…`(시점 제한 실측); TARGET_APPROVED=`af016444…`(아직 설치 미확인); TARGET_CANDIDATE=`e27be6…`(Draft/미승인); OTHER=`#537` 고정 3파일(기존 1파일 manifest 밖); MISSING=`#537` 승인 manifest와 Windows 실행 증거; UNKNOWN=`#535` 후의 실제 PC SHA. 설치·목표 누적 비교는 GitHub compare(95파일/9파일 중 Controller/config 1/3)로 확인했으며 다른 경로의 허용 여부까지 포괄 승인하지 않았다.
- **경합:** [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)의 기존 단일 B lane은 #535 준비 중. #537의 3파일은 #535와 직접 경로 중복 없음. 순차 전환 시 이전 작업의 실제 설치 완료·원장·보호/백업·Runner 재연결을 확인하고 다음 승인 manifest를 새 실측 SHA로 구성해야 한다.
- **Windows 시험 경로:** 현행 `pc-job`은 설치된 고정 `entry.mjs`만 실행; `runner-smoke`/기존 A/`source-audit`는 #537 후보 코드를 실행하지 않음. `theme-common-tests`는 별도 승인된 정확한 source/fixture만 실행. 일반 PR Windows 격리 smoke의 기존 승인 경로 **미확인**. 따라서 `WINDOWS_SMOKE_PENDING`, 우회 workflow·임의 CMD·B 생성 금지.
- **M3 테스트 착시 수정:** #537의 기존 Linux 19/19에는 Windows `fs.symlinkSync` 권한거부 시 해당 테스트 callback `return`으로 symlink 및 뒤따른 root 탈출 검사가 생략되더라도 PASS 가능성이 있었다. 같은 PR의 테스트 파일을 분리하여 root 탈출 검사는 항상 독립 검사, Windows 권한 제한은 `t.skip('SYMLINK_UNVERIFIED…')`로 명시. 변경 후 **Linux Node v24.22.1 21/21 PASS, skip 0**. Windows 실증은 여전히 0; Windows 실행 시 PASS 숫자와 별개로 symlink skip=0 확인 필수.
- **복구/전환 시험:** 기존 `tests/maintenance-apply.test.mjs`, `tests/interrupted-rollback.test.mjs`, `tests/maintenance-contract.test.mjs`에 보호·검증된 백업·복구 시나리오가 존재함을 소스로 확인. **이번 차례 직접 실행/Windows 전환 실패·복구 시험은 수행하지 않음**. M3 전체 완료 증거로 승격하지 않음.

**FIRST GAP:** #535 정상 B 완료 SHA, #537의 승인/Windows 격리 smoke 실행 경로, 새 3파일의 승인 manifest·복구 검증이 아직 없다. **다음 필수 행동:** #68에서 #535 자연 적용의 완료 상태를 확인한 뒤 #537 범위·검토·Windows 시험의 승인 경로를 조정하고, 정확한 실제 설치 SHA에 맞춘 #537 manifest/격리 복구 시험을 준비한다. 원담당의 독립 기능 진행을 멈추지 않는다.

### M3 격리 회복·배포 계약 실제 테스트 — 추가 증거

- GitHub `main`의 `tools/maintenance-contract.mjs`(blob `0b1dca5f…`), `tools/maintenance-apply.mjs`(blob `dd671e38…`), `tests/maintenance-contract.test.mjs`, `tests/interrupted-rollback.test.mjs`를 **격리 임시 경로에 정확히 복사**하고 Node **v24.22.1**로 실행.
- 명령: `node --test --test-skip-pattern='regular maintenance updater uses scoped gate' tests/maintenance-contract.test.mjs tests/interrupted-rollback.test.mjs`. **선택 실행된 34/34 PASS, fail 0, skip 0**. 누락/잘못된 승인 경로·고정 installed SHA·사후 보호 상태·실패 전/후 구분·중단 rollback·미검증 백업·재연결/작업 접수 보호 시나리오 포함.
- 제외 1건은 `tools/update.mjs` 전체 소스 정적 검사에 의존하는 별도 테스트. **전체 유지보수기/Windows 통합 테스트 PASS로 주장하지 않음**. 포트 mock·계약 fixture 테스트이며 실제 PC 백업·설치·복구 호출 0.
- 위 결과로 백업/복구 계약의 Linux 격리 회귀 근거를 확보했으나 **실제 #537 승인 manifest 부재, Windows 신규 reader smoke 미실시, #535 운영 적용 상태 미확정**이어서 M3를 DONE으로 승격하지 않음. 진행률 **60% 유지**.

## 9. M3 실제 기준 전진 — 정규 B #538 완료·3파일 후보 고정 (2026-11-07 KST)

**새 외부 완료 증거:** EarningsAPI 원담당이 정규 B [#538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/538#issuecomment-6691090423)에서 고유 `pc-update-cb732e7e-2827-44e3-9d1c-e1de0179d0ed`를 실제 실행했다. `STATUS=SUCCEEDED`, `CODE=APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, `TARGET=ACTUAL=af016444b2f87f11cd468428d9235cfc257d317d`, `PROTECTED_STATE_UNCHANGED=true`, `WORKFLOW_ENABLED=true`, `REPORT_UPLOAD=VERIFIED`, `RECOVERY=NONE`. 이는 **#535 1파일 적용 성공**이며 #537 코드 설치 증거가 아니다. [결과 JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/maintenance-pc-update-cb732e7e-2827-44e3-9d1c-e1de0179d0ed.json).

- 총괄은 실측 설치 기준을 이제 **#538 완료 시점 `af016444…`**으로 갱신. 기존 #532 `0492f6f5…`와의 1파일 차이는 성공 설치 증거로 충족. 이후 새 B가 있었는지는 실제 적용 직전 확인.
- 후속 #537 immutable 개발 HEAD `e27be6d391d738f0d446664ab9f2ca457751f624`까지 GitHub compare: **전체 9경로 / Controller-config 3개**, upstream ancestor/ahead 8. 코드 파일 3개의 GitHub blob과 로컬 `git hash-object` 3/3 일치; SHA-256은 새 [M3 비승인 후보 명세](M3_537_CONTROLLER_DELTA_CANDIDATE_20261107.md)에 파일별 고정.
- OLD=`af016444…`(정규 B 실설치); TARGET_CANDIDATE=`e27be6d…`(Draft); OTHER=`r17-sip-b/` 3개, `results/` 2개, `tests/` 1개(Controller-only stage에 포함 안 됨); MISSING=`#537` main 병합 SHA/승인 manifest/Windows isolated 실행 경로; UNKNOWN=`#538` 이후 실시간 변경 및 공유 lease(적용 직전만 측정).
- 별도 원담당은 [A #540](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/540) `pc-dd8ebabd-0022-4b2c-9886-308058ed9357`를 이미 접수. 조회 시 결과 댓글 0이므로 **신규 A 생성 금지**, 정확히 #540 결과만 원담당이 회수.
- Windows 경로 독립 검토: 일반 pc-job은 설치된 A 코드만 호출, 고정 SHA의 독립 개발 검증 실행기는 미확인. SHA pin/임시 workspace는 **권한 격리가 아님**. 제한된 Windows 사용자/VM·영향파일·테스트 재귀 import 검토·비밀정보 비주입·타임아웃 및 원본 무변경 확인이 선행돼야 한다. 기존 B 또는 임의 remote source 실행으로 우회하지 않음.
- 공용 담당에는 [#68 인계 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6691257448) **기록 완료**. 이는 설치 요청·타 담당 수신 ACK가 아님.

**M3 RUNNING / 전체 60% 유지.** 완료 조건은 #537 자체의 검증된 안전 Windows 시험 경로와 정확 승인 manifest·정규 보호 절차. 신규 Controller 설치 0(이번 총괄 작업), 공급자 API/DB/예약 변경 0. #535 B 성공을 총괄 신규 설치 성과로 계산하지 않는다.

## 10. M3 공통 업로드 결함 분리 — #540 REPORT_SIZE / Draft #545 (2026-11-07 KST)

- **분류:** 원담당 [A #540](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/540) 고정 읽기 전용 진단 자체 **PASS**; 공통 결과 전송 단계는 `REPORT_SIZE` **FAILED**. 원담당 기능 코드·EPS 완료·기존 `STATE_UNKNOWN` 상태 보존. 같은 A 재실행 금지.
- **원인/최소 수정:** pretty JSON 34,130B + TXT 1,130B > 32,768B. 데이터 삭제·한도 확대 대신 pretty가 초과할 때만 compact JSON으로 전송(실증 출력 재계산 24,800B + 1,130B = 25,930B). 두 직렬화 모두 넘으면 기존 `REPORT_SIZE` 유지.
- **구현:** 전용 개발 브랜치 [Draft PR #545](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/545) HEAD `aa581948949c01c7c391af812fe7064116a10ef0`. Controller 2파일, test 1파일. Linux Node 24 **14/14 PASS**, Controller 구문 검사 PASS, 2개 독립 소스 리뷰 중대 결함 없음. 신규 #545 소스 원격 반영 ≠ Windows 설치/기존 #540 결과 회수.
- **파일 바이트 및 누적 diff:** [정확한 후보 명세](M3_545_REPORT_DELIVERY_CANDIDATE_20261107.md). #538 B 당시 설치 `af016444…`→`main` Controller 1파일(원담당), →#545 HEAD Controller 2파일(업로드 공통), →#537 HEAD Controller 3파일(공통 읽기). 각 분리 브랜치를 임의 설치 목표로 사용하지 않고, 최종 병합 SHA 기준 전체 변경과 승인 manifest를 #68 담당이 조정.
- **FIRST GAP:** (1) #545 Windows 최소 권한 검증 경로/정규 설치 없음, (2) #540 기존 결과 포인터 보존/승인된 upload-only 회수 경로 미확인, (3) 설치 당시 이후 현재 SHA/공유 경합 적용 직전 확인 필요.
- **다음 필수 행동:** #68의 단일 담당에게 #545 후보 파일 2개와 해당 비완료 조건을 인계하고 실제 필요한 공용 적용에서만 누적 diff/정확한 승인·Windows 보호 경로를 확정. 원래 A·Provider 재호출이나 예약 검증은 만들지 않음.

**M3 RUNNING / 신규 R1 60% 유지.** 이 작업에서 PC Controller/DB/API/예약/게시 변경 0, 기존 작업자 기능 구현 대체 0.
