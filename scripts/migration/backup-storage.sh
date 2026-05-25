#!/usr/bin/env bash
# Backup completo do Supabase Storage (S3-compatível)
# Uso: ./scripts/migration/backup-storage.sh
# Requer: rclone instalado, e config rclone para Supabase S3

set -euo pipefail

PROJECT_REF="pspvppymcdjbwsudxzdx"
BACKUP_DIR="backups/storage"

if ! command -v rclone &> /dev/null; then
  echo "ERROR: rclone not installed. Install: https://rclone.org/install/"
  exit 1
fi

if ! rclone listremotes | grep -q "^supabase:"; then
  cat <<'EOF'
ERROR: rclone remote "supabase" not configured.

Configure como S3-compatible:
  rclone config
  > n (new remote)
  > name: supabase
  > type: s3
  > provider: Other
  > access_key_id: <S3 access key from Supabase Dashboard → Settings → Storage>
  > secret_access_key: <S3 secret>
  > region: <região do projeto, ex: us-east-1>
  > endpoint: https://pspvppymcdjbwsudxzdx.supabase.co/storage/v1/s3
  > acl: private

S3 credentials: Supabase Dashboard → Settings → Storage → S3 Connection
EOF
  exit 1
fi

mkdir -p "$BACKUP_DIR"

for BUCKET in lesson-audios tts-cache image-lab avatars; do
  echo "→ Sincronizando bucket: $BUCKET"
  rclone sync "supabase:$BUCKET" "$BACKUP_DIR/$BUCKET" \
    --checksum \
    --progress \
    --transfers 16
done

echo ""
echo "✓ Backup completo em $BACKUP_DIR/"
du -sh "$BACKUP_DIR"/*
