# ZGMINI — 일반챗·CMD·PC Runner 공통 작업 지침

## MarketParquet 사용 제거 — 2026-11-16 사용자 결정

- **MarketParquet는 사용하지 않는다.** 공급자가 11/05 무료 데이터 파생 점수·차트의 공개를 불허했고 11/08 KST 무료 예외도 거절했으며, 사용자가 수집·계산·게시 의존성 삭제와 main 반영을 지시했다. 문제가 생겨도 복구·재시도·재문의·유료 구매로 과거 설계를 유지하지 말고 해당 의존성을 제거한다. [사용 제거 정본](https://github.com/ansqhd5774-Choi/zgmini/blob/main/docs/MARKETPARQUET_REMOVAL.md)을 따른다.
- 과거 ‘MarketParquet 24시간 잠정치’, 무료 가이드 또는 위험 수용 플래그를 근거로 사용을 재개하지 않는다. 불가능한 잠정치는 미제공으로 분리하고 GMH의 검증된 입력·권리 범위에서 가능한 확정 경로와 독립 작업은 계속한다. Alpaca 등 새 공급처를 임의로 추가하지 않는다.
- main 소스 반영을 PC 설치·예약 삭제 완료로 간주하지 않는다. 정규 유지보수로 정확한 대상만 적용한다. 과거 데이터·DB/D1·실행 증거는 보존하며, GMH 파일이 함께 든 `marketparquet-r167` 폴더를 통째로 삭제하지 않는다. 제거된 공급자의 대기를 전체 Controller·기능 업무의 전역 Gate로 만들지 않는다.

2026-11-08 R2 Writer B 경합 보완 정본. **2026-11-12 두 PC 실측 및 신규 대화 작업 경로 준수 절차를 추가했다(기존 승인·실행 계약 유지).** 이전의 동일 목적 지침을 대체한다. 현재 업무·승인·완료 증거는 보존하며 처음부터 재시작하지 않는다. #319 복구 결과와 위험도별 검증·병렬 처리 기준을 보존하며, 일반챗 원담당의 업무 재개·인계 수신 기준을 추가한 **운영 지침**이다. 문서 반영만으로 실행기 코드가 설치·활성화됐다고 주장하지 않는다.

## 1. 목적과 정본

목표는 사용자가 요청한 현재 업무를 승인 범위에서 끝까지 수행하는 것이다. PC 자동화는 실행 수단이다. 지침 학습·환경 재확인·과거 복구 확인으로 현재 업무의 실행을 대신하지 않는다.

제어 저장소는 `ansqhd5774-Choi/zgmini-pc-control`, 기준 브랜치는 `main`이다. AGENTS.md·README.md·docs/GENERAL_CHAT_START.md의 필요한 내용을 읽고 다음 실행으로 진행한다. 짧은 전달문은 [GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md)다. 옛 사본과 충돌하면 최신 정본의 해당 기준을 적용한다.

현재 목적·전용 브랜치·승인·미완료 단계·유효 증거를 유지한다. 제어 저장소 HEAD, 실제 Controller 설치 SHA, 유지보수기 source SHA, PC Core 실행 checkout HEAD·승인 `config.source`·이를 참조하는 보조 실행기의 승인 SHA, 검사 대상 SHA를 구분한다. 과거 SHA·PID·설치 상태를 현재값으로 가정하지 않는다.

두 대의 실PC는 [장비 인벤토리](PC_HOST_INVENTORY_READONLY.md)와 [PC별 프로세스·자동 시작·실행 운영 정본](PC_OPERATING_SYSTEMS_CANONICAL.md)으로 역할/Runner/Node/경로를 구분한다. 실제 설치·수집·게시 성공 여부는 각 업무 원본 Run/결과로 판단한다.

공용 설치가 필요하면 [CONTROLLER_APPLY_QUEUE.md](CONTROLLER_APPLY_QUEUE.md)와 [원장 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68), 업데이트가 필요하면 [CONTROLLER_AUTO_UPDATE.md](CONTROLLER_AUTO_UPDATE.md)를 참조한다. 정상 업무마다 과거 장애 문서·전체 설치 이력·전체 테스트를 다시 조사하지 않는다.

## 2. 일반 작업 실행

### 실행 결과 회수 — TXT/JSON·Issue 댓글 우선 (2026-11-13)

- **기본값:** 기존 GitHub Runner가 생성한 비민감 결과는 Actions 작업 로그의 표준 출력과 검증된 `results/*.txt`/`results/*.json` 및 정확한 Issue 댓글로 회수한다. 원본 Issue·Run·attempt·job ID, 대상 PC·실제 Runner, 결과 status/code, 검증 범위·시각을 기록한다. `fetch_workflow_job_logs` 및 기존 원격 결과 readback을 우선하고, 텍스트 결과를 얻기 위해 사용자 CMD 입력/화면 촬영/압축 파일 다운로드를 요구하지 않는다.
- **불필요한 매체 변환 금지:** 명령 실행·종료코드·파일 해시·기동상태처럼 원래 텍스트로 검증되는 자료에 PNG 촬영 → ZIP artifact → 이미지 전달 → 재전사를 만들지 않는다. ZIP 아티팩트는 특정 바이너리가 필요할 때만 사용한다. 로그·댓글에는 키, 전체 환경변수, 원본 데이터, 사용자 개인정보를 기록하지 않는다.
- **격리 게스트의 실제 한계 명시:** USB·네트워크·공유폴더·클립보드 없이 실행하는 WinPE 게스트의 stdout은 **기본적으로 호스트 GitHub Runner stdout으로 연결되지 않는다.** 이때 게스트 화면만 확인된 1회 TEST_ONLY 결과를 텍스트화한다면 `SCREEN_VISUAL_OBSERVATION`과 정확한 실행 증거를 분리해 기록하며, 텍스트로 전사했다고 게스트 원시 stdout을 확보한 것으로 주장하지 않는다. 다음 **새로운 승인된** 시험에서 구조화된 로그가 필요하면 승인된 시리얼 콘솔 등 한정된 guest→host 로그 경로를 먼저 설계하되 기존 VM/ISO/운영 환경을 임의 변경하거나 완료된 실증을 재실행하지 않는다.
- **효율 및 실제 작업:** 읽기/로그 회수가 가능하면 그 작업을 즉시 끝내고 실제 기능의 미완료 필수 실행으로 넘어간다. **Remote Desktop Commander(리무트 데스크톱 컨트롤) 플러그인은 장치 목록 조회·연결·진단·승인 요청을 포함해 ZGMINI 작업에 사용하지 않는다.** GitHub Runner 대기·미배정은 해당 Run만 증거 미확정으로 기록하고, 다른 원격 도구·추가 승인으로 우회하지 않는다. 별도 ZIP·새 Runner·새 예약·유료 서비스는 기본 대체 수단이 아니다. 이 원칙은 기존 A/B/C 등급, 고정 허용목록, 승인·C급 NO-GO를 바꾸지 않는다.

### Issues·PR 전문 담당자와 별도 PC의 시험 업무 (2026-11-18 사용자 확정)

- **전문 담당자의 책임:** `zgmini-pc-control`의 Issues·PR **전체 생명주기**를 독립적으로 해결한다. 분석·소스 수정·구조 개선·리뷰·CI·모의시험·병합·종결 등은 예시일 뿐 **허용된 수행 수단을 제한하는 목록이 아니다**. 저장소·담당자·물리 PC를 같은 이름으로 취급하지 않는다.
- **별도 PC 활용:** `DESKTOP-N62L0NG`의 승인된 개발·격리 환경에서 가능한 범위의 실험·검증·시뮬레이션을 수행하고, 운영 PC `PC`의 메모리·CPU·공유 쓰기 부하는 최소화한다. 단, 기존 `zgmini-handoff-ci-isolated` **자동 Runner/Workflow**에는 등록된 허용 작업만 적용한다. 전문 담당자의 전체 업무와 자동 Runner의 설치된 operation 범위는 다른 개념이며, 별도 PC에서 운영 원본이나 미승인 코드를 임의 실행할 수 있다는 뜻은 아니다.
- **설치 권한 분리:** 전문 담당자는 운영 PC에 직접 설치하거나 Controller·Runner·Writer·DB 등 운영 환경을 변경하지 않는다. 검증을 마친 운영 적용 대상은 **최종 `zgmini` 프로세스 총괄**에게 실제 인계한다. 총괄이 기존 승인·manifest·원본 보호·lease·복구 조건에 따라 운영 적용을 수행하거나 정식 운영 적용 담당을 조정하며, 기능별 원담당의 고유 업무를 임의 이관하지 않는다.
- **인계·종결:** 원본 Issue/PR, 저장소/브랜치/HEAD SHA, 변경 파일과 목적, 시험·모의시험·CI 결과 및 한계, LAST PASS/FIRST FAIL, 영향·위험, 필요한 승인과 정확한 manifest/복구 계획, 다음 운영 실행과 성공 판정 조건을 정리한다. GitHub 인계 댓글·PR PASS·담당 채팅 실제 수신·운영 Runtime 성공은 **각기 별개**다. 설치가 필요 없는 Issues·PR은 전문 담당자가 독립적으로 종료한다.
- **브랜치 혼동 방지:** 제어 저장소의 구 `codex/controller-ops-lessons-20261105` 브랜치는 과거 기록이며, 이름만으로 현재 `zgmini` 총괄의 소속·직책·실행 권한을 판정하지 않는다. 기존 이력을 강제로 삭제·재작성하지 않는다.

### `zgmini` Issue 인계·인수·수정 종결 (2026-11-18 사용자 확정)

**책임 주체는 두 개뿐이다.** (1) **인계자:** 오류를 발견하여 원본 Issue에 증상·재현·증거를 등록한 일반 작업 대화. (2) **인수자:** Issue를 접수해 원인을 분석하고 필요한 코드·문서·공통 구조 수정, 관련 모의시험·회귀시험·CI·PR 병합, 수정 승인과 결과 댓글·종결을 처리하는 **`zgmini` 프로세스 총괄**. 이 Issue의 처리 책임을 설명할 때 실제 지정·인수 증거가 없는 `기능 원담당`, `Writer 담당자`, `설치 담당자`, 별도 가상 ChatGPT 대화를 **제3의 책임 주체로 생성하거나 그쪽으로 반환·전가하지 않는다**. 기존 별도 업무의 실제 수행 사실과 승인된 실행 권한 자체를 부정하거나 박탈하는 규칙은 아니다.

**기본 처리:** 인계자가 Issue 등록 → 인수자가 기존 완료 증거를 재사용해 분석·수정·검증·승인 → 인수자가 **원본 Issue 댓글에** 원인, 해결 범위, 정확 PR/commit SHA, 테스트/CI, 완료되지 않은 운영 적용과 다음 승인된 실행을 기재 → **해당 수정 요청이 해결되었다면 Closed/completed** → 인계자가 기존 Issue 번호를 조회해 Closed 상태와 결과 댓글을 확인하고 기존 승인 범위에서 PC 수집·계산·저장·게시·화면 작업을 이어간다. `is:open` 검색만으로는 Closed를 찾지 못하므로 인계자는 해당 번호 직접 조회 또는 전체 상태 조회를 이용한다. Github의 Closed·댓글은 타 ChatGPT 대화를 자동 재개시키는 신호가 아니므로 실제 조회/수신과 구분한다.

**종결 경계:** 수정·검증·승인이 확인된 **개발/구조/코드 결함 수정 요청**은 실제 PC Writer 설치 또는 D1 게시가 아직 미확인되어도 수정 완료로 종료할 수 있다. 다만 댓글에는 `SOURCE_FIXED / RUNTIME_UNVERIFIED`처럼 **완료된 범위와 미적용 범위**를 분리한다. 원래 Issue의 요구가 **운영 복구/실서비스 정상화 자체**이거나 수정 테스트가 실패·미완료이면 실제 요구 조건이 충족되기 전 `Closed/completed`로 잘못 보고하지 않는다. 인계자가 기존 운영 적용 과정에서 실패·재발·새 증거를 발견하면 같은 Issue를 다시 열거나 중복되지 않는 새 Issue로 인계하고, 인수자가 재분석·수정한다. 같은 미적용 문제에 불필요한 신규 Issue를 누적하지 않는다.

**권한과 기존 업무 보존:** 총괄의 코드 수정 승인·Issue Closed는 **PC Writer/Controller 설치 승인, 실제 설치·D1 쓰기·운영 게시 완료를 의미하지 않는다**. 운영 적용은 실제 인계자가 기존 승인된 A/B 실행·manifest/해시·lock/lease·원본 보호 절차로 계속한다. 인계자의 대화가 종료됐다면 자동 후속 실행을 가정하지 않고, 해당 상태는 남겨 다음 유효 대화가 원본 Issue/결과를 조회해 재개할 수 있게 한다. 본 규칙 때문에 새 Writer 담당·인계 Workflow·Gate·예약·재승인을 만들지 않는다. 기존 `agent-handoff` 공통 장애 인계와 `zgmini-pc-control` Issues·PR 전문 담당자의 별도 PC/권한 규칙은 유지한다.

### 공통 프로세스 총괄 — 요청 가능 업무·접수·작업 회신 (2026-11-17)

**누가 무엇을 맡는가:** 별도 PC `DESKTOP-N62L0NG`에서 구동되는 **기존 자동 인계 Runner/Workflow**는 등록된 GitHub Issue 접수·출처 확인·중복 제거·담당 유형 분류·전달 상태 추적·결과 기록과 원본 회신 중개, 허용된 격리 CI에 한정된다. **자동 Runner의 임무는 Issues·PR 전문 담당자의 전체 업무를 제한하지 않는다.** 이 자동 Workflow에는 운영 PC 설치·운영 데이터 변경 권한이 없다. **프로세스 총괄 ChatGPT**는 공통 Controller, Runner/GitHub Actions, 공통 Writer receiver·loader, 공통 승인/manifest·설치 도구, 공유 자원 경합, 공통 오류 판정기, 인계·결과 중개의 **구조적 결함**을 분석하고 해당 공통 부분만 최소 수정·검증·조정한다. 기능별 수집기·검증기·계산기·산식·저장·게시·UI·기능별 설치와 최종 반영은 각 **기능 원담당**이 수행한다. `COMMON_WRITER` 등의 코드가 붙었다는 이유만으로 기능 전체를 총괄에게 이전하지 않는다.

**총괄 접수·집계에서 빠지면 안 되는 두 경로:** (A) 자동 `agent-handoff` 사건(고유 Incident, `handoff-agent-pending` 잔존), (B) 기존 중앙 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)로 기능 원담당이 직접 작성한 공유 설치·승인·공통 장애 **실제 지원 요청 댓글**. B는 `agent-handoff` 라벨을 갖지 않으며 A만 조회하면 누락된다. 총괄의 작업 착수·상태·건수 보고에는 **둘 모두 확인**해 고유 기능/결정 단위로 중복 제거하고, 인계 원문·검토 PR·원담당 원장·승인/실행 상태·총괄 원본 회신을 함께 표시한다. 같은 기능의 업데이트 댓글 여러 개를 여러 미완료 작업으로 중복 계산하지 않는다. 자동 대기열 PC의 Incident 관제판은 A만 표시하는 별도 지표이며, B가 없다는 증거가 아니다. 기존 인계 Workflow의 schema/라벨·예약·Runner·실제 승인·운영 파일은 변경하지 않는다. 총괄 검토 댓글/PR 생성은 사용자 B 승인, 실제 PC 설치·타 대화 자동 수신이 아니므로 처리 완료율과 운영 적용률을 따로 보고한다.


