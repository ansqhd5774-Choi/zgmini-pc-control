# 공통 Writer B — 신규 기능 재사용 안내 (Source-only)

> 공통 Writer B의 실제 PC 설치 선례: [#651](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/651), [#666](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/666). 해당 당시의 승인 범위에만 유효하며, 후속 기능 파일의 자동 설치·게시 성공을 뜻하지 않는다.
> 아래는 **각 기능 원담당**의 승인된 공통 경로 재사용 안내다. PR 생성·병합·테스트 PASS와 새 기능의 실제 PC 설치·게시 검증을 구분한다.

### 승인 소스의 상대 import 누락 진단 (소스 계약; Windows 적용 별도)

- `WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`은 기존 **설치 전 안전 중단**이며 자동 복구·재실행 요청이 아니다. 실제 PC 파일 부재뿐 아니라 심볼릭 링크·파일 범위·크기·읽기 검증 실패일 수 있으므로 경로 없이 원인을 추측하지 않는다.
- 검증된 결과 JSON의 선택적 `diagnostic`은 `sourceKind=APPROVED_AFTER`, `sourcePath`, `dependencyPath`, `reason`만 허용하며, TXT에는 `IMPORT_SOURCE_KIND`, `IMPORT_SOURCE_PATH`, `IMPORT_DEPENDENCY_PATH`, `IMPORT_REASON`으로 제공한다. 경로는 승인된 소스 루트 내부 **상대경로**만 출력한다.
- 같은 승인 AFTER의 미확인 상대 import가 둘 이상이면 첫 `diagnostic`은 유지한 채, 안전 검증된 `diagnostics[]` 최대 8건과 `diagnosticsOmitted`를 **동일 preflight STOP의 JSON/TXT**에 함께 기록한다. 9건째 이후는 생략 개수만 보존하며 원자료·절대경로·임의 Error.message는 보고하지 않는다. 여러 의존성 때문에 정상 B 요청을 한 건씩 반복 소비하지 않도록 하는 관측 개선이다. 안전 STOP·기존 1건 결과·requestId 단회 계약은 변하지 않는다.
- 위 Writer B 검사는 새 `pc-writer-source-install` Issue의 GitHub event SHA로 checkout한 **그 Run의 제어 repo 소스**를 사용한다. Controller 업데이트 [#880](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/880)은 `controller/` 8파일만 실PC 설치한 결과이므로 Writer B의 신규 진단 코드가 실제 Windows B에서 실행됐다는 증거로 혼용하지 않는다.
- `reason`은 `NOT_FOUND`, `SYMLINK`, `NOT_FILE`, `SIZE`, `OUTSIDE_ROOT`, `READ_ERROR`, `UNAVAILABLE_OR_UNSAFE` 중 하나다. `UNAVAILABLE_OR_UNSAFE`는 미확정 사유이지 파일 부재 판정이 아니다.
- 해당 결과를 받은 기능 원담당이 대상 import의 승인 범위·실제 설치 원본을 확인하고 필요한 범위만 조정한다. **미승인 의존 파일 자동 복제·검사 우회·소비된 Issue 재실행을 금지**한다. 소스 PR·로컬 테스트만으로 실제 Windows 진단 인계 완료를 선언하지 않는다.

## 1. 한 기능을 추가할 때

1. **기능 원담당**이 최신 개발 `main`과 실제 PC의 승인 source·실행 checkout·운영 Git HEAD/branch·`config.source`·Core Task/실행 래퍼를 구분하여 필요한 **A급 읽기 전용** 증거를 확보한다. 과거 SHA·예시 경로를 현재 값으로 추정하지 않는다.
2. 변경할 Writer 파일(`M`/`A`)마다 대상 경로·원본 SHA-256(`A`는 `null`)·목표 SHA-256과 정확한 후보 소스 커밋을 정한다. 보호 파일 및 **실제로 영향받는** VBS/CMD/Sidecar 소비자와 Task XML 해시를 필요한 범위에서 검산한다. 다른 담당자의 dirty target·동일 Writer 쓰기 충돌은 덮어쓰지 않는다.
3. 파일 목록·승인 범위를 검토받아 제어 저장소의 `approvals/writer-updates/<approval-id>.json`에 **정확한 승인 manifest**를 고정하고 그 **원본 UTF-8 바이트**의 SHA-256을 확보한다. 다른 기능용 고정 B 어댑터나 Controller 전용 설치 경로를 사용하지 않는다.
4. 정규 경로가 **실제로 활성화되었고** 승인된 범위에 한하여, 아래 단회 private Issue를 원 소유자가 등록한다. 기존 자체 Windows Runner의 공통 workflow가 고정된 control commit과 승인 후보 SHA만 검사한 뒤 해당 파일 오버레이를 시도한다. 신규 CMD·예약·전역 Runner 유휴 조건은 추가하지 않는다.
5. 정확한 requestId의 PC 결과와 원격 `results/writer-b-source-install-<requestId>.json`·`.txt` **두 결과쌍 2/2 재조회**, 실제 HEAD·config·Task·파일 보호 상태를 확인한 뒤 기능 원담당이 수집→저장→D1→API→페이지 운영 검증을 계속한다.

**첫 실행 경로 확인의 범위:** `run-local.mjs`/`local-cycle.mjs`를 변경할 때만 Task XML의 단일 `<Exec>`와 첫 WSH/CMD VBS·CMD 경로를 확인한다. Task의 절대 `WorkingDirectory`가 있는 상대 경로는 그 기준으로 결합하고, C: 호환 junction은 실제 E: Writer data 경로로 확인되는 경우만 허용한다. 실제 승인 `LAUNCHER` 경로·SHA와 맞아야 `FIRST_HOP_TASK_LAUNCHER_MATCH`이며, 불분명한 실행 경로는 STOP이다. **이 증거는 첫 hop에 한하며 다단 VBS·Sidecar 전체 체인이나 실제 실행 성공을 보증하지 않는다.**

### 기존 파일에 코드 삽입이 필요한 경우 — 읽기 전용 SHA 프리뷰 재사용

- 공유 `scripts/pc-writer/*.mjs`에 **삽입만** 필요한 변경은 [`insert-only-patch.mjs`](insert-only-patch.mjs)와 [`insert-preview-readonly.mjs`](insert-preview-readonly.mjs)를 먼저 확인한다. 정확한 `afterSha256`를 알 수 없다는 이유로 Writer B의 원본·목표 SHA 계약을 완화하거나 새 Controller·CMD를 만들지 않는다.
- PC 원본 바이트를 출력하지 않고 사전/사후 SHA와 Task XML SHA를 계산하는 기존 단회 A 워크플로는 [`pc-writer-insert-preview-once.yml`](../.github/workflows/pc-writer-insert-preview-once.yml)이다. [#645](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/645)·[#648](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/648) 실PC 성공은 **당시 지정된 파일**의 증거이며 다른 파일에 그대로 전용할 수 없다.
- 새 프리뷰 사양은 `approvals/writer-previews/<새-id>.json`의 **6필드** `schema/sourceRoot/baseHead/filePath/beforeSha256/insertions`와 그 원문 SHA256에 고정한다. 현재 PC `HEAD=config.source`, 대상 tracked-clean, 정확한 preimage SHA 및 고유 anchor를 기존 프리뷰가 검증한다. 과거 기능의 spec·SHA를 복사하지 않는다.
- 고유 `pc-writer-insert-preview` Issue의 결과 JSON/TXT를 직접 재조회한 뒤 **해당** `afterSha256`를 본문 2절의 기존 Writer B manifest에 반영한다. 프리뷰 PASS는 설치·공급자 호출·DB/D1 갱신 성공이 아니며, 실제 운영 쓰기는 기존 정규 B 및 기능 승인 범위로만 진행한다.

## 2. manifest 계약 (사용 전 반드시 실제 승인·해시 고정)

`writer-b/contract.mjs`의 `ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1`이 정본이다. 아래는 **필드 안내**이며 승인된 예시 manifest나 복사 실행용 JSON이 아니다.

| 영역 | 필수 필드와 의미 |
| --- | --- |
| 신분 | `schema`, `status=APPROVED_B`, `scope=PC_WRITER_APPROVED_FILE_OVERLAY_ONLY`, `sourceRepository=ansqhd5774-Choi/zgmini`, `sourceBranch`, `runCount=1` |
| 소스 | `candidateSourceSha`(정확한 승인 후보 40-hex), `baseHead`(실 PC HEAD), `baseConfigSourceSha`(실 config.source), `sourceRoot`, `configPath`, `coreTask` |
| 대상 | `files`: `{path, change: M 또는 A, beforeSha256, afterSha256}`. 기존 파일은 원본 해시 필수, 추가 파일은 `beforeSha256:null`; 변경 경로만 1~32개 |
| 보호 | `protectedFiles`: `{path,sha256}` (영향받는 기존 파일의 실제 원본 해시; 무관한 전체 검사는 요구하지 않음) |
| 실행 의존성 | `runtimeDependencies`: `{taskXmlSha256,consumers}`. 항목은 `{id,kind: LAUNCHER 또는 SIDECAR_SOURCE,path,sha256,dependsOn:[변경 파일 경로]}`. `run-local.mjs`/`local-cycle.mjs` 변경이면 Task XML 및 관련 launcher 선언 필요. 실제 영향 소비자만 선언 |
| 제한 | `allowProviderCalls`, `allowDbChanges`, `allowD1Writes`, `allowTaskDefinitionChanges`, `allowOtherSourceChanges` 모두 `false` |

현재 계약은 `E:\ZGmini\data\pc-writer\config.json`, `ZGMINI-PC-Local-Core`, 승인된 `E:\ZGmini\projects\...`의 sourceRoot 및 범위 내 `.mjs` M/A만 받는다. `baseHead`와 `baseConfigSourceSha`는 실제로 동일해야 한다. **새 실제 운영 경로를 임의로 만들거나 파일 범위를 확장하지 않는다.** source HEAD와 config.source가 불일치하거나 변경 대상이 dirty이면 승인 상태를 다시 확인한다. 이 한정된 계약에서 처리 불가능한 유형은 총괄에게 구체적인 오류와 필요한 최소 공통 개선을 요청한다.

## 3. 정규 B Issue 요청 양식

아래 **플레이스홀더는 유효한 승인값이 아니며 실행 금지**다. 실제 `requestId`와 `chatId`는 유효한 UUID, `approvalManifestSha256`은 **승인 파일의 실제 바이트 SHA-256**으로 바꿔야 한다.

```json
{
  "schema": "ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1",
  "requestId": "<새로운 UUID>",
  "chatId": "<기능 원담당 UUID>",
  "operation": "pc-writer-source-install",
  "controlRepository": "ansqhd5774-Choi/zgmini-pc-control",
  "approvalManifestPath": "approvals/writer-updates/<승인된 파일명>.json",
  "approvalManifestSha256": "<승인 원본 바이트 SHA-256>"
}
```

- 저장소: 비공개 `ansqhd5774-Choi/zgmini-pc-control`
- Issue 제목: `pc-writer-source-install` · label: `pc-writer-b-install` · 동작: 원 소유자의 신규 `opened` 한 번
- workflow: `.github/workflows/pc-writer-b-source-once.yml` (**인증된 Actions 활성 상태를 확인**, 소스 병합은 실제 Runner 접수·PC 설치 성공 증거가 아님)
- 요청 불변 조건: Issue 승인 경로/해시, control event commit, 후보 commit, 대상 파일 SHA; **같은 requestId 재실행·임의 운영 명령 불가**

## 4. 실패와 담당 구분

- `WRITER_B_PREFLIGHT_STOP`: 운영 변경 전 정확한 오류 코드·source/해시/승인·충돌 확인. 구 요청을 그대로 반복하지 않는다.
- `WRITER_B_INSTALL_STOP_RESTORED`: 원본 HEAD/config/Task 복구 확인 결과만 인정한다. 원담당이 실패 지점을 수정하고 **새로운 명시 승인**이 필요한지 기존 범위와 대조한다.
- `WRITER_B_RECOVERY_REQUIRED` 또는 `WRITER_B_STATE_UNKNOWN`: **재실행·잠금 강제 해제·수동 소스 전환 금지**. 해당 requestId의 원장·백업·실제 PC 상태를 읽기 전용으로 재조정하고 승인된 복구 담당 경로로 인계한다.
- `RESULT_DELIVERY_UNVERIFIED`: 로컬 실행 성공 여부와 원격 증거 전송을 분리한다. JSON/TXT 원격 2/2가 아니면 GitHub 댓글만으로 설치 성공 주장 금지, PUT·설치를 무조건 재시도하지 않는다.

**로컬 합성 SHA의 추적:** Writer B는 기존 R17 선례처럼 승인 파일만 격리 Git overlay로 합성한다. 생성된 `preparedLocalSha`는 **PC 로컬 커밋이며 GitHub에 push하지 않는다.** Task 일시 중지 *이전*에 `E:\ZGmini\data\pc-writer\writer-b-install-once\<requestId>\provenance.json`에 `LOCAL_OVERLAY`, 승인 manifest 해시, base/candidate SHA, base/prepared tree OID, 로컬 ref, 파일별 원본·목표 해시를 일회 기록·fsync·재조회한다. 원격 TXT/JSON의 `LOCAL_ONLY=true`·`PROVENANCE_SHA256`은 이 로컬 증거를 지칭하며 GitHub 커밋 URL 존재의 증거가 아니다. **다음 B·후속 A에서는 GitHub SHA 조회로 로컬 HEAD를 추정하지 말고**, 실제 PC checkout HEAD·config.source·해당 로컬 Git object/ref·manifest/원장 SHA를 다시 읽기 전용으로 확인한 뒤 다음 적용 기준을 확정한다.

**프로세스 총괄**은 공통 계약·수신기·충돌·복구 경로를 맡고, **기능 원담당**은 기능 코드/manifest 검토·승인된 B 신청·실제 기능 게시 검증을 맡는다. Issue 댓글은 다른 ChatGPT 대화의 수신 증거가 아니다. 전용 R17·캘린더 고정 B 및 Controller-only 유지보수기를 기능별 Writer 변경에 우회 사용하지 않는다.
