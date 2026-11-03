# ZGMINI ER1 B 원샷 Runner — **비설치 로컬 시안**

이 디렉터리는 원래 `pc-job` A급 Runner나 `pc-maintenance` Controller 업데이트의 권한을 확대하지 않고, **별도 승인된 단회 B급 ER1 게시**를 처리하는 소스 시안이다.

## 현재 상태

- 구현: 별도 Issue 계약, 별도 self-hosted Windows CMD workflow, 공식 `actions/checkout`의 전체 commit SHA 고정, **private 제어 소스+public ER1 소스 각각 exact SHA checkout**, raw-byte 승인 manifest, SHA 파일 목록 검산, 독립 V2 Publisher·Operator, 선행 read-only preflight, GitHub 공용 단회 예약+로컬 lease, 요청별 TXT·JSON·Issue 댓글 업로드.
- 로컬 시험: `node --test tests/*.test.mjs` — **31/31 PASS** (V1 기존 보호 16 + 독립 publisher 12 + V2 workflow glue 3).
- **설치/등록/실행: 0회.** 실제 PC Runner/운영 Source/SQLite/D1/Cloudflare 변경 없음.
- **바로 실행 불가:** workflow private checkout SHA에 승인값 대신 placeholder가 있으며 승인 manifest는 `PENDING_B`다. PC config D1 binding fingerprint·Cloudflare 실제 Production Reader SHA/route 미검증, 실제 Windows/D1 검증 없음. Reader #959는 D1 신규 key 사전 저장·readback PASS 전에는 미배포로 유지한다.

## 기존 보호 계약과 분리

- `.github/workflows/pc-er1-approved-once.yml`: Issue 제목 `pc-er1-approved-one-shot`, `pc-er1-approved` 라벨, 원 저장소 private, 정확한 actor, 기존 self-hosted Windows Runner에서만 실행. 공식 `actions/checkout@11d5960a326750d5838078e36cf38b85af677262`(v4 태그의 확인된 전체 SHA)를 사용하고 `persist-credentials:false`, `fetch-depth:1`로 격리 워크스페이스의 `er1-control/`과 `er1-source/`를 각각 승인 SHA에 고정한다. 임의 Issue body는 shell에 삽입하지 않는다. 워크플로의 private checkout SHA placeholder는 **승인·반영 전 반드시 고정해야 하는 STOP 조건**이다.
- `er1-b-contract.mjs`: JSON 7필드만 허용. Issue가 전달하는 명령·경로·SQL·URL·코드·임의 옵션 없음. wire request V1 유지, raw B manifest SHA만으로 V2 승인 식별.
- `er1-b-contract-v2.mjs`: 새 승인 schema `ER1_PC_OPERATION_APPROVAL_V2`와 별도 scope, 정확한 e217 공개 소스 6개+private V2 모듈 2개 SHA256을 묶는다. 기존 Core-chain 오퍼레이터는 실행 허용목록에서 제거한다.
- `er1-b-entry.mjs`: workflow CLI에서 **V2_EDITION만 선택**하고 Git HEAD·추적 파일·원문 manifest·8개 해시를 검증한 후 private control V2 오퍼레이터+독립 게시 모듈을 격리된 public checkout에 복사한다. Core 등록 작업이나 실제 프로젝트 파일에는 checkout/pull/copy를 하지 않는다.
- `operator/ER1_PC_OPERATION_V2_ONCE.mjs`: Core `local-cycle.mjs` task chain/운영 HEAD에 의존하지 않는 단회 저장 산식·게시 운영자. 승인 config.source 및 계정/DB binding fingerprint, 정확한 D1 클라이언트·2 의존파일 SHA, **D1-first 기존 FHS/R43 Reader 활성 상태**(ER1 Reader 비활성), 만료까지 최소 10분 남은 기존 사용자 Wrangler OAuth만 사용한다. 토큰 재발급·출력·키 파일 변경 금지. 한 공개 key에 대해서만 동일 body 무쓰기 또는 신규 1건의 D1 create-only insert→정확한 readback을 허용한다. 서로 다른 기존 본문은 보존하고 STOP한다. 쓰기 결과가 불명확하면 `STATE_UNKNOWN`으로 중단하고 자동 재실행하지 않는다.
- **공용 원샷 예약:** 읽기 전용 preflight 통과 후 `results/er1-b-global-once.json`을 GitHub Contents API의 **create-only** 요청으로 한 번 등록한다. 이미 존재·충돌·응답 불명확이면 B 계산/게시를 실행하지 않는다. 서로 다른 물리 PC에 Runner가 등록된 경우에도 GitHub 공통 저장소에서 중복 시도를 차단한다.
- 로컬 추가 보호: PC의 `E:\ZGmini\automation\er1-one-shot\ER1_B_ONE_SHOT_ATTEMPTED.json`을 `wx`로 한 번 생성. 결과 불명확·실패 시 자동 재실행 금지. 실행 중 `ER1_B_ONE_SHOT.lock` 사용. Core/Korea/Iran lock은 변경하지 않음.
- `er1-b-upload.mjs`: 결과 회수 단계에서만 GitHub 토큰 사용. 비밀·원자료 없는 요약 필드를 **요청별 불변** `ER1_B_WORKFLOW_RESULT_<requestId>.json`에 저장하고, `results/er1-b-<requestId>.{json,txt}` 및 Issue 댓글로 게시. 과거 BLOCKED 결과가 다른 요청의 업로드를 막지 않음.

