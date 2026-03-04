# Runtime Truth (JSONL) — Backstage Integration

This page is the single source of truth for Runtime Truth configuration and runtime API references for HUB TechDocs.

## Runtime Truth Contract (authoritative)

`runtime.ts` reads these config keys:

```text
runtimeTruth.filePath
runtimeTruth.jsonlPath
runtimeTruth.latestPath
hubDocs.rootPath
```

Minimal working `app-config.local.yaml`:

```yaml
runtimeTruth:
  filePath: /home/danie/control_plane/runtime_truth/runtime.jsonl
  jsonlPath: /home/danie/control_plane/runtime_truth/runtime.jsonl
  latestPath: /home/danie/control_plane/runtime_truth/runtime.latest.json
```

Hard rule (operations):

> `runtime.ts` supports `RUNTIME_TRUTH_PATH` as fallback, but dev MUST NOT rely on it. Prefer explicit `app-config.local.yaml` keys to avoid hidden dependencies. If paths are wrong, expect fail-fast behavior (for example ENOENT).

## Runtime API surface (from runtime.ts)

- `GET /api/runtime/events`
- `GET /api/runtime/hub/paths`
- `GET /api/runtime/hub/file`
- `POST /api/runtime/hub/patch`
- `POST /api/runtime/hub/restore`
- `POST /api/runtime/checkpoints/restore`

UI normalization contract (Runtime Truth page, UI-only):

- Backend events may emit keys such as `type`, `status`, `ts` (plus `id`, `name`, `summary`, `facts`, `msg`).
- Runtime Truth UI normalizes to UI fields: `event_type`, `severity`, `ts`, and `project` (optional).
- Mapping: `type` → `event_type`, `status` → `severity`, timestamp fallback is `timestamp|ts|time|date`.
- Purpose: tolerate mixed schemas without backend expansion; UI must not crash when optional fields are missing.
- Reference checkpoint: `RUNTIME_UI_TIMELINE_GREEN` (2026-02-28).

## Runtime event envelope (minimum schema)

Runtime Truth is append-only JSONL. Events may vary, but for governed tooling we use a minimal envelope.

Required keys (recommended for new tooling)
- `type` (string): event category (example: `hub_session_wrap`, `jarvis_recommendation`)
- `ts` (string): ISO-8601 timestamp (example: `2026-03-04T22:21:48+01:00`)

Optional keys (common)
- `id` (string): stable identifier (wrap id or event id)
- `summary` (string): 1–2 line human summary
- `project` (string): grouping tag
- `facts` (object): structured facts (machine-readable)
- `msg` (string): freeform message

## Event id conventions

For governed tooling, event `id` MUST be stable and deterministic.

Rules:
- Use uppercase prefix + double-underscore separators.
- Include the SSOT source wrap id when the event is derived from a wrap.
- Prefer hashing canonical JSON (not pretty-printed output) for plan/content identity.

Patterns:
- Session wrap: `HUB_SESSION_WRAP__<SHORT_NAME>__YYYY-MM-DD`
- Jarvis recommendation: `JARVIS_RECO__<plan_sha256>__<wrap_id>`

Notes:
- `plan_sha256` is the SHA-256 of the canonical plan JSON (see jarvis-next spec).
- Do not use random UUIDs for governed events (breaks SSOT traceability).

Example: `jarvis_recommendation` (A-mode; no execution)

```json
{
  "type": "jarvis_recommendation",
  "ts": "2026-03-04T22:21:48+01:00",
  "id": "JARVIS_RECO__<plan_sha256>__<wrap_id>",
  "summary": "Recommended next action from RuntimeTruth (governed; approval required for any execution).",
  "facts": {
    "source_wrap_id": "<latest_wrap_id>",
    "topic": "NEW CHAT START",
    "plan": {
      "mode": "A",
      "next_action": "<exact next step>",
      "goal": "<goal of next chat>"
    },
    "plan_sha256": "<sha256 of canonical plan json>",
    "approval_token": "APPROVE:<latest_wrap_id>:<plan_sha256>"
  }
}
```

## WSL boundary

- Runtime Truth files must exist at the configured WSL paths.
- Any IP, `baseUrl`, or proxy target must be explicitly configured.
- Do not assume IP stability across reboots; measure when needed.
