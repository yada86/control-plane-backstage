# Tool Selection Governance

## Purpose
Always pick the smartest tool for the job; avoid risky automation when a direct edit is safer.

## Core Laws
- `HUB.GOV.TOOL_PICK.REQUIRED` — Every task must declare tool: VSCAI / EXEC / POWERSHELL / LOCAL AI.
- `HUB.GOV.TOOL_PICK.HIERARCHY` — Prefer VSCAI for repo edits; EXEC/POWERSHELL for runtime truth; patch scripts last.
- `HUB.GOV.TOOL_PICK.NO_ASSUMPTIONS` — Verify before acting.

### Non-negotiable exception (integrity-critical)
- **Runtime Truth writes (checkpoint push) are WSL terminal only**. VSCAI is forbidden for executing the push, because integrity > convenience.

## Do
- Use VSCAI for file edits in the repo.
- Use EXEC for Blender/runtime measurement.
- Use POWERSHELL for Windows system truth.

## Don’t
- Don’t patch by scripting what can be safely edited directly.
- Don’t “re-trace” verified architecture.

## When Relevant
- Always.

## Crosslinks
- VSCAI Rules: `10__VSCAI_RULES.md`
- EXEC Rules: `11__EXEC_RULES.md`
- PowerShell Rules: `12__POWERSHELL_RULES.md`