# 승인된 PC Controller 자동 갱신 — 독립 유지보수기

상태: **개발·격리 모의검사 단계. 최초 실PC 연결 및 GitHub-only 업데이트는 아직 미검증.**

## 정체성과 승인 경계

- 제어 저장소: `ansqhd5774-Choi/zgmini-pc-control`, `main`.
- 2026-11-02 실PC에서 마지막으로 관측한 설치 Controller SHA: `c491d95fdb594a729f08deff68d86e04c18a9544` ([Issue #31](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/31)). 현재 설치 상태는 갱신 전 `status`로 다시 확인한다.
- PR #28 Fear & Greed 진단의 병합 SHA: `b77a333db9d3445394ff4267949a79b6054126cf`. **최신 main SHA와 같다고 가정하지 않는다.** 최초 승인 파일은 `approvals/controller-updates/b77a333db9d3445394ff4267949a79b6054126cf.json`.
- 원본 A급 `pc-job` Issue의 7필드 계약은 그대로 둔다. `controller-update`를 그 안에 추가하지 않는다. 임의 CMD/SQL/다운로드 URL/경로를 받지 않는다.
- 신규 `pc-maintenance` Issue는 **갱신 요청**일 뿐 자동 승인 근거가 아니다. 별도 B급 승인 manifest의 raw SHA-256과 실제 설치 SHA, merged PR, Git 이력과 변경 파일별 해시를 모두 확인한다.
- 일반 A급 호환 보강은 승인된 기존 Controller 파일·기존 operation 이름만 갱신 가능하다. 새 실행 파일 또는 operation 등록은 명시적 B 승인 manifest가 필요하다. 운영 source·DB/D1·게시·스케줄은 이 경로로 갱신할 수 없다.

## 통신 구조

1. 일반챗이 B급 승인·파일 해시·검사 결과를 `approvals/controller-updates/<40-char-target-SHA>.json`에 저장한다. 승인 manifest는 설치 SHA, 목표 SHA, 파일별 SHA-256, 목적·PR, 검사 PASS, 검증된 snapshot rollback, 사후 진단의 고정 이름·불변 source를 기록한다.
2. 일반챗이 `pc-maintenance` label, 제목 `pc-controller-update`로 **별도** Issue를 한 번 만든다. 요청은 정확히 아래 7키 JSON이다.

```json
{
  "schema": "ZGMINI_PC_MAINTENANCE_REQUEST_V1",
  "requestId": "pc-update-<UUID>",
  "chatId": "chat-<UUID>",
  "operation": "controller-update",
  "controlRepository": "ansqhd5774-Choi/zgmini-pc-control",
  "targetControllerSha": "b77a333db9d3445394ff4267949a79b6054126cf",
  "approvalManifestSha256": "<the-exact-64-character-SHA256-of-raw-approval-file>"
}
```

3. GitHub Actions `pc-job.yml`은 **이 Issue를 실행하지 않는다**. 현재 사용자 Startup의 **독립** `ZGMINI_PC_MAINTENANCE.vbs`가 시작한 별도 Node 유지보수 프로세스가 GitHub Issues를 폴링한다. 이 프로세스는 기존 Supervisor·6개 Runner의 자식이 아니다.
4. 승인 manifest와 실제 설치 SHA를 비교해 `requestId` 원장에 기록한다. 기존 Runner 작업과 업로드가 끝날 때까지 기존 workflow 수신만 일시 중지한다. 이 기간 GitHub Issue는 남지만 `opened` 이벤트가 자동 재생되지 않으므로, 승인 창의 `pc-job` Issue를 조회해 기존 결과가 없는 요청은 **원본 7필드 본문 그대로** 한 번만 대체 Issue로 재등록하고 원래 Issue에는 연결 정보를 남긴다. 같은 requestId의 기존 Runner 원장이 중복 실행을 막는다. 등록 응답이 불확실하면 중복 재요청 없이 `RECOVERY_REQUIRED`. `queued`/`Offline`/작업 대기는 Core 장애가 아니다.
5. staging에서 정확한 Git SHA의 Controller/config 전체를 검산한다. 기존 controller/config/host를 버전별 스냅샷으로 백업하고 Core/Korea/Iran task/config 해시를 읽기 전용으로 기록한다. Supervisor PID·owner·boot·CIM 부모 트리를 검증한 뒤 **전용** Supervisor와 그 유휴 listener만 중단한다.
6. Controller/config/host를 지정 대상에서만 전환하고 자체 Supervisor를 다시 시작한다. 정확한 여섯 Runner 이름과 새 Supervisor SHA, Core 보호 해시를 확인한다. 승인 작업 수신을 재개한다.
7. manifest의 사후 고정 A급 검사 Issue를 단 한 번 만들고 `status/code/actualExecutionSha/lastPass/firstFail`을 자동 회수한다. `PASS`이며 실제 SHA가 목표 SHA와 같아야 업데이트 PASS. 결과는 별도 TXT/JSON과 `pc-maintenance` Issue 댓글로 회수한다.
8. 같은 `requestId`는 원장을 재사용하고, 통신 timeout·부분 전환은 실제 설치 SHA·원장·프로세스 상태를 먼저 조사한다. 원본 데이터/기존 Core lock/운영 DB/D1은 복구 대상이 아니다.

## 최초 연결 — 1회만, 운영자로 제한

**GitHub에 코드를 병합해도 PC 유지보수 프로세스는 자동 생기지 않는다.** 현재 PC에 독립 접수 진입점이 없으므로 최초 상태는 `AUTOMATION_BLOCKED`다. 이 한 번의 부트스트랩은 기존 A급 `pc-job`에 임의 명령을 싣는 방식으로 우회하지 않는다.

1. 로컬 실행 담당자는 현재 PC의 private 제어 저장소 `E:\ZGmini\projects\zgmini-pc-control`을 정규 `main` fast-forward로 동기화하고 **적용할 정확한40자 SHA**를 확인한다. 기존 `E:\ZGmini\automation\pc-control`의 controller/Runner는 건드리지 않는다.
2. 신규 파일의 Git blob 해시와 이 저장소 Node 테스트(`tests/maintenance-{contract,apply,agent}.test.mjs`) PASS를 대조한다. 새 도구 실행 자체는 B급 최초 설치 승인 범위이며, 관리자 권한 없이 현재 사용자 로그인 Startup 한 항목만 추가한다.
3. 현재 사용자 medium token에서 **한 번만** 실행한다. `SOURCE_SHA`는 1단계에서 확인한 실제 커밋 SHA로 대체한다.

```cmd
E:\ZGmini\runtime\node.exe E:\ZGmini\projects\zgmini-pc-control\tools\bootstrap-maintenance.mjs --source-sha SOURCE_SHA
```

4. 기대값 `BOOTSTRAP_STARTED`는 **프로세스 시작**의 증거이지 업데이트 완료 증거가 아니다. `E:\ZGmini\automation\pc-maintenance\MAINTENANCE_INSTALL.json`의 파일 해시, 독립 프로세스 소유자/부모 트리, 기존 6 Runner online, 기존 Core task/config 불변, `pc-maintenance` Issue 처리 후 댓글·TXT·JSON 확인까지 별도로 검증한다.
5. Startup은 현재 사용자 로그인 후 연결. 로그인 이전 Windows 서비스·관리자 변경은 하지 않는다. 기존 `ZGMINI_PC_CONTROL.vbs`와 Core/Korea/Iran Task는 그대로 둔다.

부트스트랩이 부분 실패하면 디렉터리 삭제·강제 재설치로 재시도하지 않는다. 파일 해시·Startup 존재·프로세스·원장을 확인해 정확한 장애 코드와 복구 기준을 확정한다.

## STOP 기준과 롤백

- `MAINTENANCE_PROCESS_NOT_INDEPENDENT`, 설치 SHA/목표 SHA/파일 해시 불일치, 기존 Runner busy·업로드 lease 존재, B 승인 부족, workflow가 기존에 비활성, Supervisor PID·owner 불일치: 설치 전 STOP.
- 전환 이후 6개 재연결 또는 고정 진단이 검증된 FAIL이면 버전 스냅샷을 먼저 검증하고 기존 source로만 롤백. 복구된 결과는 `ROLLED_BACK`이며 업데이트 성공으로 보고하지 않는다.
- 통신 timeout으로 사후 진단이 **아직 실행 중일 수 있으면** 해당 Runner를 중지하지 않는다. `RECOVERY_REQUIRED`로 기록하고 원장·실제 설치 SHA·Issue 댓글부터 대조한다. 동일 requestId 자동 재실행은 금지한다.
- 검증되지 않은 백업, 부분 설치, 실행기 소유자 불확실성에는 workflow를 비활성으로 유지한다. 기존 Core 예약/lock/SQLite/D1을 종료·삭제·초기화하지 않는다.

## 최초 Fear & Greed 진단 후속

PR #28의 `fear-greed-archive-status`는 GitHub 코드와 격리 테스트만 확인되었다. 최초 부트스트랩 후 **실제** 승인 업데이트 결과가 PASS가 되면 새 controller의 고정 진단을 한 번 실행한다. PC SQLite 아카이브와 Core Task XML/승인 실행기 연결은 읽기 전용이고, 관측 누락의 원인은 결과 증거만으로 판정한다. 데이터 복구·재수집·재게시·D1은 승인 범위 밖이다.
