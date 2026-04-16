#!/bin/bash
set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lht ./backups/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="user-registration-db"
DB_NAME="userdb"
DB_USER="postgres"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: File not found: $BACKUP_FILE"
    exit 1
fi

echo "=== Restoring PostgreSQL database ==="
echo "Backup:    $BACKUP_FILE"
echo "Container: $CONTAINER_NAME"
echo "Database:  $DB_NAME"

gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo "=== Restore complete ==="
