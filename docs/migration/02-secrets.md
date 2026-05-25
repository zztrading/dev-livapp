# Fase 2 — Secrets

Lista completa de secrets que vivem hoje no Supabase Edge Functions e o que fazer com cada um pós-migração.

| Nome | Tipo | Origem | Ação pós-migração |
|---|---|---|---|
| `LOVABLE_API_KEY` | runtime | Lovable AI Gateway | **REMOVER** após migração de todas as 23 functions (Fase 3) |
| `OPENAI_API_KEY` | runtime | OpenAI (já direto) | Manter. Substitui `LOVABLE_API_KEY` para modelos `openai/*` |
| `ELEVENLABS_API_KEY` | runtime | Sua conta ElevenLabs | Manter como única key (Fase 4) |
| `ELEVENLABS_API_KEY_1` | runtime | Connector Lovable | **REMOVER** após Fase 4 (consolidar em `ELEVENLABS_API_KEY`) |
| `GITHUB_TOKEN` | runtime | GitHub PAT | Manter se usado por edge function; senão remover |
| `SUPABASE_URL` | runtime | Auto-injetado | Auto, não mexer |
| `SUPABASE_ANON_KEY` | runtime | Auto-injetado | Auto, não mexer |
| `SUPABASE_PUBLISHABLE_KEY` | runtime | Auto-injetado | Auto, não mexer |
| `SUPABASE_PUBLISHABLE_KEYS` | runtime | Auto-injetado | Auto, não mexer |
| `SUPABASE_SECRET_KEYS` | runtime | Auto-injetado | Auto, não mexer |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | Auto-injetado | Auto, não mexer |
| `SUPABASE_DB_URL` | runtime | Auto-injetado | Auto, não mexer |
| `SUPABASE_JWKS` | runtime | Auto-injetado | Auto, não mexer |
| `ALLOW_FAULT_INJECTION` | runtime | Feature flag | Manter (controla testes de chaos) |

## Secrets novos a cadastrar (Fase 3)

| Nome | Onde obter | Necessário se... |
|---|---|---|
| `GOOGLE_AI_API_KEY` | https://aistudio.google.com/app/apikey | Mantiver modelos `google/gemini-*` |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | Adicionar Claude futuramente |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys | Optar por OpenRouter como gateway unificado em vez de chamadas diretas |

## Como cadastrar/listar secrets pós-Lovable

```bash
# Via Supabase CLI
supabase secrets list --project-ref pspvppymcdjbwsudxzdx
supabase secrets set GOOGLE_AI_API_KEY="..." --project-ref pspvppymcdjbwsudxzdx
supabase secrets unset LOVABLE_API_KEY --project-ref pspvppymcdjbwsudxzdx
```

## Frontend env vars (Vite)

Vivem em `.env` (hoje gerenciado pelo Lovable). Pós-migração, mover para `.env.example` no repo + Vercel/Netlify env vars:

```
VITE_SUPABASE_URL=https://pspvppymcdjbwsudxzdx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi... (anon key, ok público)
VITE_SUPABASE_PROJECT_ID=pspvppymcdjbwsudxzdx
```

**Nunca commitar `.env` real**, só `.env.example`.
