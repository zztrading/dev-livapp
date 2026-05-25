# Fase 7 — Deploy & CI/CD próprio

Substituir auto-deploy do Lovable por GitHub Actions.

## Pré-requisitos

1. **Supabase Access Token** (uso pessoal):
   - Gerar em https://supabase.com/dashboard/account/tokens
   - Adicionar em GitHub repo → Settings → Secrets → `SUPABASE_ACCESS_TOKEN`
2. **Supabase Project Ref**: `pspvppymcdjbwsudxzdx`
   - Adicionar como `SUPABASE_PROJECT_REF` (não-secret, mas ok como secret)
3. **Vercel/Netlify token** (frontend):
   - Vercel: https://vercel.com/account/tokens → `VERCEL_TOKEN`
   - Netlify: https://app.netlify.com/user/applications → `NETLIFY_AUTH_TOKEN`

## Workflow 1: Deploy Edge Functions

`.github/workflows/deploy-edge-functions.yml`:

```yaml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'
      - 'supabase/config.toml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Deploy all functions
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: |
          supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
```

## Workflow 2: DB Migrations

`.github/workflows/db-migrations.yml`:

```yaml
name: DB Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'
  workflow_dispatch:

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - name: Link project
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
      - name: Push migrations
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: supabase db push
```

## Workflow 3: Frontend (Vercel)

Mais simples: conectar repo no Vercel dashboard (https://vercel.com/new), config:
- Framework: Vite
- Build command: `bun run build`
- Output: `dist`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

Vercel auto-deploya em push para `main`. PRs viram preview deployments.

## Comandos manuais (fallback se CI quebrar)

```bash
# Deploy uma function específica
supabase functions deploy v10-generate-audio --project-ref pspvppymcdjbwsudxzdx

# Deploy todas
supabase functions deploy --project-ref pspvppymcdjbwsudxzdx

# Aplicar migrations pendentes
supabase db push --project-ref pspvppymcdjbwsudxzdx

# Setar secret
supabase secrets set MY_KEY="..." --project-ref pspvppymcdjbwsudxzdx

# Build frontend local
bun install
bun run build
# Output em dist/, fazer upload manual no Vercel/Netlify/CF Pages
```

## Workflows existentes a preservar

- `tts-cache-contract.yml` — validação de cache TTS
- `no-legacy-v7-pipeline.yml` — proíbe re-introdução de pipeline V7
- `v7-runtime-contract.yml` — contratos runtime V7
- `image-lab-contract.yml` — contratos image-lab
- `verify-pr-sync.yml` — sync Lovable↔GitHub (revisar se ainda faz sentido)

`verify-pr-sync.yml` provavelmente vira obsoleto pós-migração — remover.
