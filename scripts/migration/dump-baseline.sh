#!/usr/bin/env bash
# Captura snapshot completo do estado atual (read-only)
# Uso: SUPABASE_DB_URL="postgresql://..." ./scripts/migration/dump-baseline.sh

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL not set"
  exit 1
fi

OUT="docs/migration/baseline-dump"
mkdir -p "$OUT"

echo "→ Edge functions config..."
cat supabase/config.toml > "$OUT/config.toml"

echo "→ Listando edge functions..."
ls supabase/functions > "$OUT/edge-functions.txt"

echo "→ Cron jobs..."
psql "$SUPABASE_DB_URL" -c "SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobid;" > "$OUT/cron-jobs.txt" 2>&1 || echo "  (permission denied — pegar via dashboard)"

echo "→ Storage buckets..."
psql "$SUPABASE_DB_URL" -c "SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets;" > "$OUT/storage-buckets.txt"

echo "→ Storage objects count..."
psql "$SUPABASE_DB_URL" -c "SELECT bucket_id, COUNT(*) as objects, pg_size_pretty(SUM((metadata->>'size')::bigint)) as size FROM storage.objects GROUP BY bucket_id;" > "$OUT/storage-stats.txt"

echo "→ Storage policies..."
psql "$SUPABASE_DB_URL" -c "SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr FROM pg_policy WHERE polrelid = 'storage.objects'::regclass;" > "$OUT/storage-policies.txt"

echo "→ Table row counts..."
psql "$SUPABASE_DB_URL" -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC;" > "$OUT/table-counts.txt"

echo "→ Auth providers..."
psql "$SUPABASE_DB_URL" -c "SELECT provider_id, COUNT(*) FROM auth.identities GROUP BY provider_id;" > "$OUT/auth-providers-used.txt"

echo "→ Extensions instaladas..."
psql "$SUPABASE_DB_URL" -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;" > "$OUT/extensions.txt"

echo "→ Schema dump (sem dados, só DDL)..."
pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-acl > "$OUT/schema.sql"

echo ""
echo "✓ Baseline capturado em $OUT/"
ls -lh "$OUT"
