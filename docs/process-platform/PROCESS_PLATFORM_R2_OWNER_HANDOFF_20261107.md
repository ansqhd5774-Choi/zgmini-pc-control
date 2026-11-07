# ZGMINI 공통 실행·설치 경로 R2 — 원담당 인계 초안

- 작성: 2026-11-07 KST / 프로세스 총괄
- 기준 계획: [R2 PLAN](PROCESS_PLATFORM_R2_PLAN_20261107.md) · [R2 LOG](PROCESS_PLATFORM_R2_LOG_20261107.md) · [Issue #622](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/622)
- 공식 R2 **80% (M0–M3 DONE / M4 실제 수신 미완료)**. 이 문서는 **PREPARED_NOT_DELIVERED**, GitHub 반영을 다른 ChatGPT 대화의 ACK로 간주하지 않음.
- 대상은 공통 A/B 자동 경로를 원담당이 재사용하도록 하는 것. Inflation19 수집·계산·D1·페이지 게시 자체는 기능 원담당 업무.

## 이미 입증된 공통 경로 — 다시 설치·검사할 필요 없음

1. **기존 A 읽기 전용 조회:** `pc-source-preflight`로 2단 VBS 정적 추적, 승인 Writer checkout 후보 HEAD/config.source/파일 이름·해시·dirty 조회. [#654](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/654) `PASS`, candidate `d50ba2630bb04c7c50911dac0a4069a8056ee469`, 기존 3파일 SHA 일치, tracked dirty false, inventory complete. 조회 자체 provider/DB/D1/운영 쓰기 0.
2. **기존 Writer B 정규 수신기:** 공통 `writer-b/contract.mjs`/installer, 정확한 `approvals/writer-updates/*.json`, `pc-writer-b-install` label·기존 단일 Writer lock/backup/rollback/CAS 재사용. [#651](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/651) 기존 `run-local.mjs` M + `inflation-causal-public-auto-publication-r1.mjs` A + 동일 test A, 정확한 3파일을 실PC에 `WRITER_B_INSTALLED_VERIFIED` 적용, 결과 readback 2/2, `LOCAL_OVERLAY`이며 원격 운영 source push 없음. [#652](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/652)/#654 A 사후 검증.
3. **안전 실패 복구:** [#646](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/646) Core natural drain timeout 후 원본 복구, [#657](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/657) 신규 import 의존성 누락을 claim/Task·source 변경 전 안전 중단. 전체 정상1/실패4 M3 5/5, 원격 소스와 Git blob 8/8 일치하는 집중 Node 40/40 PASS.
4. **M1 운영 실행 증거:** 사용자 선택으로 정규 설치·HEAD=config.source=checkpoint.sourceHead `d50ba263...`·checkpoint 자연 전진·Task XML 보호를 `CORROBORATED_OPERATIONAL_WRITER_PROVENANCE`로 수용. 직접 Core Task→PID 인과는 **STATE_UNKNOWN**, `runtimeSourceVerified=false`를 true로 표현하지 않음.

## 기능 후속과 미확인 사항 — 공통 플랫폼 완료 Gate로 소급하지 않음

- Preview `scripts/pc-writer/inflation-causal-public-preview-r1.mjs` (SHA256 `bc458372f86faf061306ae50e2bc806534f80e4458e45dc7901a3e09cfab86cc`)는 `lib/inflation-causal-public-catalog.mjs` (SHA256 `db4e05baaa62b51a0a783ce66466c18bb02a924894fc3aca605f473cbe3632e5`) 및 `worker/inflation-causal-public-r1.mjs` (SHA256 `86c5003c3b37cac16e3e5e9b5ed610f9e00f29ee6005cb2abb91fb04abea951f`)에 의존. Candidate `6ffe6bb7f3ff8faa452dc86fdcc2a44d0926b1a7`. #657의 preview-only manifest를 재실행하지 않음.
- **기존 A [#662](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/662):** 설치된 Controller 70222...의 새 `lib/`·`worker/` 인벤토리 확인 목적. Issue/라벨 정상이나 Actions runId와 결과 JSON/TXT **STATE_UNKNOWN**. 같은 requestId/Issue 재발행 금지. 인증된 GitHub Actions에서 run 상태를 한 번 확인: absent → 이벤트, skipped → job if, queued → Runner, failed → 해당 log, completed → 결과 upload 경로. 8분은 실행 제한이며 self-hosted queue는 최대 24시간일 수 있음. `issues:[opened,labeled]` 임의 확대 금지(중복 run 위험).
- #662에서 실제 PC 파일별 present·SHA를 회수한 뒤만 정규 B 승인 manifest의 `A`/기존파일 `M`/불변 보존 범위를 확정. 기존 `relativeModuleReferences`로 전이 의존성 확인; 추가 A operation·기능별 CMD·예약·Controller 업데이트를 만들지 않음.
- **완료 경계:** 공통 Writer B 설치 성공 ≠ Inflation19 별도 Preview 설치 ≠ 19/19 공개 점수 게시·UI 갱신. 기존 데이터·산식·계산·공개 작업은 기능 원담당이 마지막 유효 지점부터 수행.

## M4 실제 인계 완료 확인 항목

- [ ] 사용자 의도에 따른 실제 원담당 대화에서 이 문서·Issue 원본 링크를 전달받음.
- [ ] 원담당이 공통 A/B 경로와 #662 조회 미확인/Preview 기능 후속 분리를 이해하고 다음 **단일 필수 실행**을 명시함.
- [ ] 총괄은 실제 수신 사실을 원장에 기록하고 M4만 최종 판정. **GitHub 파일 생성·댓글만으로 100%를 주장하지 않음**.
