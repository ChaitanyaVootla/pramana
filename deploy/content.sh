#!/usr/bin/env bash
# Apply new content to the box's database, without replacing it (learners' data stays):
# copies source texts the box lacks, backs up its database, then runs the main pipeline
# against it through an SSH tunnel. The pipeline's steps are idempotent, so steps already
# applied there propose nothing.
#
#   deploy/content.sh --from famine-early     # run the pipeline from this step to the end
#   deploy/content.sh                         # every step (slow: each one checks its sources)
#
# deploy/deploy.sh --db does the opposite: it REPLACES the box's database with the local one.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${PRAMANA_DEPLOY_HOST:-ubuntu@178.105.158.84}"
KEY="${PRAMANA_DEPLOY_KEY:-$HOME/.ssh/hetzner_moviebrowser}"
SSH=(ssh -i "$KEY" "$HOST")
PORT="${PRAMANA_TUNNEL_PORT:-5443}"

args=()
if [ "${1:-}" = "--from" ]; then args=(--from "${2:?step name}"); fi

# The local source texts (the worktree's .env may point at the main checkout's data dir).
DATA="${PRAMANA_DATA_DIR:-$(grep -E '^PRAMANA_DATA_DIR=' .env 2>/dev/null | cut -d= -f2- || true)}"
DATA="${DATA:-data}"

echo "== source texts the box lacks"
tar -C "$DATA" -czf - snapshots | "${SSH[@]}" \
  'sudo tar -xzf - --skip-old-files -C /var/lib/pramana/data && sudo chown -R 1000:1000 /var/lib/pramana/data/snapshots'

echo "== back up the box database"
stamp=$(date +%Y%m%d-%H%M%S)
"${SSH[@]}" "cd /opt/pramana && sudo mkdir -p /var/lib/pramana/backups &&
  sudo docker compose -p pramana exec -T db pg_dump -U pramana -d pramana -Fc |
  sudo tee /var/lib/pramana/backups/pramana-$stamp.dump >/dev/null && echo kept /var/lib/pramana/backups/pramana-$stamp.dump"

echo "== tunnel to the box database"
ip=$("${SSH[@]}" 'sudo docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" pramana-db-1')
pw=$("${SSH[@]}" 'sudo grep "^POSTGRES_PASSWORD=" /opt/pramana/.env | cut -d= -f2-')
ssh -i "$KEY" -o ExitOnForwardFailure=yes -N -L "$PORT:$ip:5432" "$HOST" &
tunnel=$!
trap 'kill $tunnel 2>/dev/null || true' EXIT
for _ in $(seq 1 20); do (echo >"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && break; sleep 0.5; done

echo "== pipeline ${args[*]:-(every step)}"
# Every query crosses the tunnel, so a large changeset's dry run takes minutes, not seconds.
DATABASE_URL="postgres://pramana:$pw@127.0.0.1:$PORT/pramana" PRAMANA_DATA_DIR="$DATA" \
  PRAMANA_MCP_TIMEOUT_MS=3600000 PRAMANA_STEP_TIMEOUT_MS=7200000 \
  node node_modules/tsx/dist/cli.mjs scripts/main/pipeline.ts "${args[@]}"
