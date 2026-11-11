ZGMINI #996 Windows CNG 테스트 전용 안내

목적: 단일 WinPE 복구 설계의 RSA-PSS/SHA-256 서명 검증을
공통 대기열 PC의 일반 Windows x64 환경에서만 시험합니다.

허용 범위
1. 공통 대기열 PC(DESKTOP-N62L0NG)에서만 실행합니다.
2. 기존 ZGMINI PC에서는 절대 실행하지 않습니다.
3. Visual Studio Community 2026 및 Windows SDK가 필요합니다.
4. tools\RUN_996_CNG_TEMP_CRYPTO_ONCE.cmd를 한 번 실행합니다.
5. 컴파일된 EXE, 빌드 로그, 시험 결과는 사용자 C: TEMP의
   신규 zgmini-996-cng-test-* 폴더에만 생성됩니다.

성공 메시지:
C996_CNG_WINDOWS_TEMP_CRYPTO_PASS_NOT_OWNER_OR_WINPE_PROOF

STOP/실패 시 재시도·자동 정리 없이 창과 C: TEMP 증거를 보존합니다.
기존 E:\ZGmini 원본, Controller Claim/Lease, 기존 작업 Issue,
GitHub Workflow/Backlog, 실제 Runner 구성은 변경하지 않습니다.

포함된 서명은 임시 시험 키로 만들었으며 개인키는 포함하지 않습니다.
PASS는 Windows CNG 암호 검증에 한정합니다. 실제 Owner의 서명,
신뢰 공개키, WinPE 호환성, C급 복구/설치 승인을 의미하지 않습니다.
