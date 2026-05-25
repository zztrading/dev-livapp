# Baseline pré-migração

Capturado durante a geração desta documentação.

## Supabase
- Project ref: `pspvppymcdjbwsudxzdx`
- URL: `https://pspvppymcdjbwsudxzdx.supabase.co`
- Anon key (público, ok no código): ver `.env` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- 171 migrations versionadas em `supabase/migrations/`

## Edge Functions (61)

```
admin-reset-password, analyze-audio-quality, audit-contracts,
claude-interact, collect-reward,
elevenlabs-cost-alert-check, elevenlabs-tts-contextual,
elevenlabs-usage-audit, elevenlabs-usage-detail, elevenlabs-usage-items,
force-test-c10b,
generate-audio-elevenlabs, generate-audio-with-timestamps,
generate-card-effects, generate-card-effects-v2,
generate-daily-missions, generate-lesson-audio, generate-multiple-audios,
generate-slide-images,
image-lab-generate, image-lab-generate-batch, image-lab-health, image-lab-pipeline-bridge,
lesson-playground,
patch-lesson-content, pipeline-executor, processar-aula,
send-daily-mission-notifications,
unlock-premium-prompt, update-mission-progress, user-progress,
v10-assembly-check, v10-enrich-frames, v10-generate-ai-image, v10-generate-audio,
v10-generate-images, v10-generate-mockups, v10-generate-steps,
v10-preview-score, v10-process-anchors, v10-publish-lesson,
v10-refero-search, v10-score-bpa, v10-suggest-topics,
v7-code-analysis, v7-generate-secret-audio, v7-regenerate-audio, v7-reprocess, v7-vv,
v8-audit-exercises, v8-evaluate-prompt, v8-generate-lesson-content,
v8-generate-raw-content, v8-generate-section-audio, v8-generate-section-image,
v8-generate-variations, v8-refine-content,
v8-reprocess-audio, v8-reprocess-lesson-images,
validate-exercise
```

Todas registradas em `supabase/config.toml` com `verify_jwt = false` (padrão Lovable Cloud).

## Storage

| Bucket | Público | Objetos | Tamanho |
|---|---|---|---|
| lesson-audios | sim | 4802 | 3564 MB |
| tts-cache     | sim | 314  | 273 MB |
| image-lab     | não | 73   | 121 MB |
| avatars       | sim | 0    | 0 |

## Tabelas com dados (snapshot)

```
diagnostic_logs          5184
v7_analytics             1851
user_daily_missions      1743
v10_bpa_pipeline_log     1404
v10_lesson_step_anchors  798
pipeline_executions      671
v10_lesson_steps         455
elevenlabs_usage_log     359
system_logs              342
exercise_audits          152
v10_lesson_intro_slides  131
image_jobs               94
image_attempts           84
image_assets             73
user_gamification_events 66
lessons                  60
v10_lesson_narrations    54
user_onboarding_answers  45
user_rewards             40
user_progress            34
claude_cache             33
v10_bpa_pipeline         28
v10_lessons              27
user_playground_sessions 19
courses                  16
v10_user_lesson_progress 12
trails                   11
user_achievements        6
pricing_sessions         6
user_guide_progress      6
```

## Cron jobs

> Sandbox não tem permissão `cron` para leitura via psql. Dump conhecido (fornecido pelo usuário em conversa anterior): 4 jobs ativos, sendo 2 duplicados:
> - `generate-daily-missions` + `generate-daily-missions-midnight` (mesmo SQL, horário `0 0 * * *`)
> - `cleanup-stale-image-attempts` + `cleanup-stale-image-lab` (mesmo SQL, `*/5 * * * *`)
>
> A migration de cron (Fase 2.1) consolida em 2 jobs canônicos.
