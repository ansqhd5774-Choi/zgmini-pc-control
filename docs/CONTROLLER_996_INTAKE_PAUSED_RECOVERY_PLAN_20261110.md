# ZGMINI 공통 대기열 도입 — #996 Controller 복구 하위 실행 계획 (Source only)

> **최상위 작업 목표와 우선순위는 [공통 대기열 브랜치 실행 정본](COMMON_QUEUE_ROLLOUT_BRANCH_OBJECTIVE_20261112.md)이다.**
> **목표:** ZGMINI 여러 작업자의 수리 가능한 장애를 공통 `agent-handoff`로 자동 접수하고, 단일 중앙 총괄이 원본 증거 확인 → 실제 해결·회귀 → 검증된 원본 Issue 결과 반환을 수행하여 원담당이 기존 기능 작업을 재개하도록 한다.
> **이 파일과 PR #1222는 그 목표 아래 #996의 `INTAKE_PAUSED`를 복구하기 위한 하위 과제**이며, #996/WinPE/VM 기술 검증을 전체 대기열 운영의 선행 Gate로 삼지 않는다.
> 최신 `main`의 [중앙 인계 정본](AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md)과 [공유 자원 수명주기](SHARED_RESOURCE_LIFECYCLE_V1.md)가 상위 운영 계약이다.

## 현재 실행 순서 — 상위 업무 우선

1. **P0 공통 대기열:** 현재 `agent-handoff` Issue에서 마지막 처리 증거, 원본 Run/JSON/TXT, 수리 가능성과 중복·안전 대기를 판정한다. 유효한 새 사건이 있으면 중앙에서 처리하고 원본에 검증 결과를 반환한다. `OPEN`만으로 미처리 아님.
2. **P1 재사용 가능한 문제 해결:** 확정된 공통 실패에서만 기존 도구·adapter·Runner/Workflow를 수정한다. 새로운 일반챗 자동 수신, 신규 ZIP/CMD·Runner/예약을 완료 조건으로 추가하지 않는다.
3. **DEFERRED 신규 격리 intake:** 자연 발생한 정규 Writer B 수리 가능 실패의 다섯 번째 왕복 증거만 후속 관찰한다. 이전 중앙 8/8·격리 4/5 증거를 혼합하지 않고 인위적 실패를 생성하지 않는다.
4. **별도 C급 #996 복구:** 아래의 상세 승인·보호·단회 복구 계획은 **#996의 경우에만** 유효하다. Owner의 정확한 C 승인과 WinPE/namespace 안전성 미입증인 동안 `C NO-GO`; 원본 PC 변경 0. 그 대기로 다른 정상 기능을 중단하지 않는다.

**진행률 표기:** 기존 중앙 장애 인계 **8/8(그 범위만 완료)**, 신규 격리 Writer B 자동 intake **4/5(80%)**, #996 운영 C복구 **0회/NO-GO**. 전체 ZGMINI 프로세스 또는 #996 복구 자체를 근거 없이 80~100%로 합산하지 않는다. 오래된 아래 단계별 성공 숫자는 당시 source/fixture 증거로만 해석하고, 현재 운영 상태는 원본 PC 실제 등록·Runtime 증거로 판단한다.

---

관측 기준: 2026-11-10 10:36:10 KST, 원본 Windows `automation-status.mjs` 1회.

## 목적과 실제 상태

