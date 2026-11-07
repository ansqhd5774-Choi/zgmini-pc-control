# Common Writer-B: approved versioned-bundle capability prototype

**Status: LOCAL PROTOTYPE ONLY. Neither approved nor deployed to any PC.**

## Exact integration gap

Current writer-b/contract.mjs in zgmini-pc-control only permits 1–32
approved .mjs overlays in fixed folders. New configured tools may require
108 .mjs/.json/.md immutable files, whitelisted .cmd/.vbs launcher cutover
and an ACTIVE_RUNTIME.json pointer. This exceeds the existing effect scope.
Using an unrelated Runner or arbitrary CMD would be an approval bypass.

The durable solution is a **one-time enhancement to the installed common
Writer B receiver**, routed through its already approved maintenance channel.
After this enhancement, each new tool uses a trusted profile and approved
manifest/config, without new feature-specific receiver code, new Scheduled
Tasks, arbitrary shell execution, or blanket access to filesystem paths.
Registry/profile mutations are independently pinned and approved; their
content never comes from an Issue alone.

## Local implementation

| Artifact | Responsibility | Operational writes |
| --- | --- | --- |
| versioned-bundle-plan.mjs | Exact schema and effect validation, trusted profile and path bounds, version hashes, PLAN_ONLY | None |
| versioned-bundle-transaction.mjs | Shared generic state machine with capability-injected adapter, rollback and fault states | None in prototype |
| versioned-bundle-plan.test.mjs | Manifest negative cases | None |
| versioned-bundle-transaction.test.mjs | In-memory fault injection | None |

Neither module invokes shell, filesystem, GitHub, SQL or Task Scheduler.
The injected adapter is trusted code **only** from the installed and approved
common B receiver. The Issue/manifest cannot supply adapter functions.

## Windows adapter contract: REQUIRED, NOT IMPLEMENTED

1. authenticatePinnedApproval: fetch approved Git ref and actual exact raw
   bytes; verify SHA256, source commit SHA, unique requestId, profile
   registry hash and narrow operation approval. Issue fields alone confer
   no authority.
2. inspectPreimage: read existing Scheduled Task XML and enabled state, exact
   launcher hashes, active record, file roots and version before write.
3. acquireSharedWriterLock: reuse existing Writer B maintenance lock; retain
   per-target collision ownership, not an all-Runner-idle gate.
4. verifyPreimageUnderLock: compare exact preimages again to defeat TOCTOU.
5. stageVerifiedBundle: fetch pinned source bytes, verify each SHA/size
   plus ZIP/package SHA, file count and manifest digest; reject NTFS case
   collisions, reparse points, junction parents, path escapes, file streams
   and unsafe permissions. Stage transaction-owned immutable version only.
   No staged code execution. No replacing existing immutable versions.
6. backupPreimages: preserve exact bytes plus ACL/attributes and same-volume
   durable journal for all target launchers and active JSON. A partial/unknown
   backup must retain ownership and journal, not be silently discarded.
7. casActivate: immediately rehash each preimage, then atomic **per-file**
   rename of approved launchers and active marker in journaled sequence.
   Multiple files do not have whole-bundle atomicity on NTFS, so rollback
   and crash recovery are essential. Leave Scheduled Task XML unchanged.
8. readBack: inspect actual launchers, active JSON and all bundle hashes
   after cutover; re-check unchanged Task XML and metadata.
9. commit: seal durable journal; failure/ambiguous commit is STATE_UNKNOWN
   with retained lock, never a safe automatic retry.
10. rollback and verifyRollback: only exact journal-owned targets, CAS
    restore from same-volume backups and prove real byte-for-byte state;
    failure is STATE_UNKNOWN with lock/journal held for authorized recovery.
11. releaseSharedWriterLock: only after PASS or verified rollback.
12. recordResult: JSON and TXT artifacts, preserving user secrets, no
    unbounded source payloads.

The above steps are **adapter obligations**, not proven Windows operations.
Local simulated tests demonstrate the **ordering, transitions and fault
behavior**, not physical ACL, fsync, Task Scheduler or atomic rename behavior.

## Acceptance steps

1. Review current main AGENTS.md, PC_AUTOMATION_STANDARD.md and existing
   B operation/receiver source; approve the one-time common B capability
   with a pinned profile registry. Do not mutate the old .mjs overlay route.
2. Wire the Windows Node adapter **inside the installed common receiver**
   under the existing authorization and shared lock. New tools use
   config/manifest only, never standalone executable installers.
3. Run a disposable Windows fixture with a 108-file bundle and exact
   artifact hashes. Test actual NTFS paths/ACL, symlinks, Task XML equality,
   multiple launcher CAS and active marker readback.
4. Inject failures before/after every write and simulate process termination
   and reboot; require correct journal recovery, byte-identical rollback,
   no partial public state, and no automatic re-use of consumed IDs.
5. Demonstrate two distinct new feature profiles can use the **same**
   installed generic receiver without changing its executable source.
6. Only with an approved real manifest and PASS Windows results may the
   original feature maintainer perform installation and later actual
   collector -> calculator -> D1 -> API/UI checks.

The one-time enhancement does **not** authorize provider calls, database
or D1 writes, Task creation/modification or arbitrary execution. It does
not alter currently healthy Controller/Core/other features.

Local tests: node --test theme-generic-b/*.test.mjs
