# 18) LOCAL AI MODEL STRATEGY + AUTO-ROUTER (LOCKED)

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
18) LOCAL AI MODEL STRATEGY + AUTO-ROUTER (LOCKED)
====================================================================

VERIFIED HARD CONCLUSION (2026-02-18):
- Repo-wide / “super quality compliance” → qwen2.5-coder:7b-instruct  (alias: deep)
- Daily driver / workflow blocks → qwen2.5-coder:3b                 (alias: main)
- Micro tasks / ultra fast snippets → deepseek-coder:1.3b           (alias: fast)

WHY:
- “Best” depends on task class. Speed ≠ quality. Compliance matters for repo/HUB work.
- This mapping is benchmarked with QUALITY GATING and repo-grade tasks.

ALIASES (OLLAMA):
- Create local alias models so prompts can reference stable names:
	- main → qwen2.5-coder:3b
	- fast → deepseek-coder:1.3b
	- deep → qwen2.5-coder:7b-instruct

AUTO-ROUTER (LOCAL):
- Router script path (canonical):
	C:\AI_WORK\ai_router.py
- Router routes prompts to fast/main/deep based on heuristics (repo/HUB keywords => deep, tiny tasks => fast, default => main).
- PowerShell function ‘ai’ calls ai_router.py (session function; optional to make permanent later).

USAGE:
- ai <prompt>               => auto select model
- ai deep: <prompt>         => force deep
- ai -m fast <prompt>       => force fast
- ollama run main|fast|deep  => manual direct

ENV DEFAULTS:
- OLLAMA_URL defaults to http://127.0.0.1:11434/api/generate
- OLLAMA_TIMEOUT_SEC recommended 180 for repo-grade tasks

LOCKED RULE:
- Repo/HUB edits (governance + compliance) should default to ‘deep’.
- Routine workflow blocks default to ‘main’.
- Micro/one-liner/quick transforms default to ‘fast’.

HARDWARE-AWARE LIMITS (LOCKED)
- This strategy is bound to the canonical hardware baseline (Section 2: RUNTIME CAPACITY BASELINE — HARDWARE).
- Current baseline (2026-02-19): RTX 4060 (VRAM ≈ 8 GB), RAM 32 GB, i7-9700K.

Practical implications:
- 7B class ("deep") is the quality sweet spot on this rig (stable VRAM fit, best compliance).
- 3B class ("main") is the speed/workflow sweet spot.
- 1–2B class ("fast") is for micro tasks / ultra-low latency.
- 30B+ class models are allowed only as special-case runs (expect heavy offload + slowdowns). Do not treat as daily driver.

Rule:
- Never pick a model size that contradicts the hardware baseline. If unsure → measure (nvidia-smi / runtime logs) before changing defaults.

STATUS:
This section is canonical and governs all Local AI usage.

====================================================================
SUPER JARVIS LOCAL v2 — HUB INGEST + RETRIEVAL ENGINE (GREEN / LOCKED)
====================================================================

STATUS: VERIFIED GREEN BASELINE (2026-02-20)
CHECKPOINT: SUPER_JARVIS_AGENT_GLUE_GREEN__2026-02-20

PURPOSE:
Deterministic HUB ingest + retrieval engine with agent-ready context packing.
Design goal: zero guessing, measurable behavior, dependency-light, stable CLI contracts.

VERIFIED ENV (GREEN):
- Repo root: C:\AI_WORK\fs_local_jarvis
- Python venv: C:\AI_WORK\venv_jarvis\Scripts\python.exe
- Python: 3.12.10
- chromadb: 1.5.1
- Chroma DB path: C:\AI_WORK\fs_local_jarvis\db_chroma
- HUB source: C:\Users\danie\OneDrive\PROSJEKT SYNK\BLENDER\HUB_v4_CANONICAL.md
- Package layout: C:\AI_WORK\fs_local_jarvis\src\jarvis_local

CANONICAL CLIs (DO NOT RENAME):
- jarvis-ingest-v2.exe
- jarvis-query.exe
- jarvis-route.exe
- jarvis-agent-pack.exe

INGEST v2 (LOCKED GREEN):
- Deterministic section-aware parsing: LAWS / STATE / OTHER
- Deterministic chunk schema with stable chunk_id + doc_id
- Collections: ALL / LAWS / STATE
- Idempotent upsert verified
- --rebuild verified safe

