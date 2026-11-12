# #996 WinPE TEST_ONLY ISO — 격리 런타임 실행 결정서

기준일: 2026-11-12 KST
상태: **2026-11-13 APPROVAL_RECORDED / TEST_ONLY_EXECUTION_PENDING** (아래 2026-11-12 승인 전 기록은 이력으로 보존)
대상: **공통 대기열 PC `DESKTOP-N62L0NG` 단일 호스트**
범위 밖: 기존 운영 PC `PC`, E:\ZGmini, Controller/Writer/DB/Workflow/Backlog/Claim/Lease, USB·물리 부팅.

## 재사용할 확정 증거

- 단회 WinPE ISO 생성 성공: `ISO_ONLY_PASS`; ISO `399,980,544` bytes, SHA-256 `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588`. 최종 WIM `341,652,286` bytes, SHA-256 `e1397e3ea4e49ee08981fc210415b66b534b2358343ce7e985b996df84d17dbe`. 원본 소스 증거 `e6afb33699d5ab209c7906fe645a43118d870c61`.
- WinPE test-only EXE `148,992` bytes, SHA-256 `b2b1af8accc55d95b5e11bc68664a45af19887d56f09cd9231bce2dfd6a8e218`; 이미지 내 `\Tools\c996_winpe_cng_test.exe`에 Commit 이전 삽입 확인. 자동 실행 설정 `startnet.cmd` 변경 없음. 실제 부팅·CNG 실행 `NOT_TESTED`.
- 원본/최종 WIMGAPI XML 비교 `artifacts/controller-996/zgmini-996-wim-metadata-readonly-20261112.json`: 2306→1708 bytes, WinPE Edition/Installation/Language/Branch 등 소실 `IMAGE_METADATA_DRIFT_CONFIRMED`, 최초 발생 단계 `ROOT_CAUSE_STAGE_UNKNOWN`. 원본 사용자 세션에서 원본/final WIM/ISO/BCD 5해시 동일 확인.
- 격리 Runner `zgmini-handoff-ci-spare-01`는 공통 대기열 PC에서 GitHub 작업·결과 반환 가능하나, 원본 사용자 TEMP의 final WIM 처음 `fs.lstatSync()`에서 `EPERM` [Issue #1252](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1252). Runner 권한 확대·경로 우회·파일 복제는 허용하지 않는다.
- 기존 호스트 인벤토리 [Issue #1259](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1259) / Actions Run `43106256782`: VM 표준 실행 파일 6개 검사 `ABSENT_AT_FIXED_PATH` 6/6, 포터블/다른 위치 `NOT_CHECKED`. CPU `Intel Core i5-7300HQ`, Windows 10 Home x64, RAM `16301 MiB`, 당시 free `5183 MiB`, C: free `53783 MiB`. 실PC JSON/TXT 2/2 재조회.

## 공식 사양 및 후보

- Intel i5-7300HQ는 **VT-x, EPT** 하드웨어 지원. 그러나 **펌웨어에서 VT 활성화 여부는 확인하지 않았다**: https://www.intel.com/content/www/us/en/products/sku/97456/intel-core-i57300hq-processor-6m-cache-up-to-3-50-ghz/specifications.html
- Oracle VirtualBox **7.2**는 Windows 10 x64 호스트 지원: https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/installation.html
- Oracle 최신 다운로드 페이지(조회일 기준 **7.2.22**)는 Windows x64 **Base Package를 GPLv3로 무료 제공**: https://www.oracle.com/virtualization/technologies/vm/downloads/virtualbox-downloads.html
- **Extension Pack은 이번 시험에 필요하지 않으므로 설치하지 않음.** Base Package와 Extension Pack을 같은 라이선스·승인으로 취급하지 않는다. Windows용 설치는 관리자·드라이버/네트워크 인터페이스 변경 및 재부팅 가능성이 있으므로 별도 효과 승인이 필요.

## 승인 시에만 시행할 최소 실증 순서

1. 공통 대기열 PC의 기존 설치·포터블 경로와 펌웨어 VT 활성화 여부를 **이미 허용된 읽기 전용 방법으로 먼저 확인**. VT가 비활성/상충 또는 설치/프로필 접근 불명확이면 `NO-GO`; 사용자 동의 없이 BIOS/Windows 기능 변경 금지.
2. 기존 동작 가능한 VM이 없다면 **Owner가 별도 명시 승인한 경우에만**, 신뢰된 Oracle 원본 무료 VirtualBox Base Package의 정확한 버전/다운로드 SHA/서명을 검사하고 **공통 대기열 PC에만** 설치. Extension Pack/자동 업데이트/유료 서비스 설치 없음. 사용자 프로필·다른 PC 보호. 설치 과정의 드라이버·재부팅·네트워크 영향은 독립적으로 고지 및 승인; 조용한 자동 설치 불가.
3. 원본 사용자 계정에서 **이미 존재하는 고정 SHA ISO를 읽을 수 있는 정상 권한**을 확인. `FINAL_WIM`이나 원본 ISO ACL을 변경하거나 Runner 권한 상승으로 우회하지 않는다. ISO는 **read-only 가상 광학매체**로만 부착.
4. **시험용 VM 하나**: 게스트 RAM 2048 MiB, vCPU 1, 네트워크 어댑터 **NONE**, USB 패스스루 **NONE**, 공유 폴더/클립보드/드래그앤드롭 **OFF**, 운영 PC/E: 호스트 디스크·raw disk·물리장치 **전부 미부착**. 가상 하드디스크는 만들지 않고 ISO→WinPE 메모리 부팅만 시험. 부팅 펌웨어/ISO 호환성이 불명확하면 안전하게 STOP; host 설정이나 시스템 BCD를 고치지 않는다.
5. WinPE 콘솔 진입과 레지스트리 marker/필요 DLL의 실제 로드 확인 뒤 `X:\Tools\c996_winpe_cng_test.exe` 테스트 6사례를 수집. 시험기는 자동시작 설정을 변경하지 않았으므로, **별도의 승인된 VM 콘솔 조작 및 비민감 결과 캡처 방식이 필요**하다. 사용자에게 파일을 임시 폴더에서 찾으라고 지시하지 않으며, 아직 자동 실행 성공이라 주장하지 않는다.
6. PASS 판정은 **VM 실제 시작 / guest WinPE marker / EXE 6/6 / 원본 해시 불변 / 호스트 볼륨 미부착 / 종료 후 상태**를 독립 증거로 확인한 경우에만. 부팅/marker 실패/비승인 디스크 탐지/CPU·RAM 부족/권한 오류는 즉시 `STOP`, 재시도 0. 오류를 해결하기 위해 새 WIM/ISO·DISM Commit·ACL·드라이버 변경을 자동 수행하지 않는다.
7. 종료 시 게스트 전원 종료·해당 실행 로그와 테스트 결과를 저장하고 원본 ISO/WIM/BCD·PC 경로 불변 확인. VM이나 설치 파일·로그를 승인 없이 삭제·초기화하지 않는다.

## 2026-11-12 당시 미승인·미완료 이력 (2026-11-13 승인 이전)

- **현재 부팅/VM 생성/VirtualBox 설치/드라이버·재부팅/ISO 파일 재작성 전부 0건.**
- VM에서 CNG 6/6이 성공하더라도 이는 **테스트 벡터** 검증일 뿐, 원래 #996 C급 복구에 필요한 진짜 Owner 신뢰 공개키/SPKI, 승인, 인증된 시간·철회 freshness, 운영 PC 원본 원장/lease/설치 source/복구 승인 검증을 대신하지 않는다.
- 진행률 `4/5=80%` / `C NO-GO` / `executionAuthorized=false` 유지.
- 다음 실행을 위한 **Owner의 별도 명시 결정**: "공통 대기열 PC에 VirtualBox 무료 Base 설치(필요할 때만), 관련 관리자·가상화 드라이버 효과, 격리된 단일 VM 생성 및 고정 해시 WinPE ISO 1회 시험 부팅"을 허용할지. 일부만 승인한 경우 승인 효과 안에서만 수행.


## 2026-11-12 — 격리 PC 가상화 펌웨어 실제 A급 실측 (이전 '미확인' 부분 갱신)

- 기존 장비 인벤토리 Workflow를 재사용하는 고정 A급 `pc-winpe-vm-firmware-readonly` 조회를 구현했다. 소스 [PR #1267](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1267) **squash 병합 `020df63b5424bcdb02e47d06ddf7ab36f382dbde`**, 격리 Runner 원본 [CI #43128580083](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43128580083) **19/19 PASS (0 FAIL/SKIP)**.
- A급 단회 요청 [Issue #1268](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1268), `requestId=fe4b60dc-9353-40a2-9f79-1092a6361d40`. 실제 [Run 43128803972](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43128803972), job `130887550261` **COMPLETED/SUCCESS**, `DESKTOP-N62L0NG / zgmini-handoff-ci-spare-01`, `PASS / VM_FIRMWARE_FIXED_PATHS_READONLY_OBSERVED`. 검증된 원격 결과쌍 `results/pc-winpe-vm-firmware-43128803972-1-handoff.json` (blob `729046caf9bd50346e97ad33f0743687dd743af4`)와 `.txt` (blob `78c221c7ef6fff30fa1f2b4d04f4eab51efaeff1`) **2/2 직접 재조회**.
- Microsoft의 읽기 전용 WMI: `Win32_Processor.VMMonitorModeExtensions=true`, `SecondLevelAddressTranslationExtensions=true`, `VirtualizationFirmwareEnabled=true`, `Win32_ComputerSystem.HypervisorPresent=false`. **가상화 펌웨어 활성화는 확인됐으므로 이 항목을 다시 검사하기 위해 BIOS/Windows 설정 변경할 필요 없음**. 단, 게스트 WinPE 부팅 가능성을 입증하는 것은 아니다.
- 기존 표준 VM 실행 파일 경로 6/6 `ABSENT_AT_FIXED_PATH`: VirtualBox/QEMU/VMware/Hyper-V 관리 도구. 사용자/포터블 등 다른 위치 `NOT_CHECKED`이므로 '이 PC 어디에도 VM 없음'으로 표현하지 않는다. `vmOperationallyTested=false`, `winpeBooted=false`, `bootAuthorized=false`, `cExecutionAuthorized=false`, `operationalWrites=0`, 자동 재시도 0.
- **남은 실제 효과 승인 경계**: 기존 표준/포터블 VM이 가용하지 않다면 *격리 PC만* 대상인 VM Base Package 설치(관리자·가상화 드라이버/네트워크/재부팅 가능), 네트워크/USB/공유폴더/호스트 디스크 미부착 VM 생성, ISO read-only 부착 및 1회 WinPE 부팅이 모두 **별도 Owner 승인 대상**이다. #1252의 원본 사용자 TEMP ISO `EPERM`도 남아 있어 Runner의 권한 확대/ACL 우회로 해결하지 않는다. 실제 ISO 접근·서명·hash·WIM drift 안전성 확인 없이 부팅 불가.
- **이번 A급의 판정은 `VM_HARDWARE_FEATURES_PRESENT_ONLY`**. `ISO_ONLY_PASS`와 #996 **80%, C NO-GO**를 유지하며 원본 운영 PC의 WinPE/C 복구 승인으로 확대하지 않는다. 설치·부팅·실PC 변경 0.

## 2026-11-13 — 사용자 TEST_ONLY 승인 수신 및 현재 실행 경계

- **사용자 승인 기록:** [#996 승인 인계 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6837208822). 승인 종류는 공통 대기열 PC `DESKTOP-N62L0NG`의 격리 VM/필요시 무료 VirtualBox Base 설치·가상화 드라이버·단일 고정 SHA ISO 1회 WinPE 부팅 **TEST_ONLY**다. 기존 문서의 `INSTALL/BOOT NOT AUTHORIZED`는 2026-11-12 당시 이력이며, **2026-11-13 사용자 효과 승인은 수신했다**. 이는 운영 C 수행 허가가 아니다.
- **실행 상태:** `APPROVAL_RECORDED / TEST_ONLY_EXECUTION_PENDING`. 이전 `ISO_ONLY_PASS`, Win32 네이티브 21/21 격리 시험, firmware PASS를 재사용한다. ISO `EPERM`, WIM XML drift 원인 미확정, 실제 WinPE guest boot/CNG 결과 부재는 지속된다.
- **기존 실행 가능 범위 확인:** `main`의 `config/operations.json`에 WinPE/VM 관리자 설치 operation은 확인되지 않았으며, `pc-winpe-vm-firmware-readonly`는 읽기 전용이다. 이 대화에서 연결된 Remote Desktop Commander에는 `pc` 1대만 오프라인으로 표시되고 승인 대상 `DESKTOP-N62L0NG`의 직접 제어 기기는 보이지 않았다. 이는 격리 GitHub Runner 자체의 오프라인을 뜻하지 않는다. GitHub CI/Issue만으로 호스트 관리자 설치를 시작할 사전 허용 경로를 가정하지 않는다.
- **실제 다음 실행:** 소유자가 원래 호스트에서 사용 가능한 승인된 로컬 관리자 실행 컨텍스트/기존 VM 실행기/ISO 정상 ACL을 확인한 다음, 위 정확한 TEST_ONLY 절차를 기존 정규 경로로 1회만 수행한다. 비승인 원격 shell, 임의 workflow/CMD 자동 수신기, ACL 우회, ISO 재작성·재시도는 금지한다. 실패 시 FIRST FAIL 및 원본 보존을 인계한다.
- **변경 금지:** 운영 PC 재부팅·C claim/lease/archive·Controller/Writer·Workflow/DB/D1 변경 및 `C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED`, `C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN` STOP 완화 없음. #996 실제 C 복구는 **80% / NO-GO**.

## 2026-11-13 — 실행 패키지 및 PC 단일 수동 단계

**실제 작업 호스트:** 공통 대기열 Windows 10 Home `DESKTOP-N62L0NG`. **운영 PC `PC` 작업은 없음.** GitHub 원장·소스 기록은 특정 Windows 호스트를 실행 대상으로 하지 않는다.

1. 기존 [#1270](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1270) 원본 결과: `VM_MONITOR=true`, `SLAT=true`, `FIRMWARE_ENABLED=true`, `HYPERVISOR_PRESENT=false`, 설치 기본경로 6종 `ABSENT_AT_FIXED_PATH`, 등록 프로그램/Runner PATH `NONE`이나 레지스트리 조회는 `PARTIAL`. **이 증거를 재실행하지 않는다.** VM 미설치 확정이 아닌 '검사 범위 내 미발견'.
2. 공식 Oracle 현재 확인된 **VirtualBox Base Windows 7.2.22** (`VirtualBox-7.2.22-175245-Win.exe`, 2026-10-20 배포, 약 170MB)만 후보로 삼는다. 사용자는 **공식 Oracle 다운로드 페이지** `https://www.oracle.com/virtualization/technologies/vm/downloads/virtualbox-downloads.html`에서 Windows Base Package를 선택한다. 별도 Extension Pack 다운로드/설치 금지. 설치 실행 전에 Oracle 게시 `SHA256SUMS`의 해당 파일 항목과 실제 다운로드 SHA256, Windows Authenticode 서명(Oracle 발행자)을 서로 비교한다. **현재 실행 PC에서 직접 검증한 SHA·서명은 아직 없다**. 공식 페이지의 최신 버전이 바뀐 경우 해당 후보를 자동 설치하지 않는다.
**사전 조회한 installer hash 후보:** `afd0ff1656cbe04ed88ce619594ae021419d97cce89fa9bdc443e9a963f1713f` (7.2.22 Windows EXE, 공개 커뮤니티 패키지 manifest/분석 자료에서 교차 확인). 
**주의:** 이 수치는 **실제 대상 PC가 내려받은 파일을 직접 검사한 결과가 아니며 Oracle SHA256SUMS를 직접 읽어 대조한 증거도 아니다**. 따라서 대상 PC에서는 Oracle 게시 체크섬과 Windows Authenticode를 검증하기 전 설치 실행하지 않는다. 공개 공급망 출처: `https://github.com/chocolatey-community/chocolatey-packages/blob/master/automatic/virtualbox/tools/chocolateyInstall.ps1`, `https://www.oracle.com/virtualization/technologies/vm/downloads/virtualbox-downloads.html`.

3. 기존 격리 Runner는 `pc-winpe-vm-firmware-readonly`와 기타 승인된 메타데이터/CI 경로만 제공한다. `config/operations.json`에 `virtualbox-install`·`winpe-vm-boot`는 없고 연결된 RDC에는 대상 장치가 등록된 상태가 아니다. **RDC 호출 낭비·임의 Workflow shell·Runner 서비스 계정 설치·권한 우회는 하지 않는다.** 설치/드라이버의 **로컬 UAC 관리자 조작은 호스트 소유자가 직접 수행**하고 예상하지 못한 시스템 변경·재부팅이 요구되면 STOP 및 원래 사용자 승인 효과를 재평가한다.
4. 설치 전 기존 VM 프로그램이 정상적으로 있으면 중복 설치 금지. 설치 후 새 VM은 정확히 1개/2048MiB/vCPU 1/NIC·USB·공유·clipboard·DnD·host/raw 디스크 전부 없음/HDD 없음. 원본 사용자 프로필 아래의 **기존** ISO `C996_WINPE_CNG_TEST_ONLY.iso`는 고정 SHA256 `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588`, 크기 `399980544`만 허용. 원본 사용자 TEMP의 고정 파일은 원래 소유자 컨텍스트만 사용한다. Runner `EPERM`을 우회하지 않는다.
5. **실행 확인 상태:** 이번에는 VirtualBox 설치·WinPE boot·CNG test를 수행하지 않았으므로 `VM_INSTALL_NOT_OBSERVED / GUEST_BOOT_NOT_OBSERVED / CNG_6_NOT_OBSERVED`. 실제 설치 파일 서명·해시 확인과 승인된 로컬 관리자 실행이 가능한 증거가 확보된 이후에만 단회 부팅을 진행한다. **C급 운영 복구 80%·NO-GO**와 두 native STOP은 불변. 실패 결과를 다른 Runner·PC로 바꿔 우회하지 않는다.

## 2026-11-13 — 사용자 설치 파일 다운로드 후 진행상태

- **대상:** 공통 대기열 PC `DESKTOP-N62L0NG` (사용자 현재 채팅 PC). 운영 PC `PC` 작업 없음.
- **사용자 직접 보고:** Oracle VirtualBox 설치 파일 **다운로드 완료**, 아직 설치 실행 대기 중. 파일의 실제 저장 위치·바이트·다운로드 SHA256·Authenticode/서명은 **미관측**. 사용자 보고를 GitHub Runner 실측으로 오인하지 않는다.
- **검증 기준:** Windows Base `VirtualBox-7.2.22-175245-Win.exe`, 공개 패키지 3자 출처 SHA256 `afd0ff1656cbe04ed88ce619594ae021419d97cce89fa9bdc443e9a963f1713f` [Chocolatey 확인](https://community.chocolatey.org/packages/virtualbox/7.2.22). [Oracle 공식 패키지](https://www.oracle.com/virtualization/technologies/vm/downloads/virtualbox-downloads.html) 및 [Oracle Windows 설치 문서](https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/installation.html) 확인. **원본 Oracle SHA256SUMS 직접 바이트 재조회는 미성공**, 제3자 해시+로컬 실제 해시 및 디지털 서명 유효성을 함께 확인한다.
- **설치 전 STOP:** 파일명/해시 다름, 디지털 서명 유효하지 않음·발행자 Oracle America, Inc. 아님, 실제 파일 경로 불확실, 출처 불분명. 실행/관리자 UAC 승인/시스템 설정 변경을 하지 않는다.
- **일치 시에만 호스트 Owner 직접 진행:** 기존 파일 탐색기에서 파일 속성·디지털 서명 확인, 다운로드 폴더의 기존 Windows `certutil -hashfile "VirtualBox-7.2.22-175245-Win.exe" SHA256`로 해시 확인, 공식 대화형 installer 실행. 원래 설치 위치 `C:\\Program Files\\Oracle\\VirtualBox`만 사용. 필수가 아닌 USB/Networking/Python/Extension Pack 불설치, 갱신 자동화/유료 소프트웨어 추가 불허. 필수 Oracle base/core 드라이버의 관리자 승인 외에 예상치 못한 재부팅·설정 변경 요구가 있으면 STOP.
- **상태:** `USER_REPORTED_INSTALLER_DOWNLOADED / SHA_SIGNATURE_PENDING / INSTALL_NOT_OBSERVED / WINPE_BOOT_NOT_OBSERVED`. ISO 생성 완료 증거 재사용, VM 생성·ISO 변경·원본 운영 lease 복구는 여전히 0건. #996 C `NO-GO` 유지.

## 2026-11-13 — 사용자 최초 certutil 경로 실패 (호스트 스크린샷)

- **실행 PC:** 공통 대기열 PC `DESKTOP-N62L0NG` (사용자 현재 채팅 PC). **근거 종류:** 사용자가 직접 제공한 CMD 스크린샷, GitHub Runner 원격 실행 결과 아님.
- **첫 실패:** 현재 디렉터리 `C:\Users\ansqh`에서 파일명만 인자로 `certutil -hashfile "VirtualBox-7.2.22-175245-Win.exe" SHA256` 실행 → `0x80070002 (WIN32:2 ERROR_FILE_NOT_FOUND)`. 설치 파일이 현재 디렉터리에 존재하지 않는다는 뜻이며 다운로드/설치 실패 또는 해시 불일치가 아님.
- **최소 수정:** 재다운로드·이동·ACL 변경 없이 `dir /b "%USERPROFILE%\Downloads\VirtualBox*.exe"`로 다운로드 위치의 실제 파일명을 확인한 다음, 발견된 **정확한 경로/파일명**으로 `certutil -hashfile "<full-path>" SHA256`을 실행한다. Downloads에 없으면 정상 파일 탐색기로 EXE의 실제 전체 경로 확인. 파일이 발견되지 않으면 STOP.
- **통과 조건:** 파일 SHA256 예상 값과 전체 64자리 일치, Windows 속성의 유효한 Oracle America, Inc. 디지털 서명 확인. 이 두 검증이 끝나기 전에는 관리자 설치 실행 금지. 이는 로컬 사용자가 제공한 출력에 의해 확인할 사항이며 ChatGPT는 PC 파일을 직접 검사했다고 주장하지 않는다.
- **현 상태:** `INSTALLER_PATH_NOT_RESOLVED / HASH_NOT_MEASURED / SIGNATURE_NOT_MEASURED / INSTALL_NOT_STARTED / VM_BOOT_NOT_STARTED`. 기존 운영 PC `PC` 작업 없음, RDC 사용 없음. TEST_ONLY 승인 유지 및 #996 C 운영 복구 `NO-GO` 불변.

## 2026-11-13 — VirtualBox 7.2.22 설치 완료 화면 수신 및 설치 후 A급 조회

- **실행 PC:** 공통 대기열 PC `DESKTOP-N62L0NG` (현재 사용자가 사용 중인 PC); 기존 운영 PC `PC`에서 실행 없음.
- **사용자 이미지 증거:** `Oracle VirtualBox 7.2.22 Installer` 대화창에서 `Oracle VirtualBox 7.2.22 has been installed.` 메시지 표시, `Start Oracle VirtualBox 7.2.22?` 체크, `Finish` 버튼 활성. 이는 **로컬 설치 마법사의 설치 완료 증거**지만, `Finish` 실제 클릭·VirtualBox Manager 첫 실행·최종 설치 파일 SHA256/Authenticode는 아직 미관측. 사용자 이미지 파일을 GitHub에 업로드하거나 개인 파일을 참조하는 경로를 남기지 않는다.
- **읽기 전용 Runner 재조회 신규 승인 요청:** [Issue #1343](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1343), 고유 `requestId=6b8045cb-0e48-4b9a-9db1-6c8bced7fa21`, 기존 `pc-winpe-vm-firmware-readonly`, `role=handoff`, `scope=C996_ISOLATED_VM_PREFLIGHT`. 기존 격리 Runner `zgmini-handoff-ci-spare-01`의 정확한 호스트·가상화·표준 경로·등록 프로그램 진단만 하며 설치/부팅/작업 PC 쓰기 0. Issue에 결과가 아직 도착하지 않았다면 **`RUNTIME_RESULT_PENDING`**, 원본 requestId로 재발행하지 않는다. Run ID와 원본 JSON/TXT는 실제 확인된 후에만 기재한다.
- **사용자 다음 UI 한 단계:** 설치 대화창 `Finish` 누르고 체크된 Oracle VirtualBox 7.2.22 Manager 시작 확인. Manager가 열렸다고 VM을 즉시 시작하거나 새 디스크/어댑터를 추가하지 않는다. WinPE 시험 VM의 필수 사전 설정은 RAM 2048MiB, vCPU 1, unattended install OFF, virtual HDD NONE, NIC NONE, USB OFF, 공유폴더·clipboard·drag/drop OFF, 고정 ISO read-only 광학 매체 연결·실측 SHA 검증 후 **1회** 부팅. 공식 GUI 가이드: `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/create-vm.html`.
- **ISO 입력 경로는 기존 파일만:** `C:\\Users\\ansqh\\AppData\\Local\\Temp\\C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7\\ISO_ATTEMPT_187cd12b4d2a4789b9ef549ba9cda886\\iso\\C996_WINPE_CNG_TEST_ONLY.iso`, 기대 SHA256 `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588`. 기존 격리 Runner 다른 Windows 세션의 TEMP `EPERM`을 권한 우회로 해결하지 않는다.
- **현재 상태:** `USER_SCREENSHOT_INSTALL_WIZARD_COMPLETE`, `MANAGER_LAUNCH_UNVERIFIED`, `A_RESULT_PENDING`, `VM_CREATED=false [NOT_OBSERVED]`, `WINPE_BOOTED=false [NOT_OBSERVED]`, `CNG_6_NOT_OBSERVED`. C `NO-GO` 불변. RDC 호출 0, 운영 PC 변경 0.

## 2026-11-13 — VirtualBox 설치 후 Windows Runner A급 실측 PASS

- **요청:** [GitHub Issue #1343](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1343), requestId `6b8045cb-0e48-4b9a-9db1-6c8bced7fa21` (기존 A급 원래 구조 5필드, 1회 실행). **실행 PC:** `DESKTOP-N62L0NG`, Runner `zgmini-handoff-ci-spare-01`.
- **실행 원본:** [Actions Run #43321900404](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43321900404), job `131544416160` `completed/success`, attempt 1, `handoff-c996-winpe-vm-firmware`. 고유 [JSON](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/pc-winpe-vm-firmware-43321900404-1-handoff.json) Git blob `25d97b41a6542f9bafbde0aaedf218c00d49d075` 및 [TXT](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/pc-winpe-vm-firmware-43321900404-1-handoff.txt) blob `22a5e455feb78b087b248aa9c622ef64e19503d3`, **2/2 직접 원격 재조회 PASS**. [Issue 보조 영수증](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1343#issuecomment-6837902160).
- **설치 사실의 범위:** `vmPrograms[{id:VIRTUALBOX}].status=FILE_PRESENT`; Windows Uninstall 등록 정보 `vmDiscovery.registered=[VIRTUALBOX]`. 이전 표준 경로 미발견에서 **새 Win32 파일 존재 + 등록 정보 존재**로 실제 전진. 반면 `executableInPath=[]`는 현재 Runner PATH 한정; `registryScanPartial=true`; `executableOperabilityVerified=false`; `vmOperationallyTested=false`. GUI 최초 실행·VT guest 부팅·정확한 VirtualBox EXE 버전 바이트는 미검증이며 사용자의 설치 마법사 캡처에만 7.2.22 설치 완료 문구 존재.
- **펌웨어/한계:** `VM_MONITOR=true`, `SLAT=true`, `FIRMWARE_ENABLED=true`, `HYPERVISOR_PRESENT=false`, `readiness=VM_HARDWARE_FEATURES_PRESENT_ONLY`; `operationalWrites=0`, `automaticRetries=0`. 두 번째 동일 결과 수집 불필요. **후속 NEXT:** 원본 사용자 Windows 콘솔에서 `Finish` 후 Manager 실행 확인; 기존 WinPE ISO 고정 SHA `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588` 확인 후 RAM 2048MiB/vCPU 1/No network,USB,host disk/No unattended install VM 구성. VM 부팅 전 상태는 `TEST_ONLY_BOOT_PENDING`.
- **금지:** 다시 VirtualBox 설치, 해시 불일치 이미지 부팅, Runner TEMP `EPERM` 회피, C/운영 `PC` source/claim/lease 변경. #996 C NO-GO 유지.

## 2026-11-13 — 사용자 원본 WinPE ISO SHA256 일치 실측

- **실행 PC:** 공통 대기열 Windows `DESKTOP-N62L0NG`. 증거 유형 **사용자가 직접 제출한 해당 Windows CMD 화면**, GitHub Runner의 ISO 바이트 직접 해시 증거라고 확대하지 않는다.
- **관측:** `certutil -hashfile "<기존 원본 사용자 TEMP 아래의 고정 ISO>" SHA256` 출력이 `63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588`, `CertUtil: -hashfile 명령이 성공적으로 완료되었습니다.`로 나타남. 사용자 캡처의 ISO 기준값과 기존 원본 ISO pin **SHA256 64자리 일치 PASS**. 원본 WIM/BCD 등 나머지 파일 4건의 이번 시점 재해시는 별도 확인되지 않음; 종전 관측 증거를 대체하지 않는다.
- **이전 FIRST FAIL 정정:** 파일명만 전달한 `certutil`의 `ERROR_FILE_NOT_FOUND`는 CWD 오류였으며 **고정 ISO 전체 경로로 해결**. 재다운로드·경로 변경·ACL/원자료 변경 불필요.
- **다음 실제 실행 대상 PC:** 격리 PC `DESKTOP-N62L0NG`에서 Oracle VirtualBox 7.2 Manager의 `New`로 시험 VM 1개 `ZGMINI-C996-WinPE-TestOnly` 생성. Type Windows/Windows 10 (64-bit) 또는 인식 불가능할 경우 Other (64-bit), `Install OS Using Unattended Installation` OFF; 메모리 2048MiB, CPU 1, **가상 하드디스크 없음**, NIC 모두 OFF, USB 컨트롤러 OFF, 공유폴더 없음, 클립보드/드래그앤드롭 Disabled, 호스트/물리 디스크 없음. 기존 고정 ISO를 가상 광학매체로 연결하고 Optical 우선 부팅, EFI는 기존 BIOS 부팅을 위한 기본 OFF로 유지. VirtualBox 7.2 UI 항목이 다르거나 디스크 없이 생성할 수 없으면 **생성 단계에서 STOP하고 실제 화면 확인**. 출처: `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/create-vm.html` 및 `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/working-with-vms.html`.
- **중단/검증:** 실제 VM 시작 전에 현재 guest 설정의 VM·storage·network·USB·shared folders 확인. 네트워크를 NAT(기본값)로 남기거나 host/raw disk를 연결하지 않는다. 모든 조건 만족 시에만 별도로 승인된 **WinPE 1회 부팅**과 CNG 6건 시험. 현재 `ISO_SHA256_OWNER_CMD_PASS / VM_CREATED_NOT_OBSERVED / WINPE_BOOT_NOT_OBSERVED / CNG_NOT_OBSERVED`; 운영 PC `PC` 쓰기 0, RDC 호출 0, C `NO-GO` 불변.

## 2026-11-13 — VirtualBox 7.2.22 Wizard 하드디스크 자동 생성 차단

- **사용자 screenshot, 대상 PC:** `DESKTOP-N62L0NG`, VirtualBox 7.2.22의 `Specify virtual hardware` 단계: RAM `2048 MB`, CPUs `1`, `Use EFI` OFF 모두 PASS. 하지만 `Disk Size=50.00 GB`가 보이고 `Do Not Add a Virtual Hard Disk` 선택 옵션은 이 7.2 Wizard 화면에 없음. 이대로 `Next/Finish`하면 새 가상 하드디스크 생성 효과가 추가되어 원 승인된 no-HDD 범위 위반.
- **정확한 차이:** Oracle VirtualBox 7.2 공식 가이드는 이 단계 `Disk Size`를 **새 dynamically allocated virtual hard disk image를 만드는 값**이라고 명시. 과거 7.0/7.1의 `Do Not Add` 선택지를 7.2 현 화면에 있다고 가정하면 안 됨. 출처: `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/create-vm.html`.
- **즉시 안전 동작:** 현재 아직 생성 전 화면에서 `Cancel`; `Finish/Next` 진행 금지. 비인가 새 VDI·기존 VM 삭제/초기화/변경 없음. 대신 사용자가 동일 `DESKTOP-N62L0NG`의 정상 일반 CMD에서 **Oracle 설치본 자체 관리도구** `"C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe" createvm --name "ZGMINI-C996-WinPE-TestOnly" --ostype "Windows10_64" --register`를 **해당 VM 이름이 등록되지 않았음을 확인한 경우에 한 번만** 실행. 이 명령 자체는 새 빈 VM을 등록하며 가상 하드디스크/ISO/Network 설정을 생성하거나 guest를 부팅하지 않음. 이미 등록됨 오류면 반복/삭제/재생성 금지, 현재 VM 설정·대상 확인 후 기존 상태 재사용.
- **이후 필수 단계:** `VBoxManage modifyvm`으로 NIC all none/USB off/2048MiB/1CPU/BIOS/clipboard·DnD disabled, optical storage controller 생성 후 ISO pin read-only 부착, `showvminfo`로 NIC/USB/hard disks/host-disk absent 검증. 생성 성공만으로 승인된 1회 WinPE 부팅 실행 금지. **현재 VM_CREATED_NOT_OBSERVED**, 원본 ISO 이전 해시 PASS 재사용, 운영 PC C NO-GO 불변.

## 2026-11-13 — Runner로 VBoxManage 실행 가능 여부 최종 구분

**사용자 요청:** 직접 CMD 대신 기존 `zgmini-handoff-ci-spare-01` Runner에서 VirtualBox 명령을 실행 가능한가?

- **기술적 능력:** GitHub Actions의 self-hosted Windows Runner는 사전 등록된 Workflow의 `cmd`/Node 명령을 실행할 수 있다. 이것이 **임의 CMD 실행 승인**을 뜻하지는 않는다. 현재 설치된 격리 Runner `pc-winpe-vm-firmware-readonly`는 VirtualBox 파일 존재·OS/펌웨어 플래그 및 일부 등록 정보 **읽기만** 허용하며, `VBoxManage list vms`, `createvm`, `modifyvm`, `startvm` 수행 허용 operation/고정 Workflow는 확인되지 않았다. 기존 Workflow에 임의 shell 삽입/Runner token 권한 상승은 금지.
- **사용자 계정 불일치 위험:** 현재 사용자는 Windows 콘솔 `C:\Users\ansqh`의 VirtualBox Manager를 사용하지만 격리 Runner는 **Windows Service**이고 원본 사용자 TEMP ISO 조회에서 `EPERM`을 보고했다([#1252](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1252)). 격리 Runner 실제 로그온 identity와 interactive Windows user가 같은지 **미실측**. VirtualBox의 machine folder / 글로벌 `VirtualBox.xml` 레지스트리는 각 Windows 사용자 홈 기준이므로, 다른 사용자 identity로 `createvm --register`하면 현재 Manager의 VM 목록과 분리될 수 있다. 공식 참조: `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/Troubleshooting.html`.
- **판정:** `RUNNER_VM_REGISTRATION_NOT_ADMITTED / RUNNER_USER_CONTEXT_NOT_ATTESTED`; VM 생성·boot **미실행**. 사용자의 승인된 TEST_ONLY 효과 자체는 유효하며 별도 재승인 요구 없음. 단, **새로운 원격 CMD 실행 경로를 임의 Workflow로 생성하거나 이 서비스 세션에서 등록하면 안 됨**.
- **다음 최소 실행:** 기존 사용자 계정의 VirtualBox Manager에서 아직 미등록인 경우 해당 계정의 `VBoxManage list vms` 확인→`createvm --register`를 정확히 한 번만 수행하는 정규 로컬 방법을 사용하거나, 향후 같은 사용자 계정·승인된 고정 operation 및 원본 ISO ACL이 검증된 기존 실행 경로가 마련되면 그 경로로 자동화한다. 이미 등록된 VM이면 중복 생성하지 않는다. **실행 PC는 공통 대기열 PC `DESKTOP-N62L0NG`이며 기존 운영 PC `PC` 작업 없음.** RDC 사용량 보호.

## 2026-11-13 — 사용자 계정 VM 목록 0건 실측 및 VirtualBox 7.2 diskless 등록

- **실행 PC/증거:** 사용자 Windows `DESKTOP-N62L0NG`, 일반 사용자 콘솔 `C:\Users\ansqh`. 스크린샷에 `"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" list vms` 명령 후 오류·출력 목록 없이 곧바로 프롬프트 복귀. **현재 사용자 계정의 등록된 VM 0건** 확인. Windows PC 전체 사용자 계정이나 다른 서비스 프로필의 VM 전체 0건을 뜻하지 않음.
- **다음 허용 1회 사용자 컨텍스트 실행:** `"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" createvm --name "ZGMINI-C996-WinPE-TestOnly" --platform-architecture x86 --ostype "Windows10_64" --register`. 공식 VirtualBox 7.2 CLI `createvm`: `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/create-vm.html`; 이는 단일 머신 정의 파일+등록만 생성하며 가상 HDD·ISO 연결·네트워크 설정·guest boot를 실행하지 않는다. 출력을 통해 VM UUID/등록 성공 확인 후에만 수정 단계로 진입한다.
- **주의:** 7.2 현 GUI 신규 생성은 기본 50GB VDI를 생성하므로 앞선 화면에서는 `Cancel` 우선, `Finish` 금지. 이 CMD는 기존 Windows 사용자의 VirtualBox 설정만 대상으로 하며 기존 격리 Runner의 임의 remote shell 실행기 신규 생성/권한 확대는 허용하지 않는다. 첫 실행 실패 시 무조건 재시도·삭제 금지.
- **상태:** `USER_VBOX_LIST_VMS_EMPTY_PASS`, `VM_REGISTER_NOT_OBSERVED`, `GUEST_BOOT_NOT_OBSERVED`, `CNG_6_NOT_OBSERVED`. 나머지 격리값(2048MiB/1CPU/BIOS/무네트워크·USB·host disk/ISO pin)은 등록 후에 별도로 검증. 실제 운영 PC `PC` 및 C급 복구에는 영향 없음.

## 2026-11-13 — 사용자 세션 VM 생성·등록 성공 및 Runner 검증 범위

- **실행 PC/증거:** 공통 대기열 PC `DESKTOP-N62L0NG`, 대화 중 사용자가 제출한 원본 사용자 `C:\Users\ansqh` CMD 출력. 앞선 `VBoxManage list vms`는 목록 0건이었고 이어서 `"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" createvm --name "ZGMINI-C996-WinPE-TestOnly" --platform-architecture x86 --ostype "Windows10_64" --register`를 사용자가 **1회 실행**.
- **실제 관측 성공 문구:** `Virtual machine 'ZGMINI-C996-WinPE-TestOnly' is created and registered.` 뒤에 새 `UUID`와 `C:\Users\ansqh\VirtualBox VMs\ZGMINI-C996-WinPE-TestOnly\ZGMINI-C996-WinPE-TestOnly.vbox` 설정 파일 경로가 출력되고 CMD가 정상 프롬프트로 복귀. **`USER_CMD_VM_CREATE_REGISTERED_PASS`**. VM 디스크 파일이 없다는 관측·메모리/CPU·NIC/USB/Storage 설정의 실측은 아직 없으므로 아래 추가 확인 전 격리 검증 완료로 승격하지 않는다.
- **Runner 검증 구분:** 기존 격리 `zgmini-handoff-ci-spare-01`는 `pc-winpe-vm-firmware-readonly` 및 `pc-host-inventory-readonly`로 VirtualBox **바이너리 존재/설치 등록/펌웨어**를 확인할 수 있으나, 승인된 두 Workflow 모두 `VBoxManage list vms`·현재 사용자 `VirtualBox.xml`·`.vbox` 사용자 프로필을 조회하지 않는다. Runner 자체는 명령 실행 가능하지만 `VBoxManage createvm/list vms/modifyvm` 허용 작업이 없고 Windows 서비스 사용자와 대화형 사용자 로그온 동일성 미입증; 반복 A를 수행해도 **사용자 세션의 VM 생성 사실은 검증되지 않는다**. 임의 원격 셸/사용자 폴더 ACL 우회 없이 **이번 원본 사용자 CMD 성공 출력은 독립적 유효 증거로 인정**한다. 추가 Runner 조회를 완료 Gate로 만들지 않는다.
- **다음 필수 작업 / 실행 PC:** 공통 대기열 PC `DESKTOP-N62L0NG`에서 **이미 등록된 단일 VM만** 설정: RAM 2048MiB/1CPU/BIOS/네트워크 1~4 전부 OFF, USB OFF, Clipboard·DnD OFF, 공유폴더 없음, 가상 하드디스크·raw host disk 없음, 이전 SHA256 PASS 기존 ISO를 읽기 전용 광학매체로 연결. 변경 후 `VBoxManage showvminfo "ZGMINI-C996-WinPE-TestOnly" --details` 혹은 VirtualBox GUI Settings/Storage/Network를 **대화형 사용자 계정에서** 확인. 네트워크/USB·host 디스크 연결 또는 비인가 설치 효과 확인 시 STOP. 앞서 사용자 UI의 50GB Disk Size는 **취소된 생성 마법사 화면**으로, 이번 `createvm`에서 VDI를 생성했다는 뜻은 아님.
- **현 상태:** `VM_REGISTERED_USER_CMD_PASS / DISKLESS_ISOLATION_NOT_ATTESTED / ISO_ATTACHMENT_NOT_OBSERVED / GUEST_BOOT_NOT_OBSERVED / CNG_6_NOT_OBSERVED`. ISO SHA256 PASS·VirtualBox 설치 원본 A #1343 2/2 PASS 재사용. 운영 PC `PC` 변경 없음, RDC 사용 없음, C급 실제 복구 `NO-GO` 불변.

## 2026-11-13 — VM 등록 후 7.2 정확한 격리 설정 명령 확정

- **대상 실행 PC:** 공통 대기열 PC `DESKTOP-N62L0NG`, 사용자 `ansqh` 대화형 CMD. 운영 PC `PC` 작업 없음. 완료된 사용자 콘솔 `createvm` 성공 출력 보존, 다시 생성하지 않는다.
- **7.2 공식 사양 직접 확인:** `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/vboxmanage.html` `modifyvm`은 VM 전원이 꺼져 있을 때 사용 가능; `--memory`, `--cpus`, `--firmware`, `--boot1..4`, `--nic1..8`, `--usb-ohci/ehci/xhci`, `--clipboard-mode`, `--clipboard-file-transfers`, `--drag-and-drop`, `--audio-enabled`, `--mouse`, `--keyboard` 범위. 공식 8NIC 안내: `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/networkingdetails.html`. 네트워크 8개 전부 `none` 지정이 4개 GUI만 해제하는 것보다 명확하다.
- **원래 사용자 계정에서 1회 실행 안내 명령** (VM 설정 창이 닫히고 VM 전원이 꺼진 상태에서만):

```bat
"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" modifyvm "ZGMINI-C996-WinPE-TestOnly" --memory 2048 --cpus 1 --firmware bios --boot1 dvd --boot2 none --boot3 none --boot4 none --nic1 none --nic2 none --nic3 none --nic4 none --nic5 none --nic6 none --nic7 none --nic8 none --usb-ohci off --usb-ehci off --usb-xhci off --mouse ps2 --keyboard ps2 --clipboard-mode disabled --clipboard-file-transfers disabled --drag-and-drop disabled --audio-enabled off
```

- 이 명령은 `ZGMINI-C996-WinPE-TestOnly` 1개 VM 정의의 설정만 변경하고 VM이나 가상 HDD/ISO를 생성·부팅·삭제하지 않는다. **실행 출력은 아직 미수신**이므로 `ISOLATION_MODIFY_NOT_OBSERVED`. VM 상태가 running/saved, 명령 미지원, 권한 오류 시 STOP하고 정확한 FIRST FAIL을 확인한다. CMD 실패를 성공으로 간주하고 이어서 광학매체를 붙이지 않는다.
- **다음 단계 조건부**: 위 `modifyvm` 성공을 받은 후 IDE 광학 controller **없음**을 확인하고 기존 사용자 ISO SHA PASS를 재사용해 ISO를 읽기 전용 광학 매체로 연결. `VBoxManage showvminfo`에서 메모리·CPU·BIOS/부팅·네트워크 1~8 `none`, USB OFF, HDD/raw disk NONE, shared folders none, 정확한 ISO 경로/이미지 여부를 검사한 후에만 TEST_ONLY 단회 부팅을 판단한다.
- **승인 경계:** C급 실제 운영 복구 `NO-GO`; 운영 `PC`·공유 저장·예약·Runner 계정 전환 없음; RDC 사용하지 않음.

## 2026-11-13 — VBoxManage modifyvm 등록 VM 검색 FIRST FAIL

- **실행 PC/증거:** 공통 대기열 PC `DESKTOP-N62L0NG`, 원래 사용자 `C:\Users\ansqh` CMD 스크린샷. 앞선 동일 사용자 CMD의 `createvm --register`는 성공 문구·UUID `ef4ba42b-1b14-49fc-8a0d-67d55250c720`·기본 VM 경로를 반환했음. **현재 증거만으로 실제 등록 상태 영속성은 미확정**.
- **FIRST FAIL:** `"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" modifyvm "ZGMINI-C996-WinPE-TestOnly" --memory 2048 ...` 실행 직후 `Could not find a registered machine named 'ZGMINI-C996-WinPE-TestOnly'`, `VBOX_E_OBJECT_NOT_FOUND (0x80bb0001)`, `FindMachine(...)` 오류. `modifyvm`의 새 RAM/CPU/BIOS/NIC/USB/clipboard 설정은 **미적용**. 원인으로 이름 문자열 불일치·사용자 계정별 VirtualBox.xml 등록 범위·설정 경로 변경 등이 가능하지만 어느 것도 확정하지 않는다.
- **즉시 STOP:** `createvm` 재실행·`registervm`·`unregistervm`·VM 파일 이동/삭제/재생성/ACL 변경·`modifyvm` 반복·ISO 연결·guest boot 금지. 기존 성공 등록 명령과 새 실패의 상충 증거를 우선 해소.
- **다음 단일 읽기 실행/동일 PC의 원래 `ansqh` 사용자 CMD:** `"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" list vms`. 결과에 등록된 정확한 이름·UUID `ef4ba42b-1b14-49fc-8a0d-67d55250c720`가 있는지 확인. `list vms`가 비어 있으면 **등록이 보이지 않는 현재 상태**로 분류하고 `VBOX_USER_HOME`과 실행 Windows 사용자 및 원래 `.vbox` 존재 여부만 읽기 전용으로 판정한 뒤 조치를 결정한다. 해당 VM이 나타나면 `showvminfo <관측된 UUID>`로 상세 설정을 먼저 읽고, 그 이후 정확한 수정 명령을 다시 계획한다. UUID가 불일치하면 임의 수정 금지.
- **Runner:** 기존 `zgmini-handoff-ci-spare-01`의 고정 A는 VM 설치 바이너리·펌웨어만 확인하며 Windows interactive 사용자 `VirtualBox.xml` 목록 검증을 제공하지 않는다. 다른 서비스 계정에 임의 VBoxManage 실행 금지.
- **상태:** `LAST_PASS=USER_CMD_CREATEVM_REGISTERED` / `FIRST_FAIL=VBOX_E_OBJECT_NOT_FOUND` / `VM_REGISTRATION_STATE_UNKNOWN` / `ISOLATION_NOT_APPLIED` / `GUEST_BOOT_NOT_EXECUTED`. C급 실제 운영 복구 `NO-GO` 유지, 기존 운영 PC `PC` 변경 0, RDC 사용 0.

## 2026-11-13 — 손상 또는 누락된 VM 등록 참조 READONLY 확인

- **실행 대상 PC:** 공통 대기열 PC `DESKTOP-N62L0NG`, 사용자가 직접 실행한 `C:\Users\ansqh` Windows CMD 4줄 스크린샷. 이번 증거는 사용자 제출 실측이며 GitHub Runner 측 명령 실행 결과 아님.
- **원본 관측 1:** `VBoxManage list vms` 결과 `"<inaccessible>" {ef4ba42b-1b14-49fc-8a0d-67d55250c720}`. UUID는 최초 `createvm --register` 성공 당시 값과 같으므로 해당 등록이 목록에 존재하지만 정상 구성으로 로드되지 않음. 이 단계는 `VM_REGISTERED_BUT_INACCESSIBLE`, VM 생성 성공을 철회하거나 두 번째 VM을 생성할 이유가 아님.
- **원본 관측 2:** 같은 UUID `showvminfo --machinereadable` -> `The object functionality is limited`, `E_ACCESSDENIED (0x80070005)`, `MachineWrap`. 이것만으로 NTFS ACL 거부를 확정하지 않는다. 실제 VM 정의 XML 경로 누락/변경·접근 불가능성·다른 저장소 문제 등을 구분해야 한다.
- **원본 관측 3:** `echo VBOX_USER_HOME=%VBOX_USER_HOME%`는 문자 그대로 치환되지 않은 값을 반환해 이 CMD 컨텍스트에서 변수 **미설정**; `if exist "%USERPROFILE%\\VirtualBox VMs\\ZGMINI-C996-WinPE-TestOnly\\ZGMINI-C996-WinPE-TestOnly.vbox"` 결과 `VM_FILE_MISSING`. 경로 오타/다른 폴더/실제 소실을 구분할 추가 원본 조회 필요. 다른 사용자별 등록 소유권을 확인한 증거는 아님.
- **공식 출처:** `https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/Troubleshooting.html`은 Windows 사용자 `%USERPROFILE%\\.VirtualBox\\VirtualBox.xml`에서 VM 레지스트리가 각각의 `.vbox` 파일을 참조함을 설명하고, 파일 XML 직접 수정을 권장하지 않는다.
- **다음 단일 승인 A/read-only 진단 (같은 사용자의 CMD):** VM 폴더의 파일 목록 `dir /a "%USERPROFILE%\\VirtualBox VMs\\ZGMINI-C996-WinPE-TestOnly"`와 UUID 해당 등록 포인터만 `findstr /i /c:"ef4ba42b-1b14-49fc-8a0d-67d55250c720" "%USERPROFILE%\\.VirtualBox\\VirtualBox.xml"`로 확인. **VirtualBox.xml 전체 내용·다른 VM 정보·불필요한 경로 출력 수집 금지**. 결과는 경로·파일 존재 여부만으로 판정하고 수정은 그다음에 결정.
- **STOP:** `createvm` 중복 실행, `unregistervm`, `registervm`, `modifyvm` 반복, XML 편집·이동·삭제·백업 복원, NTFS 권한 변경, ISO 부착 및 WinPE 부팅 금지. 지정 대상 외 다른 VM/PC 영향 없음.
- **상태:** `LAST_PASS=CREATEVM_REGISTERED`, `FIRST_FAIL=MODIFYVM_VBOX_E_OBJECT_NOT_FOUND`, `CURRENT=INACCESSIBLE_UUID_MATCH / VM_FILE_MISSING`, `ROOT_CAUSE_NOT_ESTABLISHED`, `WINPE_BOOT_NOT_EXECUTED`. #996 실제 C급 운영 복구 `NO-GO` 유지, RDC 호출 0.
