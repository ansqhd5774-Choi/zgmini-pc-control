# ZGMINI 성공 실행물·증거 재사용 기준 R1

2026-11-08 · 공통 프로세스 지식 자산. 정본은 최신 `main`의 `AGENTS.md` 및 `docs/PC_AUTOMATION_STANDARD.md`다.

## 1. 목적과 적용 단위

- 이미 성공한 **승인 manifest → 실제 Windows 실행 ID → 결과 JSON/TXT → 검증된 효과**를 연결하여 다음 담당자가 공통 구조를 재사용하게 한다. 성공 문구만 복사하거나 기능별 설치기·예약·Controller를 새로 만드는 것이 목적이 아니다.
- 작업 시작 시 **현재 목표에 직접 관련된 성공 사례 1건과 알려진 실패 사례만** 필요한 경우 조회한다. 이 조회는 새 Gate나 전체 사례 열람 의무가 아니다. 곧바로 현재 업무의 다음 승인 실행으로 진행한다.
- 원래 실행기에서 생성한 `approvals/`, `results/`, 고유 Issue/Run, 테스트 Fixture와 source 커밋을 우선 활용한다. 같은 증거를 재업로드하거나 이 문서에 결과 원문을 복제하지 않는다.
- GitHub 파일 저장은 미래 담당자의 명시적 조회·재사용을 돕는 **버전 관리**이지, GPT 모델·다른 대화·운영 PC를 자동 갱신하는 행위가 아니다.

## 2. 성공 증거의 기본 연결 계약

| 항목 | 남길 근거 | 판정상 주의 |
| --- | --- | --- |
| 작업 범위 | 기능/공통 operation, 승인 목적, 정확한 대상 | 무관한 업무로 승인 범위를 확대하지 않음 |
| 승인 원본 | manifest 경로·원본 SHA-256·승인 source | 이전 manifest를 새 작업 승인으로 복사하지 않음 |
| 실제 실행 | 고유 Issue/requestId/Run ID, 실행 시각·실제 PC source | 개발 HEAD와 PC 실행 SHA를 구분 |
| 결과 파일 | 원래 결과 `results/*.json`·`*.txt` 경로와 원격 재조회 | JSON/TXT 2/2와 동일 요청·source 검증 |
| 검증된 효과 | 파일 전후 해시, 백업/복구 결과, 해당 단계 PASS | 시험 PASS·PC 설치 PASS·D1·API/UI를 분리 |
| 미검증 범위 | STATE_UNKNOWN/BLOCKED/DEFERRED·후속 담당 | 검증하지 않은 다음 단계를 DONE으로 표시하지 않음 |

새로운 재사용 가능한 **공통 패턴**이 처음 검증되면 위 여섯 항목의 기존 원본 링크를 이 문서 또는 해당 담당 runbook에 **한 번** 색인한다. 기존 결과 기록이 완전하면 작업마다 새 보고서를 만들 필요가 없다. 외부 쓰기 실패와 결과 전달 실패는 별도로 기록한다.

## 3. 실제 성공 사례 색인

| 유형과 단계 | 승인·실제 결과 파일 | Windows 원본 | 재사용할 것 / 유효 범위 |
| --- | --- | --- | --- |
| Writer 운영 파일 설치, PC_INSTALL_PASS | [캘린더 3파일 승인](../approvals/writer-updates/market-calendar-er1-company-names-writer-b-20261108.json) · [실제 결과 JSON](../results/writer-b-source-install-45d5b569-18fc-4abc-b3f9-3e73ca981c02.json) | [#871](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/871) | 공통 Writer B의 승인·원본 CAS·설치·보호와 결과 연결. 해당 캘린더 3파일만 설치 검증; 게시 성공과 별개 |
| 설치 전 원본 해시, A_READONLY_PASS | [결과 JSON](../results/42435780811-1-seat-5.json) · [TXT](../results/42435780811-1-seat-5.txt) | [#863](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/863), Run 42435780811 | 정확한 sourceRoot·before SHA·A/M 상태·두 설정 상태 확인. **현재 고정 22파일만 지원**, `runtimeSourceVerified:false` |
| 원자적 결과 보고, WINDOWS_FIXTURE_PASS | [결과 JSON](../results/writer-config-b-proof-868-42436432888.json) · [TXT](../results/writer-config-b-proof-868-42436432888.txt) | [#868](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/868), Run 42436432888 | 동일 실행의 결과쌍 2/2 재조회·부분 실패 검증. **운영 config ON/실제 R6 설치 증거 아님** |

관련 실패 회귀 예: [#860](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/860)의 JSON/TXT 1/2, [#874](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/874)의 누락 import 경로 미표시. 성공 사례가 이 문제들까지 자동 해결했다고 간주하지 않는다.

이 색인은 **일부 대표 사례**다. 다른 완료 작업의 실제 원본은 각 고유 승인·Issue·결과 경로에 보존한다. 색인에 없다고 성공 취소·업무 중단·재검사를 요구하지 않는다.

## 4. 다음 담당자의 재사용 방법

1. 기능별 목표와 마지막 완료 단계부터 확인하고, 같은 작업 유형의 색인 또는 기존 `approvals/`·`results/`에서 **관련 사례만** 찾는다.
2. 재사용 대상은 공통 operation·manifest **형식**·테스트 Fixture·실패 복구 패턴이다. 과거 beforeSHA·운영 HEAD·승인·config·stored_at를 현행값으로 고정하지 않는다.
3. 변경 대상의 최신 승인 source, 실제 Windows 원본/해시·충돌, 자원 lease를 기존 정규 계약으로 대조한다. 성공 자료가 현재 작업의 승인이나 Runtime 증거를 대신하지 않는다.
4. 기존 실행기/공통 API로 수행한다. 미지원 기능만 정확한 근거와 함께 공통 총괄에 인계하고 기능 고유 업무는 계속한다.
5. 실제 성공 후 기존 Reporter의 JSON/TXT·Issue 원격 결과를 연결한다. 새로운 **재사용 가능한 공통 구조**가 추가됐을 때만 색인을 최소 갱신한다.

## 5. 보존·보안 및 시행착오 환류

- GitHub 비공개 제어 저장소에는 승인된 비민감 manifest, 해시·메타데이터, 최소 결과 JSON/TXT, 테스트 Fixture, 코드·문서만 보관한다. **전체 PC 운영 파일/SQLite·원자료·토큰·비밀 config·백업·인증 URL**을 추가 업로드하지 않는다.
- 한 번 생성한 고유 성공·실패 결과를 덮어쓰거나 실행 시각/상태를 사후 소급하지 않는다. 잘못된 판정은 정정 기록으로 구별한다.
- 장애를 발견하면 원래 성공 증거와 **다른 구현체에도 남은 동일한 결함**을 함께 조사한다. 근본 원인을 공통 코드/생성기/계약에 수정하고 관련 실패 회귀 테스트 및 필요한 Windows 증거를 연결한다.
- 모든 성공을 무조건 기록하기 위한 별도 예약·Runner·신규 Gate는 만들지 않는다. 원래 결과 회수 경로를 활용하고, 기존 정상 기능·다른 독립 작업을 중단하지 않는다.

**완료 판정:** 이 파일·시작 지침의 배포는 문서의 재사용 계약을 마련한 것일 뿐, 개별 원본 조회 범용화·D1 증거 자동화·Writer B 의존성 진단·공유 Reporter 코드 개선 또는 PC 설치 완료를 의미하지 않는다.
