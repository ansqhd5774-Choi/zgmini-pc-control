# sqliteq — read-only source reference

This directory is an unchanged reference copy of a small MIT-licensed SQLite job queue implementation.

- Upstream repository: https://github.com/Minnzen/sqliteq
- Pinned upstream commit: `202d9c7e864950bdb0966a5b3d25f22f0c7e229b`
- Source: `src/queue.ts`, `src/types.ts`, `src/processor.ts`, `src/index.ts`
- License: MIT, retained verbatim in `LICENSE`
- Local copy status: **REFERENCE_ONLY / NOT_INSTALLED / NOT_IMPORTED / NOT_ACTIVATED**

The repository's existing GitHub Writer B concurrency group, Controller request ledger, and Windows leases remain authoritative. This copy does not modify their behavior and does not authorize retries, production installation, source changes, or database/schema changes.

Candidate patterns for future, independently approved work are the atomic `UPDATE ... RETURNING` claim, the receive-generation fencing on completion, visibility timeout handling, and bounded dead-letter handling. A production integration must first validate the actual Windows Node/SQLite driver, resume semantics, existing approvals, source SHA/CAS, idempotency, tests, and PC maintenance/recovery state. Never automatically retry B-class changes based only on a queue timeout.