| 총괄에게 요청할 수 있는 작업 | 요청 예시 | 총괄 수행 범위 |
|---|---|---|
| 공통 Controller/고정 operation 결함 | 승인된 operation의 공통 등록·판정 오류 | 등록·source·Runtime 근거 대조, 공통 처리기 수정/검증 |
| Runner·Actions 공통 장애 | 잘못된 job 취소·미배정·트리거 누락 | 실제 Run/Job/Runner 진단, 공통 Workflow 수정/검증 |
| 공통 Writer 도구 결함 | 공유 receiver/loader/import 오류가 기능 작업을 차단 | 공유 코드 원인과 최소 수정/검증; 기능 hook·설치는 원담당 |
| 공통 승인·설치 경로 | 공유 manifest 생성/해시/수신기 계약 불일치 | 공통 계약과 생성·검사 경로 정합성 개선 |
| 공유 자원 충돌 | 동일 Controller/Core/Writer 파일에 둘 이상의 운영 쓰기 | 소유자·승인·manifest·lease·적용 순서 조정 |
| 공통 진단·집계 결함 | 원장 필드 오독·중복 사건 수 계산 | 공통 판정기·집계 로직 수정/검증 |
| 공통 업무 접수·인계·회신 | 접수는 됐으나 수신 대상 미확인, 결과 회신 누락 | 접수·라우팅·반환 구조 수정/검증 |

**언제 요청하는가:** 위 공통 도구·실행 계약의 실제 장애, 공유 자원 충돌 또는 업무 인계 자체의 오류가 현재 기능의 필수 실행에 영향을 줄 때만 요청한다. 기능 API·원자료·산식 오류와 단순 `WAIT_RECORDED`·정상 대기는 원담당 업무이며, 공용 원인이 확인되지 않으면 총괄은 **공용 원인 판정 지원**까지만 맡는다. 무관한 승인된 기능 작업은 계속한다.

**업무 전가 반송 원칙(2026-11-17):** 기존 책임 배분을 명확히 적용한다. 공통 요청의 제목·라벨·'승인 필요' 표현보다 **실제로 남은 동작과 최초 실패 위치**로 업무를 분류한다. 총괄은 실제 공통 도구 결함·공유 자원 충돌·범위 밖 운영 효과 승인/보호 검토에만 한정해서 수락하고, 원담당의 기능별 실행·자료 대조·명세 작성·설치·결과 회수를 떠맡지 않는다. 잘못 넘어온 요청은 **같은 원본 Issue/#68에 원담당, 원담당의 다음 필수 실행, 총괄이 지원할 공통 부분(있을 경우)만 명시해 회신**한다. 불필요한 새 Issue/재승인/별도 Gate를 만들거나, 인계를 반송했다는 이유로 독립 기능 작업을 중단하지 않는다. 실제 공통 결함이 의심되지만 미확정이면 총괄의 원인 판정 지원만 허용하며, 기능 실행 책임은 계속 원담당에게 둔다.

| 원담당 | 원담당이 끝까지 처리할 작업(총괄 이관 금지) | 총괄 지원이 허용되는 예외 |
|---|---|---|
| W01 물가지표 | 승인 A 실행·결과 회수, Core 소유권/Census B 조건 대조, 23개 원자료 검증, BLS·Census 수집/파서/저장, 계산·D1/API/UI 검증 | 공통 Controller/수신기 실제 결함과 그 수정·보호 심사. Windows Event129 관리자 설정은 사용자 직접(C급) |
| W03 테마공탐 | 승인 A 결과, R48/R73 체인과 기능 소스 대조, 승인 R47 CMD B 설치, ETF 63종+SPY 수집·계산·게시 | 공통 Task Engine/Controller 조회기·B 실행 경로 자체 결함과 공유 보호 승인 |
| W04 고용지표 | Reader/Runner·회귀시험, A 조회·결과 분석, SHA/정확 diff, 신규 B manifest 작성·검증, 승인 후 B 실행과 최종 계보 11계수 검증 | 신규 Controller **운영 효과**의 범위·보호 심사, 공통 유지보수 복구; 소스 SHA와 기능별 manifest 준비는 W04 |
| W05 API–사이트 연결 | 승인 A 회수, Writer B 사전조건/3파일 SHA·manifest 대조, 정규 Writer B 설치, WPSFD42 수집·SQLite·게시·API/UI 검증 | 공통 Controller/Task Engine/Writer receiver·공통 B 설치기 자체 결함 또는 공유 자원 경합 |
| W06 UIUX | 75단계 계획/진행 기록, 계산·checkpoint·원장 대조, 입력 변경 회귀시험, 승인 A 조회·API/UI·차트 검증 | 공통 Controller·공통 B 설치기 결함만 총괄. 실제 Writer 수정·설치는 Writer 원담당 |

**예외 확인:** 원담당이 기존 승인·고정 허용목록·실제 설치 원장으로 수행 가능한 A/B를 먼저 자기 책임으로 처리한다. 새 운영 효과 승인 또는 공통 코드/공유 보호 **실제 필요분만** 총괄에 요청한다. 각 기능의 실행 성공은 원담당 PC Runtime·원격 JSON/TXT·저장·게시 증거로만 판정한다. 위 분류는 업무 권한을 새로 부여하거나 기존 승인 범위·운영 PC source/Workflow를 변경하지 않는다.

**어디에 어떻게 요청하는가:** 저장소 `ansqhd5774-Choi/zgmini-pc-control`의 [GitHub Issues](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues)에 기존 `ZGMINI_AGENT_HANDOFF_V1` JSON 계약과 `agent-handoff` 라벨로 요청한다. 신규 Issue 생성 시 본문·라벨을 같은 생성 요청에 넣고, 기존 동일 사건이 있다면 **원본 Issue·인계 Issue를 재사용**한다. 형식과 유효 필드는 [AGENT_HANDOFF_V1.md](AGENT_HANDOFF_V1.md) 및 `agent-handoff/contract.mjs`를 따른다. 원본 `repository/issueNumber/requestId/chatId/branch/sourceSha/checkpoint`, 실패 `kind/code/lastPass/firstFail/fileRefs/evidenceIssueNumber`와 고유 `incidentId`를 정확히 확인한다. 지원 요청 목적·총괄이 반환해야 할 결과는 **원본 업무 Issue/진행 기록에 자연어로 설명**한다. 검증 계약에 없는 JSON 키를 추가하지 않고 API 키·인증 URL·전체 원자료를 올리지 않는다.

예시 요청: “원본 Writer B Issue #번호, Run #번호에서 공통 receiver import 결함이 의심됨. 공통 도구의 원인 분석·최소 수정·회귀 검증을 요청. 기능별 hook·설치·게시 작업은 원담당이 유지. 원본 LAST PASS/FIRST FAIL, source SHA 및 승인 범위는 원본 증거 참고.”

**업무 접수부터 회신까지 — 서로 다른 성공 증거를 절대 합산하지 않는다.**

| 단계 | 요청자·대기열·처리자가 할 일 | 인정할 근거 / 현재 실제 한계 |
|---|---|---|
| 1. 요청 또는 자동 발견 | 원담당의 직접 Issue 요청과 PC 실패 감지로 봇이 생성한 Issue를 구별 | Issue 작성자·원본 실행 확인. 자동 발견은 원담당이 직접 부탁했다는 뜻이 아님 |
| 2. 접수 확인 | 대기열이 schema/라벨·원본 증거·fingerprint·중복을 확인 | 고유 `agent-handoff` Issue 및 `HANDOFF_ROUTED` 봇 댓글. 이것은 **접수 기록**만 증명 |
| 3. 담당 업무 판정 | 실제 공통 결함/기능 원인·기존 소유자·수정 범위를 대조 | `COMMON_PROCESS_OWNER` 또는 `ORIGIN_FUNCTION_OWNER`은 **역할 후보**이지 실제 처리자 주소/승인이 아님 |
| 4. 실제 업무 전달 | 지정된 처리자/대화의 **수신 경로로** 원본·요청·증거를 전달 | **현 구현에 대화 자동 전달이 없음.** `HANDOFF_SELECTOR_CANDIDATE_V1`은 선별 영수증일 뿐. 전달 실증 전에는 `DELIVERY_UNVERIFIED`(보고 용어) |
| 5. 담당자 인수 | 실제 담당자가 자기 수신 경로에서 고유 사건을 확인하고 인수 여부를 기록 | GitHub 계정의 `ACKNOWLEDGED` 댓글은 계정 기록만 인증; 특정 ChatGPT 대화의 실제 수신·실행을 독립 입증하지 못함 |
| 6. 처리·검증 | 처리자가 **자신의 책임 범위에서** 실제 수정/시험/승인을 수행 | 마지막 PASS·최초 FAIL, 변경 SHA, PR·CI, 필요한 운영 Runtime 증거를 구분 |
| 7. 결과 회신 | 실제 처리자가 기존 인계 Issue에 지원되는 결과를 제출하고 원본 Issue 회신을 확인 | `ZGMINI_AGENT_HANDOFF_RESULT_V1` → `HANDOFF_RESULT_RECORDED` → `HANDOFF_ORIGIN_RESULT_RECORDED`를 원본 기록과 대조. 현재 결과 broker는 PR·CI 증거 형식이므로 **무수정 조정/단순 판정의 정식 반환을 지원한다고 가정하지 않음** |
| 8. 요청자 확인·종결 | 원담당이 결과를 **자기 대화에서 실제 수신·검토**하고 기능 업무를 이어감 | 원본 bot 결과 기록은 자동 메시지 전달/채팅 재개가 아님. 실제 확인이 없으면 `OWNER_ACK_UNKNOWN`, 운영 반영 전에는 `RUNTIME_VERIFICATION_PENDING` 유지 |

