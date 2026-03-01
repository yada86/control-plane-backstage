# 16) NEW CHAT HYGIENE

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
16) NEW CHAT HYGIENE
====================================================================

New chat starts with:

• HUB v4  
• Current State  
• Next Action  

All old context discarded intentionally.

--------------------------------------------------
TOOL PICK GUARD (MANDATORY)
--------------------------------------------------

Before proposing any action, the assistant must explicitly choose the correct tool:

• VSCAI — repo/file editing  
• EXEC — Blender runtime truth  
• POWERSHELL — system measurement & automation  
• LOCAL AI — optional accelerator  

If the tool choice is not stated, the solution is considered incomplete.

--------------------------------------------------------------------
COPY SAFETY LAW (LOCKED)
--------------------------------------------------------------------

All content intended to be copied from chat MUST be delivered inside a code block.

Rules:
• Any workflow block, script, config, checklist, header, template, or task instruction must be in a copy-safe block.
• If content is meant to be copied and is not inside a block → it is invalid output.
• Assistant must automatically format copyable content in blocks without being reminded.
• No mixed inline + block instructions for executable steps.

Purpose:
• eliminate formatting drift
• prevent human copy errors
• maintain deterministic execution
• preserve SAFE MODE integrity

Violation handling:
Any response containing copyable content outside a block must be reformatted before proceeding.

--------------------------------------------------
ADDITIVE HUB UPDATE LAW (LOCKED)
--------------------------------------------------

Purpose:
Prevent destructive edits and preserve accumulated truth.

Rule:
All HUB updates MUST be additive.

Allowed operations:
1) Insert a brand-new section (only if the section heading does not already exist).
2) Insert a brand-new checkpoint block (only if the checkpoint ID or heading does not already exist).
3) Append new information to an existing section ONLY as a dated APPEND sub-block.

APPEND sub-block standard (mandatory):
- Must be placed at the END of the target section.
- Must start with a unique marker line:
	"APPEND (YYYY-MM-DD) — <SHORT TITLE> — <UNIQUE MARKER>"
- Must use a dashed separator style, example:

--------------------------------------------------------------------
APPEND (2026-02-20) — EXAMPLE — UNIQUE_MARKER
--------------------------------------------------------------------
- facts...
- facts...
--------------------------------------------------------------------

No destructive edits:
- Never delete content from existing sections.
- Never replace an entire section to apply a small update.
- Never rewrite historical blocks.
- Never “clean up” wording unless explicitly instructed.

Idempotency requirement:
- Every APPEND must include a unique marker string.
- If that marker already exists in the section, the update must NOT be duplicated.

SAFE MODE requirement:
- Any HUB edit requires a timestamped backup + proof.
- After write, verify the marker presence count (must be exactly 1).

--------------------------------------------------
END ADDITIVE HUB UPDATE LAW (LOCKED)
--------------------------------------------------

--------------------------------------------------
BLOCK LABEL PLACEMENT RULE (LOCKED)
--------------------------------------------------

Execution target markers such as:

LIM RETT INN I → VSCAI  
LIM RETT INN I → EXEC  
LIM RETT INN I → POWERSHELL  
LIM RETT INN I → NEW CHAT  

MUST ALWAYS appear OUTSIDE the copy-safe code block.

Rules:

• The marker is instructional metadata — never part of the copied content  
• The code block must contain ONLY the executable/instruction payload  
• No block may include its own LIM RETT INN I label  

Violation handling:

If a marker appears inside a block:
• the block is INVALID  
• it must be rewritten before execution  

Purpose:
• prevent prompt pollution
• ensure deterministic copying
• avoid VSCAI mis-parsing
• preserve SAFE MODE guarantees

--------------------------------------------------
END BLOCK LABEL PLACEMENT RULE
--------------------------------------------------

--------------------------------------------------
POWERSHELL EXECUTION HYGIENE (LOCKED)
--------------------------------------------------

--------------------------------------------------------------------
POWERSHELL PS5 TERMINAL RULES (LOCKED)
--------------------------------------------------------------------

Purpose:
• Eliminate quoting/interpolation failures in PS5
• Prevent stderr from being treated as fatal when it is informational
• Enforce boring, deterministic scripts over clever one-liners

DO (SAFE):
• Prefer file-based execution over inline code
	- For Python logic: write a temp .py file and run it (python script.py)
