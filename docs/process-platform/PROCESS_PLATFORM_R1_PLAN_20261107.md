# ZGMINI 공통 실행 효율화 R1 — 프로젝트 계획서

- 작성: 2026-11-07 KST
- 상태: **M0 DONE / M1 READY**, 신규 프로젝트 20% (GitHub 문서·추적 기록만 완료)
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
- EarningsAPI: [#520](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/520#issuecomment-6689594993) `NOV30_ER1_D1_VERIFIED`은 기존 EPS 점수 게시·재조회 PASS(`providerCalls=0`)의 증거다. 하루 1 GET의 런타임 증거는 아님. [Draft PR #524](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/524) 2파일·관련 테스트 7/7, 실PC 미설치; 파일 메타데이터만으로 날짜별 호출 제한을 증명하지 못함. PR #524를 중복 편집/병합하지 않는다.
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
| Draft PR #524 | 후보 체크아웃의 EarningsAPI 파일 해시/크기/mtime | 단일 파일 존재 ≠ 활성 실행, 일일 호출 증거 아님 | Draft 보존. 원담당과 중복 코드 변경 금지 |
| `market-calendar-er1-saved-status` | 지정 과거 5일 입력·검증 개수·바인딩 지문 | 오늘 호출 ledger/런타임 요청 증거를 제공하지 않음 | 원래 기능 완료 증거 재사용; 신규 전역 진단으로 확대 금지 |
| `scripts/pc-writer/quota-ledger.mjs` + `quota-policy.mjs` (`zgmini` main) | 공통 provider quota 원장 및 요청 시각 저장 로직 존재 | 현재 공식 등록 공급자에 **EarningsAPI 없음**; 비공개 수집기의 실제 경로/이 원장 경유 여부 미확인 | 기존 원장만으로 하루 1 GET 입증 불가. 새 quota 정책을 임의로 추가하지 않음 |
| `controller/operations.mjs`+`config/operations.json` | 고정 operation allowlist·등급/자원·실행 어댑터 | 신기능 자동 로딩은 아님 | 임의 경로/스크립트 실행 없는 고정 등록 유지 |
| `docs/CONTROLLER_APPLY_QUEUE.md` + #68 | 실제 설치 SHA→목표 누적 diff 및 승인 manifest·단일 담당·lease·원본 보호 | 최소 부분 적용 가능 여부는 실제 설치기/정확한 대상에 따라 다름 | 설치기 지원을 검증하기 전 부분 적용이 가능한 것으로 단정하지 않음 |

## 5. 실행 단계와 완료 조건

| 단계/비중 | 수행 내용 | 완료 조건/증거 | 담당 |
| --- | --- | --- | --- |
| **M0 20% — 착수** | 전용 브랜치·계획·진행 원장·Issue/리뷰 PR 생성, 기존 증거 분리 | 각 GitHub 링크 재조회, 원본 브랜치 무변경 | 총괄 |
| **M1 20% — 공백 확정** | 첫 사례 #524의 필요 정보/현재 허용 A/원장/PC 접근 범위 차이표, 실제 공통화 가치 평가 | `현재 가능/미설치/불가능/미확인`과 경로·근거, 단 하나의 M2 최소 계약 | 총괄(원담당 증거 수신) |
| **M2 20% — 최소 공통 관측** | 기존 요약기·A 어댑터를 재사용해 고정·비민감 실행 관측 결과 계약을 격리 구현/관련 테스트 | 공급자 호출/DB 쓰기 0, fixture의 날짜 경계·중복·오류/UNKNOWN·키 비노출·과대/경계 차단 PASS, 독립 검토. 필요한 실제 PC 효과는 별도 상태 | 총괄(공통부) / 원담당(수집기 로직) |
| **M3 20% — 최소 변경 적용** | 누적 diff/승인·최종 바이트를 파일별 분리하는 배포 실행 명세/지원 범위 확인, 격리 시뮬레이션 | 승인 변경만 manifest, OLD/TARGET/OTHER/MISSING/UNKNOWN 분류, 경합·백업·전환 실패 시 원본 보존 검증. 실제 운영 적용은 #68에서 별도로 기록 | 총괄 설계 / 단일 적용 담당 |
| **M4 20% — 재개·효과 측정** | 원담당에게 정확한 문제/다음 행동 인계, 원본 증거로 재개·수동 개입·리드타임 측정, 필요한 공통 정본만 개정 | 실제 수신 확인과 진행 효과 구분, 전용 증거 링크, 불필요한 Gate 제거, 승인된 정본 변경 재조회 | 총괄 / 원담당 |

**실PC 효과 검증은 그 기능에 실제로 필요한 업무 흐름에서만 수행.** M2 코드·fixture 성공을 PC 설치로, M3 명세 완료를 운영 적용으로, M4 Issue 기록을 일반챗 자동 재개로 치환하지 않는다.

## 6. 관측 계약 초안 — M1에서 확정

목표는 모든 경로를 임의로 읽는 범용 파일 조회기가 아니다. 기존 승인된 A operation 또는 고정 allowlist의 **등록된 관측 대상**에서 아래 최소 메타데이터를 추출하는 것이다.

- 공통: `schema`, `observedAt`, `targetId`, `evidenceLevel`, `operationSourceSha`(확인 가능 시), `actualInstalledSha`(확인 가능 시), `status/code`, `providerCalls=0`(진단기 자신의 호출량), `operationalWrites=0`.
- 변경 대상별: `fileIntegrity`, `effectiveSourceMatch`, `lastExecutionAt`, `checkpointAt`, `lastExecutionCode`; 확인 불가 시 정확한 `UNKNOWN`과 원인.
- 일일 호출 제한 검증의 경우: **기존 영속 원장에 실제로 존재하는 범위에서만** `date`, `recordedRequestCount`, `dedupState`, `ledgerContinuity` 출력. 기록이 없거나 수집기가 일일 한도를 실제로 적용하는지 불명확하면 `STATE_UNKNOWN`. 날짜별 수치가 정상적으로 존재한다고 가정하지 않는다.
- 비노출: 파일 원문·키·전체 설정·HTTP 요청 URL·원자료·임의 인자·임의 JS/SQL.
- 테스트: 반복 호출/같은 날짜/날짜 변경/중단 후 재개/수집 실패/원장 부재/다중 Runner 경합/경계 밖 symlink/기존 계약 호환. 기존 공통 테스트를 그대로 재사용하고 영향 범위를 좁힌다.

**핵심 결정:** #524의 해시 검증은 좋은 원자적 단계지만 날짜별 호출 검증의 대체가 아니다. 먼저 기존 evidence를 수집하고, 부족할 때만 위 최소 계약의 구현을 승인 범위로 진행한다.

## 7. 실행 기록·진행 지표

기록 단위: `날짜 / 단계 / LAST PASS / FIRST FAIL / 원본 증거·SHA·시간 / 코드·테스트 / PC 설치 여부 / 실제 효과 / 담당 / 다음 한 행동`.
상태는 `DONE`, `READY`, `RUNNING`, `STATE_UNKNOWN`, `BLOCKED`, `DEFERRED`로 구분한다.

운영 KPI는 이번 착수 시 **기준치 미측정**으로 보존한다. 초기 대표 사례 #524 및 다른 실제 공용 장애를 통해 `사용자 수동 개입 횟수`, `동일 진단 반복 횟수`, `Controller 때문에 멈춘 시간`, `PR→PC 적용 소요`, `원담당 다음 실행 완료율`을 관측 가능한 범위에서만 측정한다. 증거 없는 향상률·무중단 보장·가공된 수치 금지.

## 8. 현재 결정과 바로 다음 한 행동

1. **현재:** M0 산출물 등록, 실제 코드/설치/PC 변경 없음.
2. **다음 필수 실행(M1):** 총괄이 기존 `tools/automation-status.mjs`/A operation/유효 ledger에 대해 **읽기 가능 증거와 설치 여부를 분리한 공백 표**를 완성하고, #524 원담당의 기존 기록을 대조해 **최소 관측 계약 1건**만 확정한다.
3. 지원이 불명확하거나 권한 거부 시 원문·요청 경로·담당·해제 조건만 기록. 모든 일반 작업자의 별도 기능 작업은 계속한다.
