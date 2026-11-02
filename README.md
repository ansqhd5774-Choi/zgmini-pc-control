# ZGMINI PC Control

일반챗의 GitHub 작업 요청을 사용자 Windows PC에서 실행하고 결과를 자동 회수하는 비공개 제어 저장소.

**시작 지침:** [docs/GENERAL_CHAT_START.md](docs/GENERAL_CHAT_START.md) · [허용목록](config/operations.json)

## 구조

일반챗 → `pc-job` Issue JSON → GitHub Actions → 전용 Runner 6개 → 고정 host entry → TXT/JSON·Issue 댓글.

- 기존 공개 zgmini·Core/Korea/Iran·SQLite·D1·자동배포는 이 저장소가 변경하지 않는다.
- Runner별 `_work`, job workspace, TEMP, 결과 및 request 원장을 분리한다.
- 독립 A급 진단은 병렬 가능하며 heavy 테스트는 별도 lease와 메모리 gate를 사용한다.
- 임의 CMD/스크립트/테스트 파일/작업 경로를 요청 인수로 받지 않는다.
- 원격 제어 저장소의 write 권한은 신뢰 경계다. 이 계정 권한을 가진 사용자는 workflow도 바꿀 수 있으므로 Windows sandbox와 동일하다고 주장하지 않는다.
- 무료 self-hosted 실행만 사용한다. Artifacts/cache 유료 저장은 끄고 작은 결과 파일과 댓글을 쓴다.

## 운영 상태

구현·실PC 등록·Actions 실행·결과 회수 검증은 `docs/INSTALLATION_RESULT.md`에 실제 증거로 기록한다. 이 파일의 존재만으로 설치 완료가 아니다.

승인된 공통 테스트 source: `a735e4edff07409f952dcb6cd09a03791a95c094` (`codex/theme-fear-greed-integration-20261025`). 실제 host manifest와 같을 때만 실행한다. 새 작업 코드는 별도의 executable 승인/설치 검증 없이 PC에서 자동 실행하지 않는다.

## 중지·복구

먼저 GitHub Actions에서 `ZGMINI PC Job` workflow를 비활성화하면 새 요청 수신이 멈춘다. 실행 중인 job은 결과를 먼저 확인한다. 기존 Core 프로세스나 lock은 건드리지 않는다.

PC 부팅 후 자동 연결 방식, 사용자 최초 설정, 전용 supervisor와 Startup 해제 방법은 `docs/INSTALLATION_RESULT.md`의 실제 설치 방식을 따른다. 기존 CMD 수동 경로는 폐기하지 않는다.
