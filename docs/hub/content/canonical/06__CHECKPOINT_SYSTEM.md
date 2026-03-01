# Checkpoint System

## Purpose
Make progress auditable and resumable.

## Checkpoint Push — Execution Context (LOCKED)
**rule_id:** `HUB.RULE.RUNTIME.CHECKPOINT_PUSH.WSL_TERMINAL_ONLY`

### Law
Checkpoint push **MUST** be executed in **WSL terminal** (bash) to preserve **raw runtime truth** and prevent tool-layer mutation.

### Do
- Run `scripts/fs_runtime_checkpoint_push.sh` from **WSL terminal** only.
- Verify write via:
	- `/home/danie/control_plane/runtime_truth_store/runtime.latest.json`
	- `GET /api/runtime/events?limit=...` (no-cache headers if needed)

### Don’t
- Do **NOT** run checkpoint push through **VSCAI** (risk: block mangling / partial paste / JSONL corruption).
- Do **NOT** paste multi-line JSON into JSONL. JSONL must remain strict: **1 JSON object per line**.

### Rationale (short)
VSCAI may rewrite/fragment blocks; checkpoint writes are integrity-critical.

## Core Laws
- `HUB.LAW.CHECKPOINT.REQUIRED_AT_END` — End-of-session requires HUB_SESSION_WRAP checkpoint.
- `HUB.LAW.CHECKPOINT.STABILITY_POINTS` — Checkpoint at natural stability points.

## Do
- Include: achievements, decisions_locked, changes_made, verification, known_issues, next_actions, scope_guard.

## Don’t
- Don’t end sessions without a wrap checkpoint.

## When Relevant
- Always.

## Crosslinks
- Runtime Truth: `05__RUNTIME_TRUTH.md`