QUERY (GREEN):
- jarvis-query supports --json
- --json prints ONLY valid JSON (machine output); default human output unchanged.

ROUTER (GREEN):
- jarvis-route supports --format {PACK,JSON}

AGENT GLUE (GREEN):
- jarvis-agent-pack online
- Purpose: route → retrieval → JSON context → PROMPT or JSON pack
- Supports:
	--format {PROMPT,JSON}
	Pass-through routing args (mode, n-laws, n-state, filters)
- PROMPT format contract (order is LOCKED):
	SYSTEM → CONTEXT (JSON) → USER
====================================================================

--------------------------------------------------------------------
APPEND (2026-02-20) — NEAR-DUPLICATE DEDUPE — JARVIS_DEDUPE_NEAR_GREEN
--------------------------------------------------------------------
- Near-duplicate filtering verified GREEN
- Flags:
	--dedupe-near
	--dedupe-thresh
	--dedupe-k
- Deterministic algorithm:
	- normalize (strip + collapse whitespace + lowercase)
	- word shingles size K
	- hash: blake2b(digest_size=8)
	- overlap: |A∩B| / min(|A|,|B|)
	- keep-first, drop-later
	- Deterministic ordering enforced: sort by (section, chunk_id)
- Determinism proof: identical removed-set across runs (stable)
- Baseline effect (verified): 64 → 63 chunks (0 noise, 0 drift)
- Emits exactly one line when enabled:
	[DEDUPE] enabled=1 k=5 thresh=0.95 before=64 after=63 removed=1
--------------------------------------------------------------------

--------------------------------------------------------------------
APPEND (2026-02-20) — QUERY STRICT JSON — JARVIS_QUERY_JSON_GREEN
--------------------------------------------------------------------
- jarvis-query --json mode verified
- --json prints ONLY valid JSON (machine output)
- JSON parse verified via PowerShell (ConvertFrom-Json)
- Human output unchanged
--------------------------------------------------------------------

--------------------------------------------------------------------
APPEND (2026-02-20) — AGENT GLUE — JARVIS_AGENT_PACK_GREEN
--------------------------------------------------------------------
- New CLI online: jarvis-agent-pack / jarvis-agent-pack.exe
- Function (verified): prompt → routing → retrieval → JSON context → agent-ready input
- Modes supported (verified):
	- PROMPT mode (SYSTEM + CONTEXT + USER)
	- JSON mode (pipeline/machine)
- Pass-through of routing parameters verified (mode, n-laws, n-state, filters)
- Architecture (non-invasive):
	- Isolated module: agent_pack.py
	- Entry point registered via pyproject.toml
	- No changes to existing ingest/query/router engines at checkpoint time
- PROMPT format contract verified (LOCKED order):
	SYSTEM → CONTEXT (JSON) → USER
--------------------------------------------------------------------

--------------------------------------------------------------------
APPEND (2026-02-20) — CONTINUE CONTEXT PACK VERIFIED — JARVIS_CONTINUE_CONTEXT_PACK_GREEN
--------------------------------------------------------------------
CHECKPOINT: JARVIS_CONTEXT_PACK_IN_CONTINUE_VERIFIED__2026-02-20

STATUS: VERIFIED (SAFE MODE)

FACTS (MEASURED):
- jarvis-agent-pack produces a deterministic SYSTEM + CONTEXT + USER bundle (prompt-ready)
- CONTEXT can be pasted directly into Continue without additional tooling
- Local model executes the instruction under SAFE MODE control end-to-end
- No hallucination observed under this workflow; no context drift during the verified test
- Result: Local AI is now project-aware via HUB truth, not chat memory

IMPLICATIONS (ALLOWED, TIED TO FACTS):
- Decision-making can be constrained by real HUB laws and current state
- Manual context copy can be automated later (non-blocking)
- Enables a Daniel-friendly UI layer on top of the same contract
- Supports scaling the project without governance decay

UNIQUE_MARKER: JARVIS_CONTINUE_CONTEXT_PACK_GREEN
--------------------------------------------------------------------

CHECKPOINT — JARVIS_API_E2E_GREEN__2026-02-20

