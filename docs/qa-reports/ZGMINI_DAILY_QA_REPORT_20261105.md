# ZGMINI 일일 QA — 미완료 진단 기록 (2026-11-05 KST)

> **총괄 QA 정정(2026-11-05): 이 문서는 일일 최신성 점검 완료 보고서가 아닙니다.**
> 공식 발표일은 확인했지만 **현재 ZGMINI의 실제 관측일·값과 비교하지 않았으므로 가장 중요한 D02→D03 최신성 검증이 미수행**되었습니다.
> 발표 자료가 이미 제공된 CPI/PCE/고용/PPI/ECI/JOLTS의 **실제 누락 여부는 아직 판정하지 못했습니다.** 5단계 조사 착수나 PC checkpoint PASS를 QA 완료·최신성 확인으로 해석하면 안 됩니다.
> 우선 다음 실행은 기존 공개값/PC 결과를 실제로 읽을 수 있는 승인 경량 경로 확보 후, 기발표 6종의 공식값과 비교·누락 판정하는 것입니다. 이것이 끝나기 전에는 이 보고서를 운영 합격 근거로 사용할 수 없습니다.

---

- 점검 ID: `QA-20261105-01` / 실행 시각: 07:28–07:32 KST
- 점검 기준: `docs/ZGMINI_DAILY_QA_CHECKLIST.md` DAILY-R1, QA-R7
- 개발 사이트 소스: `ansqhd5774-Choi/zgmini` main `708ed262d9425e45c0009c6470a8c7b11ac33884`
- 실제 A급 PC 실행 Controller: `69c830275bd3fec75b17c8a98c46d689447fb1a7` (승인된 Writer SHA `a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e`와 구분)
- QA 저장 위치: `ansqhd5774-Choi/zgmini-pc-control` / `codex/zgmini-quality-audit-20261105` (운영 main 미변경)
- 점검 원칙: 실행 단계와 각 검사의 실증 PASS를 구분. 연결 건강은 최신 관측 반영·게시 성공을 대체하지 않음.

## 요약

| 성과/상태 | 관측 결과 | 판정 범위 |
| --- | --- | --- |
| 5단계 조사·점검·보고 | 5단계 모두 착수하여 접근 가능한 부분 수행 | 전체 최종 합격 **아님** |
| 일일 11개 필수 검사 | 증거상 **PASS 1/11 (9%)**, PARTIAL 4, STATE_UNKNOWN 2, AUTOMATION_BLOCKED 3, NOT_RUN 1 | `D11` 보고만 PASS; 기타 10건 미완전 |
| 공개 소스 등록부 | 36 URL / 위험 상세 8 / 경제 상세 12 / 동적 6 / 정적 7 | SOURCE 확인; 실제 운영 URL·세부 시계열 전수 미검증 |
| 공식 발표 일정 | CPI·PCE·고용·PPI·ECI·JOLTS·ULC·GSCPI 8종의 대표 발표 정보 | 대표 공식 일정 확인; 전체 시계열 전수 아님 |
| PC 읽기 전용 A 작업 | 5개 Issue 중 4개 operation PASS, Alpaca 1개 BLOCKED | 각 operation 자체 결과일 뿐 지표 전체 PASS 아님 |
| 공개 사이트 API/화면 | 브라우저 확장 연결 컨텍스트 접근 실패 | `AUTOMATION_BLOCKED`; 실제 웹 장애라는 뜻 아님 |
| 운영 변경 | 공급처 호출 0 / D1 쓰기 0 / 운영 파일 변경 0 | 읽기 전용 |

## 1단계 — 등록부

- `public/sitemap.xml` 36개 경로를 기준으로 경제 12개·위험 8개 상세 등 공개 점검 후보를 확인.
- 별도 등록부: [ZGMINI_QA_SOURCE_REGISTRY_20261105.json](./ZGMINI_QA_SOURCE_REGISTRY_20261105.json) (원격 재조회 검증).
- 경제 목록 카탈로그는 presentation-only. 전체 하위 시계열의 공급처·관측일·운영 매핑이 확정됐다는 뜻이 아님. 고용 29개 표시 항목 역시 공급 성공이 아님.

## 2단계 — 발표 최신성

