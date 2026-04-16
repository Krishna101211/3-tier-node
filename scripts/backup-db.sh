#!/bin/bash
set -euo pipefail

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/userdb_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

CONTAINER_NAME="user-registration-db"
DB_NAME="userdb"
DB_USER="postgres"

echo "=== Backing up PostgreSQL database ==="
echo "Container: $CONTAINER_NAME"
echo "Database:  $DB_NAME"
echo "Backup:    $BACKUP_FILE"

docker exec "$CONTAINER_NAME" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
    > "$BACKUP_FILE"

COMPRESSED="${BACKUP_FILE}.gz"
gzip -f "$BACKUP_FILE"

echo "=== Backup complete: $COMPRESSED ==="
echo "Size: $(du -h "$COMPRESSED" | cut -f1)"

echo ""
echo "To restore:"
echo "  gunzip -c $COMPRESSED | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"

echo ""
echo "To list backups:"
echo "  ls -lh $BACKUP_DIR/"
