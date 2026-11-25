# ZGMINI #3409 — 후검사 실행 연결·복구 경로 개선 지시 및 완료 증거 R2

> **작성/반영 기준:** 2026-11-26 KST. 사용자 2026-11-25 지시문을 범위 정본으로 수용하고, 이후 확인된 #3409 실제 완료 증거를 반영한다.  
> **대상:** `ansqhd5774-Choi/zgmini-pc-control`. 기존 #3409 전용 작업 브랜치 `codex/controller-ops-lessons-20261105-3409-handoff-v2-20261125`에 업무 지시·검증 기준을 기록한다.  
> **원인 분석 기준 자료:** 사용자 제공 `ZGMINI_3409_RCA_2026-11-25.md` (2026-11-25 작성본, 이후의 실제 운영 성과는 별도 #3409 완료 댓글을 우선).  
> **책임:** 프로세스 총괄. 이 문서는 완료된 #3409의 재실행·재설치·재승인·Issue 재개 지시가 아니다. 소스·CI·운영 증거를 구분하고 새로운 실장 변경은 검증된 결함과 승인 범위가 있을 때만 추진한다.

## 1. 목표·작업 경계

1. 후검사 요청이 실제 GitHub Actions 실행에 연결되지 않으면 최초 실패 단계를 **요청 생성 → Run 확인 → Job 배정·실행 → 결과 회수 → 실제 결과 검증**으로 구분한다.
2. 정상 설치 상태의 정합 복구에는 기존 독립 운영자·CAS·원장·백업 경로를 연결한다. 결과 불명과 실제 무결성 실패를 구별한다.
3. 복구 패키지 생성 과정에서 승인 source 객체·의존성·실제 파일 바이트/해시·경로·크기 상한의 호환성을 **실행 전에** 점검한다.

기존 `controller/entry.mjs`, `controller/engine.mjs`, `tools/update.mjs`, `tools/maintenance-agent.mjs`, `tools/maintenance-apply.mjs`, `tools/maintenance-recovery.mjs`, `tools/maintenance-contract.mjs`, `tools/operator-packets/*`, `.github/workflows/pc-job.yml` 및 설치된 Runtime 중 영향 범위만 대조한다. 기존 기능/검사/문서와 내용이 겹치면 재사용한다.

**금지:** 새 전역 잠금·상주 감시·정기 진단·승인 Gate, 반복 A급 선행시험, 모든 Runner 유휴의 전역 적용, Workflow 주석만 수정하는 재등록 반복, 중복 Issue/requestId 생성, 시간 경과만으로 lease 삭제, 미확인 상태를 임의 PASS 변경, 원래 설치·독립 복구 재실행.

## 2. 기준 사실 — 원래 사고와 이후 완료를 분리

### 2.1 원래 사고 #3409/#3410: 역사 상태 불변

- 원래 B #3409는 설치 Controller SHA `6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4`의 목표 바이트 일치가 확인되었지만, 원래 후검사 #3410 고유 requestId `pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0-postcheck`에 대한 최초 Run/Job/JSON/TXT는 미확보였다. 따라서 **`OUTCOME_UNKNOWN` / `POSTCHECK_OUTCOME_UNKNOWN` / `POSTCHECK_PENDING` 이력 그대로 유지**.
- #3410 created 2026-11-24 17:09:01 UTC, 이후 17:09:25 UTC에 `pc-job` 라벨 추가. backlog resume 기록 약 1.493초 뒤라는 관측만으로 인과 원인 단정 금지. 후행 원자적 라벨 Issue들도 한때 Run 생성이 없었으므로 라벨 지연·pause window·플랫폼 내부 사유 중 하나로 단정 불가.
- `pc-job.yml`의 `opened` 와 제한된 `labeled` opt-in 계약, 설치된 `entry.mjs` 버전 차이를 구분한다. `ZGMINI_PC_JOB_LATE_LABEL_ENABLED`를 임의 활성화하지 않는다.
- PR #3433의 Workflow 주석 수정 후에도 신규 Run이 누락된 이력 존재. 주석 변경을 복구 수단으로 재사용 금지.
- 원래 3410은 역사적 미실행 기록으로 `CLOSED/not_planned`; #3409는 이후 정상 복구 및 재발 방지 검증 완료를 근거로 `CLOSED/completed`. 원래 결과를 소급 재판정하지 않는다.

참고: [#3409](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3409), [#3410](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3410), [RCA에서 조사한 PR #3433](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3433).

### 2.2 이미 수행된 수정·운영 증거 (반복하지 않음)

| 구분 | 검증된 완료 증거 | 재사용/경계 |
|---|---|---|
| 독립 복구 | [#3409 독립 Windows 영수증](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3409#issuecomment-7156473312): `RECOVERED_INSTALLED_STATE`, `ORIGINAL_LEASE_ARCHIVED=true`, `RECOVERY_ATTEMPTS=1`, 원본 재실행 없음 | 원래 B를 다시 실행하거나 원래 lease를 다시 조정하지 않음 |
| 복구 사후검증 | [#3509 / Run 45572491095](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45572491095): `ARCHIVE_VERIFIED`, 원본 lease ABSENT, JSON/TXT readback | 현행 보호 정상 증거; #3410 PASS 대체 아님 |
| 파일 크기 버그 | [PR #3508](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3508) MERGED `7a56d7c946a0b405be65653f9876ac36c08c117d`. 승인된 `tools/update.mjs`만 최대 262144 bytes, 나머지 기본 131072 bytes; SHA·regular file·symlink·nlink 검사 유지 | 크기 완화 재구현 금지. 새 패키지는 기존 허용 범위와 실제 크기 사전 대조 |
| 유지보수기 후검사 연결 | [PR #3581 / #3584 / #3586](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3409#issuecomment-7162808608)에서 V2 독립 유지보수기 정규 인계 및 운영 readback | 정상 V2를 다시 설치하지 않음 |
| 실제 자연 B 및 후검사 | [B #3587](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3587) `SUCCEEDED` → [A #3590 / Run 45617472368](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45617472368) / Job `139216506442` / 결과 JSON/TXT `PASS/CORE_READONLY_DIAGNOSIS` | 원래 #3410에 대한 Run이 아님. 임의 시험 설치·중복 후검사 불필요 |
| 로컬 원장 링크 readback | [PR #3591](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3591) MERGED `4b30acc94076ae16f3c107a5c3e14fc33eec64d5`, [#3598 / Run 45621540422](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45621540422) `PASS/ER1_LOCAL_RUN_JOB_LINK_MATCHED`; `postcheckLink.reportedRunJobLinked=true`, #3590/Run/Job exact match | 외부 증거를 로컬 link=true로 추정한 것이 아니라 실제 운영 로컬 원장 제한 projection을 확인한 결과 |
| source metadata 역사 오류 | [#3409 최종 결론](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3409#issuecomment-7163609974): 역사적 `requestedSourceSha=3a3aa9...`는 제어 저장소 커밋이며 원래 주장된 `zgmini` 저장소에서는 Git 커밋 출처 미인증 | `postSourceMetadataMatched`와 Git 객체 존재/출처 증명 분리; 원본 메타데이터 불변 보존 |

**판정:** #3409 목표 관련 정상 운영 복구·V2 후검사 연결·실제 B/A 결과·로컬 Run/Job 링크는 이후 증거로 완료되었다. #3410의 원래 시도와 GitHub 서버 내부 원인 증명은 여전히 미확정/역사 기록이다. 같은 일을 미완료 신규 기능으로 다시 등록하지 않는다.

## 3. 후검사 생성 → Run/Job → 원격·로컬 영수증 계약

### 3.1 요청 생성

- 기존 유지보수기의 정규 `pc-job` 요청 생성 함수를 재사용한다. 생성/라벨 적용의 실제 API 순서를 확인하고, `opened` 시 라벨이 함께 붙는 현재 경로와 opt-in `labeled` 경로를 구분한다.
- 연결 식별값: 원본 B requestId/Issue, 생성된 후검사 requestId/Issue, 정확한 `operation`, `sourceRepository`/`sourceBranch`/`sourceSha`, 사용한 Controller `actualExecutionSha`, Workflow ID, runId, jobId, runAttempt, seat, 결과 JSON/TXT 원본 위치.
- 설치된 Controller의 entry/event source 버전이 해당 Workflow 사건과 호환되는지는 실제 `host.json`/설치 SHA/Entry 코드 계약으로 구분한다. 다른 브랜치 최신 main 파일만으로 설치 상태를 가정하지 않는다.

### 3.2 최초 실패 단계 분류 (기존 명칭 우선)

| 관찰 | 판정/코드 후보 | 우선 진단 및 안전 행동 |
|---|---|---|
| 요청·Issue가 있고 정확한 Run 없음 | `NO_RUN` | 요청 발행 시각·이벤트·Workflow 상태·해당 Issue Run/Job 진입 여부의 범위 제한 GET. 플랫폼 내부 원인은 단정 금지 |
| Run은 있으나 Job if가 false | `SKIPPED_GATE` | 이벤트 종류·actor·label·repo·변수 opt-in과 조건 매칭 |
| Run은 있으나 Job 미배정/대기 | `RUNNER_QUEUE` | 대상 6좌석 라벨/online/busy·GitHub job 상태·queue 시간을 확인; 실행 실패/롤백으로 오인 금지 |
| Job은 시작했고 고정 entry가 거부 | `ENTRY_REJECT` | 정확한 Controller 설치 SHA, request envelope, 허용목록·entry gate·실패 코드 대조 |
| 실행 증거는 있으나 JSON/TXT/댓글 누락 | `UPLOAD_MISSING` | 기존 로컬 결과·업로드 영수증부터 readback; 같은 검사를 재실행하지 않음 |
| 후검사 결과 자체 실패 | 기존 검사 `status/code/firstFail` | 실패 항목의 실제 원인 수정; 설치 효과·읽기 실패·전달 실패 구분 |

`NO_RUN`~`UPLOAD_MISSING` 은 진단 분류 이름이다. 이미 동일 의미인 설치 코드·원장 필드가 존재하면 재사용하고 새 전역 상태 스키마를 만들지 않는다. GitHub Run 부재는 "RUN이 확인되지 않음"과 "절대 실행되지 않았음"을 증거 범위에 맞춰 구분한다.

조회는 해당 요청 식별값과 생성 시각 window로 제한한다. 동일 workflow 이름의 다른 Run을 이번 요청 성공으로 처리하지 않는다. 진행 중인 run/job/checkpoint는 `RUNNING`으로 유지하고 observation timeout으로 실패로 바꾸지 않는다.

### 3.3 기록/결과

- 기존 유지보수 원장에 생성 Issue, 범위 제한 조회한 exact Run·Job, 원격 결과 SHA/경로, 로컬 `postcheckLink`를 연결한다.
- 조회가 실패해도 전체 원장/인증 원문을 GitHub에 노출하지 않는다. 고정 범위 sanitized projection만 공개한다.
- original postcheck의 `UNKNOWN`·`RECOVERY_REQUIRED`는 후속 별도 A 성공으로 소급 삭제하지 않는다.
- 정확한 Run·Job·요청·원장 하나가 맞아도 시점·source provenance가 다른 외부 효과까지 성공이라고 표시하지 않는다.

## 4. 재접수·불확실성·정합 복구

1. **Run 없음:** 기존 original Issue/requestId/ledger 및 duplicate-reuse 확인이 먼저. 승인·구현된 정규 재접수 계약이 없으면 자동 새 Issue를 만들지 않는다. 읽기 전용 후검사의 제한된 재접수 정책을 B 설치/DB/D1·게시 효과로 확대하지 않는다.
2. **Run/Job/Worker 진행 중:** 실제 checkpoint가 전진하면 `RUNNING`. 관찰 timeout은 terminal 실패가 아니다.
3. **업로드만 누락:** 기존 로컬 JSON/TXT·결과 pointer/원장 readback → 필요한 전달만 재개. 원래 작업 재실행 금지.
4. **설치 정상·후검사 불명:** 독립 운영자 원본·설치 SHA·보호 baseline·CAS·lease·archive·Runtime 대조. 기존 `reconcile-installed` 또는 해당 승인된 정합 복구 경로로 처리; 정상 설치 재설치/무조건 롤백 금지.
5. **실제 설치 무결성 실패:** verified backup/lease/owner/phase와 기존 독립 rollback 경로에 한해 복구. 이미 보관된 원본 lease와 완료 claim 보존.
6. **결과가 끝내 불명확:** `UNKNOWN/STATE_UNKNOWN/RECOVERY_REQUIRED`로 정확한 대상에만 남기고 원래 성공을 주장하지 않는다.

## 5. 복구 패키지 실행 전 준비 검사

복구가 필요해진 뒤에야 도구/source/파일 상한을 발견하지 않도록, **기존 패키지 제작·검증 단계**에서 준비성 검사한다(운영 적용 효과와 분리).

| 검사 | 정규 확인 |
|---|---|
| source Git 객체 | 승인 source SHA와 정확한 필요한 객체 존재; 실제 ancestry 검사에 사용될 저장소·호스트의 Git graph 기준 확인 |
| 의존 모듈·파일 | 정확한 정규 경로와 승인 manifest 파일 SHA-256; 필수 import closure; 운영 원본 임의 다운로드/수정 금지 |
| 원본 파일 안전성 | regular file, no symlink, `nlink===1`, 승인된 파일별 크기·raw bytes SHA 검증 |
| 크기 허용 범위 | PR #3508의 `tools/update.mjs` 한정 262144 bytes와 나머지 기본 131072 bytes, 새로운 파일은 실제 전용 계약에 따라 판정. **전 파일 상한 일괄 확대 금지** |
| 독립 운영자 | 승인된 운영자 계보·작업 경로·Git hook 격리(`GIT_CONFIG...core.hooksPath` 등 기존 정상 계약), 일반 Actions checkout을 독립 실행으로 대체하지 않음 |
| 결과 경로 | 단회 requestId/Issue, 실행 기록·로컬/원격 결과 JSON/TXT, 중지/불명 후 reconcile 경로가 예측 가능해야 함 |
| 무영향 검사 | 준비 확인 단계에서 설치 파일, 원본 lease·DB·D1·Core/Writer·Workflow를 변경하지 않음 |

실패하면 정확한 패키지 준비 단계의 코드를 남기되 설치 자체가 실패했다고 보고하지 않는다. 실행기 해시·승인 기준·원래 상태를 안전하게 보존한다.

## 6. 집중 시험·반증 기준

| 번호 | 시험 조건 | 기대 결과 |
|---|---|---|
| T01 | 생성 API에서 `pc-job` 라벨 포함 | 기존 `opened` 계약으로 실행 진입 가능, Issue/Run 상관키 정확 |
| T02 | 지연 라벨/opt-in 미활성 | `labeled` Job 임의 실행 금지 |
| T03 | Workflow 재개 직후 후검사 | 생성·실행·upload까지 서로 다른 단계를 구분; Run 부재를 임의 플랫폼 원인으로 단정하지 않음 |
| T04 | 원본 Issue 있음, 해당 Run 없음 | `NO_RUN`, 중복 original requestId 재실행 없음 |
| T05 | Run 있음, 조건 skip | `SKIPPED_GATE`, 요청을 설치 실패로 보지 않음 |
| T06 | Job queued 또는 busy Runner | `RUNNER_QUEUE`/RUNNING 확인, 불필요 전원 Idle 검사 없음 |
| T07 | entry 요청 거부 | `ENTRY_REJECT` + 설치 SHA/허용목록/7-key 계약 대조 |
| T08 | Job 완료·업로드 누락 | 기존 로컬 영수증 회수, 작업 재실행 없음 |
| T09 | 뒤늦게 도착한 원래 성공 결과 | 동일 requestId 중복 효과 차단, 늦은 영수증만 기록 |
| T10 | 원래 B 설치 정상·postcheck UNKNOWN | 독립 정합 복구와 과거 UNKNOWN 보존 |
| T11 | 실제 설치 손상/다른 source | 승인된 복원 경로만 선택, 정상본 덮어쓰기 금지 |
| T12 | 승인 Git 객체/ancestry 누락 | 패키지 단계에서 분리 실패, 운영 변경 없음 |
| T13 | 정상 파일 128KiB 초과~256KiB 이내 `tools/update.mjs` | PR #3508 허용 정책에서 PASS |
| T14 | 위 파일 256KiB 초과·타 파일 128KiB 초과 | 해당 파일만 정확히 BLOCKED |
| T15 | 해시 변조/심볼릭 링크/하드링크 | 기존 검증대로 안전 거부 |
| T16 | 실제 Run/Job/원격 pair 및 로컬 링크 조회 | exact Issue/Run/Job/requestId 일치; source metadata 동일과 Git commit 존재 구분 |
| T17 | 기존 Controller 업데이트/복구 회귀 | 승인된 B/C/maintenance/rollback/Runner 보호 및 결과 회수 정상, 신규 전역 Gate 없음 |

테스트는 영향받은 기존 단위/통합/CI를 우선 재사용한다. fixture만으로 GitHub 서버 실제 이벤트 등록 성공을 입증했다고 하지 않는다. 변경된 이벤트 진입 경로가 실제로 있다면 **새로운 운영 목적의 설치를 만드는 것이 아니라**, 승인된 실환경에서 원래 목표에 필요한 한 번의 제한된 end-to-end 증거만 확인한다. 이미 #3587/#3590/#3598의 유효한 동일 범위 검증은 재사용한다.

## 7. 단계별 실행 및 현재 판정

| 단계 | 범위 | 현재 증거 / 처리 |
|---|---|---|
| S1 실제 원인·경계 식별 | #3410 원본 Run 미확인과 별개 원인(소스 부재, 파일 크기), 안전한 UNKNOWN | **DONE (사고별 확인)**, GitHub 서버 내부 이벤트 전달 메커니즘은 **미확정** |
| S2 정규 독립 정합 복구 | 기존 설치 보존, 원본 lease archive, 후검증 | **DONE**, #3409 운영자/ #3509 실제 영수증 |
| S3 크기 결함 수정 | 파일별 상한·해시·링크 정책 | **DONE**, PR #3508 병합/시험 |
| S4 실제 후검사 생성·Run·Job·결과 연결 | 새 정상 B의 생성·진입·실행·전달 확인 | **DONE (관측 범위 한정)**, #3587 B / #3590 Run·Job·JSON/TXT |
| S5 로컬 원장 연결 상태 확인 | `reportedRunJobLinked` 실제 readback | **DONE**, #3598 PASS 및 #3591 병합 |
| S6 재발 방지 표준화 | 이 문서에 정확한 판별·패키지 제작·회귀시험·안전 정본 고정 | **이번 문서 반영**; 일반적인 향후 모든 설치의 실운영 성공을 가정하지 않음 |

**완료 판단:** #3409 재발 방지의 알려진 코드·복구·후검사 연결 개선은 실제 운영 증거가 있는 범위에서 완료되었다. 새로운 #3409 재실행·재설치·재승인은 불필요하다. 미래에 다른 controller 업데이트에서 **새로운 실제 실패**가 관측될 때만 해당 실패 조건과 연결된 작은 수정·검증을 수행한다.

## 8. 적용·보호·보고 원칙

- #3409과 #3410의 역사 원본(원장, Run 부재 기록, archived lease) 보존; 완료 Issue/PR을 형식상 재오픈하지 않는다.
- 변경 효과가 필요한 경우 현재 설치된 source SHA, 승인 범위, 정확한 파일 CAS, lease·backup/recovery, 단일 적용 책임을 검증한다. 코드를 병합했다고 PC 설치 완료라고 표시하지 않는다.
- 승인 없는 reset/clean/rebase/강제 push/`git add .`, 임의 shell/SQL/다운로드로 안전 검사 우회, 무관한 DB/D1/공급자/Cloudflare/예약 변경 금지.
- 새 연구·전역 Gate·매번 별도 A 후검사 Issue를 #3409 완료조건으로 추가하지 않는다. 기존 정상 작업은 계속 진행한다.
- 실제 보고는 (1) 결함과 미확정 범위, (2) 수정 파일·커밋·PR, (3) 단위/CI/운영 증거, (4) 제거된 반복 실행, (5) 현재 직접 영향 있는 미해결만 남긴다.

**요약:** 문제를 더 빨리 차단하는 것이 아니라, 각 단계의 실패 위치를 구분하고 정상 설치 상태를 보존하면서 결과를 회수·정합 복구하는 방식으로 운영한다.
