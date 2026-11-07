# 공통 Windows Writer B — PIN/승인 Registry 정규 수신 연결 조사

조사 기준: `ansqhd5774-Choi/zgmini-pc-control` `main`
`5450f5d1446983094fb26ea3204eebf43b9f56d1` (GitHub 읽기 전용,
2026-11-08). 소스 모의 구현만 완료. 실제 신규 B effect 승인/설치/PC 적용 **없음**.

## 확인된 정규 수신 경계

| main 파일 | 현재 계약 | 새 PIN-CAS에 대한 판단 |
|---|---|---|
| `writer-b/contract.mjs` | `pc-writer-source-install`, `ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1`, `ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1`, `PC_WRITER_APPROVED_FILE_OVERLAY_ONLY`; `scripts/pc-writer`, `lib`, `worker` 하위 `.mjs` 전용 | host.json 및 registry JSON 변경 권한 **없음**. 기존 schema/scope를 다른 효과로 속여 사용 금지 |
| `.github/workflows/pc-writer-b-source-once.yml` | 사용자 owner·Issue opened·private repo·첫 시도, raw SHA preflight → exact SHA checkout → `writer-b/windows-adapter.mjs` → `writer-b/report.mjs` | 현 Issue title `pc-writer-source-install` 외 새 operation 미수신; generic B effect를 별도 명확한 승인 분기로 연결해야 함 |
| `writer-b/preflight.mjs` | 정규 source-only 승인 manifest의 pinned Git bytes 확인 | PIN registry 신규 B manifest 권한·원본 승인 경계가 별도 필요 |
| `r17-writer-b/r17-b-claim.mjs` | `acquireInstallLock` / `createInstallJournal` / `releaseInstallClaim`; 공유 `writer-source-install.lock`, 단회 요청 원장 | **재사용 가능**. 별도 기능 전용 잠금/재시도 루프 금지 |
| `provider-flags-b/run.mjs` | 승인 2개 환경변수만 변경하는 좁은 B, 동일 공유 Writer 잠금·동폴더 backup·ACL·fsync | 보안 구현 선례만 재사용. providers.env scope로 PIN 변경 우회 금지 |
| `tools/maintenance-agent.mjs` | controller-update, R6 host, R54, source-bundle 4종만 실제 poll/manifest/command 분기. `verifyInstalledTools` 7개 파일 SHA 일치 강제 | PIN operation/manifest/status/apply 경로 **미구현**. 이 경로를 선택하면 별도 승인한 유지보수기 self-handoff 필요 |
| `tools/update.mjs` | 위 maintenance 전용 status/apply subcommand만 있음 | `pin-cas-apply`/status 라우팅 없음. 직접 임의 호출 금지 |
| `tools/source-bundle-register.mjs` | `HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY`, 자체 fixed `hostPath` | `approvedRuntimeInventorySha256`·Registry 승인 효과와 다름. 기존 scope 재목적 금지 |
| `config/operations.json` | `mutationsEnabled=false`, 설치 A 고정 목록 | 신규 공통 A 조회 operation 미등록. 일반 A에 B 쓰기 주입 금지 |

## 최소 통합 방향

1. **기능별 수신기 없이 공용 승인 유형** 유지: `approved-preimage-readonly`
   (A), `approved-runtime-pin-register`(이 문서의 좁은 B),
   `approved-versioned-bundle-stage`·`approved-launcher-activate`(공용 B).
   공용 수신기 operation 지원만 한 번 확장하고, 이후 콘텐츠별로 승인
   Registry profile + exact SHA manifest만 새로 등록한다.
2. 기존 source-only B/Provider Flags B/Controller-update를 바꾸지 않은 채
   **하나의 공용 B 수신 분기**를 별도 좁은 owner·manifest 검증으로 마련한다.
   하나의 Writer B mutex를 공유하므로 겹치는 파일 적용만 직렬화된다.
