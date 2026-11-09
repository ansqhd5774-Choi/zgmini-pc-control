# ZGMINI 단일 ChatGPT 총괄 — 공통 장애 대기열 실행 계약

상태(2026-11-09 KST): PC Job 자동 접수 소스 main 병합·기존 opt-in 사용자 확인; Writer B 자동 접수 소스 main 병합·중앙 ChatGPT 유형별 검증 프롬프트 저장/재조회 완료.
Writer B 전용 opt-in은 사용자 `true` 저장 확인 및 실제 정상·건너뜀 분기 실증 완료. 자연 장애→중앙 수정→원래 Issue 결과 기록의 E2E는 미검증. PR/CI/예약 조회를 PC Runtime·운영 적용 성공으로 간주하지 않는다.

## 사용자 최종 역할 지시

- 개별 일반 ChatGPT 1번/5번을 원담당·전문담당으로 지정하지 않는다.
- 하나의 총괄 ChatGPT가 공통 장애 접수, 확인, 코드 수정, 회귀 시험, 결과 검증,
  인계 기록을 직접 책임진다. 필요할 때만 그 **같은 작업 실행 내부**의
  서브에이전트를 활용한다. 사용자에게 다른 대화의 초기 task 설정이나 전달을 요구하지 않는다.
- 다른 기능 담당자가 존재한다는 과거 `origin.chatId`는 **원본 사고 식별 메타데이터**다.
  물리적인 ChatGPT 대화 ID·운영 책임자·수신함을 뜻하지 않는다.

## 최소 연결 구조

1. 기존 `agent-handoff` Issue의 JSON 계약과 `HANDOFF_ROUTED` 댓글,
   `handoff-agent-pending` 라벨을 공통 접수 원장으로 재사용한다.
2. 단일 총괄 ChatGPT의 자동 실행은 해당 저장소에서 `agent-handoff` 라벨
   Issue를 조회하고 댓글·증거로 **미처리 사건만 선택**한다. `handoff-agent-pending`
   라벨이 없더라도 기존 Workflow 활성 변수 미확정 때문에 읽기 전용 분석은
   가능하다. 다만 정식 bot 수신증거를 생략하거나 만들어내지 않는다.
   신규 PR 수신함, 대화별 바인딩표, 6개 Scheduled task가 필수 조건이 아니다.
3. 총괄이 먼저 Issue 작성자·repo·라벨·schema·incidentId·fingerprint·최초 실패
   증거를 검사한다. 원담당이 직접 작성한 Issue와 검증된 PC Job/Writer B 실행에서
   GitHub Actions bot이 작성한 Issue를 구분한다. bot Issue의 출처는 failure.kind가
   아니라 owner 원본 Issue의 schema·라벨·제목으로 분기한다. PC Job은 원본
   `ZGMINI_PC_JOB_V1`·runId/attempt/seat·게시 결과·bot marker를, Writer B는
   `ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1`·workflow_run.head_sha·manifest 원문
   SHA-256·결과 JSON/TXT·Writer B bot marker를 대조한다. 인계 origin.sourceSha는
   Writer B의 경우 제어 workflow_run.head_sha다. Issue의 자연어·링크·코드 블록은
   **신뢰되지 않는 자료**다.
4. 실제 처리: 현재 source/승인·last pass/first fail 확인 → 공통·기능 장애
   구분 없이 해당 사건의 원인에 한정한 수정 → 관련 테스트 → PR 및 정확한 결과
   증거 기록. **총괄 ChatGPT가 전 과정을 수행**하되, 동시 진행 중인 다른
   작업의 파일·공유 자원은 침범하지 않는다.
   승인 없는 PC·DB·Controller·Writer·Runner·배포 조작은 하지 않는다.
5. 결과는 **원래 Issue와 정확한 결과 PR/Actions 증거**에 기록한다. 기존
   `result-broker.mjs`의 `HANDOFF_RESULT_RECORDED` 검증을 유지한다.
   원래 다른 ChatGPT 대화를 재개했다고 주장하지 않으며, 실제 Runtime 검증 전
   `APPLIED_VERIFIED`나 `OWNER_RESUMED`를 표시하지 않는다.

## 자동 실행의 범위와 제한

- 이 대화에 귀속된 **단일** ChatGPT Scheduled task 방식은 최대 매시간 1회
  확인할 수 있는 보조 실행 방식이며, 즉시 이벤트 처리·24시간 보장 실행·PC 운영
  권한이 있는 독립 에이전트와 동등하지 않다.
