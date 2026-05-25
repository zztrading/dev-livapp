-- =============================================================================
-- Agenda alerta diário de uso/gasto da ElevenLabs.
-- =============================================================================
-- A edge function elevenlabs-cost-alert-check lê elevenlabs_usage_log e
-- elevenlabs_alert_config, calcula gasto do mês corrente, e grava em
-- validation_alerts (severity=warning a 80% do limite, critical a 100%).
--
-- Idempotente: a própria edge function evita duplicar alerta do mesmo nível
-- no mesmo dia.
-- =============================================================================

-- pg_cron e pg_net já estão habilitados pela migration 20260217152321.
-- Apenas registramos o job aqui.

DO $$
DECLARE
  project_ref text;
  function_url text;
  service_role_key text;
BEGIN
  -- Tenta extrair project ref e service role das settings do banco.
  -- Em produção isto vem do Vault do Supabase; em dev o Lovable pode
  -- popular via secrets. Se não houver, agenda apenas o registro do job
  -- sem o body funcional — o admin pode disparar manualmente via UI.
  BEGIN
    project_ref := current_setting('app.settings.project_ref', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    project_ref := NULL;
    service_role_key := NULL;
  END;

  -- Remove agendamento prévio (idempotente).
  PERFORM cron.unschedule('elevenlabs-cost-alert-daily')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'elevenlabs-cost-alert-daily'
  );

  IF project_ref IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Cron job elevenlabs-cost-alert-daily registrado em modo manual: configure app.settings.project_ref e app.settings.service_role_key, ou ajuste o body do job no painel.';

    -- Registra como no-op para deixar a entrada criada; admin substitui depois.
    PERFORM cron.schedule(
      'elevenlabs-cost-alert-daily',
      '0 12 * * *',
      $cron$ SELECT 1 $cron$
    );
  ELSE
    function_url := 'https://' || project_ref || '.supabase.co/functions/v1/elevenlabs-cost-alert-check';

    PERFORM cron.schedule(
      'elevenlabs-cost-alert-daily',
      '0 12 * * *', -- 12:00 UTC = 09:00 BRT
      format(
        $cron$
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        ) AS request_id;
        $cron$,
        function_url,
        service_role_key
      )
    );
  END IF;
END $$;

COMMENT ON EXTENSION pg_cron IS
  'Job elevenlabs-cost-alert-daily: chama elevenlabs-cost-alert-check 1x/dia (12 UTC).';
