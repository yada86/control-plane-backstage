# Internal AI Docs Index (HUB/Runbook) — v1

## Goal
Make HUB + Runbook documentation queryable by local AI (private), with deterministic indexing and source citations.

## Corpus roots (v1)
- `docs/hub/content/runbook/**/*.md`
- `docs/hub/content/docs/**/*.md`

Non-goals:
- No new services/endpoints.
- No public hosting.
- No auto-writing to docs from AI.

## Output contract (v1)
Index build produces:
- `index_manifest.json` (corpus roots, counts, corpus sha256, timestamp)
- `chunks.jsonl` (one JSON per chunk: path, heading, anchor, chunk_index, sha256, text)
- Optional vector store folder (if/when enabled), treated as derived artifact.

## Determinism rules
- Stable file ordering
- Stable chunking (split on markdown headings)
- Stable hashing (sha256 over normalized content)

## Query contract (v1)
CLI (Jarvis-style):
- `jarvis-docs --q "..."` prints:
  - answer (best-effort)
  - sources: `path#anchor` (+ optional snippet/lines)

## Verification (READ ONLY)
- Corpus file counts match measured reality
- `corpus_sha256` changes only when docs change
- Query returns sources only from allowed corpus roots

## Usage (jarvis-docs)

### Preconditions (measure)
- Control Plane repo exists at: `/home/danie/control_plane/backstage`
- Jarvis repo exists at: `/home/danie/src/fs_local_jarvis`

### Build index (deterministic JSONL)
This writes derived artifacts only (no generated docs committed to git):
- `/home/danie/src/fs_local_jarvis/db_docs_index/chunks.jsonl`
- `/home/danie/src/fs_local_jarvis/db_docs_index/index_manifest.json`

Command:
- `FS_CP_REPO="/home/danie/control_plane/backstage" FS_DOCS_INDEX_DIR="/home/danie/src/fs_local_jarvis/db_docs_index" jarvis-docs build`

### Query (sources first)
Command examples:
- `FS_DOCS_INDEX_DIR="/home/danie/src/fs_local_jarvis/db_docs_index" jarvis-docs query --q "new chat hygiene" --k 5 --no-snippets`
- `FS_DOCS_INDEX_DIR="/home/danie/src/fs_local_jarvis/db_docs_index" jarvis-docs query --q "runtime gate" --k 5 --snippets`

Output contract:
- Always prints `source: <path>#<anchor>` (or `<path>` if no anchor).
- `--no-snippets` suppresses snippet lines (sources only).

### Bash quoting LAW (no backticks in wraps)
DO NOT use backticks (command substitution) inside double-quoted `--summary "..."` when pushing wraps.
Use single quotes for wrap text, or escape backticks.

Bad (will execute commands):
- `--summary "added \`jarvis-docs\` with \`--no-snippets\`"`

Good:
- `--summary 'added jarvis-docs with --no-snippets'`
