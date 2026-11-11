# #996 `INTAKE_PAUSED` C급 단회 복구 상태기계 — Source only

원본 실패 요청: `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`, Issue #996.

## 목적과 비승인 경계

`tools/controller-996-c-transaction.mjs`는 실제 운영 복구 **순서·차단·불확실 상태 규칙**만 표현한다. `simulate996CTransaction`은 테스트에서 전달한 가상 포트만 순차 호출하며, 이 저장소의 파일·GitHub Workflow·Backlog·잠금에 접근하지 않는다. 승인·운영 실행·Windows 검증을 대신하지 않는다.

`validate996CContract`는 실물에서 검증된 상태가 아니라 독립적으로 받은 **후보 진술**만 분류한다.
`approved:true`, `userConsentReceiptVerified:true`, `committedManifestVerified:true`, 임의 `ownerDeadProven`을 외부 입력에 기입하는 행위 자체는 증거가 아니다. 실사용에는 별도의 검증된 Windows 고정 어댑터가 정확한 Git 커밋 manifest, 원시 파일 바이트/owner nonce, GitHub API, 실제 사용자 C 승인 원본을 독립 재검증해야 한다.

## 2026-11-10 원본 Windows 실측과 C급 예외 경계

원본 Windows PC에서 실제 관측된 `ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1` (`2026-11-10T03:02:02.041Z`)은 **18개 중 16개 참**, 다음 두 검증은 정확히 `false`였다.

- `workflowDisableActorVerified=false`: `INTAKE_PAUSED`까지 도달한 설치된 `16064e29...` 유지보수기 소스에는 backlog pause→GitHub Workflow disable API→readback 순서가 있다. 이는 #996 실행의 **제한적 인과 경로**이지 GitHub 독립 actor audit이 아니다.
- `protectedBaselineVerified=false`: Writer/Task의 장애 이전 스냅샷은 `waitForDrain()` 이후의 `backup()`에서 처음 영구 저장되는데, 이번 실패는 앞 단계다. 역사적 기준을 **복원하거나 만들어내지 않는다.** 다른 실행자의 변경 부재도 주장할 수 없다.

원본 raw digest는 `ledger`, `owner`, `recoveryMarker`, `backlog`, `controllerHost`, `stagedHost`, `maintainerManifest` **정확히 7개**다. 8번째 `protectedSnapshot`은 존재하지 않는다. 최초 원본 관측의 보호 집계 SHA256은 `877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86`이다.

다음 독립 보완은 원본 Windows PC에서 `RUN_996_PROTECTED_READONLY_ONCE.cmd`를 **1회** 실행하여 Writer 3개(`config.json`, `quota-runner.cmd`, `run-local.cmd`)·Task 2개(Core/Korea)의 **개별 SHA256, 실제 Task enabled 값, 전체 존재·집계 일치**를 확인하는 것이다. 이 보완 관측도 쓰기 0, 역사적 기준 생성 0이며, 기존 집계와 다르면 바로 중단한다. **새로운 PC나 블로그 Runner에서 실행하는 작업이 아니다.**

이후 별도의 C급 사용자 승인은 아래를 명시적으로 받아야 한다.

