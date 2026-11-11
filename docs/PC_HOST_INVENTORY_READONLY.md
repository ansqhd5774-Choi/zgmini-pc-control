# ZGMINI 두 Windows PC — Runner 기반 읽기 전용 장비 확인 (후보)

## 목적
기존 운영 PC와 별도 공통 장애 인계 PC를 실제 Runner 결과로 구분한다. 기존 Issue → Actions → 고정 self-hosted Windows Runner → 제한된 JSON/TXT 원격 재조회 구조를 재사용한다.

## 현재 확인된 사실
- 운영 PC: Runner 이름 zgmini-pc-01~06 / label zgmini-pc-control, Node E:\ZGmini\runtime\node.exe. 2026-11-09 실PC 결과 results/42544511478-1-seat-4.json: totalMiB 16122, freeMiB 1202(당시 기준), PASS, 운영 쓰기 0. 실제 hostname, 현재 CPU·스토리지·OS 빌드는 미확인.
- 공통 대기열 PC: 격리 Runner zgmini-handoff-ci-spare-01 / label zgmini-handoff-ci-isolated. #1238 / Run 43098701158의 결과쌍은 host=DESKTOP-N62L0NG을 보고하지만 #996 전용 파일 경로 미일치로 BLOCKED/RESULT_DIRECTORY_NOT_REPORTED. 이 결과로 하드웨어 조사나 #996 복구 성공을 주장하지 않는다.
- #996의 C급 NO-GO와 ISO_ONLY_PASS, 기존 Controller/Writer/DB/Task/Workflow 및 WIM/ISO 파일은 보존한다.

## 실행 요청 (한 PC당 신규 고유 Issue 1건)
Title: pc-host-inventory-readonly
운영 PC의 본문:
{"schema":"ZGMINI_PC_HOST_INVENTORY_REQUEST_V1","operation":"host-inventory-readonly","requestId":"<NEW_UUID>","role":"operating"}
격리 PC의 본문:
{"schema":"ZGMINI_PC_HOST_INVENTORY_REQUEST_V1","operation":"host-inventory-readonly","requestId":"<OTHER_NEW_UUID>","role":"handoff"}
실제 요청에서는 placeholder 대신 각기 다른 유효한 UUID를 사용한다. 본문에 명령·임의 파일 경로·비밀정보를 넣지 않는다.

## 안전 및 구분
- 기존 PC 전용 label zgmini-pc-control, Runner 01~06 이름을 고정 확인. 공통 대기열 호스트와 같으면 BLOCKED. 기존 고정 Node 경로 이용.
- 공통 대기열 PC 전용 label zgmini-handoff-ci-isolated, 격리 Runner 이름과 호스트 DESKTOP-N62L0NG를 함께 확인. 기존 pinned setup-node 22 재사용.
- os.hostname()와 COMPUTERNAME 일치 여부 검증. CPU 모델·논리 코어·OS 버전·총/가용 RAM·C:/E: 용량·Node 버전·고정 운영 경로 존재 여부만 수집한다.
- 원본 파일/DB/Workflow 변경, 운영 명령 실행, 사용자 프로필과 비밀정보 업로드 없음. 소스 코드와 테스트만으로 실제 Windows 실행을 주장하지 않는다.
- 기존 원자적 게시기를 재사용해 results/pc-host-inventory-<runId>-<attempt>-<role>.json/.txt를 한 커밋으로 게시하고 정확 재조회한다. 결과 불명확·ref 충돌은 기존 ID 조회만 수행하고 자동 재실행하지 않는다.

## 완료 기준
각 PC의 실제 Issue/Run, Runner/호스트, 읽기 전용 결과, 원격 JSON/TXT 2/2 확인, 미확인 항목을 구분한 조사표 작성. queued, BLOCKED, 소스 병합을 실측 PASS로 간주하지 않는다. 실행 정본 3종은 실제 결과가 확보된 뒤에만 필요한 참조를 추가한다.

현재 이 문서는 후보 브랜치의 제안이며, Workflow가 정식 승인·병합되기 전에는 Issue를 생성해도 진단 실행이 보장되지 않는다.
