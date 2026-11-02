# Controller 자동 갱신 — 별도 유지보수 진입점

## 신뢰·실행 경계

- **기존 controller/6개 Runner는 업데이트 요청을 접수하거나 자신을 업데이트하지 않는다.** 별도의 `ZGMINI-PC-Control-Maintenance` Windows 작업이 로그인 사용자 `LIMITED` 권한으로 1분마다 짧게 실행된다. 추가 Runner·호스팅 서버·Artifact·캐시는 없다.
- 일반챗은 private 제어 저장소에 label `pc-controller-update`인 Issue를 만든다. 일반 `pc-job` JSON/허용목록과 분리되며, 임의 CMD·경로·URL은 불허한다.
- 최초 연결 전에는 이 label/작업을 쓸 수 없다. `AUTOMATION_BLOCKED`로 표시하고 [한 번의 별도 부트스트랩](#최초-연결-1회) 후에만 자동 업데이트 요청을 보낸다.
- GitHub `main` 병합만으로 승인되지 않는다. **현재 설치 SHA, 목표 커밋, 모든 변경 파일과 SHA-256, 승인 근거, 테스트 증거, 복구 조건을 함께 잠근 명세**가 별도 필요하다.
- `ONE_TIME_MAINTENANCE_BOOTSTRAP` 승인은 설치된 유지보수 설정의 `approvedBootstrapTargetSha`와 정확히 같을 때에만 허용한다. 이후 일반 A급 `A_READONLY_CONTROLLER`은 제한된 파일 경로만 허용하며, B급 운영·공급자·SQLite·D1·관리자 권한 변경은 불허한다.

## 작업 계약

Issue 본문은 Markdown 코드 블록이 아닌 **정확한 JSON 객체**다. 아래는 형식 예시이며 SHA/해시는 실제 커밋에서 읽어 채운다.

```json
{
  "schema":"ZGMINI_PC_CONTROLLER_UPDATE_V1",
  "requestId":"update-unique-uuid",
  "chatId":"chat-stable-session",
  "controlRepository":"ansqhd5774-Choi/zgmini-pc-control",
  "installedSha":"40-character-installed-source-sha",
  "targetSha":"40-character-approved-target-sha",
  "approval":{
    "approvalId":"approved-unique-id",
    "scope":"A_READONLY_CONTROLLER",
    "basis":"사용자 승인 근거와 제한된 진단 변경 설명 (15~300자)",
    "approvedBy":"ansqhd5774-Choi"
  },
  "changedFiles":[{"path":"controller/example.mjs","sha256":"64-character-file-sha256"}],
  "tests":{
    "status":"PASS","sourceSha":"40-character-approved-target-sha",
    "passed":3,"failed":0,"evidence":"검증된 해당 커밋의 검사 로그 및 PR"
  },
  "recovery":{
    "backup":"HASHED_CONTROLLER_CONFIG_HOST",
    "partialFailure":"STOP_AUDIT_BEFORE_RETRY"
  }
}
```

일반 A급 허용 파일: `controller/*.mjs`, `config/operations.json`, `tests/*.test.mjs`, `docs/*.md`, `README.md`, `AGENTS.md` 중 고정 정규식에 맞는 파일만. 초기 유지보수 부트스트랩 범위는 별도로 묶인 `maintenance/*.mjs`, `tools/{install,update,bootstrap-maintenance}.mjs`, `.github/workflows/pc-job.yml`까지 정확한 파일 해시가 검증되어야 한다. `results/`의 **추가된** 기존 결과 파일만 검증 diff에서 제외하며, 수정·삭제는 불허한다. 삭제/이름 변경/그 외 모든 파일은 차단한다.

이 정책은 파일 경계와 승인 출처를 검증하는 것이지 새 코드의 무해함을 자동으로 증명하지 않는다. 코드 리뷰·실제 테스트 증거가 없거나 공개 사이트·운영 데이터가 바뀌는 요청은 일반 A급으로 승격하지 않는다.

## 상태·원장

1. 유지보수 Task가 해당 label의 **열린 Issue만** 조회하고 작성자와 정확한 계약을 검증한다.
2. 작업별 `requestId` 원장에 파일+payload SHA를 기록한다. 같은 ID의 내용 변경은 `DUPLICATE_REQUEST_PAYLOAD_CHANGED`, 동일 요청은 선행 결과 재사용.
3. 목표 커밋이 private `origin/main`의 조상인지 확인하고 실제 `git diff` 파일 각각의 SHA-256을 명세와 대조한다. 로컬 checkout/운영 source는 임의 교체하지 않는다.
4. 기존 Runner6, Actions queued/in-progress, 전용 leases를 확인한다. 대기라면 `WAITING_FOR_IDLE`을 유지하고 다음 Task 실행에서 재확인한다. Core/Korea/Iran lock은 건드리지 않는다.
5. `APPLYING`을 **업데이트 실행 전에 디스크 원장에 저장**한다. 기존 `tools/update.mjs`의 고정 경로와 정확한 `ZGMINI_CONTROL_UPDATE_TARGET_SHA`만 전달한다. 유지보수 Task는 Runner/Supervisor의 하위 프로세스가 아니다.
6. 업데이트 도구는 자체 workflow 중지, 재검사, task/config/host 백업과 해시 readback, 독립 Supervisor 종료·재연결, 보호 hash 대조, workflow 재활성화를 수행한다. 자기 자신이 실행 중인 Actions job을 종료하지 않는다.
7. `APPLIED_PENDING_REPLAY`에서 업데이트 중 생성돼 결과가 없는 `pc-job` Issue에만 `pc-job-replay` label을 붙인다. 기존 workflow의 `labeled` 경로가 원래 requestId를 실행하며 동일 ID 원장으로 중복 실행을 차단한다. 원본 Issue·요청 본문은 변경하지 않는다. GitHub Actions의 `GITHUB_TOKEN`으로 만든 일반 label 이벤트는 workflow 실행을 유발하지 않으므로, 이 재개 작업은 PC에 미리 인증된 **독립 `gh` 사용자 인증**으로 수행하며 실제 이벤트 수신을 검증한다.
8. 결과 JSON·TXT를 private `results/controller-update-{requestId}`에 기록하고 Issue 댓글에 내용을 포함한다. 업로드 불확실성은 결과 확인 후 재회수; 설치는 재실행하지 않는다.

`APPLYING` 상태에서 프로세스나 통신이 끊기면 설치된 SHA·manifest·6개 Runner·보호 hash·workflow 상태를 재감사한다. 전부 검증된 경우에만 재실행 없이 게시·대기 요청 재개를 진행한다. 부분 상태나 출처 불확실 시 `UPDATE_OUTCOME_UNCERTAIN_NO_RETRY`로 정지하고 백업을 점검한다. 업데이트 도구의 `UPDATE_STOP`은 자동 재실행하지 않는다. 검증된 백업 없이 롤백/성공 판정하지 않는다.

## 최초 연결 1회

이 저장소의 코드와 기존 6개 Runner는 **최초 유지보수 Task 자체를 PC에 만들 수 없다**. 현재 설치되지 않았다면 이를 코드 병합만으로 해결했다고 주장할 수 없다.

로컬 실행 담당자는 승인·검사된 private main 커밋을 checkout에 fast-forward 반영하고, 정확한 승인 SHA로 다음 한 번의 설치 도구를 실행한다. 이 명령은 일반 작업 Issue/Runner에 넣지 않는다.

```cmd
git -C "E:\ZGmini\projects\zgmini-pc-control" pull --ff-only origin main
"E:\ZGmini\runtime\node.exe" "E:\ZGmini\projects\zgmini-pc-control\tools\bootstrap-maintenance.mjs" <승인된_최초_40자리_SHA>
```

- 일반 사용자 medium token, 기존 `E:\ZGmini\automation\pc-control-maintenance`와 같은 이름의 Task가 없어야 한다.
- 설치기는 기존 controller/Runner를 교체하지 않고 별도 유지보수 프로그램 3개와 `LIMITED` Scheduled Task **1개만** 생성한다.
- 기대값 `MAINTENANCE_BOOTSTRAP_INSTALLED`; 실패하면 `AUTOMATION_BLOCKED`, 단계·코드·잔존 자기 Task를 조사하고 무조건 재실행하지 않는다.
- 최초 연결 후 GitHub `pc-controller-update` Issue로 승인된 목표 SHA 적용 → 결과 JSON/TXT/댓글 → `fear-greed-archive-status` 실PC 실행까지 별도 확인해야 **자동화 완료**다.
- 관리자 권한이나 GitHub 인증이 부족하면 상승 실행/비인가 명령 우회 없이 중단한다.

## 중단·복구

- 유지보수 Task만 일시 정지: Windows 작업 스케줄러의 `ZGMINI-PC-Control-Maintenance`를 **Disable**. 기존 여섯 Runner·Core 예약은 그대로 둔다.
- Controller 자체 업데이트 실패는 기존 설치본의 `host.json`, `SUPERVISOR_STATUS.json`, `backups/controller-*`의 **해시가 검증된 한 세트**를 먼저 감사한다. 단순 `git reset`, 전체 프로세스 종료, lock 삭제, SQLite 재생성으로 복구하지 않는다.
- 신규 Issue가 Workflow disabled 구간에 들어오면 원본 Issue는 GitHub에 보존된다. 독립 유지보수가 복구되기 전까지 강제로 재실행하거나 임의 폐기하지 않는다.
- `UPDATE_STOP`/업데이트 불확실성은 정확한 실패 단계, `controlWorkflowDisabled`, 설치 SHA와 6개 Runner 상태를 확인한 후에만 별도 복구 승인 범위를 결정한다.
