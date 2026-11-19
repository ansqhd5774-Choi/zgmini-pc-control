# 공유 Controller 선택 적용 B 계약 초안 (source-only)

상태: **계약 코드 후보 / 미승인 / 미설치**. 이 문서는 실행 허가서나 manifest가 아니다.

## 문제와 목표

2026-11-19의 실제 운영 Controller는 #2250/#2251 검증된 `b9099839df1a7cc6b3b166a139f7fac6938ada66`이다. 최신 main은 수백 개 다른 Controller/config 경로도 변경되었으므로, 기존 `TARGET_NOT_ON_MAIN` 및 `ALLOWFILE_DIFF_MISMATCH` 조건에서 단순 7개 allowFiles로 설치할 수 없다. 최신 `controller/operations.mjs`는 운영 설치본에 없는 `r54-runtime-binding-readonly.mjs`, `inflation-causal-saved-readonly.mjs`, `earnings-bea-mfg-archive-readonly.mjs`를 import하므로 그대로 교체하면 안 된다.

변경 목표는 **기존 설치본을 기초로 딱 승인된 7개 경로만 수정하는 Git commit**을 정확한 다음 Controller source SHA로 사용하는 것이다. 다른 파일은 기존 설치본과 Git tree 내용이 동일해야 한다.

## 제한된 두 출처

1. **승인된 main commit (`selectiveSource.mainSha`)**: 해당 main에 이미 있는 변경 파일의 정확한 내용을 가져온다.
2. **비main 선택 통합 commit (`targetSha`)**: 부모가 기존 `installedSha` 하나뿐인 commit이며 정확한 변경 경로 전체가 `allowFiles`여야 한다. main blob이 그대로 호환되지 않는 `operations.mjs`/설정은 이 commit에서 별도 최소 선택 통합 후 본문 SHA-256을 명시 승인한다.

신규 `ZGMINI_PC_UPDATE_V1`의 기존 필드, B 승인, raw-byte manifest SHA, 파일 해시, backup, Core/Runner 보호를 그대로 유지하고 아래 선택 필드만 확장한다.

```json
{
  "selectiveSource": {
    "schema": "ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1",
    "branch": "codex/controller-selective-w01-w04-20261119",
    "mainSha": "<pinned actual main commit SHA>",
    "customPaths": ["config/operations.json", "controller/operations.mjs"]
  }
}
```

이 선택 모드는 `purpose=pc-controller-maintenance` 및 `controllerOnlyInstall=true`만 지원한다. 다른 목적, 추가 infrastructureEvidence, 임의 Issue command/path, staging 후 해시 교체는 불허한다.

## 정확한 승인 연결

`main`에 별도 PR로 `approvals/controller-selective-targets/<targetSha>.json`을 병합한다. 이 pin의 키는 `schema=ZGMINI_CONTROLLER_SELECTIVE_PIN_V1`, `installedSha`, `targetSha`, `sourceMainSha`, `targetBranch`, `customPaths`, `allowFiles`, `approvalRef`이고 각 필드는 신규 B manifest와 일치해야 한다.

유지보수기는 정규 입구에서 다음 증거를 검사한다.

- 실제 설치 `host.controllerSourceSha == installedSha`, 보호 파일 변조 없음
- `origin/main`에 고정 source commit이 존재하며 pin을 담은 승인 PR은 실제 병합됨
- targetBranch HEAD가 `targetSha`와 일치, 해당 commit의 유일한 부모가 `installedSha`
- 설치본부터 target까지의 **전체 Git diff 파일명이 정확히 allowFiles 집합**, 제어 외 파일 0
- 비custom 경로는 `mainSha` 파일의 SHA-256과 일치, custom도 pin의 SHA-256과 일치
- 승인 PR의 병합 commit에 똑같은 pin 존재, 정책 변경은 기존 `validateControllerConfigTransition` 검사로 차단
- 대상 tree 전량을 정확한 `targetSha` 출처로 stage하되 기존 파일은 변경하지 않고 보존
- 독립 B drain/백업/스위치/재연결/원장/사후 A/TXT/JSON/보호 readback 유지

**운영 설치 SHA는 선택 통합 commit의 `targetSha`**이며 main source SHA로 위장하지 않는다. Source provenance에는 선택 통합 commit과 검토된 main commit을 구분한다.

## 7개 경로 (최종 바이트와 manifest 아직 미확정)

- W01: `controller/inflation-a401-private23-readonly.mjs`, `controller/inflation-a407-integrity-readonly.mjs`, `controller/inflation19-runtime-readonly.mjs`
- W04: `controller/common.mjs`, `controller/employment-r6-candidate-readonly.mjs`
- 공통: `controller/operations.mjs`, `config/operations.json`

## 의무적인 다음 검증 및 적용 (아직 실행하지 않음)

1. 기존 `b9099839...` 소스를 기반으로 7개 경로만 결합한 **단일 overlay commit** 작성. `operations.mjs`의 미설치 import 3개는 가져오지 않는다. 설정은 A407 및 기존 R6 범위만 추가한다.
2. Node syntax/관련 W01 A407·inflation19·W04 8키·Controller admission·Core 보호 회귀, 전체 변경 파일 7개 검사. CI PASS 전 설치 준비 완료 주장 금지.
3. 이 변경 계약 코드를 기존 독립 Windows maintainer로 **정규 승인 handoff**한 뒤 실제 해당 maintainer 버전 검증. 코드 병합만으로 새 mode가 실PC에 존재하지 않는다.
4. 선택 통합 overlay와 원본 installed SHA, 7개 after SHA-256, 검증 evidence를 담은 main pin PR을 승인·병합하고 정규 `approvals/controller-updates/<targetSha>.json`의 raw SHA256을 확정한다.
5. 신규 requestId의 B 1회 수행. #2094 STAGED 원본을 임의 삭제·복원·재실행하지 않고 현재 preimage/lease 검사로 판정한다. 운영 actual SHA와 결과 JSON/TXT 및 독립 A 확인 후 W01 A407 25 fingerprints/checkpoint2, W04 PIT 8키 A를 각각 원담당이 수행한다.

금지: 전체 main 설치, 기존 installed SHA를 main HEAD로 표시, `git reset/clean/rebase`, 운영 lock/Task 강제 조작, 승인 없는 추가 파일 허용, 같은 pc-maintenance 요청 재실행.
