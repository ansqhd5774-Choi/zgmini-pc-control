
# ZGMINI 차세대 CI 및 GitHub Actions 40종 도입 검토 R1

기준일: 2026-11-25 (Asia/Seoul). 담당: 자동화 프로세스 전문가.
저장소: `ansqhd5774-Choi/zgmini`, `ansqhd5774-Choi/zgmini-pc-control`.
검토 기준 source: 본체 `main@30f4ff22255f5b91f21424c6a5a6471356579728`, PC 제어 `main@41f38edfd7cc568632ec2641c85e709d1564cd8e`. 런이 갱신되면 별도 기준시각 적용.
작업 기록 브랜치: PC 제어 `codex/pc-automation-process-improvement-20261119` (기존 자동화 전문가 전용). **이 브랜치는 조사 시작 시 main보다 999+커밋 뒤지고 6커밋 고유 변경이 존재한다. 브랜치 전체를 main에 병합하지 않는다.**
기존 8종 CI 보존, AI API/유료 서비스/추가 Runner/예약/운영 변경/배포/D1 쓰기/임의 재승인 금지.

## 판정 원칙

- `IMPLEMENTED`는 **지정된 범위**의 기존 소스와 관련 CI 유효 실행 증거. 공용 기능 전부에서 보편적 완료를 뜻하지 않는다.
- `PARTIAL`: 실제 관련 기능이 있으나 제품 전체·실제 서비스·원하는 수준 미달. `NOT_CONFIGURED`: 적용 가능한 자동 검사가 현재 확인한 소스에서 없음. `DUPLICATED`: 신규 제품이 실질적으로 기존 기능을 반복. `NOT_APPLICABLE`: 현재 구조/권리/공식 제공 조건상 부적합.
- 상태와 최종 조치(유지·고도화·보류·제외)는 다른 기준이다. 본 문서의 점수는 **정성적 채택 적합도 사전 평가**, 성능 개선율이나 운영 보증 수치가 아니다.
- 점수는 요청한 가중치 20/20/15/10/10/10/10/5(구조/효과/완성도/유지보수/호환/보안/비용/라이선스) 각각을 0–5 등급으로 평가해 `Σ(등급×배점/5)`로 계산했다. 비용·라이선스·현행 소스 등 추가 확인이 필요한 건 **최종 채택 승인 아님**. 개별 8항목 기초 등급은 본 문서의 평가등급 원장에서 재현할 수 있으며, 점수 자체는 측정값이 아님.

## 1. 양대 저장소 기존 CI·Runner·IssueOps 실사

