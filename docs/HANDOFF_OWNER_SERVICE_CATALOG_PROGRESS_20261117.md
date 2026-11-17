# 공통 총괄 업무 범위·접수·회신 지침 반영 진행 기록 — 2026-11-17

- 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 전용 브랜치: `codex/handoff-owner-service-catalog-20261117`
- 계획서: `docs/HANDOFF_OWNER_SERVICE_CATALOG_PLAN_20261117.md`
- 기준 main SHA: `0ae8adbe1a26509c3c4b600c2bf04f0c5a931f51`

## 기존 유효 출발점

- 기존 접수 schema `ZGMINI_AGENT_HANDOFF_V1`, 봇 `HANDOFF_ROUTED`, 후보 `HANDOFF_SELECTOR_CANDIDATE_V1`, owner 진행 댓글, 지원되는 결과 broker를 유지한다.
- GitHub 계정 댓글·자동 발견 Issue는 특정 독립 ChatGPT 대화의 실제 요청·전달·수신을 입증하지 못한다.
- `AGENTS.md` 및 PC 공통 표준은 원담당 기능 업무와 총괄 공통 결함 업무를 분리하나, 중앙 단일 처리 문서의 “공통·기능 구분 없이 수정” 표현이 충돌했다.

## 이번 변경 및 증거

1. `docs/PC_AUTOMATION_STANDARD.md`: 7개 요청 가능한 공통 업무, 명시적 제외 범위, 기존 GitHub Issue 작성 규격, 직접 요청/자동 발견 분리, 8단계 접수→회신 프로세스 정의.
2. `AGENTS.md`: 공통 역할·요청 위치와 상세 정본 참조.
3. `docs/GENERAL_CHAT_START.md`, `docs/GENERAL_CHAT_PREWORK.md`: 일반 담당자가 바로 볼 수 있는 요청 방법·회신 구분 안내.
4. `docs/AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md`: 과도한 총괄 단독 수정 범위를 현재 사용자 지시와 맞추고 역사적 E2E 성공 증거 보존.
5. `docs/HANDOFF_GITHUB_COMMENT_WORKFLOW_V1.md`: 실제 접수·선별·전달·인수·작업·원본 회신·원담당 확인을 단계별 분리.

## 진행 상태

- [x] 1/6 현행 계약 비교
- [x] 2/6 총괄/원담당 업무 범위 확정
- [x] 3/6 6개 지침 개정
- [ ] 4/6 문서 정합성·원격 readback
- [ ] 5/6 PR 및 CI 검증
- [ ] 6/6 main 반영·최종 원격 확인

**중요 미완료(별도 기능):** 실제 일반 ChatGPT 대화 자동 전달/수신과 PR·CI가 없는 순수 조정 건의 정식 결과 반환은 이번 **문서 개정만으로 구현되지 않는다**. 운영 PC 쓰기·GitHub 예약/유료 실행 추가 없음.

**다음 필수 행동:** 6개 문서 원격 재조회·일관성 대조 뒤 PR/CI 확인 → main 병합.
