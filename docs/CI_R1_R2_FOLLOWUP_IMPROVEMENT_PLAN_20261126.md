# ZGMINI CI R1·R2 19개 전수 점검 후속 개선 실행계획 R1

기준일: 2026-11-26 KST
관리 저장소: `ansqhd5774-Choi/zgmini-pc-control`
관리 브랜치: `codex/pc-automation-process-improvement-20261119`
실제 코드 변경 대상: 현행 `ansqhd5774-Choi/zgmini` / `zgmini-pc-control` 각각의 **수정 시점 최신 `main`**에서 분기한 별도 최소 범위 브랜치

## 1. 목적·기준선·현재 판정

목표: R1 8개 **검사 영역** + R2 11개 **채택 기술**의 기존 동작을 보존하면서, 발견한 6개 검출력/적용 범위/관측 제약을 **실패 조건 재현 → 필요한 최소 수정 → 관련 실제 CI 증거**로 정리한다. 신규 CI 6개나 전역 필수 Gate 6개를 추가하는 계획이 아니다.

- [CI R1 8개·R2 11개 정본](CI_R1_R2_FINAL_LIST_20261126.md): 적용 범위는 **19/19**, 기존 구현과 원본 PR 병합 근거 보존. 운영 전 범위 정상 작동·무결성 인증이라는 뜻이 아니다.
- 공통 사용 계약: [PC 자동화 정본 `main`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/PC_AUTOMATION_STANDARD.md), [웹 `AGENTS.md`](https://github.com/ansqhd5774-Choi/zgmini/blob/main/AGENTS.md). 관련 CI만 선택 사용하고 정상 HEAD PASS, 트리거, merge SHA를 분리 확인한다.
- 실제 확인: [웹 Node PR Run #45691667146](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45691667146)와 [웹 브라우저 PR Run #45688120760](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45688120760) 성공, [PC C996 #45691658668](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45691658668)·[Secret #45691658614](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45691658614) 성공. R2 11종 원본 PR들의 관련 HEAD CI 성공 기록 확인.
- **확정된 현재 CI 실행 장애: 0건(해당 조회 범위)**. 아래 6건은 이미 입증된 전면 장애가 아니라 **개선 후보**이며, 관측형 검사라는 설계 선택을 결함으로 단정하지 않는다.
- R2 **#8 웹 Performance Budget / 실사용자 Good·P75는 사용자 명시 제외, 전용 CI 삭제**([웹 PR #1631](https://github.com/ansqhd5774-Choi/zgmini/pull/1631)). 재도입·P75/INP 실측 보완·Good 강제 기준은 이번 계획에 **포함하지 않는다**. #24 로컬 Chromium Lab은 독립 유지.

## 2. 후보별 작업 정의 — 확인된 사실과 미확인 가설 분리

| 순서 | 후보 / 관련 코드 | 관측 사실·검증할 가설 | 최소 진단·수정 판단 | 해당 범위 완료 증거 |
|---|---|---|---|---|
| 1 (P1) | **R2 #23 Cross-browser** · `zgmini/scripts/ci-cross-browser-core.mjs`, `tests/ci-cross-browser-core.test.mjs` | 최근 8개 격리 조합은 JS 오류 0·가로 넘침 0. `finalizeCrossBrowser`는 `javascriptErrors >= 0`, `overflowPx >= 0`라는 **형식 검사**를 하므로 양수 오류를 허용한다. 관측형 설계가 사용자에게 필요한 검출을 누락하는지 미확인 | 먼저 8조합 fixture에서 JS 오류 1건·가로 넘침 양수·경로 누락을 독립 주입하여 현재 결과와 요구 계약을 대조. **현재 승인된 실패 기준이 실제 있는 경우에만** 그 기준을 최소 구현; 새 임의 품질 임계값·범용 Gate는 제안만 하고 별도 결정 없이 적용하지 않음 | 정상 8조합 무회귀, 부정 fixture의 정확한 관측/기존 정책의 실패 결과, 실제 브라우저 CI 정확 HEAD 실행·아티팩트 |
| 2 (P1) | **R2 #25 Accessibility** · `zgmini/scripts/ci-accessibility-axe.mjs`, `tests/ci-accessibility-axe.test.mjs` | 브라우저 로그상 모바일/데스크톱 `violatedRules=0`, `unverifiedRules=1` 각각. 현재 `baselineStatus=OBSERVED_ONLY_NO_GATING`; 미확정 규칙을 합격으로 오인하면 안 됨 | `incomplete` 1개가 무엇인지 기존 결과/안전한 재현 fixture로 분류. 알려진 위반 1건·incomplete 1건·정상 0건의 결과 스키마와 보고 누락을 검증. 실제 `/about` 페이지의 접근성 문제라면 그 원인만 고침; **승인 없는 실패 Gate 전환 금지** | 판별 가능한 fixture 회귀, 미확정 원인 기록, 해당 브라우저 CI 실제 HEAD PASS 및 올바른 결과 보고 |
| 3 (P2) | **R2 #1 Dynamic CI** · `zgmini/.github/workflows/community-chat-browser.yml`, `tests/browser-ci-trigger-scope.test.mjs` | 브라우저 트리거가 긴 명시적 `paths` 목록을 사용. 새로운 UI 경로/의존성 추가 때 테스트가 빠지는 경우가 실제 존재하는지는 미검증 | 최소 3종 변경 케이스(기존 UI 경로, 새 UI 관련 경로, UI와 무관한 문서)를 기존 트리거 계약으로 재현. **필수 검사 누락이 입증될 때만** 관련 `paths`·선택 회귀시험 수정. 전체 경로 무조건 실행/필수 보안 검사 생략 금지 | 영향받는 케이스는 Workflow 트리거, 무관 케이스는 불필요 실행 회피, 기존 R1/보안 필수 검사 보존·정확 PR HEAD CI |
| 4 (P2) | **R2 #19 CI Observability** · `zgmini-pc-control/scripts/ci-job-metrics.mjs`, `tests/ci-job-metrics.test.mjs` | 구현은 저장소 전체 최근 100건의 Actions 목록만 선별. 이벤트가 많은 저장소에서는 특정 Workflow의 최신 유효 실행이 목록에서 빠질 수 있음 | 대상 Workflow만 최신 지정 건 조회하는 **기존 GitHub API GET**이 권한·페이지·형식상 가능한지 비교. 100건 안/밖 fixture, 빈 결과, 권한/비정상 페이지 구분. 실효성 검증 후 기존 CLI 함수만 최소 변경; **신규 예약·토큰·상주 측정/PC 설치 없음** | 특정 Workflow 누락 해소 증거·하위호환 명세·무권한 안전 오류·관련 PC 격리 시험 CI |
| 5 (P3) | **R2 #29 Bundle Size CI** · `zgmini/scripts/ci-bundle-size.mjs`, `tests/ci-bundle-size.test.mjs` | 기존 측정은 JS/CSS 102/27파일에 대해 raw/gzip 바이트 관측. `compareBundleSizes` 함수는 있으나 최근 로그는 `BASELINE=UNAVAILABLE` | 동일 `schemaVersion/scope`의 **이미 보존된** main 빌드 아티팩트를 안전하게 읽어 비교 가능한지 확인. 가능하면 읽기 전용 증감 보고만 연결하고, 자료 없으면 `UNAVAILABLE` 유지; 측정 재실행/신규 운영 baseline 저장/신규 품질 임계값 추가 안 함 | 동질/비동질·결측 baseline fixture, 기존 보고 수치 보존, 실제 Node CI에서 성공·비교 가능 여부 명확히 표기 |
| 6 (P3) | **R2 #12 Workflow Governance** · `zgmini/scripts/ci-actionlint-changed.mjs`, `tests/ci-actionlint-changed.test.mjs`, `tests/browser-ci-trigger-scope.test.mjs` | 기존 actionlint는 변경된 Workflow YAML 중심. 경로 트리거 누락 탐지는 별도 브라우저 회귀시험에 의존 | #1 검증 결과를 먼저 재사용. 변경 YAML 문법 오류·필수 Workflow 경로 누락 등 **현행 계약에서 이미 실패여야 할 경우**만 음성 fixture 추가; actionlint 범위를 전 저장소 강제 검사로 확대하지 않음 | 잘못된 YAML/실제 누락 사례 판별, 정상 Workflow 비회귀, 기존 Node·Browser 해당 CI PASS |

**우선순위 P1/P2/P3는 검토 순서이지 확정 장애 심각도나 추가 강제 검사를 승인한 등급이 아니다.** 같은 문제(#1 경로 선택과 #12 트리거 회귀)는 기존 시험·증거를 재사용하고 별도 인프라를 만들지 않는다.

## 3. 실행 단계·순서와 책임

1. **대상 고정:** 사용자 승인된 19종 목록과 삭제된 #8 이력, 작업 직전 두 저장소 최신 `main`·관련 Workflow 및 해당 스크립트/테스트의 SHA를 대조한다. 유효한 기존 PASS를 재사용한다. 브랜치 전체 재기반화·rebase/reset/타 작업 수정 덮어쓰기 금지.
2. **P1 판별:** #23 → #25 순으로 실패 재현 가능한 최소 fixture를 만든다. 정상 수치·관측-only 현재 계약과 실제 허용 오류를 먼저 구분한다. **실제 기능 결함과 현재 승인된 합격 기준에 필요한 부분만** 최소 수정한다.
3. **P2 범위:** #1 경로 회귀를 먼저 점검하고 #12가 겹치면 결과를 보존·재사용한다. #19는 독립 읽기 전용 메타데이터 대상으로 별도 진행 가능. 권한 문제를 운영 결함으로 오인하지 않는다.
4. **P3 선택 개선:** #29의 비교 가능한 기존 baseline이 있는 경우에만 관측 기능 연결. #12는 #1과 중복 시험을 재작성하지 않는다. 새 데이터·차단 조건·외부 유료 서비스가 필요하면 해당 후보는 `DEFERRED_SCOPE`로 분리하고 기존 CI 정상 사용을 유지한다.
5. **통합:** 실제 변경에 한해 해당 저장소 `main` 최신 SHA 기반 전용 브랜치와 최소 PR. 각 변경의 정상·실패 fixture + 영향 관련 기존 R1/R2 CI → 정확 PR HEAD Run/JOB/스텝 → 병합 SHA/readback 확인. 웹 `main` 소스 병합과 Cloudflare 배포/PC 실제 운영을 혼동하지 않는다.
6. **원장 종료:** 후보마다 **원래 관측 → 재현(또는 부재) → 판정 → 수정 파일/PR(있다면) → 정확 HEAD 테스트 → 병합 여부 → 남은 범위**를 해당 계획서에 갱신한다. `DONE_FIXED`, `DONE_NO_CHANGE`, `DEFERRED_SCOPE`, `BLOCKED_EVIDENCE`를 구분한다.

작업 주체: 자동화 프로세스 전문가가 이 계획·증거·원장과 담당 범위 내 CI 개선을 책임진다. 실제 웹 코드 변경은 `zgmini`의 별도 최신 `main` 기반 작업 브랜치, PC CI 메트릭 변경은 `zgmini-pc-control`의 별도 최신 `main` 기반 브랜치를 사용한다. 같은 파일의 다른 담당 변경을 보존한다.

## 4. 통과 기준·중단 조건·비범위

- **검증 완료:** 후보 6개에 각각 반증 가능한 재현 자료 또는 현행 동작이 의도된 이유가 있으며, 실제 변경한 후보는 관련 회귀·정확 SHA CI가 성공하고 필요한 PR/소스 반영까지 확인. 수정이 불필요하면 근거를 남겨 `DONE_NO_CHANGE` 종료. 이것이 **6개 모두 코드 변경**을 의미하지 않는다.
- **기존 정상성 유지:** R1 8영역과 R2 11종의 기존 필수 CI·선별 실행은 정상. 오류를 숨기는 가짜 PASS, 필수 검사 제거, blanket skip, Workflow 비활성화로 완료 처리 금지.
- **승인 범위:** 현재 단계는 **개선 계획 문서 기록**이다. 계획을 사용자의 신규 운영 권한, Gate·임계값 변경, 유료 분석/예약/Runner·PC 저장·공급자 호출/DB/D1/Cloudflare 변경 승인으로 해석하지 않는다. 기존 승인에 포함된 소스·테스트 개선은 개별 영향 범위에서 진행.
- **R2 #8 명시 제외:** 웹 Good/P75·실사용자 INP 결측 해결은 별도 작업으로 복원하거나 #24·#29의 조건에 숨겨 다시 도입하지 않는다.
- **현재 장애 판정:** 최근 성공 Run이 존재한다는 증거는 그 시점·경로에 한한다. 별도 CI 실패가 발견되면 실제 에러 위치와 최초 실패 입력까지 조사한다. 성공/실패/취소/대기/중복 경로를 구분한다.
- **브랜치 보호:** 관리 브랜치가 최신 `main`과 큰 폭으로 분기되어 있으므로 이 문서 작성만으로 브랜치 전체를 `main`에 병합하지 않는다. 기존 작업·증거·승인 기록을 재설정하지 않는다.

## 5. 계획·실행 진행 원장 (2026-11-26)

| 항목 | 계획 작성 | 원인·fixture 재현 | 수정 필요 판정 | 구현·검증·병합 |
|---|---|---|---|---|
| #23 | 완료 | 기존 정상·오류 fixture 확인 | **DONE_NO_CHANGE** — 관측형 계약 의도 확인 | 기존 Run 성공 재사용, 코드 수정 없음 |
| #25 | 완료 | 기존 fixture 및 실제 Browser 아티팩트의 color-contrast 미확정 결과 확인 | **DONE_NO_CHANGE (CI 계약)** — 미확정 결과를 통과로 위장하지 않음 | 기존 Browser CI 성공 재사용, 코드 수정 없음; 실제 UI 색 대비 여부는 별도 미확인 |
| #1 | 완료 | 실제 홈·레이아웃 공유 파일 7개 트리거 누락 확인 | **DONE_FIXED** — 누락 경로 7개 보완 | [웹 PR #1635](https://github.com/ansqhd5774-Choi/zgmini/pull/1635), Node·Browser·CodeQL·Secret 4/4 PASS, main 병합 `04b4e4c45c66e8ca126fcb897337523ee2d2257c` |
| #19 | 완료 | 전체 최근 100건 혼잡 조건 및 회귀시험 작성 | **DONE_FIXED** — Workflow별 범위 조회로 교정 | [PC PR #3721](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3721) CI 2/2·Node 회귀 11/11 PASS, main 병합 `9d8dcf906c938c41f6acde6f1ad4288652bcd890` |
| #29 | 완료 | 기존 main 아티팩트 2개 + 신규 정확 HEAD 자동 compare JSON 원본 재조회 | **DONE_FIXED** — 선택적 이전 baseline 자동 readback | [웹 PR #1636](https://github.com/ansqhd5774-Choi/zgmini/pull/1636) Node·CodeQL·Secret 3/3 PASS, main 병합 `2112c2e83870e705fda078d266f79857cb9d1267` |
| #12 | 완료 | 변경 YAML 1파일 actionlint 실행·기존 경로 회귀 사용 확인 | **DONE_NO_CHANGE** — 현재 계약 검사 정합 | 웹 PR #1635 Node·Browser·CodeQL·Secret 4/4 PASS 및 main 병합 완료, 신규 Governance 기능 없음 |

**계획 수립: 6/6**, **후속 판정·필수 검증 완료: 6/6 (100%): #23·#25·#12 DONE_NO_CHANGE, #19·#1·#29 DONE_FIXED**. 변경된 3건은 지정 범위 PR/실제 관련 CI/정확 병합 SHA/main 파일 readback 완료.  기존 CI 도입 완료 19/19를 감소시키지 않는다. 사용자가 요청하지 않은 새 예약 검증을 후속 개선 완료조건으로 추가하지 않는다.

**첫 실행 대상:** #23의 `finalizeCrossBrowser`에 `javascriptErrors=1`을 주입한 기존 계약 테스트와 현재 요구된 합격 조건을 비교한다. 결과가 관측-only 정책과 일치하면 차단 추가 없이 `DONE_NO_CHANGE` 또는 별도 결정 필요로 처리하고 다음 독립 후보를 진행한다.

## 6. 후속 실제 실행 증거 — 2026-11-26

### #23 Cross-browser — DONE_NO_CHANGE

- [현행 `scripts/ci-cross-browser-core.mjs`](https://github.com/ansqhd5774-Choi/zgmini/blob/main/scripts/ci-cross-browser-core.mjs)의 `finalizeCrossBrowser`는 **8조합 정확성·문서 응답·메인 영역·측정 형식**을 검증하고 JS 오류와 가로 넘침은 관측 수치로 기록한다. `baselineStatus=NOT_APPROVED`는 승인되지 않은 실패 임계값이 없음을 명시한다.
- [기존 `tests/ci-cross-browser-core.test.mjs`](https://github.com/ansqhd5774-Choi/zgmini/blob/main/tests/ci-cross-browser-core.test.mjs)는 `overflowPx=14`, `javascriptErrors=2` 오류 주입을 **의도된 관측값**으로 보존하는 사례, 결손·중복·비정상 형식을 거부하는 사례를 이미 포함한다. 계획서 요구의 1건 JS 오류 가설을 더 강한 2건 fixture로 구분했다.
- [기존 브라우저 성공 Run #45688120760](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45688120760)의 Firefox/WebKit 8조합에서 JS 오류 0·가로 넘침 0과 정확 Job 단계 성공을 확인했다.
- **판정:** 실제 결함 미입증, 기존 사용자가 승인한 관측형 정책과 일치. 신규 오류 실패 Gate/임계값을 임의 도입하지 않고 **코드 수정 없이 종료**. 추가 수정은 별도 정책 결정 대상이며 이번 범위에 강제하지 않는다.

### #25 Accessibility — 관측 정합·실제 미확정 규칙은 분리

- [현행 `tests/ci-accessibility-axe.test.mjs`](https://github.com/ansqhd5774-Choi/zgmini/blob/main/tests/ci-accessibility-axe.test.mjs)는 `incomplete`를 `passes`와 구분해 `unverifiedRules`로 보존하고, 명시 위반과 개인정보 노출 방지·비정상 입력 거부를 검증한다.
- [브라우저 Run #45688120760](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45688120760) 로그는 두 뷰포트에서 각각 **`violatedRules=0`, `unverifiedRules=1`**로 기록한다. 이는 전체 접근성 통과가 아니라 **현재 미확정 결과가 남아 있음**을 의미한다. 기존 보고 경로 자체의 결함은 재현되지 않아 새 Gate를 추가하지 않았다.
- **원본 아티팩트 재조회:** [Browser Run #45688120760](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45688120760)의 `community-chat-browser-r1` ZIP 내 `ci-accessibility/summary.json`에서 각 뷰포트의 `incomplete`를 식별. 규칙 `color-contrast`, 영향도 `serious`, 모바일 390px **3개 노드**, 데스크톱 1440px **1개 노드**, 양쪽 확정 `violatedRules=0`. 이는 자동화로 판정할 수 없는 규칙이며, UI의 실제 대비 결함 확정은 아니다. 기존 요약·시험은 이를 미확정으로 정상 표기하므로 **CI 로직 수정 불필요**. 실제 UI 색 대비 합격·불합격은 이 증거만으로 확정하지 않는다.

### #19 CI Observability — 수정·병합 완료

- [PC `scripts/ci-job-metrics.mjs`](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/scripts/ci-job-metrics.mjs)는 저장소 전체 최근 `actions/runs?per_page=100`을 읽은 후 Workflow 이름을 선별했다. 격리 PC 제어 저장소에서 인계/관제 실행이 다량 섞인 실제 첫 페이지를 확인했고, **실제 대상 실행이 101번째 이후일 때 빈 결과가 되는 조건**을 가설로 분리했다. 현재 관측에서 모든 대상이 누락됐다는 주장은 아니다.
- [별도 최신 main 기반 PR #3721](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3721): 기존 공식 GET으로 Workflow 이름→고유 ID를 검증한 뒤 해당 Workflow 실행 100건을 조회하도록 최소 수정. 인벤토리 누락·동명·잘못된 ID·대상 외 실행은 fail-closed. 관련 시험 11건으로 회귀 확장. **정확 HEAD `c7bd264fb3fe0d5725e7fed1dc2c37590628a0bd` C996·Secret Scan 2/2 SUCCESS, C996 직접 선택 테스트 11/11 PASS(0 FAIL); main `9d8dcf906c938c41f6acde6f1ad4288652bcd890` 병합 및 기록 확인.**
- 새로운 Runner·예약·소스 설치·운영 데이터/권한·요금제 변경 없음.

### #1 Dynamic CI — 누락 경로 확인·수정·병합 완료

- 최신 웹 `main` `app/page.tsx`, `app/dashboard-ui.tsx`, `app/layout.tsx`, `app/about/page.tsx`의 **실존하는 직접 import**와 [`community-chat-browser.yml`](https://github.com/ansqhd5774-Choi/zgmini/blob/main/.github/workflows/community-chat-browser.yml)의 `pull_request.paths`를 비교. `components/site-header.tsx`, `components/site-footer.tsx`, `components/dashboard-side-rails.tsx`, `components/live-score-value.tsx`, `components/score-arrow-provider.tsx`, `app/responsive.css`, `app/about/about.module.css`는 실제 파일이면서 브라우저 트리거 목록에서 빠져 있었음.
- [웹 PR #1635](https://github.com/ansqhd5774-Choi/zgmini/pull/1635): 기존 Workflow 경로 7개 추가와 `tests/browser-ci-trigger-scope.test.mjs`의 직접 의존 경로 회귀만 변경. **새 Workflow·전역 Gate·#8 성능예산 재도입 없음**.
- 검증: 정확 HEAD `6b2df32e8e68f14ae8c7329040f0e450b643b97a`의 Node/Browser/CodeQL/Secret **4/4 SUCCESS** 확인, [main 병합 SHA `04b4e4c45c66e8ca126fcb897337523ee2d2257c`](https://github.com/ansqhd5774-Choi/zgmini/commit/04b4e4c45c66e8ca126fcb897337523ee2d2257c) 및 YAML·회귀시험 원격 blob readback 완료. **DONE_FIXED**.

### #12 Workflow Governance — 기존 검사 재사용으로 DONE_NO_CHANGE

- [웹 PR #1635](https://github.com/ansqhd5774-Choi/zgmini/pull/1635)에서는 기존 Workflow YAML 1파일의 경로만 변경. 정확 HEAD `6b2df32e8e68f14ae8c7329040f0e450b643b97a` [Node CI #45694551850](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45694551850)의 `Validate changed GitHub Actions YAML (actionlint)` 단계가 성공했고 로그 `ACTIONLINT_CHANGED_WORKFLOWS=1`을 확인.
- 기존 `tests/browser-ci-trigger-scope.test.mjs`에 직접 의존 경로 7건을 추가해 YAML 형식 검사와 실제 트리거 누락 검사를 **서로 다른 조건**으로 분리했다. #12의 누락을 입증한 추가 오류는 없으므로 신규 Governance Workflow나 전역 검사를 추가하지 않고 **DONE_NO_CHANGE**.
- 관련 브라우저 CI [#45694551870](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45694551870)도 **SUCCESS**; #1과 중복 시험을 새로 만들지 않았다.

### #29 Bundle Size — 기존 기준선 원본 비교 결과

- [Node CI Run #45691667146](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45691667146)와 [#45691870499](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45691870499)의 기존 `client-bundle-size-report` ZIP 아티팩트(각 `report.json`)를 GitHub 공식 읽기로 회수, **스키마 1·`dist/client/assets/*.js,*.css` 범위 일치** 확인.
- JS **102파일, 1,715,802 raw bytes, 563,383 gzip 추정 bytes**, CSS **27파일, 719,954 raw bytes, 129,355 gzip 추정 bytes**로 두 결과 일치. **총 129개 파일 개별 SHA-256 일치**, JS/CSS raw·gzip 증감 **모두 0 bytes**.
- 따라서 비교 가능한 baseline 아티팩트가 존재하지 않는다는 가설은 반증. [웹 PR #1636](https://github.com/ansqhd5774-Choi/zgmini/pull/1636)은 기존 Node CI에 공식 GitHub Actions 읽기·이전 main 성공 결과 아티팩트 조회·기존 비교 함수 활용을 연결하고, 결측을 가짜 0%/PASS로 만들지 않는 선택적 관측만 추가했다. **최종 CI·main 병합 검증이 완료되어 #29는 DONE_FIXED**. 새 예산 임계값·강제 Gate 없음.

### #29 최종 실패 원인·수정·실제 검증

- 최초 [PR #1636 Run #45696385288](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45696385288)은 **Node CI 실패**(다른 CodeQL/Secret 성공). 실제 원인은 `Regression tests` 중 7건: 기존 여러 테스트가 `continue-on-error: true`를 전역 거부했으며, 신규 아티팩트 목록 시험의 `total_count` 검사가 불충분했다. 비교·다운로드가 성공한 사실과 PR 전체 PASS는 구분했다.
- 최소 수정: **`continue-on-error` 제거**, 기존 GitHub-hosted Runner의 공식 `gh run download`를 읽기 전용·고정 인자·bounded timeout으로 호출하는 선택형 Node 경로에 통합. 다운로드/권한/아티팩트 결측 시 `UNVERIFIED/UNAVAILABLE` 보고로 구분하고 필수 기존 단계는 그대로 fail-closed. 아티팩트 목록 불완전은 정확히 거부. 관련 fixture·회귀시험 재검증.
- 최종 PR 정확 HEAD `2bada35e0520b88a0656a29b7594d42ab3dac1ba`: [Node CI #45697071567](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45697071567), [CodeQL #45697071625](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45697071625), [Secret #45697071579](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45697071579) **3/3 SUCCESS**.
- 정확 HEAD CI 아티팩트 `client-bundle-size-report` (ID `15061122822`) 실제 ZIP readback: `comparison.json` + `report.json`; `status=COMPARABLE`, `baselineRunId=45696149190`, JS·CSS raw/gzip **0 bytes delta** (해당 두 샘플에만 해당). 누락 baseline을 0으로 위조한 결과가 아니다.
- [웹 PR #1636](https://github.com/ansqhd5774-Choi/zgmini/pull/1636) 병합 `2112c2e83870e705fda078d266f79857cb9d1267`; 기존 Node Workflow·두 스크립트·두 시험 **총 5개 파일**의 `main` 원격 blob readback 완료. CI PASS/소스 병합과 웹 운영 배포·공급자 수집·DB/D1 게시 완료는 분리한다.

## 7. 후속 개선 종료 판정 (2026-11-26)

- **완료 6/6**: `DONE_FIXED` 3개 (#1 트리거, #19 관측 조회, #29 번들 과거 비교) + `DONE_NO_CHANGE` 3개 (#12 Workflow Governance, #23 관측형 Cross-browser, #25 접근성 미확정 결과의 안전한 구분).
- #25 실제 페이지 색 대비의 자동 판정 불가 (`color-contrast` 모바일 노드 3·데스크톱 노드 1)는 **UI 실제 적합성 미입증**이며 새로운 CI 미완료나 강제 Gate로 승격하지 않는다.
- 기존 채택 R1 8/8·R2 11/11=19/19의 실행 계약 보존. 사용자 제외한 R2 #8 Good/P75/Performance Budget 재도입 없음.
- 이 원장은 기존 자동화 담당 전용 브랜치의 해당 문서에만 반영한다. 전체 오래된 브랜치의 무단 `main` 병합, 예약·Runner·PC·Cloudflare·원자료/DB/D1 운영 변경·유료 서비스 추가는 수행하지 않았다.

## 8. #25 실제 UI 색 대비 별도 후속 검증 — 2026-11-26

**원래 CI 개선 6/6 완료 판정은 보존한다.** 사용자가 추가로 작업을 지시하여 #25 검사 결과에 남아 있던 실제 색 대비 미확정 범위를, 기존 접근성 정책과 UI 소스에서 별도 조사했다. 조사와 직접 발견된 UI 결함을 구분한다.

- 기존 [Browser Run #45688120760](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45688120760)의 `ci-accessibility/summary.json`: `violatedRules=0`, `incomplete color-contrast`는 모바일 390px 3노드/데스크톱 1440px 1노드. 현재 CI는 `OBSERVED_ONLY_NO_GATING` 및 미확정을 유지하며, 자동 검사만으로 전체 페이지 적합성 확정 불가.
- 같은 Run의 기존 `fear-greed-education/search-about-390.png`, `search-about-1440.png` 실제 스크린샷과 웹 `main`의 `app/about/page.tsx`, `app/about/about.module.css`를 비교. 기본 페이지 배경 `#10171c`에 `hello #8bbba9`, `lead #cbd4db`, `h1 #f5f7fa` 등의 명시 대비는 각각 8.42:1·12.04:1·16.85:1(배경 장식 합성 전)로 일반·큰 텍스트 기준 충족. 모바일 장식 이미지의 opacity 0.18로 흰색 최대 합성색을 가정한 `hello` 대비는 최소 4.82:1. **이는 해당 색상 조합의 수학적 검증으로, axe 미확정 개별 노드를 확정 PASS로 소급 변경하지 않는다.**
- **별도 실제 결함 발견:** `/about/` 하단 `시장 대시보드 보기` 링크의 기본 `#f8fffc` / `#08785b` 대비 **5.38:1**이지만 `:hover` `#f8fffc` / `#0c956e`는 **3.74:1**로 16px 텍스트 WCAG AA 4.5:1 미달. 정적 axe 원래 스캔은 hover 동작을 자동 포함하지 않으므로 기존 위반 0건과 모순되지 않는다.
- [웹 전용 PR #1638](https://github.com/ansqhd5774-Choi/zgmini/pull/1638): 수정 대상은 `app/about/about.module.css`의 hover 색상 1개(`#0a8062`, 계산 대비 **4.84:1**)와 기존 `tests/fear-greed-education-browser-r4.mjs`의 390/1440 실제 브라우저 `getComputedStyle`·hover 검증 추가. 새 Workflow·글로벌 Gate·#8 Good/P75 재도입 없음.
- **상태: RUNNING**. PR 정확 HEAD CI·병합 SHA·`main` 재조회 전에는 운영 반영·완료로 계산하지 않는다. 원래 axe incomplete 규칙의 원인이 이번 hover라고 단정하지 않고 별도 미확인으로 보존한다.