1. `PHASE_SCOPED_EVIDENCE_EXCEPTION`: GitHub Workflow disable actor의 독립 확인 부재와 역사적 보호 기준 복원 불가, 다른 주체의 보호 상태 불변을 입증하지 못함을 **모두 명시 인정**.
2. #996 동일 request/issue/Controller SHA·유지보수기 SHA, 원본 실측 raw digest 7개, 보호 상태 집계와 개별 해시·Task 상태, 관측 시각을 승인 명세에 고정.
3. 허용 영속 효과는 정확히 **6종**: (a) 자기 C 복구 예약 생성·보관, (b) C 전용 감사 원장과 각 위험 전환의 사전 시도 마커 기록, (c) 기존 `pc-job` Workflow 활성화 최대 1회, (d) 원본 backlog 열린 창 조건부 종료 1회, (e) 기존 Issue·JSON/TXT 결과 읽기 전용 분류, (f) 원본 설치 lease 사후 검증 후 보관. 설치·Core/Korea·Writer 변경·원본 Issue 재게시·동일 requestId 재실행은 허용하지 않는다.
4. 이 C 복구는 **기존 Controller `badad912...` 상태로 접수만 복구**한다. 완료 기록은 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`이며 Stage의 `9db6fff...` 설치 성공으로 기록하지 않는다. 새 컨트롤러 설치에는 별도 새 요청과 승인이 필요하다.

별도 C급 승인 전 **현재 원본 설치 잠금·Workflow disable 상태 유지**. 시뮬레이터에서 `approved:true`를 기입한 것이 실제 실행 권한이 아니다. 16/18을 임의로 18/18로 바꾸는 코드도 없다.

## 고정 상태 순서

| 순서 | 검증·전환 | 진행 조건 | 실패 처리 |
|---|---|---|---|
| 1 | 현재 Windows 원시 해시와 승인 C 명세 CAS | 기존 Controller·유지보수기·#996·원본 Workflow·보호 상태 정합 | 운영 쓰기 0, STOP |
| 2 | 별도 원자적 복구 예약 1회 | 원래 설치 잠금 소유자를 대체하지 않음 | 예약 응답 불명확도 STOP·독립 재조회 |
| 3 | 자신의 복구 예약 포함해 원본 재검증 | 원장·lock owner/marker·source와 다른 설치 경쟁 없음 | STOP, 원본 설치 잠금 보존 |
| 4 | 독립 `PREPARED` 복구 원장을 원자적으로 기록 | 원본 원장·승인·claim 지문 불변, 재개 효과 전 | STOP, 기록 불명확 확인 |
| 5 | Workflow enable **사전 시도 마커** 영구 기록 | own claim·nonce에 원본 상태/요청 고정, 동일 요청 두 번째 시도 차단 | STOP·무조건 자동 재시도 0 |
| 6 | 기존 `pc-job` Workflow 활성화 요청 **최대 1회** | 사전 마커 존재; 원래 요청 설치·재실행 없음 | 응답 불명확 시 재시도 0·예약 보관 |
| 7 | Workflow active 독립 재조회 | 현재 소유권/보호 상태 유지 | STOP |
| 8 | 원래 backlog의 열린 중단 창만 **독점 소유 조건부 종료** | 별도 C claim·다른 Writer 부재, 직전 원본 SHA→같은 볼륨 원자 rename→즉시 재조회, 실제 resume 시각 | STOP |
| 9 | 중단 창 모든 원본 Issue·결과 JSON/TXT 독립 조회 | **Pause~실제 Resume 전체 구간** 페이지/고유 ID·기존 결과 확인. 동일 requestId 재게시 0 | STOP |
| 10 | Core/Korea·Writer·Supervisor·전용 Runner 사후 확인 | 설치 Controller SHA 변화 0, 보호 개별 5개 SHA·Task enabled 값 불변 | STOP |
| 11 | 독립 `PRE_ARCHIVE` 복구 기록 | 보호·Backlog 결과와 원본 lease 해시 고정 | STOP |
| 12 | 원본 설치 lease 보관 **사전 시도 마커** | 원본 nonce/해시·보관 목적지 고정, 두 번째 rename 시도 차단 | STOP |
| 13 | 해당 #996 원래 install lease만 보관 | 사전 마커·사후 검증 PASS; delete 대신 개별 archive | STOP |
| 14 | 독립 최종 재조회 | 접수 active·원본 install lease 보관·원본 Controller SHA | STOP |
| 15 | 별도 완료 원장 기록 | `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`, 원본 원장 덮어쓰기 없음 | STOP |
| 16 | 자기 C claim 보관 **사전 시도 마커** | 완료 기록 성공·자기 nonce 검증, 중복 보관 금지 | STOP |
| 17 | **자기 복구 예약만** 완료 상태로 보관 | 사전 마커·자기 소유 검증 후 조건부 archive | 불명확 시 재시도 0·독립 재조회 |
| 18 | 자기 claim 보관 독립 재조회 | 완료 원장·원본 상태·자기 claim archive 확인 | STOP, 미확인 완료 주장 금지 |

`simulate996CTransaction`은 각 단계의 `true` 이외 응답을 모두 불확실로 분류한다. 원자 예약을 **시도**한 시점부터 결과가 불명확하더라도 claim 확인 전 재실행하지 않으며, Workflow enable/lease archive **시도 횟수**도 측정한다. 검증된 진짜 실행기에서는 각 성공의 원본 출처와 독립 재조회가 필요하다.

파일 내용의 SHA를 확인하고 임시 파일을 `renameSync`로 교체하는 행위는 다른 Writer와 경쟁할 경우 **진정한 동시성 CAS가 아니다.** 실제 C 실행기의 8단계는 서로 호환되는 복구 claim의 독점성뿐 아니라 **해당 backlog를 갱신하는 다른 실행자 없음**을 검증하고, 가능하면 서버/파일시스템 수준 원자 조건을 사용해야 한다. 독점성이 증명되지 않으면 변경을 시작하지 않는다. 설치 유지보수기의 기존 `replayR6Backlog`는 원본 요청의 GitHub 재게시와 `issues?since=` 갱신 시각 필터를 사용하므로 #996 복구에서 재사용을 금지한다.

## 현재 실증 미완료

- #996 **실제 원본 Windows 16/18 진단은 수신**했고 원본 [Issue #996 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6757779582)에 고정했다. 현재 보호 상태의 **개별 5개 해시 추가 관측은 미수신**.
- Workflow 중단 행위자와 장애 전 보호 스냅샷은 진단기의 `false/null`로 남아 있다. 명시적 제한 예외 승인 외에 추정으로 `true`를 채우지 않는다.
- 별도의 실제 C 승인 명세 없음. 테스트 fixture의 `approved:true`는 가상 정상 분기일 뿐 실제 승인 증거가 아니다.
- Windows 고정 **실제 실행 어댑터는 아직 미구현**. 이 소스 병합·테스트 PASS가 운영 lock 해제·Workflow 활성·복구 성공을 뜻하지 않는다.

다음 필수 경로: 기존 원본 Windows PC **보호 5개 개별 관측** → 독립 C 어댑터/보호 실패 테스트 → 사용자 정확한 C 승인 → 운영 1회 복구 및 JSON/TXT·원장 재조회 → 원래 기능 담당 재계획.

전체 공유 수명주기 프로젝트 실증은 4/5(80%)를 유지한다. #917 과거 완료를 이번 신규 진전으로 중복 산정하지 않는다.

## 2026-11-11 추가 결정 — 실제 Claim·Lease 디렉터리 경합 차단 (C NO-GO)

이 절은 기존 승인·관측 이력을 삭제하지 않는다. 현재 운영 복구는 **4/5(80%)**, 원본 복구 영속 쓰기는 **0건**이다. 격리 Windows TEMP 네이티브 ACL/종료 복구 6/6 PASS(#42955714333)는 운영 Claim/Lease 보관의 독점성을 입증하지 않는다.

**현재 원본 증거 재사용:** Issue #996의 최초 R1 16/18(`C_EVIDENCE_GAPS`)과 R2 보호 상태 지문 일치는 해당 관측 시각의 증거다. 허용 A operation에는 #996 전용 Claim·Lease·DACL 조회가 없으므로 임의 pc-job을 생성하지 않는다. #996의 `PHASE_SCOPED_EVIDENCE_EXCEPTION` 승인은 승인된 특정 manifest에 한정한다.

**LAST PASS / FIRST FAIL**
- 원본 읽기 진단과 별도 TEMP 시험은 유효. `controller-996-c-native-owner-operator.mjs`의 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED` 및 `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN`은 아직 **의도적 하드 STOP**이다.
- 확인된 2중 문제: `FileShare.Read`로 검증 child 파일 핸들을 유지하면 Windows 디렉터리 보관 rename이 거부된다. 핸들을 닫으면 파일 변경·신규 entry 삽입 경쟁이 가능하다. 고정 예약 획득의 Win 1/Busy 1 시험은 archive 독점성을 증명하지 않는다.
- 디렉터리 ACL은 하위 파일에 이미 열린 쓰기 핸들의 권한을 소급 회수하지 않는다. 원본 source와 자식 파일의 온라인 임시 ACL 수정은 기존 비협조 writer 핸들 제거가 별도로 입증되지 않으면 전체 복구의 안전성 증명이 아니다.

