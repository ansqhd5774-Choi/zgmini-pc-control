# R3 Controller Standby selective B — exact installed-base overlay

- Controller operating preimage: `53fe24e22446d21a9fd4ee308d12b7cba7f37e25` ([A #3746](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3746)).
- Immutable isolated overlay target: `8c4d5234cb4e4b60c8e057946724ae9438eea471`; **one parent**, the exact installed preimage above.
- Overlay branch: `codex/controller-standby-selective-r3-sixfile-20261126`.
- Approved same-PC feature source is under review in [Standby #3738](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3738); exact source HEAD `c0c4dcff6c8071b1318cca956e43ba82718c4975` had 4/4 CI success (including isolated Windows TEMP 11/11 and IPC 5/5).
- Overlay Git compare: **exactly six** `controller/{common,engine,entry,operations,standby,supervisor}.mjs` changes; `config/operations.json`, all other Controller modules, six-seat policy and all workflows/Watchdog/DB/Writer untouched.
- Source main ancestry basis: `f09f5a5510bd11e6e6f869ea1728d940939a5e59`; all six changed Controller paths are the reviewed #3738 candidate bytes, and are **customPaths** in existing `selectiveSource`.
- Existing independent maintainer `9a0378ffb96aa9f1403f74c189d3c39b30e4604e` supports the strict `selectiveSource` path; the Git target parent, exact main-pinned review, changed path equality, module import closure, backup and restore still require actual updater verification.
- **No operational installation or approval assumed.** This PR is source/contract-only until the reviewed B manifest is integrated, current operating sha/lease checked, and separate Watchdog B `approved:false` is lawfully activated. Read-only WMI live worker attribution is not yet proven. No forced Supervisor/Runner kill or lease cleanup.
- Keep existing `core-status` postcheck source `b6049aac81b3442a58b08050ee138921f87a09e6`, existing versioned rollback to original installed SHA, and independent post-operation readback.

## Import-closure correction (source preflight)

- The superseded five-file overlay `8da8834d5fde333850ad02269ef080cf1de4ce76` **must not be used**. Its `controller/engine.mjs` imports `CORE_STATUS_STAGES`, while the installed `controller/operations.mjs` has no matching export.
- The reviewed #3738 `controller/operations.mjs` exports `CORE_STATUS_STAGES`; its relative import list matches the installed module set.
- Corrected target `8c4d5234cb4e4b60c8e057946724ae9438eea471` has exactly one installed-SHA parent and six Controller-only changes. Exact allowlist, source and rollback pins are regenerated; the rejected five-file pin and manifest are deleted from this PR.
- Since #3738 remains Draft, all six source file hashes are explicitly listed as `customPaths` rather than pretending they are already on `main`.
