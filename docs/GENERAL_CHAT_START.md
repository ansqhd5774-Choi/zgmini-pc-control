# 새 일반챗의 자동 작업 시작

## 2026-11-12 실행 전 경로 확인 — 신규 대화 공통 5단계

1. **최신 정본 학습:** `main`의 [AGENTS.md](../AGENTS.md), [PC_AUTOMATION_STANDARD.md](PC_AUTOMATION_STANDARD.md), [PC_OPERATING_SYSTEMS_CANONICAL.md](PC_OPERATING_SYSTEMS_CANONICAL.md)를 업무 관련 범위에서 직접 조회한다. 이 문서·[GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md)와 기존 기능별 브랜치·승인·마지막 실증을 대조한다. 이 절차만 보고하고 멈추지 않는다.
2. **PC 대상 고정:** `PC`(운영 Windows 11, `zgmini-pc-control`, 6 Runner, 운영 Node/Controller 설치)와 `DESKTOP-N62L0NG`(격리 Windows 10, `zgmini-handoff-ci-isolated`, 1 ZGMINI 전용 Runner, pinned Node 22)를 구분한다. 2026-11-12 전체 Listener 수는 7개/5개로 각 ZGMINI 전용 좌석 수 6/1과 다르다. 서로 다른 설치 경로·권한을 복제하지 않는다.
3. **기존 작업 경로 사용:** 운영 A급은 `pc-job` Issue→Actions→고정 Controller, B급은 기존 승인 manifest/독립 수신기, 공통 오류 접수·인계는 격리 Runner의 기존 Workflow로 처리한다. 이미 검증된 방식이 있으면 새 ZIP·CMD·Runner·예약을 기본 대체 수단으로 설계하지 않는다. 사용자가 승인한 기존 CMD 수동 경로는 무단 폐기하지 않는다.
4. **검증된 회수:** 각 업무의 원본 Issue/Run/attempt·실제 Runner/host·작업 status/code·JSON/TXT 원격 readback을 확인한다. queued/CI 성공/원본 댓글을 실제 기능 성공·다른 일반챗 자동 수신으로 오인하지 않는다. 불명확 결과는 기존 증거부터 재조회하며 같은 requestId를 자동 재실행하지 않는다.
5. **실행과 보호:** 현재 승인 범위의 기능 작업은 즉시 계속하되, C급 #996 NO-GO, Core/Writer/DB/Task/산식·원자료/승인 게시 구조를 근거 없이 변경하지 않는다. 예약 자동 갱신 검증은 개별 기능 완료 후 후속이다. 완료 보고에는 전체 목표 진행률·새 결과 증거·남은 실제 문제·다음 실행만 포함한다.

**유의:** 위 문서가 GitHub에 있다고 ChatGPT 프로젝트 지침이 자동 수정되는 것은 아니다. 프로젝트 설정에 반영이 필요한 경우 기존 지침을 보존하고 이 시작 절차를 별도로 갱신해야 한다.

---

**두 물리 PC의 실행 대상:** 운영 6 Runner가 있는 기존 PC와 격리 `zgmini-handoff-ci-isolated` Runner가 있는 공통 장애 인계 PC의 장비·실행 환경은 동일하지 않다. [PC별 실제 Runner 인벤토리](PC_HOST_INVENTORY_READONLY.md) 및 [PC별 프로세스·자동 시작·실행·복구 정본](PC_OPERATING_SYSTEMS_CANONICAL.md)를 확인하고, 기존 성공된 GitHub Issue→Runner→JSON/TXT 구조를 해당 PC에 맞게 재사용한다. PC별 절대 경로·권한·Node 설치를 복제했다고 가정하지 않으며, 경로 불일치가 확인되면 그 작업만 제한한다. 기존 전체 업무의 전역 Gate나 C급 NO-GO를 새로 만들지 않는다.

2026-11-06 개정: 현재 업무의 마지막 유효 완료 지점부터 다음 실행으로 진행한다. 지침 확인만 보고하고 멈추지 않는다. 기존 증거 재사용과 이번 신규 성과를 구분한다.

