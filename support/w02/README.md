# W02 Treasury A 영수증 순수 판정기 — 독립 사전지원

## 현재 상태 (2026-11-15)
- **소스만 구현:** 운영 PC, GitHub pc-job, SQLite, D1, Cloudflare, 예약 및 원담당 코드를 건드리지 않는다.
- 본 디렉터리의 `treasury-audit-receipt-review.mjs`는 실제 승인 A 작업 **완료 후** 다운로드한 결과 JSON 객체를 입력받는 **순수 함수**다.
- **로컬 Node 22.16.0 17/17 PASS**. GitHub 원격 코드·테스트 blob SHA를 로컬 `git hash-object`와 직접 대조: 코드 `024a051f1f50384449637b6c3decf9137b7a462d`, 시험 `682cc21a9fb4e4e8e83fd6a18a41b1342edf1c08`. 이는 **source fixture 시험**이며 실제 Windows A 실행/게시 성공이 아니다.
- 원담당 [W02 PR #1051](https://github.com/ansqhd5774-Choi/zgmini/pull/1051)의 마지막 비공개 TA_WS 저장 원문 감사(95%→최종 판단)를 보조한다. [실제 승인 A 등록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/8e2736a62a90798afe159ef4d96a8713265ca021/config/operations.json)은 `source-inventory-runtime-readonly`이지만 이 보조 코드는 **설치된 A 기능이 아니며 이를 필수 Gate로 만들지 않는다**.

## 사용 (원담당이 이미 결과를 회수했을 때에만)

```js
import {reviewTreasuryAuditReceipt} from './support/w02/treasury-audit-receipt-review.mjs';

// existingAResult: 원본 pc-job의 실제 results/*.json 객체.
// 이 코드가 조회·실행·파일 읽기·새 요청 발행을 수행하지는 않는다.
const review = reviewTreasuryAuditReceipt(existingAResult, {
  expectedRequestId: originalIssueRequestId,
  expectedSourceSha: originalIssueSourceSha,
});
// review.code: 정확한 첫 미검증 상태/불일치 유형을 분류.
```

- 해당 작업의 **원본 Issue requestId와 실행 시 sourceSha**를 직접 제공해야 한다. `sourceBranch=main`, `actualExecutionSha/controlSourceSha=8e273...` 및 비변경 증거 검증. Controller가 추가로 바뀐 경우 현재 고정 SHA로 판정 불가하므로 이 코드를 무조건 재사용하지 않는다.
- `REVIEWABLE / PRIVATE_TAWS_INPUT_AUDIT_REVIEWABLE`은 원본 저장 기간·계수·해시가 **같은 PC A 영수증 안에서** 충족됐다는 의미만 갖는다. **실제 D1 행·동일 시점 공개 API/UI 동치 또는 W02 100%**를 자동 승인하지 않는다. 해당 판단은 기존 게시 증거와 대조하는 원담당 책임이다.
- `PRIVATE_TAWS_AWARDED_COUNT_MISMATCH`, `PRIVATE_TAWS_INPUT_NOT_STORED`, `PRIVATE_TAWS_INPUT_CONTRACT_INVALID`, `PRIVATE_TAWS_WINDOW_OR_STORAGE_TIME_MISMATCH`, `A_RECEIPT_IDENTITY_OR_INSTALLED_SOURCE_MISMATCH` 등에 대해서는 **같은 요청 재실행 없이 최초 실패 하나만 조사**한다.
- 현재 증거가 날짜 2026-11-09·436 awarded였다고 이후 날짜까지 **436 고정 요구하지 않는다**. leap-day 포함 364일 경계, 출처·작업 신원·전체 PASS와 하위 Core 상태 분리, 시점 불일치, 조작된 flag/원본문 비노출 등을 시험.
- 운영 DB raw body, CUSIP, 인증 정보, 전체 응답을 GitHub나 지원자에게 올리지 않는다.

## 단독 회귀시험

```sh
node --test support/w02/treasury-audit-receipt-review.test.mjs
```

이 테스트는 **합성 결과만 사용**하고 운영 PC·네트워크·파일 쓰기를 실행하지 않는다. 기존 승인된 실제 A 결과는 반드시 W02 원담당이 원본 Issue/Actions/JSON+TXT로 회수해야 한다.

[앞서 준비한 최초 단회 감사 문서](../../docs/W02_TAWS_365D_FINAL_AUDIT_OWNER_ONEPASS_20261115.md)

## 2026-11-15 두 DB 판정 병목 해결 및 3단계 메타데이터 연결 (지원 소스만)

**기존 W02 마지막 5% 선행 실행은 변하지 않는다.** W02 원담당은 설치된 `source-inventory-runtime-readonly` A를 **새로운 요청 중복 없이 1회만** 사용하고 실제 결과를 회수한다.

실제 설치 [`inspectSourceInventory()`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/8e2736a62a90798afe159ef4d96a8713265ca021/controller/source-inventory-runtime-readonly.mjs)는 `core.sqlite`와 **무관한** `history.sqlite`를 함께 조회한다. `history` WAL `-wal/-shm` sidecar가 정상 체크포인트로 제거되면 `core.treasuryTawsInput`이 `OBSERVED`여도 최상위 `STATE_UNKNOWN/SOURCE_INVENTORY_PARTIAL_READONLY`가 나올 수 있다. **실제 PC에서 발생했다고 주장하지 않음; 설치 소스 분기의 가능한 장애**.

지원 판정기의 새로운 보수적 결과:

- 최상위와 내부 `PASS`, 원본 요청·Controller SHA, 비변경 보호, `core`의 365일 원문·건수·해시가 모두 유효하면 `REVIEWABLE/PRIVATE_TAWS_INPUT_AUDIT_REVIEWABLE`.
- 최상위 `STATE_UNKNOWN/SOURCE_INVENTORY_PARTIAL_READONLY`라도 **오로지** `history.status=STATE_UNKNOWN`, `history.code=WAL_SIDECARS_ABSENT_UNVERIFIED`, `core.status=PASS`, `core.code=STORED_INVENTORY_READONLY`, `protectedStateUnchanged=true`, 모든 쓰기/제공자 호출 0 및 내용 유효 조건일 때 `CORE_ONLY_REVIEWABLE/PRIVATE_TAWS_CORE_AUDIT_HISTORY_WAL_UNVERIFIED`.
- 그 밖의 history 오류, 실제 보호 drift, 원문 건수 불일치, Core 실패는 이전대로 보수적 `UNVERIFIED`. `CORE_ONLY_REVIEWABLE`은 **A 전체 PASS를 대체하지 않으며**, DB를 건드리거나 새 Controller 설치·작업 재실행을 요청하지 않는다.

### 기존 PC raw 결과 + 승인된 D1 행 + 공개 API JSON의 **동일 시점 메타데이터** 대조

[`treasury-three-lane-reconcile.mjs`](./treasury-three-lane-reconcile.mjs) 에 있는 독립 함수는 원담당이 **이미 확보한** 승인 증거를 인수로 받을 뿐 API를 호출하거나 SQL을 실행하지 않는다.

```js
import {reconcileTreasurySameCycle} from './support/w02/treasury-three-lane-reconcile.mjs';
const result = reconcileTreasurySameCycle(
  originalPcAResultJson,
  existingApprovedD1OutputRowMetadata, // kind, feed_key, snapshot_key, stored_at (본문 제외)
  existingPublicReleaseCalendarJson,
  {
    expectedRequestId: originalRequestId,
    expectedSourceSha: originalSourceSha,
    apiUrl: 'https://zgmini.kr/api/release-calendar',
  },
);
```

- PC private `storedAt`, D1 `output/release-calendar/current` `stored_at`, 공개 `updatedAt` 및 `sources.treasury.checkedAt`를 정확한 millisecond로 대조한다.
- 정상 메타데이터 결합: `METADATA_ALIGNED/PC_D1_API_METADATA_SAME_CYCLE_REVIEWABLE`. WAL로 history 전체 A가 미검증이면 `CORE_ONLY_METADATA_ALIGNED/PC_CORE_AND_D1_API_METADATA_ALIGNED_HISTORY_WAL_UNKNOWN`. 둘 다 `featureCompletionApproved=false`, `d1BodyEqualityVerified=false`, `productionUiVerified=false`, `publicReadOriginAuthenticated=false`를 유지한다.
- 날짜/건수/출처 불일치면 첫 오류 하나를 분류한다. TA_WS 원문 낙찰 **436행**과 공개 Treasury **입찰+공고 894행** 등은 애초에 같은 행 집합이 아니므로 숫자끼리 직접 등치시키지 않는다.
- 동일 타임스탬프는 **본문 데이터가 같다는 증거가 아니며**, 코드에 입력한 공개 JSON과 D1 메타데이터가 실제 Owner 승인 경로로 확보됐다는 인증도 하지 않는다. 기존 생산 D1 본문·실제 홈페이지 PC/모바일 UI 검증과 최종 W02 완료 결정은 원담당 몫이다. 이 도구를 새 운영 Gate로 만들지 않는다.

**네이티브 Node 22.16.0 단독 시험:** `node --test support/w02/treasury-audit-receipt-review.test.mjs support/w02/treasury-three-lane-reconcile.test.mjs` ⇒ **37/37 PASS** (22+15, FAIL 0). 로컬 시험 Git blob SHA와 GitHub에 제출한 각 4개 .mjs 파일 원격 SHA 일치. GitHub Actions/실Windows A/실제 D1 SELECT·API GET 결과는 **실행하지 않았다**.
