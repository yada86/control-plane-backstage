# Pinned Baselines (Checkpoint Curation)

## Purpose
Keep “foundation” checkpoints visible when relevant, without spamming New Chat Start with old history.

## Policy (LOCKED)
- Raw runtime truth (JSONL) is never edited or pruned.
- This curation layer controls **presentation only**:
  - **Pinned baselines** (hand-picked, long-lived)
  - **Recent relevant** (automatic by tags/recency)
  - **Archive pointer** (everything else)

## How this is used
New Chat Start generator should:
1. Always show a small set of pinned baselines for the active subsystem tags.
2. Show a small set of recent relevant checkpoints (tag match + recency).
3. Otherwise provide an archive pointer (do not list old noise).

## Where pins live
- Machine-readable pins: `docs/hub/checkpoints/checkpoint_pins.json`
- Archive pointer: `docs/hub/checkpoints/01__ARCHIVE_INDEX.md`
