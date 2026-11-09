# ZGMINI 공용 작업 자원 수명주기 — 범용 재발 방지 계획 (2026-11-09)

## 목적과 적용 범위

시장 캘린더·고용·자산·물가의 네 건만 해제하는 과제가 아니다. 앞으로 추가될 **모든 기능**의 공용 운영 자원 사용 시 요청 유실·정상 대기 오분류·부분복구·재개 누락이 반복되지 않도록 하나의 **자원별 생명주기 계약**을 구현한다. 기존 중앙 장애 인계 8/8 검증은 별도 완료 증거이고, 이번 범용 예방 5단계와 기능별 실PC 설치 증거를 합산하지 않는다.

- 공통 자원: Writer source lane, Controller 설치 lease, Core 실행과 보호 파일, Runner/메모리·무거운 작업 lease, 공용 결과 업로드/원장. 향후 새 자원도 동일 계약에 등록한다.
- 기능별 산식·Collector·독립 조회는 변경하지 않는다. 서로 다른 자원의 독립 작업은 계속한다.
- 기존 GitHub 중앙 조정 원장 **#68**을 유지하고, 운영 잠금과 승인 보호를 교체하지 않는다.
- **불변식:** 원본 requestId 자동 재실행 0회, 소유자 불명의 잠금 삭제 0회, Core 강제 정지 0회, Task/XML·승인 SHA·정확한 백업·원본 해시 검사 우회 0회, 무승인 운영 쓰기 0회.
- 완료 근거는 source 병합, 격리 CI, PC 실제 적용, 기능별 설치, 원담당 일반챗 실제 수신을 별개로 기록한다. GitHub 댓글은 대화 자동 알림이 아니다.

## 구체적 실패 유형과 정상 상태

| 구분 | 판정 증거 | 처리 |
| --- | --- | --- |
| `REJECTED_AT_ADMISSION` | Issue 생성 전 제목/라벨/schema/manifest 유효성 오류 또는 실제 workflow skipped | 명시적 접수 오류. 실행/성공으로 간주 금지 |
| `WAITING_SHARED_RESOURCE` | 인증된 결과쌍에서 Writer B의 *청구 전 무변경* 경합·Core 활성 이연, PC Job의 *요청 소모 후 작업자 실행 전 무변경* 경합 또는 청구 후 *원본 복구 VERIFIED* | 원본 Issue + #68 대기 항목. 원본 요청 자동 재실행 금지 |
| `RECOVERY_REQUIRED` | 부분 적용·잠금 보존·원본 복원 미입증 | 동일 사고 담당·정확한 승인/백업으로 별도 복구, 일반 대기로 숨기지 않음 |
| `RESULT_UNVERIFIED` | JSON/TXT/봇 영수증·작업 종료 또는 결과 전달 불명확 | 기존 증거 조회·STATE_UNKNOWN. 무조건 재실행 금지 |
| `COMPLETED_VERIFIED` | 실제 실행 성공+별도 결과 원격 readback | 원본 완료, 영향 소비자 검증 범위 한정 |
| `READY_FOR_OWNER_REPLAN` | 자원 해제·최신 운영 source와 기존 승인 정합성이 재검증됨 | 원담당이 새로운 고유 요청 여부 결정. 다른 ChatGPT 자동 재개 주장 금지 |
| `SOURCE_DRIFT_REVIEW` | 대기 중 운영 SHA/파일/승인 근거 변경 | 과거 manifest 재사용 중단, 새 승인 대조 후 원담당 재계획 |

### 대기 항목 필수 필드

`resourceKey`, `originIssue`, `requestId`, `chatId`(허용되는 익명 식별자), `sourceSha`, `manifestSha256`, `runId`, `resultCode`, `safePoint`, `owner/precedingIssue`(확인 시에만), `releaseCondition`, 인증 결과 링크/해시, `automaticPcRetries=0`, `ownerReceipt=UNKNOWN`, `nextAction`. 지문으로 동일 이벤트 중복 접수를 막되 서로 다른 원본 요청은 각자 보존한다.

## 실행 계획과 측정 기준

