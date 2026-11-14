# PC Runner 연결 복구와 감시

## 적용 범위

기존 6개 Runner와 Controller의 승인 source를 유지한다. Core/Korea/Iran 예약·프로세스·DB·공급자·D1은 변경하지 않는다. 독립 유지보수기 PR #37과 별개인 연결 복구 작업이다.

현재 사용자 로그인 Startup `ZGMINI_PC_CONTROL.vbs` → WScript guardian → `pc-watchdog/runner-watchdog.mjs` → 기존 Controller Supervisor 순서로 실행된다. 관리자 서비스·예약 작업은 추가하지 않는다. 로그인 전이나 PC 전원 종료 중에는 동작하지 않는다.

## 장애와 복구 규칙

- 이전 Supervisor는 자기 자신이 종료되면 복구하지 못했고, 같은 부팅에서 남은 Supervisor lease가 재시작을 막았다. 최초 종료를 유발한 프로그램·사용자 조작은 확인되지 않았다.
- watchdog은 PID 생존과 45초 이내 heartbeat를 함께 확인한다. 오래된 상태 파일만 보고 정상으로 판정하지 않는다.
- Supervisor PID가 확실히 종료된 경우에만 소유자 파일을 재확인하고 전용 lease를 `pc-watchdog/archives`로 이동한다. 삭제하지 않는다. 살아 있거나 불명확한 PID는 건드리지 않는다.
- Controller 파일은 기존 host manifest의 해시와 일치해야 한다. 재시작은 시간당 최대 3회이며 10분 안정 동작 후 실패 이력을 초기화한다.
- `pc-watchdog/PAUSE`, Controller `DRAIN`, 독립 유지보수기의 `leases/controller-install`, 진행 중인 작업 lease, 비활성 GitHub workflow에서는 복구하지 않는다. 승인된 업데이트와 경쟁하지 않는다.
- WScript guardian은 watchdog Node 종료를 감지한다. 짧은 시간에 3회 실패하면 `GUARDIAN_STOP.txt`를 남기고 멈춘다. 중복 watchdog은 receiver lease로 차단한다.
- 상태 `HEALTHY`는 로컬 Supervisor heartbeat를 뜻한다. GitHub Online 및 실제 job PASS는 별도로 확인한다. PID가 살아 있으나 heartbeat가 오래됐거나 PID 재사용이 의심되면 자동 강제 종료하지 않는다.

## 일반챗 확인 순서

### Supervisor 종료와 설치 복구 잠금이 함께 남은 경우

GitHub Offline, 현재 Supervisor PID 종료, 최신 watchdog의 PAUSED를 함께
확인한다. PAUSE·DRAIN·controller-install·다른 Controller lease 중 실제 원인을
대조한다. 이 상태에서는 죽은 Supervisor 자체가 자동 복구 대상이어도 설치
보호 조건이 재시작을 억제한다. PAUSED를 GitHub 인증 오류나 Busy로 해석하지 않는다.

소스의 STATUS 출력은 `supervisorAlive`와 `recoverySuppressedBy`를 포함한다.
원인은 OPERATOR_PAUSE, CONTROLLER_DRAIN, CONTROLLER_INSTALL_LEASE,
OTHER_CONTROLLER_LEASE이며 여러 원인을 모두 보존한다. 기존 설치본에 이 필드가
없으면 코드가 적용됐다고 가정하지 않는다.

