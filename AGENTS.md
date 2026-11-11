# ZGMINI PC 자동 실행 공통 기준

- **두 PC의 실제 대상 식별(2026-11-12):** 기존 운영 PC의 `zgmini-pc-01`~`06`과 별도 공통 장애 대기열 PC의 `zgmini-handoff-ci-isolated`는 같은 GitHub 요청·결과 원칙을 사용하지만 **서로 다른 물리 PC·실행 권한·설치 환경**이다. [두 PC 장비 실측 정본](docs/PC_HOST_INVENTORY_READONLY.md) 및 [두 PC 프로세스·실행·복구 운영 정본](docs/PC_OPERATING_SYSTEMS_CANONICAL.md)의 원본 Issue/Run 및 JSON/TXT로 호스트·Runner·설치 경로를 확인한다. 다른 PC의 TEMP·Node·Controller 설치 경로를 그대로 가정하거나 #996의 수동 ZIP/CMD 경로를 새 기본 실행 방식으로 만들지 않는다. 신규 채팅의 지침 확인은 이 정본의 명시적 조회이며 GitHub 수정만으로 다른 대화에 자동 적용되지 않는다.

- **원담당 업무 재개(2026-11-06):** 이 지침을 받은 각 일반챗은 자기 원래 기능 업무의 마지막 유효 완료 지점에서 승인된 다음 실행으로 바로 진행한다. 공용 #434 자연 B 실증 대기·다른 대화의 인계 미수신은 독립 업무의 전역 Gate가 아니다. 실제 업무에 필요한 정상 B는 기존 승인·보호 계약으로 진행하되 #434 확인만 위한 인위적 B는 만들지 않는다. 프로세스 총괄은 담당자의 기능 구현·설치를 대신하지 않는다.

- **성공 실행물 재사용(2026-11-08):** 새 업무의 필수 실행에 참고할 동일 유형 성공 사례가 있으면 [docs/SUCCESS_EVIDENCE_REUSE.md](docs/SUCCESS_EVIDENCE_REUSE.md)의 승인 manifest·실제 Windows Issue/Run·원격 JSON/TXT·검증 효과를 **관련 범위만** 조회하고 검증된 공통 구조를 재사용한다. 성공 증거는 기존 `approvals/`·`results/`에 한 번 보존하고, 새로운 재사용 패턴이 검증될 때만 색인을 갱신한다. 과거 해시·승인을 현행값으로 복사하거나 별도 Gate·예약·민감 파일 업로드를 만들지 않는다. GitHub 반영은 다른 대화·PC의 자동 학습/적용이 아니다.

- 최우선은 현재 사용자 업무의 다음 실행이다. 기존 성공 증거는 내부 전제로 재사용하며 지침 학습·환경 재확인·과거 Controller 복구를 신규 성과나 핵심 진전으로 반복 보고하지 않는다. 보고는 이번 수행·검증·실제 미해결 조건·다음 행동에 한정한다. 현재 업무를 막거나 이번에 바뀐 상태, 사용자가 요청한 상태 점검만 필요한 범위로 보고한다.

- 승인 범위의 manifest·해시·누적 diff·실행 명세·검증 자료는 현재 담당자가 완성하고 다음 지원 행동까지 수행한다. 미작성 자료·브랜치 분기·과거 대기 보고만으로 중단하지 않는다. 공용 담당 미지정·실제 경합 없음이면 원장에 등록해 조정을 맡고, 기존 담당 변경은 명시적으로 인계한다. 실제 접근 거부·활성 경합·범위 밖 결정·검증 실패의 영향 단계만 중단하며 안전 검사는 우회하지 않는다.

- 단계 종료·재개·중지는 공통 정본 2절을 따른다. 완료 단계는 증거와 함께 닫고 다음 필수 실행 하나를 담당·입력·통과 조건과 함께 지정한다. 대기는 기존 ID 하나로 추적하며 같은 상태를 반복 보고하지 않는다. 사용자 중지 시 새 실행과 추적을 중단한다.

- 공통 실패 보완: `docs/COMMON_FAILURE_HARDENING_20261103.md`. 실패 중복 조회를 PASS로 바꾸지 않고, 종료 불명확은 STATE_UNKNOWN으로 격리한다. Controller와 유지보수기 정상 상태를 구분하며 부분 전환 복구는 정확한 승인/백업 계약으로 수행한다.

