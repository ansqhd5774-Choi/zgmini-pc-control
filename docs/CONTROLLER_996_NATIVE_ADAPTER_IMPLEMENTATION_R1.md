# #996 C급 복구 — 원본 Windows 실행기 개발 현황 (2026-11-10)

## 목표 및 정밀 진행률

- 대상: 기존 **원본 Windows PC** `E:/ZGmini`, Issue #996 / `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`.
- 목적: 설치된 Controller `badad9124157879d7a645b64f2768113d632355b` **그대로** 유지하면서 중단된 `pc-job` 접수와 원본 #996 잠금을 안전하게 정리. Stage 대상 `9db6fff...` 설치는 중단한 것으로 기록.
- 총 프로젝트 실증: 4/5 = **80%**. 이 문서·코드가 실운영 복구나 5단계 완료를 의미하지 않음.

## 현재 코드별 상태

| 파일 | 구현된 범위 | 운영 단계 |
|---|---|---|
| `controller-996-windows-observer.mjs` | 원본 설치/Stage/원장/GH/6전용 Runner, 원본 16/18 증거 | 실제 읽기 관측 완료 |
| `controller-996-protection-attestation.mjs` | 최초 관측과 동일하게 존재하는 Writer 파일(최대 3개)만 해시 집계하고, 2개 Task XML 해시·enabled 상태 대조. 누락 Writer·Task별 실패 위치 명시 | 원본 PC R1 추가 관측 `STATE_UNKNOWN/ENOENT` 수신. **정정 R2 결과 미수신** |
| `controller-996-c-consent-verifier.mjs` | GitHub 원본 Issue 작성자·고정 Git manifest 원문·소유자 승인 댓글 SHA 바인딩·철회/중복 차단 | 순수 검증, 실승인 **없음** |
| `controller-996-native-claims.mjs` | 원본 PC 전용 별도 claim 원자 생성, nonce·영구 시도 마커·원본/자기 claim 보관 | 실제 I/O 하위 부품, **CLI 없음·미설치** |
| `controller-996-native-workflow.mjs` | 사전 영구 `WORKFLOW_ENABLE_ATTEMPTED`, 같은 프로세스 1회 PUT, 재시작·타임아웃 시 자동 재시도 차단 | 실제 I/O 하위 부품, **승인 실행기 미연결** |
| `controller-996-native-backlog.mjs` | 원본 E: 고정, 최초 backlog SHA, 영구 `BACKLOG_CLOSE_ATTEMPTED`, Temp fsync·변경 전 2회 SHA·단회 rename·완료 SHA/구조 재조회 | 실제 I/O 하위 부품. **독립 Writer 배제 증명 어댑터 없음·미실행** |
| `controller-996-c-transaction.mjs` | 18단계 순서·실패 중단 시뮬레이터, 원본 16/18과 보호 5개 SHA 계약 | 테스트 전용, **운영 호출 금지** |
| `controller-996-backlog-plan.mjs` | 원본 이슈 분류, 같은 requestId 재게시 금지 | 읽기 전용, **실제 resume 전 목록 미수신** |
| `controller-996-backlog-readback.mjs` | `created_at` 내림차순 전체 관련 페이지 2회 동일성 검증, PR 배제, 댓글 전 페이지, bot marker별 JSON/TXT 원격 내용·requestId·runId·seat·TXT 동일성 검증 | 호출 가능한 읽기 전용 부품. **인증 GitHub GET 어댑터·실제 원본 목록 미연결** |

2026-11-10 #996 대상 회귀 **85/85 PASS**. 운영 `Workflow` PUT, PC lease 보관, backlog 갱신, 설치, Issue 재게시 등 실제 효과 **0**. 소스 브랜치는 미배포 Draft PR #1222.

### 추가 관측 R1 ENOENT 진단 및 R2 보완

- 실제 원본 PC에서 `ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1`, `STATE_UNKNOWN`, `code=ENOENT`가 수신되었다. 운영 쓰기·Issue 게시·PC 재시도는 모두 0. **이 결과만으로 미존재 대상 파일·Task를 확정할 수 없다.**
- 결함: 최초 R1 관측기는 Writer `config.json`·`quota-runner.cmd`·`run-local.cmd`를 **존재할 때만** 집계하였으나, 별도 세부 검사 초판은 3개 모두 필수로 `lstatSync`하여 부재 시 단계 정보 없이 `ENOENT`로 중지했다. 동일 객체의 fingerprints를 비교하려면 두 검사기의 존재/부재 규칙이 같아야 한다.
- R2는 부재 Writer를 `ABSENT`라고 표시하고 최초 집계와 동일하게 SHA 객체에서 제외한다. 기존에 존재하던 파일이 사라졌으면 집계 지문이 달라져 성공 판정 불가. Task는 여전히 2개가 모두 검증돼야 하며, 실패 시 `PROTECTED_TASK_QUERY_FAILED`와 정확한 Task명·기초 오류 코드를 출력한다. Writer 읽기 자체 실패도 `WRITER_FILE_OBSERVATION_FAILED`와 정확한 대상명을 출력한다.
- R2는 역사적 기준이 없다는 사실을 바꾸지 않는다. `historicalBaselineAvailable=false`, `allActorsImmutableProven=false` 및 C 실행 미승인은 그대로다. 원본 PC에서 수정된 **새 패키지의 단회 읽기 전용 검사**를 받아야 다음 단계로 진행한다. 기존 R1 ZIP 재실행은 금지.

