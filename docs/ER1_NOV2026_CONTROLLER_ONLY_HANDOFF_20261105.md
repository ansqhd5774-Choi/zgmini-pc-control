# November 2026 ER1 A 진단 — 정확한 유지보수기 인계·Controller 적용

2026-11-05 개발 증거. 실PC Windows 인계·Controller 설치는 아직 **미실행**.

## 설치 구분

1. [PR #414](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/414): A `market-calendar-er1-nov30-availability` 미래-only·cache 집계, main 병합 `96348c...`, Node 6/6 PASS.
2. [PR #416](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/416): 공통 B 유지보수기 `controllerOnlyInstall:true` 지원, main 병합 `289cfda87dfd5d3082d6265f0362d452806127be`, Node 29/29 PASS.
3. 운영 A 설치 후보 target SHA `289cfda87dfd5d3082d6265f0362d452806127be`: `approvals/controller-updates/<target>.json`에 **Controller A 파일 1개만** SHA256으로 승인. 이미 활성인 Workflow 11개 소스 차이는 PC Controller 설치 대상이 아니며, 활성 `pc-job.yml` 변경은 여전히 차단.

## 운영자 1회 필수 단계 — 정규 경로만

기존 독립 유지보수기 자체 교체는 GitHub Actions Runner에서 할 수 없습니다. 공식 `tools/handoff-maintenance.mjs`가 Windows 중간 무결성 일반 사용자 토큰, **GitHub Actions 바깥의 독립 operator**를 요구하며 자동 원격 명령 실행을 명시적으로 금지합니다. 자동 pc-job/pc-maintenance Issue는 해당 handoff를 수행하지 못합니다.

운영자 사전 조건: `E:\ZGmini\projects\zgmini-pc-control`가 `main` 최신 내용, `git status --porcelain` **깨끗함**, 기존 유지보수기 source SHA 실제 조회 결과가 `69c830275bd3fec75b17c8a98c46d689447fb1a7`, 활성 Controller 설치 lease 없음, 기존 수신기 정체성·증명 정상. 어떤 조건도 임의 덮어쓰기/삭제로 맞추지 않습니다.

정확한 정규 명령(CMD, 일반 사용자/관리자 권한 아님, 한 번만):

```cmd
E:\ZGmini\runtime\node.exe E:\ZGmini\projects\zgmini-pc-control\tools\handoff-maintenance.mjs --source-sha 289cfda87dfd5d3082d6265f0362d452806127be
```

기대 결과: `PASS` / `STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED`, 새 유지보수기 source SHA 정확히 `289cfda...`, 새 Receiver 출처·실파일 해시 재조회. 이는 **Controller A 설치 성공이 아닙니다**.

**STOP:** `HANDOFF_INSTALLED_SHA_MISMATCH`, `HANDOFF_CHECKOUT_DIRTY`, `HANDOFF_RECEIVER_*`, `HANDOFF_UPDATE_ACTIVE`, `HANDOFF_SOURCE_HASH_MISMATCH`, 결과 불명확·부분교체·`RECOVERY_REQUIRED`에서는 재실행/임의 복구 금지. 기존 보호·스냅샷·원장을 보존하고 실제 코드/단계를 보고.

## 인계 완료 후 하나의 다음 실행

기존 정규 `pc-maintenance` Issue 7필드 계약으로 `controller-update`를 정확히 한 번 접수합니다. target은 상기 `289cfda...`, raw manifest SHA256은 해당 파일 **현재 GitHub raw bytes**에서 계산하고, 설치 SHA가 실제 `69c830...`인지 요청 직전 확인. 고정 `allowFiles`는 A 소스 한 파일, Core/DB/D1/Writer/provider 쓰기 없음. 결과에서 실제 Controller SHA, 6 fresh Runner, 원본 불변, A 사후 점검을 회수한 뒤 **새** `pc-job` `market-calendar-er1-nov30-availability`를 한 번 실행해 `futureCandidateSymbols`, `futureCachedFileSymbols`, `futureInvalidFileSymbols`, `futureMissingFileSymbols`와 `providerCalls=0/d1Writes=0` 검증.

이번 문서는 실행 지시·완료 표시를 대체하지 않습니다.
