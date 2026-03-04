#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/control_plane/backstage"
SESSION="backstage"

# Ensure session exists
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d -s "$SESSION"
fi

# Start backend (7007) if not listening
if ! ss -ltn | grep -q ":7007"; then
  tmux send-keys -t "$SESSION:0" "cd ~/control_plane/backstage && yarn dev" C-m
fi

# Start frontend (3000) if not listening
if ! ss -ltn | grep -q ":3000"; then
  tmux send-keys -t "$SESSION:0" "cd ~/control_plane/backstage && yarn start" C-m
fi

# Attach only when we have a real terminal (silent launcher => no attach)
if [ -t 1 ]; then
  exec tmux attach -t "$SESSION"
else
  exit 0
fi