- 본체 `.github/workflows/` **8파일**, PC 제어 **63파일** 확인(2026-11-25 GitHub contents API, 파일 수이며 활성/최종 성공 건수 아님).
- 본체 [8영역 정본](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/CI_EIGHT_AREA_STANDARD_R1.md): Node.js CI `npm ci`·Build·Typecheck·Unit·Mock 계약·변경 소스 ESLint·npm audit, CodeQL, Secret Scan, 기존 Chromium Playwright, SEO 검사, 업로드 아티팩트. 전 사이트/다중 브라우저 E2E 미보장.
- PC 제어 [8영역 정본](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/CI_EIGHT_AREA_STANDARD_R1.md): TS 전용 typecheck 및 웹 Build는 구조상 N/A, C996 변경 소스 격리 시험·Controller/Writer 계약 E2E·Zizmor 변경 YAML 보안·Gitleaks/Oxlint. `zgmini-handoff-ci-isolated`는 격리 Windows Runner; 운영 PC 6 Runner와 구분.
- 기존 권한/실행·복구 계약·IssueOps/ChatOps·이력/JSON/TXT readback 재사용. `workflow_run` 실패 자동 Issue는 PC [#3477](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3477)·[#3478](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3478) 실제 사례로 실증. 본체는 등록 Workflow 호출 확인, 실패 후 Issue 생성은 별도 미실증.
- 기존 PC Watchdog/보호 drift, Cloudflare Git 자동배포, 원자료 SQLite→공개 projection 구조는 임의로 변경하지 않는다. GitHub `schedule` 15분 조사 재개는 기존 사용자 종료 결정에 따라 금지.

## 2. 후보 40개 1차 상태·공개 소스 매칭·평가

| 번호 | 기술 | 기존 상태 | 참고 저장소 | 예비 적합도 | 결정 | 개선 대상·중복 판단 | ZGMINI 실제 근거 |
|---:|---|---|---|---:|---|---|---|
| 1 | Dynamic CI | PARTIAL | [dorny/paths-filter](https://github.com/dorny/paths-filter) | 88/100 | 고도화 | 본체 paths, PC 변경소스 선별; 필수 검사 누락 금지 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml), [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 2 | Risk-based CI | PARTIAL | [open-policy-agent/opa](https://github.com/open-policy-agent/opa) | 68/100 | 보류 | 기존 위험·승인 보호 있으나 OPA 자동 등급은 없음; 신규 글로벌 Gate 금지 | [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 3 | Test Impact Analysis | PARTIAL | [nrwl/nx](https://github.com/nrwl/nx) | 74/100 | 보류 | PC changed-source 시험 선택 있음; Nx 영향그래프 없는 양대 저장소 | [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 4 | Distributed CI | NOT_APPLICABLE | [nrwl/nx](https://github.com/nrwl/nx) | 52/100 | 제외 | Nx Cloud 분산 Workers는 현 격리 Windows Runner 계약·비용과 충돌 | [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 5 | Mutation Testing | NOT_CONFIGURED | [stryker-mutator/stryker-js](https://github.com/stryker-mutator/stryker-js) | 69/100 | 보류 | 순수 함수 소수에만 격리 파일럿 가능; 전체 Suite는 고비용 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml) |
| 6 | Architecture Testing | NOT_CONFIGURED | [sverweij/dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | 81/100 | 고도화 | 웹 lib/worker 경계 또는 PC controller/writer 의존성의 기존 계약 위반 탐지 후보 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml), [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 7 | Contract Testing | PARTIAL | [pact-foundation/pact-js](https://github.com/pact-foundation/pact-js) | 85/100 | 유지 | 기존 Projection·Writer JSON/TXT 계약 시험 존재; Pact 별도 도입 중복 우려 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml), [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 8 | Performance Budget | NOT_CONFIGURED | [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) | 83/100 | 고도화 | 사이트 성능 상한·렌더링 회귀 자동 수치 부족; 무료 격리 브라우저 우선 | [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml) |
| 9 | Policy as Code | PARTIAL | [open-policy-agent/opa](https://github.com/open-policy-agent/opa) | 86/100 | 유지 | 기존 CAS/승인·원자료 보호 정책 검사 유지; OPA 엔진 중복 도입 보류 | [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 10 | Merge Queue | NOT_APPLICABLE | [GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) | 42/100 | 제외 | 두 저장소 모두 개인 User 소유; 공식 Merge Queue 조직 소유만 지원 | [본체 저장소](https://github.com/ansqhd5774-Choi/zgmini) |
| 11 | Centralized CI | DUPLICATED | [actions/starter-workflows](https://github.com/actions/starter-workflows) | 65/100 | 제외 | 기존 공식 CI 참고해 구성; 이질적인 Linux/Windows 공통 워크플로 강제 비효율 | [기존 8영역 정본](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/CI_EIGHT_AREA_STANDARD_R1.md) |
| 12 | Workflow Governance | PARTIAL | [rhysd/actionlint](https://github.com/rhysd/actionlint) | 87/100 | 고도화 | PC Zizmor는 보안 감사; Actions YAML 정적 문법·표현식 검증은 별개 | [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 13 | Evidence-based CI | IMPLEMENTED | [actions/upload-artifact](https://github.com/actions/upload-artifact) | 100/100 | 유지 | 본체 CSS/JS·브라우저 아티팩트, PC JSON/TXT readback 증거 존재 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml), [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml), [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 14 | Artifact Attestation | NOT_CONFIGURED | [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance) | 70/100 | 보류 | GitHub 산출물 서명과 PC 원자료 해시 감사를 혼동 금지; id-token 권한 확인 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml) |
| 15 | Supply Chain Security | PARTIAL | [actions/dependency-review-action](https://github.com/actions/dependency-review-action) | 86/100 | 고도화 | 본체 npm audit·CodeQL·Secret 이미 있음; PR 의존성 diff는 별도 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml) |
| 16 | Security Scorecard | NOT_CONFIGURED | [ossf/scorecard](https://github.com/ossf/scorecard) | 82/100 | 보류 | 공개 본체의 보안 태세 평가 가능; 새 전역 차단 없이 읽기 전용 우선 | [웹 CodeQL](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/codeql-source.yml) |
| 17 | Continuous Verification | PARTIAL | [upptime/upptime](https://github.com/upptime/upptime) | 86/100 | 유지 | Production SEO Health 및 기존 PC 감시/진단 존재; 예약 추가 금지 | [Production SEO](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/seo-production-health.yml), [PC 장애 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/agent-handoff-pc-failure-intake.yml) |
| 18 | Drift Detection | PARTIAL | [suzuki-shunsuke/tfaction](https://github.com/suzuki-shunsuke/tfaction) | 70/100 | 유지 | PC watchdog·CAS 드리프트 검증 존재; Terraform 전용 tfaction은 미적합 | [PC watchdog 원본](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/watchdog-b/protected-drift-readonly.mjs) |
| 19 | CI Observability | PARTIAL | [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | 88/100 | 고도화 | GitHub API 자체 메타데이터로 대기·실행·실패 관측 가능; Collector 신규 배포는 보류 | [웹 Actions 실행 목록](https://github.com/ansqhd5774-Choi/zgmini/actions) |
| 20 | Data CI | PARTIAL | [fivetran/great_expectations](https://github.com/fivetran/great_expectations) | 79/100 | 고도화 | 기존 저장 데이터 계약 검사 존재; Python 도구보다 현재 Node SQLite readback 확장 우선 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml), [PC C996](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/c996-r5-readonly-source-checks.yml) |
| 21 | Visual Regression CI | PARTIAL | [primer/react](https://github.com/primer/react) | 59/100 | 보류 | 스크린샷 증거는 존재; Primer는 디자인 시스템이지 비교 엔진 아님 | [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml) |
| 22 | Responsive CI | IMPLEMENTED | [microsoft/playwright](https://github.com/microsoft/playwright) | 98/100 | 유지 | Chromium Playwright 390/768/1440/1920 및 실제 모바일 touch 테스트 | [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml) |
| 23 | Cross-browser CI | NOT_CONFIGURED | [microsoft/playwright](https://github.com/microsoft/playwright) | 84/100 | 고도화 | 현재 Chromium만 설치; Firefox/WebKit은 핵심화면에 한정 파일럿 | [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml) |
| 24 | Performance CI | NOT_CONFIGURED | [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) | 83/100 | 고도화 | 기존 빌드·브라우저 검증과 별개로 LCP/CLS 회귀 측정 필요 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml), [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml) |
| 25 | Accessibility CI | PARTIAL | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | 86/100 | 고도화 | 기존 접근성 일부 계약시험; 브라우저 axe 실제 탐지 통합은 미확인 | [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml) |
| 26 | Component CI | PARTIAL | [storybookjs/storybook](https://github.com/storybookjs/storybook) | 72/100 | 보류 | 컴포넌트 경로 단위 테스트 일부, Storybook 도입은 별도 번들/유지 비용 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml) |
| 27 | Interaction CI | IMPLEMENTED | [grafana/grafana](https://github.com/grafana/grafana) | 44/100 | 유지 | 상호작용 Playwright 이미 수행; Grafana는 테스트 엔진이 아님 | [웹 Playwright](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/community-chat-browser.yml) |
| 28 | SEO CI | IMPLEMENTED | [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) | 90/100 | 유지 | SEO Production Health/메타 검증 이미 있음; Lighthouse 점수는 별도 성능 | [Production SEO](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/seo-production-health.yml) |
| 29 | Bundle Size CI | NOT_CONFIGURED | [ai/size-limit](https://github.com/ai/size-limit) | 81/100 | 고도화 | 빌드 CSS/JS 아티팩트 존재하나 byte budget 자동 회귀는 없음 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml) |
| 30 | Preview CI | NOT_CONFIGURED | [modelcontextprotocol/actions](https://github.com/modelcontextprotocol/actions) | 31/100 | 보류 | MCP repo 관리용 Actions이며 일반 Preview 플랫폼 아님; Cloudflare 변경 승인 별도 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml) |
| 31 | IssueOps | IMPLEMENTED | [github/command](https://github.com/github/command) | 100/100 | 유지 | PC Issue→Actions→Controller 요청/증거 수집 운영 경로 이미 검증 | [PC Job](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/.github/workflows/pc-job.yml) |
| 32 | ChatOps | PARTIAL | [peter-evans/slash-command-dispatch](https://github.com/peter-evans/slash-command-dispatch) | 70/100 | 유지 | 기존 댓글 기반 인증 접수·인계 있음; 범용 slash 명령은 권한 확대 | [PC 장애 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/agent-handoff-pc-failure-intake.yml) |
| 33 | Multi-Repo Automation | PARTIAL | [peter-evans/repository-dispatch](https://github.com/peter-evans/repository-dispatch) | 72/100 | 보류 | 본체·PC 인계/원장 연계는 있으나 신규 cross repo dispatch 권한 재승인 필요 | [PC 장애 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/agent-handoff-pc-failure-intake.yml) |
| 34 | Git Scraping | NOT_APPLICABLE | [simonw/git-scraper-template](https://github.com/simonw/git-scraper-template) | 38/100 | 제외 | 금융 원자료는 승인 공급자→PC SQLite 계약; Git에 원자료 게시 금지 | [PC 정본](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/PC_AUTOMATION_STANDARD.md) |
| 35 | Continuous Monitoring | IMPLEMENTED | [upptime/upptime](https://github.com/upptime/upptime) | 86/100 | 유지 | 기존 workflow_run 실패 자동 Issue+PC 장애 인계/감시; Upptime 중복 | [CI 실패 Issue intake](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/ci-failure-issue-intake.yml), [PC 장애 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/41f38edfd7cc568632ec2641c85e709d1564cd8e/.github/workflows/agent-handoff-pc-failure-intake.yml) |
| 36 | Continuous Benchmarking | NOT_CONFIGURED | [benchmark-action/github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark) | 82/100 | 고도화 | 현재 CI job 메타데이터 기반 read-only 추세선 우선, 신규 배포 페이지 불필요 | [웹 Actions 실행 목록](https://github.com/ansqhd5774-Choi/zgmini/actions) |
| 37 | Continuous Maintenance | PARTIAL | [renovatebot/renovate](https://github.com/renovatebot/renovate) | 64/100 | 보류 | npm audit 등 검사 있음; 자동 업데이트/PR 빈도·권한·라이선스 별도 | [웹 Node CI](https://github.com/ansqhd5774-Choi/zgmini/blob/30f4ff22255f5b91f21424c6a5a6471356579728/.github/workflows/node.js.yml) |
| 38 | Continuous Release | NOT_APPLICABLE | [googleapis/release-please-action](https://github.com/googleapis/release-please-action) | 54/100 | 제외 | 사이트 main→Cloudflare Git Integration 배포; 버전 릴리스 자동화 요청 없음 | [기존 8영역 정본](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/CI_EIGHT_AREA_STANDARD_R1.md) |
| 39 | Self-Service Operations | IMPLEMENTED | [issue-ops/self-service](https://github.com/issue-ops/self-service) | 79/100 | 유지 | 승인 pc-job IssueOps 운영 존재; 외부 Github Pages 포털은 보안 위험·중복 | [PC Job](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/.github/workflows/pc-job.yml) |
| 40 | Continuous Reconciliation | PARTIAL | [suzuki-shunsuke/tfaction](https://github.com/suzuki-shunsuke/tfaction) | 74/100 | 유지 | PC CAS·원장/Checkpoint와 Cloudflare 배포 readback 존재; terraform 자동 적용 불필요 | [PC 정본](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/PC_AUTOMATION_STANDARD.md) |

**집계:** 기존상태 PARTIAL 18 / NOT_APPLICABLE 4 / NOT_CONFIGURED 10 / DUPLICATED 1 / IMPLEMENTED 7.
**조치:** 고도화 12 / 보류 10 / 제외 5 / 유지 13.
**실제 신규 구현: 0건. 기존 코드 변경: 0건.** 동일 기능 중복 추가는 하지 않았다.
예비평가의 출처가 GitHub repo 메타데이터인 항목은 Workflow 원본·라이선스·릴리스/실제 테스트까지 검증된 채택 단계와 구분한다.

### 원본 소스·라이선스·최신성 스냅샷

다음 후보는 공개 GitHub REST 저장소 메타데이터·라이선스·최신 HEAD 또는 릴리스를 직접 확인했다. SHA는 **검토 원본 commit**이며 채택하는 GitHub Actions의 안전 pin을 자동 승인하는 값이 아니다.

| 후보 | 확인한 upstream SHA | 라이선스 | 확인한 Release | 적용 판단 |
|---|---|---|---|---|
| [actionlint](https://github.com/rhysd/actionlint) | `011a6d15e749bb3f2d771eed9c7aa0e7e3e10ee7` | MIT | v1.7.12 (2026-03-30) | 워크플로 정적 검사 우선 후보, Windows/Linux 설치 패키지 SHA256·출력 안전 확인 필요 |
| [paths-filter](https://github.com/dorny/paths-filter) | `f3360c560367c9daf72b88c0e6164162034c5721` | MIT | v4.0.3 (2026-08-05) | 기존 paths 필터·changed-source 선택을 재사용하고 새 권한/검사 생략 금지 |
| [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) | `947c5790b8e2c29259c65a6cfebfb89432555bc8` | Apache-2.0 | v0.16.1 (2026-11-11) | 브라우저 범위·비공개 지표/성능 오탐·리소스 비용 제한 |
| [axe-core](https://github.com/dequelabs/axe-core) | `32d9bd503128d4b52d818ca89140c1debe5d70d5` | MPL-2.0 | v4.14.1 (2026-11-16) | 기존 Playwright 소수 주요 화면에서 시작 |
| [size-limit](https://github.com/ai/size-limit) | `67eca850f776bd8a528a4f660e448e42662536e1` | MIT | v14.3.0 (2026-10-22) | 현재 dist/client 자산 기준선 확보 후 PR 차이만 검증 |
| [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | `65ae57fe4afaf18aa9e9cc29df7fabdbc658cba7` | MIT | v18.9.0 (2026-11-22) | 한정된 레이어 의존성 규칙만; 전체 모듈 정책 무조건 차단 금지 |
| [dependency-review-action](https://github.com/actions/dependency-review-action) | `bbc44d14a204704ccc493733616cd1e93a0321ec` | MIT | v5.0.1 (2026-11-17) | 본체 npm audit와 중복 여부, private 기능·추가 권한 먼저 확인 |
| [OpenSSF Scorecard](https://github.com/ossf/scorecard) | `789a810815a4398abf14b10898b111d3ced5d94d` | Apache-2.0 | 미조회 | 우선 read-only 진단, 전역 보안 gate 금지 |

- `great-expectations/great_expectations`는 기존 이름이 이전됐고 현재 검증된 소스는 [fivetran/great_expectations](https://github.com/fivetran/great_expectations)(Apache-2.0). Node 중심 ZGMINI에 Python 런타임을 추가하는 전제는 두지 않는다.
- `modelcontextprotocol/actions`는 MCP 프로젝트 관리용 GitHub composite Actions로 일반 웹 Preview 호스팅 솔루션이 아니다.
- `primer/react`는 React 디자인 시스템. 단독 visual-diff 검출기가 아니다.
- `grafana/grafana`는 AGPL-3.0 관측 플랫폼. Playwright 금융 차트 동작 시험의 직접 구현 대체가 아니다.
- GitHub Merge Queue는 [공식 문서](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)상 조직 소유 대상. 실제 두 저장소 owner.type=User이며 개인 계정 구조에서는 도입 불가.
- `tfaction`은 Terraform 모노레포 전용 제어에 가깝다. 현재 ZGMINI PC Writer/Controller 설정을 Terraform 자동 적용으로 교체하지 않는다.
- `Renovate` 상위 소스 라이선스 AGPL-3.0; 별도 Bot 권한/자동 PR/라이선스 조건에 따라 보류.
- `pact-js`는 GitHub metadata LICENSE가 NOASSERTION으로 보고되므로 실제 LICENSE와 인용/재사용 조건을 재검증하기 전 외부 코드 복사 금지.
- 대표 최신 upstream 소스와 실행 범위는 해당 링크의 README·Action manifest/릴리스로 검증하며, 유명도/Stars만으로 점수를 부여하지 않는다.

## 3. 선별 설계 — 기존 CI에만 통합, 새 Workflow·Runner·예약 0건

| 우선 | 기능 | 구체적 구현 방식 | 실행 범위·보호 |
|---|---|---|---|
| A | #19 CI Observability / #36 Benchmark | GitHub 공식 Actions Runs+Jobs GET에서 정확한 Job started/created/completed·HEAD·conclusion 추출. 기존 자료로 오프라인 baseline과 비교표 작성 | Actions 권한 read-only, 민감 로그/토큰 저장 금지. 주기 예약/새 Runner/Collector 도입 금지 |
| A | #12 Workflow Governance | 검토된 `actionlint` 실행 소스·버전·SHA256 고정 후 **기존 PC C996·웹 Node CI의 변경 YAML 경로**만 평가. Zizmor 보안 검사와 별개 문법/표현식 검사 | PC 격리 Windows, 신규 native 도구 실행 전 검증. 전체 63개 legacy 경고를 갑자기 차단하지 않음 |
| B | #29 Bundle Size | 기존 웹 Node CI에서 생성된 `dist/client/assets/*.js,*.css`의 합계·비교 기준·압축 여부·해시/매니페스트를 먼저 고정; 실제 diff만 계산 | 근거 없는 byte threshold·무관 PR 전역 차단 금지; 7일 아티팩트 재사용 |
| B | #25 Accessibility / #23 Cross-browser | 기존 `community-chat-browser.yml` 지정한 주요 차트·버튼에 axe-core, Firefox/WebKit 각각 1개 지정 테스트를 **격리 파일럿** | 추가 브라우저 설치시간·flake·Linux 종속성 및 Production read-only 검증 후 확대 |
| C | #6 Architecture / #20 Data CI | 기존 Node test runner로 approved source import closure·저장 결과 0/null/missing/stale·정확 key/time/version을 먼저 검증 | Controller/Writer 운영 source·산식·저장·게시 권한 건드리지 않음 |
| 보류/제외 | Nx 분산·Merge Queue·외부 감시·Git Scraping·MCP Preview·tfaction 자동 적용 | 운영 구조·권한·유료/배포 위험 대비 현재 검증된 개선 효과 부족 | 재승인 없는 새 운영 효과 금지 |

**우선 적용 결정:** 실행 가능한 첫 후보는 #19의 **GitHub API 메타데이터 기반 읽기 전용 기준 측정**이다. 이미 이 조사에서 실제 Run/Job 메타데이터로 시험했으며 별도 Runtime, cron, 외부 SaaS, 비용 없이 확대 가능하다. 이후 검증된 레포 소스만 조건부 도입한다.

## 4. 개선 전 실측 기준 (GitHub Actions Run/Job 원본)

2026-11-25 KST 조사. 각 Run의 Job `created_at`, `started_at`, `completed_at` 사용. 성공 완료 표본·상대적으로 가까운 시각으로만 구성. queue는 Job 시작 전, execution은 Job started→completed. 단순 workflow `run_started_at`로 queue를 0초라고 계산하는 오류를 피한다.

| 저장소/Job | n | 실제 Run IDs | 평균 Job 대기(초) | 평균 Job 실행(초) |
|---|---:|---|---:|---:|
| 웹 Node.js CI | 5 | 45475575381, 45475125294, 45474774021, 45474652442, 45474236033 | 1.6 | 105 |
| PC C996 | 5 | 45474797187, 45474245771, 45473804982, 45472462284, 45472220424 | 86.6 | 28.6 |
| PC Gitleaks/Oxlint Secret | 3 | 45474797091, 45474245904, 45473804895 | 17.3 | 33 |

- 실제 반복 실행·부하 분포·runner resource·비용·flake·검사 누락·장애 복구·공개 웹 성능·금융 데이터 최신성 등은 이 샘플에서 결정 불가: **UNVERIFIED**. 개선 효과·후측정값 임의 생성 금지.
- PC 대기시간이 실행시간보다 긴 표본의 원인이 동일하다고 단정할 수 없음. 격리 Runner 수 증가·예약 추가·안전 게이트 완화로 즉시 해소하지 않는다.
- 본체의 Build 산출물 CSS/JS upload, 웹 Playwright 다중 viewport 시험, PC C996·Secret Scan 실제 CI SUCCESS는 [기존 표준 증거](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/CI_EIGHT_AREA_STANDARD_R1.md)를 재사용한다.

## 5. 5단계 실행 원장과 다음 필수 행동

| 단계 | 현재 판정 | 유효 증거 | 미완료 |
|---|---|---|---|
| 1. 기존 시스템 조사 | 소스·대표 CI/Runner 증거 수집 | GitHub Workflow 8/63, 8종 정본, 원본 Run/Job 시각 | 설정 활성 전수/PC 운영 현황과 실제 실행은 범위별 미확인 |
| 2. 40종 매칭 | **40/40 1차 분류** | 위 40행, 32개가량 공개 저장소 메타데이터 및 선별 upstream SHA | 각 후보 전체 원본·라이선스·사용조건·실행 검증은 미완료 |
| 3. 선별 설계 | 우선 후보와 제외 범위 작성 | 상기 설계 표 | native 도구 SHA pin·브라우저 비용·사업자 조건 |
| 4. 코드 구현/시뮬레이션 | 미착수 | 구현 0/검증 0 | 정확 후보가 런타임 비용·검사 범위 증가 없이 가치 입증된 뒤 변경 |
| 5. 실제 CI/병합/성과 | 미착수 | 기존 CI 8종은 종전 완료 증거 재사용 | 신규 변경의 정확 HEAD CI·readback·전후 효과 |

**계획상의 20/40/60/80/100%는 단계 완료 기준이지 조사만으로 전체 작업 60%를 선언하는 숫자가 아니다. 현재 신규 도입 구현은 0건이며 단계 4–5는 완료 처리하지 않는다.**

**다음 필수 행동:** #19 read-only 측정 소스/시험 설계를 최신 main과 병렬 운영 작업 영향이 없는 경로에 분리해 실행; 실제 기여가 없다면 새 코드 추가 없이 현재 GitHub GET 관측을 재사용한다. #12/25/29는 현재 CI에 검증된 누락만 최소 변경으로 연결하며 새 운영 승인/유료 권한은 별도 판단한다. 기존 자동화 담당 전용 브랜치와 최신 main의 커밋 이력 차이는 통째 PR/강제 리베이스하지 않고 정확 파일 단위로만 추후 통합한다.

## 부록: 40종 8항목 등급 원장 (계산 재현용)

각 등급은 0–5의 정성 평가다. 열 순서: 기술 구조 적합성, 실제 개선 효과, 안정성, 유지보수, 호환성, 보안, 비용, 라이선스. **이 등급은 실측 성과가 아니다.**

```csv
번호,구조,효과,완성도,유지,호환,보안,비용,라이선스,점수
1,4,4,5,5,4,4,5,5,88
2,2,3,5,5,2,4,3,5,68
3,3,3,5,5,3,4,3,5,74
4,1,2,5,5,1,3,1,5,52
5,3,3,4,4,3,4,3,5,69
6,4,4,4,4,4,4,4,5,81
7,4,4,5,5,4,5,4,2,85
8,4,4,4,5,4,4,4,5,83
9,3,4,5,5,4,5,5,5,86
10,0,1,5,5,0,3,1,5,42
11,2,2,5,5,2,5,4,2,65
12,5,4,4,4,4,4,5,5,87
13,5,5,5,5,5,5,5,5,100
14,3,3,5,4,3,3,3,5,70
15,4,4,5,5,4,4,4,5,86
16,4,3,5,5,4,4,4,5,82
17,4,4,5,5,4,4,4,5,86
18,2,3,5,5,2,4,4,5,70
19,4,4,5,5,4,4,5,5,88
20,4,4,4,5,3,4,3,5,79
21,2,2,4,4,2,4,3,5,59
22,5,5,5,5,5,5,4,5,98
23,4,4,5,5,4,4,3,5,84
24,4,4,4,5,4,4,4,5,83
25,4,4,5,5,4,4,4,5,86
26,3,3,5,5,3,4,2,5,72
27,1,1,5,5,1,3,1,1,44
28,5,4,5,5,4,4,4,5,90
29,4,4,4,4,4,4,4,5,81
30,0,0,2,3,0,3,4,5,31
31,5,5,5,5,5,5,5,5,100
32,3,2,5,5,3,3,4,5,70
33,3,4,5,5,2,2,3,5,72
34,1,1,4,3,1,1,3,2,38
35,4,4,5,5,4,4,4,5,86
36,4,3,5,5,4,4,4,5,82
37,3,3,5,5,2,3,2,1,64
38,1,1,5,5,1,3,4,5,54
39,4,3,4,4,4,4,5,5,79
40,3,3,5,5,3,4,3,5,74
```


## R2 적용 진행 증거 — 2026-11-25 (R1 최초 판정 이후)

이 절은 위 1차 조사표의 **시점 이후 실제 추가된 변경**만 기록한다. 40개 후보 전부가 구현됐다는 뜻은 아니다.

| R2 후보 | 적용 효과 | 분리 작업 브랜치 | PR·main 병합 | 실제 검사 | 운영 효과·한계 |
|---|---|---|---|---|---|
| #19 CI Observability | GitHub API Run/Job의 정확 `created_at→started_at` 대기시간과 `started_at→completed_at` 실행시간 요약기, rerun attempt·누락 fail-closed | `codex/pc-automation-process-improvement-20261119-ci-metrics-r1` | [PC PR #3483](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3483) 병합 `31fad3098bf06553b486ccf8902cb68b4201d1c8` | [C996 #45480699312](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45480699312) 신규 테스트 7/7 PASS, [Secret #45480699180](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45480699180) SUCCESS, main 파일 readback | 읽기 전용 CLI·모듈 구현 완료. 신규 예약·자동 실행은 없음. fixture 검증과 실제 API 측정의 차이를 유지하며 속도 향상은 주장하지 않음 |
| #12 Workflow Governance | 원본 actionlint v1.7.12 MIT·Linux tarball SHA256 `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`를 검증해 변경된 YAML만 기존 Node.js CI에서 정적 검사 | `codex/ci-actionlint-governance-r1-20261125` | [본체 PR #1581](https://github.com/ansqhd5774-Choi/zgmini/pull/1581) 병합 `5d0c95d6dc9b1da17c454474721b03d7f58ff27b` | [Node #45481070398 Attempt 2](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45481070398) SUCCESS, CodeQL #45481070408·Secret #45481070396 SUCCESS, 본체 main readback | YAML 1파일 검사 PASS, GitHub Job step 소요 약 1초(초 단위 시각). 원본 기존 CI 8종 유지, 신규 Workflow/Runner 0건 |

### 신규 실패 관측 및 추적

- 본체 [#1582](https://github.com/ansqhd5774-Choi/zgmini/issues/1582)는 신규 actionlint 코드 결함이 아니라 변경되지 않은 `tests/korea-rev7-d1-status.test.mjs`의 Miniflare 내부 AssertionError로 [Node #45481070398 Attempt 1](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45481070398) 실패 후 자동 생성된 실제 CI Issue다. Attempt 2 전체 성공에도 **flake 근본 원인 미확정**이므로 OPEN으로 보존하고 원인별 원본 로그를 기록했다.
- 본체 [#1576](https://github.com/ansqhd5774-Choi/zgmini/issues/1576)·[#1577](https://github.com/ansqhd5774-Choi/zgmini/issues/1577)도 실제 봇 생성 UI CI 장애로 확인. 이번 CI 도구 변경과 독립이므로 닫거나 기능 소스를 무단 수정하지 않았다.
- 본체 `workflow_run → github-actions[bot] Issue` 운영 실증은 #1582 원본으로 확인됐다. 따라서 R1 이전의 '본체 생성 미실증' 관측은 **이후 실제 증거로 갱신**된다.

### 후속 적용 순서

1. **#1 Dynamic CI**: 기존 paths 필터·changed-source 선별과 공개 `dorny/paths-filter`를 비교, 검사 누락 없이 최적화할 수 있는 조건만 적용.
2. **#29 Bundle Size** 및 **#8/#24 Performance**: 기존 Build CSS/JS 아티팩트에 기준선·동일 조건 비교를 연결. 임의 임계치로 PR 차단하지 않음.
3. **#25 Accessibility/#23 Cross-browser**: 기존 Playwright 대표 화면에 한정해 무료 격리 실증 후 확대.
4. **#6/#15/#20/#36**: 보안·구조·데이터 무결성·성능 통계의 기존 보호와 중복 제거 후 필요한 것만 추가.

**누적 적용 현황(새 R2 변경 기준):** 12종 중 #12·#19 **2종 소스 구현 및 main 병합**, #12는 실제 새 Workflow 검사 실행 PASS, #19는 기존 C996 fixture 회귀시험 PASS/실행 가능한 CLI 구현(정기 실행·운영 자동 호출 미구성). 나머지 10종은 기존 R1 후보 분류 상태를 유지한다. 속도·품질 개선 수치, 새 예약/운영 설치 및 자동 복구 성공률은 별도 운영 증거가 없으므로 미확정.


### #12 actionlint 실제 호환성 보완 — 2026-11-25

- upstream [rhysd/actionlint #746](https://github.com/rhysd/actionlint/issues/746): v1.7.12는 공식 GitHub `concurrency.queue: max`를 잘못된 키로 보고하는 **입증된 오탐 위험**이 있다. ZGMINI의 CI Failure Issue Intake에도 이 키가 사용되므로 초기 #1581 적용만으로 전체 안전성 검증 완료를 주장하지 않는다.
- [본체 PR #1583](https://github.com/ansqhd5774-Choi/zgmini/pull/1583) → main 병합 `39a7a1146f682ff66d6848600ed291747cce11bf`. 기존 queue/Issue intake 동작은 보존하고, actionlint는 오탐인 정확한 key 진단만 좁게 제외하며 신규 Node 검증기로 유효값 `max`/`single`·들여쓰기 오류를 검사한다.
- 실제 changed-workflow에 `queue:max`가 포함된 [Node CI #45482394090](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45482394090)에서 Actionlint 단계 SUCCESS 및 신규 경계 회귀시험 3건 PASS; [CodeQL #45482393353](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45482393353)·[Secret #45482393323](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45482393323) SUCCESS. main 파일 재조회 완료.
- 이는 **#12 구현의 추가 호환성 보정**이며 12종 중 도입 건수에 새 항목으로 중복 산입하지 않는다. 본체 과거 Miniflare 실패 Issue #1582는 원인 미확정으로 OPEN 유지한다.


## R2 후속 실제 구현 증거 — #1 Dynamic CI 및 #29 Bundle Size (2026-11-25)

이 항목은 앞서 기록한 #12 및 #19와 **별도 범위의 후속 적용**이다. 분기된 자동화 전문가 브랜치 전체를 main에 병합하지 않고, 본체 최신 main에서 기능별 전용 브랜치를 만들었다.

| 기술 | 실증된 개선 | PR/본체 main merge SHA | 정확 PR HEAD CI | 남은 범위 |
|---|---|---|---|---|
| **#1 Dynamic CI** | 기존 Playwright `pull_request.paths`가 실제 브라우저 실행 공통 의존성인 `package.json`, `package-lock.json`, `vite.config.ts`를 놓쳐 변경만으로 UI 검사를 생략할 수 있던 결함 수정. 기존 18개 test·뷰포트·원격 읽기만 유지. 독립 Workflow 0개 | [PR #1584](https://github.com/ansqhd5774-Choi/zgmini/pull/1584) → `0e9e9c7862cfd68813c4faf7bdf9b62444ece123` | [Node #45483436147](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45483436147), [CodeQL #45483436020](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45483436020), [Secret #45483436115](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45483436115), [Playwright #45483436045](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45483436045) 모두 SUCCESS; 새 트리거 테스트 PASS | 세 파일 각각만 바뀐 별도 PR로 트리거되는 운영 실증은 미확보. 브라우저 추가 실행에 따른 비용·대기는 후속 표본 축적 전 미확정 |
| **#29 Bundle Size CI** | 기존 Vite Build의 `dist/client/assets/*.js,*.css`에서 원본 바이트·파일별 gzip(level6) 추정·SHA256·합계를 측정하고 JSON 7일 보존. 기존 Node CI 재사용, 새 서비스/의존성/Workflow/Runner 0개 | [PR #1585](https://github.com/ansqhd5774-Choi/zgmini/pull/1585) → `696a09ed99cf4d74ae6274d33e14d8d647fd73de` | 수정 HEAD `25f835cfcffa4d04ee28c3d66a754b6e71bff86b`의 [Node #45484138999](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45484138999), [CodeQL #45484138893](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45484138893), [Secret #45484138898](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45484138898) SUCCESS, 신규 시험 6/6 PASS | 정규 main 간 자동 delta gate/지속 기준선 갱신은 **미구현**, 임의 임계치로 통과/실패 판정 금지 |

### #29 최초 실제 원본 기준과 영향 없음 검증

- 기준 main `39a7a1146f682ff66d6848600ed291747cce11bf`: [Node.js CI #45482923440](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45482923440)의 실제 `production-js-assets` 및 `production-css-assets` 아티팩트 다운로드.
- PR #1585 최초 [Node CI #45483654802](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45483654802)의 신규 `client-bundle-size-report` 다운로드 후 **같은 이름 129개(102 JS/27 CSS)의 SHA256 및 원본 바이트 전부 일치**. 바이트 변경 0건/0B.
- JS: 1,715,802B 원본 / 563,383B gzip 추정, CSS: 719,954B 원본 / 129,355B gzip 추정. 총 2,435,756B 원본 / 692,738B gzip 추정. 이는 전체 파일 합계, 특정 페이지의 실제 다운로드 바이트나 CDN Brotli 전송량이 아니다.
- 수정 HEAD #45484138999의 보고서 ZIP도 독립 회수해 최초 보고서와 파일/집계 전체가 동일함을 확인. 실제 Job 단계 시각상 측정 `Measure client...` = 0초(초 단위 반올림/기록 한계), 작은 JSON 아티팩트 업로드 1초. **전체 CI 성능 개선을 뜻하지 않는다.**

### 이번 작업 중 오류·자동 Issue 증거

- #29 최초 PR HEAD `a3459f6111017fa6fb50eb131ae4fa53aa7bc413`의 [Run #45483654802](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45483654802)는 신규 비교 회귀시험 1건 실패. 원인은 코드에서 미정의 `k` 사용, 실제 사용해야 할 `kind` 변수로 **최소 한 줄 수정**. 수정 뒤 Node·보안 CI 성공과 main readback 완료.
- 해당 실패는 CI 자동 등록 기존 [Issue #1582](https://github.com/ansqhd5774-Choi/zgmini/issues/1582)에 자동 댓글로 연결됐다. 같은 Workflow/Job/Step일 뿐, 최초 Miniflare AssertionError와는 별개 원인이다. 완료 근거를 추가 기록했고 **최초 Miniflare 원인 미확정으로 Issue OPEN 유지**.
- 기존 [#1576](https://github.com/ansqhd5774-Choi/zgmini/issues/1576), [#1577](https://github.com/ansqhd5774-Choi/zgmini/issues/1577)은 타 범위 브라우저 CI 문제이므로 본 변경으로 임의 종결하지 않음.
- 현 작업의 실제 코드 변경은 각 변경 PR의 정확 2·3개 파일이며 운영 PC/Writer/Controller/D1/SQLite/Cloudflare 배포·DNS는 손대지 않았다.

### R2 누적 처리와 다음 작업

- #12 Workflow Governance: **기존 Node CI에 실행 적용 및 queue 호환성 보완 완료**.
- #19 CI Observability: **읽기 전용 Job 지표 CLI·7건 회귀시험·main 병합 완료**. 정기 자동 실행은 없음.
- #1 Dynamic CI: **확인된 PR 트리거 누락 수정·기존 Playwright까지 실증 완료**. 광범위 위험 기반 최적화는 별도이며 강제 도입하지 않음.
- #29 Bundle Size CI: **실측 수집·아티팩트·main 반영 완료**, 장기 baseline 기반 자동 비교는 미완료.
- 따라서 12종 중 **4종에 소스 개선이 반영**, 나머지 8종은 원래 검토·보류 또는 선별 단계 유지. **12/12 전체 개선 완료나 금융 데이터·운영 수집 정상화 100%로 보고하지 않는다.**
- 다음 단계는 #8/#24의 **실제 Lighthouse 측정 환경·비용·오탐 분리** 검토 또는 #25/#23의 **기존 Playwright 한정 접근성/크로스브라우저 보완**. #29 기준선을 자동 비교할 때에는 기존 실제 main 아티팩트를 읽는 안전한 방법과 권한·계약을 먼저 검증한다.


## R2 #8 Performance Budget / #24 Performance CI 실험 판정 — 2026-11-25

**판정:** 현재 두 기능 모두 **DEFERRED/UNVERIFIED**. 이번 실험의 신규 소스·Workflow 변경은 실제 main에 **0건 병합**. 자동 Budget Gate **도입 0건**, 유효한 TTFB/FCP/LCP/CLS/Lighthouse 측정값 **0건**. 이는 운영 홈페이지의 성능 장애를 뜻하지 않는다.

### 확인한 원인·구분 증거

| 시도 | 실제 Run | 기존 검증과 실패 조건 | 판정 |
|---|---|---|---|
| 공식 [Lighthouse CI v0.16.1](https://github.com/GoogleChrome/lighthouse-ci/releases/tag/v0.16.1) + `vinext start`를 기존 Node CI에서 호출 | [#45485529459](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45485529459) | Build·기존 번들 기록 성공. 일반 Node 런타임에서 `cloudflare:` 모듈을 import하지 못해 로컬 preview 기동 실패 | 로컬 실행 환경 문제, 성능 점수 미측정 |
| 공식 Cloudflare Workers `vite preview` + Lighthouse | [#45485882649](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45485882649) | `vite preview` 실제 HTTP 준비 PASS, LHCI `Running Lighthouse 1 time(s)` 확인, 단일 호출이 **4분 timeout** | 정상 Node PR 전체 검사에 추가하기엔 과도한 자원·실행시간; 철회 |
| 기존 Playwright Chromium·브라우저 Performance API 재사용, `domcontentloaded` | [#45487121357](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45487121357) | 기존 Playwright 18개 단계, 로컬 프로덕션 Build PASS. `page.goto` **20초 timeout** | 실측 없음. 소스 변경으로 운영 UI 실패 주장 금지 |
| 로컬 HTTP 응답 `commit`과 실제 `main` 렌더링 분리 | [#45488535706](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45488535706) | 기존 Playwright 18개 단계, 로컬 Build PASS. `page.goto(waitUntil:'commit')`도 20초 timeout | 다른 로딩 wait 조건에서도 재현. 기능 미완료 |

- 위 단계에서 기존 본체 [Node CI #45487121599](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45487121599), [#45488535644](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45488535644)는 **SUCCESS**; CodeQL·Secret Scan도 성공. 신규 파서·예산 계약 회귀시험 6건 포함 5,838 PASS / 0 FAIL이었으나, 이 fixture 결과를 실제 성능 측정 성공으로 간주하지 않는다.
- 기존 정상 Node.js CI 및 Playwright Workflow에 무검증 성능 검사를 강제하지 않기 위해 [PR #1587](https://github.com/ansqhd5774-Choi/zgmini/pull/1587)은 **CLOSED/unmerged**로 종료했다. 정확한 main readback에서 신규 측정 단계는 존재하지 않았음. 브랜치의 임시 `scripts/ci-browser-performance.mjs`와 회귀시험은 main에 반영하지 않았다.
- 이 실험 때문에 만들어진 CI Issue [#1588](https://github.com/ansqhd5774-Choi/zgmini/issues/1588)·[#1591](https://github.com/ansqhd5774-Choi/zgmini/issues/1591)는 원본 실패·후속 원인·철회 근거를 기록한 뒤 `CLOSED/not_planned` 처리했다. **오류가 해결됐다고 속이지 않고 실험 기능 철회로 종결**. 타 담당 [#1582](https://github.com/ansqhd5774-Choi/zgmini/issues/1582) 등 독립 Issue는 건드리지 않았다.

### 적용 효과와 앞으로의 기준

- 기존 #12·#19·#1·#29의 4종 main 반영 및 유효 검증을 보존한다. **R2 누적 실제 코드 고도화 4/12**, #8·#24 신규 고도화 채택 0건. 실패한 실험의 CI를 6/12 실구현이나 웹 운영 성능 개선으로 계산하지 않는다.
- 무작정 타임아웃을 늘리거나 실패한 검사를 `continue-on-error`로 숨기거나 사용자 Production을 일반 성능 fixture로 삼지 않는다. 외부 Lighthouse 임시 서버 업로드·유료 서비스·Runner/cron 추가 금지 유지.
- 다음 독립 후보는 #25 Accessibility CI 또는 #23 Cross-browser CI. 현 정상 Playwright와 기존 모바일/데스크톱 검사 재사용을 우선하며, 경량·실행비용·접근성 오류 유효 증거가 있는 변경만 정규 병합한다. #8/#24는 로컬 Workers Browser 탐색의 실제 원인이 **새 증거**로 확인되기 전 동일 조건을 반복하지 않는다.


## R2 #8/#24 후속 격리 성능 측정 성공 보정 — 2026-11-25

위 PR #1587의 Lighthouse/기존 실험 실패 판정은 당시 조건의 역사적 증거로 보존한다. 이후 **별도 구현·실행 환경**의 [본체 PR #1593](https://github.com/ansqhd5774-Choi/zgmini/pull/1593)에서 실제 동작 검증·main 병합을 완료했다. #1587이 성공했다고 소급하지 않는다.

- 변경 브랜치: codex/ci-performance-lab-r2-20261125. 변경 3파일: 기존 Browser Workflow, 신규 scripts/ci-performance-lab.mjs, tests/ci-performance-lab.test.mjs. main 병합 SHA: d9d335388c584cf496aa2cd1dd3842732fe3e5cf. 정확 main 파일 readback 성공.
- 기존 Browser CI의 Playwright/Chromium+로컬 npm run dev 서버 재사용, 18개 기존 UI 검사 **전부 SUCCESS** 후 성능 단계 실행. 별도 Lighthouse 설치·운영 Cloudflare 변경·Runner·예약·새 Workflow·AI API·유료 서비스 없음.
- 신규 실험 브라우저는 127.0.0.1:5173 로컬 origin만 허용하고 사이트 API는 503 UNAVAILABLE로 명시적 격리. 실제 금융 관측이나 성공 응답을 위조하지 않음.
- [Node CI #45491019155](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45491019155): 신규 7회귀시험 PASS. [CodeQL #45491019318](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45491019318), [Secret #45491019055](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45491019055), [Playwright #45491019203](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45491019203): 모두 SUCCESS. 신규 성능 측정 단계 4초(초 단위 Job timing).
- 실제 회수한 Artifact: community-chat-browser-r1 / id 14965854319 / performance-lab/report.json. 관측 시각 2026-11-24T21:32:40.521Z, Chrome 141.0.7390.37.

| 로컬 실험 viewport | responseEnd(ms) | DOMContentLoaded(ms) | FCP(ms) | LCP(ms) | CLS | LongTask(ms) |
|---|---:|---:|---:|---:|---:|---:|
| 390x844 | 137.3 | 261 | 296 | 296 | 0.03 | 148 |
| 1440x900 | 39.3 | 134.1 | 212 | 212 | 0 | 133 |

**판정 조정:** #24 Performance CI의 **제한된 로컬 격리 측정·아티팩트**는 구현·실제 실행·main 반영 완료. #8 Performance Budget은 동일 브라우저·fixture·viewport·URL을 요구하는 비교 함수와 사전 승인 정책 계약은 구현했으나 실제 임계치 정책/차단은 NOT_CONFIGURED로 보류. 따라서 R2 누적 소스 적용 **기존 4종 + #24 1종 = 5종**, #8 부분 구현으로 집계. 앞선 Lighthouse/preview timeout의 근본 원인을 입증했다고 주장하지 않는다.

**제약:** 단일 로컬 API UNAVAILABLE 회차로 실제 Production 방문자 성능, Lighthouse 점수, Core Web Vitals 현장 데이터, 전후 개선율은 검증 불가. 정책 Gate를 허가 없이 신설하지 않으며 비교 가능한 반복 실측과 승인된 성능 임계치만 후속 검토한다.


## R2 #25 접근성 CI 검증·병합 및 #23 교차 브라우저 진행 — 2026-11-25

### #25 Accessibility CI 완료 (지정 범위)
- 본체 [PR #1592](https://github.com/ansqhd5774-Choi/zgmini/pull/1592) → main 정규 병합 SHA fd0a944b2cfb5e9783ac4fc2e988ebf0697651f4. 기존 #24 성능 측정·Chromium 18개 검사 유지, axe-core 4.14.1을 기존 Playwright test-only 설치에 추가. 새 Workflow/Runner/예약 없음.
- 원래 HEAD 80b9b16e130f05a8ebe73dfc241331a6d610846f Node CI 실패는 회귀시험이 요구한 artifact retention-days: 7의 실제 Workflow 누락. 테스트 삭제나 실패 무시 대신 성능 측정과 재결합한 merge commit ec05afe315f7cf8fcc40596f917fc936578bbf62에서 추가함.
- 수정 정확 HEAD [Node #45493027487](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45493027487), [CodeQL #45493027399](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45493027399), [Secret #45493027349](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45493027349), [Playwright #45493027350](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45493027350): 4/4 SUCCESS. 기존 18개 UI 검사, 성능 측정, axe 신규 검사 모두 성공.
- 실제 CI_AXE_OBSERVED 로컬 /about 화면: 모바일390·PC1440 각각 위반 규칙 0, 위반 노드 0, 미판정 규칙 1. 결과에는 HTML/본문/selector/개인정보 미포함. 전체 사이트의 WCAG 준수나 Production 결과는 미입증.
- 누적 고도화 소스 반영 기존 5종 + #25 1종 = **6/12**. #8 Budget 승인 임계치·강제 게이트는 계속 미설정. 과거 Lighthouse 실패 증거 유지.

### #23 Cross-browser CI 후보 (아직 main 미병합)
- 본체 [Draft PR #1594](https://github.com/ansqhd5774-Choi/zgmini/pull/1594), 작업 브랜치 codex/ci-crossbrowser-core-r2-20261125. Firefox/WebKit × 로컬 /·/about/ × 390/1440 = 8조합. 외부 요청 차단, API 503 UNAVAILABLE. HTTP 200·main 존재 검사 및 overflow/JS 오류 건수만 기록.
- 정확 최신 후보 HEAD f7a0cb80b1037fc954c5ff60bda65ee2a695273d는 #25와 #24 및 기존 18개 Chromium 테스트를 함께 유지하는 비강제 병합 커밋. 최신 CI·브라우저 8조합 결과/Artifact 검증 진행 중.
- #23의 실제 Run·JSON readback 및 main 병합 전에는 6/12에 산입하지 않는다. 독립 작업 장애 Issue를 이 PR로 묶거나 임의 종결하지 않는다.


### #23 Cross-browser CI 검증·main 병합 완료 — 2026-11-25

- 본체 [PR #1594](https://github.com/ansqhd5774-Choi/zgmini/pull/1594) → main 정규 병합 SHA 6d965f47d34e5ce5bb1544d2be2dc04cedf79472. 최신 통합 HEAD f7a0cb80b1037fc954c5ff60bda65ee2a695273d의 [Node #45494289109](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45494289109), [CodeQL #45494288990](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45494288990), [Secret #45494289227](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45494289227), [Playwright #45494289070](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45494289070): **4/4 SUCCESS**.
- 정확 브라우저 Job 138800520577에서 기존 Chromium 18개 테스트, #24 Performance Lab, #25 axe 접근성, #23 Firefox/WebKit 모두 SUCCESS. CI_CROSS_BROWSER_OBSERVED: Firefox·WebKit × 모바일390/PC1440 × 로컬 홈/소개 8/8에서 overflowPx=0, javascriptErrors=0. CI_AXE_OBSERVED는 두 viewport 각각 위반 규칙 0/미판정 규칙 1. 실제 아티팩트 community-chat-browser-r1 / id 14966389707 생성 확인.
- 본체 main 재조회 SHA 6d965f47d34e5ce5bb1544d2be2dc04cedf79472. main Workflow에 기존 Chromium 18 검사·성능·axe·Firefox/WebKit·7일 아티팩트 보존 모두 남고 cross-browser 구현 및 테스트 2파일도 실제 readback 확인. 신규 Workflow/Runner/예약/운영 PC/DB/D1/Cloudflare 직접 변경 없음.
- **R2 소스 고도화 누적 7/12종(약 58.3%)**: 기존 4종 (#12/#19/#1/#29) + #24 성능 실측 + #25 접근성 + #23 교차 브라우저. **#8 Performance Budget은 비교·승인 계약만 존재하고 실제 정책 임계치/PR gate는 NOT_CONFIGURED**, Lighthouse 점수와 Production 실제 사용자 체감/전후 개선율은 여전히 미확인. 기존 검토 목록 나머지 선정 항목의 구현은 별도 미완료, 본 기록으로 완료를 주장하지 않는다.


## R2 #6 아키텍처 및 #15 공급망 CI 실제 병합 — 2026-11-25

### #6 Architecture Testing (완료, 지정 범위)
- 본체 [PR #1595](https://github.com/ansqhd5774-Choi/zgmini/pull/1595) main 병합 SHA: 589e82bb1350b8076ee9c7c760d4f6cb6039d00e. TypeScript AST 재사용, app/components/hooks/worker에서 PC Writer/Controller로 직접 향하는 static import/export/dynamic string import/require 금지. 신규 회귀시험 7건. 신규 런너/워크플로/예약 없음.
- [Node CI #45496166533](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45496166533) 실측: 463파일 검사, 금지 직접 import 0건. Node Attempt 1 기존 SEC quota fixture peak=9(허용 8)로 실패. 동일 소스의 failed Job 단회 재실행 Attempt 2는 SUCCESS. [CodeQL #45496166585](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45496166585), [Secret #45496166415](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45496166415) SUCCESS. 최초 SEC 실패는 유지, 시각 경계/실제 SEC 호출 안전성 원인은 미확정. SEC 운영 로직/threshold는 이번 작업에서 수정하지 않음.

### #15 Supply Chain Security (완료, 로컬 의존성 증거 범위)
- 공식 pinned actions/dependency-review-action v5.0.1은 최초 [Node #45496284409](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45496284409)에서 dependency-review API HTTP 403 Forbidden. warn-only로 인증 거부 해결 불가. API 권한 확대·토큰 우회 없이 공식 Action 후보 철회, 실패 기록은 보존.
- 대체 소스: Node CI에서 PR merge-base와 현재 package-lock.json v3을 로컬에서 비교. 패키지 추가/변경/삭제·registry 종류·SRI 확인 상태·설치 스크립트 관측. 같은 버전의 tarball/SRI 값 바뀜도 탐지하되 원문 URL/credential/SRI는 보고서에 저장하지 않음. advisory-only이며 CVE·라이선스 조회와 동등하지 않음. 기존 production npm audit high/critical gate는 유지. 신규 회귀시험 7건.
- [PR #1596](https://github.com/ansqhd5774-Choi/zgmini/pull/1596) HEAD 7a853109419d024e2b847f5ced9736f3806465b9에 #6 main 변경을 통합. [Node #45497441630](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45497441630), [CodeQL #45497441324](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45497441324), [Secret #45497441525](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45497441525) **3/3 SUCCESS**. 같은 Node Run에서 architecture 463파일/위반 0, supply changedPackages 0(이번 PR의 dependency 수정 없음), 아티팩트 ci-supply-chain-review id 14970715399 업로드, 기존 npm audit SUCCESS.
- 본체 main 병합 SHA: 4c442a880a7edffaa4c71963342bb03a78c95659. main readback에서 두 신규 검사 단계, 관련 4개 소스/시험, 기존 타입/빌드/회귀/보안 검증 보존 확인.

### R2 누적 판정과 다음 실행
- 이전 7종 + #6 + #15 = **9/12종(75%)** main 소스 적용·정확 HEAD CI 증거. 실제 운영 수집·게시·데이터 복구가 75% 완료라는 의미 아님.
- 남음: #8 Performance Budget 실제 승인 임계치 NOT_CONFIGURED; #20 Data CI 기존 SQLite/Writer/게시 읽기 계약과 중복 점검 후 최소 검증; #36 Continuous Benchmarking 기존 Actions Job 메타데이터의 read-only 기간별 추세 미구현.
- 다음 실행은 #20 데이터 계보의 기존 안전 readback과 중복 없는 결손 검사를 우선하며, 후속 #36은 별도 유료 관측 플랫폼/예약 없이 GitHub API 기존 실행 자료를 사용. #8 임의 임계치/Production 성능 주장 금지.


## R2 #20 Data CI 검증·main 반영 — 2026-11-25

- 본체 [PR #1600](https://github.com/ansqhd5774-Choi/zgmini/pull/1600) main 병합 SHA 1a54bbe6613644340b2ae83b5da08f543e2b9649.
- 변경: 기존 Node CI 안에 scripts/ci-data-contract-r2.mjs + tests/ci-data-contract-r2.test.mjs, synthetic read-only 결과 JSON 업로드 추가. 신규 Runner/예약/실제 원자료·SQLite·D1 읽기/쓰기/Provider/API 수집 없음.
- 실제 [Node CI #45498514914](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45498514914) SUCCESS. CI_DATA_CONTRACT 실로그: 9 공개 projection × 7가지 상태 = **63/63**; providerCalls=0, writeStatements=0. READY의 값 0/null 보존, stored pending/stale/version/future, POST 405 거부를 정확하게 구분. 신규 회귀시험 7개 포함. 기존 #6 아키텍처 재검증 463파일 금지 참조 0건, Node 전체 회귀 PASS.
- [CodeQL #45498514820](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45498514820) 및 [Secret #45498514831](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45498514831) SUCCESS. 아티팩트 ci-data-contract id 14969962274 생성.
- 이 검증은 합성 D1 계약이고 실제 운영 DB 원자료의 완전성·진짜 PIT·D1 게시/readback·Production 최신성을 인증하지 않음. 기존 기능 담당 승인·설치 경로를 대체하지 않는다.
- **R2 누적 소스 검증·main 반영 10/12종(83.3%)**. #36 GitHub Actions Continuous Benchmarking은 별도 PR #1601 CI 진행 중. #8 Performance Budget 자동 임계치는 승인되지 않아 NOT_CONFIGURED 유지.


## R2 #36 Continuous Benchmarking 통합 완료 및 #8 잔여 — 2026-11-25

### #36 Continuous Benchmarking (main 적용)
- 본체 [PR #1601](https://github.com/ansqhd5774-Choi/zgmini/pull/1601) → main 병합 SHA **3cb92940b0dc57a39c7551a41d65b1f973133b5d**. 같은 Node.js CI에서 GitHub Actions 메타데이터만 읽어 **main push Node.js CI 완료 실행 최근 최대 10건**의 run_attempt별 Job을 조회한다. 별도 Workflow·Runner·예약·외부 유료 서비스 없음. 기존 contents:read에 actions:read(조회만) 허용, token은 해당 단계에만 전달하고 저장하지 않는다.
- 최근 5건/직전 5건의 Queue·Execution P50/P90 및 실패 수를 구분. 시작하지 않은 취소/skip Job은 duration null, 표본 부족은 INSUFFICIENT_COMPARABLE_HISTORY, 실제 시각 불일치/HTTP 거부/부분 Job 인벤토리는 fail-closed. 비교는 관측치 설명이지 보정된 CI 속도 개선 보장이나 임의 Budget gate 아님. 결과 JSON 7일 보관.
- 최초 독립 HEAD [Run #45498832682](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45498832682): 실제 CI_CONTINUOUS_BENCHMARK 관측·아티팩트 id 14970112573 생성 성공, 그러나 **기존 SEC rate-limit fixture peak=9**으로 Node 전체 Regression tests 실패. 별개 원인 기록을 기존 [Issue #1582](https://github.com/ansqhd5774-Choi/zgmini/issues/1582) 댓글 7146025519에 연결; 기존 테스트 삭제·리밋 완화·운영 수집기 수정 없이 보존.
- #20 main 변경을 비강제 병합한 통합 HEAD d1a100bd895aea2f88b75f2d12eb0aea24fad89b의 [Node CI #45499301019](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45499301019), [CodeQL #45499300759](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45499300759), [Secret #45499300770](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45499300770) **3/3 SUCCESS**. Node는 기존 full Regression, #20 synthetic D1 9*7=63/63, architecture, npm audit, #36 benchmark, 두 아티팩트 업로드 모두 성공. ci-continuous-benchmark id 14969858285; ci-data-contract id 14968878263.
- 이 통합 실행에서 실제 메타데이터: 최근 5개 Job 실행 중앙값 **123초**, 직전 5개 **122초**(단순 변화 +0.8%); Queue 중앙값 두 그룹 모두 2초; 수집된 완료 Run 10개 중 실패 Run 1개. 실행 환경/소스/Runner 차이를 통제하지 않았으므로 개선/회귀 통계적 판정 아님. Workflow가 성공하기 전 실행 Job을 자기 표본에 포함하지 않는다.
- main readback SHA 3cb92940b0dc57a39c7551a41d65b1f973133b5d. node.js.yml에서 #20, #36, #6 아키텍처, #15 공급망, 기존 high/critical npm audit과 전체 회귀를 모두 확인.

### R2 최종 현재 상태와 #8 대기 조건
- 기존 10종 + #36 = **11/12종(91.7%)** 한정 source 구현·관련 실제 GitHub CI 성공·main 병합. 운영 PC 설치/데이터 수집·게시·Production 웹 성능 성공률을 의미하지 않음.
- **#8 Performance Budget**: 비교 함수·승인 source/fixture/browserVersion/viewport matching 계약과 #24 로컬 Chromium 계측은 구현되어 있으나 사용자가 승인한 수치 임계치·버전 기준선/정책이 없어 **NOT_CONFIGURED**. 임의 승인 SHA·임계치·전후 개선율 또는 PR Gate를 만들지 않음. 이 항목은 현재 11종 완료에 산입하지 않는다.
- 지속 관리 중이지만 이번 범위와 독립인 문제: SEC 공유 1초 제한 fixture의 peak=9 반복, 공식 GitHub Dependency Review API의 과거 HTTP 403. 각 원본 증거/Issue 보존. 새 데이터 결함이나 운영 수집 실패를 가정하지 않음.


## R2 #8 Performance Budget — 사전 승인 비교 관측 main 통합, 예산 Gate 미설정 (2026-11-25)

- 본체 [PR #1602](https://github.com/ansqhd5774-Choi/zgmini/pull/1602) → 정규 main 병합 SHA **880f5b28df514b7b6b02ca234070dd57e32bf588**. 현재 브라우저 CI 한 곳에서 기존 Chromium 성능 Lab 다음에 이전 **동일 워크플로 성공 Run 최대 3개**의 GitHub Actions 아티팩트를 읽어 조건이 맞는 경우에만 측정 변화량을 계산한다. 별도 Workflow·Runner·예약·요금제/외부 성능 서비스·운영 PC/D1/Cloudflare 변경 없음.
- 세부 구현은 `scripts/ci-performance-budget-observation.mjs`, `tests/ci-performance-budget-observation.test.mjs`, 기존 `.github/workflows/community-chat-browser.yml` 3파일 한정. 추가 GitHub token 권한은 `actions:read`만, token은 비교 단계에서만 전달. 최대 30 성공/실패 후보 메타데이터 조회, 실제 다운로드 최대 3회. 이전 성공 Run이지만 **승인된 성능 예산 baseline이 아님** (`HISTORICAL_NOT_APPROVED`).
- **엄격 비교:** fixture `localhost-vite-api-unavailable-v1`, Chromium browserVersion, 로컬 URL, 390×844/1440×900 viewport, metric schema가 전부 일치해야 한다. `responseEndMs`, `domContentLoadedMs`, `fcpMs`, `lcpMs`, `cls`, `longTaskTotalMs` 6개. 비어 있거나 만료된 아티팩트, 서로 다른 브라우저 버전은 `UNVERIFIED`/`INCOMPARABLE`로 구분하고 가짜 0/성능 개선율을 만들지 않음. 승인 임계치·PASS/FAIL budget gate를 도입하지 않음.
- **실제 PR 정확 HEAD 9bedd98a4faf0c9b1a941e453b3fee2e0c1bae91**: [Node #45500205710](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45500205710), [CodeQL #45500205821](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45500205821), [Secret #45500205688](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45500205688), [Browser #45500205724](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45500205724) **4/4 SUCCESS**. 신규 회귀 8건·기존 Chromium UI·axe·Firefox/WebKit·격리 성능검사·결과 artifact 저장 모두 성공.
- Browser Job 138821155523 로그의 `CI_PERFORMANCE_BUDGET_OBSERVATION`: `status:NOT_CONFIGURED`, `comparisonState:COMPARABLE_OBSERVATION`, `candidatesChecked:1`, `historicalRunId:45494289070`, `comparableMetrics:[6,6]`, `mergeBlocking:false`. `community-chat-browser-r1` artifact id **14971053091**, 7일 저장으로 기존 결과와 함께 추가. 로컬 Lab LCP mobile390 **200ms**, desktop1440 **208ms**, CLS **0.03/0**; Production 사용자 성능 아님. Axe 각각 미판정 1 규칙, 위반 0; Firefox/WebKit 로컬 8조합 overflow/JS error 0.
- main SHA **880f5b28df514b7b6b02ca234070dd57e32bf588** 재조회, 두 신규 파일과 브라우저 Workflow 속 기존 Performance Lab·axe·Firefox/WebKit·아티팩트 보존을 실제 readback 확인.
- **판정:** 자동 historical comparator 구현과 실제 GitHub Actions 실증은 완료하였으나, 사용자 승인된 budget 수치 임계치·정책 SHA 및 실질 budget 게이트가 존재하지 않으므로 #8 전체 적용 **NOT_CONFIGURED**, R2 **11/12종 유지(91.7%)**. 해당 미완은 권한 부족·다른 기능과 관련된 글로벌 차단이 아니며, 임계치/고정 baseline 승인이 필요한 한정 정책 단계이다.
- 후속: 사용자가 승인할 비교 지표·허용 상한·동일 브라우저/fixture 버전·근거 baseline run/SHA를 확정하면 현행 `evaluateApprovedBudget` 경로와 연결해 코드/CI 후속 시험을 수행한다. 동일 회차 샘플 한 번이나 임의 Web Vitals 표준값으로 예산 승인·PR 차단을 대신하지 않는다.


## R2 #8 웹 속도 공식 Good 기준 확정·CI 연결 — 2026-11-25

- 사용자 후속 지시: Performance Budget의 **'예산'은 금액이 아닌 웹 속도 우수(Good) 기준**으로 확정. 2026-11-25 공식 Google 문서 기준: Core Web Vitals **LCP <=2,500ms / INP <=200ms / CLS <=0.1** (모바일/PC 각각 실사용자 75백분위 P75), 보조 FCP <=1,800ms, Lighthouse Performance score Good >=90. 출처: https://web.dev/articles/vitals / https://web.dev/articles/fcp / https://developer.chrome.com/docs/lighthouse/performance/performance-scoring .
- 본체 [PR #1603](https://github.com/ansqhd5774-Choi/zgmini/pull/1603), 최종 HEAD **4692a78ae22c4fadd1d10fb25497349b80f09ac0**, main 정규 병합 SHA **5d0eb80c69b64b17a5e00a44c5366260ad35bfb3**. 파일 4개만 변경: `scripts/ci-web-speed-good-r2.mjs`, `tests/ci-web-speed-good-r2.test.mjs`, `scripts/ci-performance-lab.mjs`, 기존 브라우저 CI Workflow. 신규 Workflow/Runner/예약/유료 서비스/운영 DB·Cloudflare 변경 없음.
- 기존 Chromium 격리 API 503 Lab에서 관측 가능한 **LCP/CLS/FCP**에 Google 공식 Good 기준을 적용해 `artifacts/performance-lab/web-speed-good.json`을 기존 7일 Artifact에 저장. 실사용자 P75·INP·Lighthouse Score는 해당 Lab에서 **UNVERIFIED/NOT_MEASURED**, 전체 사이트 Good PASS를 생성하지 않음. 별도 승인되지 않은 PR 차단/신규 성능 Gate는 생성하지 않음.
- 최초 [Node Run #45502242921](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45502242921): 신규 경계 시험 FAIL. **실제 원인은 기존 성능 Lab이 CLS 0.101을 소수 둘째 자리 0.10으로 반올림해 우수 임계치 초과를 은폐한 정밀도 결함**. 테스트 기대값 임의 변경 대신 CLS 보존 정밀도를 소수 다섯째 자리까지 높이고 차이 계산도 정밀화. 변경 전 Lab JSON과 새 측정을 직접 같다고 비교하지 않도록 `LAB_SCHEMA:1 -> 2` 버전 변경, 경계 `0.10001` 및 구 스키마 거부 회귀시험 신규 통과. 그 결과 기존 #8 이전 Lab 아티팩트와의 자동 historical comparison은 `NO_COMPARABLE_HISTORICAL_ARTIFACT`가 정상이며, 새로운 동일 스키마 자료 없이 추세를 발명하지 않는다.
- 정확 HEAD CI: [Node #45502680830](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45502680830), [CodeQL #45502680700](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45502680700), [Secret #45502680684](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45502680684), [Browser #45502680679](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45502680679) **4/4 SUCCESS**. 기존 Node 전체 회귀, 이전 #8 측정/비교, #24·#25·#23 Chromium/axe/Firefox/WebKit 단계 모두 보존. `community-chat-browser-r1` Artifact id **14971417669** 생성.
- Browser Job **138829745290** 실로그 `CI_WEB_SPEED_GOOD_REFERENCE`: 모바일390 **LCP/FCP 200ms, CLS 0.02755**, PC1440 **LCP/FCP 184ms, CLS 0.00041**. 각각 3/3 로컬 측정 Good 목표 충족, 실사용자 P75 미검증/INP·Lighthouse 미측정/mergeBlocking false. 역사비교 이전 스키마 3개 후보는 호환 불가로 `NO_COMPARABLE_HISTORICAL_ARTIFACT`, 가짜 비교 생성 없음. Axe 모바일/PC 위반 0(미판정 규칙 각각 1), Firefox+WebKit 8조합 overflow/JS 오류 0.
- main SHA **5d0eb80c69b64b17a5e00a44c5366260ad35bfb3** 및 신규 검사/시험/정밀도 수정/기존 Browser CI 단계 본체 main readback 성공.
- **완료 판정 분리:** #8 공식 Good 수치 **참조 정책/로컬 CI 판정·기록은 구현·검증·main 적용 완료**, 고도화 후보 12종 모두 어떤 형태로든 CI에 실제 연결. 그러나 #8의 **운영 사이트 실사용자 Core Web Vitals Good 인증 및 PR 강제 Performance Budget Gate는 미구현**이므로 해당 효과까지 DONE/전역 100%로 주장하지 않는다. 기존 '11종 완료 + #8 부분 완료'의 엄격한 기능 완료 판정 유지, 수치 목표 부재 문제는 해결됨. 남는 문제는 실측 영역과 강제 Gate의 범위/권한 차이이다.


## #8 Good 웹 속도: 실사용자 CrUX/P75 읽기 계약과 공개 PSI API 429 관측 — 2026-11-25

- **본체 PR #1604** https://github.com/ansqhd5774-Choi/zgmini/pull/1604 → 정규 main 병합 SHA **c34a87120253bb14e179fea7287257608850f92d**. 웹 사이트 `https://zgmini.kr/` 공개 Google PageSpeed Insights v5 API `runPagespeed` read-only를 통해 **모바일/PC LCP·INP·CLS의 CrUX 실사용자 P75**를 판정하기 위한 검증기 `scripts/ci-pagespeed-real-user-field-r1.mjs`, 회귀시험 `tests/ci-pagespeed-real-user-field-r1.test.mjs`, 기존 브라우저 CI 3파일만 변경.
- **소스 계약:** 원시 `CUMULATIVE_LAYOUT_SHIFT_SCORE` percentile의 /100 단위 정규화, source page URL / origin fallback 구분, 페이지·출처 미일치와 결측·429·403/HTTP 오류·네트워크 실패는 가짜 수치 0이나 사이트 Good으로 채우지 않음. 홈페이지 양 기기 우수는 `HOMEPAGE_BOTH_DEVICES_GOOD`, 출처(Origin) 양 기기 우수는 `ORIGIN_BOTH_DEVICES_GOOD`, 서로 다른 출처 범위 혼용은 `MIXED_SCOPE_GOOD_SITE_UNVERIFIED`. 실제 3개 Core Web Vitals 중 하나라도 미제공이면 전체 우수 PASS 금지, Lighthouse 별도 분리. 공개/로컬 데이터가 동일한 측정이라는 주장도 금지.
- **외부 실조회 실행:** 최종 로직 보완 전 [Browser #45572496927](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45572496927) SUCCESS, 아티팩트 `community-chat-browser-r1` id **15003317361**, Job 139062325719 원문 `CI_PSI_PUBLIC_FIELD`에서 **mobile=HTTP_429, desktop=HTTP_429**, 두 기기 LCP/INP/CLS `p75:null`, `SITE_FIELD_GOOD_UNVERIFIED`, Lighthouse `UNVERIFIED`. 429는 공급자/API 응답으로 실사용자 속도 우수/불량 또는 방문 표본 부족을 증명하지 않는다. 기존 격리 로컬 Lab 모바일 LCP/FCP 228ms, desktop 256ms, CLS 0.02755/0.00041은 검증되었지만 운영 방문자 속도가 아님. Axe 위반 0 및 Firefox/WebKit 8조합 UI 정상.
- **중복 실패 제거:** 동일 공개 무인증 조건으로 429가 확인돼 PR마다 2건씩 재호출하지 않음. 기존 `community-chat-browser.yml`의 `workflow_dispatch.inputs.run_psi_field` boolean default false를 사용해 **명시적 1회 실행에서만** 두 건의 제한된 GET 호출 수행. 신규 스케줄·Workflow·Runner·외부 유료 서비스·Google API key/Google Cloud 과금·PC·D1·Cloudflare 운영 변경 없음. Google 공식 문서에서는 무인증 호출이 가능하나 반복 호출에 API key를 권장 https://developers.google.com/speed/docs/insights/v5/get-started ; 실제 구체적 429 quota 세부 원인은 별도 입증 안 됨.
- **최종 HEAD 8228935ebbeee2de0ac9c5877a02bcec935525dd**: [Node #45573849836](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45573849836), [CodeQL #45573849832](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45573849832), [Secret #45573849811](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45573849811), [Browser #45573849838](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45573849838) 모두 **SUCCESS**. 최종 브라우저 CI는 로컬 Good·접근성·Firefox/WebKit E2E 정상, PSI 단계 SKIPPED가 의도한 재호출 제한으로 검증됨. 아티팩트 id **15004035714**. 기존 W04 공개 UI가 독립 파일 수정되어 main SHA `b6049aac...`로 전진했으나, 본 PR 3파일과 무충돌/정규 병합하여 W04 변경 보존.
- **main readback:** SHA **c34a87120253bb14e179fea7287257608850f92d**, 3파일 readback에서 page/origin 분리, CLS 변환, 429 결측, 단발 워크플로 입력, 기존 로컬 성능 측정/Good/axe/교차 브라우저 검증 보존 확인.
- **완료 판정:** 실사용자 P75의 신뢰 가능한 소스 파싱·상태·회귀시험 및 안전한 일회성 CI 실행 경로는 구현/검증/main 반영. **실제 운영 사이트 CrUX P75 값 0건 확보(HTTP 429 두 건)** — 사용자 경험 우수 등급 인증과 PR 차단 게이트는 **미완료**, R2 엄격 완료 **11종 + #8 부분 완료 유지(11/12종, 91.7%)**. 결과 없음/429를 PASS로 위장하지 않음. 다음 조건은 승인된 공식 인증/쿼터가 있는 API 접근 또는 실제 Google field data의 가용성 증명이며, 권한 승인 없이 키·요금제·예약을 추가하지 않는다.


## R2 #8 운영 사이트 무료·읽기전용 Chromium 속도 Lab 완료 — 2026-11-25

- 당면 문제: 공개 PageSpeed Insights에서 mobile/desktop CrUX 실사용자 P75 조회 모두 HTTP 429(기존 #1604 영수증). 연결된 GSC Wizard의 `get_core_web_vitals` 도구는 **구독 미활성으로 도구 실행 거절**, 읽기 결과 0건. 이를 운영 사이트 속도 실패, Google CrUX 데이터 미수집, PC/Cloudflare 장애로 오인하지 않음. GSC Wizard 무료 제공 여부와 공식 Google CrUX Vis 공개 UI 제공은 별개의 문제이며, 운영 Data/SEO 설정은 변경하지 않았다.
- 최소 후속 구현: 본체 [PR #1606](https://github.com/ansqhd5774-Choi/zgmini/pull/1606) → main 병합 SHA **99694466e43105fc036067a8cc1ceb428818e066**. 기존 `.github/workflows/community-chat-browser.yml`에 `scripts/ci-production-browser-good-r1.mjs` 1단계와 테스트 `tests/ci-production-browser-good-r1.test.mjs` 추가(총 3개 파일). 기존 Playwright Chromium 재사용. 신규 Runner·Workflow·예약·패키지/유료 플랫폼·Cloudflare/PC/원자료·운영 게시 효과 없음.
- 격리 로컬 API 503 성능 Lab과 **별도**: 실제 `https://zgmini.kr/`와 `https://zgmini.kr/economic-indicators/` 각각 모바일390/PC1440 실제 production GET Chromium navigation/paint/CLS 측정. 모든 제3자 Origin 네트워크 차단, 동일 Origin도 `GET/HEAD` 외 HTTP 메서드 차단. 첫 화면 정상성·HTTP 상태·오류·차단 요청 수·Chrome 버전과 LCP/FCP/CLS를 `artifacts/performance-lab/production-browser-good.json`에 기존 7일 Artifact로 저장. 데이터 소스는 `PRODUCTION_HEADLESS_FIRST_PARTY_ONLY`. 승인 Good 비교 기준 LCP<=2500ms, FCP<=1800ms, CLS<=0.1을 관찰하지만 **실사용자 P75/INP·Lighthouse 점수 미측정**, PR/운영 release gate 추가 없음.
- 정확 후보 HEAD **417a57ca2a26da0ece17393ebfdf0151314bb337**의 [Node CI #45576573992](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45576573992), [CodeQL #45576574037](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45576574037), [Secret #45576574026](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45576574026), [Browser #45576574023](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45576574023) **4/4 SUCCESS**. 신규 회귀시험 9건 통과; 기존 W04/W05/W06 웹 UI/접근성 Firefox/WebKit, #8 mock Lab·성능 Good·역사 비교, PSI 429 수동조건 보존. 아티팩트 `community-chat-browser-r1` id **15005027106** 생성.
- Browser Job **139075888952**의 실제 `CI_PRODUCTION_BROWSER_GOOD`:
  - 홈 모바일390: HTTP200, **LCP/FCP 896ms**, **CLS 0.00139**, blocked writes 0, navigation error null.
  - 홈 PC1440: HTTP200, **LCP/FCP 668ms**, **CLS 0.00162**, blocked writes 0, navigation error null.
  - 경제지표 모바일390: HTTP200, **LCP/FCP 460ms**, **CLS 0.03484**, blocked writes 0, navigation error null.
  - 경제지표 PC1440: HTTP200, **LCP/FCP 388ms**, **CLS 0.04277**, blocked writes 0, navigation error null.
  - 4/4 전부 **로컬 Chromium first-party-only 단회 관측 Good 측정 항목 충족**. 이 수치로 브라우저 throttling/제3자 자산 포함 일반 사용자 속도, 방문자 p75, Lighthouse 90+ 달성, 실제 운영 전체 Good 인증을 확정하지 않는다.
- main SHA **99694466e43105fc036067a8cc1ceb428818e066** 재조회 및 신규 source/test/browser Workflow readback 성공. `LAB_SCHEMA=2` CLS 정밀도, 기존 #8 PSI 공개 필드 매뉴얼 opt-in, Chrome good/local/browser/wcag 판정 모두 유지.
- **범위 판정:** R2 12개 도입 대상의 #8 Good threshold/local/production 독립 관측기는 코드·CI·main 실제 적용 완료. 외부 **실사용자 CrUX P75 모바일·PC 확인은 미완료**(API 429, 유료 플러그인 무승인); 전체 웹사이트 Good 등급 인증 및 강제 performance gate를 DONE으로 선언하지 않으며 엄격 진행률 **11/12종 = 91.7% + #8 부분 완료**. 후속은 기존 공식 무료 CrUX Vis 화면에서 해당 origin 데이터의 실제 존재 여부를 확인하거나, 이미 승인된 신뢰 가능한 Google API 키 경로가 생긴 경우 최소 재조회만 시행; 유료 구독/추가 예약/임의 쿼터 우회 금지.


- **PR #1606 main 병합 후 재검증:** 정확 병합 SHA `99694466e43105fc036067a8cc1ceb428818e066`에서 [Node CI #45577806918](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45577806918) **SUCCESS**, [CodeQL #45577806843](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45577806843) **SUCCESS**, [Secret #45577806836](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45577806836) **SUCCESS**, [Production SEO #45577806816](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45577806816) **SUCCESS**. PR 정확 HEAD 4/4 외에 main 재검증도 완료. 작업 외 운영 성능·Cloudflare 배포 SHA 인증으로 확대하지 않는다.


## R2 #8 후속: Production Runtime 오인 판정 수정 및 CrUX Vis 무료 조회 한계 — 2026-11-25

- **본체 [PR #1609](https://github.com/ansqhd5774-Choi/zgmini/pull/1609)**: `classifyProductionPage`가 JS pageerror 또는 차단된 쓰기 요청이 있을 때에도 빠른 LCP/FCP/CLS만으로 `PRODUCTION_LAB_MEASURED_TARGETS_MET`를 선언할 수 있던 결함 수정. `PRODUCTION_LAB_RUNTIME_UNVERIFIED` 분리, pageErrors 누락/형식 오류 거부, 실제 Good 임계치 초과 우선 판정 유지. 변경은 검증기·회귀시험 2파일에 한정. 실제 정상 측정 결과와 허위 우수 판정 가능성을 구분함.
- **실행 증거:** 정확 수정 HEAD `e892b0a32545af350e33dc907a911fbc1c7f3334`; [Node #45578853499](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45578853499), [CodeQL #45578853407](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45578853407), [Secret #45578853345](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45578853345), [Browser #45578853555](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45578853555) **4/4 SUCCESS**; Browser 아티팩트 `community-chat-browser-r1` ID **15005727456** 및 실제 CI 로그 확보. `main` 병합 SHA `e95836753fc3055734bcdea69e39d1f8059566ac`와 소스 readback 일치. 기존 #1609 범위와 무관한 Secret Scan 변경 보존.
- **새 운영 읽기 관측:** 홈페이지 390/1440 LCP/FCP **608/508ms**, CLS **0.00192/0.00161**; 경제지표 390/1440 LCP/FCP **360/592ms**, CLS **0.03484/0.04277**. HTTP200, 쓰기 차단 0, 네 결과 모두 `PRODUCTION_LAB_MEASURED_TARGETS_MET`; 실사용자 P75 아님. 페이지 오류 0은 신규 분류 조건에 의해 동일 CI 결과로 간접 확인되나 원시 페이지 오류 배열 별도 독립 인용 없이 확장 주장하지 않음.
- **실사용자 무료 경로 직접 재검토:** Google 공식 [CrUX Vis](https://cruxvis.withgoogle.com/)는 공개 UI에서 주간 CrUX History API의 origin/page 실사용자 정보를 시각화하지만, 현재 읽기전용 웹 텍스트 도구로 직접 조회한 페이지는 **JS 대시보드 수치가 반환되지 않음(읽을 수 있는 본문 0줄)**. `https://zgmini.kr`의 CrUX 표본 존재/부재나 P75를 검증한 결과가 아님. [공식 CrUX Vis 설명](https://developer.chrome.com/docs/crux/vis), [CrUX API](https://developer.chrome.com/docs/crux/api), [History API](https://developer.chrome.com/docs/crux/history-api): 원시 API는 Google Cloud API 키 필요. 기존 [PSI #45572496927](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45572496927) 429×2와 별개로, 공개 UI 수치 미노출을 데이터 부재·속도 불량으로 오인 금지. 같은 조건의 429 재호출/키 발급/유료 서비스 가입/새 예약 없음.
- **엄격 완료 구분:** #8 Lab·Good 기준·오류 오인 방지의 코드/CI/main 통합 **DONE**, field LCP/INP/CLS P75 모바일·PC·전체 사이트 Good 등급 인증 **UNVERIFIED**; 임의 PR-blocking performance gate **미도입**. 따라서 R2 엄격 집계 **11/12 완료 + #8 부분 완료(91.7%)** 유지. 실제 field data에 접근 가능한 기존 승인 경로가 확인되면 고유 source/시간/URL·origin 범위와 두 form factor를 대조해 측정값만 반영하며, 그 전에는 운영 웹 성능 PASS로 승격하지 않는다.

## #8 실사용자 P75 대체 소스 읽기 전용 검증 — 2026-11-25

- **새로 확인한 공식 무료 후보:** Cloudflare Web Analytics의 `Core Web Vitals` 화면은 실제 방문자 LCP/INP/CLS의 75백분위(P75)와 URL·브라우저 등 필터를 지원한다. [Cloudflare 공식 문서](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/). RUM beacon은 Web Analytics/Observatory 사용 시 Cloudflare 프록시 응답에서 자동 주입하거나 수동 삽입할 수 있다. [공식 RUM 설명](https://developers.cloudflare.com/speed/observatory/rum-beacon/). **이 문서가 zgmini.kr에서 RUM 활성화·P75 자료 존재를 입증하는 것은 아님.**
- **ZGMINI 소스 조사:** 본체 현재 `main` 검색에서 `rum.cloudflare.com`, `beacon.min.js`, `cloudflareinsights`, `data-cf-beacon`, `rumWebVitalsEventsAdaptiveGroups`의 명시적 RUM 통합 파일을 확인하지 못함. Cloudflare의 *에지 자동 주입* 가능성까지 소스 검색만으로 부정하지 않음.
- **기존 공식 PC OAuth 조회 범위:** [CLOUDFLARE_OFFICIAL_PC_READONLY_STANDARD](CLOUDFLARE_OFFICIAL_PC_READONLY_STANDARD.md)의 승인 A `w05-cloudflare-deployment-readonly`는 고정 Worker 배포·Version·domain GET만 지원. **Web Analytics RUM P75 API를 조회하도록 허용/등록된 작업이 아니므로** 기존 OAuth를 이용한 임의 GraphQL/POST/조회 확장은 금지하고 새 A 실행도 만들지 않음.
- **연결된 PostHog 점검:** 기존 PostHog 읽기 연결의 활성 `Default project` (ID 604464)는 `ingested_event=false`, `completed_snippet_onboarding=false`, 같은 조직의 프로젝트 목록 1개(이 기본 프로젝트)로 확인. `read-data-schema`의 `$web_vitals` 이벤트는 **최근 30일 관측 없음**으로 표시되고 모든 기본 이벤트도 미관측으로 표기됨. 따라서 이 연결로 **실사용자 P75를 조회·인증할 수 없음**. 스키마에 `$web_vitals`라는 시스템 이벤트 이름이 있다는 사실은 실제 계측 성공이 아님. `metric-list`는 연결된 PostHog 앱의 `data_catalog:read` 범위 누락으로 미제공; 독립된 Cloudflare/Google 자료 조회 가능성과 구분함.
- **자료 상태:** PSI 기존 429×2 및 CrUX Vis 동적 데이터 접근 실패는 새로운 결측 자료나 방문자 부족 입증이 아님. 이번 단계에서도 ZGMINI 방문자 P75 값을 0건 확보; CrUX P75와 Cloudflare RUM P75는 공급자·집계 대상·기간이 달라 수치를 동일 출처로 혼합하거나 서로 인증하지 않음.
- **향후 유효한 실행 조건:** 기존 승인·계정 범위 내 Cloudflare Web Analytics의 대상 사이트 RUM `enabled`/실제 샘플/P75를 확인할 수 있게 된 때에만 모바일·PC, 페이지 URL/Origin, 집계 기간, 샘플 크기를 검증. 새로운 키·결제·RUM 활성화·계측 설정·Controller allowlist·예약·배포는 사용자 별도 명시 승인 없이 수행하지 않음. 새로운 증거가 없는 429 재요청·기능 진척률 증액 없음. #8 `실사용자 P75=UNVERIFIED`; 나머지 11/12 및 Lab 구현 완료 상태 보존.

## #8 Production RUM 스크립트 마커 실제 검증·병합 — 2026-11-25

- 본체 [PR #1611](https://github.com/ansqhd5774-Choi/zgmini/pull/1611)에서 기존 브라우저 CI `scripts/ci-production-browser-good-r1.mjs`과 회귀시험 2파일 한정 개선. Cloudflare가 서버 응답에 자동 삽입할 수 있는 `static.cloudflareinsights.com/beacon.min.js` 마커를 HTML DOM 및 차단된 스크립트 요청에서 관측; 외부 요청은 계속 전부 abort하며 RUM 이벤트/개인 데이터 송신 없음. 신규 Runner·Workflow·예약·유료 구독·API 키/Cloudflare·운영 PC/D1 변경 없음.
- 최초 HEAD `ca141353...` Node CI [#45581429123](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45581429123) 1건 FAIL 직접 원인: 기존 회귀시험의 `sameOrigin=new URL(...)` 구형 코드 표현 강제 정규식. 새 구현의 `target=new URL(request.url())` + `sameOrigin=target.origin===PROD_ORIGIN`은 기존 보호와 동일. 회귀 단언을 실제 코드 계약에 맞게 개선하고 전체 회귀를 재실행. 원래 Browser [#45581429144](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45581429144)는 성공하며 RUM 마커 4개 화면 모두 발견.
- 최종 HEAD `1bdda67c5a6868cee8eaa991e05fd606f29cbb1f`: [Node #45581926960](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45581926960), [CodeQL #45581926796](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45581926796), [Secret #45581926813](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45581926813), [Browser #45581926775](https://github.com/ansqhd5774-Choi/zgmini/actions/runs/45581926775) **4/4 SUCCESS**. Browser job `139093855022`, 기존 7일 `community-chat-browser-r1` 아티팩트 ID **15007825971**. 정규 main 병합 SHA `249dd6ab57561fe3a512906a770f402918e8c376` 및 변경 파일 remote readback 완료.
- 4개 운영 1st-party-only headless 결과 HTTP200/blockedWriteRequests=0/error=null/Good 관측 수치 이내, **RUM DOM true / 차단된 RUM script 요청 1** 각각 확인. 홈페이지 모바일390 LCP/FCP 664ms·CLS 0.0021, PC1440 476ms·0.00162; 경제지표 모바일390 688ms·0.03484, PC1440 344ms·0.04277. 실제 정확 원문은 [PR #1611 완료 댓글](https://github.com/ansqhd5774-Choi/zgmini/pull/1611#issuecomment-7158028467)에 연결.
- **확정 사실:** 운영 페이지에서 공식 Cloudflare RUM 스크립트 마커가 실재한다. 기존 ‘소스에 beacon 코드가 없어 미활성일 가능성’만으로 판단했던 불확실성 1개 해결. **미확인:** 스크립트 로딩/실행·Cloudflare ingest/실제 방문자·모바일/PC field LCP/INP/CLS P75 및 전체 사이트 Good 인증. 검사 브라우저가 외부 네트워크를 차단한 실험임을 유지. 마커 관측값으로 수집 성공·개선율을 단정하지 않음.
- 다음 정확 작업: **기존 승인·실제 접속 가능한 Cloudflare Web Analytics의 계측 데이터 표본 및 P75 readback**. 현 승인 PC A는 Worker 배포만 조회하므로 RUM GraphQL을 임의 API/SQL/프록시로 우회하지 않는다. 실사용자 P75는 계속 UNVERIFIED, #8 Good 참조·Lab/오탐 검증 완료와 실제 field 인증 미완료 구분, 엄격 고도화 수치 **11/12 + #8 부분(91.7%)** 유지.

## #8 Cloudflare RUM P75 응답 계약 — 인증 없는 소스 분리 (2026-11-25)

- **확정된 외부 계약:** Cloudflare 공식 GraphQL Analytics API의 단일 `https://api.cloudflare.com/client/v4/graphql` 엔드포인트는 인증된 `POST`(JSON query/variables)이고, `rumWebVitalsEventsAdaptiveGroups`는 Account Web Analytics 실사용자 통계 계열. `GET`만 허용된 기존 고정 `w05-cloudflare-deployment-readonly`와 별개이다. GraphQL은 HTTP200에도 `errors`를 포함할 수 있어 200만으로 정상 판정 불가. 출처: https://developers.cloudflare.com/analytics/graphql-api/ · https://developers.cloudflare.com/analytics/graphql-api/getting-started/querying-basics/ · https://developers.cloudflare.com/analytics/graphql-api/errors/ .
- **신규 source-only Draft PR [#3536](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3536)**: 전용 브랜치 `codex/ci-cloudflare-rum-field-contract-20261125`에서 기존 `main` 분기. 순수 `controller/cloudflare-rum-field-parser.mjs`와 `tests/cloudflare-rum-field-parser.test.mjs`, **기존 Controller Maintenance Source Tests workflow에 새 테스트 등록** 3파일만 변경. 활성 Controller operation/allowlist/config·승인 B manifest·운영 소스·PC/Cloudflare OAuth/DB/D1 변경 없음.
- **응답 계약:** 계정 태그 형식 및 UTC 최장 7일 범위, 고정 `zgmini.kr` 두 경로×mobile/desktop, GraphQL errors/미관측/타 사이트·URL/중복 그룹 거부; 원시 LCP·INP microseconds→milliseconds, CLS unitless, `0` vs missing/negative 구분, 0.100001 CLS처럼 경계 초과값은 **반올림 전 원값**으로 판정. RUM aggregate `count`는 개별 LCP/INP/CLS 샘플 개수와 다르므로 `metricSampleSizesVerified=false`, 사이트 Good 인증은 항상 false, CrUX 동일시 금지. GraphQL 필드명·스키마는 실제 인증 결과로 아직 검증되지 않았으므로 **계약 후보**로 한정.
- **검증 상태(해당 시각):** Node v22 격리 소스 로직 회귀시험 **11/11 PASS**. 정확 GitHub HEAD `7cda1e98b7fad251d197bbf5f52503aa68b89498`의 Controller Maintenance / C996 / PC Secret Scan 3개 GitHub Actions는 등록됐으나 최초 조회에서 모두 **queued**. CI 성공·main 병합·PC 실제 조회로 완료 처리하지 않음. 실행 중복 생성/Runner 추가 금지.
- **현재 한정 제약:** 기존 Wrangler OAuth의 Account Analytics Read 권한은 미확인이고, 기존 배포 A 작업을 RUM POST로 확장하지 않음. **다음 순서**는 기존 Actions 3건 결과 회수→실제 실패가 있으면 해당 최소 수정→소스 통합 판단→별도 범위에서 권한·운영 안전 계약 확정 후 최초 실제 Web Analytics sample readback. #8 실사용자 P75와 전체 Good은 여전히 UNVERIFIED. 자동화 전체 엄격 11/12 + #8 부분(91.7%) 유지.

## #8 PR #3536 실제 Controller CI 성공 및 잔여 대기 — 2026-11-25

- 정확 PR HEAD `7cda1e98b7fad251d197bbf5f52503aa68b89498`에서 [Controller Maintenance Source Tests #45584813111](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45584813111) **SUCCESS** 종료. Job `139103591861`의 실제 단계 37 `Validate read-only RUM P75 response contract without calling Cloudflare` **SUCCESS**, 전체 Job 실패 단계 0건. 기존 `w05-cloudflare-deployment-readonly` 동작/회귀 보존. 신규 응답 계약 테스트가 실제 CI에서 실행된 사실을 확정했으며, Cloudflare 운영 실자료를 읽었다는 뜻은 아님.
- 같은 HEAD의 [C996 #45584813168](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45584813168), [PC Secret Scan #45584813350](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45584813350)은 이 기록 시점 **queued**, 해당 CI 성공 여부 및 root cause 미입증. 중복 실행·신규 Runner/예약·운영 수정/강제 병합 없음.
- `main` 기준 SHA `a9c02fb7eadc5bbcf142385ede88dfff8170cae3`, 후보 HEAD와 변경 파일 3개 및 새 CI trigger/readback 확인. 다음 필수 행동: 동일 Run 2개 완료/실패 결과 회수 → 실패 시 원인만 수정 → 정규 소스 병합 → 별도 허가된 Cloudflare 실측 시료 존재 여부·P75 검증. **#8 실사용자 Good 인증 UNVERIFIED**, R2 엄격 진척 11/12 + #8 부분 유지.

## #8 PR #3536 CI 3종 PASS·main 병합 및 데이터 접근 제약 — 2026-11-25

- **정규 결과:** [PR #3536](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3536) 정확 후보 HEAD `7cda1e98b7fad251d197bbf5f52503aa68b89498`, Controller Maintenance [#45584813111](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45584813111) **SUCCESS** (RUM 파서 오프라인 테스트 단계 포함), C996 [#45584813168](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45584813168) **SUCCESS**, PC Secret Scan [#45584813350](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45584813350) **SUCCESS**. 최초 큐 상태를 오류로 확정하지 않고 기존 Job가 실제 진전·종료한 것을 회수함.
- **병합/readback:** 승인된 3파일 범위를 확인하고 `main` 병합 SHA `3b91ceece1d3d0d28278f22f7fc1a2365dd3deea`; 원격 `main`의 해당 SHA와 `controller/cloudflare-rum-field-parser.mjs`, `tests/cloudflare-rum-field-parser.test.mjs`, 기존 `.github/workflows/controller-maintenance-source-tests.yml` 내 테스트 단계 readback 일치. `Controller` 등록/설치/Cloudflare 호출은 **없음**.
- **별도 공식 CrUX 조회 경로 조사:** 연결된 `GSC Wizard`의 `list_sites`를 읽기 전용으로 호출했으나 도구가 **`payment_required / subscription_required`**를 반환하여 사이트 목록·Core Web Vitals 조회 전에 중단됨. 구독/유료 활성화/결제·키 발급을 제안하거나 수행하지 않음. 이 연결의 실패로 실제 CrUX 표본 부재를 추정하지 않음.
- **미완료 및 정확 다음 행동:** 실제 승인된 계정 접근에서 Cloudflare Web Analytics의 RUM 샘플 수·metric별 자료/UTC 집계·모바일/PC·페이지별 LCP/INP/CLS P75를 확인해야 함. 소스 검증기 GraphQL 필드 계약은 실제 계정에서 미검증인 후보이며 `siteGoodCertified:false`를 유지한다. 기존 `w05-cloudflare-deployment-readonly`는 Workers GET 전용이므로 임의 인증 GraphQL POST나 새 operation/승인 manifest를 추가하지 않음. Lab/CI 검증과 실제 실사용자 Good 인증 구분, 엄격 고도화 **11/12 완료 + #8 부분(91.7%)** 유지.

## #8 RUM GraphQL 계정 스칼라 공식 명세 대조 및 소스 정정 — 2026-11-25

- 공식 Cloudflare Analytics GraphQL [Querying basics](https://developers.cloudflare.com/analytics/graphql-api/getting-started/querying-basics/)와 [Account scope 예시](https://developers.cloudflare.com/cloudflare-one/tutorials/graphql-analytics/)는 계정/zone GraphQL 변수 타입을 **소문자 `string`/`string!`**으로 선언한다. 병합된 PR #3536 소스의 쿼리는 `$account: String!`로 타입 표기가 불일치. 이는 **문서 대비 재현 가능한 코드 계약 오류**이며, 실제 운영 API 오류를 실행해 입증한 것은 아니다.
- 별도 수정 [Draft PR #3538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3538), 브랜치 `codex/ci-cloudflare-rum-scalar-fix-20261125`, HEAD `fed73bf39001b1e55e26091a114064d6981dfd21`: `controller/cloudflare-rum-field-parser.mjs`의 계정 변수만 `$account: string!`로 정정, `tests/cloudflare-rum-field-parser.test.mjs`에 **소문자 유지·대문자 회귀 차단 단언 2개** 추가. 변경 파일 2개, 다른 검증·단위·가용 데이터 상태·인증·현장 실행·공통 Controller·Cloudflare 설정에는 영향 없음.
- 정확 PR HEAD의 [Controller Maintenance CI #45586537560](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45586537560), [PC Secret Scan #45586537581](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45586537581), [C996 #45586537793](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45586537793)는 생성·등록됐으나 최초 확인에서 **3개 모두 queued**. 실행/검증 성공·main 병합 증거가 없는 동안 상태를 DONE으로 승격하지 않음. 이전 #3536의 3/3 SUCCESS는 `String!` 구형 쿼리의 성공적인 실제 API 호출 증거가 아니다.
- 추가 조사: 공식 [Cloudflare Web Analytics P75 대시보드](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)와 [실방문 RUM 데이터 흐름](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)은 P75 제공 및 스크립트 전송 방식만 설명하며 `zgmini.kr`의 실제 사용자 표본은 제공하지 않는다. 무료/기존 인증된 RUM 데이터 조회 연결은 여전히 발견되지 않았음. 신규 유료 서비스·인증·allowlist·운영 변경을 진행하지 않음.
- 다음 필수 단계: **기존 #3538 CI 3건 결과 회수 → 결함 범위 재검증 → 정규 병합/readback → 실사용자 RUM/CrUX P75 접근 경로 확인 시 원본 날짜·표본·기기·페이지별 검증**. 엄격 완료 수치 11/12 + #8 부분(91.7%) 변경 없음.

## #8 GraphQL 계정 스칼라 정정 CI 3/3 PASS·정규 병합 — 2026-11-25

- [PR #3538](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3538) 정확 소스 HEAD `fed73bf39001b1e55e26091a114064d6981dfd21`의 [C996 #45586537793](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45586537793) **SUCCESS**, [Controller Maintenance #45586537560](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45586537560) **SUCCESS** (`Validate read-only RUM P75 response contract without calling Cloudflare` 단계 포함), [PC Secret Scan #45586537581](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45586537581) **SUCCESS**. 기존 Windows CI 큐는 중복 요청 없이 후속 정상 실행돼 추가 복구를 요구하지 않음.
- **변경 2파일만 확인:** `controller/cloudflare-rum-field-parser.mjs` 계정 query 변수 `$account: String!` → `$account: string!` (Cloudflare Analytics 공식 예시 스칼라 형태); `tests/cloudflare-rum-field-parser.test.mjs` 소문자 정상·대문자 회귀 거부 단언. 기존 조회를 실행하는 등록기/Controller/credential source·실제 운영 파일·설치 manifest·수집 주기·사이트·Worker 모두 변경 0.
- `main`이 동시 작업으로 원래 base SHA `3b91ceece1d3d0d28278f22f7fc1a2365dd3deea` 이후 독립적으로 전진했고 GitHub mergeable 결과가 잠시 false였음. 최신 API `mergeable_state=clean`과 diff 파일/HEAD/CI 3/3를 재검증 후 정규 merge 실행. **병합 SHA `c436cc97dc933ad0c3e09f4a2b8339b7244a59c6`**, 원격 `main` HEAD·파서 변수·회귀시험 readback 일치. 다른 작업자의 변경 보존.
- **엄격 판정:** 이 완료는 소스 GraphQL *후보*의 타입 계약을 공식 문서에 맞춘 것. 실제 `zgmini.kr` RUM Account Analytics 스키마·API 인증·샘플 수·모바일/PC LCP/INP/CLS P75를 검증한 것은 아니다. 해당 값은 `UNVERIFIED`로 유지하고 실측 없이 `siteGoodCertified=true`나 12/12 달성으로 승격하지 않음. 신규 유료 플러그인·구독·키·Controller allowlist·실사이트 데이터 전송을 추가하지 않음.
- 다음 작업: 유효한 기존 권한 범위에 Cloudflare Web Analytics 읽기 경로가 실제 확인되면 서비스 측 표본·필터·기간·모바일/PC P75 readback. 미확인 계정 GraphQL POST를 기존 Workers GET으로 우회하지 않음. 전체 고도화 11/12 + #8 부분(91.7%) 유지.

## #8 RUM P75 bot 및 경로 범위 오류 수정 후보 — 2026-11-25

- **원인 분리:** 병합된 `main`의 `GRAPHQL_QUERY`는 `requestHost=zgmini.kr`만 제한하고 `limit:30`으로 RUM 모든 경로를 조회하여 `/`, `/economic-indicators/` 대상 그룹 누락 가능성이 있으며 `bot` 조건 부재로 봇으로 분류된 방문이 P75에 혼입될 수 있다. 원인/입력은 정적 쿼리로 확인되었고 **실제 운영 샘플 혼입·누락은 미확인**.
- **근거:** Cloudflare 공식 [Web Analytics Core Web Vitals](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)의 P75/실사용자 범위, [2026-10-13 RUM GraphQL 공지](https://developers.cloudflare.com/changelog/post/2026-10-13-core-web-vital-subparts/)의 dataset 및 마이크로초/음수 결측 규약, 공개 [Cloudflare GraphQL introspection 스키마 사본](https://pages.johnspurlock.com/graphql-schema-docs/cloudflare.html)에서 `AccountRumWebVitalsEventsAdaptiveGroupsFilter_InputObject`의 `bot:uint8`, `requestPath_in:[string!]`, 응답 `dimensions.bot:uint8!` 존재 재확인. 비공식 사본이므로 실계정 schema/readback 확인을 대신하지 않는다.
- **소스 변경:** [Draft PR #3541](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3541), 브랜치 `codex/ci-rum-bot-page-scope-20261125`, HEAD `c608191e4f7dcd8a301ef8a2c69a2430eff65338` (기준 main `c436cc97dc933ad0c3e09f4a2b8339b7244a59c6`). `controller/cloudflare-rum-field-parser.mjs`: API query에 고정 `requestPath_in:["/","/economic-indicators/"]`, `bot:0` 추가; 결과에도 `dimensions.bot` 요청하여 bot!=0 row 제외; 이벤트 그룹 count=0이면 실제 값 주장 없이 metric `UNVERIFIED`. `tests/cloudflare-rum-field-parser.test.mjs`에 봇/경로 계약 및 0건 Good 오인 회귀 2건 추가. 변경 **2파일**, 신규 Runner·workflow·credential·Cloudflare 호출·Controller operation·PC 설치·DB/D1·예약·배포 **없음**.
- **CI 최초 확인:** 같은 HEAD [PC Secret Scan #45588683503](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45588683503) **SUCCESS**; [C996 #45588683470](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45588683470), [Controller Maintenance #45588683464](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45588683464) **queued**. 완료 검증을 추정하지 않고 기존 실행 결과를 후속 회수한다. 사용자 승인/정규 B 소스 설치 없이 임의 OAuth RUM GraphQL POST를 수행하지 않는다.
- **전체 완료:** 독립 Lab/CI 계약 향상과 실제 실방문자 자료 인증 구분. 실제 `zgmini.kr` RUM P75 및 Good 등급은 `UNVERIFIED`, CI 전체 엄격 11/12 + #8 부분 **91.7% 유지**.