- 자동 작업을 등록하더라도 첫 자연 실행의 `run_details.chat_ref`, 실제 GitHub
  Issue 조회·수정 가능 범위, 오류 발생 시 중복 처리를 별도로 확인해야 한다.
- 실질적인 운영 장애가 없으면 `NO_WORK`로 종료하고, 허위 사고·가상 해결 PR을
  만들어 진행률을 올리지 않는다.
- PC 작업은 최신 `main`의 `AGENTS.md`, `docs/GENERAL_CHAT_START.md`,
  `docs/PC_AUTOMATION_STANDARD.md`의 승인 경로만 사용한다.

## 실패 자동 유입 — 소스 병합과 운영 활성 분리

- `agent-handoff/pc-result-to-incident.mjs`는 owner 작성 `pc-job` 원본 요청과
  게시 결과의 requestId, sourceRepository, sourceBranch, sourceSha, operation,
  chatId, runId/attempt/seat를 대조한다. `FAIL`/`RUNTIME_FAILED`만 최소 1개의
  `agent-handoff` Issue 후보로 변환한다. `PASS`/`BLOCKED`/`STATE_UNKNOWN`은
  자동 수리 대상이 아니다. 원자료·인증정보·전체 오류 텍스트는 Issue에 넣지 않는다.
- `agent-handoff/pc-failure-producer.mjs`는 기존 `ZGMINI PC Job`의 완료 이벤트 뒤
  원격 게시 JSON과 원본 bot 결과 댓글을 읽고, 완전한 500개 이하 Issue 목록으로
  중복 확인 후 정확한 bot Issue 한 건을 등록·재조회한다. POST의 결과가 불명확하면
  원장 재조회 1회만 수행하며 PC 작업을 재시도하지 않는다. 서로 다른 실행에서
  같은 사건이 생겨도 쓰기 lane을 단일화한다.
- `.github/workflows/agent-handoff-pc-failure-intake.yml`은 별개 GitHub
  `workflow_run` 진입점이며, **`ZGMINI_PC_HANDOFF_INTAKE_ENABLED == 'true'`가
  없으면 실행하지 않는다.** 해당 변수는 2026-11-09 사용자 등록/재조회로 `true`
  확인됐다. PC Job intake의 큐 유실 방지 `queue: max`는 PR #969에 반영됐다.
  이는 실패 장애의 실제 등록·중앙 해결 성공 증거는 아니다.
