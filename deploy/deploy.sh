#!/usr/bin/env bash
# Deploy the web app to the Hetzner box (web-2) at https://pramana.vootlachaitanya.com.
#
#   deploy/deploy.sh            build the image locally, ship it, restart the web container
#   deploy/deploy.sh --db       also replace the box's database with a dump of the local main DB
#   deploy/deploy.sh --data     also sync data/snapshots (source texts) to the box
#
# The box runs `docker compose -p pramana` in /opt/pramana (deploy/docker-compose.yml):
# Postgres 18 and the web app on 127.0.0.1:3700. Caddy (movie-browser's stack) proxies
# the subdomain; its site block (deploy/pramana.caddy) and static pages (deploy/static)
# are copied into the caddy_data volume at /data/sites/. Never build on the box: it hosts movie-browser too.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${PRAMANA_DEPLOY_HOST:-ubuntu@178.105.158.84}"
KEY="${PRAMANA_DEPLOY_KEY:-$HOME/.ssh/hetzner_moviebrowser}"
SSH=(ssh -i "$KEY" "$HOST")

with_db=0 with_data=0
for arg in "$@"; do
  case "$arg" in
    --db) with_db=1 ;;
    --data) with_data=1 ;;
    *) echo "unknown option $arg" >&2; exit 2 ;;
  esac
done

echo "== build image"
docker build -f deploy/Dockerfile -t pramana-web:latest .

echo "== ship image"
docker save pramana-web:latest | gzip -1 | "${SSH[@]}" 'gunzip | sudo docker load'
scp -i "$KEY" -q deploy/docker-compose.yml "$HOST:/opt/pramana/docker-compose.yml"

if [ "$with_data" = 1 ]; then
  echo "== sync snapshots"
  tar -C data -czf - snapshots | "${SSH[@]}" \
    'sudo tar -xzf - -C /var/lib/pramana/data && sudo chown -R 1000:1000 /var/lib/pramana/data'
fi

if [ "$with_db" = 1 ]; then
  echo "== replace the box database with the local main DB"
  "${SSH[@]}" 'cd /opt/pramana && sudo docker compose -p pramana stop web'
  docker exec social-db-1 pg_dump -U pramana -d pramana -Fc --no-owner --no-privileges \
    | "${SSH[@]}" 'cd /opt/pramana && sudo docker compose -p pramana up -d db >/dev/null &&
        until sudo docker compose -p pramana exec -T db pg_isready -U pramana -q; do sleep 1; done &&
        sudo docker compose -p pramana exec -T db psql -U pramana -d postgres -qc "DROP DATABASE IF EXISTS pramana WITH (FORCE)" -c "CREATE DATABASE pramana" &&
        sudo docker compose -p pramana exec -T db pg_restore -U pramana -d pramana --no-owner --no-privileges'
fi

echo "== caddy site and static pages"
tar -czf - -C deploy pramana.caddy static | "${SSH[@]}" 'set -e
  t=$(mktemp -d); tar -xzf - -C "$t"
  C=movie-browser-caddy
  sudo docker exec $C mkdir -p /data/sites/pramana-static
  sudo docker cp "$t/static/." $C:/data/sites/pramana-static/
  # Keep the working site file until the new one validates: a broken file in the
  # import glob would stop Caddy, and with it movie-browser, at its next restart.
  sudo docker exec $C sh -c "cp /data/sites/pramana.caddy /data/sites/pramana.caddy.prev 2>/dev/null || true"
  sudo docker cp "$t/pramana.caddy" $C:/data/sites/pramana.caddy
  rm -rf "$t"
  if ! sudo docker exec $C caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    sudo docker exec $C sh -c "mv /data/sites/pramana.caddy.prev /data/sites/pramana.caddy"
    echo "new Caddy site file is invalid; kept the old one" >&2; exit 1
  fi
  sudo docker exec $C caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile'

echo "== restart web"
"${SSH[@]}" 'cd /opt/pramana && sudo docker compose -p pramana up -d && sudo docker image prune -f >/dev/null'
"${SSH[@]}" 'for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3700/); [ "$c" = 200 ] && break; sleep 1; done; echo "web answers $c"'
