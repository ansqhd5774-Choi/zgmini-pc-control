# #996 단회 C 복구 봉인본

현재 상태: **OWNER_CONSENT_MISSING / 운영 미실행**.
명세의 `approved: true`는 스키마 필드이며 그 자체가 실제 Owner 승인 증거가 아니다.

## 고정 실행물

- S1 source: `32f5e518ada323f2744d5d0854b7e5cafc736864`
- S2 manifest/package commit: `7516a8e8138707ef639cecfe81bb183495851c64`
- manifest SHA-256: `4a1e4ac62708d4e463d0df98bf1480f155ecc765798da5d4ee1ece86b3e8a030`
- SourceLock SHA-256: `28958530cccea9c220e309b6256f2152fc34c7a2c03660d71f0b2c74db24f847`
- ZIP SHA-256: `239c84e3ba91febf16f6030c517f988cfcb8416981240b6da6dd11f8277765d5`

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

Owner 댓글 확인 후 고정 S2와 정확한 실행물을 재조회하고 외부 launcher의
`ExecuteOperatorOnce`를 한 번만 사용한다. 결과 JSON/TXT는 C: TEMP에서 회수하며,
별도 독립 읽기로 원본/보관본·Controller·Workflow·Backlog·보호 상태를 대조한다.
오류나 결과 불명확이면 재실행하지 않는다.

공통 Runner 범위 유지보수기 후보와 4파일 Controller 설치는 별도 후속 업무다.
이번 C 승인으로 이를 자동 설치하지 않는다.
