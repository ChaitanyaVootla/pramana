#!/usr/bin/env bash
# Start one named dev server (foreground; run it in the background yourself).
#   scripts/dev/serve.sh main|preview|test|novice|blank
# main = the user's DB as the user; the others use the preview DB and must be the only ones used for automated browsing.
set -euo pipefail
cd "$(dirname "$0")/../../apps/web"
PREVIEW="postgres://pramana:pramana@127.0.0.1:5442/pramana_preview"
case "${1:-}" in
  main)    exec npx next dev --hostname 127.0.0.1 --port 3000 ;;
  preview) DATABASE_URL=$PREVIEW NEXT_DIST_DIR=.next-preview exec npx next dev --hostname 127.0.0.1 --port 3100 ;;
  test)    DATABASE_URL=$PREVIEW PRAMANA_USER_HANDLE=test-learner PRAMANA_USER_NAME="Test learner (preview)" NEXT_DIST_DIR=.next-test exec npx next dev --hostname 127.0.0.1 --port 3200 ;;
  novice)  DATABASE_URL=$PREVIEW PRAMANA_USER_HANDLE=test-novice PRAMANA_USER_NAME="Test novice (preview)" NEXT_DIST_DIR=.next-novice exec npx next dev --hostname 127.0.0.1 --port 3300 ;;
  blank)   DATABASE_URL=$PREVIEW PRAMANA_USER_HANDLE=${PRAMANA_BLANK_HANDLE:-test-blank-2} PRAMANA_USER_NAME="Blank learner (preview)" NEXT_DIST_DIR=.next-blank exec npx next dev --hostname 127.0.0.1 --port 3500 ;;
  *) echo "usage: $0 main|preview|test|novice|blank" >&2; exit 2 ;;
esac
