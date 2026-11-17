# ZGMINI 공통 대기열 5초 감시 — 진행 기록 2026-11-17

- 브랜치: `codex/handoff-five-second-intake-watch-20261117`
- 계획서: `docs/HANDOFF_INTAKE_5S_PLAN_20261117.md`
- 기준 main: `b90bb8ff8c655bacc40f7a2fc32e2c46ccb3f37d`

## 이번 착수 근거

- 실측: 열려 있는 Issue 목록 GET 평균 0.626초(3회). 전체 관제 명령 평균 7.38초(3회), Job 전체 평균 30.67초.
- 기존 `queue-board`는 15분 예약 + 이벤트 실행이며 공통 대기열 PC의 고정 Runner 한 좌석을 사용. GitHub Actions cron 최소 5분이므로 5초 실행용으로 쓰지 않음.
- GitHub 자동 접수/선별 봇 증거와 실제 ChatGPT 처리 담당자 전달은 구분되며, 빠른 감시가 업무를 처리하는 일은 없음.

## 진행

- [x] 1/5 현재 구조·실측 확인
- [x] 2/5 별도 경량 read-only 감시 설계
- [x] 3/5 5초 루프 소스·격리 모의 테스트 6개 작성; 로컬 Node 22 PASS 6/6. 1차 테스트에서 rate limit header 누락을 숫자 0으로 처리한 결함을 재현해 수정
- [x] 4/5 PR #1850 main 병합 `9dd289a6033a8bba5245cb07da2a42c9535e912b`; 격리 Windows PR Evidence CI Run #43995758736 `407/407 PASS` (신규 6개 포함); GitHub 변경 파일 4개 대조
- [ ] 5/5 실제 PC의 분리된 상주 프로세스 설치·인증·5초 계측 실증

## 2026-11-17 후속 — PC 실제 적용 가능성 점검

- **기존 완료점 재사용:** PR #1850의 소스 병합 SHA `9dd289a6033a8bba5245cb07da2a42c9535e912b`, 격리 Windows source CI 407/407 PASS. 검증된 소스·CI를 중복 실행하지 않았다.
- **정확한 PC 구분:** 공통 대기열 호스트 `DESKTOP-N62L0NG`의 `zgmini-handoff-ci-spare-01`은 Windows 자동시작 GitHub Actions Runner로 확인되어 있으나, 별도 5초 감시 프로세스 설치·활성화 증거는 없음.
- **기존 허용 경로 확인:** `agent-handoff*`, `pc-shared-issue-admission.yml`, `pc-host/process-inventory-readonly.yml`은 사건/워크플로 단회 GitHub Actions 또는 격리 source CI이다. 상주 watcher를 Runner와 분리해서 등록·부팅 시 기동하고 교체·복구하는 승인된 실행기 경로는 미확인. 기존 workflow를 원격 임의 실행/상주 설치 수단으로 변경하지 않는다.
- **인증 수명:** 현재 Workflow의 `GITHUB_TOKEN: ${{ github.token }}`은 GitHub Actions Job이 끝나면 만료되는 인증이다(공식 GitHub Docs). 독립 상주 프로세스에서 읽기 전용으로 사용할 검증된 자격증명 제공·갱신·폐기 방법 미확인.
- **Node 실행조건:** CI `setup-node`의 Node22는 Job 시점 검증이며 Windows 독립 상주 서비스의 설치 경로/재기동 조건 증거가 아니다.
- **실제 차단 이유:** 안전한 독립 상주 실행 경로와 인증 경로가 미확인되어 `RUNTIME_ACTIVATION_BLOCKED`. 설치·활성화·실제 5초 운영 계측 **0회**, 기능별 실제 업무 Runner 점유 **0건**. 소스 4/5와 실제 운영 0/1을 분리 보고한다.
- **다음 필수 행동:** 기존 공통 대기열 PC의 승인된 사용자/시스템 관리 경로에서 별도 읽기 전용 감시기의 자동시작·복구와 read-only GitHub 토큰 공급/회전을 확정 → 정확한 SHA·최소 권한·승인 범위를 검증한 뒤 단회 설치 → 실제 5초 간격·작업 비간섭·백오프를 관측한다. 신규 Windows 서비스/예약 또는 비밀 설정이 C급이면 사용자 직접 승인·수행을 따른다. Runner를 24시간 점유하거나 Actions Job 토큰을 영구 저장하지 않는다.
- **작업 이력 보호:** 이전 브랜치에서 만든 PR #1855가 과거 squash 병합 이력 차이로 기존 watcher 소스 3파일을 신규로 다시 나타내는 충돌을 확인하여 **미병합 CLOSED** 처리. 최신 main SHA `5ca284bec86ba1d05a608db806e3dd822d664889`에서 이 진행기록 **1파일만** 수정하도록 새 브랜치를 생성했다.

