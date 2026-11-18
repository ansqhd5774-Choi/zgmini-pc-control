# 공통 총괄 업무 목록·접수·회신 표준 정비 실행 계획 (2026-11-17)

- 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 작업 브랜치: `codex/handoff-owner-service-catalog-20261117`
- 기준 main SHA: `0ae8adbe1a26509c3c4b600c2bf04f0c5a931f51`
- 목표: 모든 일반 담당자가 총괄의 **지원 가능 업무 7유형·제외 업무·요청 조건·Issue 접수 위치/형식·접수 확인·실제 전달/인수·결과 원본 회신·요청자 실제 수신**을 한곳에서 확인하도록 한다.

## 실행 단계

1. **현행 계약 확인:** AGENTS, PC_AUTOMATION_STANDARD, GENERAL_CHAT_START/PREWORK, 중앙 인계·댓글 계약 및 `agent-handoff/contract.mjs` 대조.
2. **역할/허용 업무 확정:** 공통 대기열 PC(중개), 총괄 ChatGPT(공용 결함 지원), 기능 원담당(기능 작업)을 구분; 7개 요청 범주 및 제외 범위.
3. **문서 개정:** 상세 정본 `docs/PC_AUTOMATION_STANDARD.md`와 `AGENTS.md`, 일반챗 시작 문서 2개, 중앙/댓글 계약 2개만 수정; 기존 승인·기능 운영 불변.
4. **관련 검증:** 6문서의 요청 위치·형식·결과 필드 및 실제 처리 한계 일치 여부, 변경 파일과 원격 readback 확인.
5. **GitHub PR 검증:** 최소 변경 PR, 관련 자동 CI 및 변경 범위 확인.
6. **main 반영·진행 기록:** 승인된 문서 변경을 main에 병합하고 새 SHA/상태 확인, `docs/HANDOFF_OWNER_SERVICE_CATALOG_PROGRESS_20261117.md`에 마지막 증거/다음 행동 기록.

## 완료 정의와 기능 미구현 분리

- **문서 개정 완료:** 6문서가 현재 사용자 지시와 일치하고 실제 GitHub `main`에 존재한다.
- **실제 자동 전달 기능 완료:** 별개. 현재 `agent-handoff` 이력의 GitHub 접수·선별 영수증만으로 ChatGPT 대화의 실제 전달이나 수신을 증명할 수 없다. 실제 전달 기능은 별도 source 변경과 수신 실증이 필요하다.
- 현재 `ZGMINI_AGENT_HANDOFF_RESULT_V1`은 PR/CI 증거 형식이며 무수정/진단만 수행한 사건의 자동 회신을 모두 지원한다고 가정하지 않는다.
- PC Controller·Writer·Core·Runner 구성·운영 DB/D1·배포·예약·공급자 API·유료 서비스 변경 0건 유지.
