# ZGMINI 공통 대기열 관제판 R1 — 구현·운영 계약

## 변경 목적
기존 GitHub `agent-handoff` 사건의 인증된 접수·라우팅·중복 방지·원본 결과 반환 계약을 유지한 채, **작업 검토 순서, 담당 역할, 인수 영수증, 장기 미진행 확인 후보**를 하나의 **읽기 전용 GitHub Actions 실행 요약**으로 집계한다.

## 실제 수행 경계
- 실행 PC: 독립 `DESKTOP-N62L0NG`의 `zgmini-handoff-ci-isolated` Runner 1개.
- 입력: 승인된 비공개 `zgmini-pc-control`의 원래 Issue·전체 댓글. GitHub 원본을 변경하지 않는다.
- 출력: GitHub Actions Job Summary와 구조화된 표준출력 JSON. Issue·라벨·원장·운영 PC 파일·SQLite·D1은 변경하지 않는다.
- 실제 중앙/개별 ChatGPT 담당자가 기존 GitHub 댓글로 인수·진행·결과를 보고하는 방식을 유지한다.
- 다른 일반챗 자동 깨우기, OpenAI API, Copilot, 자동 소스 수정, 새 예약·Windows 예약 작업을 구성하지 않는다.

## 우선순위 산식 (작업 검토용, 심각도 확정 아님)
`agent-handoff/queue-priority.mjs`의 `HANDOFF_PRIORITY_ADVISORY_R1`.

| 조건 | 점수 |
|---|---:|
| COMMON_CONTROLLER / COMMON_RUNNER / COMMON_WRITER / FEATURE | 52 / 47 / 42 / 30 |
| INSTALL, D1, STORE | +8 |
| COLLECT, CALCULATE | +6 |
| SOURCE, API | +5 |
| UI | +4 |
| OTHER | +0 |
| 사건 경과 6h, 24h, 72h 이상 | +2 / +5 / +8 (최댓값만) |
| 코드가 RECOVERY_REQUIRED로 끝나거나 BACKLOG_OR_RECOVERY_NOT_VERIFIED | +9 |

- P1_REVIEW 68점 이상, P2_REVIEW 52~67, P3_REVIEW 40~51, P4_REVIEW 39점 이하.
- 점수는 **검토 순서만** 변경한다. 심각성이나 장애 원인 확정·권한 승인·실행 트리거를 뜻하지 않는다.
- GitHub 생성 시각이 없는 경우 시간 가중치 0, 경과 시간 미확인으로 출력한다. 허위 긴급도를 부여하지 않는다.
- 동일 점수는 경과 시간, Issue 번호순으로 정렬한다. 비인증 Issue 본문은 우선순위 0으로 처리하며 원본 봇 증거 검사 없이는 선별 영수증을 남길 수 없다.
- 기존 `queue-selector.mjs`의 후보 선별 순서만 해당 계산기로 확장한다. 원본 GitHub 인증·단회 POST·재조회·운영 PC 재시도 0회는 유지한다.

## 담당 인수와 진행 상태
- 기존 `HANDOFF_ROUTED`와 `HANDOFF_SELECTOR_CANDIDATE_V1` 정확한 봇 영수증이 있는 사건만 대기열 대상으로 계산한다.
- 담당 역할은 `COMMON_PROCESS_OWNER` 또는 `ORIGIN_FUNCTION_OWNER`. 특정 ChatGPT 대화 자동 호출이나 실제 작업 실행은 인정하지 않는다.
- 실제 `ZGMINI_HANDOFF_WORK_UPDATE_V1`의 `ACKNOWLEDGED`, `WORKING`, `WAITING_EVIDENCE` 댓글에는 각각 정확한 `HANDOFF_WORK_STATE_RECORDED_V1` 봇 영수증이 있어야만 상태 집계에 반영한다.
- 사라진/변조된 영수증·유효하지 않은 상태 순서 등은 `PROOF_REVIEW_REQUIRED`로 격리한다. 댓글 작성 GitHub **계정**만 검증할 수 있고 일반 ChatGPT 대화 본인 여부는 독립 검증하지 않는다.
- `HANDOFF_RESULT_RECORDED` 등이 있어도 상태는 `RESULT_EVIDENCE_RECORDED`. PC Runtime 적용 성공은 별도 원본 증거로 검증해야 한다.

## 시간 경과 확인 후보
- `PENDING_OWNER_ACK` 기준 생성 후 24시간: `ACK_DELAY_REVIEW`.
- `ACKNOWLEDGED` / `WORKING` 기준 마지막 인증 댓글 후 48시간: `WORK_INACTIVITY_REVIEW`.
- `WAITING_EVIDENCE` 기준 마지막 인증 댓글 후 72시간: `EVIDENCE_WAIT_REVIEW`.
- 추적 시각은 신뢰 가능한 GitHub ISO UTC 관측값만 사용. 시각 미확인이나 미래 시각은 지연으로 분류하지 않는다.
- 이는 **내부 점검 후보**이지 사용자가 승인한 SLA나 실제 담당자 귀책/시스템 장애 판정이 아니다.

## 실제 실행과 갱신
- 새 `.github/workflows/agent-handoff-queue-board.yml`은 기존 접수 Workflow 다음에 실행되는 **후보 선별 Actions의 성공 종료 1종**만 받아 최신 `main`에서 읽기 전용으로 실행한다. 중복 인계 이벤트에 따른 관제판 과잉 실행을 방지한다.
- GitHub Actions에서 `ZGMINI Handoff Queue Control Board`를 수동 실행해도 동일한 최신 스냅샷을 얻는다. 새 ChatGPT 예약·타이머는 없다.
- 기존 `ZGMINI_AGENT_HANDOFF_ENABLED=true` 승인 조건을 유지한다. 기존 비활성 상태를 이 배포에서 임의로 변경하지 않는다.
- 대상은 원본 Issue 100건 이하, 댓글 400개 이하 및 전부 재조회. 초과·누락·변경 경합은 요약을 성공한 척하지 않고 안전 중단한다.
- 진행이 없는 시간 중간에는 자동 재평가가 불가능하며 **다음 이벤트/수동 실행 시** 경과 시간을 재계산한다.
- 이 판정기는 운영 PC의 실제 장애 해결·GitHub 결과 댓글 반환 기능과 독립적이다.

## 완료 증거
- 소스 PR: 독립 `agent-handoff-ci` Runner CI에서 `tests/agent-handoff*.test.mjs` 및 공유 자원 계약을 검증.
- 실제 동작: 자연 접수/진행 이벤트 뒤 `ZGMINI Handoff Queue Control Board` 워크플로의 `authenticated-readonly-board` 성공 및 Job Summary의 정확한 현재 Issue 수·상태·우선순위 검토.
- 신규 장애, 운영 PC 작업, 기존 요청 재실행을 검증을 위해 인위적으로 생성하지 않는다.
- 기존 인수 댓글 실증: `#1509`, Run `43866177031`, 댓글 `6916318558` → 봇 `6916343819`. 기존 결과 반환 실증: `#1068` → `#1063`. 이 두 완료점은 재실행하지 않는다.

연계: `docs/HANDOFF_GITHUB_COMMENT_WORKFLOW_V1.md`, `docs/AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md`, `docs/PC_OPERATING_SYSTEMS_CANONICAL.md`.
