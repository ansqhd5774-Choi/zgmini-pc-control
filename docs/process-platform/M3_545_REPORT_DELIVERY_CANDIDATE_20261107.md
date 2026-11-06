# M3 — 공통 결과 전송 REPORT_SIZE 최소 수정 후보 (2026-11-07 KST)

> **후보 명세 / 설치 승인 manifest 아님.** 프로젝트 [#526](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/526), [Draft PR #545](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/545), 원담당 실행 [#540](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/540), 공용 적용 조정 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68).

## 1. 원인 및 증거 수준

- [#540 A 원본 작업](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/540): `RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY` 내부 실행 **PASS**. 그 후 보고서 전송에서 **`REPORT_SIZE` 실패**. JSON/TXT와 Issue 댓글의 자동 게시 PASS 아님.
- pretty JSON **34,130B** + TXT **1,130B** = 35,260B. 기존 `maxReportBytes=32768`보다 2,492B 초과.
- 실제 #540 자료 기준 compact JSON **24,800B** + TXT **1,130B** = **25,930B**(6,838B 여유). **필드 삭제·부분 생략·용량 제한 완화 없음**. 후보 62건 중 기록된 32건, `inventoryTruncated=true`, `STATE_UNKNOWN` 그대로 유지.
- 기존 운영 `upload.mjs`의 재조회·바이트 검증과 temp 보존 계약은 변경하지 않음. 기존 #540 A 재실행·외부 Provider 호출 0.

## 2. 파일별 후보 소스

전용 코드 브랜치 `codex/controller-report-compact-fallback-r1-20261107`, Draft PR #545, 후보 HEAD `aa581948949c01c7c391af812fe7064116a10ef0`.

| 변경 파일 | 변경 성격 | SHA-256(원격 바이트 동일 확인) |
| --- | --- | --- |
| `controller/report-upload-verified.mjs` | **신규 함수** `renderBoundedReport`: pretty+TXT 우선, 초과 시 compact+TXT, 그래도 초과하면 `REPORT_SIZE` | `2147c20346c36681661dd2da7abbe92ce195e0fd3a9dc42b974a38c5cc86e5ef` |
| `controller/upload.mjs` | 기존 인라인 직렬화·용량 검사 대신 해당 함수 호출. 업로드/댓글 재조회 경로 불변 | `0a582c931ca2b313bc50175494eb6d9265d188b70b984408bdd579c2617b97d6` |
| `tests/report-upload-verified.test.mjs` | 회귀/32KiB 경계·UTF-8·멱등 재업로드·원격 충돌·초과 차단 확인 | `e2e772917cafe1c36c64a210d35f0c8a953f8f746adf5cebfc9f4cd61920d528` |

검증: Linux Node 24 `node --test tests/report-upload-verified.test.mjs` **14/14 PASS**, 두 Controller JS `node --check` PASS. 독립 2인 소스 검토: 신규 HIGH/BLOCKER 없음. **Windows/실PC 자동 결과 업로드는 아직 미검증.**

## 3. 누적 diff / 다른 담당 변경과의 경계

- 가장 최근 확인된 실제 정상 B [#538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/538#issuecomment-6691090423): Controller `af016444b2f87f11cd468428d9235cfc257d317d` `SUCCEEDED`(해당 완료 시점). 그 이후 변경 여부는 실제 적용 직전 확인.
- `af016444… → main` 2026-11-07 현재 GitHub compare: `controller/release-calendar-runtime-readonly.mjs` **1개**(원담당 변경).
- `af016444… → #545 후보 HEAD`: Controller **2개**(`report-upload-verified.mjs`, `upload.mjs`). 테스트 파일은 Controller 교체 파일이 아님.
- `af016444… → #537 후보 HEAD`: Controller **3개**(`alpaca-quota-readonly.mjs`, `asset-r10-source-readonly.mjs`, `fixed-readonly-bytes.mjs`). #537과 #545는 **별개 Draft 브랜치**로, 어느 하나가 나머지를 포함하지 않음.
- `main`은 #545 분기 뒤 다른 업무 10커밋 전진. 세 변경군의 Controller 파일 경로는 서로 겹치지 않지만 **분기된 head 전체를 운영 설치 목표로 직접 채택 금지**. 전체 설치 SHA→선택된 **정확한** 병합/순차 목표 SHA에 대해 최종 Controller/config diff, 각 파일 승인·바이트 해시를 다시 맞춘다.

## 4. 실제 적용 통과 조건 및 후속 복구

1. 독립 코드 검토·로컬 테스트 PASS를 재사용하되, Windows 정상/실패의 최소 권한 격리 시험 수단이 있으면 검증. 임의 원격 스크립트/새 workflow/권한 우회 금지.
2. #68 단일 설치 담당이 실제 현재 Controller SHA와 공유 변경군 경합을 확인하고 #545의 2개 Controller 파일을 **정확한 최종 누적 diff와 승인 manifest**로 조정. 기존 승인 manifest를 범위 외 변경에 재사용하지 않음. 실제 B는 필요한 정규 기능 적용 시만 수행, 시험용 B 생성 금지.
3. 독립 유지보수기 보호(lease, drain, 원본/백업, 적용·검산, Runner fresh 재연결, 고정 A 진단, 결과 재조회) 통과 시에만 **운영 설치 PASS**.
4. **#540 기존 결과 자동 재게시 불가:** 기존 `issues:opened` 경로가 A 실행+upload 일괄 호출이라 과거 포인터 보존 여부와 승인된 `upload-only` 회수 경로를 별도 확인. 원본 A/Provider 재실행 없이 JSON/TXT 원격 바이트·댓글 완료 시에만 **RESULT_DELIVERED**.

상태: **개발 소스 준비 / M3 RUNNING / 전체 R1 60%**. 공유 운영 효과·Windows 설치·#540 기존 결과 복구는 미완료. 기능 로직·EPS·DB·API/예약·게시에는 변경 없음.
