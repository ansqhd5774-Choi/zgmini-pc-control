# ZGMINI 공통 오류 인계 대기열 V1 (후보)

목적: 기존 `pc-job`과 6개 Runner·Controller·B급 승인 경로를 변경하지 않고,
공통 장애 전달·중복 방지·원담당 복귀 상태를 연결한다. 공용 설치 조정 #68과는 별도다.

## 적용 및 현재 한계

- `agent-handoff` label로 생성한 **별도** 비공개 Issue JSON만 인계 후보로 접수한다.
- 별도 Workflow는 `ZGMINI_AGENT_HANDOFF_ENABLED=true` 저장소 변수 설정 전 **비활성**이다.
- 현재 구현된 것은 검증·분류·중복 인식·안전한 상태 표시다. AI 호출/소스 수정/테스트/PR 생성/ChatGPT 대화 깨우기는 **미연결**이다. 사용량 과금이나 Copilot 구독을 자동 활성화하지 않는다.
- V2 반환 연결은 `issue_comment`의 결과 JSON에서 같은 사고 ID·fingerprint, 실제 PR HEAD 및 GitHub Actions Run 성공/HEAD 일치를 조회해 **원래 인계 Issue 안에** `RUNTIME_VERIFICATION_PENDING`을 기록한다. 이는 실제 테스트의 의미·운영 적용 검증을 대체하지 않는다.
- 기존 GitHub Actions `GITHUB_TOKEN`으로 작성한 댓글은 다음 Workflow를 보통 트리거하지 않으므로, 전문 AI가 결과 댓글을 자동 발행하는 자격·실행 경로는 별도 연결이 필요하다. 현재는 owner 작성 이벤트만 수신한다.
- `zgmini-pc-control` Workflow의 기본 `GITHUB_TOKEN`은 다른 저장소의 원본 Issue에 쓰기 권한이 있다고 가정하지 않는다. 원본 업무 참조는 기록하되 다른 ChatGPT 대화가 실제 수신했다고 표기하지 않는다.
- 결과 반환 job은 해당 저장소의 PR 및 Actions 실행 조회에 필요한 `pull-requests: read`, `actions: read` 최소 권한을 가진다. 다른 저장소의 비공개 PR/Run을 이 권한으로 읽을 수 있다고 가정하지 않는다. 현재 result broker는 cross-repo 제안을 `RESULT_CROSS_REPO_AUTH_NOT_CONFIGURED`로 거부한다. 향후 승인된 GitHub App 권한이 준비된 경우에만 확장한다.
- `agentConfigured: true`는 향후 승인된 실제 엔드포인트를 연결할 때만 사용한다. `ASSIGNED`만으로 실제 AI 시작·코드 수정·운영 적용을 주장할 수 없다.
- 실패 검사와 접수는 PC 실행 재시도가 아니다. 기존 `maxAutomaticRetries=0`을 보존한다.
- Workflow는 Node source를 Windows에 실행하므로 기존 승인·설치 경로에 맞는 검증을 거친 후에만 활성화한다. PR 병합만으로 실PC 활성화라고 보고하지 않는다.

## 발행할 JSON 예시

```json
{
  "schema": "ZGMINI_AGENT_HANDOFF_V1",
  "incidentId": "handoff-123456789abc",
  "origin": {
    "repository": "ansqhd5774-Choi/zgmini",
    "issueNumber": 1009,
    "requestId": "pc-123456789abc",
    "chatId": "chat-theme1",
    "branch": "codex/theme-fear-greed-integration-20261025",
    "sourceSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "checkpoint": "COLLECT"
  },
  "failure": {
    "kind": "COMMON_CONTROLLER",
    "code": "RUNNER_IMPORT_STOP",
    "lastPass": "SOURCE_CHECKED",
    "firstFail": "RUNTIME_IMPORT",
    "fileRefs": ["controller/engine.mjs"],
    "evidenceIssueNumber": 908
  }
}
```

실제 issue/requestId·sourceSha를 확인해 사용한다. 자유형 원문 오류·기밀·토큰·URL·E: 절대경로·원자료는 본문에 포함하지 않는다.

## 결과 및 재개 계약

1. `COMMON_CONTROLLER/RUNNER/WRITER`는 공통 프로세스 담당, `FEATURE`는 기능 원담당에 배정한다.
2. 중복 기준은 `origin.repository + issueNumber + requestId + sourceSha + code + firstFail`의 SHA-256이다. 같은 실패는 기존 인계 하나를 참조하고 새 AI/PC 실행을 만들지 않는다.
3. AI 실행기가 없으면 `AWAITING_AGENT_CONFIGURATION`으로 멈추며 원래 기능 담당자는 **독립 가능한 작업**을 계속한다.
4. `ASSIGNED → FIX_PROPOSED → TESTED → APPLIED_VERIFIED → RETURNED → OWNER_RESUMED`는 단계별 증거를 요구한다. 테스트 PASS만으로 운영 변경을 통과시키지 않는다.
5. GitHub Issue 댓글로 `RETURNED`를 기록해도 원래 일반 ChatGPT 대화가 자동 실행되지는 않는다. `OWNER_RESUMED`는 실제 원담당 수신/재개를 확인한 경우에만 기록한다.

로컬 검증: `node --test tests/agent-handoff.test.mjs`.

## 반환 JSON (동일 `agent-handoff` Issue의 새 댓글)

```json
{"schema":"ZGMINI_AGENT_HANDOFF_RESULT_V1","resultId":"result-123456789abc","incidentId":"handoff-123456789abc","fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","pullRequest":{"repository":"ansqhd5774-Choi/zgmini-pc-control","number":920,"headSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},"testRun":{"repository":"ansqhd5774-Choi/zgmini-pc-control","runId":42450377234,"headSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}
```

위 값은 형식 예시이며 실제 PR·CI 원장과 fingerprint가 정확히 일치해야 한다. `RUNTIME_VERIFICATION_PENDING`은 의도된 안전 대기 상태다. 적용된 PC 버전·백업·원자료·게시 결과를 읽기 전용으로 확인하지 않으면 `APPLIED_VERIFIED` 및 `OWNER_RESUMED`로 진행하지 않는다.

반환 테스트: `node --test tests/agent-handoff-result.test.mjs`.
