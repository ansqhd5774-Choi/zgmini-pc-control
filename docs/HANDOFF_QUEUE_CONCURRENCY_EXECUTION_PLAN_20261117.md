# 공통 대기열 취소·정기 실행 누락 대응 실행계획 (2026-11-17)

- 저장소: ansqhd5774-Choi/zgmini-pc-control
- 작업 브랜치: codex/handoff-queue-job-concurrency-20261117
- 최초 main 기준 SHA: 75ae083d74dc9078c50f1ac215c6554a5c9d3bfb
- 목적: 공통 대기열 격리 Runner에서 불필요한 queued 취소를 줄이고, 실제 안전한 직렬 실행을 보존한다.
- 금지: 운영 PC/SQLite/D1/Controller/공급자 호출 변경, 신규 유료 서비스, 새 Runner 또는 예약 추가, 취소된 요청의 자동 재실행.

## 순서와 통과조건
1. **증거 구분** — 2026-11-17 00:00~07:56 KST의 격리 워크플로 GitHub 성공 49건, 관련 취소 155건(139 workflow_run/16 issues), schedule 0을 원본 시각과 대조한다. 성공은 실제 장애 복구로 오인하지 않는다.
2. **원인 계약 검증** — GitHub concurrency의 기본 single-pending 교체와 queue:max(최대 대기 100)를 공식 문서와 대조한다. schedule 이벤트 자체가 생성되지 않은 것과 Runner 작업 실패를 구분한다.
3. **최소 소스 수정** — 기존 4개 감시 YAML의 workflow-level concurrency를 동일 Job의 job-level로 이동하고 queue:max를 추가한다. 공유 ledger 직렬 group/독립 board group/기존 cron, actor·private·source 조건 및 고정 격리 Runner는 유지한다.
4. **회귀 검사** — 기존 agent-handoff 관련 Node 검증과 신규 job-level/YAML 계약 테스트를 현재 브랜치 SHA에서 확인한다. 격리 PR CI에 정확한 SHA를 사용한다.
5. **원격 소스 반영** — PR 및 리뷰 가능한 diff, CI, main 여부를 각각 확인하고 진행 기록에 최신 유효 결과를 저장한다.
6. **실행 효과 검증** — main 반영 후 동일 계열 자연 GitHub 트리거에서 Runner/Job, 대기/취소, ledger 중복을 원본 Run으로 확인한다. 15분 예약은 GitHub가 만드는 이벤트여서 별도 추적하며, 새로운 예약을 추가하지 않는다.

## 별도 원인/한계
- 전일 등록 15분 schedule가 2026-11-17 07:56 KST까지 트리거되지 않은 원인은 GitHub Actions 내부 이벤트 생성 단계로 한정된다. 원본에서 event=schedule 0은 확인되지만 GitHub 내부 원인은 확정하지 않는다.
- queue:max도 대기 100개 초과를 보존하지 못한다. 확정된 수요 과잉이 새로 관측될 때만 이벤트 중복 축소를 후속 최소 수정한다.
- 목표는 격리 Runner의 공통 장애 감시 안정화이며, 중앙 ChatGPT/원담당 대화 자동 기동 또는 원본 PC 복구는 본 작업의 기능이 아니다.
