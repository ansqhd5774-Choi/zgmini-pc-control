# PC BEA·QFR B급 1회 게시 — 비활성 제안서

**상태: Draft 제안·fixture 전용. 승인·병합·PC 설치·D1 적용 모두 미실행.**

## 목적과 현행 계약 경계

- 기존 PC Writer의 `EARNINGS_BEA_UNIT_PROFIT_R1_ONCE.mjs`와 `EARNINGS_CENSUS_QFR_R4_D1_ONCE.mjs`가 별도 D1 키에만 쓰도록 이미 구현돼 있다.
- 현행 `pc-job`은 A급 전용(`mutationsEnabled=false`), `pc-maintenance`는 Controller 소스 갱신 전용이므로 어느 쪽에도 B급 게시 명령을 혼입하지 않는다.
- 이 PR은 전용 Issue 계약·순수 검증기·기본 비활성 사전 승인 검증 workflow만 제안한다. **현재 workflow에는 실제 `--apply` 실행 단계가 없다.**
- 새 Runner, 서비스, 스케줄, 공개 저장소 source, D1 스키마, Core 잠금, Alpaca 한도 정책 및 운영 배포를 변경하지 않는다.

## 고정 요청과 승인 계약

1. 본 제안의 요청 schema `ZGMINI_PC_PUBLICATION_REQUEST_V1`은 `schema,requestId,chatId,operation,controlRepository,approvalManifestSha256` 여섯 필드만 허용한다. `requestId=pc-publication-<UUID>`, `chatId=chat-<UUID>`, actor/repository/private/`issues.opened`/`pc-publication` label을 검증한다.
2. 승인 파일 위치는 `approvals/publications/<requestId>.json`, 승인 schema는 `ZGMINI_PC_PUBLICATION_APPROVAL_V1`. 전체 원본 바이트 SHA256이 요청 핀과 일치해야 한다. 단일 `publisherSha`와 `operationalSha`를 별도로 승인한다.
3. 두 operation만 허용한다: `bea-unit-profit-once` → BEA 전용 `detail:earnings-bea-unit-profit:v1`; `census-qfr-margin-once` → QFR 전용 `detail:earnings-recession-indicators:census-qfr-mfg-margin:v1`. 스크립트 경로와 두 확인 flag는 사용자 입력이 아니라 검증기의 불변 상수다.
4. 별도 승인 Issue에 actor `ansqhd5774-Choi`가 `ZGMINI_B_PUBLICATION_APPROVED <requestId> <raw-SHA256>` 댓글을 정확히 작성해야 한다. 키·schema 승인은 실제 게시 승인으로 자동 승격되지 않는다.
5. 제안 workflow는 `ZGMINI_B_PUBLICATION_PREFLIGHT_ENABLED`를 별도 승인해 `true`로 설정하기 전에는 실행되지 않는다. 활성화해도 계약 사전 점검만 수행하고 `PUBLICATION_EXECUTOR_NOT_INSTALLED`로 차단된다. 이 변수는 **B 게시 활성화 스위치가 아니다.**

## 실제 게시 도입 전 미완료·STOP

- 현재 설치된 PC 운영 checkout와 별도 clean `main` 게시 checkout을 실PC에서 확인하고, 원본 실측 SHA·E: 경로·결과 원장을 고정해야 한다. 아직 실행하지 않았다.
- 본 제안에 `--apply` 명령을 실행할 B 운영 엔트리·실패 복구·D1 결과 업로드가 없다. Windows 격리 fixture, 승인 원장, 단일 lane 중복 방지 및 결과 회수까지 별도 검토 후 **같은 범위의 정확한 추가 승인**이 필요하다.
- 신규 B 엔트리에는 D1 단일 키 readback (`READBACK_VERIFIED` 또는 동등한 `ALREADY_STORED`)과 `sourceVersion/sourceStoredAt` 일치를 요구한다. Actions 성공·HTTP 200·source unit test만으로 게시 성공을 선언하지 않는다.
- `SOURCE_DRIFT`, `APPROVAL_MISSING`, `RAW_STALE`, `D1_READBACK_UNKNOWN`, 통신 timeout·부분 저장에서 자동 재시도 0회. Issue/requestId 원장 확인 후 `STATE_UNKNOWN`으로 보존하며 무조건 재실행하지 않는다.
- BEA는 `--dry-run`에서 FRED CSV를 1회 조회(원자료·D1 미저장), `--apply`에서는 PC 원자료를 먼저 저장할 수 있다. 따라서 원자료는 저장됐으나 D1 결과가 불명확한 부분 상태를 기록해야 한다. QFR은 기존 저장 SQLite의 read-only 조회만 수집 경로로 사용한다.

## 최소 fixture

`node --test tests/publication-contract.test.mjs`는 승인 해시·actor·두 operation·명시 flag·단일 D1 키·실행 1회·retry 0·approval comment·두 checkout 소스 drift·중복 원장·readback을 검증한다. 이 테스트는 **로컬 순수 함수 검사**이지 Windows 실PC 또는 D1 실제 검증이 아니다.
