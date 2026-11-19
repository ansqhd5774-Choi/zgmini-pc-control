# ZGMINI — 일반챗·CMD·PC Runner 공통 작업 지침

2026-11-19 실행 효과 중심 개정 정본. 승인된 업무는 마지막 유효 완료점부터 계속한다. 이 문서는 공통 규칙이며 특정 기능의 미완료 조건을 다른 업무에 확대하지 않는다. 같은 목적의 과거 규칙과 충돌하면 현재 사용자 지시와 이 정본의 적용 범위를 우선한다.

## 1. 목적과 정본

제어 저장소는 ansqhd5774-Choi/zgmini-pc-control, 기준은 main이다. 신규 대화는 AGENTS.md, README.md, 이 문서와 GENERAL_CHAT_START.md의 필요한 범위를 확인한다. 같은 대화에서는 관련 변경이나 상충 증거가 없으면 다시 전수 조회하지 않는다.
운영 PC PC와 격리 PC DESKTOP-N62L0NG의 경로·Runner·권한을 구분한다. 실제 호스트 기준은 [PC 운영 정본](PC_OPERATING_SYSTEMS_CANONICAL.md)이다. Remote Desktop Commander는 ZGMINI에 사용하지 않는다.
기능 원담당은 소스·수집·계산·저장·게시·UI 완료를 맡고, 총괄은 공통 Controller/Runner/Writer/자원/승인·인계 계약의 결함과 공유 운영 적용을 맡는다. 사용자 직접 지시로 범위를 인수한 경우 원장에 정확히 기록한다.

## 2. 일반 작업 실행

작업 이름이나 A/B 문자만 보지 말고 실제 효과를 확인한다.

| 실행 효과 | 필요한 검증 | 전체 선행조건으로 확대하지 않을 것 |
|---|---|---|
| 등록된 고정 순수 조회 | 허용 operation·요청·scope·현재 읽기 결과 | 무관한 과거 복구·활성 Core 계보·다른 대화 ACK |
| 격리 계산·시험 | 고정 입력·출력 격리·자원·실행 범위 | 운영 설치·운영 게시 승인 |
| 공급자 수집 | 승인된 공급처·권리·한도·checkpoint | 다른 공급처/기능의 성공 |
| Controller/Writer 설치 | 정확 manifest·원본/후보 해시·공유 lease·백업·인계·복원 | 독립 기능 전체의 완료 |
| DB/D1 게시·배포 | 해당 업무 승인·정확 대상·CAS/동등성·readback·복구 | 단순 코드 병합·HTTP 200 |
| 복구 | 정확 원본 요청·현재 단계·변경 효과·검증된 복구 계약 | 과거 사건의 상태를 현재값으로 복사 |

순수 조회 예외는 설치된 실행기가 명시적으로 지원하는 고정 operation에만 적용한다. Issue에 임의 effect나 shell·SQL·경로·명령을 넣어 권한을 확대하지 않는다.
조회가 성공해도 보호 확인이 실패하면 읽기 결과와 보호 미확인을 따로 보고한다. READONLY_RESULT_PROTECTION_UNVERIFIED는 시스템 정상이나 쓰기 승인 PASS가 아니다. 실제 보호 drift·예기치 않은 작업 재등록·무결성 오류는 계속 차단한다.
현재 설치된 허용목록/schema에 맞는 Issue를 고유 chatId/requestId로 한 번 접수하고 status/code/lastPass/firstFail·실제 실행 SHA·TXT/JSON·원본 댓글을 회수한다. 요청 UUID/접두사는 실제 계약으로 검증한다.
원격 source, 실제 Controller source, PC 운영 HEAD/config.source, 검사 대상 source를 구분한다. 파일 존재·해시 확인에 현재 실행 중 Core의 전체 계보를 새 필수조건으로 붙이지 않는다.
동일 source·환경·효과의 유효한 실PC 증거는 재사용한다. 미지원 작업은 기존 공통 실행기에 최소 명세/모듈을 등록·검증한다. 임의 원격 스크립트로 우회하지 않는다.