3. 새 B request envelope의 정확한 `schema/operation/title/label/actor/UUID`
   계약을 공용 수신기에서 고정한다. 정본 `writer-b/contract.mjs:18,143`
   의 일반 source-only Issue는 `requestId`/`chatId` **bare UUID v1–8**이며,
   독립 유지보수기 `pc-maintenance`는 `pc-<UUID>`/`chat-<UUID>`이다.
   두 lane의 ID 형식을 섞지 않는다. 선택한 공용 라우터를 기준으로
   envelope·중복·재시도·원장을 확정한다.
4. 신규 범위형 승인 manifest에는 `PIN_CAS_SCHEMA`,
   `PIN_CAS_SCOPE=HOST_RUNTIME_PIN_AND_REGISTRY_BYTE_CAS_ONLY`, Git의 raw
   manifest SHA256, owner Issue provenance, `sourceSha`, `profileId`,
   `hostBefore/AfterSha256`, `registryBefore/AfterSha256`, `oldPin/newPin`,
   profile 단위 before/after SHA와 단회 requestId를 각각 결합한다.
   Registry after bytes는 단일 A/B 공통
   `ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1`의 `profiles[]` 구조다.
   **기존 Registry가 있으나 host PIN이 null인 orphan 상태는 자동 채택 금지**;
   최초 부재+null만 명시 승인된 exclusive-create로 허용한다.
5. 운영 대상 `host.json`의 **정확한 실설치 경로**와 DataRoot·Registry
   및 result root는 신규 고정 A 조회/현재 설치 Receiver attestation에서
   확정해야 한다. 과거 source-bundle 계약의 `hostPath`를 현재 PIN
   대상 경로로 추측 대입하지 않는다. Issue/manifest의 자유 경로 무시.
6. 별도 승인된 수신기 설치/출처 SHA·고정 파일 검증 후에만
   `makeApprovedRegistryPinBFromWriterReceiver` →
   `makeWindowsRegistryPinBAdapter` → 순수
   `runApprovedRegistryCas`를 바인딩한다. 기존 `r17-b-claim`의 **같은 공유
   Writer 잠금과 one-shot journal**을 사용한다. 백업·ACL·fsync·2파일
   raw-CAS·부분 오류 잠금 보존은 현재 로컬 소스에 구현되어 있다.
7. 실제 Windows/NTFS에서 ICACLS, junction·reparse, 실제 lease,
   create-exclusive, rollback, 충돌 및 결과 TXT/JSON 재조회 **2/2**를
   좁게 검증한다. source PASS는 운영 PASS가 아니다.

## 이번에 구현된 최소 연결 파일

- `windows-registry-pin-adapter.mjs`: 경로를 설치 수신기가 주입하는
  factory-only Node Windows 후보. 호출 전 operational effect 없음.
- `writer-b-lock-bridge.mjs`: 위 factory와 기존 `r17-b-claim` 세 API를
  연결하는 source-only 얇은 seam; 자체 event listener·CLI·workflow 없음.
- `writer-b-lock-bridge.test.mjs`: 권한 없는 호출·비Windows 직접 사용 거부.
- `isolated-registry-pin-adapter*.mjs`, `windows-registry-pin-adapter.test.mjs`:
  로컬 fault·bootstrap·동일 공유잠금 모델 검증.

배치 주의: 이 작업공간에서는 `windows-b-receiver/`가
`r17-writer-b/`와 형제다. GitHub의 예정 경로가
`writer-b/approved-versioned-bundle/`이면
`writer-b-lock-bridge.mjs`의 import를
`../../../r17-writer-b/r17-b-claim.mjs`로 **명시적으로 수정**해야 한다.
이 경로 정합성 자체도 해당 PR에서 `node --test` 재검증해야 한다.

## 현재 블로커와 비차단 항목

**해당 신규 B 운영 효과의 블로커**: 미승인 정확한 B scope/manifest,
현재 고정 수신기 라우팅 미등록, 현 Windows host/Registry 정확한 설치
증거 미관측, 공용 수신기 미설치·실PC 미검증.

**기존 기능과 Core에는 적용되지 않음**: 정상 A 조회, 기존 Writer source B,
Provider Flags B, 독립 소스 개발·검증, 실제 자원 충돌 없는 다른 Runner.
예약 자연 실행 실증은 기능 완료 후 별도 후속 작업이다.
