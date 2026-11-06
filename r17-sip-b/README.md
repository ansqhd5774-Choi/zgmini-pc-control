# R17 SIP 장전 수집 — 최소 3파일 B 설치 소스 초안

목적: 이미 설치된 R17의 정규장 IEX 계산·수집·게시 경로는 보존하고, 정규장 외 분기에서만 SIP 15분 지연값을 로컬에 수집·저장한다. 공개 D1/API·Reader 적용은 별도 범위다.

## 상태

- `R17_SIP_B_SCOPE_DRAFT.json`: 사용자 승인 3파일 범위를 잠정 고정한 **source-only draft**. 아직 PC 전제조건 확인 및 B 실행 경로 등록 전이다.
- `r17-sip-b-install-core.mjs`: OS I/O를 주입받는 순수 coordinator. **직접 실행 불가**, GitHub Issue·Windows Runner에서 설치 허용된 작업이 아니다.
- `r17-sip-b-install-core.test.mjs`: 범위·기존 IEX 해시·미등록 실행 차단·중복 추가 파일 차단·순서·복원 시뮬레이션.

## 실제 설치 직전의 필수 작업

1. 실제 PC `E:\ZGmini\projects\zgmini-earnings-history-pc-release`의 source HEAD/config.source가 `d7bc4948573843766ad82c72ff392220178c36a3`인지, worktree가 clean인지, `us-breadth-provisional-cycle.mjs`의 SHA-256이 `c181952f...`인지, 신규 2파일이 없는지를 **읽기 전용**으로 확인한다. 이 SHA는 GitHub에서 조회되지 않는 PC-local 합성 commit이므로 원격으로 재구성했다고 주장할 수 없다.
2. 등록된 기존 B Windows 어댑터의 source-only I/O 구현(공유 Writer lock, 1회 claim, 원본 백업, 기존 Core 일시 정지/재가동, source/config.source 원자적 전환, rollback, GitHub TXT/JSON 업로드)을 이 **정확한 3파일 범위**에 연결한다. 과거 `r17-writer-b`는 5파일·다른 BASE·고정 patch이므로 그대로 실행하면 안 된다. 해당 연결은 아직 구현/등록되지 않았다.
3. GitHub PR #957의 candidate `b30aefd89793de093369044a14d86c1fdc3b0d61` checkout을 다시 검사하고 세 파일의 bytes SHA-256을 manifest와 일치 확인한다. 공개 게시 관련 파일은 설치에서 제외한다.
4. Windows B 어댑터가 등록·인증된 뒤 사용자에게 중복 CMD를 요구하지 않고 승인 범위로 **정확히 1회** 설치하고, 실제 결과 issue/TXT/JSON을 재조회한다. 결과 확보 전 `INSTALLED`·`PUBLISHED` 금지.

해당 core는 운영 PC source·DB·예약·D1·원장을 바꾸지 않는다. `node --test r17-sip-b/r17-sip-b-install-core.test.mjs`는 **실제 Windows 설치 시험이 아니라 fixture**다.
