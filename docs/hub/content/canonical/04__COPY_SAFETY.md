# Copy Safety Laws

## Purpose
Ensure every operator paste is safe, deterministic, and unambiguous.

## Core Laws
- `HUB.LAW.COPY.ONE_BLOCK` — Exactly one copy/paste-safe block per action.
- `HUB.LAW.COPY.PASTE_TARGET_LABEL` — Paste-target label must be outside code fences.
- `HUB.LAW.COPY.NO_MIXED_CONTEXT` — No mixing PowerShell/WSL/EXEC contexts in a single block.

## Do
- Always label: “LIM RETT INN I → <environment>”
- Keep blocks executable/file-relevant only.

## Don’t
- Don’t put operator instructions inside code fences.
- Don’t split code across multiple fences.

## When Relevant
- Always.

## Crosslinks
- VSCAI Rules: `10__VSCAI_RULES.md`
- EXEC Rules: `11__EXEC_RULES.md`
- PowerShell Rules: `12__POWERSHELL_RULES.md`