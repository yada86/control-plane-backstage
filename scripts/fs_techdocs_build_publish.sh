#!/usr/bin/env bash
set -euo pipefail

log(){ printf "%s\n" "$*"; }
die(){ printf "[FATAL] %s\n" "$*" >&2; exit 1; }

# Tripwire: refuse to run if file includes terminal output pasted into it
_tripwire() {
  local self="$1"
  # SAFE tripwire: only scan the tail of the file (where pasted terminal output usually ends up)
  # and only for unmistakable prompt markers.
  local tail
  tail="$(tail -n 120 "$self" 2>/dev/null || true)"
  if printf "%s\n" "$tail" | grep -nE '(^danie@|^=== HEAD ===|^=== TAIL ===|^=== SELFTEST:|^PS [A-Z]:\\\\|^Command '\''jq'\'' not found|^The terminal process )' >/dev/null 2>&1; then
    echo "[FATAL] Script file looks contaminated with terminal output (tail scan). Refusing to run."
    echo "Hit lines (tail):"
    printf "%s\n" "$tail" | grep -nE '(^danie@|^=== HEAD ===|^=== TAIL ===|^=== SELFTEST:|^PS [A-Z]:\\\\|^Command '\''jq'\'' not found|^The terminal process )' | head -n 20
    exit 2
  fi
}
_tripwire "${BASH_SOURCE[0]}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="${FS_REPO_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd -P)}"

PUBLISH_DIR_DEFAULT="$REPO_ROOT/packages/backend/static/docs"
PUBLISH_DIR="${FS_PUBLISH_DIR:-$PUBLISH_DIR_DEFAULT}"
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

if [ -n "${FS_UI_BASE:-}" ]; then
  UI_BASE="$FS_UI_BASE"
else
  UI_BASE=""
  if command -v hostname >/dev/null 2>&1; then
    WSL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    [ -n "$WSL_IP" ] && UI_BASE="http://$WSL_IP:3000"
  fi
  [ -n "$UI_BASE" ] || UI_BASE="http://172.21.211.225:3000"
fi

NS=""; KIND=""; NAME=""; SOURCE_DIR=""

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") --entity <namespace> <kind> <name>
  $(basename "$0") --source <component_dir>

Examples:
  $(basename "$0") --entity default component techdocs-smoke
  $(basename "$0") --source "$REPO_ROOT/packages/backend/components/techdocs-smoke"

Env overrides:
  FS_PUBLISH_DIR="$PUBLISH_DIR_DEFAULT"
  FS_BACKEND="http://localhost:7007"
  FS_UI_BASE="http://<ip>:3000"
USAGE
}

[ $# -ge 1 ] || { usage; exit 2; }

case "${1:-}" in
  --entity)
    [ $# -eq 4 ] || die "--entity needs: <namespace> <kind> <name>"
    NS="$2"; KIND="$3"; NAME="$4"
    shift 4
    ;;
  --source)
    [ $# -eq 2 ] || die "--source needs: <component_dir>"
    SOURCE_DIR="$2"
    shift 2
    ;;
  -h|--help)
    usage; exit 0
    ;;
  *)
    die "Unknown args. Use --help."
    ;;
esac
[ $# -eq 0 ] || die "Unexpected extra args."

extract_entity_from_catalog() {
  local catalog="$1"
  local kind ns name
  kind="$(grep -E '^[[:space:]]*kind:[[:space:]]*' "$catalog" | head -n1 | sed -E 's/^[[:space:]]*kind:[[:space:]]*//')"
  name="$(grep -E '^[[:space:]]*name:[[:space:]]*' "$catalog" | head -n1 | sed -E 's/^[[:space:]]*name:[[:space:]]*//')"
  ns="$(grep -E '^[[:space:]]*namespace:[[:space:]]*' "$catalog" | head -n1 | sed -E 's/^[[:space:]]*namespace:[[:space:]]*//' || true)"
  [ -n "$kind" ] || die "Could not read kind from: $catalog"
  [ -n "$name" ] || die "Could not read name from: $catalog"
  [ -n "$ns" ] || ns="default"
  printf "%s\n" "$ns" "$kind" "$name"
}

find_source_by_entity() {
  local ns="$1" kind="$2" name="$3"
  local kind_lc
  kind_lc="$(printf "%s" "$kind" | tr '[:upper:]' '[:lower:]')"

  local query_url managed target_dir
  query_url="$BACKEND/api/catalog/entities?filter=kind=component&filter=metadata.namespace=$ns&filter=metadata.name=$name"
  managed="$(curl -sS "$query_url" 2>/dev/null | python3 -c 'import json,sys,re
try:
    data=json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)
ns=sys.argv[1]
kind=sys.argv[2].lower()
name=sys.argv[3]
selected=None
if isinstance(data, list):
    for entity in data:
        md=entity.get("metadata") or {}
        e_ns=(md.get("namespace") or "default")
        e_kind=(entity.get("kind") or "").lower()
        e_name=(md.get("name") or "")
        if e_ns==ns and e_kind==kind and e_name==name:
            selected=entity
            break
if selected is None:
    print("")
    raise SystemExit(0)
ann=((selected.get("metadata") or {}).get("annotations") or {})
v=ann.get("backstage.io/managed-by-location") or ann.get("backstage.io/managed-by-origin-location") or ""
m=re.match(r"^file:(.*)/catalog-info\.yaml$", v)
print(m.group(1) if m else "")' "$ns" "$kind" "$name" 2>/dev/null || true)"
  if [ -n "$managed" ]; then
    if [ -f "$managed/catalog-info.yaml" ]; then
      echo "[RESOLVE] catalog managed-by-location -> $managed" >&2
      echo "$managed"
      return 0
    fi
  fi

  echo "[RESOLVE] fallback find/grep" >&2
  local match
  match="$(
    find "$REPO_ROOT" -type f -name "catalog-info.yaml" 2>/dev/null \
    | while IFS= read -r f; do
        k="$(grep -E '^[[:space:]]*kind:[[:space:]]*' "$f" | head -n1 | sed -E 's/^[[:space:]]*kind:[[:space:]]*//')"
    k_lc="$(printf "%s" "$k" | tr '[:upper:]' '[:lower:]')"
        n="$(grep -E '^[[:space:]]*name:[[:space:]]*' "$f" | head -n1 | sed -E 's/^[[:space:]]*name:[[:space:]]*//')"
        s="$(grep -E '^[[:space:]]*namespace:[[:space:]]*' "$f" | head -n1 | sed -E 's/^[[:space:]]*namespace:[[:space:]]*//' || true)"
        [ -n "$s" ] || s="default"
        if [ "$k" = "$kind" ] && [ "$n" = "$name" ] && [ "$s" = "$ns" ]; then
          echo "$f"; break
        fi
      done
  )"
  [ -n "$match" ] || die "No catalog-info.yaml found for entity: $ns/$kind/$name"
  dirname "$match"
}

