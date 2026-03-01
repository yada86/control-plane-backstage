# HUB Systems

## Systems Map (Canonical)

- Canonical rule: Repo/TechDocs (WSL/NVMe) is canonical; HUB_VAULT is backup mirror; OneDrive is not master.

- Paths (WSL):
  - Backstage repo: /home/danie/control_plane/backstage
  - Runtime truth store: /home/danie/control_plane/runtime_truth_store/runtime.jsonl
  - Runtime truth dir (symlink container): /home/danie/control_plane/runtime_truth

- Runtime API surface:
  - /api/runtime/events (UI consumes; mixed schema tolerated via UI normalization)

- Cross-links:
  - [runtime-truth.md](runtime-truth.md)
  - [hub-state.md](hub-state.md)

## MkDocs Verification (Canonical)

Canonical documentation source lives in:
- `/home/danie/control_plane/backstage/docs/hub`

Verification command (WSL):

```bash
mkdocs build --config-file /home/danie/control_plane/backstage/docs/hub/mkdocs.yml --strict
```

## Runtime GREEN gate (non-lint)

Runtime is GREEN when all of the following are true:
- Port 7007 is listening.
- `GET /healthcheck` returns HTTP 200.
- `GET /api/runtime/new-chat-start?debug=1` reports `meta.wrapFound=true` and exposes `wrapKey` + `wrapTs`.
- `GET /api/runtime/hub/paths` reports `ok=true`.

Repo-wide lint may still be RED without blocking runtime GREEN for this gate.

Run (WSL):

```bash
bash scripts/fs_green_gate_runtime.sh
```
