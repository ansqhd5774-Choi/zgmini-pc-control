# ZGMINI PC Control

일반챗의 GitHub 작업 요청을 사용자 Windows PC에서 실행하고 결과를 자동 회수하는 비공개 제어 저장소.

**공통 정본:** [docs/PC_AUTOMATION_STANDARD.md](docs/PC_AUTOMATION_STANDARD.md) (2026-11-05 개정). 현재 업무를 수행하고 이번 결과를 보고한다. 과거 설치·복구 증거는 필요한 범위에서 재사용하며 신규 성과로 반복 보고하지 않는다.

**시작 지침:** [docs/GENERAL_CHAT_START.md](docs/GENERAL_CHAT_START.md) · [허용목록](config/operations.json)

**여러 작업의 공용 설치:** [적용 대기열 운영 방침](docs/CONTROLLER_APPLY_QUEUE.md). 독립 개발·실행은 병렬로, 공용 Controller·유지보수기 적용만 단일 원장·담당으로 조정한다.

## 구조

일반챗 → `pc-job` Issue JSON → GitHub Actions → 전용 Runner 6개 → 고정 host entry → TXT/JSON·Issue 댓글.

- 자동화 인프라 작업만으로 기존 공개 zgmini·Core/Korea/Iran·SQLite·D1·자동배포를 변경하지 않는다. 별도로 승인된 업무의 게시·배포 등은 해당 업무 계약과 검증된 실행 경로를 따른다.
- Runner별 `_work`, job workspace, TEMP, 결과 및 request 원장을 분리한다.
- 독립 A급 진단은 병렬 가능하며 heavy 테스트는 별도 lease와 메모리 gate를 사용한다.
- 임의 CMD/스크립트/테스트 파일/작업 경로를 요청 인수로 받지 않는다.
- 원격 제어 저장소의 write 권한은 신뢰 경계다. 이 계정 권한을 가진 사용자는 workflow도 바꿀 수 있으므로 Windows sandbox와 동일하다고 주장하지 않는다.
- 무료 self-hosted 실행만 사용한다. Artifacts/cache 유료 저장은 끄고 작은 결과 파일과 댓글을 쓴다.

## 운영 상태

**2026-11-02: A급 자동 실행 기반 실PC 검증 완료.** Runner6개 Online, 6좌석 실제 동시 실행, 고정 테스트18개, Core 읽기 전용 조회, TXT/JSON·댓글 자동 회수, 오류·timeout·중복 차단, 전용 listener 재시작/재연결을 확인했다. 세부 증거는 [docs/INSTALLATION_RESULT.md](docs/INSTALLATION_RESULT.md), 설치·중지는 [docs/INSTALL_AND_ROLLBACK.md](docs/INSTALL_AND_ROLLBACK.md)를 따른다.

ZGMINI ChatGPT 프로젝트 공통 지침에도 자동 요청 경로를 저장하고 기존 지침 전체 보존·저장값 일치를 확인했다. **ZGMINI 프로젝트 안의 새 일반챗**에서 GitHub 도구와 이 지침을 사용한다. 프로젝트 밖 새 대화에 권한/지침이 자동 주입됐다고 주장하지 않는다.

승인된 공통 테스트 source: `a735e4edff07409f952dcb6cd09a03791a95c094` (`codex/theme-fear-greed-integration-20261025`). 실제 host manifest와 같을 때만 실행한다. 새 작업 코드는 별도의 executable 승인/설치 검증 없이 PC에서 자동 실행하지 않는다.

## 중지·복구

먼저 GitHub Actions에서 `ZGMINI PC Job` workflow를 비활성화하면 새 요청 수신이 멈춘다. 실행 중인 job은 결과를 먼저 확인한다. 기존 Core 프로세스나 lock은 건드리지 않는다.

PC 부팅 후 자동 연결 방식, 사용자 최초 설정, 전용 supervisor와 Startup 해제 방법은 `docs/INSTALLATION_RESULT.md`의 실제 설치 방식을 따른다. 기존 CMD 수동 경로는 폐기하지 않는다.

## 승인된 Controller 자동 갱신 — 실PC PASS

2026-11-03 [Issue #44](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/44)에서 GitHub 요청만으로 Controller `b77a333…` 갱신, 새 Listener 6개 연결, Core 보호 및 [진단 #45](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/45)의 PASS와 TXT/JSON/댓글 회수를 확인했다. 현재 유지보수 실행 source는 `c96d4ac…`다. 이후 작업은 [자동 업데이트 계약](docs/CONTROLLER_AUTO_UPDATE.md)을 재사용하며 최초 설치를 반복하지 않는다. 일반 pc-job에 updater 명령을 넣지 않는다.
