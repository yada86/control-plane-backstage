# Backstage Restore Runbook

## Goal
Bring Control Plane from unknown state to GREEN baseline.

## Canonical Restore Steps

1) Kill ports 7007 and 3000.
2) Start backend: `yarn workspace backend start`
3) Wait until `/healthcheck` returns 200.
4) Verify catalog ingest by polling `/api/catalog/entities/by-name/component/default/hub-docs`
   for up to 60s, until HTTP 200.

## Verify
- `/healthcheck` may become 200 before catalog ingest is finished.
- Consider restore GREEN only after hub-docs endpoint returns HTTP 200.

## Copy/Paste Restore Block (v2)

```bash
set -euo pipefail

echo "=== RUN BLOCK — BACKSTAGE RESTORE v2 (poll hub-docs) ==="
date -Is
echo

ROOT="/home/danie/control_plane/backstage"

need() { command -v "$1" >/dev/null 2>&1 || { echo "[FATAL] Missing: $1" >&2; exit 1; }; }
need ss
need awk
need sed
need sort
need kill
need sleep
need curl
need yarn
need tail
echo

echo "=== 1) Kill ports 7007 + 3000 ==="
pids="$(ss -ltnp 2>/dev/null | awk '$4 ~ /:(7007|3000)$/ {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' | sort -u)"
if [ -n "${pids:-}" ]; then
   echo "[INFO] Killing: $pids"
   for pid in $pids; do kill -9 "$pid" 2>/dev/null || true; done
   sleep 2
else
   echo "[INFO] No listeners found"
fi
echo

echo "=== 2) Start backend ==="
cd "$ROOT"
LOG="/tmp/backstage_restore.log"
rm -f "$LOG"
yarn workspace backend start >"$LOG" 2>&1 &
bp="$!"
echo "[OK] backend pid=$bp"
echo

echo "=== 3) Wait for /healthcheck ==="
ok="0"
for i in $(seq 1 60); do
   code="$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:7007/healthcheck || true)"
   if [ "$code" = "200" ]; then ok="1"; break; fi
   sleep 1
done
if [ "$ok" != "1" ]; then
   echo "[FAIL] healthcheck never became 200"
   tail -n 60 "$LOG" || true
   exit 1
fi
echo "[OK] healthcheck 200"
echo

echo "=== 4) Wait for hub-docs entity (catalog warmup) ==="
hub_ok="0"
last="000"
for i in $(seq 1 60); do
   last="$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:7007/api/catalog/entities/by-name/component/default/hub-docs || true)"
   if [ "$last" = "200" ]; then hub_ok="1"; break; fi
   sleep 1
done

if [ "$hub_ok" != "1" ]; then
   echo "[FAIL] hub-docs still not 200 after wait (last=$last)"
   echo "[INFO] last log tail:"
   tail -n 80 "$LOG" || true
   exit 1
fi

echo "[OK] hub-docs = 200"
echo
echo "=== RESTORE COMPLETE — SYSTEM GREEN ==="
```

## Notes
- Do NOT use `yarn start` (requires concurrently).
- Runtime truth is WSL-native (no /mnt/c dependency).
- If ports are in use → kill before restart.

---

## TechDocs (Local Publisher) – Critical Lessons Learned

This section documents behavior verified during local TechDocs publishing with `publisher: local`.

### 1) Correct Static Base Path (DO NOT GUESS)

Correct:
    /api/techdocs/static/docs/default/component/<entity>/

Incorrect:
    /api/techdocs/static/docs/techdocs/default/component/<entity>/

The extra `techdocs/` segment causes 404 even when files exist on disk.

Always verify using a path matrix before assuming storage failure.

---

### 2) Local Publisher Requires Explicit Sync

When using:

    techdocs:
      publisher:
        type: local

Backstage does NOT automatically build or publish MkDocs output.

Required deterministic sequence:

1. Build mkdocs site.
2. Sync docs/hub/site/ →
   packages/backend/static/docs/default/component/<entity>/
   (use rsync -a --delete).
3. Verify with static HTTP probe (must return 200).

If sync is skipped:
- Metadata may exist.
- Old pages may load.
- New pages will return 404.

This creates false-negative UI behavior.

---

### 3) Metadata Is Source of Truth for Navigation

If a page:
- Exists in mkdocs.yml nav
- Exists in mkdocs build
- Exists in techdocs_metadata.json
- Exists on disk

But does not appear in UI:

The issue is frontend cache, not storage.

Verification order:

1. Check metadata endpoint:
   /api/techdocs/metadata/techdocs/default/component/<entity>
2. Check static path:
   /api/techdocs/static/docs/default/component/<entity>/<path>/
3. Hard refresh (Ctrl+F5) or use incognito.
4. Restart frontend if required.

Never change publishDirectory without measurement.

---

### 4) Deterministic Local Publish Rule (Locked)

For local TechDocs publishing the canonical flow is:

1. mkdocs build
2. rsync with --delete
3. Static probe returning 200
4. Metadata probe confirming file presence

This rule prevents stale state, path confusion, and false 404 debugging.

END.
