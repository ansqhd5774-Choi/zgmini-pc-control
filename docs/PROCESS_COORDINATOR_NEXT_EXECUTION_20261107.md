# ZGMINI 프로세스 총괄 — 2026-11-07 잔여 실행 계획

- 기준 브랜치: `codex/controller-ops-lessons-20261105`
- 판정 기준: GPT R6.0 + 제어 저장소 `main`의 AGENTS.md, GENERAL_CHAT_START.md, PC_AUTOMATION_STANDARD.md, GENERAL_CHAT_PREWORK.md
- 이번 기록은 실제 소스/원장 읽기 전용 조사다. Controller/Reader/PC/DB/게시/예약을 수정하거나 새 요청을 제출하지 않았다.

## 1. 기존 5건 판정 — 4/5 완료(80%)

| ID | 상태 | 재사용 근거 |
| --- | --- | --- |
| #433 | DONE | #449 B·#451 A 이후 #452 실PC R54 6/6 SHA 및 원격 결과 |
| #435 | DONE | #451/#452 실제 TXT·JSON 원격 GET 검증 |
| #437 | DONE | 소스 14/14, 실제 GitHub 17/17 KPI 분석 |
| #442 | DONE | #454 B·#455 A, Actions cleanup `CLEANED/5` |
| #434 | EFFECT_RUNTIME_PENDING | 유지보수기 자체 인계 PASS, 소스 30/30; 신규 E: 파일 0 및 요청 ledger 실측 미완료 |

이 5건은 기존 운영 개선 원장의 범위다. 일반 기능 구현·R54 게시·미래 별도 개선은 5건 완료율에 섞지 않는다.

## 2. P0 — R54 일회성 결과 TXT의 E: 생성 원인 **확인됨**

증거: 사용자 보관 `ZGMINI_R54_READER_ONEFILE_INSTALL_ONCE_V4_20261106.zip`, ZIP SHA-256 `1a9263348cbc55537e50b0483e4d48562cfc901b1f16c9318d76a8ddd983c0ec` 내부 `r54-reader-onefile-v4.mjs` SHA-256 `df2b15fe97b97fa3cb0b880245fb86e715f2d08d5415e5417a55bed9c4767d97`. 실제 원본 결과 `R54_READER_ONEFILE_INSTALL_RESULT_V4.txt`: `READER_INSTALLED_VERIFIED`, target AFTER `30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85`.

원인 위치:
1. `ROOT = E:\\ZGmini\\data\\pc-writer\\theme-nine-r54`.
2. `apply()`에서 `reportDir = path.win32.join(ROOT,'maintenance','r54-reader-onefile-v4-'+stamp)`로 생성.
3. 이 경로의 `theme-nine-r37-public.before.mjs`는 검증된 **복구 백업**이므로 E: 보존이 맞다.
4. `finally`에서 **일회성** `R54_READER_ONEFILE_INSTALL_RESULT_V4.txt`까지 같은 `reportDir`에 `fs.writeFileSync(...,{flag:'wx'})`하여 E:에 남긴다. 조기 중단 보고서는 `HERE`(압축 해제 위치)에 저장한다.
5. `README_V4.txt`도 해당 E: 결과 경로를 사용자에게 안내한다. 이는 공통 규칙 누락이 아니라 **이 패킷의 출력 경로 구현** 문제다. #434 유지보수기 결과 저장 경로와는 별개다.

**다음 필수 실행 한 건 — 담당: R54 일회성 설치 패킷/공통 출력 템플릿 소스 담당.**
- 이 V4 패킷의 생성·재사용 템플릿이 실제로 있는지 원본 저장소/담당에서 식별한다. 현재 조사로는 R54 V4 패킷 내부 직접 하드코딩만 확인됐고 공통 생성기 경로는 **미확정**이다.
- 재사용 템플릿이 확인되면 기본값에서 `backup`은 기존 E: 복구 위치로 유지하고 결과 TXT/JSON·실패 보고는 `os.tmpdir()`(Windows 사용자 `%TEMP%`)의 고유 파일 또는 기존 승인 원격 결과 경로로 분리한다. 별도 생성기가 없으면 **향후 일회성 패킷의 실제 출력 함수**만 최소 수정한다. `console.log` 결과/업로드 호환은 보존.
- 정상 완료·사전 STOP·rollback 오류의 **격리 fixture**에서 E: 일회성 결과 생성 0, 복구 백업 원본/해시 보존, 결과 회수 가능, 기존 CAS·rollback 보호 유지 여부만 관련 테스트한다.
- 이미 성공한 V4 재실행·재설치·E: 기존 파일/백업 삭제 금지. 공용 Controller/Runner/예약/DB/게시 변경이나 새 전역 Gate 금지.

## 3. P1 — #434 자연 B 효과: 기존 #476을 후보로 범위 한정 검증

[Issue #476](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/476) (2026-11-06 12:57 UTC 생성)의 기존 `pc-maintenance`:
- requestId `pc-update-1d8e5eaf-9d8d-4b22-99f8-c59b3116ac54`
- 저장된 JSON `SUCCEEDED`, 실제 Controller `0492f6f5bb16769e914ca85c63db119979fcf0a6`, 보호/Workflow 양호
- TXT·JSON 원격 결과 경로 존재, 댓글 `REPORT_UPLOAD: VERIFIED` 1개 확인. 이 원격 사실은 신규 E: 파일 0이나 로컬 ledger 검증을 대체하지 않는다.
- 확인할 두 조건: (a) 해당 요청이 실제 수정 유지보수기 인계 **후** 처리됐음을 요청 시각/installed source로 확인, (b) 기존 승인 읽기 전용 경로로 같은 requestId의 영속 ledger `reportUploadStatus=VERIFIED` 및 E: `reports/MAINTENANCE_<requestId>.txt/json` 신규 생성 **0**을 확인.
- 실제 확인 경로/권한이 없으면 `EFFECT_RUNTIME_PENDING` 유지. 신규 시험 B·이전 B 재접수·유지보수기 재인계·범용 E: 조회기 추가·기존 로그 삭제 없음. 다음 정규 B에서 이미 제공되는 증거를 재사용한다.
- #434 대기는 R54·R17·ER1 등의 독립 기능에 **NON_BLOCKING**.

## 4. 마감 기준과 제외

- 프로세스 5건 완료율은 #434 위 최소 효과 증거 전까지 80% 유지. B 작업 성공이나 원격 파일 존재만으로 100% 주장하지 않는다.
- R54 실제 9테마 공개 checkpoint→D1→API는 **R54 원담당 업무**이며 총괄이 설치·게시를 대신하지 않는다.
- GPT R6.0과 GitHub main의 E: 규칙 및 역할 분리는 정합하다. 신규 중복 규정·상시 Controller 전체검사·미래 자연 실행 대기 Gate는 추가하지 않는다.
- 이 문서의 저장만으로 다른 일반챗 수신, Windows 적용, GitHub main 반영, 실제 PC 검증이 이뤄진 것은 아니다.
