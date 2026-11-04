# ER1 11월 인프라 누적 변경 보충 증거 — PR #313

> **상태: 개별 승인·공용 설치 담당 검토 대기.** 이 문서는 자체로 B급 Controller 설치 승인 manifest가 아니다.

## 목적

[ER1 증거 PR #311](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/311)에 기록된 누적 workflow 25개 이후, 다른 담당자의 별도 [물가지표 PR #313](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/313)이 병합되면서 추가된 1개 파일을 정확히 식별한다. ER1 업무의 승인된 **추가 11개** 범위를 무단으로 **12개**로 확대하지 않는다.

| 항목 | 확인된 사실 |
|---|---|
| PR #313 병합 commit | `b79b60484eef6159aef3a79883b008fb8706b5ab` |
| 목적 | PC 저장 19개 물가지표와 공개 API의 A급 읽기 전용 1회 비교 |
| 추가 경로 | `.github/workflows/pc-inflation19-public-diff-readonly-once.yml` |
| 이 파일의 SHA-256 | `5e5fad90f5dcf002e7be79ffd38ad15f79dbc22c71fb6dfdf0210d8be77642c3` |
| #311 workflow 근거 | 25개 |
| 이번 변경 후 workflow 총수 | 26개 |

[공용 승인 원장 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-6632469424)의 단일 적용 담당은 #313의 **별도 원업무 승인 근거**를 확인해 이 파일의 B 설치 포함 여부를 결정해야 한다. PR 병합이나 fixture 8/8 PASS만으로 새 인프라 운영 승인을 추정하지 않는다.

## 실제 설치 대상 재산정

- 최초 증거 설치 SHA: `14940aa112494b1cea09ff5c7250f4af86a4ce6a` (2026-11-04T13:13:56Z 실제 PC 과거 관측).
- 이전 #311 병합 SHA: `d06083e3da611e67396f749c2844cdec991f9f54`, Controller/config 8개 + workflow 26개.
- 그 이후 별도 R17 [PR #308](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/308)이 병합된 `e642891f1b63d0b2cd251207216f35008d539b2a`에서는 Controller/config **9개** + workflow **26개**로 변경됐다.
- 최신 `main`은 이후에도 이동할 수 있다. 이 수치를 고정 manifest로 사용하지 말고, 실제 설치 SHA와 **최종 target SHA**의 전체 `controller/`·`config/`·`.github/`·`scripts/` diff를 병합 승인·최종 바이트 해시에 연결한다.

## 실행 Gate

1. #313 독립 승인 근거와 #308 승인·변경 파일을 #68 단일 담당이 확인한다. 확인되지 않은 파일은 자동 포함 금지.
2. 검증된 누적 `infrastructureEvidence`와 원본 바이트 SHA-256 manifest를 최종 target 기준으로 완성한다. `postSourceSha`의 실제 유효성도 확인한다.
3. 독립 유지보수기 `pc-maintenance` 경로에서 실제 설치 SHA·lease·보호 검사를 적용해 한 번만 설치한다. 중복 요청·검사 완화 금지.
4. 설치 결과/6 Runner 재연결/고정 A 사후 진단을 확인한 다음 `market-calendar-er1-nov30-availability` 1회로 11월 PIT 적격 원자료를 확인한다.

이 보충 문서에는 Controller/config/workflow 실행 코드·Writer·Provider·DB·D1·Core·스케줄의 변경이 없다.