| 공식 지표 | 확인된 최신 발표/관측 | 사이트 대조 상태 |
| --- | --- | --- |
| CPI | 2026년 9월 관측, 10/14 발표 | 현행 공개 관측일 미확인 |
| PCE | 2026년 9월 관측, 10/29 발표 | 미확인 |
| 미국 고용 | 2026년 9월 관측, 10/02 발표 | 미확인 |
| PPI | 2026년 9월 관측, 10/15 발표 | 미확인 |
| ECI | 2026년 3분기 관측, 10/30 발표 | 미확인 |
| JOLTS | 2026년 9월 관측, 11/03 발표 | 미확인 |
| ULC | 2분기 수정치 최신; 3분기 잠정은 11/05 22:30 KST 예정 | 최신 수정 반영 미확인; 미래 데이터 누락 실패 아님 |
| GSCPI | 10월 관측 다음 갱신 11/06 00:00 KST 예정 | 이전 자료 마지막 관측일 직접 확인 필요 |

- 공식 근거: [BLS CPI](https://www.bls.gov/cpi/), [BLS 고용](https://www.bls.gov/news.release/empsit.htm), [BLS JOLTS](https://www.bls.gov/news.release/jolts.htm), [BLS PPI](https://www.bls.gov/ppi/), [BLS ECI](https://www.bls.gov/news.release/eci.htm), [BLS 생산성·ULC](https://www.bls.gov/news.release/prod2.nr0.htm), [BEA PCE](https://bea.gov/news/2026/personal-income-and-outlays-september-2026), [뉴욕연은 발표 달력](https://www.newyorkfed.org/research/calendars/i-nov26.html).
- 공식 발표 후 미반영 **확정 0건이 아니라 확인 불가**: 실제 PC→공개 관측일과 값을 재대조하지 못함.

## 3단계 — PC·저장·게시 실증

| Issue | A급 읽기 전용 operation | 실제 결과 | 핵심 제한 |
| --- | --- | --- | --- |
| [#395](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/395) | `core-status` | `PASS / CORE_READONLY_DIAGNOSIS` | 11/05 07:21~07:25 KST의 Core cycle·collection·writer checkpoint 존재/상태만 확인. 관측값·D1 미조회 |
| [#396](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/396) | `alpaca-quota-readonly` | `BLOCKED / ALPACA_LEDGER_ABSENT` | 한도 초과도 30% 여유 준수도 증명 안 됨 |
| [#398](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/398) | `market-calendar-er1-saved-status` | `PASS / ER1_SAVED_INPUT_READONLY` | 5/5 입력일 검증, 그러나 `dataStatus=PARTIAL`, `publicationPerformed=false`, 충돌 커버리지 PARTIAL |
| [#399](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/399) | `fear-greed-archive-status` | `PASS / FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS` | 당일 로컬 관측 존재. `HISTORY_DIVERGENCE`/원인 UNKNOWN, 공개 D1·UI는 미조회 |
| [#400](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/400) | `pc-source-origin-readonly` | `PASS / PC_SOURCE_ORIGIN_CANDIDATE_INVENTORY` | `candidateCount=0`, `inventoryTruncated=true`, `runtimeSourceVerified=false`; 운영 source 부재 확정 아님 |

- 5개 결과 모두 `operationalWrites=0`, `providerCalls=0`, `d1Writes=0`. 저장된 상태를 조회한 진단 PASS를 전 경로 게시 PASS로 확대하지 않았음.
- 기존 2026-11-04 #314의 물가 19개 D1/PC 수치·이력 일치 및 #18 메타데이터 차이는 **당시** 유효 증거로 보존. 11/05 최신 발표 반영의 현재 증거로 재사용하지 않음.

## 4단계 — 사용자 화면·레이아웃

- 경제 상세 12개는 공통 컴포넌트에서 PC 표·모바일 카드의 `기준/이전/현재/판단` 필드 구현 확인.
- 긍정 녹색/중립 회색/부정 적색 미니차트 CSS 구현, 위험 상세 8개의 공통 레이아웃 호출 확인.
- `missing` 판단의 미니차트는 별도 색상 규칙 없이 회색 기본값: 실제 화면에서 중립과 혼동 가능성을 검증해야 함.
- 실제 PC·모바일 페이지·computed CSS·API 본문을 확인하지 못함. 브라우저 플러그인 응답 `Browser access requires the originating browser context`; 대체 무단 접근/클라우드 브라우저 사용하지 않음.

## 5단계 — 오늘 결론과 자동화 상태

| 체크 | 상태 | 현재 증거·미완료 사유 |
| --- | --- | --- |
| D01 등록부 | PARTIAL | source 36경로 식별; 운영 및 전체 시계열 미확인 |
| D02 발표 일정 | PARTIAL | 공식 대표 8종; 전 시계열·개별 공급처 대조 미완료 |
| D03 PC→UI 최신값 | STATE_UNKNOWN | 실제 공식 관측값과 로컬·D1·UI 값 매칭 경로 부족 |
| D04 값·결측 정확도 | STATE_UNKNOWN | 코드 구조만 검토, 최신 실측값 불가 |
| D05 서비스 화면 | AUTOMATION_BLOCKED | 실제 브라우저 연결 컨텍스트 없음 |
| D06 공개 API | AUTOMATION_BLOCKED | live payload 및 D1 비교 수단 없음 |
| D07 PC 수행 | PARTIAL | 5 A job 수행, 실행 기록 확인. 개별 새 관측/게시 완료 미검증 |
| D08 상세 UI | AUTOMATION_BLOCKED | 20개 소스 공통 구조 확인, 화면 실측 없음 |
| D09 변경 차트 | NOT_RUN | 공개 시계열·실제 화면 접근 없음 |
| D10 호출 한도/장애 | PARTIAL | Alpaca 진단 전용 ledger 미존재로 계정 보호 미검증; 기타 작업 전역 차단 근거 없음 |
| D11 보고 | PASS | 본 보고서와 5개 원본 Issue, 책임 분기·NEXT 기록 |

- **일일 엄격 완료율: 1/11 = 9%**. 완료되지 않은 10개 항목을 정상으로 계산하지 않음.
- **반복 일일 예약: 미설치.** 현재 파일은 첫 회차 실측 보고이며, 공개 API·관측일을 가져오는 승인된 경량 Reader가 없어 정상 자동 점검으로 확약 불가. 재수집·운영 쓰기·시각 변경·배포도 하지 않음.

## 문제·우선순위·단일 NEXT

1. **P1 점검 커버리지 격차 (확정):** 공식 신규 발표 후 실제 PC 원자료·D1·공개 화면 관측일 대조 불가. FIRST FAIL=QA 경량 reader/실행 능력 부족, 데이터 장애 자체는 미확정. 책임=QA 공통 reader+관련 기능 담당. RETEST=대표 CPI/PCE/고용 각 1건에서 공식값→PC→게시→화면 일치.
2. **P2 Alpaca 한도 증거 부족 (확정):** [#396](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/396) `ALPACA_LEDGER_ABSENT`. Controller 검사 계약은 고정 ledger 파일을 요구하지만 현재 source에서 ledger는 첫 요청 때 생성 가능. 운영 승인 source SHA는 GitHub 참조 확인 불가, [#400](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/400)도 `inventoryTruncated=true`; 원인 단정 금지. 책임=Alpaca 수집기·공통 quota 담당. RETEST=현재 `alpacaIncremental` 상태/경로 조회와 실제 계정 60초 ledger 확인. 상한 140회/60초 유지.
3. **P2 시장 캘린더 (미확정):** [#398](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/398) 저장 입력 5/5이지만 `PARTIAL`, 게시 미검증. 책임=캘린더 담당. RETEST=ER1 결과 ledger→D1→Reader 대조.
4. **P2 공포탐욕 이력 정렬 (미확정):** [#399](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/399) `HISTORY_DIVERGENCE`, 최신 현재 관측과 보관 이력의 차이. 책임=미국 공탐 담당. RETEST=허용 보관 지연창과 공개 기간 차트 이력 대조.
5. **P2 공개 UI 확인 부재 (접근 제한):** 연결된 Browser 세션 부재. 첫 실패=브라우저 플러그인 세션 컨텍스트, 실제 서비스 실패 아님. 책임=QA 런타임 점검 경로. RETEST=정상 연결된 웹 디버그로 PC/모바일 대표 상세를 눈으로 검증.

**NEXT 한 가지:** 기존 Controller/Writer 보호 조건을 유지하며 **메타데이터 전용 A급 QA read adapter**를 실제 운영 승인 source에 맞춰 준비한다. 1회 출력은 (1) 현재 제공 가능한 원자료 관측일/값의 제한된 요약 (2) 공개 결과의 관측일/값/저장·게시일 (3) 원본 공급처 기준 시각만 포함하고 키·전체 DB·비공개 원자료를 노출하지 않는다. 승인된 설치 경로에서 고정 adapter를 검증한 뒤 CPI/PCE/고용 사례부터 실측 비교한다. 이 일회성 대표 경로가 통과하기 전에는 매일 자동화 PASS를 선언하거나 전체 데이터 자동 수집을 새로 예약하지 않는다.

---

판정 주석: CHECK `PASS`는 해당 검사에서 요구한 **실제 증거가 완결**되었을 때만 부여. 각 GitHub PC operation의 `PASS`와 일일 체크의 `PASS`는 범위가 다르다.
