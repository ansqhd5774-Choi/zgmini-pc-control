# Inflation official manual B — on-demand execution and evidence

This is a one-shot, exact-scope Windows B receiver. It was invoked once on
2026-11-10 KST ([#1177](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1177))
and **safely stopped before an official GET or PC data write**. Its code and
approval are not evidence of successful data collection or publication. It does
not change the Core scheduler, DB, checkpoint, D1, publishing path, credentials
or feature formula.

**Current objective and progress: 23/26 raw inputs, overall inflation 42%.**
Finish the missing 3 series from two official files, then existing
local calculation → Writer → D1 → public API/UI. Only after feature completion
consider first natural automatic observation-update verification.

## Intended effect under the existing approved feature scope

1. Read an explicit `APPROVED_B` manifest from the control repository and
   compare its raw SHA-256 with the owner's private, single-use Issue.
2. Verify the exact installed PC Git HEAD, `config.source`, source module hashes
   **including `local-cycle.mjs`**, and two already-approved feature parsers.
3. **Before acquiring the shared Writer B installation mutex**, observe a
   naturally running `ZGMINI-PC-Local-Core` Task whose Task-Engine-linked `node.exe`
   `local-cycle.mjs` PID owns the **exact** E: `local-cycle.lock` in the same
   run (bounded twelve-minute read-only observation). This wait cannot occupy
   the shared Writer B mutex or block another function's installer. Then
   acquire that mutex, reverify the PC source, GET the two frozen official
   BLS/Census files with finite limits, and parse the workbook on PC.
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

## On-demand manual operation (no 09:00 gate)

- **Manual** means an explicit user/owner request executed once as soon as
  authorized and safely runnable. There is **no** 09:00, next-day or daily
  scheduler prerequisite in this collector. Do not put unfinished collection,
  calculation or publication behind an automation task's clock.
- **Natural automatic verification is later work.** The separate ChatGPT
  task formerly titled `물가지표 재수집·최종 검증`, with 09:00 daily
  schedule, was paused on 2026-11-10 KST and restricted to first natural
  observation-update verification **after** function completion. This change
  does not disable or modify the approved PC Core/Korea schedules.
- GitHub Actions is **Issue-opened only**, with no Cron. Exact-scope B is
  gated by the private default-off variable
  `ZGMINI_INFLATION_MANUAL_B_ENABLED`; it was confirmed `false` after
  [#1177](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1177).
  Do not enable it for a new attempt until existing result, source/preimage,
  Task-linked Core lock ownership and B manifest have been reconciled.
- The single-use `#1177` requestId was consumed; **never rerun/reuse it**.
  Any next approved on-demand attempt has its own unique Issue/requestId and
  exact manifest, with no automatic retry or time-based resubmission. Existing
  user authorization covers its recorded scope; only additional effects
  beyond that scope require new approval.
- A preflight safety failure must return its actual non-success status, even
  if reporting JSON/TXT succeeded. Never treat an Actions green envelope as
  actual data storage.
- The receiver has no permission to change Core Task state, source, shared
  lock ownership, DB, D1 or unrelated files. Its valid scope is two official
  static GETs, private archived bytes, at most two named raw JSON updates,
  and evidence readback, with existing exclusive Core/Writer protection.
- Manual function completion is **raw 26/26 → saved-data calculation → existing
  Writer result → D1 readback → API and PC/mobile UI validation**. Scheduled
  natural-update checking is deferred, not part of that completion gate.

Local tests: `node --test inflation-manual-b/*.test.mjs`.
A source-only merge does not install a PC operation or prove its effects.

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

**Latest evidence and next required execution:**

- [PR #1176](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1176)
  reconciled the B approval manifest with the observed PC-approved source
  `48d3478030590ca63aaab2435e88c896608c70d3`.
- [B #1177](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1177),
  run `42714127327`, returned
  `INFL_MANUAL_B_PREFLIGHT_STOP / INFL_MANUAL_B_CORE_OWNER_NOT_OBSERVED_STOP`
  within the original six-minute owner observation. Official GET 0; raw
  JSON writes 0; 23/26 unchanged. Outer Actions success was not B success.
- [Read-only A #1181](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1181)
  later observed an E: Core lock and advancing Core/Writer checkpoints; it
  did not establish Task-engine-linked ownership **during** the B window.
- [PR #1183](https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1183)
  merged a bounded 12-minute natural owner-observation window, 30-minute
  total Actions limit, better observation-gap codes and truthful nonzero
  exit on non-success status. This is **source-only**, not Windows runtime
  proof or a reason to reexecute #1177.
- [Read-only A #1186](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1186),
  run `42719810637`, observed `CORE_NO_ACTIVE_TASK_ENGINE` at
  2026-11-09 23:21:47 UTC. This is an inconclusive instantaneous snapshot,
  not a broken Core Task or evidence of a different Core lock path.
- [Read-only A #1187](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1187),
  run `42719971556`, found `lockPresent:false` at 23:23 UTC, unchanged
  Core/Korea Task XML hashes and forward progress: Core cycle report
  22:39 → 23:21 UTC, collection 22:40 → 23:15, Writer 22:52 → 23:20.
  This rules out an indefinitely stuck lock at that snapshot; it does
  **not** prove Task→Node→E: lock lineage while active.
- The existing feature `local-cycle.mjs` uses one lock for both Core and
  Korea lanes, while the B owner observer only accepts Core Task instances.
  The actual failure mechanism is still unproven. Extending the observation
  timeout from six to twelve minutes alone must not be treated as a fix.
- **Next action:** identify the scheduled Task's effective Core lock root,
  its canonical equivalence to the B receiver's E: lock, and the exact
  Task/VBS/Node process relation using a bounded authorized read-only
  mechanism. Repair only the proven false guard, preserving the atomic
  exclusive Core lease, shared Writer lease, source/hash checks and
  fail-closed behavior. Then submit a **new single-use B request** for the
  existing two official sources and verify its private readback, followed by
  calculation, D1 and public API/UI. Do not make any 09:00 time gate or
  natural scheduled verification a prerequisite; do not repeat #1177 or
  generate further identical instantaneous A snapshots.

The exact operation manifest must remain within the already-approved scope:
two official static GETs, archive plus at most two named JSON updates/backups,
temporary Core lock ownership, and the private one-shot journal. If any one
of these effects is outside the existing scope, stop for explicit approval.
Nothing authorizes scheduler,
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
