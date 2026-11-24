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
| E2E | `tests/employment-r6-controller-integration.test.mjs`가 합성 Issue 본문·정책 검증 → 격리 Controller→Writer 결과 → JSON/TXT 원격 바이트 readback·재업로드 방지 및 부정확한 게시 권한 거부를 하나의 경로로 검증. 격리 C996에서 자동 실행 | IMPLEMENTED (대표 격리 E2E) |
| Security | `c996-r5-readonly-source-checks.yml` Zizmor GitHub Actions 변경 보안 검사 | IMPLEMENTED (Workflow 변경 범위) |
| Secret | `pc-secret-scan.yml` Gitleaks PR history, 보호 출력 | IMPLEMENTED |

**실행 근거:** PR #3434 HEAD `57343f59832a...` C996 [#45455116728](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45455116728), Gitleaks/Oxlint [#45455117121](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45455117121), 게시 계약 [#45455117036](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45455117036) SUCCESS. PR 병합 `b299f9594097...`. 별도 운영 원장 #3390의 W04 한 키 local/D1 hash PASS, #3408 실제 SQLite 읽기 PASS는 각각 검증 범위만 인정한다.

**E2E 적용 범위:** 대표 격리 A 경로는 기존 `tests/employment-r6-controller-integration.test.mjs`에 연결된 정상·승인되지 않은 SHA 거부 시나리오로 검증한다. `validateRequest`는 합성 Issue 본문과 정책을 판정하며 실제 GitHub event listener를 실행하지 않는다. `executeJob`은 합성 승인 source를 실행하고 결과를 임시 workspace에 저장한다. `renderBoundedReport` 및 `uploadVerifiedReportPair`는 모의 GitHub API에서 정확한 JSON/TXT 두 파일의 PUT→GET 바이트 비교, 중복 무쓰기, 충돌 시 fail-closed를 검증한다. `validatePublicationRequest`는 이 A 요청의 D1 게시 권한이 없음을 확인한다. **실제 GitHub Issue 등록/워크플로 진입·Provider 호출·운영 SQLite/D1 쓰기·Production API/UI·B 게시 작업을 이 시험이 수행하거나 보장하지 않는다.** 운영 종단 계보와 #3404 결과쌍 충돌·#3414 PDF 감사 등은 기능·공통 자동화 담당의 별도 검증 범위다. CI 표준의 대표 격리 E2E 판정은 해당 테스트가 C996 정확 HEAD에서 통과할 때에만 유효하다.
