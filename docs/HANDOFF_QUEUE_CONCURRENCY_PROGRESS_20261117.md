# 공통 대기열 취소 개선 진행 기록 (2026-11-17)

- 저장소: ansqhd5774-Choi/zgmini-pc-control
- 브랜치: codex/handoff-queue-job-concurrency-20261117
- 최초 유효 main: 75ae083d74dc9078c50f1ac215c6554a5c9d3bfb
- 계획: docs/HANDOFF_QUEUE_CONCURRENCY_EXECUTION_PLAN_20261117.md
- 현재 단계: 5/6 — 소스·CI 검증 PASS, 자연 실행 효과는 미검증
- source 변경 범위: 기존 격리 감시 YAML 4개 + 신규 정적 계약 시험 1개. 운영 PC 쓰기 0, 예약/실행 주기 변경 0.

## 원본 조사
- 2026-11-17 00:00~07:56 KST 성공: 격리 인계/감시 관련 49회(별도 PR Source CI 2회).
- 동일 구간 GitHub 취소: 155회, workflow_run 139 / issues 16. 취소 4계열 표본은 Jobs 0, 실행 전에 발생.
- 격리 Runner zgmini-handoff-ci-spare-01에 성공 Job 존재. Controller·DB 장애로 단정할 근거 없음.
- 해당 구간 schedule 이벤트 0. GitHub 내부 미생성 원인은 미확정이며, 실제 Job이 실패한 것으로 보지 않는다.
- GitHub 공식 concurrency 문서: default single pending replaces prior pending; queue:max permits up to 100. 3개 ledger 진단기는 공통 그룹, queue board는 독립 그룹.

## 실행
1. 4개 기존 YAML: workflow-level concurrency를 각 job의 동일 그룹 concurrency로 이동하고 queue:max 추가. actor/private/main/source·schedule·Runner 고정.
2. 신규 tests/agent-handoff-job-concurrency.test.mjs로 소스·직렬화·기존 cron·호스트 분리 검증.
3. Branch 마지막 정확한 SHA, PR, 격리 CI 결과는 검증 후 이 파일 하단에 갱신한다.

## 남은 필수 행동
- 격리 Windows PR Source CI 실제 PASS 확인 → 원격 diff 재확인 → 승인된 source 병합 여부 결정 → 자연 트리거 관찰.
- GitHub schedule의 6시간 공백은 소스 병합만으로 해결됐다고 주장하지 않는다.

## 2026-11-17 추가 실행·검증
- PR #1811: https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1811
- 격리 Windows PR CI Run 43982584603 / job 133702534316 / runner zgmini-handoff-ci-spare-01: PASS, Node TAP 401 tests / 401 pass / 0 fail, test source SHA 907489e67d8f9f358422002d35cda0780fbb19bb.
- 병행 C996 읽기 전용 Source CI Run 43982559077: PASS (본 수정의 기능 검증 대체가 아님).
- 수정 4개 YAML 원격 재조회: job scope·queue:max·기존 cron·원래 격리 Runner·private/actor 보호 4/4 확인.
- 최신 main 63f204b0bf11ac7454b6bdd27842d376bee3b220과의 누적 변경에서 본 PR 대상 7개 파일에 중복 수정 없음. main은 작업 도중 독립 변경 7커밋 전진했으므로 병합 시점 재대조 필요.
- 이번 문서 갱신은 시험을 통과한 실행 YAML/Node 시험 파일을 변경하지 않는다. 테스트된 소스와 코드 blob 동일성을 후속 diff로 확인한다.

## 다음 실행·중단 조건
- 다음: 충돌 없는 source PR #1811 main 병합 → GitHub 자연 이벤트에서 실행 Job/runner/취소/게시 결과 readback.
- 정기 schedule 미생성은 GitHub 외부 이벤트 문제로 분리. 병합으로 치유됐다고 주장하지 않는다.
- BLOCKER: 정확한 병합 SHA/필수 CI 충돌 또는 source 차이 검출 시 대상 범위 재검증. 기존 운영 PC 권한/DB는 본 범위 아님.
