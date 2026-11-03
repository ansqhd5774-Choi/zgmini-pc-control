# ZGMINI PC 자동 실행 공통 기준

- 승인 범위의 manifest·해시·누적 diff·실행 명세·검증 자료는 현재 담당자가 완성하고 다음 지원 행동까지 수행한다. 미작성 자료·브랜치 분기·과거 대기 보고만으로 중단하지 않는다. 공용 담당 미지정·실제 경합 없음이면 원장에 등록해 조정을 맡고, 기존 담당 변경은 명시적으로 인계한다. 실제 접근 거부·활성 경합·범위 밖 결정·검증 실패의 영향 단계만 중단하며 안전 검사는 우회하지 않는다.

- 공통 실패 보완: `docs/COMMON_FAILURE_HARDENING_20261103.md`. 실패 중복 조회를 PASS로 바꾸지 않고, 종료 불명확은 STATE_UNKNOWN으로 격리한다. Controller와 유지보수기 정상 상태를 구분하며 부분 전환 복구는 정확한 승인/백업 계약으로 수행한다.

- 공통 정본: `docs/PC_AUTOMATION_STANDARD.md`. 현재 설치 관측과 실제 성공 근거: `docs/CONTROLLER_AUTO_UPDATE_STATUS.json`, `docs/PC_AUTOMATION_RUNTIME_20261103.json`. 새 일반챗은 과거 미완료 보고로 돌아가지 말고 해당 증거와 현재 상태를 구분한다.
- 공유 설치 복구: `docs/CONTROLLER_RECOVERY.md`. RECOVERY_REQUIRED는 단일 복구 담당이 상태 판정→검증된 복구→결과 회수→재개까지 처리한다. 설치 전 취소·부분 적용 rollback·통신 불명확을 구분하고 실제 지원 도구와 원본 요청을 사용한다.
- 작업 전 요약: `docs/GENERAL_CHAT_PREWORK.md`. 상태/접수 판정: `docs/AUTOMATION_STATUS_AND_ADMISSION.md`. 과거 실패를 현재 활성 잠금으로 오인하거나 외부 도구 안전 거부를 PC 장애로 확대하지 않는다. 거부된 행동을 다른 도구로 우회하지 않는다.
- 실행 범위·증거 재사용·BLOCKER 판단은 공통 정본 2절을 따른다. 다른 담당자의 유효한 실PC 결과를 원본 링크와 적용 범위로 재사용하고, 현재 실행에 무관한 전체 경로 진단을 새 선행 조건으로 만들지 않는다. 잘못된 조건은 원래 대기열에서 정정한다.
- 공용 적용 조정: `docs/CONTROLLER_APPLY_QUEUE.md`. 기능 개발은 병렬로 유지하되 Controller·유지보수기 적용은 단일 조정 원장과 적용 담당 한 명으로 순서를 정한다. 승인된 누적 변경을 정확한 manifest로 묶거나 순차 적용하고, 서로 다른 담당자를 무기한 기다리지 않는다. 기존 PC lease·승인 검사는 그대로 유지한다.

- 한국어로 보고한다. 이 저장소는 비공개 PC 제어 전용이다. 공개 `zgmini`의 개발 source, PC 승인 source, controller source를 구분한다.
- 새 일반챗은 먼저 README.md와 docs/GENERAL_CHAT_START.md를 읽고 해당 작업을 자동 요청한다. 사용자가 매번 CMD를 실행하고 파일을 전달하도록 되돌리지 않는다.
- 기본 요청은 `pc-job` label의 새 Issue JSON이다. 현재 GitHub 연결 도구에 workflow_dispatch가 없어도 이 경로를 쓴다. 임의 CMD 문자열은 받지 않는다.
- 6개 Runner는 checkout/작업폴더/TEMP/캐시/출력/요청 원장을 분리한다. 공통 실행기로 처리 가능한 일을 기능별 임시 명령·예약으로 중복 구현하지 않는다. 업무상 필요한 예약 변경은 해당 업무 승인 범위를 따른다. 운영 데이터 공유 쓰기를 병렬 실행하지 않는다.
- 일반 pc-job은 설치된 A급 고정 허용목록으로 실행한다. 승인된 B급 갱신은 별도 유지보수 경로를 사용한다. 원격 source의 임의 스크립트는 실행하지 않는다. PC 고정 테스트 adapter는 설치 시 검증된 source SHA의 suite를 실행한다. 이 제한을 개발용 격리 테스트까지 확대하지 않는다. 요청 SHA와 실제 테스트 SHA를 섞지 않는다.
- 공통 정본 5절은 사용자에 의해 기능 구분 없이 승인된 공통 필수 절차의 상시 승인 기록이다. 승인된 업무에 필요한 등록·격리 복원·최소 실행 정책·Controller 설치 및 유지보수기 정책 인계를 B급이라는 이유만으로 다시 승인받지 않는다. 정확한 manifest·검증·보호 조건은 유지한다. 게시·배포 등 업무 효과는 해당 업무의 기존 승인을 적용하고 범위 밖 변경만 확인한다. C급 관리자·보안·시스템 설정은 사용자 직접 수행한다.
- 자동화 인프라 보완만을 근거로 Core/Korea/Iran의 task, 운영 source, 기존 lock/SQLite/공급처 호출 한도를 변경하지 않는다. 해당 자원을 변경하는 별도 승인 업무는 그 범위와 보호 계약을 따른다. controller lease가 Core lock을 대체하지 않는다. 일반 pc-job의 B급 운영 쓰기는 비활성이다. 별도의 승인 manifest를 사용하는 독립 유지보수기의 Controller 갱신은 실PC 검증됐으며, 기존 승인 범위에서 재사용한다.
- 6개 일반챗의 독립 A급 작업을 수신하되 무거운 작업은 메모리·전용 lease를 확인해 기다린다. 이 대기를 수집 장애로 보고하지 않는다.
- 같은 작업 요청의 자동 재실행은 0회다. 중복 requestId는 기존 결과를 재사용하고 내용 변경을 거부한다. timeout/불확실한 결과를 무조건 재실행하지 않는다. 상태 조회·멱등 업로드 회수·승인된 watchdog 프로세스 복구는 작업 재실행과 구분하고 각 계약을 따른다.
- 무료 운영: 모든 job은 자체 Runner만 사용한다. 유료 hosted runner/서버/Artifact/cache를 켜지 않는다. 결과는 용량 제한된 private TXT/JSON과 Issue 댓글로 회수한다. API/저장소 자체 제한까지 무제한이라 주장하지 않는다.
- token/키/원자료/전체 config/환경변수/개인정보를 로그·결과·commit에 넣지 않는다. runner 등록 token은 메모리에서만 전달하고 공식 runner의 credential 파일을 열거나 업로드하지 않는다.
- 구현/모의 검사/등록/Online/실제 Actions 실행/결과 회수/자연 재연결을 별개로 검증한다. AUTOMATION_BLOCKED와 RUNTIME_FAILED를 구분한다.
- 실제 작업에 관련된 경우 공개 zgmini main AGENTS.md와 PC_CORE_5MIN_CONFLICT_RUNBOOK.md, PC_WRITER_R2.md, PC_STORAGE_E_DRIVE.md를 참조한다. 테마 업무에만 `codex/theme-fear-greed-integration-20261025`의 THEME_PLATFORM_STANDARD.md를 추가 참조한다. 특정 기능 문서의 제한을 다른 업무의 공통 조건으로 확대하지 않는다.