**원담당 재개 원칙:** 이 지침을 실제로 받은 일반챗은 자신이 담당하던 구현·수집·계산·게시·검증을 기존 승인 범위에서 재개한다. 공용 총괄의 #434 자연 B 실증 대기나 다른 대화의 수신 미확인을 자기 업무의 선행 조건으로 삼지 않는다. 업무에 필요한 정상 승인 B급 작업은 정규 절차로 계속하고, #434만을 검증할 시험용 B는 생성하지 않는다. GitHub Issue·댓글의 인계 기록은 다른 일반챗을 깨우는 알림이 아니므로, 원담당 대화에서 실제 수신 사실과 다음 실행·결과를 구분해 기록한다. 수신 ACK 댓글을 새로운 Gate로 추가하지 않는다. 총괄은 원담당 기능 업무를 대신하지 않는다.

사용자가 작업 전에 전달할 짧은 지침은 [GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md)다. 현재 상태와 접수 문제는 [AUTOMATION_STATUS_AND_ADMISSION.md](AUTOMATION_STATUS_AND_ADMISSION.md)로 분류한다. 요약을 읽은 것만으로 최신 정본·실제 상태 확인을 대체하지 않는다.

**2026-11-10 격리 Writer B 인계 반영:** 일반챗은 작업을 시작·재개할 때 최신 `main`의 `AGENTS.md`·이 문서·`PC_AUTOMATION_STANDARD.md` 관련 범위를 확인한다. 승인된 정규 Writer B 실행이 실제 실패하면 격리 Windows Runner가 원본 bot 증거를 검증해 단일 중앙 ChatGPT용 `agent-handoff` Incident를 자동 접수하고, 검증된 해결 결과는 **원본 Issue의 bot receipt**로 돌아온다. 원담당은 실제 자기 대화가 재개됐을 때 해당 원본 Issue와 결과를 읽고 본래 기능의 다음 작업을 수행한다. GitHub 이슈 댓글만으로 다른 일반챗 자동 수신·원담당 재개·PC 설치/게시를 주장하지 않는다. 안전 대기(`WAIT_RECORDED`)·성공·미확정은 수리 실패가 아니며, 실증만을 위한 Writer B 요청을 생성하지 않는다. [중앙 계약과 새 격리 경로의 검증 범위](AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md)를 따른다.

**공통 장애 해결 결과 회수 — 원담당 읽기 전용 경로(2026-11-12):** 중앙 인계가 실제로 발생한 업무에 한하여 **자기 원본 Issue 번호 하나**를 기준으로 조회한다. 최신 `main`의 `agent-handoff/owner-return-review.mjs`는 **`readAndReviewOwnerReturn({originIssueNumber, io})`**로 기존 GitHub 조회 도구의 인증된 읽기 함수(`readIssue`, 완전한 페이지 확인을 포함한 `readIssueComments`, `readPullRequest`, `readRun`)를 연결한다. 자기 **원본 Issue 번호 하나만** 지정하면 해당 Issue에 실제 반환된 `handoffIssue`의 Incident·Owner 결과·PR·성공 Actions Run을 순서대로 읽고 기존 `reviewOwnerHandoffReturn`으로 교차검증한다. 입력된 IO는 인증된 GitHub GET 결과여야 하며 임의 생성 fixture나 페이지 일부를 실제 결과로 취급하지 않는다. **추가 Runner·예약·Workflow 없이 사용하는 순수 읽기 전용 경로**로서, 코드가 실행됐다는 사실만으로 다른 ChatGPT 대화의 자동 수신 또는 운영 PC 적용을 주장하지 않는다. 댓글이 많은 Issue는 pagination을 모두 확인하고, 완료 여부가 불명확하면 성공이나 ‘해당 없음’으로 치환하지 않는다. 자기 원본 Issue에 봇 `HANDOFF_ORIGIN_RESULT_RECORDED` 영수증이 없으면 `NO_RETURNED_RESULT`; 있다면 정확한 원본 `requestId/chatId`, Incident 본문·Owner 결과 댓글·중앙 봇 `HANDOFF_RESULT_RECORDED`, 원본 봇 댓글의 **전체 본문·봇 작성자·issue_url**, PR HEAD·CI SHA/결과를 대조한다. 어느 하나가 어긋나면 안전 중단한다. 순수 판정의 `RETURN_EVIDENCE_REVIEWABLE`은 **PR/CI를 검토할 수 있는 결과 반환 증거**일 뿐이며, `ownerChatReceived=UNKNOWN`, 실제 PC 설치/DB·D1/API/UI 적용 `NOT_VERIFIED`, 자동 PC 재실행·권한 승인 `0/FALSE`다. 원담당은 해당 이력과 자신의 마지막 유효 완료 단계를 확인해 **실제 허용된 다음 기능 작업**을 수행한다. 새 Owner ACK 댓글/자동 알림/ChatGPT 타 대화 기동을 필수 Gate로 만들지 않는다. 기존 완료된 원담당 작업의 성공 증거를 재조사하지 않는다. 이 안내만을 이유로 정상 기능 작업을 멈추지 않는다.

