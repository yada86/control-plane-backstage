# SAFE MODE

## Purpose
Prevent unintended changes by enforcing “measure first, minimal diffs, verify after.”

## Core Laws
- `HUB.LAW.SAFE_MODE.DEFAULT` — SAFE MODE is default.
- `HUB.LAW.SAFE_MODE.MEASURE_FIRST` — Measure/inspect before change.
- `HUB.LAW.SAFE_MODE.MINIMAL_DIFFS` — Keep diffs localized and additive.
- `HUB.LAW.SAFE_MODE.VERIFY_AFTER` — Verify outputs after patching.

## Do
- Measure → Patch → Verify → Checkpoint.
- Prefer reversible, diagnostic steps before writing changes.

## Don’t
- Don’t assume paths, sockets, node names, or repo structure.
- Don’t refactor when a targeted patch is sufficient.

## When Relevant
- Always.

## Crosslinks
- Tool Governance: `02__TOOL_GOVERNANCE.md`
- Copy Safety: `04__COPY_SAFETY.md`