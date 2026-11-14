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
