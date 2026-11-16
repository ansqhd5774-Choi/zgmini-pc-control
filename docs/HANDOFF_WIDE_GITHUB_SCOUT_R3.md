# ZGMINI 공통 대기열 PC — 능동 탐색 범위 확대 R3

## 목적
R1은 최근 7일 GitHub Actions failure·timed_out 실행의 개별 패턴 진단, R2는 접수된 인계의 원본 Issue·소스 blob·이력 정적 비교다. R3는 R1/R2와 겹치지 않도록 GitHub 메타데이터 기반 **감시 폭**을 확대한다. ZGMINI 운영 PC·Controller·Writer의 실제 실행은 하지 않는다.

## 6가지 확대 범위
1. GitHub Actions 최근 7일 내 취소 기록: CANCELLED_RUN_REVIEW (취소 자체는 장애 아님).
2. GitHub 승인 또는 정책 조치 필요 실행: ACTION_REQUIRED_REVIEW (원인 확정 아님).
3. queued / waiting / in_progress 2시간 이상: RUN_DELAY_REVIEW (지연 후보, PC 장애 확정 금지).
4. 최근 7일 신규 agent-handoff·handoff-agent-pending Issue 중 24시간 미갱신: HANDOFF_AGE_REVIEW (소유자 인수 부재 단정 금지).
5. 최근 7일 신규, 비초안이며 소유자 작성 agent-handoff-ci PR 중 24시간 미갱신: PR_EVIDENCE_REVIEW (CI 실패 단정 금지).
6. GitHub Actions API에서 3개 공통 워크플로 실제 상태(active, disabled_manually, disabled_inactivity 등)와 schedule 누적 실행 수 조회.

- 기존 R1과 겹치는 failure·timed_out 건수는 집계하지만 같은 상세 장애 진단을 다시 게시하지 않는다.
- 절대 기준: 최신 7일의 생성 시각, 동일 범위에서 최신순. 3개월 전 기록 같은 오래된 접수는 신규 탐색 대상이 아니다.
- 감시 대상은 **제어 저장소 ansqhd5774-Choi/zgmini-pc-control에서 확인 가능한 GitHub 증거**에 한정. zgmini 메인 저장소와 운영 PC 내부 수집 상태의 직접 관찰은 이 저장소의 GitHub Actions 토큰 권한만으로는 검증할 수 없으며, 증거가 제어 저장소로 전달된 경우에만 추가 판독 가능하다.

## 실행 구조
- 코드: agent-handoff/wide-scout.mjs, agent-handoff/wide-scout-runner.mjs
- 작업: .github/workflows/agent-handoff-wide-scout.yml
- 독립 격리 Windows Runner zgmini-handoff-ci-isolated, 최소 권한 contents:read/actions:read/pull-requests:read/issues:write.
- 15분 cron UTC 14/29/44/59분, 보조 조건부 workflow_run·Issue 라벨·진단 코드 main push. GitHub 예약 지연·누락은 발생할 수 있으며 정시 실행 확정 보장이 아니다.
- 매 실행 GitHub Job Summary에 진단 요약. 원장 #1743은 새로운 증거의 해시가 이전과 다를 때 최대 6시간마다 1개의 요약만 추가. 실행 코드·GitHub Issue 원문·로그 내용·토큰·개인정보를 댓글로 출력하지 않는다.
- 동시 기록은 R1/R2와 같은 concurrency 그룹으로 직렬화한다. 저장 전 원장 신원/최신 댓글 재확인, 저장 후 봇 댓글 재조회.
- 각 탐색의 조회 상한: 최근 Actions 최대 300건, 인계 Issue 150건, PR 100건, 원장 댓글 400건. 조회가 상한에 닿으면 complete:false로 기록하고 전체 조사 완료로 주장하지 않는다.
- schedule 누적 0건이라도 미등록 또는 비활성이라고 단정하지 않는다. API로 확인 가능한 워크플로 상태와 별도로 보고한다.

## 범위 제외
1. Controller·Writer·수집기·검증기·계산기·게시기 변경 또는 실행
2. 운영 PC 파일/SQLite/D1/Windows 서비스·예약 작업 변경
3. 코드 패치 생성·PR 자동 병합·임의 코드 실행, AI API 이용
4. 운영 PC에 기록되지 않은 원자료를 임의 추론하여 정상 또는 장애로 확정
5. 미종결 과거 장애 자동 삭제 또는 완료 처리

## 검증 기준
- Node 회귀 테스트에서 기간·최신순·오탐 후보·증거 출처·원장 멱등성·읽기 전용 제한 확인
- 전용 PR CI 통과와 PR 병합 후 별도 자동 이벤트 Run/Job 및 #1743 게시 확인.
- CI 통과는 자동 주기 실행 또는 운영 PC 장애 해결의 증명이 아니다.
