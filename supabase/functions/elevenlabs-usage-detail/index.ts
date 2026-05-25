// Detailed audit: detect duplicate ElevenLabs TTS generations
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "no key" }), { status: 500, headers: corsHeaders });

  try {
    // Fetch history with pagination - up to 3000 items
    const items: any[] = [];
    let lastId: string | null = null;
    for (let p = 0; p < 3; p++) {
      const url = new URL("https://api.elevenlabs.io/v1/history");
      url.searchParams.set("page_size", "1000");
      if (lastId) url.searchParams.set("start_after_history_item_id", lastId);
      const res = await fetch(url, { headers: { "xi-api-key": apiKey } });
      const data = await res.json();
      if (!data?.history?.length) break;
      items.push(...data.history);
      lastId = data.last_history_item_id;
      if (!data.has_more) break;
    }

    // Group by text hash to detect duplicates
    const byText: Record<string, { count: number; chars: number; voice: string; first: number; last: number; source: string; sample: string }> = {};
    const bySource: Record<string, { count: number; chars: number }> = {};
    const byVoice: Record<string, { count: number; chars: number }> = {};
    const byHour: Record<string, { count: number; chars: number }> = {};

    for (const it of items) {
      const text = (it.text || "").trim();
      const key = text.slice(0, 120);
      const chars = it.character_count_change_to - it.character_count_change_from || text.length;
      const voice = it.voice_name || it.voice_id || "?";
      const source = it.source || "?";
      const ts = (it.date_unix || 0) * 1000;
      const hour = new Date(ts).toISOString().slice(0, 13);

      byText[key] = byText[key] || { count: 0, chars: 0, voice, first: ts, last: ts, source, sample: text.slice(0, 80) };
      byText[key].count++;
      byText[key].chars += chars;
      byText[key].first = Math.min(byText[key].first, ts);
      byText[key].last = Math.max(byText[key].last, ts);

      bySource[source] = bySource[source] || { count: 0, chars: 0 };
      bySource[source].count++;
      bySource[source].chars += chars;

      byVoice[voice] = byVoice[voice] || { count: 0, chars: 0 };
      byVoice[voice].count++;
      byVoice[voice].chars += chars;

      byHour[hour] = byHour[hour] || { count: 0, chars: 0 };
      byHour[hour].count++;
      byHour[hour].chars += chars;
    }

    // Top duplicates (same text generated more than once)
    const duplicates = Object.entries(byText)
      .filter(([_, v]) => v.count > 1)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([k, v]) => ({
        sample: v.sample,
        count: v.count,
        total_chars: v.chars,
        voice: v.voice,
        source: v.source,
        first: new Date(v.first).toISOString(),
        last: new Date(v.last).toISOString(),
        span_hours: ((v.last - v.first) / 3600000).toFixed(1),
      }));

    const totalDupCalls = Object.values(byText).filter(v => v.count > 1).reduce((s, v) => s + v.count, 0);
    const totalDupChars = Object.values(byText).filter(v => v.count > 1).reduce((s, v) => s + v.chars, 0);
    const wastedCalls = Object.values(byText).filter(v => v.count > 1).reduce((s, v) => s + (v.count - 1), 0);
    const wastedChars = Object.values(byText).filter(v => v.count > 1).reduce((s, v) => s + Math.round(v.chars * (v.count - 1) / v.count), 0);

    // Spike hours (>=10 calls/hour)
    const spikes = Object.entries(byHour)
      .filter(([_, v]) => v.count >= 10)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([h, v]) => ({ hour: h, ...v }));

    return new Response(JSON.stringify({
      total_items: items.length,
      unique_texts: Object.keys(byText).length,
      duplication_summary: {
        unique_duplicated_texts: Object.values(byText).filter(v => v.count > 1).length,
        total_duplicate_calls: totalDupCalls,
        wasted_calls: wastedCalls,
        wasted_chars: wastedChars,
        wasted_pct: items.length ? (wastedCalls / items.length * 100).toFixed(1) + "%" : "0%",
      },
      by_source: bySource,
      by_voice: byVoice,
      hourly_spikes: spikes,
      top_duplicates: duplicates,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
