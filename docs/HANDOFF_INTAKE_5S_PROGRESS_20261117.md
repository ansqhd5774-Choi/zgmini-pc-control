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

## 독립성·실제 상태

현재 단계는 **SOURCE_MERGED_RUNTIME_NOT_DEPLOYED**. 새 watcher는 해당 PC에 설치/기동되지 않았고, GitHub Actions 15분 주기도 변경하지 않았음. 기존 6 Runner 운영·공유 원장·DB/D1·게시 영향 없음.

**현재 완료율:** 소스/PR 범위 4/5 (80%), PC 실제 5초 감시 활성화는 0/1.

**다음 필수 행동:** 실제 공통 대기열 PC에서 기존 승인된 읽기 권한·상주 실행/재시작 계약과 B급 유지보수 적용 경로 확인 → 허용 범위 내 설치 → 실제 5초 주기·기존 업무 Runner 비점유·재연결·API quota 측정. 허용된 설치 경로가 없으면 자동화 미적용 사실과 정확한 부족 권한을 기록하며 다른 원격 실행 도구로 우회하지 않는다.
