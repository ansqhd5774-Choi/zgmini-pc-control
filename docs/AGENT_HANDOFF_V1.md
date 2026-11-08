# ZGMINI 공통 오류 인계 대기열 V1 (후보)

목적: 기존 `pc-job`과 6개 Runner·Controller·B급 승인 경로를 변경하지 않고,
공통 장애 전달·중복 방지·원담당 복귀 상태를 연결한다. 공용 설치 조정 #68과는 별도다.

## 적용 및 현재 한계

- `agent-handoff` label로 생성한 **별도** 비공개 Issue JSON만 인계 후보로 접수한다.
- 별도 Workflow는 `ZGMINI_AGENT_HANDOFF_ENABLED=true` 저장소 변수 설정 전 **비활성**이다.
- 현재 구현된 것은 검증·분류·중복 인식·안전한 상태 표시다. AI 호출/소스 수정/테스트/PR 생성/ChatGPT 대화 깨우기는 **미연결**이다. 사용량 과금이나 Copilot 구독을 자동 활성화하지 않는다.
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
