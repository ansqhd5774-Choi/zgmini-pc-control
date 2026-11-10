# #996 원본 Windows 읽기 전용 진단 R1

## 현재 범위

- 프로세스 총괄 단일 담당. 원본 `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`, Controller #996만 고정한다.
- 실제 설치 실패: `RECOVERY_REQUIRED`, `FIRST_FAIL=INTAKE_PAUSED`, `RUNNER_SET_DRIFT`. 기존 #917 복구 완료 증거를 다시 수행하지 않는다.
- `tools/controller-996-windows-observer.mjs`는 Windows **기존 원본 운영 PC**의 고정 `E:/ZGmini`만 읽는다. 신규 격리 PC·블로그 Runner·일반 `pc-job`으로 우회 실행하지 않는다.
- `tools/RUN_996_READONLY_ONCE.cmd`는 실행 스크립트와 같은 폴더에 둔다. `%TEMP%`에 결과 텍스트 **1개**만 쓰고 메모장으로 연다. 운영 E:의 파일·Workflow·Task·잠금·원장은 쓰거나 삭제하지 않는다.
- 진단에 필요한 Node 위치는 `E:\ZGmini\runtime\node.exe`, GitHub CLI는 `C:\Program Files\GitHub CLI\gh.exe`, 기존 제어 소스 checkout은 `E:\ZGmini\projects\zgmini-pc-control`이다. GitHub 로그인 자격은 기존 설치 설정을 이용하며 출력하지 않는다.

## 출력의 검증 한계

1. 기존 원장/Owner/Recovery marker/Backlog/Stage Host/설치 Host/유지보수 manifest 원시 JSON 바이트 SHA-256을 2회 읽고 drift를 검출한다. Supervisor owner도 2회 대조한다. 동적으로 갱신되는 Supervisor heartbeat를 불변 파일로 가정하지 않는다.
2. 설치·Stage·유지보수 파일을 2회 읽고 로컬 manifest와 **각각 해당 Git source commit의 실제 바이트**에 대조한다. 6 전용 Runner만 정확히 1회씩 online/idle이어야 하며 다른 독립 Runner는 별도 계수한다. 사후 C 실행은 별도 원자적 재확인이 필요하다.
3. `process.kill(pid,0)`의 존재 검사 외에 프로세스 종료·시작이 없다. Stage, snapshot, 복구 예약, Supervisor status, 원본 GitHub Issue, Workflow 현재 상태, Core/Korea task와 Writer 파일의 **현재 해시만** 읽는다.
4. `disabled_manually`만으로 **Workflow 중단 행위자**를 확정할 수 없다. Stage-only에는 `PROTECTED_BEFORE.json`이 없을 수 있다. 이 두 항목은 `false`/`null`로 출력해 복구 C 사전조건을 **미입증**으로 유지한다. 현재 보호 해시를 이전 상태라고 소급 표기하지 않는다. 기존 backlog의 `DONE` 기록은 원격 JSON/TXT 결과 2개를 재조회한 증거가 아니다.
5. 출력에는 **원장 원문, 인증키, GitHub Issue body, owner PID·nonce, 보호 파일 내용**을 넣지 않는다. 개인 정보·전체 로그를 첨부하지 않는다. 출력 상태가 `C_EVIDENCE_GAPS`이면 복구 실패도 성공도 아니라 추가 증거가 필요한 상태다.

## 단회 실행과 인계

1. **기존 원본 Windows 운영 PC에서만** 안전하게 ZIP을 해제하고 `RUN_996_READONLY_ONCE.cmd`를 **1회** 실행한다. 새 PC에서는 실행 금지.
2. 메모장에 표시되는 구조화 결과를 총괄 담당자에게 전달한다. `STATE_UNKNOWN`, GitHub 접근 실패, 파일 변경 발견 등이라면 다른 스크립트로 우회하거나 재실행하지 않는다.
3. 담당자는 검증된 실PC 증거를 #996/중앙 #68에 한 번 연결하고, missing pre-pause baseline/Workflow actor를 어떤 **기존 신뢰 가능한 원본**으로 확정할 수 있는지 검토한다.
4. 실제 C 실행기를 별도로 구현·시험하고, 정확한 효과·사전 해시·단회 중단 규칙이 고정된 **명시적 C 사용자 승인**을 받고 나서만 기존 Workflow와 lease에 영향을 줄 수 있다. 현 진단 패키지는 승인이나 복구 도구가 아니다.

이 원본 파일과 `controller-996-backlog-plan.mjs`는 원본 요청을 복제 게시하지 않으며, 동일 `requestId`로 새 `pc-job`을 제출하지 않는다. backlog 내 고유 요청의 결과/사실 확인 후 새로운 범위의 필요 작업은 **새 고유 요청**으로 재계획한다.
