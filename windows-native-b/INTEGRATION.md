# Windows 기존 설정형 테마 단일 예약 CMD 업그레이드: 범위 확정

상태: **SOURCE SHAPE CANDIDATE ONLY / NOT APPROVED / NO PC EFFECT**.

## 확인된 운영 소스 경로

`zgmini/scripts/pc-writer/theme-config-upgrade.mjs::upgradeConfiguredSchedule`는 다음만 바꾼다.

1. 기존 `INSTALL_RESULT.json`에 핀된 `versions/<OLD>` 전체 파일 해시·기존 `THEME_SCHEDULED.cmd` 바이트를 확인한다.
2. 기존 `THEME_SCHEDULED.vbs` 경로, `ZGMINI-PC-Configured-Themes` Task XML 및 13:00 예약을 검사한다.
3. 기존 `theme-config/state/scheduled.lock`, 개별 테마 `configured-cycle.lock` 부재를 확인한다.
4. `versions/<NEW>` immutable package를 별도 stage; 대상 파일 해시를 다시 읽는다.
5. 기존 예약 CMD와 `INSTALL_RESULT.json` 백업을 만든다.
6. **오직 `THEME_SCHEDULED.cmd` 하나**를 같은 디렉터리의 임시 파일 → rename으로 바꾼다.
7. CMD 및 Task XML 재조회; 실패 시 CMD 기존 바이트를 rename 복원한다.

반면 새 generic 108-file B 스키마는 여러 manual CMD 및 `ACTIVE_RUNTIME.json` 별도 CAS를 요구한다. 이 기능의 기존 예약 실행은 Active JSON을 읽지 않고 immutable version을 직접 호출하므로, 이는 기존 1파일 업그레이드보다 강한 atomicity 요구를 새로 도입한다.

## 재사용 권장 계약

- 기존 승인된 Controller/Receiver B는 허용 operation을 **`UPGRADE_CONFIGURED_SCHEDULE_PINNED_ONE_CMD`**로 고정한다. Issue 입력으로 CMD, Task, 대상 경로, 모듈 import를 선택하지 않는다.
- 공통 B 수신부가 `manifestSha`, 승인된 `sourceSha`, 기존/신규 version+파일 목록, exact Task XML SHA, exact old/new scheduled CMD bytes/sha, exact VBS bytes/sha, 원본 백업/rollback scope를 확인한다.
- `windows-native-b/scheduled-single-pointer-preflight.mjs`는 Windows의 고정 `schtasks.exe /Query ... /XML` 및 기존 VBS/CMD를 읽는 **조회-only 보조 기능**으로 통합 가능하다. 출력 `activationAllowed:false`를 변경하지 않는다.
- 이후 원본 `theme-config-upgrade.mjs`의 **검토된 단일 scheduled CMD stage + backup + CAS + rollback 구조**를 B native backend에서 기존 승인 조건으로만 재사용한다. 신규 B 스키마가 `ACTIVE_RUNTIME.json` CAS를 강제한다면, 먼저 정확한 1파일 효과를 표현하는 별도 고정 프로필/승인 계약이 필요하며 generic guard를 꺼서는 안 된다.
- 실제 Windows 테스트에서 scheduled tick 진입 직전·rename 중·직후 기존 CMD 또는 새 CMD가 혼합 라인을 실행하지 않는지, 두 버전이 같은 `theme-config/state/scheduled.lock`에 배타 접근하는지, old→new 및 new→old 저장 파일/체크포인트 조회 호환성이 있는지 각각 입증한다. 기존 Scheduler 작업을 임의 disable/modify하지 않는다.
- 확인된 Runner/Receiver 실행 원장, 해시, 요청 ID를 신뢰 경로에서 재조회한 뒤에만 `runtimeCompatibilityProven`이 참인 **별도 승인 증빙**을 만들 수 있다. 현재 `theme-generic-b/runtime-compatibility-evidence.mjs`은 `trustedRunnerProvenanceVerified:false`, `activationAllowed:false`로 source-only 제한 상태다.

## 현재 LAST PASS / FIRST FAIL

LAST PASS: 순수 byte profile 판정 7/7 로컬 테스트 PASS. 기존 원본은 단일 CMD 전환 경로로 확인됨.

FIRST FAIL: `B_NATIVE_TASK_TICK_COMPATIBILITY_PROOF_REQUIRED` — 승인된 Windows Runtime 중간 tick/old+new 동시 실행 호환성 원장 없음.

정기 13:00 실행의 성공 여부 확인은 실제 설치·수집·계산·D1·API·UI 검증 이후의 **추가 후속 작업**이다.
