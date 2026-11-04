# ZGMINI 일일 QA 점검표 및 결과 — 2026-11-05 KST

- 점검 ID: `QA-20261105-01` | 실측 시각: 07:28–07:32 KST | 판정: **미완료**
- 기준: [일일 점검표 DAILY-R1](../ZGMINI_DAILY_QA_CHECKLIST.md) / [QA-R7](../ZGMINI_MASTER_QA_STANDARD.md)
- **핵심 결론:** 기발표 6개 지표의 공개 관측값을 읽지 못해 **공식값↔ZGMINI 일치 판정 0/6건**. 자료 누락 0건으로 해석하면 안 됨.
- **판정 방식: 결과는 `합격` 또는 `불합격`만 사용.** 현재 증거로 기준 충족을 입증하지 못하면 `불합격`이며, 메모에서 미검증·부분 확인·접근 제한·실제 오류를 구별함. **검증 미완료를 사이트 데이터 오류 확정으로 해석하지 않음.**
- 합격 기준: 기대 기준과 실제 측정값·관측일·게시 결과가 함께 확인되어야 함. 단순 실행·소스 발견·HTTP 200은 합격 근거 아님.

## 1. 기발표 지표 최신성 대조 (최우선)

| 점검 항목 | 기준 | 결과 | 메모 |
| --- | --- | --- | --- |
| **CPI** | 2026년 9월 관측분(10/14 기발표)이 동일 지표·단위로 공개돼야 함 | **불합격** | **판정 사유:** **미검증** — 사이트 관측일/값 미조회. [BLS CPI](https://www.bls.gov/cpi/). 8월 이하이면 누락 후보; 현재 표시값 불명 |
| **PCE** | 2026년 9월 관측분(10/29 기발표)과 공개값 대조 | **불합격** | **판정 사유:** **미검증** — 공개값 미조회. [BEA 9월 PCE](https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026). 8월 이하이면 누락 후보 |
| **미국 고용** | 2026년 9월 고용·실업 관측분(10/02 기발표) 반영 | **불합격** | **판정 사유:** **미검증** — 공개값 미조회. [BLS 고용](https://www.bls.gov/news.release/empsit.htm). 서로 다른 하위 시계열의 발표 주기 구분 |
| **PPI** | 2026년 9월 관측분(10/15 기발표) 반영 | **불합격** | **판정 사유:** **미검증** — 공개값 미조회. [BLS PPI](https://www.bls.gov/ppi/). 8월 이하이면 누락 후보 |
| **ECI** | 2026년 3분기 관측분(10/30 기발표) 반영 | **불합격** | **판정 사유:** **미검증** — 공개값 미조회. [BLS ECI](https://www.bls.gov/news.release/eci.htm). 2분기만 표시되면 누락 후보 |
| **JOLTS** | 2026년 9월 관측분(11/03 기발표) 반영 | **불합격** | **판정 사유:** **미검증** — 공개값 미조회. [BLS JOLTS](https://www.bls.gov/news.release/jolts.htm). 8월 이하이면 누락 후보 |
| **ULC** | 2분기 수정치 반영 확인. 3분기 잠정은 11/05 22:30 KST 발표 예정 | **불합격** | **판정 사유:** **수정 반영 미검증**, 3분기 미도래. [BLS 생산성·ULC](https://www.bls.gov/news.release/prod2.nr0.htm). 미래 발표분을 누락 FAIL로 처리하지 않음 |
| **GSCPI** | 직전 공식 관측분 확인. 10월분은 11/06 00:00 KST 정기 갱신 예정 | **불합격** | **판정 사유:** **직전 값 미검증**, 10월 미도래. [뉴욕 연은 일정](https://www.newyorkfed.org/research/calendars/i-nov26.html). 공급 자료 실제 마지막 관측일 미조회 |

> 위 발표 지표의 **불합격**은 현재 보고서가 최신 반영을 증명하지 못했다는 뜻입니다. **실제 사이트 데이터가 틀렸다고 확정한 것이 아닙니다.**

## 2. 일일 필수 점검 11개

| 점검 항목 | 기준 | 결과 | 메모 |
| --- | --- | --- | --- |
| **D01 — 대상 등록부** | 실제 공개 URL와 세부 시계열·API 매핑 누락 없어야 함 | **불합격** | **판정 사유:** **PARTIAL** — 소스 URL 36개 등록, 실제 공개 0개 확인. [36경로 등록부](./ZGMINI_QA_SOURCE_REGISTRY_20261105.json). sitemap/카탈로그만으로 운영 전체·시계열 전수 PASS 불가 |
| **D02 — 발표일·공급 확인** | 모든 시계열의 발표/공급 일정을 확인하고 미도래와 기발표 구별 | **불합격** | **판정 사유:** **PARTIAL** — 대표 8종 공식 일정 확인, 공개값 0/6 대조. 위 표. 전체 내부 시계열 일정과 공급처 실제 제공 여부는 별도 미검증 |
| **D03 — 최신 관측 전달** | 공식값→PC 저장→계산→D1/API→화면의 관측일·수치 일치 | **불합격** | **판정 사유:** **STATE_UNKNOWN** — 기발표 6건 중 0건 경로 검증. 이전 [#314](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/314)는 당시 19개 PC↔공개 D1 차이가 메타데이터 한정이었다는 증거이지 오늘 최신성 증거 아님 |
| **D04 — 값·결측 정확도** | 단위·부호·정정·0/null/missing/stale·판단 색 실제 데이터 일치 | **불합격** | **판정 사유:** **STATE_UNKNOWN** — 최신 실측값 대조 0건. 소스에는 처리 규칙 존재하나 실제 신규값 검증 없음 |
| **D05 — 서비스 노출** | 홈/위험·경제 목록/주요 동적 페이지 실제 본문 로딩·탐색 성공 | **불합격** | **판정 사유:** **AUTOMATION_BLOCKED** — 실제 로딩 실측 0건. 연결 브라우저 컨텍스트 부재. 이는 사이트 장애 확정이 아님 |
| **D06 — 공개 API** | 관련 API의 관측일·상태·payload 내용/READY-PARTIAL 일치 | **불합격** | **판정 사유:** **AUTOMATION_BLOCKED** — live payload 0건. 공개 주소는 현재 조회 도구에서 접근 실패; HTTP 200만으로 PASS 불가 |
| **D07 — PC 수집·계산·게시** | 최근 checkpoint + 해당 지표의 신규 관측 저장·계산·게시 각각 확인 | **불합격** | **판정 사유:** **PARTIAL** — A급 5건 실행, operation PASS 4건/BLOCKED 1건. [Core #395](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/395) checkpoint 최근 COMPLETE/VERIFIED; [캘린더 #398](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/398) 입력 5/5이나 PARTIAL/미게시; [공탐 #399](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/399) 당일 데이터 있으나 HISTORY_DIVERGENCE; [source #400](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/400) runtime SHA 미검증 |
| **D08 — 상세 UI** | 경제 12·위험 8의 PC/모바일 값·날짜·판단·색·레이아웃 렌더 일치 | **불합격** | **판정 사유:** **AUTOMATION_BLOCKED** — 실화면 0/20. 소스 기준 20종 공통 구조·색상 규칙 존재. 실제 배포 computed CSS/화면은 미확인 |
| **D09 — 차트 기간** | 변경된 차트의 기간·마지막 점·축·색상·잘림 정확 | **불합격** | **판정 사유:** **NOT_RUN** — 실제 변경 차트 실측 0건. 라이브 데이터·화면 접근 전까지 합격 불가 |
| **D10 — 호출 한도/장애** | 승인 Alpaca 120회 주의·140회/60초 상한 및 계정 잔여 30% 보호 | **불합격** | **판정 사유:** **PARTIAL / 차단** — 보호 여부 미검증. [#396](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/396) `ALPACA_LEDGER_ABSENT`; 140회 초과 증거는 없음. 타 작업 전역 차단 금지 |
| **D11 — 문제·보고** | LAST PASS/FIRST FAIL·책임·최소 조치·RETEST를 남기고 보고 | **합격** | **판정 사유:** **PASS(보고 행위만)** — 5개 원본 Issue/본 문서 확보. 본 PASS는 D01~D10이나 전체 서비스 정상 판정 아님 |

**일일 필수 점검:** **합격 1/11(9%) · 불합격 10/11(91%)**. 불합격 메모 분류: 부분 확인 4 / 상태 불명 2 / 접근 제한 3 / 미실행 1. **서비스 정상률·데이터 최신률은 별도 산출 불가.**

## 3. 해결해야 할 문제 (우선순위)

| 점검 항목 | 기준 | 결과 | 메모 |
| --- | --- | --- | --- |
| **P1 — 기발표값 미대조** | 위 6종 공식값과 ZGMINI 최신 관측일·수치 실제 비교 | **불합격** | **판정 사유:** **미완료 / 핵심 목적 미달성**. 첫 미확인 단계=공개값·PC 관측값 Reader. QA 총괄이 조회 경로 확보 후 6종 비교를 책임. RETEST=각 공식·PC·D1/API·화면 수치·관측일 일치 또는 첫 실패 지점 특정 |
| **P2 — Alpaca 진단 차단** | 원장·실제 처리 경로로 계정 전체 한도 보호 확인 | **불합격** | **판정 사유:** **`ALPACA_LEDGER_ABSENT`**. [#396](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/396), [#400](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/400). 운영 승인 source 확인 불충분·inventoryTruncated=true. 한도 정책은 유지, `alpacaIncremental` 최근 status/errorCode/runRequests·실제 경로만 확인 |
| **P2 — 캘린더 공개 결과** | 저장 결과→게시 원장→D1/API→Reader 일치 | **불합격** | **판정 사유:** **미검증** — 입력 5/5이나 PARTIAL. [#398](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/398). 담당=시장 캘린더, RETEST=실제 공개값 재조회 |
| **P2 — 미국 공탐 보관 이력** | 최신 현재값과 승인 보관 이력·차트 정렬 | **불합격** | **판정 사유:** **차이 감지 / 원인 미확정**. [#399](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/399) HISTORY_DIVERGENCE. 담당=미국 공탐, RETEST=보관 허용 지연과 공개 기간 차트 비교 |

**NEXT(단일):** 기발표 6종에 대해 현행 승인된 저장 원자료와 공개 결과를 읽기 전용으로 비교할 수 있는 경로를 확보하고, 첫 사례 CPI의 공식값→PC→D1/API→실제 UI 일치를 확인한다. 이후 나머지 5개를 동일 방법으로 판정한다. 새 미래 수집 예약·운영 재배포·불필요한 Controller 전역 검사부터 시작하지 않는다.

**운영 변경:** 없음. 5개 A급 PC 진단에서 providerCalls=0·d1Writes=0·operationalWrites=0. 이 회차의 정기 자동 점검은 미설치이며, 완료를 주장하지 않음.

---

근거 구분: 공식 발표=외부 1차 출처 / PC 진단=각 Issue의 JSON·TXT / UI 구현=GitHub 소스 / live API·UI=미조회. 미조회는 PASS가 아님.