**인증된 GitHub GET 입력 연결(2026-11-12):** 기존 승인된 Node 22 읽기 실행환경에서는 `agent-handoff/owner-return-github-io.mjs`의 `createOwnerReturnGithubReadIo({token, fetchImpl})`를 기존 `readAndReviewOwnerReturn`의 `io`에 전달할 수 있다. 토큰은 기존 허용된 환경/권한에서만 사용하고 GitHub Issue·채팅·로그에 출력하지 않는다. 이 어댑터는 `GET`만 수행하며, 원본 Issue의 전체 댓글 수/페이지/수정시각을 대조하고 허용된 PR·Run 저장소만 조회한다. **이 소스를 추가했다고 기존 PC Runner에 새로운 작업이 자동 설치되거나 ChatGPT 커넥터에서 JavaScript 함수가 자동 실행되는 것은 아니다.** GitHub 연결 ChatGPT에서는 기존 읽기 도구로 같은 자료를 조회해 근거별로 대조한다. 실제 원담당 대화 재개 및 운영 기능 적용 성공은 별도 확인한다.

완료 단계는 증거와 함께 닫고 다음 필수 실행 하나를 담당·입력·통과 조건과 함께 지정한다. 대기는 기존 ID 하나로 추적하며 같은 상태를 반복 보고하지 않는다. 사용자 중지 시 새 실행과 추적을 중단한다. [단계 종료와 다음 실행](PC_AUTOMATION_STANDARD.md#단계-종료와-다음-실행)을 따른다.

공통 정본은 [PC_AUTOMATION_STANDARD.md](PC_AUTOMATION_STANDARD.md)다. 기존 Runtime 증거는 필요한 대상·시각·source 범위에서 내부 전제로 재사용하고 현재 업무를 실행한다. 정상 업무마다 과거 설치·복구를 다시 확인하거나 이를 ‘가장 중요한 진전’으로 반복 보고하지 않는다. 보고는 이번 수행·검증·실제 미해결 조건·다음 행동에 한정한다.

다른 담당자의 변경이 공용 설치에 섞여 있으면 [적용 대기열 운영 방침](CONTROLLER_APPLY_QUEUE.md)에 따라 단일 조정 원장에 등록한다. Controller 외에도 동일 PC Core 실행 checkout·승인 source SHA에 실제 영향이 있는 기능 변경과 Sidecar 의존 관계를 해당 원장에서 함께 조정한다. 실제 설치 SHA와 각 변경의 승인·의존성을 적용 담당 한 명이 정리한다. 통합 또는 순차 적용을 정하고, 대기 보고에는 선행 항목·담당·다음 실행 조건을 명시한다. 독립 개발·검토는 계속한다.

실제 Runner 연결 장애가 있을 때 [RUNNER_RECOVERY.md](RUNNER_RECOVERY.md)를 따른다. Offline 상태에서 요청을 반복 생성하지 않는다. 정상 업무의 필수 시작 절차로 복구 검사를 추가하지 않는다.

Controller 설치 잠금·RECOVERY_REQUIRED는 [CONTROLLER_RECOVERY.md](CONTROLLER_RECOVERY.md)를 따른다. 기존 요청의 단계/소유자/실제 바이트/부작용을 확인한 뒤 지원되는 복구 도구를 사용하고 결과 회수·재개까지 담당한다. 진단 PASS나 잠금 보관을 업데이트 PASS로 보고하지 않는다.

2026-11-05 KST #319 설치 잠금은 공식 `ABORTED_UNTOUCHED`로 보관 완료됐다. #319 자체는 Controller 설치 성공을 뜻하지 않으며 이력은 [복구 지침](CONTROLLER_RECOVERY.md)에 있다. 일반 A급 조회·독립 Reader에는 #319 상태나 6개 Runner 전원 유휴를 반복 선행 조건으로 삼지 않는다. 실제 Controller 교체는 여전히 검증된 독립 유지보수기와 B manifest·원본 보호가 필요하다. PR #327 개선 코드는 `main`에 병합됐으며, 2026-11-05 KST 실제 PC에서 **유지보수기 자체 인계 PASS**(`5469548b05ba90f3855281e94234952bdb45fa4f`, 새 Receiver 출처 검증)를 확인했다. **그 유지보수기 인계만으로 Controller 설치·6 Runner 재연결·운영 정책 활성화를 판정하지 않는다**.
이후 별도 정규 B 요청 [#345](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/345#issuecomment-6640249328)에서 Controller `69c830275bd3fec75b17c8a98c46d689447fb1a7` 실제 설치가 `SUCCEEDED`로 검증됐고 보호 상태·Workflow 활성 상태가 유지됐다. [#346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/346)·[#347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/347) A급 진단 PASS는 각각 해당 시점의 실행 증거다. 승인되어 제거된 이란 R13 예약은 [PR #342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/342)의 `APPROVED_RETIRED_ABSENT`를 적용하며, 임의 복원하거나 독립 A급 작업의 전역 차단 조건으로 삼지 않는다. Core·Korea 보호는 유지한다. 현재 운영을 확인할 때는 과거 SHA·상태를 최신값으로 고정하지 않는다.

이 문서는 사용자에게 매번 CMD를 전달하지 않고 GitHub 요청→PC 자동 실행→결과 읽기를 이어가기 위한 진입점이다.

작업 방향을 정할 때 공용 조정 이슈 #68에서는 **현재 업무와 겹치는 승인·설치 항목**만 원본 링크로 확인한다. #68은 조정 이력이지 개별 요청의 결과 API가 아니므로 매 작업마다 전체 댓글을 조회하지 않는다. 기존 원본 실PC 결과의 유효한 경로·SHA·해시 증거는 해당 고유 Issue/requestId에서 재사용한다. 새 BLOCKER에는 실행 코드/승인 계약의 필수 조건과 실제 미충족 증거를 제시한다. 독립 실행에 무관한 Core 전체 계보·폴더 탐색 오류를 선행 조건으로 확대하지 않는다. 상세 판단·정정 기준은 공통 정본 2절을 따른다.

## 필요한 최초 연결

반복 작업의 승인 판단은 [공통 정본 5절](PC_AUTOMATION_STANDARD.md#5-상시-승인과-안전한-업데이트)을 따른다. 사용자는 승인된 업무에 필수인 진단·격리 복원·source/호스트 등록·최소 실행 정책·Controller 갱신·유지보수기 정책 인계를 기능 구분 없이 상시 승인했다. 기능명 변경이나 신규 모듈 등록을 이유로 재승인을 요구하지 않는다. 구체적인 적용 manifest와 필수 검증은 유지하고, 게시·배포 등 본 업무의 효과는 해당 업무 승인과 대조한다.

GitHub 도구가 `ansqhd5774-Choi/zgmini-pc-control`에 접근할 수 있어야 한다. 새 대화가 이 지침을 자동으로 읽도록 ZGMINI 프로젝트 공통 지침에 다음 문장을 한 번 등록한다.

> ZGMINI PC 검사·진단이 필요하면 먼저 `ansqhd5774-Choi/zgmini-pc-control`의 `docs/GENERAL_CHAT_START.md`를 읽고 허용된 A급 작업을 직접 요청하고 결과까지 확인하라. 사용자가 승인한 범위의 단순 검사마다 재승인이나 CMD 수동 실행을 요구하지 마라.

2026-11-02 실제 ZGMINI 프로젝트 설정에 이 자동 시작 절차를 추가해 저장했고, 기존 지침7509자를 보존한 총7917자 저장값을 다시 열어 확인했다. 이 프로젝트의 새 일반챗은 위 연결 절차를 사용자에게 다시 요구하지 않는다.

**2026-11-10 ChatGPT 프로젝트 공통 지침 동기화 필요:** 위 2026-11-02 저장 확인은 당시 **PC 조회 자동 시작 문구**에 한정된다. 새 격리 Writer B 중앙 인계 절차까지 프로젝트 설정에 반영됐다는 증거는 아니다. 프로젝트 관리자는 ZGMINI **프로젝트 설정 → 프로젝트 지침**에서 기존 R6.0을 보존하고 아래 문장을 추가·저장해야 한다. GitHub 업데이트만으로 기존 일반챗이나 실제 프로젝트 설정이 자동 변경되지 않는다.

> 원담당 일반챗은 업무 시작·재개 시 제어 저장소 최신 main의 AGENTS.md·docs/GENERAL_CHAT_START.md·docs/PC_AUTOMATION_STANDARD.md 관련 내용을 확인한다. 승인된 Writer B의 인증된 수리 가능 실패는 격리 Windows intake → 단일 중앙 ChatGPT 처리 → 원본 GitHub Issue 결과 반환 경로를 따른다. Issue 댓글은 다른 일반챗의 자동 수신·자동 재개나 PC 운영 적용이 아니다. 원담당은 자기 대화가 실제 재개되면 원본 Issue 결과를 확인해 본래 기능 업무를 계속한다. 안전 대기·성공·미확정을 수리 실패로 오분류하지 않고, 새 격리 경로의 자연 수리 가능 실패 전체 왕복 관측은 후속 검증으로 두며 독립 업무의 차단 조건으로 삼지 않는다.

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


**접수 유실 방지 — Issue 생성과 라벨은 반드시 한 번의 요청으로:** 기존 `.github/workflows/pc-job.yml`은 `issues.opened`에서 `pc-job` 라벨이 **이미 포함된 경우에만** 운영 A급 Job을 시작한다. 따라서 GitHub `create_issue`를 사용할 때 `title="pc-job"`, `labels=["pc-job"]`, 검증된 본문을 **같은 API 호출에 넣는다**. Issue를 먼저 생성한 뒤 라벨을 나중에 붙이는 방식은 `opened` 실행을 복구하지 못한다. `pc-job` 외의 작업도 각 등록된 정확한 title/label/schema 계약을 따른다. 본 규칙은 새 Runner/Workflow·자동 재실행 요구가 아니다.

**실측 구분(2026-11-12):** 과거 #1213은 `ZGMINI PC Job` Run `42726083946`이 `skipped`, #1217·#1227은 당시 `issues` 이벤트 전체 검색 범위에서 해당 `ZGMINI PC Job` 실행이 확인되지 않았으며 원본 결과 영수증도 없다. 둘 다 Issue 생성 2초 뒤 `pc-job` 라벨 이벤트가 있었다. 단, #1231은 유사한 후속 라벨 기록이 있으면서도 Run `42925346948` 성공이므로 **라벨 이벤트 시각만으로 과거 사건의 단독 원인을 확정하지 않는다**. 결과 없는 원본은 `AUTOMATION_BLOCKED/PC_JOB_INTAKE_NOT_OBSERVED` 또는 `STATE_UNKNOWN`으로 범위를 한정하고 같은 requestId를 재실행하지 않는다. 후속 읽기가 실제 필요하면 **새 고유 A급 요청**을 검증된 동일 요청+라벨 생성 절차로 별도 진행한다.

5. **이번에 생성한 고유 Issue 번호·requestId 하나**만 추적한다. `pc-job`은 댓글이 없어도 해당 Issue의 Actions 실행 상태를 확인하고, `pc-maintenance`는 Actions가 아닌 독립 유지보수기 요청으로서 사용 가능한 기존 원장·결과 증거를 확인한다. 진행 중이면 예상 완료 시점이나 실제 상태 변화에 맞춰 제한적으로 재조회한다. queued/offline은 곧바로 실패가 아니다. #68 전체 댓글·다른 업무 Issue들을 주기적으로 전량 조회하거나 같은 요청을 새로 만들지 않는다.
6. 결과 회수는 댓글을 보조 알림으로 사용하고 **고정 결과 파일의 원격 재조회**를 우선한다. 일반 `pc-job`은 해당 Actions 실행의 `runId`/`attempt`/`seat`를 확인해 `results/<runId>-<attempt>-seat-<seat>.json/.txt`를 조회한다. `pc-maintenance`는 고유 `requestId`에 대응하는 `results/maintenance-<requestId>.json/.txt`와 영속 원장·댓글의 `REPORT_UPLOAD`를 구분해 대조한다. 댓글이 없으면 **`pc-job`에만** 해당 Actions run/jobs/logs를 확인한다. `pc-maintenance`에는 Actions jobs/logs가 없으므로 고정 결과쌍과 승인된 원장 조회 경로를 사용하고, 그 경로가 없으면 전달 상태 미확인으로 기록한다. 원격 전달 여부가 불명확해도 이미 확인된 PC 실행 `PASS`/`FAIL`/`BLOCKED`를 덮어쓰지 않고 **실행 상태와 결과 전달 상태를 분리**해 다음 확인 조건을 남긴다. 댓글 작성만으로 다른 GitHub Workflow나 독립 ChatGPT 대화가 자동 재개된다고 가정하지 않는다.

현재 연결 도구에서 실제 검증한 인수 이름은 create_issue의 `repository_full_name`, fetch_issue_comments의 `repo_full_name`+`issue_number`, fetch_file의 `repository_full_name`+`path`+`ref`다. 도구 schema가 바뀌면 실제 schema가 우선이다. 단순 Actions conclusion만 보지 말고 JSON의 status/code를 확인한다.
7. PASS이면 해당 실제 증거를 인용한다. FAIL/BLOCKED이면 code/lastPass/firstFail/actualExecutionSha를 근거로 영향 범위를 한정한다. 새 증거나 수정 없이 동일 실패를 재요청하지 않는다.

## 허용 작업

- runner-smoke: 자체 CMD→Node 경로 및 읽기 전용 상태.
- writer-install-preimage-readonly: 기존 7필드 요청은 실제 Windows의 고정 시장 캘린더 3파일·고용 R6 19파일 설치 전 존재/SHA-256, 운영 sourceRoot/HEAD/config.source 및 R6 설정 두 키 상태를 원본 변경 없이 조회한다. **승인된 신규 기능**은 동일 operation에서 `preimageManifestPath`·`preimageManifestSha256`만 추가할 수 있다. 고유 Issue가 임의 상대경로 배열을 입력하는 것은 불가하며, GitHub 인증 단계가 당시 `GITHUB_SHA`의 비공개 승인 JSON을 원본 SHA로 고정하고 고정 Writer sourceRoot·최대 32 `.mjs` 경로·M/A만 검증해 PC 작업에 비민감 범위만 전달한다. 기존 7필드 호출은 이 단계를 건너뛴다. 해당 고정 추가 조회 계약은 신규 Controller 소스가 실제 승인 설치된 후에만 사용 가능하며, GitHub 병합만으로 운영 A급 사용 가능하다고 간주하지 않는다. 실제 실행 중 Core source 확인과는 별도다.
- writer-publication-evidence-readonly: ER1 Writer의 최신 월별 로컬 공개 output·전체 원장과 (해당 게시 시 기록된 경우에만) 개별 공개 D1 key의 저장 시각·본문 SHA-256 대조를 비밀정보 없이 조회한다. [#883](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/883) Windows A PASS이나 현재 D1 개별 증거는 `NOT_RECORDED`다. 공유 Writer `run-local.mjs`와 `independent-publication.mjs`를 동일 승인 B로 설치하고 **정상 게시가 발생한 이후**에만 해당 key의 일치를 주장한다. 이 A가 Production D1을 새로 SELECT하거나 과거 불일치를 자동 판정하는 것은 아니다.
- fear-greed-archive-status: 실PC 설치·실행 검증된 Core SQLite 관측·검증 기록 및 실행 경로 읽기 전용 진단.
- core-status: 기존 task XML hash·config의 승인 SHA·checkpoint 상태만 요약. 원자료/키/전체 config는 미출력.
- source-audit: GitHub source SHA·branch HEAD 읽기 전용 대조. 후보 코드를 실행하지 않음.
- theme-common-tests: 설치 시 검증한 불변 source의 고정 공통 테스트. 승인 source 목록은 README 상태를 확인. 일반 request의 임의 SHA를 실행하지 않음.
- isolation-proof/core-conflict-proof/failure-proof/timeout-proof: 독립 fixture 검증. 실제 Core 중지·잠금 삭제·데이터 변경 없음.

요청 후 코드를 임의로 checkout하거나 Runner에 shell 명령을 전달하지 않는다. 목록에 없는 명령은 먼저 독립적인 operation adapter와 테스트/승인 범위를 준비한다.

## 최신 공용 개선 실PC 재사용 증거

- [Controller 정규 B #880](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/880): 승인 manifest 8파일+infra 2파일, 실제 `c6a3d15…` 설치·보호·Workflow PASS.
- [승인 scoped A #882](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/882): 신규 7파일 경로·A/M SHA 조회 PASS, `sourceRoot`·운영 HEAD 확인, 실행 중 Core 출처는 미입증.
- [ER1 Writer A #883](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/883): 최신 로컬 월별 결과·원장 PASS, 현재 개별 D1 원장은 `NOT_RECORDED`. 관련 원본 JSON/TXT·적용 범위는 [성공 실행물 색인](SUCCESS_EVIDENCE_REUSE.md)을 참고하고 신규 기능 완료 Gate로 확대하지 않는다.

## 동시 작업

6개 대화는 서로 다른 requestId/chatId로 요청한다. 각 Runner는 독립 작업공간에 기록하며 같은 requestId는 중복 실행하지 않는다. 같은 source를 다른 대화가 검사해도 PC 운영 checkout을 바꾸지 않는다. 무거운 작업의 자원 대기 또는 공용 운영 변경 승인 대기는 해당 작업만 제한한다.

## 비용과 결과 보관

hosted Runner/Artifact/cache를 사용하지 않는다. 결과는 private 저장소의 작은 TXT/JSON 파일과 해당 요청 Issue의 댓글로 회수한다. 현행 `pc-job` 업로더는 TXT·JSON **두 파일의 원격 GET 동일바이트 확인 후** 성공 댓글을 기록한다. 충돌·업로드 불명확 시 성공 댓글이나 **결과 전달 PASS**를 추정하지 않는다. `pc-job`은 Actions 실행·원격 파일을, `pc-maintenance`는 해당 고정 결과·지원되는 원장을 확인하되, 이미 입증된 실행 상태는 보존하며 계산·설치를 재실행하지 않는다. `pc-maintenance`도 해당 requestId의 원격 결과 검증·영속 원장을 구분한다. GitHub 자체 API·저장 한도와 PC 자원은 존재하므로 무제한·영구무료를 보장하지 않는다.

## Controller 자동 갱신 요청 — 최초 연결 이후에만

기존 A급 `pc-job` 7필드 요청과 별도로, 승인된 Controller 자체 갱신은 [CONTROLLER_AUTO_UPDATE.md](CONTROLLER_AUTO_UPDATE.md)의 `pc-maintenance` Issue와 raw-byte SHA-256으로 고정된 승인 manifest를 사용한다. Runner 내부에서 `tools/update.mjs`를 호출하거나 일반 작업 Issue에 임의 명령을 넣지 않는다. 최초 유지보수기 연결 상태가 검증되지 않았다면 `AUTOMATION_BLOCKED`로 분류하고 사용자에게 매번 CMD 실행을 부탁하지 않는다. 병합·Online만으로 설치 성공을 선언하지 않는다.
