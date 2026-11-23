> **2026-11-23 사용자 소속 지정:** 이슈 담당자는 보조 저장소 `zgmini-pc-control / codex/issues-lifecycle-manager-20261118` 소속이다. 프로젝트 전체 프로세스 총괄은 메인 `zgmini / codex/controller-ops-lessons-20261105`이다. 아래 ‘공통 대기열 PC 프로세스 총괄’은 격리 PC의 이슈·인계 실행 기반 관리만 뜻하며 프로젝트 전체 총괄을 뜻하지 않는다. [역할 정본](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/REPOSITORY_ROLES.md). 기존 승인과 실제 지정된 업무 범위는 유지한다.

# ZGMINI GitHub Issues 수명주기 관리 기준 R1

- 제정: 2026-11-18 KST
- 전담 저장소: `ansqhd5774-Choi/zgmini-pc-control`
- 전담 개발 브랜치: `codex/issues-lifecycle-manager-20261118`
- 범위: 이슈·PR 수명주기 감사·종결 + 공통 대기열 PC(`DESKTOP-N62L0NG`)의 접수·인계·관제·격리 실행 기반 프로세스 총괄
- 상태: **기준 수립(문서 단계)**. 이 문서의 커밋만으로 자동 종료가 설치·활성화된 것은 아니다.
- 상위 정본: [AGENTS.md](../AGENTS.md), [PC_AUTOMATION_STANDARD.md](PC_AUTOMATION_STANDARD.md), [GENERAL_CHAT_START.md](GENERAL_CHAT_START.md), [GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md). 충돌 시 최신 `main` 및 명시 승인·실제 운영 증거 우선.

## 1. 목표와 범위

사용자 목표는 **실제 미완료가 없을 때 Open 0건**이다. GitHub의 숫자를 강제로 0으로 만드는 것이 목표가 아니다. GitHub Issue는 (A) 단회 PC 실행 요청의 영수증, (B) 공통 장애 인계, (C) 기능별 실제 작업·승인·공유 자원 조정의 추적 기록으로 혼용되므로 **요청 수명주기**와 **업무 완료 여부**를 분리한다.

- 기준 시점 관측치: 2026-11-18 사용자 GitHub Issues 화면 `Open 1,198 / Closed 19`. 이 수치는 고정 현재값이나 전체 미완료 건수가 아니다. 실행 시 API 재조회 결과를 기준으로 한다.
- 이슈의 Close는 원본 본문·댓글·JSON/TXT·Run 링크를 **보존**하는 상태 전환일 뿐, PC 작업 취소·재실행·성공 입증·운영 변경·결과 삭제가 아니다.
- 이 담당자는 **GitHub 이슈·PR 수명주기 관리와 공통 대기열 PC 프로세스 총괄**을 맡는다. 기능별 수집·계산·게시·설치·UI는 원담당이 수행한다. 기존 운영 PC(`PC`)의 Controller·6 Runner·Writer·Core 및 실제 공통 운영 쓰기는 기존 PC 프로세스 총괄/승인된 단일 소유자가 담당한다. 공통 대기열 PC의 실행·인계 도구 결함은 이 담당자가 분석·개선하고, 양 PC를 잇는 공유 자원·승인·보호 변경은 기존 #68 조정으로 정확한 담당·lease를 지정한다.
- 이슈 관리 기능이 다른 원담당의 독립 작업을 막거나, 신규 Runner·CMD·예약·유료 서비스·PC 접근 경로를 만들지 않는다.

## 1A. 이슈 처리 우선순위 — 최신·운영 영향 우선 (2026-11-18 개정)

사용자 지시에 따라 **과거 작은 번호부터 무조건 정리하는 방식을 중단**한다. 우선순위는 다음과 같다.

1. **P0 — 현재 진행 중인 필수 업무의 실제 장애·차단·승인/권한 대기**: 최근 갱신된 Open 이슈 중 현재 Runtime에 영향을 주는 건부터 확인한다. 원담당·요청 ID·가장 최근 유효 결과를 연결해 인계한다. 단, 이슈 관리자는 운영 PC를 변경하거나 실패 요청을 재실행하지 않는다.
2. **P1 — 최신 실행 종료 요청**: 최근 생성된 `pc-job`/승인된 단회 B 요청을 최신순으로 감사한다. 원본 결과·JSON/TXT·Actions·효과 검증이 모두 충족된 성공 요청만 개별 `Closed / completed` 처리한다. 이미 다른 담당자가 닫았으면 **no-op** 및 변경 주체/범위를 분리한다.
3. **P2 — 최근 중복·취소·불확실**: 경합·중복·댓글 미수신·`SUMMARY_ONLY`·`STATE_UNKNOWN`·원장 결손은 증거 확인 후 상태를 기록하고, 실제 미완료/인계 업무가 있으면 Open 유지한다.
4. **P3 — 과거 누적 이슈**: 최신 P0~P2 처리 후 남은 실행 역사를 오래된 순서로 단계적 정리한다. 신규 작업에 의해 무한히 밀리지 않도록 별도 누적 잔량을 측정한다. 단, 과거라도 현재 운영을 차단하는 원인은 **P0**로 승격한다.

