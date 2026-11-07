# Reusable A/light approved runtime inventory (local prototype)

This draft PR adds a **one-time** generic Controller operation in source, but has not been installed on a Windows PC. Existing operational files, tasks and databases remain unchanged.

## Source and trust boundary

- `controller/approved-runtime-inventory-readonly.mjs` exports the stable
  `inspectApprovedRuntimeRegistry({dataRoot,queryTask,manifestBytes,approvedManifestSha256,requestIdentity})`.
- `dataRoot` and `queryTask` must be provided by the installed Controller, not an
  Issue author. The entire `manifestBytes` is read from a B-maintenance-owned,
  approved local registry file; its SHA-256 is pinned **separately** in trusted
  host/approval metadata. Merely embedding a SHA in the manifest itself is not approval.
- The production adapter reads the registry at a **fixed path outside the
  Controller checkout**: `<host.dataRoot>/pc-writer/controller-approvals/approved-runtime-inventory-profiles.json`.
  There is no path override in host settings or Issue JSON. B-grade registration
  adds/replaces the registry, then independently sets the protected
  `host.approvedRuntimeInventorySha256` pin. Both need exact before/after
  approval, backup, CAS and rollback under the established B-maintenance lane.
- Keep the `pc-job` Issue JSON contract at exactly seven existing keys; do not
  add `profileId`, path, Task name, registry URI or arbitrary argument to it.
  The already validated `sourceRepository`, `sourceBranch` and `sourceSha`
  select only profiles whose **PIN-approved** `binding` exactly matches all
  three values. Possessing a source SHA alone never grants inventory access.
- Install **one** operation such as `approved-runtime-inventory-readonly`
  (`grade: A`, `resource: light`) and wire it once to the stable receiver.
  Adding a feature then updates the independently approved declarative registry
  and its trust pin, **not** `controller/operations.mjs` per-feature branches.
- The registry can contain up to **128 named profiles**, but the receiver
  inspects only **one to four** profiles sharing the exact approved source
  identity. Other profiles are never traversed or returned. It uses fixed
  relative roots, selectors and task names, never scans recursively, and never returns raw
  file, environment, command, arguments, Task XML or configuration content.
- **One shared A/B capability registry:** an entry may additionally have
  `bundleProfile`. The A receiver strictly checks its inert field types,
  fixed shape and bounds, but never queries, executes, exposes or interprets
  B-specific home/launcher information. A separate approved B receiver must
  validate the full operational contract against the installed PC and the
  same PIN-approved registry bytes before performing any mutation.

## Registry shape (example, not an approved PC installation)

```json
{
  "schema": "ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1",
  "profiles": [
    {
      "id": "themeTool",
      "binding": {
        "sourceRepository": "ansqhd5774-Choi/zgmini",
        "sourceBranch": "codex/theme-fear-greed-integration-20261025",
        "sourceSha": "1111111111111111111111111111111111111111"
      },
      "rootSegments": ["pc-writer", "theme-config-tool"],
      "files": [
        {"key": "install", "relativePath": "INSTALL_RESULT.json"},
        {"key": "schedule", "relativePath": "THEME_SCHEDULED.cmd"}
      ],
      "directories": [{"key": "backup", "relativePath": "backup"}],
      "tasks": [{"key": "scheduled", "name": "ZGMINI-PC-ThemeSchedule",
        "expectedCommandBasename": "THEME_SCHEDULED.cmd", "expectedHour": 13}],
      "bundleProfile": {
        "id": "themeTool",
        "home": "E:\\ZGmini\\data\\pc-writer\\theme-config-tool",
        "taskName": "ZGMINI-PC-ThemeSchedule",
        "taskTime": "13:00",
        "requiredLaunchers": ["THEME_SCHEDULED.cmd"],
        "optionalLaunchers": ["THEME_LIST.cmd", "THEME_REGISTER.cmd"],
        "activeRecord": "ACTIVE_RUNTIME.json",
        "maxFiles": 128,
        "maxBundleBytes": 16777216
      }
    }
  ]
}
```

