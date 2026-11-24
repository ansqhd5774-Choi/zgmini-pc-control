# ZGMINI CI 8영역 표준 판정 R1

기준: 2026-11-25, 각 저장소 최신 main·기존 CI 및 실제 Actions 결과. 목적은 **검사 유형별 필요 범위·실행 조건·실제 PASS를 통일**하는 것. 이 문서는 운영 기능의 수집·게시·배포 완료 인증을 대체하지 않는다.

## 공통 판정 계약

- CI 8종은 **8개 검사 영역**이지 각 저장소에 8개 Workflow를 만들라는 뜻이 아니다.
- IMPLEMENTED: 해당 기술에 필요한 범위의 자동 PR CI가 연결되고 실제 Run/정확 HEAD의 관련 단계가 PASS. PARTIAL: 일부 계약·Mock·UI 경로 또는 실행 검증 누락. NOT_APPLICABLE: 실제 파일·배포 구조를 근거로 불필요. NOT_CONFIGURED: 필요한 자동 검사 없음. BLOCKED: 필요한 권한·환경 때문에 실행 불가. UNVERIFIED: 실증 조회 전.
- Lint는 변경 소스만 검사하면 그 범위로 명시. Unit과 Integration은 Mock/격리/실 D1·SQLite를 구분한다. E2E는 브라우저/격리 흐름/실제 운영 전체를 구분한다. Security와 Secret은 독립 취약점 탐지 영역이다.
- CI 성공과 운영 PC source SHA, SQLite·D1 저장, Production API/UI, 배포 버전을 혼동하지 않는다. 운영 종단 E2E의 동일 key/version/time/readback은 **기능별 인수 검증**으로 별도 유지하고, 이를 전 저장소의 CI 설치 선행조건으로 만들지 않는다.
- 정상 1·실패 1의 판별력 있는 fixture/회귀시험 또는 동등한 유효 실패 증거와 관련 CI가 있으면 된다. 장애 사례 축적, 반복 설치, 고정 수량의 새로운 CI를 완료조건으로 삼지 않는다.
- 모든 범위 변경은 latest main 기반 최소 수정 → 기존 CI와 관련 시험 → PR → 정확 HEAD 검증 → merge SHA/readback. 신규 유료 보안 서비스·운영 Runner·예약·DB/D1 쓰기·공급자 호출은 별도 승인 없이 금지.

## 완료 기준

표준 설정 완료 = 각 영역에 **IMPLEMENTED 또는 근거 있는 NOT_APPLICABLE** 판정, 해당 CI가 실제 PR에서 실행·PASS, 필수 source/테스트 경로 트리거 누락 없음. PARTIAL/UNVERIFIED/BLOCKED는 해당 영역만 미완료. 모든 운영 기능에 대해 단일 원자적 종단 추적을 보편 CI 설치 합격 조건으로 추가하지 않는다.

## zgmini-pc-control — 적용 현황

| 영역 | 적용 및 실행 계약 | 현 판정 |
|---|---|---|
| Lint | `pc-secret-scan.yml` 변경 JS/MJS/TS Oxlint; 기존 버전·SHA pin | IMPLEMENTED (변경 범위) |
| Type Check | 최신 main Git tree 4,925개 파일에 TS/TSX/MTS/CTS 및 tsconfig/npm manifest 없음. `tsc` TypeScript 전용 검사 대상 없음; JS 정적 검사는 Lint/계약 시험으로 별도 유지 | NOT_APPLICABLE (TS 전용) |
| Build | npm 기반 배포 빌드/lockfile 없음. Controller·Writer 선택 소스 인계에는 SHA/manifest·CAS·transitive import closure 계약 검사 사용 | NOT_APPLICABLE (웹 방식 Build) |
| Unit | `c996-r5-readonly-source-checks.yml`의 변경 소스별 `node --test`·미등록 신규 시험 선택 | IMPLEMENTED |
| Integration | Controller→Writer, 승인/실패/복구·선택 설치, 게시 계약의 격리 시험 | IMPLEMENTED (격리 계약); 실운영 동일 실행 계보는 별개 |
| E2E | GitHub Issue→실제 운영 Controller→Writer→DB/D1→API/UI 전체를 격리 CI로 실행하지 않음. 격리 계약/부분 실측 근거는 있으나 대표 full-path CI E2E 자동 합격 범위 미정 | PARTIAL |
| Security | `c996-r5-readonly-source-checks.yml` Zizmor GitHub Actions 변경 보안 검사 | IMPLEMENTED (Workflow 변경 범위) |
| Secret | `pc-secret-scan.yml` Gitleaks PR history, 보호 출력 | IMPLEMENTED |

**실행 근거:** PR #3434 HEAD `57343f59832a...` C996 [#45455116728](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45455116728), Gitleaks/Oxlint [#45455117121](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45455117121), 게시 계약 [#45455117036](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45455117036) SUCCESS. PR 병합 `b299f9594097...`. 별도 운영 원장 #3390의 W04 한 키 local/D1 hash PASS, #3408 실제 SQLite 읽기 PASS는 각각 검증 범위만 인정한다.

**E2E 표준화의 다음 필수 범위:** 기존 승인·격리 Runner에서 **대표 시나리오의 Issue 접수→Controller/Writer 모의 실행→결과 영수증→공개 결과 계약 검증**이 자동화된 단일 CI 경로로 연결돼 있는지 먼저 판별한다. 빠진 **격리 구간**에 한해 기존 시험을 연결하고 정상/거부 fixture를 검증한다. 운영 Provider/SQLite/D1 실 쓰기, Controller 설치, 새 PC Job 반복 접수는 CI 표준화의 필수조건으로 추가하지 않는다. 실제 운영 원본 #3404 보고쌍 충돌, #3414 PDF hash/PC Job 진입 미검증은 별도 기능·자동화 복구 범위로 관리한다.
