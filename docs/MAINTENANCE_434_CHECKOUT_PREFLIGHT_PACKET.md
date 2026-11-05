# #434 Windows 로컬 checkout 읽기 전용 사전진단 패킷

현재 단계: **진단 파일 소스 준비용 Draft PR**. Windows 실PC 실행·수정·인계 증거가 아닙니다.

## 왜 필요한가

사용자의 최초 원클릭 인계 결과는 `AUTOMATION_BLOCKED / LOCAL_APPROVAL_MANIFEST_MISSING / HANDOFF_INVOKED=NO`였습니다. 즉 기존 CMD가 `E:\ZGmini\projects\zgmini-pc-control\approvals\maintenance-handoffs\1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json`의 부재를 확인하고 **인계 도구 호출 전에 중단**했습니다. 원격 GitHub `main`에는 [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443)으로 이 승인 명세가 존재합니다. 그러나 로컬 브랜치·HEAD·dirty를 조사하기 전이라 *stale checkout 여부는 미확정*입니다.

## 1회 실행

1. [MAINTENANCE_434_CHECKOUT_PREFLIGHT.cmd](../tools/operator-packets/MAINTENANCE_434_CHECKOUT_PREFLIGHT.cmd)를 기존 Windows PC의 쓰기 가능한 다운로드 폴더에 **그대로 내려받습니다**. 명령·SHA·경로 편집 금지.
2. 관리자 권한이 **아닌** 일반 사용자 Windows 로컬 세션에서 **한 번만 더블클릭**합니다. RDC·GitHub Actions/Runner를 이용한 자기 인계는 여전히 금지입니다.
3. 같은 다운로드 폴더의 **새 파일 한 개** `ZGMINI_MAINTENANCE_434_CHECKOUT_PREFLIGHT.txt`만 확인·전달합니다. 이전 `ZGMINI_MAINTENANCE_434_ONCE_RESULT.txt`는 절대 삭제·수정하지 마세요.
4. `AUTOMATION_BLOCKED`, `READONLY_DIAGNOSTIC_PARTIAL` 또는 `ERROR_<code>`라면 그 자리에서 STOP. 반복하지 않습니다.

## 확인 범위

- 기존 고정 경로 `E:\ZGmini\projects\zgmini-pc-control`, `E:\ZGmini\runtime\node.exe`, `tools/handoff-maintenance.mjs`와 정확한 승인 manifest의 **존재 여부만** 확인
- 로컬 Git의 현재 브랜치, HEAD 40자리 SHA, 로컬에 **이미 존재하는** `origin/main` 추적 SHA
- 승인 명세가 로컬 Git에서 tracked인지 확인, 고정 target SHA가 현재 HEAD의 조상인지 판정(0=YES, 1=NO, 다른 코드=ERROR)
- [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443)의 8개 승인 파일과 명세 1개, **정확히 9경로만** `git -c core.optionalLocks=false status --porcelain --`로 dirty 경로/코드 확인. 비밀값이나 파일 내용 조회 없음.

## 금지 및 완료 판정

이 CMD는 Git 원격 통신(`fetch/pull`), checkout, 파일 교체·삭제·쓰기, 유지보수기 호출, 잠금 해제, PowerShell, 관리자 권한 상승을 전혀 실행하지 않습니다. CMD와 동일 폴더에 결과 TXT 한 개만 기록하며 이미 같은 결과 파일이 있으면 **덮어쓰기 없이 종료 90**으로 STOP합니다.

`READONLY_DIAGNOSTIC_COMPLETE`는 단지 **로컬 상태 파악 성공**을 의미하며 설치 승인이나 `#434 FINAL PASS`가 아닙니다. 결과를 받은 총괄 담당자가 정확한 누락 원인과 범위, 실제 승인된 정규 동기화 경로를 별도로 정하고, 기존 안전 인계 프로그램 및 이후 중복 보고서 방지 효과를 검증해야 합니다.

참고: [공용 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68), [#434 소스](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434), [#443 manifest](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443).
