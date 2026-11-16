# HTTP 32 마지막 Census CDN 단회 PC 검증 — 2026-11-17

## 목표
운영 PC에서 `cdn.www.census.gov`의 공식 BFS CSV 고정 URL에 GET 정확히 1회 실행해 실제 HTTP 응답 상태를 검증한다. 차트 원자료 전체 다운로드, 저장, D1/Cloudflare 로그인, 비정기 재수집, 신규 예약을 실행하지 않는다.

## 현재 확인된 근거
- 운영 PC 연결/실패: #1781 / Run 43893942654, HTTP 31/32, 실패 0, Census CDN 1건 미확인
- 외부 Cloud browser: CSV HTTP 200, Content-Type text/csv, Last-Modified 2026-11-12T15:00:32Z. PC 직접 증거는 아님
- 현재 사이트 API 14/14, HTTP 31/32. 이력 CDN이 비정기라 36시간 호출 없음은 단독 장애 증거가 아님

## 최소 실행
1. 운영 PC용 일회성 고정 Census GET 코드/승인자 단일 Issue 워크플로 작성
2. 격리 Windows Runner에서 유닛 테스트(이슈 위조 차단, 정확한 URL 1회, HTTP/CSV 검증, 실패·무재시도)
3. 성공한 PR/정확한 커밋을 main에 병합
4. 승인자 소유 단일 Issue 1회 접수 후 실제 Windows self-hosted Runner 결과 확인
5. 성공 HTTP 200은 **진단 시점의 해당 PC 연결 성공**으로만 해석. 기존 rolling 14일 host log가 변경되지 않았으면 홈페이지의 HTTP 31/32는 별도로 유지

## 금지
- PC Controller 설치/수집기/Task/Runner 설정 수정
- 운영 DB/SQLite/D1/원자료/기존 HTTP 이벤트 로그 수정
- 리다이렉션/호스트 변경/무한 재시도/사용자 입력 URL
- Cloudflare 대시보드 인증이나 D1 전체 검사
- 실제 연결 증거 이전에 임의 32/32로 표시

## 진행 기록
- 코드: `tools/http32-census-cdn-once.mjs`
- 테스트: `tests/http32-census-cdn-once.test.mjs`
- 실행 워크플로: `.github/workflows/pc-census-cdn-connectivity-once.yml`
- 상태: 소스 준비, CI/병합/운영 Issue/실제 HTTP 응답 아직 확인 전

## 실제 운영 실행 결과 — 2026-11-17 01:07 KST
- 승인자 소유 Issue: https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1797
- Windows PC Run: https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/43903908465
- 운영 로그 검증: `HTTP32_CENSUS_CDN_ONCE` → `status=PASS`, `code=HTTP_200_CSV_FROM_OPERATING_PC`, `httpStatus=200`, `contentType=CSV`, `observedAt=2026-11-16T16:07:56.551Z`.
- 헤더 `Last-Modified=2026-11-12T15:00:01Z`, `providerCalls=1`, `automaticRetries=0`, `operationalWrites=d1Writes=0`, `collectorRun=false`, `scheduleChanged=false`.
- **검증 결론:** 운영 PC에서 Census CDN 직접 연결 성공. 이전 HTTP 31/32의 마지막 미확인은 최근 호출 부재(월간 자료)로 인한 감시 판정임을 분리했다.
- **다음 최소 수정:** 14일 관측 대상에 포함된 공식 월간 BFS CDN만 36시간 일간 검사에서 제외해 마지막 2xx 실측이 있으면 정상, 실제 503·네트워크 오류는 실패로 분류. 현재 수집기/Task/HTTP 로그/DB는 변경하지 않음.
- 새로운 배포의 HTTP 32/32는 운영 PC/사이트에서 원장 재조회 후에만 확정.
