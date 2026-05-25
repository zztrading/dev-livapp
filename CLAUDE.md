# CLAUDE.md

Regras funcionais que devo seguir **sempre** neste projeto.

## Fluxo obrigatório ao implementar qualquer correção ou nova funcionalidade

Quando o usuário aprovar uma implementação (com "aprovado", "pode fazer", "ok", etc.), seguir **exatamente** esta ordem:

1. **Implementar** a mudança nos arquivos
2. **Rodar type check** — `npx tsc --noEmit` (frontend) e verificar Edge Functions do Supabase
3. **Se houver erros** — corrigir todos antes de continuar
4. **Mostrar ao usuário ANTES de commitar:**
   - Lista de erros encontrados e como foram corrigidos
   - Resultado final do type check (deve ser zero erros)
5. **Aguardar confirmação** do usuário
6. **Commit** com mensagem descritiva
7. **Push** para o branch designado (`claude/...` com session id)
8. **Abrir PR** para `main`

## Regras

- **Nunca** commitar código com erros de TypeScript
- **Nunca** pular o type check "porque a mudança é pequena"
- **Sempre** checar Edge Functions (`supabase/functions/`) — elas rodam em Deno e têm erros diferentes do frontend
- Usar o hash do **merge commit** (não do branch) quando referir-se a commits em `main`
- Ao sincronizar com outros workspaces (Lovable), sempre rodar `git fetch origin main` primeiro

## Branch designado para esta sessão

Cada sessão do Claude Code recebe um branch próprio (`claude/<slug>-<id>`) informado nas instruções iniciais. Desenvolver e fazer push **apenas** nesse branch — nunca direto em `main`, nunca em branch de sessão antiga.
