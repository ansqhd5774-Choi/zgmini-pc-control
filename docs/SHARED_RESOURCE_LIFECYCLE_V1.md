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
| `WAITING_SHARED_RESOURCE` | 인증된 결과쌍에서 *청구 전 무변경* 경합·Core 활성 이연 또는 청구 후 *원본 복구 VERIFIED* | 원본 Issue + #68 대기 항목. 원본 요청 자동 재실행 금지 |
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
- 현재 자동 이벤트 연결은 **Writer B 완료 결과**와 **등록된 Writer B 승인 Issue 접수**에서만 존재한다. Controller/pc-job/신규 승인 라우트는 각자가 동일 공통 모듈의 인증 adapter를 사용해야 한다. 미래의 모든 업무에 이미 자동 배포됐다고 보고하지 않는다.
- 실제 GitHub workflow의 활성 동작과 PC 운영 적용·원담당 수신·자원 해제 재평가는 별도 단계로 실증한다.

### A급 pc-job 공용 자원 대기 연결

`agent-handoff/pc-result-to-incident.mjs`와 `pc-failure-producer.mjs`는 인증된 원본 pc-job Issue·완료 Run·결과 JSON/TXT로부터 **메모리 대기 및 seat/heavy lease 경합**만 공통 #68 원장에 기록하도록 보강했다. `BLOCKED` 전부를 대기로 취급하지 않는다. `PREVALIDATION`·`mutationStarted=false`·운영/공급처/D1 쓰기 0·SQLite 미접근·자원 lease 미보존 및 동일 TXT 일치를 요구한다. 증거가 부족하면 `PARTIAL_WAIT_EVIDENCE_PENDING`으로 보존하고 임의 재실행하지 않는다.

원래 pc-job에는 승인 manifest가 없을 수 있으므로, 공통 원장은 승인 범위(작업 종류·source 저장소/브랜치/SHA)의 SHA-256 `approvalFingerprintSha256`를 허용한다. Writer B는 원래의 실제 manifest SHA-256을 그대로 사용한다. 일반 pc-job requestId는 UUID 외 `pc-...` 형식도 기존 Controller 검증 계약 범위에서 허용한다. 신규 기능은 이 공통 모델에 adapter를 연결하되 원래 승인/로그/결과 형식을 임의 변경하지 않는다.
