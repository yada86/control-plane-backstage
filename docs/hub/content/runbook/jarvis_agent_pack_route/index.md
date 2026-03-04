# Jarvis → Agent Pack → VSCAI

## Purpose
Generate a deterministic context pack from hub collections (`FS_HUB_v4`, `LAWS`, `STATE`) and feed that pack into VSCAI/Cursor for safe, minimal-diff implementation.

## Measured Reality (2026-03-03)
- Superdoc path: `docs/hub/_build/HUB_SUPERDOC_v4.md`
- `jarvis-ingest-v2` wrote 88 chunks; `chroma_path=/home/danie/ai_data/jarvis/chroma`
- `doc_id=d5c0ccf...` present in collections: `LAWS`, `STATE`, `ALL`; missing in `FS_HUB_v4`
- Therefore: to search canonical laws/state, use `LAWS`/`STATE`/`ALL` (prefer `ALL` for oversight)

## Commands
Use installed CLIs directly.

```bash
jarvis-query --collection ALL --q "..." --n 5 --show 140 --json
```

```bash
jarvis-agent-pack --q "..." --mode AUTO --format PROMPT
```

```bash
jarvis-agent-pack --q "..." --mode AUTO --format JSON
```

## Determinism Rules
- Use installed CLIs (`jarvis-query`, `jarvis-agent-pack`), not `python -m`.
- Prefer `ALL` for cross-domain oversight; use `LAWS`/`STATE` when domain-targeting is explicit.
- Never hand-edit generated packs; regenerate from the source query.
- Keep query text stable for reproducible outputs.

## Which collection do I query?
- `ALL`: oversight / “have we done this before?” / cross-domain
- `LAWS`: governance / SAFE MODE / tool rules
- `STATE`: operational baseline / procedures / runtime truth behavior
- `FS_HUB_v4`: legacy hub-tree ingest (may not include canonical superdoc ingest)

## Pre-flight anti-loop (copy/paste)

```bash
jarvis-query --collection ALL --q "...already implemented / decided against..." --n 8 --show 180 --json
```

```bash
jarvis-query --collection LAWS --q "SAFE MODE" --n 5 --show 140 --json
```

```bash
jarvis-query --collection STATE --q "New Chat Start Protocol" --n 5 --show 140 --json
```

## Do / Don’t
- Do: run pre-flight query in `ALL` before patching big changes.
- Don’t: assume ingest-v2 writes to `FS_HUB_v4`; verify collections if uncertain.

## VSCAI Header — Canonical SSOT Rule

**Status:** LOCKED  
**Scope:** `vscai_header.md` marker-delimited block

### 1. Source of Truth
- `vscai_header.md` is the single canonical source for the VSCAI header.
- Only the content inside the defined marker block is valid header content.

### 2. Marker Law
- The marker block must remain structurally intact.
- Agent-pack reads only the marker-delimited content.
- Removing or altering markers is a governance violation.

### 3. Change Protocol
Any header change requires:
1. Explicit PATCH (no indirect edits).
2. Verification of:
  - Marker integrity
  - Correct injection into JSON top-level `.system`
3. A new `HUB_SESSION_WRAP__*` documenting the change.

No wrap = no valid change.

### 4. Stability Rule
Header text must remain stable.
Refactoring, stylistic edits, or rewording without explicit order is not permitted.

## Failure Modes
- CLI missing in `PATH`:
  - Symptom: `command not found`.
  - Action: ensure your shell can resolve `jarvis-query` and `jarvis-agent-pack`.
- Collection not found / empty results:
  - Symptom: empty JSON/chunks or no useful context.
  - Action: verify collection name and query specificity.
- Chroma path resolution mismatch:
  - Symptom: runtime cannot locate vector store.
  - Expected behavior: CLI prints a resolved Chroma path; verify it points to the intended store.

## COPY INTO VSCAI
Use this template after generating a JSON pack:

```text
[PASTE YOUR CANONICAL VSCAI HEADER FROM HUB_v4_CANONICAL.md HERE — DO NOT EDIT IT]

Use this deterministic pack JSON as the only context source:
<PASTE OR ATTACH: /absolute/path/to/pack.json>

Task:
- Read the pack JSON.
- Propose and apply the smallest SAFE patch.
- Cite exact file paths changed.
- Do not refactor.
- Do not add endpoints.
- Keep changes additive and minimal.
```

## Note on `--collection`
Current `jarvis-agent-pack --help` may not expose a `--collection` flag in some installs. In that case, select dataset intent via `--mode` (for example: `LAWS`, `STATE`, or `AUTO`) and treat collection preference as an upstream `jarvis-query` concern.