## 2026-11-17 후속 — 5초 변경 감지와 실제 접수 영수증 검증 분리

- **추가로 확인된 실제 결함:** PR #1850의 5초 소스는 `agent-handoff` Issue 변화만 판정하므로 사건이 제대로 **접수되었는지**를 판단하는 `HANDOFF_ROUTED` 봇 영수증을 검증하지 않았다.
- **소스 보완:** `agent-handoff/intake-receipt-readonly.mjs`는 변경된 Issue의 인증된 원본·전체 댓글(최대 4페이지)을 읽고 기존 `queue-selector.mjs`의 `assessIncident`로 정확한 bot receipt/fingerprint/selector 상태를 판정한다. 위조·출처 불일치·페이지 누락이면 `receiptVerified=false`다.
- **비차단 구조:** `agent-handoff/intake-watch-5s.mjs`의 Issue 목록 체크 5초 루프와 영수증 확인을 별도 비동기 레인으로 분리. 영수증 대기열은 최대 25개, 동일 검증의 동시 실행은 1개, rate-limit/인증 거부 시 백오프. 기존 작업 Runner 점유·GitHub Issue 쓰기·운영 PC 수집/설치·배포 없음.
- **검증:** [PR #1859](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1859) 격리 Windows `ZGMINI Agent Handoff PR Evidence CI` Run `43999193344` **412/412 PASS**, `c996-source` PASS. `main` 병합 SHA `ed9fd88898177c4bb2d5528196f336ded202d61d`. 최신 main에서 소스 2파일·시험 1파일 원격 재조회 PASS.
- **운영과 구분:** 위 회귀는 개발 소스 검증이다. 실제 PC의 독립 상주 감시기 설치·유효한 read-only 인증 제공·부팅 후 재기동·실제 매 5초 계측은 **미실시**. `RUNTIME_ACTIVATION_BLOCKED` 및 **5단계 중 4단계 완료(80%, 운영 0/1)**를 유지한다. 실제 독립 ChatGPT 대화 전달 여부도 별도 미구현이다.
- **다음 필수 실행:** 사용자 또는 기존 승인된 PC 관리 경로에서 독립 상주 실행/복구 계약과 인증 갱신 수단을 확정한 뒤, 해당 운영 효과에 필요한 정규 승인·최소 설치·실측으로 5/5를 완료한다. GitHub Runner 좌석을 무한 점유하거나 Job 토큰을 유출/재사용하는 우회는 금지한다.

## 2026-11-17 KST 11:01 — 공통 대기열 PC 운영 실증 1회 (읽기 전용)

- **원본 요청:** [#1863](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1863) `pc-process-inventory-readonly`, `role=handoff`, `requestId=b8372b69-85b0-4a7b-91d6-c76420cf0d25`.
- **실제 실행:** [Actions Run 43999701240](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43999701240), `handoff-process-snapshot` Job `133760412066`, Runner `zgmini-handoff-ci-spare-01`, hostname `DESKTOP-N62L0NG`; `PASS / PROCESS_INVENTORY_COLLECTED`.
- **원격 결과 원본:** `results/pc-process-inventory-43999701240-1-handoff.json` (blob `d01e47347f22138f53d172ddd7b7ff20a9f8e468`)와 `.txt` (blob `4c70129ed710917328960452f6621698d2b08f94`) **2/2 직접 재조회**, 원본 Issue 봇 receipt [#1863 댓글 6935589347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1863#issuecomment-6935589347).
- **실제 등록 상태:** `services=OK`이며 `actions.runner.ansqhd5774-Choi-zgmini-pc-control.zgmini-handoff-ci-spare-01` **Running/Auto** 1개. `tasks=OK, tasks=[]`; `startup=OK, startup=[]`. 격리 PC Windows `totalProcessCount=262`, `node.exe=6`, `Runner.Listener.exe=5`, `Runner.Worker.exe=1`. 이 검사는 프로세스 명령줄을 수집하지 않으므로 기존 일반 `node.exe`의 감시기 여부는 독립 확인할 수 없다. 다만 **ZGMINI 이름의 별도 감시 서비스/예약/시작프로그램 등록은 관측되지 않았다.**
- **실제 지연 참고:** Run 생성 `01:59:54Z` → Job 시작 `02:00:41Z` (약 47초) → 결과 로그 `02:01:08Z` (생성 후 약 74초). 따라서 기존 단회 Actions Job 재활용만으로 5초 감시 보장을 주장할 수 없음.
- **권한/환경:** 공급자 호출 `0`, 운영 데이터 쓰기 `0`, D1 쓰기 `0`; PC 설치·인증 설정·서비스·예약·Runner 변경 `0`.
- **현재 상태:** 5초 감시 소스 및 변경 사건의 bot receipt 검증은 PR #1850/#1859 main 반영 + Windows CI 완료. **실PC 상주 실행 및 유효한 읽기 전용 GitHub 자격·회전은 여전히 미설치/미확인**, `RUNTIME_ACTIVATION_BLOCKED`, **5단계 중 4단계(80%) 유지**. 실제 실PC 5초 가동은 0회.
- **다음 필수 실행:** 정상 업무 Runner를 점유하지 않는 별도 상주 실행/부팅 복구 + 최소권한 인증·갱신을 기존 등록 계약에서 실제 증명하거나, 그 경로가 없으면 C급 사용자 직접 설정 범위 및 안전한 설치 패키지를 명시한다. 권한 밖 Windows 서비스 설치·무한 Job 실행·임시 Job 토큰 영구 저장은 시행하지 않는다.

## 2026-11-17 후속 — 접수 폭주 시 영수증 검증 누락 방지

- **결함:** 기존 5초 감시에서 `receiptQueue`가 25개를 넘으면 나머지 Issue 번호를 `RECEIPT_QUEUE_LIMIT`로 보고만 하고 버려, 새 댓글 등 변경이 없으면 누락 사건을 영수증 검증하지 못했다.
- **수정:** [PR #1868](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1868)에서 25개 활성 큐는 유지하되 초과 사건을 메모리 보류 큐로 연결해 순차 검사하도록 변경했다. GitHub 목록 한 페이지 최대 99개/미완전 목록 차단, 5초 체크 루프는 영수증 검사를 await하지 않는 기존 구조 유지.
- **검증:** 격리 Windows CI Run [44002369326](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44002369326)에서 **414/414 PASS**. 27건 동시 발견 시 실제 receipt verifier 27/27 처리, 단일 영수증 레인 최대 동시 1, 영수증 검사 정체에도 5초 주기 목록 확인 4/4 유지 테스트 추가. `c996-source`도 PASS.
- **main 병합:** `ce4b462d0403aaaaed23141fa4dcb66a868421d7`, 기존 감시 소스 1파일·신규 회귀시험 1파일. 기존 GitHub 접수 workflow·Runner·PC 데이터/DB/D1·예약·보안·키 설정 변경 없음.
- **실제 운영:** 이 개선도 **SOURCE_ONLY**. 공통 대기열 PC의 5초 감시 상주 기동/최소 권한 인증·토큰 회전은 미완료. 활성화 증거가 없으므로 **5단계 중 4단계(80%), 실운영 0/1, `RUNTIME_ACTIVATION_BLOCKED`**를 유지한다.
- **다음 필수 작업:** 기존 PC의 C급 직접 설정으로 별도 자동 시작/복구 및 만료·권한을 관리하는 GitHub 읽기 인증이 허용될 때 최소 범위에 한해 설치·실측한다. 임시 Job 토큰 보관·기존 Runner 점유 또는 미승인 Windows 서비스/예약 생성 금지.

## 2026-11-17 후속 — 독립 감시기 인증/기동·실측 준비 (소스)

- **기존 완료 증거:** #1870 `main` 병합 `8340b1d51182b05d18c4362db4c3cddcdcac5aa7`, 격리 Windows **420/420 PASS**, Retry-After·Rate-limit reset 준수 및 401 종료. 이력은 반복 검사하지 않는다.
- **현재 소스 보완:** 공통 Windows PC에서 사용자가 승인한 GitHub CLI 자격 저장소를 통한 선택적 `GH_CREDENTIAL_STORE` 인증 공급자 추가. `gh auth token --hostname github.com`의 stdout을 Node 메모리에서만 활용하고 환경/argv·로그/Issue에 비밀을 기록하지 않음. 60초 캐시를 유지하되 인증 저장소 조회 실패·토큰 형식 오류는 watcher만 즉시 종료한다. 일반 네트워크 제한은 기존 백오프를 유지한다.
- **감시 주기 실측 경로:** 정상 감시 12회마다 `WATCH_HEARTBEAT` 최소/최대 관측 간격을 비민감 로그로 기록해 5초 주기를 향후 실PC에서 확인할 수 있도록 함. 실제 통신 성공·원담당 수신과는 분리.
- **Windows C급 활성화 준비:** `tools/handoff-watch-user-start.cmd`는 검증된 Node22 실행파일을 인수로 받아 기존 고정 소스 감시기만 기동하고, 비밀 인수·서비스 등록·예약 생성/교체를 수행하지 않음. 비민감 기록은 사용자별 `%TEMP%\\ZGMINI`에만 기록. C급 1회 PC 직접 설정과 STOP/복구 기준을 `docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md`로 명시.
- **현행 실제 상태:** 해당 격리 PC에 별도 watcher 작업·영구 Node22·인증 자격 저장소 등록이 확인되지 않았음. 신규 GitHub CLI/계정/Windows 예약·서비스 설치/PC 쓰기는 이번 소스 준비에 포함되지 않는다. `5단계 중 4단계(80%), 실운영 0/1, RUNTIME_ACTIVATION_BLOCKED` 유지.
- **다음 행동:** GitHub PR+격리 CI로 소스/정적 계약 통과 → `main` 읽기 검증 → C급 실제 장비 사용자 설정 필요 범위만 제시 → 실제 5초 heartbeat·Runner 업무 비간섭·접수 영수증을 일회 측정.

## 2026-11-17 최종 확인 — PR #1872 인증 실패 안전 종료, CI, main 병합

- **LAST PASS:** [PR #1872](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1872) 최종 HEAD `0b4c7b32f7284ad68bbb6e60da8e668019f0e0d0`, squash merge **`c4ae26e5d07392cc0507bb4cf91ee4fd4a4b3381`**. 변경 파일 8개(소스·시험·사용자 기동 CMD·계약·진행기록), 운영 저장소/Controller/Runner/DB/D1 변경 없음.
- **확인된 결함과 수정:** 승인 계약은 GitHub CLI 자격 저장소에서 인증을 읽을 수 없으면 종료를 요구했지만, 기존 감시기는 `HANDOFF_GH_CREDENTIAL_UNAVAILABLE` 및 `HANDOFF_GH_TOKEN_INVALID`을 반복 백오프함. Source `df6d683fa122684325c811e4ce82c822ce894212`에서 두 경우 `AUTH_SOURCE_UNAVAILABLE_STOP` 단회 종료, Test `0b4c7b32…`에서 GitHub 요청/재시도 0회 확인.
- **격리 Windows 전용 CI:** 기존 보안 규칙에 따라 새 SHA에 `agent-handoff-ci` 라벨 이벤트를 다시 발생시켜 [Run #44006803180](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44006803180) **431/431 PASS**, 0 FAIL. Runner `zgmini-handoff-ci-spare-01`, source checkout **정확한 PR HEAD `0b4c7b32…`**, 신규 인증 실패 시험 로그 직접 확인. 별도 [C996 #44006160603](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44006160603)은 43/43 PASS이나 감시기 CI가 아니므로 별개로 기록.
- **운영 실체:** `DESKTOP-N62L0NG`에 별도 Windows Task 등록/실행·고정 Node22·안전한 GitHub CLI 인증·실제 5초 heartbeat·영수증 실측은 **아직 확인되지 않음**. 2026-11-17 읽기 전용 [#1863](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1863)의 기존 PC 등록 증거를 재사용하며 추가 전체 스냅샷을 수행하지 않음.
- **진행률:** 1~4/5 **DONE, 4/5(80%)**. 5/5 **BLOCKED(C급 등록·인증 미실행)**, 실제 상시 감시 0/1. 원담당 ChatGPT 채팅 자동 전달은 이 감시기의 계약 범위가 아니며 접수 영수증과 구분.
- **NEXT(한 가지 필수 실행):** 사용자가 `docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md`에 따라 격리 PC 저권한 사용자·고정 source/Node22·자격 안전성을 먼저 확인한 뒤 C급 Task `ZGMINI-HANDOFF-WATCH`를 **직접 1회 등록**. 이후 최소 2회 `WATCH_HEARTBEAT` 실측, 유효 `HANDOFF_ROUTED` 영수증, 기존 Runner Job 비간섭·GitHub 제한 준수 검증. 무승인 신규 서비스/예약 원격 생성·토큰 로그·Runner 장기 점유 금지.

## 2026-11-17 후속 — C급 실제 활성화 전 자격/소스 적격성 확인

- **승계 완료점:** #1872 `main` 병합 `c4ae26e5d07392cc0507bb4cf91ee4fd4a4b3381`, Windows 감시 전용 CI **431/431 PASS**, 진척 **4/5(80%)**. 기존 CI·PC 전체 스냅샷 반복 없음.
- **실제 발견한 운영 위험:** GitHub CLI가 시스템 credential store를 이용하지 못하면 토큰을 평문 설정 파일에 저장할 수 있음(공식 [gh auth login](https://cli.github.com/manual/gh_auth_login)). 기본 `gh auth login`의 일반 OAuth scope는 private repository Issues 읽기에 필요한 최소 권한보다 큼. 따라서 C급 승인 사용자가 실제 저장 방식/기존 최소 권한을 로컬 확인하지 않고 설치하는 것은 승인 계약과 맞지 않음.
- **소스 정확성:** C 설치 검증 후보는 #1872 최종 HEAD `0b4c7b32f7284ad68bbb6e60da8e668019f0e0d0`가 병합된 **`c4ae26e5…`**. 운영 PC의 현재 checkout SHA 또는 실제 설치된 별도 감시 프로세스 SHA로 단정하지 않는다. 임의로 Runner `_work`를 상주 소스로 쓰거나 최신 `main`에 자동 추종하지 않음.
- **문서 최소 보완:** `docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md`에 정확 source pin·평문 fallback STOP·광범위 신규 GitHub CLI 기본 로그인 금지·인증 출력 비공유를 명시. 소스/시험·운영 PC/Runner/DB/D1/원본 Issue 변경 없음.
- **NEXT:** 사용자 C급 직접 확인 시 동일 Windows 저권한 계정의 고정 Node22·GitHub CLI/Windows 보안 자격증명·안정적 source 경로가 적격인지 판정. 하나라도 부재/불명확하면 새 토큰·서비스·예약으로 우회하지 않고 **RUNTIME_ACTIVATION_BLOCKED** 보존. 적격일 경우에만 별도 ONLOGON Task 1회 등록 → heartbeat 2회 및 `HANDOFF_ROUTED` 영수증·Runner 비간섭 확인.

## 독립성·실제 상태

현재 단계는 **SOURCE_MERGED_RUNTIME_NOT_DEPLOYED**. 새 watcher는 해당 PC에 설치/기동되지 않았고, GitHub Actions 15분 주기도 변경하지 않았음. 기존 6 Runner 운영·공유 원장·DB/D1·게시 영향 없음.

**현재 완료율:** 소스/PR 범위 4/5 (80%), PC 실제 5초 감시 활성화는 0/1.

**다음 필수 행동:** 실제 공통 대기열 PC에서 기존 승인된 읽기 권한·상주 실행/재시작 계약과 B급 유지보수 적용 경로 확인 → 허용 범위 내 설치 → 실제 5초 주기·기존 업무 Runner 비점유·재연결·API quota 측정. 허용된 설치 경로가 없으면 자동화 미적용 사실과 정확한 부족 권한을 기록하며 다른 원격 실행 도구로 우회하지 않는다.

## 2026-11-17 공통 대기열 PC 한정 후속 — 영수증 검증 429 누락·중복·401 복구

- **범위 확정:** 이 기록은 **공통 대기열 PC의 독립 5초 접수 감시 소스 자체** 장애 복구에만 적용. 프로세스 총괄 업무·중앙 #68의 다른 인계·W01~W05 기능 승인/설치 판단은 처리하지 않음.
- **확인된 코드 결함:** `agent-handoff/intake-watch-5s.mjs`가 영수증 검증 lane의 HTTP 403/429 실패 후 해당 Issue를 대기열에서 제거하여, 5초 목록이 이후 `304` 또는 불변 `updated_at`이면 잃어버린 영수증을 자동 재검증하지 않음. 검증 중인 사건을 `receiptPending`에서 즉시 제거하여 빠른 연속 업데이트 시 진행 중 신원을 큐 중복 방지 대상으로 취급하지 않음. 영수증 검증 lane의 HTTP 401이 목록 loop 전체 정지 조건이 되지 않음. 별도 `intake-receipt-readonly.mjs`가 GitHub `Retry-After`·quota-reset 대기 근거를 예외에 보존하지 않음.
- **최소 수정 PR:** [#1909](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1909), 정확 기존 **소스 2개·시험 2개**만 변경. 임시 실패(403/429/5xx/AbortError) 영수증 번호를 대기열에 보존해 **최대 3번만** 서버 지정 retry-after·할당량 reset 이후 재검증. 3회 후에는 `RECEIPT_RETRY_EXHAUSTED`로 종료하고 자동 재시도 무한 루프 금지. 진행 중 같은 번호의 변경은 1회 후속 검증으로 합치고 in-flight 완료 전에 pending 집합에서 제거하지 않음. 영수증-only 401은 `WATCH_RECEIPT_AUTH_REJECTED_STOP` 후 전체 감시 정지; 비정형 예외 원문·토큰은 로그에 미게시.
- **5초 루프 독립:** 영수증 오류 백오프는 영수증 레인에만 적용하며 정상 목록 GET 5초 타이머를 점유하지 않음. 전체 인증 401이 발생하면 반복 조회를 멈춤. 새 GitHub Actions/상주 Runner/예약/C급 Windows 작업을 만들지 않음.
- **격리 테스트:** 신규 경계 시험 5개(HTTP 429 Retry-After, 403 reset epoch, `304` 불변 목록의 429 복구, 영수증-only 401 종료, 3회 제한), 기존 테스트 합계 [Handoff Windows CI Run 44028599065](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44028599065) **455/455 PASS, 0 FAIL**, 정확 소스 PR HEAD `d159e736872cfea3efc3f816c70c2bbdcf159d32`. [C996 Run 44028592068](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44028592068) `completed/success`.
- **main 적용:** #1909 실제 squash 병합 `0a30d3061d25fc826e2b149046dea46d123e785e`; 운영 PC, 기존 격리 Runner, Windows 사용자 작업 스케줄러, 서비스, 인증 자격, SQLite/D1/공급자 호출·원자료 변경 **0건**.
- **운영 미완료 그대로:** 소스 병합은 **5초 감시기의 실제 PC 설치·부팅 재기동·최소권한 credential·heartbeat 계측을 증명하지 않음**. 원래 5단계 계획 **4/5(80%) 소스/테스트 완료**, 실운영 **0/1 및 RUNTIME_ACTIVATION_BLOCKED** 유지. 기존 C급 등록 계약 `docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md`는 변경/승인하지 않음.
- **다음 실행:** 공통 대기열 PC 독립 감시기 C급 사용자 직접 활성화가 실제 승인·검증됐을 때만 정확 설치 source/Node/인증·최소 2회 heartbeat·5초 목록과 영수증 lane·Runner 비간섭 실측. 별도 승인이 없으면 운영 설치를 시도하지 않고 추가 코드 변경도 관측 결함에 한정.

## 2026-11-17 공통 대기열 PC 전용 — 실제 C 활성화 전 불변 소스 후보 정정

- **착수·범위:** 대기열 5초 감시 운영 5/5 설치 실측을 진행하기 전 기존 승인된 C급 실행 계약·고정 소스·기존 실제 PC 관측 증거를 점검. 다른 W0X 업무·프로세스 총괄의 승인·Controller 설치/Writer 범위는 변경하지 않음.
- **실제 장애 위험:** 과거 `docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md`의 C 설치 source pin `c4ae26e5d07392cc0507bb4cf91ee4fd4a4b3381`은 PR #1909의 영수증 403/429 제한 재검증·401 종료·in-flight 중복 제거 수정 전 코드. 그 pin으로 사용자 C 설치 시 복구 결함이 그대로 재유입될 수 있음. 이 코드/계획 오류를 미수정 상태로 두지 않음.
- **실제 소스 점검:** 제어 `main`과 PR #1909 squash `0a30d3061d25fc826e2b149046dea46d123e785e`의 6개 watcher/import 모듈 및 1개 CMD Git blob **7/7 동일**. 과거 `c4ae26...`와는 watcher·receipt verifier·selector 3모듈의 blob이 서로 다름. 최신 파일을 과거 출처 SHA-256으로 오인하지 않고 명시적인 Git blob SHA-1로 기록.
- **최소 변경 PR:** [#1913](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1913) 소스 설치 지침 1파일·정적 계약시험 1파일만 수정. 불변 실행 source 후보를 `0a30d306...`로 정정하고 **필요한 7파일만** 후보로 명시해 `agent-handoff` 전체/기능별 source/Controller 복사로 확장 금지. 실제 고정 설치 경로·저권한 Windows 사용자·Node22·인증 자격을 추정하거나 자동 등록하지 않음. 정적 시험에서 6개 `.mjs` Git blob SHA-1을 실제 바이트로 계산하고 계약에 명시된 해시 및 CMD blob 참조를 검사.
- **CI / main:** [격리 Windows PR CI Run #44030504705](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44030504705) **456/456 PASS, fail 0**; [C996 #44030489660](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44030489660) **SUCCESS**. 소스·계약 PR #1913 squash main **`e37ecbab206b31e84ceee7581e8188b1e1a9cefe`**.
- **운영 차단 그대로:** 현재 확인 가능한 마지막 실제 공통 대기열 PC read-only 프로세스 원본은 [#1863](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1863). 별도 5초 상주 `ZGMINI-HANDOFF-WATCH` 작업의 **등록·활성화**, 저권한 사용자·Node22 고정 실제 경로, 최소 읽기 권한을 가진 안전한 자격 저장소, 2회 이상 heartbeat, Runner 비간섭의 **새 운영 실증은 없음**. Github 소스/CI 통과를 실제 가동으로 승격하지 않음. **소스 계획 4/5(80%), 운영 0/1, RUNTIME_ACTIVATION_BLOCKED 유지.**
- **다음 정확 작업:** [C급 사용자 직접 활성화 계약](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md)에 따라 운영 PC에서 허가된 저권한 사용자·Node22·GitHub CLI 안전한 최소 읽기 권한·고정 7파일·Task 신규 등록 충돌을 실제 확인한 경우에만 **사용자 C급 직접 등록** → 2회 heartbeat/429·401/Runner 비간섭 실측. 한 조건이라도 미확인이라면 `STOP`; GitHub Actions Job 장기 점유·원격 셸·미승인 C 등록으로 우회하지 않음.

## 2026-11-17 공통 대기열 PC — C급 활성화 로컬 읽기전용 사전검사 추가

- **범위/의도:** 기존 `RUNTIME_ACTIVATION_BLOCKED`는 저권한 PC 사용자·고정 Node22·최소권한 읽기 인증·Task 승인 및 실제 heartbeat가 미확정이기 때문. 계약서를 반복 확장하지 않고 사용자 직접 C급 실행에 앞서 재현 가능한 **무변경 로컬 적격성 검사**만 추가. 프로세스 총괄·W01~W05 기능/승인/설치는 미개입.
- **기존 증거 재사용:** 사용자 기동 CMD/7파일 소스 pin [#1913](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1913), 소스 및 C 계약 `0a30d3061d25fc826e2b149046dea46d123e785e` 불변 SHA, 영수증 복구 [#1909](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1909). 별도 PC 스냅샷·서비스 설정·인증 수집 없음.
- **새 코드:** [PR #1916](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1916)에서 `tools/handoff-watch-c-preflight.mjs` 신규. 로컬 후보 Git blob 7개, Windows/고정 호스트 `DESKTOP-N62L0NG`, Node22, 원시 토큰 환경변수 부재만 읽고 JSON에 안전한 판정값 반환. 모든 파일 읽기 2MB 제한·symlink 거부. 검사기는 `GH auth`·token value/권한 조회·GitHub API 네트워크·Task 등록/변경·파일 쓰기·서비스/Runner·watcher runtime을 호출하지 않음. `SOURCE_PREFLIGHT_PASS_C_AUTH_AND_TASK_REQUIRED`는 **소스·호스트 사전 확인**만 뜻함; 실제 C 승인·설치/권한·heartbeat 판정 아님.
- **Windows 실제 결함 재현/보완:** 첫 [Windows CI #44033263297](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44033263297)은 CMD Git blob LF와 체크아웃 CRLF 형식 차이로 7파일 중 **6/7**, 신규 시험 **3 fail**. 실패 결과를 PASS로 처리하지 않음. `tools/handoff-watch-user-start.cmd` 한 파일에만 `.gitattributes` `text eol=lf` 추가. 이미 CRLF인 Windows 체크아웃은 **CMD에 한해서만** CRLF→LF 변환 결과 Git blob이 동일하면 허용하고, 그 외 명령 문자/바이트 변경은 `SOURCE_PREFLIGHT_STOP`. 정규화 여부 비민감 반환.
- **최종 회귀:** 새 소스 HEAD `057f7ec9911d21b411a5da32051250926d56e0e7`, [Windows Handoff PR CI Run #44033639167](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44033639167) **461/461 PASS, fail 0**. 수정 시험: 7파일 일치/잘못된 호스트·Node·원시토큰 환경 차단/소스 위변조 차단/Windows CMD CRLF 동치만 허용·CMD 명령 변경 차단. [C996 #44033579303](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44033579303) `completed/success`.
- **main 반영:** #1916 squash `c8cb7808293a2bb764d5b14aece29df27b5963af`. 정확 변경 파일: `.gitattributes`, 신규 로컬 사전검사 소스·회귀시험 2개, 기존 C activation 계약 1개 (총 4파일). 실제 공통 대기열 PC/Windows Task/Node 설치/자격 저장소/Runner/API 소비/DB/D1·공급자·데이터 쓰기 **0건**.
- **최근 자연 예약 참고 (5초 감시 실증이 아님):** [Wide Scout 기존 schedule #44031219849](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44031219849), Job 133863360511, 2026-11-17T06:26:25Z 생성→06:26:27Z 시작 **2초 대기**, 06:27:00Z `SUCCESS`, 격리 Runner `zgmini-handoff-ci-spare-01`. 해당 schedule Run은 새 5초 상주 watcher가 실행됐다는 의미가 아니며 15분 예약 장기 안정성의 충분 표본도 아님.
- **최종 경계/다음:** 기존 5초 계획은 여전히 **4/5(80%)**, 운영 0/1, `RUNTIME_ACTIVATION_BLOCKED`. PC 사용자가 안전한 고정 소스/Node를 실제 확인하고 위 사전검사 `SOURCE_PREFLIGHT_PASS_C_AUTH_AND_TASK_REQUIRED`를 받은 뒤에도 저권한 Windows 사용자·GitHub 최소권한 보안자격·Task 중복 방지·C급 직접 등록을 별도 확인/승인해야 함. 이후 정상 (12회마다 1회) `WATCH_HEARTBEAT` 최소 2회와 실제 영수증/Runner 비간섭 측정으로만 5/5 완료 판정. 미승인 C 설치·원격 명령 우회 금지.
