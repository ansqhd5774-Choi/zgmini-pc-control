# 설치 전 실패 코드 소실 및 Supervisor 관리 불일치

## 확인된 사실

- #118/#120은 업데이트 ledger·stage·backup이 없고 Controller는 e38c6acd로 유지됐다. 이 사실만으로 최초 실패 원인을 확정하지 않는다.
- 설치된 maintenance-agent는 apply 자식이 exit 1이면 stdout의 고정 오류 코드를 버리고, terminal ledger가 없을 때 UPDATE_OUTCOME_UNKNOWN으로 정규화했다.
- 직접 읽기 전용으로 #120 패키지와 제한된 환경변수의 패키지 검증은 PASS였다.
- 새 무변경 preflight에서 SUPERVISOR_NOT_HEALTHY / PRE_INSTALL을 재현했다. 현재 Supervisor의 children은 0개, 전용 6개 Listener는 이전 부모가 없는 상태였다. Supervisor의 새 실행은 기존 세션과 충돌해 반복 종료된 로그가 있다. 최초 부모 종료를 유발한 행위는 미확정이다. 현재 재현을 과거 #118/#120의 저장되지 않은 원본 오류와 동일하다고 단정하지 않는다.
- 기존 automation-status는 Supervisor heartbeat와 GitHub Online만 확인해 이 불일치를 HEALTHY로 표시했다.

## 수정

1. 유지보수기 자식 실패에서는 검증된 stdout JSON의 대문자 고정 code만 보존한다. 임의 stdout/stderr는 결과에 복사하지 않는다.
2. PRE_INSTALL 명시와 원장 없음·잠금 없음·조회 오류 없음이 모두 확인돼야 BLOCKED로 판정한다. 불명확한 단계나 timeout은 UNKNOWN으로 유지하고 재실행하지 않는다. terminal 원장이 있으면 해당 원장이 우선이다.
3. update.mjs preflight는 패키지·Supervisor·설치 파일 검증만 수행한다. lease·stage·backup·설치 요청을 생성하지 않는다. apply와 같은 사전검사를 사용한다.
4. automation-status는 Supervisor의 살아 있는 고유 6좌석도 확인한다. 원격 Online만으로 제어 프로세스 정상 판정을 하지 않는다.

## 제어 프로세스 복구 원칙

해당 저장소의 idle Listener만 정확한 실행 경로·PID·생성 시각으로 확인한다. 다른 프로젝트 Listener, 실행 중 Worker, Core 작업을 건드리지 않는다. GitHub busy·로컬 작업 lease·설치 lease·보호 해시를 재확인한다. watchdog PAUSE와 Controller DRAIN으로 경쟁 재시작을 막은 뒤, 승인된 제어 프로세스만 정리한다. 종료 직후 WMI에 보이는 항목은 다시 종료하지 않고 실제 종료를 재조회한다. 종료 입증 후 Supervisor lease는 보관하며 삭제하지 않는다. 임시 PAUSE/DRAIN은 본인 소유 바이트가 맞을 때만 해제한다.

watchdog이 기존 승인 Controller로 새 Supervisor와 좌석을 재생성하게 한다. GitHub의 이전 세션이 만료되기 전 Conflict 재시도가 있을 수 있다. 로컬 프로세스·로그가 전진하는 동안 관찰 timeout만으로 실패나 재시작 사유로 삼지 않는다. 6개 fresh 관리 좌석·GitHub Online·보호 해시·무변경 preflight PASS를 각각 확인한다.

기존 실패 Issue와 원장은 덮어쓰지 않는다. 원인 해소 후 새 요청이 필요하면 실제 설치 SHA와 기존 manifest를 다시 확인하고 단일 적용 담당이 정확히 한 번 접수한다. B 게시·D1·Reader 배포는 별도 업무 단계다.

## 적용 증거

- 오류 전달 수정 source: 904b7e39e007f55980a748be45126da52fbd514a. 독립 유지보수기 실PC 인계 PASS.
- Windows 관련 12개 시험 파일 147/147 PASS. 후속 전체 경로 회귀시험 추가 후 agent/status 37/37 PASS.
- 실제 복구 완료 여부는 results/COMMON_SUPERVISOR_RECOVERY_20261103.json의 관측 상태를 따른다. 코드 병합이나 로컬 좌석 시작만으로 GitHub 재연결 완료를 주장하지 않는다.
