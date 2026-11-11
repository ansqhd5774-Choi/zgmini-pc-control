# #996 `INTAKE_PAUSED` C급 복구 후보 — Source only

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
