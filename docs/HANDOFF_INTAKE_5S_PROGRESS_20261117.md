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
- [ ] 4/5 PR, GitHub CI, main 병합·소스 readback
- [ ] 5/5 실제 PC의 분리된 상주 프로세스 설치·인증·5초 계측 실증

## 독립성·실제 상태

현재 단계는 **SOURCE_ONLY**. 새 watcher는 해당 PC에 설치/기동되지 않았고, GitHub Actions 15분 주기도 변경하지 않았음. 기존 6 Runner 운영·공유 원장·DB/D1·게시 영향 없음.

**다음 필수 행동:** PR/CI 확인과 main 반영 후, 실제 공통 대기열 PC에 적합한 기존 승인 읽기 자격증명·유지보수 실행 경로를 확인해 별도 설치·실증 여부를 판단한다. 그 전에는 5초 감시가 운영 중이라고 보고하지 않는다.
