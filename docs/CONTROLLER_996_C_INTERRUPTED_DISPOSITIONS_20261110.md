# #996 — C 복구 중 ORIGINAL_JOB_DISPOSITIONS 중단 인계

## 2026-11-11 원본 Windows R4 실측 수신 — 84/84 일치, C 복구는 NO-GO

- 사용자가 원본 Windows에서 실행한 **R4 읽기 전용 CMD 콘솔 화면 1건**을 제출했다. 화면에는 `ZGMINI_CONTROLLER_996_GIT_SOURCE_READONLY_R4`, `SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS`, 설치 **38**, Stage **39**, Maintainer **7**, 합계 **84**, `originalWindowsReadback=true`, `executionAuthorized=false`가 표시됐다. **앞선 아래의 'Windows R4 0건'은 이 결과를 받기 전 이력**이다.
- 화면 `gitBlobManifestSha256` **`0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f`**는 봉인된 Git 48종 원문 Manifest와 일치했다. 화면 `sourceBytesSha256` **`b7ca1f00f3d171dae91cc3559aef861b5b8299770ce86e5b6323def1f301f46d`**는 봉인된 84개 로컬 경로·SHA256 배열의 JSON 해시를 **별도 오프라인 재계산해 완전 일치**했다. 사용자 스크린샷 SHA256은 `215c8f70d06a8029eda14c554a84c2ad1b56fbdc570f0aab06d10a335832fb18`이며 GitHub에는 사진 원문이 아닌 비민감 전사·한계만 `artifacts/controller-996/zgmini-996-r4-windows-screenshot-readback.json`으로 기록한다.
- 출력의 `operationalWrites=0`, `workflowPuts=0`, `backlogWrites=0`, `issuePosts=0`, `pcRetries=0`은 **CLI의 자체 보고**다. 사진만으로 물리적 PC 신원을 외부 인증하거나 OS 수준 쓰기 0을 단정하지 않는다. **사진에는 실행한 ZIP/CMD SHA256 검산 결과가 없으므로 사용자 PC의 패키지 바이트 동일성도 별도 미입증**이다. 읽은 시점 이후 소스가 바뀌지 않았다는 증거도 아니다. **기존 C Claim/Install Lease 보존, 원본 Job 4건 자동 재실행 금지** 유지.
- 2026-11-11 기준 원본 Issue #996은 Open·댓글 **10건**, 신규 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1` 댓글 **0건**이었다. 원본 Job [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217)·[#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219)·[#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226)·[#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227)은 Open/결과 댓글 0건을 유지한다. 원본의 실물 replay/결과쌍 및 독립 Claim provenance가 완료됐다는 뜻은 아니다.
- **다음 관문:** 운영 `E:`를 건드리지 않는 **별도 격리 Windows의 TEMP 네이티브 `Directory.Move` 충돌 시험**(아직 실측 0)과 원본 Claim/Lease 소유자·경합·Backlog 실물 상태 최신 확인, 별도 불변 Manifest/Owner 신규 정확승인이 필요하다. 실제 C 복구·Lease 이동·Workflow 변경·원본 Job 종료 **NO-GO**, 운영 전체 진행률 **80%→80%**.

## 2026-11-11 OFFLINE Git 바이트 검증 R4 소스 봉인 — 운영 NO-GO

- **목적/범위:** 실제 복구·재실행의 승인과 무관하게, 기존 R3 원본 Windows 보존 상태에서 설치 Controller **38개**, Stage **39개**, Maintainer **7개**, 합계 **84개** 파일을 불변 Git 원본과 **읽기 전용으로** 대조할 수 있는 보조 도구를 추가했다. 독립 GitHub REST 조회로 고정 Git commit 3개의 트리 SHA와 각 Git blob 경로·SHA1·크기를 **84/84 대조, 불일치 0**, 중복 제외 원문 Git blob **48종**의 SHA256을 봉인했다.
- **중요한 설계 교정:** 최초 Git 실행(`git.exe`) 기반 R4 초안은 OS `PATH` 변조·부분 Git clone 등의 불확실성이 있어 **미배포 폐기**했다. 현재 R4는 `git`, 하위 프로세스, 네트워크, PC-job, 로그/원본 파일 쓰기를 전혀 호출하지 않고, 봉인된 오프라인 SHA256 + Git blob SHA1/크기를 실제 원본 E: 파일과 비교한다. 직접 import 호출자가 검증 Manifest SHA를 임의 대체하는 우회도 운영 경로에서 고정 SHA 필수로 차단했다.
- **별도 5파일 패키지:** `artifacts/controller-996/zgmini-996-git-source-readonly-r4.zip`, **ZIP SHA256 `07874b2cbf4c63ed98f14a464f6491df76829c6a51fe4d8fd5d86be946d1a0a7`**. 파일은 `RUN_996_GIT_SOURCE_READONLY_R4_ONCE.cmd`(SHA256 `4c9f64749e426105e702caacfdb4b7ac93dfb2fcb3dfae4ff665d7d76b1436c2`), `controller-996-git-source-readonly-cli-r4.mjs`(SHA256 `b0f6b834ab82f76e355a1879352d445dfdc7fc6520f7a1d36aed4760c010c4f6`), `controller-996-git-byte-offline-readonly-r4.mjs`(SHA256 `bc5a5e5cb0c6ced192f5a6c3b9898b8ac3e319076e07bd2de3b9d9872ff5facd`), `controller-996-git-byte-offline-manifest-r4.json`(SHA256 `0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f`), `controller-996-git-source-readonly-source-lock-r4.json`(SHA256 `d9671e500891b1935ddd2b12e38fd1a0b4c3a202c541a814afb3cc508543bb2f`)이다. ZIP CRC 검사 **5/5 정상**.
- **검증 결과:** 전체 소스·격리 fixture 회귀 **157/157 PASS**, GitHub 불변 트리 경로/Blob 메타 **84/84 일치**. 그러나 이는 **Linux/정적 시험**이며, 원본 Windows의 R4 실행 **0건**, 독립 Windows 네이티브 TEMP 이동 시험 **0건**, 신규 C 원문 승인 **0건**이다. ZIP 전체 SHA256은 별도 고정한 뒤 사용자 실행 전에 검산해야 하며, Windows reparse point·경합·파일 변경 시점은 실제 실증이 필요하다. R4가 PASS여도 C 실행 승인이 아님.
- **작업/권한 경계:** Draft PR #1222의 소스 전용 후보만 갱신한다. 기존 실패한 `RUN_996_NATIVE_C_ONCE.cmd`, R2 CMD를 재사용하지 않는다. 원본 C Claim/Install Lease·Backlog·Workflow·원본 Issue를 이동·변경·재발행하거나 PC 복구를 실행하지 않는다. 네 개 미완료 원본 Job은 성공 처리/자동 재발행 없이 원담당 재계획 검토 상태로 둔다. **전체 운영 진행률 80% → 80%, 실제 C 복구 NO-GO**.

