# 2026-11-17 공통 지원 반환

이 문서는 기능 구현/설치를 공통 담당에게 넘기는 지침이 아니다. 기존 인계 5건의 지원 결과만 연결한다. 기능별 현재 source/승인/manifest/실제 설치·결과 검증은 원담당이 유지한다.

## #1979 공용 설치 접수 복구

results/controller-1979-intake-recovery-20261117.json 및 TXT의 실제 복구와 독립 재조회가 정본이다. 목표 Controller 5492726bb5b0505b7ff7db73a3c673dabdf724ce는 보존했다. 잘못된 #1981을 REJECTED_INVALID_ORIGINAL로 기록하고 실행하지 않았다. #1841 완료 후 남았던 recovery claim은 종료된 소유자·완료 기록·보관본을 검증해 통째로 보관했다. 원래 #1979/#1841 ledger는 실패 이력 그대로다. 과거 ledger status만으로 동일 복구를 다시 하지 않는다.

## W03 고정 R47 CMD 수신기

기존 task-cmd-b/windows-adapter.mjs와 r47-onefile-cas.mjs에서 task-cmd-b/r47-task-chain.mjs를 사용한다. 일반 간접 CMD를 허용하지 않는다. 현재 Windows에서 확인한 R73 엔트리/실제 R73 mjs/R71 mjs/R48 CMD 네 파일의 정확 바이트 핀, 고정 경로, 빈 Task arguments와 고정 작업 폴더, 실제 Task XML을 검증한다. 사전·일시중지·CAS 직전·사후의 모든 probe에서 같은 체인을 다시 확인한다. 파일 변경·누락·삽입 또는 다른 실행 인수는 거부한다.

results/r47-fixed-chain-readonly-20261117.json은 실제 PC의 읽기 전용 경로 증거다. 이것은 CMD 교체나 수집 실행 증거가 아니다. 소스 병합 후 기존 pc-approved-runtime-b-once.yml의 pc-r47-cmd-onefile-install job이 새 이벤트 SHA를 checkout하므로 별도 Controller 설치는 필요 없다. W03는 기존 GO 범위와 정확 OLD/TARGET/Task XML을 유지한 새 requestId 및 raw-byte APPROVED_B manifest를 기존 approvals/task-cmd-b/에 준비하고 단회 접수/결과 재조회를 직접 수행한다. 기존 소비된 #1928/#1941은 반복하지 않는다.

## W04 PIT 계수 1파일

#1979 공유 복구만을 사유로 한 HOLD는 해소됐다. 기존 5492726bb5b0505b7ff7db73a3c673dabdf724ce → immutable target 451f53ae3831d369dfbcd4474b2c641736634a34의 controller/employment-r6-candidate-readonly.mjs 정확 1파일 효과는 기존 공통 필수 B 승인 범위에서 GO다. before e156d22989210b2599d9393a15f8206fecd325d14f3d72af04d658bd60ee9409, after d6a0a70d679c2d3708f87ea941288b99cc493b14ba2251caf0c78739b89c4a63. Draft #1986은 승인 manifest 자체가 아니므로 W04가 실제 설치 SHA/diff/백업/보호 조건과 새 정확 manifest를 완성한다. 다른 신규 Controller 변경을 합쳐 승인한 것이 아니다. 운영 B 단회와 PIT A 실행·기능 완료 판정은 W04가 수행한다.

## W05 기존 자연 유휴 경로

별도 writer-source release 소비자는 아직 없지만 기존 정규 Writer B는 그 어댑터를 필수로 요구하지 않는다. 공통 관측기의 false 값을 새 운영 허가로 바꾸지 않는다. SHARED_RESOURCE_LIFECYCLE_V1.md의 자연 유휴/기존 B 구분을 따른다. 기존 3파일 source-only GO와 정규 manifest를 재사용하되 새 고유 요청의 preclaim/late idle·원본 SHA/공유 claim/Task 보호를 실제 실행기가 검증해야 한다. 새 Core/Korea trigger 억제 효과는 HOLD/NOT_APPROVED 유지다.

## W01 23 private 원자료 fixed A

고정 operation inflation-a401-private23-readonly, Controller 변경 3파일: config/operations.json, controller/operations.mjs, controller/inflation-a401-private23-readonly.mjs. 60초 A/light, 고정 앱 entrypoint scripts/pc-writer/inflation-a401-baseline23-readonly.mjs, sourceRepository ansqhd5774-Choi/zgmini, sourceBranch main. 요청에 임의 경로/SQL/명령을 추가하지 않는다.

W01 parser를 다시 구현하지 않는다. 기존 pc-source-bundle-register B로 parser와 전체 정적 의존성의 정확 source manifest를 host.approvedSources[sourceSha]에 등록한다. 등록 entrypoint/branch/sourceSha/manifest 원본 바이트 SHA를 검증하고, 모든 승인 파일을 hash 검증한 후 해당 요청 workspace에 복사해 그 고정 엔트리만 실행한다. 운영 checkout의 임의 최신 JS를 직접 import하지 않는다. 자격증명 없는 최소 child 환경·45초/32KiB 상한과 128MiB V8 heap으로 제한한다. 원래 parser의 readOnly+WAL/SHM 선재 조건을 유지한다. 반환은 23 ID별 PRESENT_VALID/UNVERIFIED와 집계만 허용하고 수치 원문·경로·관측시각 등은 제거한다.

