# #434 로컬 main 정확한 승인 지점 Fast-forward — Windows 단회 패킷

**상태: 소스 제작·검토용 Draft. Windows 운영 적용은 미실행이며 #434 FINAL PASS가 아닙니다.**

## 목적

사용자 Windows 읽기 전용 결과의 로컬 `main` HEAD는 `91a6e085d69d35164c28cdfb8ff74cc67a6efd3b`, cached `origin/main`은 `50b8a54242525754fadb04b2a172ced884052daf`입니다. 원격 GitHub 계보에서 [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443)의 승인 manifest가 포함된 최초 병합 `14fa522c0b051801f6a12b64d872d7a50532d39e`까지 **21커밋·16파일**, 분기 없음이 확인됐습니다. 사용자가 이 **정확한 지점까지만 조건부 단회 FF**를 선택했습니다. 최신 `main` 45커밋 자동 업데이트는 승인 대상이 아닙니다.

## Windows 로컬에서 한 번 내려받아 실행

1. [MAINTENANCE_434_PINNED_FF_ONCE.cmd](../tools/operator-packets/MAINTENANCE_434_PINNED_FF_ONCE.cmd)를 기존 Windows PC의 쓰기 가능한 다운로드 폴더에 내려받습니다. 사용자가 CMD·경로·SHA를 수정하지 않습니다.
2. 관리자 권한이 아닌 일반 사용자 로컬 Windows 세션에서 **단 한 번 더블클릭**합니다. GitHub Actions·Runner·RDC·PowerShell 사용 금지.
3. 같은 폴더의 신규 단일 `ZGMINI_MAINTENANCE_434_PINNED_FF_RESULT.txt`를 확인하여 전달합니다. 기존 `ZGMINI_MAINTENANCE_434_ONCE_RESULT.txt`와 `ZGMINI_MAINTENANCE_434_CHECKOUT_PREFLIGHT.txt`는 삭제·수정하지 않습니다.
4. 오류·STOP·`STATE_UNKNOWN`이면 **절대 재실행하지 않습니다**. 정확한 결과를 먼저 재조회합니다.

## 최소 변경과 안전 조건

- E: 기존 Git checkout `E:\ZGmini\projects\zgmini-pc-control`에서 **현재 branch main·HEAD 정확 `91a6…`**, 로컬 `origin/main` 기록 정확 `50b8…`를 비교합니다.
- 목표 `14fa…`의 로컬 commit object가 있고 old→target→cached origin/main이 모두 정상 조상 관계인지 확인합니다. GitHub 네트워크 호출·fetch/pull·임의 checkout은 하지 않습니다.
- GitHub remote compare에서 확인된 **정확한 16 경로**의 scoped dirty/untracked를 검사하며, 그중 **새로 추가될 10개 파일의 기존 파일·폴더 존재(ignored 파일 포함)**도 검사합니다. 무관한 문서/결과 dirty는 새 전역 Gate로 묶지 않습니다.
- Controller 설치 lease 존재, 미검증 smudge filter 또는 Git hook disable 경로 존재 시 **쓰기 전 차단**합니다. `git check-attr`의 단일 호출 결과·종료코드·16개 출력 행을 동일 TXT로 검증합니다. Git index 관찰에는 `core.optionalLocks=false`를 사용합니다.
- 모든 조건이 통과한 경우에만 로컬 기존 Git object로 `git merge --ff-only 14fa…`를 **한 번 수행**하며, Git post-merge hook 경로는 존재하지 않는 고정 경로로 호출별 비활성화합니다. E: Core/DB·원자료·실제 독립 유지보수기 수신기·예약·운영 설정에는 직접 접근하지 않습니다.
- 실행 결과에서는 `SOURCE_FF_PINNED_PASS`가 되어도 **로컬 source HEAD와 Git-tracked manifest만 검증한 것**입니다. 실제 유지보수기 인계는 호출하지 않으며 `HANDOFF_INVOKED=NO`로 구분합니다.
- FF 호출 뒤 오류/결과 불명확 시 `STATE_UNKNOWN`으로 보존하며 자동 복원·재시도하지 않습니다. 과거 HEAD/목표 SHA/exit 정보를 단일 TXT에 남깁니다.
- 승인·실제 설치 변경이 필요한 마지막 단계는 새 별도 **Windows-local operator-only** 유지보수기 인계 및 Receiver/실행별 E: 보고서 미생성 검증입니다. 기존 첫 CMD는 이미 실행 기록이 있으므로 재실행하지 않습니다.

## 검증 구분

이번 패킷의 GitHub source 재조회, 정적 보안검토, 승인 범위 대조 결과는 **소스 증거**입니다. Windows 실기기 `git merge`, 이후 유지보수기 실제 설치, E: 보고서 동작은 별도 검증 전까지 미완료입니다.

참고: [공용 대기열 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) · [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) · [독립 유지보수기 소스 #434](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434).
