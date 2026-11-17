# 공통 대기열 취소 개선 진행 기록 (2026-11-17)

- 저장소: ansqhd5774-Choi/zgmini-pc-control
- 브랜치: codex/handoff-queue-job-concurrency-20261117
- 최초 유효 main: 75ae083d74dc9078c50f1ac215c6554a5c9d3bfb
- 계획: docs/HANDOFF_QUEUE_CONCURRENCY_EXECUTION_PLAN_20261117.md
- 현재 단계: 6/6 — DONE (격리 CI 401/401 + 자연 실행 4/4 PASS; scheduler 장기 신뢰성 별도 유보)
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

## 2026-11-17 08:58 KST 실제 main 병합·자연 실행 결과
- 소스 PR #1811은 GitHub main squash SHA 6f070b1db9391e95838d96342d7b1f0a8f10e5c4로 병합 완료 (2026-11-17 08:54:38 KST).
- 테스트된 실행 소스 SHA 907489e67d8f9f358422002d35cda0780fbb19bb에 격리 Node 401/401 PASS. 후속 브랜치 변경은 본 기록 파일뿐이며 실행 YAML·시험 코드 변경 없음.
- 병합 직후 push-triggered 3건 (43983272352, 43983272242, 43983274269)이 Job 시작 전 취소됨. 수정 효과를 즉시 100%로 주장하지 않는다.
- 혼합 SHA 전환 구간: 구버전 board 43983257740 성공 종료 23:57:12 UTC와 신버전 board 43983407382 취소 시각이 일치. 동일 concurrency 그룹에 구버전 workflow-level/신버전 job-level 실행이 겹친 정황이며 직접 취소 사유는 미확정.
- 이후 신버전 main SHA에서 자연 workflow_run 43983407413 확장 탐색 PASS(23:56:36 UTC), 43983407444 능동 진단 PASS(23:57:57 UTC), 43983407394 정밀 진단 PASS(23:58:36 UTC). 모두 격리 Runner zgmini-handoff-ci-spare-01, 동일 공유 그룹에서 순차 실행.
- board 신버전 자연 PASS는 추가 관측 필요. GitHub schedule 새벽 6시간 공백의 플랫폼 원인은 별도 미확정이며 기존 예약은 유지.
- 실행 효과 확인: 공유 진단 그룹 3/3 자연 Job PASS, board 0/1 PASS·1 cancelled(신구 SHA 겹침). 전체 4/4 PASS 아님.

## 다음 단일 필수 행동
- 구버전 실행이 완전히 종료된 뒤 신버전 board의 기존 schedule/자연 workflow_run 한 건을 조회하여 runner/결론 및 queue:max 대기 보존 여부를 확인한다. 새로운 예약·Runner·중복 요청·운영 PC 변경 금지.
- 해당 결과가 PASS이고 동일 source SHA에서 불필요한 pending 취소가 재발하지 않으면 6단계를 종료한다. 실패하면 원본 Run/Jobs의 last PASS/FIRST FAIL을 보고 필요한 범위만 재검토한다.

## 2026-11-17 09:02 KST — 6/6 실제 실행 검증 완료 (관측 범위 명시)
- 검증 대상 GitHub head_sha: 838d88997fe02ea00487b86182d05a1daacf837b. 해당 SHA는 승인된 PR #1811 병합 SHA 6f070b1db9391e95838d96342d7b1f0a8f10e5c4 이후 진행 기록만 반영된 main이다.
- 기존 자연 workflow_run 트리거 2026-11-17 08:59:46 KST 네 건을 각각 GitHub Run+Job 원본에서 직접 재조회: **4 성공 / 0 취소**. 모두 격리 Runner zgmini-handoff-ci-spare-01에서 실제 Job 종료.
  - 43983949585 정밀 진단 R2: SUCCESS, 09:00:26 KST 종료, job 133707194179.
  - 43983949542 Queue Control Board: SUCCESS, 09:01:01 KST 종료, job 133707194432. 로그 ZGMINI_HANDOFF_BOARD_R1, completeInventory=true, issueCount=9, ACKNOWLEDGED=1, PENDING_OWNER_ACK=8, reviewAlertCount=0. 인수 상태는 운영 PC 복구 성공이 아님.
  - 43983949537 능동 진단 R1: SUCCESS, 09:01:46 KST 종료, job 133707194819.
  - 43983949741 Wide Scout R3: SUCCESS, 09:02:19 KST 종료, job 133707196582.
- 동일 공유 ledger 그룹의 정밀/능동/확장 세 작업이 직렬 실행됐으며, board 독립 그룹도 실제 통과. 병합 직후 전환 중 취소 3건과 신버전 첫 board 취소는 앞선 기록대로 보존. 이번 네 건이 미래 모든 트리거의 취소 0을 보장하는 것은 아님.
- Node PR Windows CI 401/401 PASS는 기존 증거 재사용. 이번 추가 source/Runner 설치/예약 추가/DB 쓰기 0.
- 별도 유보(DEFERRED): GitHub Actions schedule 자체가 11월 17일 01:26~07:56 사이 나타나지 않았던 플랫폼 내부 원인은 미확정. 기존 cron은 유지. 09:02 KST 조회 시 schedule 누적 4건이며 09:07 이후의 일정은 이 기록에서 아직 미관측. 주기적 감시의 완전성을 주장하지 않음.

## 상태 및 인계
- 본 수정 계획 6/6 = **DONE (설정 반영·격리 회귀·실제 자연 Run 4/4 확인)**.
- 남은 의존성 = **DEFERRED (GitHub scheduler 장기 신뢰성 별도 점검)**, 본 취소 개선의 무한 반복 Gate로 삼지 않는다.
- 후속 조사는 신규 schedule 미생성 또는 정확히 동일 SHA에서 불필요한 취소가 실제 발생할 때 해당 원본 Run/Job과 YAML의 변경 영향만 재검증한다.
