# Writer B #1063 단회 복구 작업 계획 — 2026-11-09

상태: **#1063 공통 Writer B 실PC 복구 성공 / 후속 기능 설치 검증 대기 / Core 이후 정규 cycle 미관측**.
중앙 대기열: [#1068](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1068).
원본 영향 4건: #1063, #1064, #1066, #1081. **공통 잠금 복구 1/1=100%**, **기능 설치 성공 0/4=0%**, **인계 댓글 기록 4/4=100% (원담당별 실제 수신/실행 별도 판단)**. 중앙 자동 인계·처리 **8/8=100%(사고 표본 1/1)**. 기능 설치 0/4와 Core 정규 cycle 미관측은 중앙 인계율과 별도.

## 복구 전 확정된 실PC 증거 (2026-11-09 고정 스냅샷)

- 원래 설치 requestId: `bd435d7c-2939-457f-907c-98d551f6b8cf`. #1063 Run `42617811190` = `WRITER_B_RECOVERY_REQUIRED` (재실행 금지).
- 고정 읽기 전용 진단 `WRITER_B_1063_RECOVERY_EVIDENCE_READONLY`: journal 10개 마지막 `RECOVERY_REQUIRED`, SHA-256 `5e19de532866e2f4e5795a7667dc7fe502c6b19d2e391e1ba5980e4ebc6ba509`.
- Writer 공유 lock 존재·원요청 소유. 원본 config/Task/XML/module/preimage 백업 정합성 확인. Provenance SHA-256 `d4675df57be56410cf6f52429ff485d333cbaab2ababf25d66a821444fe07048`.
- PC Git HEAD=config.source=preparedLocalSha `434f30d2aa221bddacab5afa09241916618d8e22`; 원본 base `825cfbd6e2025940e3e48631e7ff1dddf582e75a`. 파일 `employment-r6-collector.mjs` SHA-256 `f22b2f1447e462d3101caf027323572606db61352ab6a53524dd406cca7a4915` (원승인 AFTER).
- Core Task `ZGMINI-PC-Local-Core` disabled, state 1, 프로세스·instances·미분류 행·Core cycle lock 모두 0; 정의는 Enabled 이외 원본과 동일. 이 시점에는 **`trackedDirty=NOT_VERIFIED`, `runtimeSourceVerified=false`, `recoveryAuthorized=false`였으며 복구 완료 아님.** 이후의 복구 성공은 다음 결과 섹션에서 별도로 판정한다.
- 별도 [A #1085](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1085) Core 체크포인트 COMPLETE / Writer VERIFIED 기록은 관측 시각에 한정. 운영 Task 활성 상태를 대체하지 않음.

## 실제 Windows 복구 결과와 원담당 인계

- 고정 복구 PR [#1086](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1086) 병합 (`807a5a69105fd9ee839d368a414e53d8f6c217c9`). 단일 사고 전용 실행기 및 정적 승인 명세를 등록했다. 일반 B의 소비된 원 요청을 재실행하지 않았다.
- 복구 [#1087 / Run 42634492692](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1087#issuecomment-6742480737): **`WRITER_B_1063_CORE_RECOVERED / WRITER_B_1063_PREPARED_CORE_ENABLED_LOCK_FINALIZED`**. 원본 PC Core Task Enabled 실조회 `true`, 원본 공유 잠금 안전 보관·정리 `true`, 원격 JSON/TXT create/readback `2/2`. 결과 파일 `results/writer-b-1063-recovery-b709eb8b-c752-44cf-a1cb-36eaa574c3ef.json` 및 `.txt`.
- **정식 중앙 결과 반환:** [격리 CI Run 42637013508](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42637013508) 원본 PR #1086 head `f723f776c60f30d0d6a68a333319b5d895333111` 성공. 자동 접수 #1068에는 [`HANDOFF_RESULT_RECORDED`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1068#issuecomment-6742864318), 원본 #1063에는 [`HANDOFF_ORIGIN_RESULT_RECORDED`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1063#issuecomment-6742864978) 영수증이 생성·재조회됐다. Broker state `RUNTIME_VERIFICATION_PENDING`이며 owner chat 수신 `UNKNOWN`.
- **확인 범위 제한:** `installationVerified=false`; 원래 #1063 B 설치 실행 실패 이력은 그대로다. 복구 후 Core **정규 cycle 관측은 아직 미확인**이며 자동 추정하지 않는다. 해당 관측은 자연스럽게 발생하는 기존 정상 업무 증거로 확인하고 복구 확인용 신규 예약 작업은 만들지 않는다.
- 인계 증거 4/4: [고용 #1063](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1063#issuecomment-6742556270), [시장 캘린더 #1064](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1064#issuecomment-6742557176), [자산 R10 #1066](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1066#issuecomment-6742556786), [물가지표 #1081](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1081#issuecomment-6742555835). 상태는 **HANDOFF_RECORDED / OWNER_ACK_UNKNOWN**. GitHub 댓글로 다른 일반챗이 자동 호출되지 않는다.
- #1064·#1066 기존 승인 명세의 base HEAD는 원본 PC prepared HEAD와 달라 새 current-head 승인 명세/새 requestId 필요. #1081은 base HEAD가 일치하지만 현재 preimage·보호 해시를 확인하고 새 requestId 사용. #1063은 이미 준비된 소스의 실제 기능 활성·결과부터 확인하고 원 설치 성공을 주장하지 않는다.

## 후속 신규 B 실행 — Core 활성 시간창 안전 중단 (2026-11-09)

- Treasury 연간 4파일 사전 조회 [#1089 / Run 42635470978](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1089): `PASS / WRITER_APPROVED_PREIMAGE_READONLY`, HEAD/config/체크포인트 소스 `434f30d2aa221bddacab5afa09241916618d8e22`, 그러나 실제 B 설치·Core 정규 실행 증거는 아님.
- [#1090 / Run 42635628648](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1090): Issue 제목이 정확한 `pc-writer-source-install`이 아니므로 B Job **skipped**, 설치 실행 0회. 동일 manifest 신규 요청이 중복 접수돼도 이것을 운영 중복 실행으로 잘못 판정하지 않는다.
- [#1092 / Run 42636354244](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1092): 정확한 제목으로 B 실행, **`WRITER_B_PREFLIGHT_STOP / WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED`**. 원격 JSON/TXT 2/2, sourceSha/baseHead null. 설치 전 `waitForCoreIdleWindow()`가 최대 6분 간 자연 유휴 연속 2샘플을 확인하지 못한 **preclaim 안전 중단**이다. 과거 #1063 공유 설치 lock 보존 사고의 재발로 혼동하지 않는다.
- 공통 적용 원장 [#68 최신 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6742981464) 및 시장 담당 [#1064 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1064#issuecomment-6742981960)를 기록했다.
- **원담당 다음 실행:** 최근 Core cycle/Task quiet/lock의 기존 증거를 필요한 범위에서 확인하고 실제 자연 유휴 창에 최신 승인 manifest·preimage를 재확인한 새 requestId로 정규 B 설치. 안전 검사 우회·Core 강제 정지·기존 요청 재실행 금지. 아직 시장 캘린더 4파일 설치 성공 **0건**.
- **재발 방지 설계 입력:** `WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED`는 원본 source/Task 변경 없는 대기·재계획 상태로 구분하고, B 요청 제목 사전 검증/공유 자원 자연 유휴창 조건/일회성 결과 소비와 새 요청 재개 계약을 평가한다. 이 문서 갱신 자체가 운영 설치기 코드 적용이 아니다.

## 순서와 통과 조건 (실행 이력 보존)

1. **고정 복구 실행기 작성**: 원 사고 한 건, 원 승인 1개 파일, 원본 requestId와 prepared local SHA, 기대 해시·Task 이름·고정 E: 경로만 허용. 일반 A·기존 소비된 Writer B 요청 불변. #917 Controller lease와 분리.
2. **소스 안전검증**: 실행 직전 immutable journal+백업+provenance, Git ref/commit parent/tree 및 HEAD·branch·config exact CAS, 대상 AFTER 파일·비대상 tracked 상태 및 승인 runtime consumer 조건 확인. 하나라도 불명확하면 STOP/원상보존.
3. **실행 안전검증**: Writer B와 같은 concurrency group의 self-hosted 원 PC B 경로, 정확한 lock owner, Core Task disabled/XML original normalized, 연속된 유휴 검사. 다른 레인 변경/원본 삭제 금지.
4. **선택적 롤포워드**: 검증 모두 PASS일 때만 `schtasks /Change /TN ZGMINI-PC-Local-Core /Enable` 후 Task enabled, XML normalized, Git HEAD/config/module 및 보호 상태 재조회. 검증 실패 시 lock/원장/원본 백업 보존.
5. **잠금 보관 및 회수**: 동일 소유 lock만 성공 후 보관 처리, 원 설치 실패 기록은 보존. 새 복구 실행 결과 JSON/TXT 2/2·실제 Core 정규 실행 확인. 진단 PASS만으로 통과 처리 금지.
6. **기능 설치 재개**: #1064/#1066/#1081은 소모된 requestId 사용 금지. 각 원담당이 새 PC beforeSha/승인 manifest로 신규 정규 B를 순차 접수하며 각 실행 SHA·결과를 확인.
7. **재발방지 후속**: 원담당 4건의 실제 기능 설치 재개/필요 증거 확보 후 공유 lock/원장 상태기계·큐 대기·중복 중단 구조를 최소 변경으로 설계/검증한다. 잠금 소유자/해시/승인 검사를 약화하거나 #1063 단회 복구기를 범용화하지 않는다. 예약 검증은 최후.

**현재 완료 판정:** (a) Core Task 재활성화·원장 원본 보존·원본 lock 정리 **PASS**, Core 이후 정규 실행 **미확인**; (b) 기능 설치 4건 후속 실PC 성공 증거 **0/4 미확인**. 두 항목이 채워지기 전까지 전체 완료 선언 금지.
