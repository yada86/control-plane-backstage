# Jarvis — System Audit (`jarvis-audit`)

`jarvis-audit` runs deterministic READ ONLY invariants in WSL. It never applies changes.

## What it checks
1. `jarvis-query smoke` prints exactly `OK` and exits 0.
2. `jarvis-agent-pack --show pack --format JSON --q "schema check"` includes `schema == "jarvis.agent_pack.v1"`.
3. Docs discoverability checks (only if `CONTROL_PLANE_ROOT` exists):
   - Runbook Index contains Jarvis canonical link.
   - Header source contains `DOCS = ARKITEKTUR (NON-NEGOTIABLE)`.
   - CONTROL_PLANE_ROOT handling (docs_discoverability):
     - If `CONTROL_PLANE_ROOT` is set: use it to locate docs base.
     - If unset: audit falls back to `/home/danie/control_plane/backstage` (if it exists) for docs checks.
     - If neither exists: `docs_discoverability` is `WARN` (skipped).
4. Optional control-plane probe (if `BASE` is set):
   - GET `$BASE/api/runtime/new-chat-start?debug=1`
   - Reads `meta.wrapKey`.

## Policy (control_plane_wrapkey)
- `BASE` unset => `INFO` with `SKIP` (`BASE unset -> skipped`).
- If `CONTROL_PLANE_ROOT` is unset, auditor attempts fallback root `/home/danie/control_plane` (if it exists) to read runtime truth wrap id; if unavailable => expected wrap id unreadable => `WARN`.
- `BASE` set + endpoint unreachable/non-200/parse error => `WARN`.
- Endpoint reachable + `meta.wrapKey` missing => `FAIL`.
- Endpoint reachable + expected runtime truth wrap id unreadable => `WARN`.
- Endpoint reachable + wrapKey mismatch => `FAIL`.
- Endpoint reachable + wrapKey match => `OK` (`PASS`).

### Control Plane wrapkey check (control_plane_wrapkey)
- Default behavior: if `BASE` is unset, `control_plane_wrapkey` is `SKIP` with reason `BASE unset -> skipped`.
- To enable the check:
   - Set `BASE=http://127.0.0.1:7007` (or pass `--base http://127.0.0.1:7007`).
   - Run `jarvis-audit --require-control-plane` to treat Control Plane as required (so failures surface as WARN/FAIL instead of being silently skipped).
- Notes:
   - The check fetches: `/api/runtime/new-chat-start?debug=1` and compares `meta.wrapKey` with the newest runtime truth wrap id.
   - `CONTROL_PLANE_ROOT` may be used to locate runtime truth for the expected wrap id (fallbacks exist as documented).

## Usage
```bash
jarvis-audit
jarvis-audit --json
jarvis-audit --emit-pack --json
jarvis-audit --require-control-plane --base "http://127.0.0.1:7007"
```

## Output and exit codes
- Human-readable output by default.
- `--json` prints JSON report only.
- `--emit-pack` emits a `jarvis.agent_pack.v1` remediation pack (proposal only, no apply).
- Exit code `0` when core invariants pass.
- Exit code `2` when any core invariant fails.

## Deterministic nuance
For machine parsing of agent-pack output, always use `--format JSON`.
