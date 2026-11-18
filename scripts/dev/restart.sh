#!/usr/bin/env bash
# Restart named dev servers in the background and wait until each answers.
#   scripts/dev/restart.sh test novice blank preview   # the preview-DB servers
#   scripts/dev/restart.sh all                          # those plus main (:3000)
#   scripts/dev/restart.sh --clean blank                # also delete its build cache (fixes a
#                                                       # dev server stuck in a Fast Refresh reload loop)
# Needed after a migration: long-running servers keep the old Drizzle schema.
# Logs: ~/Library/Logs/pramana/<name>.log (PRAMANA_LOG_DIR). Never inside the repo: the dev
# servers watch the repo root, so a log written there makes every open page reload.
set -uo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
logs="${PRAMANA_LOG_DIR:-$HOME/Library/Logs/pramana}"
mkdir -p "$logs"
dist_of() { case "$1" in main) echo .next;; preview) echo .next-preview;; test) echo .next-test;; novice) echo .next-novice;; blank) echo .next-blank;; esac; }
port_of() { case "$1" in main) echo 3000;; preview) echo 3100;; test) echo 3200;; novice) echo 3300;; blank) echo 3500;; *) return 1;; esac; }
clean=""
[ "${1:-}" = "--clean" ] && { clean=1; shift; }
names=("$@")
[ "${names[0]:-}" = "all" ] && names=(main preview test novice blank)
[ ${#names[@]} -eq 0 ] && names=(preview test novice blank)
for n in "${names[@]}"; do
  p=$(port_of "$n") || { echo "unknown server $n" >&2; exit 2; }
  pids=$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null
  for _ in $(seq 1 20); do lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 0.5; done
  [ -n "$clean" ] && rm -rf "$root/apps/web/$(dist_of "$n")"
  nohup "$root/scripts/dev/serve.sh" "$n" > "$logs/$n.log" 2>&1 &
done
for n in "${names[@]}"; do
  p=$(port_of "$n")
  ok=""
  for _ in $(seq 1 120); do
    code=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "http://127.0.0.1:$p/manifest.webmanifest" || true)
    case "$code" in 200|307|308) ok=1; break;; esac
    sleep 1
  done
  [ -n "$ok" ] && echo "$n :$p up" || echo "$n :$p NOT answering; see $logs/$n.log"
done