• Use string formatting with -f instead of “$var:” patterns
	- "{0}: {1}" -f $label, $path
• Use single-quoted here-strings for multi-line payloads:
	- $code = @'
		...
		'@
• Treat “no matches” as valid signal (not failure)
	- Select-String results may be empty without error
• Use explicit guards before actions:
	- Test-Path, Require-Path, validation before modify/delete
• Keep scripts PS5-compatible unless explicitly stated otherwise

DON’T (FORBIDDEN):
• Don’t embed "$var:" inside double-quoted strings
	- PowerShell parses $var: as a scoped variable token and can crash
• Don’t use interpolating here-strings (@" ... "@) for code payloads
	- They can mutate content before the target interpreter receives it
• Don’t rely on python -c for multi-line code blocks
	- Use a .py file for anything non-trivial
• Don’t treat pip show stderr warnings as runtime failures
	- Prefer “pip list” or Python import/metadata probes instead
• Don’t use “clever” one-liners when readability and determinism matter

Standard patterns (canonical):
• Python probe pattern:
	- Write UTF-8 (no BOM) temp .py
	- Run: & $py $tmp
	- If exit != 0: print file with line numbers for exact failure location
• Output policy:
	- No simulated output
	- All logs must be real tool output or explicit Write-Host statements

--------------------------------------------------------------------
APPEND (2026-02-22) — POWERSHELL 7 AVAILABLE (pwsh) — PWS7_7_5_4_AVAILABLE__2026_02_22_MARKER
--------------------------------------------------------------------
FACT (VERIFIED BY USER):
- PowerShell upgraded: pwsh (PowerShell 7.5.4) is now installed and available.

GOVERNANCE (DO NOT BREAK):
- powershell.exe (Windows PowerShell 5.1) remains the baseline default for deterministic Start Blocks unless pwsh is explicitly required/verified for a task.
- Any Start Block that chooses pwsh MUST still comply with:
	StrictMode + Stop-on-error + guards + no placeholders + netstat -ano port truth.

USAGE NOTE:
- When a task benefits from PS7 features, tool pick may be "POWERSHELL (pwsh)" explicitly.
--------------------------------------------------------------------

All POWERSHELL blocks must follow strict runtime-safety rules.

Rules:

• No output imitation inside blocks  
	(no fake logs, no simulated results, no narrative text)

• POWERSHELL blocks must contain ONLY valid PowerShell syntax  
	(no markdown, no comments pretending to be output)

• Syntax must be PS5-safe unless explicitly stated otherwise

• No “smart scanning” or auto-discovery without explicit guards  
	(Test-Path, Require-File, validation before action)

• Prefer boring, verbose, deterministic scripts over clever shortcuts

Principle:
Robustness beats elegance.
Predictability beats brevity.

Violation handling:

If a POWERSHELL block:
• simulates output  
• mixes narrative with commands  
• skips guards  

→ the block is INVALID and must not be executed.

--------------------------------------------------
END POWERSHELL EXECUTION HYGIENE
--------------------------------------------------

--------------------------------------------------
BLOCK LABEL PLACEMENT RULE (LOCKED)
--------------------------------------------------

Execution target markers such as:

LIM RETT INN I → VSCAI  
LIM RETT INN I → EXEC  
LIM RETT INN I → POWERSHELL  
LIM RETT INN I → NEW CHAT  

MUST ALWAYS appear OUTSIDE the copy-safe code block.

Rules:

• The marker is instructional metadata — never part of the copied content  
• The code block must contain ONLY the executable/instruction payload  
• No block may include its own LIM RETT INN I label  

Violation handling:

If a marker appears inside a block:
• the block is INVALID  
• it must be rewritten before execution  

Purpose:
• prevent prompt pollution
• ensure deterministic copying
• avoid mis-parsing
• preserve SAFE MODE guarantees

--------------------------------------------------
END BLOCK LABEL PLACEMENT RULE
--------------------------------------------------


--------------------------------------------------
POWERSHELL EXECUTION HYGIENE (LOCKED)
--------------------------------------------------

All POWERSHELL blocks must follow strict runtime-safety rules.

Rules:

• No output imitation inside blocks  
• POWERSHELL blocks contain ONLY valid PowerShell syntax  
• Syntax must be PS5-safe unless explicitly stated  
• No smart scanning without guards (Test-Path, validation first)  
• Prefer boring, verbose, deterministic scripts  

