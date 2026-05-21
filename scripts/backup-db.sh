#!/usr/bin/env bash
# ── Safre Manasik — PostgreSQL Backup Script ─────────────────────────────
# Run from cron:  0 2 * * * /opt/safre/scripts/backup-db.sh
# Retains last 30 daily backups locally; uploads to S3 if AWS_S3_BUCKET is set.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/safre}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="safre_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Run pg_dump inside the postgres container
docker exec safre_postgres pg_dump \
  -U "${POSTGRES_USER:-safre_admin}" \
  -d "${POSTGRES_DB:-safre_manasik}" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$BACKUP_DIR/$FILENAME"

SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "[$(date)] Backup created: $FILENAME ($SIZE)"

# Optional: upload to S3
if [ -n "${AWS_S3_BUCKET:-}" ]; then
  aws s3 cp "$BACKUP_DIR/$FILENAME" "s3://$AWS_S3_BUCKET/db-backups/$FILENAME" \
    --storage-class STANDARD_IA \
    --metadata "source=safre-manasik,timestamp=$TIMESTAMP"
  echo "[$(date)] Uploaded to s3://$AWS_S3_BUCKET/db-backups/$FILENAME"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "safre_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete
echo "[$(date)] Cleaned backups older than $RETENTION_DAYS days"

echo "[$(date)] Backup complete."
