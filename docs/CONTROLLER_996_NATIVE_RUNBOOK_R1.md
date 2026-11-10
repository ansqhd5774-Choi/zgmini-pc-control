# #996 C 복구 원본 Windows 단회 직접 실행 경로 — 소스 준비 상태

작성일: 2026-11-10. 대상: **기존 원본 Windows PC** `E:/ZGmini`의 #996만. 이 문서·CLI·CMD는 **소스 후보**이며 실제 실행·배포·복구 완료의 증거가 아니다.

## 2026-11-10 원본 Windows 첫 CMD 진입 실패 및 수정

- 원본 운영 PC에서 ZIP `zgmini-996-C-once-source-9ae385c.zip`의 세 고정 파일 CMD/CLI/source-lock SHA는 정상 일치했다. 원본 Node·유지보수 manifest·GitHub CLI 경로도 3/3 존재 확인.
- 그러나 구 CMD의 `for /f "usebackq"` 안에 중첩된 `"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -Command ...`가 Windows `cmd.exe`에서 잘못 파싱돼 `BLOCKED: C_CLI_SHA256_MISMATCH_OR_UNREADABLE`로 종료했다. **실제 해시 불일치가 아니라 검증기 호출 실패**이며, Node/C Operator 호출 전에 중단됐다. 화면에도 `No C operation attempted`로 표시됨.
- 구 CMD/ZIP **사용 금지**. `for /f`를 제거하고 시스템 PowerShell을 직접 한 번 호출하여 `Get-FileHash` 결과를 **PowerShell 프로세스 종료 코드**로 판단하도록 수정했다. `exit 0`일 때만 Node 호출, 그 외 모든 반환값은 차단. CLI와 17개 module source-lock 바이트는 변경하지 않음.
- 구 CMD SHA256 `02586e2cb1a47b622e6bddced091d80a0768aeb0bfdb7aa9d614d991ebac26dd`는 폐기. 수정 CMD SHA256은 `3aecb6cdf5fe9b69719793e58737c73a314f14cf6906a70e92e0267cf703762d`이다. 새 archive 별도 고정/배포, Windows 프롬프트까지 실측은 아직 필요. #996 회귀 **176/176 PASS**, 운영 C 효과 **0**, 실제 복구 진척 **80% 유지**.

## 고정 입력·허용 범위

- 원본 #996: `pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404`.
- 사용자 승인 manifest 불변 Git commit: `7cff08ec6b27410baf10d8dc7130edb57b2de8c4` (CLI 코드 고정, 임의 인자 불허).
- 승인 내용: 기존 `badad9124157879d7a645b64f2768113d632355b` Controller의 접수 복구. Stage `9db6fff...` 설치 금지. 원본 Writer·Core/Korea 보호 변경, 원본 Issue 재발행, 기존 requestId 재실행 금지.
- 영속 효과 허용: 자체 C Claim·영구 마커, 기존 `pc-job` Workflow 단회 활성화, 원본 pause window 조건부 종료, 기존 결과 읽기, 확인된 원본 설치 lease 및 자체 Claim **삭제 없는 보관**.

## 현재 미완료 사항 — 실제 실행 금지

1. **원본 역사 R1/R2 전체 관측 객체 주입 문제는 해결됨.** 최신 Operator는 `run({manifestCommitSha})`만 요구하고, 실제 불변 Git owner 승인·역사적 SHA/상태 계약과 실행 직전 원본 Windows R1/R2의 **새로운 실측**을 별도로 검증한다. 역사적 미입증 2개 항목은 원래대로 false이며, 그 값을 임의로 고치지 않는다.
2. **소스 계층 봉인 후보 구현 완료, 배포/원본 Windows 실검증은 미완료.** 원본 C 작업 코드 17개 `.mjs`의 파일별 SHA256·정적 import closure가 `tools/controller-996-native-source-lock-r1.json`에 봉인됐다. CLI에는 lock 자체 SHA256가 고정되고, CMD에는 CLI SHA256가 고정된다. 전체 18개 `.mjs`(CLI 1 + 의존 17)의 신뢰 사슬이 순서대로 검사된다. 이 검사는 실제 Windows PC 실행 증거가 아니다.
   - lock SHA256: `1761f67e0bf26175b13979692961cbcdff34d6f83a9cf9a5d585ca13a366e653`
   - CLI SHA256: `1fd97d387bac2814fafd8916ed7d07c21d04d0c4facc6ad767bb21817e2cf056`
   - 검증 전 모듈의 정적 import를 실행하지 않으며, 17/17 바이트 해시·파일 유무·경로·내부 참조 완전성이 어긋나면 운영 실행기로 진입하지 않는다.
   - **남은 배포 차단:** 수정된 CMD를 포함하는 새 immutable archive 자체의 SHA256/파일 목록을 별도로 고정·재검증하고, 원본 Windows에서 첫 확인 프롬프트까지 재진입한 결과를 받아야 한다. 실패한 구 archive는 재사용하지 않는다.
