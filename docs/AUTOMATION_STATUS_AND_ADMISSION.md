# 공통 상태 조회와 접수 실패 분류

## 현재 상태 조회

`tools/automation-status.mjs`는 고정 PC 경로·GitHub read API만 읽는다. Controller 바이트, 설치된 operation 이름, Supervisor PID/identity/fresh heartbeat, 실제 Runner6개, workflow, 활성 install lease를 요약한다. `--request-id <기존ID>`를 주면 그 원장의 과거 상태를 별도로 표시한다. 요청·업데이트·DB/D1·공급처 호출은 실행하지 않는다.

```text
E:\ZGmini\runtime\node.exe E:\ZGmini\projects\zgmini-pc-control\tools\automation-status.mjs
```

출력 schema는 `ZGMINI_PC_AUTOMATION_STATUS_V1`다. `observedAt`/`freshnessSeconds`를 표시한다. 설치/정지 직전 과거 snapshot을 현재값으로 재사용하지 않는다. Runtime 상태와 `intakeToolPermission=NOT_TESTED_BY_PC_STATUS`를 구분한다. GitHub CLI 읽기 성공이나 건강한 Runner는 다른 일반챗의 쓰기 도구 권한 증거가 아니다.

이 도구는 승인된 직접 PC 수단에서 실행한다. 설치된 일반 pc-job 허용목록에 자동 등록됐다고 주장하지 않는다. 일반챗이 직접 PC 접근을 못 하면 현재 허용된 read-only adapter 또는 원본 실PC 결과를 이용하고 관련 없는 동일 진단을 반복하지 않는다. 장기적으로 상태 collector의 고정 어댑터 등록/자동 발행은 별도 설치 검증 대상이며 이 문서만으로 구현됐다고 보고하지 않는다.

## 접수 단계별 처리

| 단계 | 확인·대응 |
|---|---|
| 도구 미연결/읽기권한 없음 | 해당 도구 접근 문제로 한정, PC 실패로 확대하지 않음 |
| schema 오류 | 제출 전 정확한 인수 수정. 생성 여부가 불명확하면 기존 requestId 조회 |
| 도구 안전 검사 거부 | 거부 원문·행동·사유 확보, 차단 행동을 다른 명령/도구로 우회하지 않음. 허용되는 준비·분석은 계속 |
| 생성 timeout/응답 유실 | Issue/requestId 조회로 실제 생성 여부 대조, 중복 제출 금지 |
| Issue 존재/PC 미접수 | 현재 receiver·활성 잠금·접수 원장 확인 |
| 실행 실패 | 실패 단계·실제 설치·부작용으로 복구 runbook 분기 |
| 결과 업로드 실패 | 설치/계산 재실행 대신 로컬 원장·기존 결과·댓글 회수 |

외부 도구 안전 정책은 저장소 문서로 해제할 수 없다. 자동 검사가 거부했는데 이유를 확보하지 못한 경우 원인 미확정으로 보고한다. 코드 수정이나 사용자 상시 승인을 거부 해제 성공으로 표현하지 않는다.

## 공통 기능의 변경 경계

설정/승인된 adapter로 가능한 업무는 기존 공통 엔진을 사용한다. 신규 adapter가 실행 코드라면 exact source·테스트·최소 허용 범위·자원 제한을 검증한다. 이것을 임의 원격 코드 실행 허용으로 구현하지 않는다. 모듈별 설치 분리의 구현 여부를 실제 코드로 확인하며, 아직 공유 Controller 설치가 필요하면 #68의 단일 적용으로 처리한다.

복구 코드와 이 runbook은 기능 공통 기준이다. 현재 설치된 유지보수기에 예방 코드가 들어갔는지는 설치 manifest와 실제 파일 해시로 별도 확인한다. 특정 작업의 소스 병합이나 테스트 성공으로 이를 대체하지 않는다.
