# ZGMINI 독립 기술지원 5차 — 기존 Windows Watchdog 업그레이드·Guardian 보호 사전 분석

**기준:** 2026-11-15 KST · 31차 총괄 [#68/R31](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6882706378) / [PR #1370](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1370) `d01229adacc3c23f50bb119d146e291ff7e15012`.  
**결과 분류:** `SUPPORT_ONLY / SOURCE_CONTRACT_VERIFIED / SYNTHETIC_MODEL / NO_WINDOWS_INSTALL`  
**소유권:** 실제 Watchdog 업그레이드, Guardian/Windows Operator·Runner·권한·B 승인 및 설치는 기존 **단일 운영 Owner/31차 총괄** 담당. 이 지원 보고는 새 승인·운영 명령·STOP/GO Gate가 아님. 기존 29~31차의 #996 복구/Controller 15파일 승인/Watchdog PR #1370 소스 CI는 재실행하지 않음.

## 1. 기준 소스 원문

| 파일/기능 | Git blob | 독립 확인 결과 |
|---|---|---|
| `tools/install-runner-watchdog.mjs` | `588d79847d239f05d975116c6f58fb7e6e4bde37` | `if(fs.existsSync(home))throw Error('EXISTING_WATCHDOG_STOP')`; 최초 INSTALL 기록 `scope:'RUNNER_RECOVERY_ONLY'`; 즉 기존 Watchdog 업그레이드 경로가 아님 |
| `tools/runner-watchdog.mjs` | `aa67452df6f45ebcaa67e75467c9e9cad0d2e198` | 시작 시 `INSTALL.json.sha256`과 현재 **실제 JS bytes의 SHA-256**를 대조. 새 핸드오프 기능은 시작 때 읽은 `installed.scope`가 `RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1`인 경우에만 활성 |
| `tools/runner-watchdog-startup.vbs` | `53b4df603cd1a9dd05619c4e007f5a067839774d` | Guardian은 `shell.Run(command,0,True)`로 자식 종료를 기다림. `PAUSE`는 **후속 기동만 억제**, 이미 실행 중인 Watchdog을 종료하지 않음. 짧은 non-10 종료 3회 누적 시 `GUARDIAN_STOP.txt` 기록 후 종료 |
| `docs/RUNNER_RECOVERY.md` | `049ad85203dd4a19df1a2529f8e5de5e62d0cd96` | 보호받는 Runner 6개·Supervisor·Guardian·Controller에 대해 무분별한 process kill/lease 삭제 금지. 최초 설치기 반복 불가 |
| `docs/PC_OPERATING_SYSTEMS_CANONICAL.md` | `75391c0529c3e3eb9a3ab78f296bbcabecdd06d7` | Windows 사용자 로그인 기반 Startup→Guardian→Watchdog→Supervisor→Runner 6개; 로그인 전/PC 종료 중 자동 실행 보장 안 함 |

위 소스는 [#1370 병합 시점](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/d01229adacc3c23f50bb119d146e291ff7e15012) 기준. 이후 Owner가 더 새 소스를 병합하면 그 **변경된 범위만** 재검증할 것.

## 2. 현재 설계상 설치 경계

**현재 브리지는 소스 main 병합 완료지만 PC 설치 완료가 아니다.** Watchdog `INSTALL.json`의 과거 scope는 `RUNNER_RECOVERY_ONLY`; 새로운 브리지 scope는 `RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1`. 신기능은 실제 프로세스 시작 시 INSTALL 내용을 읽고 활성화 조건을 결정한다.

- 최초 설치기를 재실행하면 `EXISTING_WATCHDOG_STOP`: **업그레이드 아님**
- JS만 새 버전으로 교체하고 INSTALL SHA를 유지하면 다음 시작 때 `WATCHDOG_SOURCE_DRIFT` 가능
- INSTALL의 scope만 바꿔도 이미 실행 중인 watchdog은 자신의 `installed` 스냅샷을 갱신하지 않음
- `PAUSE` 파일만 생성해도 이미 실행 중인 watchdog이 즉시 종료되지는 않음
- 종료된 Watchdog이 오래된 코드·혼합 상태로 짧게 반복 기동하면 Guardian이 3회 non-10 실패 뒤 재기동을 중단할 수 있음
- Git commit SHA, Git blob SHA, `INSTALL.json.sha256`(설치된 JS 원문 SHA-256), Guardian Startup SHA-256은 **서로 다른 값**이다. 해시 종류를 혼용하지 말 것

**검토 결론:** 기존 단일 Owner의 **독립 Windows 업그레이드 실행 프로세스**, 설치본 CAS/원본 보호·Guardian 동작/완료 readback이 필요하다. 별도 설치기를 다시 만드는 것이 아니라 **기존 승인된 독립 Windows B 경로의 실제 업그레이드 지원 여부와 승인 범위**를 구분할 것. 아직 업그레이드 실행기가 없다고 해서 Actions/Runner 자체 교체·원격제어 플러그인으로 우회하지 않는다.

## 3. 단계별 안전 계약 — 설계 지원 (운영 명령 아님)

| 단계 | 해당 Owner가 보존·검증해야 할 조건 | 실패/모호 시 판정 |
|---|---|---|
| WU-01 CAS preimage | 설치 `runner-watchdog.mjs`의 원문 SHA-256, `INSTALL.json` bytes+scope, Startup VBS bytes/ACL, Guardian PID/기동 경로, Watchdog owner PID/nonce/heartbeat, 현재 lease/보호 원본. 원본과 이전 승인 스냅샷 불일치 시 중단 | `PREIMAGE_DRIFT_OR_UNKNOWN` |
| WU-02 복구 원본 | old JS+INSTALL bytes, Startup, ACL, 보호 파일의 별도 검증된 불변 백업 및 실제 rollback 절차. #996 archive 및 Core/DB/D1 불변 범위 분리 | `BACKUP_OR_ROLLBACK_NOT_PROVEN` |
| WU-03 Guardian/Watchdog 경계 | Guardian 재기동 억제 상태와 **실제 기존 Watchdog 종료/기존 owner lease 정합**을 따로 확인. 단순 PAUSE만으로 종료 판정 금지 | `WATCHDOG_NOT_QUIESCED` |
| WU-04 적용/검증 | 승인된 Owner가 정확한 JS bytes/INSTALL metadata 두 항목을 연계해 적용. sourceSha/원문 sha256/scope 혼동 금지, 기존 Startup 임의 교체 금지. 중간 실패 시 성공 판정 금지 | `PARTIAL_UPDATE_UNKNOWN` |
| WU-05 Guardian 재가동 | 기동 전 새 JS SHA-256 vs `INSTALL.json.sha256`, scope, ACL, Guardian Startup bytes, `GUARDIAN_STOP.txt` 상태 및 기존 lease 확인 | `SOURCE_OR_GUARDIAN_DRIFT` |
| WU-06 Fresh postread | 실제 새 Watchdog PID/nonce·heartbeat, 새 scope 인식, Guardian 생존, Runner6/Controller 보호 및 실패 없이 지속적 fresh observation 확보 | `POSTCHECK_PENDING` |
| WU-07 이후 작업 | Watchdog 신규 업그레이드 PASS가 **현장 증거로 확정된 다음에만** 기존 V2 요청·7→7 실제 인계 검토. 그 이후 Controller B 15파일 설치는 별도 | `DOWNSTREAM_NOT_AUTHORIZED` |

표의 단계는 기술적 설계 요건이지 자동 B 승인 체계에 새 요구사항을 추가하는 권한이 아니다. 어떤 Window Operator를 통해 승인·실제 적용할지는 현행 Owner가 확정한다.

## 4. 재사용 가능한 격리 테스트

- [소스 계약·Guardian 경계 및 합성 상태모형](../../tests/support/watchdog-guardian-upgrade-boundaries.test.mjs).
- GitHub 저장 원문 파일 3개와 지원 테스트를 원격 재조회하고 **V8에서 21/21 assertion PASS**.
- 구성: **8개 원본 정적 계약 검증** + 정상 조건 모델 1개 + **12개 실패/불확실성 조합 모델**.
- 모델은 설치하는 코드가 아니라 조건 충족 여부만 가정한 상태 분류 함수. **실제 Node Windows 실행/업그레이드/Guardian STOP·재시작을 수행하지 않았음**. CI 또는 운영 정상성 PASS 아님.

| 실패 주입 | 모델 판정 | 결과 의미 |
|---|---|---|
| 원본·백업·ACL 인증 부족 | `MODEL_PREIMAGE_OR_PROTECTION_MISSING` | 안전 변경 불가 |
| Guardian PAUSE 누락 | `MODEL_GUARDIAN_RELAUNCH_RACE` | 다음 기동 경쟁 가능 |
| 기존 Watchdog 계속 실행/lease 불확정 | `MODEL_OLD_WATCHDOG_STILL_ACTIVE` | PAUSE는 종료 증거 아님 |
| JS 또는 INSTALL만 교체 | `MODEL_PARTIAL_UPDATE_MUST_ROLLBACK_OR_RECONCILE` | 적용 완료 금지 |
| SHA/scope 불일치 | `MODEL_SOURCE_HASH_OR_SCOPE_DRIFT` | 새 기능 활성화 증거 아님 |
| Guardian 재기동 3회 실패 | `MODEL_GUARDIAN_STOP_REQUIRES_OWNER` | 임의 자동 반복 금지 |
| 새 heartbeat·Guardian 보호·old backup 부족 | `MODEL_POSTCHECK_INCOMPLETE` | 독립 실제 증거 미충족 |

## 5. 보호 우선순위 및 다음 필수 행동

1. **기존 Owner에게 필요한 최초 결정 1개:** 이미 승인된 독립 Windows B Operator가 Watchdog 자기 업그레이드·Guardian 중간 무결성·원본 CAS·실패 복원을 지원하는지. 아니면 **운영과 분리된 독립 업데이터의 정확한 범위 및 승인을 먼저 마련**. 이미 소스에 구현한 브리지를 실행하는 것과 그 브리지의 **첫 설치를 실행할 주체**는 다르다.
2. 신규 코드가 실제 설치되는 경우, `RUNNER_RECOVERY_ONLY` → `RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1` 전환과 원본 JS SHA-256/Startup/Guardian 보호가 동일 고유 요청으로 연결돼야 한다.
3. 적용 결과가 없으면 **같은 preflight를 무한 재실행하지 말고**, 본 지원 자료를 재사용하고 W01~W06의 독립 미완료 자료/서비스 계약 지원으로 이동.
4. 이번에 별도로 발견한 [Watchdog ACK replay 결함](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6882839798)은 별도 Owner 패치/검증 대상으로 유지. 이를 Watchdog 업그레이드 범위와 섞지 않음.

## 6. 이번 지원 변경/금지

- **변경:** 지원 전용 브랜치의 회귀 테스트 1파일 + 이 분석 문서 1파일
- **미변경:** 기존 총괄/기능 브랜치, main 소스·승인 파일, 운영 PC, Guardian/Watchdog, Controller, Runner6, SQLite/D1, Cloudflare, 예약
- **사용하지 않음:** 금지 Remote Desktop Commander 및 독립 Windows Operator 가장, live GitHub Runner 자체 인계
- **진행률:** 이번 검토·시험·문서 지원 범위 100%. 31차 Watchdog 실제 설치/7→7/Controller B 운영 단계 성공률 변동 없음.

**판정:** `WATCHDOG_UPGRADE_FIRST_INSTALLER_INAPPLICABLE / GUARDIAN_PAUSE_NOT_STOP / SOURCE_SCOPE_CAS_REQUIRED / SUPPORT_TESTS_21_OF_21 / RUNTIME_NOT_RUN`.
