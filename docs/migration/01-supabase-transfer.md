# Fase 1 — Transferência de ownership do Supabase

## Cenário A (preferido): Lovable transfere o projeto

Lovable Cloud = projeto Supabase real (`pspvppymcdjbwsudxzdx`). Em teoria, é possível pedir transferência ao Supabase, sem perder URL nem keys.

### Passos

1. Criar org Supabase própria em https://supabase.com/dashboard → `New organization`.
2. Anotar o **org slug** (ex: `seu-nome-org`).
3. Abrir ticket de suporte em https://supabase.com/support OU enviar para o Lovable support:

   > Assunto: Solicito transferência do projeto Lovable Cloud para minha org Supabase
   >
   > Project ref: `pspvppymcdjbwsudxzdx`
   > Org destino: `<seu-org-slug>`
   >
   > Estou migrando minha infra para gerenciar diretamente. Quero manter o mesmo projeto (URLs, keys, dados, storage, edge functions, cron, secrets) sob minha conta Supabase, com billing direto.

4. Aguardar confirmação (normalmente 1-3 dias úteis).
5. Após transferência:
   - URL `https://pspvppymcdjbwsudxzdx.supabase.co` **igual**
   - Anon key e service role key **iguais**
   - Edge Functions, secrets, cron, storage **intactos**
   - Billing passa para sua org Supabase

### O que muda no Lovable
- Lovable perde acesso ao dashboard do projeto.
- Você continua usando Lovable para editar o código se quiser (sync via GitHub continua), mas mudanças de DB precisam ser feitas via Supabase CLI/dashboard direto.

## Cenário B (fallback): Criar projeto Supabase do zero

Se Lovable recusar transferência:

1. `supabase projects create aiiv-prod --org-id <seu-org-id> --region <região-mais-próxima>`
2. Restaurar DB: `psql $NEW_DB_URL < backups/db-pre-migration.sql`
3. Recriar storage:
   ```bash
   # Buckets via migration (fase 2.2)
   # Objetos via rclone:
   rclone copy supabase-old:lesson-audios supabase-new:lesson-audios --checksum
   rclone copy supabase-old:tts-cache supabase-new:tts-cache --checksum
   rclone copy supabase-old:image-lab supabase-new:image-lab --checksum
   ```
4. Recadastrar todos secrets (lista em `02-secrets.md`).
5. Re-deploy de todas as edge functions: `supabase functions deploy --project-ref $NEW_REF`
6. Recriar cron via migration (fase 2.1) — **atenção ao anon key novo**.
7. Atualizar frontend:
   - `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - Vercel env vars idem
8. Reconfigurar Google OAuth no novo projeto (Auth → Providers).
9. Validação E2E completa (fase 9) antes de descomissionar o projeto antigo.

### Riscos do Cenário B
- Dump+restore de Postgres geralmente funciona, mas extensions (`pg_cron`, `pg_net`, `pgmq`, `pgcrypto`, `vector`) precisam estar ativadas no projeto novo **antes** do restore.
- Storage public URLs mudam (`pspvppymcdjbwsudxzdx.supabase.co` → novo ref). Qualquer URL hardcoded em DB (`lesson-audios/...`) precisa de update massivo. Recomendação: usar URL relativa ou variável de ambiente no frontend.
- Re-uploads de 3.95 GB em rclone levam minutos (não horas).
