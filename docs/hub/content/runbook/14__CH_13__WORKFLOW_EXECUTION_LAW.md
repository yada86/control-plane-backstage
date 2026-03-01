# 13) WORKFLOW EXECUTION LAW

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
13) WORKFLOW EXECUTION LAW
====================================================================

BLOCK TYPES  
→ VSCAI  
→ EXEC  
→ POWERSHELL  
→ NEW CHAT  

Exactly one block per action.

SAFE DEBUG  
1 verify  
2 change  
3 test  
4 snapshot  
5 never assume  

CHECKPOINTS (for systems, not HUB)

====================================================================
TOOL SELECTION GOVERNANCE (LOCKED)
====================================================================

Purpose:
Always use the smartest available tool for the job (lowest risk, least friction, highest truth).

--------------------------------------------------------------------
MODEL SELECTION POLICY — CANONICAL (LOCKED)
--------------------------------------------------------------------

For every VSCAI / code-generation task:

1) Code change / surgical patch / operator blocks
	Recommend: GPT-5.1 Codex  
	Fallback: GPT-5.1 Codex-Mini (simple + cost critical)  
	Premium: GPT-5.3 Codex (maximum precision)

2) Language / documentation / explanation
	Recommend: GPT-4o

3) Mixed tasks:
	- Code-centric → Codex
	- Language-centric → GPT-4o

Security constraint:
- Never use Mini models on core logic, execution engines, guards, or security-sensitive behavior.

Cost constraint:
- Default to lowest model that passes block QA.

Rule:
- The assistant MUST annotate recommended model before providing any generated block.

--------------------------------------------------------------------
END MODEL SELECTION POLICY
--------------------------------------------------------------------

AVAILABLE TOOLS (CANONICAL)
• VSCAI — VS Code AI Chat (repo-aware editing)
• EXEC  — Blender console / live.py pipeline (runtime truth)
• POWERSHELL — system automation + measurement
• LOCAL AI (OPTIONAL) — Ollama + Open Interpreter (batch help; never a dependency)

--------------------------------------------------
DEFAULT DECISION TREE (USE THIS)
--------------------------------------------------

A) VSCAI — FIRST CHOICE (REPO EDITING)
Use when:
• editing files in repos
• adding/modifying scripts, JSON, .py, .ps1
• small precise changes, refactors, structured updates
Why:
• sees file context
• lowest patch risk
• fastest iteration

B) EXEC — RUNTIME TRUTH (BLENDER)
Use when:
• verifying nodes/sockets/identifiers
• measuring runtime state
• reproducing bugs inside Blender
Why:
• truth comes from runtime
• aligns with SAFE MODE

C) POWERSHELL — SYSTEM TRUTH (WINDOWS)
Use when:
• verifying paths, junctions, env vars
• launching Blender / tooling
• filesystem inspection
• log collection / cleanup runs
Why:
• measurable system state
• deterministic automation

D) LOCAL AI (OPTIONAL) — ACCELERATOR, NOT FOUNDATION
Use when:
• batch refactors where VSCAI is slow/limited
• generating drafts or exploring approaches
• large mechanical edits with verification
Rules:
• must NOT become a dependency
• output must still follow SAFE MODE (verify + rollback)

--------------------------------------------------
ANTI-PATTERNS (FORBIDDEN)
--------------------------------------------------

❌ Writing PowerShell patch scripts to change files when VSCAI can edit directly
❌ Patching before measuring (EXEC/PS verification first)
❌ Overengineering simple edits (“script-first reflex”)
❌ Introducing hardcoded paths (AI_WORK or random roots)

--------------------------------------------------
GOLDEN RULE
--------------------------------------------------

If VSCAI can safely do it → use VSCAI.
If truth is needed → measure in EXEC/PowerShell first.
Local AI is a turbo button, not a load-bearing wall.

Complexity is not skill.
Correct tool choice is skill.

====================================================================
END: TOOL SELECTION GOVERNANCE

## Dedupe / consolidation notes
- Verbatim import. Do not dedupe yet.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Tool Governance (library): `../canonical/02__TOOL_GOVERNANCE.md`
- Copy Safety (library): `../canonical/04__COPY_SAFETY.md`
