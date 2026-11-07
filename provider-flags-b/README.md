# 공통 Provider Flags B — 단회 설정 변경

공통 Writer source B는 `.mjs` 소스 오버레이만 지원한다. 운영 `providers.env` 설정을 소스 설치 B나 일반 `pc-job` A급으로 바꾸지 않는다.

이 경로는 사용자 승인을 받은 물가지표 19개 활성화 플래그 두 개만 `1`로 설정한다. 승인 범위 밖의 모든 항목, API 키, source, DB, Scheduler, D1, Controller는 변경할 수 없다.

- 대상: `E:\ZGmini\data\pc-writer\providers.env` 정확히 1파일
- 고정 값: `ZGMINI_INFL19_RECURRING_APPROVED=1`, `ZGMINI_INFL19_GAS_DAILY_APPROVED=1`
- 수신: private repo의 원소유자 `pc-writer-provider-flags-once` Issue, 기존 공통 B의 `pc-writer-b-install` label 재사용, `opened` 한 번만
- 승인: `approvals/writer-config/inflation19-flags-<id>.json` 원문 SHA256이 요청과 일치해야 함 (Windows checkout의 LF→CRLF 변환과 구별하기 위해 고정 Git `HEAD:path` 원본 blob 바이트로 계산; 워크트리에는 Git 줄바꿈 변환만 허용)
- 실행: 자체 Windows Runner의 고정 `.github/workflows/pc-writer-provider-flags-once.yml`
- 보호: Writer source B 공유 잠금, 기존 요청 ID 단회 claim, 원본 바이트 비공개 백업·fsync, 최종 CAS, 원자적 파일 교체, 실파일 재조회·복구 확인
- 회수: `results/provider-flags-b-<requestId>.json/.txt` 2/2 동일바이트 재조회 및 고유 Issue 댓글
- 실패·결과 불명: 기존 고유 ID를 조회한다. 단회 Issue·requestId를 재사용하거나 다른 명령으로 우회하지 않는다.

이 설정 B의 성공은 **설정 파일의 두 값만 확인**하는 증거다. 실제 수집→로컬 저장→계산→D1→API/UI 활성화 여부는 물가지표 원담당이 계속 확인한다. 기존 Writer source B #692/#711은 재실행하지 않는다.
