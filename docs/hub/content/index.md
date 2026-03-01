# HUB Docs (Canonical)

## Canonical Source of Truth (LOCKED)
- Canon lives in Backstage docs (this folder).
- Windows HUB files are **published artifacts** (for compatibility / sha256 / vault / restore), not the writing surface.
- Vault (F:\\HUB_VAULT) is immutable archive/history.

## How to Update (fast workflow)
1. Edit markdown under `docs/hub/` (this is canon).
2. Publish to Windows HUB (later: `Publish-HubDocs.ps1` one-command deploy).
3. Vault snapshots mirror the published layer.

## Where to Start
- Canonical index (TOC + rules): `docs/hub/canonical/00__HUB_v4_CANONICAL__INDEX.md`
- Manifest (for relevance selection / New Chat Start generator): `docs/hub/hub_manifest.json`
- Checkpoint curation (Pinned baselines + archive pointer): `docs/hub/checkpoints/00__PINNED_BASELINES.md`
- Runbook view (canonical chapter structure): `docs/hub/runbook/00__RUNBOOK_INDEX.md`
- Library view (thematic extraction): `docs/hub/canonical/00__HUB_v4_CANONICAL__INDEX.md`

## Scope Guard
- No new Backstage backend endpoints for docs.
- Generator must read canon docs directly (manifest-driven).
- Avoid duplication: use stable `rule_id` conventions described in the canonical index.