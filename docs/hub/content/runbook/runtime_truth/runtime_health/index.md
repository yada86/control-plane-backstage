# runtime_health.sh — Control Plane health check (READ ONLY)

## What it checks
- Newest HUB_SESSION_WRAP__* in runtime.jsonl
- runtime.latest.json id
- /api/runtime/new-chat-start?debug=1 meta.wrapKey
- Backend reachability on http://127.0.0.1:7007 (HTTP 200)

## How to run
WSL terminal:

```bash
/home/danie/control_plane/runtime_truth_store/runtime_health.sh
```

## cp_health shortcut (PATH entrypoint)
- `cp_health` is a tiny wrapper that runs `runtime_health.sh`.
- If `/home/danie/bin` is in PATH, you can run:
	```bash
	cp_health
	```
- Current installation (WSL): symlink
	`/home/danie/bin/cp_health -> /home/danie/control_plane/runtime_truth_store/cp_health`
- This is a convenience entrypoint; the canonical script remains:
	`/home/danie/control_plane/runtime_truth_store/runtime_health.sh`
