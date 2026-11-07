# ZGMINI 공통 실행·설치 경로 개선 R2 — 작업 계획서

- 작성: 2026-11-07 KST
- 프로젝트 원장: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/622
- 계획·경과 보존 브랜치: codex/controller-ops-lessons-20261105
- 공통 지침 적용 기준: ansqhd5774-Choi/zgmini-pc-control 최신 main
- 기존 프로세스 R1: Issue #526 / 이전 계획·운영 완료 100% 보존, 재개하지 않음
- 전체 R2 진행 상태: M0 진행 중(진행률은 증거 기반으로 갱신)

## 1. 해결하려는 반복 문제와 최종 목표

**문제:** 기능 담당자가 코드·테스트를 완성해도 실제 PC의 A급 원본 조회·B급 운영 설치가 이미 갖춰진 공통 경로로 이어지지 않아 기능마다 새 진단기·승인서·고정 설치기를 만들고, 설치 대상 SHA와 실제 운영 source가 달라서 반복 중단된다.

**R2 목표:** 새 기능 담당자가 다음 작업부터 기존 PC Writer를 그대로 보존하면서 **기존 공통 A급 관측 → 실제 PC 계보 기반 승인 manifest → 범위 제한 공통 Writer B급 설치 → 결과 재조회·원담당 인계**를 재사용하도록 한다. 새로운 기능명과 파일 3개만 바뀌어도 공통 실행기 코드를 복제할 필요가 없어야 한다.

완료 수치:
1. 다단계 VBS 실제 운영 래퍼에 대해 허용된 read-only 조회로 checkout·HEAD·승인 config.source·파일 존재/해시·dirty를 정확히 식별한다.
2. 물가지표 PR #981의 승인 범위 3개 파일에 한정한 Writer B급 수신이 실PC에서 안전하게 동작하고, 무관한 기존 Writer·캘린더 파일은 그대로 남는다.
3. 정상 1개 및 실패 4개 시나리오가 증거와 함께 통과한다. 실패를 허위 PASS로 만들지 않는다.
4. 이후 다른 Writer 기능은 동일 수신 계약과 manifest 생성 규칙을 재사용한다. 기능별 새 CMD·예약·B 수신기 복제는 0건을 목표로 한다.
5. GitHub 지침 정본과 작업 전 요약에는 기능 시작 시 A/B 지원 경로 확인·미지원 공통 플랫폼 인계 원칙만 간결하게 반영한다. 규정·Gate 중복을 늘리지 않는다.

## 2. 기존 유효 증거와 구분

| 범위 | 이미 유효한 증거 / 현재 사실 | R2가 새로 증명할 내용 |
|---|---|---|
| Process Platform R1 | #526 완료, 기존 R1 결과 보존 | 같은 범위를 재개하지 않음 |
| Inflation19 | 공개 페이지 19/19 등록, zgmini PR #981 코드는 준비 단계 | PC Writer 실제 설치·자동 갱신과는 별도; 공통 A/B 경로 제공 |
| Inflation A | PC #353/#356/#362의 다단계 VBS 거부; #614에서 OPERATION_NOT_ALLOWED | 실제 설치된 A 허용목록·Runtime 일치, read-only 경로 복구 |
| Writer B | Controller 전용·R17 고정·calendar 고정 수신기는 공통 3파일 Writer 수신 경로가 아님 | 변경 가능 파일 목록을 승인 manifest로 제한한 Writer 전용 수신 |
| Controller R17/ER1 | #608 시점 Controller 설치 SHA db8924162d42adf6ee6aa27a04ce1719c8fe96c2, 통합 승인 PR #615는 GitHub 준비·병합 증거 | #68 원담당의 실제 B 설치 결과만 채택; R2 중복 설치 금지 |
| PC Core 승인 source | 과거 확인값 f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5 | 설치 직전 PC에서 실제 HEAD/config.source/file SHA 재조회 |
| 공통 지침 | 최신 main의 AGENTS.md, docs/PC_AUTOMATION_STANDARD.md, docs/GENERAL_CHAT_PREWORK.md | 최소 차이 수정·실제 main 반영, PC Runtime 변경과 구분 |

