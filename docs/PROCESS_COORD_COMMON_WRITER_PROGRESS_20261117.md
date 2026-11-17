# ZGMINI 프로세스 총괄 — 공통 Writer 인계 진행 기록 (2026-11-17)

- **개발 기준:** `zgmini-pc-control` 최신 `main` (작업 시작 SHA `8340b1d51182b05d18c4362db4c3cddcdcac5aa7`).
- **작업 브랜치:** `codex/coord-writer-preimage-gate-20261117`.
- **계획·권한 정본:** `AGENTS.md`, `docs/PC_AUTOMATION_STANDARD.md`, `docs/AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md`.
- **중앙 실행 원장:** [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6936365026).
- **공통 코드 PR:** [#1876](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1876) — **DRAFT / source-only / 운영 미적용**.

## 마지막 유효 완료점

1. 2026-11-17 기준 `agent-handoff` + `handoff-agent-pending` 동시 라벨 접수 **10건**을 원본 Issue/Run/JSON과 병렬 대조.
2. #1852의 원본 #1841 `ROLLED_BACK/INTERRUPTED_ROLLBACK_VERIFIED`, #1509의 원본 #1501 `INTAKE_RECOVERED_EXISTING_CONTROLLER_PRESERVED` 복구 증거가 이미 있어 **인계 두 건의 pending 라벨만 해제**, 기존 사건·원장 보존.
3. Writer **8건** #1677/#1669/#1634/#1620/#1613/#1594/#1583/#1580의 등록된 B 요청 및 결과 JSON 모두 `WRITER_B_PREFLIGHT_STOP`. 7건 `WRITER_B_PC_PREIMAGE_STOP`, #1634 `WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`. 과거 B 재실행 0건.
4. 8건 모두 고유 `ZGMINI_HANDOFF_WORK_UPDATE_V1/ACKNOWLEDGED` 및 `HANDOFF_WORK_STATE_RECORDED_V1` 봇 receipt를 원격 확인. 특히 [#1580 Run 44004467696](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44004467696)·[#1594 Run 44004831064](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44004831064)의 Job 로그에서 실제 격리 PC `DESKTOP-N62L0NG`, Runner `zgmini-handoff-ci-spare-01`, `WORK_STATUS_RECORDED`, PC operational writes 0 확인. 이 proof는 **GitHub 계정 인수 기록**이며 다른 ChatGPT 대화 자동 수신이나 기능 설치 완료가 아님.
5. #1594 최초 ACK의 fingerprint 전사 오류는 해당 댓글을 **무효 초안**으로 명시 정정하고 별도 고유 r2 ACK 및 성공 영수증으로 복구. 기존 실패 Run 자체는 무효화하지 않음.
6. 기존 승인 [#1860 A Run 43999256156](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1860)의 **2026-11-17T01:56:16Z** 관측에서 Writer checkout HEAD와 `config.source`는 모두 `2070ff53549e2f9f2cea57d5af7e1d83f9fd7388`. 8개 과거 B manifest의 `baseHead` 모두 이 관측 SHA와 불일치. 이는 **관측 시각의 checkout 상태**이며, 과거 각 설치 시각의 첫 실패 원인을 소급 확정하지 않음.
7. #1634의 후보 SHA `a165cdf36b9f1235b2e5a8acc5431e34f87652cd`에는 `asset-r10-sp500-refresh.mjs`와 `earnings-risk-provisional-r23-hook.mjs` 파일이 존재함. 그러나 승인 manifest의 변경 2파일에는 포함되지 않고, 운영 preimage의 해당 모듈은 설치 요청 당시 `NOT_FOUND`로 판정되었으므로 임의 복사/manifest 범위 확대 금지.

## 이번 소스 최소 개선

- `writer-b/installer.mjs`: 기존 `WRITER_B_PC_PREIMAGE_STOP`과 선행 보호 검사 유지, 최초 불일치의 allowlisted `preimageCheck` 코드만 추가. 관측 SHA·파일 바이트·로컬 경로·토큰 미반환.
- `writer-b/report.mjs`: 보장된 한정 값만 결과 JSON/TXT로 전달, 임의/위조 필드 폐기.
- `writer-b/installer.test.mjs`, `writer-b/receiver.test.mjs`: HEAD·config·Task·dirty·맵 키 실패 분기/무변경, 위조 진단 폐기, JSON/TXT 비공개값 제거 회귀 시험.
- 모든 변경은 브랜치와 Draft PR에만 존재. 원본 Controller/Runner·Writer/DB/D1·공급자·운영 Task·실제 설치 변경 **0건**.

## 판정·다음 필수 실행

- **DONE:** 인계 10건의 원본 분류, 해결된 2건 대기 해제, Writer 8/8 인수 receipt, 대기열 PC 실제 Job 증거, 공통 소스 패치·테스트 작성.
- **CI 상태:** [PR #1876](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1876) 최종 HEAD의 관련 Node/격리 CI 성공 및 독립 리뷰가 확인될 때까지 **SOURCE_REVIEW_PENDING**. CI queued는 실행 실패가 아님.
- **BLOCKED(기능별 설치):** 8건 모두 과거 B 단회 소모. 현재 Runtime before SHA와 개별 원담당의 정확한 새 승인 source/manifest 없이는 기능별 설치 진행 불가. 공용 소스 패치 성공을 기능별 설치 PASS로 취급하지 않음.
- **다음 1순위:** Draft PR 정확 HEAD CI/회귀 결과 확인 → 실패 시 변경 범위 내 최소 수정, 성공 시 PR 리뷰/병합 여부 결정. 이후 필요한 **공용 도구**만 기존 B 유지보수 경로에서 승인 여부 확인. 개별 기능의 새로운 manifest·설치·수집/게시 검증은 W01/W02/W04 원담당이 수행.
- **금지:** 이전 B/pc-job ID 재실행, 격리 대기열 PC에서 운영 PC 쓰기, 임의 원격 shell, Controller/lease 강제 변경, 기능별 산식·원자료·D1 변경.