### 공통 프로세스 총괄 — 요청 가능 업무·접수·작업 회신 (2026-11-17)

총괄 지원 범위는 공통 실행·Runner, Controller 진단/설치·복구, Writer 수신/manifest, 공유 자원, 공통 결과 회수, 승인 계약, 인계 경로다. 기능별 산식·ETF 선정·데이터 공개 결정은 원담당에게 유지한다.
기존 agent-handoff Issue의 ZGMINI_AGENT_HANDOFF_V1과 원본 요청·실패·source·checkpoint를 사용한다. 중앙 #68 직접 인계도 별도 접수 원천이며 고유 업무로 중복 제거한다.
접수 → 후보 → 실제 인수 → 작업 → 결과 반환 → 원담당 재개를 구분한다. 후보 선정은 인수/실행이 아니다. 이미 선정된 미인수 건도 OWNER_ACTION_REQUIRED로 유지한다.
현재 담당자가 인수했으면 기존 ACKNOWLEDGED → WORKING 영수증을 확인하고 승인 행동을 수행한다. 자동 연결 확인이 안 된다는 이유로 이미 인수한 작업을 사용자 재전달 대기로 돌리지 않는다.
중개기 고정 NOT_CONFIGURED는 별도 중앙 AI 처리자의 실제 활성 상태를 조회한 값이 아니다. 자동 AI·다른 대화 자동 재개는 실제 증거 없으면 미검증으로 보고한다.
소스 수정 결과는 기존 PR/CI 결과 계약으로 반환한다. **코드 수정 없는 고정 읽기 진단**은 ZGMINI_AGENT_HANDOFF_DIAGNOSIS_V1로 검증된 PC Issue/Run·JSON/TXT를 반환한다. 진단을 반환하려고 무의미한 PR을 만들지 않는다.
진단 영수증은 해당 조회의 증거이며 사건 근본 해결·운영 쓰기·원담당 채팅 수신을 승인하지 않는다. 상세 [중앙 인계 계약](AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md).

## 3. 연결 장애와 자동 복구

Runner Online, Job 배정, 단계 시작, Controller 실행, 실제 기능 PASS, 결과 반환은 별개다. queued/timeout/도구 접근 실패만으로 PC 기능 실패를 확정하지 않는다.
기존 요청의 Run/attempt·실제 Runner·원장·checkpoint부터 확인한다. 종료된 read-only 요청의 내부 로그가 없다는 이유로 현재 유효한 승인 읽기를 전역 금지하지 않는다. 새 조회는 같은 ID 재실행이 아니며 현재 scope·정상 경로를 확인한 고유 요청 한 번으로 한다.
쓰기·공급자 호출·부분 적용·활성 lease·자식 종료 불명확에는 이 읽기 재개 기준을 확대하지 않는다. 실제 설치·원장·저장값을 먼저 대조한다.
Offline이면 Issue를 반복하지 않고 기존 Supervisor/watchdog/guardian·heartbeat·실제 생존과 원장을 확인한다. PID나 오래된 파일만으로 정상 판정하지 않는다.
사용자 로그인 기반 시작의 한계를 유지한다. PC 전원 꺼짐·로그인 전은 코드 장애가 아니다. 기존 복구 계약 [RUNNER_RECOVERY](RUNNER_RECOVERY.md), [CONTROLLER_RECOVERY](CONTROLLER_RECOVERY.md)를 적용하며 Core lock 삭제·전체 node 종료·무조건 재설치는 하지 않는다.

## 4. PC 직접 접근이 없는 경우

