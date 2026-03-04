# cp-guardian — Guardian loop (systemd user timer) + transition NOTE emitter (SAFE)

## Purpose
- Run Control Plane health checks periodically without new endpoints.
- Keep observability boring: logs in journald; RuntimeTruth NOTE only on status transitions (anti-spam).

## Components
- systemd user units:
  - ~/.config/systemd/user/cp-guardian.service
  - ~/.config/systemd/user/cp-guardian.timer
- ExecStart script (runs health + emits NOTE on transition):
  - /home/danie/control_plane/runtime_truth_store/guardian_emit_note.sh
- Health check script (canonical):
  - /home/danie/control_plane/runtime_truth_store/runtime_health.sh
- State (explicit, governed):
  - /home/danie/control_plane/runtime_truth_store/guardian_state.json
- RuntimeTruth append-only log:
  - /home/danie/control_plane/runtime_truth_store/runtime.jsonl

## Behavior (READ ONLY by default)
- Every timer tick runs runtime_health.sh and writes full output to journald.
- Status is parsed from the line:
  - `CONTROL PLANE HEALTH: <STATUS>`
- A RuntimeTruth NOTE is appended only when status changes (or first run with no state).
  - type: NOTE
  - id prefix: CP_GUARDIAN__STATUS__
  - msg format: `cp-guardian status <STATUS> (wrapKey=...) (backend=...)`
- No changes are made to runtime.latest.json selection policy (wraps still drive latest checkpoint).

## Install / Verify (WSL)
- Enable timer:
  - systemctl --user daemon-reload
  - systemctl --user enable --now cp-guardian.timer
- Inspect logs:
  - journalctl --user -u cp-guardian.service -n 80 --no-pager
- Verify anti-spam:
  - Restart service twice; NOTE count must not increase on stable status.

## Uninstall (reversible)
- systemctl --user disable --now cp-guardian.timer
- Remove unit files:
  - ~/.config/systemd/user/cp-guardian.timer
  - ~/.config/systemd/user/cp-guardian.service
- systemctl --user daemon-reload

## Governance notes
- Any new defaults/paths/policies must be documented + indexed before continuing.
- Do not add new RuntimeTruth event types without explicit order; NOTE is used because it already exists in JSONL.
