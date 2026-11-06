# ZGMINI 공통 실행·설치 경로 개선 R2 — 진행 원장

- 시작일: 2026-11-07 KST
- 이슈: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/622
- 계획: [PROCESS_PLATFORM_R2_PLAN_20261107.md](PROCESS_PLATFORM_R2_PLAN_20261107.md)
- 전용 브랜치: codex/controller-ops-lessons-20261105
- R1 완료 기록: #526 / R1 M0–M4 100% 보존
- 기준: 단계마다 20%, **증명되지 않은 운영 상태를 점수에 반영하지 않음**
- **현재 진행률: 20% (M0 DONE, M1–M4 미완료)**

## 최신 상태

| 단계 | 상태 | 누적 진행률 | 이번 확인 / 남은 증거 |
|---|---|---:|---|
| M0 계획·기준·지침 | DONE | 20% | Issue #622 + 계획·원장 전용 브랜치 저장. 최신 main 지침 PR #624 병합, 3개 파일 원격 재조회 본문 정확 일치 |
| M1 읽기 전용 A | RUNNING (source 병합, PC 미검증) | 20% 유지 | PR #625 main 병합·18/18 fixture PASS; 실제 A operation 설치·실PC 체크아웃/해시 회수 미확인 |
| M2 공통 Writer B | RUNNING (계약·상태머신 초안) | 20% 유지 | Draft PR #626 4파일 SOURCE_READY, 14/14 fixture PASS; Windows adapter/정규 수신 경로·실PC 설치 미구현 |
| M3 실패·정상 회귀 | DEFERRED | — | M1/M2 관련 구현 후 시나리오 5개 |
| M4 실PC 적용 경로·인계 | DEFERRED | — | 승인 실PC 결과, requestId/보호 상태 및 원담당 실제 수신 |

**진행률 원칙:** M0가 모두 검증되면 20%; M1 40%; M2 60%; M3 80%; M4 100%. 코드 작성·PR 병합은 설치·운영 완료의 대체 증거가 아니다.

## 2026-11-07 — 신규 프로젝트 수립

### 기존 증거 재사용 (새로운 설치 성과 아님)
- Inflation19 기능: https://github.com/ansqhd5774-Choi/zgmini/pull/981 — PC 설치·자동 갱신 성공 아님.
- 물가지표 A거부: #353/#356/#362 (SCRIPT_REFERENCE_UNRESOLVED / LAUNCHER_FORMAT_UNSUPPORTED), #614 (OPERATION_NOT_ALLOWED).
- PC Controller 이전 실제 설치: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/608 — 당시 설치 SHA db8924162d42adf6ee6aa27a04ce1719c8fe96c2.
- R17 통합 승인 manifest: https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/615 — GitHub 준비/병합과 PC 설치는 다름.
- Controller B 운영 적용은 #68의 기존 단일 담당이 처리. R2의 중복 B 제출 0건.
- R1 Issue #526 CLOSED, 기존 프로젝트 완료 증거 보존.

