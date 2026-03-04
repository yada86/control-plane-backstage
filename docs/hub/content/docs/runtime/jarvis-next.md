# Jarvis Next — Runtime Specification

## Purpose

Jarvis Next is a governed recommendation engine that reads
RuntimeTruth and proposes the next development step.

It operates in **A-mode (recommend)** with optional **B-mode approval validation**.

No automatic execution is allowed.

Related:
- Runbook: [Jarvis next — SSOT-native recommendations + approve](../runbook/jarvis/jarvis_next_recommendations.md)

---

## Data Sources

Jarvis reads:

runtime.latest.json  
runtime.jsonl

These represent the RuntimeTruth SSOT.

---

## Recommendation Flow

RuntimeTruth
↓
jarvis-next
↓
deterministic plan
↓
plan_sha256
↓
approval token
↓
optional approval validation

---

## Deterministic Plan Hash

The plan hash is generated using:

sha256(canonical_json(plan))

Where canonical JSON means:

json.dumps(plan, sort_keys=True, separators=(",", ":"))

This guarantees deterministic hashing.

---

## Approval Token

Format:

APPROVE:<latest_wrap_id>:<plan_sha256>

Example:

APPROVE:HUB_SESSION_WRAP__EXAMPLE__2026-03-04:9f8a2b...

---

## Validation

jarvis-next --approve <token>

Validation checks:

1. Token format
2. wrap_id matches runtime.latest.json
3. sha256 matches canonical plan hash

If all checks pass:

APPROVED (VALID) — execution not implemented

---

## Governance Rules

Jarvis Next enforces:

- RuntimeTruth as SSOT
- Docs-first development
- Deterministic plans
- Approval-token gated execution

Jarvis never performs changes automatically.

---

## Future Extensions

Possible future additions:

- jarvis-next --emit recommendation event
- approval-gated execution
- structured task extraction
- Control Plane UI integration
