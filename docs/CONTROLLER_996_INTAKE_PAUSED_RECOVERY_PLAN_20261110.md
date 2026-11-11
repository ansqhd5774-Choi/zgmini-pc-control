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
