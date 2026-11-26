# ZGMINI R3 — exact installed-base selective Controller B

**Scope:** One operating PC, Active Supervisor 1 + passive Standby 1. Source/contract work only; no PC installation.

## Current exact target

| Evidence | Value |
|---|---|
| Observed operating Controller source | `53fe24e22446d21a9fd4ee308d12b7cba7f37e25` ([#3746](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/3746)) |
| Immutable selective target | `b91340d5047daf753e1c17a5c966e4d2aecea586` |
| Target branch | `codex/controller-standby-selective-r3-minimal-20261126` |
| Exact sole parent | `53fe24e22446d21a9fd4ee308d12b7cba7f37e25` |
| Allowed diff | `controller/{common,engine,entry,operations,standby,supervisor}.mjs` only |
| Main provenance pin | `f09f5a5510bd11e6e6f869ea1728d940939a5e59` |
| Reviewed primary source | [#3738](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3738), HEAD `c0c4dcff6c8071b1318cca956e43ba82718c4975` |

This target uses exact #3738 blobs for `common`, `engine`, `entry`, `standby`, `supervisor`. **The sixth file, `operations.mjs`, is a minimal patch of the observed installed file only**, exporting the constant needed by `engine.mjs`:

```js
export const CORE_STATUS_STAGES=Object.freeze([
 'CORE_STATUS_ENTERED','CORE_LOCK_READ','CORE_CHECKPOINT_CYCLE',
 'CORE_CHECKPOINT_COLLECTION','CORE_CHECKPOINT_WRITER','CORE_CONFIG',
 'CORE_TASK_HASHES','CORE_STATUS_DONE'
]);
```

The actual six-file Git diff from the installed parent shows `operations.mjs` changed by only 6 lines; no unrelated R6 diagnostic, data calculation or collection changes are imported. The existing `core-status` operation remains valid and the extra timeout-stage observation is optional if the old operation does not emit a marker. `config/operations.json`, Controller's six-seat policy, Watchdog, workflows, Runner/Worker binaries, Writer, DB and D1 remain exactly as installed.

## Why earlier candidates were rejected

- **Five-file `8da8834d...`:** missing import export — new `engine.mjs` imports `CORE_STATUS_STAGES`, installed `operations.mjs` does not export it. Must not be installed.
- **Six-file `8c4d5234...`:** importing the complete source `operations.mjs` from #3738 also imports unrelated R6/Core diagnostic changes, not needed for Standby. Must not be installed.
- The associated old approval candidates and main pins were deleted from this PR. Their immutable Git commits remain provenance only, not approved targets.

## Existing B route and exact stop conditions

The independently installed maintainer `9a0378ffb96aa9f1403f74c189d3c39b30e4604e` supports `selectiveSource`, strict installed-parent target, main-hosted pin, customPaths, exact six-file diff, import closure, stable config, backup/versioned restoration and existing `core-status` postcheck. Current candidate approval PR [#3752](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3752) is Draft, with exact allowfiles and raw manifest fingerprint; it is **not** an executed B request.

- Source under review #3738 is still Draft. Its exact HEAD had 4/4 CI (including isolated Windows TEMP 11/11 + IPC 5/5); this is not operating failover proof.
- Actual Windows WMI process-path/old Runner.Listener descendant classification remains unverified. A new operating B cannot be called complete without current lease/installed source, an approved main manifest, Guardian/Watchdog standby transition contract, six Runner readback, protected-source readback and rollback.
- Watchdog B R4 source already merged separately via #3751, but its `approved:false` manifest remains disabled; Controller must be installed and read back first.
- No force push, reset, blanket upgrade, extra Runner/service, independent schedule, DB/D1 or Core lock mutation permitted.

The intended next step is exact-head CI validation of this PR's contract, then provenance/import-closure verification for the **minimal** overlay before consideration of a protected operating Controller B.
