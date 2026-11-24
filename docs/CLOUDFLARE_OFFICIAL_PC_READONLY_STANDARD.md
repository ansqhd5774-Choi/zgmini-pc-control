# Cloudflare 운영 조회 공식 표준 — 기존 PC Runner·Wrangler OAuth (2026-11-24)

> 적용 범위: **ZGMINI가 이미 승인·등록한 Cloudflare 운영 상태의 읽기 전용 검증**. 이 문서는 웹 디버그·Cloudflare 대시보드 수동 조작을 필수 경로로 삼지 않는다. Cloudflare 변경·배포 실행을 허가하는 문서가 아니다.

## 1. 정본과 적용 경계

- 상위 공통 지침: [AGENTS.md](../AGENTS.md), [PC_AUTOMATION_STANDARD.md](PC_AUTOMATION_STANDARD.md), [GENERAL_CHAT_PREWORK.md](GENERAL_CHAT_PREWORK.md). 기존 A급 `pc-job`·Runner·결과 회수 및 B급 Controller 유지보수 계약을 그대로 사용한다.
- **공식 1차 경로:** 기존 운영 PC(`PC`)의 등록된 `w05-cloudflare-deployment-readonly` → 설치된 Controller의 허용목록 → 기존 Wrangler OAuth를 운영 PC 내부에서만 재사용 → Cloudflare 공식 REST API의 **고정 GET** → 원래 JSON/TXT 결과 원격 회수. 웹 디버그, 사용자 수동 대시보드, 새 유료 브라우저, Remote Desktop Commander가 선행조건이 아니다.
- 현행 구현은 고정 Worker `zgmini-migration-candidate-r5`, 도메인 `zgmini.kr` 전용이다. 다른 Worker/계정/도메인 또는 API 동작을 Issue 본문이나 명령 인자로 주입할 수 없다. 확장이 필요하면 기존 공통 모듈의 정확한 대상·권한·테스트·승인 manifest를 별도로 검증해 등록하며 임의 shell, URL, SQL이나 미승인 호출로 대체하지 않는다.
- 다음은 **별개의 작업**이다: (a) Cloudflare 활성 Deployment/Version/트래픽/도메인 조회, (b) D1→API 의미 동치, (c) GitHub 공식 build check와 Version ID 대조, (d) Cloudflare API의 source SHA 독립 attestation, (e) Worker·DNS·D1·배포 설정/코드 변경. (a)가 PASS라도 (d)가 미증명이거나 (e)를 허가한 것은 아니다.

## 2. 기존 승인된 실행 절차

1. **기존 결과 우선:** 동일 Worker·배포 Version·환경에 대해 유효한 실PC 결과가 있으면 재사용한다. 새로운 활성 배포·검증 대상 변경이나 실제 모순이 없다면 같은 조회·Controller 설치를 반복하지 않는다. 기준 성공은 아래 4절의 #3306/Run/원본 JSON·TXT이다.
2. **실제 설치 여부와 권한:** 현재 운영 PC의 허용목록 `config/operations.json`에 `w05-cloudflare-deployment-readonly`가 A/light·90초로 등록되었고 설치된 Controller에서 같은 operation을 지원하는지 확인한다. GitHub `main`에 코드만 있다고 운영 설치된 것은 아니다. 현행 성공 설치 증거는 #3302이다. 설치가 실제로 빠진 경우에만 공통 Controller 등록→CI·승인 manifest→독립 B 유지보수→사후검사를 수행한다. 읽기 실행마다 B 설치를 다시 요구하지 않는다.
3. **원래 A 요청:** 현행 `ZGMINI_PC_JOB_V1`의 기존 7필드(`schema`, 고유 `requestId`, `chatId`, 고정 `operation`, `sourceRepository`, `sourceBranch`, 승인된 정확한 `sourceSha`)로 `pc-job` Issue를 *한 번* 접수한다. `sourceRepository=ansqhd5774-Choi/zgmini`, `operation=w05-cloudflare-deployment-readonly`. 실행 당시 실제 승인 source를 사용하며 과거 성공 SHA를 새 요청에 기계적으로 복사하지 않는다. 임의 URL·token·shell·배포 인자를 추가하지 않는다.
4. **운영 PC 내부 조회:** 기존 고정 설정의 account/source/core를 검증하고, 승인된 `zgmini-earnings-history-pc-release` source checkout의 HEAD·변경 없는 관련 3파일을 검증한 뒤 기존 `scripts/pc-writer/d1.mjs`의 credential 경로로 운영 PC 내부 Wrangler OAuth를 재사용한다. 새 token 발급·채팅 입력·로그 노출을 요구하지 않는다. 현재 Controller 구현은 redirect 차단·timeout을 가진 GET만 사용한다.
5. **Cloudflare 공식 GET:** 고정 계정의 Workers `/scripts/{worker}/deployments` 목록 → 선택된 활성 Deployment 상세 → 활성 Version 상세 → `/domains`의 Worker/호스트 바인딩 순서로 관측한다. Deployment ID·Version ID·트래픽 합계 100%·상세 일치·도메인 연결을 실제 응답으로 검증한다. 버전별 트래픽 비율은 *관측 시점*의 값이다. 빌드 Version ID와 활성 Version ID의 비교는 별도의 GitHub build check를 근거로 하며, 과거 버전 핀을 현재의 무조건 참인 값으로 취급하지 않는다.
6. **원격 결과 판정:** 원본 Issue/Run/attempt, 실제 PC·실행 SHA, `results/*.json`과 대응 `*.txt`, `status`, `code`, `exitCode`, `activeDeploymentId`, `activeVersions[].versionId/percentage`, `domainVerified`, `expectedBuildVersionActive`, `sourceShaVerified`, `protectedStateUnchanged`, `operationalWrites`, `providerCalls`, `d1Writes`를 연결해 확인한다. `PASS`는 이 operation이 실제 검증한 필드 범위에만 해당한다. `controlWorkspaceWrites=true`는 기존 보고·결과 작업공간 기록과 구분하며 Cloudflare 운영 쓰기 성공을 뜻하지 않는다.

