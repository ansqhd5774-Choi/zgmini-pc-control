# #4135 Public Native Writer B 최초 정책 설치

사용자 승인 #7238358611을 사용한다. 재승인·원본 #4135 재실행·Controller 재설치는 하지 않는다.
대상은 승인된 기존 4파일 설치, 예약 요청 `db6a4814-d8ea-5343-9539-cf797835c231` 한 건이다.
이 절차 자체는 공급자 호출·R2 계산·DB/D1 게시를 실행하지 않는다.

## 최초 설치와 이후 일반챗 역할

최초 설치는 두 호스트의 실제 독립 관리자 계정에서 한다. 일반 GitHub Runner가 자신의 신뢰 정책을
만들거나 ACL을 바꿔 스스로 실행 권한을 부여하지 않는다. 이미 설치된 정책과 전용 변수의 readback이
끝나면 일반챗은 준비된 source PR을 한 번 열어 기존 CI→Native Publisher→Writer Receiver 경로를 사용한다.
최초 정책 설치가 끝나지 않았으면 일반챗에 실행을 요청하지 않는다.

## 준비

1. 이 PR이 검증·병합된 main의 정확 바이트를 사용하는 Owner Codex에서
   `node tools/native-writer-b-policy-package.mjs prepare <새 source commit SHA> <새 TEMP 패키지 폴더>`를 실행한다.
   source commit은 원격에 존재하되 아직 PR CI가 시작되지 않은 전용 준비 브랜치다.
   `ci-approval/`의 해당 단회 실행 명세 변경으로 기존 source CI 트리거 범위를 사용한다.
2. 준비기는 Owner GitHub 인증·기존 승인 댓글·manifest 원문·현재 Writer HEAD/config/4파일 CAS·
   Controller source·예약 requestId 미사용을 확인한다. 결과는 scope.json, policy.json,
   INSTALL_ONCE.ps1, package.json이다. 정책과 원자료·키를 공개하지 않는다.
3. package.json의 scope/installer SHA를 실제 패키지와 대조한다. 양 호스트에 동일 패키지를 전달한다.
   Runner 계정 SID는 기존 서비스/Listener의 실제 SID를 사용한다. 다른 PC SID를 복사하지 않는다.

## 독립 Windows 실행

목적은 승인된 정책 파일의 최초 배치이며 Writer를 실행하지 않는다.
각 호스트의 시작 메뉴에서 Windows PowerShell을 관리자 권한으로 연다. 실행 정책이나 보안 제품은 변경하지 않는다.
`INSTALL_ONCE.ps1 -ScopeFile <scope.json 절대경로> -ScopeSha256 <package.json의 scopeSha256>
-RunnerSid <해당 호스트 Runner SID> -OutputFile <패키지 폴더\PC.json 또는 DESKTOP-N62L0NG.json> -Apply`를
호스트별 정확히 한 번 실행한다. 정상값은 `SCOPE_INSTALLED_VERIFIED`다.
기존 root·원장·출력·ACL 불일치, STOPPED 또는 무응답이면 재실행하지 않고 코드를 회수한다.
프로세스 종료·Task 변경·Claim/Lease 삭제·파일 출처 표시 제거·ExecutionPolicy 변경은 하지 않는다.

설치기는 기존 정책을 덮어쓰지 않는다. 새 scope root는 관리자/SYSTEM 쓰기, 실제 Runner 읽기만 허용한다.
격리 호스트에는 별도 durable receipt root를 생성해 해당 Runner의 기록만 허용한다.
실패/중단된 staging은 자동 삭제하거나 성공으로 바꾸지 않는다. source/config/원자료는 변경하지 않는다.

## 두 호스트 증명과 활성화

1. 양 호스트의 실제 JSON을 Owner 패키지 폴더에 회수한다.
   `node tools/native-writer-b-policy-package.mjs finalize <패키지 폴더>`는 두 호스트의 관측을 대조해
   정책 전용 영수증을 create-only로 공개하고 정확 원격 바이트를 재조회한다. Controller 설치 영수증을 위조하거나 재사용하지 않는다.
2. 생성한 proof.json을 양 호스트에 전달한다. 위 설치 명령에 `-ProofFile <proof.json>`을 추가하고,
   OutputFile은 `PC.final.json` 또는 `DESKTOP-N62L0NG.final.json`으로 바꿔 호스트별 한 번 실행한다.
   정상값은 `POLICY_PROOF_INSTALLED_VERIFIED`다. 각 호스트는 GitHub 원격 영수증과 자신의 보호된 실제 관측 원문까지 대조한다.
