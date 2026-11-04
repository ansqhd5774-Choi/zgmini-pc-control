# R10 PC Writer source B — isolated draft

This draft is **not installed, not wired into `maintenance-agent.mjs`, and not a PC job**. It cannot execute a Windows update on its own. The existing maintainer only accepts its documented Controller/R6 jobs; an independent, explicitly approved B-only receiver/port and operating handoff are required later. Do not dispatch this draft as a generic A/light command or issue shell action.

## Exact scope

- Two pinned candidate source files: `lib/diagnostic-layer/asset-bubble-r10-raw-evidence-r1.mjs` and `worker/asset-bubble-r10-raw-r1.mjs`, from public source commit `c3683e5d8e2ff4658022064866658dab81222270`.
- If an operating source commit is eventually approved, **only these two files plus the corresponding `config.source` SHA** may change. No Task/scheduler/provider/API/SQLite/D1 changes. No same-checkpoint overwrite.
- `r10-source-b-stage.mjs` does bytes and import checks before optional **new, isolated** staging. It cannot touch the Core checkout.
- `r10-source-b-apply.mjs` is a *port-based policy/state-machine proposal*, not an operational installer. Its mock tests cannot establish Windows/Task/Git runtime correctness.

## Required STOP conditions before any real B operation

1. Obtain fresh Task → launcher → live process / exact checkout proof with true Core source identity. A historical checkout-only source diagnostic is insufficient.
2. Verify actual operating `config.source`, clean Git HEAD, exact original two-file hashes, candidate dependency closure, and the trusted parent Core lock / Writer idle state.
3. Establish retrievable Git objects for both old and new source commits, exact two-file Git diff and proven rollback. The reported operating `a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e` is **not currently retrievable via the remote GitHub source API**; this blocks admission.
4. Obtain a **separate approved B manifest** with all originally unknown hashes; the checked-in template is DRAFT and intentionally rejected. Verify independent original backup, CAS, shared installer lease, and global create-only reservation before mutation.
5. Bind an authorized, independently controlled B receiver to fixed operations, verify post-apply source/config and protected state. The draft has no dispatch, GitHub Workflow, task registration, or PC command implementation.

If the source proof or admission cannot be established, halt; do not substitute old R10 CMD scripts, reset/clean the checkout, force-push, bypass A restrictions, or attempt the same checkpoint publication again.

## Local isolated test

```console
node --test r10-b/r10-source-b.test.mjs
```

The test suite uses mocked trusted ports and scratch fixtures only. It is a contract regression check, **not** PC execution or Production proof.
