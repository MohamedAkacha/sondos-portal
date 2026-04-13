#!/bin/bash
# =====================================================
# MongoDB Automated Backup Script
# Run via cron: 0 2 * * * /path/to/backup-mongo.sh
# =====================================================

BACKUP_DIR="/backups/mongo"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MONGO_URI="${MONGO_DB_URI:-mongodb://localhost:27017/sondos-portal}"
RETENTION_DAYS=7

echo "🔄 Starting MongoDB backup at $TIMESTAMP"

mkdir -p "$BACKUP_DIR"

# Dump
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/$TIMESTAMP" --gzip

if [ $? -eq 0 ]; then
  echo "✅ Backup completed: $BACKUP_DIR/$TIMESTAMP"
  
  # Compress
  tar -czf "$BACKUP_DIR/$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
  rm -rf "$BACKUP_DIR/$TIMESTAMP"
  
  # Remove old backups
  find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
  echo "🧹 Cleaned backups older than $RETENTION_DAYS days"
else
  echo "❌ Backup failed!"
  exit 1
fi
