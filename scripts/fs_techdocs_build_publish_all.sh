#!/usr/bin/env bash
set -euo pipefail

log(){ printf "%s\n" "$*"; }
die(){ printf "[FATAL] %s\n" "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
ONE="$REPO_ROOT/scripts/fs_techdocs_build_publish.sh"
BACKEND="${FS_BACKEND:-http://127.0.0.1:7007}"
HEALTH_URL="$BACKEND/api/catalog/entities?limit=1"

free_7007() {
  if command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp 2>/dev/null | awk '$4 ~ /:7007$/ {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' | sort -u)"
    if [ -n "${pids:-}" ]; then
      echo "[INFO] Freeing :7007 (kill): $pids"
      for pid in $pids; do kill "$pid" 2>/dev/null || true; done
      sleep 1
    else
      echo "[INFO] :7007 already free"
    fi
  else
    echo "[WARN] ss not available; skipping auto-free of :7007"
  fi
}

DRY=0
LIMIT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --limit) LIMIT="${2:-0}"; shift 2 ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--dry-run] [--limit N]"
      exit 0
      ;;
    *) die "Unknown arg: $1" ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "curl missing"
command -v python3 >/dev/null 2>&1 || die "python3 missing"
[ -x "$ONE" ] || die "Missing executable: $ONE"

tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w "%{http_code}" "$HEALTH_URL" || true)"
echo "[HEALTH] $HEALTH_URL -> HTTP $code"
[ "$code" = "200" ] || { echo "[FAIL] Backend probe not 200"; sed -n '1,20p' "$tmp" || true; rm -f "$tmp" || true; exit 2; }
grep -qi '<title>Scaffolded Backstage App</title>' "$tmp" && { echo "[FAIL] Got SPA HTML on backend probe (wrong target / fallback)"; rm -f "$tmp" || true; exit 2; }
rm -f "$tmp" || true

TMP="$(mktemp)"
trap 'rm -f "$TMP" >/dev/null 2>&1 || true' EXIT

log "=== FS TECHDOCS ALL: CATALOG QUERY ==="
log "[TIME] $(date -Iseconds)"
log "[BACKEND] $BACKEND"
log "[ONE] $ONE"
log ""

HTTP="$(curl -sS -o "$TMP" -w "%{http_code}" "$BACKEND/api/catalog/entities" || true)"
[ "$HTTP" = "200" ] || die "Catalog query failed: HTTP $HTTP"


LIST="$(python3 - "$TMP" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
entities = []
for e in data:
    md = e.get("metadata") or {}
    ann = md.get("annotations") or {}
    if "backstage.io/techdocs-ref" not in ann:
        continue
    ns = md.get("namespace") or "default"
    kind = (e.get("kind") or "").lower()
    name = md.get("name") or ""
    if not name or not kind:
        continue
    entities.append((ns, kind, name))

entities.sort()
for ns, kind, name in entities:
    print(f"{ns}\t{kind}\t{name}")
PY
)"

COUNT="$(printf "%s\n" "$LIST" | grep -c . || true)"
log "[FOUND] $COUNT techdocs-enabled entities"

[ "$COUNT" -eq 0 ] && exit 0

if [ "$DRY" -eq 1 ]; then
  echo
  echo "$LIST"
  exit 0
fi

i=0
fail=0

printf "%s\n" "$LIST" | while IFS=$'\t' read -r ns kind name; do
  i=$((i+1))
  if [ "$LIMIT" -gt 0 ] && [ "$i" -gt "$LIMIT" ]; then
    break
  fi

  echo
  echo "----- [$i/$COUNT] $ns/$kind/$name -----"
  if "$ONE" --entity "$ns" "$kind" "$name"; then
    echo "[OK] $ns/$kind/$name"
  else
    echo "[FAIL] $ns/$kind/$name"
    fail=$((fail+1))
  fi
done

exit 0
