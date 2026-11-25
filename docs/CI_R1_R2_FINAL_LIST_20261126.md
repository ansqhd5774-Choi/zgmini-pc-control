# ZGMINI CI 1차(R1)·2차(R2) 최종 적용 목록

기준일: **2026-11-26 (KST)**  
작업 원장 브랜치: `codex/pc-automation-process-improvement-20261119` (`ansqhd5774-Choi/zgmini-pc-control`)  
개발 및 병합 기준: `ansqhd5774-Choi/zgmini` · `ansqhd5774-Choi/zgmini-pc-control`

> **사용자 승인 범위 변경:** 차세대 R2 **#8 웹 성능 Good/P75·Performance Budget**은 2026-11-26에 도입 대상에서 **제외하고 전용 CI를 삭제**했다. 기존 11개 R2 완료 증거는 유지한다. **#8 제외를 12번째 성공으로 계산하지 않는다.**

## 1. 최종 진행 현황

| 구분 | 최초 계획 | 유지 대상 | 유지 대상 완료 | 판정 |
|---|---:|---:|---:|---|
| 1차 R1 — 기본 CI 검사 **영역** | 8 | 8 | 8 | **8/8 완료** |
| 2차 R2 — 차세대 CI **기술** | 12 | 11 | 11 | **11/11 완료, #8 제외** |
| **업무 범위 내 합계** | **20** | **19** | **19** | **19/19 완료(재설정된 범위)** |

R1 8개는 **검사 영역**, R2 12개는 **개별 기술 작업**이다. 따라서 전체 19/19는 19개의 신규 GitHub Workflow·외부 서비스를 설치했다는 의미가 아니다. #8 제외 이전의 이력 상태는 **R1 8/8 + R2 11/12 = 19/20(95%)**였으며 이력에서 지우지 않는다.

## 2. 1차 R1 — 최초 CI 8개 영역

| 번호 | 검사 영역 | `zgmini` 웹 본체 | `zgmini-pc-control` PC 제어 |
|---|---|---|---|
| R1-01 | Lint | 변경 소스 ESLint — **적용** | 변경 소스 Oxlint — **적용** |
| R1-02 | Type Check | TypeScript `tsc --noEmit` — **적용** | TypeScript 소스·빌드 체계 없음 — **N/A** |
| R1-03 | Build | `npm ci`, 웹 빌드, 자산 증거 — **적용** | 웹 빌드·lockfile 없음, 대신 SHA/manifest/CAS 검사 — **N/A** |
| R1-04 | Unit | Node 테스트 — **적용** | C996 변경 소스 Node 테스트 — **적용** |
| R1-05 | Integration | 격리 계약 시험 — **적용** | Controller/Writer 격리 계약 시험 — **적용** |
| R1-06 | E2E | 지정 Chromium/Playwright 브라우저 경로 — **적용** | 합성 요청→Controller/Writer→JSON/TXT 영수증 격리 E2E — **적용** |
| R1-07 | Security | CodeQL, npm audit — **적용** | 변경 Workflow Zizmor — **적용** |
| R1-08 | Secret | Gitleaks — **적용** | Gitleaks — **적용** |

