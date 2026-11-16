# ZGMINI 공통 대기열 — 증거 심화·조건부 시뮬레이션 R2

## 목표와 R1 구분
이 확장은 R1의 최근 7일 Actions 실패 수집을 대체하지 않는다. 기존 `agent-handoff` 미종결 이슈를 대상으로 **최근 7일·최신 접수 순**으로 원본 증거, 소스 blob, 같은 SHA의 최근 Actions 실행을 정적 대조한 뒤, 문제를 해결하기 전에 필요한 증거·원담당 조치를 조건부 시뮬레이션한다.

**범위의 엄격한 한계:** 소스 의미 해석/패치 작성/실제 프로그램 실행 시뮬레이션은 수행하지 않는다. 고정된 정책 결정표를 시뮬레이션할 뿐이다. 보고서에 `STATIC_EVIDENCE_REVIEW` 또는 `INSUFFICIENT_EVIDENCE`를 표시하고, 원인·복구 성공·장애 심각도를 확정하지 않는다. GitHub-only 로직이 실제 PC 상태를 알아낼 수 없다.

## 구현 요소
- `agent-handoff/deep-diagnostics.mjs`: 인증된 핸드오프 원본과 bot 라우팅·후보 선정 영수증 대조, 7일/최신순 필터, 소스 blob 동치 판정, 근거·원인 후보·조치 결정표 생성.
- `agent-handoff/deep-diagnostics-runner.mjs`: 승인된 비공개 제어 저장소의 열려 있는 `agent-handoff` Issue만 읽는다. 각 사건의 원본 Issue, 원본 댓글, 접수 시점의 정확한 source SHA 및 작업 당시 `main` SHA의 최대 3파일, 같은 SHA의 최근 7일 GitHub Actions 결과만 읽는다.
- `.github/workflows/agent-handoff-deep-diagnostics.yml`: 기존 독립 Windows 격리 Runner의 15분 간격 예약(UTC 12/27/42/57분), R1과 동일 GitHub 원장 #1743 쓰기 동시성 그룹. 별도 Windows 작업 스케줄러 설치나 PC 상주 프로세스를 만들지 않는다.
- 보고서는 각 접수 이슈·fingerprint의 고유 bot marker로 중복 방지, 매주기 최대 3건, 댓글 원격 재조회. 인증 미확인 사건은 진단 완료로 출력하지 않고 제외한다.
- 원본 이슈·소스가 없거나 리포지토리 접근이 제한되면 `INSUFFICIENT_EVIDENCE` 또는 안전 중단. 최신 결과를 확인하기 전 '문제 해결'이라고 표현하지 않는다.
- 상대 경로는 기존 핸드오프 계약에서 검증된 3개까지만 사용하며 소스 본문·로그 원문·토큰·외부 원자료는 보고하지 않는다.

## 증거 수준
1. GitHub 이슈 접수·라우팅·후보 선정 영수증: 위조/중복 검사
2. 원본 이슈와 bot 작성 결과 형식 후보: 실제 설치 성공/운영 효과와는 별개
3. 고정 SHA vs 관측 당시 main SHA의 Git blob 동치: 소스 내용의 변경 유무만 확인. 실제 PC 배포 여부와 무관
4. 동일 SHA Actions 성공/실패 최근 이력: 여러 workflow가 섞일 수 있으므로 동일 장애의 선행 성공/재현 증명 아님
5. 조건부 정책 시뮬레이션: 근거 없는 재실행 금지 / 읽기 전용 소스 검토 / 격리 테스트 제안 / 운영 변경은 원담당 승인 필요

## 보안 경계와 운영 방식
- GitHub API GET과 #1743 진단 댓글 생성 이외 외부 효과 없음. `contents:read`, `actions:read`, `issues:write`만 허용.
- 새 GitHub API 응답·진단 댓글은 원본 이슈에 실행 지시를 내리거나 특정 일반챗을 자동 호출하는 수단이 아니다.
- Controller·Writer·수집기·SQLite·D1·운영 PC 파일/작업 스케줄러 변경, 운영 수집 재실행, 자동 패치/PR 병합, AI API 사용 전부 제외.
- 최신 7일이 지난 기존 기록은 다음 순찰 신규 진단 대상에서 제외. 이미 GitHub에 기록된 증거는 삭제하지 않는다.
- 대기열 출처가 불완전하거나 데이터 변경 경합·댓글 400개 초과·GitHub API 제한이 있으면 근거 없는 성공 댓글을 쓰지 않는다.

## 검증과 남은 범위
- `tests/agent-handoff-deep-diagnostics.test.mjs`: 최신순·7일, 계약 검증, 위조/중복 차단, 원본·소스·이력 비교, 조건부 시뮬레이션, GitHub 쓰기 제한, 재실행 멱등성.
- 코드가 `main`에 병합되어도 예약 실행 성공 및 진단 댓글 1건 이상은 **별도 실운영 관측**으로 검증해야 한다.
- 사용자 최초 확대 목표의 '관련 소스 의미 분석, 실제 수정안별 코드 실행 시뮬레이션, 원담당 자동 인수 확인'은 이 무AI/무실행 결정표만으로 충족하지 못한다. 향후 격리 테스트와 책임자 승인에 따른 별도 도구가 필요하다.

## R3 보조 이벤트 실행 경로 (예약 트리거 미생성에 대한 완화)
- 2026-11-16 조사 기준 제어 저장소의 `actions/runs?event=schedule` 조회는 총 0건이었다. 이는 예약 시각대로 실행되었다는 증거가 아니며 활성화/등록 상태가 직접 검증된 것도 아니다.
- **기존 15분 cron 유지.** GitHub 자체 예약 시각은 지연·누락될 수 있으므로 보조 경로는 정시 보장의 대체가 아니다.
- 보조 경로: 기존 검증된 `ZGMINI Handoff Queue Candidate Selector` 또는 `ZGMINI Agent Handoff PR Evidence CI` 성공 완료, 소유자 작성 핸드오프 `handoff-agent-pending` 라벨 이벤트, `main`의 진단 전용 Workflow·Runner 파일이 변경된 push.
- 각 보조 이벤트에 대해 정확한 저장소·비공개 여부·`main`·소유자·Workflow 결과/이슈 라벨을 YAML과 Node 실행기에서 **이중 확인**한다.
- `workflow_run`이 앞선 Workflow의 실제 성공을 증명하는 것이지, 새로운 진단 자체의 성공을 뜻하지 않는다. 원장 #1743에 봇 진단 댓글 또는 Job Summary가 확인되어야 R1/R2 결과를 합격 판정한다.
- 새 보조 트리거는 자동 코드 수정, 설치, 운영 PC 권한, PR 실행 코드 권한, Windows 스케줄러를 추가하지 않는다. `contents:read`, `actions:read`, `issues:write`와 공유 원장 동시성 그룹을 유지한다.
- 성공한 보조 이벤트가 전혀 없는 기간에는 이 경로만으로 **정기 점검이 보장되지 않는다**. 예약식 활성 상태 조회/실제 `schedule` 이벤트 수신 증거가 여전히 필요하다.
