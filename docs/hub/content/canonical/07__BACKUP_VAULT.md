# Backup + Vault

## Purpose
Preserve immutable history and provide reliable restore points.

## Core Laws
- `HUB.LAW.VAULT.IMMUTABLE` — Vault is immutable archive/history.
- `HUB.LAW.BACKUP.THIN_ORCH` — UI orchestration only; scripts remain source of truth.

## Do
- Mirror published layer into Vault.
- Verify exit codes and outputs.

## Don’t
- Don’t treat Vault as live working directory.

## When Relevant
- Backup router, mirror jobs, retention, restore testing.

## Crosslinks
- Restore Engine: `08__RESTORE_ENGINE.md`