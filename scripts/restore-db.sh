#!/usr/bin/env bash
# ── Safre Manasik — PostgreSQL Restore Script ────────────────────────────
# Usage: ./restore-db.sh /path/to/safre_YYYYMMDD_HHMMSS.sql.gz

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

BACKUP="$1"

if [ ! -f "$BACKUP" ]; then
  echo "ERROR: Backup file not found: $BACKUP"
  exit 1
fi

echo "WARNING: This will DROP and restore the database. Are you sure? (yes/no)"
read -r CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

echo "[$(date)] Restoring from $BACKUP..."

gunzip -c "$BACKUP" | docker exec -i safre_postgres psql \
  -U "${POSTGRES_USER:-safre_admin}" \
  -d "${POSTGRES_DB:-safre_manasik}"

echo "[$(date)] Restore complete."
echo "Now run: docker compose -f docker-compose.prod.yml restart backend"
