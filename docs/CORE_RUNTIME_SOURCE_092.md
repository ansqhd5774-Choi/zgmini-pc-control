# 092 Core Runtime Source 인증

## 확인된 원인과 수정 범위

2026-11-21 실PC에서 Core Task의 Hidden=true, 실행 중 State=4인데
GetInstances(0)=0인 사례를 확인했다. 같은 시각 공식
TaskService.GetRunningTasks(1)은 정확한 Core Task 경로·실제 InstanceGuid와
EnginePID를 반환했고, WMI 부모 계보가 실제 Core Node로 연결됐다.

기존 GetInstances(0)을 먼저 사용하고, 미관측일 때만 공식 숨김 포함 조회를
사용한다. 정확한 Core 경로·RUNNING 상태·GUID·PID와 기존 WMI 검증을
유지하며 Korea·다른 Task·접근 거부를 성공으로 대체하지 않는다.
Task 설정, 권한, 이벤트 채널, Core 실행·수집 주기는 변경하지 않는다.

## PASS와 미인증 범위

- 실제 Task 인스턴스→WMI Core Node→canonical 실행 경로를 증명한다.
- 실제 Git HEAD와 승인 config.source, Core/Collector/Writer/collection-events
  4개 실행 관련 파일을 Git blob과 비교한다. 정상 Windows CRLF checkout은
  실제 Git 설정·속성을 확인하고 raw SHA와 Git blob SHA를 각각 기록한다.
  임의 편집·사용자 필터·source/승인 변경은 성공으로 처리하지 않는다.
- runtimeSourceVerified는 위 실행/출처 범위다. 기존 체크포인트의 시간 근접만으로
  수집·Writer·게시가 동일 cycle이라고 판정하지 않는다.
- collectionWriterSameCycleVerified=false는 전체 결과 계보 미인증을 명시한다.
  Task가 종료된 정상 idle 시점에는 기존 UNKNOWN을 유지하며 고장이나
  소스 손상으로 확대하지 않는다. 같은 idle 진단을 반복 제출하지 않는다.

## 검증과 운영 적용

Node fixture는 숨김 작업·다른 Task·GUID/PID·경로·source/승인 변경·파일 편집·
Git 줄바꿈·Korea 구분·조회 종료를 검증한다. fixture PASS는 실PC가 아니다.
정규 Controller 설치 뒤 실제 자연 실행 중 고유 A 결과 JSON/TXT를 회수한다.
기존 설치 #2602와 결과 미확정 #2604는 이력으로 보존하고 재실행하지 않는다.
Writer/원자료/SQLite/D1·Task 강제 실행·새 예약은 이 수정의 효과가 아니다.

공식 API 근거:
- https://learn.microsoft.com/en-us/windows/win32/taskschd/taskservice-getrunningtasks
- https://learn.microsoft.com/en-us/windows/win32/taskschd/registeredtask-getinstances
