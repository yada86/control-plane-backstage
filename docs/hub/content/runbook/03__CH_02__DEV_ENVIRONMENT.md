# 2) DEV ENVIRONMENT (LOCKED BASELINE)

## Legacy content (imported from monolithic HUB_v4_CANONICAL)
2) DEV ENVIRONMENT (LOCKED BASELINE)
====================================================================

This baseline must match reality. If it doesn’t, measure and update this chapter.

Timezone
- Europe/Oslo

Primary operating contexts
- VSCAI_WIN  → VS Code AI editing on Windows filesystem (C:\, D:\, F:\)
- VSCAI_WSL  → VS Code AI editing on WSL/Linux filesystem (/home, /mnt/c, ...)
- PowerShell → Windows shell
- PowerShell (Administrator) → Elevated Windows shell (only when required)
- WSL terminal → Linux shell inside WSL

Backstage (WSL)
- Repo root: [workspace-local checkout]
- UI: ${APP_BASE_URL}
- Backend: ${BACKEND_BASE_URL}
- WSL IP: [derived at runtime; do not hardcode]

Runtime truth (Windows)
- ${RUNTIME_TRUTH_PATH}
- ${RUNTIME_TRUTH_PATH} (sibling file `runtime.latest.json` in same directory)

TechDocs publish directory
- ${TECHDOCS_PUBLISH_DIR}

### Generated artifacts policy (git)

Local TechDocs publishing produces generated files under:

- `packages/backend/static/docs/` (published TechDocs output)
- `docs/hub/_build/` (local build artifacts / superdocs)
- `.continue/` (local tool state)

Policy:
- These paths are **generated artifacts** and must not be committed in normal source commits.
- Source-of-truth lives under `docs/hub/content/**` and code under `packages/**`.
- If we ever choose to version published docs output, it must be done as a separate explicit “publish” commit with its own documented workflow.

Vault
- F:\HUB_VAULT

====================================================================

## Dedupe / consolidation notes
- If these facts appear elsewhere in legacy chapters, treat this as the canonical environment baseline and replace repeats with pointers here.

## Crosslinks
- Runbook Index: `00__RUNBOOK_INDEX.md`
- Path Governance (library): `../canonical/18__PATH_GOVERNANCE.md`
