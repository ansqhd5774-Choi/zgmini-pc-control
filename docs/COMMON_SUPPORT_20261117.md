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
