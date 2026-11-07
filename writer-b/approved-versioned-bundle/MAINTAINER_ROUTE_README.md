# Generic B maintainer route — source-only integration candidate

**Uninstalled / unapproved**. Existing source-only Writer B authority does not
authorize `host.json` PIN changes, capability registry creation, or versioned
108-file bundle activation. This directory has no CLI/Workflow/PC entrypoint.

## Read-only main evidence (2026-11-08)

- `tools/maintenance-agent.mjs`: `pollOnce` lists `pc-maintenance` Issues
  and filters four fixed titles. `processIssue` parses a seven-field Issue,
  dispatches those four operations only, and routes to fixed `update.mjs`
  subcommands. Its pre-existing ID grammar is a lowercase slug, **not** the
  RFC UUID required by shared Writer B. It maintains a one-shot request ledger,
  upload recovery and result comment rules; those are not optional.
- `tools/update.mjs`: only old fixed `source-bundle-*`, `r54-b-*`, `host-r6-*`
  and controller apply/status commands. Nothing currently routes PIN CAS or
  versioned activation. `tools/maintenance-contract.mjs` and the installed
  updater's own status/ledger also require explicit changes.
- `tools/maintenance-agent.mjs::verifyInstalledTools`: exact seven installed
  file SHA manifest, `MAINTENANCE_INSTALL.json` and Startup/ancestry proof. A
  new imported module is **not installed** by a GitHub PR or main commit.
- `writer-b/contract.mjs`: `pc-writer-source-install` approval only, limited
  to 1–32 .mjs source edits. No non-source PIN/registry, 108-file activation,
  schedule or arbitrary B extension. Existing workflow remains unaffected.
- Existing maintainer `atomicReplace` is scoped to its own request ledger,
  receiver status and report bookkeeping. No observed generic operation that
  recursively cleans unrelated `dataRoot/pc-writer/*.json` files. This is a
  source-scope observation, not real PC runtime evidence.

## This candidate

`approved-generic-b-route.mjs` is an import-only, effect-closed dispatcher.
The Issue holds **only** `schema,requestId,chatId,operation,controlRepository,
expectedInstalledReceiverSha,approvalManifestSha256` (UUID v1–8, RFC variant). Both
`pc-maintenance` and a new exact B label must be present so the existing
poller can still discover requests. The Issue never supplies `path`, `task`,
`shell`, `mode`, `fileCount`, `sourceSha`, or effect selector.

1. Installed independent receiver must attest its exact installed SHA,
   control-source commit SHA and private repository status.
2. Independent durable request ledger reports `NOT_CLAIMED`; any prior or
   uncertain attempt returns for reconciliation, never replays.
3. Approval bytes are fetched from immutable control commit at the fixed
   `approvals/approved-runtime-b/<rawSha256>.json` path and byte-hash verified.
4. A *separate owner/effect verifier* proves owner Issue, reviewed merged B
   approval, immutable source, exact source SHA, effect scope and source
   provenance. No default verifier or generic `true` approval is supplied.
5. Only the approved manifest schema selects the existing pure `PIN CAS`
   coordinator or the existing generic versioned-bundle coordinator. The
   adapter is created from installed trusted fixed paths and runtime evidence,
   never from Issue JSON. Both use the same shared Writer lock contract.

`maintenance-agent-generic-b-hook.mjs` is a tiny optional branch which leaves
all four existing Issue titles untouched. Its presence grants NO capability:
calling it requires the above installed/approved injected dependencies. Its
handler is **intake-only** (`approvedRoute.receive`): approval/package identity
is checked and the *existing fixed `tools/update.mjs` CLI* is called. The
actual PIN CAS/versioned effect route is imported only by the installed
updater, not executed inside the maintenance-agent poll loop.

`maintenance-agent-integration.patch` is the **unapplied 18-line-source
candidate** against main `tools/maintenance-agent.mjs`. It adds one new
opt-in Issue title in `pollOnce`, short-circuits that title before the legacy
slug-ID parser in `processIssue`, and accepts an injected handler defaulting
to `null` (new Issue then `B_ROUTE_NOT_INSTALLED`). The old four paths are
byte-for-byte unchanged. `git apply --stat` checks the patch format only;
it has not been applied to an installed receiver, nor checked against a full
local main checkout. Do not merge this seam alone: the installed handler,
owner approval and durable status/ledger are **mandatory** before enabling.

The new request intentionally calls its pin `expectedInstalledReceiverSha`
instead of the legacy `targetControllerSha`. In the existing controller
update contract, the latter names a *target controller build*. Here it must
match the *already installed, attested independent maintainer source SHA*;
reusing the legacy name would invite a critical old/new-SHA mix-up.

## Minimum **future** main integration, in order

1. Approve the two narrowly described new B effects and stable shared
   operation contract; review exact manifest schema, immutable source,
   request/actor/permissions, installed registry/PIN source and 108-file
   staging profile. Source-only approval does **not** qualify.
2. Update `tools/maintenance-contract.mjs` with only this operation's
   seven-key UUID envelope and owner/effect authorization. Preserve existing
   lowercase-slug IDs in legacy paths. Add fixed digest-named B approval
   directory to `manifestBytes` and a **bounded 262144 byte limit only for
   bundle B**; do not increase legacy manifest limits globally.
3. Insert `GENERIC_B_TITLE` in `tools/maintenance-agent.mjs::pollOnce`
   summary-title allowlist, and call the installed hook at the **beginning**
   of `processIssue` before its legacy four-title filter/slug parser. Import
   the intake-only hook in the maintenance receiver and the actual route in
   the installed updater; pin both in the verified SHA manifest. Keep its
   existing poller, lease, Origin attestation and report delivery.
4. Implement exact `tools/update.mjs` **fixed** `approved-runtime-b-status`
   and `approved-runtime-b-apply` commands, with installed owner/manifest
   verification and R17 shared Writer B lock, ledger, journal, isolated
   staging, protected source hash check, native ACL/Task readback and CAS
   rollback. No command/path from Issue. Register the pinned output SHA in
   `verifyInstalledTools`, `MAINTENANCE_INSTALL.json` and approved installer.
5. Preserve/reuse existing exactly-once ledger/report reconciliation and
   already-installed handler for old operations. If the new operation returns
   `STATE_UNKNOWN`, retain lock and stop/reconcile. If operation PASS but
   JSON/TXT 2/2 fails, report success of local mutation but **incomplete
   evidence**, never end-to-end DONE. Verify real Windows only after approved
   installation, then return to feature processing. Natural scheduled-run
   validation is a later step, not this installation's preliminary Gate.

The code here is the safe routing *shape*, **not** a complete deployable
updater: it deliberately lacks GitHub fetcher, installed-origin verifier,
durable B ledger, live Windows bridge for the 108-file Task/launcher swap,
the actual installed CLI factory injection, installed hashes and signed/merged
B permission. See `update-integration/` for the fixed CLI candidate and its
one-request vertical DI simulation.
Pretending those are satisfied would be the very permission bypass this
project is removing. They remain explicit integration work.

## Local regression

`node --test receiver-integration/*.test.mjs windows-b-receiver/*.test.mjs
theme-generic-b/*.test.mjs theme-generic-a/tests/*.test.mjs`

Fixture tests mock every private GitHub, Windows and owner-proof operation.
No real Windows/NTFS SID/DACL, Task XML, source-108 checksum, 6 Runner race,
PC installation, D1/API/UI or scheduled execution has been verified here.
