# 새 일반챗의 자동 작업 시작

2026-11-04 개정: 현재 업무의 마지막 유효 완료 지점부터 다음 실행으로 진행한다. 지침 확인만 보고하고 멈추지 않는다. 기존 증거 재사용과 이번 신규 성과를 구분한다.

사용자가 작업 전에 전달할 짧은 지침은 [GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md)다. 현재 상태와 접수 문제는 [AUTOMATION_STATUS_AND_ADMISSION.md](AUTOMATION_STATUS_AND_ADMISSION.md)로 분류한다. 요약을 읽은 것만으로 최신 정본·실제 상태 확인을 대체하지 않는다.

공통 정본은 [PC_AUTOMATION_STANDARD.md](PC_AUTOMATION_STANDARD.md)다. 기존 Runtime 증거는 필요한 대상·시각·source 범위에서 내부 전제로 재사용하고 현재 업무를 실행한다. 정상 업무마다 과거 설치·복구를 다시 확인하거나 이를 ‘가장 중요한 진전’으로 반복 보고하지 않는다. 보고는 이번 수행·검증·실제 미해결 조건·다음 행동에 한정한다.

다른 담당자의 변경이 공용 설치에 섞여 있으면 [적용 대기열 운영 방침](CONTROLLER_APPLY_QUEUE.md)에 따라 단일 조정 원장에 등록한다. 실제 설치 SHA와 각 변경의 승인·의존성을 적용 담당 한 명이 정리한다. 통합 또는 순차 적용을 정하고, 대기 보고에는 선행 항목·담당·다음 실행 조건을 명시한다. 독립 개발·검토는 계속한다.

실제 Runner 연결 장애가 있을 때 [RUNNER_RECOVERY.md](RUNNER_RECOVERY.md)를 따른다. Offline 상태에서 요청을 반복 생성하지 않는다. 정상 업무의 필수 시작 절차로 복구 검사를 추가하지 않는다.

Controller 설치 잠금·RECOVERY_REQUIRED는 [CONTROLLER_RECOVERY.md](CONTROLLER_RECOVERY.md)를 따른다. 기존 요청의 단계/소유자/실제 바이트/부작용을 확인한 뒤 지원되는 복구 도구를 사용하고 결과 회수·재개까지 담당한다. 진단 PASS나 잠금 보관을 업데이트 PASS로 보고하지 않는다.

이 문서는 사용자에게 매번 CMD를 전달하지 않고 GitHub 요청→PC 자동 실행→결과 읽기를 이어가기 위한 진입점이다.

작업 방향을 정하기 전에 #68의 해당 항목과 원본 실PC 결과에서 다른 담당자의 유효한 경로·SHA·해시 증거를 재사용한다. 새 BLOCKER에는 실행 코드/승인 계약의 필수 조건과 실제 미충족 증거를 제시한다. 독립 실행에 무관한 Core 전체 계보·폴더 탐색 오류를 선행 조건으로 확대하지 않는다. 상세 판단·정정 기준은 공통 정본 2절을 따른다.

## 필요한 최초 연결