1. **[1/5] 범용 위험 전수 분류·계약 확정**: 기존 Controller, Writer, Core, Runner, 결과 업로드의 입구/대기/복구/반환을 매핑하고 실제 위험 및 불변식 문서화.
2. **[2/5] 공통 접수·상태 모듈**: 인증된 결과에서 무변경 이연/원상복원/복구 필요를 분리하고 검증 가능한 자원 대기 ID와 재평가 계약 구현. 잘못된 Issue는 발행 전에 명시적 거부.
3. **[3/5] 기존 실행 어댑터 연결**: Writer B report가 `ORIGINAL_VERIFIED` 복구 증거를 JSON/TXT에 보존하고 중앙 인계가 정상 이연을 실제 사고로 오분류하지 않도록 개선. Controller/pc-job의 실패·대기 처리 계약을 참조 연결.
4. **[4/5] 지속 원장·격리 회귀**: #68 원장에 안전한 대기 항목을 중복 없이 기록하고 해제 시 재평가하되 자동 설치하지 않음. 접수, 3개 이상 기능 경합, 정상 활동, 부분 복구, 재시도 0회, 상태 불명확, source 드리프트, 결과 readback 검사. 사용자 자기 Runner에서 격리 CI 검증.
5. **[5/5] 실제 운영 확인·원담당 인계**: 변경의 독립 승인·기존 보호 계약 아래 정규 실제 수집·설치 사례로 상태-대기-재평가-결과 연결 확인. 기능 담당자의 실제 설치는 담당자가 수행. 새 자동 예약 검증은 전체 기능 작업 완료 후 후속 단계.

## 기존 사건에 대한 적용 범위

- #1063은 **복구 필요 사고**. #1087 Core/lock 복구 PASS이나 기능별 Writer 설치와 첫 자연 Core 주기 증거는 별개.
- #1090은 **정확한 Issue 제목 불일치로 job skipped**. 설치 성공이 아니다.
- #1092는 **Core 활성으로 청구 전 깨끗한 이연**. 복구 사고/설치 PASS가 아니다.
- 기존 기능 설치 확인 0/4, 중앙 인계 8/8은 각자 분리한다.

## 종료 기준

범용 구현 완료란 **신규 기능을 하나 추가해도 추가 기능별 예외 없이** 유효성 미달 요청이 명시적으로 실패하고, 자원 경합은 내구형 원장에 남으며, 실제 복구 사고는 원래 잠금과 승인 보호를 유지하고, 자원 해제 후 최신 source 재대조를 거쳐 새 승인 요청을 판단하고, 원본 실행/전달/원담당 수신 여부가 섞이지 않는 것을 뜻한다. 문서만 병합하거나 격리 테스트만 PASS인 상태는 실PC 적용 완료로 보고하지 않는다.

## 공통 접수 및 대기 기록 구현 (소스 전용)