## 2026-11-11 Codex 사용량 중단 후 재개: 보관 충돌 격리 시뮬레이션

### 독립 검토 보완 정본 — 원본 승인 누락·경로 불일치 교정 (운영 NO-GO)

- 신규 C 원문 조회기는 실제 GitHub REST의 비동기 `get/authenticateReadOnly`에 맞춰 전 경로 `async/await`로 동작한다. **원본 #996 Issue body의 7개 필드가 포함된 원문 SHA256** `37caf348eb4fc5440ebfa76a1c1166bb7480dffdd8d054dcb19391816bc72b5a`, 고정 Owner ID, `comments` 공식 총수, 댓글 두 번 전체 페이지와 마지막 원본 Issue 재조회가 모두 같아야만 `C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY`를 반환한다. 댓글 단축 응답, 본문의 `chatId/controlRepository/approvalManifestSha256` 변조, 조회 도중 Issue 변경은 각각 차단한다. 포트 주입 단계이므로 실제 인증된 운영 GET 어댑터·새 승인 증빙을 아직 제공하지 않는다.
- 이전 격리 Linux 시뮬레이션의 **예약 디렉터리 아래 `payload/` 이동**은 Windows 정본 `Directory.Move(source, destination)`의 **직접 보관 경로**와 달랐다. 지금은 양쪽 모두 **구 C Claim → 신규 C Claim → 원본 Install Lease 최종 이동**, 보관 폴더 바로 아래 `owner.json`/Marker를 기준으로 통일하고 회귀시험에서 양쪽 경로·순서를 교차 확인한다. 과거 이 문서 하단의 `payload/`·`AFTER_*_RESERVATION` 기록은 **이전 실험 이력**이며 현행 정본이 아니다. Linux `rename`은 검사·이동 사이 경합에서 이미 존재하는 빈 폴더를 교체할 수 있으므로 **절대 운영 no-replace 보증으로 사용하지 않으며**, 별도 격리 Windows TEMP에서 실제 `.NET Directory.Move` 충돌·중단 시험을 통과해야 한다.
- Windows 네이티브 fixture는 추가로 UNC/네트워크·이동식·비 NTFS/ReFS TEMP 위치를 차단하고 **원본 E:가 아닌 로컬 고정 디스크**에서만 동작하도록 소스를 제한했다. 안전한 Windows 하드웨어/동시 프로세스 환경에서 실제 실행하기 전까지는 해당 검증 PASS 0건이다.
- 정적·격리 소스 회귀 **144/144 PASS**(신규 승인 리더 18, Windows 스크립트 정적 2, Linux↔Windows 직접 보관 경로 교차 1 포함). **Windows Native 실측 0**, 원본 C Claim/Install Lease 변경 0, Workflow PUT 0, Issue POST 0, 이전 실행 CMD 재사용 0. 운영 진행률 **80%→80%**, 실제 C 실행 **NO-GO**.

### 신규 C 독립 승인 원문 조회·Windows TEMP 네이티브 시험 소스 (운영 NO-GO)

