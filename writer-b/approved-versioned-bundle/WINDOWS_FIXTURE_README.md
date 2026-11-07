# PIN + approved runtime registry CAS — isolated filesystem proof

**Status: test-only fixture adapter. NOT an approved or installed Windows B receiver.**

This folder tests the narrow proposed B-grade operation
`HOST_RUNTIME_PIN_AND_REGISTRY_BYTE_CAS_ONLY`. It does not expand the
existing source-only Writer B approval, run a command, query a Task,
create a Scheduled Task or touch PC operational files.

## Fixed effects

- Only a receiver-resolved `host.json` **single** top-level
  `approvedRuntimeInventorySha256` value can change. Every other host JSON
  field and byte is retained by the parent pure coordinator.
- Only the pinned `approved-runtime-inventory-profiles.json` registry can be
  replaced. The parent coordinator validates the exact SHA-approved registry
  afterimage and requires a **single approved profile change**, preserving
  all unrelated registry bytes, identities and profile entries.
- Both files must have pinned before/after raw SHA-256 hashes and be backed
  up in their respective directories before the first CAS switch. A verified
  **first registration** may specify registry-before `null` only when the
  actual file is absent and the old host PIN is also `null`; it then uses an
  exclusive create with no overwrite. If the registry already exists, its
  before SHA must agree with the existing host PIN. Orphaned/mismatched state
  must stop, not auto-adopt.
- The existing Writer B shared lock is modeled at one fixed fixture path.
  An actual implementation must reuse the already installed shared lock;
  it must never create a parallel independent Writer writer lane.

## Verified here

The adapter uses actual local Node file operations, but accepts only a
top-level directory directly below `os.tmpdir()` whose basename begins with
`zgmini-b-pin-fixture-` **and** contains the exact fixture marker. A requested
root outside that scope is rejected before any mutation. The paths for host,
registry, lock and journal are constant; Issue-provided paths are impossible.

The test suite exercises:

1. Approved bytes: immutable file hashes, durable journal, same-folder
   security-mode-preserving backup, per-file fsync/CAS and readback, result
   JSON/TXT pair.
2. Failure after the host switch: byte-identical rollback, registry unchanged.
3. Failure after both switches: registry-first then host rollback.
4. Ambiguous partial backup: `STATE_UNKNOWN`, original files unchanged,
   exact shared lock and journal retained for authorized recovery.
5. Forged approval hash: no lock or operating fixture changes.
6. Symlink escape and unmarked directories: rejected; external file unchanged.
7. Initial registry absence: explicit `null` approval, create-exclusive,
   exact target readback, no preimage backup for nonexistent file.
8. Bootstrap creation fault: original ABSENT restored, transaction-created
   file removed only after exact after-SHA comparison.
9. Consumed request ID: prior journal denies a second lock claim without
   leaving a leaked writer lock.

Run locally: `node --test windows-b-receiver/*.test.mjs`.

## Unproven and forbidden until separately approved

- Actual GitHub Issue actor, event commit, immutable approved manifest raw
  hash and source SHA authentication. The local adapter uses a **fixture
  oracle**, which is not production authorization.
- Correct live Windows `host.json` location, approved registry location,
  ACL/SID preservation through `CopyFile`, NTFS reparse/junction behavior,
  atomic rename semantics and reboot/crash journal reconciliation.
- Existing common Writer B receiver integration, workflow operation routing,
  one-shot lease and exact B approval effect. The current B contract only
  permits `.mjs` source overlays and therefore cannot execute this effect.
- Real PC preimage A, actual B installation, result upload/re-read 2/2,
  or subsequent feature D1/API/UI output verification.

The actual Windows receiver must additionally prove full Windows ACL
equivalence (`icacls` or equivalent), ownership, backups and directory
durability; a POSIX mode comparison does **not** prove that. Fixture PASS is
not Windows PASS. The correct implementation should live inside the
separately approved shared Writer B receiver and consume only manifest/pin
data from the **same single approval registry** used by the generic A reader.
