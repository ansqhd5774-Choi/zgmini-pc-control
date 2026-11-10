# #996 — C 복구 중 ORIGINAL_JOB_DISPOSITIONS 중단 인계

## 2026-11-11 단계별 원본 Git 84바이트 R4 재연결 — 282/282 PASS, 실제 C 실행 NO-GO

- 새 단계별 E: 2회 판독기 `controller-996-c-original-stage-readonly.mjs`가 기존 봉인된 R4 `verify996OfflineGitBytesReadOnly`와 원문 `controller-996-git-byte-offline-manifest-r4.json`을 **각 단계의 두 스냅샷마다 재사용**하도록 연결했다. 각 읽기마다 installed 38·staged 39·maintainer 7 = 84 실제 파일이 Git blob·SHA256 원문과 일치해야 하며, 실패·출처 위장·원문 누락 시 STOP. 격리 testOnly는 `sourceBytesVerified=false`, 실제 원본 Windows R4 성공에서만 true로 보고하지만 어떤 경로도 `executionAuthorized=true`를 만들지 않는다. 원본 PC 실측은 여전히 0회.
- 관련 신규/수정 테스트 **10/10**, 전체 Node **282/282 PASS**. 2개 수정 파일 원격 Git blob SHA byte-match **2/2**. 마지막 source commit `ced9b2482fdb7a33d53eec66d78794b9348a406f`.
- 남은 운영 P0는 **C 고정 배타 예약의 정확한 소유권/수명 및 승인 Effect**, 각 이동 직전 지금 판독을 호출하는 봉인된 Windows 운영 Operator+ZIP/Source Lock, Owner의 #996 **신규 정확 승인**이다. 현재 신규 Owner 동의 0, 원본 4 jobs Open/결과 0, E: 복구 쓰기 0. 기존 구 C CMD 재시도 금지. **4/5=80%→80%, PR Draft, C NO-GO.**


## 2026-11-11 원본 Windows 단계별 C 읽기/기존 GH Workflow GET 연결 — 281/281 PASS, 운영 C NO-GO

- 신규 `tools/controller-996-c-original-stage-readonly.mjs` 및 9개 격리 테스트: 구 Claim 보관 후 원본→archive fallback, continuation/READY, Install-LAST, 고정 배타 예약 PID·nonce·SHA, 원본 10 pin, 두 번의 파일 SHA+identity, 다른 C continuation, 정상 신규 Install owner(최종 이동 뒤)를 **읽기 전용** 분류한다. 기존 `c-physical-disposition-readonly`만 재사용하고, 실제 이동/보관/권한 부여 기능은 없다. 테스트 synthetic 9/9는 Windows 원본 실측이 아니다.
- 기존 설치형 GH GET 어댑터 `c-installed-gh-get-readonly.mjs`를 확장하여 **고정 `actions/workflows/pc-job.yml` GET만** Owner/repo ID 인증 후 동기 읽기 하도록 연결했다. 일반 consent-reader GET 포트에는 Workflow 경로를 개방하지 않았고 토큰·POST·PUT 없이 `state='active'` 및 ID/path를 검증한다. 변경 테스트 포함 전체 관련 Node **281/281 PASS**, 새/변경 4파일 원격 Git blob SHA 대조 **4/4**, 마지막 소스 commit `cf43defd36b5e3521163c3f3698dc77eb03086ec`.
- **아직 필수 불완전:** 이 새 stage reader는 원본 PC에서 한 번도 실행되지 않았고, stage마다 실제 Git 84바이트를 다시 검증하는 연결이 없어 `sourceBytesVerified=false`, `independentAuthentication=false`, `executionAuthorized=false`다. 고정 예약의 exact 효과/영구 보존·operator/package/source-lock SHA와 신규 Owner C 승인 Manifest도 부재. 실제 C 임계 이동 직전 인증된 판독과 생산용 Windows archiver는 아직 없다. **구 C CMD 반복 실행·E: 폴더 이동·잠금 해제·Workflow PUT·Backlog 쓰기·원본 Issue 재발행 금지**. 전체 **4/5=80%→80%, PR Draft, C NO-GO**.


## 2026-11-11 C 단계별 물리 분류 충돌 범위 수정 — 270/270 PASS, 운영 C 대기

- C 단계별 **순수 판독기** `tools/controller-996-c-physical-disposition-readonly.mjs`에서도 과잉 `writerActiveCount/controllerActiveCount===0` Gate를 제거했다. 실제 중복 자원 한정 `scope=CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES`, `foreignInstallOwnerCount=0`, `otherContinuationCount=0`, `twoSnapshotsIdentical=true`, `fresh=true`만 요구한다. unrelated Writer/Core는 통과, 외부 Install owner·중첩 C·불안정 관측은 차단한다. `tests/controller-996-c-physical-disposition-readonly.test.mjs` 및 `tests/controller-996-c-physical-fixture-readback.test.mjs`에서 격리 회귀 추가·수정, 전체 **270/270 PASS**. 3개 원격 Git blob SHA 로컬 일치 **3/3**, 마지막 commit `ac9181f664e619fa3d2e44fdfd81fd71cb0236d3`.
- 원본 `#996` 새 C 승인 여전히 **0**, 원본 4건 `#1217/#1219/#1226/#1227`는 **4/4 Open·결과 댓글 0/4**. 기존 Owner C 동의는 구 phase 범위 전용. 시험용 Fixture/Stage Helper는 여전히 실행 불가·`executionAuthorized=false`. 기존 PC E: 파일 이동·Lock 해제·Workflow PUT·Backlog·Issue 변경은 **0**.
- **미구현 필수 연결:** 실제 E:의 단계별 2회 SHA/identity CAS(구 Claim 보관 후 archive 위치 fallback 포함), 고정 `controller-recovery-continuation-reservation` 소유 PID/nonce/수명·정확 C Effect, 각 Native Move 직전 범위 한정 독립 관측, Install-LAST 뒤 신규 정규 Install owner와 보관 원본 구분 → 운영 operator + ZIP + source lock 실제 해시 봉인 → **사용자 신규 정확 C 동의** → 기존 PC 단회 C 복구. 예약 효과가 승인 범위에 명확히 포함되지 않으면 STOP. **전체 4/5=80%→80%, PR Draft, C NO-GO.**


## 2026-11-11 관련 자원만 C 충돌로 판정 — Draft Gate 과잉 조건 수정

- 원본 승인 Maintainer 소스 `16064e29...`의 `tools/maintenance-lock.mjs`와 `tools/update.mjs`를 읽기 전용 확인했다. C 보관은 `pc-maintenance/leases/controller-recovery`·새 continuation·`controller-install` 형제 디렉터리만 변경한다. 일반 Controller Update/R6 Host B/Source Bundle B/R54 B는 **먼저 `controller-install`을 선점**하고, `receiver`는 독립 장기 lease이며 일반 Writer 데이터 lane과 여섯 Runner 활동은 C 보관 디렉터리 자체와 충돌하지 않는다.
- 새로운 중복 충돌 점검기 파일을 만들지 않았다. 기존 `controller-996-c-original-prewrite-readonly.mjs`는 이전 C/install owner PID 종료, 10파일 SHA/identity 2회, archive·continuation 부재 및 R1 보호 검사를 이미 수행한다. 단, 아직 **신규 원본 PC 실측/실행 직전 CAS 증거가 아니다**.
- Draft `controller-996-continuation-gate.mjs`의 모든 Writer 유휴 강제 조건을 제거하고 `scope=CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES`, `foreignInstallOwnerCount=0`, `otherContinuationCount=0`, `twoSnapshotsIdentical=true`, `fresh=true`의 **해당 자원 한정** 판독으로 수정했다. unrelated Writer가 활성인 합성 시험은 허용되지만, 외부 소유자·중첩 continuation·불명확 snapshot은 계속 STOP. 이 Gate는 여전히 `executionAuthorized=false`인 순수 shape review로 실제 C 권한이 아니다. 관련 **29/29**, 전체 **268/268 PASS**, 원격 변경 3파일 byte-match **3/3**. 기존 승인 Effect 6개·원본 source/데이터/운영 설정 불변.
- **남은 실제 필수 작업:** 현장 원본 E:/의 기동 시/각 보관 단계 직전 2회 CAS를 정규 Windows C operator에 결합하고, 고정 배타 예약과 동일 부모 원자적 archive 순서를 구현·봉인 → 정확한 Owner 신규 C 동의 → 기존 PC 1회 C 실행·사후 읽기. 승인 전 기존 잠금 변경·구 CMD 재시도·Workflow PUT·Backlog 재작성 금지. **4/5=80%→80%, PR Draft, C NO-GO**.

## 2026-11-11 기존 PC 설치형 GitHub GET 인증 연결 — 실행기 미완성/C NO-GO

- `tools/controller-996-c-installed-gh-get-readonly.mjs`로 원본 Windows의 고정 `gh.exe`를 통해 **GET만** 수행하고 기존 인증의 Owner 계정·비공개 Repository ID를 확인하도록 구현했다. 허용 주소는 #996·원본 Issue #1217/#1219/#1226/#1227·전체 댓글 페이지·불변 commit의 C Manifest뿐이며 token 출력/추출·POST/PUT/재발행이 없다. 기존 C 동의 리더와 원본 4건 판독에 주입할 수 있는 실제 Windows 어댑터다. 실 PC에서 신규 어댑터 실행 0회, 사용자 신규 C 승인 0건이다.
- 신규 최소 시험 **3/3**, 전체 관련 정적·격리 시험 **265/265 PASS**, 원격 신규 소스 2개 byte-match **2/2**. **기능 완료로 계산하지 않는다.** 남은 실제 필수 구현은 Writer/Controller 현재 Lease·PID·경합 2회 읽기, 실행 직전 SHA CAS, 정확 승인·배포 바이트에 결합된 Windows C 운영 보관 실행 및 실패 시 수동 재판정이다. 기존 운영 파일 변경 0, PR Draft, **4/5=80%→80%, C NO-GO**.

## 2026-11-11 기존 PC 해시 5개 화면 판독·10핀 후보 완성 — 운영 C NO-GO

- 사용자가 **기존 PC** PowerShell에서 C Claim owner·Backlog·3개 진행 Marker의 SHA256을 읽기 전용으로 조회했고 5줄이 모두 정상 출력되었다. 화면 내 `BLOCKED` 없음. 스크린샷 SHA256 `b54905f5017f91c472e2e3dedfc7a8a4a3ce532e150fc6c10400e40974307b9e`, 독립 판독 2회 동일, 5/5 64hex 일치. 화면 원본 미게시, 비민감 전사와 구 R3/R4 고정 5개를 합친 **총 10개 후보 해시**를 `artifacts/controller-996/zgmini-996-original-windows-10-pin-screen-readback-20261111.json`에 기록하고 원격 바이트 재조회했다.
- 이 값들은 사용자 제공 화면 및 과거 고정 증거의 결합이다. **새 원본 PC 독립 실행 신원·최종 실행 직전 동일한 파일 바이트·Writer/Controller 경합·신규 Owner Consent·Operator SHA/ZIP/Source Lock은 아직 미검증**. 이는 승인 Manifest 자체가 아니며 현재 C 운영 쓰기 0, 신규 승인 0, `executionAuthorized=false`다. **사용자에게 동일 5개 SHA 추가 수동 반복 요청은 하지 않는다**. 다음 필수 개발은 운영 C operator·독립 소유권/경합 CAS/중단 회복 프로토콜 및 정확 Source Lock 구현이다. PR Draft, **80%→80%, C NO-GO**.

## 2026-11-11 원본 PC C 사전검증 10핀 2회 읽기 전용 소스 — **실행 전/운영 C NO-GO**

- 원본 PC에서만 사용하도록 제한한 `tools/controller-996-c-original-prewrite-readonly.mjs`와 단위시험 1개를 Draft PR #1222에 추가했다. 기존 C Claim owner·Marker 3개·Install Lease 2개·Backlog·세 Source Manifest **정확히 10개 SHA/파일 식별정보 2회**, 이전 Owner PID 종료·신규 archive/continuation 부재·R1 보호 14/14·R4 Git bytes 84/84를 안전하게 판독하도록 구성했다. **아직 원본 PC에서 신규 소스를 실행한 적은 없고, CLI/CMD/ZIP도 없다.** 모의 입력에서는 진본성 증명이 되지 않는다.
- 신규 독립 Node 시험 **6/6**, 전체 #996 정적·격리 회귀 **262/262 PASS**, 원격 소스 2파일 바이트 비교 **2/2**. 결과는 항상 `executionAuthorized=false`, 기존 PC 파일 이동·Lock 해제·Workflow PUT·Backlog·Issue 변경 **0**이다. 사전검증 소스 자체를 C급 운영 실행기로 간주하지 않는다.
- 승인 Manifest에 필요한 원본 SHA **10개 중 고정 증거 5개 확인·현재 C Claim/Marker/Backlog 5개는 현재 원본 PC 재조회 필요**. 과거 R3에는 해시가 콘솔 출력되었으나 현 채팅/정본에는 실제 5개 값이 보존되지 않았다. 없는 해시 추정이나 초기화·재요청 금지. 설치형 A급 Core 조회는 C Claim 소유권을 독립 인증하지 못하며 원본 pc-job #1217/#1219/#1226/#1227은 **4/4 Open·결과 댓글 0/4**로 유지한다.
- **남은 필수 단일 개발 과제:** 신규 C급 실운영 operator·독립 Claim/Writer 경합 직전 CAS·중단 복구 프로토콜과 실행 바이트/ZIP/Source Lock 봉인 → 미래 정확 Owner 승인 Manifest/댓글 → 기존 PC에서 승인된 단회 C 복구. 별도 PC 네이티브 TEMP 2-process 1/1 PASS는 재검증 불필요. 현재 원본 PC에서 구 C CMD 재시도, 파일 이동, Lease 정리 **금지**. 전체 5단계 수명주기 **4/5 = 80%→80%**, PR Draft, C NO-GO.

