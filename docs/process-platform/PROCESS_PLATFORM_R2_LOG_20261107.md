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
| M1 읽기 전용 A | READY | — | 운영 VBS 다단 래퍼 + 실제 A allowlist/source/file SHA/dirty read-only 수집 필요 |
| M2 공통 Writer B | READY | — | 실PC 지원 확인, scope-bound manifest/수신기와 승인/백업/lease 필요 |
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