최신 범위는 매 작업 시작 시 GitHub의 `is:issue is:open`을 **updated 내림차순**과 **created 내림차순**으로 각각 읽어 교집합 및 차이를 파악한다. 가장 최근 생성된 번호만으로 최신 장애를 누락하지 않는다. 검색은 페이지 제한을 점검하고, 추출된 상위 일부를 Open 총수라고 주장하지 않는다.

종료 전 **바로 직전** 요청 schema·requestId·operation·현재 state·신규 댓글·동시 다른 담당의 변경을 재조회한다. 동시 Close 확인 시 다시 닫거나 자동 reopen하지 않는다. `PASS`가 부분 증거만 나타내거나 후속 정정/승인 해시 불일치가 있으면 무조건 자동 Close 금지. 이 우선순위 변경은 기존 종료 증거 요건·원담당 책임·공용 Controller 보호·영속 중앙 원장 보존을 완화하지 않는다.

## 1B. 사용자 지정 역할: 공통 대기열 PC 프로세스 총괄 (2026-11-18)

사용자는 이슈담당즈에 기존 PC 프로세스 총괄과 **업무 범위 약 90% 상당의 공통 프로세스 분석·개선·인계 조정 책임**을 부여하되, **직접 관리할 PC는 공통 대기열 PC**로 구분했다. 90%는 기능상 역할 설명이며 운영 B/C 승인, 자격정보·관리자 권한, 타 PC 쓰기 권한이나 안전 검사 면제를 뜻하지 않는다.

| 경계 | 이슈담당즈 (이 브랜치) | 기존 PC 프로세스 총괄 / 원담당 |
| --- | --- | --- |
| 호스트·실행기 | `DESKTOP-N62L0NG`, `zgmini-handoff-ci-isolated` 전용 Runner 1개 | 운영 `PC`의 `zgmini-pc-01`~`06` 및 운영 전용 유지보수기 |
| 담당 기능 | GitHub Issues·PR 정리, 공통 인계 접수/선별/중복 제거/원장·관제, 격리 Runner·Workflow/인수·결과 회신 경로의 진단·최소 개선·회귀 검증 | 운영 Controller·Writer·Core·Runner 결함, 실제 기능별 수집/계산/저장/게시/배포 |
| 공통 경계 | #68 원장·`agent-handoff` 원본을 통해 양측 실제 담당/증거 연결; 공통 장애 원인·LAST PASS/FIRST FAIL 및 영향/수정 범위 구분 | 실제 운영 변경·원본 승인/manifest/lease/backup과 기능별 Runtime 검증 |
| 허용 실행 | 기존 설치된 격리 GitHub Workflows·정확한 Runner/원본 Issue/Run·JSON/TXT 조회, 승인된 최소 소스 변경·격리 테스트·GitHub 기록 | 운영 PC 승인 A/B 실행; C는 사용자 직접 수행 |

**우선 작업 순서:** ① 격리 대기열 최신 실제 장애·대기·인계/원본 결과와 Workflow/Runner의 마지막 유효 증거 확인 → ② 승인된 범위에서 원인 분석·최소 수정/관련 회귀·결과 회신·원본/중앙 조정 연결 → ③ 완료 증거가 확정된 단회 Issue 종료 및 대체된 PR 정리 → ④ 최근 처리 후 과거 잔량. 승인·실행이 확인되지 않은 경우 `STATE_UNKNOWN`/HOLD로 보존하고 독립 이슈 정리는 계속한다.

**경계 보호:** 기존 `agent-handoff`의 스키마·bot 영수증·전체 댓글 검증, 원본 requestId/Run/attempt, 인수·회신 8단계와 중복방지를 유지한다. 격리 CI 성공/관제 요약/Issue 댓글은 운영 PC 적용, 다른 ChatGPT 대화 실제 수신, Windows 서비스 정상 지속 운영의 증거가 아니다. 격리 PC에 운영 PC의 E: 설치/DB/Task/원장·키가 있다고 가정하지 않는다. 승인 없는 운영 쓰기·Controller 교체·복구·Runner 재시작·워크플로 권한 확대·신규 유료 서비스·자동 재실행 금지.

