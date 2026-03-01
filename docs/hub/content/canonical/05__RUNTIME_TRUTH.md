# Runtime Truth

## Purpose
Establish runtime.jsonl as the canonical event log and source for UI/state.

## Core Laws
- `HUB.LAW.RUNTIME_TRUTH.CANON` — Runtime truth JSONL is canonical log.
- `HUB.LAW.RUNTIME_TRUTH.NO_GUESSING` — UI and decisions must be grounded in recorded events.

## Do
- Push checkpoints for milestones and session wraps.
- Prefer reading runtime truth over memory.

## Don’t
- Don’t “assume latest” if runtime truth can confirm it.

## When Relevant
- Any operational status, checkpointing, restore, backup, and UI behavior.

## Crosslinks
- Checkpoint System: `06__CHECKPOINT_SYSTEM.md`