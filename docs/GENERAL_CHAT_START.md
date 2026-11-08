# 새 일반챗의 자동 작업 시작

2026-11-06 개정: 현재 업무의 마지막 유효 완료 지점부터 다음 실행으로 진행한다. 지침 확인만 보고하고 멈추지 않는다. 기존 증거 재사용과 이번 신규 성과를 구분한다.

**원담당 재개 원칙:** 이 지침을 실제로 받은 일반챗은 자신이 담당하던 구현·수집·계산·게시·검증을 기존 승인 범위에서 재개한다. 공용 총괄의 #434 자연 B 실증 대기나 다른 대화의 수신 미확인을 자기 업무의 선행 조건으로 삼지 않는다. 업무에 필요한 정상 승인 B급 작업은 정규 절차로 계속하고, #434만을 검증할 시험용 B는 생성하지 않는다. GitHub Issue·댓글의 인계 기록은 다른 일반챗을 깨우는 알림이 아니므로, 원담당 대화에서 실제 수신 사실과 다음 실행·결과를 구분해 기록한다. 수신 ACK 댓글을 새로운 Gate로 추가하지 않는다. 총괄은 원담당 기능 업무를 대신하지 않는다.

사용자가 작업 전에 전달할 짧은 지침은 [GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md)다. 현재 상태와 접수 문제는 [AUTOMATION_STATUS_AND_ADMISSION.md](AUTOMATION_STATUS_AND_ADMISSION.md)로 분류한다. 요약을 읽은 것만으로 최신 정본·실제 상태 확인을 대체하지 않는다.

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
