# ZGMINI 사용자 직접 확인 — 6개 기능 최종 목표 및 담당 범위 (2026-11-14)

> **목적:** 새 일반챗·GPT 예약 실행에서 기능의 **최종 목적**을 당장의 점검·복구·PR·현재 진행률과 혼동하지 않게 한다. 2026-11-14 사용자가 시장 캘린더 보고 1개와 물가·테마·고용·API·UIUX 5개 보고를 **직접 총괄 대화에 제출**했다. 해당 6개 목표를 현행 사용자 제공 기준으로 삼아 원담당 GitHub 브랜치의 계획/최근 HEAD와 대조했다.
>
> **정본 위계:** 사용자의 최신 명시 지시와 승인 → 제어 최신 `main`의 `AGENTS.md`, `docs/PC_AUTOMATION_STANDARD.md`, `docs/GENERAL_CHAT_START.md` → 기능별 실제 승인/원자료·Runtime/D1/API/UI → 본 문서. 본 문서는 **목표 인계와 범위 정렬 문서**이며 새로운 산식·가중치·출처 권리·DB·TTL·PC 설치·D1 게시·배포·C급 승인을 발생시키지 않는다.
>
> **판정 상태:** `USER_REPORTS_RECEIVED_AND_GITHUB_CROSSCHECKED` / `SOURCE_AND_OPERATING_PROOF_DISTINCT`. 76차의 잘못된 상위목표 판정은 77차에서 철회했다. 이후 사용자 제공으로 W02는 78차, W01·W03·W04·W05·W06은 이 문서에서 **목표만 재인식**한다. 각 실행 단계별 현재 운영 성공 판정은 해당 실제 증거로만 판단한다. 전용 브랜치 HEAD는 조회 당시 참고값이며 매 실행 직전 재조회해야 한다.

## 1. 8개 역할의 목표·진행률 분모

