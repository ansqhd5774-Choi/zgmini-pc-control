# PC BEA·QFR B급 1회 게시 — 비활성 제안서

**상태: Draft 제안·fixture 전용. 승인·병합·PC 설치·D1 적용 모두 미실행.**

## 목적과 현행 계약 경계

- 기존 PC Writer의 `EARNINGS_BEA_UNIT_PROFIT_R1_ONCE.mjs`와 `EARNINGS_CENSUS_QFR_R4_D1_ONCE.mjs`가 별도 D1 키에만 쓰도록 이미 구현돼 있다.
- 현행 `pc-job`은 A급 전용(`mutationsEnabled=false`), `pc-maintenance`는 Controller 소스 갱신 전용이므로 어느 쪽에도 B급 게시 명령을 혼입하지 않는다.
- 이 PR은 전용 Issue 계약·순수 검증기·기본 비활성 단발 실행 workflow를 제안한다. **코드는 실제 `--apply` 경로를 포함하지만 운영 활성화·실PC 실행은 별도 승인·Windows 검증 전 금지다.**
- 새 Runner, 서비스, 스케줄, 공개 저장소 source, D1 스키마, Core 잠금, Alpaca 한도 정책 및 운영 배포를 변경하지 않는다.

## 고정 요청과 승인 계약

1. 본 제안의 요청 schema `ZGMINI_PC_PUBLICATION_REQUEST_V1`은 `schema,requestId,chatId,operation,controlRepository,approvalManifestSha256` 여섯 필드만 허용한다. `requestId=pc-publication-<UUID>`, `chatId=chat-<UUID>`, actor/repository/private/`issues.opened`/`pc-publication` label을 검증한다.
2. 승인 파일 위치는 `approvals/publications/<requestId>.json`, 승인 schema는 `ZGMINI_PC_PUBLICATION_APPROVAL_V1`. 전체 원본 바이트 SHA256이 요청 핀과 일치해야 한다. 단일 `publisherSha`와 `operationalSha`를 별도로 승인한다.
3. 두 operation만 허용한다: `bea-unit-profit-once` → BEA 전용 `detail:earnings-bea-unit-profit:v1`; `census-qfr-margin-once` → QFR 전용 `detail:earnings-recession-indicators:census-qfr-mfg-margin:v1`. 스크립트 경로와 두 확인 flag는 사용자 입력이 아니라 검증기의 불변 상수다.
4. 별도 승인 Issue에 actor `ansqhd5774-Choi`가 `ZGMINI_B_PUBLICATION_APPROVED <requestId> <raw-SHA256>` 댓글을 정확히 작성해야 한다. 키·schema 승인은 실제 게시 승인으로 자동 승격되지 않는다.
5. 제안 workflow는 `ZGMINI_B_PUBLICATION_APPLY_ENABLED`가 별도 승인·Windows 실증 후 `true`로 설정되기 전에는 실행되지 않는다. 활성화하더라도 B manifest·승인 Issue 댓글·PC 두 checkout clean/SHA·정확한 파일 해시가 불일치하면 적용 전 중단된다. 환경변수 `ZGMINI_EARNINGS_C_OPERATIONAL_ROOT`는 **실PC에서 검증된 E:\\ZGmini\\projects 아래의 정확한 operational checkout**만 가리켜야 한다.

## 실제 게시 도입 전 미완료·STOP

- 현재 설치된 PC 운영 checkout와 별도 clean `main` 게시 checkout을 실PC에서 확인하고, 원본 실측 SHA·E: 경로·결과 원장을 고정해야 한다. 아직 실행하지 않았다.
- B executor 초안은 E:\\ZGmini\\automation\\pc-publication 아래 요청별 원장 및 전용 active lease를 사용한다. APPLY 시작 후 timeout·부분 저장·결과 오류는 `STATE_UNKNOWN`이며 **active lease를 자동 해제하지 않고** D1 결과 확인 후 수동 인계를 요구한다. 정확한 다른 requestId라도 이 B lane만 정지하며 일반 A 작업에는 영향이 없다.
- 새 Workflow의 자식 프로세스 트리 정리·PC Git 체크아웃·D1 실재조회·GitHub 결과 업로드는 **Windows 실PC에서 아직 검증하지 않았다**. 현재 변수는 비활성으로 유지하며, 승인 원장·부분 저장 및 결과 회수 검증까지 별도 확인 후에만 운영 활성화를 허용한다.
- 신규 B 엔트리에는 D1 단일 키 readback (`READBACK_VERIFIED` 또는 동등한 `ALREADY_STORED`)과 `sourceVersion/sourceStoredAt` 일치를 요구한다. Actions 성공·HTTP 200·source unit test만으로 게시 성공을 선언하지 않는다.
- `SOURCE_DRIFT`, `APPROVAL_MISSING`, `RAW_STALE`, `D1_READBACK_UNKNOWN`, 통신 timeout·부분 저장에서 자동 재시도 0회. Issue/requestId 원장 확인 후 `STATE_UNKNOWN`으로 보존하며 무조건 재실행하지 않는다.
- BEA는 `--dry-run`에서 FRED CSV를 1회 조회(원자료·D1 미저장), `--apply`에서는 PC 원자료를 먼저 저장할 수 있다. 따라서 원자료는 저장됐으나 D1 결과가 불명확한 부분 상태를 기록해야 한다. QFR은 기존 저장 SQLite의 read-only 조회만 수집 경로로 사용한다.

## 최소 fixture

`node --test tests/publication-contract.test.mjs tests/publication-executor.test.mjs`는 승인 해시·actor·두 operation·명시 flag·단일 D1 키·실행 1회·retry 0·approval comment·publisher의 `lib/market-score` 해시 포함·두 checkout source drift·중복 원장·로그 재조회·timeout 상태전이를 검증한다. 이는 **로컬 순수 함수 검사**이지 Windows 실PC 또는 D1 실제 검증이 아니다.