3. 두 final JSON을 회수한 후 `node tools/native-writer-b-policy-package.mjs activate <패키지 폴더>`를 실행한다.
   실제 운영 scope/proof 및 원격 영수증 검증 후에만 Writer B 전용 변수 3개와 두 root 변수만 설정·재조회한다.
   이 단계도 예약 요청을 발행하지 않는다. API 결과 불명은 activation intent를 보존하고 재호출하지 않는다.

## 일반챗 시험 및 완료 기준

일반챗에는 정확 source 브랜치/commit과 예약 ID를 전달한다. 준비된 source PR을 정확히 한 번 열고
첫 CI completion이 Publisher에 전달되는지 확인한다. 이미 완료된 CI 재사용·원본 ID 재실행·다른 source PR 생성은 하지 않는다.
현재 동작하는 Receiver의 CAS/lease/백업/복원·자연 유휴 조건은 유지한다.

정책 준비/두 호스트 설치/변수 활성화/실제 Writer 설치는 서로 다른 결과다.
`POLICY_AND_VARIABLES_READY_NOT_EXECUTED`는 일반챗 시험 준비 완료이며 Writer 설치 완료가 아니다.
실제 설치 결과·4파일 SHA·Task 복원·원격 영수증까지 확인해야 #4135 설치 완료다.
R2 실제 계산·게시에는 별도의 기존 유효 업무 승인과 실행 결과가 필요하며 이 최초 설치 승인으로 확대하지 않는다.

## #4135 기존 미활성 scope의 단회 교정 전환 (#4387)

이 절차는 이미 두 호스트에 설치된 최초 scope를 재설치하는 절차가 아니다.
기존 scope의 정확 SHA256 `df097365ebc641a551f6e0b233ad333662f4ae12b82a2180cfb97637656f5736`,
policy SHA256 `03460ff9cc6effa88162bc4369f248a055f2346d9997a2535ee9bba9cbf44828`,
control SHA `b2dead3c87f88b35f1a05de77d72f33e3a618a10`,
준비 source SHA `55e40e183d5d85fa4897e6449f3c8a13161f9adf`를 보존한다.
최초 배치 원본과 관측은 보호된 backup으로 유지한다. 다른 정책/요청에 재사용하지 않는다.

- **병합 후 Owner 준비:** 정확 병합 source 및 기존 승인 원본 확인 후
  `node tools/native-writer-b-policy-package.mjs prepare-transition 55e40e183d5d85fa4897e6449f3c8a13161f9adf <새 TEMP 절대경로>`.
  기존 운영 PC scope bytes 및 고정 preimage hash, Writer 기존 4파일 CAS, 예약 claim 부재,
  비활성 변수, source CI 미시작을 확인한다. 바뀌는 값은 실행 control/adapter/receiver pin 및 명시된 checkout mode뿐.
- 양쪽 독립 관리자에게 새 sealed package를 전달한다. 기존 최초 설치 명령에
  `-TransitionFromScopeSha256 <package.json migration.beforeScopeSha256>`만 추가한다.
  각 호스트 한 번, 기존 원본 두 파일 및 정확 ACL/관측/claim 부재/backup 경로 확인 후에만 보호된 stage를 교체한다.
  기존 영수증 root는 그대로 검증·재사용한다. `SCOPE_INSTALLED_VERIFIED` 및
  `previousScopeSha256`, `backupVerified=true`를 회수한다. STOPPED/UNKNOWN이면 재실행·삭제 금지.
  새 scope와 관측은 교체 전에 함께 작성·검증한다. 첫 rename 전 보호된 intent를 기록한다. 교체 후 검증 또는 결과 저장 실패도 복구 대상이다. 새 root가 존재하면 정확한 새 scope/관측 및 ACL을 확인한 경우에만 별도 failed 경로로 보존하고, 기존 backup의 원본 정책·관측·ACL을 확인한 후 원복한다. 불일치/불명 또는 프로세스 강제 중단 시 intent와 기존 backup을 이용해 독립 관리자 readback으로 상태를 구분하며 자동 재실행·삭제하지 않는다.
- 두 호스트 새 scope/원본 backup 검증 결과를 회수한 뒤 기존 finalize/proof/activate를 수행한다.
  finalize 및 activate는 현재 main ancestry, 정확 receiver workflow blob과 승인 runtime adapter,
  준비 source의 CI 미시작을 다시 확인한다. 기존 source HEAD와 단회 요청 ID는 변경하지 않는다.
  이전 패키지/결과를 사용해 새 proof를 만들지 않는다.
- 실제 Windows 관리자 transition/backup/ACL readback 전에는 완료로 표시하지 않는다.
  일반챗은 `POLICY_AND_VARIABLES_READY_NOT_EXECUTED`가 확인될 때만 기존 준비 PR을 한 번 연다.
