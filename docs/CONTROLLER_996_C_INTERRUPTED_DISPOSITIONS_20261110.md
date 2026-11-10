# #996 — C 복구 중 ORIGINAL_JOB_DISPOSITIONS 중단 인계

## 실제 관측과 범위 (2026-11-10 KST)

- 대상: 원본 Windows `E:/ZGmini`, 원본 [#996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996), `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`.
- 사용자가 기존 R2 `RUN_996_NATIVE_C_ONCE.cmd`에서 `996 실행`을 입력한 뒤 얻은 결과:
  `STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE` / `C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID`, `failedStep=ORIGINAL_JOB_DISPOSITIONS`.
- C 화면의 시도 수: Workflow PUT 1, backlog close 1, original lease archive 0, own claim archive 0. 이것은 시도 횟수이며 독립적인 운영 성공 확인은 아니다.
- 기존 C Operator 소스에서 이 단계에 도달하려면 `enableOnce`, `verifyActiveReadback`, `closeOnce`의 반환값 검사에 이미 통과했어야 한다. 다만 이후의 물리적 상태와 전체 사후검증은 아직 미확정이다.
- GitHub 브라우저 읽기 전용 실측: `pc-job.yml`의 메뉴가 `Disable workflow`로 표시되어 **현재 활성 상태**. #996은 Open, 원격 maintenance 결과는 과거 `UNKNOWN/RUNNER_SET_DRIFT` 그대로이고 새 C terminal receipt는 없음.
- 원본 Issue #1226(`core-status`)·#1227(`pc-job`)은 Open·결과 댓글 0. 이들이 실제 C pause window에 속하는지의 최종 판단은 원본 backlog의 `pausedAt/resumedAt` 읽기 전용 교차검증이 필요하다. 이전 #917의 원본 #919와 혼동하지 않는다.

## 확인된 소스 결함과 변경

원래 백로그 계획 검증기는 모든 `chatId`를 UUID 36자로, 제목을 `pc-job`으로, 본문을 7개 필드로만 제한했다. 반면 정본 `controller/common.mjs`는 `chat-UUID`를 허용하고, 제목을 인증 조건으로 사용하지 않으며, `writer-install-preimage-readonly`의 승인된 9필드 변형을 허용한다. `controller/entry.mjs`도 `pc-job` label을 검사하지 정확한 제목을 강제하지 않는다.

Draft #1222에서 순수 소스 `controller-996-backlog-plan.mjs`와 회귀시험 2개 파일만 정본 계약에 맞췄다. 원본/확장 경로, body 키, 해시 및 source identity 검증, 중복 requestId·불완전 결과 차단은 유지한다. 로컬 연결 시험 22/22 PASS, GitHub 원격 수정 파일 byte 일치 3/3.

**이 변경은 C 복구 실행 허가가 아니다.** 기존 R2 ZIP·CLI·source-lock·승인 manifest의 봉인된 바이트는 변경하지 않았다. ZIP에 포함된 구 검증기를 다시 실행하면 동일/추가 부작용 위험이 있다. 변경된 Draft 파일을 기존 ZIP에 임의 덮어씌우거나 명령행으로 직접 호출하지 않는다.

## 다음 단회 읽기 전용 판정 — 원본 Windows 전용

새로운 상태 전용 관측기가 다음 원본 증거를 **민감정보를 출력하지 않고** 독립 재조회해야 한다. 구 R1/R2 사전 검사처럼 `no claim` 또는 `backlog open`을 전제해서는 안 된다.

1. 기존 #996 install lease/owner/marker/ledger의 존재·원본 digest·현재 archive 여부, 이전 owner 생존 여부, 신규 C claim/marker의 존재·PID 생존 여부. 원본 nonce·전체 JSON은 외부 출력하지 않는다.
2. C 고유 marker의 정확한 순서: `PREPARED`, `WORKFLOW_ENABLE_ATTEMPTED`, `BACKLOG_CLOSE_ATTEMPTED`의 존재·정합; `PRE_ARCHIVE`, `ORIGINAL_LEASE_ARCHIVE_ATTEMPTED`, `COMPLETE`, `OWN_CLAIM_ARCHIVE_ATTEMPTED`의 존재 여부는 **단정하지 말고 실제 조회**한다.
3. 원본 pause 파일 `pausedAt`, `resumedAt`, `replays`와 원본 SHA/닫힌 SHA; `BACKLOG_CLOSE_ATTEMPTED`의 `nextSha` 및 `resumeAt`과의 동일성. 원본 pause 시각부터 실제 resume 시각까지의 전체 Issue 2회 조회·댓글/JSON/TXT 대조.
4. `pc-job` Workflow `active`와 이벤트 실행 이력, 별도 6개 전용 Runner·독립 Runner, 기존 Controller/Stage/Maintainer 실제 파일 바이트·source pin, 보호 Writer/Task 현재 fingerprint. 역사적 `protectedBaselineVerified=false`와 disable actor 미입증은 임의로 true로 바꾸지 않는다.
5. 다른 승인 설치·복구 Writer 또는 동시 C owner가 있는 경우 즉시 중단. 상태 확인 자체는 설치·Issue 게시·Workflow PUT·backlog rename·lease 이동 0회여야 한다.

### 첫 단계 구현 현황 — source-only narrow observer (2026-11-10)

- Draft #1222에 `tools/controller-996-interrupted-observer.mjs` 및 `tests/controller-996-interrupted-observer.test.mjs`를 신규 추가했다. 기존 봉인된 R2 ZIP, C CMD/CLI, source-lock, 동의 manifest는 **변경하지 않았다**. 이 소스에는 운영용 CLI도 없다.
- 원본 Windows 고정 `E:/ZGmini`에서만 읽기 전용 호출을 허용하는 **라이브러리 후보**다. 경로·symlink 검사, 6개 원본 파일의 SHA256 고정값, 기존 install lease·신규 C claim 및 세 intent marker, 양쪽 owner PID 생존 여부, backlog closed SHA/시간, 후속 archive marker 부재, GitHub Workflow ID/path/active와 원본 Issue/Runner 이름 6개 존재, 현재 Writer/Task fingerprint를 검사한다. 읽는 도중 원본 파일 해시나 lease/marker 존재 상태가 바뀌어도 즉시 UNKNOWN으로 중단한다.
- 반환 상태가 `READONLY_INTERRUPTED_PHASE_CONSISTENT`이더라도 `C_CLAIM_PROVENANCE_NOT_EXTERNALLY_PINNED`, `claimProvenanceExternallyPinned=false`, `fullSourceBytePostcheckVerified=false`, `executionAuthorized=false`를 명시한다. 이름 6개를 가진 Runner의 등록 여부만 확인하며 **격리·전용·온라인 준비 상태를 증명하지 않는다**. 원본 C 소유권 승계 또는 archive 승인으로 사용할 수 없다.
- 연결된 소스 단위·경합 부정 회귀 **29/29 PASS**(기존 backlog plan/readback 22건 + 새 관측기 7건). 실제 원본 Windows 실행/사후 증거는 아직 **0건**이며 5단계 수명주기 완료율은 **4/5 = 80%**로 유지한다.
- **남은 별도 증명:** 원본 pause-window 전체 Issue 2회 조회·댓글/JSON/TXT 결과, Workflow 실행 이력, 각 설치 소스 파일의 실제 바이트 단위 postcheck, 격리 Runner 구성, C claim의 독립 provenance·안전한 소유권 인계 규칙. 이 중 하나라도 빠진 상태에서 새 C 복구 실행·lease archive를 승인하지 않는다.

### 후속 단계 구현 — 분리된 중단 상태 읽기 전용 R1 패키지

- Draft #1222에 기존 C R2와 **완전히 별개의** `RUN_996_INTERRUPTED_READONLY_ONCE.cmd`, `controller-996-interrupted-readonly-cli.mjs`, `controller-996-interrupted-readonly-source-lock-r1.json` 및 패키지 시험을 추가했다. 배포 대상은 정확히 **7개 파일**이며 기존 C Operator·R2 ZIP/CMD/소유자 동의 파일은 포함하지 않는다.
- 다운로드 후보: [`zgmini-996-interrupted-readonly-r1.zip`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/artifacts/controller-996/zgmini-996-interrupted-readonly-r1.zip), ZIP SHA256 `f233a5a9a48f44680c4566e2226707fb72f86769f8d790f53a07d34dadca086c`. 내부 CMD SHA256 `d811bca0d10ff7baf4f747bbf1bc59104e066497c59c2d7a9e254ed827640daa`, CLI SHA256 `418aa7fb41152c81e95a37ffae858741ae23c98fa503f1300fba33250db2fdd7`, source-lock SHA256 `ab2b58f7dc2ef528052add141d81e4d4eb2a7d5cf8b1673d07e1ff50901fee10`.
- CMD가 고정된 `C:/Windows/System32` PowerShell의 `Get-FileHash`로 CLI를 먼저 검증하고, CLI가 고정된 4개 원본 모듈의 해시·import closure를 확인한 후에만 상태 관측기를 불러온다. 모든 PC 읽기 대상은 원본 Windows `E:/ZGmini`로 고정되어 있고, 실행 패키지는 **원본 설치 폴더 바깥**에 위치해야 한다. 조회 중 실패·경합이면 기존 C claim·install lease를 유지하고 UNKNOWN으로 끝난다. `%TEMP%`가 원본 E:를 가리킬 위험을 제거하기 위해 **TXT·로그·임시 파일·클립보드를 만들지 않고 콘솔에 비민감 JSON만 표시**하며, 필요시 사용자가 콘솔 화면을 전달한다.
- 신규 패키지 자체 부정 검증 **9/9 PASS**, 기존 관측기/백로그 연결 시험 합계 **38/38 PASS**. ZIP 압축 7개 내부 파일과 로컬 원문 **7/7 일치**, ZIP Git blob 원격·로컬 동일. **이것은 Linux 격리/정적 시험이며 실제 Windows CMD+PowerShell 실측이 아니다.** 원본 PC 읽기 전용 단회 실행은 이 단계에 **포함되지 않았고**, 재실행 명령이나 이전 C 동의로 대체하지 않는다.
- 패키지 단계의 후속 확인은 (1) Windows CMD 직접 해시 검사의 실제 exit code, (2) 실제 원본 PC에서 관측기 반환, (3) 실행 중 운영 쓰기 0과 상태 미변경 대조다. 그때에도 **Claim 독립 provenance·설치 소스 전체 byte·pause-window 원본 Issue 결과 검증이 별도로 완료되기 전까지 C 복구 재개 NO-GO**다.

## 후속 C 단계 설계 (source-only, 실행 금지)

- 단일 후속 복구는 **이미 시도한 Workflow PUT과 backlog rename을 반복하지 않는다.** 다른 상태가 발견되면 먼저 원인을 분리하며 재시도하지 않는다.
- 이미 닫힌 pause window가 원본 C marker와 물리적으로 동일함을 확인한 뒤에만 수정된 순수 disposition planner로 원본 작업을 **읽기 전용** 재분류한다. 댓글만으로 PC 성공을 인정하지 않으며 결과 JSON/TXT와 동일성 대조가 안 된 항목은 작업자 재계획 상태로 남긴다.
- 과거 C claim의 nonce/PID를 새 프로세스가 자신 것처럼 재사용하지 않는다. 별도의 승인된 인계·배타 소유권 명세가 없으면 원본 C claim과 install lease를 둘 다 보존한다.
- 현재 소스와 신규 후속 실행기의 바이트가 달라지므로 이전 사용자 C 동의와 R2 ZIP 서명을 자동 승계하지 않는다. 새 source-lock/배포 바이트/정확한 단계 범위/실행 소유자 승인을 다시 묶어야 한다.
- 원본 C marker, 보호 상태, 원본 결과 조정 및 물리적 postcheck가 모두 일치하는 경우에만 승인된 후속 단계에서 원본 install lease를 **삭제 없는 archive**로 전환하고, 별도의 완료 marker/독립 postcheck 후 새 C claim을 보관한다.
- 실패·경합·불명확한 파일/원격 읽기·ACK 손실은 `STATE_UNKNOWN` 유지. 원본 #996 재요청, 기존 requestId 재발행/자동 replay, 설치 재개, 무조건 unlock/rollback, 새 B 설치·Writer/Core/DB/D1 변경은 금지한다.

## 다음 명시적 Gate

**현재 Gate = 원본 Windows 사후 상태 read-only evidence 확보.** 이 Gate 전에 신규 C 운영 실행은 NO-GO다. 정확한 관측 계약과 결과를 기반으로 한 소스 전용 state-resume 후보 및 부정 회귀시험이 먼저 필요하다. 설계/테스트는 4/5(80%) 실제 수명주기 완료로 계산하지 않는다.
