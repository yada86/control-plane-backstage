---
title: Jarvis next — SSOT-native recommendations + approve-to-execute
---

# Jarvis next — SSOT-native recommendations + approve-to-execute

## North Star
Jarvis skal foreslå neste steg basert på RuntimeTruth (SSOT) uten å dikte. Default er READ ONLY (A). Utførelse (B) krever eksplisitt godkjenning bundet til SSOT.

## Inputs (truth sources)
- runtime.latest.json (current wrap + status)
- runtime.jsonl (historikk + åpne tasks)
- Runbook Index (docs-first gate)

## Modes
### A) Advisor (default)
Kommando: `jarvis next`
Jarvis gjør:
- leser latest + tail av JSONL
- finner open tasks / FAIL / mismatch
- sjekker docs-first (topic må finnes i Runbook Index)
- returnerer én anbefaling + WHY (wrap-id + ts) + NEXT COMMANDS
- kan emitte event: `jarvis_recommendation` (valgfritt)

Ingen filer endres.

### B) Approve-to-execute (armed)
Kommando: `jarvis next --approve "<TOKEN>"`
Krav:
- Token må være bundet til SSOT (latest wrap-id) og plan-hash.
- Hvis latest.wrap != token.wrap → STOP.
- Hvis docs-first ikke oppfylt → STOP.
- Measure-before-change alltid.

Anbefalt policy:
- Jarvis får lov å “apply + verify + prepare-wrap”
- Wrap push forblir human sign-off.

## Approval token (SSOT-bound)
Format:
`APPROVE:<LATEST_WRAP_ID>:<PLAN_SHA256>`

Token genereres av `jarvis next` sammen med planen.
Token er ugyldig hvis:
- ny wrap er pushet (latest endrer seg)
- planen endrer seg (hash mismatch)

## Execution gates (B)
0) SSOT preflight: latest.id må matche token wrap
1) Docs-first: topic finnes i Runbook Index
2) Measure preconditions: grep/exists før endring
3) Patch staging: vis diff/paths før apply
4) Apply + Verify: kjør verifiseringer til fil → parse
5) Emit events: logg action + result i RuntimeTruth
6) Prepare wrap command (men ikke push automatisk)

## Related
- Runtime Truth: ../runtime-truth.md
- NCS generator contract: ../../docs/runtime/new-chat-start-generator.md

---

## Command

Jarvis recommendations are generated with:

jarvis-next

Optional arguments:

jarvis-next --topic <topic>
jarvis-next --emit  (optional telemetry; writes exactly one `jarvis_recommendation` event to RuntimeTruth JSONL)
jarvis-next --approve <token>

Examples:

jarvis-next
jarvis-next --topic "NEW CHAT START"
jarvis-next --approve "APPROVE:<wrap_id>:<plan_sha256>"

---

## Output

Typical output:

plan_sha256: <sha256>
approval_token: APPROVE:<latest_wrap_id>:<plan_sha256>

The recommendation is derived from RuntimeTruth and the latest session wrap.

---

## Approval Token

Format:

APPROVE:<latest_wrap_id>:<plan_sha256>

Validation rules:

- wrap_id must match runtime.latest.json
- plan_sha256 must match the canonical plan hash
- token must start with "APPROVE:"

If valid:

APPROVED (VALID) — execution not implemented

If invalid:

APPROVED (INVALID)

Execution is intentionally disabled until explicitly implemented.

---

## Docs-First Gate

Jarvis will refuse to produce recommendations if the topic
does not exist in the Runbook Index.

Canonical index:

docs/hub/content/runbook/00__RUNBOOK_INDEX.md

This prevents hidden state and ensures all recommended work
is documented before implementation.

---

## Technical Specification

Technical details for the recommendation engine:

../docs/runtime/jarvis-next.md
