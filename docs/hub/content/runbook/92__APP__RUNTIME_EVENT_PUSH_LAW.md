# Appendix — Runtime Event Push Law

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
====================================================================
RUNTIME EVENT PUSH LAW (GLOBAL) — NO EVENT WITHOUT A LOG
====================================================================

Rule:
If something meaningful happened, it MUST be logged to runtime truth.

Meaningful events include:
- session boundaries (start/resume/end)
- important decisions locked
- architecture changes
- environment/path changes
- any verification (pass/fail)
- any fix applied
- any checkpoint created
- any failure discovered

Severity rules:
- INFO for normal progress
- WARN when something looks off but work can continue
- ERROR for broken systems / blockers
- DEBUG only for high-volume diagnostic noise

Minimum schema requirements:
- ts (timestamp)
- project
- task_id
- event_type
- severity
- summary (short factual sentence)
- tags (optional)
- facts (structured payload)
- refs/entities when relevant

Hard requirement:
- The assistant MUST provide a push block after a meaningful event.
- If missing, the output is incomplete/invalid.

New chat rule:
- New chats must resume by reading runtime.latest.json + recent ERROR/WARN.
- Never rely on chat memory for operational truth.

## Dedupe / consolidation notes
- Verbatim import. Do not dedupe yet.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Runtime Truth (library): `../canonical/05__RUNTIME_TRUTH.md`
- Checkpoint System (library): `../canonical/06__CHECKPOINT_SYSTEM.md`
