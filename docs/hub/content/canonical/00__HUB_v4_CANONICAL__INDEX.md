# HUB v4 Canonical (Backstage) — Index

## Authority (LOCKED)
- Canonical HUB docs live under `docs/hub/` in this Backstage repo.
- Windows HUB files are published artifacts only (compat/sha256/vault/restore), not the writing surface.
- New Chat Start generator must reference these canon docs (manifest-driven).

## Rule IDs (anti-duplication)
Use stable IDs for any rule that might be referenced across systems:

Format:
- `HUB.LAW.<DOMAIN>.<NAME>`
- `HUB.RULE.<DOMAIN>.<NAME>`
- `BACKSTAGE.GEN.<DOMAIN>.<NAME>` (only when the rule is truly generator-specific)

Conventions:
- One rule == one ID == one authoritative definition.
- If a rule is amended: keep the same ID, add an **Amended** note with date + rationale.

## Canonical Table of Contents (19 sections)
1. SAFE MODE — `01__SAFE_MODE.md`
2. Tool Selection Governance — `02__TOOL_GOVERNANCE.md`
3. Architecture Laws (CORE sacred) — `03__ARCHITECTURE_LAWS.md`
4. Copy Safety Laws — `04__COPY_SAFETY.md`
5. Runtime Truth — `05__RUNTIME_TRUTH.md`
6. Checkpoint System — `06__CHECKPOINT_SYSTEM.md`
7. Backup + Vault — `07__BACKUP_VAULT.md`
8. Restore Engine — `08__RESTORE_ENGINE.md`
9. New Chat Start Protocol — `09__NEW_CHAT_START_PROTOCOL.md`
10. VSCAI Rules — `10__VSCAI_RULES.md`
11. EXEC Rules — `11__EXEC_RULES.md`
12. PowerShell Rules — `12__POWERSHELL_RULES.md`
13. WSL Boundaries — `13__WSL_BOUNDARIES.md`
14. Backstage Scope Guard — `14__BACKSTAGE_SCOPE_GUARD.md`
15. GN Engine Laws — `15__GN_ENGINE_LAWS.md`
16. Local AI Stack — `16__LOCAL_AI_STACK.md`
17. Observability Core — `17__OBSERVABILITY_CORE.md`
18. Path Governance — `18__PATH_GOVERNANCE.md`
19. Security + Integrity — `19__SECURITY_AND_INTEGRITY.md`

## Manifest-driven relevance
- Manifest: `docs/hub/hub_manifest.json`
- New Chat Start generator should:
  - Always include: Canonical Index + SAFE MODE + Tool Governance + Copy Safety + New Chat Start Protocol + Path Governance
  - Add relevant docs by tags (subsystem/task context)
  - Prefer pointers (paths/links), not full 1000-line dumps.

## Editing pattern (keep diffs clean)
Each section file should follow this template:
- Purpose
- Core Laws (with rule_id)
- Do / Don’t
- When Relevant
- Crosslinks