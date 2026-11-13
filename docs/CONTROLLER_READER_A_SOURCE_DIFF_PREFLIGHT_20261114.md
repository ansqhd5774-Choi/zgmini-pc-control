# ZGMINI Controller A 신규 Reader 적용 — 고정 소스 차이·의존성 사전검증 (41차)

**기준:** 2026-11-14 KST · `SOURCE_ONLY / READBACK_PREPARATION / NOT_APPROVED / NOT_INSTALLED`.

- 원래 운영 PC **마지막 측정** Controller source SHA: `badad9124157879d7a645b64f2768113d632355b` ([A #1340](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1340), [A #1338](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1338)). 현재 PC 실설치 SHA는 새 운영 A 결과가 없으므로 **UNKNOWN**.
- 개발 대상 최신 제어 main SHA: `69e25a08a903dc8e52ef1093ec15837de4c20858`. 두 **Git tree는 recursive/truncated=false**, Git 저장소 소스의 blob 차이이며 Windows 설치 시점·파일 해시·승인 증명이 아니다.
- 이 기록은 올바른 기존 B 경로에 넘길 **사전 검토용 불변 후보**이지 실행 가능한 승인 manifest, 설치 지시, 운영 PC 런타임 상태 선언이 아니다. 정확한 최근 PC before/hash가 다르면 새로 비교한다. C #996과 겹치는 설치 공유 쓰기는 `NO-GO`.

## 1. 실제 Git tree 전체 경로 차이: 14개, 배포 후보 13개

| 경로 | 변경 유형 | 마지막 실측 source Git blob | 현재 main Git blob | 종류 |
| --- | --- | --- | --- | --- |
| `config/operations.json` | 변경 | `d22d18bd9b252cbaa5e6b8e082377a872630b2b3` | `c906683afd487762f5bc32f50a199679df200dc3` | 실행/설정 후보 |
| `controller/core-runtime-source-readonly.mjs` | 변경 | `6e11effce48a1bf6c4d85493cd23523746d49dc2` | `47668f82f040b7f20a35e7117c1ef40fec070a71` | 실행/설정 후보 |
| `controller/core-runtime-source-wmi.mjs` | 변경 | `d02267dca6756b64cd4aff6ba38b648b05c24503` | `187fc83e94f65c6ab355f427da11cae8b4b9d2b4` | 실행/설정 후보 |
| `controller/d05-lineage-readonly.mjs` | 신규 | `ABSENT` | `43eaf1b976b3584b3f18739366d7122ec59bb9d4` | 실행/설정 후보 |
| `controller/employment-r6-collection-evidence-readonly.mjs` | 신규 | `ABSENT` | `2daa4e03b6affe5fd44c68311eca57ddee614b0e` | 실행/설정 후보 |
| `controller/inflation-core-lock-observation-readonly.mjs` | 신규 | `ABSENT` | `82ac34052ef22edbecd8ab7348fe76bffcb3d583` | 실행/설정 후보 |
| `controller/inflation-core-lock-observation-readonly.test.mjs` | 신규 | `ABSENT` | `51a76a59d3b0ade9550764a74f56536089ee3916` | 비배포 시험 |
| `controller/operations.mjs` | 변경 | `f6ef5a4dccf9b1b09f50db6edfa61004e6503b44` | `b507697ce089254cd61932f1d5b703b48f93e0db` | 실행/설정 후보 |
| `controller/release-calendar-runtime-readonly.mjs` | 변경 | `cf5e8e82ef1013db4726ae82c14482d10178dd71` | `1470cd93cf0e0887d55a1351305be5c4edfc7c6e` | 실행/설정 후보 |
| `controller/shared-resource-release-readonly.mjs` | 신규 | `ABSENT` | `9eb5f752f6fbfc3f48d3bd2e7a5d7cbc5a816039` | 실행/설정 후보 |
| `controller/source-inventory-runtime-readonly.mjs` | 신규 | `ABSENT` | `db9e9c8347277287cc6ef10bad310be125314d52` | 실행/설정 후보 |
| `controller/theme-l7-runtime-readonly.mjs` | 변경 | `be5b9a6a6657f95f472b91b57461bf1e3ded2614` | `a841aef7547345090a0af209cd426590ede9b035` | 실행/설정 후보 |
| `controller/writer-b-1063-recovery-readonly.mjs` | 신규 | `ABSENT` | `b67a3dcf57fd54d7b6977a9bb867a62442bd5a56` | 실행/설정 후보 |
| `controller/writer-b-1063-task-probe.mjs` | 신규 | `ABSENT` | `c7102b4a60293ceadc80916469a75bfcd69b821d` | 실행/설정 후보 |

**합계:** 변경 6개(기존 Controller 모듈 5 + operations 설정 1), 신규 8개(실행 모듈 7 + 비배포 test 1), 삭제 0. **설치 후보 13개(12개 Controller 런타임 + 설정 1)**. 비배포 시험 `controller/inflation-core-lock-observation-readonly.test.mjs`는 Git 소스에서 유지하되 실제 파일 교체 manifest에 넣지 않는다. 기존 [PR #1333](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1333)의 `*.test.mjs` 설치 비교 제외 수정이 실제 운영 유지보수기에 설치됐는지 별도 readback 필요.

## 2. 정적 진입점·config 회귀 교차검증

- 두 고정 source의 `config/operations.json`은 **31 → 37 operation**. 기존 31개 키와 설정값 **31/31 JSON 값 일치**, 삭제/변경 0; `operations` 외의 전역 config 키/값 변경 0. 신규 6개:
  - `d05-lineage-readonly`
  - `employment-r6-collection-evidence-readonly`
  - `inflation-core-lock-observation-readonly`
  - `shared-resource-release-readonly`
  - `source-inventory-runtime-readonly`
  - `writer-b-1063-recovery-readonly`
- 실제 `controller/operations.mjs`가 위 신규 모듈 6개를 **정적 import**하고, `writer-b-1063-recovery-readonly.mjs`는 신규 `writer-b-1063-task-probe.mjs`도 의존한다. 신규 Controller 12개 런타임 파일 후보 전체의 **상대경로 import는 30건, 최신 Git tree 기준 대상 누락 0건**. 단, 기존 설치 tree에 없는 직접 신규 6개 모듈을 함께 가져오지 않고 `controller/operations.mjs`만 적용하면 필수 import를 잃는다.
- 기존 Controller의 변경 모듈 5개(`core-runtime-source-readonly.mjs`, `core-runtime-source-wmi.mjs`, `operations.mjs`, `release-calendar-runtime-readonly.mjs`, `theme-l7-runtime-readonly.mjs`)는 **config 값이 같다고 런타임 동작도 불변이라는 증거가 아님**. 관련 기존 A 회귀/기능별 조회 범위는 승인된 source CI와 실제 운영 적용 후 최소 A readback에서 각각 확인해야 한다.
- 테마 `theme-l7-runtime-readonly.mjs`의 최신 `safeR181HttpErrorFlow`와 과거 운영 설치본 미포함은 [원담당 #1009](https://github.com/ansqhd5774-Choi/zgmini/issues/1009#issuecomment-6861796566)에 독립 인계 완료. 이 문서는 실제 HTTP failure·6피드 정상화 증거가 아님.

## 3. 실제 설치 전 필수 STOP·Owner 단계

1. 운영 Owner가 **새로운** 읽기 전용 운영 PC 관측(기존 #1351 Job 배정 포함)으로 6개 ZGMINI Runner Online/busy·Guardian/Watchdog/Supervisor·실제 Controller before SHA·정확한 설치 파일 preimage·유지보수기 fixed 7파일 설치 버전·현재 `controller-install` owner/lease·#996 원장 상태를 분리 검증. 마지막 관측을 현재 Runtime이라고 단정하지 않는다.
2. 실제 설치 관리자는 기존 `pc-controller-maintenance` vs `pc-controller-heavy-readonly` 승인 purpose를 구분해 기존 `tools/maintenance-contract.mjs` 조건 및 해당 신규 6개 A/light/heavy 정책(인플레이션 Core lock A/heavy 240초, 1536MiB)·기존 사용자 승인의 정확 범위를 확인한다. 단순 config 값 PASS는 유지보수 B 전체 승인 근거가 아니다.
3. 그 후에만 현재 Runtime before 파일 SHA-256·target source tree/file SHA-256·고유 B manifest·preimage/backup/CAS/rollback·공유 설치 lease 보호를 갖춘 **단일 Owner의 정규 B 적용**을 검토. 운영 source·Controller·Task·원자료·DB·D1 변경은 범위 밖.
4. 정상 적용 시 최소 `d05-lineage-readonly`, `source-inventory-runtime-readonly`, `employment-r6-collection-evidence-readonly`, `theme-l7-runtime-readonly` 및 기존 31 operation A 회귀 중 영향 범위의 실제 Runner/JSON/TXT·installedSHA/before-after·원본 보호 readback으로 판정. CI·Git merge는 실PC A 성공이 아니다.
5. 공유 설치는 C #996의 native namespace/CAS·신규 C approval 미충족이면 `BLOCKED_ACTIVE_RECOVERY_LEASE` 유지. 이 범위 외 기능별 공식 원본 검토/독립 개발·기존 설치 A·공개 API/UI 검증은 계속. **#1351 기존 Job 재요청 0; 새 임의 CMD·Controller 복사·무단 lock 해제 0.**

## 4. 현재 정확한 완료점과 전달 대상

- Git 원본 증거: **two truncated=false trees / 14개 차이 중 13개 배포 후보 / 신규 직접 상대 import 6개 / 최신 tree import 누락 0 / 기존 config 31/31 동일**; 판정 `SOURCE_AUDIT_COMPLETE`.
- 실제 PC #1351 [Run #43429486924](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43429486924) Job `131899103441`은 `queued/runner_id=0`이며 원격 결과 없음. 현재 복구 미완료.
- 작업 담당: **공통 Controller 단일 적용 Owner**, 총괄 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68). D05·시장·고용·테마 기능 원담당은 자기 기존 완료점을 보존하고 정확한 신규 A 운영 적용 후 readback만 요구. 완료된 R10·예약 검증을 다시 Gate로 만들지 않는다.

## 5. 70차 추가 감사 — 6개 신규 A 등록의 최소 의존성 vs 의미상 정상 판정

**구분:** 2026-11-14 KST, 소스-only GitHub blob readback. 기존 41차의 `13개 파일` 최종 main parity 후보와 이전 PASS를 재사용하며 운영 PC를 새로 조회하거나 설치하지 않음.

1. **정적 import 1차 최소 집합은 9파일**: `config/operations.json` 1 + `controller/operations.mjs` 1 + 그 파일이 eager import하는 신규 operation 모듈 6(`d05-lineage-readonly`, `inflation-core-lock-observation-readonly`, `shared-resource-release-readonly`, `writer-b-1063-recovery-readonly`, `source-inventory-runtime-readonly`, `employment-r6-collection-evidence-readonly`) + 신규 `controller/writer-b-1063-task-probe.mjs` 1. 새 `operations.mjs`은 위 여섯 모듈을 **무조건 import**하므로 단일 operation용 설정만 적용하려고 신규 파일을 일부 누락시키면 `controller/entry.mjs`가 최초 import 단계에서 실패할 수 있음. 기존 `controller/engine.mjs`은 old/main Git blob `b1463e22266905e458e8dc616e021685ba00a0d8` 동일; 새 공유 Runtime 엔진 설치 변경은 본 소스 차이에 없음.
2. **9파일은 기능적 의미에서 충분하지 않음(물가 A 명백한 전이 의존)**: 신규 `controller/inflation-core-lock-observation-readonly.mjs`는 `inspectCoreRuntimeSource`의 `observation.lockOwner.status==='VERIFIED_ACTIVE_CORE'`를 필수 관측한 뒤에야 `ownerVerifiedSamples>0`가 됨. 기존 `controller/core-runtime-source-readonly.mjs@6e11effce48a1bf6c4d85493cd23523746d49dc2`의 `inspectCoreRuntimeSource`는 `lockOwner` 결과 키를 **전혀 반환하지 않음**. 최신 `@47668f82f040b7f20a35e7117c1ef40fec070a71`에만 `readCoreLockSnapshot/classifyCoreLockOwner`가 추가돼 반환함. **따라서 구버전 core 모듈과 신규 인플레이션 observer를 조합하면, 실제 Task/lock이 정상이어도 observer의 `PASS` 분기로 도달할 수 없음**(대개 owner 미관측 `STATE_UNKNOWN`; 실제 상태 오류 확정 아님). 기존 41차 13파일 집합에서 `core-runtime-source-readonly.mjs` 갱신을 제외해 ‘신규 6개만 설치 성공’이라고 할 수 없음.
3. **WMI 변환 버전 차이도 영향 검토 대상**: 구 `core-runtime-source-wmi.mjs@d02267dca6756b64cd4aff6ba38b648b05c24503`는 Windows CIM_DATETIME의 signed UTC offset을 해석하지 않던 코드이며, 최신 `@187fc83e94f65c6ab355f427da11cae8b4b9d2b4`는 offset을 보정함. Task-linked Node PID 생성시각 대조에 영향이 있을 수 있으므로, 물가 Core lock 정상 판정 시 **두 core source 모듈의 버전·회귀 검증을 함께 심사**해야 함. 원격 import closure가 맞는다는 사실만으로 실제 프로세스/lock 판정 정확성을 확정하지 않음.
4. **실제 보수적 적용 후보는 기존 13파일 유지**: 9파일의 *구문상 필수 최소*와 10~11파일의 *물가 의미상 의존성*은 소스 분석이며, 정상적인 부분 적용 `APPROVED_B` manifest가 아님. 13개 전체에는 기존 release-calendar·theme 관련 변경까지 포함돼 있으므로 관련 영향 회귀·현재 PC before SHA/승인 source pinned manifest·Writer/C996 공유 lease와 B/C 권한을 구별해 Owner가 적용 scope 결정. source-only 검증을 `INSTALLED`/운영 `PASS`로 승격 금지.

**결론:** 최초 운영 실행 이전의 안전 제약 하나를 명확히 확인: **`NEW_OPS_IMPORTS_PRESENT` ≠ `NEW_OPS_RUNTIME_SEMANTICS_CORRECT`**. 권한 없는 부분 복사·설치·새 A/B 요청·기존 승인 효과 변경 없음. 실제 다음 실행은 기존 41차와 동일한 **운영 PC 단일 Owner의 #1351/6 Runner 현재 등록·online/busy·Listener와 PC controller before SHA 읽기 전용 인증**이며, 이미 전달된 원담당 지시는 중복하지 않는다.
