# ZGMINI 공통 오류 인계 SQLite 대기열 — 개조 후보

## 현재 단계: SOURCE_ONLY / NOT_CONNECTED / NOT_INSTALLED

`third_party/sqliteq-reference/`의 MIT 원본을 보존하며, 원본의 SQLite 원자적
선점(`UPDATE ... RETURNING`) 및 수령 세대의 소유권 검증을 기존
`agent-handoff/` 인계 계약 전용으로 개조한다.

- 구현: `agent-handoff/sqlite-queue.mjs`
- GitHub 댓글 읽기 재검증 연결: `agent-handoff/queue-bridge.mjs`
- 기존 Issue broker: `main(env, {queue})`로 **명시적으로 주입된 경우만**
  연결한다. 기존 워크플로의 `main()` 호출은 그대로 GitHub-only 경로다.
- 테스트: `tests/agent-handoff-sqlite-queue.test.mjs`,
  `tests/agent-handoff-queue-bridge.test.mjs`
- 저장하는 값: `parseHandoff`의 정제된 메타데이터, fingerprint, 소유권,
  GitHub 결과 댓글 읽기 재검증을 표시하는 최소 증거만
- 외부 의존성: 없음. SQLite 연결을 호출자가 주입한다. 검증된 Node 24의
  `node:sqlite` `DatabaseSync`로 단위 테스트한다. 실제 PC Node 버전은 미확인.
- 호출: 별도의 승인된 호출자가 `initializeHandoffQueueSchema(db)`를 명시적으로
  실행한 후 `createHandoffQueue(db)`를 사용해야 한다. 모듈 import에는 쓰기 없음.

## 정책과 완료 판정

1. `enqueue`는 사고 ID와 기존 `fingerprintHandoff` 기준으로 중복을 차단한다.
   지문은 같지만 JSON 내용이 다른 경우 덮어쓰지 않고 중단한다.
2. `claim`은 한 건의 **메타데이터 전달 처리권**만 원자적으로 선점한다.
   ChatGPT 대화의 실제 수신이나 작업 시작을 의미하지 않는다.
3. `queue-bridge`는 기존 GitHub Issue의 댓글 목록을 실제 재조회하고
   bot 작성자·`commentId`·fingerprint·사고 ID를 검증한다. POST 응답 유실도
   읽기 재검증으로 판정한다. 성공 시 `markRouted`는 `ROUTED_PENDING_AGENT`
   상태만 기록한다. 승인된 운영 DB 연결과 워크플로 활성화는 미구현이다.
4. lease 만료는 `STATE_UNKNOWN`으로 분류하며 자동 재선점하지 않는다.
   `automaticPcRetries=0`; 승인 없는 PC 실행·B 설치·원자료 접근은 없다.
5. `RETURNED`, `OWNER_RESUMED`, `APPLIED_VERIFIED`는 기존 증거 기반 계약의
   별도 단계이며 이 SQLite 모듈이 자동 표시하지 않는다.

## 운영 분리

- 기존 `controller/`, `tools/update.mjs`, `writer-b/installer.mjs`, 6 Runner,
  Workflow, `config/operations.json`, Windows DB 경로 및 #68 원장은 변경하지 않는다.
- SQLite 메모리·임시 파일의 격리된 테스트만 실행한다. 운영 E: 스키마 설치는
  승인·manifest·Windows Runtime 실증을 거친 별도 후속 단계다.
- 현행 `docs/AGENT_HANDOFF_V1.md`의 기능 플래그와 미연결 상태를 보존한다.
  원담당 대화 자동 재개에는 별도 실제 대화 실행/수신 연결이 필요하다.

## 검증

`node --test tests/agent-handoff-queue-bridge.test.mjs tests/agent-handoff-sqlite-queue.test.mjs tests/agent-handoff.test.mjs tests/agent-handoff-result.test.mjs`

최소 검사: 저장/중복, 다른 source SHA, 별도 SQLite 연결 간 단일 선점,
lease 만료/지연 완료 거부, 댓글 읽기 증거 요구, 기밀 필드 거부,
PC 자동 재시도 0회, 정상 상태와 불명확 상태 분리.
