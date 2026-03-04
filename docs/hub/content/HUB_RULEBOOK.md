# HUB Rulebook

Primary rulebook entry for HUB Docs.

- Runbook index: [runbook/00__RUNBOOK_INDEX.md](runbook/00__RUNBOOK_INDEX.md)
- Canonical index: [canonical/00__HUB_v4_CANONICAL__INDEX.md](canonical/00__HUB_v4_CANONICAL__INDEX.md)

## TIER-0 ENGINE LAWS

## 🔒 ONE-BLOCK LAW (NON-NEGOTIABLE)

### Definition
All EXEC / VSCAI / POWERSHELL outputs must contain **exactly ONE** copy-safe execution block.

### Mandatory Constraints
- Exactly one executable block per response.
- No secondary blocks.
- No variants or alternatives in the same response.
- No optional blocks.
- No mixed tool contexts (e.g., VSCAI + POWERSHELL together).
- No fallback snippets.
- No commentary inside execution blocks.

### Sequential Enforcement Model
If multiple steps are required:
1. Execute Step 1 in a single block.
2. Measure / verify result.
3. Proceed with next block in a new response.

No batching of steps.
No compound execution responses.

### Invalid Output Definition
Any response containing more than one execution block is invalid  
and must be regenerated.

### Governance Principle
Single-block discipline guarantees:
- Deterministic execution
- Zero context bleed (WSL vs Windows)
- No partial SAFE-mode violations
- No hidden state mutations
- No cross-environment contamination

This law overrides convenience.

Precision > Speed.
Determinism > Density.
Governance > Convenience.
