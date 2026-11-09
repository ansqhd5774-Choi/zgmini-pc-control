# Inflation official manual B (source-only candidate)

This is a dormant, one-shot, exact-scope Windows adapter. It **is not** an
installed/registered PC operation and does not change the Core scheduler, DB,
checkpoint, D1, publishing path, credentials or feature formula.

## Intended effect after separate operator authorization

1. Read an explicit `APPROVED_B` manifest from the control repository and
   compare its raw SHA-256 with the owner's private, single-use Issue.
2. Verify the exact installed PC Git HEAD, `config.source`, source module hashes
   **including `local-cycle.mjs`**, and two already-approved feature parsers.
3. Under the shared Writer B installation mutex, first observe a naturally
   running `ZGMINI-PC-Local-Core` Task whose Task-Engine-linked `node.exe`
   `local-cycle.mjs` PID owns the **exact** E: `local-cycle.lock` in the same
   run (bounded six-minute read-only observation). Then GET the two frozen
   official BLS/Census files with finite limits and parse the workbook on PC.
4. Wait for natural Core idle, atomically obtain the observed `local-cycle.lock`
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

## 2026-11-10 preflight evidence (not execution authorization)

- [A #1105, run 42639125861](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1105):
  approved historical PC checkout `4273137a85adcc90c863a27f703baa749b05cb64`
  matches `config.source`; these three source file SHA-256 digests were read on PC:
  - `inflation-causal-candidate-manual-official-r1.mjs`:
    `53c01bbc129e1c4c5ff129d37fae8e0ff801c30bfe50a6ad0ab1227d394a5ed6`
  - `inflation-causal-candidate-manual-official-store-r1.mjs`:
    `3ef346bd5e240cdcdbd741a0f62b665bba42bf33556e37a6efa359f07de834ec`
  - `xlsx-lite.mjs`:
    `44d4c230a0620faea0d8bb2575e6f13c9ab7cfb5700aa11d752017db747f619a`
- [A #1119, run 42646137586](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1119):
  `pc-source-preflight` **PASS** with no operational writes and fourth file
  `local-cycle.mjs` SHA-256
  `2e6200e5637fb99f339fdc74a64592f34c1272423a39366b8559c16ea1b13b5d`.
  The report was `SUMMARY_ONLY` and verified **only a historical checkout**, not
  a currently executing Core process or its effective lock root.
- Existing live Core proof attempts, for example
  [run 42642308955](https://github.com/ansqhd5774-Choi/zgmini-pc-control/blob/main/results/42642308955-1-seat-3.json),
  returned `STATE_UNKNOWN / CORE_NO_ACTIVE_TASK_ENGINE`, not a failed Core.

**Next distinct requirement:** before preparing `APPROVED_B`, reconcile the
current installed source with the four preimages. The dormant receiver now
contains an exact-path live lock-owner proof: during the authorized one-shot
it must observe an active Task-linked Core PID that owns the exact E: lock,
before any official GET, request claim, or data write. No live Windows proof
has yet been produced; if Core does not naturally run during the bounded
window, the run fails closed, without starting or disabling the Task.
The observed `checkpointSource` (`434f30d2...`) differed from the static
checkout source (`4273137a...`) in #1105; the later stored Writer checkpoint
mentions `4273137a...`, but neither observation alone resolves the live Task
chain. Do not retry A #1119 to turn static evidence into Runtime evidence.

The operator must separately authorize exactly two official static GETs,
archive plus at most two named JSON updates/backups, temporary Core lock
ownership, and the private one-shot journal. Nothing authorizes scheduler,
DB, D1, source replacement, a recovery rollback, or repeated execution.

### Shared recovery and lock-path interpretation

- [#1087](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1087)
  records `WRITER_B_1063_CORE_RECOVERED`, Core enabled and the prior #1063
  lock finalized. It does **not** verify that the original #1063 Writer B
  installation succeeded. Do not reopen that recovered Core lock incident or
  re-run its original maintenance request as a preflight for this feature.
- The feature Core code derives its cycle lock from `ZGMINI_PC_HOME`, or from
  the scheduled account's `.zgmini/pc-writer` home when unset. The B receiver
  names `E:\ZGmini\data\pc-writer\local-cycle.lock`. A C: junction may make
  these identical, but current static source/Task evidence does not prove
  their canonical identity. A Runner user's environment alone is not proof
  of the scheduled Core Task's effective environment.
- The regular Writer B installer can temporarily disable and restore Core,
  but that changes Task state and caused a prior restoration incident. It is
  not an authorized substitute for this two-file data operation. Preserve
  this receiver's Task-unchanged scope; the new read-only Windows/JScript
  observer confirms an actual owner only while Core naturally runs, and never
  outputs process command lines, user names, environment or process lists.
