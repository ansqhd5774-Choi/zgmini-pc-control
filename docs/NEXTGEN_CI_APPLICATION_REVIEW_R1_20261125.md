
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
