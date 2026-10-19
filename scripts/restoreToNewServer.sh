#!/usr/bin/env bash
# Quick automated restore script for when the new server IP is provided.
# Usage: ./scripts/restoreToNewServer.sh <NEW_IP> [SSH_PORT]
set -euo pipefail

NEW_IP="${1:?Error: Provide NEW_IP as first argument}"
PORT="${2:-22}"
KEY="${HOME}/.ssh/hostinger_ems_ed25519"
BACKUP_DIR="/Users/mohdsaeedafri/All-Code-Base/EMS/backups"

echo "=== Target: root@$NEW_IP (port $PORT) ==="

# 1. Test SSH
echo "[1/5] Testing SSH connectivity..."
ssh -p "$PORT" -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "root@$NEW_IP" "uname -a && docker --version"

# 2. Prepare directories on new server
echo "[2/5] Creating /opt/ems and volumes..."
ssh -p "$PORT" -i "$KEY" "root@$NEW_IP" "mkdir -p /opt/ems /opt/ems-data/postgres /opt/ems-data/redis /opt/ems-backups"

# 3. Transfer code, Dockerfile, entrypoint and backups
echo "[3/5] Transferring codebase and backup files..."
cd /Users/mohdsaeedafri/All-Code-Base/EMS
tar --exclude="node_modules" --exclude=".git" -czf - prisma src package.json package-lock.json | \
  ssh -p "$PORT" -i "$KEY" "root@$NEW_IP" "tar xzf - -C /opt/ems"

scp -P "$PORT" -i "$KEY" "$BACKUP_DIR/Dockerfile" "$BACKUP_DIR/entrypoint.sh" "root@$NEW_IP:/opt/ems/"
scp -P "$PORT" -i "$KEY" "$BACKUP_DIR/ems_database.dump" "$BACKUP_DIR/redis_dump.rdb" "root@$NEW_IP:/opt/ems-backups/"

# 4. Build and run EMS container
echo "[4/5] Building and launching EMS container..."
ssh -p "$PORT" -i "$KEY" "root@$NEW_IP" '
  chmod +x /opt/ems/entrypoint.sh
  cd /opt/ems && docker build -t ems-services:latest .
  docker rm -f EMS 2>/dev/null || true
  docker run -d \
    --name EMS \
    --restart unless-stopped \
    -p 5000:5000 \
    -p 5432:5432 \
    -p 6379:6379 \
    -e POSTGRES_DB=ems \
    -e POSTGRES_USER=ems_user \
    -e POSTGRES_PASSWORD=b3dc6022286765e48af328d30dedf10957f0c6e0323efceb \
    -v /opt/ems/entrypoint.sh:/usr/local/bin/entrypoint.sh \
    -v /opt/ems-data/postgres:/var/lib/postgresql/16/main \
    -v /opt/ems-data/redis:/var/lib/redis \
    -v /opt/ems:/app \
    ems-services:latest
  sleep 8
  ufw allow 5000/tcp 2>/dev/null || true
'

# 5. Restore database from dump
echo "[5/5] Restoring database state..."
ssh -p "$PORT" -i "$KEY" "root@$NEW_IP" '
  docker exec -i EMS pg_restore -U ems_user -d ems --clean --if-exists --no-owner /opt/ems-backups/ems_database.dump 2>/dev/null || true
  docker exec EMS redis-cli ping
  curl -s http://127.0.0.1:5000/health
'

echo "=== RESTORE COMPLETE ON $NEW_IP ==="