증거 링크: [Inflation 기능 PR #981](https://github.com/ansqhd5774-Choi/zgmini/pull/981) · [PC #614](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/614) · [Controller #608](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/608) · [R17 통합 PR #615](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/615) · [공용 설치 원장 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68).

**주의:** 위 SHA는 해당 증거의 관측 시점 값이다. 실제 설치 SHA, 최신 main, PC 승인 source 및 운영 실행 SHA를 서로 같다고 추정하지 않는다.

## 3. 단계와 정량적 통과 조건

| 단계 | 누적 진도 | 소유자 | 산출물·필수 PASS | 실패·대기 처리 |
|---|---:|---|---|---|
| M0. 기준·추적 계약 | 20% | 프로세스 총괄 | R2 계획·로그를 기존 전용 브랜치에 기록, Issue #622 추적, R1 완료 보존, 최신 main 기준 최소 지침 PR 검증·반영 | 지침 PR 미병합이면 M0 진행 |
| M1. 읽기 전용 A 실행 원본 | 40% | 공통 A 담당/총괄 | 기존 A 계약·실제 허용목록 일치; 다단 VBS의 승인된 고정 대상만 추적; Writer checkout/HEAD/config.source/3파일 존재·SHA256·dirty 획득; PC 원자료/DB/D1/source 변경 0 | 미설치라면 별도 지원 등록; 다른 승인 B를 A로 우회 금지 |
| M2. 범위 제한 Writer B | 60% | 공통 B 담당/총괄 | 기존 B 잠금·백업·복구 자산 재사용; 실제 PC 기준 before/after source와 세 파일 해시·호환성·단일 적용 담당·유한 범위 승인 manifest; 수신기 코드 및 관련 집중 테스트 | Controller-only 또는 캘린더 고정 수신기 우회 사용 금지 |
| M3. 정상·실패 회귀 | 80% | A/B 담당·총괄 | 정상 1, 다단 VBS 1, 타 담당 dirty 충돌 1, source/file 해시 불일치 1, 부분 적용·복구 1 관련 fixture/격리 시뮬·집중 테스트 PASS; 기존 파일 보호 | 거부 원인·원본 유지·RECOVERY_REQUIRED 구분 |
| M4. 실PC 경로·인계 | 100% | 총괄 + 실제 B 적용 원담당 | 기존 승인 범위의 정상 실PC A·B 결과(requestId, 설치 SHA, 보호 해시, 원장), Writer 기존 기능 보존, 원담당에게 실행 계약 실제 전달·수신 확인 | 설치/수신 미확인은 미완료; 원담당 기능 게시 실증은 별도 |

M1과 M2의 코드·문서 준비는 독립적으로 병렬 수행한다. **동일 Writer 실제 파일 쓰기만** #68 원장과 실제 lane lease에 따라 단일 담당자가 직렬 적용한다. M3은 해당 구현 준비 후, M4는 실제 승인된 Runtime 결과가 확보된 후 판정한다. 이전 단계가 부분 완료여도 독립 작업은 계속한다.

## 4. 구현 계약과 순서

### A — 실제 원본을 조회하는 공통 진단

1. 현재 등록·설치된 A operation 및 allowlist를 필요한 범위에서 조회한다. #353/#356/#362/#614 기존 실패 요청을 변경 없이 재전송하지 않는다.
2. VBS → VBS → 고정 실행 파일처럼 운영에서 관측된 단계별 래퍼를 **읽기 전용/허용 경로로만** 정적으로 또는 승인된 고정 조회로 해석한다. 임의 명령 실행·알 수 없는 동적 코드 추적은 하지 않는다. 해석 불가하면 이유를 정확히 반환한다.
3. PC Writer 실행 checkout와 Git HEAD, 실제 승인 config.source, PR #981 대상 파일 3개 각각의 존재·tracked dirty·SHA-256을 고유 requestId 결과 JSON/TXT로 제공한다.
4. 실제 Controller에 operation이 미설치면 GitHub 등록과 운영 설치를 분리해 표현한다. ER1의 기존 승인 Controller 통합 설치 완료·실제 활성 결과를 재사용하고 중복 B 요청을 만들지 않는다.

### B — Writer 범위 제한 적용 수신기

1. 기존 유지보수기·Writer lock/backup/atomic apply 자산의 실제 재사용 범위부터 확인한다. generic shell/임의 파일 쓰기 서비스는 만들지 않는다.
2. approved manifest는 repository·branch·승인 source 계보·실제 PC HEAD/config.source, 대상 파일 개별 경로/기존 SHA256/목표 SHA256, 설치 후 정합성, Sidecar/실행 래퍼 영향, 공유 writer lock/lease 담당, 백업·실패 복원·결과·요청 멱등키를 포함한다.
3. 요청 수신기는 해시 일치/승인 경로/범위·파일별 lease 검증 후에만 지정 파일을 적용한다. 변경 대상 외 파일·Calendar 코드·예약·산식·운영 데이터·다른 담당자의 dirty를 덮어쓰지 않는다.
4. 부분 적용 실패 시 실제 결과를 보존하고 승인된 백업·원장을 근거로 RECOVERY_REQUIRED 또는 검증된 복원 상태를 기록한다. 자동 재요청·허위 PASS는 금지한다.
5. PR #981 브랜치 전체를 기존 Writer에 병합하지 않는다. 최신 main 및 실PC 승인 source 기준으로 필요한 3개 파일 차이만 선별한다.

### 실패 검증의 최소 세트

| 사례 | 기대 동작 |
|---|---|
| 다단 VBS 래퍼 | 승인된 목적지까지 조회, 실제 checkout 식별, 부작용 0 |
| 타 담당자 dirty 겹침 | 다른 변경 그대로 보존, 해당 파일 충돌만 안전 거부 |
| before source·파일 SHA 불일치 | 한 파일도 변경하지 않고 불일치 경로·실측값만 보고 |
| 중단·부분 파일 적용 | 원본/백업·변경 원장 보호, 정확한 복원 상태 또는 RECOVERY_REQUIRED |
| 승인 정상 3파일 | 목표 해시·source/HEAD 정합성, 기존 Writer 동작 및 관련 사후 검증 |

## 5. 역할과 보호 경계

- **프로세스 총괄:** 공통 경로 분석·원인 수정·계약·테스트·지침·정확한 인계. 물가지표 수집/계산/게시·시장 캘린더 코드·ER1 Core 설치 대행 금지.
- **물가지표 담당:** PR #981 파일 내용·영향 검토, 승인 경로로 기능 적용, PC Writer→로컬 결과→D1→공개 API→19개 페이지 갱신 실증.
- **ER1/Controller 적용 담당:** #68 기존 단일 적용 담당으로서 PR #615와 실제 설치 지문 대조, 정규 B 설치/결과·A 활성 확인. R2는 이 증거를 재사용한다.
- **캘린더 담당:** 기존 기능·고정 승인 경로 소유권.
- **독립 담당자/Runner:** 겹치지 않는 개발·조회·게시 계속. 전체 6좌석 유휴·Controller 전체 재검사를 전역 Gate로 추가하지 않음.

## 6. 검증·운영·완료 판정

- PC Runtime·requestId 결과와 실제 해시 > PR·fixture > 문서 설명으로 신뢰도를 구분한다.
- SOURCE_PREPARED / TESTED / MAIN_MERGED / PC_INSTALLED / OWNER_RECEIVED / FUNCTION_PUBLISHED를 섞어 완료 처리하지 않는다.
- 현행 승인·보호를 완화하지 않고 공통 경로의 코드·생성기·기본값을 수정한다. 동일 공통 실패 두 번째부터는 경고와 Gate가 아닌 원인 수정을 우선한다.
- 장기 자연 예약 결과는 R2 완료를 위한 신규 Gate가 아니다. 최초 실제 승인 적용과 인계가 완료되면 운영 후속 감시는 별도 추적한다.
- 추적 원장: Issue #622 체크박스 + 같은 브랜치 R2_LOG. 각 단계에는 LAST PASS, FIRST FAIL, 시각, 요청 ID, 정확한 오류, 담당, 다음 실행, 검증 원본 링크를 적는다.
- 원담당의 실제 수신은 해당 대화의 확인으로만 확정하며 GitHub 댓글 기재만으로 수신을 추정하지 않는다.
- **R2 완료 != Inflation19 실제 자동 갱신 완료 != ER1 D+30 수집 완료.** 후자는 각각 원담당의 운영 결과로 확인한다.

## 7. 지침 개정·브랜치 전략

- 기존 전용 브랜치 codex/controller-ops-lessons-20261105에는 이 R2 계획과 원장을 누적한다.
- 이 브랜치는 최신 main과 크게 분기되어 있으므로 오래된 AGENTS.md/공통 정본을 그대로 main에 병합하지 않는다. 최신 main을 기준으로 최소 지침 수정 전용 PR을 분리한다. 문서·코드 적용 전후 상태를 따로 기록한다.
- PC_AUTOMATION_STANDARD.md §2/§5/§8에 초기 A/B capability 매핑·미지원 공통 인계·Writer B 허용 범위·반복 장애 구조 수정 원칙을 짧게, AGENTS.md와 GENERAL_CHAT_PREWORK.md에는 한 줄 요약만 반영한다. GENERAL_CHAT_START.md는 기존 경로로 유지한다.
- 지침 원격 main 반영은 **문서 배포**이며 실제 PC A/B 실행기 설치 성공은 아니다. 다른 일반챗에 자동 전파/학습됐다고 주장하지 않는다.

## 8. 당장 다음 작업

1. M0: 신규 R2 파일 저장, Issue #622 링크 확인, 최신 main 기반 최소 공통 지침 PR 검증·병합.
2. M1/M2: 다른 담당자의 Runtime을 건드리지 않는 A/B 계약·실제 설치 모듈 지원 범위 조사와 필요한 최소 변경.
3. M3: 정상/실패 시나리오 5개 집중 검증.
4. M4: 안전한 승인 B 적용의 실PC 실행 결과·물가지표 담당 실제 수신을 확보해 인계하고 R2를 닫는다.

불필요한 예약·CMD·유료 서비스·새 승인 반복·무관 기능 수정·기존 R1 재검증은 계획에서 제외한다.

## 9. 2026-11-07 사용자 명시 변경 — R17 Controller 단일 설치 담당 R2 총괄 인수

- 사용자 선택에 따라 기존 R17 B 적용 담당 대신 **현재 R2 프로세스 총괄이 정규 Controller 설치와 결과 회수까지 직접 수행**한다. 이는 R2 Controller 공통 전제의 한정된 역할 변경이다. 물가지표 기능/게시, 캘린더, ER1 Core 수집기의 원담당 권한은 이전하지 않는다. §2·§4·§5·§8의 기존 "R17 대기/총괄 B 금지"는 사용자 변경 이전 이력으로 해석한다.
- [공용 #68 인수 기록](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6699762305)으로 기존 담당의 중복 B 생성을 방지한다. 댓글은 다른 ChatGPT 대화의 실제 ACK나 PC lease의 대체물이 아니다.
- 실제 최신 [읽기 전용 A #628](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/628) PASS, PC Controller db8924162d42adf6ee6aa27a04ce1719c8fe96c2, 보호 상태 불변/운영 쓰기 0.
- 기존 승인 5파일 [#615](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/615) + R2 A 1파일 [#625](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/625)의 정확한 6파일 누적 diff를 신규 불변 B 승인 [#629](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/629)로 main 반영. 목표 6348be5201801e008be10867fd68add4ddeca52c, RAW SHA256 75aebe1445b2c40e49ea852ec7ef86fac2b152c7202b82f0abfa9b93f1fb24e1. 기존 #615 manifest 수정 없음.
- [정규 단회 B 요청 #630](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/630), requestId pc-update-2b963307-a5dd-4225-9366-29d0687e6a24 접수. **결과 미확정/RUNNING, PC 설치 완료 주장 금지**. 동일 요청 결과를 한 번 회수해 설치 SHA/보호/Workflow/새 A 활성으로 판정한다.
- R2 M1 통과는 설치 이후 물가지표 Writer 파일 해시와 dirty를 실제 A로 확보할 때다. 단순 Controller B 접수만으로 R2 진도 20%를 올리지 않는다.

## 10. 2026-11-07 실제 설치 후 결정 사항 — M1 Runtime 증거와 후보 해시 분리

- [#630](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/630) 실제 PC Controller가 목표 `6348be5201801e008be10867fd68add4ddeca52c`로 설치되었음(SUCCEEDED/보호 불변). §9 마지막 문단의 RUNNING은 과거 이력이며 종결됐다.
- [#632](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/632): 자연 실행 중이지 않은 Core는 runtime 검증 `STATE_UNKNOWN`; 근거 없는 재시도·예약/운영 설정 변경 금지.
- [#633](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/633): 정적 VBS 탐색은 PASS, `sourceResolved=false`; Git/승인 config.source/Writer checkpoint가 일치하는 고정 checkout 후보 확보. [#634](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/634)는 디렉터리 인벤토리 상한(`inventoryTruncated=true`)으로 후보 없음. 둘을 혼동하거나 동일 요청 반복하지 않는다.
- M1은 **(a) corroborated candidate file inventory**(존재/각 SHA256/dirty와 Git/config/checkpoint 일치)와 **(b) actual Core Runtime binding**(활성 Task 실행 연결)을 별개로 검증한다. (a)만 PASS이면 M1 완료 아님; B의 사전 source gate에서 (b) 필요 여부를 실제 설치기 계약과 대조한다. 별도 Core 강제 시작·신규 스케줄을 Gate로 만들지 않는다.
- [PR #635](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/635)는 기존 `pc-source-preflight` 재사용 보완, 테스트 20/20 PASS인 GitHub 소스 준비다. 새 Controller B가 승인·PC 설치되기 전 기능 활성은 아니다. 다음 공통 실행은 PR 독립 리뷰→정확한 설치 전후 지문 계약→정규 1회 B→A 후보 3파일 실측. Writer 설치는 사용자 별도 명시 없는 한 물가지표 원담당의 영역으로 유지한다.
