# AIliv — Migração Lovable → Infra Própria

Documentação completa para sair do Lovable mantendo o Supabase (transferência de ownership) e rodar o projeto **idêntico** ao que roda hoje.

Plano-mestre versionado em `.lovable/plan.md` (10 fases). Esta pasta `docs/migration/` materializa os entregáveis das fases 0, 2, 5, 7 e 8.

## Snapshot do projeto (capturado em build)

- **Supabase project ref**: `pspvppymcdjbwsudxzdx`
- **Edge Functions**: 61 (lista em `docs/migration/00-baseline.md`)
- **Migrations versionadas**: 171
- **Storage**: 4 buckets, ~3.95 GB totais
  - `lesson-audios` (público): 4802 objetos / 3564 MB
  - `tts-cache` (público): 314 objetos / 273 MB
  - `image-lab` (privado): 73 objetos / 121 MB
  - `avatars` (público): 0 objetos
- **Tabelas com dados** (top 5): `diagnostic_logs` (5184), `v7_analytics` (1851), `user_daily_missions` (1743), `v10_bpa_pipeline_log` (1404), `v10_lesson_step_anchors` (798)
- **Edge functions que dependem do Lovable AI Gateway**: 23 (lista em `docs/migration/03-ai-gateway-replacement.md`)
- **Edge functions que usam ElevenLabs**: 16 (lista em `docs/migration/04-elevenlabs.md`)

## Checklist de migração

- [x] Fase 0 — Baseline documentado (`00-baseline.md`)
- [ ] Fase 0 — Backup DB executado (script: `scripts/migration/backup-db.sh`)
- [ ] Fase 0 — Backup Storage executado (script: `scripts/migration/backup-storage.sh`)
- [ ] Fase 1 — Ticket Lovable aberto para transferência do Supabase
- [ ] Fase 2 — Cron jobs versionados como migration
- [ ] Fase 2 — Storage buckets/policies versionados como migration
- [x] Fase 2 — Lista de secrets documentada (`02-secrets.md`)
- [ ] Fase 2 — Auth config dumpada (`06-auth-config.md`)
- [x] Fase 3 — Mapping AI Gateway → providers diretos (`03-ai-gateway-replacement.md`)
- [ ] Fase 3 — Helper `_shared/ai-gateway.ts` criado
- [ ] Fase 3 — 23 functions migradas
- [x] Fase 4 — Plano ElevenLabs documentado (`04-elevenlabs.md`)
- [x] Fase 5 — Referências Lovable mapeadas (`05-lovable-references.md`)
- [ ] Fase 6 — GitHub Actions workflows criados
- [ ] Fase 7 — Hosting configurado (Vercel/Netlify)
- [ ] Fase 9 — Validação E2E executada
- [ ] Fase 10 — Cutover DNS

## Como usar esta documentação

1. Leia esta visão geral.
2. Execute scripts da Fase 0 para gerar backups locais.
3. Decida hosting + provider de IA (perguntas no fim do plano).
4. Abra ticket Lovable (Fase 1).
5. Siga `07-deploy.md` para configurar CI próprio.
6. Use `RUNBOOK.md` no dia a dia pós-migração.

> **Nada nesta pasta executa mudanças destrutivas**. Tudo é leitura, scripts manuais ou documentação.