- `tools/controller-996-native-continuation-consent-reader.mjs`는 기존 신규 C Shape Gate와 6효과 배열을 공유한다. **별도 신규 C Manifest의 40hex 고정 Git commit·고정 경로** `docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json`을 raw GitHub GET에서 읽고 base64 canonical/size/Git blob SHA-1/원문 SHA-256·Manifest top-level exact key 집합·원본 #996 Issue owner/title/body schema/requestId/operation/targetControllerSha·원본 전체 댓글 100/page·중복 ID·댓글 두 차례 완전 재조회·작성/수정 시간 일치·고유 신규 소유자 승인 정확본문(Manifest commit SHA 포함)·같은 소유자 모순 승인 및 신규 철회 표시를 검증하는 **읽기 전용 후보 라이브러리**다. 과거 `RECONCILE_INTAKE_PAUSED_ONLY` 승인은 새 범위에 재사용하지 않으며 원본 GitHub 댓글 작성/수정 **0회**. 결과 상태는 `C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY`, `executionAuthorized=false`다. 인증된 GET 포트 주입은 향후 작업이며, 모의 포트 테스트 통과를 실제 사용자 승인으로 오인하지 않는다.
- 실제 GitHub #996 raw REST GET 1페이지 읽기 전용 결과 댓글 **10건**, 과거 C 승인 패턴 **1건**, 신규 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1` **0건**(2026-11-11 확인). 댓글에 작성/수정 시각이 존재함을 확인했다. 신규 불변 Manifest·Operator SHA·ZIP SHA·source-lock SHA·owner 댓글은 **아직 발급되지 않았다**.
- `tools/TEST_996_WINDOWS_NATIVE_MOVE_FIXTURE.ps1`는 경로 입력을 받지 않고 새 Windows TEMP `zgmini-996-test-native-<GUID>`에서만 `[System.IO.Directory]::Move`의 원본→보관·기존 대상 충돌 거부·중간 중단 후 Install Lock 보존·마지막 Lease 해제 뒤 다른 임시 잠금 생성 경계만 **시험하도록 작성한 소스**다. 시작 시 TEMP 실제 드라이브가 `E:`이거나 `ZGmini` 경로 포함/부모 Reparse Point이면 중단하며, 임의의 recursive cleanup은 수행하지 않고 시험 폴더만 남긴다. 운영 `E:` 원본 경로·실제 승인/업데이트는 접근하지 않는다. **현재 Linux 환경에는 PowerShell이 없어 Windows Native 동작 실행 PASS는 0건**이며, Node 정적 안전 계약 시험 2건만 통과했다. Junction·전원 중단·dir 메타데이터 내구성·동시 프로세스/Writer 유입과 디스크 flush는 별도 격리 Windows 실증이 필요하다.
- 당시 **소스 회귀 140/140 PASS**(신규 승인 모의 15, Windows PowerShell 정적 2 포함); 이후 수정 최신 결과는 바로 위 독립 검토 보완 정본 **144/144**가 우선이다. **원본 Windows 운영 변경 0·Workflow PUT 0·원본 Issue POST 0·PC C 실행 0**, 운영 진행률 **80%→80%**. 실제 C 실행은 여전히 **NO-GO**이며 이전 CMD/승인 재실행을 금지한다.

### 후속 필수 수정: 실제 설치 배타 잠금 해제는 맨 마지막 (운영 NO-GO)

- 최신 `main` `tools/maintenance-lock.mjs`의 설치 진입 잠금은 **정확히 `leases/controller-install` 디렉터리의 원자적 획득**에 의존하고, 신규 `controller-recovery-continuation-<UUID>` Claim은 그 경로를 대신 보호하지 못한다. 앞선 어댑터의 **oldC → install → continuation** 순서는 원본 Lease를 먼저 없애 다른 설치와 경합할 수 있었다. 신규 C 승인 manifest는 아직 발급되지 않았으며, 실제 실행 순서를 **oldC → continuation → install(마지막 상태 변경)**로 수정했다.
- 격리 `simulate996Continuation`은 신규 Claim의 `READY_TO_RELEASE_INSTALL.json`을 완료 확정(`DONE`)이 아닌 **해제 준비 의도**로 `wx`·fsync·재읽기하고, 구 C Claim 보관 및 신규 Claim 보관 후 `owner.json`·준비 Marker 원문 SHA를 재검증한다. 그다음 보호/Writer 경합·원본 Install Lease 소유권을 다시 확인하고 **Install Lease 보관을 마지막 변경**으로 한다. 이후 쓰기 없는 원본 보관 읽기 검증만 수행하며 모든 중단은 자동 재시작 불가다.
- `plan996WindowsArchive` 및 테스트 포트도 같은 마지막 Lease 순서를 강제한다. 신규 Claim 보관 후 기존 잠금 보존, 준비 Marker의 소유자 nonce·원본 Install Recovery SHA 불일치 차단, 최종 해제 직전 Writer 유입 시 잠금 보존, 최종 해제 후 새 `controller-install` 경로가 다른 내용으로 다시 존재해도 **구 보관 Lease의 바이트와 현재 경로를 구분**하는 부정 시험을 추가했다. 다른 내용의 Lease가 정당한 새 Writer라는 증빙까지 완료된 것은 아니므로 `postReleaseOwnerVerified=false`로 반환한다. Mutating Linux fixture의 중간 부모 symlink도 차단했다. 실제 Windows `.NET Directory.Move`, journal 원자성과 보존·독립 owner attestation은 아직 검증하지 않았다.
- 새 집중·전체 회귀 포함 **123/123 PASS**, 기존 운영 PC 원본 변경 **0**, Workflow PUT **0**, 원본 Issue 재게시 **0**, 실PC C급 실행 **0**. **운영 진행률 80%→80%**, 이 단계는 Draft 소스 보완만 GO; 신규 사용자 C 승인·84개 원본 Windows 바이트 검증·실물 잠금 해제 테스트 완료 전에는 운영 **NO-GO**다.

### 후속 독립 C 동의·Windows 보관 어댑터 소스 검토 (운영 실행 불가)