**기준 정본:** [PC_OPERATING_SYSTEMS_CANONICAL.md](PC_OPERATING_SYSTEMS_CANONICAL.md), [HANDOFF_QUEUE_CONTROL_BOARD_R1.md](HANDOFF_QUEUE_CONTROL_BOARD_R1.md), [AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md](AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md), [PC_AUTOMATION_STANDARD.md](PC_AUTOMATION_STANDARD.md). 이 전담 브랜치의 문서 수정만으로 main·운영 PC·실제 격리 PC 설정이 자동 변경되지는 않는다.

## 2. 분류 기준: GitHub 이슈 ≠ 현재 작업 건수

각 Issue를 독립적으로 아래 1차 유형과 2차 실행 상태로 분류한다. 제목·라벨만으로 최종 판정하지 않는다.

| 유형 | 판별 대상 | 종료의 의미 |
| --- | --- | --- |
| `EXECUTION_REQUEST` | `pc-job`, 승인 B 유지보수, 단회 Writer B·Task 요청 등 | **이 요청 ID/Run의 처리 수명주기**가 종료됨. 관련 기능 전체 완료와 다름 |
| `HANDOFF_INCIDENT` | `agent-handoff`, 장애 전달·복구 이슈 | 고유 Incident에 대한 인계·원본 회신·실제 인수/해결 확인 |
| `WORK_ITEM` | 기능·버그·설치/게시·UI 등 실제 작업 | 승인된 목표와 검증 인수 조건 완료 또는 명시적 취소 |
| `COORDINATION` | #68 등 중앙 조정, 공유 설치·승인·운영 조정 원장 | **열어 둬야 하는 영속 원장**일 수 있음. 개별 댓글 완료로 닫지 않음 |
| `UNKNOWN_TYPE` | 유형·소유자 불명 | 조사 전 자동 종료 금지 |

요청 상태는 `QUEUED`, `RUNNING`, `SUCCEEDED_VERIFIED`, `FAILED_FINAL_VERIFIED`, `BLOCKED_FINAL_VERIFIED`, `CANCELLED_VERIFIED`, `STATE_UNKNOWN`, `INCONSISTENT` 중 하나로 관리한다. GitHub 상태(`open/closed`)는 별도 필드다. `READY`·`DONE`은 해당 범위의 업무 상태이지 원본 PC 실행 결과의 대용이 아니다.

## 3. 신뢰할 수 있는 종료 증거

`EXECUTION_REQUEST` 자동 성공 종료는 다음 **전부**가 충족된 경우에만 허용한다.

1. 이슈의 정확한 `repository/issueNumber`, schema, 고유 `requestId`, operation, actor 및 대상 계보를 확인한다. 같은 번호의 다른 작업·다른 repository·다른 requestId를 혼합하지 않는다.
2. 연관 GitHub Actions `runId`, `attempt`, 실제 target host/Runner 및 최종 Job 종료를 일치시키고, 중복 시도나 아직 진행 중인 시도가 있는지 확인한다.
3. 검증된 원격 `results/*.json`과 `results/*.txt` **2/2**, 동일한 고유 요청의 status/code·원본 댓글·Run URL을 대조한다. 필요한 경우 업로더의 고유 `zgmini-pc-result` 마커, 댓글 작성자와 원본 결과를 확인한다.
4. 실행 status는 **해당 operation의 계약에 따라 성공으로 확정**되어야 한다. `HTTP 200`, `Actions success`, `REPORT_UPLOADED`, `READY`, `SUMMARY_ONLY`, `CI PASS`, `댓글 게시` 단독으로 성공 간주 금지.
5. 실행의 의도된 부작용이 있다면 승인 범위 내 실제 적용·사후 검증을 확인한다. A 조회 성공은 B 설치·SQLite/D1·게시 성공이 아니며, 설치 성공은 기능 게시 완료가 아니다.
6. Issue를 닫는 바로 직전 현재 state/수정 이력·새 댓글·다른 소유자 조치·중복 Run을 재조회해 드리프트·경합이 없음을 확인한다. 판정이 변경되면 쓰기를 중단한다.

원격 증거가 일부 없거나 서로 불일치하면 `STATE_UNKNOWN`/`INCONSISTENT`로 유지하고 **재실행으로 메우지 않는다**. `SUMMARY_ONLY`는 해당 요약 범위만 입증한다. 분류용 GitHub API 읽기가 실패하거나 페이지가 잘리면 건수·종료 대상을 확정하지 않는다.

