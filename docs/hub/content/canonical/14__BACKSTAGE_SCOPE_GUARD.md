# Backstage Scope Guard

## Purpose
Keep Backstage changes thin and non-invasive.

## Core Laws
- `HUB.LAW.BACKSTAGE.NO_NEW_ENDPOINTS` — No new endpoints unless explicitly ordered.
- `HUB.LAW.BACKSTAGE.THIN_ORCHESTRATION` — UI → backend → existing scripts (scripts remain source of truth).
- `HUB.LAW.BACKSTAGE.NO_RETRACE` — Don’t re-trace verified architecture.

## Do
- Use existing events and already-loaded data.

## Don’t
- Don’t grow a second control plane inside Backstage.

## When Relevant
- Any Backstage UI/backend changes.

## Crosslinks
- Architecture Laws: `03__ARCHITECTURE_LAWS.md`