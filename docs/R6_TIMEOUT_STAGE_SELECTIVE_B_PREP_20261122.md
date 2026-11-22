# R6 60초 timeout 단계 진단 — 3파일 Controller B 적용 준비

- 상태: **제안·검증 중. 정규 운영 적용 승인/설치/실행 영수증 아님**
- 현행 실PC 검증 설치 SHA: `042c45567d31c5ec620c9e13b154fc3f08218774` — [#2681](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2681), 후속 [#2687](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2687)
- 후보 단일 부모 SHA: `52e238aaffa9b80559930ef359d8095d5aa867e9` — [소스 PR #2691](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2691)
- 기존 `controller/inflation-census-m3-archived-headers-readonly.mjs` 및 W01 고정 읽기 연결 보존
- Controller 변경 3파일: `controller/employment-r6-collection-evidence-readonly.mjs`, `controller/engine.mjs`, `controller/operations.mjs`
- 소스 원본: [PR #2684](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2684) main 병합, 4개 source CI 완료
- 대상 영향: R6 read-only worker가 **자신의 타임아웃**으로 종료된 경우 제한된 마지막 진입 단계만 자체 workspace에 기록·조회. 원자료·DB/스키마·산식·Provider·D1·Task/Runner 설정·60초 한계 변경 없음
- 필수 정규 경로: 최신 설치 SHA·대상 파일 CAS readback → 고정 B 승인 증거·manifest/pin SHA256/회귀 CI → 독립 유지보수기 1회 적용, lease·백업·복구 계약 → JSON/TXT 및 사후 A급 readback
- 승인 근거가 없는 경우 이 계획·PR·도구 접근 권한을 사용해 B급 실행을 가장하거나 발행하지 않음
- 원본 장애: [#2645](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2645). 새 진단이 설치되고 다음 정상 승인 A에서 실제 마지막 단계가 확인되기 전에는 고용지표 성능 복구 완료 판정 금지
