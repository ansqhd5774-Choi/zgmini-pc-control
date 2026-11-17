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

## 독립성·실제 상태

현재 단계는 **SOURCE_MERGED_RUNTIME_NOT_DEPLOYED**. 새 watcher는 해당 PC에 설치/기동되지 않았고, GitHub Actions 15분 주기도 변경하지 않았음. 기존 6 Runner 운영·공유 원장·DB/D1·게시 영향 없음.

**현재 완료율:** 소스/PR 범위 4/5 (80%), PC 실제 5초 감시 활성화는 0/1.

**다음 필수 행동:** 실제 공통 대기열 PC에서 기존 승인된 읽기 권한·상주 실행/재시작 계약과 B급 유지보수 적용 경로 확인 → 허용 범위 내 설치 → 실제 5초 주기·기존 업무 Runner 비점유·재연결·API quota 측정. 허용된 설치 경로가 없으면 자동화 미적용 사실과 정확한 부족 권한을 기록하며 다른 원격 실행 도구로 우회하지 않는다.
