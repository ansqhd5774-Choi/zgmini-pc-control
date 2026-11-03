# 공용 Controller 실패 예방·복구·재개

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

## 실패 예방

### 부분 전환 중단의 명시적 rollback

`tools/controller-rollback-recovery.mjs`는 설치 전 취소와 다른 고정 경로 복구 도구다. 기존 실패 요청을 재실행하지 않으며 원본 ledger를 덮어쓰지 않는다. BACKED_UP/SUPERVISOR_STOPPED/SWITCHED/RECONNECTED 단계만 대상으로 한다. POSTCHECK_PENDING 이후는 기존 결과 확인으로 돌리고 rollback하지 않는다.

실행에는 `approvals/maintenance-recoveries/<기존요청ID>.rollback.json`의 커밋된 `ZGMINI_PC_ROLLBACK_APPROVAL_V1` 명세가 필요하다. approved, requestId, sourceSha, toolSha256, ledgerSha256, ownerSha256, markerSha256, snapshotHostSha256, protectionSha256과 files를 고정한다. files는 복구 도구/update/maintenance-apply/maintenance-contract/maintenance-lock 5개 파일의 path·sha256이다. Git source와 실제 바이트를 모두 대조한다. 기존 요청의 승인 manifest·요청자·열린 Issue도 재검증한다.

기존 소유자 종료, 별도 복구 예약, Windows 로그인 사용자 독립 계보, 저장된 PROTECTED_BEFORE.json, 현재 보호 상태, 백업 바이트 검증을 모두 통과해야 복구한다. 과거 백업에 보호 기준이 없으면 소급 생성하지 않는다. 복구 시작 전에 실패하면 자체 복구 예약만 해제하고 원래 설치 잠금은 보존한다. 복구를 시작한 뒤 실패하면 복구 예약·원래 잠금과 별도 결과를 보존한다. 검증된 이전 Supervisor·6좌석·보호 상태·접수 재개·backlog 회수 후에만 ROLLED_BACK으로 판정하고 원래 설치 lease를 보관한다.

고정 실행 형식은 `node tools/controller-rollback-recovery.mjs --request-id <원래ID> --source-sha <정확한도구SHA>`다. 담당자가 승인 명세를 채운다. 일반 pc-job 허용목록에 등록된 기능이 아니며, 도구 안전 거부를 우회하는 경로가 아니다. 이번 변경의 복구 시나리오는 격리 시험이며 실제 운영 rollback 완료 증거로 취급하지 않는다.

유지보수기 자체 인계에서는 새 파일/해시/권한/기존 origin proof를 먼저 검증한 뒤 협조 종료를 요청한다. 이미 시작 시 CAPTURE된 수신기는 exact PID·생성시각·SID·세션을 현재 IDENTIFY와 대조한다. 오래된 Explorer 부모 계보를 다시 요구하지 않되 저장 origin proof가 없거나 현재 identity가 다르면 중단한다. IDENTIFY만으로 새 수신기의 origin을 만들 수 없다. 신규 수신기는 기존 전체 CAPTURE 검증을 유지한다.

- update는 Supervisor owner/status와 현재 설치 바이트를 공유 install lease 획득 전에 읽기 전용 확인한다. 실제 validate에서도 재검증한다.
- intake pause를 시도하지 않은 실패에서 존재하지 않는 backlog를 요구하지 않는다. pause를 시도했다면 통신 ACK 실패를 포함해 원장을 반드시 대조한다.
- 상태머신은 failureOperation과 원래 code를 함께 남긴다. ENOENT만으로 대상 경로나 원인을 확정하지 않는다.
- 필요한 파일 누락, 프로세스 종료, nonce 변경, 부분 전환, 통신 단절, 업로드 실패, 중복 복구를 테스트한다. 시간 경과만으로 lease를 삭제하지 않는다.

## 재개와 인수인계

원래 잠금이 이미 없거나 다른 담당자가 복구했다면 `NO_ACTIVE_INSTALL_LEASE`와 기존 보관 결과를 대조한다. 이를 새 복구 성공으로 보고하거나 도구를 다시 적용하지 않는다. #106은 2026-11-03T10:54:42Z의 사용자 실PC 보관 결과가 Issue 댓글에 등록됐고, 이후 새 Supervisor/정상 watchdog 상태를 확인했다. 이 과거 성공을 현재 모든 lease가 없다는 보장으로 사용하지 않는다.

1. 원래 실패 요청은 terminal 이력으로 보존하고 recovery 결과를 연결한다.
2. 실패 원인을 수정하고 현재 실제 설치 SHA에서 대상까지의 diff·manifest를 다시 검증한다.
3. 복구/정상 실행 확인 후 새 고유 요청 ID로 승인된 갱신을 한 번 제출한다. 새 요청에 원래 실패/복구 링크를 남긴다.
4. 갱신·재연결·보호 검사·사후 진단·TXT/JSON/댓글을 회수해 각각 보고한다.
5. #68의 대기 항목 담당에게 실제 SHA와 사용 가능한 모듈을 인계한다. 이미 설치된 기능은 중복 설치하지 않는다.

구현·격리 Windows 시험·실PC 읽기 전용 확인·실제 lease 복구·유지보수기 설치·GitHub 자동 갱신 재개는 별도 증거다. 코드 저장만으로 자동 복구가 설치됐다고 보고하지 않는다.
