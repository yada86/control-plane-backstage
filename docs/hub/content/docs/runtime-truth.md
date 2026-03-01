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

## WSL boundary

- Runtime Truth files must exist at the configured WSL paths.
- Any IP, `baseUrl`, or proxy target must be explicitly configured.
- Do not assume IP stability across reboots; measure when needed.
