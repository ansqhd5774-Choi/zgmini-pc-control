# PC 설치·업데이트·중지

## 현재 설치본

- Root: `E:\ZGmini\automation\pc-control`
- Node: `E:\ZGmini\runtime\node.exe`
- control checkout: `E:\ZGmini\projects\zgmini-pc-control`, private main
- Runner6개: `zgmini-pc-01`~`zgmini-pc-06`, Runner별 `_work` 분리
- Startup: 현재 사용자 Startup의 `ZGMINI_PC_CONTROL.vbs`가 숨김 supervisor를 실행한다.
- 일반 사용자 medium token. Windows 서비스는 설치하지 않았다. **Windows 로그인 후** 자동 연결이며 로그인 전 실행을 보장하지 않는다.

이 경로는 현재 PC 배치다. 다른 PC에 적용할 때 대상·사용자·source·권한을 먼저 확인한다. 기존 설치본이 있으면 최초 설치기를 반복 실행하지 않는다.

## 최초 설치

이미 이 PC의 설치는 완료됐다. 아래는 재현 가능한 정본이며 일반챗의 매 작업에 요구하는 명령이 아니다.

준비: GitHub CLI가 private 제어 저장소의 admin 권한으로 인증돼 있어야 한다. token은 명령줄/채팅에 붙이지 않는다. 승인된 테마 source checkout과 SHA가 존재해야 하며 source를 자동 pull/교체하지 않는다. 최초 설치는 host root/기존 runner/Startup 이름 중복 시 중단한다.

```cmd
E:\ZGmini\runtime\node.exe E:\ZGmini\projects\zgmini-pc-control\tools\install.mjs
```

1회 실행. 정상 기대값은 `SIX_RUNNERS_CONFIGURED_STARTUP_INSTALLED`이며 **이 값만으로 Actions 실제 실행 성공은 아니다**. 설치기는 공식 runner ZIP의 GitHub SHA256을 검증하고 일반 사용자 권한·기존 작업 XML/config 불변을 확인한다. 관리자 token이거나 부분 설치·경로 충돌·SHA 불일치면 STOP하고 상태를 먼저 조사한다. `--replace`, 기존 Core 강제 종료·잠금 삭제·DB 초기화로 통과시키지 않는다.

## 검증된 Controller 업데이트

현재 정본은 [CONTROLLER_AUTO_UPDATE.md](CONTROLLER_AUTO_UPDATE.md)다. [Issue #44](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/44)에서 독립 유지보수기의 GitHub 요청 → 실제 갱신 → 진단 및 결과 회수를 검증했다. 기존의 인수 없는 `node tools/update.mjs` 직접 실행 안내는 대체됐다. 일반 pc-job에서 자기 Runner를 교체하지 않는다. 승인 manifest와 별도 pc-maintenance 요청을 사용한다.

## 중지·롤백

새 PC 작업 접수만 멈추려면 GitHub 제어 저장소 → Actions → **ZGMINI PC Job** → Disable workflow. CLI 대체는 다음과 같다.

```cmd
gh workflow disable pc-job.yml --repo ansqhd5774-Choi/zgmini-pc-control
```

실행 중 job은 결과부터 확인한다. 기존 운영 수집 작업에는 영향이 없다. 다시 켜기는 동일 명령의 `disable`을 `enable`로 바꾼다.

로그인 자동 시작도 해제하려면 현재 사용자 Startup에서 **ZGMINI_PC_CONTROL.vbs 1개만** 별도 백업 폴더로 이동한다. 다른 Startup 항목은 변경하지 않는다. 실행 중 listener를 종료해야 한다면 전용6개가 모두 idle이고 제어 job/lease가 없음을 확인한 뒤 자체 supervisor만 중지한다. Core PID나 전체 node.exe를 종료하지 않는다.

controller 롤백은 `backups/controller-*`에 보존된 정확한 controller/config/host manifest를 검증하고 동일한 drain 절차로 되돌린다. 단순 Git reset이나 root 전체 삭제를 쓰지 않는다. 이전 source가 현재 결과 계약과 맞는지도 확인한다. SQLite/D1/기존 운영 source는 롤백 대상이 아니다.

## 비용

모든 job은 self-hosted다. Artifact/cache/hosted runner/server 생성은 없다. 결과 JSON/TXT는 private Git 파일과 Issue 댓글에 저장한다. 이 구조에 유료 Artifact 업로드를 자동 fallback으로 추가하지 않는다. GitHub API/저장소 서비스 한도·PC 전력/자원은 존재하므로 무제한을 보장하지 않는다.

## 독립 유지보수기 최초 연결 이력 (현재 연결·갱신 검증 완료)

Controller 갱신을 자동 요청하기 위한 **별도** 현재 사용자 Startup 수신기가 필요하다. [CONTROLLER_AUTO_UPDATE.md](CONTROLLER_AUTO_UPDATE.md)의 정확한 SHA 검증과 1회 부트스트랩 계약을 따른다. 기존 `tools/update.mjs`를 GitHub Actions의 6 Runner 프로세스 트리 안에서 실행하면 자기 작업 종료·busy 검사에 충돌하므로 금지한다. 과거 최초 연결 전 상태는 AUTOMATION_BLOCKED였으나 현재는 #44/#45의 실제 PASS로 대체됐다. 기존 설치를 반복하지 않으며, 과정별 성공과 실패 이력은 보존한다.