## 2026-11-11 별도 Windows 2-process 고정 예약 경합 실측 1/1 PASS — C 운영 NO-GO

- **실물 PASS:** 사용자가 새 격리 Windows PC에서 `RUN_996_WINDOWS_C_CONCURRENT_FENCE_TEMP_ONCE.cmd` 실행 콘솔을 공유했다. 결과 스키마 `ZGMINI_996_WINDOWS_C_CONCURRENT_FENCE_RESULT_V1`, status `ISOLATED_WINDOWS_C_CONCURRENT_FENCE_TEST_ONLY`, `casesPassed=1`, `processesStarted=2`, `distinctProcessIds=true`, `readyBeforeGo=true`, `fixedReservationAtomicMove=true`, `winners=1`, `busy=1`, `createdFixtures=1`. 이로써 앞선 순차 예약 10-case만으로는 미입증이었던 **서로 다른 Windows PowerShell 실제 프로세스 두 개의 동일 고정 이름 선점/경합**이 **합성 TEMP 범위에서 실측 PASS**다.
- **근거:** 사용자 콘솔 스크린샷 SHA256 `52336ab0bc779ad9ab5d350fcbe0e9211f465cb2c8803fd12f8d26c82c41e76a`, 비민감 정규화 결과 `artifacts/controller-996/zgmini-996-windows-c-concurrent-fence-native-1of1-20261111.json`. 사용한 브랜치의 parent SHA256 `470c68479a2813f9f27ba68b49e2bbfdc2b463abb39e840948b0ac49dbec03d9`, worker SHA256 `62b3e1ff821028c0af5304640bb3505e782ed7263d95070dac1cba972bffd180`; CMD는 양 파일을 실행 전후 해시 확인한다. 이 스크린샷은 특정 실행 결과이며 실제 OS 원본 검토 기록이나 fixture 재조회 증거는 아니다.
- **격리/영향:** 보고값 `executionAuthorized=false`, `operatorReady=false`, `originalPcWrites=0`, `workflowPuts=0`, `backlogWrites=0`, `issuePosts=0`, `pcRetries=0`, `cleanupPerformed=false`. 모두 시험기 자체 보고이며 **독립적인 원본 PC 무변경 감사를 대체하지 않는다**. 자동으로 지운 fixture 없음. 원래 C 단계 엔진 자체, 기존 `E:\ZGmini`의 Claim/Install/Lease, Writer, 원본 GitHub 4 Job, 중단 복구 원장, reboot 후 durability, 승인된 새로운 예약 Effect까지 실증한 것이 아니다.
- **남은 필수 운영 Gate:** 원본 운영 Windows의 현재 소유권/실행중 프로세스/원장/Writer read-only 판정, 기존 4개 원본 pc-job Issue/Backlog/Workflow의 최신 상태 대조, 향후 C 운영 후보의 고정 예약 효과·수명·충돌 거부·원본 복구 정본 SHA 계약 확정, 그 범위에 대한 **새 Owner 정확 승인**. 승인 전 실제 원본 경로 쓰기/복구/Workflow 변경/Backlog 종료/기존 CMD 재실행 금지.
- **추가 최신 GitHub GET 관측(2026-11-11):** 원본 4 pc-job Issue **#1217/#1219/#1226/#1227 전부 open, 댓글 각각 0**. 4건의 본문 JSON requestId/chatId/operation/sourceSha `643b7c7c4372ffad552443fc312c6cb1b944e2fc` 및 Owner `ansqhd5774-Choi`/ID `327938088`가 핀과 일치했고, 별도 comments API도 각각 0건이다. 원본 중단 #996은 open·댓글 **10건**이며 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1` 신규 정확 승인 **0건**으로 확인. 이 관측은 GitHub 연결 GET의 시점별 스냅샷이며 아직 원본 PC Runtime/원장 및 Backlog 상태의 독립 증거가 아니다. 조회 중 Issue/Workflow/Backlog/PC 쓰기 없음.
- **판정/진행률:** 이번 Windows concurrency native `NOT_OBSERVED→PASS`, 전체 #996 C 운영 **80%→80%, NO-GO**, Draft PR #1222 유지. 아래 'Windows 네이티브 실행 0회' 표기는 **당시 이력**이며 이번 사진으로 동시성 시험의 해당 제한만 해제됐다.

## 2026-11-11 새 격리 Windows 두 독립 프로세스 고정 예약 경합 시험 — 소스 256/256 PASS, 네이티브 결과 미관측

- **실행 대상: 별도 신규 Windows PC만. 기존 운영 PC에서 실행 금지.** 사용자가 앞서 별도 PC에서 확인한 동일 부모 TEMP 10/10·328/328은 **순차** 예약 시험이었다. 이번에는 `TEST_996_WINDOWS_C_CONCURRENT_FENCE_NATIVE_ONCE.ps1` 부모가 서로 다른 UUID/PID의 Windows PowerShell 5.1 프로세스 두 개를 띄우고, 각 worker가 READY를 보낸 다음 단일 GO 뒤 **같은 고정 예약 디렉터리**에 `[IO.Directory]::Move`를 한 번씩 시도한다. 합격 조건은 WIN 1, BUSY 1, loser proposal 보존, winner owner와 원본 복구·설치 owner SHA256 불변이다.
- **실행 보호:** `E:\ZGmini` 존재 시 effect 전 STOP, 고정 로컬 NTFS/ReFS `%TEMP%` GUID 내부만 쓰기, reparse 검사, `-TestOnly`, PS1 두 개의 정확한 SHA256 사전·사후 검증, 원본 PC/Workflow/Backlog/Issue 쓰기 0, rollback/kill/retry/자동 cleanup 0. CMD의 파일 단위 `Unblock-File`은 검증된 두 PS1에만 적용하고, 실행 정책을 변경하거나 Bypass하지 않는다. 부모 SHA256 `470c68479a2813f9f27ba68b49e2bbfdc2b463abb39e840948b0ac49dbec03d9`, worker SHA256 `62b3e1ff821028c0af5304640bb3505e782ed7263d95070dac1cba972bffd180`. 배포용 별도 TEMP ZIP `zgmini-996-c-concurrent-fence-windows-temp-r1.zip` SHA256 `aafdcd46a1e5d1cfdcce1b605901dd69453b19e42307e92bb5b82498a0804614`, 내부 3개 파일 압축 검사 3/3 OK.
- **소스/검증:** 새 파일 4개 `tools/TEST_996_WINDOWS_C_CONCURRENT_FENCE_NATIVE_ONCE.ps1`, `tools/INVOKE_996_WINDOWS_C_CONCURRENT_FENCE_WORKER_TEST.ps1`, `tools/RUN_996_WINDOWS_C_CONCURRENT_FENCE_TEMP_ONCE.cmd`, `tests/controller-996-windows-c-concurrent-fence-bundle.test.mjs`를 **전용 Draft PR #1222의 작업 브랜치에만 반영**. 원격/로컬 바이트 4/4 일치, 관련 Node 회귀 256/256 PASS (신규 9/9), Windows PowerShell 직접 실행 0회. 기존 10-case 시험기와 승인 원본 운영 파일은 수정하지 않았다.
- **Runner 확인:** 격리 Windows Runner 라벨 `zgmini-handoff-ci-isolated`는 존재하지만 현행 워크플로 67개에 **신규 #996 PowerShell 경합 시험을 실행하는 승인 경로는 없음**. 새 Workflow를 임의 설치·활성화하거나 기존 pc-job/블로그 Runner를 우회 이용하지 않는다. 즉시 실측하려면 기존과 같은 **신규 PC에서만 단회 수동 CMD**가 필요하다.
- **한계/판정:** 이 시험은 실제 Windows의 단일 고정 이름 원자 예약 경쟁만 검증하며, 새 C Effect의 승인·원본 Windows 현재 소유권/Writer/Backlog 판독·중단 후 lease 수명·재부팅 내구성·C 운영 실행기의 준비를 증명하지 않는다. **전체 운영 복구 80%→80%, C NO-GO, 신규 #996 Owner 정확 승인 0, PR Draft 유지.** 다음 필수 행동: 새 PC TEMP 동시성 실측 1회 후 JSON/콘솔 원본 관측을 정본에 갱신하고, 원본 C 필수 상태의 최신 읽기 전용 증거를 마련한 다음 정확 승인을 재검토한다.

## 2026-11-11 실제 별도 Windows 동일 부모 TEMP 네이티브 10/10·328/328 PASS — 운영 C NO-GO

- 사용자가 **별도 Windows PC**에서 실행한 `RUN_996_WINDOWS_C_SIBLING_TEMP_ONCE.cmd` 콘솔 사진의 고정 결과: `ZGMINI_996_WINDOWS_C_SIBLING_NATIVE_FIXTURE_V1`, `ISOLATED_WINDOWS_C_SIBLING_TEST_ONLY`, **casesPassed=10**, **checksPassed=328**, **createdFixtures=10**, `sameParentLeaseMove=true`. 신규 10-case Windows 네이티브 격리 시험은 **이제 실측 PASS**다. 직전 섹션의 ‘실행 대기’는 당시 이력이다.

- 콘솔은 `reservationFileCreateNewSequentialTested=true`와 `reservationDirectoryMoveSequentialTested=true`를 보고한다. 이것은 **단일 프로세스 내 순차 중복 예약 차단**이지 Windows 실제 복구 프로세스 2개의 동시에 시작하는 경합·fencing 증거가 아니다. 동일 부모 `[IO.Directory]::Move`가 별도 Windows의 TEMP fixture 안에서 동작했음을 보인 것이며, 기존 C 단계 엔진 자체나 실제 운영 `E:\ZGmini`의 Claim·Lease 이동 증거가 아니다.

- 사용자 화면 SHA256 `9565d47631cc938e07ab0b6b82f8e0dee171f415fa8b27523cc86903ac126a69`; 비민감 전사 정본은 `artifacts/controller-996/zgmini-996-windows-c-sibling-native-10of10-20261111.json`에 저장한다. CMD가 실행 전 검증하는 PS1 SHA256 `0a00d432d34a743ab7946ee12d6a379872df48452e5702357bc3c1182f4bfe05`. 보고값은 `executionAuthorized=false`, `operatorReady=false`, `originalPcWrites=0`, `workflowPuts=0`, `backlogWrites=0`, `issuePosts=0`, `pcRetries=0`, `cleanupPerformed=false`. 이 0값은 **시험기 자체 보고**이며 OS 감사를 통한 운영 PC 무변경 외부 입증으로 확대하지 않는다. 10개 임시 fixture는 자동 삭제되지 않았다.

- **확인된 다음 결손:** 구 R3/R4의 원본 Windows 읽기 전용 84파일/Backlog 증거를 현재 C 필수 상태에 한정해 최신 판독; 이전 중단된 원본 Claim의 역사적 소유자 증거; 지금의 Writer/Controller/Task와 4개 원본 Backlog GET 합치; 서로 다른 UUID 실제 Windows 복구 경쟁의 단일 고정 배타 예약 실증 및 실패 후 수명주기; 이 추가 신규 Effect를 반영한 source/ZIP/lock 불변 범위와 원본 #996 Owner 신규 정확 승인. **현재 GitHub #996 댓글 10건, 신규 C Consent 0건**. 과거 C 승인 재사용·운영 파일 이동·Workflow/Backlog/Issue 쓰기는 금지한다.

- **진행률:** 기존 네이티브 동일 부모 시험 증거 `NOT_OBSERVED→PASS`; 전체 운영 C급 복구 **80%→80%**, 운영 **NO-GO**, PR **Draft 유지**. 다음 작업은 반복 CMD가 아니라 동일 부모 네이티브 성공을 재사용해 원본 상태/소유권/fencing 통합 후보의 **읽기 전용 구성 및 독립 검증**을 완성하는 것이다.

## 2026-11-11 신규 Windows 동일 부모 이동 TEMP 시험기 — 소스 247/247, 실물 실행 대기

- **실제 운영 구조 차이에 대한 직접 보완:** 기존 별도 Windows 네이티브 7/7·29/29은 `leases→archives`의 다른 부모 이동이었다. 새로운 `tools/TEST_996_WINDOWS_C_SIBLING_NATIVE_ONCE.ps1`은 원본과 같은 상대 경로 `automation/pc-maintenance/leases` 안에서 `controller-recovery→controller-recovery-archived-<원본ID>`, `controller-recovery-continuation-<UUID>→...-archived-<UUID>`, `controller-install→controller-install-recovered-<원본ID>`를 **동일 부모 [IO.Directory]::Move**로 검증하는 별도의 **TEMP 전용 원시 동작 fixture**다. 이미 검증된 기존 Windows 7-case PS1/CMD는 수정하지 않았다.

- Windows 원시 동작 후보는 정상 1, 중단 지점 5, 충돌 1, 합성 Writer 1, marker 변경 1, 예약 1의 **총 10개 GUID-TEMP 시나리오**를 정의한다. 예약 시나리오는 고정 파일 `FileMode.CreateNew` 충돌 및 고유 디렉터리→고정 디렉터리 `Directory.Move` 충돌을 **각각 순차** 검증하며, Windows의 서로 다른 실제 프로세스 간 동시 경합이나 보관/예약 해제 수명주기 검증이 아니다. 실행 후 원본 파일 삭제·자동 cleanup·rollback·retry는 하지 않는다.