- `tools/controller-996-continuation-gate.mjs` 및 대응 시험을 추가했다. **이전 `RECONCILE_INTAKE_PAUSED_ONLY` C 동의는 신규 중단 Claim 인계에 사용 불가**하며, 신규 스키마 `ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1`의 고유 UUID·새 불변 manifest 증거·새 정확한 사용자의 승인 영수증·operator/source-lock/ZIP 원문 해시·기존 Claim/세 marker/Lease/Backlog 원문 핀·원본 Windows에서의 Git 84바이트 검증·원본 4 Issue 무재실행 분류·Fresh Writer 경합 부재가 모두 일치해야 검토 후보가 된다. 모든 성공 응답도 `executionAuthorized=false`인 **순수 검토**이며, 이 함수에 전달된 boolean만으로 실PC 변경을 승인하지 않는다. 동의·원본 수정·이슈 재발행 기능은 없다. 집중 **12/12 PASS**.
- `tools/controller-996-windows-archive-adapter.mjs` 및 시험에는 기존 C Claim → 원본 Install Lease → 신규 Continuation Claim 순서의 **고정 E: 경로·동일 볼륨 Windows .NET Directory.Move no-replace 계약 계획**과 Linux 전용 fixture 시뮬레이션만 존재한다. 실제 Windows `.NET`/PowerShell 호출, 원본 경로 접근, 운영 실행용 CLI/CMD는 **전혀 없다**. 존재하는 보관 대상·검사 후 경쟁 생성·크래시 주입·원본 drift·원본 및 보관 부모 symlink·테스트 fixture 부모 symlink·늦은 Writer 경합 및 잘못된 경로를 거부하는 집중 **13/13 PASS**. Install Lease 보관 직후 중단 시 자동 재실행도 차단을 확인했다.
- 전체 소스 회귀 **114/114 PASS**. 독립 검토 판정은 **Draft 소스만 조건부 GO, 실제 C는 NO-GO**. Gate는 주입된 증빙의 **형식만 검토**하며 진본성·독립 승인까지 증명하지 않는다. 현재까지 추가된 것은 독립 소스·테스트로, **실제 Win32 Directory.Move semantics 실측, 대상 저장 경로의 진정한 원자성·parent fsync, immutable consent·owner 외부 provenance, 중단 직전 완성 준비 Marker, 사후 다른 설치 진입 경합, 중간 부모 symlink 교체 경합**은 아직 미충족이다. 기존 원본 PC/Workflow/Claim/Lease/Backlog·실제 GitHub Issue 운영 변경 **0**, 운영 수명주기 **80%**. Draft 소스 외 배포·실행 **NO-GO**.

- 이전 Codex 대화는 `Integrity 996`/`Review 996` 완료, Windows 임시 폴더 소스 시험 **13건 PASS**와 보관 경로 충돌 수정을 진행했다고 보고한 상태에서 사용량 제한으로 중단됐다. **해당 세션의 미커밋 파일/명령 실행 기록은 현재 작업 환경에서 확인할 수 없으며, 이를 GitHub에 게시된 코드·실PC 결과로 간주하지 않는다.** 새 작업은 기존 Draft PR #1222 HEAD `89fc9fbdeef4790533dc834261da7869c4764988`에서 재개한다.
- 사용량 중단 시점의 Windows archive 경로 충돌과 같은 문제를 **격리 Linux temp-only 시뮬레이션**에서 별도 보강했다. 이전의 `absent(destination)` → `rename(source,destination)`만으로는 POSIX의 기존 빈 디렉터리 교체와 검사·실행 사이 경쟁을 차단할 수 없다. 새 모의 코드는 **독점 `mkdir`로 대상 보관 디렉터리를 예약**한 다음 원본을 그 내부 `payload`로 이동하며, 예약 실패·동일 경로 선점·예약 직후 강제 중단 시 원본 보존 및 자동 재시도 거부를 시험한다.
- 추가 부정시험 5건: 기존 빈 대상 경로, 사전검사 직후 경쟁 디렉터리 생성, 구 C Claim 보관 예약 직후 중단, Install Lease 보관 예약 직후 중단, 이동 직전 원본 Claim SHA 변경. 집중 **11/11 PASS**, 전체 연결 회귀 **81/81 PASS**. 이는 **실물 Git 84파일 증명·Windows/.NET 이동 보장·운영 C 승인·실PC 복구 증거가 아니다.**
- 운영용 어댑터는 여전히 별도 구현 대상이다. `Directory.Move`의 Windows 대상-존재 충돌 거부, 파일/디렉터리 정체성 pin, parent flush, 현행 보호/Writer 경합 재검사, 새 정확한 C 동의, 보관 단계별 저널과 비자동 재진입 판정이 필요하다. `simulate996Continuation`은 여전히 운영 호출을 무조건 거부하며, 기존 CMD/ZIP·원본 #996·Claim·Lease·Workflow·Backlog를 건드리지 않았다.
- 새로운 **읽기 전용 소스 검산 라이브러리** `tools/controller-996-git-source-readonly.mjs`를 별도 분리했다. 원본 Windows 고정 경로와 Git checkout에서 commit `badad912`/`9db6fff`/`16064e2`에 대해 `git show <commit>:<rel>`로 **38+39+7=84개** 파일을 실제 바이트 비교하고, pinned host manifest·소스 SHA·Stage 전체 파일셋·심볼릭 링크·재스캔을 검증하도록 설계했다. 운영 입력 임의 경로/커밋은 허용하지 않고, Linux는 별도 temp fixture 주입에서만 테스트한다. 실행용 CMD/소유자 handoff/원본 PC 실제 실행은 없다. 전용 부정시험 **8/8 PASS**, 기존 보관 시뮬레이션과 합친 전체 회귀 **89/89 PASS**. 이것은 **Windows 84파일 실측 완료가 아닌 소스/격리 테스트**다.
- **운영 진행률 4/5=80% 유지, 실제 C는 NO-GO.** 다른 Codex 세션의 미커밋 변경은 보존하고, 나중에 동기화할 때 강제 덮어쓰기/리셋 없이 차이를 확인한다.

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

### 원본 Windows 실제 관측 수신 및 pause-window 원본 Issue 두 차례 대조