## 3. 보안·실패·변경 경계

- OAuth token, account 비밀, API Authorization 헤더, 전체 환경변수, 인증 URL, 원본 private config를 GitHub·채팅·결과 파일에 노출하지 않는다. 이미 인증된 운영 PC의 현행 공식 저장 경로를 사용하며, 외부 웹 디버그 인증 세션에 의존하지 않는다.
- `CF_EXISTING_WRANGLER_OAUTH_UNVERIFIED`, `CF_OAUTH_PERMISSION_UNVERIFIED`, `CF_SOURCE_HEAD_MISMATCH`, `CF_ACTIVE_DEPLOYMENT_SHAPE_UNVERIFIED`, `CF_DOMAIN_BINDING_UNVERIFIED` 등의 실패/미확인은 **해당 조회 단계의 오류**로 분류한다. 인증 미검증을 운영 배포 장애로, `STATE_UNKNOWN`을 배포가 없다는 사실로 변경하지 않는다. 원본 오류 단계·실제 입력을 확인하고 최소 수정한다. 안전 검사를 끄거나 계속 재시도하지 않는다.
- 소스와 운영 설치가 다른 경우: 승인 source·파일별 해시, 현재 설치 SHA·설정 CAS·정확 selectiveSource 파일 포함 여부를 확인하고 필요한 등록 변경만 정규 PR/CI 후 B 유지보수로 적용한다. #3297의 `SELECTIVE_MAIN_SOURCE_HASH_MISMATCH`는 누락된 정확 두 경로를 #3299에서 pin하여 #3302에서 설치 완료한 역사 사례다. 이 사례를 현행 미설치나 전역 오류로 복사하지 않는다.
- **쓰기 작업은 별도 계약:** Worker 코드 배포, traffic 전환, Cloudflare 설정·route·DNS·D1 변경은 이 A 경로의 허용 범위가 아니다. 기존 사용자 업무 승인, 소스→Cloudflare Git Integration build→정확 Deployment→Production 검증, 대상별 CAS·백업·복구·readback 절차를 준수한다. 읽기 A의 OAuth 보유나 API 접근 가능성을 쓰기 권한으로 해석하지 않는다. Wrangler 직배포·배포 롤백·DNS 변경을 이 문서만으로 실행하지 않는다.
- `sourceShaVerified=false`는 Cloudflare API 메타데이터 자체에서 Git commit SHA를 독립 증명하지 못했다는 뜻이다. GitHub 공식 build check가 같은 Cloudflare Version ID를 증명한 사실과 분리 기록한다. 이를 임의로 `true`로 바꾸거나 활성 배포 조회 실패로 판정하지 않는다.
- 0개의 `providerCalls`, `d1Writes`, `operationalWrites`는 해당 읽기 실행의 효과를 나타낸다. 결과 등록·원장 GitHub 쓰기는 이 값과 구별된다.

## 4. 2026-11-24 운영 성공 원본 (재실행 대상 아님)

| 단계 | 원본 | 실제 확인 |
| --- | --- | --- |
| 읽기 operation 구현·통합 | [PR #3289](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3289) | 고정 Cloudflare GET, 기존 61 작업 불변, A/light 90초 신규 등록 |
| selectiveSource 2경로 정정 | [PR #3299](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3299) · [실패 #3297](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3297) | 정확 pin 수정·기존 승인/원본 보존 |
| Controller 정규 B 설치 | [#3302](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3302) · [설치 JSON](../results/maintenance-pc-update-54d3988e-2960-43d4-a618-0bf023f28be3.json) | `SUCCEEDED`, 실제 Controller SHA `c5c7ee4d9554beeedf1572752e7e90aafa260730`, 보호 불변 |
| 운영 PC A 읽기 | [#3306](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3306) · [Run 45373166159](https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45373166159) · [JSON](../results/45373166159-1-seat-4.json) · [TXT](../results/45373166159-1-seat-4.txt) | `PASS / CF_ACTIVE_DEPLOYMENT_READONLY_VERIFIED`, 종료 0, 보호 불변, 운영 쓰기 0 |
| 당시 활성 배포 관측 | [중앙 #68 원장](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68#issuecomment-7128575148) | 관측 `2026-11-24 19:16:24 KST`, Deployment `276f49b7-21f4-4884-af5a-29c3037ab80a`, Version `f115f82d-e0e5-4f31-9000-fbb9bbc467ae`, traffic 100%, `zgmini.kr` 바인딩 |
| GitHub build 확인 | [ZGMINI 해당 source의 공식 check](https://github.com/ansqhd5774-Choi/zgmini/commit/a0735cac4a4dc56f0da0d3d0f82a93fd5b4486c7/checks) | 당시 build Version ID와 활성 Version 일치. Cloudflare API의 `sourceShaVerified`는 **false** 유지 |

이 사례는 **2026-11-24 관측된 당시 상태**이지 미래의 활성 Deployment/Version에 관한 상수나 다음 사용자 업무의 변경 승인서가 아니다. 프로젝트 지침·다른 일반챗·실제 운영 PC는 GitHub 문서만 수정해 자동 갱신되지 않는다.