기존 Runner·독립 유지보수기·승인된 PC 도구를 우선한다. 설치된 환경을 다시 설치하지 않는다. 도구 미연결을 PC 장애로 판단하지 않는다.
사용자 실행이 꼭 필요하면 기존 검증 도구를 호출하는 실제 CMD/ZIP을 제공한다. 명령 복사·파일 작성·경로/SHA 편집을 사용자에게 요구하지 않는다.
목적·준비 상태·실행 위치·일반 권한·정확히 한 번·정상값·STOP·금지 행동·보낼 결과를 안내한다. 비민감 TXT와 자동 회수를 우선한다. Windows 미검증 도구를 검증된 운영 도구로 표현하지 않는다. 파일 제공이 불가능하면 정확한 도구 한계를 밝힌다.

## 5. 상시 승인과 안전한 업데이트

사용자가 승인한 업무의 필수 공통 등록·격리 복원·최소 실행 정책·Controller/Writer 설치·유지보수기 인계는 정확한 효과 범위에서 재승인 없이 수행한다. 게시·배포·관리자/보안 변경은 그 업무 승인 범위를 따른다. 코드 병합이나 도구 접근 권한이 업무 승인을 대신하지 않는다.
현재 설치 → 정확 목표·파일별 해시·raw manifest 해시·검사·백업/복구 조건을 확정한다. 누적 diff와 allowFiles가 다르면 승인되지 않은 변경을 끼워 넣지 말고 정규 최소 목표 commit/manifest 또는 승인된 순차 적용을 준비한다.
Controller는 독립 pc-maintenance로 갱신한다. 일반 pc-job이 실행 중인 자기 Controller를 교체하지 않는다.
기존 작업/업로드 종료 → 요청 보존 → 검산한 백업 → 승인 파일 적용 → 전용 Runner 재연결 → 보호 검사 → 기능별 사후 검사 → 결과 회수 순서로 진행한다. 접수/backlog도 중복 없이 회수한다.
유지보수기 자체 첫 인계는 별도 계약을 따른다. 출처 증거를 소급 생성하거나 UNKNOWN을 PASS로 바꾸지 않는다. Startup 환경의 실제 GitHub 인증을 확인하며 비밀값은 공식 저장소 밖으로 내보내지 않는다.

### Writer B의 Core 유지보수 창 확보 (2026-11-19)

기존 정확 Writer B manifest에 coreMaintenance=PAUSE_NEW_STARTS_DRAIN_360S_V1과 원본 Task XML SHA를 고정하면 후보 준비 → 신규 예약 시작 억제 → 현재 실행 정상 drain → quiet 확인 → 기존 source/config CAS → 원본 Task 복원/readback을 사용한다.
현재 실행을 강제 종료하거나 lock을 삭제하지 않는다. 360초 내 drain 미확인 시 설치 없이 원상 복원·재조회한다. 중간 종료·부분 실패는 정확 journal/claim/lease·원본을 보존하고 지원되는 복구로 대조한다.
실제 #2234 설치, #2235 3파일 해시/HEAD=config.source, #2236 Core 원본 XML·lock 부재로 검증됐다. 이 승인된 유지보수 모드는 과거 #1919의 특정 HOLD와 구분되며 옛 HOLD를 현재 모든 설치에 적용하지 않는다.
모드가 없는 과거 승인서는 기존 자연 유휴 경로를 유지한다. 현재 실제 preimage를 담은 새 manifest·새 ID로 진행하고 기존 실패를 replay하지 않는다. [Writer B 실행 절차](../writer-b/README.md).

## 6. 동시 작업과 변경 범위

사용자의 현재 단독/병렬 방침을 따른다. 6 Runner는 동시 실행 의무가 아니다. 요청/작업폴더/TEMP/출력/원장은 분리하고 실제 겹치는 공유 쓰기만 자원별 lease로 직렬화한다.
공용 Controller/Writer/Core checkout 변경은 #68의 적용 담당 한 명이 현재 SHA·승인·순서·결과를 조정한다. 담당 미지정·경합 없음이면 현재 작업자가 범위를 기록하고 조정을 맡는다. 원장 댓글은 PC lease가 아니다.
중량 여부와 메모리 기준은 실제 operation의 시간·RSS/가용 RAM·동시 사용·입력 규모로 판단한다. 기존 승인값은 검증 전 임의로 낮추지 않는다. 단순 관측 시간을 메모리 사용량으로 간주하지 않는다. resource=light/heavy를 보안 권한과 혼동하지 않는다.
memory/lease 대기는 해당 자원 범위에 한정한다. 오래 걸려도 checkpoint/processed count가 전진하면 RUNNING이다. bounded chunk/resume를 사용하고 처음부터 반복하지 않는다.

