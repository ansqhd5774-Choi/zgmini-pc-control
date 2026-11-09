# Inflation official manual B (source-only candidate)

This is a dormant, one-shot, exact-scope Windows adapter. It **is not** an
installed/registered PC operation and does not change the Core scheduler, DB,
checkpoint, D1, publishing path, credentials or feature formula.

## Intended effect after separate operator authorization

1. Read an explicit `APPROVED_B` manifest from the control repository and
   compare its raw SHA-256 with the owner's private, single-use Issue.
2. Verify the exact installed PC Git HEAD, `config.source`, source module hashes
   **including `local-cycle.mjs`**, and two already-approved feature parsers.
3. Under the shared Writer B installation mutex, GET the two frozen official
   BLS/Census files with finite limits, then parse the actual workbook on PC.
4. Wait for natural Core idle, atomically obtain the same `local-cycle.lock`
   respected by the existing Core, claim the one-shot journal, reverify source
   and lease, archive the official bytes privately and store/read back only:
   - `inflation-causal-candidates-r1/bls-cpi-ppi3.json` (retains PPI `WPSFD4`)
   - `inflation-causal-candidates-r1/census-m3-manufacturing-inventories.json`
5. Release only our owned Core lock; create-only private GitHub result metadata
   (no raw observations, credentials or PC paths), and read back both JSON/TXT.

The official source files are already installed on the approved feature PC,
but their current HEAD/hashes and the **actual** Core lock behavior must be
re-attested at approval time. An unchanged BLS/Census file does not trigger
unnecessary rewriting. A partial mutation keeps the shared Writer B lock and
records exact private recovery metadata; **no automatic retry or rollback**.

## Activation is deliberately absent

- No approval manifest or Issue is shipped.
- GitHub Actions job requires the opt-in variable
  `ZGMINI_INFLATION_MANUAL_B_ENABLED` with the exact value `true`. Do not turn
  it on until an approved B manifest, exact live PC file preimage and explicit
  Core lock lease approval have been reconciled.
- Any unrelated `pc-job`, generic command or scheduled Cron cannot invoke it.
- This PR is a development artifact, **not** a PC installation or data capture.
- The operational objective remains official candidate data storage, then
  existing computation → Writer → D1 → public API/UI verification. The
  publication steps are outside this B adapter's authority.

Local tests: `node --test inflation-manual-b/*.test.mjs`. Windows live
side effects remain untested until the separately approved single-use run.
