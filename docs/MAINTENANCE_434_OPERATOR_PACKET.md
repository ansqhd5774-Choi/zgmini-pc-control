> **현재 사용 파일은 V2입니다 (2026-11-06 KST).** 최초 V1 `MAINTENANCE_434_HANDOFF_ONCE.cmd`와 기존 결과 TXT는 역사 기록으로 보존하며 **재실행하지 않습니다.** 실제 Windows 고정 FF V2 `SOURCE_FF_PINNED_PASS` (local `main` HEAD `14fa522c0b051801f6a12b64d872d7a50532d39e`)가 확인됐습니다. 현재 유지보수기 자체 인계는 아직 미실행입니다.

## V2 — 다음 실제 단회 절차

1. 새 `tools/operator-packets/MAINTENANCE_434_HANDOFF_V2_ONCE.cmd` 파일을 다운로드해 Windows 일반 사용자 로컬 세션에서 **한 번만** 실행합니다. Windows `E:\ZGmini` 연결, `E:\ZGmini\runtime\node.exe`와 설치된 독립 Receiver가 필요합니다. GitHub Runner/RDC/관리자 권한에서는 실행하지 않습니다.
2. V2는 로컬 HEAD `14fa522c0b051801f6a12b64d872d7a50532d39e`, 추적 중인 8파일 승인 manifest와 필수 경로만 확인하고, 정식 `tools/handoff-maintenance.mjs --source-sha 1d6f66d87c0ff247ba75b4c98682c07c646e79cc`를 한 번 호출합니다. 기존 도구의 설치 SHA/byte/Receiver 원본/권한/lease/백업 복원 보호를 재사용합니다.
3. 결과는 사용자 `%TEMP%\ZGMINI_MAINTENANCE_434_HANDOFF_V2_RESULT.txt` 한 개에 기록되며 CMD 화면과 메모장에 표시되고 `pause`로 창을 유지합니다. `HANDOFF_HELPER_PASS`라도 이후 실제 설치 SHA·새 Receiver·후속 정상 B의 E: 중복 신규 보고서 0건 검증까지 **#434 FINAL PASS가 아닙니다.**
4. `PREVALIDATION_BLOCKED`, `STOP_NO_RETRY`, `UNKNOWN`, `RECOVERY_REQUIRED`이면 **재실행·파일 변경·임의 복구 없이 결과 원문만 회수**합니다. V1과 FF V2를 재사용·재실행하지 않습니다.

---

# #434 독립 유지보수기 — Windows 로컬 운영자 단회 인계 패킷

상태: **소스 패킷 준비·검토용 (실제 Windows 인계 미실행)**. 이 문서는 운영 적용 완료 증거가 아닙니다.

## 내려받아 한 번 실행

1. [MAINTENANCE_434_HANDOFF_ONCE.cmd](../tools/operator-packets/MAINTENANCE_434_HANDOFF_ONCE.cmd)를 Windows PC의 쓰기 가능한 다운로드 폴더에 내려받습니다. 기존 파일을 새 이름으로 복제하거나 수정하지 않습니다.
2. 기존 유지보수기를 실행하는 PC의 **일반 사용자(관리자 권한 아님) 로컬 Windows 세션**에서 이 CMD를 **한 번만 더블클릭**합니다. GitHub Actions·Runner·RDC 등에서 실행하지 않습니다.
3. CMD와 같은 폴더에 생긴 단일 `ZGMINI_MAINTENANCE_434_ONCE_RESULT.txt`의 `OPERATOR_RESULT`와 Node JSON `status/code`를 확인합니다. `HANDOFF_HELPER_PASS`라면 새 유지보수기/Receiver 재조회 및 E: 중복 보고서 방지 운영 검증으로 이어갑니다.

## 고정 범위

- 기존 설치 독립 유지보수기 (이전 관측): `c66a629f2a52b232e92b90e42906795afa4cb657`.
- 정확한 승인 대상: `1d6f66d87c0ff247ba75b4c98682c07c646e79cc`.
- 승인 명세: `approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json` (`main`, PR #443 병합).
- 기존 프로젝트 경로: `E:\ZGmini\projects\zgmini-pc-control` / 승인 Node: `E:\ZGmini\runtime\node.exe`.
- CMD는 위 경로와 `main` 브랜치를 읽기 전용으로 확인한 후 **기존 검증 도구** `tools/handoff-maintenance.mjs --source-sha 1d6f66d87c0ff247ba75b4c98682c07c646e79cc`를 딱 1회 호출합니다.
- 최종 설치·복구 여부는 도구가 직접 검사합니다. 승인된 8개 파일, checkout의 해당 파일 dirty, 설치 SHA, target 조상, 리스, Receiver 신원·origin, Windows 권한, 백업/원복 검증을 CMD에 중복 구현하지 않았습니다.

## 실패 시 STOP

- `NODE_MISSING`, `HANDOFF_SCRIPT_MISSING`, `LOCAL_APPROVAL_MANIFEST_MISSING`, `GIT_UNAVAILABLE`, `HANDOFF_MAIN_REQUIRED`는 **인계 호출 이전 차단**입니다. 자동 동기화·checkout·파일 복사로 해결하지 않습니다.
- 기존 `ZGMINI_MAINTENANCE_434_ONCE_RESULT.txt`가 있으면 새 파일로 덮어쓰거나 재시도하지 않고 종료 코드 90으로 중단합니다.
- 결과 TXT 작성 실패는 종료 코드 91, 사전검사 차단은 92입니다. 인계 도구가 `UNKNOWN`·`RECOVERY_REQUIRED` 또는 다른 비통과 상태면 그대로 보존하고 재실행하지 않습니다.
- CMD는 Git pull/checkout, PowerShell, 관리자 권한 상승, 예약 작업 변경, 기존 영속 원장·DB·키·backup·lease 삭제, 강제 종료를 수행하지 않습니다. 패킷 파일 자체는 운영 PC의 코어 원장과 독립입니다.

## 검증 범위

- 이 패킷 PR에 대한 테스트는 원격 원본 재조회와 텍스트 정적 검증으로 제한됩니다. **Windows 실제 인계, 새 Receiver 정상 시작, E: 중복 보고서 0건**은 해당 PC에서 별도로 증명돼야 #434가 FINAL PASS입니다.
- `OPERATOR_RESULT=HANDOFF_HELPER_PASS`는 Node 유지보수기 자체 인계의 성공입니다. 이후 #434 중복 보고서 방지 실제 효과까지 자동으로 증명하지 않습니다.
- 한 번 실행한 결과 TXT는 비밀키를 포함하지 않도록 별도 환경 전체 출력이나 secret 조회 없이 고정 메타데이터 및 기존 도구의 상태 JSON만 담습니다. 민감정보가 보인다면 외부 공유 전에 중단하고 점검합니다.

참고: [공용 Controller 적용 대기열 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68), [승인 소스 PR #434](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434), [명세 PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443).