## 4. 종료 결정표

| 이슈 유형·상태 | GitHub 처리 | 필요한 증거/후속 |
| --- | --- | --- |
| 실행 요청 `SUCCEEDED_VERIFIED` | `Closed / completed` 후보 | 요청 결과 2/2·계보·해당 effect 검증·최종 state 재조회 |
| 실행 요청 `FAILED_FINAL_VERIFIED` / `BLOCKED_FINAL_VERIFIED` | **자동 종료 금지**. 책임자·후속 추적 확인 후 개별 종료 가능 | 정확한 실패 원인, LAST PASS/FIRST FAIL, 재시도 금지, 별도 활성 장애/작업 링크 및 수신·인수 확인 |
| 실행 요청 `CANCELLED_VERIFIED` / 명시적 중복 | `Closed / not_planned` 후보 | 취소·중복의 실제 근거와 대표 원본 링크, 미실행/부작용 없음 또는 정확한 효과 범위 |
| `QUEUED` / `RUNNING` | Open | Run/Runner 현재 상태에 따라 관찰. 단순 지연은 실패 아님 |
| `STATE_UNKNOWN` / `INCONSISTENT` | Open | 기존 ID·Run·결과·댓글을 읽기 전용 복원. 임의 종료·무조건 재요청 금지 |
| `HANDOFF_INCIDENT` 해결 | 개별 검증 후 `Closed / completed` | 공통 회신과 원담당 **실제 인수·해결**, 연계 미해결 범위 없음 |
| `WORK_ITEM` 완료/명시 취소 | 개별 검증 후 `completed` / `not_planned` | 기능별 승인된 실제 목표와 테스트·PC/D1/API/UI 범위의 필요한 증거 |
| `COORDINATION` / 중앙 원장 | 원장 성격이면 Open 유지 | 개별 작업 종료와 영속 원장 폐쇄를 구별 |
| `UNKNOWN_TYPE` | Open | 분류·담당·종료 계약부터 확인 |

**추가 규칙:** 실패한 단회 요청이 더 이상 실행될 수 없다는 사실만으로 장애가 해결된 것은 아니다. 원본 실패 기록은 폐기하지 않고, 후속 Incident/작업이 생성·인수되고 원본의 수명주기 종료가 입증됐을 때만 종료 판정한다. 모든 자동 종료는 성공한 단회 요청부터 시작한다. `Closed`인 과거 이슈를 자동 재개하거나 처리된 고유 요청을 재실행하지 않는다.

## 5. 운영 안전 계약

- 허용 초기 범위: **GitHub 읽기 전용 목록 감사와 종료 후보 보고**. 이후 사용자 승인·검증을 받은 제한된 범위의 GitHub 상태/완료 댓글 쓰기만 허용한다. 이 문서는 대량 종료 승인이나 PC 운영 효과 승인이 아니다.
- 이슈 담당 전용 브랜치의 변경은 이슈 관리자 코드·시험·문서에 한정한다. Controller/Writer·Workflows·GitHub 권한 변경은 영향 범위와 정규 PR·관련 회귀검증·필요 승인 이후에만 진행한다.
- 이전 정상 업로더 `controller/upload.mjs`는 결과 pair와 GitHub 댓글을 쓰지만 현행 조회 범위에서 자동 Close는 확인되지 않았다. **이 기능의 도입은 구현·검증·활성화가 필요한 별도 단계**다. 해당 업로더의 보고·정리·PC 락을 훼손하지 않는다.
- 자동 종료 처리기는 기존 결과 게시 이후에 **비차단·멱등**으로 동작해야 한다. 종료 실패 때문에 원본 PC 실행을 실패로 소급하지 않고, 결과 재게시·PC 재실행·이슈 중복 생성을 유발하지 않는다.
- 동일 Issue 중복 Close 요청은 no-op으로 수렴. 새 댓글·수정·새 Run·동시 종료 간 상태 경합 시 중단 후 재분류한다. 전체 목록 탐색은 pagination/상한/권한 오류를 드러내고, 누락을 0건으로 보고하지 않는다.
- 원본 Issue 본문, 댓글, result pair, 승인 manifest, 원장, checkpoint, 이력, 활성 Incident 및 중앙 #68은 삭제·일괄 변형하지 않는다. 보안정보·키·개인정보·전체 원자료는 감사 결과에 기록하지 않는다.
- 실제 운영 PC `PC`의 6 Runner와 격리 대기열 PC `DESKTOP-N62L0NG`의 역할을 섞지 않는다. 이슈 정리를 위해 PC Controller 교체·예약 변경·Runner 재시작을 요구하지 않는다.