- 공통 정본: `docs/PC_AUTOMATION_STANDARD.md` (2026-11-05). 조회/독립 A급, 등록·설정, 실제 Controller 교체의 위험도별 검증을 구분한다. 정상 업무마다 전체 Controller 건강 검사나 과거 복구 이력을 다시 조회하지 않는다. 다음 실행에 필요한 조건만 확인하며 실제 오류·불명확 상태가 있으면 관련 진단으로 전환한다. 과거 기록은 원본 관측 시각·적용 범위에서 재사용하고 현재 상태로 고정하지 않는다.
- 실제 설치 장애가 발생했을 때 `docs/CONTROLLER_RECOVERY.md`를 적용한다. 원장 없는 UNKNOWN·관리 좌석 불일치는 `docs/INSTALL_FAILURE_120_20261103.md`를 참조한다. 단일 담당이 상태 판정→검증된 복구→회수→재개를 수행하며 과거 복구 완료를 현재 업무의 신규 성과로 보고하지 않는다.
- #319는 2026-11-05 KST `ABORTED_UNTOUCHED`로 실패 설치 lease를 보관했다. **#319 자체는 새 Controller 설치 PASS 증거가 아니다.** 효율 개선 코드는 PR #327로 `main`에 병합됐고, 2026-11-05 KST 실제 PC 유지보수기 자체 인계(`dbe072206a599f7ac3c4eb9d86afd89cd4fdbd54` → `5469548b05ba90f3855281e94234952bdb45fa4f`)는 `PASS` 및 새 Receiver Windows 출처 검증으로 확인됐다. 이는 새 Controller 설치·Runner 재연결·운영 정책 활성화 증거는 아니다. 문서나 source 병합을 근거로 현행 실행기 안전 검사를 우회하지 않는다. 실제 교체의 B 승인·원본 해시·전환/복구 보호는 유지한다.
- **후속 실제 설치 확인(2026-11-05 KST):** 별도 B 요청 [#345](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/345#issuecomment-6640249328)에서 Controller `69c830275bd3fec75b17c8a98c46d689447fb1a7`가 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`로 설치됐고 보호 상태 유지·Workflow 활성 상태가 확인됐다. [#346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/346)·[#347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/347)에서 서로 다른 Runner 좌석의 A급 진단 PASS와 #347 시점 Core 실행 전진이 확인됐다. 이 증거는 #319 보관·유지보수기 인계와 별개이며 해당 관측 시점에만 유효하다. 새 작업은 실제 관련 변경이 있을 때만 영향 범위를 재검증한다.
- 작업 전 요약: `docs/GENERAL_CHAT_PREWORK.md`. 상태/접수 판정: `docs/AUTOMATION_STATUS_AND_ADMISSION.md`. 과거 실패를 현재 활성 잠금으로 오인하거나 외부 도구 안전 거부를 PC 장애로 확대하지 않는다. 거부된 행동을 다른 도구로 우회하지 않는다.
- 실행 범위·증거 재사용·BLOCKER 판단은 공통 정본 2절을 따른다. 다른 담당자의 유효한 실PC 결과를 원본 링크와 적용 범위로 재사용하고, 현재 실행에 무관한 전체 경로 진단을 새 선행 조건으로 만들지 않는다. 잘못된 조건은 원래 대기열에서 정정한다.
- 공용 적용 조정: `docs/CONTROLLER_APPLY_QUEUE.md`. 기능 개발은 병렬로 유지하되 Controller·유지보수기 및 동일 PC Core 운영 source lane에 **실제로 겹치는 쓰기**는 단일 조정 원장과 자원별 적용 담당 한 명으로 순서를 정한다. Core 승인 SHA를 직접 검증하는 보조 기록기의 호환성·사후 실제 기록 결과도 영향 범위에 포함한다. 승인된 누적 변경을 정확한 manifest로 묶거나 순차 적용하고, 서로 다른 담당자를 무기한 기다리지 않는다. 기존 PC lease·승인 검사는 그대로 유지한다.
- **모든 현재·미래 공용 자원 경합의 동일 수명주기(2026-11-10):** [docs/SHARED_RESOURCE_LIFECYCLE_V1.md](docs/SHARED_RESOURCE_LIFECYCLE_V1.md)를 재사용한다. Writer·Controller·Core source·Runner 메모리/seat/lease·공용 결과/원장 등 **실제로 공유 자원을 쓰는 실행**에서만 승인된 입구/자원 키/원본 요청/결과 JSON·TXT/복구 증거/재계획 상태를 연결한다. 신규 자원·실행 종류는 기존 공통 계약에 인증 어댑터를 등록하고, 기능 전용 우회 대기·임의 재실행·같은 requestId 재사용을 만들지 않는다. Writer B의 청구 전 무변경과 pc-job의 요청 소모 후 작업자 실행 전 무변경, 복구 필요를 구분한다. #68 대기 원장은 PC 잠금·일반챗 자동 수신이 아니며, 자원 해제는 실제 운영·승인·source readback 후 새 고유 요청으로 재계획한다. 문서/CI 통과는 운영 적용 PASS가 아니다. **독립 업무의 전역 Gate로 확대하지 않는다.**

- **격리 Windows Writer B 자동 장애 인계(2026-11-10):** 정규 승인 Writer B 원본 Issue/실행에서만 별도 격리 Windows Runner(`zgmini-handoff-ci-isolated`)의 `workflow_run` intake가 원본 bot receipt·manifest SHA·JSON/TXT 결과를 검증해 **수리 가능한 확정 실패**를 `agent-handoff` Incident로 접수한다. 기존 단일 중앙 ChatGPT가 사건을 확인·수정·회귀/PR/CI 후 **원본 GitHub Issue**에 결과를 반환한다. 별도 CI Runner는 6개 운영 PC Runner와 다르며, `WAIT_RECORDED`·성공·미확정은 자동 수리 사건이 아니다. 원본 Issue 회신은 다른 일반챗의 자동 수신/재개·PC 운영 적용이 아니다. 이미 검증된 안전 대기를 실패 실증으로 바꾸거나 검증 전용 인위적 B를 만들지 않는다. 기존 중앙 사고 E2E 8/8과 **새 격리 intake의 자연 유효 실패 전체 왕복 미실증(DEFERRED)**은 다른 범위다. 원담당은 기존 기능 작업을 계속하며 [단일 중앙 인계 정본](docs/AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md)과 [공통 실행 지침](docs/PC_AUTOMATION_STANDARD.md)을 참고한다.

- 신규 기능 공통 경로(R2 #622): 실제 PC 적용 초기에 기존 등록·A급 진단·B급 Writer 수신 지원 범위를 짧게 확인하고, 미지원 경로만 프로세스 총괄의 공통 도구 개선으로 분리한다. 독립 개발은 계속하며 기존 기능 전용 B 수신기를 우회 재목적 사용하지 않는다. 실제 source/파일 해시·잠금·복구가 연결된 최소 manifest를 사용하고 단순 코드 병합을 PC 설치 성공으로 보고하지 않는다. 세부 계약은 `docs/PC_AUTOMATION_STANDARD.md` 2·5·8절을 따른다.

- 한국어로 보고한다. 이 저장소는 비공개 PC 제어 전용이다. 공개 `zgmini`의 개발 source, PC 승인 source, controller source를 구분한다.
- 새 일반챗은 먼저 README.md와 docs/GENERAL_CHAT_START.md를 읽고 해당 작업을 자동 요청한다. 사용자가 매번 CMD를 실행하고 파일을 전달하도록 되돌리지 않는다.
- 기본 요청은 `pc-job` label의 새 Issue JSON이다. 현재 GitHub 연결 도구에 workflow_dispatch가 없어도 이 경로를 쓴다. 임의 CMD 문자열은 받지 않는다.
- 6개 Runner는 checkout/작업폴더/TEMP/캐시/출력/요청 원장을 분리한다. 공통 실행기로 처리 가능한 일을 기능별 임시 명령·예약으로 중복 구현하지 않는다. 업무상 필요한 예약 변경은 해당 업무 승인 범위를 따른다. 운영 데이터 공유 쓰기를 병렬 실행하지 않는다.
- 일반 pc-job은 설치된 A급 고정 허용목록으로 실행한다. 승인된 B급 갱신은 별도 유지보수 경로를 사용한다. 원격 source의 임의 스크립트는 실행하지 않는다. PC 고정 테스트 adapter는 설치 시 검증된 source SHA의 suite를 실행한다. 이 제한을 개발용 격리 테스트까지 확대하지 않는다. 요청 SHA와 실제 테스트 SHA를 섞지 않는다.
- 공통 정본 5절은 사용자에 의해 기능 구분 없이 승인된 공통 필수 절차의 상시 승인 기록이다. 승인된 업무에 필요한 등록·격리 복원·최소 실행 정책·Controller 설치 및 유지보수기 정책 인계를 B급이라는 이유만으로 다시 승인받지 않는다. 정확한 manifest·검증·보호 조건은 유지한다. 게시·배포 등 업무 효과는 해당 업무의 기존 승인을 적용하고 범위 밖 변경만 확인한다. C급 관리자·보안·시스템 설정은 사용자 직접 수행한다.
- 자동화 인프라 보완만을 근거로 Core/Korea/Iran의 task, 운영 source, 기존 lock/SQLite/공급처 호출 한도를 변경하지 않는다. 해당 자원을 변경하는 별도 승인 업무는 그 범위와 보호 계약을 따른다. controller lease가 Core lock을 대체하지 않는다. 일반 pc-job의 B급 운영 쓰기는 비활성이다. 별도의 승인 manifest를 사용하는 독립 유지보수기의 Controller 갱신은 실PC 검증됐으며, 기존 승인 범위에서 재사용한다.
- **승인된 이란 R13 제거 예외:** 사용자가 의도적으로 제거한 `ZGMINI-PC-Iran-Progress-R13` 예약은 [PR #342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/342) 이후 `APPROVED_RETIRED_ABSENT`로 확인한다. Core·Korea 예약의 기존 보호는 유지한다. 이란 예약을 무조건 존재해야 하는 필수 조건으로 취급하거나 임의로 재등록·복원하지 않는다. 실제 상태가 승인 계약과 다르면 해당 범위만 진단한다.
- 6개 일반챗의 독립 A급 작업을 수신하되 무거운 작업은 메모리·전용 lease를 확인해 기다린다. 이 대기를 수집 장애로 보고하지 않는다.
- 같은 작업 요청의 자동 재실행은 0회다. 중복 requestId는 기존 결과를 재사용하고 내용 변경을 거부한다. timeout/불확실한 결과를 무조건 재실행하지 않는다. 상태 조회·멱등 업로드 회수·승인된 watchdog 프로세스 복구는 작업 재실행과 구분하고 각 계약을 따른다.
- 무료 운영: 모든 job은 자체 Runner만 사용한다. 유료 hosted runner/서버/Artifact/cache를 켜지 않는다. 결과는 용량 제한된 private TXT/JSON과 Issue 댓글로 회수한다. API/저장소 자체 제한까지 무제한이라 주장하지 않는다.
- **E: 기록 보존 최소화(2026-11-05 사용자 지시):** 일회성 CMD·사전검증·진단·시뮬레이션의 TXT/JSON·콘솔 로그를 `E:\ZGmini`에 계속 누적하지 않는다. 기본은 사용자별 `%TEMP%` 또는 기존 GitHub Issue 댓글·결과 회수 경로이며, 목적 달성 후 불필요한 임시 출력은 보존 대상으로 취급하지 않는다. E:에는 승인된 원자료·DB·checkpoint·설치 상태 원장·복구에 필요한 백업·영구 운용 증거 등 실제 지속성이 필요한 것만 기존 경로/계약대로 저장한다. 이미 생성된 기록과 백업은 임의 삭제하지 않고 필요성·대상 경로·복구 상태를 확인한 뒤 승인 범위에서 정리한다.
- token/키/원자료/전체 config/환경변수/개인정보를 로그·결과·commit에 넣지 않는다. runner 등록 token은 메모리에서만 전달하고 공식 runner의 credential 파일을 열거나 업로드하지 않는다.
- 구현/모의 검사/등록/Online/실제 Actions 실행/결과 회수/자연 재연결을 별개로 검증한다. AUTOMATION_BLOCKED와 RUNTIME_FAILED를 구분한다.
- 실제 작업에 관련된 경우 공개 zgmini main AGENTS.md와 PC_CORE_5MIN_CONFLICT_RUNBOOK.md, PC_WRITER_R2.md, PC_STORAGE_E_DRIVE.md를 참조한다. 테마 업무에만 `codex/theme-fear-greed-integration-20261025`의 THEME_PLATFORM_STANDARD.md를 추가 참조한다. 특정 기능 문서의 제한을 다른 업무의 공통 조건으로 확대하지 않는다.