## 승인 출처 — 현재 엄격한 경계

1. C급 승인 후보 manifest 경로는 `docs/CONTROLLER_996_C_APPROVAL_R1.json`이며, **아직 승인된 파일이 없음**. 현재 코드에는 이 경로의 실제 `approved:true` 배포가 없다.
2. 향후 원본 GitHub Issue #996 작성자 `ansqhd5774-Choi` 본인이 승인 명세 **전체 바이트 SHA256**을 명시적으로 수락하는 단일 댓글이 필요하다. `build996ConsentComment`는 정확한 댓글 본문을 생성한다. Bot 댓글이나 “승인”이라는 일반 문구는 이 검증을 통과하지 못한다.
3. 원본 PC의 인증된 GitHub API/`git show <commit>:<path>`로 댓글 작성자, 불변 커밋 바이트, 승인 명세 개별 해시, 역사적 미입증 2개 예외를 다시 검증해야 한다. 외부 JSON에 `approved:true`를 넣는 것만으로는 불가하다.
4. `review996CConsent()`는 현재도 의도적으로 `executionAuthorized:false`를 반환한다. 실제 운영 권한은 별도 네이티브 오퍼레이터의 전체 보호 검증·승인 재조회·사용자 명시 실행 절차가 끝날 때만 생성된다.

## 실제 실행기 연결 전에 남은 필수 구현

1. 원본 Windows 보호 5항목의 실측·개별 해시·Task enabled 값 확보, 최초 집계 지문 `877bcd2a...` 재계산 일치.
2. 승인 manifest를 Git 고정 커밋으로 독립 조회하고 #996 owner 승인 댓글의 작성자·SHA·철회 여부를 검증하는 **네이티브 인증 진입점** 작성. 오프라인 단순 boolean 전달 금지.
3. 최초 7 raw digest·현재 보호 상태·Runner 6개·원래 설치 owner 사망·별도 C claim 부재를 확인 후 첫 영속 쓰기. 자기 claim 생성 후에는 기존 observer의 `recoveryClaimAbsent`를 재사용할 수 없으므로 **자기 nonce 전용 재검증 경로** 적용.
4. Workflow enable이 `active`로 증명된 후 **다른 backlog Writer 부재 확인** — 실제 OS·lease·프로세스 기반 독립 검사기 개발은 미완성. Backlog 하위 부품은 `proveExclusiveWriter` 함수 누락·미확인 시 실패하고, SHA 대조·same-directory temp·fsync·rename·신 SHA 재조회까지 소스에서 구현. **이는 원자 CAS가 아니므로 독점성 증명 없이 실행 절대 금지.**
5. GitHub Issues를 `sort=created`, `direction=desc`, `per_page=100`으로 실제 pause→resume 구간 내 완전 탐색하고 두 번 동일성 검사하도록 소스 구현. 후보별 댓글 전체 페이지, `results/<runId>-<attempt>-seat-<seat>.json/.txt` 둘 모두 원격 GET, 내용·출처·status/ID 교차 검증도 소스 구현. **여전히 실제 GitHub 인증 GET 포트·Windows resume 원본 관측이 연결되지 않음.** 기존 `replayR6Backlog` 금지, 동일 requestId 재발행 0. 결과 확인이 안 된 원본은 담당자 재계획 대상으로 분류.
6. 보호 대상 5개의 SHA와 Task enabled 값은 **실행 직전, Workflow PUT 직전, 설치 lease 보관 직후, 최종 종료** 단계에서 비교. 독립 Runner 추가 자체는 불필요한 차단 사유가 아님.
7. 완료 상태는 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`. 원본 설치 lease는 삭제 없이 보관하고, 자체 C claim도 완료 기록 후 별도 보관·최종 재조회. 영구 시도 마커가 이미 있으면 재실행 불가.

## 부작용·승인 제한

다음 작업은 (1) 최초 원본 보호 추가 5항목 읽기 증거 수령, (2) 독립 Writer 배제·GitHub 인증 GET 포트와 owner 서명 승인 확인 연결, (3) 원본 PC 전용 C 진입점에 현재 보호 CAS/Claim/Workflow/Backlog/수집/보관을 결합, (4) 오류 주입 후 별도 소유자 승인 판정을 수행하는 것이다. **새 C 명시 승인 전 원본 Windows PC에서 C 복구를 실행하지 않는다.** 새 PC/블로그 자동화 Runner에서 #996 관련 CMD를 실행해서도 안 된다. 기존 #917 완료는 재실행하거나 신규 성과로 합산하지 않는다.
