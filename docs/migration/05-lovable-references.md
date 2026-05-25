# Fase 5 — Referências Lovable no código

Resultado da busca `rg "lovable\.(dev|app)|lovable-uploads" src`:

| Arquivo | O que tem | Ação |
|---|---|---|
| `src/components/BuildBadge.tsx` | Badge "Made with Lovable" | **Remover** componente inteiro e suas referências |
| `src/lib/runtimeSignature.ts` | Assinatura de runtime com domínio Lovable | Trocar por domínio próprio ou remover se não usado |
| `src/main.tsx` | Possível import de telemetria Lovable | Limpar imports `lovable-*` |
| `src/data/ai-apps/apps-directory-expanded.ts` | Pode citar Lovable como ferramenta de IA | **Manter** (é conteúdo educacional sobre IA, não código) |

## Checklist de limpeza

```bash
# 1. Buscar todas as referências
rg -n "lovable\.(dev|app)" src public supabase
rg -n "lovable-uploads" src public
rg -n "LOVABLE_API_KEY" src supabase  # esperado em supabase/functions, removido após Fase 3
rg -n "ai\.gateway\.lovable\.dev" supabase  # removido após Fase 3
rg -n "@lovable" package.json  # se houver pacote npm @lovable
```

## index.html / vite.config.ts / package.json

- `index.html`: verificar `<script>` de telemetria Lovable, OG image hospedada em `*.lovable.app`.
- `vite.config.ts`: remover plugins `lovable-*` se houver (provavelmente `vite-plugin-lovable-tagger`).
- `package.json`: remover devDependencies `@lovable/*` ou `vite-plugin-lovable-*`.

## public/landing/*.html

Landing page tem badge Lovable no rodapé e possivelmente links `*.lovable.app`. Revisar `pt.html` e `index.html` (rota `/landing/`).

## lovable-uploads URLs em assets

Imagens originalmente uploadadas via Lovable ficam em `https://...lovable-uploads/...`. Pós-migração:
1. Baixar todas para `public/uploads/` ou bucket próprio Supabase.
2. Search-replace de URLs no DB (campos `image_url`, `audio_url`) — possivelmente nenhum, pois imagens de aula já vivem em `lesson-audios` bucket.

## Validação final

Após limpeza, rodar:
```bash
rg -n "lovable" src public supabase --type-not=md --type-not=json | grep -v "node_modules"
```
Esperado: 0 hits (exceto comentários intencionais e o arquivo de conteúdo educacional).