### 수행·영향
- 새 추적 Issue #622 생성.
- 기존 프로세스 총괄 브랜치에 R2 계획·원장을 신규 생성. 기존 R1 기록·기능 소스 수정 없음.
- 공통 지침 수정: [PR #624](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/624) 병합, merge commit a842f4225ce062dce6ce3dc85d8e15c750ca4220. 최신 main 기준 3개 Markdown 파일만 변경(AGENTS.md, docs/GENERAL_CHAT_PREWORK.md, docs/PC_AUTOMATION_STANDARD.md). main 원격 파일 3개 내용이 PR 브랜치의 목표 본문과 정확히 일치하는 것을 확인.
- §2 신규 기능 초기 공통 A/B 경로 매핑, §5 범위 제한 Writer B 계약, §8 반복 문제 구조 개선 기준 반영; 원담당 대리 설치·프로세스 Gate 추가 없음.
- 새 예약·PC A/B 실행·DB/D1/운영 Writer 변경 0건.

### 다음 필수 행동
- M1: 기존 operation 지원·실제 PC 허용목록·VBS 다단 래퍼의 읽기 전용 진단 계약을 필요한 범위에서 대조. 최신 Controller 실제 설치 결과가 나오면 #614 거부 원인과 구분해 실PC checkout/HEAD/config.source/세 파일의 SHA/dirty를 회수한다.
- M2: 공통 Writer B의 기존 자산·승인 범위와 3파일 manifest 수신 경로를 병렬 준비한다. 실제 운영 쓰기는 기존 #68의 단일 담당/lease로만 진행한다.

### 명시적 미확인
- 현재 Controller/PC Writer 설치 SHA와 실제 Core 승인 source는 본 실행에서 새로 조회하지 않음.
- #614 A거부 해결, Writer B 경로 설치, 19개 지표 자동 게시 성공, ER1 B 설치 성공 모두 **미확인**.

## 2026-11-07 — M1 읽기 전용 코드 감사 착수 (아직 M1 PASS 아님)

- 현재 main의 [controller/pc-source-readonly.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/controller/pc-source-readonly.mjs) (blob e12b2ed6a282b450ba0fbbfef03ef4e88b0f57c4): Task XML의 cmd/bat/vbs/mjs 파일 경로를 bounded 정적 추적하지만, 소스 파일 해시 목록은 기존 여섯 경로로 고정되어 PR #981의 물가지표 3개는 포함되지 않는다. 반환 증거도 STATIC_LAUNCHER_TRACE_ONLY로 실제 실행 원본 확정과 구별한다.
- [controller/core-runtime-source-readonly.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/controller/core-runtime-source-readonly.mjs) (blob 6e11effce48a1bf6c4d85493cd23523746d49dc2): 실행 프로세스 체인을 read-only로 연결하는 데 유효하지만 파일 해시 목록은 수익·캘린더 3개로 고정됨; Inflation19 파일 해시·운영 HEAD/config.source/dirty 통합 조회를 바로 제공하지 않는다.
- [config/operations.json](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/config/operations.json) (blob 0b8f8ae3645f2a0d2b54f7ad5ac4f1ebaf5d0cb5): core-runtime-source-readonly A operation은 source에 등록됨. 그러나 #614의 실제 PC 요청 OPERATION_NOT_ALLOWED는 별도 설치·허용목록 불일치 증거로 보존한다. **GitHub 등록을 실PC 활성으로 보지 않는다.**
- 분리된 최소 개선 과제: (1) 다단계 VBS에 대한 고정 허용 경로의 read-only 해석, (2) 공통 승인 manifest 대상 파일 목록의 bounded SHA256/dirty 조회, (3) 실제 PC A 허용목록 활성 후 고유 requestId로 확인. Controller #68 기존 설치를 반복 제출하지 않는다.
- 보존: Runtime·원자료·DB·D1·운영 파일 수정 0건. 새 검사나 전역 Gate 추가 0건.
- **LAST PASS:** source 코드·현재 GitHub 허용목록의 정적 지원 범위 확인.
- **FIRST FAIL / 남은 조건:** 실제 PC A operation 활성/세 파일 read-only 해시를 획득하지 못함(#614 이전 거부 증거). 다음: 기존 Controller 설치 담당의 실제 설치 결과 대조 후 허용된 A 요청; 동시에 source의 bounded 진단기 개선·관련 fixture 테스트.

## 2026-11-07 — M1 공통 A 코드·회귀 완료 (Runtime 별개)

- [PR #625](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/625) 최신 main 병합: merge SHA **6348be5201801e008be10867fd68add4ddeca52c**, 변경 파일 2개만.
- [controller/pc-source-readonly.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/controller/pc-source-readonly.mjs) blob **3ab1095a61e3c1b22918689e7cafc0950f7e1022**, [tests/pc-source-r2-readonly.test.mjs](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/tests/pc-source-r2-readonly.test.mjs) blob **d2f1e10a4ff0cb954d7d9eb27b759b0766253c21** 원격 main 재조회.
- 다단계/UTF-16LE VBS read-only 정적 추적, bounded scripts/pc-writer/*.mjs 파일명/SHA256/dirty inventory, config.source SHA↔HEAD 비교. 무관 파일의 2MB 초과·비정상/심볼릭 링크 오류는 partial issues[]로 분리해 정상 파일의 해시를 보존한다.
- 관련 격리 테스트 **18/18 PASS**, 부모 총괄 독립 재실행 exit=0. 초기 UTF-16LE 1건 실패와 무관 파일 전역 차단 설계를 발견해 수정한 뒤 병합했다.
- **LAST PASS:** source 병합·원격 재조회·격리 18/18 PASS.
- **FIRST FAIL / 미확인:** 해당 수정은 PC 설치 증거가 아니며, #614 운영 Controller A 허용목록과 실제 조회 요청·writer checkout/HEAD/config.source/PR #981 세 파일 해시·dirty 회수 미완료. M1 **RUNNING**, R2 **20% 유지**.
- **다음:** #68 원담당의 실제 Controller 설치·A 활성 결과를 확인한 뒤 같은 요청 ID를 재사용하지 않는 승인 A 1회로 대상 PC 증거 회수. 별도 기능 CMD·새 예약·중복 Controller B 제출 금지.

## 2026-11-07 — M2 공통 Writer B 코드 초안 (수신 미완성)

- [Draft PR #626](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/626) (브랜치 codex/controller-process-platform-r2-writer-b-20261107), 신규 4파일만: writer-b/contract.mjs, installer.mjs, 각 테스트.
- 재사용 근거: r17-writer-b/r17-b-claim.mjs(공유 writer-source-install.lock/요청 원장), r17-b-git-stage.mjs(격리 commit/해시 검산), r17-sip-refresh-b/install-core.mjs(대상 dirty/backup/Core drain/config.source CAS/rollback). 고정 R17/calendar 설치기와 Controller-only maintenance를 다른 기능 설치로 우회 사용하지 않음.
- 계약: private owner Issue/요청 SHA/승인 manifest 원문 해시, source HEAD=config.source, 파일 1~32개 변경 전/후 해시·허용 경로, 단일 Writer lock, backup/restore/RECOVERY_REQUIRED, provider/DB/D1/Task definition write 금지. 원격 입력 임의 shell 실행 없음.
- 로컬 fixture **14/14 PASS**, 부모 독립 재실행 exit=0. 인증된 authorizeWriterBIssue 결과만 installer coordinator가 받는 내부 seal 보완 포함.
- **LAST PASS:** SOURCE_READY / FIXTURE_PASS / 4파일만 격리 PR.
- **FIRST FAIL / 미완성:** Windows adapter + 실제 B 요청 수신 Workflow/Runner 연결·결과 원장/실PC 적용이 구현·검증되지 않아 일반 Writer B 설치 가능 상태를 주장할 수 없음. M2 **RUNNING**, 전체 R2 **20% 유지**.
- **다음:** 기존 자체 Runner 승인 B 전달 방법과 보존된 Windows 자산을 좁게 재사용한 adapter/receiver 구현·관련 격리 테스트. 실제 운영 적용은 #68 단일 담당·승인 경로에서만 수행.
