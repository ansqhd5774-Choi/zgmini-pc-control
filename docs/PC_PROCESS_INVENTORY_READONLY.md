# 두 PC의 실제 프로세스 운영 상태 관측 — 읽기 전용

## 목적과 범위
기존 운영 PC와 격리 공통 대기열 PC의 프로세스·시작 등록·서비스·예약 작업을 **각 PC의 기존 Runner**에서 읽기 전용으로 한 번 조회한다. CPU/RAM/스토리지/Windows 버전의 이전 확정값은 docs/PC_HOST_INVENTORY_READONLY.md 및 각 Issue 원본을 재사용한다. 기능 개발/Controller 변경/수집/DB/D1 게시/운영 Task 변경은 수행하지 않는다.

## 정식 요청
- 제목: pc-process-inventory-readonly
- 운영 PC: {"schema":"ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1","operation":"process-inventory-readonly","requestId":"<FRESH_UUID>","role":"operating"}
- 공통 인계 PC: 동일하되 role=handoff, 다른 고유 UUID를 사용한다.
- 요청 본문 필드는 정확히 schema/operation/requestId/role 네 개다. Issue·요청은 승인된 user만 작성한다.
- 기본적 Runner/호스트 검증은 기존 도구에서 재사용한다. 운영 PC는 호스트 PC + zgmini-pc-01~06, 공통 인계 PC는 DESKTOP-N62L0NG + zgmini-handoff-ci-spare-01 고정.

## 실측 필드와 정보 최소화
- Windows 표준 CIM 읽기 전용 Win32_Process: **전체 프로세스 개수 + 지정한 프로세스 이름별 전체 집계(processCounts) + 실행 프로세스 이름/PID/PPID/session/Working Set MiB(최대 60 상세)**. 상세 60개는 Runner.Listener/Worker → WScript → Node → PowerShell → CMD 순 우선한다. 전체 지정 프로세스가 60개를 넘더라도 이름별 전체 집계는 보존한다.
- 동일 CIM의 ZGMINI/Actions Runner 관련 서비스명·상태·시작 형태(최대 24).
- 이름이 ZGMINI로 시작하는 예약 작업 이름·상태(최대 48). 명령·인수·트리거 원문을 게시하지 않는다.
- #1018 기존 공급자 제거 판정에 필요한 고정 `ZGMINI-PC-MarketParquet-ETF` Task XML의 로컬 해시, Enabled 상태, 정확 단일 E: 데이터/프로젝트 launcher 파일의 SHA256·basename·실행형식만 `marketParquetTaskSource`에 추가한다. 원본 XML·명령행·인수·비밀·파일 바이트는 반환하지 않는다. 경로/작업이 모호하면 `STATE_UNKNOWN`. Task 수정·정지·재설정·Provider 접근은 절대 수행하지 않는다.
- 사용자 Startup 폴더에서 ZGMINI로 시작하는 **파일 이름만**(최대 24). 파일 본문, 전체 경로, 계정명은 반환하지 않는다.
- 명령줄, 환경변수, 프로세스 토큰, 시리얼번호, IP/MAC, 사용자 개인정보, 계정 식별자, 인증·원자료·DB는 조회·전송하지 않는다.
- PowerShell/CIM에서 접근 실패 시 PARTIAL과 안전 코드만 반환한다. 실패 stderr 원문을 로그/결과로 내보내지 않는다.
- JSON/TXT는 GitHub 원자적 게시기에서 단일 commit + 원격 동일바이트 2/2 재조회한다. 원본 Issue 댓글은 부가 수신증거다. 자동 재시도 0회.

## 결과 분류
PASS/PROCESS_INVENTORY_COLLECTED는 **한 시점에 프로세스 정보를 수집**했다는 증거다. Windows Service 관리/전체 프로세스 인과관계/실제 복구 성공/부팅 후 자동 시작을 증명하지 않는다. 해당 도메인의 부분 실패는 결과의 serviceStatus,taskStatus,startupStatus로 별도 기록한다.

본 도구는 #996의 C급 NO-GO, ISO_ONLY_PASS, Controller 설정, WIM/ISO, Core 및 Writer 운영을 변경하지 않는다.
## W06 고정 Task 트리거/액션/최근 실행 읽기 — 별도 선택형 probe

운영 PC의 기존 `pc-process-inventory-readonly` Issue 계약에 `"probe":"w06-cnn-task-cadence-readonly"` 하나만 추가한 별도 단회 A를 사용한다. `role=operating`만 허용하고 Task 이름·경로·명령어를 요청에서 입력받지 않는다. 기존 Workflow와 Runner만 사용하며 Windows Task/주기/액션을 변경하지 않는다.

`Get-ScheduledTask`와 `Get-ScheduledTaskInfo`로 이름이 ZGMINI로 시작하는 최대 48개 Task의 Enabled/State, trigger 개수와 반복 초, 실행 파일의 범주, 액션 인수에 `local-cycle.mjs --cnn-minute` 두 리터럴이 존재하는지, 최근/다음 실행시각 및 종료 코드를 조회한다. 전체 인수·경로·XML·환경변수·계정·공급자 정보는 출력하지 않는다. 간접 VBS/CMD 호출의 내부 실행 경로는 이 조회로 확정되지 않는다. 간격 60초와 인수 리터럴 확인은 **실제 60초 자연 실행, 성공적인 HTTP·SQLite·D1 게시 증거가 아니다**. 불명확한 trigger/Task 정보는 PARTIAL/STATE_UNKNOWN으로 유지한다. 승인 없는 신규 Task·기존 Task 변경·공급자 호출·DB/D1 쓰기는 0건.