## 6. 감사 및 단계적 정리 절차

1. **스냅샷:** API에서 `is:issue state:open`을 페이지 끝까지 읽고 이슈/PR을 구분한다. 기준 시각, 검색 조건, 페이지 수, total/중복·누락 확인 상태를 기록한다. 화면의 1,198/19는 과거 기준선으로만 표시한다.
2. **유형화:** schema·라벨·제목·원본 댓글/Run을 근거로 `EXECUTION_REQUEST` / `HANDOFF_INCIDENT` / `WORK_ITEM` / `COORDINATION` / `UNKNOWN_TYPE`으로 분리한다. 기능별 책임자를 유지한다.
3. **증거 대조:** 동일 requestId/Run/attempt와 원격 JSON/TXT, 댓글, 승인 scope, 실제 effect를 결합하여 상태·결손·불일치를 기록한다.
4. **Dry-run 보고:** 우선 '자동 성공 종료 가능', '사람 검토 필요', '진행 중', '미확정', '영속 원장'을 집계한다. Issue 번호와 증거 링크만 출력한다. 이 시점 GitHub 이슈 변경 0건.
5. **제한된 적용:** 별도 명시 승인 후 검증된 `SUCCEEDED_VERIFIED`부터 작은 배치로 종료한다. 대상 번호·판정 버전·결과 링크를 기록하고 각 건을 재조회해 Open→Closed 전환을 확인한다. 오류 시 남은 배치 중단, 일괄 rollback/reopen 금지.
6. **미해결 이관:** 실패·차단·미확정의 실제 담당/원본 Incident·승인/복구 범위를 연결한 뒤 개별 판정한다. 복구·재실행은 원담당 승인 경로만 사용한다.
7. **신규 처리 개선:** 기존 결과 업로드·정규 PC 작업에 영향 없는 방법으로 요청 종료를 연결한다. 새 Runner·Cron·중복 PC 실행기 없이 현재 GitHub 이벤트/기존 업로더 경로를 재사용한다.
8. **정확성 검증:** 정상·지연·실패·불명확·결과쌍 누락·댓글 불일치·중복 실행·상태 경합·API 제한·중앙 원장/인계 보존 시험을 수행한 뒤 필요 시 PR 병합·실제 활성화·운영 회귀를 분리해 확인한다.

## 7. 측정 지표와 완료 조건

매 보고에 관측 시각과 함께 다음을 분리한다.

- `openTotal`, `closedTotal`: GitHub 실제 이슈 수(대상 repository와 검색 범위 명시).
- `openExecutionTerminalVerified`: 종료 증거는 충분하나 GitHub Open으로 남은 단회 요청.
- `openExecutionActive`, `openExecutionUnknown`, `openBlockedNeedsOwner`: 진짜 실행 중 / 불명확 / 미해결 후속.
- `openWorkItems`, `openHandoffs`, `openCoordination`, `unclassified`: 작업·인계·영속 원장·미분류 수.
- `evidenceVerifiedCount`, `closeAttemptCount`, `closedReadbackVerifiedCount`, `falseCloseCount`, `sideEffectsPCCount`: 정확성 지표.
- 모든 분류는 중복 제거된 Issue 번호 기준이며, 불완전한 페이지/증거는 **UNKNOWN**으로 별도 표시한다.

**합격 기준:** 증거가 충분한 종료 후보를 누락 없이 식별하고, 승인된 대상만 정확히 종료·재조회하며, 잘못 닫힌 진행 중/장애/영속 원장 0건, PC 부작용 0건. 정리 후에도 합법적인 미완료 Issue는 Open으로 남을 수 있다. **Open 0은 실제 미완료·미분류·진행 중 업무가 모두 없는 경우에만 달성되는 결과**이고 숫자만을 위한 강제 종료는 실패다.

## 8. 수립 시점의 완료·미완료

- 완료: 업무 책임 분리·증거 요건·종료 매트릭스·보호 원칙·실행 순서·지표 기준 수립.
- 미완료: 전체 현황 API 감사, 완료 증거별 분류 결과, 자동 종료 기능 구현, 회귀시험, 승인된 실제 이슈 종료, 실제 운영 모니터링.
- **다음 필수 실행:** 최신 원격 Open 이슈를 읽기 전용으로 완전 페이지 수집해 유형별 수와 `SUCCEEDED_VERIFIED` 후보의 실제 원격 증거를 대조한 dry-run 감사 결과 작성. 그 결과 없이 1,198건 일괄 종료하지 않는다.
