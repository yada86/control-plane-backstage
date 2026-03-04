# Jarvis — Agent Pack Schema

### Agent Pack schema v1 (proof-carrying work package)

Jarvis can emit a **work package** (a deterministic JSON “pack”) that is designed to be executed under HUB governance:
- **Measure → Patch → Verify → Wrap**
- Commands are explicit and can be run as-is (no interpretation).

#### JSON shape (v1)
```json
{
  "schema": "jarvis.agent_pack.v1",
  "intent": "short human goal",
  "scope_guard": [
    "docs-only change",
    "no new endpoints",
    "no refactor",
    "SAFE MODE: measure before patch"
  ],
  "inputs": {
    "q": "original query",
    "context_refs": ["runbook paths or doc anchors"],
    "base": "optional control-plane base URL"
  },
  "plan": [
    "step 1 ...",
    "step 2 ..."
  ],
  "measure": [
    {
      "id": "MEASURE_01",
      "tool": "EXEC_WSL",
      "mode": "READ_ONLY",
      "cmd": "grep -RIn \"...\" ...",
      "expect": "what success looks like"
    }
  ],
  "patch": [
    {
      "id": "PATCH_01",
      "tool": "VSCAI_WSL",
      "mode": "PATCH",
      "target": "file/path",
      "change": "minimal diff description"
    }
  ],
  "verify": [
    {
      "id": "VERIFY_01",
      "tool": "EXEC_WSL",
      "mode": "READ_ONLY",
      "cmd": "python3 -m py_compile ...",
      "expect": "exit 0"
    }
  ],
  "wrap": {
    "id_template": "HUB_SESSION_WRAP__<SHORT_NAME>__YYYY-MM-DD",
    "summary": "1–2 lines",
    "known_issue": "— or current blockers",
    "next_action": "exact next step",
    "goal": "goal of next chat"
  },
  "outputs": {
    "status": "DRAFT|READY|APPLIED",
    "notes": ["anything critical"]
  }
}
```

#### How to view packs (WSL)
- Show full pack JSON:
  - `jarvis-agent-pack --show pack --q "<...>"`
- Show answer-only JSON (demo-safe):
  - `jarvis-agent-pack --show answer --q "<...>"`

### Canonical `--show answer` demo (strict parsing)

```bash
jarvis-agent-pack --q "Reply in JSON only: {\"hash\":\"303aefff2e9f776c5eac3a1ac65160af0a1cc8704c798103c280b53f76694894\",\"verdict\":\"OK\"}" --format JSON --no-system --show answer
```

```bash
python3 - <<'PY'
import hashlib
payload = b"303aefff2e9f776c5eac3a1ac65160af0a1cc8704c798103c280b53f76694894"
print(hashlib.sha256(payload).hexdigest())
PY
```

- Expected digest from verification snippet:
  - `303aefff2e9f776c5eac3a1ac65160af0a1cc8704c798103c280b53f76694894`
- Contract note:
  - `--format JSON` without `--show answer` returns pack JSON (`q` / `mode` / `context` / metadata), not assistant answer JSON.

### Impressive demo (deterministic compute)

```bash
jarvis-agent-pack --compute-sha256 CONTROL_PLANE --format JSON --no-system --show answer
```

### Format nuance (measured)
- `--show pack` may default to PROMPT unless `--format JSON` is set; for machine parsing use:
  - `jarvis-agent-pack --show pack --format JSON --q "<...>"`
