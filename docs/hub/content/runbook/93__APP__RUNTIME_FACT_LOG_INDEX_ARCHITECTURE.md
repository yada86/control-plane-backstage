# Appendix — Runtime Fact Log + Index Architecture

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
====================================================================
RUNTIME FACT LOG + INDEX ARCHITECTURE (CANONICAL PLATFORM SYSTEM)
====================================================================

Purpose:
- Separate policy (HUB) from operational truth (runtime facts).
- Eliminate context loss between chats.
- Enable deterministic resume, automation, and Jarvis routing.
- Keep HUB compact while preserving full historical truth.

Core Design (LOCKED):

1) Source of Truth — Runtime Event Log (JSONL)
	- Append-only machine-readable log (one JSON object per line)
	- Stores all meaningful events:
		- session start/resume
		- path/env resolution
		- template changes
		- server start/stop
		- E2E pass/fail
		- fixes applied
		- checkpoints

2) Latest Snapshot (for fast resume)
	- A single JSON file that always represents the most recent event set.
	- Used by UI + new chat resume flows.
	- Must be updated on every event push.

3) Index (optional acceleration)
	- A SQLite index may be built to allow:
		- query by project/task_id/event_type/severity/tags
		- efficient time-window retrieval
		- deterministic “resume pack” construction

4) UI Consumption
	- Backstage reads latest snapshot + recent tail of jsonl
	- UI must show:
		- recent checkpoints (prioritized)
		- current goal/next action
		- warnings/errors first
	- The UI must not invent state.

5) Integrity
	- JSON must always be valid.
	- No partial writes:
		- write temp file
		- fsync if possible
		- atomic rename
	- A failed write must not corrupt latest snapshot.

6) Deterministic resume pack
	- A resume pack should include:
		- core laws (from HUB)
		- current state + next action (from runtime latest)
		- most relevant checkpoints (from runtime index)
	- No freeform interpretation.

## Dedupe / consolidation notes
- Verbatim import. Do not dedupe yet.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Runtime Truth (library): `../canonical/05__RUNTIME_TRUTH.md`
