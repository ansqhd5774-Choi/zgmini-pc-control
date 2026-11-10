# #996 C급 복구 — 원본 Windows 실행기 개발 현황 (2026-11-10)

## 최신 승인·실행 상태 (2026-11-10 05:21:34 UTC 이후)

- **C급 한정 승인 등록 완료:** 원본 Issue [#996 승인 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6759732782), 댓글 ID `6759732782`, 작성자 `ansqhd5774-Choi` / GitHub `author_association=OWNER`, 작성 시각 `2026-11-10T05:21:34Z`. 승인 표식 1개, 철회 표식 0개. 승인 명세는 불변 Git 커밋 `7cff08e…`에 고정되며, 전체 파일 SHA256 `05bf8aa72b438b69d7c86f8798a72ec2c12fe3537489f2153069dabfe0695e7b`를 댓글에서 수락했다. **원본 Windows에서의 인증 GET·실제 운영 실행은 별도 미실시**다.
- **유효 승인 범위:** `RECONCILE_INTAKE_PAUSED_ONLY`, 최초 원본 Windows PC의 단회 C 복구. 역사적 `workflowDisableActorVerified=false` 및 `protectedBaselineVerified=false`와 다른 행위자의 전체 보호 불변성 미입증 상태를 그대로 수락한다. 이를 `true`로 변경하거나 Controller `9db6fff...` 설치 권한으로 확대하지 않는다.
- **실제 운영 실행 0건:** 이 승인 댓글은 PC 작업을 자동 실행하지 않는다. `pc-job` Workflow는 원래 복구 대상이므로 실행 진입점이 될 수 없고, 기존 Actions 경로는 production native 모듈이 명시적으로 거부한다. **원본 Windows 직접 실행용 CLI/CMD 소스는 작성됐으나 설치·운영 실증 전**이다. 별도/블로그 Runner 우회 금지.
- **증거 출처 보완:** 원본 과거 R1·R2 전체 JSON을 테스트 fixture로 재구성해 운영 증거로 쓰지 않는다. 불변 Git manifest·소유자 승인 댓글을 검증한 뒤 고정 7개 원본 SHA와 현재 R2의 존재/부재·Task 2개를 대조하고, 최초 변경 직전 원본 Windows에서 실제 R1/R2를 **새 시각으로** 독립 재조회하는 방식으로 수정하였다. 승인 직후 Workflow PUT 전 승인 철회 재확인 및 세 단계 Claim nonce/PID 사후 검증도 추가하였다.
- 아래 단계별 개발 이력에 기록된 “owner 승인 없음”, 과거 테스트 개수, “실행기 미연결”은 **각 작업을 수행하던 당시의 상태**다. 현재 승인·연결·운영 판정은 이 최신 상태와 아래 표의 수정된 상태를 우선한다. 운영 완료 판정은 여전히 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`와 최종 독립 Windows 검증을 요구한다. 전체 실증 진행률은 **4/5 = 80%** 유지.

## 목표 및 정밀 진행률

- 대상: 기존 **원본 Windows PC** `E:/ZGmini`, Issue #996 / `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`.
- 목적: 설치된 Controller `badad9124157879d7a645b64f2768113d632355b` **그대로** 유지하면서 중단된 `pc-job` 접수와 원본 #996 잠금을 안전하게 정리. Stage 대상 `9db6fff...` 설치는 중단한 것으로 기록.
- 총 프로젝트 실증: 4/5 = **80%**. 이 문서·코드가 실운영 복구나 5단계 완료를 의미하지 않음.

## 코드별 최신 상태 (이하 상세 개발 이력의 수치는 기록 당시 기준)

| 파일 | 구현된 범위 | 운영 단계 |
|---|---|---|
| `controller-996-windows-observer.mjs` | 원본 설치/Stage/원장/GH/6전용 Runner, 원본 16/18 증거 | 실제 읽기 관측 완료 |
| `controller-996-protection-attestation.mjs` | 최초 관측과 동일하게 존재하는 Writer 파일(최대 3개)만 해시 집계하고, 2개 Task XML 해시·enabled 상태 대조. 누락 Writer·Task별 실패 위치 명시 | 실제 원본 PC R2 **현재 지문 일치** 수신. 역사 기준은 여전히 미입증 |
| `controller-996-c-consent-verifier.mjs` | GitHub 원본 Issue 작성자·고정 Git manifest 원문·소유자 승인 댓글 SHA 바인딩·철회/중복 차단. R2의 Writer **PRESENT/ABSENT 3개 상태**와 **실제 존재 파일의 SHA만** 승인 객체에 바인딩 | Owner의 SHA 고정 승인 댓글 **등록 완료**. 원본 Windows 네이티브 인증 GET·C 실행은 미실시 |
| `controller-996-native-claims.mjs` | 원본 PC 전용 별도 claim 원자 생성, nonce·영구 시도 마커·원본/자기 claim 보관 | 실제 I/O 하위 부품. 별도 CLI 소스와 연결됐으나 **원본 PC 미설치·미실행** |
| `controller-996-native-workflow.mjs` | 사전 영구 `WORKFLOW_ENABLE_ATTEMPTED`, 같은 프로세스 1회 PUT, 재시작·타임아웃 시 자동 재시도 차단 | 네이티브 단일 실행기 **소스에 연결**, 실제 Workflow PUT은 0건 |
| `controller-996-native-backlog.mjs` | 원본 E: 고정, 최초 backlog SHA, 영구 `BACKLOG_CLOSE_ATTEMPTED`, Temp fsync·변경 전 2회 SHA·단회 rename·완료 SHA/구조 재조회 | 네이티브 실행기에 Writer 가드와 **소스 연결 완료**, 원본 PC 운영 실행 0건 |
| `controller-996-c-transaction.mjs` | 18단계 순서·실패 중단 시뮬레이터, 원본 16/18과 Writer 3경로 존재 상태·존재하는 파일 SHA·필수 Task 2개 SHA 계약 | 테스트 전용, **운영 호출 금지** |
| `controller-996-backlog-plan.mjs` | 원본 이슈 분류, 같은 requestId 재게시 금지 | 읽기 전용, **실제 resume 전 목록 미수신** |
| `controller-996-backlog-readback.mjs` | `created_at` 내림차순 전체 관련 페이지 2회 동일성 검증, PR 배제, 댓글 전 페이지, bot marker별 JSON/TXT 원격 내용·requestId·runId·seat·TXT 동일성 검증 | 호출 가능한 읽기 전용 부품. **인증 GitHub GET 어댑터 소스 준비, 실제 원본 목록·C 연계 미실행** |
| `controller-996-native-github-readonly.mjs` | **기존 원본 PC 전용** 설치 manifest·GitHub 로그인 주체·비공개 제어 저장소 검증 후 고정 Issues/댓글/결과 쌍 GET만 허용. 자격증명 노출·POST·Workflow PUT 경로 없음 | 소스+테스트 검증, 실제 원본 PC 인증 호출 **미실행** |
| `controller-996-native-consent-reader.mjs` | 인증 GET 포트로 **원본 #996**, 승인 manifest의 **정확한 Git 커밋 콘텐츠**, 승인 댓글 전 페이지를 조회. Base64 size·Git blob SHA1·댓글 중복/불완전 목록을 검증하며 `review996CConsent`에 넘길 읽기 전용 원문 증거 생성 | 승인 manifest·owner 댓글 GitHub 등록 확인. 원본 PC에서 네이티브 인증 GET **미실행** |
| `controller-996-native-approval-readiness.mjs` | 서명된 원본 Git manifest·owner 댓글을 검증하고 실제 과거 R1 7 SHA와 R2 Writer 상태·Task 2개 SHA/enabled의 고정 핀을 비교. 과거 R1/R2 전체 JSON을 테스트 fixture로 조립해 운영 실측처럼 주입하지 않음 | 읽기 전용 검증 소스 완료. 신규 실PC 재측정은 별도 `native-fresh-preflight`, 운영 C 실행 미실시 |
| `controller-996-native-fresh-preflight.mjs` | 원본 승인 R1/R2의 역사적 시각을 유지하고, 새로운 원본 Windows 실측의 7 raw SHA·16개 정상 검사·보호 Task 2개 활성화 확인. 자기 Claim 생성 이후는 자기 nonce/PID를 검증하면서 기존 Claim 부재 조건 하나만 예외 처리 | 실행 전/Claim 직후 전용 읽기 모듈. 실제 C 진입점과 운영 재측정은 **미완료** |
| `controller-996-native-postcheck.mjs` | `BACKLOG_CLOSED`·`ORIGINAL_LEASE_ARCHIVED`·`FINAL_ARCHIVED` 각 단계에서 경로별 원본 lease SHA·자기 Claim/영구 마커·원본 정적 파일 4개 SHA·Backlog 신규 SHA/종료 상태·GitHub Workflow active·현재 R2 지문과 Task enabled를 독립 재조회. 변경 전제와 충돌하는 옛 R1/활성 Claim 전용 검증 함수 재사용 금지 | **물리 상태 확인만 수행하는 읽기 전용 소스**. 원본 GitHub 개별 Job 결과 확인은 단일 실행기의 별도 단계가 담당. 실PC 검증 미실시, 성공해도 `executionAuthorized=false` |
| `controller-996-native-operator.mjs` | **원본 Windows C 단일 실행기 소스 후보**. 고정 GitHub 원문 승인 → 최신 R1/R2 → 자체 Claim → 영구 마커·단회 Workflow PUT → 현재 보호/GitHub 인증 재조회 → Writer guard 2회 포함 Backlog 단회 close → 원본 Issue/JSON·TXT 재조정 → 단계별 Postcheck → 원본/자체 Claim 순차 보관을 실제 하위 부품 API 반환값에 맞게 연결 | **승인 manifest·댓글 등록 확인**, CLI 소스 연결, 미배포·실제 원본 실행 0건. 테스트 포트는 비 Windows 격리 TEMP에서만 허용. 원본 Windows 통합 검증 및 독립 최종 재조회 미완료 |
| `controller-996-native-cli.mjs` / `RUN_996_NATIVE_C_ONCE.cmd` | 원본 Windows 설치된 Node·E: 경로·현재 유지보수기 소스·직접 대화형 확인 문자열을 검사하는 단회 C 진입점 후보. 인자·Actions·Runner 우회 거부 및 결과 영수증 출력 | **소스 구현, 원본 PC 미배포·미실행**, 별도 설치 무결성/실제 Windows 사후 확인 필요 |
| `controller-996-native-writer-gate.mjs` | 원본 PC 고정 5개 초기 파일 SHA, 사망 owner·원본 install lease, 현재 C claim nonce/PID, 설치된 유지보수기 7개 파일의 실제 SHA와 커밋 Git 원문 대조. 백로그 변경 직전 호출 시 해시 변동 즉시 중단 | **협조적 Writer만** 배제하는 읽기 전용 소스 부품, 실제 C 연결·원본 PC 검증 **미실행** |
| `controller-996-r2-evidence-review.mjs` | 실제 R2 개별 SHA·존재/부재·Task 활성 상태로 최초 64자리 fingerprint 재계산 및 완료/승인 오인 차단 | 사용자 전달 R2 값 재계산 PASS, 실운영 재실측은 아님 |

2026-11-10 최종 소스 묶음 확인 시점 #996 대상 회귀 **175/175 PASS**. CLI → 17개 의존 모듈과 각 Git 소스의 실제 SHA 바이트 검증, 원본 Controller·Stage·유지보수기 최종 재해시를 추가했다. 운영 `Workflow` PUT, PC lease 보관, backlog 갱신, 설치, Issue 재게시 등 실제 효과 **0**. 소스 브랜치는 미배포 Draft PR #1222.

### 이전 개발 이력 — 추가 관측 R1 ENOENT 진단 및 R2 보완

> 이 절부터 ‘승인 명세 후보 작성’까지의 테스트 수와 승인·실행기 상태는 **각 단계 작업 당시의 기록**이다. 현재 상태는 문서 맨 위의 최신 승인·실행 상태와 코드별 최신 상태가 우선한다.

- 실제 원본 PC에서 `ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1`, `STATE_UNKNOWN`, `code=ENOENT`가 수신되었다. 운영 쓰기·Issue 게시·PC 재시도는 모두 0. **이 결과만으로 미존재 대상 파일·Task를 확정할 수 없다.**
- 결함: 최초 R1 관측기는 Writer `config.json`·`quota-runner.cmd`·`run-local.cmd`를 **존재할 때만** 집계하였으나, 별도 세부 검사 초판은 3개 모두 필수로 `lstatSync`하여 부재 시 단계 정보 없이 `ENOENT`로 중지했다. 동일 객체의 fingerprints를 비교하려면 두 검사기의 존재/부재 규칙이 같아야 한다.
- R2는 부재 Writer를 `ABSENT`라고 표시하고 최초 집계와 동일하게 SHA 객체에서 제외한다. 기존에 존재하던 파일이 사라졌으면 집계 지문이 달라져 성공 판정 불가. Task는 여전히 2개가 모두 검증돼야 하며, 실패 시 `PROTECTED_TASK_QUERY_FAILED`와 정확한 Task명·기초 오류 코드를 출력한다. Writer 읽기 자체 실패도 `WRITER_FILE_OBSERVATION_FAILED`와 정확한 대상명을 출력한다.
- R2는 역사적 기준이 없다는 사실을 바꾸지 않는다. `historicalBaselineAvailable=false`, `allActorsImmutableProven=false` 및 C 실행 미승인은 그대로다. **원본 PC R2 결과는 이미 수신·검증했다.** 기존 R1 ZIP 재실행 또는 동일한 R2의 불필요한 재실행 금지.

### 원본 Windows R2 실제 수신 및 재계산 (2026-11-10T04:06:43.338Z)

- Schema `ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1`, `CURRENT_ITEMS_MATCH_OBSERVATION`. 원본 요청 및 #996 확인. R1 원본 보호 지문과 현재 지문 양측 모두 `877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86`.
- Writer: `config.json` **PRESENT** SHA256 `0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453`; `quota-runner.cmd`와 `run-local.cmd`는 **ABSENT**. 최초 관측기 규칙에 따라 부재 2개는 해시 객체에 넣지 않음. `presentWriterFileCount=1`, `allFivePresent=false`를 그대로 보존.
- 보호 Task: `ZGMINI-PC-Local-Core` SHA256 `dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028`, `ZGMINI-PC-Local-Korea` SHA256 `1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1`, 둘 다 `taskEnabled=true`.
- 별도 순수 검증기에서 **개별 SHA 3개 → 원본 전체 SHA256 재계산 일치**; 위변조·존재 오인·Task 불명·승인 오인 실패 테스트 5/5 PASS. 이 검증은 사용자 제출 JSON의 내부 일관성만 확인한다. 실제 원본 PC를 인증된 재조회로 확인한 것은 아님.
- 역사적 부재 `historicalBaselineAvailable=false`, `allActorsImmutableProven=false`, Workflow 중단 행위자 미입증은 유지. 해당 미입증 항목을 true로 뒤집지 않으며 C 승인은 별도로 받아야 함. R2 실행의 `operationalWrites=0`, `issuePosts=0`, `pcRetries=0`, `executionAuthorized=false`.
- **협조적 Writer만 배제 가능한 범위:** 기존 `controller-install` 원본 마커·owner 사망·digest와 C 별도 claim·설치 소스 상호 확인, 백로그 원본 SHA 및 변경 직전 SHA를 독립 재확인. 외부 비협조 Writer·TOCTOU까지 절대 배타성을 주장하지 않는다. 원본 설치 lease는 백로그 읽기/결과 분류 완료 전에 보관하지 않는다.
- **실패 방지 변경:** 기존 `c-consent-verifier`/`c-transaction`은 Writer 3개 모두 존재·해시가 있다는 비현실적인 전제를 사용했으므로, 실제 R2(`1 PRESENT`, `2 ABSENT`)를 복구 전 검증에서 영구 차단했다. `protectedWriterFileStatus`를 승인 manifest에 명시하고 `protectedItemsSha256.files`에는 `PRESENT`인 파일만 넣도록 계약을 일치시켰다. 부재 경로에서 임의 SHA를 만들거나 임의로 파일을 설치하지 않는다. 신규 정상/실패 테스트 각 1건 추가, 전체 97/97 통과. 이 조치는 실제 복구나 승인 획득이 아니다.

### 이전 개발 이력 — 원본 GitHub 인증 GET 및 협조적 Writer 범위

- 원본 PC 전용 GitHub GET의 허용 경로를 정확한 `issues/996`, `issues/996/comments?per_page=100&page=N`, `contents/docs/CONTROLLER_996_C_APPROVAL_R1.json?ref=<40자리 SHA>`까지 확장했다. 원본 Git blob 바이트·Base64·Git blob SHA1·크기, 전체 댓글 페이지·중복 ID·승인 작성자 여부를 분리 검증한다. **승인 댓글이나 manifest를 자동 생성하지 않는다.**
- 원본 Controller 코드의 협조적 Writer 진입은 `controller-install` lease의 EEXIST로 차단됨: 일반 업데이트, R6 Host 신규 적용, Source Bundle, R54 B 적용, maintenance-agent 자동 진입. R6 Host 수동 복구는 같은 `controller-recovery` claim을 획득하므로 #996 별도 claim과 상호 배타적이다.
- `makePorts()` 직접 사용 및 외부/구버전 비협조 Writer는 해당 설치 잠금에 의한 보장이 없다. 따라서 `proveExclusiveWriter`는 **검증된 현재 설치 코드가 협조하는 Writer 경로만** 확인한다. 원본 install lease SHA와 dead PID, own claim nonce·PID, 설치 원문 소스 무결성, backlog SHA, 다른 recovery claim 부재, 최종 rename 직전 재확인 중 하나라도 불확실하면 중단한다. OS 수준의 완전한 CAS·전역 배타성을 주장하지 않는다.
- 새 GET 어댑터의 가짜 네트워크 응답·Git blob 변조·404·댓글 중복·페이지 오류 회귀 후 전체 **103/103 PASS**. 실제 원본 PC 읽기 호출과 원본 영구 쓰기 **0건**, 다음 소스 검증 없이 운영 C를 실행하지 않는다.
- 독립 `controller-996-native-writer-gate.mjs`를 추가했다. 기존 R1 raw SHA 다섯 개를 고정하고, 실제 C claim nonce/PID 및 원본 owner 사망, 현재 설치 `MAINTENANCE_INSTALL.json` 7개 관리 source와 Git 원문을 다시 확인한다. 성공해도 모든 외부 프로세스의 OS 수준 독점성을 뜻하지 않으며, 오직 **정상 설치된 협조적 Writer 경로의 차단 근거**로만 사용한다. 원본 ledger/lease/marker/backlog source drift·symlink·owner 재활성화·내 claim 이탈·현재 설치 소스 변경 실패 케이스 포함 추가 8개 테스트, 전체 **111/111 PASS**. 최종 backlog rename 전에 동일 함수를 재호출하는 기존 `native-backlog`의 삽입점에 연결 가능하지만 운영 승인·실PC 연결은 아직 없음.
- `controller-996-native-approval-readiness.mjs`는 위 증거가 갖춰질 경우 **R2 보호 상태 검증 → SHA 바인딩된 owner 승인 검증 → 원본 R1과 C 계약 검증**을 합성해 `READONLY_APPROVAL_AND_R1_R2_CONTRACT_REVIEWED`만 반환하도록 추가했다. 가짜 승인 fixtures, 승인 누락, R1/R2 값 변조, 역사적 미입증 항목 삭제, PC·네트워크 운영 호출 존재 검사를 각각 통과했다. 추가 **4건**, 전체 **116/116 PASS**. 유효한 테스트용 승인도 운영 실행 권한을 발급하지 않는다.
- 독립 소스 검토 후 실제 R2에서 **두 보호 Task 모두 enabled=true**였던 조건을 `r2-evidence-review`, `c-consent-verifier`, `c-transaction`에 명시했다. Task가 disabled로 바뀐 상태를 승인 manifest 안에 거짓으로 동기화해 통과시키는 경로를 차단한다. 테스트 승인 댓글은 실제 owner 승인이 아닌 **synthetic fixture**이며, 합성 검증은 인증된 원본 Windows 최신 재조회 없이 실행 권한이 되지 않는다.
- **단계별 검증 충돌 해소:** 승인용 R1/R2 역사 관측과 실행 직전의 새 관측은 시각이 달라야 정상이다. 기존 R1 프로브의 복구 Claim 부재·Workflow 비활성·Backlog 미종료 조건은 전체 과정에 재사용할 수 없다. 신규 `native-fresh-preflight`는 첫 쓰기 전 원본 16/18·7 SHA·보호 Task 2개를 대조하고, Claim 생성 직후는 자기 nonce/PID만 인증해 해당 1개 체크를 예외로 허용하되 다른 정상 체크는 유지한다. 시각 역전·소유권 이탈·상태 drift 오류 주입 등 신규 **7/7 PASS**, 전체 **123/123 PASS**. Workflow/Backlog 변경 후에는 별도 단계별 사후 재조회가 필요하다.
- **단계별 독립 사후 검증 구현:** `controller-996-native-postcheck.mjs`는 Workflow 활성화·Backlog 종료·두 lease 순차 보관이라는 각 단계의 **변경된 정상 상태**에 맞춰 원본 Windows 파일/마커/보호 Task/Workflow GET을 독립 재조회한다. 최종 보관 후에는 활성 자체 Claim을 요구하지 않으며, 이전 원본 owner가 계속 비활성인지 검사한다. 원본 SHA·마커 nonce·Backlog 신규 SHA·Workflow 상태·Task disable·보관 경로 오류 주입 신규 **7/7 PASS**, 누적 **130/130 PASS**. 다만 이는 물리상태 증명으로 한정되며, 원본 GitHub `pc-job` 결과 재조회에서 **개별 미확인 Job을 성공으로 단정하지 않음**. 본 검증만으로 GitHub 재조정·C 트랜잭션·실제 Windows 복구 완료를 선언하지 않는다.
- **원본 실행기 소스 최초 결합 (당시):** `native-operator`는 시뮬레이터의 무조건 boolean 포트를 실제 Claim owner/ticket/Backlog SHA/단계별 상태 영수증으로 분리했다. 실제 원본 GitHub GET의 C 승인 명세·소유자 댓글을 **첫 쓰기 전에** 검증하고, PUT 직전에 GitHub 원본 계정·private repo·설치된 협조 Writer 7개 소스 Git 원문·보호 R2·Workflow disabled 상태를 다시 검증한다. Backlog 종료 뒤 GitHub 주체를 **재인증**한 후 전체 Issue/JSON·TXT 읽기 결과에서 **검증된 PASS와 미확인·실패 재계획을 구별**해 COMPLETE marker에는 건수·해시만 기록한다. 중단 시 자동 재시도/자동 롤백/Issue 새 게시 없음. 격리된 test-only 정상 및 Claim mkdir 실패, PUT 직전 source drift, PUT ACK 손실, Backlog rename 불명확, GitHub 조회 실패, 양측 lease archive 이후 확인 실패 등 **13/13 PASS**, 당시 누적 **143/143 PASS**. 당시 승인과 실제 Windows 복구는 아직 없었고, 이후 승인 댓글이 등록됐다.
- **승인 명세 후보 작성 (댓글 등록 이전):** `docs/CONTROLLER_996_C_APPROVAL_R1.json`에 실제 R1 raw SHA 7개·R2 존재 Writer 1개/부재 2개·Task SHA/enabled 2개 및 C effect 6종을 정확히 고정했다. 후보 SHA256은 `05bf8aa72b438b69d7c86f8798a72ec2c12fe3537489f2153069dabfe0695e7b`. **파일 내부 `approved:true`만으로는 소유자 승인이라고 보지 않는다.** 이 단계에서 아직 없던 불변 Git commit·소유자 수락 댓글은 이후 등록·확인됐다(상단 최신 기록 참조). 당시 실제 댓글 없음→실행 승인 거부와 합성 단회 댓글→구조 검증 등 신규 **4/4 PASS**, 누적 **147/147 PASS**.

## 승인 출처 — 최신 경계

1. C급 한정 승인 명세 `docs/CONTROLLER_996_C_APPROVAL_R1.json`은 불변 Git 커밋 `7cff08e…`와 전체 바이트 SHA256 `05bf8aa72b438b69d7c86f8798a72ec2c12fe3537489f2153069dabfe0695e7b`에 고정됐다. 파일 내부 `approved:true`만으로는 실행 권한을 뜻하지 않으나, 아래 소유자 수락 댓글은 별도로 확인됐다.
2. 원본 Issue #996의 작성자 `ansqhd5774-Choi`가 정확한 명세 SHA256을 수락하는 [단일 댓글 `6759732782`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6759732782)을 게시했다. 현재 C급 승인 표식 1개, 철회 0개. 추가로 새 댓글을 요구할 필요는 없다.
3. **운영 실행 시에는** 원본 Windows의 인증된 GitHub GET로 실제 작성자·댓글 시각·철회 여부·불변 커밋 원문 및 R1/R2 고정 값을 새로 검증한다. 이 실행 전 재조회는 아직 하지 않았으므로 운영 결과와 구분한다.
4. `review996CConsent()`와 승인 Readiness는 여전히 `executionAuthorized:false`를 반환한다. 실제 C급 변경은 네이티브 오퍼레이터에서 원본 Windows 실측과 단회 실행 조건을 충족해야 하며, 별도 Workflow 재실행·설치·원본 요청 재게시 권한이 생기는 것은 아니다.

## 실제 원본 Windows 실행 전에 남은 검증·절차

1. 원본 Windows 보호 대상의 실측·개별 해시·Task enabled 값 확보, 최초 집계 지문 `877bcd2a...` 재계산 일치. **완료 (R2 사용자 제공, 독립 실PC 인증 전)**.
2. 승인 명세·정확한 owner 수락 댓글은 GitHub에 등록 완료. 고정 GitHub GET·동의 읽기·고정 R1/R2 승인 검증 및 단일 연계 소스는 구현했다. **원본 Windows의 인증 GET 실측·진입점 실행 검증·배포는 미완료**이며 오프라인 단순 boolean 전달 금지.
3. 최초 7 raw digest·현재 보호 상태·Runner 6개·원래 설치 owner 사망·별도 C claim 부재를 확인 후 첫 영속 쓰기. 자기 claim 생성 후에는 기존 observer의 `recoveryClaimAbsent`를 재사용할 수 없으므로 **자기 nonce 전용 재검증 경로** 적용. 읽기 전용 구현·테스트는 완료, 원본 운영 PC 연결은 아직 없음.
4. Workflow enable이 `active`로 증명된 후 **알려진 협조적 backlog Writer 배제 확인** — 설치 source·PID·lease/claim·원본 SHA 읽기 전용 가드와 단일 native operator의 소스 연결까지 구현, **실제 원본 Windows PC 적용·사후 독립 확인은 미완료**. Backlog 하위 부품은 `proveExclusiveWriter` 함수 누락·미확인 시 실패하고, SHA 대조·same-directory temp·fsync·rename·신 SHA 재조회까지 소스에서 구현. **이는 원자 CAS가 아니므로 검증 범위를 넘어선 독점성 주장 없이 운영 적용 시 별도 확인이 필요.**
5. GitHub Issues를 `sort=created`, `direction=desc`, `per_page=100`으로 실제 pause→resume 구간 내 완전 탐색하고 두 번 동일성 검사하도록 소스 구현. 후보별 댓글 전체 페이지, `results/<runId>-<attempt>-seat-<seat>.json/.txt` 둘 모두 원격 GET, 내용·출처·status/ID 교차 검증도 소스 구현. **인증 GET·네이티브 단일 흐름의 소스 연결 완료, 실제 Windows resume 원본 관측·외부 독립 검증은 미실시.** 기존 `replayR6Backlog` 금지, 동일 requestId 재발행 0. 결과 확인이 안 된 원본은 담당자 재계획 대상으로 분류.
6. 최초 존재/부재 규칙에 따른 **Writer 3개 경로의 상태 + 존재 파일 SHA + Task 2개 SHA/enabled** 값은 **실행 직전, Workflow PUT 직전, 설치 lease 보관 직후, 최종 종료** 단계에서 비교. 부재 파일을 무조건 설치하거나 미검증 상태로 간주하지 않는다. 독립 Runner 추가 자체는 불필요한 차단 사유가 아님.
7. 완료 상태는 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`. 원본 설치 lease는 삭제 없이 보관하고, 자체 C claim도 완료 기록 후 별도 보관·최종 재조회. 영구 시도 마커가 이미 있으면 재실행 불가.

## 부작용·승인 제한

다음 작업은 (1) 원본 Windows에서 등록된 승인 manifest·댓글의 인증 GET 원문 및 현재 R1/R2를 새 시각으로 재확인, (2) 네이티브 진입점의 운영 환경·차단 조건과 오류 주입 검증을 완료, (3) 승인 범위 내 단회 Workflow/Backlog/잠금 보관 후 독립 사후 검증, (4) 미확인 원본 Job을 자동 재실행하지 않고 담당자 재계획으로 분리하는 것이다. **C급 한정 승인과 실운영 C 수행 완료는 별개**다. 새 PC/블로그 자동화 Runner에서 #996 관련 CMD를 실행해서도 안 된다. 기존 #917 완료는 재실행하거나 신규 성과로 합산하지 않는다.
