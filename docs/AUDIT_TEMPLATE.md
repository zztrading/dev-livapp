# docs/AUDIT_TEMPLATE.md — Template de Auditoria de Feature

> Padrão de auditoria pra rodar **antes** de declarar feature pronta.
> Existe pra evitar o erro real que aconteceu na Onboarding V2:
> front buildou, PRs mergearam, mas backend (migrations) nunca foi
> aplicado no Supabase remoto.

---

## 1. Quando rodar

Auditoria é obrigatória nestes momentos:

- Após cada sprint que toca DB, RLS, Storage ou Edge Functions
- Antes de marcar uma feature como "pronta pra produção"
- Antes de qualquer release/deploy
- Sempre que um branch acumular 5+ PRs sem merge em `main`

---

## 2. Checklist técnico mínimo

### 2.1. Schema vs frontend

- [ ] Toda tabela referenciada no front (`.from("tabela")`) existe no remote?
- [ ] Toda coluna lida/escrita no front existe na tabela do remote?
- [ ] Tipos Supabase (`src/integrations/supabase/types.ts`) refletem o schema real do remote (não só o local)?

### 2.2. RLS (Row Level Security)

- [ ] Toda tabela nova tem `enable row level security`?
- [ ] Policies cobrem os 4 verbs (SELECT, INSERT, UPDATE, DELETE) sem deixar buraco?
- [ ] Policies anon estão limitadas a `where user_id is null` (lockdown após linkagem)?
- [ ] Nenhuma policy usa `using (true)` ou `with check (true)` sem justificativa documentada?

### 2.3. FK e integridade

- [ ] Toda coluna `*_id` que aponta pra outra tabela tem FK constraint?
- [ ] FK com `on delete cascade` ou `on delete restrict` definido conscientemente (não default)?
- [ ] Unique constraints onde o front depende de idempotência?

### 2.4. Storage

- [ ] Bucket existe no remote (não só na migration local)?
- [ ] Bucket público vs privado bate com o uso no front?
- [ ] Policies de write restritas (admin/supervisor via `has_role()`)?

### 2.5. Edge Functions

- [ ] Função existe no `supabase/functions/` E foi deployed no remote?
- [ ] `verify_jwt` está configurado no `config.toml` se necessário?
- [ ] Secrets/env vars (`LOVABLE_API_KEY`, `ELEVENLABS_KEY` etc.) estão setados no remote?

### 2.6. Migrations aplicadas (mais crítico)

- [ ] Toda migration em `supabase/migrations/` aparece em `supabase_migrations.schema_migrations` do remote?
- [ ] Lovable (ou quem aplica migrations) devolveu evidência via SQL — não só "feito"?

**Block de queries de evidência** (rodar no SQL Editor do Supabase, colar saída):

```sql
-- A) Tabelas criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '<prefixo_da_feature>%'
ORDER BY table_name;

-- B) Colunas críticas adicionadas
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND column_name IN ('<col1>','<col2>')
ORDER BY table_name, column_name;

-- C) FKs
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.<tabela>'::regclass AND contype = 'f';

-- D) RPCs/Functions criadas
SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
WHERE proname = '<nome_da_funcao>';

-- E) Buckets
SELECT id, name, public, file_size_limit FROM storage.buckets
WHERE id = '<nome_do_bucket>';

-- F) Policies (atenção a policies legacy que deveriam ter sido dropadas)
SELECT polname FROM pg_policies
WHERE schemaname IN ('public','storage') AND tablename = '<tabela>'
ORDER BY polname;

-- G) Migrations registradas
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version IN ('<v1>','<v2>',...) ORDER BY version;
```

---

## 3. Formato do relatório

Cada achado deve ter:

| Campo | Exemplo |
|---|---|
| Severidade | 🔴 Bloqueador / 🟡 Médio / 🟢 Polish |
| Onde | `src/components/X.tsx:142` ou `supabase/migrations/Y.sql` |
| O que | "RLS update permite anon modificar row já linkada a user" |
| Impacto | "Vetor de abuso: usuário B descobre session_id e sobrescreve respostas do usuário A" |
| Fix proposto | "Adicionar `where user_id is null` na policy de update" |
| Estimativa | "3 linhas, 5 min" |

Severidades:

- **🔴 Bloqueador** — feature não pode ir pra produção; quebra UX, segurança ou dado
- **🟡 Médio** — vale fix antes de scale, mas não trava lançamento
- **🟢 Polish** — cosmético, a11y, micro-UX

---

## 4. Lições aprendidas — caso Onboarding V2

Caso real registrado em `docs/SESSION_LOG.md` (período 2026-05-19 → 2026-05-26):

**O que aconteceu:**
- 13 PRs mergeados no branch `claude/general-chat-3eVkr`
- Auditoria pessoal validou código frontend
- Feature declarada "deploy-ready"
- Em teste real, descobriu-se que **nenhuma das 5 migrations do Onboarding V2 foi aplicada no Supabase remoto**
- Front silenciosamente swallowava todos os erros (RLS resilient design escondia que tabela não existia)

**Por que passou batido na auditoria anterior:**
- Auditoria leu código local e migration files locais — assumiu que aplicação era automática
- Não rodou query no remote pra confirmar que `onboarding_v2_sessions` (etc.) existia de verdade
- Lovable é quem aplica migrations neste projeto, mas o processo não tem ack obrigatório

**Regra que essa lição gerou (já no CLAUDE.md):**

> Migrations precisam de evidência de aplicação no remote. Toda PR que adiciona/altera arquivo em `supabase/migrations/` só pode ser considerada "pronta" depois que o Lovable aplicar a migration e devolver evidência via SQL.

**Anti-padrão a evitar:**
- "O type check passou e o front buildou, então tá pronto" — front pode buildar mesmo com backend inexistente; resiliência do código não substitui validação de schema real.
