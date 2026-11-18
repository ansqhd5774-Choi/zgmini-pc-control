# ZGMINI 공통 대기열 — GitHub 능동 진단 R1

## 목적
기존 15분 대기열 관제와 별개로 승인된 비공개 GitHub 저장소의 **최근 7일간 실패한 Actions 실행**을
최신순으로 점검하고 관련 Job/제한된 로그 신호를 비교해 참고용 진단 댓글을 별도 원장
[Issue #1743](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1743)에 남긴다.

## 실행 계약
- Workflow: `.github/workflows/agent-handoff-proactive-diagnostics.yml`
- Runner: 기존 독립 Windows `zgmini-handoff-ci-isolated`, 15분 간격(UTC 매시 10·25·40·55분)
- 명시적 재실행: 저장소 owner가 `workflow_dispatch`로 수동 요청한 경우에만 허용
- 기존 활성 변수 `ZGMINI_AGENT_HANDOFF_ENABLED=true` 유지
- 권한: `contents: read`, `actions: read`, `issues: write` (진단 원장 댓글만)
- 코드 자동 수정, PR 병합, 운영 PC/원장/SQLite/D1 쓰기, 수집/게시 재실행, AI API 호출 금지

## 최신순 및 과거 제외
- 검사 창: 관측시각 기준 **최근 7일**, 정확한 UTC 생성시각으로 재검증
- 과거 수개월 전 실패는 제외. 과거 관련 사건에 *새로운* 실패 Run이 생겼다면 신규 Run만 별도 관측
- 시간 가중치나 심각도 점수보다 **최신 실행 시각이 항상 우선**
- 실패/시간 초과의 원본 GitHub Actions ID + attempt로 정확하게 중복 방지
- 한 회 실행에서 신규 진단 댓글 최대 3건. 다음 주기에 아직 최근 7일 안에 남은 후보를 이어 처리
- 검색 범위가 제한을 초과하거나 GitHub API 응답이 불완전한 경우 전체 성공으로 보고하지 않고 안전 중단

## 증거와 댓글
- Run을 정확한 HEAD, 시각, attempt로 재조회하여 drift 여부 확인
- 실패 Job과 단계번호, 고정된 로그 신호만 기록하고 **로그 전문, 자격정보, 절대경로는 게시하지 않음**
- 로그 신호는 추정 후보. 실행 실패가 실제 운영 PC 또는 외부 데이터 공급자의 결함이라는 단정 금지
- GitHub Actions bot의 유일한 `ZGMINI_PROACTIVE_DIAG_R1` marker/Run ID/attempt만 완료 기록으로 인정
- 댓글 POST 오류 후 무조건 재POST하지 않고 원장 재조회로 결과 확인, 중복·충돌은 STOP
- 본 원장은 일반챗 작업 지시나 운영 변경 승인이 아니다
- GitHub API 접근 실패, Runner 오프라인, 예약 지연/누락, 추가 GitHub 조사의 필요성은 그대로 남는다

## 완료 판정
1. 전용 Windows Runner에서 `tests/agent-handoff-proactive-diagnostics.test.mjs` 포함 회귀 테스트 통과
2. 신규 소스 `main` 병합과 실행 Workflow 및 권한 계약 재조회
3. 기존 실제 실패 Run 대상으로 최신 7일, 최신순, 최초 진단 1건 이상 관측 또는
   관측 대상 0건임을 성공 Run Summary로 확인
4. 동일 Run/attempt 재조사 시 댓글 중복 발생 0건
5. 운영 PC 쓰기·수집 재실행·AI 호출 0건

※ 문서/소스/CI 완료는 최초 GitHub schedule 자연 실행 성공을 의미하지 않는다.
