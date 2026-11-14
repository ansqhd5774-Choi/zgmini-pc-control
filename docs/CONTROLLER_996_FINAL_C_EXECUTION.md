# #996 단회 C 복구 봉인본

현재 상태: **INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED / 실제 Windows 복구 및 독립 재조회 완료**.
명세의 `approved: true`는 스키마 필드이며 그 자체가 실제 Owner 승인 증거가 아니다.

2026-11-14 16:58:33 UTC, 실제 Owner 댓글
[#6881040211](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/996#issuecomment-6881040211)을
재조회한 뒤 아래 S2로 단회 실행했다. 원본 C Claim·신규 continuation Claim·원본
Install Lease의 세 보관을 완료했고 강제 해제·삭제·재시도는 하지 않았다.
17:01 UTC 독립 재조회에서 설치 잠금 `held=false`, watchdog `HEALTHY`, 유지보수
receiver `LISTENING`, Runner 6개 Online을 확인했다. Workflow는 active이고 Backlog는
기존 닫힌 상태 그대로다. 기존 Controller `badad912…`와 보호 상태는 유지됐다.

실행/독립 재조회/제어면 상태/이동 전 ID·ACL 증거는
`artifacts/runner-recovery/996-native-c-operation-20261115.json`,
`996-independent-postread-20261115.json`, `996-control-plane-postread-20261115.json`,
`996-before-archive-identities-20261115.json`에 보존한다.
독립 재조회 기록의 `operationalWrites=0`은 **사후 읽기 자체**의 효과다. 실제 C
실행에서는 승인된 reservation/marker 생성과 보관을 수행했다.

## 고정 실행물

- S1 source: `e1731720ebea0921c51e7cc2470e0b15312271cc`
- S2 manifest/package commit: `94cb242c6603ce02ae9826ce62a8ae81ef20c0c0`
- manifest SHA-256: `90cb0e789437da8417cf068bbaa1defdd2b2a61e3220d38581f0a5441009b2be`
- SourceLock SHA-256: `0805ceadc928333bad3f3c993008c7793226cea277ba26c057078c6b9d194739`
- ZIP SHA-256: `55144dc25f5fbad757f07966af5015f09e485d702611fcdf032fab207dcd047d`

ZIP은 새 S1에서 다시 생성했다. 독립 두 번 생성한 ZIP/SourceLock이 같으며,
압축 해제한 21개 항목의 원본 해시와 S2 원격 3파일의 원문 바이트를 대조했다.
이전 검토 ZIP을 재사용하지 않았다. PR #1222는 Draft로 유지하며 병합하지 않는다.

## 실행 경계

1. 외부에서 고정 source/Node/launcher/helper 바이트를 검증한다.
2. Windows 원본 핸들을 보유한 채 Bootstrap과 Operator를 실행한다.
3. Operator의 실행 모드는 고정된 실제 Bootstrap 구현만 허용한다. 호출자가 만든
   receipt, 잠금 해시, 합성 verifier로 실행 권한을 만들 수 없다.
4. 검증한 메모리 바이트로만 동적 모듈을 로드한다. 정확한 새 Owner 댓글을 다시
   읽고, 최초 쓰기 직전 원본 10파일·84 source bytes·보호 상태를 대조한다.
5. fixed reservation과 continuation을 보존하고, 기존 C Claim→continuation→
   Install Lease 순서로 보관한다. 마지막 보관 직전 Owner 철회/변조를 재조회한다.
6. 각 이동의 TxF 내부 pin/ID/ACL 검증과 사후 재조회가 일치해야 한다.
   중간 실패·불명확 결과는 `STATE_UNKNOWN_PRESERVE_ALL_C_CLAIMS`로 보존한다.
   삭제·강제 해제·원본 요청 재시도·자동 cleanup을 하지 않는다.

성공 시 `INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED`만 최종 상태로 인정한다.
기존 Controller `badad9124157879d7a645b64f2768113d632355b`를 유지하며, 원본 실패
설치를 성공으로 바꾸지 않는다. Workflow/Backlog 쓰기·Issue POST·원본 요청 재실행은 0이다.
이미 닫힌 Backlog를 다시 닫거나 Workflow를 다시 활성화하지 않는다.

## 검증과 승인 등록

직전 S2 `7516a8e…`는 실제 Owner 댓글 `6880843117` 확인 후 한 번 호출했으나
`BLOCKED_BEFORE_C_WRITE / C_996_OWNER_STATE_UNKNOWN / NO_WRITE`로 중단됐다.
읽기 전용 재현에서 원인은 `C_996_ORIGINAL_JOBS_STATUS_OR_ORIGIN_DRIFT`였다.
이전 구현이 #1217 댓글 0개·#1227 댓글 1개를 고정했으나, 실제로는 정상 인수인계
댓글이 각각 2개였다. 원본 요청의 identity/source 검사는 유지하면서 댓글의 전체
목록·ID·본문 hash를 두 번 관측하도록 수정했다. 댓글을 실행 승인·완료 증거로
사용하지 않으며 원본 요청 재실행은 0건이다. 이후 오류 코드도 숨기지 않는다.

수정 관련 검사 20건 PASS. 새 ZIP의 실제 읽기 전용 검사에서 전체 Git/로컬 source,
4개 원본 Issue, 원본 PC prewrite를 모두 확인했다. 원본 10개 pin과 84개 source는
직전 관측과 같고, Claim·Install Lease·Workflow·Backlog는 변경되지 않았다.
수정본에는 새 continuation ID를 사용하며 직전 실행물은 재사용하지 않는다.

변경 후 Windows 네이티브/경합/순서/실행 경계 시험 24건 PASS, Windows 외부 source
snapshot/handoff 4건 PASS, 별도 Operator 계약 4건 PASS. 기존 Bootstrap/Owner
검사 32건의 통과 결과도 재사용한다. 실행 경계 시험의 최초 정적 검사 1건은
실제 optional-chain 구문과 다른 regex 때문에 실패했고 regex를 바로잡아 통과했다.
보안 조건이나 기대값을 낮추지 않았다.

원본 PC 읽기에서 기존 10개 pin과 84개 source가 그대로임을 확인했다. 실제 봉인본
Bootstrap은 `C_996_BOOTSTRAP_OWNER_CONSENT_MISSING`으로 종료했고 운영 쓰기는 0이다.

Owner는 생성된 승인 원문의 전체 내용을 #996의 **새 댓글에 한 번** 게시한다.
코드블록·접두 설명·필드 수정·기존 댓글 편집을 하지 않는다. 채팅의 '게시 완료'
응답이나 이 문서는 실제 GitHub 댓글을 대체하지 않는다. 담당 에이전트가 Owner
동의를 대신 생성해서는 안 된다. 원문 댓글을 실제로 검증하기 전에는 실행하지 않는다.

이번 S2의 `ExecuteOperatorOnce` 실행과 결과 JSON/TXT 회수는 완료됐다.
별도 독립 읽기로 원본/보관본·파일 ID·directory ACL·Controller·Workflow·Backlog·
보호 상태를 대조했다. 완료된 C 실행물을 다시 실행하지 않는다.
고정 reservation은 계약대로 보존하며 임의 해제·삭제하지 않는다.

공통 Runner 범위 유지보수기 후보와 4파일 Controller 설치는 별도 후속 업무다.
이번 C 승인으로 이를 자동 설치하지 않는다.
