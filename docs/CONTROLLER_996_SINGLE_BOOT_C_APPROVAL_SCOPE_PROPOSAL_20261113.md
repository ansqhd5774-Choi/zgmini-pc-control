# #996 단일 WinPE 부팅 C급 복구 — 정확한 승인 범위 제안서

**기준:** 2026-11-13 KST / **상태:** `UNAPPROVED_PROPOSAL / SOURCE_ONLY / C_NO_GO`  
**대상:** 기존 운영 PC `PC` 하나. 공통 대기열 PC `DESKTOP-N62L0NG`은 격리 CI·선택적 TEST_ONLY 시험만 담당.  
**목적:** 기존 #996 중단 복구의 원본 C claim·새로운 승인된 continuation claim·install lease를 원본 손실 없이 순서대로 보관하고, 정확한 실PC postcheck 이후 공유 설치 차단을 해소할 수 있는 *승인 요청의 경계*를 고정한다. 이 문서는 승인 manifest·실행 명령·Owner 동의가 아니다.

## 1. 이미 확인된 원본 — 반복 조회 금지

| 증거 | 판정 | 이번 승인의 증명에서 제외되는 부분 |
| --- | --- | --- |
| 운영 [#1265 / Run 43124923743](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1265) | E: 볼륨 GUID/Serial, 7 디렉터리 FILE_ID `PASS` | WinPE 볼륨 재바인딩·그 후 변동 없음은 미검증 |
| 운영 [#1342 / Run 43303078533](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1342) | #996 owner/marker/ledger `CORRELATED`, raw SHA 3/3 역사적 고정값 일치, install lock `held=true/recoveryRequired=true` | owner PID 현재 생존, 새 승인, C 배타 실행 및 postcheck 아님 |
| 격리 [Run 43304286248](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43304286248) | 부모 디렉터리 exclusive share 0에도 새 파일 삽입 성공 | 온라인 디렉터리 핸들 방식은 안전 보장 불가 |
| 격리 [Run 43306796062](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43306796062) | 기존 승인 검토의 원본 3 SHA 연속성 소스 검증 15/15 `PASS` | C 권한·현재 PC 전체 보호·새 WinPE 실증 아님 |
| 격리 [#1270 / Run 43130418963](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1270) | CPU VT/SLAT·firmware enabled, VM 표준 6경로에는 실행 파일 없음 | 포터블 VM·WinPE 부팅·실물 PC 복구 허가 아님 |

실증 당시 설치 유지보수기 SHA는 `16064e29fea0e53e7769a24d93d75b6f5292cfc0`, Controller SHA는 `badad9124157879d7a645b64f2768113d632355b`. 새 Git HEAD/소스 검사는 설치 성공을 뜻하지 않는다.

## 2. 기존 승인 계약의 실제 불일치 — 재사용만으로 승인이 되지 않음

기존 `tools/controller-996-continuation-gate.mjs`와 `tools/controller-996-native-continuation-consent-reader.mjs`가 요구하는 `CONTINUATION_EFFECTS` 7개는 **기존 Windows 온라인 continuation C**를 위한 제안이며, 본 문서의 다음 3영역을 명시하지 않는다.

1. **운영 효과:** 원래 운영 Windows의 6개 ZGMINI Runner drain·자동 재시작 억제, 사용자 세션 종료·부팅 변경·WinPE 진입 및 정상 Windows 복귀, 최대 24시간 GitHub 큐·신규 작업 유실 방지. Workflow PUT·원본 Issue 재생·무승인 backlog 수정은 하지 않음.
2. **오프라인 효과:** 원래 PC의 동일한 실제 E: 물리 볼륨을 GUID/Serial/FILE_ID로 재확인 후 단독 접근하고, 정확한 원본/대상 경로를 **무교체 보관**. 현재 코드 `plan996SingleBootRecovery`의 OLD_C 목적지는 legacy `controller-recovery-archived-<original>`이 아니라 충돌을 피한 `controller-recovery-interrupted-<original>`.
3. **보호 및 복귀 효과:** 독립적으로 고정된 Owner SPKI·실제 서명된 짧은 오프라인 handoff와 신뢰된 만료/시각·철회 경계, WinPE 이미지와 native x64 실행물의 바이트 SHA, 부팅전·후 Writer/Controller/Workflow/Backlog/원본 PC Job 4개/lease/claim 읽기 검증, 중단 시 손실 없는 `STATE_UNKNOWN` 보존.

**금지:** 기존 continuation manifest의 `approved:true`를 WinPE 동의로 사용하거나, 불일치를 맞추려고 기존 검사·STOP을 삭제/완화하는 행위. 기존 C 후보에는 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`, `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` 두 무조건 STOP이 있어 실행할 수 없다.

## 3. 새 C 승인에서 명시해야 할 실제 효과 — 아직 모두 미승인

| 시점 | 별도 승인이 필요한 실제 효과 | 필수 전제 및 STOP |
| --- | --- | --- |
| 원래 Windows, C 이전 | 사용자에게 통지한 운영 중단 창에서 **운영 PC 6 ZGMINI Runner drain 및 Windows 재시작 억제**; 원본 승인된 pc-job Issue의 대기 위험 평가 | 실제 registered Runner ID, Supervisor/Watchdog/Receiver, 활성 Workflow, pending/running Job, 보호 Writer·예약, 온라인 owner/claim/lease 현재값이 원본과 일치하지 않으면 STOP |
| 원래 Windows, C 준비 | 승인된 독립 continuation C claim을 고정 이름·원자 예약 경로에서 생성, 불변 원본 진단·서명 handoff 영속 보존 | 기존 `controller-recovery`와 `controller-install`은 보존; 새로운 예약·marker 경로, 이름, owner, sha, timeout이 승인 manifest에 정확히 포함되어야 함 |
| 원래 Windows → WinPE | **같은 운영 PC**를 1회 종료/다른 부팅 환경으로 전환, 네트워크·Owner 승인 freshness와 명시된 만료 조건을 재검증 | 물리 PC 및 복귀 가능성, 선정된 ISO SHA·메타데이터·native 해시·부팅 방식 승인 없음 또는 WIM 구조 변동 미해소 시 STOP |
| 선택 WinPE, 오프라인 | 원본 볼륨 독립 재바인딩과 원본 해시/ACL/FILE_ID 보호, 정확히 3개 **디렉터리 rename without replacement** 수행: OLD_C → interrupted archive, continuation → continuation archive, **install lease를 마지막으로** archive | 첫 이동 전 배타 접근·no reparse·원본 PID 없는 Windows 종료·원래 PC 아닌 디스크 미부착, 오프라인 owner 서명/기한 검증 실패 시 **이동 0**. 단계별 source/destination 양쪽 FILE_ID 재조회. 충돌/모호성/미지원 API는 STOP·재시도 0 |
| WinPE → 정상 Windows | 원래 Windows로 복귀, 보호 원본·원장·Controller/Writer/Job·Workflow/Backlog·3 archive·잔여 claim 현재 상태 검증 | postcheck 전 자동 수집/Writer/Controller 설치 재개 금지. 실패 시 임의 unlock, delete, auto retry, restore, workflow PUT 금지 |
| 후속 전환 | 정확한 검증 후 승인된 프로세스로만 자동 시작·Runner·수집 재개 | 전원/로그인/네트워크, 대기 24시간 이내 처리 여부 및 중복 방지, 보호/원장 해시 재조회, 별도 승인 범위 없는 새로운 설치 금지 |

**실행 금지 효과:** E: DB/원자료/Writer 파일 내용 변경, DNS/Cloudflare/배포 변경, 승인 없는 Workflow PUT/원본 Issue replay/Backlog 재작성, 강제 잠금 해제/삭제/임의 복구, 제3 PC 생성·공통 대기열 PC를 운영 PC로 대체, 유료 VM/자동 구독·새 예약.

## 4. 승인 전에 해시·기능을 확정해야 할 미완료 입력

| 구분 | 현재 확보된 근거 | 승인 가능한 최종 고정값 |
| --- | --- | --- |
| 원본 식별 | 원래 #996 ID/Issue/target 및 #1265 볼륨/FILE_ID·#1342 lease 3 SHA | **직전 보호 자료 fresh readback + 전체 backup/ACL/원장 해시**가 추가로 필요 |
| 원본/대상 경로 | `plan996SingleBootRecovery`의 3개 동일 `leases` 부모 아래 고정 경로 | 새로운 C claim UUID, 실제 archive 대상의 사전 `ABSENT` 검증/해시 |
| 운영 C 실행기 | 소스 후보 `tools/controller-996-c-native-owner-operator.mjs` (Git blob `2708a3a93d3b1be8ef10ff4e36f62d71d15d9b20`) | **본 후보는 무조건 STOP**. 별도 신뢰 native x64 offline mover source+바이너리 SHA, 실제 WinPE 호환성 필요 |
| 선택 WinPE | 격리 ISO 테스트 전용 SHA256 `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588`, test-only EXE SHA256 `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218` | 실제 운영 복구 이미지로 채택 불가. WIM metadata drift 원인 미확정, 실제 부팅·CNG·원본 볼륨 독립 확인 없음 |
| Owner 인증 | `tools/controller-996-signed-offline-handoff.mjs` RSA-PSS 소스 후보 | 실제 소유자 공개키 SPKI pin, 새 exact manifest Git 바이트 SHA, 명시 consent 댓글 및 철회, 신뢰된 offline time/validity는 **미정** |
| 온라인 admission | `tools/controller-996-offline-admission-review.mjs` 순수 synthetic 판정, 6 Runner 이름 구조 | 실제 Runner 등록 ID/현지 매핑·중단/재시작 방지·pc-job 대기/24h 보호 실증 없음 |
| 복구/복귀 | crash reconciliation C 순수 모듈과 기존 source tests | 실제 WinPE에서 native no-replace·FILE_ID, 영속 ACK, Windows 복귀 후 모든 original postcheck 미확정 |

**주의:** 격리 PC의 테스트용 VM 설치·1회 WinPE boot는 별도 선택적 효과 승인 사안. 그 시험 성공을 원본 운영 PC의 C 승인이나 실물 배타성으로 대체하지 않는다. 운영 PC의 실제 부팅/Claim/Lease 변경은 **별도의 정확한 Owner C 승인**이 필요하다.

## 5. 정확한 승인 요청 작성·수신 순서

1. 단일 #996 C Owner가 위 빈칸에 대응하는 native 실행물/ISO 원본을 **실제 설치·실측·독립 서명으로 검증**하여 고정한다. source-only 예시 digest, 가짜 Owner 키, 오래된 값으로 채우지 않는다.
2. 이전 연속 복구 manifest `ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1`을 변경 없이 재사용하지 않는다. **단일 WinPE 부팅의 새 효과를 명시한 별도 승인 manifest 스키마**와 exact Git commit·내용 SHA, 기간·PC·경로·재부팅·복귀 중단/회복 기준을 고정한다.
3. Owner가 해당 manifest의 모든 실제 운영 효과를 알도록 보고한 뒤 별도의 *명시적 승인*을 수신·정확한 최신 GitHub 원장으로 재조회한다. 일반 “계속해라”·Draft PR·CI 성공·`approved:true` 임의 기재는 승인 아님.
4. 승인되더라도 그 즉시 실행하는 것이 아니라, 실제 운영 전용 preflight에서 원본 owner/claim/lease/Writer/Workflow/Runner/4 Jobs와 승인·해시·freshness를 다시 검사하여 **불일치 시 무변경 STOP**.
5. WinPE 부팅과 C 보관은 그때 승인된 운영자의 단회 경로에서만 허용. 실패 시 중복 재실행 없이 기존 ledger/ID/체크포인트 readback, `STATE_UNKNOWN`과 공유 설치 잠금 보존.

**현재 판정:** `OWNER_C_NOT_GRANTED / WINPE_RUNTIME_UNPROVEN / C_NO_GO`. 원본 보호/Runner 및 독립 기능의 정상 운영을 이 제안서 때문에 새로 중단하지 않는다. **본 제안서는 시뮬레이션/코드 진행률도 아닌 승인 전 요구사항 분리 작업**이다.

## 2026-11-13 — WinPE TEST_ONLY 실증 완료 반영 / 운영 C 승인 범위 유지

**원본 추가 실증:** 별도 공통 대기열 Windows 10 PC `DESKTOP-N62L0NG`에서 기존 사용자 세션 Runner `ansqh-tistory-publisher`를 사용해 **정확히 1회** 격리 WinPE 부팅·CNG test-only 실행·종료를 확인. 게스트 `X:\Windows\System32>` 표시 [Run #43339375970](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/43339375970), CNG 화면 `6 OF 6` [#43339714153](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/43339714153), 종료 코드 `0` [#43340021424](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/43340021424), VM `poweroff` 및 원본 ISO SHA256 불변 [#43340339111](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/43340339111) PASS. 영구 텍스트 원장은 [control main `results/c996-winpe-test-only-20261113-verified.txt`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/c996-winpe-test-only-20261113-verified.txt), #996 원장 [댓글 6840486828](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6840486828).

**이 문서의 이전 `WINPE_RUNTIME_UNPROVEN`은 2026-11-13 테스트 이전 이력이다.** 현재 `TEST_ONLY_WINPE_BOOT_AND_CNG_6_6_PASS`로 범위를 수정한다. **별개의 운영 C급 오프라인 실행기·Volume GUID/Serial/FILE_ID 재바인딩·WIM 메타데이터 완전성·Owner trust 및 서명/시각/철회·namespace no-replace 원자성은 이 시험에서 입증되지 않았다.** 격리 VM은 운영 PC의 E: 원본 볼륨을 부착하지 않았고, 게스트 자체도 `bootIntegrityProven=0`, `imageBindingVerified=0`, `ownerApprovalVerified=0`, `offlineClockTrusted=0`, `revocationVerified=0`, `executionAuthorized=0`, `operationalWrites=0`으로 명시했다.

**다음 승인과 독립 기술 필수 입력:** 운영 PC `PC`의 정확한 효과가 고정된 신규 Owner C manifest/서명·신뢰 anchor, 네이티브 오프라인 x64 mover 빌드 해시 및 원본 볼륨 식별, 운영 중단/복귀 창·Runner/Writer/Workflow/원장 보존 범위, 예외 없는 pre/postcheck. 이전 continuation C 승인 또는 TEST_ONLY 동의는 해당 단일 부팅 운영 효과의 승인으로 사용하지 않는다. `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`, `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` 무조건 STOP을 변경하지 않는다. 이 문서 수정으로 C 코드/VM/운영 PC 실제 효과 0.