## 7. 보호와 실패 처리

원본·목표 해시, 중복/충돌 검증, 요청 단회성, 실제 공유 쓰기 잠금, 백업·복구, 게시 CAS/readback은 유지한다. 특정 사건·기능의 추가 조건을 공통 안전 요건으로 승격하지 않는다.
Core/Korea, 다른 프로젝트 Runner, 운영 source·원자료·산식·SQLite/D1·수집/게시 주기·예약·배포·DNS는 별도 승인 범위만 변경한다. 사용자 승인으로 제거된 Iran R13은 APPROVED_RETIRED_ABSENT이며 임의 복원하지 않는다.
MarketParquet는 사용자가 제거한 공급자다. 유료 구매·복구·새 공급자 추가로 과거 설계를 임의 유지하지 않는다. GMH와 함께 든 폴더를 통째로 삭제하지 않는다. [공급자 제거 정본](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/MARKETPARQUET_REMOVAL.md).
비밀정보·전체 환경변수·원자료·인증 URL을 로그/Issue/commit에 넣지 않는다. 유료 서비스·자동결제를 임의 추가하지 않는다.
사용자/다른 작업자의 변경을 보존한다. 자동 stash/reset/clean/rebase·강제 push·이력 재작성을 하지 않는다. commit은 작업 파일만 명시적으로 선택한다.
같은 ID 자동 재실행은 하지 않는다. 결과 전송의 멱등 회수와 PC 작업 재실행을 구분한다. 실패 결과를 PASS로 바꾸거나 검사를 삭제해 통과시키지 않는다.

## 8. 완료·보고·문서 유지

현재 목표를 실제 막는 조건만 BLOCKER다. 도구 제약(AUTOMATION_BLOCKED), 실제 기능 실패(RUNTIME_FAILED), 자원 대기, 실행 중, STATE_UNKNOWN, 검증된 복원을 구분하고 영향 없는 작업은 계속한다.
구현·테스트·병합·설치·실제 기능 실행·게시·API/UI·다음 자연 실행을 따로 보고한다. HTTP200·CI·Runner Online·BOOTSTRAP_STARTED로 종단 성공을 선언하지 않는다.
기존 실PC/Provider/DB/배포/사용자 수동 검증은 유효 범위에서 재사용한다. 자동화 접근 실패로 완료된 Runtime 증거를 취소하지 않는다.
완료는 실제 수행·고유 요청/Run·결과쌍·보호/사후 readback으로 판정한다. 열린 Issue·대기 라벨·과거 실패 하나를 현재 전역 장애로 재사용하지 않는다. 성공 후 상태를 정리하되 과거 실패/승인 증거는 보존한다.
보고는 한국어로 이번 결과·실제 증거·중요한 미해결 범위·다음 필수 행동만 짧게 작성한다. 동일 상태·유효한 과거 성공을 신규 성과로 반복하지 않는다. 근거 없는 완료율이나 재발 없음 보장을 쓰지 않는다.
[성공 실행물 색인](SUCCESS_EVIDENCE_REUSE.md)의 공통 실행 구조를 재사용한다. 새 gate·예약·문서를 매 작업의 완료조건으로 만들지 않는다.
이 정본과 GENERAL_CHAT_PREWORK.md를 함께 유지한다. GitHub 반영은 다른 일반챗의 자동 학습이나 PC 설치가 아니다. 이전 정본은 [역사 보관본](history/PC_AUTOMATION_STANDARD_BEFORE_EFFECTS_20261119.md)이며 현재 차단 조건으로 적용하지 않는다.
