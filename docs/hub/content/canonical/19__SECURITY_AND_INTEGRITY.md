# Security + Integrity

## Purpose
Maintain integrity guarantees (hashes, auditability) without adding friction.

## Core Laws
- `HUB.LAW.INTEGRITY.HASHED_ARTIFACTS` — Published artifacts may be hashed/verified (sha256) as integrity signal.
- `HUB.LAW.SECURITY.MIN_PRIVILEGE` — Use least privilege; elevate only when required.

## Do
- Fail fast on integrity mismatches when verifying artifacts.

## Don’t
- Don’t over-verify in hot paths unless a failure occurs (avoid double-work).

## When Relevant
- Publishing, restore, audit, and incident response.