2026-11-14 10:23 KST 실PC 관측에서 운영 6좌석 Offline, Supervisor PID 45080
종료, watchdog PID 14596 생존/PAUSED, PAUSE와 DRAIN 부재를 확인했다.
watchdog 바이트는 기존 INSTALL.json과 일치했다. 남아 있는 #996 install lease
원본 owner SHA와 Backlog SHA는 기존 기록과 일치했고 Workflow는 active였다.
이 관측의 직접 연결은 #996 설치 잠금으로 재시작 억제 → 운영 Runner Offline
→ #1351 Job 미배정이다. Supervisor 최초 종료 원인은 미확정이다.
원본 근거는 [#68 실측 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6869314747)과
[#1351](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1351#issuecomment-6869319033)에 있다.

설치 잠금 해제와 기존 Controller 연결 복구를 구분한다. #996 C급 보관을
모든 기존 작업의 전역 선행 조건으로 만들지 않는다. controller-install을
삭제하거나 Listener만 별도로 기동하는 방식은 사용하지 않는다.

사용자가 승인한 기존 Controller 연결 복구는 다음 범위에서 별도로 진행할 수 있다.

1. 설치 manifest와 정확한 Git 원본 바이트로 기존 실행 파일 전체를 검증한다.
2. Supervisor owner의 종료, 설치/C owner의 종료, 동시 복구 부재를 확인한다.
   PAUSE/DRAIN, Workflow 상태 및 대기 중 요청의 실제 실행 효과도 확인한다.
3. 기존 검증된 watchdog의 보관 함수를 사용해 종료된 **일반 Supervisor lease만**
   보관한다. #996 C Claim·Install Lease·원장·Backlog는 보존한다.
4. 기존 설치된 Supervisor 정상 진입점을 한 번 실행한다. 새 요청이나 재실행 없이
   6좌석 연결과 기존 요청의 실제 결과 JSON·TXT·댓글을 확인한다.
5. 설치 파일·#996 원본·Core/Korea 보호 지문을 사후 대조한다.

이 절차는 감시기의 설치 잠금 검사를 우회하도록 변경하거나 신규 설치를 허용하는
절차가 아니다. 설치 복구에는 기존 C급 승인·독점 접근 계약을 계속 적용한다.
기능별 독립 소스 수정·기존 데이터 검증은 해당 기능 담당이 계속한다.

### 2026-11-14 기존 연결 복구 결과

10:35 KST 기존 Controller `badad9124157879d7a645b64f2768113d632355b`의
38개 파일을 검증한 뒤 위 절차로 Supervisor를 기동했다. 운영 Runner 6개는
Online으로 복귀했고, 기존 #1351이 같은 Run/Job으로 실행되어 JSON·TXT가 회수됐다.
중복 요청은 없으며 #996 원본·설치 파일·보호 지문은 변경되지 않았다.

- 실행/회수: [#1351 실제 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1351#issuecomment-6869476984)
- 실제 진단: `STATE_UNKNOWN / CORE_NO_ACTIVE_TASK_ENGINE`. Actions 성공을
  Core 실행 출처 확인 PASS로 해석하지 않는다. 별도 Task Scheduler 조회에서
  Core는 RUNNING이었다. 해당 진단 코드만으로 Core 정지를 단정하지 않는다.
- 근거: `artifacts/runner-recovery/existing-controller-reconnection-20261114.json`.
- 남은 제한: 설치된 watchdog은 #996 Install Lease가 존재하면 자동 재시작을
  억제한다. Supervisor가 다시 종료되면 연결이 재차 끊길 수 있다.
  신규 Controller 설치와 #996 C급 복구는 아직 완료되지 않았다.

### 재발 방지 후보와 진단 한계 (2026-11-14, 미설치)

- Supervisor의 상태 파일 `writeJson`은 임시 파일 생성 또는 rename 오류를
  호출자에 전달하며, 기존 Supervisor에는 이 오류의 처리 경계가 없었다.
  일시적 `EPERM`/`EACCES`/`EBUSY`가 전체 프로세스를 종료할 수 있는 코드 경로를
  보완했다. 이 경로가 과거 PID 45080 종료의 실제 원인이었는지는 미확정이다.
- 보완은 Supervisor heartbeat 쓰기에만 적용한다. 일시적 실패 시 기존 heartbeat를
  갱신하지 않고 다음 정상 tick에서 기록을 시도한다. 최초 경고에는 비민감 오류
  코드만 남긴다. 설치기의 신선도 검사와 원장·lease 쓰기 실패 처리는 유지한다.
- Windows 직접 조회에서 Core 상태 RUNNING(4)과 `GetInstances(0).Count=0`이
  동시에 관측됐다. 이후 READY(3)도 관측됐다. 예약 실행 상태와 인스턴스
  목록 가시성을 구분해야 하며, 이전 #1351 당시의 상세 원인까지 소급 확정하지 않는다.
- [Microsoft GetInstances 문서](https://learn.microsoft.com/en-us/windows/win32/taskschd/registeredtask-getinstances)는
  호출자의 보안 컨텍스트에 따라 인스턴스가 제한됨을 명시한다. 자동 권한 상승이나
  무관한 Node 프로세스로의 대체를 하지 않는다. 변경된 읽기 진단은 전후 Task 상태,
  가시 인스턴스 수, 상태 전환을 구분하고 출처 미확인은 계속 `STATE_UNKNOWN`이다.
- 관련 40건 및 기존 설치·결과 회수 회귀 70건 PASS. Windows 읽기 전용 후보 실행
  증거는 `artifacts/runner-recovery/recurrence-prevention-review-20261114.json`에 있다.
  코드 후보 테스트·직접 읽기 실행은 운영 설치 또는 #996 C 복구 완료가 아니다.

### #996 후속 구현 및 4파일 분리 (2026-11-14)

- 실제 Backlog 원장은 `resumedAt=2026-11-10T13:21:26.727Z`, `replays={}`이며
  pause window는 종료돼 있다. 미종료 Backlog라는 후속 조사 문구를 현재 상태로
  재사용하지 않는다. 원래 원장의 `intakePaused`는 과거 실패 당시 기록이다.
- 기존 Operator의 **읽기 전용 handoff 모드**는 source-lock의 16개 파일을 검산한
  뒤 모듈 바이트를 메모리에 보존한다. Node 동기 로더가 그 바이트를 직접 공급하고,
  목록 밖 import와 합성 승인 반환을 차단한다. 이는 외부 Windows 핸들 고정을
  대체하거나 Owner 승인·네이티브 이동 안전성을 증명하지 않는다.
- Windows TEMP 4개 검사 및 Bootstrap 합성 4개 검사 PASS. 기존
  `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`와 네이티브 namespace
  하드 STOP은 유지한다. C 실행, 원본 보관, 최종 SourceLock/ZIP 봉인은 미실행이다.
- 설치된 `badad9124157879d7a645b64f2768113d632355b`를 기준으로 별도 브랜치
  `codex/runner-runtime-fourfile-20261114`에 필요한 변경만 이식했다. 후보 커밋
  `02d866913aa73802bbca0bd353e9021216532b75`의 Controller/config diff는 정확히
  4파일이고, 작업 목록·다른 실행 모듈은 동일하다. 해당 후보 검사 20개 PASS.
- 이 분리 커밋은 아직 승인 PR 병합·main 계보 검증·설치 manifest 검증을 통과한
  운영 목표 SHA가 아니다. 현행 설치기의 승인 PR merge commit과 target SHA
  계보 조건도 충족해야 한다. 4파일 분리만으로 설치 가능하다고 판정하지 않는다.
- 남은 최초 운영 차단은 디렉터리 이동 경계의 신규 파일 삽입 배제다. 핸들을 닫고
  이동한 후 검산하는 방식으로 이를 PASS 처리하거나 원본 잠금을 해제하지 않는다.

### 트랜잭션 이동의 Windows TEMP 실증 (2026-11-14, 운영 어댑터 아님)

`tests/controller-996-txf-archive.test.mjs`는 기존 운영 경로를 열지 않고 C: TEMP에서
독립 프로세스와 Windows TxF API를 검사한다. 세 디렉터리의 rename을 잠정 적용하고
한 번에 commit 또는 rollback하는 시험이다. 일반 rename 뒤 사후 검사로 실패를
발견하는 방식과 달리, commit 전에는 외부에서 원래 Install 경로가 계속 보인다.

- 정상 commit, 명시 rollback, 독립 프로세스 삽입, 목적지 충돌, transaction owner
  강제 종료, 이미 열린 디렉터리 핸들을 통한 NT 상대경로 삽입을 구분한다.
- 직접 삽입 시험은 동일 child가 transaction 밖에서 먼저 성공하는 양성 대조를
  통과해야 한다. 단순 호출 실패를 namespace 배제로 판정하지 않는다.
- 이미 열린 쓰기용 디렉터리 핸들이 있으면 세 번째 잠정 이동이 Windows 오류
  6800(`ERROR_TRANSACTIONAL_CONFLICT`)으로 거부됐다. 앞선 두 이동도 rollback되고
  원본 세 경로·owner 원문 바이트·파일/디렉터리 ID·ACL이 보존됐다. 경쟁자는 여전히
  원본에 쓸 수 있으므로 이 경우 실행을 허용하지 않는 것이 정상이다.
- 정상 commit과 rollback/중단의 원문 바이트·파일 ID·ACL 보존도 검사한다.

이 시험은 **실제 #996 C Operator의 CAS 구현이 아니다.** 실제 기대 파일 목록·ID·
SHA·ACL을 transaction 내부에서 대조한 뒤 commit하는 운영 어댑터 연결과 검증이
남아 있다. 원본 E:의 transaction 동작, 실제 Owner 승인 및 최종 패키지도 미검증이다.
기존 C hard STOP과 운영 Claim·Lease는 유지한다.

[Microsoft TxF 규격](https://learn.microsoft.com/en-us/windows/win32/fileio/programming-considerations-for-transacted-fileio-)
상 directory enumeration만으로 격리가 보장되지는 않는다. 위 제한된 이동 실증을
모든 파일시스템 변경의 배제 보장으로 확대하지 않는다. 또한 Microsoft는
[MoveFileTransacted](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefiletransacteda)의
새 상시 사용을 권장하지 않으므로, 현재는 고정 Windows/NTFS의 일회성 복구 후보만
검토한다. watchdog·Controller의 상시 의존성에는 추가하지 않았다.

### 실제 Operator 이동 함수 연결 후 검증 (2026-11-14, 운영 C 차단 유지)

`controller-996-c-native-owner-operator.mjs`의 `moveNoReplace`를 TxF-CAS
구현에 연결했다. TEMP builder와 운영 후보는 동일한 네이티브 코드를 사용하며,
컴파일된 root 제한만 다르다. 원래 Claim→continuation→Install Lease 최종 보관
순서와 마지막 Owner 승인 재조회는 보존한다. **각 이동이 별도 transaction**이며,
앞선 TEMP의 세 이동 동시 commit 시험을 전체 Operator의 원자성 증거로 혼용하지 않는다.

네이티브 구현은 원본 inventory·ID·ACL·hash를 관측하고 잠정 rename한 뒤,
transaction 내부에서 정확한 파일 목록·ID·ACL·승인 hash·owner를 다시 검증한다.
transacted writer handle을 commit까지 유지하며, 검증 실패는 rollback한다.
실제 commit·transaction identity·pins-before-commit·ACL 증거가 없는 영수증은
운영 호출자가 받지 않는다. 불명확한 commit이나 사후 차이는 재실행하지 않는다.

- 같은 구현의 Windows TEMP 10건 PASS: 정상, 잘못된 hash, 추가 파일, 목적지
  충돌, transaction 안 삽입, 기존 writer, 잘못된 nonce, 생존한 구 owner, hardlink,
  CAS 검증 직후 프로세스 종료. 마지막 경우 사용자 finally 없이 원본이 보존됐다.
- Windows 소스/승인 전달 경계 4건, Bootstrap 합성 4건, 소스 계약 4건 PASS.
  `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED` 강제 차단은 유지한다.
- 원본 Windows의 추가 **읽기**에서 prewrite가
  `C_996_PREWRITE_R1_LIVE_PROTECTION_UNVERIFIED`로 거부됐다. 항목 대조 결과
  Core/Korea Task hash와 enabled 상태는 동일하고 Writer config hash만 다르다.
- 현재 config hash `53533eab…`는 [#1321 사후 진단](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1321)의
  `results/43233846597-1-seat-5.json`과 일치한다. 해당 진단은
  [#1320 R10 B 적용](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1320) 후의 PASS다.
  승인 manifest 원문 hash도 #1320 요청과 일치한다. 이것을 운영 손상으로 해석하거나
  config를 과거 값으로 되돌리지 않는다. 과거 R2와 현재 승인 상태의 보호 기준을
  정확한 C 명세에 연결해야 하며, 현재 fingerprint를 무조건 허용하도록 바꾸지 않는다.

근거: `artifacts/runner-recovery/996-txf-operator-cas-20261114.json`.

### 승인된 후속 보호 상태 연결 (2026-11-15, 읽기 전용)

현재 Writer config는 #1320 B 적용 후 #1321의 실제 저장 재조회 해시와 일치한다.
과거 R2 보호 해시와 다르다는 이유로 이를 복원하지 않는다. 선택적
`protectionBaseline`은 파일·Task 전체 목록과 fingerprint, 고정 commit의 증거 경로를
정확한 C manifest에 포함한다. 과거 R2 검사는 유지하며, 새 기준의 형식 검증이나
관측 성공은 Owner 승인 또는 증거 인증을 뜻하지 않는다. Owner 원문 승인에 묶인
manifest 검증과 별도 실행 경계가 충족돼야 한다.

- 원본 PC 읽기에서 파일 10개 두 차례 대조, 설치·staged·유지보수 소스 84개,
  보호 검사 14개를 확인했다. `C_ORIGINAL_PREWRITE_FILE_PINS_OBSERVED_ONLY`이며
  `executionAuthorized=false`, 운영 쓰기 0건이다.
- R4 봉인 JSON의 개발 checkout CRLF 변환을 확인했다. 기대 SHA를 변경하지 않고
  Git 원문 LF 바이트로 되돌렸으며 봉인 파일 3개에 LF checkout 규칙을 추가했다.
- 관련 검증 65건 PASS: 보호 기준·Owner 변조/철회·Windows 소스 경계 37건과
  관측·prewrite·stage TEMP 검사 28건. TEMP 포트는 원본 E: 경로를 거부한다.
- 설치된 유지보수기는 저장소 Runner 총수가 정확히 6개여야 한다고 검사한다.
  별도 격리 Runner가 존재하면 `RUNNER_SET_DRIFT`가 재발할 수 있다. 여섯 운영
  이름의 유일성·Online·Busy 검사로 범위를 제한하는 최소 수정과 검증된 유지보수기
  인계가 필요하다. 현재 C lease가 남은 동안 인계나 새 설치 요청을 수행하지 않는다.

근거: `artifacts/runner-recovery/996-proposed-baseline-readiness-20261115.json`.
이 기록은 최종 SourceLock/ZIP/S2 또는 운영 복구 완료 증거가 아니다.

### 원본 Install Lease 최종 보관 순서의 Windows TEMP 검증

`tests/controller-996-native-archive-sequence.test.mjs`는 실제 Operator와 동일한
네이티브 TxF-CAS builder를 호출하되 고정된 C: TEMP fixture만 사용한다.
기존 C Claim→continuation Claim→Install Lease 순서에서 정상 완료, 첫 보관 후 중단,
continuation 보관 중 프로세스 종료·변조, 두 번째 보관 후 중단, Install 보관 중
프로세스 종료·변조·목적지 충돌 8건을 검사했다. 모두 PASS이며, 실패·중단 시
원본 Install 경로·owner 바이트·파일/디렉터리 ID·ACL이 보존됐다. 앞서 완료한
보관은 되돌리거나 삭제하지 않았다. 정상 완료에서만 마지막 Install을 보관한다.

이는 전체 Owner Operator 실행이나 실제 승인 인증 시험이 아니다. 기존 Linux
시뮬레이터는 Windows에서 의도적으로 거부되고, 별도 PC 전용 소스 시험은 원본
E: 존재 시 거부한다. 해당 추가 suite 호출의 실패를 PASS로 변경하거나 이 TEMP
검증으로 전체 C 승인이 완료됐다고 해석하지 않는다.

재발 방지용 최소 유지보수기 후보는 설치 source `16064e29…`에서 분리한
`103a38b4b3643c68fec47c861fe2ac9a0bfa1b42`다. runtime 변경은 `tools/update.mjs`
한 파일이며, 여섯 운영 좌석의 유일성·상태와 API 목록 완전성을 확인한다.
Runner·계약·적용·인계 회귀 90건 PASS, 원격 바이트 일치를 확인했다. 미설치이며
원본 #996 lease가 있는 동안 인계하지 않는다. 별도 4파일 Controller 후보의
승인 PR 계보 조건도 아직 충족되지 않았으므로 설치를 요청하지 않는다.
원본 Claim·Install Lease·Workflow·Backlog·Controller는 변경하지 않았다.
최종 SourceLock/ZIP/S2 및 실제 운영 C 실행은 아직 미완료다.

위 STATUS 소스 보완은 Draft 후보이며 2026-11-14 관측 당시 운영 설치에
반영되지 않았다. 상태 설명 보완을 Runner 복구 성공으로 보고하지 않는다.

1. GitHub의 6개 Runner Online·busy 및 최근 요청 결과를 확인한다.
2. 실패 시 현재 허용된 PC 접근 경로로 `pc-watchdog/STATUS.json`, Supervisor heartbeat, lease를 확인한다. Offline이라면 새 Issue를 반복 생성하지 않는다.
3. `BLOCKED`의 정확한 code만 해결한다. Core 잠금 삭제·전체 node 종료·Runner 재등록은 금지한다.
4. 복구 후 고유 requestId의 기존 허용 작업 한 개로 JSON/TXT/댓글을 확인한다.

설치 도구는 `tools/install-runner-watchdog.mjs`다. 기존 설치가 있으면 중단하며 반복 설치하지 않는다. 기존 Startup 원본과 보호 해시는 `pc-watchdog/STARTUP_BEFORE.vbs`, `PROTECTION_BEFORE.json`에 보존된다. 감시만 일시 중지할 때는 `pc-watchdog/PAUSE`를 사용하며 기존 Runner는 종료하지 않는다.

## 실PC 증거

- 2026-11-03 KST: 기존 6개 Offline 확인 → watchdog이 종료된 Supervisor lease 보관 → 기존 source `c491d95f…`로 6개 Online 복구.
- [Issue #38](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/38): 실제 `core-status` PASS, JSON/TXT/댓글 자동 회수. `protectedStateUnchanged=true`, 운영/Provider/D1 쓰기 0.
- 2026-11-03 03:11 KST: 새 watchdog PID 30248만 종료하는 시험 후 WScript가 PID 19524로 자동 재기동했다. Supervisor PID 38716과 Runner 6개 Online을 유지했고 보호 해시 불변을 재확인했다. 재부팅·로그인 전 서비스 동작을 검증한 것으로 확대하지 않는다.
