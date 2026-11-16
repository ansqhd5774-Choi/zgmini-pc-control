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
