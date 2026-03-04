---
title: New Chat Start Generator (SSOT Contract)
description: Canonical specification for how the NEW CHAT START block is generated, sourced, verified, and governed.
---

# New Chat Start Generator (SSOT Contract)

Tier: 0 (Front Door)  
Scope: CONTROL_PLANE / RuntimeTruth UI + Backend endpoint  
Purpose: Prevent stale wrap drift and false-green status by enforcing deterministic sourcing and explicit verification.

---

## 1) Purpose

The NEW CHAT START block is the single front door into a new chat session context. It is designed to be:

- SSOT-driven: It reflects the latest HUB_SESSION_WRAP__... event.
- Gate-derived: STATUS is derived from the latest runtime gate event when backend is available.
- Non-lying under outage: If backend is DOWN, frontend fallback must not pretend the system is GREEN.

This document defines the contract (what must be true), not implementation trivia.

## 1.1) Operational Header Laws (Injected into NCS)

The NEW CHAT START text block includes immutable operational laws that are injected by the backend generator and must remain visible to operators:

- `EXECUTION LAW (NON-NEGOTIABLE)`
  - ÉN BLOKK OM GANGEN: only ONE runnable block per assistant message.
  - Wait for execution output before issuing the next block (no batching).
- `BLOCK MARKING LAW (NON-NEGOTIABLE)`
  - Every runnable block must be preceded outside code fences with:
    `LIM RETT INN I → VSCAI_WSL / WSL TERMINAL (EXEC) / POWERSHELL / VSCAI_WIN`
  - Unmarked runnable blocks are invalid output.
- `DOC LAW (NON-NEGOTIABLE)`
  - New technical behavior (scripts/paths/commands/policies/defaults) must be documented in TechDocs and indexed in Runbook before continuing.
  - Canonical Runbook Index: ../runbook/00__RUNBOOK_INDEX.md
- `MEASUREMENT LAW`
  - Measure first; default to READ ONLY before PATCH.
- `SCOPE / ARCHITECTURE LAW`
  - No endpoint/service/schema expansion without explicit order; minimal diffs only.

## BASH/PASTE SAFETY (NON-NEGOTIABLE)
- SHORT BLOCK LAW: no pasted EXEC block > ~60 lines. If longer: write to file then run the file.
- NO HEREDOC IN CHAT: avoid <<EOF in pasted blocks (paste corruption risk).
- NO PIPES INTO PARSERS: always curl > "$TMP" then parse the file (no | python, no | jq).
- ALWAYS mktemp + FILE PARSE: TMP="$(mktemp ...)" then read TMP in python/jq.
- QUOTE LAW: every $VAR in bash commands must be in double quotes.
- ANTI-UNBOUND: define variables immediately before use; never rely on previous blocks.
- IF PASTE FAILS: stop and switch to file-based execution; do not brute-force “block 5”.

These law headings are part of the runtime contract for `/api/runtime/new-chat-start` output, not optional prose.

## 1.2) SSOT TASK CONTEXT (FROM LATEST WRAP)

The generated NEW CHAT START includes a dedicated section:

- `SSOT TASK CONTEXT (FROM LATEST WRAP)`
  - `MAIN TASK (GOAL)` derivation: `facts.active_goals[0] || "—"`
  - `NEXT ACTION (LAST WRAP)` derivation: `facts.next_actions[0] || "—"`
  - `KNOWN ISSUE (LAST WRAP)` derivation: `facts.known_issues[0] || "—"`
  - `LATEST WRAP (SSOT)` line: `meta.wrapKey | meta.wrapTs`

Operational rule:

- To change MAIN TASK (GOAL), push a new `HUB_SESSION_WRAP__...` with `--goal` (this populates `active_goals[0]`).
- To change NEXT ACTION / KNOWN ISSUE, push a new wrap with `--next-action` / `--known-issue`.

---