`DELIVERY_UNVERIFIED`, `OWNER_ACK_UNKNOWN`은 이 표의 **보고·해석 용어**다. `agent-handoff/contract.mjs`의 JSON 상태 enum으로 새로 등록된 값이 아니다. 기존 `HANDOFF_ROUTED`·후보 선별·결과 댓글의 기술적 존재를 **실제 타 ChatGPT 대화 수신·조치의 증거로 사용하지 않는다.** 실제 전달/수신 경로가 없으면 미전달 사건으로 남기며 담당자의 태만 또는 미처리로 집계하지 않는다. 자동 발견과 정식 의뢰, 원본 실행과 인계 Issue는 사건별 고유 ID로 연결하고 **한 사건을 두 건의 미완료 업무로 합산하지 않는다**.

**점검 주기와 한계:** 대기열 관제판은 GitHub Actions 설정상 15분 간격으로 조회하고 Issue/Workflow 이벤트에서도 실행될 수 있다. GitHub 예약 지연·누락이 가능하며, 점검 완료는 실제 업무 전달·회신 완료가 아니다. 실증 전에는 15분 이내 전달 보장이라고 보고하지 않는다. 수신 미확인 때문에 무관한 기능 작업을 멈추거나 기존 요청을 중복 생성하지 않는다.

**반환 책임의 종료 조건:** 총괄이 공통 수정·검증을 끝내면 본인 작업의 증거와 원본 요청에 연계된 결과를 반환한다. 해당 기능 원담당의 운영 설치·수집·게시까지 총괄 완료로 계산하지 않는다. 공통 업무가 단순 검토·무수정 판정이어서 기존 `RESULT_V1` 규격(PR/CI)에 맞지 않으면 결과를 허위로 채워 기록하지 말고 현재 반환 규격의 미지원 범위를 명확히 남긴다. 실제 원담당 수신이 확인될 때만 요청자 수신 완료를 기록한다.

### 신규 대화·두 PC 작업 경로 표준 (2026-11-12 실제 Runner 실측 반영)

**원칙:** 새 일반챗은 기존 운영체계를 임의 재설계하지 않고 마지막 유효 완료 지점에서 현재 기능 작업을 계속한다. 이는 현재 업무에 관련된 가벼운 확인 절차이며 새로운 전역 Gate가 아니다.

1. **대화 시작·재개:** **신규 대화 첫 진입 때만** 제어 저장소 최신 `main`의 [AGENTS.md](../AGENTS.md), [GENERAL_CHAT_START.md](GENERAL_CHAT_START.md), 이 지침 및 [두 PC 운영 정본](PC_OPERATING_SYSTEMS_CANONICAL.md)의 필요한 부분을 확인한다. **같은 대화의 후속 작업은 첫 단계부터 재개하지 말고** 마지막 유효 완료점·기존 승인·미완료 필수 실행 하나를 승계한다. 관련 source·설정·PC 실행 환경에 변화 또는 상충 증거가 있을 때만 변경된 부분을 다시 확인한다. 기존 담당 브랜치·승인·미완료 단계·유효한 실PC 증거를 재사용한다. [운영 PC 실측 JSON](pc-profiles/operating-PC.json), [격리 PC 실측 JSON](pc-profiles/handoff-DESKTOP-N62L0NG.json)은 증거 범위 내에서 참고한다. GitHub 수정만으로 새 ChatGPT 대화에 지침이 자동 주입됐다고 주장하지 않는다.
2. **대상 PC 선택:**
   - 기존 **운영 PC**: 호스트 `PC`, Windows 11 Pro, 전용 Runner `zgmini-pc-01`~`06`, label `zgmini-pc-control`, Node `E:\ZGmini\runtime\node.exe`, Controller `E:\ZGmini\automation\pc-control`. GitHub 승인 A급 진단, 별도 승인 B급 Writer/Controller 적용, 로컬 데이터 수집·계산·저장·게시 관련 작업을 담당한다. Windows 사용자 로그인 Startup·Guardian·Watchdog·Supervisor 및 독립 유지보수기 계약을 따른다.
   - 별도 **격리 시험·공통 인계 PC**: 호스트 `DESKTOP-N62L0NG`, Windows 10 Home, 전용 Runner `zgmini-handoff-ci-spare-01`, label `zgmini-handoff-ci-isolated`, pinned setup-node 22. **해당 자동 Runner**는 원본 GitHub 결과 검증·수리 가능 장애 접수·중복 제거·인계/결과 중개·허용된 격리 CI만 수행한다. 이 PC의 별도 승인된 개발·시험 환경에서 전문 담당자는 폭넓은 Issues·PR 작업과 모의시험을 수행한다. 운영 PC의 `E:\ZGmini` Controller 설치 루트가 없으므로 기존 PC 경로·DB·운영 권한을 그대로 가정하지 않는다.
   - 실측 Runner.Listener 프로세스는 운영 PC 7개, 격리 PC 5개였으나 이는 **ZGMINI 전용 Runner 구성(각 6개/1개)**과 같지 않다. 이름별 PID 소유권·Online·부팅 후 복구는 별도 실증 없이는 확정하지 않는다.
3. **기존 Workflow 우선:** 운영 A급은 기존 `pc-job` Issue JSON → `pc-job.yml` → 설치된 `controller/entry.mjs` → `upload.mjs`를 재사용한다. B급은 해당 기존 독립 승인 manifest·유지보수기/Writer 계약을 사용한다. 공통 장애 인계는 `agent-handoff*` 및 공유 요청 접수용 격리 Workflow, 정확한 opt-in과 GitHub 증거를 사용한다. 고정 Runner label·호스트·Node 경로를 먼저 확인한다. **기존 작동 경로를 두고 임의 ZIP·CMD·기능 전용 Runner/수신기/예약을 새 기본 방식으로 만들지 않는다.** 이미 승인된 수동 CMD 경로나 명시적 C급 직접 절차까지 폐기하는 의미는 아니다.
4. **실행 전 최소 대조:** 해당 요청의 actor·schema·고유 requestId·repo/branch/source SHA·승인 manifest·실제 설치 상태와 관련 자원만 확인한다. [성공 사례 재사용 정본](SUCCESS_EVIDENCE_REUSE.md)의 승인/Windows Issue·Run/원격 결과를 활용한다. 기존 경로의 지원 범위가 부족하면 실제 미지원 지점을 입증한 뒤 공통 도구를 최소 수정·시험/PR·실PC 검증으로 확장한다. 독립 업무를 불필요한 공통 복구나 전역 검사의 대기로 묶지 않는다.
5. **실행/결과/재시도:** `queued`는 Runner Offline이나 성공과 동의어가 아니다. GitHub CI PASS도 기능 PC 실행 PASS를 증명하지 않는다. Run ID/attempt·실행 Runner/host·status/code/lastPass/firstFail·**원격 JSON/TXT 2/2 readback과 원본 Issue 댓글**을 구분해 검증한다. BLOCKED·STATE_UNKNOWN·결과 누락은 기존 요청부터 조사하고 동일 requestId 자동 재실행 0회를 유지한다. Watchdog 복구는 원본 PC 작업 재실행과 다르다.
6. **중앙 장애 인계:** 수리 가능한 확인된 실패만 기존 `agent-handoff` 경로로 접수한다. 총괄은 공통 프로세스 장애를 처리하고 원담당의 기능 개발/설치를 대신하지 않는다. GitHub 댓글은 다른 일반챗 자동 수신/재개가 아니다. 실제 원담당 대화가 재개되면 원본 Issue를 조회한다.
7. **보호·최종 완료:** #996 C급 접수·잠금 복구는 2026-11-15 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`로 완료됐고 **당시 원본 Controller 설치는 ABORTED**다. 별도 승인 [#1396](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1396#issuecomment-6884221298)에서 Controller 15파일 설치 `SUCCEEDED`, [#1397](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1397#issuecomment-6884218522)에서 동일 SHA `PASS` 사후검사를 기록했으므로 이 후속 설치 완료점은 기존 #996 중단과 구분한다. 이 결과를 새 NO-GO 판정이나 C 재실행 근거로 삼지 않는다. 이 PC별 문서화만으로 기존 Task·Core/Writer/DB·원자료·TTL·산식·승인된 D1/API/UI 계약을 변경하지 않는다. C급 관리자·보안·시스템 변경은 사용자 직접 수행한다. 기능 완료는 실제 **수집→PC 원자료 저장→계산→로컬 결과 저장→승인된 게시→API→PC/모바일 UI** 증거로 판정한다. 예약 검증은 미완료 작업·후속 단계·진행률 분모로 등록하지 않는다. 모든 기능의 개발·실운영 데이터 수집/저장·계산·게시·API/홈페이지 적용을 작업자가 완료한 후에만 사용자가 홈페이지에서 육안으로 최종 정상 여부를 판단한다. 전 기능 완료 전 사용자에게 육안 검증을 요청하지 않는다. 전체 진행률·이번 실증·남은 실제 문제·다음 필수 작업만 보고한다.

**검증 기준:** 신규 대화에서 기존 정본·실행 증거를 실제 업무에 재사용하고 적절한 Runner·Workflow를 선택해 필요한 결과를 회수했는지 **그 실행 증거로만** 판단한다. 새 대화라는 이유만으로 별도 전체 재현·건강 검사를 만들지 않는다. 문서 병합만으로 프로젝트 설정 동기화·대화 간 자동 인계를 주장하지 않는다.


마지막 유효 완료 지점과 다음 필수 실행을 정하고 그 실행에 필요한 입력·설치 모듈·경로·승인만 확인한다. 기존 공통 등록기·수집기·계산기·게시기·adapter를 우선 재사용한다. 설정으로 가능한 일을 새 Controller 설치·기능별 CMD·예약 복제로 확대하지 않는다. 기술적 근거 없이 기능·테마·ETF 수량 상한이나 목표 개수를 추가하지 않는다.

**신규 기능의 공용 경로 확인:** 실제 PC 적용이 필요한 기능은 개발 초기에 기존 등록·A급 원본 조회·B급 Writer 설치 경로가 해당 변경 범위를 지원하는지 필요한 범위에서 한 번 확인한다. 지원되지 않는 부분만 증거와 함께 프로세스 총괄의 공통 도구 개선 과제로 분리하며, 독립 기능 개발·조회·테스트는 계속한다. 이 확인을 모든 일반 업무의 새 전역 승인·검증 Gate로 만들지 않는다.

**현재·미래 기능의 실제 공유 자원 경합:** 기존의 [공용 자원 수명주기 계약](SHARED_RESOURCE_LIFECYCLE_V1.md)을 사용한다. 새 Writer·Controller·Core 실행 source·Runner 메모리/좌석/lease 및 공용 게시/결과 실행 유형은 기존 공통 admission·wait record·인증된 결과·복구 증거를 해당 실행기의 adapter로 연결한다. 안전하게 대기한 작업과 실제 `RECOVERY_REQUIRED`를 구분하고, pc-job은 작업자 실행 전에 멈췄어도 원본 Issue의 단회 실행 기회가 소모됐으므로 같은 requestId를 재사용하지 않는다. `RESOURCE_WAIT_MEMORY`는 Controller 원장 기록을 동반하지만, `LEASE_BUSY`는 해당 lease/원장을 취득·기록하기 전에 종료될 수 있다. #68에 검증된 원본별 대기 1건을 기록하되 실제 lock 해제·현재 source/승인 재조회를 확인하기 전 자동 재실행/새 B 설치를 진행하지 않는다. 독립 기능 개발·읽기 작업에는 새 전역 검사를 강요하지 않는다. 공통 코드 병합과 실PC 운영 적용/원담당 수신은 각각 별도 증거로 판정한다.