| ID / 담당 | 상위 최종 목적 | 현재 단계와 기존 보고 숫자의 정확한 뜻 | 상위 목적 실제 달성률 |
| --- | --- | --- | --- |
| **COORD / 프로세스 총괄** | 승인된 실기능 완성을 지원하기 위해 **공통 Runner/Controller/권한·공유 장애와 운영 안전 문제를 직접 처리**, 기존 W01~W07 결과를 수령·검증하고 다음 지시를 배정한다. 기능 원담당의 구현 책임을 대신 수행하거나 8번째 일반챗 담당자를 만들지 않는다 | 공통 #1351 `queued`(실PC 배정 미실행), #996 C NO-GO/80% 등은 공통 작업의 시점별 상태. 완료 전부로 포장 금지 | 별도 집계 |
| **W01 / 물가지표** | 최초 **31개 후보 중 #20 제외 = 30개 평가 대상**. 기존 19개부터 사이트에 연결·검증 → 나머지 번호상 11개 공식 수집/권리/중복 검토 → 30개 품질·적합성 판단 후 실제 채택 목록 결정 → 사용자 승인 종합 물가 산식·가중치 설계/검증 → 실제 PC 수집·저장·계산·D1/API/UI 종단 운영 완성 | **42%**는 현재 기존 물가 기능 보고값; **23/26**은 독립 저장 입력 수집 단계, **4/7**은 신규 연구자료 공개 확인. **26/7은 상위 30후보/산식 목표의 대체가 아님** | **미산정** |
| **W02 / 시장 캘린더** | 공식 미국 경제 발표·중앙은행·주요 금융시장 일정·기업 실적 예정·정정, 권리 충족 한국/추가 국가를 `/market-calendar/`에서 검색·주/월·남은 시간·실제/이전/허가된 예상값·별점으로 제공. 승인 PC→SQLite→계산→D1→API/UI 자동 갱신 | TreasuryDirect TA_WS **95/100**은 365일 기능 *단독* 진행률; 마지막 원문 독립 A 감사 **0/5점**. ER1, FOMC, 기업 실적/국가 확장은 별도 | **미산정** |
| **W03 / 테마 공포·탐욕** | **인기순 163개 각 테마**의 ETF/SPY 실제 수집·저장·승인 산식 계산·이력·D1/API/PC·모바일 자동 갱신. 설정/공통 엔진으로 운영하고 개별 파이프라인·예약 복제 금지. **P1 → P4 → P2 → P3**: 현재 공개 10개 정상화 → 공개 콘텐츠 안정화(병행) → 공통 엔진 완성 → 인기순 신규 테마 한 개씩 실제 게시 확대 | **T1 20%** = *기존 공개 10개 공통 플랫폼 이관* 5단계 중 연결 명세 확정; **163개 전체의 20% 아님**. 현재 공개 10개 정상화 최근 0/10(당시), R181 첫 실패 원본 인계 부족 | **미산정** |
| **W04 / 고용 R6** | **BLS 24 + DOL/ETA 5 = 29개** 고용 세부지표 공식 수집, 1년 차트와 산식 점수·PIT·결측 분리, SQLite→승인 D1→`/api/employment-r6/observations`→고용 페이지 종단 실제 검증 | **87.5%**는 최신 원담당 8단계 환산 관례; 공식 S1~S7 구계획은 과거 **약 55%**로 분모가 다름. **28/29 READY**는 이전 시점 실제 상태, 현장 재검증 필요. 51지역×실제 연속 주(약 577주) 원자료 gap 조사 미완료. **29/29 READY 강제 금지** | 종단 완료 미검증 |
| **W05 / API–사이트 연결** | 승인된 공급자→운영 PC/SQLite→저장값 기반 계산→로컬 결과→정확 D1 게시/readback→Production API→PC·모바일 값/날짜/차트 일치·정상 갱신을 기능 간 검증한다. 원담당의 Collector·산식·Writer 책임을 대체하지 않음 | **75% = 현행 5개 API/D1 정확키 동치 검증 4단계 중 3단계 준비**, 운영 D1/API/Cloudflare 동시 증거 **0/5**. 2026-10 실적 침체 분석 `/earnings-recession/` 정보성 지표 확대 **R1~R6는 역사적 별도 목표**, 현행 75%로 종결 금지 | 전체 API 연결 완료율 **미산정** |
| **W06 / UIUX** | 승인된 ZGMINI 경제·금융 데이터가 실제 Production에서 **PC·모바일 화면의 수치·단위·날짜·결측·stale·차트·축·마지막 점·레이아웃**에 정확히 표시되도록 UI 수정·선별 main 통합·exact 배포와 화면 실증 완료. 현재 우선 수용검사는 물가/고용/시장/테마 **4페이지 × 2뷰 = 8뷰** | **25%**는 기존 UIUX 기능 보고율; 소스 PR #1066/#1068/#1069 CI 성공은 실제 배포가 아님. **Production 0/8**; 승인된 #1068 5파일 main 병합 GO/HOLD 및 Production 캡처가 남음 | 실제 UI E2E 미완료 |
| **W07 / 독립 지원** | 총괄이 **명시적으로 배정한 독립 감사·자료 조사·소스 증거 대조**를 원담당/총괄로 반환하는 지원 역할. 영구적인 D05 기능 Owner나 별도 8번째 기능 전담자는 아님 | 당시 D05 입력 계보 `HISTORICAL_INPUT_LINEAGE_UNPROVEN`; 지원 조사 완료와 D05 실기능 0/68은 별개. 고정 전용 브랜치 미지정 | 배정된 과제별 집계 |

**전체 진행률 경고:** 전통적 6개 기능 수치 (42+95+20+87.5+75+25)/6 = **57.4% 참고 산술평균**. 그런데 위 수치들은 **서로 다른 단계·분모**다. 그러므로 57.4%를 목표 기준의 실질 전체 기능 완료율로 주장하지 않는다. **ZGMINI 전체 E2E 최종 달성률 = 미산정/UNKNOWN**. 기존 57.4% 기록은 참조로 보존.

## 2. W01 — 물가 최종 지시와 실제 다음 단계

