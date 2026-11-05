# ZGMINI — Controller·6 Runner 운영 노하우 (누적 기록)

- 최초 기록: 2026-11-05 KST
- 대상: `ansqhd5774-Choi/zgmini-pc-control`
- 성격: **경험·근거 아카이브**. 운영 승인·실행 지침을 새로 만드는 문서가 아니다.
- 상위 기준: [AGENTS.md](../AGENTS.md), [GENERAL_CHAT_START.md](GENERAL_CHAT_START.md), [PC_AUTOMATION_STANDARD.md](PC_AUTOMATION_STANDARD.md), [CONTROLLER_RECOVERY.md](CONTROLLER_RECOVERY.md), [CONTROLLER_APPLY_QUEUE.md](CONTROLLER_APPLY_QUEUE.md).
- 원칙: 이 문서의 과거 기록·SHA는 **그 관측 시점의 증거**다. 현재 실제 설치·운영 상태로 간주하지 않는다.

## 1. 목적

여러 일반챗과 6개 자체 Runner를 함께 운영하면서 겪은 문제를 **발생 문제 → 실제 원인/범위 → 해결 → 검증 증거 → 다음번 판단 기준**으로 축적한다. 새로운 작업이 시작될 때 과거 복구를 반복하거나, 한 작업의 안전 차단이 모든 업무를 멈추는 일을 줄이는 것이 목적이다.

업무 기능 완성이 먼저다. 이 문서 갱신 자체를 개별 기능의 완료 조건이나 추가 안전 Gate로 만들지 않는다. 운영 계약·산식·DB·스케줄러·게시/배포 정책은 이 문서만으로 바꾸지 않는다.

## 2. 증거 등급과 용어

1. 실제 PC Runtime/설치·실행 결과, 보호 상태와 원장 재조회
2. API/저장 결과·checkpoint·배포·화면의 해당 시점 확인
3. 동일 환경 실측 및 격리 테스트
4. GitHub source·PR·계획/문서

**source 병합 ≠ PC 설치 ≠ 작업 실행 PASS ≠ 콘텐츠 최종 완성.**

- `PASS`: 해당 요청의 정의된 범위만 통과.
- `BLOCKED`: 정해진 보호/선행 조건 때문에 해당 행동이 차단됨. 즉시 전체 Controller 고장이라고 판정하지 않음.
- `STATE_UNKNOWN`: 실제 종료·변경 여부에 충분한 증거가 없음. 임의 재실행 또는 잠금 해제 금지.
- `RECOVERY_REQUIRED`: 부분 적용 또는 부작용 가능성을 확인해야 하는 전환/복구 상태.
- `AUTOMATION_BLOCKED`: 접속/도구 권한 문제. 운영 작업 실패와 구분.
- `RUNTIME_FAILED`: 대상 실행의 실제 오류로 입증된 경우.

## 3. 확인된 주요 사례

