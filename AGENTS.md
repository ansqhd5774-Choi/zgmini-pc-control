# ZGMINI PC 자동 실행 공통 기준

- 공통 정본: `docs/PC_AUTOMATION_STANDARD.md`. 현재 설치 관측과 실제 성공 근거: `docs/CONTROLLER_AUTO_UPDATE_STATUS.json`, `docs/PC_AUTOMATION_RUNTIME_20261103.json`. 새 일반챗은 과거 미완료 보고로 돌아가지 말고 해당 증거와 현재 상태를 구분한다.

- 한국어로 보고한다. 이 저장소는 비공개 PC 제어 전용이다. 공개 `zgmini`의 개발 source, PC 승인 source, controller source를 구분한다.
- 새 일반챗은 먼저 README.md와 docs/GENERAL_CHAT_START.md를 읽고 해당 작업을 자동 요청한다. 사용자가 매번 CMD를 실행하고 파일을 전달하도록 되돌리지 않는다.
- 기본 요청은 `pc-job` label의 새 Issue JSON이다. 현재 GitHub 연결 도구에 workflow_dispatch가 없어도 이 경로를 쓴다. 임의 CMD 문자열은 받지 않는다.
- 6개 Runner는 checkout/작업폴더/TEMP/캐시/출력/요청 원장을 분리한다. 테마별 명령이나 개별 운영 예약을 추가하지 않는다. 운영 데이터 공유 쓰기를 병렬 실행하지 않는다.
- A급 고정 허용목록만 자동 실행한다. 원격 source의 임의 스크립트는 실행하지 않는다. 테스트는 설치 시 검증된 source SHA의 고정 suite에만 적용한다. 요청 SHA와 실제 테스트 SHA를 섞지 않는다.
- B급 운영 변경·새 executable 승인/설치·DB/D1/게시/배포/삭제는 별도 승인 계약이 필요하다. C급 관리자·보안·시스템 설정은 사용자 직접 수행한다.
- Core/Korea/Iran의 task, 운영 source, 기존 lock/SQLite/공급처 호출 한도는 변경하지 않는다. controller lease가 Core lock을 대체하지 않는다. 일반 pc-job의 B급 운영 쓰기는 비활성이다. 별도의 승인 manifest를 사용하는 독립 유지보수기의 Controller 갱신은 실PC 검증됐으며, 기존 승인 범위에서 재사용한다.
- 6개 일반챗의 독립 A급 작업을 수신하되 무거운 작업은 메모리·전용 lease를 확인해 기다린다. 이 대기를 수집 장애로 보고하지 않는다.
- 같은 작업 요청의 자동 재실행은 0회다. 중복 requestId는 기존 결과를 재사용하고 내용 변경을 거부한다. timeout/불확실한 결과를 무조건 재실행하지 않는다. 상태 조회·멱등 업로드 회수·승인된 watchdog 프로세스 복구는 작업 재실행과 구분하고 각 계약을 따른다.
- 무료 운영: 모든 job은 자체 Runner만 사용한다. 유료 hosted runner/서버/Artifact/cache를 켜지 않는다. 결과는 용량 제한된 private TXT/JSON과 Issue 댓글로 회수한다. API/저장소 자체 제한까지 무제한이라 주장하지 않는다.
- token/키/원자료/전체 config/환경변수/개인정보를 로그·결과·commit에 넣지 않는다. runner 등록 token은 메모리에서만 전달하고 공식 runner의 credential 파일을 열거나 업로드하지 않는다.
- 구현/모의 검사/등록/Online/실제 Actions 실행/결과 회수/자연 재연결을 별개로 검증한다. AUTOMATION_BLOCKED와 RUNTIME_FAILED를 구분한다.
- 기존 프로젝트 지침: 공개 zgmini main AGENTS.md와 PC_CORE_5MIN_CONFLICT_RUNBOOK.md, PC_WRITER_R2.md, PC_STORAGE_E_DRIVE.md를 함께 따른다. 테마 정본은 기존 `codex/theme-fear-greed-integration-20261025`의 THEME_PLATFORM_STANDARD.md다.