- **전용 브랜치:** `fix/economic12-inflation-legacy4-r35-20261021`, 조회 HEAD `a55b91694231e379029a66ab65430ee5f4013717`.
- **목표 오인 금지:** 30개는 **후보 평가 수**, 26개는 **독립 원자료 수집 단계 수**. 30 = 19 기존 + 7 신규 + 3 정의·권리 보류(#15,#17,#30) + #27(원자료 #26과 중복). #20 국제 운송비 제외. #27 수집 중복이라고 최종 선정 후보 자체를 임의 삭제하지 않음. 보류 3개를 무단 게시/산식 포함도 금지.
- **현재 이슈:** BLS CPI 임대료 #22 `CUSR0000SEHA`, OER #23 `CUSR0000SEHC01` INVALID/0; Census 제조업 총재고 #28 `MTM/TI` MISSING. 기존 PPI #24 유효 **203건 보존**. 기존 성공 19/4축 물가 원산식·기존 공개 결과 불변.
- **다음 승인 작업:** [제어 Draft PR #1336](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1336) `open/draft/not-authorized`; 승인 Owner가 정확한 source·manifest·고정 4 운영 대상 파일의 **효과 GO/NO-GO**를 판정. PR의 실제 변경 파일은 GitHub상 **1개 승인 계획 파일**이며, 그 안의 설치 대상 4파일과 혼동하지 않는다. 소모 #1177 재사용 금지. 허용된 독립 파서/게시/권리 검토를 공통 장애 때문에 중단하지 않음.
- **연결 종착점:** 기존 19개 우선 실사이트 정확성 확인 → 신규 후보 합법·적격성/원자료 복구·게시 → 30후보 최종 판정 → 사용자 승인 산식·가중치 확정 → 전체 수집·저장·계산·로컬 결과·D1/API/UI 검증. 미래 자연 예약 갱신은 후속 관측.
- **근거:** [현재 R1 26/7 실행계획](https://github.com/ansqhd5774-Choi/zgmini/blob/fix/economic12-inflation-legacy4-r35-20261021/docs/INFLATION_26_SOURCE_AND_PUBLICATION_EXECUTION_PLAN_R1_20261110.md), [원본 11 후보 분류](https://github.com/ansqhd5774-Choi/zgmini/blob/fix/economic12-inflation-legacy4-r35-20261021/docs/INFLATION_MISSING11_REGISTRATION_REVIEW_R2_20261108.md).

## 3. W02 — 시장 캘린더 상위 통합 목표

- **전용 브랜치:** `codex/zgmini-gpt-workspace-20261025`; 최신 HEAD는 매 실행 재조회.
- **최종 범위:** 공식 경제·금융·실적 일정 통합 확대, 권리/수집·저장/자동 게시/API/UI/정정·결측 관리. 고정 출처 수/사건 수 없음.
- **Treasury 현재 단계:** TA_WS 365일 `95/100`, 잔여 원문 독립 A 감사 `0/5`. 운영 PC A `source-inventory-runtime-readonly` 실제 설치 SHA/allowlist/lease 인계가 **현재 최초 필요**. 미설치이면 운영 A 발행하지 않음. 승인 설치가 확인되면 W02 원담당 단 1회 pc-job 실행→원문기간/수·SHA256·WAL·JSON/TXT 2/2→D1/API/UI 동일 버전.
- **별도:** ER1 `★★★ >=97, ★★ >=85, ★ <85`, 결측은 `-`; 2027 FOMC 정책/전략회의 구별 Draft PR #1063; 원자료/게시/외부 국가 확장.
- **근거:** [총괄 78차 사용자 확인](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6868201728), [W02 상위 프로젝트](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/zgmini-gpt-workspace-20261025/docs/MARKET_CALENDAR_PROJECT_SCOPE_AND_HANDOFF_20261027.md).

## 4. W03 — 테마 163개와 P/T 단계 분리

- **전용 브랜치:** `codex/theme-fear-greed-integration-20261025`, 조회 HEAD `7d8366d0bc3d67030ff494fe4d2e1b09065f70e8`.
- **상위 P 우선:** **P1 기존 공개 10개 운영 정상화 → P4 공개 콘텐츠 안정화(동시 진행) → P2 공통 계산/수집/게시 엔진 실운영 → P3 인기순 신규 1개씩 등록·승인·공개, 최종 163개 실제 운영**. 163개 완성 전에도 이미 공개된 테마는 유지.
- **기술 T milestone:** T1 20% (10/10 ID·입력/산식 매핑 DONE), T2 40% (공통 실연결 PARTIAL), T3 65% (저장 입력 Shadow), T4 85% (승인 PC·D1·공개 10개 실제 전환), T5 100% (설정형 추가 테마 실증). **T5 100% ≠ 163/163 운영 완성**.
- **원자료/산식/권리:** R158/T40·R20·V40 = 40/20/40 승인 모델, 252일 실제 관측 차트, 확정 GetMarketHistory 원가격 1시간봉, MarketParquet 잠정치 공개권은 별도. 실제 ETF/SPY 거래일·SHA·checkpoint/승인된 적격성, 데이터센터 PAIR50 및 우주 개별 승인 방법론 보존. `AI·반도체`는 별도 공개 승인 전까지 현재 공개 10개에 합류 금지.
- **현재 가장 먼저 필요한 원본:** 공용 승인된 운영 PC의 `r181-primary-cycle.mjs` 현행 설치 소스 SHA·실행 실패 기록/계측 가능한 원장 변경 지점과 수정 승인 효과를 **기존 단일 운영 Owner가 W03에 인계**. 그 후 실제 FIRST FAIL HTTP/status 또는 NO_STATUS 좁은 계측→승인 GMH 저장→R178 rolling 게시/readback→기존 10개 API/UI 검증. 이미 존재하는 STOP 9건을 HTTP 원인 실증으로 과장하지 않음.
- **근거:** [163 테마 상위 마스터](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/theme-fear-greed-integration-20261025/docs/THEME_FEAR_GREED_163_THEME_MASTER_PLAN_20261027.md), [5단계 공통 이관](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/theme-fear-greed-integration-20261025/docs/THEME_SCALE_AND_METHODOLOGY_WORKFLOW.md), [플랫폼](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/theme-fear-greed-integration-20261025/docs/THEME_PLATFORM_STANDARD.md), [온보딩](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/theme-fear-greed-integration-20261025/docs/THEME_ONBOARDING_PLAYBOOK.md).

## 5. W04 — 고용 R6의 지표/역사/실운영 조건

- **전용 브랜치:** `codex/employment-1y-reader-r1`, 조회 HEAD `2d78ed157531e54377c337537a670f8c44e93cc9`.
- **29개(7평가군):** Slack 4·20%, Payroll 5·20%, Claims 5·20%, Demand 4·15%, Wage 2·5%, Breadth 3·15%, BED 6·5%. 고정 승인 산식·가중치 변경 금지.
- **S1~S7 완성:** 공식 BLS24/DOL5 원자료 → 기존 Provider/Collector/Reader/산식 → 실제 승인 A/B/운영 source → 후보/Core 원자료·PIT 대조 → 실제 수집·로컬 점수·1년 이력 → 승인 D1 row/hash/stored_at → `/api/employment-r6/observations` 및 `/economic-indicators/employment/` PC/모바일 29행 검증.
- **현재 초점:** `STATE_CLAIMS_BREADTH` 51지역(50주+DC)에서 약 577연속 주(약 29,427 지역×주 조합; 정확 필요 주수 Reader가 실측 산출), `firstFailureWeek`/`missingRegionCodes` 운영 관측 미확인. 소스·Windows Node 15/15 PASS는 PC 실행·원본 충족 증거 아님. 정상 PARTIAL/미발표/부족 기간은 정직하게 남기며 29/29 READY 강제 금지.
- **다음 실제 의존:** 공통 총괄이 6 Runner/현재 승인 Controller·Reader 등록/Provider·Collector 운영 SHA를 기존 읽기 승인 경로로 **한 번 실측 가능하게** 확보한 후 고용 담당이 허용 Reader로 최초 결손 주·지역을 판정하고 부족한 원자료만 보강. #1351 queued는 실패 확정 아님, 중복 새 Job 발행 금지.
- **PR 분리:** [기능 Draft #933](https://github.com/ansqhd5774-Choi/zgmini/pull/933) 230파일 미병합, [제어 Reader Draft #1361](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1361) 2파일 미병합. 필요한 파일만 선별 통합. 기존 문서 S1~S7 약 55%와 최신 8단계 87.5%는 분모 불일치; 이 문서에서 **두 수치를 억지로 재계산하지 않음**.
- **근거:** [고용 R6 완료계획](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/employment-1y-reader-r1/docs/EMPLOYMENT_R6_DELIVERY_PLAN.md).

## 6. W05 — API 통합 5개 현재 단계 / 실적 침체 독립 원계획

- **전용 브랜치:** `codex/api-site-integration-r1-20261026`, 조회 HEAD `ec14386eacc3e56039301a7e32c3313628391571`.
- **현재 5개 검사:** ① 물가 19 `/api/inflation-causal-inputs`, ② 신규 물가 7 `/api/inflation-candidate-inputs`, ③ 시장 `/api/release-calendar`, ④ 테마 `/api/theme-fear-greed`, ⑤ 고용 `/api/employment-r6/observations`. 기존 승인 D1 정확키·sourceVersion/sourceStoredAt/stored_at·body SHA 및 Reader 변환 후 실제 공개 JSON을 비교한다. body SHA와 변환 JSON SHA 단순 동일성 강제 금지.
- **현재 75% = 4단계 3개 완료:** API/Reader 계약, 과거 Production HTTP/JSON, 기존 비교기 테스트 **11/11 PASS**. **남은 4단계 = 동시점 D1 5개 실제 row의 저장시각·SHA와 Production API·exact Deployment SHA 대조**. 전체 5키 현재 실증 0/5.
- **오래된 원목표 별도 보존:** `/earnings-recession/`에서 승인 E1-R4 기존 위험 점수 4요소를 유지하면서 권리 확인된 정보성 기업 실적 지표를 **개수 제한 없이 추가하는 R1~R6 계획**은 **별도 범위/현행 완료 여부 미판정**. 현재 다기능 동치 검증 75%로 원목표 완료 선언 금지. 이 분리는 **원목표 폐기를 승인한 것이 아님**.
- **다음 의존:** 기존 승인된 D1/Cloudflare 읽기 소유자가 5키 비민감 읽기 영수증·출처시각·대응 API·exact Production Deployment 인계. W05는 불일치가 확정되었을 때만 범위 좁은 실제 수정을 담당하며 무승인 D1/Cloudflare 쓰기를 수행하지 않음.
- **근거:** [2026-11-14 현행 계획](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/api-site-integration-r1-20261026/docs/API_SITE_R1_ACTIVE_WORK_PLAN_20261114.md), [기존 실적 침체 R1~R6](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/api-site-integration-r1-20261026/docs/EARNINGS_RECESSION_COMPANION_API_SITE_INTEGRATION_PLAN_R1_20261026.md).

## 7. W06 — UIUX 현재 4화면 실검증과 실제 배포 경계

- **전용 브랜치:** `codex/ui-improvements`, 조회 HEAD `c78086804aecc4e42d32c32f7ed31c3405f43562`.
- **현재 4화면:** `/economic-indicators/inflation/`, `/economic-indicators/employment/`, `/market-calendar/`, `/theme-fear-greed/`. **다른 `/inflation/`은 별개 점수 출처**라 혼용 금지.
- **실제 완료 계약:** 소스 최소 수정/회귀 → 승인된 정확 파일만 main 통합 → Cloudflare Git Integration Build와 exact Deployment → 실제 1440px 4장 + 390px 4장 PNG 8장 → 동시점 5개 API 값/단위/원출처·관측·게시일·PENDING/STALE·축·마지막 점·모바일 가로 넘침 검증 → 실 UI 버그 수정·재검사.
- **현재:** 기능 단계 25%, 브랜치 소스 수정·Node CI 일부 완료. [Draft #1068](https://github.com/ansqhd5774-Choi/zgmini/pull/1068) HEAD `12f0bf05c306788e76a3974dfefcc499499e7fe1` **5개 파일**, 병합 GO/HOLD 공식 판정 대기; [#1066](https://github.com/ansqhd5774-Choi/zgmini/pull/1066)와 [#1069](https://github.com/ansqhd5774-Choi/zgmini/pull/1069) 별도 부분 검토. #1067 기능은 이미 #1068로 중복 포함됐다고 보고되며 **별도 중복 병합 금지**. Production 8장 0/8, 정확 배포·동시점 API 대조 미완료.
- **현재 FIRST FAIL 구분:** 별도 모의 브라우저의 교육 문구 hidden-selector timeout ≠ Production 확정 장애; 실제 통합 절차의 `MAIN_MERGE_HOLD`와 브라우저 접근 제한 `AUTOMATION_BLOCKED` 분리. 무승인 main merge/Worker 직배포 금지.
- **근거:** [UIUX 64차 기록](https://github.com/ansqhd5774-Choi/zgmini/blob/codex/ui-improvements/docs/workspaces/UIUX_64_NULL_DATE_COMBINED_NODE_CI_20261114.md).

## 8. GPT 예약 실행·총괄 지시 생성의 원칙 (신규 Gate 아님)

1. **모든 새 예약 대화는 자기 ID/전용 브랜치를 기준으로** 이 문서의 상위 목적을 먼저 확인하고, 최신 사용자 지시·제어 main 규칙·본인 브랜치 실제 현재 HEAD·중앙 #68 마지막 유효 지시/결과를 다시 읽는다. **브랜치 SHA/현재 진행률/실PC 상태는 실행 때마다 새로 확인**한다.
2. 매 실행은 `상위 최종 목적` / `현재 승인된 단계 목표` / `이번 구체적 nextAction`을 구분한다. **목표 변경은 사용자 승인 없이 실행 결과나 감사 문서만으로 발생하지 않는다**. 완료된 실행은 증거 재사용. 다수 진행 가능한 독립 소스 작업은 공용 B/C 장애에 묶지 않는다.
3. 담당자는 자신의 범위 안에서 실제 소스/검증을 진행해 **본인 브랜치 원격 SHA**, 테스트·운영·게시 정확 근거와 `LAST_PASS/FIRST_FAIL`을 중앙 #68에 기록한다. 메시지 등록은 다른 대화의 자동 수신을 뜻하지 않는다.
4. 총괄은 신규 결과를 실제 조회하고 **해당 담당자 기존 작업 목표를 축소하지 않는 범위**에서 다음 필수 단계만 발급한다. 운영 Runner/Controller/공유 승인 문제는 총괄의 고유 직접 책임. **총괄+W01~W07 = 실제 8개 역할, 일반챗 담당자는 7명**.
5. 이 문서는 **GPT 예약 생성/실행 또는 새 PC Scheduler/CMD/Cloudflare Cron 추가 승인**이 아니다. 예약 프롬프트에 인용할 상위 목표의 복원 근거만 제공. 사용자 별도 예약 승인 전 실행하지 않는다.

## 9. 이번 확인과 미완료 경계

- 사용자 보고 제공: **W01/W02/W03/W04/W05/W06 6/6**. 실제 GitHub 해당 **전용 브랜치 HEAD 6/6 확인**. 상위/현행 계획 문서 접근 및 PR #1336/#1361/#933/#1068/#1066/#1069 상태 읽기 확인.
- 사용자 직접 확인이 아닌 **현재 PC Runtime·D1·API 정확 동치·Production 배포**는 새로 실행하지 않았으며 여기에 열거한 이전 증거를 최신 실측으로 승격하지 않는다.
- **다음 중요한 종합 작업:** 각 담당 예약 지시문 생성 전 이 목표 분리표를 고정 기준으로 사용. 단기 기능 실행은 위 우선순위와 승인 소유를 따르며, 공유 Controller/Scheduler/DB/Cloudflare 운영 변경은 하지 않는다.
