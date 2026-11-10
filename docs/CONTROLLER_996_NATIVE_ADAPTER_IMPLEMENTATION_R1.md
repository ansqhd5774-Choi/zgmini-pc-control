# #996 C급 복구 — 원본 Windows 실행기 개발 현황 (2026-11-10)

## 목표 및 정밀 진행률

- 대상: 기존 **원본 Windows PC** `E:/ZGmini`, Issue #996 / `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`.
- 목적: 설치된 Controller `badad9124157879d7a645b64f2768113d632355b` **그대로** 유지하면서 중단된 `pc-job` 접수와 원본 #996 잠금을 안전하게 정리. Stage 대상 `9db6fff...` 설치는 중단한 것으로 기록.
- 총 프로젝트 실증: 4/5 = **80%**. 이 문서·코드가 실운영 복구나 5단계 완료를 의미하지 않음.

## 현재 코드별 상태

| 파일 | 구현된 범위 | 운영 단계 |
|---|---|---|
| `controller-996-windows-observer.mjs` | 원본 설치/Stage/원장/GH/6전용 Runner, 원본 16/18 증거 | 실제 읽기 관측 완료 |
| `controller-996-protection-attestation.mjs` | Writer 3개·Task XML 2개 SHA/상태를 최초 집계 지문과 비교 | 원본 PC 추가 관측 **미수신** |
| `controller-996-c-consent-verifier.mjs` | GitHub 원본 Issue 작성자·고정 Git manifest 원문·소유자 승인 댓글 SHA 바인딩·철회/중복 차단 | 순수 검증, 실승인 **없음** |
| `controller-996-native-claims.mjs` | 원본 PC 전용 별도 claim 원자 생성, nonce·영구 시도 마커·원본/자기 claim 보관 | 실제 I/O 하위 부품, **CLI 없음·미설치** |
| `controller-996-native-workflow.mjs` | 사전 영구 `WORKFLOW_ENABLE_ATTEMPTED`, 같은 프로세스 1회 PUT, 재시작·타임아웃 시 자동 재시도 차단 | 실제 I/O 하위 부품, **승인 실행기 미연결** |
| `controller-996-c-transaction.mjs` | 18단계 순서·실패 중단 시뮬레이터, 원본 16/18과 보호 5개 SHA 계약 | 테스트 전용, **운영 호출 금지** |
| `controller-996-backlog-plan.mjs` | 원본 이슈 분류, 같은 requestId 재게시 금지 | 읽기 전용, **실제 resume 전 목록 미수신** |

2026-11-10 회귀 **62/62 PASS**. 운영 `Workflow` PUT, PC lease 보관, backlog 갱신, 설치, Issue 재게시 등 실제 효과 **0**. 소스 브랜치는 미배포 Draft PR #1222.

## 승인 출처 — 현재 엄격한 경계

1. C급 승인 후보 manifest 경로는 `docs/CONTROLLER_996_C_APPROVAL_R1.json`이며, **아직 승인된 파일이 없음**. 현재 코드에는 이 경로의 실제 `approved:true` 배포가 없다.
2. 향후 원본 GitHub Issue #996 작성자 `ansqhd5774-Choi` 본인이 승인 명세 **전체 바이트 SHA256**을 명시적으로 수락하는 단일 댓글이 필요하다. `build996ConsentComment`는 정확한 댓글 본문을 생성한다. Bot 댓글이나 “승인”이라는 일반 문구는 이 검증을 통과하지 못한다.
3. 원본 PC의 인증된 GitHub API/`git show <commit>:<path>`로 댓글 작성자, 불변 커밋 바이트, 승인 명세 개별 해시, 역사적 미입증 2개 예외를 다시 검증해야 한다. 외부 JSON에 `approved:true`를 넣는 것만으로는 불가하다.
4. `review996CConsent()`는 현재도 의도적으로 `executionAuthorized:false`를 반환한다. 실제 운영 권한은 별도 네이티브 오퍼레이터의 전체 보호 검증·승인 재조회·사용자 명시 실행 절차가 끝날 때만 생성된다.

## 실제 실행기 연결 전에 남은 필수 구현

1. 원본 Windows 보호 5항목의 실측·개별 해시·Task enabled 값 확보, 최초 집계 지문 `877bcd2a...` 재계산 일치.
2. 승인 manifest를 Git 고정 커밋으로 독립 조회하고 #996 owner 승인 댓글의 작성자·SHA·철회 여부를 검증하는 **네이티브 인증 진입점** 작성. 오프라인 단순 boolean 전달 금지.
3. 최초 7 raw digest·현재 보호 상태·Runner 6개·원래 설치 owner 사망·별도 C claim 부재를 확인 후 첫 영속 쓰기. 자기 claim 생성 후에는 기존 observer의 `recoveryClaimAbsent`를 재사용할 수 없으므로 **자기 nonce 전용 재검증 경로** 적용.
4. Workflow enable이 `active`로 증명된 후 **다른 backlog Writer 부재 확인**, 원본 backlog SHA 대조, 같은 볼륨 조건부 replace 후 신 SHA 독립 재조회. 이 동작을 엄밀한 동시 CAS라고 주장하지 않음.
5. GitHub Issues를 `sort=created` 전체 페이지로 조회, 실제 pause→resume 창의 원본 Issue·댓글·`results/<runId>-<attempt>-seat-<seat>.json/.txt`를 원격 GET. 기존 `replayR6Backlog` 금지, 동일 requestId 재발행 0. 결과 확인이 안 된 원본은 담당자 재계획 대상으로 분류.
6. 보호 대상 5개의 SHA와 Task enabled 값은 **실행 직전, Workflow PUT 직전, 설치 lease 보관 직후, 최종 종료** 단계에서 비교. 독립 Runner 추가 자체는 불필요한 차단 사유가 아님.
7. 완료 상태는 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`. 원본 설치 lease는 삭제 없이 보관하고, 자체 C claim도 완료 기록 후 별도 보관·최종 재조회. 영구 시도 마커가 이미 있으면 재실행 불가.

## 부작용·승인 제한

다음 작업은 코드를 더 완성하고 실패 테스트를 수행하는 것이다. **새 C 명시 승인 전 원본 Windows PC에서 C 복구를 실행하지 않는다.** 새 PC/블로그 자동화 Runner에서 #996 관련 CMD를 실행해서도 안 된다. 기존 #917 완료는 재실행하거나 신규 성과로 합산하지 않는다.