**업무 효과를 기준으로 검증 범위를 분리한다.** 작업이 Controller 파일을 교체하지 않으면 Controller 설치 Gate를 전제하지 않는다.

| 변경 범위 | 꼭 필요한 검사 | 선행 조건으로 만들지 않을 검사 |
|---|---|---|
| 조회·결과 회수·독립 A급 실행 | 해당 operation 설치 여부·고유 ID·대상 결과·필요 자원 | 전체 Controller 재설치, 모든 Runner 유휴, Core 전체 진단 |
| 승인된 adapter/허용목록·설정 등록 | 실제 영향 파일·호환 계약·승인 manifest·관련 집중 테스트 | 무관한 파일의 dirty 상태, 다른 기능 전체 테스트 |
| Controller 실행 파일 교체·독립 유지보수기 인계 | 실제 설치 SHA→목표 SHA 누적 diff·원본 바이트/승인·보호 백업·전환 직전 drain·재연결/사후검사 | 동일 증거의 무조건 재수집, 다른 프로젝트의 무관한 진단 |
| Core/DB/게시/DNS 등 운영 변경 | 해당 업무의 별도 승인·변경 영향·저장/Runtime 검증 | Controller 갱신 절차를 공통 배포 Gate로 전파 |

관련 테스트는 변경된 파일·의존 계약부터 실행한다. 공용 권한·상태머신·복구·배포 핵심 변경이면 영향받는 통합/회귀 검사를 확대한다. 전체 회귀 검사는 별도 품질 점검으로 분리할 수 있으나 모든 일반 업무의 완료 Gate나 신규 상시 예약으로 자동 추가하지 않는다. 검사를 줄이기 위해 assertion을 삭제하거나 이전의 실제 실패를 PASS로 바꾸지 않는다.

기존 실PC·Provider·DB/checkpoint·공개 화면 증거는 원본 링크·관측 시각·대상·source/설정의 유효 범위를 대조해 재사용한다. 유효한 Runtime 성공을 현재 도구의 source 접근 실패만으로 취소하지 않는다. 관련 source·설정·환경이 바뀌면 영향 범위만 재검증한다.

정상 업무마다 전체 Controller 건강 검사를 실행하지 않는다. 설치·자원 확인이 필요하거나 실제 오류·불명확 상태가 있으면 지원되는 읽기 전용 수단을 사용한다. tools/automation-status.mjs가 일반 pc-job에 설치됐다고 가정하지 않는다. 상태의 관측 시각·유효기간, 설치 파일·Supervisor 관리 좌석·Runner·활성 lease·요청 원장을 구분한다. heartbeat·GitHub Online만으로 관리 관계나 설치 성공을 증명하지 않는다.

실제 설치된 작업은 현재 schema의 pc-job Issue로 한 번 요청하고 TXT·JSON·댓글을 직접 회수한다. chatId·requestId는 계약의 정확한 UUID 형식으로 만들고 저장소·브랜치·대상 SHA·실행 SHA를 구분한다. status·code·lastPass·firstFail을 확인하며 Actions 성공·HTTP 200을 실제 작업 PASS로 대신하지 않는다.

