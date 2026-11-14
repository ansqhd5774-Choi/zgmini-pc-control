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
