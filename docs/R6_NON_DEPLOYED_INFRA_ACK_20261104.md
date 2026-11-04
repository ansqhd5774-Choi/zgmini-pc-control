# R6 Controller update: non-deployed infrastructure ancestry acknowledgment (2026-11-04)

Scope: The already-committed workflows below exist in Git history between the installed Controller `6406ff105c8646a4af5e59d98a42e77022437ea4` and the next Controller target. They are **not** staged or executed by the independent Controller updater, whose deployed paths are only `controller/`, `config/`, and `host.json`. This file records their exact committed bytes for the existing updater's `infrastructureEvidence` verifier; it does not approve executing any workflow, modifying any PC operational DB, or changing any existing source. Existing feature-specific B approvals remain independent.

Related pre-existing approvals in the repository: `ER1_*_B_APPROVAL.json`, `INFLATION_SCE31_B_APPROVAL.json`, and the AI software V2 registration approval. R6 diagnostic and telemetry changes: merged PR #230. Shared Controller installation must continue to enforce every changed controller/config file hash, current Host SHA, preflight, backup/rollback, six Runner reconnection, and protected state.

| Non-deployed committed file | SHA-256 |
|---|---|
| `.github/workflows/pc-ai-software-v2-register-once.yml` | `a874ebada958c2efb91c85b91c7652c0abcd6cfb7db153259500b29c4f4ba2ac` |
| `.github/workflows/pc-er1-approved-once.yml` | `d5acad0b8dfa0da24b851eb7bb01025769f0e582029444f9772cb3f86919f4b2` |
| `.github/workflows/pc-er1-dec31-capture.yml` | `c627ec35fdf51f244218748d15eb33c7307e83020734cc80d5e7a12a62685517` |
| `.github/workflows/pc-er1-dec31-derived-score-v1.yml` | `fc07a27c7febcba635aecf6ab4d01889ed0ef5a49cd554b16ddaa466f4cb4576` |
| `.github/workflows/pc-er1-dec31-derived-score-v2.yml` | `c721b92c8a5a2dea5ff7eb255cbbd982153d8787b8159789a2a83f93bb98a52d` |
| `.github/workflows/pc-er1-dec31-html-publish-v2.yml` | `d8c56740b1eaf555deca3556f395ce5814ddf1cdea04b4d5b5842ed5d6508fdf` |
| `.github/workflows/pc-er1-dec31-html-publish-v3.yml` | `2c592e7d43a4afbc42774b837b78509ddd391149bbc6bca9e313fc3e70e02a61` |
| `.github/workflows/pc-er1-dec31-html-publish.yml` | `ac90c4303b7e82ed0e0596b32434e88b434f4b8eea30c8cc83e417ed60932b12` |
| `.github/workflows/pc-er1-dec31-symbol-batch-a.yml` | `bbbe72b99b7061cfdb16325a4e0367c6fc12d0de46dcd045bed008aa62a2ab2f` |
| `.github/workflows/pc-er1-dec31-symbol-probe.yml` | `e4cd0cdffa14ba5897b143a7f1e526c22defb068ee8480ba65bf34138387f401` |
| `.github/workflows/pc-er1-nov30-capture.yml` | `4b1cebacaadb896b378c9725ebbf91f18f594c8c5bb7404be868f508841b8d1a` |
| `.github/workflows/pc-er1-nov30-html-publish.yml` | `501752e38f3ded3b78239a577f544dcde93de2ddc6a38751c45bec7bbef7be02` |
| `.github/workflows/pc-inflation-sce31-approved-once.yml` | `313c748bbf57a2d11a9ad91e8d7652832ce577d4a7e53c67cb1c9048daea2d81` |