- Writer B는 `agent-handoff/writer-b-result-to-incident.mjs`의 증거 adapter
  (PR #971)와 `agent-handoff/writer-b-failure-producer.mjs`,
  `.github/workflows/agent-handoff-writer-b-failure-intake.yml`(PR #972)을
  main에 병합했다. Writer B 전용 변수
  `ZGMINI_PC_HANDOFF_WRITER_B_INTAKE_ENABLED == 'true'`만 producer를 활성화한다.
  이 변수는 2026-11-09 사용자 `true` 저장을 확인했다. 실제 Writer B 원본 Run `42569264941` → 장애 접수 Run `42569394131`은 `NOT_ELIGIBLE`/`WRITER_B_INSTALLED_VERIFIED`, verifiedResults 1건·신규 장애 Issue 0건이었다. 건너뛴 원본 Run `42569494307`의 접수 Run `42569500468`도 `SKIPPED`였다(건너뜀 가드 PR #981 병합 후). 원본 owner 요청·workflow_run·bot
  receipt·고정 manifest SHA-256·결과 JSON/TXT 2/2를 확인한 실패만 접수한다.
  `WRITER_B_SETUP_STOP`, `WRITER_B_STATE_UNKNOWN`, 성공은 자동 수리 제외,
  `WRITER_B_RECOVERY_REQUIRED`는 읽기 전용이다. 자동 PC 재실행 0건.
- **GitHub 공식 제약:** `GITHUB_TOKEN`이 생성한 Issue의 `issues.opened`는
  다른 GitHub Workflow를 연쇄 실행하지 않는다. 따라서 새 bot Issue가 기존
  `issue-broker.mjs`를 자동 기동한다고 주장할 수 없으며, 현재 설계의 실제
  소비자는 `agent-handoff` 라벨을 직접 읽는 단일 중앙 ChatGPT 예약 작업이다.
  중앙 예약 프롬프트에는 2026-11-09 PC Job/Writer B 각각의 원본 증거 검증을
  반영해 저장·재조회했다. 새 bot Issue로 다른 ChatGPT 대화가 자동 재개되지는 않는다.
- 결과 파일 자체가 올라오지 않았거나 bot 수신 댓글이 없다면 최초 실패
  사실이 불명확하므로 자동 생성하지 않는다. 이 부재 경로는 추가 수신 복구가
  필요하며 결과가 전무하면 `NO_PUBLISHED_RESULTS`, 확정 실패의 댓글만
  빠졌으면 `PARTIAL_RECEIPT_PENDING`으로 명시하고 해당 intake 실행을 실패
  처리한다. **실패 전수 자동 접수 성공**이라고 말하지 않는다.

## 실행 계획 정본 — 단일 총괄 기준 (2026-11-09 KST)

**최종 목표:** 승인된 공통 장애를 기존 GitHub `agent-handoff` Issue로 접수하고, **하나의 중앙 ChatGPT**가 증거 검증 → 원인에 한정한 수정 → 관련 회귀·PR/CI → 원본 GitHub Issue의 검증된 결과 기록까지 직접 수행한다. PC 운영 반영이 필요한 경우에만 별도 승인·실제 Runtime 검증을 수행한다. **다른 일반 ChatGPT 대화를 자동 기동·재개시키는 것이 현재 완료 조건이 아니다.**

**계획 정본과 브랜치 규칙**
- 이 문서의 최신 `main`이 단일 계획 정본이다. 진행 중인 변경은 최신 `main` 기반 전용 브랜치와 PR에 기록하고, 병합·읽기 재조회 후 정본을 갱신한다. 기능 담당 브랜치와 공유 설치 자원은 침범하지 않는다.
- 기존 `codex/controller-ops-lessons-20261105`는 확인 시점 `main`보다 1,214커밋 뒤처진 분기이며, 그 안의 2026-11-07 계획·`WORK_HANDOFF.md`는 **현재 중앙 인계 목표의 정본이 아니다**. 이 구형 브랜치를 통째로 병합하거나 옛 진행률을 새 완료 근거로 재사용하지 않는다.
- 구 다중 대화 방식 PR #932·#933·#934와 MCP 이벤트 실험 Draft PR #1038은 **연구/소스 초안(DEFERRED)**이다. 각각의 병합·배포나 원담당 채팅 최초 1회 Tasks 설정을 본 기능의 Gate로 넣지 않는다. #944·#945는 이미 closed/unmerged 상태다.

**8개 세부 마일스톤 / 범위별 증거**

| 단계 | 완료 조건 | 2026-11-09 현재 판정 |
| --- | --- | --- |
| 1 | 기존 Issue JSON·fingerprint·중복 방지 계약 확립 | **완료(SOURCE)** — `agent-handoff` 계약·라우팅 코드 존재 |
| 2 | PC Job 장애 intake 소스 main 병합, opt-in 설정 확인 | **완료(SETUP)** — 승인 변수 `true`; 실제 자연 실패 유입은 7단계 검증 |
| 3 | Writer B intake 소스 main 병합, opt-in·정상/건너뜀 분기 확인 | **완료(SETUP)** — 변수 `true`, Run `42569394131` 정상 및 `42569500468` 건너뜀; 실제 실패 유입은 미검증 |
| 4 | 단일 중앙 ChatGPT 예약 작업 등록 및 실제 대기열 조회 | **완료(SCHEDULER)** — `Automation_9a403a04a8ac8191a331e94f9abeb1b4`, 첫 자연 실행 `NO_WORK` |
| 5 | 기존 GitHub Issue 라우팅·검증 증거 보존 | **완료(ROUTING 한정)** — #1041에 bot `HANDOFF_ROUTED` 기록; **수동 생성 사건**이므로 자연 자동 intake 증거는 아님 |
| 6 | 원본 GitHub Issue 결과 반환 계약과 broker 소스 확보 | **완료(SOURCE)** — 기존 result broker; 실제 자연 사건의 결과 반환은 8단계 미검증 |
| 7 | 승인된 PC Job/Writer B의 **자연 발생 유효 실패** → 증거 대조 → 단일 Incident Issue 자동 등록·중복 방지·재조회 | **미완료(RUNTIME E2E)** — 인위적 실패를 만들지 않음 |
| 8 | 중앙 ChatGPT가 실제 사건을 선택하여 원인 수정·회귀·정확한 PR/CI·원본 Issue 결과 기록까지 수행하고 필요한 운영 적용을 별도 판정 | **미완료(AGENT E2E)** — `NO_WORK`/PR/CI만으로 완료 판정 금지 |

- **계획·구성 세부 마일스톤: 6/8 = 75%.** 이는 source·설정·라우팅 단계의 누적 수치이며 **실제 자연 장애 E2E는 0/1 = 0% 검증**이다. 문서 수정이나 단순 예약 실행으로 7·8단계 진행률을 올리지 않는다. 전체 운영 기능 완료라고 표현하지 않는다.
- **ChatGPT 구조 제약:** 중앙 ChatGPT가 다른 일반 ChatGPT의 대화 ID를 지정해 그 대화에 Tasks를 설치하거나 대화를 깨우는 지원 경로는 확인되지 않았다. `origin.chatId`는 원 사고 추적용이며 실제 `chat_ref`와 별개다. 다른 일반챗마다 최초 1회 Tasks 연결, PR 알림 브리지, Work 전용 MCP Events는 현재 **비채택·완료조건 제외**한다. 이 제약을 회피했다고 주장하지 않는다.
- **#1041 중앙 판정 완료(2026-11-09 KST):** #1041은 사람이 작성한 #1030 읽기 전용 Writer insertion **프리뷰 안전 중단** 인계로, 자연 PC Job/정규 Writer B 설치 장애 자동 접수 실증이 아니다. 원본 상태 `BLOCKED / WRITER_B_INSERT_ANCHOR_MATCH_STOP`, 결과 JSON/TXT 2/2, PC source·Task·DB·D1·Provider 쓰기/호출 0. #792의 승인된 단일 Core 훅 after SHA-256과 #1012의 실제 Windows A 조회 파일 SHA-256이 `2e6200e5637fb99f339fdc74a64592f34c1272423a39366b8559c16ea1b13b5d`로 일치한다. **#1012는 특정 checkout 파일/bridge 존재 증거일 뿐 현재 실행 중 Core launcher 연결·gate 활성 증거는 아니다**. #1022 HEAD/config 조회를 파일 SHA 직접 증거로 오인하지 않는다. 최신 owner 댓글의 R2 이중 hook 중복 위험에 따라 신규 설치·재시도는 보류한다. 중앙 총괄이 #1041에 `CENTRAL_TRIAGE_RECORDED` 댓글 [#1041 comment 6739037534](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1041#issuecomment-6739037534)를 남기고 읽기 재조회했으며, 완료된 판정의 무한 재처리 방지를 위해 `handoff-agent-pending`만 제거했다. `agent-handoff` 라벨과 Issue(open), 원본 #1030, 기존 원장은 보존. 무수정 판정을 result-broker의 `HANDOFF_RESULT_RECORDED`/운영 해결로 승격하지 않는다. 현행 broker의 자동 원본 반환 대상은 인증된 pc-job/Writer B **소스 설치** Issue로, #1030 프리뷰는 해당 계약과 다르다.

**중앙 예약 지시문 정합성(2026-11-09 KST):** 기존 단일 task `Automation_9a403a04a8ac8191a331e94f9abeb1b4`의 저장된 prompt를 이 계획의 단계 7(자연 유효 장애 자동 접수), 8(중앙 해결→원본 Issue 반환)에 맞춰 업데이트·재조회했다. 구형 '7번 = 다른 일반 ChatGPT 자동 재개' 문구는 제거했고, #1041을 비대상/DEFERRED로 분류하도록 명시했다. task ID·기존 일정·활성 상태는 유지하며 추가 대화별 task 0건. 이전 실제 예약 Run `4f285e2a-b46c-8327-b2ff-351ffecadebd`는 #1041 1건을 조회·자동 수정 제외한 것으로 확인됐다. **프롬프트 수정 후 자연 예약 실행 결과는 아직 미검증**이며, 이것을 7·8단계 실증으로 세지 않는다.

**다음 필수 실행과 인수 조건**

1. **7→8단계 실제 기능:** 기존 중앙 예약을 유지하면서 다음 자연 발생 *유효* PC Job/Writer B 실패 1건의 owner 요청·bot receipt·workflow run·원문 SHA·결과 JSON/TXT를 교차 검증한다. 정확한 중복 억제 Issue 등록을 확인하고, 중앙 총괄이 허용 범위의 최소 수정·관련 테스트·PR/CI와 인증된 원본 Issue receipt를 처리한다. 원본 결과는 다른 일반 ChatGPT 대화의 자동 재개가 아니다. 합성 장애·중복 PC 재실행·별도 원담당 Tasks·예약 자연 갱신 검증을 선행하지 않는다.
2. **이미 판정된 #1041:** 새로운 실제 근거가 없으면 중복 훅 설치·불필요한 Writer 진단 코드 개조·추가 수동 반환을 반복하지 않는다. 원담당 물가지표 기능은 독립적으로 기존 Core launcher/gate를 승인된 경로로 확인하고 수집·게시를 진행한다. 총괄은 그 소유 영역을 변경하지 않는다.
3. **보고 계약:** 준비·구현 6/8(75%)와 자연 장애 전체 처리 0/1(미검증)을 구분하고, 사건별 LAST PASS/FIRST FAIL·PR/CI·실제 Runtime 적용 여부·원본 Issue readback을 별도 기록한다. 새로운 실증이 있을 때만 해당 단계 진행률을 높인다.

## 수정된 증거와 남은 필수 단계

- 잘못 만든 1번·5번 수신함 PR #945·#944는 2026-11-09 KST에 **closed/unmerged**.
- 기존 소스 PR #932→#933→#934는 미병합 Draft이며, 이전 다중 대화용 선택적
  바인딩 기능은 자동 운영 활성화하지 않는다.
- 위 세 Draft PR은 운영 유입의 필수 전제가 아니다. 단일 중앙 intake 소스는
  기존 `main`의 `agent-handoff/contract.mjs` 계약을 재사용했고, PC Job 경합
  수정 PR #969, Writer B adapter PR #971, Writer B producer/Workflow PR #972가
  순서대로 main 병합됐다. 관련 Node 회귀 134/134 PASS는 SOURCE 범위의 증거다.
  기존 미병합 Draft와 인계 기록은 보존한다.
- 기존 Issue 검색에서 `label:handoff-agent-pending` 0건, `label:agent-handoff`
  0건을 관측했다. 이는 검색 시점의 대기열 현황이고 상시 비어 있음을 의미하지 않는다.
- **2026-11-09 KST 실제 등록:** 단일 task `ZGMINI 공통 인계 중앙 처리`,
  ID `Automation_9a403a04a8ac8191a331e94f9abeb1b4`,
  `is_enabled=true`, 매시간 조건 확인. 신규 대화별 task 0건.
  등록 직후의 `conversation_id`는 `6af0833b-a34c-83ec-99a3-1acde1007171`였으나,
  실제 실행 후 자동화 레코드의 `conversation_id`와 `run_details.chat_ref`는
  모두 **`6af09dfa-38a0-83ee-ad03-8a27bc3460f3`**로 관측되었다.
  서로 다른 ID를 동일 채팅이라고 간주하지 않는다.
- 최초 등록 후 검색 Gate를 `agent-handoff` 라벨 단독으로 줄였다. 기존
  `handoff-agent-pending` 라벨/Workflow opt-in이 없더라도 유효 사건의 읽기 전용
  진단은 가능하며, 없던 `HANDOFF_ROUTED` 봇 증거를 위조하지 않는다.
- **첫 실제 예약 실행 PASS(대기열 조회에 한정):** 실행 ID
  `d43c770c-6fa8-832f-a4f5-4e006664d76c`, scheduled
  `2026-11-08T16:06:35Z`, started `16:05:57.590984Z`,
  completed `16:06:17.675456Z`, recorded_status=`completed`.
  결과 `NO_WORK`, 미처리 인계 Issue **0건**, GitHub/PC 쓰기 **0건**.
  이는 실제 장애 원인 수정·코드/PC Runtime/결과 반환 성공 증거가 아니다.
- 중앙 예약 작업 `Automation_9a403a04a8ac8191a331e94f9abeb1b4`는 기존
  매시간 일정과 활성 상태를 보존한 채 2026-11-09 Writer B 출처·실패 상태
  검증을 추가하고 재조회했다. 최신 관측 접수 `agent-handoff`는 0건이므로
  실제 처리 성공으로 평가하지 않는다.
- Writer B 변수 등록과 정상 경로 실증은 완료됐다. 다음 필수 단계는
  실제 자연 발생한 유효 실패 1건의 인계 Issue 생성·원장 중복 방지·중앙 처리·
  원래 Issue 결과 기록을 증거로 검증한다. 검증만을 위한 인위적 PC 실패,
  Writer B 재실행·재설치·복구 변경은 하지 않는다. 이전 다중 대화 Draft의
  `queue=null`/별도 Windows DB 미연결은 본 단일 중앙 intake의 완료 Gate가 아니다.
