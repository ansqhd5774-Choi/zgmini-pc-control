# #996 `INTAKE_PAUSED` C급 단회 복구 상태기계 — Source only

원본 실패 요청: `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`, Issue #996.

## 목적과 비승인 경계

`tools/controller-996-c-transaction.mjs`는 실제 운영 복구 **순서·차단·불확실 상태 규칙**만 표현한다. `simulate996CTransaction`은 테스트에서 전달한 가상 포트만 순차 호출하며, 이 저장소의 파일·GitHub Workflow·Backlog·잠금에 접근하지 않는다. 승인·운영 실행·Windows 검증을 대신하지 않는다.

`validate996CContract`는 실물에서 검증된 상태가 아니라 독립적으로 받은 **후보 진술**만 분류한다. 
`approved:true`, `userConsentReceiptVerified:true`, `committedManifestVerified:true`, 임의 `ownerDeadProven`을 외부 입력에 기입하는 행위 자체는 증거가 아니다. 실사용에는 별도의 검증된 Windows 고정 어댑터가 정확한 Git 커밋 manifest, 원시 파일 바이트/owner nonce, GitHub API, 실제 사용자 C 승인 원본을 독립 재검증해야 한다.

## 고정 상태 순서

| 순서 | 검증·전환 | 진행 조건 | 실패 처리 |
|---|---|---|---|
| 1 | 현재 Windows 원시 해시와 승인 C 명세 CAS | 기존 Controller·유지보수기·#996·원본 Workflow·보호 상태 정합 | 운영 쓰기 0, STOP |
| 2 | 별도 원자적 복구 예약 1회 | 원래 설치 잠금 소유자를 대체하지 않음 | 예약 응답 불명확도 STOP·독립 재조회 |
| 3 | 자신의 복구 예약 포함해 원본 재검증 | 원장·lock owner/marker·source와 다른 설치 경쟁 없음 | STOP, 원본 설치 잠금 보존 |
| 4 | 독립 `PREPARED` 복구 원장을 원자적으로 기록 | 원본 원장·승인·claim 지문 불변, 재개 효과 전 | STOP, 기록 불명확 확인 |
| 5 | 기존 `pc-job` Workflow 활성화 요청 **최대 1회** | 원래 요청의 설치·재실행 없이 승인된 C 효과 | 응답 불명확 시 **재시도 0**, 예약 보관 |
| 6 | Workflow active 독립 재조회 | 현재 소유권/보호 상태 유지 | STOP |
| 7 | 원래 backlog의 열린 중단 창만 CAS 종료 | 실제 resume 시각 기록, 원본 백업/시간 창 보존 | STOP |
| 8 | 중단 창 모든 원본 Issue·결과 JSON/TXT 독립 조회 | **Pause 시작~실제 Resume 후 전체 구간** 재조회, 완전 페이지·고유 ID·기존 결과 확인. **동일 requestId 재게시 0** | STOP, 기존 Issue 원본 유지 |
| 9 | Core/Korea·Writer·Supervisor·전용 Runner 사후 확인 | 운영 Controller SHA 변화 0 | STOP |
| 10 | 독립 `PRE_ARCHIVE` 복구 기록 | 보호·Backlog 인증 결과와 원본 lease 해시 고정 | STOP |
| 11 | 해당 #996의 원래 install lease만 보관 | 앞선 읽기·보호 결과 모두 PASS | STOP, 추가 archive 금지 |
| 12 | 독립 최종 재조회 | 접수 active·원본 install lease 보관·원본 SHA 확인 | STOP |
| 13 | 별도 완료 원장 기록 | 원본 원장 덮어쓰기 없음, 실패 결과 별도 보관 | STOP |

`simulate996CTransaction`은 각 단계의 `true` 이외 응답을 모두 불확실로 분류한다. 원자 예약을 **시도**한 시점부터 결과가 불명확하더라도 claim 확인 전 재실행하지 않으며, Workflow enable/lease archive **시도 횟수**도 측정한다. 검증된 진짜 실행기에서는 각 성공의 원본 출처와 독립 재조회가 필요하다.

## 현재 실증 미완료

- #996 Windows 공식 진단 원본 최신값 미수신. 이전 2026-11-10 10:36 KST 관측만 최신으로 재사용하지 않는다.
- Workflow 중단 행위자와 장애 전 보호 스냅샷은 진단기의 `false/null`로 남아 있다. 추정으로 `true`를 채우지 않는다.
- 현재 C 승인 명세 없음. 테스트 fixture의 `approved:true`는 가상 정상 분기일 뿐 실제 승인 증거가 아니다.
- Windows 고정 **실제 실행 어댑터는 아직 미구현**. 이 소스 병합·테스트 PASS가 운영 lock 해제·Workflow 활성·복구 성공을 뜻하지 않는다.

다음 필수 경로: 기존 원본 Windows PC 단회 읽기 결과 → 근거 부족 조건 해소 → 독립 C 어댑터/보호 실패 테스트 → 사용자 정확한 C 승인 → 운영 1회 복구 및 JSON/TXT·원장 재조회 → 원래 기능 담당 재계획.

전체 공유 수명주기 프로젝트 실증은 4/5(80%)를 유지한다. #917 과거 완료를 이번 신규 진전으로 중복 산정하지 않는다.
