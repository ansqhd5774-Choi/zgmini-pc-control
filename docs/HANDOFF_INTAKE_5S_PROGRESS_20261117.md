> **종료 기록 (2026-11-20):** 5초 상주 감시기는 사용자 요청으로 폐기했다. 기존 4/5 진행 기록은 과거 개발 증거일 뿐 미완료 설치의 후속 실행을 지시하지 않는다. 마지막 격리 PC 읽기 전용 실측 Issue #2384 / Run #44557834733은 `ZGMINI-HANDOFF-WATCH` 작업 없음(`tasks=[]`, `taskStatus=OK`)을 확인했다. 운영 설치 해제 성공을 주장하지 않는다. 기존 이벤트 기반 Handoff와 15분 관제는 유지한다.

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

## 2026-11-17 공통 대기열 PC 전용 — 5초 감시기 예외 로그 비밀 노출 방지

- **원래 진행률 보존:** 기존 5초 감시기 1~4/5 소스/테스트 완료, 실제 C급 사용자 등록·저권한 인증·2회 `WATCH_HEARTBEAT` 미실시. PC 실운영은 계속 **0/1, `RUNTIME_ACTIVATION_BLOCKED`**, 실제 5초 상주 구동으로 주장하지 않는다. 연결된 별도 원격 데스크톱 장치가 오프라인이며 대기열 PC와 같은 장치라는 근거도 없으므로 원격 설치/자격 조작을 실행하지 않았다.
- **확정된 결함:** 감시기의 `runWatch()` 일반 catch에서 `WATCH_READ_FAILED.code`에 임의 `Error.message` 앞 80자까지 사용해 예외에 포함된 인증 문자열 또는 Windows 개인 경로가 감시기 관측 로그로 전파될 위험이 있다. 최상위 `main().catch`도 임의 예외 원문을 좁은 `Bearer` 정규식 치환 후 stderr에 기록해 추가적인 경로·정보 노출 가능.
- **소스 개선:** [PR #1920](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1920)에서 `agent-handoff/intake-watch-5s.mjs`의 목록 조회/최상위 오류 출력을 **사전 정의된 고정 코드 allowlist**로 변경. `AbortError`는 `REQUEST_TIMEOUT`, 내부 정적 유효성 문제는 고정 `HANDOFF_WATCH_*` 코드, 외부/알 수 없는 예외는 각각 `WATCH_REQUEST_FAILED` 또는 `HANDOFF_WATCH_FATAL_STOP`만 기록. 인증정보·에러 본문/로컬 절대경로를 로그에 넣지 않는다. 5초 주기·Retry-After·401 종료·독립 영수증 레인·작업 비간섭 동작 자체는 변경 없음.
- **회귀:** 기존 테스트 파일 1개에 2건 추가. 외부 fetch 예외의 인증문자/호스트경로가 관측 로그에 절대 포함되지 않음, 정상 내부 고정 오류코드는 유지, 예상치 못한 최상위 오류도 고정 안전 코드만 출력. 최초 Windows CI [#44035027481](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44035027481)는 신규 로그 시험 2건 PASS였으나 예전 watcher Git blob pin을 갱신하지 않아 **459/463 PASS, 4 fail**. 실패를 보존하고 병합하지 않은 채 소스 7파일/사전검사기/계약 시험의 새 불변 버전을 갱신했다.
- **최종 검증:** 정확 PR HEAD `3b26b18fe8e3e761ea322fabf844ac911dc64ca9`에서 Windows Handoff CI [#44035399650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44035399650) **463/463 PASS, fail 0**, C996 [#44035374844](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44035374844) `completed/success`. #1920 main squash **`f1a280b9c24ec8d01ee228115b92ebb964f49802`**.
- **설치 source 정확성:** 초기 PR 검증용 중간 commit `7f6684ca2f6fd4d6362f3a1eae7b096ba90ef823`은 **실제 C 설치 pin이 아니다**. main 병합 후 정확 7파일 Git blob 일치를 7/7 재확인하고, 최종 설치 후보를 `f1a280b9c24ec8d01ee228115b92ebb964f49802`로 재고정했다. 신규 watcher blob `2515dd83b96f76146dc75991fa8648cae6d42382`; 나머지 6파일은 기존 고정값 유지. `tools/handoff-watch-c-preflight.mjs`, `tests/agent-handoff-watch-c-startup-contract.test.mjs` 및 C 활성화 계약도 동일 최종 main pin으로 정합화. Git blob SHA-1과 Windows SHA-256 혼동 금지.
- **작업 경계/다음:** 실제 Windows C급 등록·Task/서비스·GitHub 인증·토큰 회전·Node 설치·Runner·수집기/DB/D1/원자료·공급자 호출 변경 0. 프로세스 총괄 의사결정·중앙 #68 원장 및 W01~W05 기능에 미개입. 다음은 운영 PC에서 **사용자 직접** 고정 7파일·Node22·최소권한 GitHub credential 저장 방식·Task 중복/자동시작을 확인한 후 C급 설정, 정상 5초 heartbeat 최소 2회와 영수증 검증 및 Runner 비간섭을 실측한다. 실제 C 적격성 증거 없이는 5/5 완료로 판정하지 않는다.

## 2026-11-17 공통 대기열 PC — WATCH_HEARTBEAT 성공·실패 관측 분리

- **담당 범위:** 공통 대기열 PC 독립 5초 감시기 heartbeat 판정과 로컬 사전검사 source pin만 변경. 프로세스 총괄 중앙 원장·인계 승인, W01~W05 기능·Controller·Writer와 무관. C급 Windows Task·계정·인증·Runner·DB·D1·공급자·운영 PC 상태 변경 **0건**.
- **실제 소스 결함:** 기존 `runWatch()`는 GitHub 403/429, 비정상 HTTP 응답 및 네트워크 예외에도 `completedPolls`를 증가시키고 12회마다 `WATCH_HEARTBEAT`를 기록했음. `backoffActive`는 **마지막 1회**의 상태이므로 직전 11회 실패하고 마지막 조회만 성공한 경우 전체 창의 조회 실패 여부를 heartbeat 1개만으로 판정할 수 없음. 5초 시작 시각 간격(min/max)만으로도 GitHub 응답 정상 여부를 보장하지 않음.
- **최소 수정:** [소스 PR #1925](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1925)에서 기존 watcher `WATCH_HEARTBEAT`에 `successfulReadsInWindow`, `failedReadsInWindow`, `backoffCyclesInWindow`, `completeUnthrottledWindow`를 추가. 성공은 HTTP 200/304 처리 상태에 한정하고 403/429·HTTP 오류·throw는 실패로 기록. 200이지만 GitHub quota 부족으로 백오프하면 정상 조회와 별개로 제한 횟수도 기록. 12회 창 후 해당 집계를 재설정하고 기존 min/max interval·5초 정상 조회·비차단 영수증 검증·재시도 수칙은 유지. heartbeat 자체는 **실제 PC 5초 가동 영수증이나 ChatGPT 전달 ACK가 아님**.
- **격리 회귀:** 정상 12회가 성공 12/실패 0/백오프 0으로 표시되는지 확인. 첫 조회 429 → 마지막 정상인 창이 성공 11/실패 1/백오프 1, `backoffActive=false`여도 `completeUnthrottledWindow=false`인지 확인. 다음 12회 창에서 카운터 0 초기화 후 별도 PASS. quota 부족 HTTP200과 예외(인증 문자열 포함)도 개별 결과 및 비밀정보 미기록 확인. [Windows Handoff PR CI Run #44037276119](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44037276119) **466/466 PASS, 0 FAIL**, PR HEAD `70f0e13c79eb6508f2ce91a5944ca7148bdc13a4`; [C996 #44037249894](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44037249894) **SUCCESS**.
- **main 병합 및 source pin 정합성:** #1925 squash `82e06469569bb6842aa4aca43970d84262329481`. 병합 후 기존 7개 감시기 소스와 CMD가 해당 불변 SHA 및 최신 main에서 **7/7 Git blob 동일**. 새 watcher Git blob `ac3bf7cd987e2ac4bacdcd94105a7689344bae7e`; 나머지 6파일 기존 값 보존. 별도 `tools/handoff-watch-c-preflight.mjs`, `tests/agent-handoff-watch-c-startup-contract.test.mjs` 및 C 활성화 지침을 최종 pin으로 정합화; 소스 중간 commit `3976174e6c4c49c329933097163130b5c8138a47`을 운영 설치 SHA라고 주장하지 않는다.
- **실제 운영 상태:** 연결된 Remote Desktop Commander 등록 장치 `pc`는 **OFFLINE**이고 대상 공통 대기열 PC와 동일한 장치인지 검증되지 않음. GitHub Actions 소스/Windows CI가 실제 독립 상주 감시 프로세스의 등록·인증·heartbeat/5초 동작이라는 의미가 아님. 따라서 기존 총 5단계 중 **4/5(80%)**, 실제 운영 **0/1, `RUNTIME_ACTIVATION_BLOCKED` 유지**.
- **다음 단일 작업:** 사용자 승인된 공통 대기열 PC에서 `tools/handoff-watch-c-preflight.mjs` 로컬 읽기전용 소스 적격성 확인 → 저권한 Windows 사용자·GitHub 최소 읽기 인증 보안 저장소·기존 Task 중복/실행 권한 확인 → 별도 C급 직접 설치·자동시작 등록(승인 전 STOP) → 실제 정상 5초 시각 및 2회 이상 `WATCH_HEARTBEAT`의 성공/실패/백오프 횟수와 영수증 검증·Runner 업무 비간섭 관측. 미승인 원격 셸/CI에서 임의 설치/새 예약/토큰 전송으로 우회하지 않는다.

## 2026-11-17 공통 대기열 PC — 기존 읽기전용 PC 등록 현황과 실제 Runner 대기 실측

- **업무 경계/이번 실행:** 공통 대기열 PC의 기존 증거 **재조회 및 판정만** 수행. 프로세스 총괄 중앙 인계/승인 원장·W01~W05 기능·Controller/Writer를 검토·변경하지 않았음. 운영 Windows PC에 신규 스냅샷/태스크 설치·서비스/Runner 변경/인증 조회·로컬 파일 쓰기 **0건**.
- **실제 PC 기존 읽기 전용 스냅샷:** 사용자 인증 Issue [#1863](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1863), 기존 Run [#43999701240](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43999701240)에서 이미 저장된 원본 `results/pc-process-inventory-43999701240-1-handoff.json` 및 `.txt` 원격 재조회. 원본 `2026-11-17T02:00:57.758Z`, 대상 `DESKTOP-N62L0NG`, Runner `zgmini-handoff-ci-spare-01`, `status=PASS`·`PROCESS_INVENTORY_COLLECTED`, `operationalWrites=0`, `automaticRetries=0`. 원본 `snapshot.serviceStatus=OK`, 유일 조회 서비스 `actions.runner.ansqhd5774-Choi-zgmini-pc-control.zgmini-handoff-ci-spare-01` **Running / Auto**. `snapshot.taskStatus=OK`, **`snapshot.tasks=[]`**, `startupStatus=OK`, `startup=[]`. 이는 **해당 시각 ZGMINI 접두사의 예약 작업 미관측**이지 모든 프로세스 실행 부재나 2026-11-17T07:24Z 현재 상주 감시기 부재의 증명은 아님. 프로세스 명령줄은 의도적으로 캡처하지 않았으므로 `node.exe` 이름만으로 watcher 실행 여부 단정 금지.
- **추가 실제 Runner Job 실측 (기존 실행 재사용, 신규 워크플로 접수 0건):**
  - PC Failure Intake [Run #44038245794](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44038245794) / Job `133886258236`: 2026-11-17T07:22:51Z 생성→07:22:54Z 시작, **Runner 대기 3초**, `completed/success`.
  - Candidate Selector [Run #44038315730](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44038315730) / Job `133886480715`: 2026-11-17T07:23:23Z 생성→07:23:25Z 시작, **Runner 대기 2초**, `completed/success`.
  - Queue Control Board [Run #44038391625](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44038391625) / Job `133886727777`: 2026-11-17T07:23:57Z 생성→07:23:59Z 시작, **Runner 대기 2초**, `completed/success`.
  - 세 Job 모두 `zgmini-handoff-ci-spare-01`에서 실행. 본 3개 표본의 Runner 배정 대기는 **2~3초**, 전부 성공. **이것은 기능 담당의 실제 접수·ACK/5초 상주 감시기와 동일한 증거가 아님**, 광범위 시간대나 p95 SLA를 단정하지 않음.
- **독립 연결 확인:** Remote Desktop Commander에 등록된 유일 `pc` 장치는 **Offline**(도구 관측 기준 마지막 seen 1102h ago)이고, 그 장치가 `DESKTOP-N62L0NG`인지 매핑되지 않았다. 이 경로로 공통 대기열 PC에 접속/명령 실행 가능하다고 간주하지 않는다. GitHub Actions의 격리 Runner 성공이 Windows 사용자 C급 작업 설치 승인은 아님.
- **현재 판정:** 신규 watcher 소스 PR [#1925](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1925)와 C source pin PR [#1926](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1926) 병합은 과거 확정. 기존 5단계 계획은 **4/5(80%)**, 실제 PC 5초 감시 가동 **0/1 미검증**, `RUNTIME_ACTIVATION_BLOCKED` 유지. **새로운 재현 장애가 확인되지 않은 이벤트 기반 Runner에 신규 소스 수정을 추가하지 않는다.**
- **다음 단일 필수 작업:** 사용자 승인된 **실제 공통 대기열 PC 저권한 Windows 계정**에서 [C급 활성화 계약](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md)에 따른 고정 7파일·Node22·읽기 전용 GitHub 자격 안전 저장/최소권한·기존 Task 충돌 없는지 확인. 적격·C급 직접 설정 시에만 `ZGMINI-HANDOFF-WATCH`을 등록한 후 실PC `WATCH_HEARTBEAT` 2회 이상과 성공/실패/백오프 횟수·유효 영수증·Runner 비간섭을 실측. 승인/인증/실장비 접근 미확인 시 무단 등록·토큰 발급·GitHub Runner 장기 점유 없이 **STOP**.

## 2026-11-17 공통 대기열 PC — 사용자 제한 권한 5초 감시 활성화 준비 반영

- **사용자 의사와 범위:** 공통 대기열 PC는 운영 PC와 다른 `DESKTOP-N62L0NG`. 사용자 요청 "적용 해보자"에 따라 **해당 PC에 로그인한 일반 사용자의 제한 권한 ONLOGON 방식**만 구축하고, 별도 Windows 관리자 권한을 선결 조건으로 두지 않았다. 내부 `C급` 분류는 다른 운영 PC 관리자 권한 요구와 구분. 프로세스 총괄 #68 승인·Controller/Writer·W01~W05·운영 PC·기존 격리 Runner/서비스·15분 관제는 변경 0건.
- **최신 PC 원본 실측:** 기존 검사를 반복하지 않고, 실제 PC에서 시점 차이를 해소하기 위해 **1회만** [read-only Issue #1936](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1936), [Run #44041290108](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44041290108)을 실행. 저장된 결과 `results/pc-process-inventory-44041290108-1-handoff.{json,txt}`는 `2026-11-17T07:46:51.766Z`, `host=DESKTOP-N62L0NG`, `runner=zgmini-handoff-ci-spare-01`, `PROCESS_INVENTORY_COLLECTED/PASS`, `taskStatus=OK`, **`tasks=[]`**, `startup=[]`. Runner 서비스 `Running/Auto`. 운영 PC 검사 Job은 SKIPPED. `operationalWrites=0`, 공급자 호출=0. 해당 시각 작업 없음은 **새 감시기가 실제 실행 중임을 입증할 수 없다는 의미**이지 그 시점 이후의 모든 사용자 세션을 추적한 것이 아니다.
- **실행 구조 재평가:** GitHub Actions `schedule`은 5초 주기를 제공하지 않으며, GitHub 이벤트 기반 접수와 기존 15분 관제는 유지. 상주 감시를 Actions Runner Job으로 24시간 점유하지 않는다. 공통 대기열 PC 사용자 로그인 컨텍스트의 **별도 제한 권한**이 있어야 별도 5초 Node 루프를 실행할 수 있고, 이는 다른 운영 PC의 권한을 사용하지 않는다.
- **적용 소스:** [PR #1942](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1942) `tools/handoff-watch-user-activate.ps1` 신규. Windows 인터랙티브 세션·정확 호스트 확인, SYSTEM/서비스/Actions Session0 거부, 고정 7개 source Git blob과 Node22 검사, 기존 Task·설치 폴더 있으면 중단, `GH_TOKEN/GITHUB_TOKEN` 환경·커스텀 GH 설정·평문 토큰 저장 거부, 해당 사용자 기존 GH CLI private Issues GET 읽기 검사. `-Apply` 명시와 기존 최소 `Issues:read` 범위에 대한 사용자 직접 `-ConfirmRestrictedCredential` 확인이 있어야 `%LOCALAPPDATA%\ZGMINI\handoff-watch` **새 소스 7파일만** 복사 및 재검증, 기존 Task 덮어쓰기 없이 `ZGMINI-HANDOFF-WATCH`의 `Interactive / RunLevel Limited / ONLOGON` 예약과 동시 실행 중복 금지·최대 2회 제한 재시작을 설정. 신규 인증 생성·권한 확대·원격 명령 실행 없음. `tools/handoff-watch-c-preflight.mjs`는 별도 `--source-root` 읽기 검사 옵션만 추가 (기존 watcher 소스 pin `82e06469569bb6842aa4aca43970d84262329481`, 정확 소스 7파일 **불변**).
- **검증 및 병합:** [Windows Handoff CI #44043412347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44043412347) PR HEAD `dcdea82e09dba6e4c1fd0ee584baab3e61d4a16c`에서 **470/470 PASS, 0 FAIL**. 테스트는 미승인 서비스 계정/Runner 설치 거부, 제한 권한/중복 차단, GH 평문/토큰 확대 금지, 7파일 정합, `--source-root` CLI와 Windows PowerShell 구문 검사. 실제 Windows Task의 등록/시작은 **CI에서 수행하지 않음**. [C996 #44043356655](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44043356655) `completed/success`. #1942 main squash **`d61f332996e56ce92d8db07aec1adf7a8cdcb3a4`**.
- **정확 실행 단계(사용자 직접):** 대기열 PC `DESKTOP-N62L0NG`에 권한 제한된 로그인 계정으로 접속하고 **Runner `_work`가 아닌 신뢰된 코드 checkout**에서 읽기 전용 `powershell -NoProfile -File .\tools\handoff-watch-user-activate.ps1`를 먼저 실행. 출력이 `READONLY_READY_USER_APPLY_REQUIRED`이고 GH CLI Windows 안전한 자격 보관 및 해당 private 저장소 `Issues:read` 최소 범위를 사용자 직접 확인한 경우에만 `powershell -NoProfile -File .\tools\handoff-watch-user-activate.ps1 -Apply -ConfirmRestrictedCredential` 실행. 결과 `REGISTERED_START_REQUESTED_HEARTBEAT_PENDING`는 **등록 및 시작 요청이지 정상 5초 운전의 증거가 아니다**. 계정이 다르거나 자격 미확정이면 STOP.
- **종료 판정:** 이 대화의 GitHub 저장소 소스/전용 문서 작업은 완료했으나 사용자의 PC 인터랙티브 로그인 세션·기존 최소권한 GH 자격저장소는 직접 사용할 수 없어 **실제 5초 상주 감시기 설치/활성화는 여전히 0/1, 총 4/5(80%), `RUNTIME_ACTIVATION_BLOCKED`**. 실제 Task·2회 이상 `WATCH_HEARTBEAT`, 정상 5초 시작 간격·12회 창 성공/실패/백오프, 원본 영수증과 Runner 비간섭까지 확인한 후에만 5/5 전환. 별도 C급 중앙 설치 요청이나 기존 Runner의 5초 상시 점유는 하지 않는다.

## 2026-11-17 공통 대기열 PC — 실제 Runner 세션·3회 5초 조회 독립 검증

- **업무 경계:** 사용자 요청 "러너로 확인하면 되잖아" 및 "작업해라"에 따라 **공통 대기열 PC `DESKTOP-N62L0NG`에 설치된 기존 격리 Runner**를 이용해 1회성 자체 계정/예약 확인과 5초 간격 실제 GitHub GET을 실행했다. 프로세스 총괄 중앙 #68, 일반 운영 PC, W01~W05, Controller/Writer, Runner 서비스 및 15분 관제 설정을 수정하지 않았다. GitHub Issue 요청/PR/검증 기록 외 Windows 예약·사용자·인증·디스크/운영 DB·D1 쓰기 **0**.
- **구현 및 소스 검증:** [PR #1952](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1952)에서 별도 도구 `tools/handoff-watch-runner-context-readonly.mjs`, owner-only private Issue gate/격리 Runner 지정 `.github/workflows/handoff-watch-runner-context-readonly.yml`, 6개 격리 시험 추가. 1회 Task Scheduler 읽기, 실행 중 PowerShell 세션·현재 계정의 관리자 토큰 유무만 Boolean/정수로 제한. 사용자명·SID·경로·환경·GH CLI 자격·token 값 미수집. `issues:read` GitHub Actions **임시 토큰**으로만 조건부 GET 최대 3회, 각 3.5초 제한과 5초 간격 시도. 401/403/429/비정상 오류 시 반복하지 않음. Windows [Handoff CI #44046824235](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44046824235) **477/477 PASS, fail 0**, C996 #44046786952 `completed/success`. 소스 squash merge **`63597f43913f82104e2b4cbee3e91a498c2ae7e5`**.
- **진짜 PC 원격 실행:** owner-issued [Issue #1953](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1953) → [Workflow Run #44047213436](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44047213436) / Job `133915791727` **SUCCESS**, 2026-11-17T08:30:20.929Z 관측. Windows 고정 호스트+Runner `hostVerified=true, runnerVerified=true`. `sessionZero=true`, `serviceIdentity=false`(SYSTEM/LocalService/NetworkService 고정 SID 아님), `adminGroupToken=false`; `taskQueryOk=true`, `taskExists=false` (`ZGMINI-HANDOFF-WATCH`), `ghCliPresentInRunnerContext=true`. **사용자 인터랙티브 세션·사용자 안전한 Credential Store·Task 등록 권한은 각각 false/unverified**. 관리자 권한이 없다는 사실과 사용자 계정 컨텍스트가 있다는 사실을 혼동하지 않는다.
- **5초 실측 표본:** 동일 Run의 `pollSample.sampleCount=3`, `readHttpCodes=[200,304,304]`, `successfulReads=3`, `observedMinStartIntervalMs=5000`, `observedMaxStartIntervalMs=5013`, `longestRequestMs=575`. 즉 **동일 PC의 Runner에서 GitHub 읽기 API를 5초 간격으로 3회 호출하는 것은 가능함을 실제 입증**. 이 토큰은 `EPHEMERAL_ACTIONS_JOB_TOKEN_NOT_A_WATCHER_CREDENTIAL`; 작업이 종료되면 상주 감시기로 사용할 수 없음. 3회 표본으로 24시간 API 안정성·15분 관제 대체·지속 자동시작을 주장하지 않는다.
- **권한/실행 판정:** 현재 Runner는 Session 0이고 사용자 자동시작 `Interactive/RunLevel Limited/ONLOGON` 계약의 실행 계정과 분리됨. `runnerContextEligibleForUserActivation=false`, `RUNNER_CONTEXT_CANNOT_OWN_USER_ONLOGON_WATCH`. Windows Task 등록 시험은 **시도조차 하지 않았고**(`taskRegistrationAttempted=false`), 결과는 권한이 "절대 없다"는 증거가 아니다. 단, Session 0 격리 Runner 작업에 영구 5초 watcher를 상주시켜 Runner 1석을 점유하거나 임시 Actions 토큰을 영구 보관하는 설계는 사용하지 않는다.
- **진행률 유지 및 다음:** 소스·임시 5초 REST 관측·Runner 세션/태스크 확인은 검증됨. 별도 사용자 컨텍스트의 안전한 읽기 자격/자동시작 등록/실제 상주 `WATCH_HEARTBEAT` 2회/영수증·Runner 비간섭은 **미실시**. 따라서 전체 계획 **4/5(80%)**, 가동 **0/1, `RUNTIME_ACTIVATION_BLOCKED`**. 다음은 다른 운영 PC가 아닌 해당 대기열 PC의 실제 저권한 로그인 사용자에서 [`tools/handoff-watch-user-activate.ps1`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/tools/handoff-watch-user-activate.ps1)의 기본 읽기전용 검사를 진행하고, 안전한 기존 `Issues:read` 자격을 확인한 경우에만 사용자 계정으로 `-Apply -ConfirmRestrictedCredential` 실행. 해당 사용자 권한·Credential 미확인 시 STOP. 이 단계는 현재 Runner의 Session 0에서 우회 실행 불가.