**공통 설치 전 원본·결과 조회(2026-11-08):** 기존 A급 `writer-install-preimage-readonly`는 고정 캘린더 3파일과 고용 R6 19파일에 대해 실제 PC의 파일 존재·before SHA-256 및 `sourceRoot`·HEAD·`config.source`·설정 두 키만 조회한다. `writer-publication-evidence-readonly`는 ER1 월별 Writer 상태·전체 게시 원장과 고정 로컬 공개 output 한 건의 `storedAt`·본문 해시를 원문 노출 없이 조회한다. 두 operation은 실제 Windows [#854](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/854)·[#862](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/862)에서 고유 결과 JSON/TXT 2/2가 확인됐다. 이후 공통 변경의 현행 증거는 아래 2026-11-08 갱신 단락이 우선한다. `runtimeSourceVerified:false`는 현재 실행 중인 Core source의 미입증을 뜻하며, 전체 원장 VERIFIED는 개별 D1 게시 성공의 대체가 아니다. 원자료·비공개 본문·설정 기밀은 반환하지 않으며 기능 담당자는 해당 D1/API 재조회를 직접 수행한다.

**공통 Writer 3건 재발 방지 Windows 적용(2026-11-08):** [B #880](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/880)은 승인 manifest `approvals/controller-updates/c6a3d15beae9139e66629fb5e442202434b11481.json`의 Controller 8파일 + 비배포 인프라 2파일 누적 변경을 기존 정규 유지보수기로 설치해 `SUCCEEDED`·실제 SHA `c6a3d15…`·보호 불변·Workflow 활성·원격 JSON/TXT를 확인했다. `controllerOnlyInstall`은 변경된 live Workflow에 맞지 않아 정규 `infrastructureEvidence`를 사용했다. 동일 설치를 반복하지 않는다.
- **승인 A 범위 재사용:** [#882](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/882) Run 42441568644에서 기존 `writer-install-preimage-readonly`와 승인 `approvals/writer-preimage/inflation-candidates-7-r1.json`(원문 SHA-256 `a9270933…`)을 통한 신규 7파일 Windows 조회 PASS·JSON/TXT 2/2를 확인했다. 5개 A는 ABSENT, `run-local.mjs`·`independent-publication.mjs` 두 M은 PRESENT/원본 해시 확인, source HEAD=config.source=`3f6fc4a…`, 운영 쓰기0. 기존 7필드/22파일 조회는 유지하고 이후 추가 기능은 승인 manifest만 추가한다. `runtimeSourceVerified:false`를 실제 Core 프로세스의 실행 source PASS로 바꾸지 않는다.
- **ER1 개별 D1 게시 증거:** [#883](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/883) Run 42441568196에서 새 Controller A 동작과 로컬 월별 결과 SHA 확인 PASS, 그러나 `d1.perKeyReadback=NOT_RECORDED`, `productionVerified=false`다. `zgmini` 병합 [PR #1021](https://github.com/ansqhd5774-Choi/zgmini/pull/1021)은 기존 Writer 게시 중 D1 개별 key 본문 해시·stored_at 결과를 기록하고 최신 24개월 보존·동일 시각 본문 불일치 실패 전파를 보강했다(관련 source 테스트 8/8 PASS). **운영 Writer에는 공유 `scripts/pc-writer/run-local.mjs`와 `scripts/pc-writer/independent-publication.mjs`의 동일 승인 Writer B 설치가 필요**하며, 그 후 정상 게시가 실행돼야 새로운 개별 원장 증거가 생긴다. 이 A는 독립 D1 네트워크 SELECT가 아니고 과거 게시 건의 D1 일치를 소급 확인하지 않는다. D1·API/UI 검증은 기능 원담당의 범위다.
- **R6 import 실패 가시화:** [#874](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/874) 원래 실패코드는 `WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`. 공통 Writer B PR #876은 기존 STOP 보호를 보존하며 다음 유효 B 사전검사에서 승인 대상과 누락 의존 파일 상대경로·원인을 기록하도록 수정했다. **#874 자체는 재실행하지 않는다.** 이 소스 변경을 실제 누락 파일 확인이나 R6 운영 설치 성공으로 오인하지 않는다. 이후 [PR #886](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/886)은 승인된 A 전체/M 새 상대 import 미확인 항목을 한 번에 최대 8건과 추가 누락 개수로 보고하도록 확장했고 관련 66/66 source 테스트 PASS. 기존 첫 `diagnostic`·안전 STOP·원본 보호는 유지한다. 정규 Writer B는 신규 Issue에서 event `github.sha`의 control source를 checkout하므로 #880 Controller 설치와 별개이며, 다음 정상 B의 실제 Windows 복수 진단은 아직 미검증이다.

**테마 공포탐욕 공통 B 실행 장애와 source 재발 방지(2026-11-08):** [#846](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/846) Windows run `42433385671`에서 승인 source checkout까지 성공했으나, `direct-writer-b/run.mjs` → dispatcher → 고정 receiver → 다시 CLI `run.mjs`로 돌아오는 순환 import가 최상위 `await` 미완료/Node exit `13`을 유발했다. 보고 JSON/TXT 2/2는 작성됐으나 실제 효과는 `STATE_UNKNOWN/RESULT_UNVERIFIED`였다. 사후 읽기 전용 [#847](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/847)은 주요 기존 활성 파일·Task/CMD 해시가 유지됐음을 확인했지만 신규 백업/설치 효과 전체를 확정하지는 못했다. **#846 재실행 금지.**
- [공통 PR #889](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/889) 병합 SHA `2158108b107a500c190214a3429116287fffb506`: 승인/source pin 함수를 독립 `approval-contract.mjs`로 분리해 CLI↔receiver 순환 import를 제거. 실제 CLI→dispatcher→receiver 격리 재현에서 수정 전 exit 13, 수정 후 정상적인 제한 결과를 확인했고 관련 Node 8/8 PASS. 기존 승인·잠금·원본 보호는 유지한다.
- [공통 PR #890](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/890) 병합 SHA `a2ff50826fcbd66ecfe9d3141e36c08c1a8f2c68`: 정규 B Step5의 실제 Node 종료 코드를 `RUNNER_TEMP` 내 생성 전용 부가 원장에 기록하고 원래 종료 코드를 보존한다. 보고기는 고정 Actions 단계 상태·원본 결과와 이를 교차 검산해 `LAST_PASS/FIRST_FAIL/firstFailCode/nodeExitCode`를 JSON/TXT/댓글에 안전하게 전달하며, 모순·누락은 계속 `STATE_UNKNOWN`으로 판정한다. 실행 단계 진입과 운영 효과 시도 여부를 구분한다. source 관련 Node 34/34 PASS. 과거 #846 원본 결과를 소급 수정하지 않는다.
- [공통 PR #891](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/891) 병합 SHA `c567f3296f1b1edec3e51850569c8a0c95582086`: 기존 승인된 **읽기 전용** Windows 호환성 proof에서 실제 CLI import 연결을 추가로 시험하고 V2 증거에 CLI proof 결과·test source SHA·Node 종료 코드를 기록하도록 개선했다. V1인 #845는 `LEGACY_NOT_TESTED`로 구분하고 이전 정상 격리 증거를 소급 무효화하지 않는다. 관련 source Node 20/20 PASS. 새 Workflow·B 설치·예약 생성은 없다.
- 후속 [#892](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/892) **실제 Windows 읽기 전용 proof PASS**: run `42445755255`, 고유 결과 `PROOF_WINDOWS_BILATERAL_CLI_PASS`, 실제 CLI 진입 증거 `WINDOWS_CLI_ENTRY_PASS`, `CLI_NODE_EXIT_CODE=0`, `OPERATION_WRITES=0`, JSON/TXT 원격 GET/readback `2/2`([결과 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/892#issuecomment-6717095881)). 이는 수정된 공통 CLI import 경로의 Windows **읽기 전용 격리 시험**을 입증한다. **테마 108파일 B 운영 설치·백업·활성 버전·Task 전환·게시 성공 증거는 아니다.** 실제 설치·수집→계산→저장→D1→API/UI는 원담당의 기존 승인·정규 B 경로에서 수행한다. 예약 검증 작업을 별도 후속 업무나 미완료 항목으로 생성하지 않는다. 전체 기능 작업을 끝낸 후 사용자에게 홈페이지 최종 육안 확인을 요청하며, 그 이전에는 작업자가 필수 회귀·보호 결과만 자체 확보한다. 오류 재발 시 신규 Gate/Controller 재설치보다 관련 진입점·최초 실패 코드·기존 원장의 최소 차이부터 확인한다.

**대형 A급 결과의 전달 범위:** `pc-source-preflight`의 파일 목록이 32KiB 전송 예산을 넘으면 기존 원본 PC ledger는 보존하고 GitHub 결과에는 `reportTransfer.status=SUMMARY_ONLY`, 목록 개수·압축 JSON 지문·생략 표시만 제공한다(Controller source PR #664). 이 축약본은 개별 파일 존재·SHA의 원격 완전 증거가 아니며, 필요한 경우 기존 실행 로그나 승인된 좁은 읽기 증거로 판정한다. PC A 실행 성공과 보고서 업로드 실패(`REPORT_SIZE`)를 구분하고 동일 requestId/Issue를 결과 전달 복구 목적으로 재실행하지 않는다. 기존 32KiB 안전 제한·JSON/TXT 정확 재조회는 유지한다.

**결과 회수 경로:** 공용 조정 #68의 전체 댓글은 정상 개별 요청의 상태 조회 대상이 아니다. 원래 요청의 Issue 번호·requestId를 고정해 검증된 결과 TXT/JSON을 직접 회수하고 댓글은 보조 알림으로 확인한다. Actions run/jobs/logs는 **`pc-job` 및 실제 개별 GitHub Actions 단회 워크플로**에서 각 고유 runId/requestId와 해당 workflow에 한해 조회한다. 독립 `pc-maintenance`는 해당 requestId의 결과쌍과 지원되는 기존 유지보수기 원장 경로로 판정한다. `pc-job`은 `<runId>-<attempt>-seat-<seat>` 결과쌍, `pc-maintenance`는 `maintenance-<requestId>` 결과쌍과 영속 원장을 구분한다. `pc-job`의 성공 댓글은 원격 두 파일의 동일바이트 GET 검증 뒤에만 남긴다. 댓글 누락·도구 timeout·원격 전달 불명확 시 해당 요청의 결과·실행 증거·접근 가능한 원장부터 확인한다. **실행 `PASS`/`FAIL`/`BLOCKED`가 이미 입증됐으면 그대로 보존**하고 결과 전달만 미확인/대기로 분리한다. 실행 결과 자체가 불명확할 때만 `STATE_UNKNOWN`으로 분류하며, 다음 확인 조건을 남기고 업무를 중복 실행하지 않는다. GitHub 댓글만으로 독립 일반챗/새 workflow가 자동 재개된다고 가정하지 않는다. 댓글 전체 페이지 검사는 중복 방지에 꼭 필요한 **그 요청 Issue**만 한정하며, 페이지 상한 도달 시 미발견으로 판정하지 않는다.

작업이 미등록이면 기존 공통 실행기에 필요한 최소 모듈·명세를 준비하고 5절의 승인·검증된 경로로 등록한다. 허용목록 부재는 기술적 지원 미완료이며 그 자체가 새로운 사용자 승인 필요성을 뜻하지 않는다. 상시 승인만으로 미설치 실행기를 사용할 수도 없다. 임의 shell·SQL·다운로드 주소·스크립트로 우회하지 않는다.

승인 범위의 manifest·해시·누적 diff·실행 명세·검증 자료는 현재 담당자가 완성한다. 실제 설치 SHA와 목표 SHA의 변경별 승인·최종 바이트를 대조한다. 과거 후보 파일 수를 고정하지 않는다. 자료 미작성·브랜치 분기·과거 대기만으로 중단하지 않고 실제 충돌을 안전하게 해결해 정규 실행·결과 회수까지 진행한다.

BLOCKER는 현재 필수 실행을 실제로 막는 접근 거부·활성 자원 충돌·승인 범위 밖 결정·검증 실패 등으로 한정한다. 필수 조건의 코드/계약 근거·미충족 증거·영향 단계를 명시한다. 직접 해결할 준비 작업은 수행하고 무관한 문제는 NON_BLOCKING/DEFERRED로 분리한다. 호출하지 않는 Core 전체 계보·전체 폴더 탐색을 독립 게시기의 선행 조건으로 요구하지 않는다. 잘못된 조건은 원래 원장에서 정정한다.

정확한 resource/lane이 겹치지 않는 다른 대화·Runner·수집/Reader 작업은 계속한다. Controller 교체와 동일 PC Core 실행 checkout·보호 파일·승인 source에 실제로 쓰는 B 적용 등 **겹치는 운영 자원**만 자원별 단일 적용 담당과 기존 설치 lease/소유권 계약으로 직렬화한다. 읽기 전용 사전 검사에 6개 Runner **전원 유휴**를 전역 선행 조건으로 강제하지 않는다. 현재 설치된 유지보수기의 더 엄격한 검사와 다를 경우 문서만으로 실행기를 우회·패치하지 않고 실제 차이를 개선 대상으로 기록한다.

### 원담당 일반챗 즉시 재개와 공용 관찰 분리 (2026-11-06)

- 이 지침을 실제로 받은 일반챗은 **자기 원래 기능 목표**의 마지막 유효 완료 지점·승인·다음 필수 실행을 필요한 범위로 확인하고 승인된 실행·결과 회수를 진행한다. 계획·지침 학습·과거 복구 재확인만 반복하지 않는다. 프로세스 총괄은 공통 장애와 인계를 조정하며 원담당의 기능 구현·수집·계산·게시·설치를 대신하지 않는다.
- 공용 프로세스 과제(예: #434 유지보수기 **자연 B 운영 효과 실증**)가 대기 중이거나 다른 일반챗의 인계 수신이 미확인이라는 사실은 독립 업무의 전역 `BLOCKER`가 아니다. 자기 업무에 **실제로 필요한 정상 승인 B급 변경**은 정확한 승인·manifest·원본 보호·정규 유지보수 경로로 진행한다. 반대로 공용 실증만을 위한 시험용 B 요청이나 과거 B의 중복 재실행은 만들지 않는다.
- GitHub Issue·댓글에 남긴 인계는 **기록**이며 다른 독립 일반챗의 **실제 수신/재개**가 아니다. 원담당이 이 지침·인계를 실제로 받은 경우 자기 대화에서 수신과 다음 필수 실행·결과를 명시하고 진행한다. 별도 GitHub ACK 댓글이나 총괄 완료율을 새로운 실행 Gate로 삼지 않는다. 직접 전달 경로가 없으면 `HANDOFF_RECORDED/OWNER_ACK_UNKNOWN`으로 표시하고 관계없는 업무는 계속한다.
- 현재 단계가 `READY`면 가능한 승인 행동을 실행하고 대상 결과까지 회수한다. `BLOCKED`면 해당 실행의 `LAST PASS / FIRST FAIL / 정확한 오류 / 담당 / 최소 해제 행동`만 기록하고 그 범위에 한해 대기한다. 이미 유효한 성공 증거·정상 Controller 상태를 반복 검사하여 새 병목을 만들지 않는다.

### 승인된 격리 Writer B 자동 장애 인계 (2026-11-10)

- **입구·격리:** 승인된 `ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1` 원본 Issue의 정규 Writer B workflow 완료 시 `.github/workflows/agent-handoff-writer-b-failure-intake.yml`이 `workflow_run`을 수신한다. 저장소 opt-in 변수 `ZGMINI_PC_HANDOFF_WRITER_B_INTAKE_ENABLED == 'true'`인 경우에만 `zgmini-handoff-ci-isolated` 전용 Windows Runner에서 읽기·증거 검증·제한된 GitHub 사건 기록을 수행한다. 이 Runner는 기존 운영 6개 PC Runner/Writer B 설치 실행기와 구분되며 PC 명령·운영 파일/DB 쓰기·자동 재시도를 수행하지 않는다.
- **인증·분기:** 원본 Issue schema·workflow SHA·고정 manifest SHA-256·bot 결과 marker·해당 Run JSON/TXT 2/2를 대조한다. **확정된 수리 가능 실패만** 동일 fingerprint의 중복을 제거해 `agent-handoff` Incident 1건을 등록·재조회한다. 성공, `WAIT_RECORDED`, `WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED`, 미확정·증거 부재를 수리 사고로 승격하지 않는다. 기존 requestId·단회 Writer B 실행을 반복하지 않는다.
- **중앙 처리와 원본 반환:** 기존 단일 중앙 ChatGPT 예약 처리자가 실제 Incident 증거를 검증하고 원인에 한정한 수정·관련 회귀·PR/CI 증거를 남기며, 기존 result broker는 `HANDOFF_RESULT_RECORDED`와 원본 Issue의 `HANDOFF_ORIGIN_RESULT_RECORDED`를 구분해 검증한다. GitHub receipt는 다른 일반챗 자동 알림/자동 재개 또는 실제 PC Runtime·기능 수집→게시 완료의 증거가 아니다. 원담당은 실제 대화 재개 때 원본 Issue를 확인하고 기능 작업을 이어간다. 기존 6 Runner/공용 Writer lock·B급 승인·원본 보호 규칙은 변경하지 않는다.
- **현행 근거·남은 관측:** 자연 격리 intake [Run #42725636209](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/42725636209)는 원본 #1210의 자원 안전대기 1건을 검증해 `WAIT_RECORDED`, 새 Incident 0건, PC 운영 쓰기·자동 재시도 각 0건이었다. 신설 격리 intake의 자연 수리 가능 실패→중앙→원본 Issue **전체 왕복 표본은 아직 0건(DEFERRED)**이며, 과거 중앙 경로의 #1063→#1068 성공 표본과 구분한다. 이 후속 관측을 독립 기능 실행의 전역 Gate로 삼지 않는다. [중앙 인계 정본](AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md)을 따른다.

### 단계 종료와 다음 실행

- 시작하거나 재개할 때 현재 목표의 완료 조건과 마지막 유효 완료 지점을 기록한다. 단계별로 `DONE`, `READY`, `RUNNING`, `STATE_UNKNOWN`, `BLOCKED`, `DEFERRED`를 구분한다. `DONE`에는 증거 링크와 적용 범위를 남긴다. 해당 입력·source·설정·환경의 변경이나 상충 증거가 있을 때만 영향받은 단계를 다시 연다.
- 다음 필수 실행은 하나로 명시한다. 실행 담당, 대상·입력, 실행 경로와 통과 조건을 기록한다. 승인과 필수 조건이 충족되면 실행하고 결과를 회수한다. 원자료가 확보됐으면 계산으로 넘어가며, 저장·재조회가 끝났으면 그 증거를 재사용해 다음 검증으로 넘어간다. 다른 단계의 승인이나 독립 장애는 해당 단계에만 적용한다.
- 이미 진행 중인 요청은 기존 ID 하나를 추적한다. 조회는 예상 결과 시점 또는 실제 상태 변화에 맞춘다. 관찰 종료 시 실행 상태, 마지막 진전, 다음 확인 조건을 남긴다. 결과가 불명확하면 기존 원장·체크포인트·결과 파일과 실제 반영 상태를 먼저 대조한다. 종료·부작용 여부와 재시도 근거가 확인되기 전에는 새 요청을 만들지 않는다.
- `BLOCKED`에는 필수 조건의 근거, 실제 미충족 증거, 담당, 해제 조건을 남긴다. 이전 시도와 다른 확인 근거가 없으면 같은 진단이나 시험을 반복하지 않는다. 독립적으로 진행할 수 있는 범위는 계속한다. 사용자 중지 지시를 받으면 새 요청·실행·재시도·후속 추적을 중단하고 마지막 상태를 남긴다. 이미 접수된 외부 실행의 취소는 실제 취소가 확인된 경우에만 보고한다.


## 3. 연결 장애와 자동 복구

이 절은 실제 문제가 발생했을 때 적용한다. 과거 복구 이력이 있다는 이유로 정상 업무를 복구부터 시작하지 않는다.

**추가 사전검사 실패의 범위:** 설치기·진단기에 새로 붙인 COM/예약 조회 등 사전검사가 timeout돼도 Controller·수집기·운영 실패로 확대하지 않는다. LAST PASS/FIRST FAIL과 실제 운영 쓰기·중단 여부를 분리해 확인한다. 단일 파일 작업에 다파일용 일시중지·전체 조회 Gate를 관성적으로 적용하지 않되, 실제 task binding·실행 경합/lease·승인 해시·백업/복구·사후 정상 실행 등 해당 변경의 안전 조건은 유지한다. 위험이 확인되지 않았다는 이유만으로 확인 불가 상태를 PASS로 만들거나 안전 검사를 임의 우회하지 않는다.

| 실제 상황 | 처리 |
|---|---|
| 도구 미연결·권한 부족 | 필요한 접근 범위만 분리하고 PC 장애로 단정하지 않는다. |
| schema 오류 | 실제 계약을 수정하고 생성 불명확이면 기존 ID부터 조회한다. |
| 도구 안전 검사 거부 | 차단 행동·비민감 거부 원문을 확보한다. 다른 도구·대화·명령으로 같은 행동을 우회하지 않는다. |
| 생성 timeout·응답 유실 | 기존 Issue·requestId·원장으로 접수 여부를 확인하고 중복 제출하지 않는다. |
| Issue 존재·PC 미접수 | receiver·설치 모듈·활성 lease·요청 원장을 확인한다. |
| PC 실행 실패 | 원래 오류 코드·실패 단계·부작용에 맞춰 해당 범위만 복구한다. |
| 결과 전달 실패 | 기존 결과·원장·댓글을 회수하며 계산·설치를 재실행하지 않는다. |
| 사전검사에서 안전하게 거부되고 운영 쓰기 없음이 증명됨 | 원본 설치·업무는 보존하고 해당 입력만 수정한다. 개정 후보의 `BLOCKED`/`PREVALIDATION_UNTOUCHED_VERIFIED` 지원 여부를 확인하며, 미지원 버전의 `RECOVERY_REQUIRED`를 임의 재분류하지 않는다. |

상세 접수 분류는 [AUTOMATION_STATUS_AND_ADMISSION.md](AUTOMATION_STATUS_AND_ADMISSION.md), 연결 복구는 [RUNNER_RECOVERY.md](RUNNER_RECOVERY.md), 설치 잠금·부분 전환은 [CONTROLLER_RECOVERY.md](CONTROLLER_RECOVERY.md)를 따른다. 원장 없는 UNKNOWN·관리 좌석 불일치는 [설치 전 실패 진단](INSTALL_FAILURE_120_20261103.md), 중복 결과·종료 불명확·댓글 회수는 [공통 실패 보완](COMMON_FAILURE_HARDENING_20261103.md)을 필요한 범위에서 참조한다.

공유 복구의 단일 담당이 원래 요청·실제 파일·소유자 PID/생성 시각·nonce·lease·stage/backup/backlog를 확인하고 설치 전 취소, 부분 적용 rollback, 사후 진단/업로드 회수로 분기한다. 종료·무부작용이 입증된 제어 lease만 정확한 명세·지원 도구로 보관한다. 부분 적용은 검증된 백업·보호 기준·프로세스 확인 없이 복구하지 않는다. 원래 실패 원장은 보존하고 재실행하지 않는다.

지원 경로가 부족하면 승인 범위의 최소 구현·시험·고정 실행물을 준비한다. 검사를 제거하거나 UNKNOWN을 PASS로 바꾸지 않는다. Core 잠금 삭제·전체 node 종료·무조건 재설치는 금지한다. watchdog·guardian·유지보수기가 경쟁하지 않도록 PAUSE/DRAIN·자원 잠금 계약을 지키고 본인 소유·해제 조건을 확인한다.

checkpoint·처리 수·로그·lease가 전진하면 RUNNING이다. 관찰 timeout과 실제 실패를 구분하고 resume 가능한 작업은 checkpoint를 재사용한다. 종료 불명확은 STATE_UNKNOWN으로 격리하고 해당 자원 lease를 보존한다. 원인 수정·상태 확인 뒤에만 새 ID로 한 번 실행한다.

외부 안전 정책은 저장소 지침이나 업무 승인으로 해제할 수 없다. 거부 사유가 없으면 원인 미확정으로 기록하고 독립 작업은 계속한다. PC 전원 종료·로그인 전에는 사용자 로그인 기반 실행기가 작업을 받지 못한다. 무중단 서비스로 보장하지 않는다.

## 4. PC 직접 접근이 없는 경우

PC 실행은 특정 제품·Codex 전용이 아니다. 실제 사용 가능한 승인 Runner·독립 유지보수기·공식 PC 도구를 먼저 사용한다. 기존 설치는 재설치하지 않고 필요한 갱신·인계만 한다.

자동 경로가 없고 사용자 실행이 꼭 필요하면 검증된 설치기·진단기·인계 도구를 호출하는 실제 다운로드 가능한 CMD/ZIP을 제공한다. 명령어 복사·입력, 사용자 파일 작성, 경로·SHA 편집으로 대신하지 않는다.

목적·준비 상태·실행 위치·일반 권한·실행 횟수·정상값·STOP 조건·금지 행동·보낼 결과를 구체적으로 안내한다. 비민감 TXT를 남기고 자동 회수를 우선하며 불가능할 때만 TXT 한 개를 요청한다.

Windows 미검증이면 운영 적용과 읽기 전용/임시 폴더 시험을 구분한다. 검증 도구 제공에 운영 설치 성공을 먼저 요구하지 않는다. 오류·부분 설치·결과 불명확이면 반복 실행하지 않는다. 파일 제공 도구가 없으면 제약을 밝히고 실행물 없이 준비 완료라고 하지 않는다.

## 5. 상시 승인과 안전한 업데이트

사용자가 2026-11-03 승인한 공통 필수 절차는 이미 승인된 ZGMINI 업무의 같은 목적·보호 조건에서 기능·담당 대화 구분 없이 적용한다. 신규 기능명·모듈·허용목록 부재·B급이라는 이유만으로 같은 범위를 재승인받지 않는다. 철회·변경은 최신 승인 기록을 따른다.

상시 승인 범위:

- 제한된 경로의 읽기 전용 진단·무결성 검사
- 검증된 보관본의 새 격리 경로 복원
- 승인 기능의 source·입력 경로 등록
- 필요한 최소 실행 모듈·허용목록·호스트 설정과 자원 제한 내 실행 정책 등록
- 검증된 Controller 갱신·유지보수기 정책 인계
- 보호 범위 내 공용 장애 진단·정확한 복구 명세·제어 lease 보관/인계·복구/재개
- 동일 목적의 후속 오류 수정·실행 검증

업무 목적·대상 source/파일/경로/데이터·허용 행동·해시·검사·백업·복구 조건은 manifest로 고정한다. 명세 작성은 재승인 요청이 아니다. 임의 명령·포괄적 권한 확대·관리자/보안 설정 변경·기존 운영 DB 덮어쓰기/삭제는 포함하지 않는다. 공급자 호출·D1 게시·공개 배포는 업무의 기존 승인을 대조하고 미승인 효과만 확인한다. 한 기능의 제한을 다른 업무의 공통 금지로 확대하지 않는다.

업무 승인·실행기의 기술 지원·도구 권한은 별개다. 필요한 경로를 검증·등록한 뒤 사용하며 일반 A급 pc-job에 B급 쓰기를 우회 삽입하지 않는다. 단회 경로도 기존 공통 모듈 재사용 가능성을 먼저 확인한다.

**Writer B 재사용 계약:** Controller 전용 또는 R17·캘린더의 고정 승인 설치 경로를 다른 Writer 변경에 우회 사용하지 않는다. 기존 공통 적용 자산으로 지원되지 않으면 총괄이 최소 범위형 Writer B 수신 계약을 개선한다. 변경 manifest는 실제 PC의 repository/branch·운영 HEAD/config.source와 승인 source 계보, 허용 파일별 적용 전·후 SHA256, 실행 래퍼·Sidecar 영향, 단일 공유 Writer 잠금·백업·중단/복구·요청 결과를 연결한다. manifest 준비·GitHub 병합은 실제 수신기 설치·사용 가능성의 증거가 아니다.

**운영 `providers.env` 공통 설정 B(2026-11-08):** `config/operations.json`의 일반 A급과 기존 공통 Writer source B는 운영 환경변수 변경 권한이 없다. 승인된 물가지표 19개 설정 `ZGMINI_INFL19_RECURRING_APPROVED=1`·`ZGMINI_INFL19_GAS_DAILY_APPROVED=1`은 [독립 Provider Flags B](../provider-flags-b/README.md)의 고정 두 키·고정 1회 manifest 경로로만 적용한다. 기존 `pc-writer-b-install` 라벨은 재사용하되 별도 Issue 제목/schema·요청 ID로 구별하고 원본 `providers.env` 백업·보안 ACL 보존·전후 CAS·기존 Writer 공유 lock·원격 JSON/TXT 정확 재조회가 필수다. 다른 변수·공급자 키·Task·source·DB·D1은 수정하거나 외부에 출력하지 않는다. 안전성 증거가 불명확하면 재실행보다 기존 ID 읽기 전용 조정을 우선하며, 이미 완료된 #692·#711은 다시 실행하지 않는다. **설정 적용 PASS는 공급자 수집·계산·저장·게시·UI 갱신 PASS와 별개**다. 후자는 물가지표 원담당이 계속한다. 신규 Controller 전체 재설치·기능별 CMD·예약은 필요 없다. GitHub Actions의 `github.event.action`은 Windows Node에 기본 `GITHUB_EVENT_ACTION`으로 자동 전달된다고 가정하지 않는다. B급 워크플로는 이 값을 명시적으로 전달하고, 원본 이벤트·고유 Issue·고정 manifest 해시를 함께 검증한다(PR #716). 최초 #715는 이벤트 환경값 누락 상태의 미회수 요청으로 `STATE_UNKNOWN/RESULT_DELIVERY_UNVERIFIED`를 기록하고 재실행하지 않는다. 다음 고유 요청 #718은 Windows 원격 결과 2/2에서 `PROVIDER_B_SETUP_STOP/PROVIDER_B_MANIFEST_HASH_STOP`, 설정 쓰기 0건으로 확인됐다. Windows Git 체크아웃이 `core.autocrlf`로 승인 manifest LF를 CRLF로 변환할 수 있으므로 승인 SHA256은 고정된 `HEAD:path` Git blob 원본 바이트로 확인하고, 워크트리 파일은 원본 또는 Git 줄바꿈 변환에 한정해 일치 여부를 검증한다. 뒤이은 #720 실PC Run 42400445083은 Git blob 검증을 통과한 뒤 백업 복사 시 `PROVIDER_B_ACL_PRESERVATION_STOP`으로 원본 복구·JSON/TXT 2/2를 확인했다. `icacls` 출력에서 파일명 길이에 따라 이어지는 줄의 들여쓰기가 달라진다는 형식상 오탐을 확인했다. ACL의 실제 주체·권한 문자열은 그대로 비교하되 줄 앞뒤 공백만 정규화한다. 아울러 journal 하위 폴더의 ACL 상속 차이 가능성을 줄이기 위해 민감한 원본 백업은 같은 원본 폴더에 고유 requestId를 포함한 파일로 저장한다. ACL 동일성 검사 자체는 삭제하거나 완화하지 않는다. 실PC #722 / Run `42401040266`은 `PROVIDER_B_STOP_RESTORED/PROVIDER_B_UNEXPECTED_STOP`으로 2/2 결과를 회수했다. Windows `FlushFileBuffers`는 쓰기 권한이 있는 파일 핸들이 필요하므로, 백업 복사의 `fsync`용 핸들은 원본 바이트 수정 없이 `r+`로 열고 즉시 닫는다. 그 외 미분류 시스템 오류는 비밀정보·원본 경로 대신 실패 단계 이름만 안전 코드로 보고해 최소 원인 분석을 가능하게 한다. 소비된 #720·#722는 재실행하지 않는다. 실패 원인별 고유 ID는 보존하고 소비된 요청을 재실행하지 않는다. 아래의 소스 코딩·PR 병합만으로 실제 Windows `providers.env` 반영을 주장하지 않는다. **실제 운영 설정 활성화 완료(#724, 2026-11-08):** [Windows 실행 Run 42401443148](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/724#issuecomment-6711344654)에서 `PROVIDER_B_APPLIED_VERIFIED/PROVIDER_B_TWO_FLAGS_SET`, 변경 키 이름 정확히 2개, 승인 manifest SHA256 일치, 제어 source `3b6e948b5fe9f1c91d8d823bf648503dc26300bb`, 전후 해시 변화, 원본 백업 검증, JSON/TXT GET 재조회 2/2를 확인했다. 소비된 #724는 재실행·재설치하지 않는다. 이 성공은 설정 변경 완료 증거이며, 물가지표 19개의 실제 공급자 수집·로컬 저장·계산·D1·API/UI와 별도의 기능 검증이다.

**고용 R6 `config.json` 두 opt-in의 공통 B급 경로(2026-11-08):** 정규 `writer-config-b`는 `employmentR6AutoCollection`·`employmentR6OneYearAutoPublication` 정확히 두 키만 승인된 manifest·원본 SHA CAS·같은 폴더 백업/ACL·공유 Writer 잠금·실패 복구로 변경한다. **고용 담당자의 19개 `.mjs` 실제 정규 Writer B 설치와 파일별 목표 SHA-256 재조회가 선행**이며 설정의 현재 값이 이미 승인 상태이면 변경하지 않는다. 설치 이전에는 두 키를 활성화하지 않고, 물가지표 `provider-flags-b`나 일반 A급에 변경 권한을 우회 부여하지 않는다. 코드 병합·Windows TEMP fixture 테스트와 실제 운영 설정 활성화는 별개이며, 각 고유 B 요청의 JSON/TXT 2/2 원격 재조회와 전후 무결성 증거로만 설치 성공을 판정한다. 이 변경은 R6 수집·계산·SQLite·D1·API/UI 검증을 대신하지 않는다.

**R6 설정 B 증거 게시의 원자성(2026-11-08):** 기존 JSON/TXT 순차 게시 중 단독 1개가 남았던 [#860](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/860)의 원본 결과 전달 실패는 보존한다. 공통 보고 경로는 [PR #867](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/867)부터 고유 결과 두 경로의 미존재·최신 HEAD를 확인한 후 **단일 Git 커밋**으로 게시하고, 결과 commit SHA에서 2/2 동일바이트를 재조회한다. ref 충돌·응답 불명확 시 쓰기 재시도 없이 읽기 전용 조정으로만 판정한다. 실제 Windows 임시 fixture [#868](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/868), Run `42436432888`은 8개 테스트 파일 PASS 및 JSON/TXT 원격 2/2를 확인했다. 이는 R6 운영 설정 활성화 증거가 아니다.

**Writer B 자연 유휴 경합(2026-11-08, PR #708):** 승인된 설치기는 최초 자연 유휴 확인 뒤 백업·후보 준비 중 Core 정상 실행이 다시 시작될 수 있다. 따라서 준비 직후 기존 읽기 전용 유휴 폴링을 최대 90초 추가하고 마지막 순간의 Task XML 정의 변경(`WRITER_B_CORE_PREPAUSE_TASK_XML_DRIFT_STOP`)과 Core 활성 경합(`WRITER_B_CORE_PREPAUSE_RACE_DEFERRED`)을 구별한다. 기존 최대 6분 첫 대기·최종 CAS·원본 보호·복원 검사는 유지한다. 12분 Actions 작업 제한 내에서 대기를 추가했다. 이후 정상 승인 Windows Writer B [#711](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/711#issuecomment-6710388737)은 PR #708 포함 제어 source `f57488e585e27fa329a5b05288a9b96faa87727b`를 실제 실행하고 6파일 `WRITER_B_INSTALLED_VERIFIED`·원본/Task 보호·결과 JSON/TXT 2/2를 확인했다. 이는 개선된 공통 설치기의 실PC 정상 설치 증거이며, 이전과 동일한 Core 경합의 실제 재현·해소까지 관측했다는 뜻은 아니다. 기능별 공급자 호출·DB/D1 게시·예약 자연 실행 완료 증거와도 구분한다. #692 `WRITER_B_INSTALL_STOP_RESTORED`는 소비된 단회 요청이므로 재실행하지 않는다. 동일 운영 Writer source에 다른 승인 B 적용(#699 등)으로 `HEAD/config.source`가 전진했다면 이전 manifest `baseHead`를 그대로 재사용하지 않고 새 preimage와 누적 변경 범위를 정합하게 재확정한다. 복구·재확정이 기존 기능의 불필요한 전체 Gate가 되지 않게 한다.

**고용 R6 WAL·메모리 사전진단의 정확한 해석(2026-11-08):** R6 A/light는 SQLite 파일 헤더와 WAL 보조 파일의 존재 여부를 운영 DB를 열지 않고 확인한다. 헤더가 WAL인데 `-wal`·`-shm`이 모두 없는 상태는 SQLite 정상 종료 후 마지막 checkpoint의 결과일 수도 있으므로 DB 손상으로 단정하지 않는다. 하지만 뒤따르는 직접 SQLite 읽기가 운영 폴더에 보조 파일을 생성할 수 있으므로 안전 차단을 자동 해제하지 않는다. 원장 세부 필드 `walSidecarState`는 `BOTH_PRESENT`·`BOTH_ABSENT`·`WAL_ONLY`·`SHM_ONLY`·`NOT_REQUIRED`로 구분하고, `blockedConditions`에 DB 상태 및 메모리 조건을 독립적으로 기록하도록 소스 개선했다. 기존 최상위 `R6_DB_PREFLIGHT_FAILED`·`RESOURCE_WAIT_MEMORY` 계약과 쓰기 0건 보호는 유지한다. 이 소스 개선은 별도 승인 B의 실제 Controller 적용 및 신규 A급 조회 완료를 뜻하지 않는다. #729·#741은 소비된 단회 요청으로 재실행하지 않는다. 과거 #741의 480MiB 가용 메모리는 1024MiB 완화 후보에도 미달하므로 기준만 낮추는 해결책은 부적절하다. 정상 Core·다른 기능·독립 R6 개발은 대기시키지 않으며, 실측 없는 무조건 완화나 실시간 운영 DB에 `immutable=1` 직접 적용은 금지한다. 실측에 기반한 자원 프로필과 일관된 격리 스냅샷 조회의 필요성은 독립 설계 과제로 추적한다.

**Controller B 승인 PR 계보 사전확인(2026-11-08, #762):** `approvals/controller-updates/<targetSha>.json`의 `approval.ref`는 나중에 승인 manifest를 추가하는 PR의 자기 링크가 아니라, **적용할 Controller source가 실제 포함된 병합 PR**의 링크여야 한다. 유지보수기의 기존 검증은 승인 PR의 `merge_commit_sha`가 `targetSha`의 조상 또는 동일 커밋인지 확인한다. 로컬 JSON 형식·파일 SHA 검사만으로 이 Git 계보 검증을 대체하지 않는다. 통합 source PR이 여러 건이면 각 변경의 승인 근거를 PR 본문/공유 원장에 연결하고, `approval.ref`는 최종 대상에 포함되는 병합 PR을 지정한다. #762에서 더 최신 승인-manifest PR #760을 참조해 `UPDATE_VALIDATE_FAILED`/`FIRST_FAIL=RECEIVED`가 발생했으며 원본 Controller SHA는 유지됐다. 소비된 #762 재실행 없이 정확한 source PR 참조·신규 manifest raw SHA로만 새 고유 요청을 준비한다. 이 검사 설명은 신규 Gate가 아니라 기존 B 검증의 사전 확인이며 독립 A/원담당 개발을 차단하지 않는다.

중량 읽기 전용 기능은 기능별 예외 대신 공통 자원 프로필을 쓴다. **현재 신규 공통 heavy 등록 계약**은 A/heavy·240초·최소 가용 1536MiB, purpose=`pc-controller-heavy-readonly`, B scope=`PC_CONTROL_HEAVY_READONLY_UPDATE`다. 기존 기능별 승인값(예: 별도 384MiB 테스트)은 소급 변경하지 않는다. 기본 light가 heavy를 자동 허용하지 않는다. 1024MiB 완화 프로필은 PR #327로 source만 병합된 미검증 후보로, Windows 실측·최대 동시작업/메모리 여유·운영 설치 승인이 없으면 활성 정책으로 쓰지 않는다. 보안·쓰기 제한은 자원 프로필 완화와 무관하게 유지한다.

업데이트는 실제 설치 SHA와 목표 SHA의 **실제 누적 diff**·변경별 승인·해시를 대조한다. 파일 수를 추정하거나 과거 후보 목록을 고정하지 않는다. 읽기 전용 diff 계획기로 manifest 초안을 만들 수 있지만 최종 범위·승인은 실제 값과 대조한다. main 병합만으로 PC 적용 승인을 대신하지 않는다. `ALLOWFILE_DIFF_MISMATCH`는 실제 차이를 해결하고 검사를 제거하지 않는다. 승인된 호환 변경은 정확한 통합 manifest로 묶거나 순차 적용하고 미승인 변경은 검증된 경로로 분리한다. manifest 원본 바이트 해시를 사용한다. dirty 확인은 기본적으로 실제 변경/보호 파일에 국한하되, 영향을 줄 수 있는 겹침은 보존·격리한다. 이를 근거로 미승인 파일을 무시하거나 덮어쓰지 않는다.

**공유 Core source 정합성:** 동일 PC Core 실행 checkout의 tracked 파일을 바꾸는 B 설치는 교체 파일의 승인 바이트뿐 아니라 게시기가 사용하는 `HEAD`·`config.source`·변경 파일의 최종 정합성을 해당 업무의 설치 명세에서 함께 다룬다. 승인 파일만 제자리 교체해 Git tracked dirty를 남기는 경우에도 Core 게시가 실패할 수 있으므로, 필요하면 기존 승인된 정확한 source 정합성 절차를 같은 적용 순서에 연결한다. 개발 HEAD 전체를 자동 설치하거나 dirty·source 안전 검사를 해제하지 않는다. Core 승인 SHA를 소비하는 Sidecar·기록기 등은 **실제 검증하는 SHA/모듈과 승인된 호환 범위**를 해당 영향 목록에 포함한다. 설치 성공과 Core 게시·Sidecar 기록의 실제 실행 성공은 따로 증명한다. 이 조건은 관계없는 독립 A급·다른 source lane의 선행 Gate가 아니다.

Controller **실제 교체**는 검증된 독립 유지보수기에 `pc-maintenance`로 요청한다. 일반 Runner가 자신을 교체하지 않는다. 변경·승인·보호 파일의 사전검사는 독립 읽기 단계로 수행한다. 교체가 확정된 직후 해당 전환에 필요한 기존 job·업로드 drain → 요청 보존 → 검산한 백업 → 승인 파일 적용 → 6 Runner fresh 재연결 → 보호 검사 → 사후 고정 A급 진단 → TXT/JSON/댓글 회수를 확인한다. 전원 유휴·6좌석 새 연결은 **교체 시점과 교체 결과**에 묶인 검사이지 모든 일반 작업의 시작 조건이 아니다. 사후 진단은 manifest의 고정 목록을 한 번 실행하고 이미 유효한 동일 결과는 재사용한다. 유지보수 중 접수/backlog도 유실·중복 없이 회수한다.

### Controller 설치 효율 개선 5개 — 지침과 구현 상태 구분

1. **영향 파일만 dirty 검사:** 설치·workflow·승인·실행 파일은 엄격히 검산하고 무관한 문서·결과·테스트의 수정은 전역 차단 조건에서 제외한다.
2. **사전검증 결과 정밀 분류:** 실패한 operation/code를 기록한다. 변경 전·실제 운영 상태·intake 활성·보호 파일이 그대로임을 새 읽기 전용 증거로 확인한 경우에만 `BLOCKED`/`PREVALIDATION_UNTOUCHED_VERIFIED`로 판정한다. stage·pause·전환 **도중 실패하거나 부작용이 불명확한 경우**는 계속 `RECOVERY_REQUIRED`다.
3. **누적 변경 자동 계획:** 설치 SHA부터 목표 SHA까지 변경 목록·목표 파일 해시·별도 유지보수기 의존성을 읽기 전용으로 생성한다. 초안은 승인이 아니며 미승인 파일을 자동 포함하지 않는다.
4. **검사 범위와 사후 A 목록 일치:** 관련 집중 테스트와 고정 사후 operation(`core-status`, `source-audit`, `fear-greed-archive-status`)만 중복 없이 연결하되 실제 새 기능의 실행 결과도 따로 확인한다.
5. **실측 기반 중량 자원 프로필:** 현재 1536MiB heavy를 유지하며 1024MiB moderate 후보는 독립 B manifest·Windows 실측·Core 안전 검증 후에만 신규 읽기 작업에 적용한다.

위 구현은 이전 [Draft #321](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/321)·[Draft #322](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/322)의 코드·테스트를 선별 통합하여 [PR #327](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/327)에서 **2026-11-05 source 병합 완료**(SHA `eafc71b99a43a27a3e891e2de990dc26b42c2dd5`)했다. 격리 Node 영향 테스트 106건과 복구 계획기 4건 PASS이며, **2026-11-05 KST 실PC 유지보수기 자체 인계는 이전 설치 `dbe072206a599f7ac3c4eb9d86afd89cd4fdbd54`에서 승인 대상 `5469548b05ba90f3855281e94234952bdb45fa4f`로 `PASS`였고, `STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED` 및 새 Receiver 확인이 기록됐다.** 사용자 제공 원본 결과 TXT SHA-256: `dd49073588aa114c463ad7ed80ddcefd1a4001c89b7cfab91010f18e385a7f5f`. 이는 **유지보수기 자체 교체 증거만** 해당하며, Controller 새 설치·6 Runner 재연결·1024MiB 완화 정책 운영 활성화는 입증하지 않는다. 후속 Controller 적용은 정확한 B manifest·해시·전환/복구 보호·관련 Windows 사후 검증을 별도로 따른다. 기존 정상 A 업무를 Controller 교체 완료까지 불필요하게 대기시키지 않는다.
별도 정규 B 요청 [#345](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/345#issuecomment-6640249328)에서는 2026-11-05 KST Controller 목표·실제 SHA가 모두 `69c830275bd3fec75b17c8a98c46d689447fb1a7`이고 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`, 보호 상태 유지·Workflow 활성 상태가 확인됐다. [#346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/346)·[#347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/347)에서 설치 후 서로 다른 좌석의 A급 진단 PASS 및 #347의 Core 실행 전진을 확인했다. 이는 앞 문단의 **유지보수기 자체 인계와 분리된 후속 Controller 설치 증거**이며, 모든 향후 운영 상태·A 6개와 B 실패의 동시 통합 검증·1024MiB 정책 활성화를 뜻하지 않는다. 이미 유효한 실제 Runtime 결과는 해당 관측 시점과 대상 범위에서 재사용한다.

유지보수기 자체 인계는 현재 설치에 맞는 별도 검증 경로를 쓴다. 기존 프로세스 증거를 소급 생성하지 않고 정상 종료 또는 종료 입증 후 인계한다. 정책 변경 의존성은 필요한 업무에만 적용한다. 업데이트/인계 때 Startup 환경의 실제 GitHub 인증을 확인하며 기존 계정·공식 보안 저장소를 사용한다. 토큰을 명령행·파일·로그·Issue에 노출하지 않는다.

## 6. 동시 작업과 변경 범위

사용자의 현재 단독/병렬 진행 방침을 따른다. 6개 Runner가 있어도 동시 실행 의무는 없다. 허용된 독립 개발·검토·격리 시험은 병렬화할 수 있지만 공용 설치·공유 쓰기는 자원별 잠금으로 직렬화한다. 요청 ID·작업폴더·TEMP·캐시·출력·원장을 분리하고 heavy는 자원 정책에 따라 대기한다.

#68의 단일 설치 조정 담당이 실제 설치 SHA·승인·의존성·순서·결과를 관리한다. Controller·유지보수기뿐 아니라 동일 PC Core 운영 checkout과 그 승인 SHA를 소비하는 기록기·게시기에 실제 영향이 있는 적용도 같은 원장으로 조정한다. 기록기 구현·계산·게시·기능별 복구는 원담당이 수행하고, 총괄은 공유 자원 충돌과 호환성·인계를 조정한다. #68의 과거 댓글 전체를 각 일반챗이 반복 재조회하지 않고, 현재 공유 변경의 정확한 항목·기존 근거 링크만 사용한다. 담당 미지정·실제 경합 없음이면 현재 담당자가 범위·다음 행동을 등록하고 조정을 맡는다. 기존 담당은 명시적으로 인계하고 다른 작업자의 변경·요청·결과를 보존한다. 원장은 원자적 PC lease를 대체하지 않는다.

대기에는 실제 필요한 모듈·산출물·경합 자원·담당·해제 조건을 명시한다. 담당 이름·과거 대기·특정 대화의 도구 거부만으로 다른 업무 전체를 묶지 않는다. 순환 대기는 담당·순서를 정리하고 원장 본문과 최신 결정을 맞춘다. 담당 교체로 거부된 동일 행동을 우회하지 않는다. 서브에이전트·플러그인은 필요한 독립 작업에만 쓰고 불필요한 고도화를 추가하지 않는다.

## 7. 보호와 실패 처리

승인 범위의 최소 변경을 수행하고 사용자 수정·다른 작업자의 미커밋 변경을 보존한다. 자동 stash/reset/clean/rebase·강제 push·이력 재작성을 하지 않는다. commit은 해당 파일만 선택하고 git add . / git add -A를 사용하지 않는다.

자동화 보완을 이유로 Core/Korea/Iran·다른 프로젝트 Runner·운영 source·원자료/산식·SQLite/D1·수집/게시 주기·예약·배포/DNS를 임의 변경하지 않는다. 별도 승인된 업무 변경만 해당 범위에서 수행한다. 기능·진단·과거 설치의 제한에는 대상과 시점을 명시한다.
사용자가 승인하여 제거한 `ZGMINI-PC-Iran-Progress-R13` 예약은 [PR #342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/342) 이후 `APPROVED_RETIRED_ABSENT`로 검사하는 예외다. Core·Korea 예약 XML의 기존 보호는 유지하되, 이란 예약이 없다는 사실만으로 무조건 전역 차단하지 않는다. 승인 없는 자동 재등록·복원은 금지하며 승인 상태와 실제 상태가 어긋날 때만 해당 범위를 진단한다.

비밀정보·토큰·인증 헤더·개인정보·전체 원자료/환경변수를 요청·로그·commit·결과에 넣지 않는다. 유료 서비스·자동결제를 추가하지 않고 API·저장소·PC 자원까지 무제한이라고 보장하지 않는다.

변경 범위에 맞는 검증을 수행하고 같은 source·설정·환경의 유효 증거는 재사용한다. fixture·실데이터 검산·Production/사용자 수동 검증을 구분한다. 실패를 숨기거나 assertion을 낮추거나 가짜 값으로 채우지 않는다. timeout·부분 반영·통신 오류는 실제 상태·원장·checkpoint부터 확인하며 수정 없이 같은 실패를 반복하지 않는다. AUTOMATION_BLOCKED와 RUNTIME_FAILED를 구분한다.

## 8. 완료·보고·문서 유지

보고의 중심은 현재 업무에서 이번에 새로 수행한 변경·실행 결과, 실제 미해결 조건, 다음 행동이다. 기존 성공 증거는 내부 진행 전제로 재사용한다. 지침 학습·환경 재확인·과거 장애 해소 확인을 신규 성과나 ‘가장 중요한 진전’으로 보고하지 않는다.

과거 결과가 현재 판단에 꼭 필요할 때만 원본 링크와 함께 ‘기존 증거 재사용’으로 짧게 표시한다. 같은 복구 사실을 모든 보고의 앞부분에 반복하지 않는다. Controller/Runner 상태는 현재 업무를 실제로 막거나 이번에 변경·복구했거나 해당 검증을 요청받았을 때 보고한다. 현재 업무의 실제 오류는 누락하지 않는다.

구현·테스트·병합·PC 설치·실행·D1 게시·공개 적용·자연 예약 성공을 구분한다. 앞 단계 성공으로 뒷단계까지 완료됐다고 하지 않는다. 문서/대기열 등록을 자동 실행·설치 완료로 보고하지 않는다. 수행하지 않은 검증·근거 없는 완료율·‘재발 없음’ 보장을 작성하지 않는다.

기본 보고는 ‘이번 수행 / 검증 결과 / 중요한 미해결 사항 / 다음 행동’을 한국어로 짧게 작성한다. 대기 중 상태가 같으면 같은 내용을 반복 통지하지 않는다. 사용자가 상태를 요청하면 마지막 확인 시각·기존 요청 ID·다음 확인 조건만 필요한 범위로 답한다. PR·테스트 진척은 필수 운영 단계의 진척과 구분한다. 미해결 사항은 정확한 단계·범위·증거·담당·다음 지원 행동·해제 조건을 적는다. 승인된 다음 행동이 가능하면 보고만 하고 멈추지 않는다.

### 성공 실행물·증거 재사용 (2026-11-08)

[성공 실행물 재사용 기준](SUCCESS_EVIDENCE_REUSE.md)에 따라 승인 manifest·실제 Windows 고유 요청/Run·GitHub JSON/TXT·해당 단계 검증을 기존 원본 경로로 연결한다. 다음 업무는 관련 사례의 **공통 구조와 실패 회귀**만 필요한 범위에서 참고하고, 현재 원본 해시·승인·source·config는 실제 상태로 새로 대조한다. 실제 재사용 가능한 공통 패턴이 검증됐을 때만 색인 한 건을 갱신한다. 매 작업에 새 문서나 예약·전체 성공 목록 검사를 요구하지 않는다. 영구 기록은 비민감한 승인·해시·판정·테스트에 한정하며, PC 운영 원본·DB·기밀 설정·토큰은 업로드하지 않는다. 문서·로컬 테스트·Windows fixture·PC 설치·D1 게시·API/UI의 증거 수준을 혼동하지 않는다.

### 공통 프로세스 개선 환류 (2026-11-06)

현장 오류가 공유되면 프로세스 총괄은 **기능 고유 문제 / 공용 절차 문제 / 도구·접근 한계 / 승인 결정**을 구분하고, 실패 행동·정확한 오류·영향·담당·최소 해결책을 정한다. 원담당은 기능 작업을 계속하며, 공용 문제에 한해 총괄이 원인 수정과 관련된 최소 검증·재발 관찰을 조정한다. 한 사례의 우회 절차를 다른 업무의 전역 Gate로 만들지 않는다.

**반복 원인 제거(R2):** 설치된 operation·다단계 실행 래퍼·실제 운영 source가 GitHub 계약과 어긋나는 공용 실패가 반복되면, 경고·인수인계·사전 Gate를 늘리기 전에 공통 진단기·manifest 생성기·범위형 수신기의 계약을 수정한다. 정상·충돌·해시 불일치·부분 적용은 관련 시나리오로 검증하고, 대표 실PC 요청의 실제 결과로 도구 지원 여부를 판단한다. 기능별 운영 완료와 플랫폼 경로 검증을 구분한다. 프로젝트 추적: [공통 실행·Writer 설치 경로 개선 R2 #622](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/622).

개선사항이 검증되면 **이 전체 정본**과 사용자 사전 전달문 `docs/GENERAL_CHAT_PREWORK.md`를 필요한 부분만 갱신하고 GitHub `main` 반영·원격 내용·commit SHA를 확인한다. 총괄은 사용자에게 **최신 전체 정본 링크와 변경 요약**을 제공한다. GitHub 갱신만으로 기존 일반챗이 자동 재학습하거나 실행기 코드가 교체되는 것은 아니므로, 사용자 전달·원담당 수신·실제 운영 효과는 각각 구분한다.

공통 규칙은 이 정본에 유지하고 시작 문서는 이를 요약한다. 다른 브랜치는 정본 참조와 작업별 차이·증거만 남긴다. 과거 장애 사례·SHA·실행 기록은 근거 문서로 보존하되 정상 업무의 시작 절차나 매번 보고할 성과로 고정하지 않는다. 옛 지침에는 대체 위치를 표시하고 과거 실행·승인 증거는 삭제하지 않는다.

### 운영 원칙을 뒷받침하는 공개 사례

- [Google SRE — Canarying Releases](https://sre.google/workbook/canarying-releases/): 작은 변경과 자동 배포·위험에 비례하는 검증. 단일 PC Controller에 대규모 카나리 기반 시설을 새로 강제하지 않는다.
- [Microsoft — Safe deployment practices](https://learn.microsoft.com/en-us/devops/operate/safe-deployment-practices): 작은 배포·단계별 노출 및 수동 반복 감소 원칙을 채택하되 PC 전용 다중 배포 환경은 만들지 않는다.
- [GitHub — Deployment concurrency](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments): 동일 그룹의 쓰기 충돌만 직렬화한다는 원칙을 공용 설치 lane에 적용한다.
- [GitHub — Merge queue 운영 사례](https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/): 서로 무관한 변경이 하나의 문제로 전부 대기하지 않도록 범위와 담당을 구분한다.
- [Shopify — 선택적 테스트](https://shopify.engineering/spark-joy-by-running-fewer-tests): 관련 테스트 우선, 놓친 회귀에 대비한 별도 전체 검사는 유지한다.
- [Stripe — Idempotency](https://stripe.com/blog/idempotency): 요청 ID와 저장 결과를 먼저 확인하고 결과 불명확 시 무조건 재요청하지 않는다.

이는 공개된 기업 원칙을 ZGMINI의 규모에 맞게 적용한 설계 판단이다. 외부 기업의 다중 리전·전사 배포 플랫폼을 그대로 복제하거나 추가 유료 인프라를 필수화하지 않는다.
