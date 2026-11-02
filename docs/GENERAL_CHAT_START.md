# 새 일반챗의 자동 작업 시작

이 문서는 사용자에게 매번 CMD를 전달하지 않고 GitHub 요청→PC 자동 실행→결과 읽기를 이어가기 위한 진입점이다.

## 필요한 최초 연결

GitHub 도구가 `ansqhd5774-Choi/zgmini-pc-control`에 접근할 수 있어야 한다. 새 대화가 이 지침을 자동으로 읽도록 ZGMINI 프로젝트 공통 지침에 다음 문장을 한 번 등록한다.

> ZGMINI PC 검사·진단이 필요하면 먼저 `ansqhd5774-Choi/zgmini-pc-control`의 `docs/GENERAL_CHAT_START.md`를 읽고 허용된 A급 작업을 직접 요청하고 결과까지 확인하라. 사용자가 승인한 범위의 단순 검사마다 재승인이나 CMD 수동 실행을 요구하지 마라.

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
7. PASS이면 해당 실제 증거를 인용한다. FAIL/BLOCKED이면 code/lastPass/firstFail/actualExecutionSha를 근거로 영향 범위를 한정한다. 새 증거나 수정 없이 동일 실패를 재요청하지 않는다.

## 허용 작업

- runner-smoke: 자체 CMD→Node 경로 및 읽기 전용 상태.
- core-status: 기존 task XML hash·config의 승인 SHA·checkpoint 상태만 요약. 원자료/키/전체 config는 미출력.
- source-audit: GitHub source SHA·branch HEAD 읽기 전용 대조. 후보 코드를 실행하지 않음.
- theme-common-tests: 설치 시 검증한 불변 source의 고정 공통 테스트. 승인 source 목록은 README 상태를 확인. 일반 request의 임의 SHA를 실행하지 않음.
- isolation-proof/core-conflict-proof/failure-proof/timeout-proof: 독립 fixture 검증. 실제 Core 중지·잠금 삭제·데이터 변경 없음.

요청 후 코드를 임의로 checkout하거나 Runner에 shell 명령을 전달하지 않는다. 목록에 없는 명령은 먼저 독립적인 operation adapter와 테스트/승인 범위를 준비한다.

## 동시 작업

6개 대화는 서로 다른 requestId/chatId로 요청한다. 각 Runner는 독립 작업공간에 기록하며 같은 requestId는 중복 실행하지 않는다. 같은 source를 다른 대화가 검사해도 PC 운영 checkout을 바꾸지 않는다. 무거운 작업의 자원 대기 또는 공용 운영 변경 승인 대기는 해당 작업만 제한한다.

## 비용과 결과 보관

hosted Runner/Artifact/cache를 사용하지 않는다. 결과는 private 저장소의 작은 TXT/JSON 파일과 Issue 댓글에 자동 회수한다. 결과 파일 저장이 충돌하면 bounded retry 후에도 댓글에 결과를 남긴다. GitHub 자체 API·저장 한도와 PC 자원은 존재하므로 무제한·영구무료를 보장하지 않는다.
