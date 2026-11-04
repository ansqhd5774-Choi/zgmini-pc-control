# ER1 2026-11 Controller 인프라 누적 증거 — 검토용

> **상태: 승인 검토용.** 이 문서는 설치 manifest·운영 실행 허가가 아니며, 별도 승인 및 단일 적용 담당의 검산 전 사용하지 않는다.

- 현재 실PC 설치 기준(2026-11-04T13:13:56Z): `14940aa112494b1cea09ff5c7250f4af86a4ce6a`.
- 11월 A/light 모듈이 포함된 검증 기준점: `1ef6d920b7fd42324fc9c1e52b07bad626547650`([#303](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/303) 병합 SHA, main 조상).
- 기준 설치 → 기준점 diff: `controller/`·`config/` 8개, `.github/workflows/` 25개(추가 승인 범위 11개). `scripts/` 변경 없음. 전체 파일 해시는 기준점의 원격 원본 바이트에서 산출.
- 선행 14개는 기존 [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) 및 승인 명세 `approvals/controller-updates/e675f3af0423ebbfbe8af87624cd0cad10027ffc.json`의 최종 해시와 재대조한 뒤 재사용.
- 추가 11개는 아래 각 변경의 병합 PR 이력을 참고하되, 수정 PR 이후 **최종 파일 해시 승인과 공용 적용 담당의 명시적 수락은 별도로 필요**하다.

| 변경 파일 | 기준점 SHA-256 | 병합 PR 근거 |
|---|---|---|
| `.github/workflows/pc-ai-software-v2-register-once.yml` | `a874ebada958c2efb91c85b91c7652c0abcd6cfb7db153259500b29c4f4ba2ac` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-approved-once.yml` | `d5acad0b8dfa0da24b851eb7bb01025769f0e582029444f9772cb3f86919f4b2` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-capture.yml` | `c627ec35fdf51f244218748d15eb33c7307e83020734cc80d5e7a12a62685517` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-derived-score-v1.yml` | `fc07a27c7febcba635aecf6ab4d01889ed0ef5a49cd554b16ddaa466f4cb4576` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-derived-score-v2.yml` | `c721b92c8a5a2dea5ff7eb255cbbd982153d8787b8159789a2a83f93bb98a52d` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-html-publish-v2.yml` | `d8c56740b1eaf555deca3556f395ce5814ddf1cdea04b4d5b5842ed5d6508fdf` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-html-publish-v3.yml` | `2c592e7d43a4afbc42774b837b78509ddd391149bbc6bca9e313fc3e70e02a61` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-html-publish.yml` | `ac90c4303b7e82ed0e0596b32434e88b434f4b8eea30c8cc83e417ed60932b12` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-symbol-batch-a.yml` | `bbbe72b99b7061cfdb16325a4e0367c6fc12d0de46dcd045bed008aa62a2ab2f` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-dec31-symbol-probe.yml` | `e4cd0cdffa14ba5897b143a7f1e526c22defb068ee8480ba65bf34138387f401` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-nov30-capture.yml` | `4b1cebacaadb896b378c9725ebbf91f18f594c8c5bb7404be868f508841b8d1a` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-er1-nov30-html-publish.yml` | `501752e38f3ded3b78239a577f544dcde93de2ddc6a38751c45bec7bbef7be02` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-inflation-19-inventory-b-once.yml` | `c194e596a75cd8f434184649deb49c411a196365a9254b4f49f165de348be62a` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-inflation-bls8-approved-once.yml` | `6f01ba50ef9e8ed72e35219abe91259a12d02cda5492effe845906a1713812fe` | [#245](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/245) |
| `.github/workflows/pc-inflation-eia-only-approved-once.yml` | `8471be497afefeb2c55b5ea5a1e442b4398f1c9f5c5cdf81db6335bfcbed0a12` | [#253](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/253), [#257](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/257) |
| `.github/workflows/pc-inflation-eia-readback-once.yml` | `50e1dec79d76f64298551c3db107f56868fc8fd703eab35ec00752c150dd1ac0` | [#263](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/263) |
| `.github/workflows/pc-inflation-gas-electric-approved-once.yml` | `22dd0977e328323b032fdb673d9a553f4a97086069f60cf98aa20c6b596231f5` | [#247](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/247) |
| `.github/workflows/pc-inflation-sce31-approved-once.yml` | `313c748bbf57a2d11a9ad91e8d7652832ce577d4a7e53c67cb1c9048daea2d81` | [#237](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/237) |
| `.github/workflows/pc-inflation19-public-d1-once.yml` | `799a10270471d63c6411908748646ec5a0734ef0ae0581182565131ee53fbbcf` | [#292](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/292) |
| `.github/workflows/pc-inflation19-public-preview-readonly-once.yml` | `215b4573ca9a07795e49be820c3505bc4fa815893e4807db8aa222811842e9d0` | [#279](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/279), [#281](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/281), [#284](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/284), [#288](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/288) |
| `.github/workflows/pc-inflation19-public-runtime-readonly-once.yml` | `4bdbad37e253be2d0663b8df5f59f755438dd5f4d09c0ab2a97df356dfad3f51` | [#297](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/297), [#299](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/299) |
| `.github/workflows/pc-r17-writer-b-preflight.yml` | `36d192b9fc8f00d81ed90fa97378b82e7fdbe87bfd8b19457a635134ef88fc12` | [#255](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/255), [#259](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/259), [#262](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/262), [#267](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/267) |
| `.github/workflows/pc-theme-r54-evidence-once.yml` | `49ec8c58fc04237a9a50bb049c81069260007ded6e3e25b236ba50c635778f13` | [#271](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/271) |
| `.github/workflows/pc-theme-r54-readiness-once.yml` | `9cb8cf8375a5e4512c759008995cdff59852946bd7fcf692534da8593b6c5806` | [#278](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/278) |
| `.github/workflows/pc-theme-r54-score-once.yml` | `bfcb622afe18a959c2d75cb1e6ddfb3936db71e22b13a5368025fd5c824903d9` | [#273](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/273) |

## 적용 전 필수 검증

1. [공용 설치 조정 #68](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/68)의 기존 R17 단일 담당이 신규 ACK의 범위·개별 승인·현재 실제 설치/lease를 확인한다.
2. 승인 ACK가 main에 병합된 뒤 **실제 새 목표 SHA**를 확정한다. 이 문서의 `1ef6d920...`은 증거 기준점이지 병합 이후 최종 설치 목표가 아니다.
3. 실제 설치 SHA→새 목표 SHA의 **전체** `controller/`·`config/` 및 `.github/`·`scripts/` diff를 다시 산출해 정확한 파일/해시 manifest를 만든다. 별도 인프라 증거에는 승인된 병합 PR URL을 사용한다.
4. 설치기 `TARGET_NOT_ON_MAIN`, `APPROVAL_PR_TARGET_MISMATCH`, `ALLOWFILE_DIFF_MISMATCH`, `UNAPPROVED_INFRA_CHANGE` 안전 검사를 그대로 유지한다. 합격 전 PC B 설치 Issue 제출 금지.
5. 정규 설치 및 A `market-calendar-er1-nov30-availability` 한 번 실행·실제 결과를 회수한다. 일정 D1 3,051건은 기존 #215 증거를 재사용한다.

변경 없는 기존 기능·Core·운영 DB/D1·Provider·스케줄에는 영향을 주지 않는다.
