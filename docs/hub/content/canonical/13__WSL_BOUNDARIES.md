# WSL Boundaries

## Purpose
Prevent mixed-context mistakes between Windows and WSL.

## Core Laws
- `HUB.RULE.WSL.CONTEXT_CLARITY` — Always declare whether paths are Windows or WSL.
- `HUB.RULE.WSL.NO_MIXED_BLOCKS` — No PowerShell inside WSL blocks; no WSL paths inside Windows-only blocks unless bridged.

## Do
- Use `wslpath` when bridging paths.

## Don’t
- Don’t mix filesystem assumptions.

## When Relevant
- Any cross-OS operation.

## Crosslinks
- Copy Safety: `04__COPY_SAFETY.md`