# ZGMINI — 일반챗·CMD·PC Runner 공통 작업 지침

2026-11-08 R2 Writer B 경합 보완 정본. 이전의 동일 목적 지침을 대체한다. 현재 업무·승인·완료 증거는 보존하며 처음부터 재시작하지 않는다. #319 복구 결과와 위험도별 검증·병렬 처리 기준을 보존하며, 일반챗 원담당의 업무 재개·인계 수신 기준을 추가한 **운영 지침**이다. 문서 반영만으로 실행기 코드가 설치·활성화됐다고 주장하지 않는다.

## 1. 목적과 정본

목표는 사용자가 요청한 현재 업무를 승인 범위에서 끝까지 수행하는 것이다. PC 자동화는 실행 수단이다. 지침 학습·환경 재확인·과거 복구 확인으로 현재 업무의 실행을 대신하지 않는다.

제어 저장소는 `ansqhd5774-Choi/zgmini-pc-control`, 기준 브랜치는 `main`이다. AGENTS.md·README.md·docs/GENERAL_CHAT_START.md의 필요한 내용을 읽고 다음 실행으로 진행한다. 짧은 전달문은 [GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md)다. 옛 사본과 충돌하면 최신 정본의 해당 기준을 적용한다.

현재 목적·전용 브랜치·승인·미완료 단계·유효 증거를 유지한다. 제어 저장소 HEAD, 실제 Controller 설치 SHA, 유지보수기 source SHA, PC Core 실행 checkout HEAD·승인 `config.source`·이를 참조하는 보조 실행기의 승인 SHA, 검사 대상 SHA를 구분한다. 과거 SHA·PID·설치 상태를 현재값으로 가정하지 않는다.

공용 설치가 필요하면 [CONTROLLER_APPLY_QUEUE.md](CONTROLLER_APPLY_QUEUE.md)와 [원장 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68), 업데이트가 필요하면 [CONTROLLER_AUTO_UPDATE.md](CONTROLLER_AUTO_UPDATE.md)를 참조한다. 정상 업무마다 과거 장애 문서·전체 설치 이력·전체 테스트를 다시 조사하지 않는다.

## 2. 일반 작업 실행

마지막 유효 완료 지점과 다음 필수 실행을 정하고 그 실행에 필요한 입력·설치 모듈·경로·승인만 확인한다. 기존 공통 등록기·수집기·계산기·게시기·adapter를 우선 재사용한다. 설정으로 가능한 일을 새 Controller 설치·기능별 CMD·예약 복제로 확대하지 않는다. 기술적 근거 없이 기능·테마·ETF 수량 상한이나 목표 개수를 추가하지 않는다.

**신규 기능의 공용 경로 확인:** 실제 PC 적용이 필요한 기능은 개발 초기에 기존 등록·A급 원본 조회·B급 Writer 설치 경로가 해당 변경 범위를 지원하는지 필요한 범위에서 한 번 확인한다. 지원되지 않는 부분만 증거와 함께 프로세스 총괄의 공통 도구 개선 과제로 분리하며, 독립 기능 개발·조회·테스트는 계속한다. 이 확인을 모든 일반 업무의 새 전역 승인·검증 Gate로 만들지 않는다.

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
- 후속 [#892](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/892) **실제 Windows 읽기 전용 proof PASS**: run `42445755255`, 고유 결과 `PROOF_WINDOWS_BILATERAL_CLI_PASS`, 실제 CLI 진입 증거 `WINDOWS_CLI_ENTRY_PASS`, `CLI_NODE_EXIT_CODE=0`, `OPERATION_WRITES=0`, JSON/TXT 원격 GET/readback `2/2`([결과 댓글](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/892#issuecomment-6717095881)). 이는 수정된 공통 CLI import 경로의 Windows **읽기 전용 격리 시험**을 입증한다. **테마 108파일 B 운영 설치·백업·활성 버전·Task 전환·게시 성공 증거는 아니다.** 실제 설치·수집→계산→저장→D1→API/UI는 원담당의 기존 승인·정규 B 경로에서 수행한다. 예약 자동 갱신 검증은 모든 기능 작업 완료 후 별도 후속 단계다. 오류 재발 시 신규 Gate/Controller 재설치보다 관련 진입점·최초 실패 코드·기존 원장의 최소 차이부터 확인한다.

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