**우선 설계:** 운영 Writer·관련 예약의 원본 E: 접근을 정지하고, 다른 인스턴스가 해당 볼륨에 쓰지 못하는 **오프라인 독점 복구**를 별도로 검증·승인받는 방안. 그 환경에서만 파일 ID·원문 SHA/ACL·목적지 부재의 두 차례 읽기를 확인하고, 자식 핸들 종료→동일 볼륨 비덮어쓰기 보관→사후 파일 ID·SHA·ACL·경로 검증을 하도록 기존 3단계 보관 계획을 수정한다. 각 단계의 사전 기록·단회 효과·실패 시 `STATE_UNKNOWN`은 유지한다.

**온라인 대안:** 승인된 maintenance freeze와 모든 기존 writer 핸들 정리, 디렉터리 신규 항목 생성 및 자식 파일 수정 차단 ACL, 보관 후 ACL 원본 복구를 함께 검증해야 한다. ACL만 걸고 하드 STOP을 없애는 변경은 허용하지 않는다.

**결정·승인 구분:** 오프라인 PC 운영 중단·독점 E: 접근·원본 archive 이동, 또는 온라인 원본 ACL/Writer 중단은 기존 C 승인 명세와 다른 운영 효과이므로 Owner의 명시적 범위 결정과 정확한 승인·source 봉인이 먼저 필요하다. 결정을 받은 뒤 별도 Windows TEMP에서 신규 entry 삽입/child 핸들/이동/중단 복구와 동적 import 이전 검증을 완료할 때까지 운영 실행 두 STOP 유지. 최종 결과는 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`로만 판정한다.
