# ZGMINI 두 Windows PC — Runner 기반 운영·장비 정본

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

검증된 읽기 전용 Workflow는 PR #1243에서 main에 병합됐다. 아래 실제 실행 증거를 현재 기준으로 사용한다. 이 증거는 다른 대화나 PC 설정의 자동 반영을 뜻하지 않는다.


## 2026-11-12 실PC 1차 결과 및 정확한 후속 조치
- 격리 PC #1245 / Run 43101563767: PASS, host DESKTOP-N62L0NG, runner zgmini-handoff-ci-spare-01, Windows 10 Home 19045, Intel Core i5-7300HQ(4 logical), RAM 16301 MiB/free 4632 MiB, C: 243306/53797 MiB, E: 198690/173364 MiB, Node v22.23.4. 실제 JSON/TXT 2/2 원격 readback, 운영 쓰기 0.
- 운영 PC #1247 / Run 43101700919: BLOCKED/HOST_IDENTITY_UNVERIFIED, Node os.hostname()=PC, Runner zgmini-pc-05, 운영 쓰기 0, JSON/TXT 2/2 원격 readback. CPU·RAM·OS·디스크는 아직 수집하지 못함. #1247 재실행 금지.
- 최초 구현은 별도의 COMPUTERNAME 환경변수 값을 Node os.hostname()와 반드시 일치하도록 요구했다. 이 값의 누락 또는 불일치는 실제 GitHub 등록 Runner + OS API hostname으로 식별된 경로를 불필요하게 막을 수 있다. 환경변수는 참고 사실로만 기록하고 **등록 Runner 이름+고정 라벨+OS hostname+두 PC 상호 배제**를 실질 호스트 검증 기준으로 유지한다.
- 수정 코드·테스트 검증 뒤 새 고유 Issue 1건으로 운영 PC의 읽기 전용 결과를 새로 수집한다. 기존 #1247의 BLOCKED 원본은 보존하며 #996 C급 NO-GO는 별개로 유지한다.


## 2026-11-12 두 PC 최종 실측 정본

**두 물리 PC는 동일한 GitHub Issue/Actions/self-hosted Runner 기반 실행 원칙을 공유하지만 OS·CPU·Node·디스크·설치 경로·업무 권한은 다르다.** 절대 경로와 설치본을 복제해 사용하지 않는다.

| 항목 | 기존 운영 PC | 격리 공통 대기열 PC |
| --- | --- | --- |
| 호스트명 | PC | DESKTOP-N62L0NG |
| 실행 증거 | #1249 / Run 43102349724 | #1245 / Run 43101563767 |
| 결과 | PASS / JSON+TXT 2/2 | PASS / JSON+TXT 2/2 |
| Runner 실측 | zgmini-pc-03 | zgmini-handoff-ci-spare-01 |
| 선택 label | zgmini-pc-control | zgmini-handoff-ci-isolated |
| Windows | 11 Pro / 10.0.26300 / x64 | 10 Home / 10.0.19045 / x64 |
| CPU | Intel Core i5-11400H 2.70 GHz | Intel Core i5-7300HQ 2.50 GHz |
| 논리 프로세서 | 12 | 4 |
| RAM 총량 MiB | 16122 | 16301 |
| RAM 가용 MiB (당시) | 1036 | 4632 |
| C: 용량/가용 MiB | 487153 / 46064 | 243306 / 53797 |
| E: 용량/가용 MiB | 1907694 / 1580840 | 198690 / 173364 |
| 사용 Node | v24.19.0, E:\ZGmini\runtime\node.exe | v22.23.4, pinned setup-node |
| E:\ZGmini, Controller, control checkout | 고정 경로 존재 확인 | 동일 고정 경로 모두 부재 |
| 운영 데이터 쓰기/공급자/D1 | 0/0/0 | 0/0/0 |
| 자동 PC 재실행 | 0 | 0 |

원격 정본:
- 기존 PC JSON: results/pc-host-inventory-43102349724-1-operating.json
- 기존 PC TXT: results/pc-host-inventory-43102349724-1-operating.txt
- 공통 대기열 PC JSON: results/pc-host-inventory-43101563767-1-handoff.json
- 공통 대기열 PC TXT: results/pc-host-inventory-43101563767-1-handoff.txt
- 기존 #1247 / Run 43101700919의 BLOCKED/HOST_IDENTITY_UNVERIFIED는 원본 실패 증거로 보존. 당시 Node의 os.hostname()은 PC였고, 뒤이은 #1249에서 COMPUTERNAME 환경변수 부재가 확인됐다. PR #1248은 임의 환경변수 확인을 필수 Gate에서 제외하되 등록 Runner 이름/고정 라벨/OS hostname/두 PC 상호배제를 유지했다. 소비된 #1247을 재실행하지 않았다.

### 신규 ChatGPT 대화에서 적용할 장비 선택 절차
1. 최신 main의 AGENTS.md, GENERAL_CHAT_START.md, PC_AUTOMATION_STANDARD.md와 **이 장비 정본**을 현재 작업의 관련 범위만 확인한다.
2. 실제 수행 작업이 운영 PC의 Core/Writer/Controller/수집·계산·D1 계열인지, 격리 Runner의 GitHub 전용 장애 접수·검증·인계인지 구분한다. PC 물리 환경이 같다는 추정을 금지한다.
3. 기존 승인된 Runner/Workflow/Issue/결과 반환 도구를 먼저 재사용한다. 기존 설치본·OS·Node·권한을 그대로 복사하거나 독립 ZIP/CMD를 상시 기본 방식으로 만들지 않는다.
4. 읽기 전용 결과에서 사용한 Runner 이름과 실제 호스트명을 함께 확인한다. 이 인벤토리는 **측정 시점의 환경 증거**이며 현재 Online, 활성 권한, OS/디스크 변경, 운영 설치 완성을 영구 보장하지 않는다.
5. #996 C급 NO-GO/ISO_ONLY_PASS는 유지된다. 인벤토리 PASS를 #996 복구, 원본 WIM 수정, 기능 수집·계산·게시 성공으로 주장하지 않는다.
