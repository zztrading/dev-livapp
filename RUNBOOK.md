# AIliv — Runbook Operacional (pós-Lovable)

Operações comuns no dia a dia.

## Logs

```bash
# Edge function logs (últimos 100)
supabase functions logs v10-generate-audio --project-ref pspvppymcdjbwsudxzdx --limit 100

# Tail (em segundo terminal)
supabase functions logs v10-generate-audio --project-ref pspvppymcdjbwsudxzdx --follow

# Dashboard
open https://supabase.com/dashboard/project/pspvppymcdjbwsudxzdx/functions
```

## Banco de dados

```bash
# Console SQL
psql "$SUPABASE_DB_URL"

# Backup pontual
pg_dump "$SUPABASE_DB_URL" --no-owner --no-acl | gzip > backup-$(date +%Y%m%d).sql.gz

# Migration nova
supabase migration new <nome_descritivo>
# Edita o arquivo gerado em supabase/migrations/
supabase db push --project-ref pspvppymcdjbwsudxzdx

# Regenerar tipos TypeScript
supabase gen types typescript --project-id pspvppymcdjbwsudxzdx > src/integrations/supabase/types.ts
```

## Storage

```bash
# Upload manual
supabase storage cp ./arquivo.mp3 ss:///lesson-audios/audios/X.mp3 --project-ref pspvppymcdjbwsudxzdx

# Listar
supabase storage ls ss:///lesson-audios --project-ref pspvppymcdjbwsudxzdx

# Sync grande (use rclone)
rclone sync ./local supabase:lesson-audios --checksum --progress
```

## Secrets

```bash
supabase secrets list --project-ref pspvppymcdjbwsudxzdx
supabase secrets set MY_KEY="..." --project-ref pspvppymcdjbwsudxzdx
supabase secrets unset MY_KEY --project-ref pspvppymcdjbwsudxzdx
```

## Cron jobs

```sql
-- Ver jobs ativos (precisa role com acesso a cron)
SELECT jobid, jobname, schedule, active FROM cron.job;

-- Ver últimas execuções
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Pausar/reativar
SELECT cron.alter_job(jobid := X, active := false);

-- Remover
SELECT cron.unschedule('nome-do-job');
```

## Deploy

```bash
# Edge function única
supabase functions deploy v10-generate-audio --project-ref pspvppymcdjbwsudxzdx

# Todas
supabase functions deploy --project-ref pspvppymcdjbwsudxzdx

# Frontend (Vercel)
vercel --prod
```

## Rotacionar key comprometida

```bash
# Lovable API key (se ainda usar) — não aplicável pós-migração
# OpenAI / Google / ElevenLabs / OpenRouter:
# 1. Gerar nova no painel do provider
# 2. supabase secrets set OPENAI_API_KEY="nova_key" --project-ref pspvppymcdjbwsudxzdx
# 3. Revogar antiga no painel do provider
# 4. Verificar logs por 24h pra confirmar zero falhas
```

## Adicionar novo bucket

```sql
-- Em migration nova:
INSERT INTO storage.buckets (id, name, public) VALUES ('meu-bucket', 'meu-bucket', false);

CREATE POLICY "Users can upload own files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'meu-bucket' AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## Sair do ar / rollback

```bash
# Reverter última migration aplicada
# (Supabase não tem rollback automático — restaurar do backup)
psql "$SUPABASE_DB_URL" < backups/db-pre-migration.sql

# Reverter deploy de edge function
git revert <commit-hash>
git push origin main  # CI re-deploya a versão anterior
```

## Monitoramento de custo

- **Supabase**: https://supabase.com/dashboard/project/pspvppymcdjbwsudxzdx/settings/billing
- **OpenAI/OpenRouter**: dashboards próprios
- **ElevenLabs**: function `elevenlabs-usage-audit` + cron `elevenlabs-cost-alert-check`
- **Vercel**: https://vercel.com/<sua-org>/<projeto>/usage