- 새 `tools/RUN_996_WINDOWS_C_SIBLING_TEMP_ONCE.cmd`는 **PS1 SHA256 `0a00d432d34a743ab7946ee12d6a379872df48452e5702357bc3c1182f4bfe05`**를 먼저 검증하고서 `-TestOnly`를 사용한다. 실행 정책 우회가 없고 `E:\ZGmini`가 존재하는 PC에서는 중지한다. 이 사실은 운영 PC 신원 증명이나 실제 C 승인 증거가 아니다. ZIP의 별도 SHA256은 `9e30ac6ac8933faa6fa9fe339d00aa3d7682c082fc67572993c8c9a29d79494e`이며 내부 CMD·PS1 2개다. GitHub 신규 파일 3개 원격/로컬 **3/3 바이트 일치**, ZIP 무결성 **2/2 OK**, #996 관련 Node 정적·합성 회귀 **247/247 PASS**.

- **Windows 실제 실행 0회:** 10/10 PASS는 아직 관측되지 않았다. 새 시험기는 과거 C 단계 엔진 전체가 아니라 **동일 부모 rename 원시 동작**만 독립 시험하므로 성공하더라도 운영 C급 실행기/E 드라이브 상태·Writer·과거 Claim 소유권·Backlog 4건·신규 Owner C 승인까지 검증한 것으로 간주하지 않는다. 기존 R3/R4 읽기 전용 원본 증거는 재사용하고 필요한 실제 변경 상태만 새로 확인한다.

- **다음 단일 필수 행동:** 물리적 별도 Windows PC/격리 Runner의 새 ZIP 정확 해시 검사 및 `RUN_996_WINDOWS_C_SIBLING_TEMP_ONCE.cmd` 단회 실행 결과 JSON·시험 source hash 회수 → 실제 C 후보 소유권/fencing 설계와 현장 Writer/Backlog 독립 CAS → 신규 예약 효과를 명시한 별도 Owner 정확 승인 후에만 C급 운영 검토. 현재 실제 C NO-GO·운영 80%→80%.

## 2026-11-11 C 복구 동시성·원본 4 Job GET 보완 — 소스 242/242, 실제 복구 NO-GO

- **이번 신규 10개 소스/시험 파일은 격리 프로토타입과 GET 전용 판독 구성요소이며 실제 운영 C 실행기가 아니다.** `controller-996-c-exclusive-reservation-fixture.mjs`는 Linux 임시 디렉터리에서 고정 예약 위치의 원자적 생성과 서로 다른 UUID 2개 동시 경합을 검증하여 **1 승자·1 BUSY, 12/12 PASS**를 재현했다. 이는 Windows 현장 독립 CAS나 충돌 후 예약 해제 계약을 증명하지 않는다. **고정 예약 디렉터리는 기존 승인된 Effects에 없는 신규 쓰기 효과**이므로 신규 Owner 정확 승인 전에 운영에 도입할 수 없다.

- `controller-996-c-physical-fixture-readback.mjs`는 운영과 같이 동일 부모 `leases`에서 6개 합성 중단 상태를 실제 파일 바이트 SHA256로 재확인하고 하드링크·심볼릭링크·Writer 변경·다른 UUID·이중 판독 드리프트를 차단한다. **Linux 임시 경로 합성 12/12 PASS**로 실제 원본 Windows 독립 관측/동일 부모 Native MOVE 실증은 아니다. 과거 Windows TEMP 7/7·29/29은 실제 네이티브 증거이지만 부모 위치가 운영과 다르다.

- `controller-996-authenticated-github-get.mjs`는 GitHub Actions 기본 **설치형 `GITHUB_TOKEN`**을 `GET /installation/repositories`로 확인하도록 보완했고, Owner 개인 사용자 GET와 구분한다. `controller-996-native-continuation-consent-reader.mjs`는 설치형 GET 독립 판독과 **실제 Owner 작성 신규 승인 댓글**을 별개로 요구한다. `controller-996-original-four-jobs-readonly.mjs`는 #1217/#1219/#1226/#1227 원본 requestId·chatId·operation·source SHA와 결과 댓글을 두 번 GET하는 **읽기 전용 분류기**이며 실제 서버의 전체 Backlog/Writer 대조가 아니다. 원본 4개 Issue의 **본문 JSON 의미 필드**를 검증하며 임의의 공백/필드 순서까지 고정하는 원문 바이트 SHA는 아니다.

- 독립 감사 P0에 따라 두 reader에서 `auth.testOnly===false`를 반드시 확인하고 누락 플래그/시험용 출처를 실패 처리했다. **이번 전체 #996 정적/합성 회귀 242/242 PASS**, 위 10개 신규/수정 파일 원격 브랜치와 로컬 내용 **10/10 일치**. 실제 인증 토큰으로 GET 호출·실제 Windows 원본 상태 조회·보관 이동·Workflow PUT·Backlog 변경·Issue POST·pc-job 재실행은 **모두 0회**. 별도 신규 C 승인 **0건**이므로 **Draft/운영 C NO-GO, 전체 운영 80%→80%**.

- **다음 필수 P0:** 운영 PC 신뢰된 독립 물리 관측과 Writer/Backlog provenance → 실제 Windows 동일 부모 원자 이동 및 복수 C 시도 배타성/재시작 검증 → 새 reservation 효과를 포함한 정확한 변경 범위·불변 소스/패키지/Lock 해시 봉인 → 원본 #996 Owner의 별도 정확 승인. 현재 운영 실행·기존 C Consent 재사용은 금지한다.

## 2026-11-11 실제 C 운영 승인 전 신규 GET 인증 어댑터·중단 상태 분류 — 소스 검증 205/205

- **이번 변경은 실제 C 복구 실행기가 아니라 다음 실행기의 읽기 전용 구성요소**다. `tools/controller-996-authenticated-github-get.mjs`는 `api.github.com` 고정 원본에서 계정명+숫자 ID·비공개 제어 저장소를 확인하고, 원본 #996 Issue/댓글 전체 페이지 및 새 불변 Manifest 40hex commit 경로에 한한 **GET 요청**만 제공한다. 토큰을 로깅하지 않고, 외부 리디렉션·응답 URL 변경·예상치 못한 메서드/경로·HTTP 비200·JSON 불일치·초과 크기 스트림을 차단한다. 주입식 `fetchImpl`은 `testOnly:true`에서만 허용한다. 이 함수의 `readOnly:true`는 사용 API가 GET뿐이라는 의미이며 토큰 자체의 서버 쓰기 권한 부재를 증명하지 않는다. 실제 GitHub 인증 호출은 **이 턴 수행하지 않았다**. 독립 가짜 fetch 테스트 8/8 PASS.

- `tools/controller-996-c-physical-disposition-readonly.mjs`는 원본 old C Claim·Install Lease가 남은 상태, 새 Claim 예약, 원본 C 보관 직후, READY 기록 후, 신규 continuation 보관 후, Install Lease 보관 후 등 **6가지 주입 스냅샷 위치**를 구분한다. 모든 경로에서 `executionAuthorized=false`·운영 쓰기/자동 재시도 0을 반환하며, 원본/보관 동시 존재·SHA 변경·활성 Writer·문제 있는 마커·불분명한 이동은 UNKNOWN으로 중단한다. 새 시험 12/12 PASS. 이는 입력을 외부에서 제공받는 **순수 분류기**이므로 실제 원본 Windows의 독립 인증이나 새로운 C 승인 자체가 아니다.

- 기존 전체 #996 Node/정적 회귀 **185/185 → 205/205 PASS**(신규 8+12, 기존 코드 미변경). 신규 4파일 GitHub Draft 브랜치 원격 내용은 로컬 소스와 **4/4 바이트 일치** 확인. 이전 Windows TEMP 시험 **7/7·29/29**은 독립된 네이티브 증거로 유지한다. 실제 운영 PC·Workflow·Backlog·Issue/pc-job 쓰기 **0회**, 운영 **80%→80%·C NO-GO**.

- **후속 P0:** 원본 E: 파일/실제 프로세스·Writer·Lease를 신뢰된 Windows 경로에서 직접 확인하는 물리적 읽기/CAS; 기존 C Claim의 독립된 소유자 provenance; 서로 다른 continuation UUID 사이 **공유 배타적 예약/fencing**(기존 Install 잠금을 마지막까지 보존); 인증 GET과 원본 4개 pc-job의 실결과/Backlog 대조; 동일 부모 `leases` 디렉터리 이동·경합/중단 실증; 실제 source/package/source-lock 해시 봉인 후 원본 #996 Owner의 **별도 정확한 신규 C 승인**. 현재 #996 신규 owner 댓글 **0건**이므로 실제 C 운영 실행/원본 설치 잠금 해제는 금지한다.

## 2026-11-11 신규 Windows C 단계 TEMP 7/7·29/29 네이티브 실측 — 운영 C NO-GO

- 물리적으로 **별도인 Windows PC**에서 사용자가 신규 `RUN_996_WINDOWS_C_STAGE_TEMP_ONCE.cmd` 실행 후 콘솔 화면을 제출했다. 화면 `ZGMINI_996_WINDOWS_C_STAGE_NATIVE_FIXTURE_V1`, `status=ISOLATED_WINDOWS_C_STAGE_NATIVE_TEST_ONLY`, `casesPassed=7`, `checksPassed=29`, `createdFixtures=7`을 확인했다. **현재 신규 Windows C 단계 격리 fixture 7/7·29/29 PASS**로 수락하며, 아래의 최초 0/7 기록은 실측 전 이력이다.

- 사용자 스크린샷 SHA256 `86ab26ab808fd2027c390c37fc24225736a5506104a1de5dc9ac186fb6f0ebb7`; 원문 화면은 GitHub에 저장하지 않고 `artifacts/controller-996/zgmini-996-windows-c-stage-native-7of7-20261111.json`에 비민감 전사·적용 범위·한계만 기록했다. 화면에는 `executionAuthorized=false`, `operatorReady=false`, `originalPcWrites=0`, `workflowPuts=0`, `backlogWrites=0`, `issuePosts=0`, `pcRetries=0`, `cleanupPerformed=false`. 0건 수치는 **fixture 실행기 자체 보고**이며 외부 OS 감사·원본 PC 실물 무변경 독립 증거는 아니다. 합성 TEMP root 7개는 자동 정리되지 않았다.

- 새 PowerShell source에 내장된 디렉터리 이동·충돌 차단·중간 중단 조건을 **실제 Windows에서** 통과했지만, 합성 `expected.json`/`live.json`을 사용하므로 원본 84 Git 파일의 현재 상태, 원본 C Claim·Install Lease 소유권, 새로운 배타적 Claim 취득, 현재 Writer 경합, Backlog 4개 원본 Job의 결과쌍, 정확한 신규 Owner 동의·전원 중단 시 디렉터리 내구성, 운영 C operator는 **검증되지 않았다**. 사용자의 실제 PC ZIP 전체 SHA256 외부 독립 검산 화면도 없으므로 소스 확정 범위를 초과해 주장하지 않는다.

- 실제 GitHub 원본 #996 재조회는 **Open·댓글 10건, 신규 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1` 0건**, #1217/#1219/#1226/#1227 **Open 4/4·결과 댓글 0/4**. 기존 `ZGMINI_CONTROLLER_996_C_CONSENT_V1`는 이전 phase-scoped 동의여서 새 운영 C 허가가 아니다. 실제 `E:\\ZGmini` 보관 이동·Workflow PUT·Backlog 변경·원본 Issue POST·pc-job 재시도 금지. **운영 C NO-GO, 전체 진행률 80%→80%, PR Draft 유지.**

## 2026-11-11 신규 Windows C 단계 엔진 후보·7개 TEMP 격리 시험 패키지 R1 — 실측 대기

