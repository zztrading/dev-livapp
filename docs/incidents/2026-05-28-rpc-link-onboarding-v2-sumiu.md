# Incidente — RPC `link_onboarding_v2_to_user` perdeu lógica de populate

**Data:** 2026-05-28
**Severidade:** Alta (gamification do onboarding V2 não vinculada em produção)
**Impacto real:** **0 usuários afetados** — bug detectado ANTES de qualquer aluno completar signup via onboarding V2. PRE-CHECK do PR 5b3 confirmou `onboarding_v2_sessions.user_id IS NOT NULL` retornava 0 rows.
**Status:** Resolvido via migration `20260528180000`

---

## Linha do tempo

| Quando | Evento |
|---|---|
| 2026-05-27 (PR #337) | Migration `20260528140000_link_onboarding_v2_populate_users.sql` aplicada. POST-CHECK retornou `mig_registrada=1`, `rpc_atualizado=true`. RPC funcionava (versão completa com populate de users.*). |
| 2026-05-27 → 28 (entre PRs #338-341) | Algum mecanismo silencioso reverteu o RPC pra versão antiga (apenas UPDATE em `onboarding_v2_sessions.user_id`) e removeu a row da `schema_migrations`. |
| 2026-05-28 (PR 5b3 audit) | Detectado durante auditoria pré-rename de `patent_level`. SQL diagnóstico confirmou: body sem `greatest(xp_total`, schema_migrations sem `20260528140000`. |
| 2026-05-28 (este PR) | Migration `20260528180000` re-aplicada com correções + backfill + asserts transacionais. |

## Causa raiz

Não identificada com 100% de certeza. Lovable confirmou explicitamente não ter alterado a migration. Hipóteses:

1. **Schema sync silencioso** — algum mecanismo de reconciliação (Lovable ou outro) reverteu o RPC ao detectar divergência com snapshot interno.
2. **Reset/restore manual** — operação humana no Dashboard Supabase.
3. **Outro processo automatizado** não documentado.

**Decisão técnica:** parar de procurar culpado e focar em prevenção. A causa raiz pode ser sistêmica (sync ferramenta vs source-of-truth) — proteger via asserts e monitoramento periódico vale mais que pinpointar evento isolado.

## Impacto real em produção

**Zero alunos afetados.** PRE-CHECK do PR 5b3 retornou `0` em
`SELECT count(*) FROM onboarding_v2_sessions WHERE user_id IS NOT NULL`.

Os 5 rows em `public.users` (que apareciam consistentes 5/5/5 na auditoria
de `patent_level`/`patente_level`) foram criados por outros caminhos —
Auth.tsx direto sem `from=quiz`, ou app preexistente. Nenhum deles passou
pelo signup via Tela 13 do Onboarding V2.

**O bug existia mas nunca foi exercitado.** Auditoria forense pré-rename
de `patent_level` pegou o problema antes do primeiro aluno real completar
o fluxo. Backfill embutido na migration `20260528180000` foi noop
(0 rows processadas) — mas mantém-se no script pra robustez caso
o estado mude entre commits e aplicação remota.

## Correção aplicada (migration `20260528180000`)

Migration transacional única com 4 passos:

1. **CREATE OR REPLACE RPC** com lógica completa (versão do PR #337 + correção: escreve em `patent_level` sem 'e', alinhado com app inteiro)
2. **Backfill retroativo** — re-roda RPC pra todos `onboarding_v2_sessions WHERE user_id IS NOT NULL`
3. **DROP COLUMN** `patente_level` (órfã, dados duplicados confirmados via SQL 5/5/5)
4. **Asserts inline** — se algum invariante quebrar (body do RPC não tem `greatest(xp_total`, coluna `patente_level` ainda existe, etc), `RAISE EXCEPTION` aborta tudo via ROLLBACK automático

## Decisão de nomenclatura

`patente_level` (com 'e') tinha sido criada no PR #334 (M0.1) por consistência PT-BR com spec. Mas o app inteiro (13+ pontos: Dashboard, Achievements, GuidedLessonV5 protegido, hooks de gamification) usa `patent_level` (sem 'e').

**Conclusão:** spec V2 errou ao escolher `patente_level`. Custo de refatorar o app inteiro pra usar `patente_level` é alto (inclui arquivo protegido GuidedLessonV5) sem benefício técnico. Drop da coluna órfã + RPC alinhado com convenção existente.

## Prevenção pra próximas sessões

1. **AUDIT_TEMPLATE** atualizado — adicionar check periódico do body do RPC `link_onboarding_v2_to_user` (próxima auditoria pós-merge).
2. **SESSION_LOG** registra este incidente como lição aprendida.
3. **Idéia descartada** — smoke test no `verify-pr-sync.mjs` que checa body do RPC remoto. Inviável por falta de credenciais Supabase no CI; investigar Lovable hooks como alternativa em sessão futura.

## Lições

- POST-CHECK ✅ não significa estado estável — pode regredir.
- Spec PT-BR em projeto com código EN-tech: nomeação canônica deve seguir código existente, não spec novo.
- Auditoria forense periódica do RPC > apenas confiar na migration estar registrada.
