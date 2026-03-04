# Jarvis — Health Checks

### jarvis_health.sh (aggregated health check)

- Script path: `/home/danie/src/fs_local_jarvis/tools/jarvis_health.sh`
- Run: `/home/danie/src/fs_local_jarvis/tools/jarvis_health.sh`
- Optional control-plane read-only check: `BASE="http://127.0.0.1:7007" /home/danie/src/fs_local_jarvis/tools/jarvis_health.sh`
- Optional strict control-plane requirement: `BASE="http://127.0.0.1:7007" /home/danie/src/fs_local_jarvis/tools/jarvis_health.sh --require-control-plane`
- Expected core PASS lines include:
  - `[PASS] found jarvis-query -> ...`
  - `[PASS] found jarvis-agent-pack -> ...`
  - `[PASS] entrypoint contains: from jarvis_local.query_v2 import main`
  - `[PASS] entrypoint contains: from jarvis_local.agent_pack import main`
  - `[PASS] jarvis-query smoke -> OK`
  - `[PASS] Jarvis health OK`

### Quick health check (READ ONLY)
- Command(s): **PLACEHOLDER — MEASURE THIS**
- Expected output: **PLACEHOLDER — MEASURE THIS**
- Exit codes: **PLACEHOLDER — MEASURE THIS**

### Smoke test (READ ONLY)
- Query used: **PLACEHOLDER — MEASURE THIS**
- Expected invariant: **PLACEHOLDER — MEASURE THIS (e.g., non-empty result set / stable JSON shape)**

### Windows wrapper commands (measured)
- Query: bin/jarvis.cmd
  - Forwards `%*` to `jarvis_cli.py`.
  - Runs: `"%FS_AI_WORK_ROOT%\venv_jarvis\Scripts\python.exe" "%FS_AI_WORK_ROOT%\fs_local_jarvis\src\jarvis_cli.py" %*`
- Ingest: bin/jarvis_ingest.cmd
  - Runs: `"%FS_AI_WORK_ROOT%\venv_jarvis\Scripts\python.exe" "%FS_AI_WORK_ROOT%\fs_local_jarvis\src\jarvis_ingest.py"`

- WSL-native entrypoints (measured):
  - src/jarvis_cli.py
  - src/jarvis_ingest.py
  - src/jarvis_local/query_v2.py
  - src/jarvis_local/ingest_v2.py
  - src/jarvis_local/route_v2.py
  - src/jarvis_local/agent_pack.py
- Canonical command is not asserted here; use the canonical env override below until code hardening is completed.

## Windows wrapper (jarvis.cmd) — deterministic WSL bridge

**Wrapper location (Windows):**
- `C:\Users\danie\bin\jarvis.cmd`

**What it does:**
- Calls WSL-native Jarvis entrypoints via `wsl.exe -e` (no PowerShell dependency).
- Ensures a default Chroma path is present if `--chroma-path` is not provided.
- Injects a deterministic default model into WSL execution via env.

**WSL bin path used by wrapper:**
- `WSLBIN=/home/danie/ai_envs/jarvis_wsl_312/bin`

**Default Chroma path used by wrapper (when caller does not pass --chroma-path):**
- `/home/danie/ai_data/jarvis/chroma`

**Deterministic model injection (added 2026-03-03):**
- Wrapper defines: `DEFAULT_MODEL=qwen2.5:7b-instruct`
- Wrapper executes WSL commands as:
```bash
wsl.exe -e env FS_JARVIS_MODEL=!DEFAULT_MODEL! %WSLBIN%/jarvis-...
```
- This makes Windows→WSL calls use the same default model as the hardened WSL CLI.