반복 작업의 승인 판단은 [공통 정본 5절](PC_AUTOMATION_STANDARD.md#5-상시-승인과-안전한-업데이트)을 따른다. 사용자는 승인된 업무에 필수인 진단·격리 복원·source/호스트 등록·최소 실행 정책·Controller 갱신·유지보수기 정책 인계를 기능 구분 없이 상시 승인했다. 기능명 변경이나 신규 모듈 등록을 이유로 재승인을 요구하지 않는다. 구체적인 적용 manifest와 필수 검증은 유지하고, 게시·배포 등 본 업무의 효과는 해당 업무 승인과 대조한다.

GitHub 도구가 `ansqhd5774-Choi/zgmini-pc-control`에 접근할 수 있어야 한다. 새 대화가 이 지침을 자동으로 읽도록 ZGMINI 프로젝트 공통 지침에 다음 문장을 한 번 등록한다.

> ZGMINI PC 검사·진단이 필요하면 먼저 `ansqhd5774-Choi/zgmini-pc-control`의 `docs/GENERAL_CHAT_START.md`를 읽고 허용된 A급 작업을 직접 요청하고 결과까지 확인하라. 사용자가 승인한 범위의 단순 검사마다 재승인이나 CMD 수동 실행을 요구하지 마라.

2026-11-02 실제 ZGMINI 프로젝트 설정에 이 자동 시작 절차를 추가해 저장했고, 기존 지침7509자를 보존한 총7917자 저장값을 다시 열어 확인했다. 이 프로젝트의 새 일반챗은 위 연결 절차를 사용자에게 다시 요구하지 않는다.

프로젝트 밖의 새 일반챗이 이 저장소를 자동으로 알고 있다고 가정하지 않는다. GitHub 도구 미연결이면 연결이 필요한 범위만 안내한다. Runner 설치만으로 모든 대화에 지침·권한이 자동 주입되지는 않는다.

## 실행 방법 — GitHub Issue 도구만으로 가능

1. README의 현재 운영 상태와 config/operations.json을 읽는다. 필요한 작업을 허용목록에서 고른다.
2. `requestId`는 새 UUID 기반 영문 소문자 ID, `chatId`는 대화별 임의 식별자를 사용한다. 개인정보나 token을 넣지 않는다.
3. source 저장소·기존 브랜치·정확한40자리 SHA를 확인한다. 테스트 실행은 host에 승인된 SHA만 가능하다. source-audit은 해당 branch HEAD와 SHA가 같아야 한다.
4. 아래 형태의 JSON만 Issue 본문에 넣고, label `pc-job`으로 새 Issue를 **한 번** 생성한다. Markdown fence나 임의 실행 인수는 넣지 않는다.

```json
{"schema":"ZGMINI_PC_JOB_V1","requestId":"pc-REPLACE-WITH-UUID","chatId":"chat-REPLACE","operation":"runner-smoke","sourceRepository":"ansqhd5774-Choi/zgmini","sourceBranch":"main","sourceSha":"REPLACE_WITH_VERIFIED_40_CHARACTER_SHA"}
```

이것은 형식 예시이며 placeholder 그대로 요청하지 않는다. create_issue 도구의 `repository_full_name`, `title`, `body`, `labels` 등 실제 schema를 따른다.

5. Issue 댓글을 제한적으로 확인한다. 실행 시작부터 결과까지 보통 수초~수분이며 queued/offline은 실행 실패가 아니다. 같은 요청을 새로 만들지 않는다.
6. 결과 댓글의 Actions URL, TXT·JSON 파일 또는 댓글 내 JSON/TXT를 읽는다. fetch_issue_comments/fetch_file/fetch_workflow_run_jobs/fetch_workflow_job_logs 등 현재 사용 가능한 GitHub 도구를 쓴다.

현재 연결 도구에서 실제 검증한 인수 이름은 create_issue의 `repository_full_name`, fetch_issue_comments의 `repo_full_name`+`issue_number`, fetch_file의 `repository_full_name`+`path`+`ref`다. 도구 schema가 바뀌면 실제 schema가 우선이다. 단순 Actions conclusion만 보지 말고 JSON의 status/code를 확인한다.
7. PASS이면 해당 실제 증거를 인용한다. FAIL/BLOCKED이면 code/lastPass/firstFail/actualExecutionSha를 근거로 영향 범위를 한정한다. 새 증거나 수정 없이 동일 실패를 재요청하지 않는다.

## 허용 작업

- runner-smoke: 자체 CMD→Node 경로 및 읽기 전용 상태.
- fear-greed-archive-status: 실PC 설치·실행 검증된 Core SQLite 관측·검증 기록 및 실행 경로 읽기 전용 진단.
- core-status: 기존 task XML hash·config의 승인 SHA·checkpoint 상태만 요약. 원자료/키/전체 config는 미출력.
- source-audit: GitHub source SHA·branch HEAD 읽기 전용 대조. 후보 코드를 실행하지 않음.
- theme-common-tests: 설치 시 검증한 불변 source의 고정 공통 테스트. 승인 source 목록은 README 상태를 확인. 일반 request의 임의 SHA를 실행하지 않음.
- isolation-proof/core-conflict-proof/failure-proof/timeout-proof: 독립 fixture 검증. 실제 Core 중지·잠금 삭제·데이터 변경 없음.

요청 후 코드를 임의로 checkout하거나 Runner에 shell 명령을 전달하지 않는다. 목록에 없는 명령은 먼저 독립적인 operation adapter와 테스트/승인 범위를 준비한다.

## 동시 작업

6개 대화는 서로 다른 requestId/chatId로 요청한다. 각 Runner는 독립 작업공간에 기록하며 같은 requestId는 중복 실행하지 않는다. 같은 source를 다른 대화가 검사해도 PC 운영 checkout을 바꾸지 않는다. 무거운 작업의 자원 대기 또는 공용 운영 변경 승인 대기는 해당 작업만 제한한다.

## 비용과 결과 보관

hosted Runner/Artifact/cache를 사용하지 않는다. 결과는 private 저장소의 작은 TXT/JSON 파일과 Issue 댓글에 자동 회수한다. 결과 파일 저장이 충돌하면 bounded retry 후에도 댓글에 결과를 남긴다. GitHub 자체 API·저장 한도와 PC 자원은 존재하므로 무제한·영구무료를 보장하지 않는다.

## Controller 자동 갱신 요청 — 최초 연결 이후에만

기존 A급 `pc-job` 7필드 요청과 별도로, 승인된 Controller 자체 갱신은 [CONTROLLER_AUTO_UPDATE.md](CONTROLLER_AUTO_UPDATE.md)의 `pc-maintenance` Issue와 raw-byte SHA-256으로 고정된 승인 manifest를 사용한다. Runner 내부에서 `tools/update.mjs`를 호출하거나 일반 작업 Issue에 임의 명령을 넣지 않는다. 최초 유지보수기 연결 상태가 검증되지 않았다면 `AUTOMATION_BLOCKED`로 분류하고 사용자에게 매번 CMD 실행을 부탁하지 않는다. 병합·Online만으로 설치 성공을 선언하지 않는다.
