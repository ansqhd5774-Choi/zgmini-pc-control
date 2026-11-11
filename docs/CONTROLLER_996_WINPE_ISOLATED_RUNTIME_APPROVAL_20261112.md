# #996 WinPE TEST_ONLY ISO — 격리 런타임 실행 결정서

기준일: 2026-11-12 KST
상태: **SOURCE/RESEARCH ONLY — INSTALL/BOOT NOT AUTHORIZED**
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

## 명시적으로 여전히 미승인·미완료

- **현재 부팅/VM 생성/VirtualBox 설치/드라이버·재부팅/ISO 파일 재작성 전부 0건.**
- VM에서 CNG 6/6이 성공하더라도 이는 **테스트 벡터** 검증일 뿐, 원래 #996 C급 복구에 필요한 진짜 Owner 신뢰 공개키/SPKI, 승인, 인증된 시간·철회 freshness, 운영 PC 원본 원장/lease/설치 source/복구 승인 검증을 대신하지 않는다.
- 진행률 `4/5=80%` / `C NO-GO` / `executionAuthorized=false` 유지.
- 다음 실행을 위한 **Owner의 별도 명시 결정**: "공통 대기열 PC에 VirtualBox 무료 Base 설치(필요할 때만), 관련 관리자·가상화 드라이버 효과, 격리된 단일 VM 생성 및 고정 해시 WinPE ISO 1회 시험 부팅"을 허용할지. 일부만 승인한 경우 승인 효과 안에서만 수행.
