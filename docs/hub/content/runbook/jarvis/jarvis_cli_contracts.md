# Jarvis — CLI Contracts

## CLI usage contract (important)

- `jarvis query` requires the explicit `--q` flag (positional query text is not accepted by `jarvis-query`).
- Example (Windows):
```bash
jarvis query --q "Reply with exactly: OK"
```
- If `--q` is missing, argparse exits with code `2` and shows usage help (expected behavior).

## jarvis-query smoke contract (WSL)

- `jarvis-query smoke` prints exactly `OK` and exits 0.

### Verify (READ ONLY)
```bash
jarvis-query smoke
```
Expected: exactly one line `OK` and exit code `0`.

## E2E Smoke Test (READ ONLY)

### WSL canonical entrypoint
- `python3 /home/danie/src/fs_local_jarvis/src/jarvis_cli.py <subcommand> ...`

### Smoke test (WSL, READ ONLY)
- `python3 /home/danie/src/fs_local_jarvis/src/jarvis_cli.py smoke`
Expected: prints exactly `OK` and exits 0.

- Windows wrapper uses `jarvis query --q "..."`
- WSL python entrypoint uses positional `query "<text>"` or the new `smoke` subcommand.

- Purpose: verify Jarvis v1 end-to-end generation path is operational in WSL.
- Notes:
  - `jarvis-query` / `jarvis-route` / `jarvis-agent-pack` are retrieval/context tools; LLM generation is via Ollama.
  - Deterministic defaults:
    - Model: `FS_JARVIS_MODEL` (fallback `qwen2.5:7b-instruct`)
    - Ollama URL: `OLLAMA_URL` (fallback `http://127.0.0.1:11434/v1/chat/completions`)
