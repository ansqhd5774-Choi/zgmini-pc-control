# ZGMINI 공통 실행 효율화 R1 — 프로젝트 계획서

- 작성: 2026-11-07 KST
- 상태: **M0 DONE / M1 DONE / M2 DONE / M3 배포 범위 분리·시험 착시 수정, 본 단계 미완료**, 신규 프로젝트 60% (Windows/실PC 효과 미실증)
- 전용 브랜치: `codex/controller-process-platform-r1-20261107`
- 분기 기준: `codex/controller-ops-lessons-20261105` (기존 업무·완료 증거 보존)
- 운영 정본: `main`의 `AGENTS.md`, `docs/PC_AUTOMATION_STANDARD.md`, `docs/GENERAL_CHAT_START.md`, `docs/GENERAL_CHAT_PREWORK.md`
- 중앙 추적: [#526](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/526); 실제 Controller 적용 조정은 기존 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)
- 기록: [R1 실행 원장](PROCESS_PLATFORM_R1_LOG_20261107.md)
- 완료율 산정: 이 프로젝트의 M0~M4 **각 20%**, 완료 증거가 있을 때만 반영. 기존 프로세스 5건(4/5, 80%)과 합산 금지.

## 1. 목적과 성공 정의

작업자가 이미 승인받은 자기 기능의 다음 실행을 **불필요한 Controller 전체 검사/설치/사용자 수동 파일 전달 없이** 진행하도록 공통 프로세스·실행 수단을 개선한다.

구체적으로:
1. **공통 관측:** 필요한 대상의 실제 설치·실행·저장/호출 증거를 안전한 고정 A급 인터페이스로 읽고, 소스 해시/설치/운영 효과를 별도 판정한다.
2. **최소 범위 적용:** 실제 설치 SHA부터 목표 SHA까지의 변경을 정확히 나눠, 승인·보호 조건을 유지하면서 공유 Controller 배포 병목을 줄인다.
3. **작업 재개/인계:** 원래 요청의 LAST PASS/FIRST FAIL·담당·다음 한 행동을 기록하고, 독립 기능의 진행을 방해하는 허위 전역 BLOCKER를 제거한다.

성공은 문서·테스트 PASS만이 아니라 **선택한 대표 작업에서 불필요한 수동 개입 없이 필요한 증거를 회수**하고 정상 독립 작업이 계속됨을 확인할 때 인정한다. 진행률과 기능별 운영 성공은 분리한다.

## 2. 보존 대상·업무 경계

- 기존 5건: #433/#435/#437/#442 DONE; #434는 유지보수기 인계 PASS지만 신규 E: 보고 파일 0 운영 효과 미실증. **4/5=80% 보존**. #434 확인용 인위적인 B 금지.
- EarningsAPI: [#520](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/520#issuecomment-6689594993) `NOV30_ER1_D1_VERIFIED`은 기존 EPS 점수 게시·재조회 PASS(`providerCalls=0`)의 증거다. 하루 1 GET의 런타임 증거는 아님. [main 병합 PR #524](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/524) 2파일·관련 테스트 **11/11**, 실PC 미설치; 고정 `collection-events.jsonl`의 KST 날짜별 fetch-wrapper 로그 관측 기능도 추가됨. 단 이 기록은 비공개 수집기의 모든 GET·일일 차단·활성 설치를 증명하지 못함. PR #524를 중복 편집/병합하지 않는다.
- R54: V3/V4 일회성 결과 TXT가 E:에 기록되는 원인은 개별 패킷의 하드코딩. 복구 백업은 E:에 보존하고 출력은 템플릿/원담당 범위에서 조정. 성공한 V4 재실행 금지.
- 원담당: EarningsAPI·R54·R17·ER1의 수집/계산/게시/기능 코드 및 본래 설치 실행.
- 총괄: 공통 진단·조정·문서·통합 계약·프로세스 지표. 원담당의 기능을 대신 개발하거나 PC 운영 효과를 임의 선언하지 않는다.
- 공유 설치: #68의 **단일 적용 담당**이 실제 lease, 기존 유지보수기, 정확한 manifest·승인·백업·사후 Windows 검증으로만 시행.
- 민감 데이터/API 키/전체 설정·원자료 미출력, 외부 공급자 GET 0, 운영 Core/DB/예약/게시 변경 없음. 위험한 임의 shell·파일 경로 입력·승인 검사 우회 금지.

## 3. 대기업 공식 운영 원칙의 최소 적용

| 공개 사례 | 확인된 원칙 | R1의 적용 |
| --- | --- | --- |
| [Google SRE, Eliminating Toil](https://sre.google/sre-book/eliminating-toil/) | 수동·반복 작업은 장기 구조 개선 대상으로 관리 | 중복 진단, 사용자의 파일 제출, 잦은 중단을 측정해 공통화 |
| [Amazon Builders' Library, Automating safe deployments](https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments/) | 운영 도구·설정·코드 등의 안전한 배포 경로 분리 | 공유 변경을 배포 단위/담당 기준으로 분리; 무관한 업무 진행 허용 |
| [Microsoft Azure, Safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments) | 작은 변경·단계별 영향 제한·실제 상태 확인·복구 | 필요한 범위의 테스트/원본 보호/실행 효과 확인, 불필요한 전역 Gate 추가 금지 |

거대 인프라·Kubernetes·Docker·새 유료 서비스의 도입을 전제로 하지 않는다. ZGMINI 단일 PC와 현재 승인 도구를 우선 사용한다.

## 4. 확인된 현행 구조와 공백 — 2026-11-07 소스 조사

| 기존 수단 | 확인된 범위 | 미확인/공백 | 결정 |
| --- | --- | --- | --- |
| `tools/automation-status.mjs` | PC 고정 경로에서 Controller/유지보수기/Runner/lease/설치 operation 요약 | 일반 `pc-job` allowlist 등록·실설치 증거 없음 | **재사용 후보**, 기존 A 또는 원본 결과로 확인; 전역 건강 검사로 만들지 않음 |
| `release-calendar-runtime-readonly` | 출시 캘린더 source/checkpoint/후보 checkout 읽기 전용 A | EarningsAPI 날짜별 호출/체크포인트 및 실제 실행 연결 미확인 | 이 한계를 넘는 새로운 주장은 하지 않음 |
| main 병합 PR #524 | 후보 체크아웃 파일 메타데이터 + 고정 fetch-wrapper 로그의 최근 512 KiB/1024행/14일 KST 날짜별 관측; 11/11 테스트 | 단일 파일·부분 로그는 활성 실행/하루 1 GET 차단의 증거 아님. 누락·절단·비공개 bypass 가능성 `STATE_UNKNOWN` | 원담당 PR 보존. 수집기·날짜별 파서 중복 구현 금지 |
| `market-calendar-er1-saved-status` | 지정 과거 5일 입력·검증 개수·바인딩 지문 | 오늘 호출 ledger/런타임 요청 증거를 제공하지 않음 | 원래 기능 완료 증거 재사용; 신규 전역 진단으로 확대 금지 |
| `scripts/pc-writer/quota-ledger.mjs` + `quota-policy.mjs` (`zgmini` main) | 공통 provider quota 원장 및 요청 시각 저장 로직 존재 | 현재 공식 등록 공급자에 **EarningsAPI 없음**; 비공개 수집기의 실제 경로/이 원장 경유 여부 미확인 | 기존 원장만으로 하루 1 GET 입증 불가. 새 quota 정책을 임의로 추가하지 않음 |
| `controller/operations.mjs`+`config/operations.json` | 고정 operation allowlist·등급/자원·실행 어댑터 | 신기능 자동 로딩은 아님 | 임의 경로/스크립트 실행 없는 고정 등록 유지 |
| `tools/update.mjs` + #68 | 설치 SHA→목표 SHA 모든 `controller/`,`config/` 변경과 `manifest.allowFiles` 완전일치 후 목표 디렉터리 전체 교체 | **현재 일부 파일만 발췌 설치 불가**(`ALLOWFILE_DIFF_MISMATCH`). 실설치 SHA는 #476 정상 B 당시 `0492f6f5…` | 기존 A는 독립. 승인된 통합 manifest 또는 정확한 목표 SHA 순차 B. 검사/백업/드레인 우회 불가 |

## 5. 실행 단계와 완료 조건

| 단계/비중 | 수행 내용 | 완료 조건/증거 | 담당 |
| --- | --- | --- | --- |
| **M0 20% — 착수** | 전용 브랜치·계획·진행 원장·Issue/리뷰 PR 생성, 기존 증거 분리 | 각 GitHub 링크 재조회, 원본 브랜치 무변경 | 총괄 |
| **M1 20% — 공백 확정** | 첫 사례 #524의 필요 정보/현재 허용 A/원장/PC 접근 범위 차이표, 실제 공통화 가치 평가 | `현재 가능/미설치/불가능/미확인`과 경로·근거, 단 하나의 M2 최소 계약 | 총괄(원담당 증거 수신) |
| **M2 20% — 최소 공통 관측** | M1 증거 등급 계약 유지, 기존 A 2곳의 고정 파일 바이트 읽기 중복을 최소 공통 모듈로 격리·재사용; #524 날짜별 집계는 원담당 코드 재사용 | 새 helper·2개 A 소비자·집중 fixture, 기존 응답 계약 회귀 검사, 독립 검토, PC/API/DB 변경 0. Windows 설치·운영 효과는 M3/M4 별도 | 총괄(공통부) / 원담당(수집기 로직) |
| **M3 20% — 최소 변경 적용** | 누적 diff/승인·최종 바이트를 파일별 분리하는 배포 실행 명세/지원 범위 확인, 격리 시뮬레이션 | 승인 변경만 manifest, OLD/TARGET/OTHER/MISSING/UNKNOWN 분류, 경합·백업·전환 실패 시 원본 보존 검증. 실제 운영 적용은 #68에서 별도로 기록 | 총괄 설계 / 단일 적용 담당 |
| **M4 20% — 재개·효과 측정** | 원담당에게 정확한 문제/다음 행동 인계, 원본 증거로 재개·수동 개입·리드타임 측정, 필요한 공통 정본만 개정 | 실제 수신 확인과 진행 효과 구분, 전용 증거 링크, 불필요한 Gate 제거, 승인된 정본 변경 재조회 | 총괄 / 원담당 |

**실PC 효과 검증은 그 기능에 실제로 필요한 업무 흐름에서만 수행.** M2 코드·fixture 성공을 PC 설치로, M3 명세 완료를 운영 적용으로, M4 Issue 기록을 일반챗 자동 재개로 치환하지 않는다.

## 6. 관측 계약 — M1 확정

목표는 모든 경로를 임의로 읽는 범용 파일 조회기가 아니다. 기존 승인된 A operation 또는 고정 allowlist의 **등록된 관측 대상**에서 아래 최소 메타데이터를 추출하는 것이다.

- 공통: `schema`, `observedAt`, `targetId`, `evidenceLevel`, `operationSourceSha`(확인 가능 시), `actualInstalledSha`(확인 가능 시), `status/code`, `providerCalls=0`(진단기 자신의 호출량), `operationalWrites=0`.
- 변경 대상별: `fileIntegrity`, `effectiveSourceMatch`, `lastExecutionAt`, `checkpointAt`, `lastExecutionCode`; 확인 불가 시 정확한 `UNKNOWN`과 원인.
- 일일 호출 제한 검증의 경우: **기존 영속 원장에 실제로 존재하는 범위에서만** `date`, `recordedRequestCount`, `dedupState`, `ledgerContinuity` 출력. 기록이 없거나 수집기가 일일 한도를 실제로 적용하는지 불명확하면 `STATE_UNKNOWN`. 날짜별 수치가 정상적으로 존재한다고 가정하지 않는다.
- 비노출: 파일 원문·키·전체 설정·HTTP 요청 URL·원자료·임의 인자·임의 JS/SQL.
- 테스트: 반복 호출/같은 날짜/날짜 변경/중단 후 재개/수집 실패/원장 부재/다중 Runner 경합/경계 밖 symlink/기존 계약 호환. 기존 공통 테스트를 그대로 재사용하고 영향 범위를 좁힌다.

**확정:** `FILE_INVENTORY_ONLY` / `LOGGED_FETCH_WRAPPER_CALLS_ONLY` / `SAVED_CHECKPOINT_ONLY` / `ACTIVE_RUNTIME_VERIFIED`를 서로 구분한다. 한 등급의 PASS를 다음 등급으로 승격하지 않는다. 로그 부분/중단·활성 설치 불명·비공개 checkpoint 부재 시 `STATE_UNKNOWN` 유지. M2 공통화 후보는 여러 A 진단기의 고정 경로·symlink·용량 제한·안정적 읽기 계약 하나이며, 파일 형식이 달라 성급한 범용 reader 분리 대신 실제 두 번째 소비자가 확인된 경우에만 최소 모듈을 추출한다. #524의 기능별 파서는 건드리지 않는다.

## 7. 실행 기록·진행 지표

기록 단위: `날짜 / 단계 / LAST PASS / FIRST FAIL / 원본 증거·SHA·시간 / 코드·테스트 / PC 설치 여부 / 실제 효과 / 담당 / 다음 한 행동`.
상태는 `DONE`, `READY`, `RUNNING`, `STATE_UNKNOWN`, `BLOCKED`, `DEFERRED`로 구분한다.

운영 KPI는 이번 착수 시 **기준치 미측정**으로 보존한다. 초기 대표 사례 #524 및 다른 실제 공용 장애를 통해 `사용자 수동 개입 횟수`, `동일 진단 반복 횟수`, `Controller 때문에 멈춘 시간`, `PR→PC 적용 소요`, `원담당 다음 실행 완료율`을 관측 가능한 범위에서만 측정한다. 증거 없는 향상률·무중단 보장·가공된 수치 금지.

## 8. M1 완료 판정과 다음 실행 (2026-11-07)

**M1 완료 / 당시 신규 진행률 40%.** 기존 A, quota ledger, fetch-wrapper 로그와 비공개 EarningsAPI 수집기의 관측 공백을 확인하고 위 단일 증거 등급 계약을 확정했다. PR #524의 11/11은 소스 fixture 검증이며 운영 PC 설치·1 GET/day 실증은 미확인.

**M2 완료:** 실제 공통 소비자 Alpaca quota·자산 R10을 확인해 4파일 변경의 최신 main 격리 브랜치 [Draft PR #537](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537)에 구현. Linux Node 24 집중 테스트 19/19 PASS, 독립 코드 검토·회귀 수정 후 PASS. 실제 Windows smoke·운영 적용/체감 효과는 미실증이므로 M3·M4로 분리한다.

**M3 확인 결과:** 실제 설치된 Controller SHA로 확인된 최신 정상 B #476의 목표는 `0492f6f5bb16769e914ca85c63db119979fcf0a6` ([근거](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476#issuecomment-6685444328)); 이는 당시 증거이며 현재 PC 재측정 값은 아니다. 기존 정상 B #445→#449→#454→#476은 승인된 정확한 목표 커밋에 맞춰 **순차적으로 전체 diff를 적용한 성공 사례**다. 해당 대상 커밋의 일부 파일만 임의 선택한 것은 아니다. 유지보수기 설치 SHA `4f076a…`와 Controller SHA를 혼동하지 않는다.

**M3 다음 행동:** 현재 설치 SHA와 승인된 정확한 목표 SHA가 있는 실제 공유 변경에 한정해 기존 manifest/백업/restore/6 Runner 복구 시나리오를 격리 시험한다. #68 단일 적용 담당 외 임의 B 요청·설치 금지.

**운영 변경:** 이번 조사·기록 단계에서 실제 Windows 실행/Controller 교체/공급자 API 호출/DB·예약 변경 없음. 원담당 업무 진행을 중단시키지 않는다. 예약 검증은 본 업무가 끝난 후 별도 후속 작업이다.

## 10. M2 구현 완료 — 공통 코드 격리 (2026-11-07)

- **총괄 계획·원장 브랜치:** `codex/controller-process-platform-r1-20261107` ([PR #527](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/527), 운영 배포 대상 아님). 역사적으로 최신 main과 269커밋 이상 분기되어 Controller 소스 교체 대상으로 사용하면 신규 진단기를 잃을 수 있다.
- **M2 코드 브랜치:** 최신 `main` 기준 `codex/controller-process-safe-read-r1-20261107` ([Draft PR #537](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537)). 4개 파일만 변경: `controller/fixed-readonly-bytes.mjs`·`controller/alpaca-quota-readonly.mjs`·`controller/asset-r10-source-readonly.mjs`·`tests/fixed-readonly-bytes.test.mjs`.
- **역할:** 공통 함수는 호출자가 정한 고정 파일과 검증 루트에 대한 경계·크기·읽기 도중 변경 여부를 검사해 바이트만 반환한다. 원담당의 Alpaca 140회 상한/원장 JSON 검증, 자산 R10의 SHA·정적 Task/실행 판정, 기존 반환 코드·민감정보 비노출은 유지. 임의 경로 PC operation은 추가하지 않는다.
- **검증:** 격리 Node 24 `node --test tests/fixed-readonly-bytes.test.mjs tests/alpaca-quota-readonly.test.mjs tests/asset-r10-source-readonly.test.mjs` **19/19 PASS**. 독립 검토에서 발견한 opened FD의 부적격 크기와 변경 중 크기의 오류코드 분류 문제 1건 수정 후 재검토 통과. 원격 4개 파일과 로컬 테스트본 완전 일치 확인.
- **남은 위험:** Windows `openSync('r')`는 atomic nofollow를 보장하지 못한다. 현재 고정 root·lstat/realpath·inode/dev 검사가 위험을 완화하지만 symlink 교체 경합의 완전 차단 증거는 아님. 주입 테스트 FS는 open/fstat/read/close 필요. **Windows 실제 파일 읽기·경로/인증정보·기존 오류 코드 smoke 및 운영 B 적용은 M3**. 합병·설치 권한은 별도로 유지.
- **#524 변화:** EarningsAPI 원담당 PR은 `main`에 병합됨(2026-11-07 KST 확인). 수집기 파일 관측과 KST 로그 집계의 소스 개선이며 운영 1 GET/day 실증과 혼동하지 않는다.

**신규 프로젝트 완료율: M0+M1+M2 = 60%. M3+M4는 미완료.** 운영 API/DB/예약/Controller 교체/정규 Runner 재시작 **0회**.

## 11. M3 추가 확인 (2026-11-07)

- 실제 설치 마지막 A [#532](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/532) `0492f6f5…` → EarningsAPI [PR #535](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/535) 승인 목표 `af016444…`: Controller 1파일. #535 적용 완료 증거는 아직 없다.
- 해당 승인 목표 → 공통 관측 [Draft PR #537](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537) `e27be6d…`: Controller 3파일. 기존 1파일 승인 명세로 합쳐서 설치할 수 없고, #68 기존 단일 B 담당 및 정확한 새 설치 SHA 기준으로 순차 조정한다.
- 현행 A/기존 Windows workflow는 미설치 PR #537 코드를 실행하지 않으므로 Windows fixture는 `WINDOWS_SMOKE_PENDING`. 테스트의 Windows symlink 권한거부가 초록색 PASS로 숨지 않도록 `t.skip`/root 탈출 독립 검사로 보정했고 Linux Node 24 집중 21/21 PASS(Windows 증거 아님).
- 공유 설치의 백업·복구 계약은 최신 main의 `maintenance-contract`/ `maintenance-apply`/ `interrupted-rollback` 격리 소스 테스트를 **Linux Node v24.22.1에서 34/34 PASS**(정규 updater 전체 소스 정적 검사 1건 제외). 실PC/Windows 복구 시험은 아님. 다음은 승인된 Windows 격리 경로, #535 실제 적용 확인, #537 3파일 정확 manifest/검증이다. 증거·제외 범위는 [실행 원장 §8](PROCESS_PLATFORM_R1_LOG_20261107.md) 참고. **M3·M4 미완료 / 60% 유지**.

## 12. M3 배포 기준 전진 (2026-11-07 KST)

- 이전 1파일 승인 설치는 정규 [B #538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/538#issuecomment-6691090423)에서 실제 **SUCCEEDED**. Controller `af016444b2f87f11cd468428d9235cfc257d317d`, 보호 상태·workflow·결과 회수 PASS. 이전 1파일 병목 해소는 원담당/단일 설치자의 실제 성과로 보존한다.
- 남은 공통 변경은 [PR #537](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537) `e27be6d…`의 **3파일**이며, 정확한 파일 경로·raw SHA-256·원격 바이트 일치·권한/검증 상태는 [M3 배포 후보](M3_537_CONTROLLER_DELTA_CANDIDATE_20261107.md)로 분리. 기존 B manifest 재사용 금지.
- 기존 A [#540](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/540)은 원담당이 이미 접수하여 중복 발행 안 함. #68에도 [후보 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6691257448) 기록. 수신·적용 자동 완료를 주장하지 않는다.
- **현재 핵심 미해결:** #537 Windows 개발 fixture를 안전하게 실행할 기존 승인 수단 미확인. SHA/임시 경로만으로 보안 격리를 보장하지 않으므로 최소 권한 별도 실행 경로가 확인되기 전에는 운영 Windows 시험 PASS/설치 완료로 승격하지 않는다.

**프로젝트 60% 유지, M3 RUNNING/M4 DEFERRED.** 다음 실행: #537의 정확한 개발 source에 대한 단회 Windows 시험 수단을 기존 승인 경로에서 확인·준비하고, 승인 manifest 및 현재 실제 설치 SHA를 맞춰 #68 담당에 인계. 검증 목적의 중복 B/A나 미래 예약은 만들지 않는다.
