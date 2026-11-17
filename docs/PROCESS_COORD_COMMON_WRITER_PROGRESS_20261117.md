# ZGMINI 프로세스 총괄 — 공통 Writer 인계 진행 기록 (2026-11-17)

- **개발 기준:** `zgmini-pc-control` 최신 `main` (작업 시작 SHA `8340b1d51182b05d18c4362db4c3cddcdcac5aa7`).
- **작업 브랜치:** `codex/coord-writer-preimage-gate-20261117`.
- **계획·권한 정본:** `AGENTS.md`, `docs/PC_AUTOMATION_STANDARD.md`, `docs/AGENT_HANDOFF_CENTRAL_ORCHESTRATOR_V1.md`.
- **중앙 실행 원장:** [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6936365026).
- **공통 코드 PR:** [#1876](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1876) — **main source 병합 완료** (squash `5a064fd5a3608f6c67c55990f10cdd173bdbb559`) / **운영 PC 미적용**.

## 마지막 유효 완료점

1. 2026-11-17 기준 `agent-handoff` + `handoff-agent-pending` 동시 라벨 접수 **10건**을 원본 Issue/Run/JSON과 병렬 대조.
2. #1852의 원본 #1841 `ROLLED_BACK/INTERRUPTED_ROLLBACK_VERIFIED`, #1509의 원본 #1501 `INTAKE_RECOVERED_EXISTING_CONTROLLER_PRESERVED` 복구 증거가 이미 있어 **인계 두 건의 pending 라벨만 해제**, 기존 사건·원장 보존.
3. Writer **8건** #1677/#1669/#1634/#1620/#1613/#1594/#1583/#1580의 등록된 B 요청 및 결과 JSON 모두 `WRITER_B_PREFLIGHT_STOP`. 7건 `WRITER_B_PC_PREIMAGE_STOP`, #1634 `WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`. 과거 B 재실행 0건.
4. 8건 모두 고유 `ZGMINI_HANDOFF_WORK_UPDATE_V1/ACKNOWLEDGED` 및 `HANDOFF_WORK_STATE_RECORDED_V1` 봇 receipt를 원격 확인. 특히 [#1580 Run 44004467696](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44004467696)·[#1594 Run 44004831064](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44004831064)의 Job 로그에서 실제 격리 PC `DESKTOP-N62L0NG`, Runner `zgmini-handoff-ci-spare-01`, `WORK_STATUS_RECORDED`, PC operational writes 0 확인. 이 proof는 **GitHub 계정 인수 기록**이며 다른 ChatGPT 대화 자동 수신이나 기능 설치 완료가 아님.
5. #1594 최초 ACK의 fingerprint 전사 오류는 해당 댓글을 **무효 초안**으로 명시 정정하고 별도 고유 r2 ACK 및 성공 영수증으로 복구. 기존 실패 Run 자체는 무효화하지 않음.
6. 기존 승인 [#1860 A Run 43999256156](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1860)의 **2026-11-17T01:56:16Z** 관측에서 Writer checkout HEAD와 `config.source`는 모두 `2070ff53549e2f9f2cea57d5af7e1d83f9fd7388`. 8개 과거 B manifest의 `baseHead` 모두 이 관측 SHA와 불일치. 이는 **관측 시각의 checkout 상태**이며, 과거 각 설치 시각의 첫 실패 원인을 소급 확정하지 않음.
7. #1634의 후보 SHA `a165cdf36b9f1235b2e5a8acc5431e34f87652cd`에는 `asset-r10-sp500-refresh.mjs`와 `earnings-risk-provisional-r23-hook.mjs` 파일이 존재함. 그러나 승인 manifest의 변경 2파일에는 포함되지 않고, 운영 preimage의 해당 모듈은 설치 요청 당시 `NOT_FOUND`로 판정되었으므로 임의 복사/manifest 범위 확대 금지.

## 이번 소스 최소 개선

- `writer-b/installer.mjs`: 기존 `WRITER_B_PC_PREIMAGE_STOP`과 선행 보호 검사 유지, 최초 불일치의 allowlisted `preimageCheck` 코드만 추가. 관측 SHA·파일 바이트·로컬 경로·토큰 미반환.
- `writer-b/report.mjs`: 보장된 한정 값만 결과 JSON/TXT로 전달, 임의/위조 필드 폐기.
- `writer-b/installer.test.mjs`, `writer-b/receiver.test.mjs`: HEAD·config·Task·dirty·맵 키 실패 분기/무변경, 위조 진단 폐기, JSON/TXT 비공개값 제거 회귀 시험.
- 코드·회귀시험·이 진행 기록 5파일은 [PR #1876](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1876)에서 `main`에 병합되어 원격 재조회됨. 원본 Controller/Runner·Writer/DB/D1·공급자·운영 Task·실제 설치 변경 **0건**.

## 판정·다음 필수 실행

- **DONE:** 인계 10건의 원본 분류, 해결된 2건 대기 해제, Writer 8/8 인수 receipt, 대기열 PC 실제 Job 증거, 공통 소스 패치·테스트 작성.
- **소스 검증 DONE:** 정확 PR HEAD `4e207fa1852c0551d0afe4037efede6e72f36a97`에서 [격리 Windows CI Run 44006906854](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44006906854) **424/424 PASS**, [C996 CI Run 44006752176](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44006752176) **43/43 PASS**. 2026-11-17T03:02Z 격리 Runner `zgmini-handoff-ci-spare-01` 및 호스트 `DESKTOP-N62L0NG` Job 로그 검증. PR source-only main 병합 `5a064fd5a3608f6c67c55990f10cdd173bdbb559`. 독립 사람 리뷰는 별도 증거 없음.
- **HISTORICAL (정정 전 판정):** 아래 최신 재대조 전에 8건을 모두 미완료 설치로 분류했으나 이는 잘못된 합산임. 원본 B 단회 실패와 후속 별도 승인 B 설치 성공을 구분해야 함. 기능별 저장·게시 검증은 별개임.
- **최신 판정 우선:** 문서 맨 아래 `2026-11-17 W01/W02/W04 최신 설치 재대조`를 우선 적용. W02·W04 기설치 소스는 정확 파일 해시 검증 완료; W01은 고유 A #1880 결과 회수 전까지 신규 설치 여부를 미확정으로 유지. 과거 B 재실행 금지.
- **금지:** 이전 B/pc-job ID 재실행, 격리 대기열 PC에서 운영 PC 쓰기, 임의 원격 shell, Controller/lease 강제 변경, 기능별 산식·원자료·D1 변경.

## 2026-11-17 W01/W02/W04 최신 설치 재대조 — 추가 실행

**결론:** 과거 실패 8건을 현재 미설치 8건으로 합산한 이전 판정은 틀림. 여러 정확 승인 B가 뒤이어 설치 성공했으므로 신규 설치 대신 **현재 PC의 승인 AFTER SHA 재조회**를 우선함.

1. **W02 Taxonomy [완료 / 설치 재시도 불필요]**
   - 후속 B [#1600](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1600): Run 43829473029, 결과 원격 `WRITER_B_INSTALLED_VERIFIED`, 로컬 source SHA `f4ab6f4e6bdbebb8f6958be88b5c9e194df8329b`.
   - 최신 고유 A [#1881](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1881), [Run 44008648543](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44008648543): 2026-11-17T03:14:29Z `PASS/WRITER_APPROVED_PREIMAGE_READONLY`, 승인 3파일 `lib/market-calendar-taxonomy-public.mjs`, `scripts/pc-writer/market-calendar-taxonomy-output.mjs`, `scripts/pc-writer/run-local.mjs` 모두 W02 승인 AFTER SHA와 **3/3 일치**; `HEAD=config.source=2070ff53549e2f9f2cea57d5af7e1d83f9fd7388`. PC 운영 쓰기/Provider/D1 0.
   - 기존 인계 #1583/#1594의 대기 라벨만 해제하고 원본·Issue 기록 보존. 원담당 원본 [#1592 정정 회신](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1592#issuecomment-6937005338).
2. **W04 Employment [해당 설치 파일 확인 / 설치 재시도 불필요]**
   - 후속 B [#1678](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1678), [#1729](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1729), 최종 [#1751](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1751): 승인 B `WRITER_B_INSTALLED_VERIFIED`, 최종 로컬 source SHA `2070ff53549e2f9f2cea57d5af7e1d83f9fd7388`.
   - 기존 운영 A [#1812](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1812) 2026-11-16T23:50:41Z의 Provider `9a41a73e8cca84ae6ced6998f88c5dadc6fd5f12e6d09b7542748a5b187ddb12` 및 Collector `848c83202b2b63944629655850542ef2a90fefdeed48ffbfdc1774ad487a0bc5`가 #1751 승인 AFTER SHA와 **2/2 일치**. 이후 [#1860](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1860) 2026-11-17T01:56Z 및 W02 A #1881 03:14Z에도 동일 checkout/config SHA 유지. 2파일 이외의 R6 기능 데이터/스케줄러/게시까지 완료됐다는 주장은 하지 않음.
   - 기존 인계 #1580/#1620/#1669/#1677의 대기 라벨만 해제. 원담당 원본 [#1676 정정 회신](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1676#issuecomment-6937005992).
3. **W01 Inflation [과거 일부 B 성공 / 최신 정확 파일 검사 진행 중]**
   - Core bridge 관련 후속 정확 B [#1636](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1636) 및 [#1650](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1650) `WRITER_B_INSTALLED_VERIFIED`. 그러나 기존 #1633 전체 2파일 제안은 `WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP`이었고, 이후 B 설치는 Core bridge 단일 파일에 한정되어 `local-cycle.mjs`까지 설치됐다고 간주하지 않음.
   - 신규 승인 A [#1880](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1880) [Run 44008646478](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44008646478): 동일 A Operation 고정 2파일 scope, **최종 GitHub completed/cancelled (2026-11-17T03:26:38Z)**. Job #133790015470 `zgmini-pc-02` started 03:13:31Z, completed 03:26:31Z, steps 배열 비어 있고 decoded Job log 404, 원본 Issue 댓글/JSON/TXT 결과 없음. 취소 원인·실제 PC 내부 진행은 미확정. `AUTOMATION_BLOCKED/PC_JOB_CANCELLED_NO_RESULT`로 이 A 검사만 범위 제한하며 중복 재실행 금지.
   - 인계 #1613/#1634의 pending 라벨은 유지. 작업 완료/기능 hook 필요성은 결과 회수와 W01 원담당 판단으로 결정.
4. **공통 대기열 정리:** 총 10건 중 Controller 복구 2 + W02 2 + W04 4 = **8건 pending 정합 해제**. W01 2건 잔존. GitHub 접수/인수는 다른 ChatGPT 대화의 자동 수신이 아님.

**한계:** 위 A는 `FIXED_CHECKOUT_NOT_LIVE_CORE_PROCESS` 범위의 PC source/preimage 읽기 전용이며, 실제 공급자 수집·SQLite 결과·Cloudflare D1/API/UI 출력을 검증하지 않는다. 운영 source/Task/DB/D1 신규 쓰기 0; 기존 B requestId 재실행 0.

**다음 필수 행동 하나:** #1880 GitHub Run cancelled/무로그/무결과의 실제 원인 및 `zgmini-pc-02` Runner 정상 접수 상태를 기존 승인된 진단/원장으로 한정 확인. 재조회로 원본 결과가 뒤늦게 입증되면 활용하고, 미확정이면 원담당 W01과 **새 승인 A 요청의 필요성**을 결정. 그때 `local-cycle.mjs` 및 Core bridge의 현재 SHA를 대조해 설치 필요/불필요 회신. W02·W04와 다른 독립 기능을 전역 차단하지 않음.

## 2026-11-17 #1880 취소 실행 추가 조사 — Runner 02 범위 한정

- **원본:** [W01 승인 A #1880](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1880#issuecomment-6937390352), [Run 44008646478](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44008646478), attempt 1, `completed/cancelled`. Job 133790015470: `zgmini-pc-02`, 2026-11-17T03:13:31Z~03:26:31Z **13분 정각**; Run 전체 794000ms(13분14초).
- **관측 증거:** GitHub `GET actions/runs/{id}/jobs` 및 전용 Job steps 도구 **0개**, job log 404, run logs 본문 없음. 본 요청 Issue bot 결과 없음. 원격 `results/44008646478-1-seat-2.json` / `.txt` 각각 404. `pc-job.yml` 당시 커밋 `b39ec76a5fc9ae16a1234dbbb6910d71ca5ae41f`의 job `timeout-minutes:8`, 고정 operation `writer-install-preimage-readonly`의 허용 시간 60초. 8분 이후 추가 5분 패턴은 **취소/시간제한 경로 의심**일 뿐 정확한 취소 주체·실제 PC 상태 입증이 아님.
- **동일 Runner 과거 반례:** 2026-11-16T23:50Z [#1812](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1812), [Run 43982706453](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43982706453)은 `zgmini-pc-02`에서 Job 단계 5/5 완료, A JSON PASS. 이전 정상 이력일 뿐 현재 Runner Online 증거는 아님.
- **동시 다른 Runner 정상:** [#1881](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1881), [Run 44008648543](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/44008648543), `zgmini-pc-05`의 동일 `writer-install-preimage-readonly`는 5/5 단계 및 원격 JSON/TXT 2/2 PASS. **공용 operation 자체의 보편적 고장으로 판정 불가**.
- **범위:** LAST PASS=GitHub opened+pc-job label 및 Runner 02 배정. FIRST FAIL=작업 단계/원격 결과 증거 부재, 최종 cancelled. `AUTOMATION_BLOCKED/PC_JOB_CANCELLED_BEFORE_STEP_EVIDENCE`로 고유 W01 A 한 건만 분류; 운영 PC 원자료/SQLite/D1/Writer 파일 변경, Core 수집 실패, 설치 누락 여부는 **미확정**.
- **재시도/운영 조치:** 같은 requestId/Run 재실행 0, 신규 대체 A 0, 운영 Task/Controller/Runner/DB/D1/원자료 변경 0. 격리 대기열 PC를 운영 Runner 대체 실행기로 사용하지 않음.
- **다음 필수 행동:** W01 담당이 기존 성공 B(#1636/#1650) 및 미완료 `local-cycle.mjs` 통합 필요성을 원본 #1633에서 판단. 동일 Runner의 지원되는 실제 진단/원장으로 해당 취소 원인이 확인될 때만 최소 복구 판단; 불명확하면 별도 승인된 새 고유 A를 필요 범위에 한해 결정. W02/W04 정상 소스 설치 3/3·2/2, 공통 대기열 8/10 정합화는 유지. 기능 수집·게시 결과 확인은 기능 원담당 업무.
