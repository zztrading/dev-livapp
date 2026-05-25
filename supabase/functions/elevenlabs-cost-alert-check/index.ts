// =============================================================================
// elevenlabs-cost-alert-check
// =============================================================================
// Calcula gasto/uso do mês atual a partir de elevenlabs_usage_log e compara
// com os limites de elevenlabs_alert_config. Grava em validation_alerts
// quando passa de 80% (warning) ou 100% (critical) do limite.
//
// Roda via pg_cron 1× por dia. Pode ser disparada manualmente por admin
// para testar via POST sem body.
//
// Idempotente: não duplica alerta do mesmo nível no mesmo dia.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Preço aproximado overage no plano Creator (USD por 1000 chars).
// Multiplicado pela voz quando aplicável.
const RATE_PER_1K_USD = 0.30;
const VOICE_MULTIPLIERS: Record<string, number> = {
  "Xb7hH8MSUJpSbSDYk0k2": 1.67, // Alice
};
const DEFAULT_VOICE_MULTIPLIER = 1.67;

interface UsageRow {
  voice_id: string;
  char_count: number;
  cache_hit: boolean;
}

interface AlertConfig {
  max_calls_per_month: number | null;
  max_cost_usd_per_month: number | null;
}

function calculateMonthCost(rows: UsageRow[]): { cost: number; calls: number } {
  let cost = 0;
  let calls = 0;
  for (const r of rows) {
    if (r.cache_hit) continue; // hits não custam
    calls += 1;
    const mult = VOICE_MULTIPLIERS[r.voice_id] ?? DEFAULT_VOICE_MULTIPLIER;
    cost += (r.char_count / 1000) * RATE_PER_1K_USD * mult;
  }
  return { cost, calls };
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdminOrService(req);
  if (auth.error) return auth.error;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Lê limites configurados.
    const { data: configRow } = await supabase
      .from("elevenlabs_alert_config")
      .select("max_calls_per_month, max_cost_usd_per_month")
      .eq("id", 1)
      .maybeSingle();

    const config: AlertConfig = {
      max_calls_per_month: configRow?.max_calls_per_month ?? null,
      max_cost_usd_per_month: configRow?.max_cost_usd_per_month ?? null,
    };

    if (config.max_calls_per_month == null && config.max_cost_usd_per_month == null) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no limits configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Soma uso do mês atual (apenas chamadas reais; cache hits são $0).
    const since = startOfMonthIso();
    const { data: rows, error: rowsErr } = await supabase
      .from("elevenlabs_usage_log")
      .select("voice_id, char_count, cache_hit")
      .gte("created_at", since);

    if (rowsErr) {
      return new Response(
        JSON.stringify({ error: rowsErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { cost, calls } = calculateMonthCost((rows ?? []) as UsageRow[]);

    // 3. Decide nível do alerta.
    type Level = "warning" | "critical";
    const triggered: Array<{ level: Level; metric: "calls" | "cost"; ratio: number; current: number; limit: number }> = [];

    if (config.max_calls_per_month && config.max_calls_per_month > 0) {
      const ratio = calls / config.max_calls_per_month;
      if (ratio >= 1) triggered.push({ level: "critical", metric: "calls", ratio, current: calls, limit: config.max_calls_per_month });
      else if (ratio >= 0.8) triggered.push({ level: "warning", metric: "calls", ratio, current: calls, limit: config.max_calls_per_month });
    }
    if (config.max_cost_usd_per_month && config.max_cost_usd_per_month > 0) {
      const ratio = cost / Number(config.max_cost_usd_per_month);
      if (ratio >= 1) triggered.push({ level: "critical", metric: "cost", ratio, current: cost, limit: Number(config.max_cost_usd_per_month) });
      else if (ratio >= 0.8) triggered.push({ level: "warning", metric: "cost", ratio, current: cost, limit: Number(config.max_cost_usd_per_month) });
    }

    if (triggered.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, calls, cost: Number(cost.toFixed(2)), triggered: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Idempotência: não grava alerta do mesmo nível+métrica se já existe hoje.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const inserted: any[] = [];
    for (const t of triggered) {
      const guaranteeName = `elevenlabs-${t.metric}-budget`;
      const testName = `${t.metric}-${t.level}`;

      const { data: existing } = await supabase
        .from("validation_alerts")
        .select("id")
        .eq("guarantee_name", guaranteeName)
        .eq("test_name", testName)
        .eq("severity", t.level === "warning" ? "warning" : "critical")
        .gte("created_at", todayStart.toISOString())
        .maybeSingle();

      if (existing) {
        inserted.push({ skipped: true, level: t.level, metric: t.metric, reason: "already alerted today" });
        continue;
      }

      const message = t.metric === "cost"
        ? `Gasto ElevenLabs em $${t.current.toFixed(2)} (${Math.round(t.ratio * 100)}% do limite mensal $${t.limit.toFixed(2)})`
        : `Chamadas ElevenLabs em ${t.current} (${Math.round(t.ratio * 100)}% do limite mensal ${t.limit})`;

      const { data: ins, error: insErr } = await supabase
        .from("validation_alerts")
        .insert({
          guarantee_name: guaranteeName,
          test_name: testName,
          severity: t.level === "warning" ? "warning" : "critical",
          message,
          details: {
            metric: t.metric,
            level: t.level,
            current: t.current,
            limit: t.limit,
            ratio: Number(t.ratio.toFixed(3)),
            calls_total: calls,
            cost_total_usd: Number(cost.toFixed(2)),
            calculated_at: new Date().toISOString(),
          },
          resolved: false,
        })
        .select("id")
        .single();

      if (insErr) {
        inserted.push({ error: insErr.message, level: t.level, metric: t.metric });
      } else {
        inserted.push({ id: ins.id, level: t.level, metric: t.metric, message });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        calls,
        cost: Number(cost.toFixed(2)),
        triggered: triggered.map(t => ({ level: t.level, metric: t.metric, ratio: Number(t.ratio.toFixed(3)) })),
        inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[elevenlabs-cost-alert-check] error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
