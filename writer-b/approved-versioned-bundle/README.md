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
| isolated-windows-fixture-adapter.mjs | Real Node fs CAS/backup/journal/rollback, hard-locked to disposable TEMP test fixture | Fixture only |
| isolated-windows-fixture-adapter.test.mjs | End-to-end fixture I/O and fault injection | Fixture only |
| approved-registry-cas.mjs | Pure two-file host PIN + shared A/B capability registry B-CAS coordinator | None |
| approved-registry-cas.test.mjs | In-memory byte-preserving patch + failure/rollback/bootstrap | None |
| pinned-bundle-profiles.mjs | Maps the same PIN-verified A/B registry to B profile contracts | None |
| pinned-bundle-profiles.test.mjs | Tests shared A parser, source binding, A-only exclusions | None |
| windows-versioned-bundle-adapter.mjs | Capability-injected Windows receiver bridge **candidate**; no live integration | None without separately authorized bridge |
| windows-versioned-bundle-adapter.test.mjs | Receiver bridge contract, post-lock reparse/handle checks, immutable reuse and schedule-race faults | Simulation only |

Neither generic planning/coordinator module invokes shell, filesystem,
GitHub, SQL or Task Scheduler.
The injected adapter is trusted code **only** from the installed and approved
common B receiver. The Issue/manifest cannot supply adapter functions.

The separate isolated-windows-fixture-adapter.mjs intentionally DOES use
Node filesystem calls, but refuses all locations except a top-level
marker-bearing zgmini-b-fixture-* directory inside the OS TEMP folder.
It simulates Task XML with local fixture files; it never calls Windows Task
Scheduler, fetches approvals, runs .cmd/.vbs/.mjs, or opens a production PC
path. Its locally injected approval is a **test simulation**, not a real
GitHub authorization proof.

## Windows adapter contract: CANDIDATE ONLY, NOT INSTALLED

A capability-injected candidate is included for review. Its required
`bridge` methods are obligations of an independently authorized Windows
receiver, **not proof that the actual Windows receiver supports them**.

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
   No staged code execution. Never overwrite an existing immutable version.
   If a failed activation left an immutable version, exact name/count/content
   hashes may permit read-only reuse under a fresh, separately approved
   request ID; any drift is an immediate stop. Orphan staging/journals need
   owner-confirmed recovery, not an unconditional delete.
6. backupPreimages: preserve exact bytes plus ACL/attributes and same-volume
   durable journal for all target launchers and active JSON. A partial/unknown
   backup must retain ownership and journal, not be silently discarded.
7. casActivate: immediately rehash each preimage, then atomic **per-file**
   rename of approved launchers and active marker in journaled sequence.
   Multiple files do not have whole-bundle atomicity on NTFS. In particular,
   the existing Task Scheduler may start a launcher **between** two renames,
   regardless of the Writer B lock. Before installing, prove each old/new
   launcher combination is safe and the active pointer switches last, with
   schedule-tick interleaving simulation plus real Windows evidence. If not,
   do not activate. Leave Scheduled Task XML unchanged.
8. readBack: inspect actual launchers, active JSON and all bundle hashes
   after cutover; re-check unchanged Task XML and metadata.
9. commit: seal durable journal; failure/ambiguous commit is STATE_UNKNOWN
   with retained lock, never a safe automatic retry.
10. rollback and verifyRollback: only exact journal-owned targets, CAS
    restore from same-volume backups and prove real byte-for-byte state;
    failure is STATE_UNKNOWN with lock/journal held for authorized recovery.
11. releaseSharedWriterLock: only after PASS or verified rollback.
12. recordResult: JSON and TXT artifacts, preserving user secrets, no
    unbounded source payloads. A committed file mutation with incomplete
    report artifacts is **not end-to-end DONE**: consumer must require
    `status=PASS` **and** `reportStatus=JSON_TXT_2_OF_2`. Both coordinators
    expose `endToEndDone:false` and `evidenceRecoveryRequired:true` for a
    committed mutation with incomplete JSON/TXT, and the receiver must
    recover missing results from the existing committed journal without
    reapplying B or reusing a consumed request ID.

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

## Distinct A inventory PIN / registry sidecar issue

An A operation may require a paired approved runtime-inventory digest in
host.approvedRuntimeInventorySha256 and a controller approval registry
sidecar. These are **not** versioned-bundle launcher/active-pointer targets.

The current control repo main Writer B operation authorizes only .mjs
source overlay. Its independent source-bundle B operation is restricted to
the approvedSources registry entry in host.json; it cannot alter the
runtime-inventory PIN or the approved capability profiles sidecar.
Treating either as a bundle file or injecting an operation into pc-job
would cross authorization boundaries. A new **small common B effect**
requires explicit approval, not a new ad hoc script:

1. Fixed exact host path and fixed existing registry sidecar path, checked
   against installed controller host/config. No arbitrary file path from
   Issue payload.
2. Approved exact old SHA256 and new SHA256 for both operational files,
   plus an approved runtime-inventory content hash and registry scope.
3. Patch only host.approvedRuntimeInventorySha256. Preserve all other
   host fields/values and their exact raw bytes outside this one field
   (or require a separately approved one-time migration if absent).
4. Patch only one explicitly approved A/B capability registry profile,
   preserve all other bytes; validate the exact common schema through the
   same read-only parser as the installed Controller A route.
5. Use the SAME Writer B lock, one-shot request claim, same-parent ACL
   backups, fsync, CAS, staged atomic per-file replacement, durable
   journal and reverse rollback, and JSON/TXT 2/2 remote readback.
6. The approval must pin both effects as ONE recoverable transaction;
   partial success must not be reported as PASS. Never default to
   replacing whole host.json with a newly generated template.

**One registry, one approval:** the shared sidecar schema is
ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1, with profiles[] entries
containing id, binding (source repo/branch/SHA), rootSegments, A files,
directories, tasks and optional bundleProfile B metadata. A validates
but does not execute/return B metadata; B reads that same raw PIN-verified
file, applies separate B semantics, and projects approved bundleProfile
entries into the versioned-bundle planner. A-only entries cannot activate
a B install. New content adds one approved profile to the same file,
not two independently registered profiles or receiver code rewrites.

The registry itself may be missing on the first approved registration.
Only a real read-only absence observation plus explicit approval of
registryBeforeSha256=null and oldPin=null authorize first-create. The
receiver must use CREATE_NEW/no-overwrite and journal the original ABSENT
state; recovery removes only the transaction-created file after exact
CAS. Existing files always require exact old SHA, security-preserving
backup and rollback. Missing due to access error must NOT be treated as
absent.

If an existing registry has bytes but the host PIN is absent, the ordinary
registration operation MUST refuse to adopt it. Pinning its existing SHA
would implicitly approve all unrelated profiles; this needs a separate
orphan-recovery approval scope and complete registry review. Valid ordinary
registration states are either both old PIN and registry absent (bootstrap)
or old PIN exactly equal to the existing registry raw SHA256.

This remains LOCAL pure source/tests only, and the exact installed host
path/registry path and current PIN state MUST be observed through an
authorized A/read-only inventory before any real B approval. No live
Windows receiver, actual Git provenance or PC activation is claimed.
