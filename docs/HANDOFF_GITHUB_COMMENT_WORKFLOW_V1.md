# ZGMINI 공통 대기열 — GitHub 댓글 작업 인수·상태·결과 계약 V1

## 목적과 역할
- 일반 ChatGPT 담당자는 기존 허용된 GitHub agent-handoff Issue로 작업/장애를 요청한다.
- 독립 공통 대기열 PC DESKTOP-N62L0NG의 격리 Runner zgmini-handoff-ci-isolated는 원본 Issue·실행·SHA·검증된 댓글로 접수·분류·중복 방지·상태 기록과 결과 검증만 한다.
- 실제 분석·소스 수정·PR·테스트는 해당 업무 담당 ChatGPT가 별도 승인된 개발 환경에서 수행한다.
- 운영 PC의 Controller, Core, Writer, SQLite, D1, 배포와 관리자/보안 설정에 이 Workflow가 쓰기 작업을 수행하지 않는다.
- 일반챗의 자동 깨우기·대화 자동 재개를 지원한다고 주장하지 않는다. 새 ChatGPT 예약 작업이나 AI API 인증·과금·실행을 만들지 않는다.

## 현재 이미 존재하는 접수/결과 계약
- Issue JSON: ZGMINI_AGENT_HANDOFF_V1; 라벨 agent-handoff와 handoff-agent-pending.
- 입력 인증: HANDOFF_ROUTED 봇 영수증 + HANDOFF_SELECTOR_CANDIDATE_V1 단일 봇 영수증.
- 최종 결과 JSON: ZGMINI_AGENT_HANDOFF_RESULT_V1을 원본 agent-handoff Issue에 owner가 댓글로 작성.
- GitHub Actions agent-handoff.yml의 기존 record-verified-return이 PR/CI 원본 증거를 대조하고 RUNTIME_VERIFICATION_PENDING까지만 기록한다. 운영 적용/기능 완료를 대신하지 않는다.
- 기존 진행 원장과 Issue를 새 요청 없이 재사용한다.

## 신규: owner GitHub 진행 댓글
각 일반챗 담당자는 자기 업무를 실제로 인수하거나 상태가 변경된 때에만 인증된 동일 Issue에 아래 JSON을 단일 행으로 게시한다. incidentId, fingerprint, role은 해당 Issue 기존 HANDOFF_ROUTED 영수증에서 확인한 그대로 사용한다. updateId는 새 상태 기록마다 유일해야 한다.

    {"schema":"ZGMINI_HANDOFF_WORK_UPDATE_V1","updateId":"work-2001-20261116-a","incidentId":"handoff-example-2001","fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"COMMON_PROCESS_OWNER","state":"ACKNOWLEDGED"}

위 값은 형식 예시이므로 실제 사고에서는 그대로 게시하지 않는다. 신뢰되지 않은 Issue 내용이나 코드는 실행하지 않는다.

허용 상태 흐름:
- 첫 댓글: ACKNOWLEDGED (인수 표명, AI 실행 증거는 아님)
- 그다음: WORKING 또는 WAITING_EVIDENCE
- WORKING → WAITING_EVIDENCE, WAITING_EVIDENCE → WORKING
- 결과 제출은 별도 기존 ZGMINI_AGENT_HANDOFF_RESULT_V1 형식으로 한다. 진행 댓글을 TESTED, APPLIED_VERIFIED, RETURNED, OWNER_RESUMED로 해석하지 않는다.

## 격리 Runner 검증
- 소유자 작성, 열린 사고 Issue, 필수 라벨 2개, 원본 JSON schema·SHA fingerprint·분류 역할, 이미 인증된 봇 라우팅/후보 영수증을 대조한다.
- owner 진행 댓글의 저장된 id/내용/Issue URL이 정확히 같아야 한다.
- 이전 진행 댓글마다 대응하는 단일 봇 영수증을 확인하고 순서를 지킨다. 누락·위조·불명확·다중 기록은 중단한다.
- GitHub bot은 동일 Issue에 HANDOFF_WORK_STATE_RECORDED_V1을 하나만 남기고 저장 후 재조회한다. POST 응답이 유실돼도 무작정 다시 쓰지 않는다.
- 영수증은 evidence: OWNER_GITHUB_COMMENT_ONLY, aiExecution: NOT_ATTESTED, operationalWrites: 0을 표시한다. 작성자가 실제 AI 작업을 완료했는지 독립 증명하지 않는다.
- 기존 ZGMINI_AGENT_HANDOFF_ENABLED=true 조건을 그대로 따른다. owner의 새 상태 댓글 이벤트가 있어야 실행한다. 예약은 불필요하다.

## 제한과 조치
- GitHub 댓글만으로 다른 ChatGPT 채팅을 실행하거나 자동 인수시키지 않는다.
- GitHub 사용자 계정으로 작성된 댓글은 검증할 수 있으나 어느 일반 ChatGPT 대화가 댓글을 작성했는지는 독립 인증하지 못한다. origin.chatId는 신원/실행 인증 수단이 아니다.
- 봇 GITHUB_TOKEN 댓글로 다른 Actions가 자동 실행될 것으로 가정하지 않는다.
- 결과 PR/CI 성공과 운영 PC 런타임 성공을 혼동하지 않는다.
- 고유한 장애 상태와 소스 수정 책임을 운영 PC/AI 제안 실행기로 강제 이전하지 않는다.

## 회귀 테스트
    node --test tests/agent-handoff-work-progress.test.mjs
    node --test tests/agent-handoff*.test.mjs

연계 정본: AGENT_HANDOFF_V1.md, AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md, PC_OPERATING_SYSTEMS_CANONICAL.md.
