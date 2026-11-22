# 092 Core Runtime Source 인증

## 현재 운영 완료 증거 — 2026-11-22 KST

- Controller [#2652](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2652):
  d260aea2513902a77425344629f91575e2d950ef, SUCCEEDED 및 보호 상태 불변.
- 시작 인증 1파일 [#2658](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2658):
  WRITER_B_INSTALLED_VERIFIED, 실제 승인 소스 91b0e5a602883b9d3ee61310281957d3cdd23f11.
  수집·산식·게시 실행 파일 6개와 Task XML·VBS는 변경되지 않았다.
- 설치된 092의 실제 Windows 직접 조회에서 숨김 Task GUID→WMI Node→승인 소스 인증 PASS.
- 자연 실행 0a720a19-139c-461c-8375-9d1a2ec0457c, 09:20:03~09:24:17 KST:
  시작 Task 인증·수집 COMPLETE·Writer PUBLISH/VERIFIED·Core COMPLETE 연결 PASS.
  기존 Writer가 저장 응답 17행을 기록했다. 진단 자체의 공급자/DB/D1 쓰기는 없다.
- [JSON 영수증](../results/core092-installed-runtime-lineage-20261122.json)과
  [TXT 영수증](../results/core092-installed-runtime-lineage-20261122.txt)의 원격 바이트를 재조회했다.
  Runner 6개 Online, pc-job active, 설치 Lease held=false를 확인했다.

과거 #2604 및 후속 #2656의 idle 시점 STATE_UNKNOWN은 그대로 보존한다.
이미 확보한 위 실제 실행·완료 결과를 idle 자동화 결과 때문에 취소하거나 같은 A를 반복하지 않는다.
이는 092 출처·결과 연결 완료이며 모든 업무 데이터의 품질 완료를 의미하지 않는다.

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
- live 검사기의 collectionWriterSameCycleVerified=false는 해당 순간 조회에서
  완료 결과 계보를 평가하지 않았음을 명시한다. 완료된 자연 실행은 기존
  tools/core092-completed-lineage-readonly.mjs가 세 checkpoint의 공통 ID,
  승인 SHA·시작 Task 인증·실행 파일 해시·시간·실제 게시 결과로 별도 검증한다.
  실행 중 증거와 완료 결과 증거의 범위를 섞지 않는다.
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
