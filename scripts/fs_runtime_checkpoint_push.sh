#!/usr/bin/env bash
set -euo pipefail

# Canonical CHECKPOINT writer for Runtime Truth (JSONL)
# Writes:
#   - runtime.jsonl (append one JSON line)
#   - runtime.latest.json (overwrite with the latest event)
#
# SAFE features:
#   - Creates a timestamped backup of runtime.jsonl before append
#   - --dry-run prints JSON payload only (no writes)
#
# Usage examples:
#   ./scripts/fs_runtime_checkpoint_push.sh --id HUB_SESSION_WRAP --status GREEN --summary "Session wrap" \
#     --active-goal "Ship session wrap button" --next-action "Start new chat with COPY NEW CHAT START"
#
#   ./scripts/fs_runtime_checkpoint_push.sh --id HUB_SESSION_WRAP --summary "Wrap" --facts-json '{"schema":"SESSION_SUMMARY","notes":["..."]}'
#
# Notes:
# - Uses Europe/Oslo timestamp via Python zoneinfo for correctness.
# - Does NOT require jq.

die() { echo "[FAIL] $*" >&2; exit 1; }
info() { echo "[INFO] $*" >&2; }
ok() { echo "[OK] $*" >&2; }

RUNTIME_STORE_DIR_DEFAULT="/home/danie/control_plane/runtime_truth_store"
RUNTIME_STORE_DIR="${RUNTIME_STORE_DIR:-$RUNTIME_STORE_DIR_DEFAULT}"
RUNTIME_JSONL="${RUNTIME_JSONL:-$RUNTIME_STORE_DIR/runtime.jsonl}"
RUNTIME_LATEST="${RUNTIME_LATEST:-$RUNTIME_STORE_DIR/runtime.latest.json}"
TZ_NAME="${TZ_NAME:-Europe/Oslo}"

DRY_RUN=0
ID=""
STATUS="GREEN"
SUMMARY=""
PROJECT=""
HOST_OVERRIDE=""
FACTS_JSON_RAW=""
ACTIVE_GOALS=()
KNOWN_ISSUES=()
NEXT_ACTIONS=()
SCOPE_GUARD_DEFAULT=("UI-only (no backend changes)" "No new endpoints" "No runtime.jsonl rewrite")
SCOPE_GUARD=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --store-dir) RUNTIME_STORE_DIR="$2"; RUNTIME_JSONL="$2/runtime.jsonl"; RUNTIME_LATEST="$2/runtime.latest.json"; shift 2 ;;
    --jsonl) RUNTIME_JSONL="$2"; shift 2 ;;
    --latest) RUNTIME_LATEST="$2"; shift 2 ;;
    --tz) TZ_NAME="$2"; shift 2 ;;
    --id) ID="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --summary) SUMMARY="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --host) HOST_OVERRIDE="$2"; shift 2 ;;
    --facts-json) FACTS_JSON_RAW="$2"; shift 2 ;;
    --active-goal) ACTIVE_GOALS+=("$2"); shift 2 ;;
    --known-issue) KNOWN_ISSUES+=("$2"); shift 2 ;;
    --next-action) NEXT_ACTIONS+=("$2"); shift 2 ;;
    --scope-guard) SCOPE_GUARD+=("$2"); shift 2 ;;
    -h|--help)
      sed -n '1,120p' "$0"
      exit 0
      ;;
    *) die "Unknown arg: $1" ;;
  esac
done

[[ -n "$ID" ]] || die "Missing --id"
[[ -n "$SUMMARY" ]] || die "Missing --summary"

# Validate target paths exist (or can be created)
[[ -d "$(dirname "$RUNTIME_JSONL")" ]] || die "Missing dir for runtime.jsonl: $(dirname "$RUNTIME_JSONL")"
[[ -d "$(dirname "$RUNTIME_LATEST")" ]] || die "Missing dir for runtime.latest.json: $(dirname "$RUNTIME_LATEST")"
[[ -f "$RUNTIME_JSONL" ]] || die "Missing runtime.jsonl: $RUNTIME_JSONL"

# Build JSON payload using Python (ensures correct tz + stable JSON)
PAYLOAD_JSON="$(
python3 - "$TZ_NAME" "$ID" "$STATUS" "$SUMMARY" "$PROJECT" "$HOST_OVERRIDE" "$FACTS_JSON_RAW" \
  "$(printf '%s\n' "${ACTIVE_GOALS[@]-}")" \
  "$(printf '%s\n' "${KNOWN_ISSUES[@]-}")" \
  "$(printf '%s\n' "${NEXT_ACTIONS[@]-}")" \
  "$(printf '%s\n' "${SCOPE_GUARD[@]-}")" <<'PY'
import json, sys
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except Exception as e:
    ZoneInfo = None

tz_name = sys.argv[1]
event_id = sys.argv[2]
status = sys.argv[3].upper()
summary = sys.argv[4]
project = sys.argv[5].strip() or None
host_override = sys.argv[6].strip() or None
facts_json_raw = sys.argv[7].strip()

