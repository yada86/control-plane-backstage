# Architecture Laws (CORE is sacred)

## Purpose
Protect CORE systems and prevent accidental architectural drift.

## Core Laws
- `HUB.LAW.CORE.SACRED` — CORE systems are sacred unless explicit approval is given.
- `HUB.LAW.SCOPE.NO_REFACTOR` — No refactor; minimal diffs; additive only.
- `HUB.LAW.SCOPE.NO_NEW_ENDPOINTS` — No new backend endpoints unless explicitly ordered.

## Do
- Patch locally, document decisions, checkpoint at stability points.

## Don’t
- Don’t introduce new subsystems or abstractions to “clean things up”.

## When Relevant
- Any system-level change.

## Crosslinks
- Backstage Scope Guard: `14__BACKSTAGE_SCOPE_GUARD.md`
- Path Governance: `18__PATH_GOVERNANCE.md`