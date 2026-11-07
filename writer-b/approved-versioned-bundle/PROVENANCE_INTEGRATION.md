# 기존 승인 Runner 결과와 runtime 호환성 증거 — source-only 연결 후보

## 현재 main의 실제 근거

- `.github/workflows/pc-job.yml`: `issues.opened`, owner와 `pc-job` 최초 이벤트 승인 조건, self-hosted Windows runner. 고정 `controller/entry.mjs`, 이후 `controller/upload.mjs` 실행.
- `controller/entry.mjs`, `controller/engine.mjs`: `GITHUB_RUN_ID`, attempt, Runner seat 및 요청 identity를 바탕으로 PC 로컬 원장/보고서 생성. 보고서 `jobId`, `controlSourceSha`, `requestedSourceSha`, `operation` 존재.
- `controller/report-upload-verified.mjs`, `controller/upload.mjs`: `results/<run>-<attempt>-seat-<seat>.json/.txt`를 **GitHub Contents main**에 순차 생성/GET 재독. `upload-artifact` 기반 Actions artefact가 아님. 최초 생성 시 `.json`과 `.txt`가 서로 다른 commit일 수 있으므로 두 파일 모두 포함된 **동일 불변 commit SHA**에서 읽어 검증해야 함.
- `config/operations.json`: 기존 A allowlist는 fixed operations이며, old→new/new→old 격리 DB/checkpoint 호환성 fixture 실행을 증명하는 정규 operation은 현재 없음. `mutationsEnabled:false`, `artifactUploadEnabled:false`와 결과 크기 제한 존재.
- 현재 보고서가 `SUMMARY_ONLY`이면 원본 상세 일부는 PC ledger에만 있으며, GitHub 결과의 SHA는 그 상세 실행 사실을 증명하지 않음.

## 이번 후보가 검증하는 범위

`runner-result-provenance.mjs`의 `verifyExistingPcRunnerTransport`는 **신뢰된 read-only GitHub API**를 주입받아 아래를 교차검증한다.

1. 승인된 workflow 파일 자체를 run `head_sha` 불변 ref에서 바이트 재조회하고 승인 SHA256 대조.
2. workflow run `issues`/owner/repo/main SHA/attempt/완료 success, 실제 Windows self-hosted seat 및 고정 entry/upload job step success 확인.
3. 해당 issue 소유자와 번호 확인. **현재 mutable labels로 과거 승인 결정을 재구성하지 않음.**
4. 승인된 불변 결과 commit에서 JSON/TXT 두 파일을 재조회하고 각각 Git blob OID(SHA1)와 로컬 raw SHA256를 검증.
5. JSON의 requestId, chatId, source SHA, controller SHA, operation, run/attempt/seat 확인. TXT는 실제 main 렌더 방식으로 JSON과 바이트 일치 검증.

위 조건을 모두 만족해도 반환 결과는 오직 `GITHUB_TRANSPORT_VERIFIED_NO_RUNTIME_PROOF`이며 `activationAllowed:false`. Issue JSON, 사용자가 제공한 hash, self-reported `PASS`, GitHub run success 어느 하나도 runtime 실행 실증으로 승격하지 않는다. 이 검증기는 네트워크를 직접 열지 않고 운영 파일을 건드리지 않는다.

## 실제 활성화에 필요한 기존 Runner 증거 차이

| 증거 | 현재 main | 활성화 판단 |
|---|---|---|
| Workflow/Runner/결과 JSON·TXT identity | 검증 가능 | 보고서 전달 경로만 증명 |
| PC에서 old/new 실제 시작된 프로세스·진입점·소스 SHA | 정규 호환 fixture 없음 | 확인 전 BLOCK |
| 격리 DB/checkpoint 양방향 old→new, new→old 읽기 | 정규 호환 fixture 없음 | 변경된 runtime closure면 필수 |
| `wx` 동일 lock·예약 경계·중복 실행 없음 | 일부 source fixture | 실PC 경쟁·Task 증거 전 BLOCK |
| 공급자 API/D1/운영 DB 쓰기 0 | 기존 A 보고 필드는 있지만 fixture 없음 | 실행 경계 원장 필요 |
| 원시 transcript SHA와 승인 고정 harness/run/원장 결속 | 현재 전달 계약에 없음 | hash 단독은 증거 아님 |

### 차이가 없는 파일 fast path

old/new **실행과 결과에 영향을 주는 전체 closure**가 실제 PC의 승인된 같은 lock 기준으로 바이트 재독되고, imported files·런처·Task·Node flags·env/config·데이터 위치·경로 민감성까지 등가이며 숨은 dynamic dependency가 없다는 증거가 있다면 격리 양방향 실행 부담을 줄일 수 있다. 단 `sourceSha`나 self-reported file-list hash가 같다는 이유만으로 허용하면 안 된다. 현재 main A는 전체 실PC closure 조회·lock 아래 동일성·실제 프로세스 증명을 제공하지 않으므로 **현 시점 fast path도 운영 활성화 불가**.

### 다음 최소 공통 연결

1. 기존 승인 Writer/Runner를 통하여 **고정된 하나의 공용 offline compatibility evidence operation**이 허용되는지 권한 범위를 확인한다. 기능별 CMD나 승인 키는 만들지 않는다. A read-only 범위를 초과하면 정규 B 승인으로 등록; 임의 실행 금지.
2. 고정 harness(기존 승인 실행기 SHA pin)에서 old/new 파일·config·Task 정확한 preimage 및 격리 state cross-read, `wx` 경쟁 테스트, 네트워크/D1/production DB zero를 실행하고 실제 stdout/stderr·프로세스 exit·원장과 raw transcript를 requestId/runId/source SHA에 결속한다.
3. 기존 GitHub result pair에는 고정 operation ID, harness SHA, raw transcript SHA, 실제 종료 결과, 상세 ledger identity만 필요한 범위로 포함하고, 원본은 기존 승인 비공개 회수 경로로 읽는다. raw hash와 run 성공만이 아니라 **정해진 harness에서 실행된 원장·프로세스·격리 DB 결과**를 독립 대조한다.
4. 이 연결 실증 후에만 `theme-generic-b/runtime-compatibility-evidence.mjs`의 `activationAllowed:false` 해제를 검토한다. 기존 A 정보성 PASS, `SUMMARY_ONLY` 및 정적 mock 시험을 실운영 승인으로 해석하지 않는다.

권한과 운영 연결은 미획득. 이번 산출물은 **source-only preproduction**이며 자연 13:00 예약 검증은 요구하지 않는다.
