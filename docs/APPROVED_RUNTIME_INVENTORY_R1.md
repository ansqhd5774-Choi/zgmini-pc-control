# Reusable A/light approved runtime inventory (local prototype)

This isolated prototype does **not** modify existing ZGMINI Controller operations,
production PC files, GitHub branches, jobs or Task Scheduler entries.

## Source and trust boundary

- `controller/approved-runtime-inventory-readonly.mjs` exports the stable
  `inspectApprovedRuntimeRegistry({dataRoot,queryTask,manifestBytes,approvedManifestSha256})`.
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
- Install **one** operation such as `approved-runtime-inventory-readonly`
  (`grade: A`, `resource: light`) and wire it once to the stable receiver.
  Adding a feature then updates the independently approved declarative registry
  and its trust pin, **not** `controller/operations.mjs` per-feature branches.
- The receiver inspects up to eight named profiles, with fixed relative roots,
  selectors and task names. It never scans recursively and never returns raw
  file, environment, command, arguments, Task XML or configuration content.

## Registry shape (example, not an approved PC installation)

```json
{
  "schema": "ZGMINI_APPROVED_RUNTIME_INVENTORY_PROFILES_V1",
  "profiles": [
    {
      "id": "themeTool",
      "rootSegments": ["pc-writer", "theme-config-tool"],
      "files": [
        {"key": "install", "relativePath": "INSTALL_RESULT.json"},
        {"key": "schedule", "relativePath": "THEME_SCHEDULED.cmd"}
      ],
      "directories": [{"key": "backup", "relativePath": "backup"}],
      "tasks": [{"key": "scheduled", "name": "ZGMINI-PC-ThemeSchedule",
        "expectedCommandBasename": "THEME_SCHEDULED.cmd", "expectedHour": 13}]
    }
  ]
}
```

These paths/task names are examples and must be verified against actual
approved host registration before adding a production registry profile.

## Guarantees, scope and limitations

- Read-only: file `lstat`, `realpath`, bounded read+SHA, Task XML query only.
  Zero operational file/DB/D1 writes. The existing Controller outer run/ledger
  continues to write its own audit artifacts as usual.
- Missing root/file/directory is reported as `exists:false`. An attempted
  symlink/junction/reparse-like redirect, unsafe selector, credential-like
  filename or unapproved registry hash is rejected, not silently followed.
- Task metadata is only whether XML was queried, expected fixed command
  basename/hour matches, enabled boolean, and XML SHA-256. It does not claim
  actual Task last-run status, installation PASS or any B-level permission.
- Each file >8 MiB is marked `SIZE_LIMIT`, Task XML >256 KiB cannot be parsed,
  registry >16 KiB is rejected, and nested inventory output >20 KiB is rejected.
- The installed current `host.json` does **not** yet expose
  `approvedRuntimeInventorySha256`. Until a separately reviewed B-grade
  config-only update sets this field, the stable A receiver returns clean
  `BLOCKED/APPROVED_INVENTORY_NOT_REGISTERED`. A missing external registry
  yields `BLOCKED/APPROVED_INVENTORY_REGISTRY_ABSENT` and a changed unapproved
  registry yields `BLOCKED/APPROVED_INVENTORY_REGISTRY_DRIFT`.
- Changing a pin is itself a **B-grade** trusted approval state transition;
  the actual secure host-PIN config-only update path **remains unimplemented**.
  That is an integration prerequisite, not a reason to re-install Controller
  source for each new content feature.
- This is a portable module and tests, **not** a completed integration into
  the live Windows Controller. Integration needs the current operation
  allowlist and stable dispatcher branch updated once, plus Windows smoke
  proof of reparse handling and full installed Controller report size.
- Receiver result is capped at **20KiB** to leave overhead for the Controller
  GitHub envelope's 32KiB bound; the exact assembled report must still be
  verified on real Windows before broad rollout.

Run: `node --test theme-generic-a/tests/*.test.mjs`