3. 현재 #996 승인 manifest·댓글을 원본 GitHub 인증 GET으로 다시 검증해야 하며, 실제 실행 전 단계별 보호 상태·source·Writer 배타성을 재검증해야 한다. Linux 테스트 결과는 원본 PC의 결과가 아니다.

## 준비 완료 후의 정확한 단회 절차

1. 배포할 때 **봉인된 archive/서명과 실행용 CMD까지 외부에서 신뢰 가능하도록 확인**한 뒤, 원본 PC에서 검증된 source 패키지의 `tools` 내 `RUN_996_NATIVE_C_ONCE.cmd`를 사용자 직접 1회 실행한다. `C:\Users\...\Downloads\...\tools` 또는 `%TEMP%\...\tools` 같은 원본 `E:/ZGmini` 밖 로컬 staging은 허용한다. 원본 설치 트리 내부, UNC/네트워크 공유, 파일/디렉터리 symlink 또는 junction으로 우회된 경로는 불허한다. 새로운 PC·블로그 Runner·GitHub Actions·원격 임의 명령 방식도 불허한다.
2. CMD는 원본 Windows 고정 시스템 경로 `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`의 `Get-FileHash`로 **Node 실행 전 CLI 자체의 SHA256**부터 확인한다. 불일치 또는 verifier 부재 시 차단한다. CMD가 `NODE_OPTIONS`, `NODE_PATH`를 지우고 원본 `E:/ZGmini/runtime/node.exe`로 CLI를 인수 없이 호출하면, CLI는 Node builtin만 먼저 읽고 원본 Windows/Node/유지보수기·TTY를 읽기 전용 확인한 다음 봉인된 lock JSON 및 17개 소스 바이트·정적 import 폐쇄성을 검증한다. 확인이 모두 끝나야 운영 모듈을 `dynamic import`한다. 대화형 콘솔에서 `996 실행` 입력을 별도 1회 요구한다.
3. 입력 취소는 `C_CLI_CANCELLED_UNTOUCHED`로 종료한다. 확인 입력 뒤에는 CLI가 고정 manifest commit만 운영 실행기에 전달한다.
4. 성공은 `C_NATIVE_RECOVERY_PHYSICALLY_VERIFIED`와 독립 최종 사후 확인이 함께 있어야 한다. 원본 개별 미확인 Job은 `ownerReplanRequired`로 유지하며 별도 신규 고유 요청을 재계획한다.
5. 어떤 실패·예외·타임아웃도 **그대로 중지, 자동 재시도 금지**. `STATE_UNKNOWN_*`은 자체 Claim·원본 설치 lease·Workflow·Backlog를 **읽기 전용** 재조회하기 전 임의로 잠금을 풀지 않는다. 원본 설치 Stage를 계속하지 않는다.

## 자료와 비밀 보호

- CLI는 사용자에게 허용된 상태 코드·단계·시도 횟수·재계획 개수만 출력한다. 소유자 nonce, 승인 원문, GitHub token, 보호 파일 전체 내용 및 원본 Issue 본문은 출력하지 않는다.
- CMD는 결과를 원본 E:에 영구 기록하지 않으며, 부작용 불명확 시 사용자에게 재실행하지 말라고 명시한다.
- 기존 잠금/원장/백업은 복구 계약의 보관 순서를 따르며 이 bootstrap이 별도로 삭제·교체하지 않는다.
- 신뢰 사슬은 **배포 archive/CMD 외부 pin → CMD가 CLI SHA 확인 → CLI가 lock SHA 확인 → CLI가 17개 소스 SHA/closure 확인**이다. CMD 자체에는 자기 해시 검증이 없으므로 신뢰할 수 있는 배포 경로/별도 archive pin 없이 단독 실행을 승인할 수 없다. 파일 검증 후 Node 로딩까지는 OS 원자적 파일 핸들(CAS)이 없으므로, 동시에 파일을 교체할 수 있는 로컬 공격자가 있다면 완전한 TOCTOU 방어를 보장하지 못한다. CLI는 사용자 확인 직후 import 전 동일한 검증을 다시 실행한다.

**개발 상태:** 원본 Windows C 실운영 실행 **0회**, source-only CLI와 CMD·17-module lock. 실제 C급 완료율은 기존 **4/5 = 80%** 유지.
