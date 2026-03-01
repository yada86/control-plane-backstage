# Checkpoint Archive (Pointer)

## Purpose
Provide a stable place to point for older checkpoints without dumping them into New Chat Start.

## Rule
- New Chat Start should prefer **pinned** + **recent relevant** only.
- For older history, include a single pointer to this file.

## Where to look for full history
- Runtime Truth UI: ${APP_BASE_URL}/runtime
- Runtime truth JSONL: ${RUNTIME_TRUTH_PATH}
- Latest snapshot: ${RUNTIME_TRUTH_PATH} (sibling file `runtime.latest.json` in same directory)

## Notes
This page intentionally stays short. It is a pointer, not a duplicate of runtime truth.