if [ -n "$SOURCE_DIR" ]; then
  [ -d "$SOURCE_DIR" ] || die "Source dir not found: $SOURCE_DIR"
  [ -f "$SOURCE_DIR/catalog-info.yaml" ] || die "No catalog-info.yaml in source dir; use --entity instead."
  mapfile -t e < <(extract_entity_from_catalog "$SOURCE_DIR/catalog-info.yaml")
  NS="${e[0]}"; KIND="${e[1]}"; NAME="${e[2]}"
else
  SOURCE_DIR="$(find_source_by_entity "$NS" "$KIND" "$NAME")"
fi

command -v yarn >/dev/null 2>&1 || die "yarn not found"
command -v curl >/dev/null 2>&1 || die "curl not found"

tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w "%{http_code}" "$HEALTH_URL" || true)"
echo "[HEALTH] $HEALTH_URL -> HTTP $code"
[ "$code" = "200" ] || { echo "[FAIL] Backend probe not 200"; sed -n '1,20p' "$tmp" || true; rm -f "$tmp" || true; exit 2; }
grep -qi '<title>Scaffolded Backstage App</title>' "$tmp" && { echo "[FAIL] Got SPA HTML on backend probe (wrong target / fallback)"; rm -f "$tmp" || true; exit 2; }
rm -f "$tmp" || true

log "=== FS TECHDOCS BUILD+PUBLISH (REPRO) ==="
log "[TIME] $(date -Iseconds)"
log "[ENTITY] $NS/$KIND/$NAME"
log "[SOURCE_DIR] $SOURCE_DIR"
log "[PUBLISH_DIR] $PUBLISH_DIR"
log "[BACKEND] $BACKEND"
log "[UI_BASE] $UI_BASE"
log ""

TMP_OUT="$(mktemp -d -t fs_techdocs_site_XXXXXX)"
cleanup(){ rm -rf "$TMP_OUT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

log "=== GENERATE (no-docker) ==="
log "[OUT_TMP] $TMP_OUT"
( cd "$REPO_ROOT" && yarn exec techdocs-cli generate --no-docker --source-dir "$SOURCE_DIR" --output-dir "$TMP_OUT" )
[ -f "$TMP_OUT/index.html" ] || die "Generate output missing index.html"

TARGET_DIR="$PUBLISH_DIR/$NS/$KIND/$NAME"
STAGE_DIR="$(mktemp -d -t fs_techdocs_publish_stage_XXXXXX)"
trap 'rm -rf "$STAGE_DIR" >/dev/null 2>&1 || true; cleanup' EXIT

log ""
log "=== PUBLISH (local) ==="
log "[TARGET_DIR] $TARGET_DIR"
mkdir -p "$(dirname "$TARGET_DIR")"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$TMP_OUT"/ "$STAGE_DIR"/
else
  rm -rf "$STAGE_DIR"/*
  cp -a "$TMP_OUT"/. "$STAGE_DIR"/
fi

rm -rf "$TARGET_DIR"
mkdir -p "$(dirname "$TARGET_DIR")"
mv "$STAGE_DIR" "$TARGET_DIR"

log ""
log "=== VERIFY ==="
[ -f "$TARGET_DIR/index.html" ] || die "Published index.html missing"

META_URL="$BACKEND/api/techdocs/metadata/entity/$NS/$KIND/$NAME"
HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "$META_URL" || true)"
[ "$HTTP_CODE" = "200" ] || die "Metadata check failed: HTTP $HTTP_CODE for $META_URL"
log "[OK] metadata 200 -> $META_URL"

DOCS_URL="$UI_BASE/docs/$NS/$KIND/$NAME"
log "[OK] Open: $DOCS_URL"
