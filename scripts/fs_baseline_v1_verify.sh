#!/usr/bin/env bash
set -euo pipefail

echo "=== BASELINE_V1_VERIFY (READ ONLY) ==="
echo "[INFO] timestamp=$(date -Is)"
echo "[INFO] hostname=$(hostname)"
echo "[INFO] uname=$(uname -a)"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

ok() {
  echo "[OK] $1"
}

info() {
  echo "[INFO] $1"
}

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

DISTRO_FILE="/etc/FS_DISTRO_ID"
EXPECTED_DISTRO="Ubuntu_NVMe"
RUNTIME_STORE_DIR="/home/danie/control_plane/runtime_truth_store"
RUNTIME_CANONICAL_FILE="$RUNTIME_STORE_DIR/runtime.jsonl"
RUNTIME_BACKUP_GLOB="$RUNTIME_STORE_DIR/runtime.jsonl.bak_*"
RUNTIME_TRUTH_LINK="/home/danie/control_plane/runtime_truth"

info "Checking WSL distro invariant"
[ -f "$DISTRO_FILE" ] || fail "$DISTRO_FILE is missing"
DISTRO_ID="$(tr -d '[:space:]' < "$DISTRO_FILE")"
[ "$DISTRO_ID" = "$EXPECTED_DISTRO" ] || fail "$DISTRO_FILE expected '$EXPECTED_DISTRO', got '$DISTRO_ID'"
ok "$DISTRO_FILE = $EXPECTED_DISTRO"

info "Checking runtime truth canonical file"
[ -e "$RUNTIME_CANONICAL_FILE" ] || fail "Missing canonical runtime truth file: $RUNTIME_CANONICAL_FILE"
[ -f "$RUNTIME_CANONICAL_FILE" ] || fail "Runtime truth path is not a regular file: $RUNTIME_CANONICAL_FILE"
ok "Canonical runtime truth file exists and is regular: $RUNTIME_CANONICAL_FILE"

info "Checking runtime truth backup files"
BACKUP_MATCHES="$(compgen -G "$RUNTIME_BACKUP_GLOB" || true)"
[ -n "$BACKUP_MATCHES" ] || fail "No backup file found matching: $RUNTIME_BACKUP_GLOB"
ok "Found runtime truth backup(s) matching: $RUNTIME_BACKUP_GLOB"
echo "$BACKUP_MATCHES" | while IFS= read -r backup; do
  [ -n "$backup" ] && info "backup=$backup"
done

info "Checking runtime_truth symlink wiring"
RT_DIR="/home/danie/control_plane/runtime_truth"
RT_STORE="/home/danie/control_plane/runtime_truth_store"
ls -la "$RT_DIR" || fail "Failed to list $RT_DIR"
ls -la "$RT_STORE" || fail "Failed to list $RT_STORE"

if [ -L "$RT_DIR" ]; then
  RESOLVED_LINK="$(readlink -f "$RT_DIR")"
  RESOLVED_STORE="$(readlink -f "$RT_STORE")"
  info "resolved runtime_truth=$RESOLVED_LINK"
  info "resolved runtime_truth_store=$RESOLVED_STORE"
  [ "$RESOLVED_LINK" = "$RESOLVED_STORE" ] || fail "runtime_truth symlink target is not runtime_truth_store"
  ok "runtime_truth is symlink -> runtime_truth_store"
elif [ -d "$RT_DIR" ]; then
  [ -e "$RT_DIR/runtime.jsonl" ] || fail "Missing $RT_DIR/runtime.jsonl"
  [ -L "$RT_DIR/runtime.jsonl" ] || fail "$RT_DIR/runtime.jsonl is not a symlink"
  [ "$(readlink -f "$RT_DIR/runtime.jsonl")" = "$(readlink -f "$RT_STORE/runtime.jsonl")" ] || fail "$RT_DIR/runtime.jsonl does not point to $RT_STORE/runtime.jsonl"

  [ -e "$RT_DIR/runtime.latest.json" ] || fail "Missing $RT_DIR/runtime.latest.json"
  [ -L "$RT_DIR/runtime.latest.json" ] || fail "$RT_DIR/runtime.latest.json is not a symlink"
  [ "$(readlink -f "$RT_DIR/runtime.latest.json")" = "$(readlink -f "$RT_STORE/runtime.latest.json")" ] || fail "$RT_DIR/runtime.latest.json does not point to $RT_STORE/runtime.latest.json"

  RESOLVED_LINK="$(readlink -f "$RT_DIR")"
  RESOLVED_STORE="$(readlink -f "$RT_STORE")"
  info "resolved runtime_truth=$RESOLVED_LINK"
  info "resolved runtime_truth_store=$RESOLVED_STORE"
  ok "runtime_truth directory contains symlinks -> runtime_truth_store"
else
  fail "runtime_truth missing or invalid type: $RT_DIR"
fi

info "Checking runtime truth paths do not use /mnt/c"
PATH_AUDIT="$(printf '%s\n%s\n%s\n%s\n%s\n' "$RUNTIME_CANONICAL_FILE" "$BACKUP_MATCHES" "$RUNTIME_TRUTH_LINK" "$RESOLVED_LINK" "$RESOLVED_STORE")"
if printf '%s\n' "$PATH_AUDIT" | grep -q '/mnt/c'; then
  fail "Runtime truth path audit contains /mnt/c"
fi
ok "Runtime truth path audit contains no /mnt/c"

info "Checking Backstage health endpoint"
BACKEND="http://127.0.0.1:7007"
HEALTH_URL="$BACKEND/api/catalog/entities?limit=1"
tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w "%{http_code}" "$HEALTH_URL" || true)"
echo "[HEALTH] $HEALTH_URL -> HTTP $code"
[ "$code" = "200" ] || { echo "[FAIL] Backend probe not 200"; sed -n '1,20p' "$tmp" || true; rm -f "$tmp" || true; exit 2; }
grep -qi '<title>Scaffolded Backstage App</title>' "$tmp" && { echo "[FAIL] Got SPA HTML on backend probe (wrong target / fallback)"; rm -f "$tmp" || true; exit 2; }
rm -f "$tmp" || true
ok "backend probe 200 (non-SPA)"

info "Checking hub-docs entity endpoint"
HUB_DOCS_URL="$BACKEND/api/catalog/entities/by-name/component/default/hub-docs"
HUB_DOCS_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$HUB_DOCS_URL" || true)"
[ "$HUB_DOCS_CODE" = "200" ] || fail "hub-docs endpoint expected 200, got $HUB_DOCS_CODE"
ok "hub-docs 200"

echo "[OK] BASELINE_V1 GREEN"
