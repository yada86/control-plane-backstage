#!/usr/bin/env bash
set -euo pipefail

PORTS=("${@:-7007 3000}")

need() { command -v "$1" >/dev/null 2>&1 || { echo "[FAIL] Missing required tool: $1" >&2; exit 2; }; }
need ss
need awk
need sed
need tr
need readlink

is_listening_line() {
  local port="$1"
  # ss output example: LISTEN ... :7007 ... users:(("node",pid=123,...))
  ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p"$" {print $0}' | sed -n '1p'
}

extract_pid_from_ss() {
  # Extract first pid=NNN from an ss line
  echo "$1" | sed -nE 's/.*pid=([0-9]+).*/\1/p' | head -n 1
}

show_pid_details() {
  local pid="$1"
  [ -n "${pid:-}" ] || return 0

  echo "  pid=$pid"

  if [ -r "/proc/$pid/cmdline" ]; then
    echo -n "  cmdline="
    tr '\0' ' ' < "/proc/$pid/cmdline"
    echo
  else
    echo "  cmdline=[unreadable]"
  fi

  if [ -L "/proc/$pid/cwd" ]; then
    echo -n "  cwd="
    readlink -f "/proc/$pid/cwd" 2>/dev/null || echo "[unreadable]"
  else
    echo "  cwd=[unavailable]"
  fi
}

echo "=== PORT PRECHECK (fail-fast, no-kill, verbose owner) ==="
date -Is
echo

bad=0
for p in "${PORTS[@]}"; do
  line="$(is_listening_line "$p" || true)"
  if [ -n "${line:-}" ]; then
    echo "[EADDRINUSE] Port $p is already in use:"
    echo "  ss=$line"
    pid="$(extract_pid_from_ss "$line" || true)"
    show_pid_details "${pid:-}"
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
