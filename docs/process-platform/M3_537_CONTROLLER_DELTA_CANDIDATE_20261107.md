# R1 M3 — PR #537 Controller 3파일 최소 적용 후보 (설치·승인 문서 아님)

- 작성: 2026-11-07 KST
- 성격: **읽기 전용 후보 변경 목록/검증 인계**, 정규 B 승인 manifest 아님
- 중앙: [#526](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/526), [공유 단일 적용 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68), [개발 Draft PR #537](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/537)

## 1. 실제 기준과 immutable 후보

| 구분 | 정확한 값·증거 | 판정 |
| --- | --- | --- |
| OLD (최신 정규 B 결과) | `af016444b2f87f11cd468428d9235cfc257d317d` · [B #538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/538#issuecomment-6691090423) `SUCCEEDED` / actual=target / `PROTECTED_STATE_UNCHANGED=true` / result upload verified | **해당 완료 시점 실설치 확정**, 이후 새 변경 여부는 실제 요청 직전 재확인 |
| TARGET_CANDIDATE | `e27be6d391d738f0d446664ab9f2ca457751f624` · PR #537 개발 브랜치 | **Draft**, 아직 main 병합·B 승인·PC 설치 아님 |
| installed→candidate 비교 | GitHub compare `af016444…→e27be6d…`: ancestor/ahead 8, 전체 변경 9경로 중 **controller/config 3경로** | 정적 diff 경로 검사 PASS |
| OTHER | 위 전체 9경로 중 `r17-sip-b/` 3개, `results/` 2개, `tests/` 1개 | Controller-only 단계의 설치 경로로 취급 금지. 기능별 승인·소유 별도 |
| UNKNOWN/MISSING | 최신 PC lease/current installed 재실측, 후보 main 병합 SHA, 정확한 새 승인 manifest 및 Windows 격리 smoke | **준비 불충분. B 접수 금지** |

## 2. controller/config 정확한 3파일과 SHA-256

아래 해시는 로컬 원본 파일과 PR #537 GitHub content Git blob SHA가 **3/3 일치**한 바이트의 SHA-256이다. 승인 manifest의 `allowFiles` 후보 집합을 설명하지만, 실제 입력 manifest를 발행하거나 승인하지 않는다.

| 변경 | 파일 | 후보 SHA-256 |
| --- | --- | --- |
| MODIFIED | `controller/alpaca-quota-readonly.mjs` | `1886ac4e878aae44cc9f2480c3e7964798fb59ba3a246237794a6ed33717a6ea` |
| MODIFIED | `controller/asset-r10-source-readonly.mjs` | `2180b7a05dbd75feffd29d0d604d4019812f322d15f2f7b6847018a27001e8c1` |
| ADDED | `controller/fixed-readonly-bytes.mjs` | `ef545e7621da26f790ac15089aba3c82956fb40e287c3a1ec9ad13cddfe3bdf8` |

**정확 일치 규칙:** 실제 Controller 설치 직전 새 `installedSha→main targetSha`의 **모든** `controller/`·`config/` 경로가 그때 발행할 승인 `allowFiles[]`와 같아야 한다. 이후 다른 작업자가 같은 영역을 변경하면 3이라는 숫자에 집착하지 않고 diff를 재계산한다. `ALLOWFILE_DIFF_MISMATCH` 및 `TARGET_NOT_ON_MAIN` 등을 우회하지 않는다.

## 3. 이미 검증된 범위

- PR #537 공통 helper + Alpaca/asset R10 2개 소비자: Linux Node v24.22.1 집중 **21/21 PASS, skip 0**(Windows 권한 제한 시 symlink 테스트는 명시 `SYMLINK_UNVERIFIED` skip).
- 정규 유지보수기 `maintenance-contract`/ `interrupted-rollback` 관련 Linux 격리 fixture **34/34 PASS**, `tools/update.mjs` 전체 소스 확인에 의존하는 기존 1개 테스트는 선택 제외. 실제 백업/복구·Windows 교체를 수행한 증거 아님.
- #535 한 파일 B [#538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/538#issuecomment-6691090423)는 **이미 완료**, 이 작업의 3파일을 설치한 것이 아님.
- EarningsAPI 원담당이 설치 후 [A #540](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/540)을 **이미 접수**했으므로 총괄이 A/B 중복 요청하지 않는다.

## 4. Windows 격리 시험 경로의 현실적 제한

- `pc-job`과 기존 A는 **설치된 Controller만** 실행한다. 해당 경로에 임의 개발 SHA/명령을 넣지 않는다. `theme-common-tests`는 지정 source 등록에 한정. 기존 승인된 PR #537 독립 Windows Node fixture 실행기가 **확인되지 않았다**: `WINDOWS_SMOKE_PATH_UNVERIFIED`.
- 최소 후보: 검토된 정확한 source SHA와 재귀 import/test 의존성, 해시, 제한된 test 3개를 고정한 **단회** Windows 개발 격리 시험. 승인된 기존 검증 adapter가 실제로 확인될 때만 사용. 새 보편적 원격 셸·임의 코드 실행 허용목록 금지.
- `%TEMP%`/Runner workspace 분리는 운영 파일 손상 가능성을 낮추지만 권한 격리는 아니다. 동일 사용자 코드가 접근 가능한 `E:\ZGmini`/GitHub 인증정보를 자동 차단하지 않는다. 가능한 최소 권한 별도 Windows 실행 계정/VM, 비밀정보 미주입, 핀 고정 source review, timeout, 결과 sanitization, 테스트 후 운영 파일 무변경 검산 필요.
- 신규 워크플로는 기본 경로가 아니다. 실제 단회 수단이 없고 필요성이 입증되면 범위/승인을 구분한 **테스트 전용** self-hosted Windows one-shot(최소 `contents:read`, 고정 SHA/명령/테스트)만 별도로 심사. 운영 장비에서 PR 코드 실행은 SHA pin만으로 샌드박스가 되지 않는다.
- 결과 등급: `M3_WINDOWS_FIXTURE_PASS_ONLY`(경로·symlink 실행/skip·Node·소스 해시 확인 시) / `M3_WINDOWS_SMOKE_FAIL` / `WINDOWS_SMOKE_PATH_UNVERIFIED`. 어느 것도 #537 설치 성공으로 표현하지 않는다.

## 5. 다음 담당·필수 한 행동

1. **프로세스 총괄:** 이 후보 문서·Draft를 유지하면서 #537의 변경만 코드 검토하고, Windows 격리 시험 실행권한·수단이 실제로 있는지 기술 제약을 분리한다. 별도 기능 업무 담당을 대신하지 않는다.
2. **공용 적용 담당(#68):** #537가 검토·병합되고 승인 manifest가 준비된 후 **직전 실설치 SHA/lease**와 전체 diff/파일 바이트를 다시 대조한 뒤 정규 B 1건만 수행한다. backup/drain/6 Runner 복구/보호 및 사후 관련 A를 증거로 남긴다.
3. **원담당:** #540의 *이미 존재하는* A 결과를 회수해 EarningsAPI 파일 메타데이터와 KST 호출 로그를 별도 판정. 1 GET/day 운영 보증·EPS 기존 운영 PASS와 혼동하지 않는다.

완료율: M0~M2 DONE = **60%**, M3 RUNNING / M4 DEFERRED. 예약 검증·인위적 Controller B는 모든 실제 업무 완료 이후의 후속 검토.
