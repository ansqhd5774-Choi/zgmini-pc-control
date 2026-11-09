# Writer B #1063 단회 복구 작업 계획 — 2026-11-09

상태: **실PC 읽기 증거 확보 / 복구 실행기 준비 중 / 운영 복구 미실행**.
중앙 대기열: [#1068](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1068).
기능 차단: #1063, #1064, #1066, #1081. 실제 해소 **0/4**. 공통 프로세스 완료 항목 **6/8=75%**.

## 확정된 실PC 증거

- 원래 설치 requestId: `bd435d7c-2939-457f-907c-98d551f6b8cf`. #1063 Run `42617811190` = `WRITER_B_RECOVERY_REQUIRED` (재실행 금지).
- 고정 읽기 전용 진단 `WRITER_B_1063_RECOVERY_EVIDENCE_READONLY`: journal 10개 마지막 `RECOVERY_REQUIRED`, SHA-256 `5e19de532866e2f4e5795a7667dc7fe502c6b19d2e391e1ba5980e4ebc6ba509`.
- Writer 공유 lock 존재·원요청 소유. 원본 config/Task/XML/module/preimage 백업 정합성 확인. Provenance SHA-256 `d4675df57be56410cf6f52429ff485d333cbaab2ababf25d66a821444fe07048`.
- PC Git HEAD=config.source=preparedLocalSha `434f30d2aa221bddacab5afa09241916618d8e22`; 원본 base `825cfbd6e2025940e3e48631e7ff1dddf582e75a`. 파일 `employment-r6-collector.mjs` SHA-256 `f22b2f1447e462d3101caf027323572606db61352ab6a53524dd406cca7a4915` (원승인 AFTER).
- Core Task `ZGMINI-PC-Local-Core` disabled, state 1, 프로세스·instances·미분류 행·Core cycle lock 모두 0; 정의는 Enabled 이외 원본과 동일. **`trackedDirty=NOT_VERIFIED`, `runtimeSourceVerified=false`, `recoveryAuthorized=false`이므로 복구 완료 아님.**
- 별도 [A #1085](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1085) Core 체크포인트 COMPLETE / Writer VERIFIED 기록은 관측 시각에 한정. 운영 Task 활성 상태를 대체하지 않음.

## 순서와 통과 조건

1. **고정 복구 실행기 작성**: 원 사고 한 건, 원 승인 1개 파일, 원본 requestId와 prepared local SHA, 기대 해시·Task 이름·고정 E: 경로만 허용. 일반 A·기존 소비된 Writer B 요청 불변. #917 Controller lease와 분리.
2. **소스 안전검증**: 실행 직전 immutable journal+백업+provenance, Git ref/commit parent/tree 및 HEAD·branch·config exact CAS, 대상 AFTER 파일·비대상 tracked 상태 및 승인 runtime consumer 조건 확인. 하나라도 불명확하면 STOP/원상보존.
3. **실행 안전검증**: Writer B와 같은 concurrency group의 self-hosted 원 PC B 경로, 정확한 lock owner, Core Task disabled/XML original normalized, 연속된 유휴 검사. 다른 레인 변경/원본 삭제 금지.
4. **선택적 롤포워드**: 검증 모두 PASS일 때만 `schtasks /Change /TN ZGMINI-PC-Local-Core /Enable` 후 Task enabled, XML normalized, Git HEAD/config/module 및 보호 상태 재조회. 검증 실패 시 lock/원장/원본 백업 보존.
5. **잠금 보관 및 회수**: 동일 소유 lock만 성공 후 보관 처리, 원 설치 실패 기록은 보존. 새 복구 실행 결과 JSON/TXT 2/2·실제 Core 정규 실행 확인. 진단 PASS만으로 통과 처리 금지.
6. **기능 설치 재개**: #1064/#1066/#1081은 소모된 requestId 사용 금지. 각 원담당이 새 PC beforeSha/승인 manifest로 신규 정규 B를 순차 접수하며 각 실행 SHA·결과를 확인.
7. **재발방지 후속**: 4건 설치 복구 후 lock/원장 상태기계의 자동화 가능한 안전 reconcile·큐 대기·중복 중단 구조를 최소 변경으로 설계/검증. 예약 검증은 최후.

완료 판정: (a) 기존 Core Task 정상 재활성화·원장 보존·lock 비점유·정규 실행 관측, (b) 4개 설치 요청의 후속 실PC 성공 증거. 위 단계는 완료 전까지 완료 보고하지 않음.