Principle:
Robustness beats elegance.  
Predictability beats cleverness.

Violation handling:

If a POWERSHELL block:
• simulates output  
• mixes narrative with commands  
• skips guards  

→ the block is INVALID.

--------------------------------------------------
END POWERSHELL EXECUTION HYGIENE
--------------------------------------------------

====================================================================
BOOTSTRAP INTEGRITY LAW — NEW CHAT START BLOCKS
====================================================================

Purpose:
- Eliminate ambiguity and state-dependence across new chat sessions.
- Ensure every "NEW CHAT START" block is a self-contained, deterministic bootstrap that works from a clean PowerShell session.

Definitions:
- "Start Block" = The first instructions provided to begin/resume an engineering task in a new chat session.
- "Clean session" = No assumed env vars, no assumed working directory, no assumed tools on PATH.

Laws (MUST):
- “Assistant’s first response in a new chat MUST be ONLY the GET command block + a single-line instruction to paste output. No additional commentary allowed before GET proof.”
1) Zero Placeholders Law
	- Start Blocks MUST NOT include placeholder paths (e.g., C:\path\..., <REPLACE_ME>, FULL\PATH\TO\...).
	- Start Blocks MUST either:
		a) resolve required paths deterministically (search within explicit roots), or
		b) fail fast with explicit error describing EXACT missing requirement.

2) No Prior State Law
	- Start Blocks MUST NOT rely on:
		- previously set environment variables
		- previous working directory
		- previous running server processes
		- prior chat context
	- They MUST fully define required env vars and execution context on every run.

3) Deterministic Shell Law
	- Start Blocks MUST NOT assume pwsh exists.
	- They MUST verify shell availability (pwsh.exe or powershell.exe) via explicit Test-Path or Get-Command.
	- Prefer powershell.exe for baseline determinism unless pwsh is verified present and required.

4) Idempotence & Port Hygiene Law
	- Start Blocks MUST be safe to run multiple times.
	- If a fixed port is required (e.g., 8787), Start Blocks MUST:
		- measure port ownership via netstat -ano (authoritative),
		- kill ONLY the listening PID(s) if they belong to the current system (e.g., python/uvicorn for this repo),
		- then re-verify port is free BEFORE starting a new server.
	- Avoid relying solely on Get-NetTCPConnection (race-prone).

5) StrictMode Compatibility Law (PowerShell)
	- Start Blocks MUST run under:
		- Set-StrictMode -Version Latest
		- $ErrorActionPreference='Stop'
	- Therefore:
		- Never assign to $pid / $PID (read-only, case-insensitive trap). Use $targetPid / $listenPid.
		- Any pipeline that may produce a single object MUST be normalized to an array with @(...), then use .Length (not .Count).
		- Do not assume exception properties (e.g., .Response). Log Exception.Message and ErrorDetails.Message.

6) Environment Reset Law
	- Start Blocks MUST explicitly set (and may explicitly clear) key env vars used by the task.
	- They MUST print the final resolved values (redacting secrets) before execution.
	- Minimum: host, port, timeout, JARVIS_CMD_TEMPLATE (or equivalents).

7) Proof-of-Life Law
	- Start Blocks MUST include a controlled smoke test sequence:
		- health/version checks
		- one representative functional request
	- All tests MUST be copy/paste runnable and deterministic.

Checklist (MUST PASS before considering a Start Block "valid"):
- [ ] No placeholder paths remain.
- [ ] Works from a clean PowerShell session (no pre-set env required).
- [ ] Runs with StrictMode + Stop-on-error.
- [ ] Resolves or validates all required paths.
- [ ] Handles port conflicts deterministically using netstat -ano.
- [ ] Prints resolved configuration before starting.
- [ ] Includes smoke tests that verify end-to-end behavior.

--------------------------------------------------------------------
END COPY SAFETY LAW

## Dedupe / consolidation notes
- Verbatim import. This chapter contains known internal duplicates (label placement + PowerShell hygiene repeated). Do not change during import; dedupe sweep later.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- New Chat Start Protocol (library): `../canonical/09__NEW_CHAT_START_PROTOCOL.md`
- Copy Safety (library): `../canonical/04__COPY_SAFETY.md`
- PowerShell Rules (library): `../canonical/12__POWERSHELL_RULES.md`
