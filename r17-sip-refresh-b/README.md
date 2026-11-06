# R17 SIP 장전 1파일 source refresh — B급 Draft

목적: 공개 `zgmini`의 승인된 2026-11-07 R17 장전 SIP 명부 조회 수정만 실제 PC Writer에 설치한다.
정규장 IEX 수집기·장전 계산 라이브러리·기존 DB 및 결과 파일·예약·D1·공개 URL은 변경하지 않는다.

## 고정 소스
- PC 현재 설치 source: `cf43e65bbf72f56b70a52bc5a650a0cb5682b6bc` (#534 Windows 설치).
- 공개 소스: `d913514d919c1e499b7af9bc86d17ca07da18094` (PR #999).
- 단일 변경: `scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs`
  - 이전 SHA-256: `4be51a9d8162a6bc90528965fd263f52371675fabb64df1ac7ae7c18948e4e59`
  - 새 SHA-256: `bf0d4858679295a19c0a35c2a704899d28cbef9e7874efe38d0f71a337b3a959`
  - Git blob: `7ee9783744d45c3e5c2f88dc06f7e5c9687d7be3`
- 보호 해시: 정규 IEX 파일 `acaf0e46...`, SIP 계산 라이브러리 `a14cbad4...` (manifest 원문 참조).

## 실행 범위와 제약
1. 승인된 단회 GitHub Issue `pc-r17-sip-refresh-onefile-install` + JSON schema
   `ZGMINI_R17_SIP_REFRESH_B_INSTALL_REQUEST_V1` + label `pc-r17-writer-b-install`.
   고유 UUID와 manifest 원문 해시, 정확한 source SHA를 검증한다.
2. 설치 전 실제 PC Source HEAD/config.source, 대상 1파일 원본 해시,
   보호 2파일 해시, 대상 및 보호 경로의 dirty 상태를 확인한다.
   차이가 나면 설치 전 중단한다. 임의 자동 복구/재시작 없음.
3. 기존 `r17-writer-b` 공유 Writer 설치 lock/원장,
   검증된 정확 파일 Git overlay, 기존 Task 상태 검사를 재사용한다.
   Core를 일시 정지→drain→유일한 1파일 overlay commit 적용→
   config.source 갱신→Core 원상태 복원→source/config/task 재조회한다.
4. 원본 Source·설정·Core XML과 파일 바이트는 별도 백업한다.
   부분 실패 시 검증된 원본으로 복원한다. 상태 불명확하면 보호 lock 유지,
   새 Issue 재실행 금지.
5. GitHub private 결과 TXT/JSON 및 Issue 댓글만 업로드한다.
   인증키·종목 데이터·원시 시세·민감 원문을 로그에 넣지 않는다.
6. 설치 자체는 공급자 API 호출·DB/D1 게시·예약 변경·수집/계산 실행을 하지 않는다.
   실제 장전 수집·저장 및 공개 권한 검증은 별도 실증이다.

**상태:** source-only Draft, 로컬 fixture test 통과. PC 실설치 미실행.
**검증:** `node --test r17-sip-refresh-b/*.test.mjs`.
**주의:** 과거 #534(3파일) 재실행 금지. 신규 Issue는 독립 검토·명세 승인 확인 후 딱 한 번 생성한다.