These paths/task names and SHA are examples, **not** approved identities. Actual
values must be verified against approved host registration before use.

**Version decision:** `ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1`
(unified A/B schema) supersedes the prototype inventory-only V2. Each profile
has one `id` and one source binding; the optional `bundleProfile.id` must equal
the parent profile `id`. The B writer must update only the selected profile
through its independently protected B transaction, preserving all other
entries, and journaled, separately CAS the external registry and trusted host PIN with backup/readback/reverse rollback. This is **not** an atomic two-file operation.
Current A code is a read-only consumer and does not implement this B transaction.

## Guarantees, scope and limitations

- Read-only: file `lstat`, `realpath`, bounded read+SHA, Task XML query only.
  Zero operational file/DB/D1 writes. The existing Controller outer run/ledger
  continues to write its own audit artifacts as usual.
- Missing root/file/directory is reported as `exists:false`. An attempted
  symlink/junction/reparse-like redirect, unsafe selector, credential-like
  filename or unapproved registry hash is rejected, not silently followed.
- Windows device basenames (`CON`, `NUL`, `PRN`, `AUX`, `COM1`–`COM9`,
  `LPT1`–`LPT9`, including suffixes such as `CON.cmd`) and trailing-dot
  path/launcher/Task names are rejected before filesystem access.
  Required/optional launcher names are de-duplicated case-insensitively.
- Task metadata is only whether XML was queried, expected fixed command
  basename/hour matches, enabled boolean, and XML SHA-256. It does not claim
  actual Task last-run status, installation PASS or any B-level permission.
- Each file >8 MiB is marked `SIZE_LIMIT`, Task XML >256 KiB cannot be parsed,
  registry >128 KiB is rejected, and nested selected output >20 KiB is rejected.
- No source-identity match yields `BLOCKED/APPROVED_INVENTORY_SOURCE_UNREGISTERED`.
  Five or more profiles matching one identity yields bounded
  `BLOCKED/APPROVED_INVENTORY_SELECTION_TOO_LARGE`. This is an **explicit future scalability limit**, not a current feature blocker; before registering five or more on a shared SHA, implement approved bounded pagination/selection without changing the seven-field Issue contract. A source revision needs
  an exact new binding approved through B maintenance, but never a new
  per-feature Controller code branch or full Controller source installation.
- The installed current `host.json` does **not** yet expose
  `approvedRuntimeInventorySha256`. Until a separately reviewed B-grade
  config-only update sets this field, the stable A receiver returns clean
  `BLOCKED/APPROVED_INVENTORY_NOT_REGISTERED`. A missing external registry
  yields `BLOCKED/APPROVED_INVENTORY_REGISTRY_ABSENT` and a changed unapproved
  registry yields `BLOCKED/APPROVED_INVENTORY_REGISTRY_DRIFT`.
- Changing a pin is itself a **B-grade** trusted approval state transition;
  a narrow host-PIN + registry **prototype** with offline tests now exists in
  `writer-b/approved-versioned-bundle/approved-registry-cas.mjs` and its
  `windows-registry-pin-adapter.mjs` candidate, but the current installed
  Windows Writer B still **does not implement or authorize** that effect.
  That is an integration prerequisite, not a reason to re-install Controller
  source for each new content feature.
- This is a portable module and tests, **not** a completed integration into
  the live Windows Controller. Integration needs the current operation
  allowlist and stable dispatcher branch updated once, plus Windows smoke
  proof of reparse handling and full installed Controller report size.
- Receiver result is capped at **20KiB** to leave overhead for the Controller
  GitHub envelope's 32KiB bound; the exact assembled report must still be
  verified on real Windows before broad rollout.

Run: `node --test tests/approved-runtime-inventory-*.test.mjs`
