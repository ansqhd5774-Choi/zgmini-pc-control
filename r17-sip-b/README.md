# R17 SIP 장전 수집 — 최소 3파일 B 설치 소스 초안

목적: 이미 설치된 R17의 정규장 IEX 계산·수집·게시 경로는 보존하고, 정규장 외 분기에서만 SIP 15분 지연값을 로컬에 수집·저장한다. 공개 D1/API·Reader 적용은 별도 범위다.

## 상태

- `R17_SIP_B_SCOPE_DRAFT.json`: 사용자 승인 3파일 범위를 잠정 고정한 **source-only draft**. 아직 PC 전제조건 확인 및 B 실행 경로 등록 전이다.
- `r17-sip-b-install-core.mjs`: OS I/O를 주입받는 순수 coordinator. **직접 실행 불가**, GitHub Issue·Windows Runner에서 설치 허용된 작업이 아니다.
- `r17-sip-b-install-core.test.mjs`: 범위·기존 IEX 해시·미등록 실행 차단·중복 추가 파일 차단·순서·복원 시뮬레이션.
- `r17-sip-b-auth.mjs`, `r17-sip-b-install-windows.mjs`, `r17-sip-b-install-upload.mjs`: 기존 R17 B 공유 잠금·원장·Git overlay·Windows Task probe를 재사용하는 전용 3파일 adapter 및 제한된 증거 회수 코드. **아직 Windows 실제 실행 검증 없음**.
- `.github/workflows/pc-r17-sip-b-install-once.yml`: 전용 Issue one-shot source-only 연결안. **Draft branch에만 있고 main에 등록되지 않아 현재 실행 불가**. 기존 label `pc-r17-writer-b-install`을 재사용하지만 신규 title·schema·operation이 달라 과거 5파일 workflow는 실행되지 않는다.
- 테스트: `node --test r17-sip-b/r17-sip-b-install-core.test.mjs r17-sip-b/r17-sip-b-adapter-contract.test.mjs` (13/13 PASS, source fixture).

## 실제 설치 직전의 필수 작업

1. 실제 PC `E:\ZGmini\projects\zgmini-earnings-history-pc-release`의 source HEAD/config.source가 `d7bc4948573843766ad82c72ff392220178c36a3`인지, worktree가 clean인지, `us-breadth-provisional-cycle.mjs`의 SHA-256이 `c181952f...`인지, 신규 2파일이 없는지를 **읽기 전용**으로 확인한다. 이 SHA는 GitHub에서 조회되지 않는 PC-local 합성 commit이므로 원격으로 재구성했다고 주장할 수 없다.
2. 설치 전용 adapter·Workflow 코드 검토 후 기존 승인된 정규 경로로 main 등록한다. 과거 `r17-writer-b`의 5파일 고정 Workflow를 재실행하지 않는다. 현재 adapter는 code/fixture만 준비됐고 **운영 등록되지 않았다**.
3. GitHub PR #957의 candidate `b30aefd89793de093369044a14d86c1fdc3b0d61` checkout을 다시 검사하고 세 파일의 bytes SHA-256을 manifest와 일치 확인한다. 공개 게시 관련 파일은 설치에서 제외한다.
4. Windows B 어댑터가 등록·인증된 뒤 사용자에게 중복 CMD를 요구하지 않고 승인 범위로 **정확히 1회** 설치하고, 실제 결과 issue/TXT/JSON을 재조회한다. 결과 확보 전 `INSTALLED`·`PUBLISHED` 금지.

해당 core는 운영 PC source·DB·예약·D1·원장을 바꾸지 않는다. `node --test r17-sip-b/r17-sip-b-install-core.test.mjs`는 **실제 Windows 설치 시험이 아니라 fixture**다.
