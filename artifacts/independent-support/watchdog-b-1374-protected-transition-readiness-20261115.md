# 독립 기술지원 7차 — #1374 보호 변경 3개 범주 승인 이력 연결 계획

## 기존 증거 재사용

- [Watchdog B #1372](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1372): Run 43631797304, BLOCKED / WATCHDOG_B_PROTECTED_STATE_DRIFT / writes=0. 원본 요청 재실행 금지.
- [기존 6차 지원](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6883036273): 13/13 비교기 시험 완료, 반복 시험하지 않음.
- [원담당 후속 #1374](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1374#issuecomment-6883022056): PR #1373의 신규 A readback Run 43632362343는 PASS / WATCHDOG_A_PROTECTED_KEYS_CHANGED; CONTROLLER_HOST:CHANGED, RETIRED_IRAN_TASK:CHANGED, WRITER_CONFIG:CHANGED. 보호 원본 미변경. 변경값과 승인 이력 간 직접 인과 관계는 아직 미확인.

## 이미 존재하는 승인 이력 후보와 필요한 증거

1. WRITER_CONFIG: 기존 Writer B 영수증 results/writer-config-b-a94b4091-6f6f-427e-98f7-a6e4dd2fa210.json은 CONFIG_B_APPLIED_VERIFIED / Run 42492034633을 기록. 승인 원본은 approvals/writer-config/employment-r6-optins-20261108-r1.json, 두 자동수집 boolean의 정확 변경만 허용. 과거 승인 변경 존재와 Watchdog baseline→현값 일치 여부는 별개.
2. RETIRED_IRAN_TASK: 승인된 Iran R13 제거 #342와 PC_AUTOMATION_STANDARD의 APPROVED_RETIRED_ABSENT 계약은 유효. 현재 protection()의 부재 검사 성공값은 이 문자열. #1374에서 CHANGED가 관측되었으므로 이전 baseline 값의 출처·형식 확인이 필요하며, 이전 Task를 임의 재등록하지 않는다.
3. CONTROLLER_HOST: 고정 host.json 보호값의 이전↔현재 변화. 구체 파일 전후 SHA가 승인된 고유 Controller 실행 receipt와 연결되었는지는 아직 입증되지 않음.

## 이번 신규 소스 전용 도구

- tests/support/watchdog-b-protection-transition-proof.mjs
- tests/support/watchdog-b-protection-transition-proof.test.mjs

두 파일은 순수 함수 + 합성 입력 Node 테스트 12/12 PASS. #1374 고정 사건/Run/변경 목록과 **기존 승인된 Windows 경로 안에서만 열람되는** before/current 7범주 보호값을 비교한다. 추가·누락·다른 범주나 Task 부재 증거 불일치를 STOP으로 분류한다. 후보 승인/영수증의 참조 문자열 형식 및 정확 전후값 일치만 검사한다. 출력에는 보호값 원문·SHA·토큰이 없으며 승인 증명 자체는 실행하지 않는다. 최고 판정 LOCAL_MATCH_OWNER_AUTHENTICATION_REQUIRED도 운영 설치 또는 baseline 전이 허가는 아니다.

## 다음 작업 — 단일 운영 Owner 소유

1. 기존 승인 read-only Windows 경로에서 보호 baseline 원본과 현재값의 **3개 범주만** 승인 manifest·고유 설치 receipt·시각 및 복구 증거와 결속. GitHub로 민감 원문·보호 해시·XML 게시 금지.
2. 범주별 MATCH / UNAUTHORIZED / UNKNOWN을 판단. Writer 기존 기록은 후보일 뿐, 현재 상태에 대한 인과 증명이 아님. Iran 승인된 부재 검증은 지속 필수.
3. 셋 모두 실제 승인/수정 범위가 증명되기 전에는 신규 B 요청·PROTECTION_BEFORE.json 갱신·guard 제거·기존 #1372 재시도 금지.
4. Owner가 별도 승인된 baseline 전이/고유 새 B 경로를 확정한 후에만 Watchdog staging을 시도. 이후 자연 재기동 시 새 source SHA, scope, PID, heartbeat, Guardian, 6 Runner 및 Core/Task 보호를 재조회해야 활성화 PASS. 유지보수기 7→7, Controller 15파일 설치는 별도 후속.

**이번 작업 범위:** support 브랜치 3파일 소스 기록만. 운영 PC, Runner, Watchdog, Controller, SQLite/D1, Cloudflare, 예약, 원본 승인 상태 변경 0. 실제 운영 병목은 승인 변경과 보호 원본의 연결 증명 미완료로 계속 BLOCKED.