- `tools/INVOKE_996_WINDOWS_C_ARCHIVE_CANDIDATE.ps1`를 **운영 무조건 STOP**인 시험 전용 PowerShell 단계 엔진으로 추가했다. `-TestOnly`·원본 `E:\ZGmini` 부재·NTFS/ReFS 고정 드라이브의 새 TEMP fixture·부모 Reparse Point 부재를 요구한다. 합성 SHA/inventory·가상 Writer·목적지 충돌을 재확인하고 `[IO.Directory]::Move`로 **old C → continuation → install 최종** 순서의 삭제 없는 이동과 `READY_TO_RELEASE_INSTALL`의 `CreateNew`/`Flush(true)`를 시험하도록 작성했다. 실패·중단 시 자동 재시도·삭제·원상 복구하지 않는다. `Flush(true)`는 파일 기록 보조일 뿐 전원 차단 때의 디렉터리 rename 내구성을 증명하지 않는다.
- `tools/TEST_996_WINDOWS_C_STAGE_FIXTURE_ONCE.ps1`는 별도 Windows PC의 TEMP 안에 **각각 독립된 7개 GUID root**를 만들어 정상 1·중단 3·기존 archive 충돌 1·합성 Writer 경합 1·원본 marker 변경 1을 새 단계 엔진으로 호출하도록 작성했다. 이 입력은 합성 `expected.json`/`live.json`으로 실제 owner·claim provenance·원본 Git 84개·원본 Writer 경합을 인증하지 않는다. 시험은 `leases→archives` 부모가 달라 운영 `leases` 내부 형제 디렉터리 이동과 정확히 같지 않다. `AFTER_INSTALL` 중단 시 기존 Install 잠금은 이미 보관된 상태이므로 수동 재판정이 필요하다. 모든 TEMP root는 자동 삭제하지 않는다.
- `tools/RUN_996_WINDOWS_C_STAGE_TEMP_ONCE.cmd`는 **두 PS1의 전체 SHA256을 실행 전에 검산**한다: stage=`7fddd91a5ee0088955cdfc03f3799186ade4d5dfce17193e457f75fcf992e657`, fixture=`2b76e38f785a208a3aefc5d202ec1c478b2f052d244d842e5df024fb2f8cad0b`. PowerShell 정책을 우회하지 않는다. **격리 시험 ZIP** `artifacts/controller-996/zgmini-996-windows-c-stage-native-fixture-r1.zip`, SHA256=`5f1d054c72f3528525db04e1e5d84615fc5f9e4c90c4cff870b7ab85ca819af8`, 구성 정확히 CMD+PS1+PS1 **3파일**, ZIP CRC **3/3 정상**. 이 패키지에는 운영 C 명령이나 원본 PC 대상 실행기가 없다.
- 신규 단계 엔진/fixture/CMD 정적 회귀 **6+4+2=12/12**, 기존 #996 전체 **185/185 PASS**. 이 숫자는 **Linux 정적 검사**이며 **새 두 PS1의 Windows Native 실측 0/7**이다. 이전 Windows 네이티브 기본 이동 13/13은 별도 이전 패키지의 실증이다. 새 단계 엔진 Windows 실측이 완료된 것처럼 기록하지 않는다.
- 현재 새 continuation Claim의 실제 배타 취득, 독립 인증된 C owner/정확한 새 승인, 현재 원본 PC CAS·Writer 경합·원본 4 Job 결과/원본 84 Git bytes 런타임 결합, 안전한 전원 중단 회복/운영 C operator·CLI/CMD/ZIP은 **미구현**. 기존 C CMD 재실행, 운영 E: Claim/Install Lease 이동·Workflow PUT·Backlog 변경·원본 Issue 재발행은 모두 **NO-GO**. 전체 운영 진행률 **80%→80%**, PR Draft 유지.

## 2026-11-11 최신 원본 Issue·소유권 대조 및 신규 C 증거 Bridge — 운영 80%, C NO-GO

