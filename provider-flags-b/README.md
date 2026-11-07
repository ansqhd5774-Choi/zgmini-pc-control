# 공통 Provider Flags B — 단회 설정 변경

공통 Writer source B는 `.mjs` 소스 오버레이만 지원한다. 운영 `providers.env` 설정을 소스 설치 B나 일반 `pc-job` A급으로 바꾸지 않는다.

기존 프로필은 사용자 승인을 받은 물가지표 19개의 두 활성화 플래그만 `1`로 설정한다. 신규 후보는 아래의 **별도 정확한 프로필**만 허용한다. 두 프로필 모두 승인 범위 밖의 항목, API 키, source, DB, Scheduler, D1, Controller를 변경할 수 없다.

- 대상: `E:\ZGmini\data\pc-writer\providers.env` 정확히 1파일
- 고정 값: `ZGMINI_INFL19_RECURRING_APPROVED=1`, `ZGMINI_INFL19_GAS_DAILY_APPROVED=1`
- 수신: private repo의 원소유자 `pc-writer-provider-flags-once` Issue, 기존 공통 B의 `pc-writer-b-install` label 재사용, `opened` 한 번만
- 승인: 기존은 `approvals/writer-config/inflation19-flags-<id>.json`, 신규 후보는 하단에 명시된 별도 경로. 어느 경우나 승인 JSON 원문 SHA256이 요청과 일치해야 함 (Windows checkout의 LF→CRLF 변환과 구별하기 위해 고정 Git `HEAD:path` 원본 blob 바이트로 계산; 워크트리에는 Git 줄바꿈 변환만 허용)
- 실행: 자체 Windows Runner의 고정 `.github/workflows/pc-writer-provider-flags-once.yml`
- 보호: Writer source B 공유 잠금, 기존 요청 ID 단회 claim, 원본 `providers.env`와 동일한 상위 폴더의 고유 이름·동일 ACL 비공개 백업·fsync, 최종 CAS, 원자적 파일 교체, 실파일 재조회·복구 확인 (백업 `fsync`는 Windows `FlushFileBuffers`의 요구에 맞는 쓰기 가능 핸들로만 호출; 권한 범위 확대·원본 파일 내용 수정 없음)
- 회수: `results/provider-flags-b-<requestId>.json/.txt` 2/2 동일바이트 재조회 및 고유 Issue 댓글
- 실패·결과 불명: 기존 고유 ID를 조회한다. 단회 Issue·requestId를 재사용하거나 다른 명령으로 우회하지 않는다.

이 설정 B의 성공은 **설정 파일의 두 값만 확인**하는 증거다. 실제 수집→로컬 저장→계산→D1→API/UI 활성화 여부는 물가지표 원담당이 계속 확인한다. 기존 Writer source B #692/#711은 재실행하지 않는다.

## 신규 물가지표 후보 — 별도 승인 범위 (추가 프로필 제안)

- 원래 11개 후보 중 소스 구현된 7개는 기존 19개 플래그와 **별개**로 `ZGMINI_INFLATION_CANDIDATE_CORE_APPROVED=1`, `ZGMINI_INFLATION_CANDIDATE_BOOTSTRAP_APPROVED=1` 두 키만 설정한다.
- 승인 명세 경로는 `approvals/writer-config/inflation-candidate-flags-<고유 ID>.json`, scope는 `INFLATION_CANDIDATES_EXACT_TWO_PROVIDER_FLAGS_ONLY`로 고정한다. 기존 `inflation19-flags-*`와 혼합하거나 임의 키를 추가할 수 없다.
- 동일한 기존 B workflow·공유 설치 lock·원본 파일 백업/ACL/최종 CAS/재조회·결과 2/2를 재사용한다. **Writer source B 설치 검증이 먼저**이며, 이 설정 변경은 새 예약 생성·원자료 수집 성공·D1 게시 성공이 아니다.
- 신규 키로 활성화되면 Core adapter가 해당 공급자 호출을 시도할 수 있으므로, 공식 출처·할당량·관측일·원자료 보호가 승인된 모듈 상태인지 확인한 후 정확한 단회 manifest로 실행한다. EIA/재무부 bootstrap은 이 플래그로 1회 허용되며 별도 정기 갱신 트리거는 후속 구현 사항이다.
