# Fase 4 — Consolidar ElevenLabs

## Estado atual

Lovable injeta 2 secrets:
- `ELEVENLABS_API_KEY` — sua key direta
- `ELEVENLABS_API_KEY_1` — key do **connector Lovable ElevenLabs** (managed)

Functions usam lógica de fallback: tenta `_1`, cai para principal.

## Functions afetadas (16)

```
elevenlabs-tts-contextual
elevenlabs-usage-audit
elevenlabs-usage-detail
elevenlabs-usage-items
generate-audio-elevenlabs
generate-audio-with-timestamps
generate-lesson-audio
generate-multiple-audios
processar-aula
v7-generate-secret-audio
v7-regenerate-audio
v7-vv
v8-generate-section-audio
v8-reprocess-audio
v10-generate-audio
v10-process-anchors
```

## Plano

1. Criar conta ElevenLabs própria (se ainda não tem) em https://elevenlabs.io
2. Gerar API key em https://elevenlabs.io/app/settings/api-keys
3. Setar como `ELEVENLABS_API_KEY` no Supabase:
   ```bash
   supabase secrets set ELEVENLABS_API_KEY="sk_..." --project-ref pspvppymcdjbwsudxzdx
   ```
4. Em cada function, remover fallback `_1`:
   ```diff
   - const apiKey = Deno.env.get('ELEVENLABS_API_KEY_1') || Deno.env.get('ELEVENLABS_API_KEY');
   + const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
   ```
5. Desconectar connector Lovable ElevenLabs (depois de remover do código).
6. `unset ELEVENLABS_API_KEY_1`.

## Voice config (já documentado em mem://infrastructure/eleven-labs-voice-standard-alice)

- Voice: `Alice` (ElevenLabs)
- Model: `eleven_multilingual_v2`
- Stability: 0.5, Similarity boost: 0.75, Style: 0.0

Não precisa mexer. Voice IDs ElevenLabs são globais.

## Monitoramento de custo

`elevenlabs-cost-alert-check` cron job (versionado na Fase 2.1) chama essa API com sua key direta — vai continuar funcionando após consolidação.
