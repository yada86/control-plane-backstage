# Path Governance

## Purpose
Prevent path drift across Windows/WSL/tools.

## Core Laws
- `HUB.LAW.PATHS.CANONICAL` — Canonical paths must be documented and referenced; avoid hardcoding duplicates.
- `HUB.LAW.PATHS.NO_GUESSING` — Always verify before claiming a path is canonical.

## Do
- Keep one canonical map and reference it.

## Don’t
- Don’t introduce new root conventions casually.

## When Relevant
- Any new script/config/doc pointer.

## Crosslinks
- WSL Boundaries: `13__WSL_BOUNDARIES.md`