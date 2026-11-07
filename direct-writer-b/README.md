# ZGMINI 독립 승인 Runtime B — 소스 시제품 (미설치)

목적: 공통 유지보수기 인계 6→7 또는 7→N를 기다리지 않고 **이미 승인된 좁은
운영 변경**을 기존 Windows 자체 Runner의 1회 GitHub Issue로 실행할 수 있는지
검증한다. 사용자 PC에 설치하거나 실제 Issue를 생성하지 않았다.

## 현재 결과

- `pc-approved-runtime-b-once.yml`: `.github/workflows/`에 **등록하지 않은** 후보.
  기존 Provider Flags B와 같은 owner/private/opened/one-attempt 고정 조건,
  Windows 자체 Runner, `zgmini-writer-source-b-one-at-a-time` 공유 concurrency,
  pinned checkout, 45분 제한을 따른다.
- `run.mjs`: Issue의 유일한 입력은 고정 operation·UUID·정확한 승인 manifest
  SHA256이다. `approvals/approved-runtime-b/<SHA256>.json`의 `git show HEAD`
  바이트, checkout 바이트와 main commit을 모두 대조한다. Issue 본문에 명령,
  임의 파일 경로, 새로운 운영 effect를 기입할 수 없다.
- `report.mjs`: 실행 토큰은 이 단계에만 전달된다. 결과 JSON/TXT를 각각
  create-only로 올리고 `main`에서 2/2 바이트 재조회하며, 1회 Issue 댓글로
  요약한다. 애매한 PUT, 부분 readback, 알 수 없는 상태는 재실행하지 않는다.
- `direct-writer-b.test.mjs`: Owner/approval 범위/해시/무브리지 거부/순수
  엔진 DI/리포트 2/2 및 실패 시뮬레이션. 이것은 소스 테스트이고 실PC 성공 아님.

## 진짜 첫 차단 지점

`run.mjs`는 **고정된** `direct-writer-b/native-adapter.mjs`에서만
`makeApprovedNativeAdapter({auth})` export를 읽는다. 현재 파일이 없기 때문에
승인 Issue라도 `DIRECT_B_NATIVE_BRIDGE_NOT_INSTALLED`로 종료하고 운영 변경은
0건이다. 단지 `originVerified: true` 같은 가짜 adapter를 작성해서 설치 성공으로
간주하면 안 된다.

필요한 네이티브 브리지는 Windows 실환경의 고정된 원본·Task·락·백업·복원
기능에 연결되어야 하고, `theme-generic-b`의 순수 효과 엔진이 요구하는 계약을
모두 구현해야 한다. 특히 108개 파일을 배치하는 **신규 다중 CMD CAS 모델**은
기존 `theme-config-upgrade.mjs`의 **단일 THEME_SCHEDULED.cmd CAS** 모델과
다르므로 원래 예약 tick과 old/new 프로세스의 `scheduled.lock` 공유, 상호
runtime/state 재조회·복구 보장이 확인되기 전에는 승인 활성화하면 안 된다.
현재 source-only 설계에서는 그 호환성 증거가 없고, Windows 실증도 없다.

## 수직 연결 전 필수 확인

1. 제어 저장소 최신 main으로 승인된 정확한 108파일 source SHA, manifest,
   등록 profile 및 bridge 소스가 일치하는지 검토한다. 승인 받은 *효과* 외
   Task/DB/D1 변경을 섞지 않는다.
2. `native-adapter.mjs`가 고정 factory를 내보내고 `originVerified`, `effect`,
   `sourceSha`, 실제 `adapter`, bundle일 때 고정 `trustedProfiles`를 제공한다.
   순수 엔진의 rollback/공유 Writer B lock/Task tick 보호/복구에 필요한 native
   계약을 모두 충족해야 한다. 이를 검증하지 못하면 BLOCKED로 유지한다.
3. 테스트와 실제 Windows 무변경 사전검사를 통과한 후 후보 workflow와 승인
   manifest를 **통제된 리뷰/병합 절차로** main에 등록한다. `report.mjs`의
   `?ref=main` GET은 main에 파일이 생성되는 조건이므로, PR 브랜치에서만
   미리 돌리면 readback 2/2가 성립하지 않는다.
4. 승인된 고유 Issue 1회 → 실PC 결과 JSON/TXT 2/2 → 원래 운영 files/Task
   readback → 로컬 결과·게시/API/UI 검증 순서로 완결한다. 그 후에만 미래 자연
   예약 동작 검증을 후속 수행한다.

## 수동 시험

```sh
node --test direct-writer-b/direct-writer-b.test.mjs
```

현 상태는 **workflow source-only/test PASS, 실제 Writer B BLOCKED**이며,
Provider Flags B 2/2 실증을 108파일 설치 성공으로 전용하지 않는다.
