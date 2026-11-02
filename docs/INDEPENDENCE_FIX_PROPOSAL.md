# 독립 유지보수기 검증 보완 — 격리 후보 (실PC 미적용)

## 현재 상태/전제

- 로컬 작업자 보고: `c2458c73e129358813e9099a3eb8e5e77a82d87d` 유지보수기 설치 및 프로세스 실행 확인. 현재 프로세스를 종료하거나 재설치하지 않는다.
- 기존 `maintenance-ancestry.vbs`는 updater에서 부모 체인을 최상위까지 조회. 설치 Startup WScript는 `Run(...,0,False)` 직후 종료하므로 WMI에서 부모가 사라질 수 있다. `ParentProcessId` 재사용 가능성도 있어 UNKNOWN을 PASS로 바꾸면 안 된다.
- 이 보완은 **격리 Linux Node 모의검사 PASS**이며 Windows WMI·실PC 적용 PASS가 아니다.

## 변경 설계

1. Startup WScript가 `Run(...,0,True)`로 유지보수기 생애 동안 살아 있게 한다. `bootstrap-maintenance.mjs`는 Explorer에 고정 Startup 파일 실행을 요청한다. 짧게 실행되는 bootstrap Node를 WScript의 부모로 남기지 않는다. 2026-11-03 Windows에서 임시 진단 VBS를 Explorer로 시작해 실제 WScript→Explorer 부모 관계와 생성 시각을 확인했다.
2. `maintenance-agent.mjs`가 시작 직후의 살아 있는 WScript 부모·승인 Startup 경로, 동일 사용자 SID/session, 같은 사용자 Explorer 조상, PID 생성 순서를 읽기 전용 WMI로 확인한다. 성공 시 현재 receiver lease의 정확한 PID·nonce·boot, receiver 생성 시각·SID·session과 Startup 파일 해시를 원장에 기록한다. 실패 시 proof를 기록하지 않는다.
3. `update.mjs`는 manifest의 승인 6파일 해시, Startup 파일 해시, receiver lease·proof 동등성 확인 후, `maintenance-ancestry.vbs VERIFY`로 updater에서 현재 살아 있는 receiver까지만 부모를 추적한다. 각 부모 생성 시각이 자식보다 늦으면 UNKNOWN, supervisor 발견은 DESCENDANT, WMI 결측·잘못된 출처는 UNKNOWN이다.
4. 업데이트 진입 때와 실제 supervisor 종료 직전에 같은 검증을 반복한다. 승인 origin이 없는 기존 `c245` 프로세스에서는 **여전히 UNKNOWN으로 STOP**한다.

## 테스트 및 남은 검증

- `node --test tests/maintenance-{contract,apply,agent,lock,independence}.test.mjs`: 5개 suite PASS(기존 4, 신규 1). 신규 suite는 Origin proof 정상/부재·Startup 변조·lease PID 불일치, 종료 부모·PID 재사용·Runner 종속·순환·WMI 누락 상태 모델을 검증한다.
- **미검증:** Windows VBScript 실행/COM 반환형·Explorer 조상 실제 형태, 실PC 실제 생성 시각/SID, 로그인 재기동, 6개 Runner 재연결, Controller B 갱신, 후속 Fear & Greed 진단.
- 보안 조건: same-user writable 원장만으로 제3자 악성 프로세스에 대한 암호학적 기원 증명을 제공하지 않는다. 현 계약은 로컬 동일 사용자/승인 고정 코드 신뢰 경계다. WMI 결측은 계속 STOP.
- 현재 설치된 유지보수기는 신규 출처 증거를 만들 수 없고, 자신을 갱신하는 updater의 기존 검사도 UNKNOWN일 수 있으므로 **GitHub Issue만으로 첫 수정 버전을 설치했다고 주장할 수 없다.** 새 B급 실행 파일·startup 수정·manifest 해시·백업/복구 승인과 로컬 담당자의 정확한 단회 *in-place* 전환 절차가 필요하다(재설치 아님). 수동 파일 덮어쓰기·lock 삭제·기존 6 Runner 중지는 이 후보가 수행하지 않는다.

## 종료된 기존 수신기 인계

현재 PC에서 과거 receiver PID 42436은 ESRCH로 종료가 확인됐다. `tools/handoff-maintenance.mjs`는 이 상태에서만 승인된 정확한 SHA/파일 해시와 기존 설치 해시를 확인하고 유지보수기 6파일·manifest·Startup의 바이트 백업 후 in-place 전환한다. 살아 있거나 PID가 불명확하면 중단한다. 기존 잠금·원장·Runner는 삭제/종료하지 않는다. 새 실행의 Windows origin proof를 확인해야 PASS다. 실패 시 새 receiver가 종료된 것이 확인된 경우에만 검산한 백업을 복구하고, 살아 있으면 RECOVERY_REQUIRED로 보존한다.

같은 CreationDate는 그 자체로 PID 재사용 증거가 아니므로 무조건 `>=`로 차단하지 않는다. 살아 있는 고정 WScript, 동일 SID/session, 정확한 receiver 생성 시각·lease nonce·source/Startup 해시를 함께 검증한다.
