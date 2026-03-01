# VSCAI Rules

## Purpose
Safe repo editing with clear intent, minimal diffs, and deterministic outputs.

## Core Laws
- `HUB.RULE.VSCAI.CONTEXT_TAG_REQUIRED` — VSCAI_WIN vs VSCAI_WSL must be explicit.
- `HUB.RULE.VSCAI.NO_REFORMAT` — No reformat; only requested insert/replace; keep diffs localized.

## Do
- List files before change.
- Keep changes additive and scoped.

## Don’t
- Don’t refactor unrelated files.

## When Relevant
- Any repo edit.

## Crosslinks
- Copy Safety: `04__COPY_SAFETY.md`
- Tool Governance: `02__TOOL_GOVERNANCE.md`