- 등록된 승인형 공용 자원 요청은 `shared-resource/issue-admission.mjs`에서 정확한 제목·라벨·스키마·manifest 해시를 확인하고 요청 본문을 생성한다. 향후 새 유형은 *이 공용 라우트 표*에 추가한다.
- `.github/workflows/pc-shared-issue-admission.yml`은 등록된 제목 또는 라벨이 있는 새 Issue를 격리 Runner에서 검사한다. 잘못된 제목/라벨/본문은 원본 Issue에 읽기 검증된 미접수 댓글을 남기며, 기존 설치 workflow의 엄격한 진입 검사는 그대로다. 새 Issue가 아예 어떤 등록된 제목·라벨도 갖지 않은 경우는 의도를 추정할 수 없으므로 생성자가 사전검증해야 한다.
- `shared-resource/lifecycle.mjs`는 공통 자원 키·안전 이연 시점·근거 결과쌍·중복 ID·신규 승인 재계획을 정의한다. 기존 일반챗이 자동으로 재개되는 인터페이스는 아니다.
- `agent-handoff/resource-wait-ledger.mjs`는 인증된 정상 자원 대기만 #68에 영구 댓글로 1회 기록한다. 중복 수신은 기존 기록 재사용, POST ACK 분실은 조회만 수행한다. 조정 원장 #68은 실제 PC lease가 아니다.
- 현재 자동 이벤트 연결은 등록 Writer B 승인 Issue 사전검사, PC Job/Writer B 완료 결과에 대한 독립 오류 접수 및 결과 반환으로 확장됐다([PR #1133](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1133)). **2026-11-10 실제 PC Job 정상 결과 접수 3/3 PASS**(#1134·#1135·#1136), 확인된 실패 0건, 자동 PC 재시도 0회. 이는 실패 사고의 종단간 실증이 아니다.
- **봇 생성 Incident의 연결 보완(2026-11-10):** 접수 워크플로가 기본 `GITHUB_TOKEN`으로 생성한 `agent-handoff` Issue는 GitHub의 연쇄 이벤트 방지 규칙으로 일반 `issues.opened` 워크플로를 자동 실행하지 않는다. 또한 수동 Issue 라우터는 원담당 계정 작성 이벤트로 엄격히 한정되어 있다. 따라서 PC/Writer B producer는 인증된 원본 결과→봇 Issue 생성·본문/라벨/작성자 readback 후 **동일한 격리 `workflow_run` 잡에서** 직접 `HANDOFF_ROUTED` 댓글과 대기 라벨을 기록한다. 기존 Issue 재사용·POST 응답 분실·댓글 성공/라벨 실패도 같은 bot readback으로 보정하며, 실패 시 route 성공을 선언하지 않는다. 새 AI 에이전트 자동 실행·다른 일반챗 자동 수신·PC 복구/설치·예약은 여전히 수행하지 않는다. 실제 실패→route→verified return→원담당 ACK는 자연 발생 증거가 있기 전까지 미검증이다.
- **활성화 변수 범위:** `ZGMINI_PC_HANDOFF_INTAKE_ENABLED`는 PC Job의 독립 오류 접수 **및 해당 접수 내부의 인증된 bot 직접 라우팅**을 한 단위로 허용한다. `ZGMINI_PC_HANDOFF_WRITER_B_INTAKE_ENABLED`는 Writer B의 동일 단위를 별도 허용한다. 반면 `ZGMINI_AGENT_HANDOFF_ENABLED`는 owner가 직접 만든 Issue의 수동 라우팅과 owner 결과 댓글 처리 워크플로에 적용된다. **중앙 변수 하나가 모든 입구를 정지시키는 공통 kill-switch는 아니다.** 특정 경로를 끄려면 해당 독립 승인 변수를 적용 범위에서 조정해야 하며, 새로운 Gate를 임의로 늘리지 않는다. 현재 값은 여기서 주장하지 않는다.
- **라벨 readback 경합 보호:** 직접 라우팅이 댓글과 상태 라벨을 기록하기 전후에도 기본 `agent-handoff` 라벨·봇 작성자·원본 본문이 유지되는지 확인한다. 기본 라벨이 사라지면 성공으로 기록하지 않으며 자동 재발행·PC 재실행을 수행하지 않는다.
- 실제 GitHub workflow의 활성 동작과 PC 운영 적용·원담당 수신·자원 해제 재평가는 별도 단계로 실증한다.

### A급 pc-job 공용 자원 대기 연결

`agent-handoff/pc-result-to-incident.mjs`와 `pc-failure-producer.mjs`는 인증된 원본 pc-job Issue·완료 Run·결과 JSON/TXT로부터 **메모리 대기 및 seat/heavy lease 경합**만 공통 #68 원장에 기록하도록 보강했다. `BLOCKED` 전부를 대기로 취급하지 않는다. `PREVALIDATION`·`mutationStarted=false`·운영/공급처/D1 쓰기 0·SQLite 미접근·자원 lease 미보존 및 동일 TXT 일치를 요구한다. 증거가 부족하면 `PARTIAL_WAIT_EVIDENCE_PENDING`으로 보존하고 임의 재실행하지 않는다.

원래 pc-job에는 승인 manifest가 없을 수 있으므로, 공통 원장은 승인 범위(작업 종류·source 저장소/브랜치/SHA)의 SHA-256 `approvalFingerprintSha256`를 허용한다. Writer B는 원래의 실제 manifest SHA-256을 그대로 사용한다. 일반 pc-job requestId는 UUID 외 `pc-...` 형식도 기존 Controller 검증 계약 범위에서 허용한다. 신규 기능은 이 공통 모델에 adapter를 연결하되 원래 승인/로그/결과 형식을 임의 변경하지 않는다.

### 요청 소모와 안전한 재평가 (코드 리뷰 보강)

- Writer B 진입 전 대기는 `UNCLAIMED_UNTOUCHED`, GitHub 원본 요청의 단회 실행 기회가 소모된 pc-job의 작업자 시작 전 대기는 `REQUEST_CONSUMED_PREWORKER_UNTOUCHED`로 구분한다. 둘 다 자동 재실행은 금지하며, PC Job의 기존 requestId 재사용은 불허한다.
- `reviewResourceWait`는 순수 판정 함수로 운영 파일·lock을 직접 확인하지 않는다. 현재 자원 해제·source SHA·원래 승인 상태를 함께 인증하는 실제 PC readback adapter가 아직 없기 때문에, 문자열 `VERIFIED_RELEASED`와 과거 SHA가 일치해도 **`RECHECK_EVIDENCE_PENDING`만 반환하고 `READY_FOR_OWNER_REPLAN`을 반환하지 않는다**. 자원별 인증된 원본 Issue·Run·봇 영수증·JSON/TXT 해시·시각·현재 source/승인·해제 증거가 구축되기 전까지 운영 자동 재개/성공 근거로 사용하지 않는다. 실제 운영 연결은 5단계에서 별도 검증한다.
- 공통 #68 원장 기록 성공 시 `WAITING_SHARED_RESOURCE_RECORDED` 반환을 추가했다. 이 상태는 원담당 ChatGPT가 결과를 자동 수신했음을 뜻하지 않는다.
- 확장 격리 CI에서 발견된 기존 `writer-b/receiver.test.mjs`의 POSIX 경로 전용 검사 두 건은 테스트 픽스처에서 Windows 구분자를 정규화해 동일 의미로 검증한다. 운영 복구 동작은 변경하지 않았다.

### 범용 자원 해제 A급 관측기 — 소스 준비 단계 (2026-11-10)

- `shared-resource-release-readonly`는 기존 Controller A급 허용목록에 등록한 **읽기 전용 관측 후보**다. `controller/shared-resource-release-readonly.mjs`는 고정 Windows `E:\\ZGmini\\data\\pc-writer`의 Core/Writer lock, 승인 설정의 **관측 SHA**, 기존 Scheduler/WMI JScript probe, Core Task XML hash를 1.5초 간격의 두 샘플로 대조한다. Task가 enabled/READY, 인스턴스·관련/불명확 프로세스 0, Core/Writer 잠금 부재, Task XML·설정 SHA 안정 조건에서만 `CANDIDATE_CLEAR_NOT_AUTHORIZED`를 표기한다. 그 외는 `OBSERVED_BUSY` 또는 `UNVERIFIED`다.
- 이 A 관측기 자신도 Controller의 request/seat lease를 사용하므로 **모든 lease 디렉터리 0개**로 판정하지 않는다. Controller 설치 owner lease, heavy 메모리/좌석, 결과 업로드 자원은 현재 `UNVERIFIED`로 남긴다. 새 공용 자원은 자원별 실제 소유권 판정과 보호 조건을 검증해 별도 확장한다.
- A 반환 `PASS`는 **두 번의 로컬 관측을 수집했다**는 뜻이다. `releaseVerified=false`, `runtimeSourceVerified=false`, `approvalVerified=false`, `ownerReplanAuthorized=false`, `automaticPcRetries=0`를 고정한다. `reviewResourceWait`의 `RECHECK_EVIDENCE_PENDING` 차단은 그대로이며, 진단 결과 하나만으로 자동 재개/새 설치하지 않는다.
- 이 소스의 GitHub 병합만으로 Windows 사용 가능이라 주장하지 않는다. 정규 승인된 Controller 설치가 `config/operations.json`, dispatcher, 신규 관측기 및 기존 `writer-b-1063-task-probe.mjs` 의존 파일을 동일 버전으로 설치한 뒤에만 사용 가능하다. #917 복구 및 운영 승인 보호를 우회하지 않는다.
- 남은 필수 연결: 원본 #68 대기 및 원본 Issue/Run+JSON/TXT 인증 readback, 현재 A 관측 Run/결과쌍의 원격 재조회, 최신 운영 source와 현재 승인 manifest 대조, 자원별 소유권 검증, 실제 Windows 대기→해제→원담당의 새 승인 판단. 이 모두가 실증되기 전까지 5단계는 **미완료**다. 새 예약 수집/자동 재시도는 하지 않는다.

### 공통 장애 인계의 운영 PC 독립화 (2026-11-10, 소스 병합 및 부분 실운영 확인)

- 기존 중앙 인계 4개 작업(PC 실패 접수·Writer B 실패 접수·Issue 분류/라우팅·검증 결과 반환)은 모두 운영 PC의 `zgmini-pc-control` Runner와 `E:\\ZGmini\\runtime\\node.exe`를 호출했다. 이는 Controller 장애가 중앙 장애 처리 기능까지 멈추게 하는 단일 장애점이었다.
- 네 작업은 운영 파일·Controller·Core·Writer/DB를 직접 조작하지 않는 GitHub API 전용 작업임을 확인했다. 해당 워크플로는 별도 승인 격리 Windows Runner `zgmini-handoff-ci-isolated`와 고정 SHA의 checkout/setup-node 22로 분리한다. 운영 B 설치와 실제 PC 점검은 계속 원래 보호된 운영 경로에 둔다.
- 승인된 GitHub actor/라벨/정확한 Issue/결과 스키마 및 기존 `vars.ZGMINI_AGENT_HANDOFF_ENABLED`·`ZGMINI_PC_HANDOFF_INTAKE_ENABLED`·`ZGMINI_PC_HANDOFF_WRITER_B_INTAKE_ENABLED` opt-in 조건을 변경하지 않는다. Runner 분리는 **미활성화 기능을 자동 활성화하지 않는다**. GitHub Issue 기록 역시 다른 일반챗에 자동 전달되지 않는다.
- 격리 공통 요청 admission의 실패 `SHARED_ADMISSION_REPORT_ENV_NOT_ALLOWED`는 Actions가 자동 제공하지 않는 `GITHUB_EVENT_ACTION`를 검증 스크립트가 요구하는 불일치 때문이었다. 호출 step에 `GITHUB_EVENT_ACTION: ${{ github.event.action }}`를 명시한다.
- 독립 테스트는 4개 중앙 job의 Runner/source-only 경로, opt-in/출처 검증, admission 환경값을 고정한다. CI 완료는 실제 운영 활성·실패 사건 완전 자동 인계·Controller #917 회복을 증명하지 않는다.
- **장애 격리 원칙:** Controller `RECOVERY_REQUIRED`는 Controller 실제 갱신·동일 lease에 직접 의존하는 실행만 중지한다. GitHub 중앙 조정, 독립 개발·정적 검증, 승인된 별도 Runner 작업, 각 기능의 무관한 경로를 한꺼번에 막지 않는다. 동일 Writer 설치 요청은 실제 Windows source·manifest·자원 상태를 현재 값으로 재검증하며 중복 requestId 자동 재시도 금지.

### 공통 인계 독립 운영의 자연 실증 (2026-11-10)

- #1133가 `main`에 squash 병합됐다(`7d561babe2ff510638b2227445c0245408da45d6`). 중앙 인계 4개 job 모두 기존 운영 `zgmini-pc-control` Runner가 아닌 `zgmini-handoff-ci-isolated`에서 실행되도록 정의됐고, 격리 Windows CI [Run 42691701101](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42691701101) **206/206 PASS**.
- 병합 뒤 원본 PC A [#1134](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1134)와 [#1135](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1135)의 **실제 완료**를 각 [intake Run 42691970785](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42691970785)와 [42692830715](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42692830715)이 Controller #917 미복구 상태에서도 성공적으로 읽었다. `SCAN_COMPLETED` 2/2, 각 결과 1건, 실제 실패 0, 신규 사고 0, 운영 PC 쓰기 0, 재시도 0.
- 이 성공은 **정상 원본의 안전 제외** 증거다. 실제 실패에서 원본 Issue/Run+JSON/TXT 인증 → 전문 중앙 Issue → 검증된 복구 결과 반환 → 원담당이 별도 일반챗에서 직접 수신한 경우는 아직 관측되지 않았다. 입구의 `GITHUB_EVENT_ACTION` 소스 수정 역시 자연 발생한 부적합 승인 Issue의 bot 영수증은 미검증이다.
- 중앙 #68 최상단에는 [2026-11-10 현재 범위/재개 안내](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6750647072)를 연결해 과거 11월 8일 공유 Writer 설치 계획을 현행 전역 Gate로 오독하지 않게 했다. 기존 이력은 보존했다.
- 5/5 단계 완료 기준은 변하지 않는다. 새 시험용 PC 작업·인위적 실패·기존 requestId 재실행·예약 검증을 만들어 최종 실증을 당기지 않는다.
