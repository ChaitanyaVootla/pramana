#!/usr/bin/env bash
# Build and (re)start the production server on :3400 (preview DB, test learner). Foreground.
# Alternates between two build directories: the old server keeps serving from one while the
# other builds, so :3400 is down only for the restart.
set -euo pipefail
cd "$(dirname "$0")/../../apps/web"
export DATABASE_URL="postgres://pramana:pramana@127.0.0.1:5442/pramana_preview" PRAMANA_USER_HANDLE=test-learner PRAMANA_USER_NAME="Test learner (preview)"
current=$(cat .next-prod-current 2>/dev/null || echo .next-prod-b)
next=.next-prod-a; [ "$current" = ".next-prod-a" ] && next=.next-prod-b
rm -rf "$next"
NEXT_DIST_DIR=$next npx next build
pids=$(lsof -tiTCP:3400 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pids" ]; then kill $pids; sleep 1; fi
echo "$next" > .next-prod-current
NEXT_DIST_DIR=$next exec npx next start --hostname 127.0.0.1 --port 3400
