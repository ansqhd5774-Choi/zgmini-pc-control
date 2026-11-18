# 공용 Controller 실패 예방·복구·재개

## #319 실제 복구 사례(2026-11-05 확인)

- 원본 [#319](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/319) `pc-update-9f22c05c-2735-4d63-81c8-b88c6d332d9a`는 **설치 완료가 아닌 사전검증 중단**이었다. 공식 Windows 독립 도구의 복구 전 `inspect`는 `ABORT_UNTOUCHED_ELIGIBLE`, 8/8 true, `operationalWrites=0`을 기록했다.
- 첫 공식 실행의 `RECOVERY_APPROVAL_UNCOMMITTED`는 승인 JSON의 Git blob과 Windows CRLF 체크아웃 바이트 불일치로 발생할 수 있는 사전검사 오류였다. `.gitattributes`의 `approvals/maintenance-recoveries/*.json text eol=lf`를 [PR #324](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/324)로 반영하고, 새 분리 worktree에서 원본 바이트 일치·fresh inspect를 통과한 **새 단회 실행**을 수행했다. 첫 실패 CMD를 그대로 반복하지 않았다.
- [복구 결과](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/319#issuecomment-6635620932): `ABORTED_UNTOUCHED` / `DEAD_PREVALIDATION_LEASE_ARCHIVED`, UTC `2026-11-04T16:10:25.084Z`, archive `pc-update-9f22c05c-2735-4d63-81c8-b88c6d332d9a-91e60677-9b52-4535-bf4a-95bdace558c7.lease`. 기존 Controller SHA `14940aa112494b1cea09ff5c7250f4af86a4ce6a`, `controllerChanged=false`, `originalRequestRetried=false`, `coreDbD1Writes=0`, `reportUpload=VERIFIED`.
- 이전 설치 lease는 보관됐지만 새로운 Controller 버전 설치·복구 후 Supervisor heartbeat/owner·6 Runner 신선도 검증은 **별도 단계**다. 당시 원본 update 결과와 복구 결과를 합쳐 설치 PASS로 표시하지 않는다. 다른 정상 업무가 #319 과거 이력을 매번 재검사하게 하지 않는다.

## 목적과 담당

모든 기능에 적용하는 공통 절차다. #68의 단일 복구 담당이 기존 실패 Issue와 requestId를 소유하고 상태·도구·해제 조건·후속 담당을 기록한다. 단순히 다른 담당자 대기라고 보고하지 않는다. 진단·개발·이미 가능한 읽기 전용 작업은 계속하고 공유 설치만 보류한다.

사용자의 2026-11-03 공통 필수 절차 상시 승인과 장애 예방/지침 이중 보완 지시를 적용한다. 복구 명세는 정확한 대상과 파일 해시를 고정하는 기술 기록이며 같은 범위의 재승인 요청이 아니다. Core 잠금·운영 DB·D1·다른 프로젝트는 대상이 아니다.

## 단계별 처리

| 관측 상태 | 다음 행동 | 재개 조건 |
|---|---|---|
| 설치 소유자 생존·상태 전진 | 기존 요청을 관찰, 새 설치 금지 | 실제 terminal 결과 |
| 사전검증 실패·기존 실행 정상 | BLOCKED, 첫 오류 수정 | 실제 SHA로 명세 갱신 |
| 설치 전 실패·소유자 종료·기존 Controller 바이트 동일·stage/backup/backlog 없음 | 아래 고정 도구로 inspect 후 정확한 복구 명세에 따라 abort-untouched | 원래 실패 기록 보존·lease 전체 보관·기존 Supervisor/Runner 정상 확인 |
| stage 또는 intake pause 흔적 존재 | 단계·backlog·실제 설치·백업 확인 | 무부작용 종료가 입증되거나 검증된 복구 결과 |
| 전환/부분 적용 | 기존 maintenance-apply의 검증 백업 복원 경로 확인, 실제 파일·프로세스·원장 대조 | ROLLED_BACK와 기존 버전 실행/보호/접수 검증 |
| 사후 진단/업로드 불명확 | 기존 Issue·postIssueNumber·원장·저장 결과 회수 | 실제 결과 확정. 실행 중 진단을 종료하거나 중복 요청하지 않음 |
| 증거 누락/변경/다른 설치 소유자 | RECOVERY_REQUIRED와 정확한 실패 체크 기록 | 부족한 체크만 확보. 임의 잠금 삭제 금지 |
| 새 실행기에서 사전검사 실패 후 변경 없음이 바이트·owner·intake·보호 상태로 입증 | `BLOCKED`/`PREVALIDATION_UNTOUCHED_VERIFIED`로 국소화, 원래 입력 수정 | 설치 lease 해제는 정확한 실행기 계약에 따라서만. 부분 변경/미입증은 `RECOVERY_REQUIRED` |

기존 자동 rollback이 실패한 부분 적용은 abort-untouched 대상이 아니다. 임의 파일 복사나 잠금 해제를 하지 않고 해당 실제 단계에 맞는 검증된 복구 구현을 보완한다. 표는 지원하지 않는 상태를 성공으로 바꾸는 권한이 아니다.

## 실제 공통 도구와 고정 인수

실행 파일은 `tools/maintenance-recovery.mjs`다. Windows 일반 사용자·Actions 밖에서 실행하며 운영 root는 도구 내부 고정값이다. 임의 CMD·SQL·root·다운로드 URL을 받지 않는다.

읽기 전용:

```text
E:\ZGmini\runtime\node.exe E:\ZGmini\projects\zgmini-pc-control\tools\maintenance-recovery.mjs inspect --request-id <기존요청ID> --source-sha <검증된도구커밋>
```

무변경 설치 취소 및 죽은 lease 보관:

```text
E:\ZGmini\runtime\node.exe E:\ZGmini\projects\zgmini-pc-control\tools\maintenance-recovery.mjs abort-untouched --request-id <기존요청ID> --source-sha <검증된도구커밋>
```

담당자는 실제 값을 채워 실행한다. 이 예시는 사용자가 SHA를 편집하라는 안내가 아니다. 현재 설치된 일반 pc-job에 이 도구가 있다고 가정하지 않는다. 승인된 직접 PC 수단으로 실행하고, 접근이 없으면 검증된 고정 CMD 패키지를 제공한다. 일반 작업에 임의 shell로 넣지 않는다.

복구 쓰기에는 `approvals/maintenance-recoveries/<기존요청ID>.json`의 커밋된 정확한 명세가 필요하다. schema=`ZGMINI_PC_RECOVERY_APPROVAL_V1`, approved=true, operation=`ABORT_UNTOUCHED`, requestId, issueNumber, sourceSha, installedSha, toolSha256, ledgerSha256, ownerSha256, markerSha256을 고정한다. 승인·source 바이트·Issue 요청·실제 해시·PID 종료·6좌석/lease 상태를 검증한다. 원래 요청은 재시도하지 않는다.

도구는 별도 원자적 복구 예약을 확보하고 증거/소유자 종료를 다시 확인한 다음 controller-install 디렉터리를 recovery 아래로 통째로 보관한다. Core 잠금이나 다른 lease는 이동하지 않는다. PREPARED/complete 기록과 원본 원장을 남기며 결과는 기존 실패 Issue에 자동 회수한다. 업로드만 실패하면 로컬 결과를 회수하며 복구를 반복하지 않는다. 예약이 남았거나 결과가 불명확하면 원본과 보관 위치부터 확인한다.

`ABORTED_UNTOUCHED`는 이전 설치 시도를 부작용 없이 취소하고 잠금을 보관했다는 뜻이다. Controller 업데이트 성공·Supervisor 정상·다음 요청 승인 완료를 뜻하지 않는다. 기존 watchdog의 정상 복구 후 fresh Supervisor heartbeat·정확한 소유자·6 Runner를 확인한다. watchdog도 실제 오류라면 원래 오류를 수정하며 전체 node 종료로 해결하지 않는다.

이 기준은 모든 A급 작업을 중단시키는 전역 자원 Gate가 아니다. 6개 Runner 전원 유휴·drain은 실제 Controller 교체 또는 현재 설치된 복구 실행기의 명시적 검사에 한정한다. 단순 조회·독립 수집/Reader·결과 회수는 경합 자원이 없으면 계속한다. 사전검증 무변경 증명 기능은 [Draft #322](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/322)의 검토안으로, 현행 PC에 설치되기 전까지 위 표를 사용해 **기존 상태를 임의 수정하지 않는다.**

## 실패 예방

### 부분 전환 중단의 명시적 rollback

이미 자동 rollback이 이전 Controller를 복원한 경우(예: #1841)는 같은 파일 복원을 반복하지 않는다.
기존 독립 `controller-rollback-recovery.mjs`의 정확한 승인/claim 경로에서, 전체 host.json과
snapshot 바이트 일치·현재 모든 Controller 해시·현재 Supervisor/6개 Runner·기존 보호 baseline을
다시 검증한다. 모두 일치하면 `RECOVERY_EXISTING_VERSION_VERIFIED`로 기존 프로세스를 유지하고
접수 재개와 기존 backlog 정합화만 마무리한다. 접수 쓰기 전에도 mutationStarted를 원장에
보존하여 응답 불명확 시 claim과 원본 lease를 유지한다. 원본 실패 ledger는 덮어쓰지 않는다.
미실행 backlog 요청은 기존 고유 replay 계약으로 처리하고, 취소된 과거 요청은 자동 재실행하지 않는다.

`tools/controller-rollback-recovery.mjs`는 설치 전 취소와 다른 고정 경로 복구 도구다. 기존 실패 요청을 재실행하지 않으며 원본 ledger를 덮어쓰지 않는다. BACKED_UP/SUPERVISOR_STOPPED/SWITCHED 단계는 원장·백업·보호 상태가 검증될 때만 복구 대상이다. **RECONNECTED 이후는 새 Controller와 접수 상태가 이미 살아 있을 수 있으므로 자동 백업 복원을 수행하지 않는다.** 이 단계는 먼저 기존 ledger의 실패 원인, 실제 설치 SHA, host.json의 누적 승인 등록, Supervisor/Runner, `pc-job.yml` 활성 상태와 backlog를 읽기 전용으로 대조한다. `INTAKE_RESUMED`/BACKLOG_RECONCILED/POSTCHECK_PENDING 이후도 기존 결과를 확정할 때까지 임의 롤백하지 않는다.

실행에는 `approvals/maintenance-recoveries/<기존요청ID>.rollback.json`의 커밋된 `ZGMINI_PC_ROLLBACK_APPROVAL_V1` 명세가 필요하다. approved, requestId, sourceSha, toolSha256, ledgerSha256, ownerSha256, markerSha256, snapshotHostSha256, protectionSha256과 files를 고정한다. files는 복구 도구/update/maintenance-apply/maintenance-contract/maintenance-lock 5개 파일의 path·sha256이다. Git source와 실제 바이트를 모두 대조한다. 기존 요청의 승인 manifest·요청자·열린 Issue도 재검증한다.

기존 소유자 종료, 별도 복구 예약, Windows 로그인 사용자 독립 계보, 저장된 PROTECTED_BEFORE.json, 현재 보호 상태, 백업 바이트 검증을 모두 통과해야 복구한다. 과거 백업에 보호 기준이 없으면 소급 생성하지 않는다. 복구 시작 전에 실패하면 자체 복구 예약만 해제하고 원래 설치 잠금은 보존한다. 복구를 시작한 뒤 실패하면 복구 예약·원래 잠금과 별도 결과를 보존한다. 검증된 이전 Supervisor·6좌석·보호 상태·접수 재개·backlog 회수 후에만 ROLLED_BACK으로 판정하고 원래 설치 lease를 보관한다.

고정 실행 형식은 `node tools/controller-rollback-recovery.mjs --request-id <원래ID> --source-sha <정확한도구SHA>`다. 담당자가 승인 명세를 채운다. 일반 pc-job 허용목록에 등록된 기능이 아니며, 도구 안전 거부를 우회하는 경로가 아니다. 이번 변경의 복구 시나리오는 격리 시험이며 실제 운영 rollback 완료 증거로 취급하지 않는다.

유지보수기 자체 인계에서는 새 파일/해시/권한/기존 origin proof를 먼저 검증한 뒤 협조 종료를 요청한다. 이미 시작 시 CAPTURE된 수신기는 exact PID·생성시각·SID·세션을 현재 IDENTIFY와 대조한다. 오래된 Explorer 부모 계보를 다시 요구하지 않되 저장 origin proof가 없거나 현재 identity가 다르면 중단한다. IDENTIFY만으로 새 수신기의 origin을 만들 수 없다. 신규 수신기는 기존 전체 CAPTURE 검증을 유지한다.

- update는 Supervisor owner/status와 현재 설치 바이트를 공유 install lease 획득 전에 읽기 전용 확인한다. 실제 validate에서도 재검증한다.
- intake pause를 시도하지 않은 실패에서 존재하지 않는 backlog를 요구하지 않는다. pause를 시도했다면 통신 ACK 실패를 포함해 원장을 반드시 대조한다.
- 상태머신은 failureOperation과 원래 code를 함께 남긴다. ENOENT만으로 대상 경로나 원인을 확정하지 않는다.
- 필요한 파일 누락, 프로세스 종료, nonce 변경, 부분 전환, 통신 단절, 업로드 실패, 중복 복구를 테스트한다. 시간 경과만으로 lease를 삭제하지 않는다.

## 재개와 인수인계

### #1501 RECONNECTED 접수 원장 정합 복구

`tools/controller-intake-recovery.mjs`는 고정된 #1501 및 #1745 사례를 지원하는 독립 Windows operator 경로다. 기본 CLI는 기존 #1501이며, #1745는 명시적으로 `--issue 1745`를 추가한다.
`inspect --source-sha <40자리 커밋>`으로 현재 바이트와 원격 JSON/TXT 영수증을 대조한다.
`apply`는 커밋된 `approvals/maintenance-recoveries/pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b.intake.json`의
source·의존 파일·ledger/owner/marker/backlog/host/보호 상태 해시가 모두 일치해야 실행된다.

- 기존 설치·Supervisor·Runner·Workflow·원본 ledger는 변경하지 않는다.
- #1503과 동일 operation/source의 #1517 실제 실행을 대체 영수증으로 보존하며 기능 결과 BLOCKED를 유지한다. 재생하지 않는다.
- #1508 성공 실행의 시작 시각은 접수 재개가 확인된 **상한 증거**이며 정확한 enable 시각으로 주장하지 않는다.
- 원본 backlog를 별도 보존하고 두 요청 처리 근거를 기록한 뒤, 원래 설치 lease 전체를 recovery 아래 보관한다.
- PREPARED 이후 실패하면 claim·원본 lease·단계 기록을 보존한다. 같은 명령 재실행이나 자동 롤백은 금지한다.
- 이 복구는 신규 Controller 설치·사후 검사·W01 Event129 원인 규명 성공이 아니다.

원래 잠금이 이미 없거나 다른 담당자가 복구했다면 `NO_ACTIVE_INSTALL_LEASE`와 기존 보관 결과를 대조한다. 이를 새 복구 성공으로 보고하거나 도구를 다시 적용하지 않는다. #106은 2026-11-03T10:54:42Z의 사용자 실PC 보관 결과가 Issue 댓글에 등록됐고, 이후 새 Supervisor/정상 watchdog 상태를 확인했다. 이 과거 성공을 현재 모든 lease가 없다는 보장으로 사용하지 않는다.

1. 원래 실패 요청은 terminal 이력으로 보존하고 recovery 결과를 연결한다.
2. 실패 원인을 수정하고 현재 실제 설치 SHA에서 대상까지의 diff·manifest를 다시 검증한다.
3. 복구/정상 실행 확인 후 새 고유 요청 ID로 승인된 갱신을 한 번 제출한다. 새 요청에 원래 실패/복구 링크를 남긴다.
4. 갱신·재연결·보호 검사·사후 진단·TXT/JSON/댓글을 회수해 각각 보고한다.
5. #68의 대기 항목 담당에게 실제 SHA와 사용 가능한 모듈을 인계한다. 이미 설치된 기능은 중복 설치하지 않는다.

구현·격리 Windows 시험·실PC 읽기 전용 확인·실제 lease 복구·유지보수기 설치·GitHub 자동 갱신 재개는 별도 증거다. 코드 저장만으로 자동 복구가 설치됐다고 보고하지 않는다.

### #1745 RECONNECTED 접수 원장 정합 복구

설치 SHA가 실제 목표와 일치하고 Workflow가 active여도, 과거 ledger의 resumeIntake 실패와 열린 backlog 때문에 공유 설치 lease는 남을 수 있다. 이를 Controller 미설치 또는 Runner 전체 장애로 보고 재설치하지 않는다. 과거 실패 ledger는 원본 증거로 보존하며 성공으로 덮어쓰지 않는다.

- 고정 요청: pc-update-45b549d0-f233-40eb-9075-02942c25f8cd, 실제 유지할 Controller e3a495c97d6b40d6d4eea2ff4f586bef46216eb7.
- inspect/apply --source-sha <검증 커밋> --issue 1745: 기존 독립 Windows operator만 사용한다. 실행 파일·의존성 Git 바이트와 커밋된 정확한 승인 명세를 검증한다.
- #1747의 원본 요청·봇 댓글 내 JSON·저장 JSON/TXT를 교차 검증한다. 실제 PASS 시작 시각은 접수 재개의 상한 증거이며 정확한 enable 시각이 아니다. 해당 구간 pc-job 전체 검색 결과가 정확히 #1747 한 건이고 이미 실행됐을 때만 재생 없이 backlog를 닫는다.
- 현재 Controller/유지보수기 건강·6개 전용 Runner·Workflow active·보호 상태·종료된 원 소유자·ledger/owner/marker/backlog/host 원본 해시가 모두 일치해야 한다. 누락/추가 요청·진행 중 실행·소유자 재생존·바이트 변화가 있으면 적용하지 않는다.
- 기존 공통 transaction으로 원본 backlog 백업, 정합화된 backlog 재조회, 전체 install lease 보관을 수행한다. 원본 ledger는 그대로 두고 별도 complete 영수증으로 복구를 판정한다. 중간 실패는 원본/claim/단계 증거를 유지하고 재실행하지 않는다.
- Controller/Workflow/예약/DB/D1/공급자 호출/원본 요청 재실행은 변경 0이다. 이 복구는 W03 신규 검사기의 설치 또는 68단계 완료를 뜻하지 않는다. 복구 후 새 모듈이 필요한 담당자는 실제 설치 SHA에서 누적 diff와 정확한 별도 설치 manifest를 준비해 기존 정상 B 경로를 사용한다. 독립 기능은 이 공유 설치 상태를 전역 Gate로 삼지 않는다.

### #1979 INTAKE_RESUMED 이후 잘못된 backlog 요청

Controller 실제 목표 5492726bb5b0505b7ff7db73a3c673dabdf724ce, Workflow active 및 6개 Runner 건강과 별도 #1985 PASS를 확인해도 #1979 원본 ledger는 실패 이력으로 보존한다. tools/controller-1979-backlog-recovery.mjs는 정확한 원본 바이트/승인 해시로 고정된 #1981 한 건만 대상으로 한다. 기존 경로를 만족하지 않는 writer-updates 승인 문서를 writer-preimage 문서처럼 허용하지 않는다.

원본 pause window는 이미 닫혔다. 전체 구간 검색이 #1981 한 건이고 현행 검사기로 부적합이 확인될 때 REJECTED_INVALID_ORIGINAL/PREIMAGE_MANIFEST_PATH를 backlog에 기록한다. 원본 Issue/본문은 수정하지 않고 재생하지 않는다. 기존 공통 transaction의 원본 backlog 백업·현재 보호 재검증·install lease 전체 보관·독립 결과 재조회 및 정확한 커밋 승인 manifest를 그대로 적용한다. 이는 원본 #1979 설치 성공 판정이 아닌 접수 정합 복구다. inspect/apply --source-sha <고정 source>로 구별하며 apply는 현재 사용자 공통 제어 lease 복구 승인 범위에서만 수행한다.

재발 방지 source: update.mjs의 classifyBacklogOriginal은 관측 가능한 잘못된 JSON/계약을 실행 금지의 명시적 terminal rejection으로 분리한다. 검증을 완화하지 않고 body SHA와 실패 코드를 원장에 남긴 뒤 다른 정상 요청의 처리를 계속한다. 내용이 바뀌었거나 관측 불명확한 경우는 중단한다. 이 source 수정은 유지보수기 자체의 정규 정책 인계 전까지 운영 적용된 것으로 간주하지 않는다.
