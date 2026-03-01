# EXEC Rules

## Purpose
Runtime measurement truth (Blender, engines) without assumptions.

## Core Laws
- `HUB.RULE.EXEC.ONE_BLOCK` — One copy-safe exec block per action.
- `HUB.RULE.EXEC.MEASURE_THEN_PATCH` — Measure before patch; verify after.

## Do
- Use clear logging and visible debug outputs.

## Don’t
- Don’t patch blindly.

## When Relevant
- Blender console scripts, runtime inspection.

## Crosslinks
- SAFE MODE: `01__SAFE_MODE.md`