#!/usr/bin/env bash
# Start SSH tunnels + local backend against Hostinger Postgres/Redis.
# Frontend: set API_BASE_URL=http://localhost:4000/api/v1 in ems-frontend/.env.local
set -euo pipefail

KEY="${HOME}/.ssh/hostinger_ems_ed25519"
HOST="root@31.97.186.223"
EMS="/Users/mohdsaeedafri/All-Code-Base/EMS"

if ! pgrep -f "ssh.*127.0.0.1:15432" >/dev/null; then
  ssh -i "$KEY" -o BatchMode=yes -o ServerAliveInterval=30 -f -N \
    -L 127.0.0.1:15432:127.0.0.1:5432 \
    -L 127.0.0.1:16379:127.0.0.1:6379 "$HOST"
  echo "SSH tunnels started"
fi

ssh -i "$KEY" -o BatchMode=yes "$HOST" 'grep "^DATABASE_URL=" /opt/ems/app/.env' | python3 -c "
import sys
url=sys.stdin.read().strip().split('=',1)[1]
for old in ['@ems-postgres:5432','@127.0.0.1:5432','@localhost:5432']:
  if old in url: url=url.replace(old,'@127.0.0.1:15432'); break
print('DATABASE_URL='+url)
" > /tmp/ems-tunnel.override.env
echo 'REDIS_URL=redis://127.0.0.1:16379' >> /tmp/ems-tunnel.override.env
echo 'PORT=4000' >> /tmp/ems-tunnel.override.env

echo "Override env written to /tmp/ems-tunnel.override.env"
echo "Start backend: cd $EMS && node --env-file=.env --env-file=/tmp/ems-tunnel.override.env --watch src/server.js"
echo "Start frontend: cd ../ems-frontend && npm run dev -- -p 3001"