R1의 **범위별 완료는 8/8**, 실제 PC 적용 가능한 영역은 6개 적용 + 2개 구조상 N/A다. 기존 [웹 R1 정본](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/CI_EIGHT_AREA_STANDARD_R1.md) 및 [PC R1 정본](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/docs/CI_EIGHT_AREA_STANDARD_R1.md)을 재사용한다. 주요 구축 증거는 PC [#3384](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3384), [#3396](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3396), [#3400](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3400), [#3445](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3445), [#3448](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3448), 웹 [#1566](https://github.com/ansqhd5774-Choi/zgmini/pull/1566)이다.

## 3. 2차 R2 — 차세대 CI 원안 12개 및 최종 유지 11개

아래 **기술 번호(#1, #6 등)는 원래 40종 후보 목록 번호**를 그대로 유지한다. 12종을 순서대로 1~12로 재번호 부여하지 않는다.

| 후보 번호 | 기술·업무 | 최종 판정 | 구현·병합 증거 |
|---|---|---|---|
| #1 | Dynamic CI | **완료/유지** | [웹 PR #1584](https://github.com/ansqhd5774-Choi/zgmini/pull/1584) |
| #6 | Architecture Testing | **완료/유지** | [웹 PR #1595](https://github.com/ansqhd5774-Choi/zgmini/pull/1595) |
| **#8** | **Performance Budget / Web Speed Good·실사용자 P75** | **사용자 제외·전용 코드 삭제** | [웹 PR #1631](https://github.com/ansqhd5774-Choi/zgmini/pull/1631), 2026-11-26 |
| #12 | Workflow Governance | **완료/유지** | [웹 #1581](https://github.com/ansqhd5774-Choi/zgmini/pull/1581), [#1583](https://github.com/ansqhd5774-Choi/zgmini/pull/1583) |
| #15 | Supply Chain Security | **완료/유지** | [웹 PR #1596](https://github.com/ansqhd5774-Choi/zgmini/pull/1596) |
| #19 | CI Observability | **완료/유지** | [PC PR #3483](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3483) |
| #20 | Data CI | **완료/유지** | [웹 PR #1600](https://github.com/ansqhd5774-Choi/zgmini/pull/1600) |
| #23 | Cross-browser CI | **완료/유지** | [웹 PR #1594](https://github.com/ansqhd5774-Choi/zgmini/pull/1594) |
| #24 | Performance CI — 격리 Chromium Lab | **완료/유지** | [웹 PR #1593](https://github.com/ansqhd5774-Choi/zgmini/pull/1593) |
| #25 | Accessibility CI — axe-core | **완료/유지** | [웹 PR #1592](https://github.com/ansqhd5774-Choi/zgmini/pull/1592) |
| #29 | Bundle Size CI | **완료/유지** | [웹 PR #1585](https://github.com/ansqhd5774-Choi/zgmini/pull/1585) |
| #36 | Continuous Benchmarking | **완료/유지** | [웹 PR #1601](https://github.com/ansqhd5774-Choi/zgmini/pull/1601) |

**최종 R2: 최초 12종 중 #8 제외, 적용 대상 11종 모두 완료(11/11).** 각 '완료'는 기존에 확정된 지정 범위의 구현·CI·main 반영을 의미하며, 사이트 전체 성능 인증이나 운영 데이터 무결성의 포괄적 보증이 아니다.

## 4. #8 제외·삭제의 정확한 실행 증거

- 사용자 명시 결정에 따라 [웹 PR #1631](https://github.com/ansqhd5774-Choi/zgmini/pull/1631)을 병합. `zgmini/main` 병합 SHA **`29851041f6103adabaaedf458a2451ec0a995cbf`**.
- #8 전용 **8파일 삭제**(Good 기준, PageSpeed Insights, Production 브라우저 계측, 과거 성능 예산 비교의 각 스크립트와 테스트), 공통 브라우저 Workflow에서 #8 단계·수동 PSI 입력 제거.
- **공유 #24 실험실 CI, 접근성·교차 브라우저·기타 기능 회귀는 보존**. 실제 PR HEAD CI **5/5 SUCCESS**, 정확 병합 SHA의 `check`/`scan`/`analyze`/`verify`/`Workers Builds` **5/5 SUCCESS**. Production SEO **36/36 PASS**, sitemap **36/36 PASS**.
- PC 제어 RUM 원장 [#3572 최종 종결 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3572#issuecomment-7172984772)과 #8 전용 A 조회 이슈 **9/9 `closed/not_planned`**. 원본 JSON/TXT, 최초 관측값, 코드 및 운영 완료 증거는 그대로 보존.
- **실사용자 RUM 측정치는 과거 창 기준 11/12로 남으며**, 경제지표 모바일 INP의 값은 `null`이다. #8을 제외한 것은 결측 해결이나 Good 인증 성공을 의미하지 않는다.

## 5. 관리 기준 및 다음 행동

**2026-11-26 후속 전수 점검 개선계획:** [CI R1·R2 19개 후속 개선 실행계획 R1](CI_R1_R2_FOLLOWUP_IMPROVEMENT_PLAN_20261126.md)을 따른다. #23·#25·#1·#19·#29·#12 6건은 **재현·수정 필요성 판정 전 개선 후보**이며, 19/19 기존 구축 완료 상태와 별개로 관리한다. #8 제외·삭제와 기존 보호 기준은 유지한다.



1. 앞으로 CI 1·2차 완료 보고의 대상은 **R1 8/8, R2 11/11, 총 19/19**로 계산한다. 원안 20종과 제외된 #8 이력은 별도로 표시한다.
2. 완료된 11종을 반복 구현하거나 #8 미실측을 새로운 미완료 항목으로 재등록하지 않는다. **#8 재도입은 사용자 별도 결정**이 필요하다.
3. 추가 예약 검증·유료 측정·새 PC 작업·Cloudflare 설정 변경·운영 재배포를 본 목록 작성의 완료조건으로 추가하지 않는다.
4. 이 문서는 기존 [상세 평가·진행 원장](NEXTGEN_CI_APPLICATION_REVIEW_R1_20261125.md)의 **최종 범위 색인**이다. 기존 40종 평가와 2026-11-25까지의 19/20 진행 경과는 이력으로 보존한다.
