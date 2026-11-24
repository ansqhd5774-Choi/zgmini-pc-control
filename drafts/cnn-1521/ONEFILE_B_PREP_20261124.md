# CNN #1521 — exact one-file Controller B install preflight (proposal only)

- Target commit: `45682a7dcc62c801f3ba903b639a2eacce242d68`
- Parent installed-source SHA (historical runtime evidence): `b9a423cf38d0967d6ed336912a66433f79502d3d`
- Exact changed deployable file: `controller/fear-greed-archive-readonly.mjs` (13 additions, 2 deletions; no other changed paths)
- Git blob SHA: `f59e4ea5e239a63dc66cf00090a08500596cadaf`
- Raw UTF-8 SHA256: `4f125e65131b3a666dc9c28b8de3a83bbaf29471c27dbc77b646f8ebdfb5cad0`
- Manifest allowFiles fingerprint SHA256: `247268aabb409aae9fa4255d0628b652fe366594e43c9e08d6bde4954485de8b`
- One-file source branch: `codex/cnn-1521-b9-exact-onefile-diagnostic-20261124`.
- Existing isolated Windows CI: https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/45304444636 (focused CNN hash fixture and surrounding groups PASS). Original full fixture 4 Windows symlink EPERM failures remain explicitly excluded from that PASS.

## Strict operational gates (not authorized by this draft)

1. Human review and merge of **exact** single-file B proposal plus corresponding immutable selective pin; review linked to this PR and its contents. Do not treat opening this draft as B approval.
2. Read actual installed Controller SHA, installed diagnostic preimage bytes, active lease/owner and current maintenance/Writer health; historical #2960 is not a fresh lease check.
3. Require installed SHA exact `b9a423cf38d0967d6ed336912a66433f79502d3d`, no competing shared installation, successful independent Windows source/CAS/allowFiles/backup/rollback preflight and matched approval manifest raw bytes.
4. Only then submit the existing maintenance Receiver's approved B effect **once** and verify independent postcheck. Never use PC runner shell, force stop, direct file overwrite, renewal of schedules, or manual CMD.
5. Read-only `fear-greed-archive-status` once, distinguish the recognized Sidecar script SHA from the actual protected runtime source/approval gate; independently verify the exact failure before any separate Sidecar fix.
6. Recover verified real CNN intraday observations (2+ distinct timestamps) through SQLite→D1→public GET→1D/1W PC and mobile; leave #1521 open until end-to-end evidence.

## Prohibited transformations

Do not merge historic b9 branch or this one-file branch wholesale into current main, do not import the older diagnostic source to current main, do not replace current main's composite/SQLite diagnostics, do not claim source-only CI proves production. This PR carries metadata only.

## Status

PREPARED_FOR_REVIEW / NOT APPROVED / NOT INSTALLED. Operational DB/D1/Writer/Controller/Tasks/Provider/cron changes: 0.