## 2) Source of Truth Chain (SSOT)

### 2.1 Runtime Truth storage
- Canonical store: runtime.jsonl (strict JSONL: one dict/object per line; no arrays)
- Derived: runtime.latest.json (rebuilt from last JSONL line)

### 2.2 Wrap selection (SSOT)
- Latest session wrap is the latest event whose ID starts with:
  HUB_SESSION_WRAP__

The NEW CHAT START must reference that wrap as:
- LATEST WRAP (SSOT)
- wrapKey (when debug/meta is available)

### 2.3 Generator pipeline (conceptual)

runtime.jsonl (dict-only)
↓
latest HUB_SESSION_WRAP__ event
↓
/api/runtime/new-chat-start
↓
Frontend: COPY NEW CHAT START

### 2.4 NEW CHAT START v2 content sourcing
- PROJECT MISSION
  - Source: latest HUB_SESSION_WRAP.goal
  - Fallback: latest HUB_SESSION_WRAP.summary
  - Final fallback: —
  - Render rule: 1–2 lines max (trimmed, whitespace-collapsed)

- ACTIVE TRACK
  - Source: latest HUB_SESSION_WRAP.nextAction
  - Fallback: latest HUB_SESSION_WRAP.goal
  - Final fallback: —
  - Render rule: split on `;` or newline, render up to 3 bullets

---

## 3) STATUS Derivation (Gate)

### 3.1 Gate input
STATUS is derived from the latest runtime gate event (when backend is reachable).

The generator must expose (directly or via debug meta):
- whether a gate event was found,
- whether it is OK,
- and which gate key/timestamp it came from.

For `debug=1`, meta is non-breaking and additionally includes:
- missionFound / missionSource / missionText
- trackFound / trackSource / trackTokens
- checkpointsMax=7 / checkpointsFiltered / checkpointsReturned

### 3.2 Fallback rule (backend DOWN)
If backend is DOWN or unreachable:
- Frontend fallback MUST force STATUS: YELLOW (gate unknown).
- It MUST NOT claim GREEN based on cached or old data.

---

## 4) Hard Invariants (Non-negotiable)

### 4.1 Wrap invariants
- Wrap ID MUST start with: HUB_SESSION_WRAP__
- “Stale NEW CHAT START” means: No newer HUB_SESSION_WRAP__... exists.
- After pushing a wrap, wrapKey must equal the wrap ID just pushed.

### 4.2 Runtime Truth invariants
- runtime.jsonl is strict JSONL:
  - one object per line
  - dict/object only
- runtime.latest.json is derived deterministically from last JSONL line.

### 4.3 Status invariants
- Backend UP + gate OK => STATUS: GREEN
- Backend DOWN => STATUS: YELLOW
- No silent fallback to GREEN when gate is missing or backend unreachable.

### 4.4 Checkpoint selection invariants
- LATEST RELEVANT CHECKPOINTS (MAX 7) has hard cap: 7 items.
- Filtering is token-based against checkpoint id/title/summary.
- Selection is deterministic.
- If token filtering yields too few matches, fallback appends newest checkpoints.

---

## 5) Operating Procedure (End of Session)

Tool choice: WSL terminal (NOT PowerShell)

### 5.1 Push SSOT wrap

/home/danie/control_plane/runtime_truth_store/fs_push_session_wrap.sh \
  --id "HUB_SESSION_WRAP__<SHORT_NAME>__YYYY-MM-DD" \
  --summary "<1–2 lines>" \
  --known-issue "<blockers or —>" \
  --next-action "<exact next step>" \
  --goal "<goal of next chat>" \
  --show

### 5.2 Verify generator points at your wrap (READ ONLY, robust JSON parse)

- IKKE bruk `printf ... | python3 - <<'PY'` (heredoc stjeler stdin → JSONDecodeError).
- Bruk alltid “fetch til fil → parse fil”:

