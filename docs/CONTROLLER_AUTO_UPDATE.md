# 승인된 PC Controller 자동 갱신 — 독립 유지보수기

## 2026-11-05 위험도별 적용 기준 및 #319 복구

[원본 #319](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/319)의 2026-11-04 사전검증 실패는 공식 독립 Windows 복구 도구로 `ABORTED_UNTOUCHED`/`DEAD_PREVALIDATION_LEASE_ARCHIVED`까지 검증됐다. 기존 Controller `14940aa112494b1cea09ff5c7250f4af86a4ce6a`의 바이트를 바꾸거나 원본 요청을 재실행하지 않았으며 Core/DB/D1 쓰기도 0건이었다. [복구 결과 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/319#issuecomment-6635620932). **설치 실패 잠금의 복구이지 신규 Controller 설치 성공은 아니다.** 복구 이후 Supervisor 소유자·heartbeat·필요 Runner 증거는 실제 조회로 별도 확인한다.

위험도와 공유 자원 범위로 검사를 선택한다. 독립 A급 조회나 일반 작업의 결과 회수에는 전체 Runner 유휴·Controller 교체 검사·전역 dirty 검사를 요구하지 않는다. 승인된 설정/adapter 등록은 실제 영향 파일과 계약을 집중 검증한다. **Controller 실행 파일을 교체할 때만** 해당 drain·보호 백업·실제 설치 SHA·6 fresh Runner·사후 검사 계약을 적용한다. 현재 설치된 실행기가 더 엄격하면 정규 개선·설치 전까지 그 검사를 우회하지 않는다.

### 검토 중인 설치 효율 개선(미설치)

| 개선 | 의도 | 현재 적용 상태 |
|---|---|---|
| 비설치 파일 dirty 제외 | 현재 영향받는 Controller/config·workflow/scripts·승인 경로만 설치 충돌 검사 | Draft #321, 운영 미설치 |
| 단계별 실패 코드 | `failureOperation`과 안전한 stage 코드로 원인을 국소화 | Draft #321, 운영 미설치 |
| SHA 간 누적 diff 계획 | 정확한 목표 바이트로 승인 초안 생성, 승인 자체는 아님 | Draft #321, 운영 미설치 |
| 사후 A 목록 중앙화 | `core-status`·`source-audit`·`fear-greed-archive-status` 계약 일치 | Draft #321, 운영 미설치 |
| 1024MiB moderate 후보 | 신규 읽기 작업만 별도 승인과 실측 후 등록 | Draft #321, 운영 미설치 |

[Draft #322](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/322)는 prevalidation 단계의 무변경을 실측으로 증명할 때에만 `BLOCKED`/`PREVALIDATION_UNTOUCHED_VERIFIED`로 분류하는 추가 보완안이다. 현재 코드가 `RECOVERY_REQUIRED`를 내보낸 상황을 문서만으로 재분류하거나 lease를 직접 지우지 않는다. 두 Draft의 테스트 성공·코드 병합·유지보수기 인계·Windows 실설치·Runtime 반영을 분리해 판정한다.

## 2026-11-03 공통 장애 보완 운영 적용 증거

유지보수기 source `aabc345b86c5aa4c6af23c57b2d1eedca876b4a7`의 정상 종료/인계와 신규 receiver origin을 실Windows에서 확인했다. 공통 자원 프로필, 설치 전 실패 예방, 현재/과거 잠금 분리 코드가 실제 설치 파일 해시와 일치한다. Controller `e38c6acd…` 바이트·Core/Korea/Iran 보호 해시 불변, Runner6개 Online을 확인했다. [원본 증거](../results/COMMON_MAINTENANCE_HARDENING_20261103.json). 이 기록은 당시 실측이며 현재 설치 상태를 영구 고정하지 않는다. R17/R6/ER1 기능 설치·실행·D1 게시 성공을 뜻하지 않는다. 아래 #44와 c96d 기록은 이전 성공 이력이다.

여러 담당자의 변경이 누적된 적용은 [공용 적용 대기열 운영 방침](CONTROLLER_APPLY_QUEUE.md)을 먼저 따른다. 정확한 통합 manifest 또는 순차 적용으로 조정하며, 개별 승인·파일 해시·기존 설치 보호 검사는 그대로 유지한다.

상태 (2026-11-03 KST): **실PC PASS.** [업데이트 #44](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/44) → Controller `b77a333…` → 새 Listener 6개 → [진단 #45](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/45) PASS → TXT/JSON/댓글 회수 완료. 유지보수기 source는 `c96d4ac…`이며 [실측 정본](PC_AUTOMATION_RUNTIME_20261103.json)을 참조한다. 아래의 과거 최초 연결 기록은 재설치 지시가 아니다.

## 정체성과 승인 경계

- 제어 저장소: `ansqhd5774-Choi/zgmini-pc-control`, `main`.
- 2026-11-02 실PC에서 마지막으로 관측한 설치 Controller SHA: `c491d95fdb594a729f08deff68d86e04c18a9544` ([Issue #31](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/31)). 현재 설치 상태는 갱신 전 `status`로 다시 확인한다.
- PR #28 Fear & Greed 진단의 병합 SHA: `b77a333db9d3445394ff4267949a79b6054126cf`. **최신 main SHA와 같다고 가정하지 않는다.** 최초 승인 파일은 `approvals/controller-updates/b77a333db9d3445394ff4267949a79b6054126cf.json`.
- 원본 A급 `pc-job` Issue의 7필드 계약은 그대로 둔다. `controller-update`를 그 안에 추가하지 않는다. 임의 CMD/SQL/다운로드 URL/경로를 받지 않는다.
- 신규 `pc-maintenance` Issue는 **갱신 요청**일 뿐 자동 승인 근거가 아니다. 별도 B급 승인 manifest의 raw SHA-256과 실제 설치 SHA, merged PR, Git 이력과 변경 파일별 해시를 모두 확인한다.
- Controller 실행 파일 갱신은 현재 계약상 **모두 명시적 B급 승인 manifest**가 필요하다. 운영 source·DB/D1·게시·스케줄은 이 경로로 갱신할 수 없다.
- **기존 안전 정책은 유지한다.** 6좌석, `mutationsEnabled=false`, 기존 operation 정의, actor/source 및 공통 설정 필드는 이전 설치값과 완전히 같아야 한다. 기본 갱신은 A/light·90초 이하만 허용한다. 중량 읽기 전용 등록은 기능명별 새 예외 대신 아래 공통 승인 프로필을 사용한다. 현재 설치 버전의 지원 여부는 실제 파일로 확인한다.

## 공통 자원 프로필

새 heavy 등록은 manifest의 purpose=`pc-controller-heavy-readonly`, B scope=`PC_CONTROL_HEAVY_READONLY_UPDATE`를 사용한다. 요청 envelope에 임의 권한 필드를 추가하지 않는다. 이 프로필은 A/heavy·240초·최소 가용 1536MiB의 **현재 검증된** 자원 계약을 재사용하며, 동시 heavy 수·actor·기존 operation·쓰기 비활성 정책을 변경하지 않는다. 여러 기능명을 같은 프로필로 검증하므로 기능을 추가할 때마다 유지보수기 코드를 바꾸지 않는다. 다른 자원 등급은 별도의 공통 프로필 검증 대상이며 임의 숫자를 허용하지 않는다. 위 moderate 후보를 기존 heavy에 소급 적용하지 않는다.

기존 `employment-r6-readonly-adapter` 목적의 manifest는 과거 한정 계약 호환으로 보존한다. 이를 신규 기능의 공통 승인으로 사용하지 않는다. 실행기 등록은 정확한 소스/파일 해시/테스트/승인 manifest를 계속 요구하며, 프로필 승인만으로 임의 모듈을 실행하지 않는다.

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
5. staging에서 정확한 Git SHA의 Controller/config 전체를 검산한다. 기존 controller/config/host를 버전별 스냅샷으로 백업하고 Core/Korea/Iran task/config 해시를 읽기 전용으로 기록한다. Supervisor PID·owner·boot·WMI 부모 트리를 검증한 뒤 **전용** Supervisor와 그 유휴 listener만 중단한다. 부모 조회는 해시가 고정된 Windows Script Host/VBScript로만 수행하고 PowerShell/WSL은 실행하지 않는다. 조회가 불완전하면 즉시 중단한다.
6. Controller/config/host를 지정 대상에서만 전환하고 자체 Supervisor를 다시 시작한다. 정확한 여섯 Runner 이름과 새 Supervisor SHA, Core 보호 해시를 확인한다. 승인 작업 수신을 재개한다.
7. manifest의 사후 고정 A급 검사 Issue를 단 한 번 만들고 `status/code/actualExecutionSha/lastPass/firstFail`을 자동 회수한다. Runner의 `actualExecutionSha`는 **Controller** 목표 SHA와, `requestedSourceSha`는 별도 **공개 진단 코드** SHA와 각각 일치해야 한다. Core 보호 해시와 Runner 여섯 좌석도 독립 재확인해야만 업데이트 PASS다. 결과는 별도 TXT/JSON과 `pc-maintenance` Issue 댓글로 회수한다.
8. 같은 `requestId`는 원장을 재사용하고, 통신 timeout·부분 전환은 실제 설치 SHA·원장·프로세스 상태를 먼저 조사한다. 원본 데이터/기존 Core lock/운영 DB/D1은 복구 대상이 아니다.

유지보수기 수신기와 갱신 실행기는 각각 독립적인 원자적 lease를 사용한다. 긴 갱신 중에도 승인된 6개 유지보수 파일(고정 WMI 진단 VBS 포함)의 설치 SHA-256을 실행 직전에 다시 검증한다. 설치 결과가 불확실할 때 install lease를 복구 대기 상태로 유지하므로 다른 요청이 같은 Controller를 교체하지 않는다. 임의 자동 잠금 삭제·재설치는 금지한다.

## 최초 연결 이력 — 재설치 금지

2026-11-03 로컬 담당자가 유지보수기 `c2458c73…`의 설치와 실행을 확인했다. 아래 절차는 **미설치 당시 승인된 최초 1회 설치 계약의 역사적 기록**으로 보존하며, 현재 PC에서 다시 실행하라는 뜻이 아니다. 설치 확인과 프로세스 독립성 PASS는 별개다. `MAINTENANCE_PROCESS_NOT_INDEPENDENT` 또는 출처 증거 불충분인 동안 새 `pc-maintenance` Issue를 생성하지 않는다. PR #37은 병합됐고, 후속 Windows 출력·인증·재연결 보완 및 정상 종료 인계를 거쳐 현재 실PC 갱신이 완료됐다. 최초 c245 실행의 UNKNOWN은 과거 이력으로 보존하며 현재 상태에 적용하지 않는다.

동일 범위의 A급 `pc-job` 기존 증거([Issue #38](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/38), [Issue #39](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/39))를 반복 요청하지 않는다. `PASS / CORE_READONLY_DIAGNOSIS`, 실제 Controller SHA `c491d95fdb594a729f08deff68d86e04c18a9544`, Core/Korea/Iran task hash 불변은 **Controller 업데이트 PASS가 아니다**. 업데이트 전 새로 필요한 PC 진입점은 설치된 독립 유지보수기의 출처·부모 체인 read-only 검증이며, 허용목록 우회나 `pc-job`의 임의 명령은 금지한다.

## 과거 최초 연결 절차 — 미설치 당시 1회만, 운영자로 제한

**GitHub에 코드를 병합해도 PC 유지보수 프로세스는 자동 생기지 않는다.** 당시 독립 접수 진입점 부재는 `AUTOMATION_BLOCKED`였으며, 현재는 위 실PC PASS 증거로 대체됐다. 이 한 번의 부트스트랩은 기존 A급 `pc-job`에 임의 명령을 싣는 방식으로 우회하지 않는다.

1. 로컬 실행 담당자는 현재 PC의 private 제어 저장소 `E:\ZGmini\projects\zgmini-pc-control`을 정규 `main` fast-forward로 동기화하고 **승인된 정확한 40자 SHA**를 확인한다. 이후 `main`에 신규 결과 TXT/JSON만 추가됐다면 해당 승인 SHA를 그대로 사용할 수 있지만, 코드·설정 변경이 있으면 부트스트랩을 차단한다. 해당 SHA의 부트스트랩/실행기/테스트 파일과 현재 worktree의 해시가 일치해야 한다. 기존 `E:\ZGmini\automation\pc-control`의 controller/Runner는 건드리지 않는다.
2. 신규 파일의 Git blob 해시와 이 저장소 Node 테스트(`tests/maintenance-{contract,apply,agent,lock}.test.mjs`) PASS를 대조한다. 새 도구 실행 자체는 B급 최초 설치 승인 범위이며, 관리자 권한 없이 현재 사용자 로그인 Startup 한 항목만 추가한다.
3. 현재 사용자 medium token에서 **한 번만** 실행한다. `SOURCE_SHA`는 1단계에서 확인한 실제 커밋 SHA로 대체한다.

```cmd
E:\ZGmini\runtime\node.exe E:\ZGmini\projects\zgmini-pc-control\tools\bootstrap-maintenance.mjs --source-sha SOURCE_SHA
```

4. 기대값 `BOOTSTRAP_STARTED`는 **프로세스 시작**의 증거이지 업데이트 완료 증거가 아니다. `E:\ZGmini\automation\pc-maintenance\MAINTENANCE_INSTALL.json`의 파일 해시, 독립 프로세스 소유자/부모 트리, 기존 6 Runner online, 기존 Core task/config 불변, `pc-maintenance` Issue 처리 후 댓글·TXT·JSON 확인까지 별도로 검증한다.
5. Startup은 현재 사용자 로그인 후 연결. 로그인 이전 Windows 서비스·관리자 변경은 하지 않는다. 기존 `ZGMINI_PC_CONTROL.vbs`와 Core/Korea/Iran Task는 그대로 둔다.

부트스트랩이 부분 실패하면 디렉터리 삭제·강제 재설치로 재시도하지 않는다. 파일 해시·Startup 존재·프로세스·원장을 확인해 정확한 장애 코드와 복구 기준을 확정한다.

## STOP 기준과 롤백

- `MAINTENANCE_PROCESS_NOT_INDEPENDENT`, 설치 SHA/목표 SHA/파일 해시 불일치, **실제 교체 직전** 기존 Runner busy·업로드 lease 존재, B 승인 부족, workflow가 기존에 비활성, Supervisor PID·owner 불일치: 해당 Controller 설치 단계 STOP. Runner busy는 독립 A급 조회·소스 계획·읽기 전용 사전검사의 전역 차단 조건이 아니다. 현재 실행기의 더 엄격한 판단은 검증된 새 버전 설치 전까지 우회하지 않는다.
- 전환 이후 6개 재연결 또는 고정 진단이 검증된 FAIL이면 버전 스냅샷을 먼저 검증하고 기존 source로만 롤백. 복구된 결과는 `ROLLED_BACK`이며 업데이트 성공으로 보고하지 않는다.
- 통신 timeout으로 사후 진단이 **아직 실행 중일 수 있으면** 해당 Runner를 중지하지 않는다. `RECOVERY_REQUIRED`로 기록하고 원장·실제 설치 SHA·Issue 댓글부터 대조한다. 동일 requestId 자동 재실행은 금지한다.
- Workflow disable 직후 승인 확인 응답이 유실될 수 있으므로, 실제 Workflow 상태를 다시 조회한다. 상태가 비활성 또는 불확실하면 `BLOCKED/workflowEnabled=true`로 잘못 보고하지 않고 `RECOVERY_REQUIRED`로 남긴다. 부모 프로세스 정보 조회 실패도 독립 유지보수 실행 성공으로 간주하지 않는다.
- 검증되지 않은 백업, 부분 설치, 실행기 소유자 불확실성에는 workflow를 비활성으로 유지한다. 기존 Core 예약/lock/SQLite/D1을 종료·삭제·초기화하지 않는다.

## 최초 Fear & Greed 진단 후속

PR #28의 `fear-greed-archive-status`는 실제 업데이트 #44의 자동 사후 진단 #45에서 PASS했고 결과가 회수됐다. 같은 source·환경의 유효한 이 결과는 재사용한다. 이 사후 진단에서 PC SQLite 아카이브와 Core Task XML/승인 실행기 연결은 읽기 전용이고, 관측 누락의 원인은 결과 증거만으로 판정한다. 데이터 복구·재수집·재게시·D1 쓰기는 이 진단의 범위 밖이며, 다른 업무의 별도 승인까지 금지하는 공통 제한이 아니다.

## 검증된 Windows 실행·인계 규칙

- Startup은 기다리는 WScript에서 Node를 실행하며, Explorer를 통해 시작해 임시 bootstrap 부모 종료와 분리한다. 출처는 살아 있는 WScript·생성 시각·동일 사용자/세션과 source/Startup 해시로 증명한다.
- WSH 증명 출력에는 `cscript //NoLogo`를 사용한다. `//B`는 실제 Windows에서 증명 출력을 비워 버려 제거됐으며 Windows 회귀시험이 있다.
- Startup의 GitHub CLI는 해당 Windows 사용자 보안 저장소 인증을 사용한다. 다른 도구에서의 인증 성공만으로 대체하지 않는다. 토큰을 CMD·파일·로그에 담지 않는다.
- `tools/handoff-maintenance.mjs --source-sha <승인된 SHA>`는 승인 파일·해시·백업을 확인하고 기존 수신기의 협조 종료 또는 종료 입증 후 전환한다. 살아 있는 수신기를 강제 종료하거나 원장을 지우지 않는다.
- 수신기는 `RECEIVER_STATUS.json`에 폴링 상태와 오류 코드를 남긴다. 승인된 `STOP_REQUEST.json`은 PID·nonce·source와 일치하고 갱신 작업이 없을 때만 정상 종료시킨다.
- 재연결은 최대 10분의 bounded 대기이며 GitHub Online뿐 아니라 새 Listener 로그 6개와 연속된 상태 확인이 필요하다. 오래된 서버 세션과 일시 Offline을 즉시 실패로 판정하지 않는다.
- 새 읽기 전용 모듈은 `controller/<소문자-이름>.mjs`와 정확한 승인 manifest·Git diff·파일 해시로 추가한다. 파일명을 유지보수기에 매번 하드코딩하지 않는다. 범용 목적은 `pc-controller-maintenance`, 승인 scope는 `PC_CONTROL_CONTROLLER_UPDATE`다. 기존 operation·6좌석·운영 쓰기 비활성 정책은 보존한다.
- 새 모듈의 실제 실행 성공은 Controller 갱신/기존 Core 사후 검사와 별개다. 새 operation 자체의 결과도 확인한다.
