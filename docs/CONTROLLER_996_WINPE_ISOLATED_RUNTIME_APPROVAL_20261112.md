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
