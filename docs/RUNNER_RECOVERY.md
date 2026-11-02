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

1. GitHub의 6개 Runner Online·busy 및 최근 요청 결과를 확인한다.
2. 실패 시 현재 허용된 PC 접근 경로로 `pc-watchdog/STATUS.json`, Supervisor heartbeat, lease를 확인한다. Offline이라면 새 Issue를 반복 생성하지 않는다.
3. `BLOCKED`의 정확한 code만 해결한다. Core 잠금 삭제·전체 node 종료·Runner 재등록은 금지한다.
4. 복구 후 고유 requestId의 기존 허용 작업 한 개로 JSON/TXT/댓글을 확인한다.

설치 도구는 `tools/install-runner-watchdog.mjs`다. 기존 설치가 있으면 중단하며 반복 설치하지 않는다. 기존 Startup 원본과 보호 해시는 `pc-watchdog/STARTUP_BEFORE.vbs`, `PROTECTION_BEFORE.json`에 보존된다. 감시만 일시 중지할 때는 `pc-watchdog/PAUSE`를 사용하며 기존 Runner는 종료하지 않는다.

## 실PC 증거

- 2026-11-03 KST: 기존 6개 Offline 확인 → watchdog이 종료된 Supervisor lease 보관 → 기존 source `c491d95f…`로 6개 Online 복구.
- [Issue #38](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/38): 실제 `core-status` PASS, JSON/TXT/댓글 자동 회수. `protectedStateUnchanged=true`, 운영/Provider/D1 쓰기 0.
- 2026-11-03 03:11 KST: 새 watchdog PID 30248만 종료하는 시험 후 WScript가 PID 19524로 자동 재기동했다. Supervisor PID 38716과 Runner 6개 Online을 유지했고 보호 해시 불변을 재확인했다. 재부팅·로그인 전 서비스 동작을 검증한 것으로 확대하지 않는다.
