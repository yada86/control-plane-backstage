# Baseline V1 Verifier

## What this verifies
This read-only verifier checks locked CONTROL_PLANE_BASELINE_V1 invariants:
- `/etc/FS_DISTRO_ID` exists and equals `Ubuntu_NVMe`.
- Runtime truth is WSL-native:
  - `/home/danie/control_plane/runtime_truth_store/runtime.jsonl` exists and is a regular file.
  - at least one backup exists matching `runtime.jsonl.bak_*`.
  - `/home/danie/control_plane/runtime_truth` is WSL-native and contains symlinks (`runtime.jsonl`, `runtime.latest.json`) pointing to `runtime_truth_store` (or `runtime_truth` may itself be a symlink to `runtime_truth_store`).
  - printed runtime truth paths do not contain `/mnt/c`.
- Backstage endpoints:
  - `http://127.0.0.1:7007/healthcheck` returns `200`.
  - `http://127.0.0.1:7007/api/catalog/entities/by-name/component/default/hub-docs` returns `200`.

## How to run
```bash
bash scripts/fs_baseline_v1_verify.sh
```

## GREEN meaning
GREEN means script exit code `0` and all checks print `[OK]`.
Expected GREEN headline lines:
- `=== BASELINE_V1_VERIFY (READ ONLY) ===`
- `[OK] /etc/FS_DISTRO_ID = Ubuntu_NVMe`
- `[OK] runtime_truth is symlink -> runtime_truth_store` or `[OK] runtime_truth directory contains symlinks -> runtime_truth_store`
- `[OK] Runtime truth path audit contains no /mnt/c`
- `[OK] healthcheck 200`
- `[OK] hub-docs 200`
- `[OK] BASELINE_V1 GREEN`

## If a check fails
Do not patch immediately. Follow SAFE MODE: measure first, then patch with the smallest deterministic change.