- Controller #917 복구는 `RECOVERY_COMPLETED`, 독립 22/22 PASS로 이미 완료. #996과 혼동하지 않는다.
- 별도 #996 원본 `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`는 현재 `RECOVERY_REQUIRED/RUNNER_SET_DRIFT`, `FIRST_FAIL=INTAKE_PAUSED`.
- 실제 Controller SHA `badad9124157879d7a645b64f2768113d632355b`; 독립 유지보수기 SHA `16064e29fea0e53e7769a24d93d75b6f5292cfc0`.
- 유지보수기 Receiver `HEALTHY/LISTENING`, install lock held/recoveryRequired, `pc-job` workflow `disabled_manually`.
- 전용 `zgmini-pc-01..06` 6개 + 독립 spare 1개 모두 online/idle. 7개를 6개로 잘못 검사하는 기존 유지보수 소스가 현재 설치되어 있음.
- 원인 수정 [PR #1137](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1137)은 main 병합·4/4 PASS, PC에는 아직 미설치.

## 완료 범위 — 이 Draft

1. `tools/controller-996-intake-candidate.mjs`: **특정 #996 고정 ID와 source에 한정한 순수 읽기 전용 판정/후보 생성**.
2. `tests/controller-996-intake-candidate.test.mjs`: 전용 6개+별도 Runner, 원장 phase, 잠금 owner, stage·backup, 열린 backlog, Workflow, 보호 상태, 원시 해시의 부정 시나리오.
3. 후보의 `approved`와 `executionAuthorized`는 항상 `false`. 코드에 운영 쓰기/복구/네트워크 실행 경로 없음. 임의 7→7 유지보수기 변경, 임의 Controller 설치, 잠금 정리는 수행하지 않음.

## 미완료 실행 계획 — 승인되지 않은 운영 변경

| 순서 | 다음 필수 작업 | 통과 조건 | 담당·경계 |
|---|---|---|---|
| 1 | 원본 Windows 원장·lease owner/marker·stage/backlog·기존 Controller 파일·Supervisor·Core/Korea/Writer 보호 원시 증거를 **읽기 전용** 수집 | 각 원시 바이트 해시와 owner 생존/nonce/원장 시각·중복 복구 claim·기존 버전 무전환 사실 확인 | 공통 C 단일 담당. 키·원본 파일·PID/nonce 채팅 공개 금지 |
| 2 | #996의 `INTAKE_PAUSED`에서만 동작하는 독립 C 실행기와 정확한 승인 계약 구현 | 기존 완료 단계/원장 불변, 원본 Workflow 중단 주체 판정, 재실행 0, 중간 실패 fail-closed, source/owner CAS, 복구 원자 claim, 보호/백로그의 부정 회귀 통과 | **source-only 구현·시험까지**. 기존 `abort-untouched` 또는 `controller-rollback-recovery` 호출 금지 |
| 3 | C 복구 후보 확정 및 **새 사용자 명시 승인** | exact requestId/사전 source/파일 SHA/허용 효과/실패 STOP·되돌림/보관 조건을 사용자에게 제시하고 승인 수신 | 이 Draft나 이전 #917 동의는 #996 실행 권한 아님 |
| 4 | 승인된 원본 Windows에서 **단회** 복구 | 현재 증거 재조회 PASS → 비활성 접수 복원 → 해당 중단 창 원본 Issue idempotent 조정 → 후속 결과 확인 → 원본 lock 전체 보관 | 다른 Runner 우회, 무조건 재신청, DB·D1·Writer·Controller 변경 금지 |
| 5 | 독립 사후 결과 및 기능 인계 | lock 없는 상태·workflow active·Supervisor·전용6 Runner·원본 Issue 완료/보류 목록·보호/운영 source SHA/TXT·JSON 검증 | 이후 별도 [#1220](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1220) 7→7 유지보수기 handoff는 새 정확한 승인 범위로 검토 |

## STOP 기준

- #996 외의 설치 owner/원장 또는 marker가 관측되거나 owner가 생존/불명인 경우.
- Controller 실제 파일이 원본과 다르거나 stage 밖에 전환·백업 흔적이 확인된 경우.
- Workflow 비활성 주체, backlog 일시 중단 창, 원본 Issue 재실행/기존 결과 중복 여부가 불명확한 경우.
- 전용 Runner 누락·중복·오프라인, 보호 Task/Writer drift, 다른 활성 복구 claim·lease 충돌 또는 본 후보 고정 SHA 불일치.
- GitHub Issue/댓글만 있고 원본 Windows 최신 재조회·C 직접 승인·독립 종료 결과가 없는 경우.

이 후보는 복구 성공이 아니다. 전체 공통 실패→중앙 route→verified return→원담당 수신 일반화 실증은 **4/5(80%)**, #917 자체 복구는 **8/8 완료** 상태를 유지한다. 예약 자동 갱신 확인은 기능 완성 이후의 별도 후속이다.

## 2026-11-12 WinPE 후보 및 신뢰시간 판정 — 최신 작업 우선순위

이 절은 위 초기 원본 Windows CMD 단회 복구 계획 이후의 변경된 **후보 설계**를 기록한다. 초기 runbook·과거 승인·CMD가 실제 C급 재실행을 자동 허가하지 않는다. 운영 접근은 차단된 채 source-only 검증만 수행한다.

- 물리적 PC는 **기존 ZGMINI 운영 PC 1대**와 **공통 대기열 PC 1대**로 구분한다. 공통 대기열 PC의 Windows 10/Visual Studio 2026/SDK 네이티브 CNG 시험은 C996_CNG_WINDOWS_TEMP_CRYPTO_PASS_NOT_OWNER_OR_WINPE_PROOF 성공이며, 실제 선택된 WinPE 이미지·원본 E: 파일·승인 공개키·권한·시계를 검증하지 않았다.
- 최신 후보는 **기존 PC WinPE 단일 부팅**을 전제로 old C archive → continuation → install LAST 순서를 고정하고, 서명된 manifest(RSA-PSS SHA256 Salt32)·원본 파일 ID/볼륨·독립 Owner trust anchor·만료/철회 freshness를 조건으로 한다. 이는 실운영 승인이나 부팅 지시가 아니다.
- **서명된 issuedAt/expiresAt은 값의 무결성만 증명**한다. WinPE 오프라인 OS 시각은 변경·회귀 가능하며 신뢰시각이 별도로 없으면 만료 집행이 불가능하다. 부팅 직전 승인 확인 후 발생한 철회도 WinPE 오프라인에서는 탐지 불가. 따라서 offlineClockTrusted=false, ownerApprovalVerified=false, executionAuthorized=false 유지. 근거: https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-setsystemtime 및 https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/client-clock-reverts-to-previous-time.
- 최신 main 공통 지침과 #996 소스 조사 범위에서 **독립 등록된 실제 Owner 공개키/SPKI pin 미확인**. Caller 제공 공개키+지문과 테스트 메모리 RSA 키는 Owner 인증이 아니다. 실제 PC 저장소에 없는 것으로 단정하지 않으며, 접근·추출·새 키 설치는 승인 전 금지.
- boot.wim의 실제 선정 파일·index·SHA256도 미확정(DEFERRED_IMAGE_NOT_SELECTED). 기존 PC 또는 공통 대기열 PC 재부팅, 운영 E: 쓰기, 기존 CMD 재실행, Workflow 변경, backlog disposition 처리 모두 **0건**.

### 다음 최소 순서

1. 공통 대기열 PC에서 이미 준비된 **WinPE boot.wim 실제 파일 경로**를 읽기 전용으로 확인한다. 없으면 이미지 미선정으로 기록. 있다면 DISM Get-ImageInfo로 index 목록→실제 선택 index와 x64 확인, certutil SHA256으로 이미지 식별만 한다. 이는 CNG/원본 E: 실환경 검증이 아니다.
2. 기존 Owner 키를 **독립된 신뢰 등록 경로**에서 확인하고 공개키/SPKI pin만 검증한다. 없으면 신규 독립 trust anchor의 명시적 승인·등록이 먼저다. 테스트키 승격 금지.
3. 승인 철회와 실제 만료를 보장하려면 WinPE **인증된 온라인 시간·철회 재조회** 경로를 검증한다(네트워크 드라이버·TLS·신뢰시각 의존성 포함). 불가능하면 오프라인 단회 C급 실행 **NO-GO**. 물리 승인/nonce가 시간을 대체한다고 주장하지 않는다. 위험 수용과 보장 완화는 새 Owner 명시 결정이 있어야 한다.
4. 실제 WinPE 및 원본 PC 실측·Owner 권한·최종 C급 승인 전까지 C 운영 동작 0건 유지. 최초 상태 모호성 C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID / ORIGINAL_JOB_DISPOSITIONS는 원 ID 보존, 재실행·임의 정리 금지.

**이번 회귀:** 유효한 RSA-PSS 서명이라도 호출자가 과거의 창 안 시각을 공급하면 offlineClockTrusted/ownerApprovalVerified/executionAuthorized가 모두 거짓인 시나리오 추가, 관련 14/14 PASS. **실제 총괄 복구율 4/5 = 80% 유지, C급 NO-GO**.

### 2026-11-11 17:18 기본 ADK 경로 조회 — 공통 대기열 PC

- 사용자 제공 Windows 10 19045.6466 CMD 화면에서 기존 기본 경로의 *.wim 검색은 **지정된 경로를 찾을 수 없습니다**. 이는 기본 ADK WinPE 디렉터리의 부재 관찰이며 PC 전체 WinPE 이미지 부재·WinPE 설치 실패를 입증하지 않는다.
- 최신 main config/operations.json에 공통 대기열 PC WinPE 이미지 조회 A급 operation은 없음. 승인되지 않은 pc-job 인수·원격 shell·별도 Runner workflow로 우회하지 않는다.
- 다음 유효 준비: **공통 대기열 PC에만** Microsoft 공식 ADK Deployment Tools + 동일 버전 WinPE add-on 설치 여부 확인/준비. 2026-11-12 Microsoft 공식 제공 10.1.26100.9457(September 2026)은 Windows 10 포함 대상판으로 게시됨. 공식 출처 https://learn.microsoft.com/en-us/windows-hardware/get-started/adk-install. WinPE 베이스 이미지 Winpe.wim은 Copype 준비 시 새 작업 폴더의 Media/Sources/boot.wim으로 복사된다(https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/copype-command-line-options).
- 설치가 끝나기 전까지 boot.wim 가정/USB 포맷/WinPE 부팅 금지. 설치·이미지 존재는 사용자 직접 화면 또는 해당 PC의 승인된 증거로 확인. Windows 일반 CNG 시험은 WinPE 증거로 승격 금지.
- **실제 총괄 복구 80% 유지, C NO-GO, 운영 PC/E: 영향 0**.


### 2026-11-12 공통 대기열 PC ADK/WinPE 실측 — 권한 경계에서 중단

- PC 식별 PASS: 실제 hostname `DESKTOP-N62L0NG`, Windows 10 Home `10.0.19045` / 64비트. 이번 작업은 공통 대기열 PC에서만 수행했으며 기존 운영 PC 및 `E:\ZGmini`에 접근·변경하지 않음.
- ADK Deployment Tools 및 Windows PE add-on 설치 PASS: Windows Kits 레지스트리의 KitsRoot10을 기준으로 설치 위치를 탐색함. 설치 구성요소 버전은 양쪽 모두 `10.1.26100.9457`.
- 확인한 설치 root: `C:\Program Files (x86)\Windows Kits\10\Assessment and Deployment Kit`. `Deployment Tools\DandISetEnv.bat`, `Windows Preinstallation Environment\copype.cmd`, amd64 DISM/Oscdimg, `Windows Preinstallation Environment\amd64\en-us\winpe.wim` 모두 존재. DISM 파일 버전 `10.0.26100.9457`, Microsoft Authenticode 서명 Valid. 이는 설치 도구의 버전이며 WIM 내부 OS 버전으로 사용하지 않음.
- 기존 일반 CMD의 copype 명령 해석 실패는 설치 누락으로 분류하지 않음. 이 진단 프로세스에만 WinPERoot/DISMRoot/OSCDImgRoot 및 PATH를 설정한 후 `where copype.cmd`가 위 공식 파일을 해석함. 사용자/시스템 환경변수 영구 변경 0.
- 공식 `DandISetEnv.bat` 내용을 확인한 결과 마지막에 `WimMountAdkSetupamd64.exe /repair`가 포함됨. 관리자·드라이버 변경 승인이 없는 현재 단계에서는 해당 BAT를 실행하지 않음. `copype.cmd`에도 read-only WIM mount/unmount가 포함됨.
- 실제 최초 로컬 도구 실패: amd64 ADK DISM의 `/English /Get-WimInfo /WimFile:<설치된 원본 winpe.wim> /Index:1`가 **740 / Elevated permissions are required to run DISM**으로 종료. 세션 관리자 권한 False. 권한 부족 시 중단하라는 사용자 요청에 따라 권한 상승·재시도·이미지 생성 단계는 수행하지 않음.
- 설치된 **원본 winpe.wim만** 읽기 전용 SHA-256 확인: `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`, 크기 **340134390 bytes**. 경로는 위 root의 `Windows Preinstallation Environment\amd64\en-us\winpe.wim`. 이 값은 생성한 boot.wim의 해시가 아니며 실제 선택·승인된 부팅 이미지도 아님.
- 결과: PC/ADK/WinPE 파일 존재 PASS, copype 환경 **경로 해석 PASS·정식 BAT 실행/생성 미실행**, boot.wim 생성 **NOT_RUN_PERMISSION_BLOCKED**, 이미지 index/내부 아키텍처/버전 **UNVERIFIED**. amd64 디렉터리 이름이나 도구 버전을 이미지 메타데이터 검증으로 대체하지 않음.
- 신규 설치/재설치/재부팅/USB 제작/기존 파일 삭제·덮어쓰기/Controller·Runner 중단/Workflow·Backlog·Claim·Lease 변경/C급 실제 복구 **모두 0건**. 운영 PC 변경 **0건**.
- 다음 필수 작업: 공통 대기열 PC에서 승인된 관리자 실행 컨텍스트를 확보한 뒤, 드라이버 repair의 별도 효과를 검토하고 공식 copype를 **새로운 TEMP 작업 경로에 단회** 실행. 성공 후 생성 boot.wim의 DISM index 목록·선택 index·x64·내부 버전·경로·크기·SHA-256을 검증한다. 현재 740은 Windows 권한 경계이며 설치 실패나 WinPE CNG 실패가 아님. WinPE 실제 부팅/CNG·Owner 키·시간/철회 검증과 구분한다.
- **전체 80% 유지 / C NO-GO / executionAuthorized=false**.


### 2026-11-12 WinPE 생성 및 정적 검증 PASS — 사용자 관리자 실행 후 로컬 재대조

이 절은 바로 앞 740 권한 중단 이후의 새 결과이며, 기존 실패 관측은 이력으로 보존한다.

- 사용자 관리자 PowerShell에서 준비된 `C996_WINPE_STATIC_1d65d75de40e4fd18b4f11c0decca065.cmd`를 단회 실행. 공통 대기열 PC hostname `DESKTOP-N62L0NG`를 로컬 재확인하고 실제 산출물·로그를 직접 읽어 대조함.
- 새 작업 폴더: `C:\Users\ansqh\AppData\Local\Temp\C996_WINPE_STATIC_1d65d75de40e4fd18b4f11c0decca065`. 기존 폴더 존재 시 중단하는 실행 계약이며, 시스템/사용자 환경변수 영구 변경·DandISetEnv 드라이버 /repair 호출 없이 프로세스 한정 도구 경로로 **Microsoft 공식 copype amd64**를 실행함.
- `copype.txt`: staging → read-only mount → boot 파일 복사 → unmount → **Successfully staged**. DISM index 목록/선택 index 세부 조회 모두 **The operation completed successfully**. mount 디렉터리의 실제 자식 항목 0개도 확인. 전체 시스템 마운트 상태를 새로 조회한 것은 아님.
- **PC 식별 PASS / ADK PASS / WinPE add-on PASS / copype 실행 환경 PASS / boot.wim 생성 PASS / 정적 검증 PASS**.
- 실제 파일: 위 작업 폴더의 `WinPE_amd64\media\sources\boot.wim`.
- 이미지 index 목록은 **1개(Index 1)**, 선택 index **1**, Name **Microsoft Windows PE (amd64)**, Architecture **x64**, Version **10.0.26100**, ServicePack Build **1**, Edition/Installation **WindowsPE**, 기본 언어 **en-US**.
- 도구 DISM 버전 **10.0.26100.9457**과 이미지 내부 버전 **10.0.26100**을 구분한다. DISM의 이미지 전개 크기 **2,009,251,937 bytes**와 실제 WIM 파일 크기 **340,134,390 bytes**를 구분한다.
- SHA-256: **fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197**. 관리자 실행 certutil 출력과 별도 로컬 Get-FileHash 결과가 일치하며 설치 원본 winpe.wim 해시와도 동일함.
- DISM 원본 필드 **WIM Bootable : No**도 보존한다. 파일명 boot.wim·정적 검증 PASS만으로 실제 부팅 가능성이나 WinPE 부팅 성공을 선언하지 않는다. 해당 메타데이터의 부팅 구성 적합성은 후속 검토 범위이며 이번 작업에서 이미지/BCD를 수정하지 않음.
- 최초 실제 실패 코드는 이전 **740 / 관리자 권한 부족**으로 보존. 이번 관리자 실행의 copype·DISM 2회·certutil은 스크립트의 각 종료코드 검사 통과, `STATIC_IMAGE_VALIDATION=PASS`. WinPE 부팅/CNG **NOT_TESTED**, Owner 인증·신뢰시각·철회 실증 **미완료**.
- 운영 PC 접근·변경 **0건**, 운영 E:\ZGmini 접근/변경 0건. 기존 Controller/Runner 중단, Workflow·Backlog·Claim·Lease 변경, 재부팅·USB/ISO 제작, C급 실제 복구 0건.
- 다음 필수 작업: 선택된 이 이미지의 boot 구성/메타데이터 적합성을 검토하고, Owner trust anchor 및 인증된 시간·철회 조건과 함께 별도 WinPE 부팅·CNG 검증 계획을 확정한다. 재부팅/부팅 미디어 제작/운영 C 효과는 이번 정적 검증의 승인 범위가 아니다.
- **WinPE 정적 준비 완료 / 전체 #996 진행률 80% 유지 / C NO-GO / executionAuthorized=false**.


### 2026-11-12 부팅 파일 정적 검토 및 WinPE CNG 시험 재사용 경계

- 새 WinPE 작업 폴더에서 boot.wim, BIOS BCD/boot.sdi/bootmgr, UEFI bootx64.efi/BCD, bootbins의 bootmgfw.efi/bootmgfw_EX.efi/efisys.bin/efisys_EX.bin/etfsboot.com **11/11 존재**를 읽기 전용으로 확인. 파일 존재가 실제 부팅 성공을 뜻하지 않음.
- bootx64.efi 및 bootmgfw.efi Authenticode Valid, issuer Microsoft Windows Production PCA 2011. bootmgfw_EX.efi Valid, issuer Windows UEFI CA 2023. 공통 대기열 PC에서 검증한 서명 상태일 뿐 실제 부팅 대상의 Secure Boot db/dbx 승인·철회 상태를 증명하지 않음. bootex/부팅 체인 선택 미확정.
- BIOS BCD SHA256 `ba146660b06aedbea6e5892378569507c7c3b9387c7bd06a33d58d0fb7dfaa94`; UEFI BCD SHA256 `877fa52824b660d096aa79263bb150058ea77b1d59f8fc4804ae2fa42708b2a9`. 서로 다른 저장소의 해시를 단순 불일치 실패로 처리하지 않음.
- `bcdedit /store <생성 TEMP의 media\Boot\BCD> /enum all` 단회 읽기 조회 결과 **Access is denied / exit 1**. 기존 DISM 740과 별개의 후속 권한 실패. 내용 미확인으로 BIOS/UEFI ramdisk device/osdevice·boot.sdi 경로·winpe yes·loader 경로·선택 index 연계 PASS는 보류. 권한 상승·시스템 BCD 변경·재시도 없음.
- Microsoft Copype 문서는 작업용 파일 집합 생성과 Winpe.wim→Boot.wim 이름 변경을 설명하며, MakeWinPEMedia를 실제 부팅 미디어 제작 단계로 구분함. /bootex는 2023 CA 서명 부팅 파일 선택 옵션. 이번에는 MakeWinPEMedia, USB/ISO 제작, 부팅 항목 편집, 재부팅을 실행하지 않음. 출처: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/copype-command-line-options 및 https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/makewinpemedia-command-line-options
- 기존 CNG 시험기 소스 검토: `tests/controller-996-cng-windows-temp-harness.c`는 GetComputerNameW로 DESKTOP-N62L0NG를 강제하고 `E:\ZGmini` 존재를 조회함. WinPE 환경으로 승인 없이 그대로 옮기거나 guard를 단순 제거하지 않음. 이번 E: 미접근 요구와 WinPE 런타임 식별 계약에 맞는 **별도 test-only harness**가 필요함.
- WinPE 시험기 설계 조건: 원본 운영 볼륨 경로 조회/열기/쓰기 0, 메모리 내 공개 시험 벡터만 사용, x64/WinPE 환경 식별 및 선택 이미지 provenance 연결, 테스트키는 Owner 키로 승격하지 않음. 유효 RSA-PSS/SHA256/Salt32와 manifest/signature/pin 변조·잘못된 salt/padding 거부를 확인하되 ownerApprovalVerified=false/offlineClockTrusted=false/executionAuthorized=false 유지. 정적 빌드 의존성 검토와 런타임 출력의 의미를 분리. 현재 그 별도 시험기의 구현·컴파일·실제 WinPE 실행은 미수행.
- 다음 필수 작업 1개: 사용자 관리자 컨텍스트에서 **생성 TEMP의 BIOS/UEFI BCD 두 개에 대한 /enum all 읽기만** 완료하고 반환된 경로/플래그를 검토. 로컬 전용 읽기 준비 파일 `C:\Users\ansqh\C996_BCD_READONLY_f9ff26781fd541c7bc0d23aef9164c41.cmd` 생성(미실행), 출력은 새로운 TEMP 폴더에만 저장. 권한 오류 시 자동 재시도·정리 없음.
- 이후 별도 test-only WinPE harness와 부팅 검증 계획을 리뷰하고, 대상 PC·미디어·Secure Boot 체인·운영 볼륨 미접근 보호를 확정한 명시 범위 전에는 부팅하지 않음. Owner trust anchor·신뢰시간/철회 미검증 상태 유지.
- **운영 PC/E: 접근·변경 0, 기존 Controller/Runner/Workflow/Backlog/Claim/Lease 변경 0. WinPE 정적 이미지 PASS 유지, 부팅 적합성 PARTIAL, 실제 WinPE/CNG 미실증. 전체 80% / C NO-GO 유지.**


### 2026-11-12 BIOS/UEFI BCD 관리자 조회 완료 및 바이트 drift 관측

- 사용자 관리자 실행의 실제 로그 폴더 `C:\Users\ansqh\AppData\Local\Temp\C996_BCD_READONLY_89dab58353224693a2e2f9093bf370ed`에서 result.txt, bios-bcd.txt, uefi-bcd.txt를 직접 읽음. `BCD_READONLY_QUERY=PASS`로 두 /enum all 호출 종료코드 검사를 통과.
- 양쪽 {bootmgr} default/displayorder={default}; {default} device/osdevice=`ramdisk=[boot]\sources\boot.wim,{7619dcc8-fafe-11d9-b411-000476eba25f}`, systemroot=\windows, winpe=Yes. ramdisk options는 ramdisksdidevice=boot, ramdisksdipath=\boot\boot.sdi. 실제 media\Boot\boot.sdi 존재 확인. BIOS loader는 \windows\system32\boot\winload.exe, UEFI는 \windows\system32\boot\winload.efi. 이 외부 BCD 출력 자체에는 WIM index 값이 없으므로 내부 boot index와의 실제 부팅 연결을 새로 입증했다고 하지 않음.
- **BCD 표시된 경로/WinPE 플래그 정적 검토 PASS**, 실제 부팅/Secure Boot 승인·CNG는 미실행.
- 별도 사후 해시에서 TEMP BIOS BCD는 `247c0bad51c04adf996977cb9245188d181f833729967762143d4a081af9e7dc`, UEFI BCD는 `3eb6f65e2e6b72d1b99ceeda6aa60523299150f6085be4867b0d351f9f29269f`로 변경됨. 이전 사전 해시는 현재 설치 ADK 원본 BCD 해시와 계속 일치. boot.wim은 `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`로 불변.
- 읽기 전용 바이트 비교: BIOS 632바이트 차이(4096바이트 hive 헤더 밖 579), UEFI 641바이트 차이(헤더 밖 588), 파일 크기 각각 16384 불변. 따라서 **헤더/체크섬만 변경됐다고 단정할 수 없음**. BCD enum 호출의 hive 내부 메타데이터 정규화인지 다른 효과인지, 개별 설정 값 변화 여부는 아직 독립 판별하지 않음. 명령에 /set·/delete·/create는 없었으나 /enum을 바이트 무변경이라고 주장한 보장은 철회한다.
- 원본 ADK 및 TEMP BCD를 덮어쓰거나 복구하지 않고 증거 보존. 시스템 BCD에는 접근하지 않음. 다음 진단은 외부 BCD를 Windows hive API에 다시 로드하지 않는 **오프라인 읽기 전용 파서**로 원본/TEMP의 키·값·보안 메타데이터를 분리 대조하는 것. 원인 확인 전 TEMP BCD 바이트 불변/부팅 준비 완료를 선언하지 않음.
- 후속 WinPE test-only harness의 E: 미접근·시험키/Owner 분리 및 부팅 승인 경계 유지. 운영 PC/E: 접근·변경 0, Workflow/Backlog/Claim/Lease/Runner 변경 0. **전체 80% / C NO-GO**, 정적 이미지 생성 PASS와 BCD 경로 검토 PASS를 보존하고 BCD 무변경성은 UNVERIFIED로 구분.


### 2026-11-12 BCD 오프라인 구조 비교 완료 — 부팅 값 동일, 내부 ACL/메타데이터 차이

- 기존 BCD를 Windows registry/BCD API로 재로드하지 않고 Node 24의 fs.readFileSync/Buffer만 사용하는 한정 hive 파서로 ADK 원본과 TEMP 복사본을 비교함. 신규 TEMP 보고 폴더 외 쓰기 0. 파싱 전후 원본/TEMP 파일 각각 SHA-256 동일 확인.
- BIOS hive 65 keys/45 values, UEFI hive 66 keys/46 values를 순회. 각 key의 class, 값 이름/type/raw data, security descriptor, NK flags/lastWrite/accessBits를 분리 비교. 미지원 big-data/volatile key 또는 범위·서명·개수·순환 오류 시 실패하도록 구현. 이 한정 파서는 범용 포렌식 라이브러리 인증이나 악성 hive 전체 보장을 제공하지 않음. 레이아웃 참고: https://github.com/williballenthin/python-registry/blob/master/Registry/RegistryParse.py
- 양쪽 **ROOT/Objects 이하 모든 key 및 모든 raw 값 동일**. 따라서 기존 bootmgr/loader/ramdisk 설정에 대해 이번 바이트 drift에서 부팅 값 변경은 발견되지 않음.
- 값 변경은 양쪽 모두 **ROOT/Description의 KeyName 1개**. 원본의 24-byte REG_SZ raw data에서 TEMP의 `BCD00000001` UTF-16 문자열로 바뀜. 원본 raw 내용을 정상 문자열이었다고 가정하지 않음.
- 보안 descriptor 차이는 BIOS 55개/UEFI 56개 key. 비교된 unique descriptor pair는 동일: 원본 `O:BAG:BAD:(A;CI;KA;;;SY)(A;CI;KA;;;BA)(A;CI;KR;;;WD)(A;CI;KR;;;RC)S:NO_ACCESS_CONTROL` → TEMP `O:BAG:BAD:(A;;CCSWRPRCWD;;;BA)(A;;KA;;;SY)S:NO_ACCESS_CONTROL`. Owner/Group BA는 유지되고 DACL의 ACE·상속 표시는 실제로 다름. **보안 메타데이터가 바뀐 상태이므로 완전 무변경 또는 단순 체크섬 갱신이라고 주장하지 않음.** 이 차이는 hive 내부 ACL이며 파일시스템 ACL과 구분함.
- NK flags/accessBits/lastWrite 등도 차이가 있음. 관측 패턴은 hive 로딩 시 이름/보안/키 메타데이터 처리가 일어난 가설과 일치하지만, 호출 전후 OS 추적을 수집하지 않았으므로 원인 프로세스를 확정하거나 모든 차이가 무해하다고 선언하지 않음. 원본 ADK/TEMP BCD 복원·재조회·덮어쓰기 없음.
- 파서 확인 **8/8 PASS**: BIOS/UEFI 각각 동일 입력 일치, 메모리 내 winload 경로 1-byte 변조 탐지, 잘린 hive 거부, 실제 원본/TEMP 모든 boot-object raw 값 동일 대조. 대조군 변조는 메모리에서만 수행. Windows hive API를 사용한 독립 2차 파서 검증은 아님.
- 로컬 증거: `C:\Users\ansqh\AppData\Local\Temp\C996_BCD_OFFLINE_0aa219f584804b7cb930176b255a4728\comparison-detailed.json`, SHA256 `a6587baed011ada1d84431655c616898ad763226103784543c0c56d206a2c645`; `parser-checks.json`, SHA256 `83a3daea027a3d44ce4be105c61873f8eaba9d6dc30c5ec50f69d9eee114682d`. 비교 코드 SHA256 `f1f3564f42794ea7928ad55e556c694569785cb436dd55ad02a96088bf6c2f1f`.
- **현재 판정:** WinPE 이미지 정적 생성 PASS, BCD 부팅 값 일치 PASS, BCD byte identity FAIL(의도치 않은 내부 ACL/메타데이터 차이 관측), WinPE 부팅·Secure Boot 대상 호환·CNG NOT_TESTED. 수정/재생성으로 이력을 덮지 않고 현재 TEMP 증거를 보존한다.
- 다음 필수 개발은 기존 일반 Windows harness를 재목적 실행하지 않는 **E: 미접근 WinPE test-only CNG harness 설계/정적 검토**. 실제 부팅 전에 별도 실행 환경 식별, 이미지 provenance, 테스트키/Owner 분리, 시간/철회 경계를 확정한다. USB/ISO 제작·재부팅·기존 PC C 실행은 여전히 승인 범위 밖.
- 운영 PC/E: 접근·변경 0, Controller/Runner/Workflow/Backlog/Claim/Lease 변경 0. **전체 80% / C NO-GO / executionAuthorized=false 유지**.


### 2026-11-12 WinPE 전용 CNG test-only 구현 및 공통 대기열 PC 정적 빌드

- 완료 기준점 `e722fe85aeeffadfc86f016d6bed1b8fe44a0712`의 BCD 오프라인 비교를 재사용. BCD 재조회/수정, WIM 마운트/수정, USB/ISO 생성, 부팅/재부팅 없이 진행.
- 신규 `tools/controller-996-winpe-cng-test.c`: 기존 순수 `controller-996-winpe-cng-handoff-verify.c`를 그대로 include하여 재사용. 기존 Windows harness는 변경/실행/재목적 사용하지 않음. 별도 WinPE 전용 test-only 빌드 매크로와 x64 강제, C operator 매크로 거부.
- 환경 식별은 Microsoft 공식 `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\WinPE` 한 경로에 `RegOpenKeyExW(KEY_QUERY_VALUE | KEY_WOW64_64KEY)`와 RegCloseKey만 사용. 누락/접근 거부/기타 오류는 종료코드 2와 registryStatus로 fail-closed. 컴퓨터 이름/드라이브 열거/운영 볼륨/파일 경로 조회·변경 없음. 존재 마커는 위조 가능하므로 환경 관측일 뿐 부팅 무결성·이미지 provenance·Owner trust 증거 아님. 근거: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/whats-new-in-windows-pe-s14 및 https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regopenkeyexw
- 신규 공개 벡터 header `tests/c996_winpe_cng_public_vectors.h`: 기존 test-only generator로 만든 합성 메모리 RSA 키의 **공개 출력만** 고정. 개인키 생성은 test fixture 프로세스 메모리에 한정되고 내보내거나 Owner 인증키로 등록/승격하지 않음. WinPE EXE에는 키 생성·서명·파일 입력 기능이 없고 내장 공개 벡터만 사용. header SHA256 `2d0af82c0ced9810ea95c141df8397ea77d0bec623b6f40fc06ec57cfba6eb32`.
- 시험 사례 **6개**: 정상 RSA-PSS/SHA256/Salt32 검증, manifest 변조, signature 변조, 공개 blob SHA256 pin 변조, 잘못된 salt(0), PKCS1 padding 거부. 모든 반환에서 ownerApprovalVerified/offlineClockTrusted/executionAuthorized/operationalWrites의 0을 검사하고 결과도 Owner·부팅 무결성·이미지 바인딩·철회 인증으로 승격하지 않음.
- 신규 build-only CMD는 VS Installer vswhere로 VS 2026 [18.0,19.0) x64 C++ 도구를 찾고 별도 새 C: TEMP output에서 빌드. **/W4 /WX /TC /O2 /MT /GS /guard:cf**, link **/MACHINE:X64 /SUBSYSTEM:CONSOLE /DYNAMICBASE /NXCOMPAT /INCREMENTAL:NO**. MFC/ATL/CLR 없음. EXE 실행 명령 없음.
- 실제 host `DESKTOP-N62L0NG`, Visual Studio 2026 Developer Command Prompt **18.12.0**, MSVC dumpbin **14.52.37029.0**. 컴파일·링크 **exit 0**, /WX에서 경고 0. 최초 준비 실패는 vswhere 공백 경로 인용 **exit 1**이며 인용 수정 후 최초 실제 cl 빌드 성공. 실패 이력을 숨기거나 무수정 재시도하지 않음.
- 실제 EXE **148992 bytes**, SHA256 **b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218**. 직접 DLL 의존성 **3개: bcrypt.dll, ADVAPI32.dll, KERNEL32.dll**. MSVCP/VCRUNTIME/UCRT/MFC/ATL 동적 의존성 없음. PE 직접 파싱으로 Machine 0x8664, PE32+ 0x20b, console subsystem 3, CLR descriptor RVA/size=0 검증.
- /MT 정적 CRT 때문에 KERNEL32의 CreateFileW 등 CRT 지원 import가 존재함. **EXE 전체에 파일 API import가 없다고 주장하지 않음**. 시험기/재사용 primitive 소스에는 파일/드라이브 API 호출 및 운영 경로 접근이 없으며 런타임 호출 추적은 미실시. printf/puts 표준 출력은 CRT를 사용함.
- 새 회귀 **11/11 PASS**(소스 경계/내장 벡터 6개/빌드 계약/실제 PE 검사), 기존 관련 회귀 **8 PASS + 1 SKIP**, 합계 **20 tests / 19 PASS / 0 FAIL / 1 SKIP**. SKIP은 non-Windows cc stub 검사(해당 호스트 cc 부재)이며 native x64 MSVC 빌드는 별도로 통과. 기존 vector-generator 시험의 Windows URL.pathname 자식 실행 오류를 fileURLToPath로 최소 수정.
- 소스·시험 파일은 `%TEMP%\zgmini-996-cng-bundle-b9b2dfe5529541b0a89d9f69db658ca3`, EXE/OBJ/build/dependents/imports/headers/sha256/result 및 static-evidence.json은 `%TEMP%\zgmini-996-winpe-cng-build-18624-8721`. 파일을 재생성/다운로드한 다른 EXE의 해시로 이 결과를 대체하지 않음. 원본 순수 verifier 수정 0.
- **실행한 WinPE EXE 0회 / 실제 WinPE CNG 성공 미실증**. 선택된 이미지의 OS DLL/export 실존과 로드 성공·registry marker 관측·6-case 실제 CNG는 다음 승인된 WinPE test-only 런타임 단계에서 확인할 것. 실제 부팅·미디어 생성·선택 boot.wim 변경은 수행하지 않음.
- 운영 PC/E: 접근·변경 0, BCD/WIM 변경 0, Controller/Runner/Workflow/Backlog/Claim/Lease/C급 복구 0. **전체 80% / C NO-GO / Owner 승인·신뢰시간·철회 미검증 유지**.

## 2026-11-12 공통 대기열 PC 테스트 전용 ISO 생성 승인 범위

사용자가 직전 제안(공통 대기열 PC에서 **ISO 생성만**, USB/부팅·원본 운영 PC 변경 없음)에 "계속해라"로 진행을 승인함. **이 승인 범위는 ISO 생성 준비 작업 한정**이며 WinPE 실행, 운영 PC 부팅, C급 원복, Owner 승인/키, Workflow/Backlog, 실제 원본 E: 접근까지 확대하지 않는다. 이 ChatGPT는 공통 대기열 Windows에서 직접 실행할 수 없으므로 해당 PC의 로컬 Codex가 아래 최소 단계를 실제 수행하고 결과를 전달해야 한다. GitHub 문서 등록이 로컬 Codex 실행 또는 자동 전달 증거는 아니다.

1. 호스트 DESKTOP-N62L0NG와 기존 VS/ADK/WinPE 도구 위치, 입력 EXE SHA256 `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218` 확인. 입력이 불일치하면 STOP, 임의 재빌드로 이전 실증 대체 금지.
2. 새로운 **C: 사용자 TEMP 하위** 고유 작업 폴더에 공식 `copype amd64`로 ISO 전용 새 WinPE 작업본을 만든다. 이미 존재하는 이전 작업본·기존 BCD·WIM·원본 ADK를 덮어쓰거나 정리하지 않는다.
3. 작업본의 BIOS/UEFI BCD·boot.wim·boot.sdi 입력 SHA256/파일크기를 보존한다. `bcdedit /store ... /enum`조차 기존 TEMP BCD에 hive 내부 ACL/메타데이터 변화를 일으킨 실측이 있으므로 이번 생성 경로에서 사용하지 않는다. 읽기 전용 오프라인 파서 결과는 재사용, 원인 미확정 드리프트를 무해 판정하지 않는다.
4. 공식 DISM으로 **이번 신규 작업본의 boot.wim만** 명시 인덱스 확인 후 독립 마운트하고, EXE 단일 바이트 그대로 `\Tools\c996_winpe_cng_test.exe`에 추가한다. Startnet.cmd/Winpeshl.ini 자동 실행·드라이버·계정/보안 설정·기존 BCD 값 변경 없음. 마운트 안팎 EXE SHA 동일 확인 후 성공할 때만 `/Unmount-Image /Commit`; 실패 시 임의 `/Discard`/cleanup/재시도하지 않고 정확한 마운트 상태와 원본 해시 기록 후 STOP.
5. 새 작업본에 대해 Microsoft 공식 `MakeWinPEMedia /ISO`로 **ISO 파일만** 별도 신규 C: TEMP 경로에 생성. `/UFD`·Diskpart·USB 포맷·ISO 굽기·부팅 항목 변경·PC 재부팅 금지. `/bootex`는 실제 UEFI/Secure Boot 2023 CA 체인 검증 없이 자동 선택하거나 호환 성공으로 주장하지 않는다.
6. ISO/최종 WIM/내장 EXE의 각 SHA256·크기·DISM 이미지 정보, 신규 BCD 전후 비교, mount 상태, 실행/쓰기 범위를 TXT/JSON에 최소 요약한다. ISO 생성 성공은 **WinPE 런타임·bcrypt.dll 실제 로드·CNG 6/6·Owner 승인·clock/revocation·C급 복구** 중 어떤 것도 PASS로 승격하지 않는다.

공식 근거: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/winpe-mount-and-customize 및 https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/winpe-create-usb-bootable-drive.

**이번 승인에서 허용된 신규 쓰기는 공통 대기열 PC의 새 C: TEMP 작업본/ISO/최소 결과뿐**. 원본 PC/E:·USB·서비스/Runner·GitHub Workflow·원본 Claim/Lease 변경 0. 실제 총괄 #996 복구율 **80%**, C급 **NO-GO** 유지.


### 2026-11-12 테스트 전용 ISO 생성 단회 실제 실행 — WIM reparse 검사에서 STOP

- 위 ISO 승인 절을 그대로 입력 계약으로 사용. host DESKTOP-N62L0NG 재확인, 입력 EXE SHA256 `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218` 일치 후 새 C: 사용자 TEMP 작업 폴더 `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_TEST_ONLY_0cadf11c99594b999cd2b64b553ebc6f`에서만 작업.
- 정상 UAC 경로로 별도 관리자 pwsh 프로세스 시작. 새로운 attempt.started를 CreateNew로 생성하여 동일 스크립트 자동 재실행 거부. 공식 copype amd64 **exit 0**; 신규 WIM index 목록·index 1 상세 DISM **exit 0**; 해당 신규 WIM의 독립 mount **exit 0**.
- 입력 이미지: Index 1, Microsoft Windows PE (amd64), x64, Version 10.0.26100 / ServicePack Build 1, WindowsPE, en-US. 입력 WIM 크기 340134390 bytes, SHA256 `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`. DISM 10.0.26100.9457. WIM Bootable No 필드도 보존.
- **최초 실패 stage=COPY_SINGLE_EXE**, code=`PRECONDITION_OR_SCRIPT_ERROR`, 관리자 스크립트 최종 exit **1**. 원문 `Reparse input rejected: ...\image-mount\Windows\System32\startnet.cmd`. Snapshot 검사가 마운트 내부 파일의 ReparsePoint를 일괄 거부하여 EXE 복사 전에 중단. DISM/복사/ISO 도구 자체 실패로 재분류하지 않음.
- 중단 후 읽기 전용 fsutil query **exit 0**, startnet.cmd Attributes Archive/SparseFile/ReparsePoint, tag **0x80000008**. 공식 MS-FSCC 정의는 IO_REPARSE_TAG_WIM, WIM Mount filter용임. 준비 스크립트가 합법적인 WIM projection과 임의 symlink/junction을 구분하지 못한 과도한 가드가 원인. 단순히 모든 reparse를 허용하는 수정으로 대체하지 않음. 근거: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/c8e77b37-3909-4fe6-a4ea-2b9d423b1ee4
- 실패 시 임의 /Discard·cleanup·재시도 금지 계약을 준수하여 **Unmount/Discard/Commit/MakeWinPEMedia 모두 미실행**, EXE 복사 **0**. 새 ISO **없음**, 최종 수정 WIM **미생성**, 내장 EXE SHA **해당 없음**. 기존 입력 EXE 해시는 유지되며 이를 내장 성공 해시로 기재하지 않음.
- 정확한 잔여 mount: 위 새 폴더의 `image-mount`, Image File `WinPE_amd64\media\sources\boot.wim`, Index **1**, Mounted Read/Write **Yes**, Status **Ok**. 실패 후 DISM /Get-MountedImageInfo 읽기 조회 결과로 확인. 자동 해제하지 않은 활성 mount이므로 새 이미지 작업을 중복 시작하지 않음.
- 입력/증거 보호 사후 재대조: ADK 원본 copype/MakeWinPEMedia/DISM/winpe.wim/BIOS·UEFI BCD 및 기존 TEMP WIM/BCD·입력 EXE **10/10 해시 일치**. 신규 작업본 BIOS/UEFI BCD **2/2 일치**. 신규 boot.wim은 아직 입력 해시와 동일. bcdedit 실행 0. 운영 PC/E:/USB 접근·변경 0, 서비스/Runner/Workflow/Backlog/Claim/Lease 변경 0.
- 이번 로컬 신규 파일/작업: BUILD_TEST_ISO.ps1, attempt.started, result.json, readonly-poststop.json, stop-summary.json, copype/DISM 진단 로그, 신규 WinPE 작업본·scratch·image-mount/iso 폴더. Windows 이미지 작업이 수행하는 DISM 마운트 상태 등록은 승인된 마운트 단계의 결과이며 별도 보안/서비스 설정 변경을 수행하지 않음.
- 결과 보관: 위 새 TEMP의 result.json(최초 실패), failure-mount-status.txt(정확한 활성 mount), INPUT_INDEX_1.txt, readonly-poststop.json(10/10 및 2/2 해시 보호), stop-summary.json. 기존 TEMP 증거 수정/삭제 0.
- 다음 최소 조치는 **실패 상태 보존 후 명시된 mount 후속 처분과 태그 구분 가드 수정의 별도 승인 범위 확인**. 승인 없이 기존 실패 스크립트 재실행, 실패 mount의 /Discard 또는 Commit, 기존 증거 덮어쓰기, 새로운 ISO 재시작을 하지 않음.
- **ISO 생성 미완료 / 실제 부팅·CNG·Owner 승인 검증 0 / 전체 80% / C NO-GO 유지**.


### 2026-11-12 Owner 승인 — 잔여 단일 WIM 해제·가드 보정·신규 ISO 1회

- 사용자에게 다음 작업 범위를 명시한 뒤, 사용자가 이 대화에서 **"승인"**으로 답함: 기존 ISO 실패 작업본의 정확히 한 WIM mount를 사전 재확인 후 `/Discard` 1회 해제, 정상 WIM reparse 태그 검사 오류 최소 수정·회귀, **새 고유 C: TEMP 작업본**에서 ISO-only 1회 신규 시도. 이전 절의 실패 후 `/Discard`/재시도 금지에 대한 **이 한정된 신규 명시 승인**이며 포괄적 PC 시스템/보안 변경 또는 원본 #996 C 복구 승인이 아님.
- **실행 담당/접근:** `DESKTOP-N62L0NG`의 로컬 Codex, 정상 관리자 실행 컨텍스트로만 수행. 이 ChatGPT/GitHub 문서 갱신은 Windows 실행이 아니며 작업 자동 전달·자동 수행을 뜻하지 않음.
- **처분 대상 1개:** `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_TEST_ONLY_0cadf11c99594b999cd2b64b553ebc6f\image-mount`, 이 root의 `WinPE_amd64\media\sources\boot.wim`, DISM **Index 1 / Mounted Read/Write Yes / Status Ok**. 실행 직전 별도 읽기 전용 DISM 전체 mount 목록에서 이 경로와 원본 WIM·index·상태가 정확히 일치하고 중복/기타 mount 영향이 없으며 EXE 복사 0·임의 변경/미기록 파일 0을 입증한다. 보호 입력 10/10, 신규 BCD 2/2, 입력 WIM `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`, EXE `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218`를 대조한다. 하나라도 불일치하면 **STOP, 어떠한 해제도 하지 않음**.
- 모두 일치하는 경우 위 **MountDir 하나만** `DISM /Unmount-Image /MountDir:<정확한 위 경로> /Discard` 단회 수행. `/Commit`, `/Cleanup-Wim`, 다른 mount 해제, 시스템 원본 WIM/ADK/기존 BCD 교체·삭제, 증거 폴더 정리 금지. 사후에는 mount가 사라졌는지, 작업본 WIM·보호 입력 10/10·신규 BCD 2/2 해시와 실패 증거 보존을 확인하고 JSON/TXT 기록.
- **가드 보정:** Windows 로컬 TEMP의 기존 `BUILD_TEST_ISO.ps1` 원본을 보존하고 코드·현재 검사를 직접 읽은 뒤 **별도 신규 준비본**을 수정. DISM의 정확한 WIM mount mapping이 확인된 경계 **안쪽의 WIM-projected 항목**에 한해 `IO_REPARSE_TAG_WIM=0x80000008` 허용. 외부 입력 EXE·목적지 경로·검증되지 않은 경계에는 적용하지 않음. `SYMLINK=0xA000000C`, `MOUNT_POINT=0xA0000003`, 기타/미확인 태그와 경계 이탈은 계속 STOP. 전역 ReparsePoint 검사 제거 금지. 정상·위험 태그 부정 회귀 후 진행.
- **새 ISO 1회:** 앞선 단일 mount 해제와 가드 검증이 PASS인 경우에만 **새 고유 TEMP root와 별도 attempt ID**로 공식 `copype amd64`, 신규 작업본 index1 WIM 마운트, 고정 SHA EXE 1개를 `\Tools\c996_winpe_cng_test.exe`에 복사/내장 SHA 검사, 승인된 성공 시에만 신규 마운트를 `/Commit`, `MakeWinPEMedia /ISO` 1회. 구 작업본 재실행·마커 재사용·오류 시 자동 `/Discard`/정리/재시도 0. 최초 실패 시 원본 증거·mount 상태·input/output SHA를 보존하고 STOP.
- **성공 판정:** ISO SHA256/크기, 수정 WIM·내장 EXE SHA256, DISM index/arch/image metadata, BIOS/UEFI BCD 해시, 신규 mount 종료 및 기존 보호 해시를 확인한 후에만 `ISO_ONLY_PASS`로 표기. 실제 WinPE 부팅, CNG 6사례, Owner 신뢰/서명·offline clock/철회, 최종 #996 C급 복구 성공과 구분. 성공 또는 실패를 작업 후 측정 전까지 선언하지 않음.
- **전면 제외:** 원본 운영 PC, `E:`, USB, 부팅/재부팅, 서비스/Runner, Workflow·Backlog·Claim·Lease, 실제 C급 관리자 복구, 테스트키의 Owner 키 승격. 전체 공통 복구 보고 기준 **80% / C NO-GO** 유지, ISO 결과 도착 뒤에만 진척 변경 검토.
- 근거: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/c8e77b37-3909-4fe6-a4ea-2b9d423b1ee4 및 https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/mount-and-modify-a-windows-image-using-dism.


### 2026-11-12 승인 c74064b 후 가드 보정·단일 해제 준비 실제 결과 — 활성 로그 공유 오류로 STOP

- 사용자 직접 지시 및 승인 커밋 `c74064b35899648313df933c5bcf9f84f7a64d9c` 마지막 절 확인. 최신 main AGENTS/공통 실행 지침 관련 범위를 재확인. 기존 실패 스크립트 재실행 0. 별도 신규 root `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_R2_f7a131b4bb7a4149a854bd0ee3ea7447`에서 가드·회귀·단회 실행 준비.
- 기존 실패 스크립트를 직접 읽고 별도 WIM_READ_GUARD.ps1 구현: CreateFileW(OPEN_REPARSE_POINT, desiredAccess=0) + GetFileInformationByHandleEx(FileAttributeTagInfo)로 대상 자체의 태그 확인. C: 경로와 모든 조상을 검사. 정확한 DISM mapping으로 검증한 mount 내부 **읽기**에서만 WIM=0x80000008 허용; 외부 입력/복사 목적지, symlink=0xA000000C/junction=0xA0000003/unknown 태그는 계속 거부.
- 준비 회귀의 최초 오류: PowerShell의 signed hex literal→UInt32 직접 cast가 범위를 벗어나 exit 1. Convert.ToUInt32(hex,16)로 새 준비본을 수정한 후 **14/14 PASS**: 정상/WIM 읽기, 외부·미검증·목적지 WIM 거부, symlink/junction/unknown/missing-tag 거부, inside/sibling/..escape/root 경계, 실제 startnet WIM 태그 읽기. 이미지 동작 전 개발 검사에서 발견·수정한 오류이며 실제 해제 시도와 구분.
- 새 단회 cleanup-attempt.started 후 관리자 사전 검사: host DESKTOP-N62L0NG, 입력 EXE 고정 SHA 일치, 보호 입력 **10/10**, 기존 실패 작업본 BCD/WIM/boot.sdi **4/4** 해시 일치(BCD 2개 포함). WIM SHA `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`, EXE SHA `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218`.
- **최초 실제 처분 준비 실패:** PRECHECK에서 기존 실패 root 최상위 증거 파일들을 Get-FileHash로 읽던 중 `MOUNT_NEW_WIM.dism.log`가 다른 프로세스에서 사용 중이어서 읽기 공유 오류. 원문 `The process cannot access the file '...\MOUNT_NEW_WIM.dism.log' because it is being used by another process.` 관리자 스크립트 exit **1**, cleanup-result.status=STOPPED, discardAttempts=**0**. HRESULT/정확한 잠금 보유 PID는 이번 출력에서 미수집이므로 특정 Win32 숫자나 주체로 단정하지 않음.
- 준비기가 사용 중인 DISM 로그까지 고정 해시 증거 대상으로 포함해 사전 검사가 막힌 것이며, WIM 내용 손상이나 승인 해제 실패를 입증한 것은 아님. 프로세스 종료·잠금 해제·파일 공유 우회·같은 스크립트 재실행 없음.
- 승인된 “오류/불일치 즉시 STOP”에 따라 **/Discard 0, /Commit 0, WIM baseline 전개 0, 신규 copype/ISO 시도 0**. 별도 BUILD_NEW_ISO_ONCE.ps1 준비본은 구문검사만 했고 실행하지 않음. 기존 root/증거를 삭제·덮어쓰거나 실패 마커를 재사용하지 않음.
- 중단 후 별도 관리자 **읽기 전용** /Get-MountedImageInfo exit **0**. 정확한 잔여 mount는 여전히 `...\C996_ISO_TEST_ONLY_0cadf11c99594b999cd2b64b553ebc6f\image-mount`, Image File 같은 root의 `WinPE_amd64\media\sources\boot.wim`, **Index 1 / RW Yes / Status Ok**. 활성 mount 1개 유지. 전체 파일·미기록 변경 대조 단계에 도달하지 못했으므로 그 조건을 PASS로 선언하지 않음.
- ISO/최종 수정 WIM/내장 EXE **새 산출물 없음**, SHA256 **해당 없음**. 위 두 해시는 입력 식별값일 뿐 새 ISO 성공 증거가 아님.
- 신규 결과: guard-tests.json, cleanup-result.json, poststop-mount-state.txt, poststop-query-result.json, summary.json. guard source SHA256 `9c7e2667c7a03d9c52a9c4a62b650cc2573c27ae3a56bda7504f4b0caf7713ff`; 회귀 결과 SHA256 `27ee855f65d91435d7b9803fd5cc5df793fa999dd3a4d5e6901c7b3356881b04`.
- 다음 필수 작업은 활성 DISM 로그의 잠금/공유 및 증거 보존 계약을 읽기 전용으로 분류하고, **고정 실패 증거와 사용 중 로그를 분리하는 사전검사 보정**을 검토하는 것. 잠금 해제를 이유로 DISM/Runner를 종료하지 않음. 중단 상태에서 승인된 이미지 처분/ISO 단회 경로를 임의 재개하지 않음.
- 운영 PC/E:/USB/부팅/Runner/Workflow/Backlog/Claim/Lease 변경 0. 실제 WinPE/CNG/Owner/시간/철회 검증 0. **전체 80% / C NO-GO 유지**.


### 2026-11-12 PRECHECK 활성 DISM 로그 공유 오류 — 수정 결정 (실행 미확인)

- 원본 실패 실측 `2c9f28dad57206f6725737eadf695d1a3b2087c9`: `MOUNT_NEW_WIM.dism.log` 읽기 공유 오류로 PRECHECK exit 1. `/Discard`/신규 ISO 0회, 기존 mount Index 1/RW/Ok, guard 회귀 14/14 PASS, 고정 보호 10/10·기존 작업본 입력 4/4 PASS. 잠금 보유 프로세스/PID·로그 쓰기 진행 여부는 **UNKNOWN**. 이번 결정은 실제 Windows 실행 결과가 아니다.
- **검증 계약 최소 보정:** 생성 중 변경될 수 있는 `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_TEST_ONLY_0cadf11c99594b999cd2b64b553ebc6f\MOUNT_NEW_WIM.dism.log` **정확히 1파일**만 *변동 운영 로그*로 분류하고 불변 해시 요구에서 제외한다. 로그를 삭제·강제 오픈·잠금 해제하거나 내용/무변경을 PASS라고 주장하지 않는다. 로그의 정확한 경로와 존재·파일 형식·메타데이터·해시 가능/불가 및 원문 오류를 결과에 명시한다. 별도 새 작업의 DISM `/LogPath`는 이전 실패 로그와 겹치지 않는 신규 TEMP 로그로 지정한다. 다른 파일의 해시 읽기 오류는 자동 면제하지 않고 STOP.
- 보호 10/10 + 기존 작업본 입력 4/4 + EXE 고정 SHA, mount→WIM→Index1/RW/Ok, EXE 복사 0/미기록 파일 0/원본 WIM 불변, 기존 attempt·증거 보존, symlink/junction/unknown 태그 차단 등 **기존 필수 보호는 생략하지 않는다**. 파일 목록에서 해당 로그를 제외할 때도 경로가 허용 루트 내부의 **정확한 파일명**인지 검증하고 신규 의심 파일은 여전히 STOP.
- **활성 작업 안전:** `MOUNT_NEW_WIM.dism.log` 잠금만으로 보유자나 WIM 손상을 단정하지 않는다. 실행 직전 읽기 전용 프로세스/서비스 작업 여부와 DISM 현재 mount mapping을 필요한 범위에서 확인한다. 동일 WIM을 실제로 서비스하는 다른 작업이 진행 중이거나 프로세스 소유를 판별할 수 없고 동시 변경 가능성이 남으면 STOP. 잠금 강제 해제·DISM/Runner 종료·전체 cleanup/자동 재실행 금지.
- 원본 `cleanup-attempt.started`를 재사용하지 않고 **새 준비본**에만 검사 수정·집중 회귀와 새 고유 단계 식별자를 적용한다. 기존 사용자 승인은 앞서 정확히 지정한 단일 mount의 `/Discard` 1회 및 별도 신규 ISO-only 1회 범위를 벗어나지 않으며, **실제 0회였다는 점과 새 실행 사전 상태를 입증한 뒤에만** 다음 단계 진행 가능성을 판단한다. 불일치나 도구 접근 불가 시 미실행 유지.
- 실제 성공 후에만 mount gone·고정 해시·입력/ISO·WIM SHA·LogPath 분리 결과를 재확인한다. `/Discard`/ISO/WinPE/Owner 승인 성공은 현재 미확인. 공통 전체 **80% / C NO-GO** 유지.
- 근거: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/deployment-troubleshooting-and-log-files 및 https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/dism-image-management-command-line-options-s14.


### 2026-11-12 로그 1개 제외·진행 작업 판별·회귀 후 실행 준비 — RtBackup 권한 경계에서 STOP

- 최신 사용자 지시와 main 공통 지침, 브랜치 최신 결정(`7616366dd40860387f685f539dab5101d720bb46`), 기존 단일 해제/신규 ISO 승인 `c74064b35899648313df933c5bcf9f84f7a64d9c`을 적용. 기존 실패 스크립트/마커 재실행 없음. 새 단계 식별자 R3/R4를 사용하고 모든 산출물은 신규 C: 사용자 TEMP 아래에 보존.
- 관리자 읽기 전용 관측: 관련 dism.exe/dismhost.exe/oscdimg.exe 등 별도 작업 프로세스 없음. 기존 ADK wimserv.exe PID 2864의 명령행 `wimserv.exe 61b108e2-bee1-491f-a00b-dca70c56c776`를 식별. 5초 2표본 CPU user/kernel time·읽기/쓰기 횟수·전송 바이트가 모두 동일, 지정 로그 4262 bytes/수정 시각도 동일. 실행 직전 추가 3초 카운터 동일 재확인. **이 관측 범위에서 진행 중인 이미지 작업은 확인되지 않음**; 프로세스·드라이버 종료/잠금 해제 없음.
- 제외 대상은 기존 실패 root의 `MOUNT_NEW_WIM.dism.log` 전체 경로 **정확히 1개**뿐. root 최상위 알려진 증거 14개를 allowlist로 확인하고 고정 해시 13개/변동 로그 1개로 분리. 같은 이름의 다른 위치·미기록 파일·다른 읽기 오류는 STOP. 로그 metadata만 보존하고 해시 가능/불가를 새로 강제 시험하거나 무변경 PASS로 표기하지 않음.
- 집중 회귀 **6/6 PASS**: 잠긴 로그 reader 호출 0, 동일 basename 외부 경로 거부, 알려지지 않은 증거 거부, 다른 파일 읽기 오류 거부, 보호 pin 불일치 거부, 정상 pin 허용. 기존 WIM tag/경계 회귀 **14/14 PASS**.
- 보호 입력 **10/10**, 기존 실패 작업본 입력 **4/4**, exact mount→WIM→Index1/RW/Ok 확인 뒤, 별도 새 TEMP baseline-readback에 원본 WIM을 DISM /Apply-Image /Verify /NoRpFix로 전개 **exit 0**. 이는 원본 WIM 읽기 및 새 검증 폴더 생성이지 추가 WIM mount 또는 ISO 시도가 아님.
- R3 파일 전수 대조 중 metadata API가 path-not-found로 STOP. 읽기 전용 진단에서 **실제 존재하는 262자 경로**에 일반 CreateFileW 경로는 Win32 **3**, 동일 경로의 확장 길이 형태는 성공함을 확인. 기존 준비본을 보존하고, 새 R4 준비본에 canonical C: 경로 검증 후 native no-follow metadata API에만 `\\?\` 접두를 적용. 시스템 LongPaths 정책·ACL 변경 없음. 장경로/native 경계 회귀 **2/2 PASS**를 추가하여 **관련 회귀 총 22/22 PASS**. 준비본 문자열 생성 구문 오류도 parser 단계에서 차단·수정했으며 이미지 처분을 실행하지 않은 개발 오류로 보존.
- R4 전수 대조는 **ReadFileAttributeTagInfo 접근 거부**에서 STOP. 추가 관리자 읽기 전용 metadata 진단으로, 원본 검증 전개본과 잔여 mount **각각 20215개 항목**의 metadata를 읽은 뒤 두 경우 모두 **`Windows\System32\LogFiles\WMI\RtBackup` / Win32 5 / Access denied**를 관측. 이 20215는 전체 파일 내용 검증 PASS 수가 아니라 진단 중 읽힌 metadata 항목 수.
- 정확한 경로:
  - baseline: `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_R3_35a4a9f48c7344acaf8dae28eb71181f\baseline-readback\Windows\System32\LogFiles\WMI\RtBackup`
  - mount: `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_TEST_ONLY_0cadf11c99594b999cd2b64b553ebc6f\image-mount\Windows\System32\LogFiles\WMI\RtBackup`
- RtBackup은 승인된 로그 예외가 아님. **추가 제외·TakeOwn·DACL 변경·backup privilege 활성화·오류 무시·강제 열기 없음**. 전체 파일/미기록 변경 0 검증은 미완료이므로 해제 조건 PASS로 승격하지 않음.
- 실제 운영 효과 집계: **/Discard 0회, 신규 ISO 작업 시작 0회, 신규 copype/Commit 0회, USB/부팅/CNG/Owner 검증 0회**. 잔여 단일 mount Index1/RW/Ok는 그대로 보존. 기존 준비본 및 실패 증거 삭제/수정 0.
- 사후 보호 재대조 **23/23 일치**(입력 10개 + 고정 실패 증거 13개). 로그 1개는 지시대로 제외되며 이 숫자에 포함하지 않음. 입력 EXE SHA `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218`, 기존 WIM SHA `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`. ISO/최종 수정 WIM/내장 EXE 신규 SHA는 산출물 미생성으로 해당 없음.
- 최신 증거 root `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_R4_b934fb8dea714fb0bed5a60c8faf4fc7`: cleanup-result.json(STOPPED, discardAttempts=0), guard-tests.json, exact-log-tests.json, longpath-tests.json, metadata-walk-diagnosis.json(정확한 거부 경로/코드), poststop-protected-checks.json(23/23). R3 root의 activity-observation.json 및 BASELINE_READBACK.txt도 보존. ISO 준비본은 구문검사만 했고 실행하지 않음.
- 다음 필수 작업: RtBackup을 포함한 **읽기 권한 경계에서 원본 대비 검증을 완료할 승인된 방법**을 결정. 현재 “지정 로그 1개만 제외” 범위를 확대하거나 권한을 바꾸지 않은 상태에서는 미검증 항목을 생략해 /Discard/ISO로 진행하지 않음.
- **전체 복구율 80% / C NO-GO 유지**. 로그 예외/가드 회귀 성공과 단일 WIM 해제·ISO 생성 성공을 구분. 운영 PC/E:/USB/Runner/Workflow/Backlog/Claim/Lease 변경 0.


### 2026-11-12 RtBackup 대조 가능성 판단 — 공식 DISM 범위와 안전한 최단 경로 (source-only)

- 근거 실행 [f01edfae3f328bea88066bd221896ad034589e68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/f01edfae3f328bea88066bd221896ad034589e68): 읽기 시 동일 Win32 5가 baseline-readback과 기존 mount 양쪽의 `Windows\System32\LogFiles\WMI\RtBackup`에서 관측됨. 나머지 관련 회귀 22/22 PASS, 보호/고정 23/23 해시 동일; /Discard=0, ISO=0. **둘 다 접근 거부는 내용 동일성의 증거가 아니다.**
- 공식 DISM `/List-Image /ImageFile:<WIM> /Index:1`은 **원본 아카이브 파일·폴더 목록만** 반환하고, `/Get-MountedImageInfo`는 **등록된 mount의 경로·WIM·index·RW·상태만** 반환한다. 해당 두 명령으로 마운트의 *미기록 변경 파일 0개* 또는 RtBackup 내부 바이트 동일성을 인증할 수 없다. `/Apply-Image /Verify`는 원본 이미지 전개 성공이며 다른 마운트의 overlay 변경 없음을 증명하지 않는다. 출처: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/dism-image-management-command-line-options-s14 .
- 정상 Microsoft DISM `/Unmount-Image /MountDir:<exact> /Discard`는 **마운트 변경을 WIM 원본에 반영하지 않고 버리는** 공식 절차다(https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/mount-and-modify-a-windows-image-using-dism). 단, 예상치 못한 **마운트 내부 미저장 수정의 유무**와 이 명령의 **격리된 TEMP 원본 보존 효과**는 서로 다른 주장이다. 원본 WIM pre/post SHA 검증은 원본 바이트 보존 증거일 뿐 마운트가 애초 완전히 일치했다는 증명은 아니다.
- **검증 전략 결정:** WinPE TEMP의 모든 보안 제한 경로에 대해 ACL 우회·소유권 취득·특권 활성화·오류 무시·제외 확대를 하지 않는다. 보안 보호 폴더를 반복 순회하는 전수 스캐너 개발도 중단. 마지막 문서 승인 c74064b의 `미기록 변경 0` 사전조건은 미입증 상태이므로 **현재 상태에서 /Discard를 바로 실행하지 않는다**. WIMMount overlay의 미기록 변경 내역을 알려주는 신뢰 가능한 공식 읽기 전용 API나 기록을 실제로 확보할 때만 기존 조건을 통과시킨다. 문서에서 발견하지 못한 비공식 경로를 추정해 PASS 처리하지 않는다.
- **명시적인 대안 결정이 필요한 경우:** 사용자에게 정확히 위 **1개 C: TEMP 실패 WIM mount**에 대해서만 사전 전수 무변경 입증을 **포기하되** 원본 WIM SHA, 올바른 mount 식별/다른 활성 쓰기 없음, 기존 기록·증거 보존 및 `/Discard` 이후 동일 원본 SHA·mount gone을 필수 조건으로 대체하는 선택지를 제시한다. 이는 기존 승인 조건을 바꾸는 것이므로 `계속해라`만으로 자동 확정하지 않는다. 운영 PC·E:·USB·워크플로/Runner/Claim/Lease·C급 실행에는 일절 확장되지 않는다.
- 현 시점 실제 Windows 신규 실행 0, 접수 복원 0, 전체 복구율 **80% / C NO-GO**, 다음 업무 담당은 공통 대기열 PC 로컬 Codex가 **기존 증거의 신뢰 가능한 변경 추적 가능 여부만 읽기 전용으로 판정**하거나 Owner의 위 정확한 TEMP 폐기 승인 변경을 받는 것이다. 동일 실패 도구 반복·중복 마운트 금지.


### 2026-11-12 RtBackup 후속 공식 WIM API 확인 — 기존 해제 조건 미충족

- 사용자 후속 지시는 '계속해라'였으나, 이 문서의 직전 조건 변경안은 전수 무변경 증명을 대신하는 정확한 승인 범위 변경을 요구한다. 이번 확인만으로 실제 /Discard 승인 조건을 충족했다고 승격하지 않는다. 이 GitHub 기록만으로 로컬 Codex가 자동 실행되거나 새 PC 관리자 권한이 발생하지 않는다.
- Microsoft DISM /List-Image는 원본 WIM 아카이브 항목 목록, /Get-MountedImageInfo는 mount 위치·WIM 경로·index·RW·상태를 제공한다. 공식 WIM API WIMGetMountedImageList의 WIM_MOUNT_INFO_LEVEL1에는 WimPath, MountPath, ImageIndex, MountFlags와 Mounted/Mounting/ReadWrite 등 상태 플래그만 있고 미저장 파일의 전수 변경 목록은 없다. 이는 확인된 공식 조회 인터페이스의 한계이며, 모든 내부 overlay 추적 방식이 존재하지 않는다는 증명은 아니다. 자료: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/dism-image-management-command-line-options-s14 및 https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/wim/dd851915(v=msdn.10).
- 이번 단계는 공식 API 계약의 읽기 전용 조사 + 문서 반영만 완료. 기존 Win32 5 보안 경계에 대한 특권/ACL 변경·RtBackup 면제·보호 스캐너 우회 없음. 기존 실측 회귀 22/22 및 보호 고정 해시 23/23 증거 재사용. Windows 신규 작업, /Discard, ISO, 부팅, 원본 PC/E:/USB/Runner/Workflow/Claim/Lease 변경 0.
- 다음 필수 단계: (1) 정확히 지정된 실패 TEMP WIM 하나에 대해 전수 무변경 증명 대신 원본 WIM 보존·정확한 mount 식별·활성 쓰기 부재·해제 사후 검증을 쓰는 조건 변경의 명시적 승인 또는 (2) 기존 승인 조건에 맞는 독립적인 변경 추적 증거 확보. 둘 중 어느 것도 확정되기 전에는 /Discard·ISO 실행하지 않는다. 전체 80% / C NO-GO.


### 2026-11-12 Owner 명시 승인 — 격리 TEMP 단일 mount 폐기 사전조건 한정 변경

- Owner가 직전 대화의 구체적인 승인 요청(해당 TEMP mount 1개의 전수 미기록 변경 0 증명 조건을 원본 WIM 보존 증명으로 대체)에 대해 '승인 계속해라'라고 명시 승인했다. 앞선 c74064b의 승인 대상과 범위는 유지하되, **이 특정 마운트의 폐기 사전조건에 한해서만** 다음 내용을 적용한다. 소스 코드/계획 문서 변경 자체는 실제 관리자 명령 실행 증거가 아니다.
- 대상 PC는 **공통 대기열 PC DESKTOP-N62L0NG** 한 대. 정확한 실패 mount는 `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_TEST_ONLY_0cadf11c99594b999cd2b64b553ebc6f\image-mount`, 연계 WIM은 동일 root의 `WinPE_amd64\media\sources\boot.wim`, **Image Index=1 / Mounted Read-Write=Yes / Status=Ok**. WIM 고정 SHA256 `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`, WinPE 시험 EXE SHA256 `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218`. 값 불일치·마운트 소유자/상태 불명은 즉시 STOP.
- **승인 조건 대체의 정확한 의미:** WIM mount 내부의 `Windows\System32\LogFiles\WMI\RtBackup` 전수 파일 내용 동일성 및 미기록 변경 0 증명을 폐기 사전조건으로 요구하지 않는다. 대신 동일 TEMP root와 WIM의 정밀 식별, 원본 입력/보호 10/10 및 고정 실패 증거 13/13 해시 검증, 이전 실패 로그 보존, 별도 작업의 실시간 DISM/wimserv/관련 이미지 쓰기 **부재 확인**, 이 마운트 외 대상 없음 확인, 원본 WIM 해시 pre/post 동일, DISM mount gone 사후 확인을 필수로 한다. RtBackup에 대한 TakeOwn·ACL/특권 변경·강제 읽기·추가 예외 확대는 여전히 금지. 미기록 변경 0 자체를 PASS했다고 기록하지 않는다.
- **실제 처분:** 위 사전 검사 전부 PASS인 경우에만 정상 관리자 컨텍스트에서 **지정 `/MountDir` 한 개만** `DISM /Unmount-Image /MountDir:<exact approved mount dir> /Discard` **최대 1회**. 다른 mount에 /Discard·/Commit, 전역 `/Cleanup-Wim`, 실패 스크립트/마커 재실행·잠금 강제 해제·프로세스 종료·원본/증거 폴더 삭제 금지. 실행 직전 고유 새 stage marker 및 결과 TXT/JSON 기록; DISM 오류·상태 불명확 시 STOP, 자동 재시도 0.
- **ISO-only 후속:** 단일 /Discard 성공, 마운트 등록 소멸, WIM 및 보호 해시 불변이 확인된 경우에만 별도 새로운 고유 C: 사용자 TEMP root/attempt에 공식 copype amd64→Index1 신규 WIM mount→고정 SHA 시험 EXE 한 개를 `\Tools\c996_winpe_cng_test.exe`로 삽입→내장 SHA 검증→성공 시 새 마운트 /Commit→공식 MakeWinPEMedia /ISO **단회** 생성. 이전 ISO 실패 root의 Build 스크립트/marker 재사용 금지, 선행 guard 회귀 22/22 PASS 증거를 재사용하고 새 루트 대상 매핑만 확인. 실패 시 mount/증거 보존하고 STOP; 추가 자동 /Discard·새로운 재시도 없음.
- **검증/보고:** discardAttempts, ISO attempts, 첫 실패 코드, mount pre/post, 원본 SHA pre/post, 보호 해시, 생성 ISO/WIM/EXE SHA·크기, 이미지 index/x64/버전, BCD 해시, 불변 증거 유지, 신규 TEMP 결과 JSON/TXT를 사후 재조회. ISO_ONLY_PASS는 실제 ISO 생성 및 무결성 증거가 존재할 때만 기록하고 WinPE 부팅·CNG 실행·Owner 키·신뢰시각/철회·#996 운영 C복구 PASS라고 주장하지 않는다.
- **제외/STOP:** 기존 ZGMINI 운영 PC·E:·USB·물리 부팅·시스템 BCD·서비스/Runner·Workflow/Backlog/Claim/Lease·운영 Controller/source 변경 0. 동일 WIM에 다른 실제 진행 중 이미지 쓰기가 관측되거나 구분 불가하면 어떠한 해제도 하지 않는다. C NO-GO/전체 80%는 실제 신규 결과 확인 전 유지. GitHub Issue/PR 댓글만으로 로컬 Codex 실행·자동 인계를 주장하지 않는다.


### 2026-11-12 승인 0bd938c 적용 — 단일 TEMP 폐기 및 신규 ISO_ONLY_PASS 실제 확인

- 적용 승인: `0bd938cff4cecd8ea4f22e57fceb2fc539000a3a` 마지막 절의 폐기 사전조건 한정 변경. **RtBackup 내부 전수 동일성/미기록 변경 0은 이번에도 미입증(false)**으로 유지하고, 승인된 대체 조건인 원본 WIM 보존·정확한 단일 mount·다른 활성 이미지 쓰기 부재·고정 증거 보존·사후 mount gone을 검사함. RtBackup 순회/권한 변경/오류 면제 확대 없음.
- 실제 host DESKTOP-N62L0NG. 새로운 stage root `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7`. 고유 discard-attempt.started를 CreateNew로 생성, 이전 스크립트/마커 재실행 0.
- 처분 직전 보호 입력 **10/10**, 기존 실패 작업본 입력 **4/4**, 고정 실패 증거 **13/13** 해시 일치. 허용된 변동 로그 MOUNT_NEW_WIM.dism.log 1개는 metadata/존재를 기록하고 해시 예외를 유지; 내용을 읽거나 무변경 PASS로 표기하지 않음.
- 관리자 관측에서 기존 wimserv PID2864/정확한 세션 명령행 식별, 3초 간 CPU·I/O 카운터 동일을 처분 직전 2회 확인. 별도 dism/dismhost/oscdimg 등의 추가 작업 없음. DISM 전체 mount 목록은 **정확히 승인 대상 1개**, 원본 경로·WIM·Index1/RW Yes/Status Ok 일치.
- **단일 /Discard 1회, 종료코드 0**. 정확한 대상은 `...\C996_ISO_TEST_ONLY_0cadf11c99594b999cd2b64b553ebc6f\image-mount` 하나뿐. 사후 /Get-MountedImageInfo **exit 0 / No mounted images found**. 원본 WIM SHA256 `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197` 유지, 보호 입력10·작업본입력4·고정증거13 모두 사전/사후 동일. 기존 실패 스크립트·증거 삭제/덮어쓰기 0.
- 폐기 성공 게이트 후 별도 신규 ISO root `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7\ISO_ATTEMPT_187cd12b4d2a4789b9ef549ba9cda886`에서 **ISO pipeline 1회 / MakeWinPEMedia /ISO 1회**. 공식 copype amd64, 입력 index1/x64 조회, 신규 WIM RW mount mapping 검증, 고정 SHA EXE 한 개 복사, 내장 SHA 검증, 성공 시 Commit·해제, 최종 이미지 조회, 공식 /ISO, 신규 BCD/보호 해시·mount gone 검사 **모두 exit 0 또는 assertion 통과**. 자동 재시도/추가 Discard 0. /bootex /UFD /f 사용 0.
- 입력 EXE는 그대로 `\Tools\c996_winpe_cng_test.exe`에 추가. startupBefore/After에서 기존 startnet.cmd 바이트 동일, winpeshl.ini 부재 유지 확인. 드라이버/계정/보안/자동 실행 설정 변경 0. 기존 guard/tag/정확 로그/장경로 **22/22 PASS** 증거와 동일 helper를 재사용했으며 보안 정책/특권 변경 없이 처리.
- **ISO:** root의 `iso\C996_WINPE_CNG_TEST_ONLY.iso`, **399980544 bytes**, SHA256 **63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588**.
- **최종 WIM:** root의 `WinPE_amd64\media\sources\boot.wim`, **341652286 bytes**, SHA256 **e1397e3ea4e49ee08981fc210415b66b534b2358343ce7e985b996df84d17dbe**.
- **내장 EXE:** **148992 bytes**, SHA256 **b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218**. 복사 후 mount 내부에서 직접 해시 비교하여 입력과 일치했고 이후 Commit exit0. 이 내장 해시는 commit 직전 측정한 것이며, commit 후 이미지를 추가 마운트/추출해 재측정한 것은 아님.
- ISO/최종 WIM은 일반 로컬 세션에서 **별도 Get-FileHash 재계산 2/2 일치** 확인. 결과 `ISO_ONLY_PASS.json`, SHA256 `bb6e2104b2fc4b6abca775887357abc1e24200472d099c0b5d931eb9178216b6`.
- 최종 DISM 이미지 정보: **Index1 / Microsoft Windows PE (amd64) / x64 / Version 10.0.26100 / ServicePack Build1**, 펼친 크기 **2009400929 bytes**, directories **3653**, files **17277**. WIM Bootable No 필드는 이전과 동일. **Edition/Installation/ProductType/ProductSuite/Languages가 최종 출력에서 <undefined>로 표시됨**을 보존하며 원인 미확인; 입력의 WindowsPE/en-US를 최종 메타데이터 값으로 복사하지 않음. 이 필드를 자동 수정하거나 이번 ISO를 부팅 호환 PASS로 선언하지 않음.
- 신규 BCD BIOS SHA `ba146660b06aedbea6e5892378569507c7c3b9387c7bd06a33d58d0fb7dfaa94`, UEFI SHA `877fa52824b660d096aa79263bb150058ea77b1d59f8fc4804ae2fa42708b2a9`, **전후 2/2 동일**. 새 boot.sdi 동일, commit 후 WIM은 ISO 생성 전후 동일, 보호 입력10/10 동일. bcdedit 실행 0. 신규 최종 /Get-MountedImageInfo도 **No mounted images found**, mount 잔여 0.
- **이번 승인 실행 최초 실패 코드: 없음(null)**. /Discard·copype·DISM 조회/마운트/Commit·MakeWinPEMedia /ISO는 모두 exit0. 과거 WIM reparse guard/사용 중 로그/장경로3/RtBackup5 실패는 이력으로 그대로 보존하며 성공으로 재분류하지 않음.
- 변경 파일/쓰기 범위: 새 R5 준비 스크립트/검사 결과/진단 로그, 새 ISO 작업본의 **Tools\c996_winpe_cng_test.exe 1개**, 공식 Commit에 따른 신규 WIM, 공식 MakeWinPEMedia의 신규 작업본 EFI bootloader 복사, ISO 파일 및 최소 TXT/JSON. 기존 ADK 원본/기존 TEMP 증거/기존 BCD 변경0. 이전 mount 내부의 미저장 상태는 Owner가 정확히 승인한 /Discard로만 폐기.
- 검증 증거: R5 root의 cleanup-result.json, SINGLE_DISCARD.txt, POST_MOUNT_MAPPING.txt, ISO_ONLY_PASS.json; ISO root의 result.json, FINAL_INDEX_1.txt, MOUNT_STATUS.txt, make-iso.txt, 각 DISM 로그. 준비 스크립트 SHA256: DISCARD_APPROVED_ONCE.ps1 `b1a7b9e70f1116a667e839bc951f8466e2d9d80f651cfba63e2e4142eb7f78db`, BUILD_NEW_ISO_ONCE.ps1 `cc926d5e1eb82b7640187b1ba23cc91eaa51a9ead28372d323238daf1d9fa131`.
- **판정 ISO_ONLY_PASS / 단일 TEMP 해제 PASS / 실제 WinPE 부팅·DLL 로드·CNG·Owner/신뢰시각/철회 검증 미실행**. 다음은 최종 메타데이터의 undefined 표시를 읽기 전용으로 해석하고, 별도 승인된 격리 WinPE 런타임에서 marker·DLL 로드·6개 CNG 사례를 검증하는 것. 이번 ISO 생성 승인을 부팅/운영 C 실행으로 확장하지 않음.
- **전체 복구율 80% / C NO-GO 유지**. 운영 PC/E:/USB/물리 부팅/Runner/Workflow/Backlog/Claim/Lease/Controller 운영 변경 0.


### 2026-11-12 ISO_ONLY_PASS 후 final WIM `<undefined>` 메타데이터 진단 계획 — 읽기 전용

- 원본 증거 `e6afb33699d5ab209c7906fe645a43118d870c61`에서 지정 TEMP mount `/Discard` 정확히 1회 PASS, 후속 ISO-only 단회 PASS, 사후 mounted image 0, 보호/BCD 해시 불변으로 확인. 최종 파일: ISO 399980544 bytes SHA256 `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588`; final WIM 341652286 bytes SHA256 `e1397e3ea4e49ee08981fc210415b66b534b2358343ce7e985b996df84d17dbe`; test EXE 148992 bytes SHA256 `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218` (EXE는 Commit 전 mount 내부에서 확인). 최종 WIM index1/x64/10.0.26100 및 ISO_ONLY_PASS 유지. 이 기록 자체는 다른 컴퓨터의 바이트에 대한 새로운 직접 검증이 아님.
- **새 조사 대상:** 입력 WIM은 `Edition/Installation=WindowsPE`, `Languages=en-US`로 관측됐지만 final WIM의 DISM `/Get-ImageInfo /Index:1`은 `Edition/Installation/ProductType/ProductSuite/Languages=<undefined>`로 보고됐다. 출력만으로 metadata 손상/무해를 단정하지 않는다. HAL 같은 원래 undefined일 수 있는 필드와 **실제로 이전에 값이 있던 필드**를 구별한다. WIM Bootable No도 기존 값 그대로이며 WinPE 실제 부팅 적합성의 PASS는 아니다.
- **로컬 Codex의 단일 다음 작업 (READ ONLY):** (1) 작업 PC `DESKTOP-N62L0NG`와 기존 ISO/final WIM/ADK 원본 WIM의 canonical path, 크기, SHA256을 재확인. 이상 시 STOP. (2) 공식 ADK DISM `/Get-ImageInfo /ImageFile:<...> /Index:1 /English`을 원본 ADK WIM 및 final WIM에 동일 버전/환경으로 각각 다시 실행하되 `/LogPath`는 새 고유 C: TEMP 위치만 사용하고 stdout/stderr와 exit code 보존. 기존 ISO/원본/증거/BCD에 쓰지 않는다. (3) Microsoft WIMGAPI의 `WIMCreateFile` **WIM_GENERIC_READ + WIM_OPEN_EXISTING**, `WIMLoadImage(index1)`, `WIMGetImageInformation`으로 원본과 final의 image-information Unicode XML을 **읽기 전용** 조회한다(가능하면 소스 기반 임시 probe, no write handle/no mount/no WIMSetImageInformation). 필요한 fields `IMAGE/NAME`, `WINDOWS/ARCH`, `VERSION`, `EDITIONID`, `INSTALLATIONTYPE`, `PRODUCTTYPE`, `PRODUCTSUITE`, `LANGUAGES`, `DEFAULT`의 존재/값 비교만 비민감 TXT/JSON 보고; raw 전체 image payload는 공개 업로드하지 않는다. 원본/최종 각각 같은 getter 사용, 반환된 buffer는 LocalFree/handles close.
- WIM XML fields가 final에서 사라지고 input에 존재했다면 `IMAGE_METADATA_DRIFT_CONFIRMED`; XML에는 값이 있는데 DISM에만 undefined이면 `DISM_PRESENTATION_MISMATCH`; 조회 불가 또는 서로 상충하면 `METADATA_STATE_UNKNOWN`. 어느 경우도 ISO/원본 WIM의 자동 메타데이터 repair, 재압축, export/commit, 복구용 set, 파일 덮어쓰기를 수행하지 않는다. 동일 getter 비교 결과만으로 부팅 성공을 주장하지 않는다.
- `ISO_ONLY_PASS` 자체는 이미 고유 실행/해시 근거가 있어 완료로 보존한다. **WinPE 실제 부팅, 시험 EXE의 DLL 로드·6개 CNG 케이스는 미실행**이다. 물리 부팅/USB/VM 설치/승인되지 않은 다른 런타임 테스트는 별도 정확한 환경·허용 경로·복귀·운영 볼륨 미접근의 범위 확정 전 실행하지 않는다. Owner 공개키·인증된 시간/철회 조건은 별도의 C급 운영 NO-GO로 유지한다. 전체 공통 4/5=80% 유지.
- 공식 출처: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/wim/dd834949(v=msdn.10) 및 https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/wim/dd851934(v=msdn.10) 및 https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/dism-image-management-command-line-options-s14 .


### 2026-11-12 WinPE 메타데이터 읽기 전용 실측 — IMAGE_METADATA_DRIFT_CONFIRMED

- 계획 커밋 `956552747a07151bef8804416f1c124ed1473de8`의 마지막 절 실행. 기존 ISO_ONLY_PASS 산출물은 보존하고 새 진단 root `C:\Users\ansqh\AppData\Local\Temp\C996_METADATA_READONLY_d4b2a8fa52b643c6a50ec8891e23beb4`에만 probe/scratch/결과 작성.
- 공통 대기열 host DESKTOP-N62L0NG 재확인. ADK 원본 WIM(340134390 bytes, SHA `fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197`), final WIM(341652286 bytes, SHA `e1397e3ea4e49ee08981fc210415b66b534b2358343ce7e985b996df84d17dbe`), 기존 ISO(399980544 bytes, SHA `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588`) 및 BIOS/UEFI BCD의 사전/사후 **5/5 해시 동일**.
- **동일 ADK DISM 10.0.26100.9457**의 `/English /Get-ImageInfo /ImageFile:<source or final> /Index:1`를 양쪽에 실행, 새 개별 LogPath/scratch 사용. source/final **exit 0/0**. source Edition/Installation=WindowsPE, ProductType=WinNT, ProductSuite=빈 표시, Languages=en-US(Default); final은 5개 모두 <undefined> 재현.
- **동일 공식 ADK WIMGAPI 10.0.26100.9457 (Microsoft 서명 Valid)**를 사용한 별도 동일 getter로 양쪽 조회. WIMCreateFile **WIM_GENERIC_READ 0x80000000 / WIM_OPEN_EXISTING 3 / flags0**, 새 임시 처리 경로, WIMLoadImage index1, WIMGetImageInformation만 호출. write handle·WIMSetImageInformation·mount API 없음. Unicode XML buffer LocalFree 및 image/file WIMCloseHandle은 양쪽 모두 성공(**6/6 cleanup 상태 true**). WIMGAPI getter **2/2 성공**, source/final XML buffer size **2306/1708 bytes**.
- **실제 image-information XML 필드 비교:**

| 필드 / XML 경로 | ADK 원본 | 최종 WIM |
|---|---|---|
| Edition / WINDOWS/EDITIONID | 존재, WindowsPE | **노드 없음** |
| Installation / WINDOWS/INSTALLATIONTYPE | 존재, WindowsPE | **노드 없음** |
| ProductType / WINDOWS/PRODUCTTYPE | 존재, WinNT | **노드 없음** |
| ProductSuite / WINDOWS/PRODUCTSUITE | **빈 요소로 존재** | **노드 없음** |
| Languages / WINDOWS/LANGUAGES | 존재, LANGUAGE=en-US·DEFAULT=en-US | **부모 노드 없음** |
| DEFAULT / WINDOWS/LANGUAGES/DEFAULT | 존재, en-US | **노드 없음** |

- 추가 XML 차이: VERSION/BRANCH 원본 ge_release 존재, final 노드 없음. NAME=Microsoft Windows PE (amd64), ARCH=9(DISM x64), VERSION 숫자 **MAJOR10/MINOR0/BUILD26100/SPBUILD1/SPLEVEL0**는 동일. 원본의 빈 ProductSuite 요소와 최종 요소 부재를 같은 값으로 처리하지 않음.
- **판정 IMAGE_METADATA_DRIFT_CONFIRMED:** 최종 WIM의 **정보 XML 자체에서** 원본의 필드들이 사라졌고 DISM 출력과 일치하므로 DISM_PRESENTATION_MISMATCH가 아님. 조회 성공/동일 getter/원본·최종 필드 존재를 확보했으므로 전체 판정을 METADATA_STATE_UNKNOWN으로 남기지 않음. 단, **정확한 소실 원인·단계는 미확정**이며 Commit/DISM 특정 결함으로 단정하지 않음. 파일시스템·내부 Windows 레지스트리 payload 손실/부팅 실패 또는 무해성의 증거로 확대하지 않음.
- **실행 최초 실패 코드 없음(null)**. DISM source/final 0/0, WIMGAPI source/final success/success. 메타데이터 drift는 진단 결과이지 읽기 API 실행 실패를 감춘 PASS가 아님.
- 추적 결과: `artifacts/controller-996/zgmini-996-wim-metadata-readonly-20261112.json` 및 같은 이름 TXT. JSON은 요청된 필드/선택 XML 조각·정확한 source/final 식별값·코드/메모리 해제·사전/사후 SHA만 포함. **전체 image-information XML은 로컬에만 보존하고 GitHub에 업로드하지 않음**. 로컬 JSON SHA256 `1de1c955a4a08d554d3de6b57d29836f40b9475b9dd8e5406f9d002157843b6c`, TXT SHA256 `9b5bac9f28eda78ed1e14a75ed3892c5f9ae76539f846a0713e71298aef17445`.
- 임시 probe READ_WIM_METADATA.ps1 SHA256 `a808269f275fcc00c80fe5d13bee913008c2c1cb377ac396031806ec0a8e9792`. WIMGAPI 이미지 정보 getter 명세: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/wim/dd834949(v=msdn.10) ; read-only open 명세: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/wim/dd851934(v=msdn.10) .
- 새 WIM mount/ISO·WIM·BCD 수정/자동 repair/export/recommit/재생성/USB/부팅 **0**. 기존 ISO_ONLY_PASS는 생성·해시 범위로 그대로 보존. WinPE 실제 DLL 로드/CNG 6사례/Owner 승인/신뢰시각/철회는 미검증.
- 다음 필수 작업: 기존 빌드·Commit 로그와 공식 metadata 처리 계약을 **읽기 전용으로 조사하여 소실 발생 경로와 보존 전략을 검토**. 보존 필드 복사/자동 복구/새 이미지 제작은 이번 진단 승인에 포함되지 않으며 수행하지 않음.
- **전체 80% / C NO-GO 유지**. 운영 PC/E:/USB/Runner/Workflow/Backlog/Claim/Lease 변경 0. 이번 GitHub 최소 변경은 계획 문서 1개와 비민감 결과 TXT/JSON 2개뿐.


### 2026-11-12 Codex 사용량 초과 대응 — XML drift 원인 분석과 증거 한계 (GitHub-only)

- **접근/실행:** 사용자 보고상 Codex 사용량 한도 초과로 새 PC 로컬 Codex에 추가 지시/실행 불가. 본 ChatGPT가 연결된 GitHub 커밋 `42ac6611eb45c36038f0a2c97c0f20ea35e05395`의 실제 JSON/TXT/계획을 직접 대조했다. 원격 Desktop Commander 등록 PC는 현재 OFFLINE이며 이것을 공통 대기열 PC와 동일하다고 가정하지 않았다. 로컬 TEMP의 Commit 원문 로그를 **읽거나 실행하지 못했다**. GitHub의 성공 기록과 원본 PC 직접 실행을 구분한다.
- **기존 사실 재사용:** 원본 WIM image-information XML buffer 2306 bytes, 최종 1708 bytes(차이 -598). ADK WIMGAPI 동일 read-only getter 2/2와 동일 DISM 2/2 결과가 일치. 원본 WINDOWS/EDITIONID=WindowsPE, INSTALLATIONTYPE=WindowsPE, PRODUCTTYPE=WinNT, 빈 PRODUCTSUITE 노드, LANGUAGES LANGUAGE/DEFAULT=en-US, VERSION/BRANCH=ge_release가 최종 XML에는 없음. NAME, ARCH=9, numeric VERSION은 동일. `IMAGE_METADATA_DRIFT_CONFIRMED`; DISM 출력 문제만은 아니다.
- **인과관계 보수적 판정:** 최종 WIM이 ISO 생성 전후 같은 SHA였다는 기존 기록은 **ISO-only 제작 단계에서 호스트측 최종 WIM 파일이 변경되지 않았음**을 지지한다. ISO 안에 실제 내장된 WIM을 독립 추출한 검증은 아직 없다. 메타데이터 소실이 초기 copype 직후 이미 발생했는지, 신규 mount 후/EXE 복사 후 변화인지, DISM `/Commit` 중 변경됐는지는 **중간 상태 XML 측정이 없어 불명확**하다. Commit에 귀속하거나 특정 Microsoft 버그라고 주장하지 않는다.
- **읽기 전용 로그 조사 우선순위(가능할 때만):** 기존 ISO R5 root의 `result.json`, mount/Commit 관련 별도 DISM `.log`, `FINAL_INDEX_1.txt`, `make-iso.txt`, 새 메타데이터 비교 JSON/TXT를 원본 보존한 채 시간·실제 명령·exit·로그에 기록된 메타데이터 처리 이벤트로 단계별 대응시킨다. 핵심 최초 확인 대상은 `copype` 직후 입력 WIM과 ISO pipeline `/Mount-Image` 직전/직후, `/Unmount-Image /Commit` 직후 및 `/ISO` 직전의 **기존에 이미 기록된** ImageInfo/XML 존재 여부다. 해당 시점 기록이 없으면 `STAGE_UNKNOWN`으로 남긴다. 최근 로그 부재를 추정값으로 메우지 않는다.
- **가능 원인 구분 (모두 가설):** (A) copype의 read-only mount/unmount 및 staging 중 metadata 정규화, (B) 신규 DISM mount/commit의 image XML 갱신, (C) ISO-only 스크립트가 이미지 정보에 관여하는 별도 명령을 호출, (D) 판정/로그가 다른 WIM 또는 index를 가리키는 대상 불일치. 위 (D)는 고정 SHA·index1 기록 때문에 가능성이 낮아 보이나, 하위 명령 입력 경로로 재확인하기 전 배제하지 않는다. B를 공식 동작/결함으로 확정하지 않는다.
- **다음 필수 실행의 최소 단위:** 현재는 GitHub에 포함되지 않은 **기존 로컬 Commit/DISM 로그의 읽기 전용 회수** 또는 승인된 로컬 실행 연결 확보가 필요하다. 모든 중간 단계가 기록되지 않았다면 추가 실험은 별도 격리 TEMP에서 원본과 매 단계 XML/SHA를 관측하는 재현 설계를 먼저 검토한다(현재 재실험/새 ISO/원본 WIM 수정은 승인하지 않음). 전체 XML 원문이나 키·시스템 원본 자료를 GitHub/채팅에 올리지 않고 필드 유무·요약·파일 해시/시각과 실패 코드만 최소 공개한다.
- **현 상태:** ISO_ONLY_PASS(기존 실행의 ISO 생성·해시)는 유지하되 `IMAGE_METADATA_DRIFT_CONFIRMED`, `ROOT_CAUSE_STAGE_UNKNOWN`, `WINPE_RUNTIME_NOT_TESTED`. 실제 부팅·CNG 6/6·신뢰 Owner 키·시간/철회·C급 복구는 전혀 검증되지 않음. 새 PC 추가 실행 0, WIM/ISO/BCD/운영 PC/E:/USB/Runner/Workflow/Claim/Lease 변경 0. 공통 자동 인계 실증 진행률 4/5=80%, C NO-GO.


### 2026-11-12 GitHub+CMD 실행 경로 복귀 — Codex 비의존 구조 확인

- 사용자 확인: Codex는 사용 가능한 사용량이 있을 때 쓴 **선택적 실행 도구**였으며, 기존 ZGMINI 작업의 기본은 **GitHub 승인 요청 → Windows CMD/고정 Runner → TXT·JSON 결과 회수**였다. Codex 한도 초과 자체는 원인 분석이나 GitHub 작업을 중단하는 BLOCKER가 아니다.
- 최신 main 실제 점검: `AGENTS.md`, `docs/GENERAL_CHAT_START.md`, `docs/PC_AUTOMATION_STANDARD.md`, `README.md`, `config/operations.json`, `.github/workflows/pc-job.yml`, `controller/entry.mjs`, 원본 유지보수 Issue #996. 기존 `pc-job`은 Issue `pc-job` 라벨, Windows self-hosted `zgmini-pc-control`, **고정 E:\ZGmini\runtime\node.exe 및 E:\ZGmini\automation\pc-control**을 호출한다. 허용목록에는 **공통 대기열 PC DESKTOP-N62L0NG의 C996 R5 TEMP Commit/DISM 로그 수집 A급 operation이 없다**. #996 원본은 `pc-maintenance` C 복구 미완료 상태이며, 과거 실제 `pc-job` workflow disabled 관측을 성공한 현재 접수로 간주하지 않는다.
- 따라서 원래 운영 PC의 `pc-job`에 임의 CMD나 source 경로를 넣거나, 타 PC blog Runner 등을 재목적 사용하거나, `pc-job` workflow를 복구 명목으로 활성화하지 않는다. 원본 #996 C 복구·운영 E:와 별개의 **공통 대기열 PC 읽기 전용 진단**이다. GitHub 문서나 Issue에 CMD를 적은 것만으로 로컬 실행/원격 전달을 주장하지 않는다.
- **가장 짧은 다음 작업:** (1) GitHub 브랜치에 이미 승인된 `C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7/ISO_ATTEMPT_187cd12b4d2a4789b9ef549ba9cda886` 로컬 R5의 `result.json`, `FINAL_INDEX_1.txt`, `make-iso.txt`, **기존 DISM mount/Commit 로그**의 경로와 해시만 고정한 **소스 전용 읽기 전용 CMD/Node 회수기**를 준비한다. (2) 코드 자체는 고정 host/path/파일명, 기존 입력 SHA pre/post, no-follow·경로 탈출 차단, 로그 내부 비밀/전체 raw 내용 업로드 차단, 32KiB 이하 최소 phase/event summary TXT·JSON, 출력을 같은 PC 사용자 TEMP에만 새로 기록하는 방식이다. (3) 새 PC에서 **이미 승인·설치된 실제 실행/반환 경로**가 확인될 때만 1회 실행한다; 미설치라면 이를 명확히 `AUTOMATION_BLOCKED`로 보고하고 별도 임의 Runner 설치/유료 실행/원격 shell 우회는 하지 않는다. 수동 실행이 반드시 필요해진 경우 검증된 다운로드 가능한 단일 CMD 패키지만 제공한다.
- GitHub에 이미 있는 JSON/TXT로 판단한 `IMAGE_METADATA_DRIFT_CONFIRMED`는 유지. 새 로그가 Commit 전/후 XML 스냅샷을 실제 보유하면 해당 최초 drift stage를 좁히고, 없으면 `ROOT_CAUSE_STAGE_UNKNOWN`으로 남긴다. 자체 재현/원본 WIM metadata repair/ISO 재생성/WinPE 부팅/운영 PC 변경은 이 준비 범위 밖이다.
- 완료 기준: 고유 실행 ID, 대상 PC, 실제 파일 SHA, 최초 실패 코드, Commit 시간/결과, 단계별 metadata 기록 유무, TXT·JSON을 **실제 원격 재조회**한 뒤에만 `CMD_LOG_EVIDENCE_RECEIVED` 표시. `ISO_ONLY_PASS`  유지, WinPE/CNG 실행 미완료, 전체 80% / C NO-GO.


### 2026-11-12 R5 GitHub+CMD 단회 로그 회수기 구현 — Source-only 검증

- 기존 main의 허용목록에는 `DESKTOP-N62L0NG` R5 WinPE Commit/DISM TEMP 로그를 읽는 A급 operation이 없음. 운영 E: 경로의 `pc-job`/중단된 workflow를 새 PC 진단에 재목적 사용하지 않고 **별도 source-only 도구**를 구현.
- 구현 파일 `tools/c996-r5-evidence-readonly.mjs`, `tools/RUN_C996_R5_READONLY.cmd`, `tests/c996-r5-evidence-readonly.test.mjs`. 대상 호스트 `DESKTOP-N62L0NG` 및 R5 root `C:\Users\ansqh\AppData\Local\Temp\C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7\ISO_ATTEMPT_187cd12b4d2a4789b9ef549ba9cda886` 고정. 커맨드 인수·임의 실행·운영 E:·USB·WIM mount/commit/ISO 생성 없음.
- ADK 원본 WIM·R5 최종 WIM·ISO·BIOS/UEFI BCD **5개**에 대해 알려진 크기·SHA-256 사전/사후 동일 여부 확인. R5/ISO stage 및 지정 `logs` 하위의 `.dism.log`/고정 DISM 로그 이름만 제한적으로 열람. 관련 TXT/JSON은 존재·크기·SHA만 집계. symlink/junction 경로 차단, 로그 입·출력 SHA 불변, 로그 원문/민감 경로 공개 금지, 파일 수/크기 및 결과 최대 32KiB 제한.
- 반환은 새 사용자 TEMP의 `C996_R5_READONLY_<UUID>\summary.json`와 `summary.txt`만. Commmit/마운트/메타데이터/실패 이벤트는 **코드·횟수·시각(있을 때)**만 내보내고 실제 log line을 공유하지 않음. 기존 XML 필드 차이는 `IMAGE_METADATA_DRIFT_CONFIRMED`, **정확한 발생 구간은 계속 `UNKNOWN`**으로 처리. 로그가 없으면 PARTIAL·exit2, 해시/권한/경로 불일치 시 STOPPED·exit2, 자동 재실행 없음.
- 해당 Node 소스의 최종 Git blob SHA `85c8fe399882e0e09a02469a186975a3703fd311`을 ZIP 내부 스크립트와 로컬 `git hash-object`가 **정확히 일치**함을 확인. 컨테이너 Node 22 `node --check` 성공, 순수 회귀 **11/11 PASS**, 비Windows 호스트 강제 STOP(입력/출력 변경 없음) 확인. **이는 실제 Windows R5 로그 실행·원격 증거 회수 PASS가 아니다.**
- 별도 전달용 고정 ZIP `ZGMINI_C996_R5_Readonly_CMD.zip`, 6267 bytes, SHA256 `1ca835345543cebac3d541a1d7ca6e424a8c1cacea245eff338d8f400af9ff00`. 기존 공통 PC용 자동 회수 operation이 없어 자동 전달은 현재 `AUTOMATION_BLOCKED`. 다른 Runner 임의 실행/재설치 금지. 필요한 경우 **대상 공통 대기열 PC에서만** ZIP을 풀고 CMD 1회 실행하는 예외 경로를 제공하며 결과 파일 2개 또는 승인된 보고 경로에서 회수.
- 현재 산출물: GitHub 소스와 독립 테스트+ZIP 준비 완료. **Windows 실행 0 / 원격 TXT·JSON 회수 0**. 기존 ISO_ONLY_PASS 보존, metadata drift 확인, stage 미확정. 전체 공통 진행률 **80% / C NO-GO** 및 운영 PC/E:/USB/Runner/Workflow/Claim/Lease 변경 0.


### 2026-11-12 수동 CMD 파일 발견 실패 정정 — GitHub 표준 자동 회수로 전환

- 사용자 실측: 앞서 제공된 `ZGMINI_C996_R5_Readonly_CMD.zip`의 `RUN_C996_R5_READONLY.cmd` 실행 창이 곧바로 닫혔고, 사용자는 결과 파일을 찾을 수 없었다. **실제 해당 1회 실행 결과는 STATE_UNKNOWN**이며, 사용자의 조작 문제로 간주하지 않는다.
- 실패 구조: 과거 CMD는 `where node.exe` 의존, 종료코드 반환 후 즉시 창 종료(`pause`/상태 표시/Explorer/자동 게시 없음). 출력은 일회성 `%TEMP%\C996_R5_READONLY_<UUID>\summary.json/.txt`였고 GitHub 결과 자동 업로드가 **없었다**. 이전 source 회귀 11/11 PASS는 Windows 실제 완료나 파일 반환 성공을 뜻하지 않는다.
- GitHub `main`의 `docs/GENERAL_CHAT_START.md`·`docs/PC_AUTOMATION_STANDARD.md`·`docs/SUCCESS_EVIDENCE_REUSE.md`, 대표 A 실제 성공 #882를 다시 대조. 정본은 고유 Issue/requestId → 승인된 고정 Windows Runner/operation → GitHub 결과 JSON/TXT **2/2 원격 동일바이트 확인** → 실제 status/code 판정. 사용자에게 매번 임시 파일 찾아 전달하도록 요구하지 않는다.
- **정정:** 기존 `tools/RUN_C996_R5_READONLY.cmd`는 브랜치 commit `6f1788cf10490388cd8efa0ff1946bf0cf580686`에서 **deprecated/즉시 STOP + 창 유지**로 변경. 기존에 다운로드된 ZIP 안 CMD가 자동으로 갱신되는 것은 아니므로 **그 ZIP 재실행 금지**. 원본 R5 성공 ISO/WIM/BCD, 로컬 이전 실행 결과 및 증거를 삭제·초기화하지 않는다.
- 새 독립 브랜치 `fix/c996-queue-r5-readonly-github-20261112`, **Draft PR #1237**. GitHub `issues.opened` + 전용 `pc-c996-r5-readonly` 라벨 + 고정 JSON schema/owner/private 확인 + `zgmini-handoff-ci-isolated` self-hosted Windows Runner 후보. Node 도구는 PC hostname **DESKTOP-N62L0NG**가 일치하지 않으면 WIM/ISO/로그 접근 없이 BLOCKED. 읽기 요약 32KiB 제한; `results/c996-r5-<runId>-<attempt>.json/.txt` 고유 파일에 자동 게시하고 GET readback 2/2 후에만 원본 Issue 댓글로 결과 연결. 자동 재실행·원문 로그 업로드 없음.
- **실행 게이트:** 해당 Runner가 **실제로 DESKTOP-N62L0NG에 등록됐다는 증거는 아직 없음**. PR #1237는 main 미병합, 이번 PR CI [Run #43097205808](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43097205808)는 확인 시 `queued`·판정 미확정. 이 단계에서 고유 A Issue를 만들면 main의 수신 workflow가 없어 접수되지 않을 수 있으므로 새 요청은 생성하지 않음. `main` 실제 배포와 Runner 호스트/실제 수행을 구분한다.
- **완료 기준:** PR Source CI PASS, 호스트/label 실제 등록·접수 가능 상태 확인 → 새 유일 Issue 1개 제출 → 실제 Windows JSON/TXT 2/2 원격 재조회 → Commit/DISM 로그를 단계별 분석. 실행이 불가하면 `AUTOMATION_BLOCKED`로 보고하고 기존 CMD·동일 고유 요청을 무조건 재실행하지 않는다. C 운영 복구는 승인된 별도 정규 C 경로만 사용.
- 현재 추가 실제 WIM/ISO/BCD 실행 0, 운영 PC/E:/USB/Runner/Workflow/Backlog/Claim/Lease 변경 0. 기존 `ISO_ONLY_PASS` 및 `IMAGE_METADATA_DRIFT_CONFIRMED`, root-cause `STAGE_UNKNOWN`, 공통 자동 인계 실증 4/5=80%, C NO-GO 유지.


### 2026-11-12 고정 GitHub Issue 단회 요청 #1238 — CLI 없는 표준 자동 회수 등록

- 이전 임시 ZIP/CMD 방식은 즉시 창이 닫히고 임의 TEMP 결과를 수동으로 찾아야 했으며 실제 자동 결과 전송 경로도 없어서 **사용 중지**. 기존 출력/실행의 결과는 `STATE_UNKNOWN`으로 보존하고 다시 실행하거나 삭제하지 않는다.
- 기존 증거 재사용: 사용자가 지정·확인한 독립 `zgmini-handoff-ci-spare-01` / label `zgmini-handoff-ci-isolated`는 공통 대기열 PC `DESKTOP-N62L0NG`용이다. 이는 과거 호스트 지정 증거이며 **이번 현재 Runner 온라인·할당·실제 작업 성공 증거는 별도**다.
- 신규 단회 GitHub용 source PR [#1237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1237)을 **`main`에 squash 병합**: `7895604bee3de8e8d32ccfa65578a6799d6d5e28`. 등록 소스 `c996-r5-readonly/collector.mjs`, `github-runner.mjs`, `.github/workflows/pc-c996-r5-readonly.yml`, source 테스트 2개. source Node collector 11/11 PASS, 최신 직접 평가된 순수 JS 검증 35/35 PASS. **Windows 전체 CI** Run [#43098346998](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43098346998)은 마지막 조회에서 `queued`, job 0. 이는 테스트 통과도 Runtime 실패도 아니다.
- 고정 Issue 이벤트는 **정확한 제목** `pc-c996-r5-readonly` 및 owner/private/body `ZGMINI_C996_R5_READONLY_REQUEST_V1`/`operation=c996-r5-commit-log-readonly`/`host=DESKTOP-N62L0NG`/고유 UUID를 동시에 검증하므로 새로운 label 등록이나 임의 `pc-job` CMD 주입을 요구하지 않는다. 기존 self-hosted isolated Runner만 실행 가능, 실제 host 불일치면 WIM 미접근 `BLOCKED`.
- 원본 사용자 계정으로 생성된 [Issue #1238](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1238), requestId **`a66d9e6d-17dd-43cf-bedb-8f56a336cadf`** 단 1건 제출 및 정확한 schema/host/issue 사용자 readback 확인. **이 요청만 추적**, timeout·Runner offline에서 동일 요청 재생성/새 UUID 제출·임의 커맨드 우회 금지.
- 실행 성공 시 결과는 main `results/c996-r5-<runId>-<attempt>.json/.txt` **2/2 GET 동일바이트 검증 후** Issue #1238 bot 결과 댓글이 생성돼야 한다. 콜렉터는 기존 ADK WIM·final WIM·ISO·BCD 2개 사전/사후 SHA 5/5와 기존 Commit 로그의 비민감 이벤트 수만 읽는다. 실측 첫 실패 코드/호스트/원본 SHA를 JSON/TXT로 재조회하고 그때만 발생 stage 범위를 좁힌다.
- 현재 Issue #1238 **댓글 0개**, Runner Job 실행 결과 미수신; `CMD_LOG_EVIDENCE_RECEIVED` 미표시. 원본 `/Discard` 1회·`ISO_ONLY_PASS` 성과 보존, `IMAGE_METADATA_DRIFT_CONFIRMED`, `ROOT_CAUSE_STAGE_UNKNOWN`, C NO-GO, 자동 인계 **4/5=80%**. 새 운영 PC/E:/USB/Runner/Controller/Workflow/Backlog/Claim/Lease 변경 0.


### 2026-11-12 GitHub CMD 자동 회수 실PC 확인 — C: Runner TEMP 및 접근 제한

- 이전 사용자가 직접 찾지 못한 수동 ZIP/CMD는 **deprecated**, 신규 사용 금지. 기존 GitHub 경로의 원본 실행기 `zgmini-handoff-ci-spare-01`에서 단회 Issue가 실제 실행돼 bot JSON/TXT 원격 확인을 달성함. CODEX가 없어도 진행 가능한 정상 GitHub→고정 Windows Runner→보고 구조 확인.
- [#1238](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1238), Run `43098701158`, 원격 2/2: `BLOCKED/RESULT_DIRECTORY_NOT_REPORTED`, 내부 초기 STOP 코드 누락. [PR #1239](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1239) `main` 병합 SHA `56ee8fc48c999afab94a09e8125ea728d0a7014d`에서 제한된 오류 코드만 전송하도록 수정.
- [#1240](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1240), Run `43100052135`, 원격 JSON/TXT 2/2: `BLOCKED/TEMP_ROOT_MISMATCH`, host `DESKTOP-N62L0NG`. 원본 WIM/ISO/BCD는 원래 사용자 TEMP C: 경로에 있지만 isolated Runner의 OS TEMP가 별도임을 확인. 파일 원본 경로를 바꾸거나 복구하지 않음.
- [PR #1241](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1241) `main` squash SHA `bafc1e0f069160f5b2e5c7823f40bb21aa39b8b2`: **입력 경로·원본 해시 고정**, 신규 출력만 Runner OS의 안전한 C: TEMP에 저장하고 결과 회수는 부모 경로·이름·realpath를 확인. Windows source CI Run [#43100573449](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43100573449): **24/24 PASS**, host `C996_QUEUE_HOST_MATCH=TRUE`.
- [#1242](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1242) Run `43100756953` GitHub 원격 JSON/TXT 2/2: **STOPPED/EPERM**, hash `0/5`, log `0`, 원본/운영 변경 보고값 0. Runner 계정이 어느 고정 입력의 메타데이터/내용 읽기에서 거부되는지 당시 결과에는 없으므로 접근제한 경계는 그대로 보존한다.
- [PR #1244](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1244) `main` squash SHA `4be57c66c8eb1dbec6745bbc1318472d168a9974`: 실패 시 **고정 검사 단계·입력 ID만** 반환해 접근 거부 위치를 정확히 한정. 실제 Windows source CI [#43101250255](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43101250255): **25/25 PASS**, host TRUE. 파일 경로/로그 원문·사용자 정보 비공개, ACL 변경/특권 우회/Runner 프로세스 종료 0.
- 새 고유 단회 읽기 요청 [#1246](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1246), requestId `0c26f9b8-70b6-4aeb-a073-6dfa8c1e91c7` 제출. 기존 #1238/#1240/#1242는 중복 재실행하지 않음. 정확한 `inspectStep`/`inspectId` 및 `status/code`를 JSON/TXT 원격 재조회하면 소실 원인 분석을 재개하거나 PC 계정 접근 경계로 `BLOCKED`를 구분한다. 해당 단계가 자동 게시되기 전에는 결과를 추측하지 않는다.
- CNG 시험 ISO 원본 `ISO_ONLY_PASS`, WIM `IMAGE_METADATA_DRIFT_CONFIRMED`, 정확한 drift 시점 `ROOT_CAUSE_STAGE_UNKNOWN`, WinPE 실부팅/CNG NOT_TESTED, 전체 4/5=80% 및 C NO-GO 보존. 운영 PC/E:/USB/Controller·Runner·Workflow·Claim·Lease 변경 0.


### 2026-11-12 R5 GitHub CMD 단회 실측 — 최종 WIM EPERM 접근 경계 확인

- [Issue #1246](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1246), requestId `0c26f9b8-70b6-4aeb-a073-6dfa8c1e91c7`, Actions Run `43101568043`를 단회 실행해 sanitized JSON/TXT **2/2**를 원격 재조회했다. result: `STOPPED/EPERM`, `inspectStep=PRE_INPUT_HASH`, `inspectId=FINAL_WIM`, `pinCount=0/5`, `logCount=0`, `operationalWrites=0`. 원본 ADK WIM의 사전 해시는 반복문 흐름상 선행 통과했으나 `validatePins()`의 전체 배열 할당 전에 최종 WIM 접근에서 예외가 발생하여 게시된 pinCount는 0이다. 따라서 검증 1/5 성공이라고 재분류하거나 5/5 PASS라 주장하지 않는다.
- 범위는 **공통 대기열 PC `DESKTOP-N62L0NG`의 격리 R5 `WinPE_amd64\media\sources\boot.wim`** 읽기다. `EPERM`이 최종 WIM 파일 자체 ACL·상위 폴더 접근·공유 위반/핸들 상태 중 정확히 어느 지점에서 발생했는지는 입증되지 않았다. 원래 사용자 `%TEMP%`와 GitHub Runner TEMP가 별도임은 앞선 #1240 `TEMP_ROOT_MISMATCH`로 확인됐으며, 두 실행 계정이 다르다고 단정할 증거는 없다.
- [PR #1244](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1244) `main` SHA `4be57c66c8eb1dbec6745bbc1318472d168a9974`는 고정 파일 ID와 단계만 보고하도록 변경했고 별도 Windows CI Run [#43101250255](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43101250255) **25/25 PASS**. 이번 실제 `#1246` 수신은 권한 우회·파일 재생성 없이 해당 진단이 기능함을 확인하는 것으로 한정한다.
- **현재 구체적 차단 조건:** `FINAL_WIM`에 대한 격리 Runner 읽기 접근 거부가 실제 R5 Commit/DISM 로그 수집을 차단했다. 완료된 WinPE ISO 자체 `ISO_ONLY_PASS`와 XML drift 확인은 보존하되, 소실 정확한 단계는 `ROOT_CAUSE_STAGE_UNKNOWN`. 추가 SHA/ACL 면제·TakeOwn·권한 상승·계정 변경·파일 복제·잠금 해제·반복 자동 요청으로 해결했다고 주장하지 않는다.
- **다음 필수 실행:** 원본 `FINAL_WIM`의 파일·상위 폴더 접근 실패가 Windows 접근 제어인지, 별도의 이미지 파일 점유·관리용 reparse/파일 상태인지 **기존 승인된 동일 PC 읽기 전용 메타데이터 경로로 최소 검증**. 이 단계에 실제 승인·설치된 독립 실행 경로가 없으면 `AUTOMATION_BLOCKED`로 분류하고, 임의 Windows shell/권한 우회로 진행하지 않는다. 보호된 R5의 기존 로그가 제공되지 않는 한 Commit 원인 시점 `UNKNOWN`을 유지한다.
- 원본 고유 요청 #1238/#1240/#1242/#1246 재실행 **0회**; 더 이상의 반복 Issue 생성 없음. 운영 PC/E:/USB/Runner/Workflow/Backlog/Claim/Lease 변경 0. 공통 자동 인계 전체 4/5=80%, C NO-GO 유지.


### 2026-11-12 FINAL_WIM EPERM 세부 단계 실PC 확인 — 추가 동일 Runner 실행 중단

- 실측 출발점: [#1246](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1246), `PRE_INPUT_HASH/FINAL_WIM/EPERM`. 기존 read-only `statNoLink()`는 `fs.lstatSync(full-leaf-path)`부터 시작해 상위 디렉터리를 순회하고 마지막 leaf 재조회 이후에 `fs.createReadStream()`을 호출한다. 기존 결과만으로 **lstat 작업 vs 스트림 바이트 읽기** 구분이 되지 않았음.
- [PR #1251](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1251) `main` squash SHA `f726d7ddd910baad373851b369846df1e69ef8e8`: 기존 no-follow·reparse·해시 사전/사후 검사를 **변경 없이**, 실패 증거에 `inspectOperation` 고정 enum (`PATH_LSTAT`,`LEAF_RECHECK`,`STREAM_READ`,`HASH_COMPLETE`)과 0..24 상대 깊이만 추가. 원본 경로·ACL·원문 로그는 게시 안 함. 격리 Windows CI [#43102856308](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43102856308): **27/27 PASS**, host TRUE. 제한된 모의시험은 PATH_LSTAT depth 0/2/5에서 각 EPERM을 해당 위치에 보존.
- 단회 요청 [Issue #1252](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1252) requestId `d67f288d-3ac7-4acc-a652-56643b4f6e11`, Run **`43103166518`**, 결과 `results/c996-r5-43103166518-1.json/.txt` **GitHub 원격 2/2 재조회**. 실측: `host=DESKTOP-N62L0NG`, `status=STOPPED`, `code=EPERM`, `inspectStep=PRE_INPUT_HASH`, `inspectId=FINAL_WIM`, `inspectOperation=PATH_LSTAT`, `inspectDepth=0`, `pinCount=0/5`, `logCount=0`, `operationalWrites=0`, `automaticRetries=0`.
- **정확한 결론:** 기존 코드의 **첫 번째 `fs.lstatSync(전체 FINAL_WIM 경로)`가 EPERM**을 반환했다. 그 이후 상위 디렉터리 명시 순회나 `createReadStream()` 단계에 도달했다는 증거가 없다. 이는 *파일 metadata 조회 API 호출*의 실패를 정확히 식별한 것이며, Windows 내부 경로 탐색·파일 자체 ACL·보호 플래그·핸들/필터 드라이버 중 어떤 원인이 되는지의 확정은 아님. Windows Node.js의 lstat가 제한적 파일 권한에서 EPERM을 반환하는 유사 사례는 https://github.com/nodejs/node/issues/35853 에 있으나 이번 파일과의 동일 원인 입증은 아님.
- 사용자 직접 관리자로 만든 ISO/WIM 해시 및 ISO_ONLY_PASS는 앞선 `e6afb336` 관측 범위에서 보존. 현재 독립 격리 Runner가 동일 FINAL_WIM metadata를 읽지 못하므로, **이 Runner에서 그 파일에 대한 추가 hash/reparse 우회·TakeOwn·ACL/권한 변경·계정 전환·우회 CLI·파일 복제·반복 Issue 요청을 진행하지 않는다.** 기존 유효한 로컬 사용자 결과를 현재 Runner `EPERM` 때문에 무효로 만들지 않는다.
- **남은 필수 업무:** 해당 R5 WIM/Commit 로그의 사용자가 승인한 **동일 접근 권한의 기존 실행 경로**가 이미 존재하는지 근거 확인, 또는 이미 GitHub에 보존된 진단 증거만으로 메타데이터 drift의 발생 구간에 관측값이 있는지 추가 확인. 원본 사용자 계정 경로에 접근할 수 없는 Runner를 재목적화하지 않는다. 다른 안전하고 승인된 조회 주체가 실제 등록되지 않았다면 이 *로그 직접 회수* 단계만 `AUTOMATION_BLOCKED`로 기록. WIM XML 소실 사실 `IMAGE_METADATA_DRIFT_CONFIRMED` 및 정확한 소실 단계 `ROOT_CAUSE_STAGE_UNKNOWN`은 유지.
- 사용자 수동 ZIP 재실행 요구 0, 운영 PC/E:/USB·Controller·Runner·Workflow·Claim·Lease, 물리 부팅·재ISO/원본 WIM 수정 0. 전체 공통 자동 인계 실증 진행률 **4/5=80% / C NO-GO** 유지.


### 2026-11-12 격리 WinPE 런타임 후보 환경 — 기존 Host Inventory 실PC 6경로 확인

- 기존 공통 대기열 PC `DESKTOP-N62L0NG`의 별도 런타임 후보 확인을 위해 **기존 `pc-host-inventory-readonly` 수집기**만 확장. 새로운 기능별 CMD/전용 Runner/예약 설치 없음. PR [#1257](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1257) `main` merge SHA `c7639a2e8b2b449998f97c657ce9cec83c2a5601`; 고정 C: 표준 경로 `fs.lstatSync` 존재 상태만 조회. 기존 2 PC role admission, owner/private, Runner labels, JSON/TXT atomic upload 계약 유지.
- 격리 Windows source CI [#43105968261](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43105968261) **7/7 PASS**; 관련 source CI [#43105968224](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43105968224) **27/27 PASS**. 첫 시험 Run #43105583324의 테스트 ID 정규식 실패는 신규 VM 식별자 `X64`를 검사 코드가 허용하지 않은 테스트 문제였으며 한 줄 수정하고 후속 두 CI를 실PC 재검증; 실제 파일 변조/VM 실행 실패가 아님.
- 새 유일 request [Issue #1259](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1259), requestId `b729d658-90f4-4219-9970-88b16a0f391c`, Run `43106256782`, 고정 self-hosted `zgmini-handoff-ci-spare-01` / `DESKTOP-N62L0NG`. JSON `results/pc-host-inventory-43106256782-1-handoff.json`와 TXT 동명 `.txt` **GitHub 원격 GET 2/2** 확인. 결과 `PASS/READONLY_HOST_INVENTORY_COLLECTED`, `operationalWrites=0`, `automaticRetries=0`.
- 6개 후보 **모두 `ABSENT_AT_FIXED_PATH`**: `VIRTUALBOX`, `QEMU`, `VMWARE_WORKSTATION_X64`, `VMWARE_WORKSTATION_X86`, `VMWARE_PLAYER`, `HYPERV_CONNECT`. 이것은 `C:\Program Files`와 `C:\Windows\System32`의 **검사한 고정 6경로에 설치 파일이 없다는 관측**만 의미한다. portable/다른 경로 프로그램은 `NOT_CHECKED`, CPU/BIOS VT-x·펌웨어·가속 엔진 사용 가능성 `NOT_CHECKED`, 실제 부팅 `NOT_EXECUTED`. Windows 10 Home x64/Intel i5-7300HQ, 총 RAM 16301MiB, 당시 가용 5183MiB 확인은 호스트 상황 참고치이지 VM 실행 가능 PASS가 아님.
- WinPE 실제 TEST_ONLY 런타임은 이 단계에서 **준비 미완료**. 실행 가능한 기존 허용 VM 소프트웨어가 고정 경로 6개에서는 발견되지 않았고, 독립 Runner의 원본 사용자 TEMP `FINAL_WIM` 읽기는 앞선 #1252에서 `EPERM`이었다. VM 구동을 위해 해당 입력 접근 제한을 우회하거나 Owner 사용자 폴더를 다른 Runner로 복사·ACL/권한 변경해선 안 된다.
- 다음 필수 결정: (1) 실제 다른 기존 승인 VM 설치 경로를 합법적인 읽기 전용 인벤토리에서 확인할 수 있는지, 또는 (2) 해당 PC에 VM 소프트웨어를 **별도 명시 승인된 변경 효과·관리자/네트워크 드라이버·비용/복구 계획**으로 설치하고 **원본 사용자 계정의 합법적인 ISO 접근 및 볼륨 완전 격리 조건**을 확보할지 검토. **지금 `계속해라`는 VM 설치·드라이버 변경·ISO 부팅에 대한 구체 승인으로 해석하지 않는다.** 승인이 없으면 source-only 정적 검증과 원본 C급 복구 계약 검토는 계속하되 실제 부팅은 DEFERRED로 둔다.
- 무료 Windows 호스트의 VM 후보는 공식 VirtualBox Windows x64 지원 안내(https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/installation.html) 등으로 별도 검토 가능하나, 기능 존재·구매·설치·VM 부팅/USB 포맷/운영 PC/E:/Controller/Runner/Workflow/Claim/Lease 변경 모두 **0**. `ISO_ONLY_PASS`, `IMAGE_METADATA_DRIFT_CONFIRMED`, `ROOT_CAUSE_STAGE_UNKNOWN` 및 C NO-GO, 공통 자동 인계 4/5=80% 유지.


### 2026-11-12 #996 원본 pc-job 4건 — 진단 댓글/실제 결과 분리

- **재사용한 실제 Owner 승인:** [원본 Issue #996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996)의 `ZGMINI_CONTROLLER_996_C_CONSENT_V1`은 SHA256 `05bf8aa72b438b69d7c86f8798a72ec2c12fe3537489f2153069dabfe0695e7b`에 한정된 `PHASE_SCOPED_EVIDENCE_EXCEPTION`으로, `workflowDisableActorVerified=false`·`protectedBaselineVerified=false`를 수용한 과거 **부분 승인**이다. 새 `ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1`, WinPE 부팅·VM 설치·E: Claim/Lease 원자 이동·Workflow PUT/Backlog 조정·온라인 승인철회/시각 대체 승인은 아님.
- 원본 pc-job [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217)·[#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219)·[#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226)·[#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227)을 **실제 GitHub GET**으로 확인: 4/4 OPEN + label `pc-job`, 요청 body **7필드 JSON 4/4 정상**이고 고정 operation/source SHA가 branch `tools/controller-996-original-four-jobs-readonly.mjs`의 pin과 일치. 따라서 `C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID`를 단순 JSON 구문 오류로 단정하지 않는다. 기존 승인 preimage **9필드**와 원본 **7필드** 계약 차이는 별도 분석 대상으로 보존.
- 댓글 상태: #1217/#1219/#1226 = 0건, #1227 = 정확한 Owner 진단 댓글 1건 (`id=6781491296`, UTF8 body SHA256 `3808532bddb28fe398139bce3dc016a336bced84a7951467cbb26edf6b349b30`). 이 댓글은 `AUTOMATION_BLOCKED/PC_JOB_INTAKE_NOT_OBSERVED`라는 **사람의 조회·판정**이며 bot 결과/PC job 성공·취소 증거가 아님. 4건의 자동 결과 verified는 여전히 0/4.
- 범위가 같은 기존 원본 `tools/controller-996-original-four-jobs-readonly.mjs`에 정확 **#1227 댓글 1건의 ID·소유자 userId·본문 SHA** 검증만 허용. 그 외 댓글·편집·추가·잘못된 원본 필드/상태는 STOP. 결과는 `PINNED_OWNER_DIAGNOSTIC_NOT_RECEIPT`, 4건 전체 `OWNER_REPLAN_REVIEW_REQUIRED`와 `resultVerified=false`, `executionAuthorized=false` 및 운영 쓰기·Issue 게시·재시도 **모두 0** 유지. 코드 커밋 `724d9169bb0b956da24aa5d5701bc6f77908c1a3`, 테스트 커밋 `cb0b32faae115b449584808d6c00842bd568087a`.
- 범위 검증: 실제 GitHub 소스 함수 + 원본 4개 Issue/댓글 fixture 기반 V8 **15/15 PASS**(핀 정상·댓글 수정/ID/작성자/추가/다른 Issue/declared count·원본 source SHA·승인자·중복 호출 부정). 댓글 SHA는 Python `hashlib.sha256`으로 UTF8 1370바이트 직접 대조. 이 검증은 **GitHub source-only 논리 검사**이며, 독립 Windows Node 테스트 실행이나 원본 PC Runtime 성공은 아님. `tests/controller-996-original-four-jobs-readonly.test.mjs`에 동일 negative 회귀 추가.
- **다음 필수 업무**: 원본 4건의 소모·수신/Disposition을 bot receipt 및 실제 Runner/Controller 원장으로 재확인하고, 7필드 원본과 9필드 승인 preimage의 계약 불일치가 첫 실패를 만드는지 소스·원본 기록으로만 좁힌다. 완전히 동일 body를 자동 재게시하거나 #1217/#1219/#1226/#1227을 닫지 않는다. WinPE/VirtualBox 설치는 아직 독립 승인 없음.
- 전체 4/5=80%, #996 `RECOVERY_REQUIRED`, C `NO-GO`, `ISO_ONLY_PASS` 보존. 기존 운영 PC/E:/USB, Runner/Workflow/Backlog/Claim/Lease/Controller 및 공통 대기열 PC 원본 WIM/ISO 실물 변경 **0건**.


### 2026-11-12 최초 `ORIGINAL_BODY_INVALID` 원인 범위 — 원본 4건과 최신 Backlog 플래너 교차검증

- `tools/controller-996-backlog-plan.mjs` 실제 feature-branch source SHA blob `61353ade3167e94148616fb885fce8033efdb1e3`의 `strictRequest()`를 원본 [#1217](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1217), [#1219](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1219), [#1226](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1226), [#1227](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1227) **실제 GitHub body 4개**에 대해 확인. 모두 고정 7필드·원본 요청/operation/source 형태가 정상이고, 제목이 달라도 `pc-job` label + Owner + body 기준으로 허용된다. 9필드 예외는 **`writer-install-preimage-readonly` operation 하나에만** 허용되며 core-status/core-runtime-source-readonly에 임의 2필드 추가는 정상 거부.
- 동일 소스의 `plan996BacklogWithoutReplay` + 실제 4건 JSON 및 #1227 Owner 진단 댓글을 활용한 **가상 완료 목록·비어 있는 replay map** 시뮬레이션: **4건 모두 `OWNER_REPLAN_REVIEW_REQUIRED`**, `issuePostsAuthorized=0`, `automaticPcRetries=0`, `executionAuthorized=false`. 정상/음성 6/6 및 기존 4건 reader 별도 15/15 V8 PASS. **listing.complete=true·replays={}는 검증용 가정**이고 원본 운영 PC Runtime·GitHub 전수 페이지 완전성·원장 replay 무변경의 실측이 아님.
- 해당 플래너가 인식하는 원본 인간 D05 댓글을 테스트에 반영하고도 여전히 0 PC 결과/0 재실행임을 고정: `tests/controller-996-backlog-plan.test.mjs` commit `f829e9aaa671fb84c65c63f6e4fd0cdbdbeffd0d`. 읽기 전용 원본 4건 strict reader의 정확 D05 댓글 SHA pin 및 부정회귀는 commit `724d9169bb0b956da24aa5d5701bc6f77908c1a3`/`cb0b32faae115b449584808d6c00842bd568087a`.
- 따라서 과거 원본 C 실패 `C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID / ORIGINAL_JOB_DISPOSITIONS`의 원인을 **현재 4건의 JSON 파싱 오류나 정상 7필드 형식 때문이라고 확정할 수 없다**. 실제 실패에 사용된 유지보수기/Operator 버전, 원본 장애 당시의 전체 목록 및 Backlog journal·manifest preimage를 일치시켜 **최초 거부된 Issue 번호와 오류를 정확히 식별하는 조회**만 다음 단계로 분리. 상태 모호성에서 최초 Issue를 닫거나 replay/restore, Workflow PUT, install Lease 이동을 수행하지 않는다.
- 부분 `ZGMINI_CONTROLLER_996_C_CONSENT_V1`은 해당 phase evidence exception에 한정. 새 continuation/WinPE/VM/운영 복구 효과 승인으로 해석 금지. 개발 소스/테스트/문서 외 PC 쓰기 0; 현재 전체 **4/5=80% / C NO-GO** 유지.


### 2026-11-12 원본 C R2 최초 실패의 구형 파서 불일치 재확인 — source defect explained

- **최초 실패 근거 직접 연결:** 기존 [C급 중단 정본](docs/CONTROLLER_996_C_INTERRUPTED_DISPOSITIONS_20261110.md)의 `## 실제 관측과 범위` 및 `## 확인된 소스 결함과 변경`에는 사용자가 기존 Windows R2 `RUN_996_NATIVE_C_ONCE.cmd`를 **1회 실행**해 `failedStep=ORIGINAL_JOB_DISPOSITIONS`, `code=C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID`, `STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE`를 수신했고, **옛 backlog 검증기**가 `(a) chatId UUID 36자만`, `(b) Issue 제목 pc-job만`, `(c) 요청 7필드만` 허용했던 소스 결함이 이미 확인됐음이 기록되어 있다. 현재 설치 C 실행기 자체 재실행/수정 없이 이 기존 증거를 재사용한다.
- **정본 코드 직접 검증:** 실제 이전 Controller SHA `badad9124157879d7a645b64f2768113d632355b`의 `controller/common.mjs`는 `chat-UUID` 허용, 기본 7필드+`writer-install-preimage-readonly`의 정확한 9필드 예외를 허용하며 `controller/entry.mjs`는 Issue 제목 대신 label `pc-job`을 검사한다. 관련 소스의 Git blob `common.mjs=8eb3d0f9f80522d1dbf5d4eaa9edda72af1bb45f`, `entry.mjs=94b9d8bdbadc5dee684db17345bd9230c12fab82`. 수정된 Draft `tools/controller-996-backlog-plan.mjs` blob `61353ade3167e94148616fb885fce8033efdb1e3`는 정본과 같은 요청·채팅 ID·라벨/제목·9필드 구분을 구현한 **source-only 검증기**다.
- GitHub 원본 4건 #1217/#1219/#1226/#1227의 **실제 `chatId`는 4/4 전부 `chat-UUID`**, 제목이 정확히 `pc-job`인 경우 **2/4**, 요청 본문 7필드 **4/4**. 따라서 구형 UUID 전용 입력검사에 네 원본 모두 부합하지 않았고 제목 강제 검사도 두 건을 부당하게 배제한다. **정확히 첫 번째로 처리·거부한 원본 Issue 번호는 C R2의 원문 단계별 출력에 없으므로 별도 `UNKNOWN`**. 9필드 허용 누락은 다른 Writer 업무로 확대되는 정본 차이이나 **이 네 원본의 직접 실패 필드는 아니다**.
- 이전 원본 R3 Windows 실측은 `pausedAt=2026-11-10T01:06:53.751Z`~`resumedAt=2026-11-10T13:21:26.727Z`, 구간 전체 **11개 Issue 중 pc-job 4건**, 실제 `replays={}` SHA256 `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`, `replayCount=0`, backlog SHA256 `4521688c7d9f0cebbf5a71e1ba71713abc4327a5d9a091ea250f0b001ce44186`를 사용자 콘솔 및 독립 GitHub 조회로 고정했다. **이는 그 시점의 실제 읽기 전용 증거**이며 현재 PC 원장 상태의 영구 보장이 아니다. 네 건은 당시 실제 bot 결과 0/4, `OWNER_REPLAN_REVIEW_REQUIRED`; 이후 #1227의 Owner D05 댓글 1건도 실행 성공이 아니다.
- 이번 고정 회귀 `tests/controller-996-backlog-plan.test.mjs` [commit `81df457ea29761959fb5c33b7ec4e68c6cb921af`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/commit/81df457ea29761959fb5c33b7ec4e68c6cb921af): 기존 테스트의 원본 네 Issue 케이스에 **정확한 4개 `chat-UUID`와 제목/요청 ID**를 재사용해 이후 같은 결함의 재발을 방지한다. GitHub 소스와 실제 원본 요청으로 재확인한 구형/정본 조건 대조는 4/4/2/4 범위만 입증한다. 기능 소스 재설치는 수행하지 않는다.
- **원 C 동의의 정확한 경계 정정:** [원본 C 승인 JSON](docs/CONTROLLER_996_C_APPROVAL_R1.json)은 `PHASE_SCOPED_EVIDENCE_EXCEPTION`뿐 아니라 **당시 `ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE`, `CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE`를 제한된 허용 효과에 포함**했다. R2 실행은 Workflow PUT 1회·Backlog close 1회 **시도**했으며 실제 R3에서 Workflow active / Backlog closed가 관측됐다. 따라서 과거 승인 효과를 `Workflow PUT/Backlog close 권한 0`으로 단정하는 일부 뒤이은 요약은 부정확하다. 하지만 이 1회 효과를 **재실행하거나 신규 continuation C·WinPE·VM·새 Claim/Install Lease 보관 승인으로 확대할 수 없다**.
- **현재 결론:** 과거 `C_GITHUB_BACKLOG_PLAN_ORIGINAL_BODY_INVALID`의 **소스 계약 불일치 원인은 확인/수정 기록 재사용 DONE**, 첫 거부 Issue `UNKNOWN`; 별개의 최종 C 복구는 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED` 고정 STOP, 원본 C Claim/Install Lease 소유권 인계와 신규 continuation Owner 승인 부재로 `NO-GO`. 새 계획·반복 원본 CMD/Issue·Workflow PUT/Backlog Close·Claim/Lease 변경 **0건**. 기존 ISO `ISO_ONLY_PASS`, `IMAGE_METADATA_DRIFT_CONFIRMED`, WIM XML 소실 단계 `ROOT_CAUSE_STAGE_UNKNOWN` 유지. 자동 인계 전체 **4/5 = 80%**.
