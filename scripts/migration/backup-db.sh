#!/usr/bin/env bash
# Backup completo do Postgres Supabase pré-migração
# Uso: SUPABASE_DB_URL="postgresql://..." ./scripts/migration/backup-db.sh

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL not set"
  echo "Get it from: Supabase Dashboard → Settings → Database → Connection string (URI)"
  exit 1
fi

mkdir -p backups
TS=$(date +%Y%m%d-%H%M%S)
OUT="backups/db-${TS}.sql.gz"

echo "→ Dumping public schema + roles + storage..."
pg_dump "$SUPABASE_DB_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=storage \
  --schema=auth \
  --exclude-schema=supabase_migrations \
  --exclude-table-data='auth.audit_log_entries' \
  --exclude-table-data='auth.refresh_tokens' \
  | gzip > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✓ Backup salvo: $OUT ($SIZE)"
echo ""
echo "Para restaurar em projeto novo:"
echo "  gunzip < $OUT | psql \"\$NEW_DB_URL\""
