#!/bin/sh
# Runs ON the VPS as root for every green CI run on main (see ems-deploy-shim.sh and
# .github/workflows/deploy-hostinger.yml). Usage: deploy.sh <release dir> <commit sha>
#
# Touches only the `ems` compose project's backend. rentocloud-* containers share this box
# and are never named here. Containers are never removed by image filter.
set -eu
umask 077 # dumps and releases hold PII; root-only
REL=$1
SHA=$2
SHORT=$(printf %s "$SHA" | cut -c1-7)
TS=$(date -u +%Y%m%d%H%M%S)
cd /opt/ems

healthy() { # waits up to 120s for the backend built from $1 to answer /health
  i=0
  while [ $i -lt 120 ]; do
    running=$(docker inspect ems-backend --format '{{index .Config.Labels "ems.commit"}}' 2>/dev/null || true)
    code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/health || true)
    [ "$code" = 200 ] && { [ -z "$1" ] || [ "$running" = "$1" ]; } && return 0
    i=$((i + 1)); sleep 1
  done
  return 1
}

echo "== [1/5] database backup"
docker exec ems-postgres pg_dump -U ems_user -Fc ems > "/opt/ems-backups/ems_predeploy_${TS}_$SHORT.dump.tmp"
mv "/opt/ems-backups/ems_predeploy_${TS}_$SHORT.dump.tmp" "/opt/ems-backups/ems_predeploy_${TS}_$SHORT.dump"
ls -1t /opt/ems-backups/ems_predeploy_*.dump | tail -n +31 | xargs -r rm -f

echo "== [2/5] build ems-backend:latest from $SHORT (old container keeps serving)"
docker tag ems-backend:latest "ems-backend:pre-$TS"
docker build -q --label "ems.commit=$SHA" -f "$REL/deploy/hostinger/Dockerfile.backend" -t ems-backend:latest "$REL" | cut -c1-19

echo "== [3/5] cut over (migrations run in the container CMD)"
docker compose up -d backend 2>&1 | tail -1
if ! healthy "$SHA"; then
  echo "!! $SHORT did not become healthy; last log lines:"
  docker logs --tail 30 ems-backend 2>&1 | cut -c1-300
  echo "!! rolling back to ems-backend:pre-$TS"
  docker tag "ems-backend:pre-$TS" ems-backend:latest
  docker compose up -d backend 2>&1 | tail -1
  healthy "" && echo "rollback healthy" || echo "!! rollback ALSO unhealthy"
  exit 1
fi
echo "healthy on $SHORT"

echo "== [4/5] scheduled jobs (nightly backup, timesheet reminders)"
install -m 644 "$REL"/deploy/hostinger/systemd/*.service "$REL"/deploy/hostinger/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ems-backup.timer ems-reminder.timer >/dev/null 2>&1
systemctl list-timers --no-pager 'ems-*' | sed -n '2,3p' | awk '{print "  next:", $1, $2, $3, $NF}'

echo "== [5/5] prune (keep 5 releases, 5 rollback images, 30 pre-deploy dumps)"
ls -1dt /opt/ems/releases/*/ | tail -n +6 | xargs -r rm -rf
docker images ems-backend --format '{{.Tag}}' | grep '^pre-' | sort -r | tail -n +6 \
  | while read -r tag; do docker rmi "ems-backend:$tag" >/dev/null 2>&1 || true; done
docker ps --format '{{.Names}} {{.Status}}' | grep -E '^(ems|rentocloud)-'
echo "deployed $SHORT"
