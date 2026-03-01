#!/usr/bin/env bash
set -euo pipefail

PORTS=("${@:-7007 3000}")

need() { command -v "$1" >/dev/null 2>&1 || { echo "[FAIL] Missing required tool: $1" >&2; exit 2; }; }
need ss
need awk
need sed

is_listening() {
  local port="$1"
  # ss output example: LISTEN ... :7007 ... users:(("node",pid=123,...))
  ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p"$" {print $0}' | sed -n '1p'
}

echo "=== PORT PRECHECK (fail-fast, no-kill) ==="
date -Is
echo

bad=0
for p in "${PORTS[@]}"; do
  line="$(is_listening "$p" || true)"
  if [ -n "${line:-}" ]; then
    echo "[EADDRINUSE] Port $p is already in use:"
    echo "  $line"
    bad=1
  else
    echo "[OK] Port $p is free"
  fi
done

if [ "$bad" -ne 0 ]; then
  echo
  echo "[FAIL] One or more required ports are busy. Stop the process or change ports, then retry."
  exit 3
fi

echo
echo "[OK] All required ports are free."