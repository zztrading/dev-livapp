// Diagnostic edge function: fetches REAL ElevenLabs usage data for billing audit
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { requireAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const keyName = url.searchParams.get("key") || "ELEVENLABS_API_KEY";
  const apiKey = Deno.env.get(keyName);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: `no api key for ${keyName}`, available: { primary: !!Deno.env.get("ELEVENLABS_API_KEY"), connector: !!Deno.env.get("ELEVENLABS_API_KEY_1") } }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const days = parseInt(url.searchParams.get("days") || "90");
    const now = Date.now();
    const start = now - days * 24 * 60 * 60 * 1000;

    // 1. Subscription info (current plan, char usage this period)
    const subRes = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    const subscription = await subRes.json();

    // 2. Character usage history (per-day breakdown)
    const usageRes = await fetch(
      `https://api.elevenlabs.io/v1/usage/character-stats?start_unix=${start}&end_unix=${now}&breakdown_type=voice`,
      { headers: { "xi-api-key": apiKey } }
    );
    const usage = await usageRes.json();

    // 3. History (recent generations - last 1000)
    const historyRes = await fetch("https://api.elevenlabs.io/v1/history?page_size=1000", {
      headers: { "xi-api-key": apiKey },
    });
    const history = await historyRes.json();

    // Aggregate history
    const historyAgg: Record<string, { count: number; chars: number }> = {};
    let totalHistoryChars = 0;
    let totalHistoryCount = 0;
    if (history?.history) {
      for (const item of history.history) {
        const day = new Date((item.date_unix || 0) * 1000).toISOString().slice(0, 10);
        const chars = item.character_count_change_to - item.character_count_change_from || 0;
        historyAgg[day] = historyAgg[day] || { count: 0, chars: 0 };
        historyAgg[day].count++;
        historyAgg[day].chars += chars;
        totalHistoryChars += chars;
        totalHistoryCount++;
      }
    }

    return new Response(
      JSON.stringify({
        subscription: {
          tier: subscription.tier,
          character_count: subscription.character_count,
          character_limit: subscription.character_limit,
          can_extend_character_limit: subscription.can_extend_character_limit,
          status: subscription.status,
          next_character_count_reset_unix: subscription.next_character_count_reset_unix,
          next_reset_iso: subscription.next_character_count_reset_unix
            ? new Date(subscription.next_character_count_reset_unix * 1000).toISOString()
            : null,
        },
        usage_stats: usage,
        history_summary: {
          total_items: totalHistoryCount,
          total_characters: totalHistoryChars,
          per_day: historyAgg,
          oldest: history?.history?.[history.history.length - 1]?.date_unix
            ? new Date(history.history[history.history.length - 1].date_unix * 1000).toISOString()
            : null,
          newest: history?.history?.[0]?.date_unix
            ? new Date(history.history[0].date_unix * 1000).toISOString()
            : null,
        },
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
