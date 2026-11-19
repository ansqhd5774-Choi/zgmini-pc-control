> **종료 기록 (2026-11-20):** 사용자 요청에 따라 별도 5초 상주 감시기 기능을 폐기했다. 본 문서는 당시 계획의 기록이며 현재 실행·설치·재개 지침이 아니다. 기존 GitHub 이벤트 기반 Handoff 접수와 15분 관제, 격리 Runner는 유지한다. C급 설치·인증·예약 작업을 새로 만들지 않는다.

# ZGMINI 공통 대기열 5초 접수 감시 — 비차단 실행 계획 (2026-11-17)

- 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 전용 브랜치: `codex/handoff-five-second-intake-watch-20261117`
- 시작 main SHA: `b90bb8ff8c655bacc40f7a2fc32e2c46ccb3f37d`
- 목표: **접수 여부를 정상 상태에서 5초 간격으로 가볍게 확인하면서 담당자의 기존 실제 업무 처리에는 영향을 주지 않는 것**.

## 실행 단위

1. 기존 대기열 PC·GitHub 이벤트·관제판 간격과 실제 조회시간 근거 확인.
2. **분리된 경량 감시 소스** 설계: 5초 간격으로 열려 있는 `agent-handoff` Issue 목록의 변경만 1 GET 조회; ETag/304·중복 방지·요청 중첩 방지·3.5초 timeout·429/403/인증/비정상 시 백오프.
3. source-only 구현·회귀: `agent-handoff/intake-watch-5s.mjs`, `tests/agent-handoff-intake-watch-5s.test.mjs`. GitHub Issue나 운영 PC에 임의 명령/댓글/재실행을 수행하지 않음.
4. 독립 PR·GitHub CI PASS·main 반영, 최신 문서 및 진행기록 원격 readback.
5. **실제 PC 적용 별도:** 기존 공통 대기열 PC에서 Runner와 **분리된 프로세스**로 인증된 읽기 권한·기존 승인 유지보수 계약/설치 manifest·실제 해시·부팅/복구 경로를 확인하고 실배포, 5초 간격·감시 장애 시 백오프·업무 독립 실행 증거 확인. source merge/테스트만으로 완료를 주장하지 않음.

## 동작 경계

- 15분 `queue-board`는 종합 현황/증거 검사로 유지. 5초 감시는 별도 가벼운 **변경 감지**만; 매 5초 GitHub Actions Job 생성·전체 9건의 본문/댓글 조회·CI 실행을 하지 않음.
- GitHub 이벤트 기반 실제 접수 broker는 기존대로 유지. 빠른 감시의 발견은 `HANDOFF_ROUTED` 실제 접수 영수증이나 담당 ChatGPT 수신 증거가 아님.
- 감시 소스는 반드시 **기존 인증된 읽기 자격증명**과 `ZGMINI_HANDOFF_WATCH_ENABLED=true` 설정이 주어져야만 실행. 현재 승인된 PC에 상주 프로세스/권한이 설치됐다고 가정하지 않음.
- GitHub 요청 최소 1 GET/5초(정상 운전 시 720회/시간, 17,280회/일). ETag/304, rate limit header, 403/429에서 최소 60초 백오프; 실제 한도·자격 확인 없이 5초 보장 주장하지 않음.
- GitHub Actions schedule는 최소 5분이므로 5초 제어 수단이 아님. PC Runner 전용 1좌석을 감시 작업이 지속 점유해서도 안 됨.
- 비정상 시 감시 루프의 예외를 **실제 기능 담당자 실행 중단**으로 전파하지 않음. 신호가 사라지면 기존 GitHub Issue 원본이 남고 이벤트/15분 관제에서 회수 가능.
- 운영 PC Controller·공통 Runner 등록·Writer/DB/D1·Cron·기능 source 변경 없음.