현재 소스 지원만 완료했으며 Controller 신규 operation과 W01 immutable bundle은 PC에 자동 설치되지 않는다. W01이 정확 app source bundle/정규 host 등록 및 3파일 Controller 최소 diff manifest를 준비해 원래 승인 경로로 적용하고 A 결과를 직접 회수한다. parser/23개 실제 자료 수집·검증·게시를 총괄이 대행하지 않는다.

## 실제 재발 방지 수신기 인계 완료

results/common-prevention-handoff-20261117.json 및 TXT: 승인된 3개 런타임 파일(maintenance-apply/maintenance-agent/update)을 기존 협조 종료·백업·새 Windows 출처 검증으로 적용했다. source c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7 → 36cf8ffb813f3a006f3e05379fba641fb3404645, STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED. 첫 원격 poll 완료 후 새 owner PID와 LISTENING heartbeat 일치, 유지보수기/Controller/6Runner HEALTHY, 공유 설치 lease 없음, Workflow active 및 기존 보호 snapshot 불변을 독립 확인했다. W03/W04/W01 기능 설치와 데이터 실행은 대행하지 않았다.


## 공통 지원 4건의 인수 범위 및 종료 판정

사용자의 후속 지시: 총괄에게 요청된 공통 지원만 완료하고, 나머지 기능 작업은 원담당이 진행한다. 아래의 완료는 **요청한 지원 범위의 완료**이며 기능별 운영 종단 완료가 아니다. 기능 후속 미실행을 이유로 이 지원 4건을 다시 미완료로 열지 않는다. 새 코드/환경의 실제 오류가 발견되면 해당 신규 증거의 영향 범위만 다시 처리한다.

| 지원 | 최초 요청의 완료 조건 | 충족 근거 및 반환 | 공통 판정 | 원담당에게 남기는 작업 |
|---|---|---|---|---|
| W03 #1894 | 고정 R73 간접 경로의 공통 B receiver 최소 보호 수정·검증·정규 승인 경로 반환 | PR #1989, results/r47-fixed-chain-readonly-20261117.json, 기존 효과 GO #6941303392, 반환 #6946187545 | SUPPORT_COMPLETE | 새 고유 manifest/B CMD 설치·결과 회수, 수집·계산·게시 |
| W04 #6944873762 | #1979 공통 복구와 요청된 정확 1파일의 운영 GO/NO-GO | 실제 복구·수신기 인계, 현재 before SHA 및 누적 1파일 검증, OPERATIONAL_B_GO #6946188691 | SUPPORT_COMPLETE | 본인 정규 manifest 완성·설치·PIT A·데이터 검증 |
| W05 #6944925601 | 별도 writer-source 인증 소비자의 존재와 정확 경로 확인; 없으면 GAP/NO-GO 및 최소 범위 반환 | 별도 READY_FOR_OWNER_REPLAN 인증 소비자 없음이라는 GAP 확인, 기존 Writer B의 fresh idle/lease/source/Task 경로와 관측기 false의 의미를 분리해 반환 #6946188039 | SUPPORT_COMPLETE — GAP_REPORTED | 기존 승인 범위 새 B의 현재 preflight와 본인 기능 작업. 관측만으로 승인/해제 성공을 주장하지 않음 |
| W01 #6945119078 | parser 재작성 없이 고정 A 진입점의 공통 파일/신뢰 경로에 대한 source-only 결론·지원 | PR #1989의 고정 operation/승인 bundle 신뢰 경로·11개 전용 테스트, 반환 #6946189465 | SUPPORT_COMPLETE — SOURCE_ONLY | 본인 승인 bundle 및 실제 cumulative manifest·PC 설치·A 실행·23원자료 판정 |

반환 댓글은 모두 ansqhd5774-Choi/zgmini-pc-control의 원본 #1894 또는 #68에 보존한다. 기존 원본 기능 승인·실행 증거는 유지한다. 이 종료 판정은 자동 ChatGPT 수신 ACK, PC 설치, source-only 결과의 Runtime 승격 또는 새 운영 효과 승인이 아니다.

- W05의 신규 Core/Korea trigger 선행 억제·guard 완화는 여전히 HOLD/NOT_APPROVED다. 이번 의뢰는 존재/범위 확인이므로 새 인증기·추가 Controller·일괄 진단·Writer 설치를 만들지 않는다.
- 현재 관측한 Controller 5492726b… 기준 W04 target 451f53ae…까지는 1파일이다. W01 공통 target 7c2f2449…까지는 W04 변경을 포함해 4파일이며, W04 적용 후에는 W01 3파일이다. 원담당이 실제 설치 직전 source를 기준으로 계산한다.
- #1894의 handoff-agent-pending은 공통 source 지원 미처리 라벨이다. 요청 범위의 수정·검증·반환이 완료되면 완료 근거를 남기고 이 라벨만 정리한다. agent-handoff 라벨·Issue·원본 이력은 보존하며 기능 설치 성공으로 Issue를 닫거나 가짜 HANDOFF_RESULT_RECORDED 봇 영수증을 만들지 않는다.
