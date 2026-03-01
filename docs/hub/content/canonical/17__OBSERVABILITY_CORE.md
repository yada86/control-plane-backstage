# Observability Core

## Purpose
Make systems visible (Graphviz snapshots, overlays, metrics) without touching sacred cores.

## Core Laws
- `HUB.LAW.OBS.POST_PROCESS_ONLY` — Prefer post-processing overlays over invasive renderer changes.

## Do
- Keep baselines locked; build enhancements as overlays.

## Don’t
- Don’t modify baseline renderer unless explicitly approved.

## When Relevant
- Snapshot/Graphviz work.

## Crosslinks
- Architecture Laws: `03__ARCHITECTURE_LAWS.md`