# Remaining stdin blobs are newline-joined lists (we passed via printf)
# We read all stdin and split into 4 logical sections separated by blank lines? No:
# We pass each list as a single string arg already via argv is hard, so we passed as stdin lines three times.
# Simpler: we read stdin once and parse sections by sentinel lines.
# But we didn't send sentinels. Instead: we reconstruct from env? Not.
# We'll accept only argv-provided lists are empty and rely on flags. We passed lists as stdin lines one after another,
# which is ambiguous. So we instead embed lists directly by scanning sys.stdin with markers.
PY
)" 2>/dev/null || true

# The above python stub is intentionally replaced below with a robust implementation (no ambiguity):
PAYLOAD_JSON="$(
python3 - "$TZ_NAME" "$ID" "$STATUS" "$SUMMARY" "$PROJECT" "$HOST_OVERRIDE" "$FACTS_JSON_RAW" \
  "${ACTIVE_GOALS[@]+"${ACTIVE_GOALS[@]}"}" -- \
  "${KNOWN_ISSUES[@]+"${KNOWN_ISSUES[@]}"}" -- \
  "${NEXT_ACTIONS[@]+"${NEXT_ACTIONS[@]}"}" -- \
  "${SCOPE_GUARD[@]+"${SCOPE_GUARD[@]}"}" <<'PY'
import json, sys
from datetime import datetime
from zoneinfo import ZoneInfo

tz_name = sys.argv[1]
event_id = sys.argv[2]
status = sys.argv[3].upper()
summary = sys.argv[4]
project = sys.argv[5].strip() or None
host_override = sys.argv[6].strip() or None
facts_json_raw = sys.argv[7].strip()

# Parse argv list sections separated by literal "--"
rest = sys.argv[8:]
sections = []
cur = []
for x in rest:
    if x == "--":
        sections.append(cur)
        cur = []
    else:
        cur.append(x)
sections.append(cur)
# sections: [active_goals, known_issues, next_actions, scope_guard]
active_goals = [s.strip() for s in (sections[0] if len(sections) > 0 else []) if s.strip()]
known_issues = [s.strip() for s in (sections[1] if len(sections) > 1 else []) if s.strip()]
next_actions = [s.strip() for s in (sections[2] if len(sections) > 2 else []) if s.strip()]
scope_guard = [s.strip() for s in (sections[3] if len(sections) > 3 else []) if s.strip()]

if not scope_guard:
    scope_guard = ["UI-only (no backend changes)", "No new endpoints", "No runtime.jsonl rewrite"]

now = datetime.now(ZoneInfo(tz_name))
ts = now.isoformat(timespec="seconds")

host = host_override or None
if host is None:
    # best-effort hostname without shelling out
    import socket
    host = socket.gethostname()

facts = None
if facts_json_raw:
    try:
        facts = json.loads(facts_json_raw)
    except Exception as e:
        raise SystemExit(f"[FAIL] --facts-json is not valid JSON: {e}")

# If no explicit facts-json, build minimal structured facts for WRAPPED_STATE hydration
if facts is None:
    facts = {}

# Prefer additive merge: only fill if missing
facts.setdefault("active_goals", active_goals)
facts.setdefault("known_issues", known_issues)
facts.setdefault("next_actions", next_actions)
facts.setdefault("scope_guard", scope_guard)

event = {
    "type": "CHECKPOINT",
    "id": event_id,
    "name": event_id,
    "ts": ts,
    "tz": tz_name,
    "status": status,
    "host": host,
    "summary": summary,
    "facts": facts,
}
if project:
    event["project"] = project

# JSONL line: compact, single-line
print(json.dumps(event, ensure_ascii=False, separators=(",", ":")))
PY
)"

[[ -n "${PAYLOAD_JSON:-}" ]] || die "Failed to build JSON payload"

echo "=== CHECKPOINT PAYLOAD (JSONL line) ==="
echo "$PAYLOAD_JSON"
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  ok "--dry-run set; no writes performed."
  exit 0
fi

# Backup runtime.jsonl before append
ts_tag="$(date +%Y%m%d_%H%M%S)"
bak="$RUNTIME_JSONL.bak_${ts_tag}"
cp -a "$RUNTIME_JSONL" "$bak"
ok "Backup -> $bak"

# Append to runtime.jsonl (one line)
printf '%s\n' "$PAYLOAD_JSON" >>"$RUNTIME_JSONL"
ok "Appended -> $RUNTIME_JSONL"

# Write runtime.latest.json atomically
tmp="${RUNTIME_LATEST}.tmp_${ts_tag}_$$"
printf '%s\n' "$PAYLOAD_JSON" >"$tmp"
mv -f "$tmp" "$RUNTIME_LATEST"
ok "Updated -> $RUNTIME_LATEST"

ok "DONE"