## 최초 사용 전 필수 조건 (준비 전 STOP)

1. **새 B 승인**: private 제어 저장소의 최소 PR에서 V2 edition/entry/operator/publisher/approval과 workflow를 검토한다. 승인된 exact 40자리 control commit SHA를 workflow placeholder에 고정한다. 원본 Core-chain `operator/ER1_PC_OPERATION_ONCE.mjs`는 V2 경로에서 사용하지 않는다. 새 Windows host-entry 설치 없이 기존 self-hosted Runner checkout 작업공간 사용.
2. `approval/ER1_INDEPENDENT_PUBLISHER_V2_PENDING.json`은 미승인 템플릿이다. PC 기존 `config.source` exact 승인 SHA와 `account/core/history` **비공개 결합 해시**를 승인 관리자가 기존 설정에서 검산한 뒤 `APPROVED_B`로 서명·검토하고, 정확한 bytes를 private checkout의 고정 `approval/ER1_PC_OPERATION_APPROVAL.json`으로 배치한다. 비공개 DB ID와 credential을 GitHub/로그에 쓰지 않는다. config binding 해시 불명이면 STOP. PC Core HEAD 추적을 새로운 필수 A 설치 진단으로 만들지는 않는다.
3. D1 클라이언트 `d1.mjs`, `d1-transient.mjs`, `d1-diagnostics.mjs`는 public e217 checkout에 있는 exact SHA로만 연결한다. 기존 Wrangler OAuth가 10분 안에 만료되거나 없으면 **preflight STOP**, 자동 refresh/재로그인 금지. 저장 산식은 기존 e217 그대로이며 고정 발행사 명부 없음.
4. **D1-first 선행 검증**: Cloudflare 실제 Production API의 route/binding·배포 ID·exact source SHA를 조회하여 그 배포에서 신규 ER1 feed key를 읽지 않음을 확인하고, 승인 manifest에 검증된 `legacyProductionSha`, `legacyProductionRoute`, `prePublishReaderGate=D1_FIRST_LEGACY_READER_GATE`를 고정한다. 실행 직전 실제 `zgmini.kr` GET에서 기존 FHS/R43 헤더 둘 다 존재, ER1 Reader 헤더 부재, `x-display-count` 양수, HTML 본문에 실제 별점 요소가 있는지 확인한다. 2026-11-02는 실제 `display-count:0`·본문 0바이트라 자동 Gate가 STOP하므로, **11-03 282건/별점 요소 282개를 직접 관측해 승인 probe URL을 2026-11-03으로 조정**했다. 이 고정 날짜가 실제 배포 시점에 더는 유효하지 않다면 STOP 후 새로운 유효 표본으로 재승인해야 한다. 헤더 검사만으로 배포 SHA/route를 검증했다고 주장하지 않는다. 검증이 불가능하거나 다른 배포가 진행 중이면 STOP.
5. **실행 순서**: 해당 신규 D1 공개 key의 기존 다른 본문을 덮어쓰지 않는 0/1회 게시 → 원격 exact readback 확인 → 그 후에만 별도 승인 절차로 [Reader PR #959](https://github.com/ansqhd5774-Choi/zgmini/pull/959)를 병합/배포 → 배포 SHA, `x-zgmini-earnings-grade-reader: ZGMINI-ER1-97`, API/PC·모바일 별점·결측/필터 검증. 게시 실패/UNKNOWN이면 Reader 배포 금지.
6. 공용 Controller 대기열 [#68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)과 독립 B 적용 순서를 조정하고, 실제 Windows self-hosted 환경·계정 권한·GitHub 원샷 예약의 원자성·결과 회수·D1 readback을 검증한 뒤 **해당 workflow를 명시적으로 승인**한다. `tools/update.mjs`의 `.github/` 인프라 diff 금지에 걸리므로 **workflow를 main에 임시 병합하는 단계는 별도 승인 전 금지**. 잠깐 병합 후 제거하는 우회안도 중간 자동업데이트 차단·Issue 누락·실행 불명확·삭제 PR 지연 위험이 있고 사전 회수·차단 계획 필요하다.

## 현재 승인하지 않은 동작

`config/operations.json`의 `mutationsEnabled=false` 유지, A등급 작업을 B로 승격하지 않음, Controller `pc-maintenance`를 운영 쓰기로 전용하지 않음, Core·예약·DB 구조/산식/TTL/공급자/API 호출/데이터 재수집/Cloudflare 배포 변경 없음. 고정 발행사 명부 없음. 경로를 추정해 D1 게시하는 우회도 없음.

## 테스트 범위

actor/private/label/Runner 식별, 요청 필드 외 명령·경로 차단, B manifest raw SHA·shape, 공개 6개+D1 3개+private 2개 핀 계약, 정확한 private/public Git checkout SHA·dirty 차단, private V2 staging, GitHub 글로벌 예약/로컬 중복 방지, OAuth expiry STOP, **D1-first Reader 이중 헤더·ER1 미활성 및 0건·빈 본문·별점 누락 STOP Gate**, 검증 배포 SHA/route 명세 미입력 STOP, 0/1건 D1 write·readback, 기존 다른 본문 보존, D1 outcome unknown, token 차단, 요청별 결과 회수 등 **Linux Node fixture 31/31**. Cloudflare 실제 배포 SHA/route·Windows PC Runtime·Production D1·사이트 검증은 아니다.
