# Appendix — Runtime Fact Log System

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
====================================================================
RUNTIME FACT LOG SYSTEM (GLOBAL) — KEEP HUB SMALL, KEEP TRUTH COMPLETE
====================================================================

Goal:
- HUB remains policy + contracts + indexes (low churn, high signal).
- Runtime facts (high churn) live in machine-readable logs on disk.
- New chats resume instantly by reading runtime logs, not reloading giant HUB sections.
- Jarvis must be able to retrieve runtime + relevant policy without drowning in irrelevant text.

Rules:
1) HUB stores:
	- locked laws + contracts
	- stable architecture
	- pointers/indexes to runtime artifacts
	- checkpoints (summaries, not raw logs)
2) Runtime truth stores:
	- everything that happened that matters
	- outputs, proofs, traces, measurements
	- failure chains + fixes
3) Chat is never the archive.
	- If it matters → it must become runtime truth + checkpoint.

Canonical files:
- ${RUNTIME_TRUTH_PATH}
- ${RUNTIME_TRUTH_PATH} (sibling file `runtime.latest.json` in same directory)

WSL bridge:
- ${RUNTIME_TRUTH_PATH}
- ${RUNTIME_TRUTH_PATH} (sibling file `runtime.latest.json` in same directory)

What goes into runtime facts:
- session start/resume
- path resolution / env changes
- template changes
- server start/stop
- smoke tests / E2E pass/fail
- error discovery + fix applied
- port conflict resolution
- checkpoint creation
- any change that affects reproducibility

Event quality requirements:
- Logs MUST be machine-readable JSON (JSONL append) + update a latest snapshot.
- Logs MUST be structured: event_type, severity, facts, refs, summary.
- Logs MUST avoid freeform chatter; summaries must be short and factual.

Enforcement:
- If the assistant does not provide a PUSH EVENT block after a meaningful event, the output is considered incomplete/invalid.
- The user is expected to run the block to keep runtime truth current.
- New chats must resume by reading runtime.latest.json and recent ERROR/WARN events.

## Dedupe / consolidation notes
- Verbatim import. Do not dedupe yet.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Runtime Truth (library): `../canonical/05__RUNTIME_TRUTH.md`
