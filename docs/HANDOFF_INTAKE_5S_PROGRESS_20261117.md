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

## 2026-11-17 후속 — 실제 PC 적용 경로·권한 조사

- **기존 완료점 재사용:** PR #1850 병합 SHA `9dd289a6033a8bba5245cb07da2a42c9535e912b`와 Windows 분리 CI 407/407 PASS. 소스·시험은 다시 설치하거나 반복 실행하지 않았다.
- **대기열 PC의 실제 등록 확인:** `docs/PC_OPERATING_SYSTEMS_CANONICAL.md`와 `pc-host/process-inventory-readonly.yml`에는 `zgmini-handoff-ci-spare-01` 자동 시작 Windows Runner 서비스가 있으나, 해당 서비스는 GitHub Actions 작업 수신기다. 독립 상주 `intake-watch-5s.mjs` 서비스·유지보수 수신기는 등록 또는 설치 증거가 없다.
- **허용된 워크플로 조사:** `agent-handoff*`, `pc-shared-issue-admission.yml`, `pc-host-inventory-readonly.yml`, `pc-process-inventory-readonly.yml`은 이벤트/예약 1회 실행·단회 읽기·CI 경로다. 이들은 **5초 상주 설치·안전 갱신/재기동 B 수신기**가 아니며 임의 백그라운드 프로세스 설치 권한으로 사용하지 않는다.
- **인증 수명:** 현재 확인된 `GITHUB_TOKEN: ${{ github.token }}`은 GitHub Actions Job 한정 토큰으로 종료 시 만료된다(공식 GitHub 문서). GitHub 밖 독립 watcher에서 쓸 장기 운용/자동 갱신 **읽기 전용 자격증명 경로는 미확인**이다. 키를 발급하거나 출력하지 않았다.
- **Node 실행환경:** 격리 CI의 `actions/setup-node@...`는 해당 Job에서 Node22를 준비한다. 별도 Windows 상주 서비스에서 사용할 Node 실행파일 경로/관리자는 미확인이다.
- **필수 차단 조건:** 독립 감시기 기동을 위한 승인된 상주 실행·부팅 복구 경로 + 비밀 노출 없는 유효한 read-only GitHub 인증/갱신. 두 조건 없이 배포하면 5초 보장 불가능. 5초 감시를 기존 Runner job에서 무한 실행해 한 좌석을 점유하거나 임시 `GITHUB_TOKEN`을 저장하는 우회는 금지.
- **판정:** `RUNTIME_ACTIVATION_BLOCKED` (운영 설치·5초 실측 미실시). 단회 GitHub 조회 및 소스/CI PASS와 실제 24시간 5초 감시 가동을 구분한다.
- **다음 필수 행동:** 공통 대기열 PC의 기존 승인 등록/유지보수 경로에 독립 read-only 감시기 적용 기능이 있는지 정본·실제 등록으로 확정하고, 있으면 해당 원본 보호·manifest·hash·auth 조건으로 단회 활성화한 뒤 실측한다. 없으면 C급 사용자 직접 시스템 등록/자격 설정 절차가 선행한다. 새 워크플로에 임의 원격 명령·지속 프로세스 생성 작업을 추가하지 않는다. 기능별 독립 작업은 계속한다.

## 독립성·실제 상태

현재 단계는 **SOURCE_MERGED_RUNTIME_NOT_DEPLOYED**. 새 watcher는 해당 PC에 설치/기동되지 않았고, GitHub Actions 15분 주기도 변경하지 않았음. 기존 6 Runner 운영·공유 원장·DB/D1·게시 영향 없음.

**현재 완료율:** 소스/PR 범위 4/5 (80%), PC 실제 5초 감시 활성화는 0/1.

**다음 필수 행동:** 실제 공통 대기열 PC에서 기존 승인된 읽기 권한·상주 실행/재시작 계약과 B급 유지보수 적용 경로 확인 → 허용 범위 내 설치 → 실제 5초 주기·기존 업무 Runner 비점유·재연결·API quota 측정. 허용된 설치 경로가 없으면 자동화 미적용 사실과 정확한 부족 권한을 기록하며 다른 원격 실행 도구로 우회하지 않는다.