```bash
BASE="http://127.0.0.1:7007"
TMP="$(mktemp /tmp/ncs_XXXXXX.json)"
curl -sS --max-time 6 "$BASE/api/runtime/new-chat-start?debug=1" > "$TMP"
python3 - <<PY
import json
p = "$TMP"
with open(p, "r", encoding="utf-8") as f:
  d = json.load(f)
m = d.get("meta") or {}
print("[OK] meta.wrapKey   =", m.get("wrapKey"))
print("[OK] meta.wrapFound =", m.get("wrapFound"))
print("[OK] meta.wrapTs    =", m.get("wrapTs"))
PY
```

Expected: meta.wrapFound=True and meta.wrapKey equals the wrap ID you just pushed.

If not, treat as failure and investigate before ending session.

### 🔒 VERIFICATION RECIPE — DETERMINISTIC WRAP SELECTION (PROVEN 2026-03-03)

This section is normative. It documents the canonical proof that
`/api/runtime/new-chat-start` selects the newest `HUB_SESSION_WRAP__*`
deterministically and without cache leakage.

This recipe MUST be followed when validating changes to the generator.

---

#### STEP 1 — NEGATIVE TEST (FORCED NEWER WRAP)

Push a deliberately newer wrap:

/home/danie/control_plane/runtime_truth_store/fs_push_session_wrap.sh \
  --id "HUB_SESSION_WRAP__NCS_NEGATIVE_TEST__YYYY-MM-DD" \
  --summary "NEGATIVE TEST: force newer wrap selection" \
  --known-issue "—" \
  --next-action "Verify meta.wrapKey equals this ID" \
  --goal "Prove newest-wrap selection is deterministic" \
  --show

Then verify:

BASE="http://127.0.0.1:7007"
TMP="$(mktemp /tmp/ncs_XXXXXX.json)"
curl -sS --max-time 6 "$BASE/api/runtime/new-chat-start?debug=1" > "$TMP"

python3 - <<PY
import json
with open("$TMP","r",encoding="utf-8") as f:
    d=json.load(f)
m=d.get("meta") or {}
print(m.get("wrapKey"), m.get("wrapFound"), m.get("wrapTs"))
PY

EXPECTED:
meta.wrapKey == pushed wrap ID
meta.wrapFound == True

If not, selection is NOT deterministic.

---

#### STEP 2 — COLD-START VERIFICATION (CACHE IMMUNITY)

1. Restart backend.
2. Hard refresh browser (Ctrl+F5).
3. Repeat fetch→file→parse verification above.

EXPECTED:
meta.wrapKey remains the newest wrap.
HTTP status = 200.
Backend listening on :7007.

---

#### LOCKED CONCLUSION (2026-03-03)

The generator:
- Uses newest `HUB_SESSION_WRAP__*`
- Uses no time heuristics
- Is immune to warm cache
- Is immune to cold restart

This procedure is the canonical regression test for NCS wrap selection.
Do not modify without explicit architectural approval.

---

## 6) Failure Modes

Symptom: NEW CHAT START looks stale  
Cause: No newer wrap pushed  
Fix: Push new HUB_SESSION_WRAP__ event

Symptom: STATUS unreliable  
Cause: Gate event missing or backend unreachable  
Fix: Bring backend up, re-run gate workflow

Symptom: Backend DOWN but UI shows GREEN  
Cause: Broken fallback  
Fix: Enforce fallback rule: backend down => YELLOW

Symptom: wrapKey mismatch  
Cause: Write failure or selection bug  
Fix: Inspect runtime.jsonl tail

---

## 7) Change Governance

Any change to:
- Wrap selection logic
- STATUS derivation logic
- Fallback behavior
- /api/runtime/new-chat-start semantics

MUST update this document in the same session.

---

## 8) Versioning

Last reviewed: 2026-03-01  
Owner: CONTROL_PLANE / RuntimeTruth  
Tier: 0