- Date: 2026-02-20
- Status: E2E GREEN (Jarvis CLI executed successfully via jarvis_api; output returned)
- Verified:
	- jarvis_api running on 127.0.0.1:8787; /health + /version OK
	- ask_jarvis.ps1 located at: C:\AI_WORK\fs_local_jarvis\tools\ask_jarvis.ps1
	- ask_jarvis.ps1 params verified: -Q (mandatory), -Mode (AUTO|LAWS|STATE|BOTH), -Model, -Temperature, -TimeoutSec
	- Host shell: PowerShell 5.1 (powershell.exe); pwsh (PS7) not installed / not available
	- Jarvis execution now works end-to-end with exit_code=0 through jarvis_api
- Fixes locked in:
	- jarvis_runner.py patched: if exit_code=0 and stdout is plain text (non-JSON), treat it as valid output_text (fallback) instead of error
- Current operational template constraint:
	- jarvis_api still validates JARVIS_CMD_TEMPLATE must include {json} and {mode}
	- Workaround template used: reads {json} request file, extracts .user_text, maps mode (DEFAULT->AUTO, STRICT->LAWS, RAG->BOTH), calls ask_jarvis.ps1 with -Q
- Known integration gap (next work):
	- Open WebUI points to http://127.0.0.1:8787/v1 but jarvis_api does not yet expose OpenAI-compatible adapter endpoints (/v1/models, /v1/chat/completions, /v1/openapi.json alias). Adapter patch planned next.
- Troubleshooting truths (measured):
	- WinError 10048 = port already in use; resolve via netstat -ano and kill LISTENING PID
	- $PID is read-only in PowerShell; avoid $pid variable; use $targetPid/$listenPid
	- Select-String may return single object; force array with @() and use .Length under StrictMode

CHECKPOINT — JARVIS_API_RUNTIME_CONTRACT_LOCKED__2026-02-20

- Date: 2026-02-20
- Purpose: Lock in runtime truths and time-saving constraints discovered during E2E bring-up.
- Confirmed Jarvis CLI contract:
	- ask_jarvis.ps1 does NOT accept JSON input files
	- Mandatory input param is -Q (string)
	- Mode values accepted: AUTO | LAWS | STATE | BOTH
	- Optional params available: -Model, -Temperature, -TimeoutSec
- Current jarvis_api limitation:
	- JARVIS_CMD_TEMPLATE validation requires {json} and {mode} placeholders
	- Direct {q} placeholder not yet supported (planned future patch)

- Operational workaround template (verified working):

	powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
		$p='{json}';
		$req=Get-Content -LiteralPath $p -Raw | ConvertFrom-Json;
		$m='{mode}';
		if($m -eq 'DEFAULT'){ $m='AUTO' }
		elseif($m -eq 'STRICT'){ $m='LAWS' }
		elseif($m -eq 'RAG'){ $m='BOTH' };
		& 'C:\AI_WORK\fs_local_jarvis\tools\ask_jarvis.ps1' -Q $req.user_text -Mode $m -TimeoutSec 120
	"

- Transport-layer fix locked in:
	- jarvis_runner.py now treats plain-text stdout as valid output_text when exit_code=0
	- JSON stdout remains supported when present
	- Non-zero exit_code still produces structured error

- PowerShell StrictMode truths (time savers):
	- $PID is built-in read-only variable (case-insensitive) → never use $pid for process IDs
	- Select-String may return a single object → always wrap with @() and use .Length
	- Do not assume exception.Response exists; log Exception.Message and ErrorDetails.Message
	- netstat -ano is the authoritative port ownership tool (Get-NetTCPConnection can miss races)

- Port conflict resolution pattern (verified):
	- netstat -ano | findstr :8787
	- identify LISTENING PID
	- Stop-Process -Id <PID> -Force
	- verify no LISTENING entries remain before restart

- Integration state:
	- jarvis_api core pipeline is E2E green
	- Open WebUI currently bypasses governance due to missing OpenAI-compatible adapter
	- Adapter endpoints planned:
			/v1/models
			/v1/chat/completions
			/v1/openapi.json alias

====================================================================

## Dedupe / consolidation notes
- Verbatim import. Do not dedupe yet.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Local AI Stack (library): `../canonical/16__LOCAL_AI_STACK.md`