| 사례 | 발생 문제 → 해결/실제 결과 | 재사용할 노하우 |
| --- | --- | --- |
| [#319](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/319) | 이전 실패 설치 lease를 `ABORTED_UNTOUCHED`로 보관. 원본 요청 재실행·운영 변경 없음. | **안전한 보관은 신규 Controller 설치 성공이 아니다.** 무변경·소유자/원장·부작용 증거 확인 없이 자동 해제하지 않는다. |
| [#341](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/341), [PR #342](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/342) | 구버전 검사에서 의도적으로 제거된 이란 R13 작업을 필수 존재 대상으로 오인. 정확한 제거 상태를 확인하는 `APPROVED_RETIRED_ABSENT` 적용; 격리 시험 126/126 PASS. | 승인되어 제거된 예약을 자동 재등록하지 않는다. Core·Korea 보호는 유지. 격리 시험만으로 PC 운영 교체 성공을 선언하지 않는다. |
| [PR #327](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/327) | 설치 영향 파일 중심의 검사·오류 분류·누적 diff 계획·사후 진단 범위 개선 코드를 source에 반영. 유지보수기 자체 인계도 별도로 PC 검증. | 문서/코드/유지보수기 인계/Controller 실제 설치를 분리해 기록한다. 1024MiB 완화 후보를 자동 활성화하지 않는다. |
| [#345](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/345) | 별도 B 요청으로 Controller `69c830275bd3fec75b17c8a98c46d689447fb1a7` 설치 `SUCCEEDED/APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED`. 보호 상태·Workflow 활성 확인. | 과거 #319 보관이 아니라 **이 별도 설치 결과**가 해당 시점의 신규 Controller 운영 증거다. |
| [#346](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/346)·[#347](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/347) | 서로 다른 Runner 좌석에서 설치 후 A급 읽기 전용 진단 PASS; #347 시점 Core 실행 전진. | 설치 이후 진단은 실제 SHA·좌석·시각·보호 상태와 함께 해석한다. 전체 미래 안정성 보장은 아님. |
| [#349](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/349)·[#350](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/350) | 동일 시작 시각 `2026-11-04T20:17:46.695Z`에 5번 좌석 #349는 읽기 전용 PASS, 3번 좌석 #350은 개별 안전 차단 BLOCKED. 양쪽 모두 운영 쓰기 0. | **관측된 두 작업의 격리 사례**. #350 차단이 독립 #349 완료를 막지 않았음. 다만 6개 A와 B 실패를 함께 검증한 것은 아님. |
| [PR #348](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/348) | 공통 지침 3개 파일 개정 후 `e7337e31643fbc14a0843a4a1d4a7adbf5c9669d`로 main 병합. | 공통 규칙은 정본에, 이번 문서에는 재사용할 사건·근거·한계만 저장한다. |

### #350에서 특별히 주의할 점

- `R17_268_OPERATIONAL_CHANGE_BLOCKED`, `PATCH_TARGET_UNVERIFIED`.
- `assessment=CHANGED`, `R17_268_PROTECTED_STATE_DRIFT_UNATTRIBUTED`로 **과거 보호 기준과 현재 관측 사이 차이는 확인**됐으나, `attributedTo268=false`로 요청 #268의 결과라고 귀속되지 않았다.
- WMI와 전용 요청 lease/운영 source 식별 등 필수 증거가 부족하다. **현재 상태가 전부 정상이라고 판정하거나 임의 복구해서는 안 된다.** 해당 R17 작업의 원장·소유자·실제 보호 기준을 담당자가 확인할 때까지 그 범위만 차단한다.
- 독립 업무를 계속할 수 있다는 점과 #350 자체가 해결됐다는 점은 서로 다르다.

## 4. 병렬 운영 의사결정 원칙

| 상황 | 즉시 판단 | 최소 행동 |
| --- | --- | --- |
| 독립 A급 조회/개발/격리 시험 | 실행 자원과 실제 공유 변경이 겹치지 않으면 계속 | 작업별 requestId/chatId·작업공간·결과를 분리 |
| 공용 Controller/유지보수기 B 설치 | 공유 전환은 한 담당·한 설치 lane | 승인 manifest·실제 누적 diff·정확한 SHA·백업/lease 검증 |
| 사전검증 실패, 변경 없음이 입증 | 해당 입력만 BLOCKED/보관 가능(설치 버전 지원 조건에 따름) | 운영 변경·원본 요청 재실행 없이 원장과 보호 상태 재조회 |
| stage/pause/파일 교체 후 실패 또는 영향 불명확 | `RECOVERY_REQUIRED` 또는 `STATE_UNKNOWN` 유지 | 소유자·원본 바이트·부분 설치·백업 확인 후 승인 경로로 처리 |
| 한 Runner의 보호 기준 차이·증거 부족 | 해당 작업만 차단, 다른 독립 A는 계속 | LAST PASS/FIRST FAIL/정확한 code/영향 범위/담당/재검증 조건 기록 |
| 동일 요청 timeout·댓글 유실 | 실행 결과가 없다고 재요청하지 않음 | 기존 Issue·requestId·원장·저장 결과 먼저 재조회 |
| 무거운 A가 메모리/lease 대기 | 단순 대기를 장애로 확대하지 않음 | 기존 1536MiB heavy 정책과 자원 lease 준수 |
| Core/Korea/Iran 보호 검사 | 해당 운영 승인 계약을 실제로 대조 | 이란 R13의 **승인된 제거**와 Core/Korea의 계속된 보호를 구별 |

## 5. 이후에 확인할 실패 변수 — 필요할 때만

- 두 작업 동시 실행(#349/#350)은 관측됐으나 **6개 A급 + B 설치 실패의 동시 실PC 통합 검증은 미확인**. 실증 없이는 ‘전체 6개 병렬 PASS’라고 기록하지 않는다.
- 한 작업에서 발견된 보호 상태 차이의 원인을 다른 작업·Controller 전체에 추정 귀속하지 않는다.
- 격리 fixture 시험과 실PC 운영 결과를 항상 분리하고, 실제 장애가 없으면 이미 통과한 전체 시험·이전 복구를 매번 재실행하지 않는다.
- Controller/Runner 작업 성공 뒤에도 기능별 최신 데이터·계산·D1 게시·Reader 화면·예약 자동 갱신은 해당 업무에서 독립적으로 최종 검증한다. 예: #349 A 조회 PASS가 시장 캘린더의 전체 실제 적격성 검증 완료를 뜻하지 않는다.

## 6. 노하우를 쌓는 기록 형식

앞으로 **새로운 유형의 문제나 검증된 개선**이 발생할 때만 아래 형식으로 이 파일에 항목을 추가한다.

1. 날짜(KST), 업무/담당, GitHub Issue·PR·실PC 결과 링크, requestId 및 실제 SHA(비밀정보 제외)
2. 사용자가 달성하려던 기능 목표와 **실제로 막힌 행동 하나**
3. LAST PASS / FIRST FAIL / 정확한 `code` / 변경 시작·운영 쓰기 여부
4. 원인: **확인 / 가능성 / 불명**을 명시하고 다른 작업으로 영향 확대 금지
5. 최소 수정 또는 승인된 복구, 재실행 없이 확인한 저장·원장 결과
6. 재검증 결과: fixture, PC Runtime, 운영 게시/UI를 분리하고 **미검증 사항** 표시
7. 한 줄 재사용 규칙과 실제 필요한 다음 행동

이미 공통 정본에 있는 일반 규칙을 복사하지 않고 **증거가 있는 차별적 사례**를 추가한다. 오래된 사건이 현재 오류로 다시 관측되지 않았다면 재발로 기록하지 않는다.

## 7. 이번 보관 작업의 범위

이 파일은 지식 축적을 위한 GitHub **독립 브랜치 보관**이다. 현재 main, PC Controller, Runner, task, scheduler, Core/D1/공개 사이트에 운영 변경을 요구하지 않는다. 브랜치에 문서를 올렸다는 사실만으로 배포·PC 적용·작업 실행 완료를 주장하지 않는다.

## 8. 2026-11-06 검증된 공통 프로세스 개선

이 절은 **2026-11-06 KST 당시** 확인한 사례를 보존하며, 현재 설치 상태나 운영 승인을 대체하지 않는다.

| 사례 | 발생 문제·조치 | 실제 검증·재사용 규칙 |
| --- | --- | --- |
| [공용 대기열 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68) | Issue 첫머리의 과거 `14940…` 설치 SHA·#339 실패 표기가 새 기록보다 앞에 있어 오래된 차단을 재사용할 위험. 기존 5,249자 본문을 보존하고 관측 근거·담당·다음 실행·독립성을 담은 현재 상태 요약을 맨 위에 추가. | 변경 후 7,065자 원격 재조회. [#432 Controller 증거](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/432#issuecomment-6656893231)·[#68 설치 조정](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6658289465)을 구분. **상태 요약은 실PC 실시간 조회가 아니며** B 설치 직전 SHA·lease 확인 필요. 후속 [#443 병합](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 뒤 동일 상단에 남은 **‘#434 manifest 없음’ 오래된 문구도 정정**하여 실제 남은 Windows-local 검증만 BLOCKER로 유지. |
| [#431](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/431) 전역 선행 조건 오판 | #431 완료를 모든 후속 기능의 기술적 Gate로 취급한 계획을 수정. [#433](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/433)은 `config/operations.json`·`controller/operations.mjs` 두 파일 중첩, [#435](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/435)은 #431과 파일 중첩 없음, [#434](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434)는 별도 유지보수기 변경. | **실제 파일·승인·공유 lease에만 의존성 적용.** 기존 단일 B 담당·설치 순서는 임의 변경하지 않되, 무관한 A/소스 검토를 중단하지 않는다. |
| [#431·#433·#435 누적 설치 선택](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6664241790) | 설치 `69c830…` 대비 #431 승인 4파일에 #433·#435 변경을 합치면 Controller 실행 파일 **7개 후보**(공통 `operations` 2파일 중첩). | **각 변경의 승인·정확한 해시가 충족되면** 기존 R17 담당이 단회 누적 명세를 조정. 충족되지 않으면 #431의 이미 승인된 4파일 단독 작업을 계속하며 이 선택적 합산안을 새 Gate로 만들지 않음. |
| [#434 전담 인계](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/434) | 사용자가 #434 **독립 유지보수기 인계만** `b434_installer`에 맡기고 기존 R17 담당의 #431 Controller 설치 소유를 유지. 총 8파일 SHA를 고정한 [PR #443](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/443) 명세 **main 병합(`14fa522c0b051801f6a12b64d872d7a50532d39e`) 완료**,  실제 변경 소스 `tools/maintenance-agent.mjs` 1파일. | **main 명세 병합≠Windows-local 검증·B 접수·운영 인계.** 해당 운영 0건, 설치 잠금·Receiver 보호는 유지. #431 설치 완료는 기술적 전제 아님. |
| [Draft PR #442](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/442) | 임시 정리 전 로컬 `RESULT.json` 중첩 결과 및 `RESULT.txt`가 원격 게시 보고와 달라도 삭제되는 결함을 격리 재현. 포인터·JSON·worker-result의 의미적 일치 및 TXT 바이트 일치 검사 추가. | 소스 집중 시험 **19/19 PASS**, 원격 3파일 일치·별도 격리 재현 PASS. 불일치 시 `SKIPPED`, 폴더·포인터·영속 원장 보존. **Draft·Windows 운영 미검증·E: 실제 삭제 0건.** |
| [PR #437](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/437) | KPI 17개 실제 `pc-job` Issue의 기준선 확보; `queueWait`와 `execution` 용어가 각각 순수 Runner 대기·worker 실행시간으로 오해될 위험. PR 설명에 실제 정의를 명시. | `main` source 병합 SHA `ac1f5c22e6b06fafbc45ef6c4d6cacdb309a110a`, 소스 시험 **14/14 PASS**. 실제 GitHub 17건(12 PASS·5 BLOCKED, 제외 0)에서 Issue 생성→Controller 시작 중앙값 **18,495ms**, Controller 전체 처리시간 중앙값 **5,718ms**, 최대 동시 관측 2건. 순수 Runner 대기·worker 시간으로 해석 금지. 개선 전후 효과는 아직 미검증. |

### 기업 운영 원칙을 최소 적용한 근거

- [Google SRE — Managing Incidents](https://sre.google/sre-book/managing-incidents/): 총괄·운영 담당을 구분하고 하나의 최신 상태를 공유한다. → #68의 기존 단일 B 담당을 존중하면서 본문 상태를 갱신.
- [AWS Builders' Library — Making Retries Safe with Idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): 결과가 불명확한 중복 요청의 부작용을 피한다. → 기존 `requestId`·영속 원장/재조회 계약을 재사용하고 추가 실행기를 만들지 않음.
- [GitHub Actions — Concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency): 충돌 실행을 제한하지만 기본 대기 교체 동작이 있다. → B 신규 전역 concurrency 그룹을 만들지 않고 기존 lease·단일 담당 사용.

**한 줄 재사용 규칙:** 본문과 댓글의 유효한 최신 상태를 일치시키고, 실제 변경 파일이 겹치는 작업만 조정한다. 독립 업무는 계속한다. 소스 테스트·문서 개선을 PC 설치 완료로 확대하지 않는다.

**5개 항목 FINAL PASS: 0/5.** #433·#435·#434·#437 병합, #442 19/19 격리 시험, #437 17건 KPI 기준선을 실제 PC/Windows 운영 완료 또는 개선 효과로 확장하지 않는다.
