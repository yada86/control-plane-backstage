# Restore Engine

## Purpose
Enable transactional, verifiable restore from runtime truth / vault packs to filesystem.

## Core Laws
- `HUB.LAW.RESTORE.TRANSACTIONAL` — Restores must be transactional and safe.
- `HUB.LAW.RESTORE.NO_DESTRUCTIVE_DEFAULT` — Default behavior is non-destructive; explicit approval required for deletes.

## Do
- Dry-run first, apply only with explicit intent.
- Log all writes and decisions.

## Don’t
- Don’t overwrite or delete without explicit operator intent.

## When Relevant
- Restore pack apply, recovery, and rollback operations.

## Crosslinks
- Backup + Vault: `07__BACKUP_VAULT.md`
- PowerShell Rules: `12__POWERSHELL_RULES.md`