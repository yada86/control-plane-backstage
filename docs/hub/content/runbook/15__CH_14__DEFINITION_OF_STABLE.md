# 14) DEFINITION OF STABLE

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
14) DEFINITION OF STABLE
====================================================================

A system is STABLE only when:

• runtime verified  
• snapshot taken  
• documented in HUB  
• rollback exists  

--------------------------------------------------------------------
MINIMUM EVIDENCE REQUIREMENT — CHECKPOINTS (LOCKED)
--------------------------------------------------------------------

====================================================================
CHECKPOINT NAMING STANDARD — MACHINE SAFE (LOCKED)
====================================================================

All checkpoints MUST use the following format:

<SYSTEM>_<SUBSYSTEM>_<FACT>_<STATUS>__YYYY-MM-DD

Examples:

F9_ENGINE_OBSERVABILITY_CORE_VERIFIED__2026-02-20  
JARVIS_PROJECT_ROOT_MISSING_CONFIRMED__2026-02-20  
GRAPHVIZ_OVERLAY_FLOWTYPING_FIXED__2026-02-18  

Rules:

• UPPERCASE only  
• Words separated by underscores  
• Double underscore before date  
• No free text  
• Fact must be objective (FIXED, CONFIRMED, VERIFIED, MEASURED)

Forbidden:

❌ vague wording (IMPROVED, SEEMS_OK, WORKING_NOW)  
❌ spaces  
❌ narrative titles  

Purpose:
• machine parsing
• auditability
• drift elimination
• deterministic history

====================================================================
END CHECKPOINT NAMING STANDARD
====================================================================

--------------------------------------------------------------------
AUTO-EVIDENCE HOOKS — RUNTIME REQUIREMENT (LOCKED)
--------------------------------------------------------------------

Every execution engine that produces checkpoints MUST automatically emit evidence.

Minimum auto-evidence per run:

• timestamped STDOUT capture  
• timestamped STDERR capture  
• run_id propagation  
• canonical file output location  
• explicit START and END markers  

When possible also emit:

• version stamps (Blender, addon, script hash)  
• step timing metrics  
• environment snapshot (critical vars only)

Rule:

A checkpoint is NOT valid unless backed by auto-evidence output.

Manual “trust me” checkpoints are forbidden.

Purpose:
• zero human memory dependency
• instant reproducibility
• factual debugging only
• SAFE MODE enforcement

--------------------------------------------------------------------
END AUTO-EVIDENCE HOOKS
-----------------------------------------------------------------

## Dedupe / consolidation notes
- Verbatim import. Do not dedupe yet.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Checkpoint System (library): `../canonical/06__CHECKPOINT_SYSTEM.md`
- Runtime Truth (library): `../canonical/05__RUNTIME_TRUTH.md`