- 사용자가 별도 바탕화면 폴더의 신규 R1 읽기 전용 CMD를 실제 원본 Windows에서 단회 실행한 **콘솔 스크린샷**을 제출했다. `ZGMINI_CONTROLLER_996_INTERRUPTED_READONLY_CLI_V1`, `READONLY_INTERRUPTED_PHASE_CONSISTENT`, `checksPassed=14/checksTotal=14`, `code=C_CLAIM_PROVENANCE_NOT_EXTERNALLY_PINNED`. 이전 C CMD 재실행은 0회다.
- 실측: `workflowState=active`, `originalLeasePresent=true`, `cClaimPresent=true`, `laterArchiveMarkersPresent=false`; 원본 Backlog 마커와 닫힌 파일 SHA의 일치가 검증됐다. 관측 구간(UTC) `pausedAt=2026-11-10T01:06:53.751Z`, `resumedAt=2026-11-10T13:21:26.727Z`. 결과의 `operationalWrites=0`, `issuePosts=0`, `pcRetries=0`, `executionAuthorized=false`를 보존한다. CLI 자기 보고는 별도의 OS 수준 쓰기 추적 증거가 아니며, 이후 실행자 승인으로 해석하지 않는다.
- GitHub `repo:ansqhd5774-Choi/zgmini-pc-control is:issue created:2026-11-10T01:06:53Z..2026-11-10T13:21:26Z` 범위 2회 조회와 각 원본 Issue·전체 댓글 2회 GET의 정규화 결과가 일치했다. 구간 내 등록된 `pc-job` 원본은 **4개**: [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217) (`core-runtime-source-readonly`), [#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219) (테마 T1, 동일 operation), [#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226) (`core-status`), [#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227) (`core-runtime-source-readonly`). 모두 Open·원본 결과 댓글 0건. `#1213/#1215/#1216`은 원본 pause 시작 **이전**에 생성되어 이 구간에서 제외한다.
- 독립 GitHub Actions GET `actions/runs?created=2026-11-10T01:06:53Z..2026-11-10T13:21:26Z&per_page=100`, 페이지 1~3을 모두 조회한 결과 **전체 277개 실행(100+100+77), run ID 중복 0**이며, 그중 `.github/workflows/pc-job.yml` 실행은 **0개**다. 원본 Issue 등록 직후의 `.github/workflows/pc-shared-issue-admission.yml` 4개 실행 [#42734248711](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42734248711)·[#42734569000](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42734569000)·[#42820183375](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42820183375)·[#42820379269](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42820379269)은 모두 `completed/skipped`. `main`의 `pc-job.yml`은 `issues.opened`·`pc-job` label·전용 self-hosted runner 기반이므로 pause 구간의 원본 처리 성공을 Actions 이력에서 찾지 못했다. 단, 실행 기록 부재는 **실물 replays·JSON/TXT 부재, 외부 PC 실행 0을 증명하지 않는다**.
- 이 사실은 **실행 결과쌍 JSON/TXT의 부재 또는 실행 자체의 부재를 독립 증명하지 않는다**. 실물 Backlog `replays` 항목의 건수·원본별 결과를 별도 읽기로 확정하기 전까지 4건은 `OWNER_REPLAN_REVIEW_REQUIRED` **후보**이며 `DONE`, `SUCCESS`, 자동 재실행, 새 Issue 생성으로 처리하지 않는다. 네 원본 모양을 `replays={}`로 넣은 새로운 **비운영 가정 시뮬레이션**을 추가하여 전체 관련 회귀 **39/39 PASS**, 운영 결과로 오인하지 않는다.
- **해제 차단 요소**: (1) C Claim의 외부에서 고정된 owner/PID/nonce provenance 및 소유권 인계, (2) 원본 Backlog 전체 replays·원격 result JSON/TXT와 Run 대조, (3) Controller/Stage/Maintainer 개별 실제 소스 바이트·현재 보호 상태의 별도 완전 사후검증, (4) 겹치는 Writer/Controller 활성 소유자 배제. 미충족 중에는 원본 C Claim·Install Lease 모두 보존하고 Workflow PUT/backlog rename/Issue 재발행/Lease archive 0회를 유지한다.

### 중단 후 독립 리뷰로 보강한 소스 판정 (추가 운영 실행 없음)

- 순수 GitHub 결과 대조기 `read996OriginalBacklogEvidence`의 `replays={}` 기본값은 **미전달된 실물 원장을 임의의 빈 재생 원장으로 취급**할 수 있었다. 이를 제거하고 호출자가 명시적 `replays` 객체를 제공하지 않으면 `C_GITHUB_ORIGINAL_REPLAYS_NOT_PROVIDED`로 GitHub 조회 전 중단한다. 명시적 빈 map 자체는 **실물 검증 증거가 아니며**, 독립 Windows SHA pin이 여전히 필요하다.
- 종전 최상위 `READONLY_RESULTS_RECONCILED`는 `DONE` 재발행·결과쌍 부재가 미검증이어도 완료처럼 읽힐 위험이 있었다. 결과쌍 **전부 입증**(`READONLY_RESULT_PAIRS_VERIFIED`), **미입증 포함**(`READONLY_VERIFICATION_INCOMPLETE`), **요청 0건의 빈 구간**(`READONLY_EMPTY_WINDOW_VERIFIED`)을 분리하고 `verifiedCount/unresolvedCount`를 반환한다. `DONE`은 실제 replay Issue 및 결과가 검증되기 전 `PRIOR_REPLAY_UNVERIFIED`, `SKIPPED_RESULT_PRESENT`인데 원본 결과쌍이 없거나 불일치하면 `JOURNAL_INCONSISTENT`다. 모두 `executionAuthorized=false`, Issue 게시·PC 재시도 0.
- 관련 소스·부정 회귀 **43/43 PASS**(이전 39건 + 새 4건). 이는 원본 Windows 실물 replays·C Claim provenance·설치 소스 postcheck를 대신하지 않는다. 현재 변경은 Draft의 소스 전용이며 기존 R1 읽기 패키지·봉인 ZIP·실행 CMD는 수정하지 않았다.
- 신규 C 인계는 과거 PID/nonce를 재사용하지 않고 **별도 continuation claim**을 요구한다. 구 C Claim의 SHA/존재·미등록 파일, 모든 marker, 오래된 PID와 새 Writer 경합, 전체 원본 원장/결과쌍을 독립 고정한 다음에야 범위 고정된 새 C 승인 절차를 설계할 수 있다. 원본 C Claim·Install Lease 이동 금지.

### 후속 단회 읽기 전용 증거 R2 — 소스·ZIP 후보, Windows 미실행

- 신규 패키지 `zgmini-996-interrupted-evidence-r2.zip`은 기존 C Operator 또는 이전 R1 상태 관측 CMD를 수정하지 않는 **별도 8파일 ZIP**이다. `RUN_996_INTERRUPTED_EVIDENCE_R2_ONCE.cmd`가 고정 Windows PowerShell에서 CLI SHA를 검사하고, CLI가 봉인된 **5개 모듈과 import closure**를 SHA/source-lock으로 확인한다. 이후 R2 관측기 **자체가 같은 프로세스의 기존 14/14 R1 물리 상태 검사를 재수행**하므로 외부에서 주입한 과거 14/14 JSON은 운영 판정에 사용할 수 없다. 콘솔만 사용하고 TXT·로그·임시·원본 E: 기록을 만들지 않는다.
- 한 번에 추가 관측할 항목은 **원본 C Claim/세 marker의 각 SHA·파일 identity**, Claim 디렉터리의 미승인 파일 여부, 살아난 기존 PID/새 continuation claim·archive 충돌, **실물 Backlog SHA·replays 건수/원본 Issue 번호/단순 상태/관련 replay Issue 번호**, Controller 설치/Stage/Maintainer 각 파일 바이트와 봉인된 로컬 manifest 해시의 부합이다. Claim nonce/원문 request body/토큰/파일 원문은 출력하지 않는다. 전후 독립 스냅샷의 SHA·mtime/file identity를 대조한다.
- 반환의 `DONE`은 **재생 원장 문자열**일 뿐 실제 결과 성공이나 재발행 Issue 인증이 아니다(`replayStatusIsNotExecutionProof=true`). `sourceManifestHashPostcheckVerified=true`도 **로컬 봉인 manifest 대비 소스 바이트 일치**만 뜻하며 Git commit 원문과의 완전 교차검증은 아직 수행하지 않아 `fullSourceBytePostcheckVerified=false`다. C Claim의 역사적 작성자·소유권 외부 승인 역시 미완료(`claimProvenanceExternallyPinned=false`), 모든 경우 `executionAuthorized=false`, 운영 쓰기 0이다.
- R2 ZIP SHA256 `dec06d8d402f68e84eb06893ed8db532e4d799cb4d6b68a3c292a8ad8d44fca9`; 내부 구성 8개·원문 바이트 **8/8 일치**. CMD SHA256 `7f62991a8d50aa5a27bebd37c8d5999a71230eb68716c2f3d6bdf7581d7e5c90`, CLI SHA256 `1dfb2f0101a6406ba6bf7dc8acb8ec8f14cc31fdf02a02afa825ff733b9b6dfe`, source-lock SHA256 `cef975fbfcf0c608144a5d3de9162e0fb05e4ec1aada0b72cba2f5a9328b6ce6`. 관련 소스 단위·패키지 부정 시험 **13/13 PASS**, 기존 총 43건과 합계 **56/56 PASS**. **원본 Windows의 R2 실행·실제 결과는 아직 0건**이다. R2 실행 결과를 받더라도 C 재실행·Claim/Lease 이전은 별도 승인 없이는 금지한다.

### R2 원본 Windows 실행 실패 및 교정된 R3 — 2026-11-10 KST

- 사용자가 `RUN_996_INTERRUPTED_EVIDENCE_R2_ONCE.cmd`의 **실제 원본 Windows 콘솔 사진**을 제출했다. 결과는 `STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE`, 최초 실패 `C_EVIDENCE_SOURCE_FILES_INVALID`, `sourceManifestHashPostcheckVerified=false`, `fullSourceBytePostcheckVerified=false`, `claimProvenanceExternallyPinned=false`, `executionAuthorized=false`; 자체 보고 운영 쓰기/Issue 게시/PC 재시도 **각 0**. 과거 R2 Linux fixture PASS를 Windows 실증 PASS로 바꾸지 않는다. **실패한 R2 CMD 재실행 금지**.
- R2 관측기의 `sourceSet()`이 Controller 파일 개수를 임의로 **최대 30개**로 제한했다. 실제 승인 원본 Git tree SHA `badad9124157879d7a645b64f2768113d632355b`는 `controller/*.mjs` 및 `config/operations.json` **38파일**, Stage 대상 Git tree SHA `9db6fff689c488a59fe8771f013b7c5d3bafc0a8`는 같은 범위 **39파일**이다. 두 트리 모두 `truncated=false`, 파일 경로 regex **38/38·39/39 충족**; Stage에는 `controller/source-inventory-runtime-readonly.mjs` 단 1개 추가됐다. `tools/install.mjs`와 `tools/update.mjs`가 전체 Git source 집합을 host manifest에 기록하는 설계도 확인했다. 따라서 R2의 상한 30은 **검증기 결함**이다. 다만 실물 Windows manifest map의 개별 항목은 실패 시 출력되지 않아 아직 직접 확인되지 않았다.
- 과거 R2 ZIP·source-lock·CMD는 역사적 실패 증거로 **불변 유지**한다. 별도 `controller-996-interrupted-evidence-r3.mjs`에서 원본 **정확히 38**, Stage **정확히 39**를 요구하고, 기존 immutable manifest SHA, 개별 파일 SHA, 형식, stage 추가 파일 금지, 이중 스냅샷 및 lease/claim 보존 검사는 유지한다. 37/40개, 잘못된 확장자, 파일 바이트 변조, metadata drift, 가짜 R1 관측 입력, symlink/추가 모듈, Linux 운영 호출 거부를 시험한다.
- 새로운 **R3 8파일 ZIP**: `artifacts/controller-996/zgmini-996-interrupted-evidence-r3.zip` SHA256 `327c1c189da4f869a4890ea98c210dd48ef938720a511605549bd8cd5e2bd1a3`. ZIP 내부 8/8 소스 일치. R3 CMD `RUN_996_INTERRUPTED_EVIDENCE_R3_ONCE.cmd` SHA256 `056b72c184c16ad65cbc52f223c8ab0258cfb34e5c914fc377fd5877bd8d5d87`, CLI `b481803a4d7a262e809676b57042a213826dba175d92ae1de19fed49bf515414`, source lock `16ea86d400f6f20a11ba9a8d63138bf66b6c4ea849ffadd637b5d2506f8e3af4`. R1/R2 원본과 R3 및 backlog 판정 포함 회귀 **70/70 PASS**. R3 **Windows 실PC 미실행**이며 읽기 전용 한정, 승인/복구/Claim 승계/Lease 이전 권한은 여전히 없음.
- 다음 실행 하나: 사용자가 원본 Windows의 **새 바탕화면 폴더**에 R3 ZIP만 압축 해제하여 **R3 CMD만 한 번** 실행하고 콘솔 반환 화면을 공유한다. 이전 R2/C CMD 재실행, 파일 섞기, 운영 소스·임대 원장 변경 금지. 이후에만 실제 `replays` 원장과 GitHub Issue/Run/JSON/TXT을 교차 대조한다.

### R3 원본 Windows 실증 성공 및 기존 Issue 재계획 판정 — 2026-11-10 KST

- 사용자가 **신규 R3 CMD 단회 실행의 원본 Windows 콘솔 사진**을 제출했다. 반환 `ZGMINI_CONTROLLER_996_INTERRUPTED_EVIDENCE_R3`, `READONLY_EVIDENCE_SNAPSHOT_CONSISTENT`, `C_CLAIM_INDEPENDENT_OWNER_HANDOFF_NOT_APPROVED`. 기존 R2 상한 결함은 실제 승인 설치 파일 **38개**, 목표 Stage **39개**, Maintainer **7개**를 읽음으로써 해소됐다. 전후 manifest 일치 `sourceManifestHashPostcheckVerified=true`, `replayStatusIsNotExecutionProof=true`, `fullSourceBytePostcheckVerified=false`, `claimProvenanceExternallyPinned=false`, `executionAuthorized=false`, 자체 보고 운영 쓰기/Issue 게시/PC 재시도 **0/0/0**. 이는 C급 복구 성공이나 OS 수준 쓰기 추적 증거가 아니다.
- 물리 Backlog SHA256 `4521688c7d9f0cebbf5a71e1ba71713abc4327a5d9a091ea250f0b001ce44186`, 원본 UTC 중단 구간 `2026-11-10T01:06:53.751Z` ~ `2026-11-10T13:21:26.727Z`. **실제 `replayCount=0`, `replayDoneCount=0`, `replaySkippedCount=0`, `replayEntries=[]`**; replay journal SHA256 `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`는 정확한 빈 JSON `{}` digest와 일치한다. 따라서 과거 가정 `replays={}`와 달리 실물 원장의 빈 기록을 확인한 것이다.
- GitHub의 동일 pause window 전체 Issue 목록을 2회 조회해 등록 **11개**, 그중 서로 다른 원본 `pc-job` Issue **4개** [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217) / [#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219) / [#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226) / [#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227)를 재확인했다. 각 Issue+댓글 4/4 직접 조회 결과 **Open/댓글 0**, 기간 내 Actions **277개 고유 실행**, `pc-job.yml` **0개**, 관련 admission **4개 모두 skipped**. 승인된 JSON/TXT 결과쌍 **0/4 검증**, 미확정 **4/4**. 이 4건은 `OWNER_REPLAN_REVIEW_REQUIRED` 후보이며 성공·실패·결과 파일 부재를 확정하지 않는다. 별도 원본 보존 후 기능 원담당이 **새 requestId로만** 재계획한다.
- C Claim의 내부 marker↔owner nonce/승인 manifest 관계와 이전 PID 종료는 R1 14/14 및 R3 교차검사에서 확인했지만, **새 프로세스에 대한 C급 소유권 인계**는 승인되지 않았다. 봉인된 Controller/Stage/Maintainer 바이트가 로컬 원본 manifest와 같음은 확인했으나, 각 파일이 Git의 승인 source commit 바이트와 같다는 독립 `git show` 비교는 미실시했다. 두 가지가 최종 C 실행의 시작 전 필수 검사다.
- **후속 설계 방향:** (1) 별도 승인 manifest에 기존 claim/세 marker/원본 lease/백로그 SHA·R3 증거 및 신규 C source SHA를 고정하고, (2) 실행 시작에 기존 Git SHA 원본 38+39+7개를 실제 파일과 읽기 전용 비교하며 다른 활성 Controller 소유자를 배제한 뒤, (3) 충돌 없이 새로운 고유 continuation claim을 원자적으로 확보하는 **신규 C급 일회성 명세**를 작성한다. 앞서 이미 시도된 Workflow PUT/Backlog close/Issue 재발행은 모두 **0회**; 새 Claim의 바이트 단위 사전검사 후에만 원본 install lease 및 구 C claim을 **삭제 없는 별도 보관** 대상으로 삼고 단계별 postcheck를 수행하도록 설계한다. 중간 크래시 시 기존/신규 claim 보존·수동 재판정이 우선이며 자동 재시도하지 않는다.
- 새 C 실행은 지난 C 동의를 자동 승계하지 않는다. **신규 C급 변경 명세와 소유권 인계에 대한 사용자 승인 전에는 운영 쓰기 0 유지.** 기존 R1/R2/R3/C CMD 재실행 필요 없음. 전체 수명주기 완료율 **4/5 = 80%**로 유지한다.

### 후속 C 단계의 격리 시뮬레이션 (운영 실행기 아님)

- 새로운 `tools/controller-996-continuation-transaction.mjs` 및 `tests/controller-996-continuation-transaction.test.mjs` **소스 전용 후보**를 Draft에 작성한다. 함수의 운영 호출은 무조건 `C_CONTINUATION_PRODUCTION_NOT_APPROVED`로 **PC 접근/쓰기 전에 거부**하고, Linux의 별도 임시 fixture + `testOnly=true`인 경우에만 모의 Claim/디렉터리 보관을 수행한다. CLI, Windows CMD, 사용자 운영 동의 파일은 **없다**.
- 모의 첫 쓰기 전 원본 38개·Stage 39개·Maintainer 7개의 **총 84개** Git mock bytes를 로컬 파일과 직접 대조한다. 새 고유 UUID continuation Claim을 분리한 다음 구 C Claim을 **먼저** 보관하여 기존 Install Lease 잠금을 유지하고, 원본 Install Lease를 **마지막에** 보관하는 순서를 시험했다. 이후 새 continuation Claim 보관/완료를 분리하며 Workflow PUT, Backlog rename, Issue 게시, 원본 요청 재실행은 각 **0건**이다.
- 독립 신규 동의 거부, Git 바이트 불일치, 신규 Claim 취득 후 중단, 구 Claim 보관 직후 중단, Install Lease 보관 직후 중단 및 정상 완료 등 **6/6 모의 시험 통과**, 전체 로컬 회귀 **76/76 PASS**. 원본/구 Claim/신규 Claim을 중간 장애 단계에서 보존하고 자동 재실행하지 않는다. 독립 소스 감사의 판정은 **Draft 소스 전용 게시 GO**, 실제 C 운영은 **NO-GO**다.
- **실제 운영 구현 전 미충족:** (1) 주입식 mock `readLive`/`sourceRead`/동의를 고정된 Git 승인 증거·84파일 실제 `git show`·기존 R1 14/14·현재 GitHub 원본 결과로 교체, (2) 기존 세 marker 내부 `details`의 승인 manifest/ownerNonce/순서 재확인, (3) 보관 대상 경로의 원자적 **no-clobber**, parent directory fsync, 파일 identity CAS/경합 재조회, (4) Claim 취득 이후 각 rename 전에 최신 공통 Writer/Controller 경합·원본 불변 대조와 크래시 회복 시험, (5) 새로운 source-lock과 정확한 C급 사용자 승인. 이 조건을 누락한 시뮬레이션을 복구 도구로 승격하지 않는다.

## 후속 C 단계 설계 (source-only, 실행 금지)

- 단일 후속 복구는 **이미 시도한 Workflow PUT과 backlog rename을 반복하지 않는다.** 다른 상태가 발견되면 먼저 원인을 분리하며 재시도하지 않는다.
- 이미 닫힌 pause window가 원본 C marker와 물리적으로 동일함을 확인한 뒤에만 수정된 순수 disposition planner로 원본 작업을 **읽기 전용** 재분류한다. 댓글만으로 PC 성공을 인정하지 않으며 결과 JSON/TXT와 동일성 대조가 안 된 항목은 작업자 재계획 상태로 남긴다.
- 과거 C claim의 nonce/PID를 새 프로세스가 자신 것처럼 재사용하지 않는다. 별도의 승인된 인계·배타 소유권 명세가 없으면 원본 C claim과 install lease를 둘 다 보존한다.
- 현재 소스와 신규 후속 실행기의 바이트가 달라지므로 이전 사용자 C 동의와 R2 ZIP 서명을 자동 승계하지 않는다. 새 source-lock/배포 바이트/정확한 단계 범위/실행 소유자 승인을 다시 묶어야 한다.
- 원본 C marker, 보호 상태, 원본 결과 조정 및 물리적 postcheck가 모두 일치하는 경우에만 승인된 후속 단계에서 원본 install lease를 **삭제 없는 archive**로 전환하고, 별도의 완료 marker/독립 postcheck 후 새 C claim을 보관한다.
- 실패·경합·불명확한 파일/원격 읽기·ACK 손실은 `STATE_UNKNOWN` 유지. 원본 #996 재요청, 기존 requestId 재발행/자동 replay, 설치 재개, 무조건 unlock/rollback, 새 B 설치·Writer/Core/DB/D1 변경은 금지한다.

## 다음 명시적 Gate

**현재 Gate = 원본 C Claim의 외부 provenance·안전한 소유권 인계, 실물 Backlog replays/결과쌍, 개별 설치 소스 전체 바이트 검증.** 원본 Windows 중단 단계의 14/14 읽기 전용 관측과 GitHub Actions 277개 조회까지 완료했으나, 이 Gate 전에는 신규 C 운영 실행·원본 Lease archive가 **NO-GO**다. 소스 설계·테스트·GitHub 원격 조회는 4/5(80%) 실제 수명주기 완료로 계산하지 않는다.
