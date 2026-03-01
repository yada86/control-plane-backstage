# New Chat Start Protocol

## Purpose
Ensure every new chat starts with accurate context without re-tracing.

## Core Laws
- `BACKSTAGE.GEN.NEW_CHAT_START.NO_RETRACE` — Do not rediscover verified architecture.
- `BACKSTAGE.GEN.NEW_CHAT_START.TOC_POINTERS` — Provide TOC + where docs live (pointers), not 1000-line dumps.
- `BACKSTAGE.GEN.NEW_CHAT_START.CANON_BACKSTAGE_DOCS` — Generator references Backstage canon docs (manifest-driven).

## FRONTEND INVARIANT — SESSION WRAP SOURCE OF TRUTH (LOCKED)

**Invariant:** New Chat Start skal alltid hente "last session wrap"-feltene fra nyeste `HUB_SESSION_WRAP*`-event (ikke fra generelle checkpoints).

### Kilde (API truth)
Runtime events i UI/API har disse feltene (relevant for wrap):
- `type`: `"CHECKPOINT"`
- `name` og/eller `id`: wrap-identifikator (f.eks. `HUB_SESSION_WRAP__...`)
- `ts`: ISO timestamp
- `facts`: objekt som inneholder feltene vi trenger

**Viktig:** Frontend må **ikke** matche på `task` (feltet finnes ikke i API-shapen).

### Seleksjonsregel (må alltid holde)
1) Filtrer events hvor:
	- `(event.name || event.id)` starter med `"HUB_SESSION_WRAP"`
2) Velg **nyeste** ved `event.ts` (størst/nyest timestamp).
3) Les feltene eksakt fra `event.facts`:
	- `facts.next_actions`
	- `facts.known_issues`
	- `facts.status`
4) `pickRelevantCheckpoints(...)` er kun presentasjon (LATEST RELEVANT CHECKPOINTS) og skal aldri være datakilde for feltene over.

### Konsekvens ved brudd
Hvis frontend bruker “latest generic checkpoint” eller andre heuristikker som kilde for `next_actions/known_issues/status`, vil UI kunne vise **stale** session state (gamle next_actions/known_issues). Dette er en regressjon.

### Critical: Checkpoint Push channel (LOCKED)
- **Checkpoint push must be executed in WSL terminal** (`HUB.RULE.RUNTIME.CHECKPOINT_PUSH.WSL_TERMINAL_ONLY`).
- VSCAI may generate the command block, but the operator must run it in **WSL terminal**.

## Do
- Include: MODE, TOOL, STATUS, INDEX, scope guard, canonical paths/urls, prioritized checkpoints.
- Include doc pointers from manifest by relevance tags.

## Don’t
- Don’t point generator at Windows HUB as canon.

## When Relevant
- Every new chat.

## Crosslinks
- Manifest: `docs/hub/hub_manifest.json`
- Canonical Index: `00__HUB_v4_CANONICAL__INDEX.md`