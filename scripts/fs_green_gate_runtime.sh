#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1"
  exit 1
}

echo "=== RUNTIME GREEN GATE (READ ONLY) ==="

# a) Port 7007 listening
if ss -ltnp | grep -E '[:.]7007\b' >/dev/null 2>&1; then
  echo "[OK] port 7007 listening"
else
  fail "port 7007 is not listening"
fi

# b) /healthcheck must be HTTP 200
health_code="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:7007/healthcheck || true)"
if [[ "$health_code" == "200" ]]; then
  echo "[OK] /healthcheck HTTP 200"
else
  fail "/healthcheck returned HTTP ${health_code}"
fi

# c) /new-chat-start?debug=1 meta.wrapFound==true and print wrapKey + wrapTs
new_chat_json="$(curl -sS http://127.0.0.1:7007/api/runtime/new-chat-start?debug=1)" || fail "cannot fetch /api/runtime/new-chat-start?debug=1"

if command -v python3 >/dev/null 2>&1; then
  parsed_line="$({
    printf '%s' "$new_chat_json" | python3 -c 'import json,sys
try:
    d=json.loads(sys.stdin.read())
except Exception as e:
    print(f"[FAIL] invalid JSON from /api/runtime/new-chat-start?debug=1: {e}")
    raise SystemExit(2)
m=d.get("meta") or {}
wf=bool(m.get("wrapFound"))
wk=str(m.get("wrapKey") or "")
wt=str(m.get("wrapTs") or "")
print(f"wrapFound={str(wf).lower()} wrapKey={wk} wrapTs={wt}")
raise SystemExit(0 if wf else 3)
'
  } 2>/dev/null)" || fail "meta.wrapFound is not true in /api/runtime/new-chat-start?debug=1"
  echo "[OK] $parsed_line"
else
  compact_json="$(printf '%s' "$new_chat_json" | tr -d '\n\r')"
  if printf '%s' "$compact_json" | grep -E '"wrapFound"[[:space:]]*:[[:space:]]*true' >/dev/null 2>&1; then
    wrap_key="$(printf '%s' "$compact_json" | grep -oE '"wrapKey"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/')"
    wrap_ts="$(printf '%s' "$compact_json" | grep -oE '"wrapTs"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/')"
    echo "[OK] wrapFound=true wrapKey=${wrap_key} wrapTs=${wrap_ts}"
  else
    fail "meta.wrapFound is not true in /api/runtime/new-chat-start?debug=1"
  fi
fi

# d) /hub/paths => ok:true
hub_paths_json="$(curl -sS http://127.0.0.1:7007/api/runtime/hub/paths)" || fail "cannot fetch /api/runtime/hub/paths"
if printf '%s' "$hub_paths_json" | tr -d '\n\r' | grep -E '"ok"[[:space:]]*:[[:space:]]*true' >/dev/null 2>&1; then
  echo "[OK] /api/runtime/hub/paths ok=true"
else
  fail "/api/runtime/hub/paths does not report ok=true"
fi

echo "RESULT: GREEN"
