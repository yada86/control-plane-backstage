# PowerShell Rules

## Purpose
Windows system truth and safe automation (fail-fast, strict).

## Core Laws
- `HUB.RULE.PWS.STRICT_MODE` — `$ErrorActionPreference='Stop'` and `Set-StrictMode -Version Latest`.
- `HUB.RULE.PWS.READ_ONLY_DEFAULT` — Default read-only; no write/delete unless explicitly requested.
- `HUB.RULE.PWS.VERIFY_PATHS` — Validate paths with `Test-Path`; fail fast.

## Do
- Prefer explicit arrays, stepwise commands.

## Don’t
- Don’t assume git, env vars, or CLI existence.

## When Relevant
- Any Windows automation, backups, publish jobs.

## Crosslinks
- Backup + Vault: `07__BACKUP_VAULT.md`