- GitHub 원본 #996의 전체 댓글 **10/10**을 다시 읽었다. 과거 `ZGMINI_CONTROLLER_996_C_CONSENT_V1` 1건은 기존 phase-scoped 범위에만 유효하고 신규 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1`는 **0건**이다. 사용자 승인 댓글을 대신 발행하거나 이전 동의를 새 C Claim 소유권 인계로 해석하지 않는다.
- 원본 `pc-job` [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217)·[#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219)·[#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226)·[#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227)는 **Open 4/4·결과 댓글 0/4·갱신/재계획 표시 0/4**. 이전 원본 Windows R3의 Backlog `replayCount=0`은 **그 당시 스냅샷**이다. 현재 E: 실물·수집 상태 또는 실행 성공을 증명하지 않으므로 원본 요청 재실행·완료 처리·새 Issue 중복 생성 금지.
- `tools/controller-996-c-operator-evidence-bridge.mjs`와 집중 시험을 추가했다. **신규 C Owner 동의 리더가 주입한 원문 Manifest 바이트 SHA-256·객체 일치, prospective operator/package/source-lock 실제 Buffer SHA-256, 원본 물리 10종 SHA pin·Git 84종·원본 Job·현재 경합의 기존 gate 형식**을 연결하는 순수 증거 검토다. 독립 감사 후 집중 **13/13**, 전체 #996 회귀 **173/173 PASS**. 주입식 리더 증거와 `contentMatchesCandidate=true`는 독립 실제 인증·현장 CAS 보증이 아니다. `execute996COperator`는 어떤 입력에도 `C_CONTINUATION_PRODUCTION_NOT_APPROVED`를 **파일/네트워크 접근 전에 반환**한다.
- **남은 단일 소스 과제:** 정규 Windows C operator의 실제 파일·운영 조회 어댑터·독립 기존 Claim provenance·최신 Writer 경합 CAS·stage journal 및 안전한 크래시 복구를 별도 정확 소스/검증으로 구현해야 한다. 현재 **운영 CLI/CMD/ZIP/확정 operator SHA가 없다**. 이를 만든 것처럼 승인 manifest를 채우지 않는다. Windows 네이티브 TEMP 13/13 및 원본 Windows R4 84/84는 해당 범위에만 유효하다. **실제 C 승인 0, E: 이동 0, Workflow PUT 0, Backlog 변경 0, 원본 Issue 게시/pc-job 재시도 0. 운영 진행률 80%→80%, C NO-GO, PR Draft 유지.**

## 2026-11-11 별도 Windows 네이티브 TEMP 13/13 실측 성공 — 운영 C NO-GO 유지

- 사용자가 **물리적으로 분리된 Windows PC**에서 PowerShell `Process` 범위의 한시적 `RemoteSigned` 설정을 직접 승인·적용하고, 고정 PS1 SHA256 `6f8436fec7216d278f82558571a7172e5c2d2f7cc0b8b0db357f9ec4a24e613a` 및 CMD SHA256 `f1ca16cafbeb60f6389f0dcc70e1e0c9a37ab59b79a89a49620cb573b04d43e8`을 비교한 뒤 **정확한 PS1 1개의 인터넷 출처 표시만 제거**했다. 이 과정에서 전역·영구 실행 정책 변경은 수행하지 않았다. 같은 세션의 수동 CMD 실행 스크린샷에는 `ZGMINI_996_WINDOWS_NATIVE_TEMP_FIXTURE_V1`, `WINDOWS_TEMP_FIXTURE_NATIVE_MOVE_ONLY`, `checksPassed=13`이 나타난다.
- 소스의 `Assert-Test` 경로를 독립 대조하면 **정상 6 + 기존 목적지 충돌 3 + old C 보관 직후 중단 1 + continuation 보관 직후 중단 1 + 새 Install 잠금 재생성 2 = 총 13건**이다. 실제 Windows `.NET Directory.Move` 기본 동작에 대해 대상 기존 경로 덮어쓰기 거부·원본 보존·Install 마지막 이동을 **13/13 성공 관측**으로 인정한다. 출력은 `installedRootTouched=false`, `executionAuthorized=false`, `originalPcWrites=0`, `workflowPuts=0`, `backlogWrites=0`, `issuePosts=0`, `operatorReady=false`, `cleanupPerformed=false`; 수치는 실행기의 자기 보고이며 별도 OS 쓰기 추적 증거는 아니다.
- 화면 SHA256 `ec3eabbc4ce85bdd3266f7beaf732137d2d334c14d1ea076fee7eff7cb518c93`. 결과·출처·검증 한계는 `artifacts/controller-996/zgmini-996-native-temp-fixture-success-20261111.json`에 기록하고 스크린샷 원본은 GitHub에 저장하지 않는다. 시험이 만든 `zgmini-996-test-native-<GUID>` TEMP 폴더는 **자동 삭제되지 않고 남아 있으므로 증거 보존 중 임의 정리하지 않는다**. 테스트 ZIP 전체 SHA256을 사용자가 별도 확인했다는 화면은 없다.
- **입증 범위 한정:** 이는 운영 `E:\ZGmini` C Claim/Lease의 실물 이동이나 정확한 트랜잭션/전원 중단 내구성, 원본 PC 소유권, 원본 4 Job 결과쌍의 존재, 현재 Writer 무경합, 새 C 승인 **어느 것도 검증하지 않는다**. R4 원본 Windows의 Git 84/84 원본 소스 관측은 별도 성공 증거다. #996 신규 정확 Owner 승인 댓글은 **0**, C 재실행 권한 없음, 원본 Claim·Install Lease 이동과 Workflow PUT·Backlog·Issue 변경 금지. 전체 운영 진행률 **80%→80%**, 실제 C는 **NO-GO**.

## 2026-11-11 별도 Windows TEMP 시험 1회 — PowerShell 실행 정책으로 차단

- 사용자는 **별도 물리 Windows PC**에서 `RUN_996_ISOLATED_WINDOWS_NATIVE_TEMP_FIXTURE_ONCE.cmd`를 실행했다고 명시하고 콘솔 화면을 제출했다. 원본 PC에서 발생한 `BLOCKED: ORIGINAL_ZGMINI_ROOT_PRESENT`와 구별된다. 새 PC에서는 CMD가 `#996 ISOLATED WINDOWS TEMP NATIVE MOVE FIXTURE RESULT:`까지 진행했지만, PowerShell이 PS1에 대해 **`UnauthorizedAccess`·`about_Execution_Policies`**를 출력하며 실행을 거부했다. CMD 자체 메시지도 `FIXTURE STOPPED. DO NOT BYPASS EXECUTION POLICY.`였다.
- **Windows `.NET Directory.Move` 테스트 실제 수행 0건, PASS 0건**. 시험 스크립트의 더미 TEMP 폴더 생성 단계도 시작하지 않았다. CMD 헤더까지 진행된 것으로 보아 내장 소스 SHA 확인 단계는 통과했을 가능성이 높으나, 제출된 사진에 ZIP SHA 검산이나 OS 수준 무쓰기 기록이 없으므로 별도 입증으로 표시하지 않는다. 사용자 화면 SHA256 `28d529af7ddb4b0ea4703eed3a464d7391adb01e0596bfd0eaad1f7c2c8fc82d`와 진단 한계만 `artifacts/controller-996/zgmini-996-native-temp-fixture-policy-block-20261111.json`에 기록하고 사진 원문은 GitHub에 올리지 않는다.
- **권한 경계:** 실행 정책 우회·변경, `-ExecutionPolicy Bypass`, 외부 명령 통한 임의 스크립트 실행, 관리자 권한 강제 상승은 **시도하지 않는다**. 다음 순서는 별도 Windows PC에서 `Get-ExecutionPolicy -List` **읽기 전용 조회**로 `MachinePolicy`/`UserPolicy`/`Process`/`CurrentUser`/`LocalMachine`의 실제 제한 범위를 보고, 해당 기기 소유자 또는 정책 관리자의 별도 지시를 기다리는 것이다. 정책 차단이 풀렸다는 검증 전에는 같은 CMD를 반복 실행하지 않는다.
- 원본 Windows의 R4 소스 해시 **84/84 성공 관측은 유효**, 별도 native TEMP 실증은 여전히 **0**, 신규 C 정확승인은 **0**. 실제 C 복구·Claim/Lease 이동·Workflow PUT·Backlog·Issue 변경 전부 **NO-GO**, 운영 진행률 **80%→80%**.

## 2026-11-11 별도 격리 Windows TEMP 네이티브 이동 시험 패키지 R1 — 아직 미실행

- 원본 Windows의 R4 Git 84/84 읽기 전용 확인 이후 남은 **운영과 분리된 Windows `Directory.Move` 원자적 충돌 거부 실증**용 수동 단회 패키지를 봉인했다. `artifacts/controller-996/zgmini-996-isolated-windows-native-temp-fixture-r1.zip` **SHA256 `551046318b4605a4063f910edd65700b2ee6fb212474c8179260591791f7f8dc`**, ZIP 구성 정확히 **2파일**, CRC **2/2 정상**.
- CMD `RUN_996_ISOLATED_WINDOWS_NATIVE_TEMP_FIXTURE_ONCE.cmd` SHA256 `f1ca16cafbeb60f6389f0dcc70e1e0c9a37ab59b79a89a49620cb573b04d43e8`, 네이티브 소스 `TEST_996_WINDOWS_NATIVE_MOVE_FIXTURE.ps1` SHA256 `6f8436fec7216d278f82558571a7172e5c2d2f7cc0b8b0db357f9ec4a24e613a`. CMD는 고정 Windows PowerShell의 `Get-FileHash`로 PS1을 먼저 검산하고, 기본 실행 정책을 **우회하지 않는** `-NoProfile -NonInteractive -File`로 실행한다. 정책 차단 시 그 상태로 중지한다.
- **반드시 물리적으로 분리된 격리 Windows PC에서만 수동 실행:** CMD와 PS1 모두 **원본 `E:\ZGmini` 경로가 있으면 중단**한다. 단, `Directory.Exists`의 부재는 접근 거부·마운트 해제에서도 발생할 수 있어 **이 차단 조건만으로 별도 PC 신원 인증은 불가능**하다. 운영자는 물리적으로 분리된 PC임을 먼저 확인해야 한다. PowerShell 소스는 TEMP가 원본 E:·UNC/네트워크·이동식 또는 비 NTFS/ReFS·Reparse Point 경로이면 차단하고, 별도 새 `zgmini-996-test-native-<GUID>` 아래에만 **더미 파일·디렉터리를 생성해** 기존 대상 충돌·중단 후 Install 보존·정상 해제 순서를 시험한다. 자동 삭제·운영 데이터 접촉·CI Runner workflow dispatch·C Operator 호출은 하지 않는다. 출력의 `operatorReady=false`와 `executionAuthorized=false` 유지.
- 전체 격리 Node/정적 회귀 **160/160 PASS**. 그러나 이 패키지는 **별도 Windows 네이티브 실측 0**, 경합/Crash 내구성 실측 0이며, 본문 R4 원본 Windows 성공 결과를 대체하지 않는다. 실제 Windows 결과/출력·ZIP 해시 검산은 별도 제출 필요하다. 기존 C급 재실행 금지, 운영 진행률 **80%→80%**.

## 2026-11-11 원본 Windows R4 실측 수신 — 84/84 일치, C 복구는 NO-GO

- 사용자가 원본 Windows에서 실행한 **R4 읽기 전용 CMD 콘솔 화면 1건**을 제출했다. 화면에는 `ZGMINI_CONTROLLER_996_GIT_SOURCE_READONLY_R4`, `SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS`, 설치 **38**, Stage **39**, Maintainer **7**, 합계 **84**, `originalWindowsReadback=true`, `executionAuthorized=false`가 표시됐다. **앞선 아래의 'Windows R4 0건'은 이 결과를 받기 전 이력**이다.
- 화면 `gitBlobManifestSha256` **`0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f`**는 봉인된 Git 48종 원문 Manifest와 일치했다. 화면 `sourceBytesSha256` **`b7ca1f00f3d171dae91cc3559aef861b5b8299770ce86e5b6323def1f301f46d`**는 봉인된 84개 로컬 경로·SHA256 배열의 JSON 해시를 **별도 오프라인 재계산해 완전 일치**했다. 사용자 스크린샷 SHA256은 `215c8f70d06a8029eda14c554a84c2ad1b56fbdc570f0aab06d10a335832fb18`이며 GitHub에는 사진 원문이 아닌 비민감 전사·한계만 `artifacts/controller-996/zgmini-996-r4-windows-screenshot-readback.json`으로 기록한다.
- 출력의 `operationalWrites=0`, `workflowPuts=0`, `backlogWrites=0`, `issuePosts=0`, `pcRetries=0`은 **CLI의 자체 보고**다. 사진만으로 물리적 PC 신원을 외부 인증하거나 OS 수준 쓰기 0을 단정하지 않는다. **사진에는 실행한 ZIP/CMD SHA256 검산 결과가 없으므로 사용자 PC의 패키지 바이트 동일성도 별도 미입증**이다. 읽은 시점 이후 소스가 바뀌지 않았다는 증거도 아니다. **기존 C Claim/Install Lease 보존, 원본 Job 4건 자동 재실행 금지** 유지.
- 2026-11-11 기준 원본 Issue #996은 Open·댓글 **10건**, 신규 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1` 댓글 **0건**이었다. 원본 Job [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217)·[#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219)·[#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226)·[#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227)은 Open/결과 댓글 0건을 유지한다. 원본의 실물 replay/결과쌍 및 독립 Claim provenance가 완료됐다는 뜻은 아니다.
- **다음 관문:** 운영 `E:`를 건드리지 않는 **별도 격리 Windows의 TEMP 네이티브 `Directory.Move` 충돌 시험**(아직 실측 0)과 원본 Claim/Lease 소유자·경합·Backlog 실물 상태 최신 확인, 별도 불변 Manifest/Owner 신규 정확승인이 필요하다. 실제 C 복구·Lease 이동·Workflow 변경·원본 Job 종료 **NO-GO**, 운영 전체 진행률 **80%→80%**.

## 2026-11-11 OFFLINE Git 바이트 검증 R4 소스 봉인 — 운영 NO-GO

- **목적/범위:** 실제 복구·재실행의 승인과 무관하게, 기존 R3 원본 Windows 보존 상태에서 설치 Controller **38개**, Stage **39개**, Maintainer **7개**, 합계 **84개** 파일을 불변 Git 원본과 **읽기 전용으로** 대조할 수 있는 보조 도구를 추가했다. 독립 GitHub REST 조회로 고정 Git commit 3개의 트리 SHA와 각 Git blob 경로·SHA1·크기를 **84/84 대조, 불일치 0**, 중복 제외 원문 Git blob **48종**의 SHA256을 봉인했다.
- **중요한 설계 교정:** 최초 Git 실행(`git.exe`) 기반 R4 초안은 OS `PATH` 변조·부분 Git clone 등의 불확실성이 있어 **미배포 폐기**했다. 현재 R4는 `git`, 하위 프로세스, 네트워크, PC-job, 로그/원본 파일 쓰기를 전혀 호출하지 않고, 봉인된 오프라인 SHA256 + Git blob SHA1/크기를 실제 원본 E: 파일과 비교한다. 직접 import 호출자가 검증 Manifest SHA를 임의 대체하는 우회도 운영 경로에서 고정 SHA 필수로 차단했다.
- **별도 5파일 패키지:** `artifacts/controller-996/zgmini-996-git-source-readonly-r4.zip`, **ZIP SHA256 `07874b2cbf4c63ed98f14a464f6491df76829c6a51fe4d8fd5d86be946d1a0a7`**. 파일은 `RUN_996_GIT_SOURCE_READONLY_R4_ONCE.cmd`(SHA256 `4c9f64749e426105e702caacfdb4b7ac93dfb2fcb3dfae4ff665d7d76b1436c2`), `controller-996-git-source-readonly-cli-r4.mjs`(SHA256 `b0f6b834ab82f76e355a1879352d445dfdc7fc6520f7a1d36aed4760c010c4f6`), `controller-996-git-byte-offline-readonly-r4.mjs`(SHA256 `bc5a5e5cb0c6ced192f5a6c3b9898b8ac3e319076e07bd2de3b9d9872ff5facd`), `controller-996-git-byte-offline-manifest-r4.json`(SHA256 `0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f`), `controller-996-git-source-readonly-source-lock-r4.json`(SHA256 `d9671e500891b1935ddd2b12e38fd1a0b4c3a202c541a814afb3cc508543bb2f`)이다. ZIP CRC 검사 **5/5 정상**.
- **검증 결과:** 전체 소스·격리 fixture 회귀 **157/157 PASS**, GitHub 불변 트리 경로/Blob 메타 **84/84 일치**. 그러나 이는 **Linux/정적 시험**이며, 원본 Windows의 R4 실행 **0건**, 독립 Windows 네이티브 TEMP 이동 시험 **0건**, 신규 C 원문 승인 **0건**이다. ZIP 전체 SHA256은 별도 고정한 뒤 사용자 실행 전에 검산해야 하며, Windows reparse point·경합·파일 변경 시점은 실제 실증이 필요하다. R4가 PASS여도 C 실행 승인이 아님.
- **작업/권한 경계:** Draft PR #1222의 소스 전용 후보만 갱신한다. 기존 실패한 `RUN_996_NATIVE_C_ONCE.cmd`, R2 CMD를 재사용하지 않는다. 원본 C Claim/Install Lease·Backlog·Workflow·원본 Issue를 이동·변경·재발행하거나 PC 복구를 실행하지 않는다. 네 개 미완료 원본 Job은 성공 처리/자동 재발행 없이 원담당 재계획 검토 상태로 둔다. **전체 운영 진행률 80% → 80%, 실제 C 복구 NO-GO**.

## 2026-11-11 Codex 사용량 중단 후 재개: 보관 충돌 격리 시뮬레이션

### 독립 검토 보완 정본 — 원본 승인 누락·경로 불일치 교정 (운영 NO-GO)

- 신규 C 원문 조회기는 실제 GitHub REST의 비동기 `get/authenticateReadOnly`에 맞춰 전 경로 `async/await`로 동작한다. **원본 #996 Issue body의 7개 필드가 포함된 원문 SHA256** `37caf348eb4fc5440ebfa76a1c1166bb7480dffdd8d054dcb19391816bc72b5a`, 고정 Owner ID, `comments` 공식 총수, 댓글 두 번 전체 페이지와 마지막 원본 Issue 재조회가 모두 같아야만 `C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY`를 반환한다. 댓글 단축 응답, 본문의 `chatId/controlRepository/approvalManifestSha256` 변조, 조회 도중 Issue 변경은 각각 차단한다. 포트 주입 단계이므로 실제 인증된 운영 GET 어댑터·새 승인 증빙을 아직 제공하지 않는다.
- 이전 격리 Linux 시뮬레이션의 **예약 디렉터리 아래 `payload/` 이동**은 Windows 정본 `Directory.Move(source, destination)`의 **직접 보관 경로**와 달랐다. 지금은 양쪽 모두 **구 C Claim → 신규 C Claim → 원본 Install Lease 최종 이동**, 보관 폴더 바로 아래 `owner.json`/Marker를 기준으로 통일하고 회귀시험에서 양쪽 경로·순서를 교차 확인한다. 과거 이 문서 하단의 `payload/`·`AFTER_*_RESERVATION` 기록은 **이전 실험 이력**이며 현행 정본이 아니다. Linux `rename`은 검사·이동 사이 경합에서 이미 존재하는 빈 폴더를 교체할 수 있으므로 **절대 운영 no-replace 보증으로 사용하지 않으며**, 별도 격리 Windows TEMP에서 실제 `.NET Directory.Move` 충돌·중단 시험을 통과해야 한다.
- Windows 네이티브 fixture는 추가로 UNC/네트워크·이동식·비 NTFS/ReFS TEMP 위치를 차단하고 **원본 E:가 아닌 로컬 고정 디스크**에서만 동작하도록 소스를 제한했다. 안전한 Windows 하드웨어/동시 프로세스 환경에서 실제 실행하기 전까지는 해당 검증 PASS 0건이다.
- 정적·격리 소스 회귀 **144/144 PASS**(신규 승인 리더 18, Windows 스크립트 정적 2, Linux↔Windows 직접 보관 경로 교차 1 포함). **Windows Native 실측 0**, 원본 C Claim/Install Lease 변경 0, Workflow PUT 0, Issue POST 0, 이전 실행 CMD 재사용 0. 운영 진행률 **80%→80%**, 실제 C 실행 **NO-GO**.

### 신규 C 독립 승인 원문 조회·Windows TEMP 네이티브 시험 소스 (운영 NO-GO)

- `tools/controller-996-native-continuation-consent-reader.mjs`는 기존 신규 C Shape Gate와 6효과 배열을 공유한다. **별도 신규 C Manifest의 40hex 고정 Git commit·고정 경로** `docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json`을 raw GitHub GET에서 읽고 base64 canonical/size/Git blob SHA-1/원문 SHA-256·Manifest top-level exact key 집합·원본 #996 Issue owner/title/body schema/requestId/operation/targetControllerSha·원본 전체 댓글 100/page·중복 ID·댓글 두 차례 완전 재조회·작성/수정 시간 일치·고유 신규 소유자 승인 정확본문(Manifest commit SHA 포함)·같은 소유자 모순 승인 및 신규 철회 표시를 검증하는 **읽기 전용 후보 라이브러리**다. 과거 `RECONCILE_INTAKE_PAUSED_ONLY` 승인은 새 범위에 재사용하지 않으며 원본 GitHub 댓글 작성/수정 **0회**. 결과 상태는 `C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY`, `executionAuthorized=false`다. 인증된 GET 포트 주입은 향후 작업이며, 모의 포트 테스트 통과를 실제 사용자 승인으로 오인하지 않는다.
- 실제 GitHub #996 raw REST GET 1페이지 읽기 전용 결과 댓글 **10건**, 과거 C 승인 패턴 **1건**, 신규 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1` **0건**(2026-11-11 확인). 댓글에 작성/수정 시각이 존재함을 확인했다. 신규 불변 Manifest·Operator SHA·ZIP SHA·source-lock SHA·owner 댓글은 **아직 발급되지 않았다**.
- `tools/TEST_996_WINDOWS_NATIVE_MOVE_FIXTURE.ps1`는 경로 입력을 받지 않고 새 Windows TEMP `zgmini-996-test-native-<GUID>`에서만 `[System.IO.Directory]::Move`의 원본→보관·기존 대상 충돌 거부·중간 중단 후 Install Lock 보존·마지막 Lease 해제 뒤 다른 임시 잠금 생성 경계만 **시험하도록 작성한 소스**다. 시작 시 TEMP 실제 드라이브가 `E:`이거나 `ZGmini` 경로 포함/부모 Reparse Point이면 중단하며, 임의의 recursive cleanup은 수행하지 않고 시험 폴더만 남긴다. 운영 `E:` 원본 경로·실제 승인/업데이트는 접근하지 않는다. **현재 Linux 환경에는 PowerShell이 없어 Windows Native 동작 실행 PASS는 0건**이며, Node 정적 안전 계약 시험 2건만 통과했다. Junction·전원 중단·dir 메타데이터 내구성·동시 프로세스/Writer 유입과 디스크 flush는 별도 격리 Windows 실증이 필요하다.
- 당시 **소스 회귀 140/140 PASS**(신규 승인 모의 15, Windows PowerShell 정적 2 포함); 이후 수정 최신 결과는 바로 위 독립 검토 보완 정본 **144/144**가 우선이다. **원본 Windows 운영 변경 0·Workflow PUT 0·원본 Issue POST 0·PC C 실행 0**, 운영 진행률 **80%→80%**. 실제 C 실행은 여전히 **NO-GO**이며 이전 CMD/승인 재실행을 금지한다.

### 후속 필수 수정: 실제 설치 배타 잠금 해제는 맨 마지막 (운영 NO-GO)

- 최신 `main` `tools/maintenance-lock.mjs`의 설치 진입 잠금은 **정확히 `leases/controller-install` 디렉터리의 원자적 획득**에 의존하고, 신규 `controller-recovery-continuation-<UUID>` Claim은 그 경로를 대신 보호하지 못한다. 앞선 어댑터의 **oldC → install → continuation** 순서는 원본 Lease를 먼저 없애 다른 설치와 경합할 수 있었다. 신규 C 승인 manifest는 아직 발급되지 않았으며, 실제 실행 순서를 **oldC → continuation → install(마지막 상태 변경)**로 수정했다.
- 격리 `simulate996Continuation`은 신규 Claim의 `READY_TO_RELEASE_INSTALL.json`을 완료 확정(`DONE`)이 아닌 **해제 준비 의도**로 `wx`·fsync·재읽기하고, 구 C Claim 보관 및 신규 Claim 보관 후 `owner.json`·준비 Marker 원문 SHA를 재검증한다. 그다음 보호/Writer 경합·원본 Install Lease 소유권을 다시 확인하고 **Install Lease 보관을 마지막 변경**으로 한다. 이후 쓰기 없는 원본 보관 읽기 검증만 수행하며 모든 중단은 자동 재시작 불가다.
- `plan996WindowsArchive` 및 테스트 포트도 같은 마지막 Lease 순서를 강제한다. 신규 Claim 보관 후 기존 잠금 보존, 준비 Marker의 소유자 nonce·원본 Install Recovery SHA 불일치 차단, 최종 해제 직전 Writer 유입 시 잠금 보존, 최종 해제 후 새 `controller-install` 경로가 다른 내용으로 다시 존재해도 **구 보관 Lease의 바이트와 현재 경로를 구분**하는 부정 시험을 추가했다. 다른 내용의 Lease가 정당한 새 Writer라는 증빙까지 완료된 것은 아니므로 `postReleaseOwnerVerified=false`로 반환한다. Mutating Linux fixture의 중간 부모 symlink도 차단했다. 실제 Windows `.NET Directory.Move`, journal 원자성과 보존·독립 owner attestation은 아직 검증하지 않았다.
- 새 집중·전체 회귀 포함 **123/123 PASS**, 기존 운영 PC 원본 변경 **0**, Workflow PUT **0**, 원본 Issue 재게시 **0**, 실PC C급 실행 **0**. **운영 진행률 80%→80%**, 이 단계는 Draft 소스 보완만 GO; 신규 사용자 C 승인·84개 원본 Windows 바이트 검증·실물 잠금 해제 테스트 완료 전에는 운영 **NO-GO**다.

### 후속 독립 C 동의·Windows 보관 어댑터 소스 검토 (운영 실행 불가)

- `tools/controller-996-continuation-gate.mjs` 및 대응 시험을 추가했다. **이전 `RECONCILE_INTAKE_PAUSED_ONLY` C 동의는 신규 중단 Claim 인계에 사용 불가**하며, 신규 스키마 `ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1`의 고유 UUID·새 불변 manifest 증거·새 정확한 사용자의 승인 영수증·operator/source-lock/ZIP 원문 해시·기존 Claim/세 marker/Lease/Backlog 원문 핀·원본 Windows에서의 Git 84바이트 검증·원본 4 Issue 무재실행 분류·Fresh Writer 경합 부재가 모두 일치해야 검토 후보가 된다. 모든 성공 응답도 `executionAuthorized=false`인 **순수 검토**이며, 이 함수에 전달된 boolean만으로 실PC 변경을 승인하지 않는다. 동의·원본 수정·이슈 재발행 기능은 없다. 집중 **12/12 PASS**.
- `tools/controller-996-windows-archive-adapter.mjs` 및 시험에는 기존 C Claim → 원본 Install Lease → 신규 Continuation Claim 순서의 **고정 E: 경로·동일 볼륨 Windows .NET Directory.Move no-replace 계약 계획**과 Linux 전용 fixture 시뮬레이션만 존재한다. 실제 Windows `.NET`/PowerShell 호출, 원본 경로 접근, 운영 실행용 CLI/CMD는 **전혀 없다**. 존재하는 보관 대상·검사 후 경쟁 생성·크래시 주입·원본 drift·원본 및 보관 부모 symlink·테스트 fixture 부모 symlink·늦은 Writer 경합 및 잘못된 경로를 거부하는 집중 **13/13 PASS**. Install Lease 보관 직후 중단 시 자동 재실행도 차단을 확인했다.
- 전체 소스 회귀 **114/114 PASS**. 독립 검토 판정은 **Draft 소스만 조건부 GO, 실제 C는 NO-GO**. Gate는 주입된 증빙의 **형식만 검토**하며 진본성·독립 승인까지 증명하지 않는다. 현재까지 추가된 것은 독립 소스·테스트로, **실제 Win32 Directory.Move semantics 실측, 대상 저장 경로의 진정한 원자성·parent fsync, immutable consent·owner 외부 provenance, 중단 직전 완성 준비 Marker, 사후 다른 설치 진입 경합, 중간 부모 symlink 교체 경합**은 아직 미충족이다. 기존 원본 PC/Workflow/Claim/Lease/Backlog·실제 GitHub Issue 운영 변경 **0**, 운영 수명주기 **80%**. Draft 소스 외 배포·실행 **NO-GO**.

- 이전 Codex 대화는 `Integrity 996`/`Review 996` 완료, Windows 임시 폴더 소스 시험 **13건 PASS**와 보관 경로 충돌 수정을 진행했다고 보고한 상태에서 사용량 제한으로 중단됐다. **해당 세션의 미커밋 파일/명령 실행 기록은 현재 작업 환경에서 확인할 수 없으며, 이를 GitHub에 게시된 코드·실PC 결과로 간주하지 않는다.** 새 작업은 기존 Draft PR #1222 HEAD `89fc9fbdeef4790533dc834261da7869c4764988`에서 재개한다.
- 사용량 중단 시점의 Windows archive 경로 충돌과 같은 문제를 **격리 Linux temp-only 시뮬레이션**에서 별도 보강했다. 이전의 `absent(destination)` → `rename(source,destination)`만으로는 POSIX의 기존 빈 디렉터리 교체와 검사·실행 사이 경쟁을 차단할 수 없다. 새 모의 코드는 **독점 `mkdir`로 대상 보관 디렉터리를 예약**한 다음 원본을 그 내부 `payload`로 이동하며, 예약 실패·동일 경로 선점·예약 직후 강제 중단 시 원본 보존 및 자동 재시도 거부를 시험한다.
- 추가 부정시험 5건: 기존 빈 대상 경로, 사전검사 직후 경쟁 디렉터리 생성, 구 C Claim 보관 예약 직후 중단, Install Lease 보관 예약 직후 중단, 이동 직전 원본 Claim SHA 변경. 집중 **11/11 PASS**, 전체 연결 회귀 **81/81 PASS**. 이는 **실물 Git 84파일 증명·Windows/.NET 이동 보장·운영 C 승인·실PC 복구 증거가 아니다.**
- 운영용 어댑터는 여전히 별도 구현 대상이다. `Directory.Move`의 Windows 대상-존재 충돌 거부, 파일/디렉터리 정체성 pin, parent flush, 현행 보호/Writer 경합 재검사, 새 정확한 C 동의, 보관 단계별 저널과 비자동 재진입 판정이 필요하다. `simulate996Continuation`은 여전히 운영 호출을 무조건 거부하며, 기존 CMD/ZIP·원본 #996·Claim·Lease·Workflow·Backlog를 건드리지 않았다.
- 새로운 **읽기 전용 소스 검산 라이브러리** `tools/controller-996-git-source-readonly.mjs`를 별도 분리했다. 원본 Windows 고정 경로와 Git checkout에서 commit `badad912`/`9db6fff`/`16064e2`에 대해 `git show <commit>:<rel>`로 **38+39+7=84개** 파일을 실제 바이트 비교하고, pinned host manifest·소스 SHA·Stage 전체 파일셋·심볼릭 링크·재스캔을 검증하도록 설계했다. 운영 입력 임의 경로/커밋은 허용하지 않고, Linux는 별도 temp fixture 주입에서만 테스트한다. 실행용 CMD/소유자 handoff/원본 PC 실제 실행은 없다. 전용 부정시험 **8/8 PASS**, 기존 보관 시뮬레이션과 합친 전체 회귀 **89/89 PASS**. 이것은 **Windows 84파일 실측 완료가 아닌 소스/격리 테스트**다.
- **운영 진행률 4/5=80% 유지, 실제 C는 NO-GO.** 다른 Codex 세션의 미커밋 변경은 보존하고, 나중에 동기화할 때 강제 덮어쓰기/리셋 없이 차이를 확인한다.

## 실제 관측과 범위 (2026-11-10 KST)

- 대상: 원본 Windows `E:/ZGmini`, 원본 [#996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996), `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`.
- 사용자가 기존 R2 `RUN_996_NATIVE_C_ONCE.cmd`에서 `996 실행`을 입력한 뒤 얻은 결과:
  `STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE` / `C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID`, `failedStep=ORIGINAL_JOB_DISPOSITIONS`.
- C 화면의 시도 수: Workflow PUT 1, backlog close 1, original lease archive 0, own claim archive 0. 이것은 시도 횟수이며 독립적인 운영 성공 확인은 아니다.
- 기존 C Operator 소스에서 이 단계에 도달하려면 `enableOnce`, `verifyActiveReadback`, `closeOnce`의 반환값 검사에 이미 통과했어야 한다. 다만 이후의 물리적 상태와 전체 사후검증은 아직 미확정이다.
- GitHub 브라우저 읽기 전용 실측: `pc-job.yml`의 메뉴가 `Disable workflow`로 표시되어 **현재 활성 상태**. #996은 Open, 원격 maintenance 결과는 과거 `UNKNOWN/RUNNER_SET_DRIFT` 그대로이고 새 C terminal receipt는 없음.
- 원본 Issue #1226(`core-status`)·#1227(`pc-job`)은 Open·결과 댓글 0. 이들이 실제 C pause window에 속하는지의 최종 판단은 원본 backlog의 `pausedAt/resumedAt` 읽기 전용 교차검증이 필요하다. 이전 #917의 원본 #919와 혼동하지 않는다.

## 확인된 소스 결함과 변경

원래 백로그 계획 검증기는 모든 `chatId`를 UUID 36자로, 제목을 `pc-job`으로, 본문을 7개 필드로만 제한했다. 반면 정본 `controller/common.mjs`는 `chat-UUID`를 허용하고, 제목을 인증 조건으로 사용하지 않으며, `writer-install-preimage-readonly`의 승인된 9필드 변형을 허용한다. `controller/entry.mjs`도 `pc-job` label을 검사하지 정확한 제목을 강제하지 않는다.

Draft #1222에서 순수 소스 `controller-996-backlog-plan.mjs`와 회귀시험 2개 파일만 정본 계약에 맞췄다. 원본/확장 경로, body 키, 해시 및 source identity 검증, 중복 requestId·불완전 결과 차단은 유지한다. 로컬 연결 시험 22/22 PASS, GitHub 원격 수정 파일 byte 일치 3/3.

**이 변경은 C 복구 실행 허가가 아니다.** 기존 R2 ZIP·CLI·source-lock·승인 manifest의 봉인된 바이트는 변경하지 않았다. ZIP에 포함된 구 검증기를 다시 실행하면 동일/추가 부작용 위험이 있다. 변경된 Draft 파일을 기존 ZIP에 임의 덮어씌우거나 명령행으로 직접 호출하지 않는다.

## 다음 단회 읽기 전용 판정 — 원본 Windows 전용

새로운 상태 전용 관측기가 다음 원본 증거를 **민감정보를 출력하지 않고** 독립 재조회해야 한다. 구 R1/R2 사전 검사처럼 `no claim` 또는 `backlog open`을 전제해서는 안 된다.

1. 기존 #996 install lease/owner/marker/ledger의 존재·원본 digest·현재 archive 여부, 이전 owner 생존 여부, 신규 C claim/marker의 존재·PID 생존 여부. 원본 nonce·전체 JSON은 외부 출력하지 않는다.
2. C 고유 marker의 정확한 순서: `PREPARED`, `WORKFLOW_ENABLE_ATTEMPTED`, `BACKLOG_CLOSE_ATTEMPTED`의 존재·정합; `PRE_ARCHIVE`, `ORIGINAL_LEASE_ARCHIVE_ATTEMPTED`, `COMPLETE`, `OWN_CLAIM_ARCHIVE_ATTEMPTED`의 존재 여부는 **단정하지 말고 실제 조회**한다.
3. 원본 pause 파일 `pausedAt`, `resumedAt`, `replays`와 원본 SHA/닫힌 SHA; `BACKLOG_CLOSE_ATTEMPTED`의 `nextSha` 및 `resumeAt`과의 동일성. 원본 pause 시각부터 실제 resume 시각까지의 전체 Issue 2회 조회·댓글/JSON/TXT 대조.
4. `pc-job` Workflow `active`와 이벤트 실행 이력, 별도 6개 전용 Runner·독립 Runner, 기존 Controller/Stage/Maintainer 실제 파일 바이트·source pin, 보호 Writer/Task 현재 fingerprint. 역사적 `protectedBaselineVerified=false`와 disable actor 미입증은 임의로 true로 바꾸지 않는다.
5. 다른 승인 설치·복구 Writer 또는 동시 C owner가 있는 경우 즉시 중단. 상태 확인 자체는 설치·Issue 게시·Workflow PUT·backlog rename·lease 이동 0회여야 한다.

### 첫 단계 구현 현황 — source-only narrow observer (2026-11-10)

- Draft #1222에 `tools/controller-996-interrupted-observer.mjs` 및 `tests/controller-996-interrupted-observer.test.mjs`를 신규 추가했다. 기존 봉인된 R2 ZIP, C CMD/CLI, source-lock, 동의 manifest는 **변경하지 않았다**. 이 소스에는 운영용 CLI도 없다.
- 원본 Windows 고정 `E:/ZGmini`에서만 읽기 전용 호출을 허용하는 **라이브러리 후보**다. 경로·symlink 검사, 6개 원본 파일의 SHA256 고정값, 기존 install lease·신규 C claim 및 세 intent marker, 양쪽 owner PID 생존 여부, backlog closed SHA/시간, 후속 archive marker 부재, GitHub Workflow ID/path/active와 원본 Issue/Runner 이름 6개 존재, 현재 Writer/Task fingerprint를 검사한다. 읽는 도중 원본 파일 해시나 lease/marker 존재 상태가 바뀌어도 즉시 UNKNOWN으로 중단한다.
- 반환 상태가 `READONLY_INTERRUPTED_PHASE_CONSISTENT`이더라도 `C_CLAIM_PROVENANCE_NOT_EXTERNALLY_PINNED`, `claimProvenanceExternallyPinned=false`, `fullSourceBytePostcheckVerified=false`, `executionAuthorized=false`를 명시한다. 이름 6개를 가진 Runner의 등록 여부만 확인하며 **격리·전용·온라인 준비 상태를 증명하지 않는다**. 원본 C 소유권 승계 또는 archive 승인으로 사용할 수 없다.
- 연결된 소스 단위·경합 부정 회귀 **29/29 PASS**(기존 backlog plan/readback 22건 + 새 관측기 7건). 실제 원본 Windows 실행/사후 증거는 아직 **0건**이며 5단계 수명주기 완료율은 **4/5 = 80%**로 유지한다.
- **남은 별도 증명:** 원본 pause-window 전체 Issue 2회 조회·댓글/JSON/TXT 결과, Workflow 실행 이력, 각 설치 소스 파일의 실제 바이트 단위 postcheck, 격리 Runner 구성, C claim의 독립 provenance·안전한 소유권 인계 규칙. 이 중 하나라도 빠진 상태에서 새 C 복구 실행·lease archive를 승인하지 않는다.

### 후속 단계 구현 — 분리된 중단 상태 읽기 전용 R1 패키지

- Draft #1222에 기존 C R2와 **완전히 별개의** `RUN_996_INTERRUPTED_READONLY_ONCE.cmd`, `controller-996-interrupted-readonly-cli.mjs`, `controller-996-interrupted-readonly-source-lock-r1.json` 및 패키지 시험을 추가했다. 배포 대상은 정확히 **7개 파일**이며 기존 C Operator·R2 ZIP/CMD/소유자 동의 파일은 포함하지 않는다.
- 다운로드 후보: [`zgmini-996-interrupted-readonly-r1.zip`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/codex/controller-996-intake-c-candidate-r1-20261110/artifacts/controller-996/zgmini-996-interrupted-readonly-r1.zip), ZIP SHA256 `f233a5a9a48f44680c4566e2226707fb72f86769f8d790f53a07d34dadca086c`. 내부 CMD SHA256 `d811bca0d10ff7baf4f747bbf1bc59104e066497c59c2d7a9e254ed827640daa`, CLI SHA256 `418aa7fb41152c81e95a37ffae858741ae23c98fa503f1300fba33250db2fdd7`, source-lock SHA256 `ab2b58f7dc2ef528052add141d81e4d4eb2a7d5cf8b1673d07e1ff50901fee10`.
- CMD가 고정된 `C:/Windows/System32` PowerShell의 `Get-FileHash`로 CLI를 먼저 검증하고, CLI가 고정된 4개 원본 모듈의 해시·import closure를 확인한 후에만 상태 관측기를 불러온다. 모든 PC 읽기 대상은 원본 Windows `E:/ZGmini`로 고정되어 있고, 실행 패키지는 **원본 설치 폴더 바깥**에 위치해야 한다. 조회 중 실패·경합이면 기존 C claim·install lease를 유지하고 UNKNOWN으로 끝난다. `%TEMP%`가 원본 E:를 가리킬 위험을 제거하기 위해 **TXT·로그·임시 파일·클립보드를 만들지 않고 콘솔에 비민감 JSON만 표시**하며, 필요시 사용자가 콘솔 화면을 전달한다.
- 신규 패키지 자체 부정 검증 **9/9 PASS**, 기존 관측기/백로그 연결 시험 합계 **38/38 PASS**. ZIP 압축 7개 내부 파일과 로컬 원문 **7/7 일치**, ZIP Git blob 원격·로컬 동일. **이것은 Linux 격리/정적 시험이며 실제 Windows CMD+PowerShell 실측이 아니다.** 원본 PC 읽기 전용 단회 실행은 이 단계에 **포함되지 않았고**, 재실행 명령이나 이전 C 동의로 대체하지 않는다.
- 패키지 단계의 후속 확인은 (1) Windows CMD 직접 해시 검사의 실제 exit code, (2) 실제 원본 PC에서 관측기 반환, (3) 실행 중 운영 쓰기 0과 상태 미변경 대조다. 그때에도 **Claim 독립 provenance·설치 소스 전체 byte·pause-window 원본 Issue 결과 검증이 별도로 완료되기 전까지 C 복구 재개 NO-GO**다.

### 원본 Windows 실제 관측 수신 및 pause-window 원본 Issue 두 차례 대조

- 사용자가 별도 바탕화면 폴더의 신규 R1 읽기 전용 CMD를 실제 원본 Windows에서 단회 실행한 **콘솔 스크린샷**을 제출했다. `ZGMINI_CONTROLLER_996_INTERRUPTED_READONLY_CLI_V1`, `READONLY_INTERRUPTED_PHASE_CONSISTENT`, `checksPassed=14/checksTotal=14`, `code=C_CLAIM_PROVENANCE_NOT_EXTERNALLY_PINNED`. 이전 C CMD 재실행은 0회다.
- 실측: `workflowState=active`, `originalLeasePresent=true`, `cClaimPresent=true`, `laterArchiveMarkersPresent=false`; 원본 Backlog 마커와 닫힌 파일 SHA의 일치가 검증됐다. 관측 구간(UTC) `pausedAt=2026-11-10T01:06:53.751Z`, `resumedAt=2026-11-10T13:21:26.727Z`. 결과의 `operationalWrites=0`, `issuePosts=0`, `pcRetries=0`, `executionAuthorized=false`를 보존한다. CLI 자기 보고는 별도의 OS 수준 쓰기 추적 증거가 아니며, 이후 실행자 승인으로 해석하지 않는다.
- GitHub `repo:ansqhd5774-Choi/zgmini-pc-control is:issue created:2026-11-10T01:06:53Z..2026-11-10T13:21:26Z` 범위 2회 조회와 각 원본 Issue·전체 댓글 2회 GET의 정규화 결과가 일치했다. 구간 내 등록된 `pc-job` 원본은 **4개**: [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217) (`core-runtime-source-readonly`), [#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219) (테마 T1, 동일 operation), [#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226) (`core-status`), [#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227) (`core-runtime-source-readonly`). 모두 Open·원본 결과 댓글 0건. `#1213/#1215/#1216`은 원본 pause 시작 **이전**에 생성되어 이 구간에서 제외한다.
- 독립 GitHub Actions GET `actions/runs?created=2026-11-10T01:06:53Z..2026-11-10T13:21:26Z&per_page=100`, 페이지 1~3을 모두 조회한 결과 **전체 277개 실행(100+100+77), run ID 중복 0**이며, 그중 `.github/workflows/pc-job.yml` 실행은 **0개**다. 원본 Issue 등록 직후의 `.github/workflows/pc-shared-issue-admission.yml` 4개 실행 [#42734248711](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42734248711)·[#42734569000](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42734569000)·[#42820183375](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42820183375)·[#42820379269](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42820379269)은 모두 `completed/skipped`. `main`의 `pc-job.yml`은 `issues.opened`·`pc-job` label·전용 self-hosted runner 기반이므로 pause 구간의 원본 처리 성공을 Actions 이력에서 찾지 못했다. 단, 실행 기록 부재는 **실물 replays·JSON/TXT 부재, 외부 PC 실행 0을 증명하지 않는다**.
- 이 사실은 **실행 결과쌍 JSON/TXT의 부재 또는 실행 자체의 부재를 독립 증명하지 않는다**. 실물 Backlog `replays` 항목의 건수·원본별 결과를 별도 읽기로 확정하기 전까지 4건은 `OWNER_REPLAN_REVIEW_REQUIRED` **후보**이며 `DONE`, `SUCCESS`, 자동 재실행, 새 Issue 생성으로 처리하지 않는다. 네 원본 모양을 `replays={}`로 넣은 새로운 **비운영 가정 시뮬레이션**을 추가하여 전체 관련 회귀 **39/39 PASS**, 운영 결과로 오인하지 않는다.
- **해제 차단 요소**: (1) C Claim의 외부에서 고정된 owner/PID/nonce provenance 및 소유권 인계, (2) 원본 Backlog 전체 replays·원격 result JSON/TXT와 Run 대조, (3) Controller/Stage/Maintainer 개별 실제 소스 바이트·현재 보호 상태의 별도 완전 사후검증, (4) 겹치는 Writer/Controller 활성 소유자 배제. 미충족 중에는 원본 C Claim·Install Lease 모두 보존하고 Workflow PUT/backlog rename/Issue 재발행/Lease archive 0회를 유지한다.

### 중단 후 독립 리뷰로 보강한 소스 판정 (추가 운영 실행 없음)

- 순수 GitHub 결과 대조기 `read996OriginalBacklogEvidence`의 `replays={}` 기본값은 **미전달된 실물 원장을 임의의 빈 재생 원장으로 취급**할 수 있었다. 이를 제거하고 호출자가 명시적 `replays` 객체를 제공하지 않으면 `C_GITHUB_ORIGINAL_REPLAYS_NOT_PROVIDED`로 GitHub 조회 전 중단한다. 명시적 빈 map 자체는 **실물 검증 증거가 아니며**, 독립 Windows SHA pin이 여전히 필요하다.
- 종전 최상위 `READONLY_RESULTS_RECONCILED`는 `DONE` 재발행·결과쌍 부재가 미검증이어도 완료처럼 읽힐 위험이 있었다. 결과쌍 **전부 입증**(`READONLY_RESULT_PAIRS_VERIFIED`), **미입증 포함**(`READONLY_VERIFICATION_INCOMPLETE`), **요청 0건의 빈 구간**(`READONLY_EMPTY_WINDOW_VERIFIED`)을 분리하고 `verifiedCount/unresolvedCount`를 반환한다. `DONE`은 실제 replay Issue 및 결과가 검증되기 전 `PRIOR_REPLAY_UNVERIFIED`, `SKIPPED_RESULT_PRESENT`인데 원본 결과쌍이 없거나 불일치하면 `JOURNAL_INCONSISTENT`다. 모두 `executionAuthorized=false`, Issue 게시·PC 재시도 0.
- 관련 소스·부정 회귀 **43/43 PASS**(이전 39건 + 새 4건). 이는 원본 Windows 실물 replays·C Claim provenance·설치 소스 postcheck를 대신하지 않는다. 현재 변경은 Draft의 소스 전용이며 기존 R1 읽기 패키지·봉인 ZIP·실행 CMD는 수정하지 않았다.
- 신규 C 인계는 과거 PID/nonce를 재사용하지 않고 **별도 continuation claim**을 요구한다. 구 C Claim의 SHA/존재·미등록 파일, 모든 marker, 오래된 PID와 새 Writer 경합, 전체 원본 원장/결과쌍을 독립 고정한 다음에야 범위 고정된 새 C 승인 절차를 설계할 수 있다. 원본 C Claim·Install Lease 이동 금지.

### 후속 단회 읽기 전용 증거 R2 — 소스·ZIP 후보, Windows 미실행

- 신규 패키지 `zgmini-996-interrupted-evidence-r2.zip`은 기존 C Operator 또는 이전 R1 상태 관측 CMD를 수정하지 않는 **별도 8파일 ZIP**이다. `RUN_996_INTERRUPTED_EVIDENCE_R2_ONCE.cmd`가 고정 Windows PowerShell에서 CLI SHA를 검사하고, CLI가 봉인된 **5개 모듈과 import closure**를 SHA/source-lock으로 확인한다. 이후 R2 관측기 **자체가 같은 프로세스의 기존 14/14 R1 물리 상태 검사를 재수행**하므로 외부에서 주입한 과거 14/14 JSON은 운영 판정에 사용할 수 없다. 콘솔만 사용하고 TXT·로그·임시·원본 E: 기록을 만들지 않는다.
- 한 번에 추가 관측할 항목은 **원본 C Claim/세 marker의 각 SHA·파일 identity**, Claim 디렉터리의 미승인 파일 여부, 살아난 기존 PID/새 continuation claim·archive 충돌, **실물 Backlog SHA·replays 건수/원본 Issue 번호/단순 상태/관련 replay Issue 번호**, Controller 설치/Stage/Maintainer 각 파일 바이트와 봉인된 로컬 manifest 해시의 부합이다. Claim nonce/원문 request body/토큰/파일 원문은 출력하지 않는다. 전후 독립 스냅샷의 SHA·mtime/file identity를 대조한다.
- 반환의 `DONE`은 **재생 원장 문자열**일 뿐 실제 결과 성공이나 재발행 Issue 인증이 아니다(`replayStatusIsNotExecutionProof=true`). `sourceManifestHashPostcheckVerified=true`도 **로컬 봉인 manifest 대비 소스 바이트 일치**만 뜻하며 Git commit 원문과의 완전 교차검증은 아직 수행하지 않아 `fullSourceBytePostcheckVerified=false`다. C Claim의 역사적 작성자·소유권 외부 승인 역시 미완료(`claimProvenanceExternallyPinned=false`), 모든 경우 `executionAuthorized=false`, 운영 쓰기 0이다.
- R2 ZIP SHA256 `dec06d8d402f68e84eb06893ed8db532e4d799cb4d6b68a3c292a8ad8d44fca9`; 내부 구성 8개·원문 바이트 **8/8 일치**. CMD SHA256 `7f62991a8d50aa5a27bebd37c8d5999a71230eb68716c2f3d6bdf7581d7e5c90`, CLI SHA256 `1dfb2f0101a6406ba6bf7dc8acb8ec8f14cc31fdf02a02afa825ff733b9b6dfe`, source-lock SHA256 `cef975fbfcf0c608144a5d3de9162e0fb05e4ec1aada0b72cba2f5a9328b6ce6`. 관련 소스 단위·패키지 부정 시험 **13/13 PASS**, 기존 총 43건과 합계 **56/56 PASS**. **원본 Windows의 R2 실행·실제 결과는 아직 0건**이다. R2 실행 결과를 받더라도 C 재실행·Claim/Lease 이전은 별도 승인 없이는 금지한다.

### R2 원본 Windows 실행 실패 및 교정된 R3 — 2026-11-10 KST

- 사용자가 `RUN_996_INTERRUPTED_EVIDENCE_R2_ONCE.cmd`의 **실제 원본 Windows 콘솔 사진**을 제출했다. 결과는 `STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE`, 최초 실패 `C_EVIDENCE_SOURCE_FILES_INVALID`, `sourceManifestHashPostcheckVerified=false`, `fullSourceBytePostcheckVerified=false`, `claimProvenanceExternallyPinned=false`, `executionAuthorized=false`; 자체 보고 운영 쓰기/Issue 게시/PC 재시도 **각 0**. 과거 R2 Linux fixture PASS를 Windows 실증 PASS로 바꾸지 않는다. **실패한 R2 CMD 재실행 금지**.
- R2 관측기의 `sourceSet()`이 Controller 파일 개수를 임의로 **최대 30개**로 제한했다. 실제 승인 원본 Git tree SHA `badad9124157879d7a645b64f2768113d632355b`는 `controller/*.mjs` 및 `config/operations.json` **38파일**, Stage 대상 Git tree SHA `9db6fff689c488a59fe8771f013b7c5d3bafc0a8`는 같은 범위 **39파일**이다. 두 트리 모두 `truncated=false`, 파일 경로 regex **38/38·39/39 충족**; Stage에는 `controller/source-inventory-runtime-readonly.mjs` 단 1개 추가됐다. `tools/install.mjs`와 `tools/update.mjs`가 전체 Git source 집합을 host manifest에 기록하는 설계도 확인했다. 따라서 R2의 상한 30은 **검증기 결함**이다. 다만 실물 Windows manifest map의 개별 항목은 실패 시 출력되지 않아 아직 직접 확인되지 않았다.
- 과거 R2 ZIP·source-lock·CMD는 역사적 실패 증거로 **불변 유지**한다. 별도 `controller-996-interrupted-evidence-r3.mjs`에서 원본 **정확히 38**, Stage **정확히 39**를 요구하고, 기존 immutable manifest SHA, 개별 파일 SHA, 형식, stage 추가 파일 금지, 이중 스냅샷 및 lease/claim 보존 검사는 유지한다. 37/40개, 잘못된 확장자, 파일 바이트 변조, metadata drift, 가짜 R1 관측 입력, symlink/추가 모듈, Linux 운영 호출 거부를 시험한다.
- 새로운 **R3 8파일 ZIP**: `artifacts/controller-996/zgmini-996-interrupted-evidence-r3.zip` SHA256 `327c1c189da4f869a4890ea98c210dd48ef938720a511605549bd8cd5e2bd1a3`. ZIP 내부 8/8 소스 일치. R3 CMD `RUN_996_INTERRUPTED_EVIDENCE_R3_ONCE.cmd` SHA256 `056b72c184c16ad65cbc52f223c8ab0258cfb34e5c914fc377fd5877bd8d5d87`, CLI `b481803a4d7a262e809676b57042a213826dba175d92ae1de19fed49bf515414`, source lock `16ea86d400f6f20a11ba9a8d63138bf66b6c4ea849ffadd637b5d2506f8e3af4`. R1/R2 원본과 R3 및 backlog 판정 포함 회귀 **70/70 PASS**. R3 **Windows 실PC 미실행**이며 읽기 전용 한정, 승인/복구/Claim 승계/Lease 이전 권한은 여전히 없음.
- 다음 실행 하나: 사용자가 원본 Windows의 **새 바탕화면 폴더**에 R3 ZIP만 압축 해제하여 **R3 CMD만 한 번** 실행하고 콘솔 반환 화면을 공유한다. 이전 R2/C CMD 재실행, 파일 섞기, 운영 소스·임대 원장 변경 금지. 이후에만 실제 `replays` 원장과 GitHub Issue/Run/JSON/TXT을 교차 대조한다.

### R3 원본 Windows 실증 성공 및 기존 Issue 재계획 판정 — 2026-11-10 KST

- 사용자가 **신규 R3 CMD 단회 실행의 원본 Windows 콘솔 사진**을 제출했다. 반환 `ZGMINI_CONTROLLER_996_INTERRUPTED_EVIDENCE_R3`, `READONLY_EVIDENCE_SNAPSHOT_CONSISTENT`, `C_CLAIM_INDEPENDENT_OWNER_HANDOFF_NOT_APPROVED`. 기존 R2 상한 결함은 실제 승인 설치 파일 **38개**, 목표 Stage **39개**, Maintainer **7개**를 읽음으로써 해소됐다. 전후 manifest 일치 `sourceManifestHashPostcheckVerified=true`, `replayStatusIsNotExecutionProof=true`, `fullSourceBytePostcheckVerified=false`, `claimProvenanceExternallyPinned=false`, `executionAuthorized=false`, 자체 보고 운영 쓰기/Issue 게시/PC 재시도 **0/0/0**. 이는 C급 복구 성공이나 OS 수준 쓰기 추적 증거가 아니다.
- 물리 Backlog SHA256 `4521688c7d9f0cebbf5a71e1ba71713abc4327a5d9a091ea250f0b001ce44186`, 원본 UTC 중단 구간 `2026-11-10T01:06:53.751Z` ~ `2026-11-10T13:21:26.727Z`. **실제 `replayCount=0`, `replayDoneCount=0`, `replaySkippedCount=0`, `replayEntries=[]`**; replay journal SHA256 `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`는 정확한 빈 JSON `{}` digest와 일치한다. 따라서 과거 가정 `replays={}`와 달리 실물 원장의 빈 기록을 확인한 것이다.
- GitHub의 동일 pause window 전체 Issue 목록을 2회 조회해 등록 **11개**, 그중 서로 다른 원본 `pc-job` Issue **4개** [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217) / [#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219) / [#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226) / [#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227)를 재확인했다. 각 Issue+댓글 4/4 직접 조회 결과 **Open/댓글 0**, 기간 내 Actions **277개 고유 실행**, `pc-job.yml` **0개**, 관련 admission **4개 모두 skipped**. 승인된 JSON/TXT 결과쌍 **0/4 검증**, 미확정 **4/4**. 이 4건은 `OWNER_REPLAN_REVIEW_REQUIRED` 후보이며 성공·실패·결과 파일 부재를 확정하지 않는다. 별도 원본 보존 후 기능 원담당이 **새 requestId로만** 재계획한다.
- C Claim의 내부 marker↔owner nonce/승인 manifest 관계와 이전 PID 종료는 R1 14/14 및 R3 교차검사에서 확인했지만, **새 프로세스에 대한 C급 소유권 인계**는 승인되지 않았다. 봉인된 Controller/Stage/Maintainer 바이트가 로컬 원본 manifest와 같음은 확인했으나, 각 파일이 Git의 승인 source commit 바이트와 같다는 독립 `git show` 비교는 미실시했다. 두 가지가 최종 C 실행의 시작 전 필수 검사다.
- **후속 설계 방향:** (1) 별도 승인 manifest에 기존 claim/세 marker/원본 lease/백로그 SHA·R3 증거 및 신규 C source SHA를 고정하고, (2) 실행 시작에 기존 Git SHA 원본 38+39+7개를 실제 파일과 읽기 전용 비교하며 다른 활성 Controller 소유자를 배제한 뒤, (3) 충돌 없이 새로운 고유 continuation claim을 원자적으로 확보하는 **신규 C급 일회성 명세**를 작성한다. 앞서 이미 시도된 Workflow PUT/Backlog close/Issue 재발행은 모두 **0회**; 새 Claim의 바이트 단위 사전검사 후에만 원본 install lease 및 구 C claim을 **삭제 없는 별도 보관** 대상으로 삼고 단계별 postcheck를 수행하도록 설계한다. 중간 크래시 시 기존/신규 claim 보존·수동 재판정이 우선이며 자동 재시도하지 않는다.
- 새 C 실행은 지난 C 동의를 자동 승계하지 않는다. **신규 C급 변경 명세와 소유권 인계에 대한 사용자 승인 전에는 운영 쓰기 0 유지.** 기존 R1/R2/R3/C CMD 재실행 필요 없음. 전체 수명주기 완료율 **4/5 = 80%**로 유지한다.

### 후속 C 단계의 격리 시뮬레이션 (운영 실행기 아님)

- 새로운 `tools/controller-996-continuation-transaction.mjs` 및 `tests/controller-996-continuation-transaction.test.mjs` **소스 전용 후보**를 Draft에 작성한다. 함수의 운영 호출은 무조건 `C_CONTINUATION_PRODUCTION_NOT_APPROVED`로 **PC 접근/쓰기 전에 거부**하고, Linux의 별도 임시 fixture + `testOnly=true`인 경우에만 모의 Claim/디렉터리 보관을 수행한다. CLI, Windows CMD, 사용자 운영 동의 파일은 **없다**.
- 모의 첫 쓰기 전 원본 38개·Stage 39개·Maintainer 7개의 **총 84개** Git mock bytes를 로컬 파일과 직접 대조한다. 새 고유 UUID continuation Claim을 분리한 다음 구 C Claim을 **먼저** 보관하여 기존 Install Lease 잠금을 유지하고, 원본 Install Lease를 **마지막에** 보관하는 순서를 시험했다. 이후 새 continuation Claim 보관/완료를 분리하며 Workflow PUT, Backlog rename, Issue 게시, 원본 요청 재실행은 각 **0건**이다.
- 독립 신규 동의 거부, Git 바이트 불일치, 신규 Claim 취득 후 중단, 구 Claim 보관 직후 중단, Install Lease 보관 직후 중단 및 정상 완료 등 **6/6 모의 시험 통과**, 전체 로컬 회귀 **76/76 PASS**. 원본/구 Claim/신규 Claim을 중간 장애 단계에서 보존하고 자동 재실행하지 않는다. 독립 소스 감사의 판정은 **Draft 소스 전용 게시 GO**, 실제 C 운영은 **NO-GO**다.
- **실제 운영 구현 전 미충족:** (1) 주입식 mock `readLive`/`sourceRead`/동의를 고정된 Git 승인 증거·84파일 실제 `git show`·기존 R1 14/14·현재 GitHub 원본 결과로 교체, (2) 기존 세 marker 내부 `details`의 승인 manifest/ownerNonce/순서 재확인, (3) 보관 대상 경로의 원자적 **no-clobber**, parent directory fsync, 파일 identity CAS/경합 재조회, (4) Claim 취득 이후 각 rename 전에 최신 공통 Writer/Controller 경합·원본 불변 대조와 크래시 회복 시험, (5) 새로운 source-lock과 정확한 C급 사용자 승인. 이 조건을 누락한 시뮬레이션을 복구 도구로 승격하지 않는다.

## 후속 C 단계 설계 (source-only, 실행 금지)

- 단일 후속 복구는 **이미 시도한 Workflow PUT과 backlog rename을 반복하지 않는다.** 다른 상태가 발견되면 먼저 원인을 분리하며 재시도하지 않는다.
- 이미 닫힌 pause window가 원본 C marker와 물리적으로 동일함을 확인한 뒤에만 수정된 순수 disposition planner로 원본 작업을 **읽기 전용** 재분류한다. 댓글만으로 PC 성공을 인정하지 않으며 결과 JSON/TXT와 동일성 대조가 안 된 항목은 작업자 재계획 상태로 남긴다.
- 과거 C claim의 nonce/PID를 새 프로세스가 자신 것처럼 재사용하지 않는다. 별도의 승인된 인계·배타 소유권 명세가 없으면 원본 C claim과 install lease를 둘 다 보존한다.
- 현재 소스와 신규 후속 실행기의 바이트가 달라지므로 이전 사용자 C 동의와 R2 ZIP 서명을 자동 승계하지 않는다. 새 source-lock/배포 바이트/정확한 단계 범위/실행 소유자 승인을 다시 묶어야 한다.
- 원본 C marker, 보호 상태, 원본 결과 조정 및 물리적 postcheck가 모두 일치하는 경우에만 승인된 후속 단계에서 원본 install lease를 **삭제 없는 archive**로 전환하고, 별도의 완료 marker/독립 postcheck 후 새 C claim을 보관한다.
- 실패·경합·불명확한 파일/원격 읽기·ACK 손실은 `STATE_UNKNOWN` 유지. 원본 #996 재요청, 기존 requestId 재발행/자동 replay, 설치 재개, 무조건 unlock/rollback, 새 B 설치·Writer/Core/DB/D1 변경은 금지한다.

## 다음 명시적 Gate

**현재 Gate = 원본 C Claim의 외부 provenance·안전한 소유권 인계, 실물 Backlog replays/결과쌍, 개별 설치 소스 전체 바이트 검증.** 원본 Windows 중단 단계의 14/14 읽기 전용 관측과 GitHub Actions 277개 조회까지 완료했으나, 이 Gate 전에는 신규 C 운영 실행·원본 Lease archive가 **NO-GO**다. 소스 설계·테스트·GitHub 원격 조회는 4/5(80%) 실제 수명주기 완료로 계산하지 않는다.
