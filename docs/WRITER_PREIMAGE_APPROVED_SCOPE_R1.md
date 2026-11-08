# Writer 설치 전 원본 조회 — 재사용 가능한 승인 범위 R1

2026-11-08. 이 문서는 새 기능별 Controller 소스 하드코딩을 없애는 **후보 계약**이다. 소스 PR/병합은 실제 Windows Controller 설치 증거가 아니다. 사용 전 설치된 `host.controllerFiles`와 고유 `pc-job` 결과를 확인한다.

## 문제와 호환성

- 과거 `writer-install-preimage-readonly`는 시장 캘린더 3개 + 고용 R6 19개를 코드 상수로만 조회했다. 새 물가지표 6개를 지원하려면 동일 Controller를 매번 수정해야 하는 구조적 문제가 있었다.
- **기존 7필드 요청은 그대로** 동작하며 이전 22개 경로, 원본 SHA/상태, `calendar`·`employmentR6` 응답 키는 유지한다.
- 신규 범위는 **동일 A operation**에 `preimageManifestPath`와 `preimageManifestSha256` 두 필드를 함께 추가한다. 이외의 임의 `paths`, 쉘, SQL, URL 입력은 금지한다. 다른 operation에는 추가 필드가 허용되지 않는다.
- 별도 Controller·Runner·workflow·스케줄러·기능별 CMD는 생성하지 않는다. 이후 새 기능은 검토·승인된 manifest 파일만 GitHub 정본에 추가하므로 Controller 재설치가 필요하지 않아야 한다.

## 신뢰 경계 및 승인

1. 기능 담당자는 수정/추가 대상과 파일별 `M`/`A`, 변경 이유를 검토하여 비공개 제어 저장소의 `approvals/writer-preimage/<approved-name>.json`에 최소 범위 manifest를 PR로 반영한다. `main` 반영 및 그 SHA와 파일 원문 SHA-256을 대조한다. 이 manifest는 **읽기 승인**이며 Writer B 설치 승인이 아니다. B의 `beforeSha256`은 이 A 결과로 확보하고 별도의 정확한 B manifest에 기록한다.
2. `pc-job` 이슈의 기존 7필드에 두 값을 추가한다. `preimageManifestPath`는 위 고정 디렉터리의 명명 제한 파일, `preimageManifestSha256`은 **승인 원문 파일 바이트**의 소문자 SHA-256이다. Issue에는 파일 배열, 인증 정보, 임의 경로 또는 내용을 넣지 않는다.
3. 기존 `pc-job.yml`의 **조건부 GitHub 인증 단계**가 실행 이벤트의 불변 `GITHUB_SHA`에 고정해 비공개 제어 repo의 승인 파일을 가져온다. 승인 파일의 실제 SHA-256과 정확한 schema/status/scope, 고정 sourceRoot, 파일 수 1~32, 상대 `.mjs` 경로, `M`/`A`, 중복·탈출 경로 부재를 검사한다. 이 단계에서 먼저 `host.controllerFiles`에 등록된 스테이저·검증기·공통 모듈을 포함한 모든 고정 Controller 파일 SHA를 검증한다.
4. 인증 단계는 해당 Run/Attempt의 `RUNNER_TEMP`에 **비밀정보 없는 승인 경로 목록만** 임시 저장한다. 기존 Controller `entry`는 고유 requestId/manifest SHA/event SHA를 재검산해 `engine` 작업 입력으로 전달하고, 자격 증명 없이 실행되는 격리 worker가 기존 `sourceRoot` 정합성을 검사한 뒤 해당 경로만 읽는다. 출력은 경로·존재·비민감 해시·상태와 기존 검증 필드뿐이다. 운영 파일과 DB는 읽기만 하며 변경하지 않는다.
5. 단계 누락·파일 해시 변조·스코프 거부·인증 실패·서버 조회 오류는 `BLOCKED`로 보고한다. Actions staging 실패여도 뒤따르는 `entry`가 가능한 경우 원래의 고유 결과 TXT/JSON을 작성하도록 staging 단계는 `continue-on-error` 처리한다. 이 예외는 **A 조회 성공으로 간주하지 않는다**. 동일 요청을 무조건 재실행하지 않는다.

## 추가 2필드 예시

아래는 **형식 예시**다. 실제 `sourceSha`, requestId, 승인 원문 SHA는 현재 정본을 조회해 기입한다.

```json
{
  "schema": "ZGMINI_PC_JOB_V1",
  "requestId": "preimage-inflation-example-20261108",
  "chatId": "inflation",
  "operation": "writer-install-preimage-readonly",
  "sourceRepository": "ansqhd5774-Choi/zgmini",
  "sourceBranch": "main",
  "sourceSha": "0000000000000000000000000000000000000000",
  "preimageManifestPath": "approvals/writer-preimage/inflation-candidates-7-r1.json",
  "preimageManifestSha256": "4c5c0af01e5214390854688ff241b7bb6530a601c24aaf566dfce79f6b40e6a4"
}
```

위 예시의 `sourceSha` 값은 전부 0인 설명용 자리표시이며 **실행에 사용하지 않는다**. 승인 JSON의 `sourceRoot`는 `projects/zgmini-earnings-history-pc-release`로 고정하고, 현행 허용 상대 경로는 `lib/`, `worker/`, `scripts/pc-writer/`의 `.mjs` 파일이다. sourceRoot/HEAD/config.source의 실제 일치가 입증되지 않으면 설치 준비 완료로 판정하지 않는다.

## 인계·완료 판단

- 신규 기능용 manifest 반영은 공통 도구의 일회성 배포 이후 **Controller 코드 재설치 없이** 진행한다. 단 기존 승인 파일을 무단으로 수정하거나 HEAD를 과거 값으로 추측하지 않는다.
- `scopedPreimage.files[]`의 파일별 `path`, `expectedEffect`, `exists`, `sha256`, `state`, `trackedDirty`를 B 설치 manifest 준비에 사용한다. scoped 요청에서는 고정 22개 필드가 `NOT_OBSERVED`로 나오는 것이 정상이며 그 경로를 별도로 재조회했다고 보고하지 않는다.
- 완료 증거: 정확한 승인 manifest commit/SHA + 실제 Controller 설치 source + 고유 A Issue/Run + TXT/JSON 2/2 재조회 + 운영 source/head/config 및 파일별 SHA 검증. PR·모의 시험만으로 Windows 사용 가능하다고 보고하지 않는다.
- 다음 기능이 같은 조회를 요청하면 비밀정보를 제외한 승인 manifest 및 결과 계약을 재사용한다. 이미 성공한 #863 22개 고정 조회를 불필요하게 반복하지 않는다.
