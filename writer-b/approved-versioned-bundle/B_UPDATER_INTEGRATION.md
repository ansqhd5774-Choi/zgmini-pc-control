# Common generic B updater — inactive source-only candidate

This directory contains no executable CLI entrypoint, no GitHub/PC installer,
no Task/Scheduler/DB/D1 writer and no privileged shell. It is a proposed
**narrow extension of the existing independent `tools/update.mjs`**. Existing
four maintenance effects and source-only Writer B permissions are unchanged.

## Main source observation

- `tools/update.mjs::command` currently calls the *legacy lowercase-slug*
  `safeId(args[2])` immediately after parsing arguments (around line 2507).
  A new Writer B UUID would otherwise be rejected **before** a new branch.
- The existing source-bundle, R54, R6, controller `status/preflight/apply`
  branches each have fixed commands and independent permission checks. They
  must retain their exact previous behavior; no new `command` default effect
  may bypass them.
- `tools/maintenance-agent.mjs`'s approved package has five keys:
  `issue,manifest,manifestRawBase64,issueNumber,actor`. The new updater
  independently verifies its exact fixed file path, byte hash and owner Issue;
  retaining all five fields prevents accidental incompatibility.

## Prepared files

- `approved-runtime-b-updater.mjs`: creates a dispatcher with exactly two
  commands, `approved-runtime-b-status` (read-only) and
  `approved-runtime-b-apply` (one-shot delegated approved effect). **All**
  external dependencies are injected by a separately installed, approved,
  source-hash verified receiver; there are no default real PC methods.
- `update-mjs-generic-b-optin.patch`: a proposed minimal `tools/update.mjs`
  seam (9 inserted lines, two replaced) adding only the two new commands
  **before** its existing slug parser. Until a separately installed hook is
  supplied, it returns `B_UPDATE_HOOK_NOT_INSTALLED` without any effect.
  `git apply --stat` validates patch syntax, not deployed installation.
- `approved-runtime-b-intake.mjs`: intake-only, owner-approved package
  creation/readback followed by the **fixed** `approved-runtime-b-status` and
  `approved-runtime-b-apply` argv; it never invokes PIN or bundle effects
  directly. The existing maintainer's opt-in hook must use this **intake**,
  while the actual generic effect route belongs inside `update.mjs`.
- `vertical-integration.test.mjs`: one no-PC DI run through maintenance
  hook → approved package → fixed updater command → generic effect route;
  duplicate request reconciles without second effect.
- `approved-runtime-b-updater.test.mjs`: DI simulation of read-only status,
  trusted fixed package, owner/main/manifest bytes, shared Writer-lock
  contention, no retry on uncertain apply, JSON/TXT completion split and
  ledger readback failures.

## Preconditions checked on every new command

1. Installed independent B receiver status, exact source SHA, origin proof,
   Windows platform, approved fixed dataRoot and Registry/Writer lock targets.
2. UUID request ID; **Issue paths, shell args or arbitrary subcommands denied**.
3. Exact installed `maintenanceRoot/approved/<request UUID>.json` file, raw
   approved manifest SHA-256 and package parsed/raw identity.
4. Live owner-open Issue, existing maintenance and new B label, original
   request identity, private control repo and immutable control commit proof.
5. Durable ledger reports no consumed request; shared Writer lock is not
   held. Inspect again immediately before dispatch. Actual B adapter must
   acquire/recheck the same R17 shared Writer lock itself; updater does not
   create a parallel lock lane.
6. Existing generic B route selects only independently approved PIN CAS or
   versioned-bundle effect from the immutable manifest, with native protected
   preimages, same-directory backup/ACL/fsync, exclusive create, journal,
   exact CAS, bounded rollback, and no Task/XML change outside scope.
7. Local PASS is distinguished from complete evidence: JSON/TXT pair and
   durable updater ledger readback are required for `endToEndDone:true`.
   Ambiguous apply or ledger outcome returns `UNKNOWN`, without another apply.

## Integration gaps — do not operate until separately approved

- The current `tools/update.mjs`/installed maintainer does **not** import or
  invoke this hook. Actual CLI calls `command()` with no options, so proposed
  `approvedRuntimeBHook=null` will correctly return **HOOK_NOT_INSTALLED**
  until the source-pinned factory is explicitly installed. This is a known
  integration **BLOCKER**, not a completed operational connection.
- The required fixed factory (not implemented on the PC) must be statically
  imported by the approved `tools/update.mjs` installer, use the existing
  `verifyInstalledTools(root)`/Startup owner ancestry attestation, and
  compare the module file SHA list in `MAINTENANCE_INSTALL.json` with the
  actual installed bytes. It must wire six installed callbacks to
  `makeApprovedRuntimeBUpdater`, and finally invoke
  `command(args,{approvedRuntimeBHook:verifiedFactory})` **only** for the
  two exact new B commands. It must not accept an Issue-provided module path,
  dynamic import, environment selector, arbitrary shell, or external Task.
- On the maintainer side, the factory must give the new Issue hook a trusted
  `approved-runtime-b-intake` instance, which creates one exact durable
  `approved/<uuid>.json` package and calls existing `updater()` execFile
  (fixed `nodeBinary`, fixed `updateScript`, `safeUpdaterEnv`, shell:false).
  The current main code does not yet provide that injected factory or UUID
  maintenance ledger/status writer; those remain separate approved source
  work. A direct-effect maintainer hook would be the **wrong route**.
- The new handler still requires the installed implementations of
  `installedStatus`, `readRecoveryStatus`, `readApprovedPackage`,
  `verifyLiveOwnerIssue`, `executeApprovedRoute`, and
  `persistAndReadBackResult` with tested durable Windows semantics. Their
  dependency injection in local tests is **not** real authorization.
- The current generic B versioned-bundle Windows adapter depends on approved
  native bridge capabilities (Task XML, safe schedule tick, 108-file staging,
  ACL, immutable source blob/ZIP and rollback). No actual Windows 108-file
  activation or live host.json/Registry proof has occurred.
- Existing old maintenance `source-bundle-status/apply`, `r54-b-*`, `host-r6-*`,
  `status/preflight/apply` and Writer B source-only paths were not altered.
  `update-seam-regression.test.mjs` statically asserts the proposed diff has
  no deletions beyond the entrypoint signature and split of the old `cmd/id`
  line. This does **not** substitute for executing the full real main update
  regression test suite after an approved local checkout/source installation.
- Future naturally scheduled run verification is after functional installation,
  not a preliminary Gate.

Run source-level tests:

`node --test update-integration/*.test.mjs receiver-integration/*.test.mjs
windows-b-receiver/*.test.mjs theme-generic-b/*.test.mjs
theme-generic-a/tests/*.test.mjs`

### Main updater regression scope

- **Confirmed in the downloaded main source:** the existing `tools/update.mjs`
  dispatch cases and their fixed arguments; the proposed diff changes only
  the entrypoint signature and splits `cmd` from legacy `safeId` to check the
  new command before the old parser. The source-only static diff test checks
  the removal/addition set and no change to six named old subcommands.
- **Local executable checks:** generic intake/update/route and Windows
  fixture simulations, including unchanged four old maintenance Issue titles.
- **Not confirmed:** running the actual main 148KB `tools/update.mjs`
  controller/R6/R54/source-bundle regression suite or real Windows installed
  binary/source manifest. The file is not checked out in this scratch tree,
  and no installed receiver was invoked. This remains a required post-approval
  integration verification; do not label the existing updater regression PASS.
