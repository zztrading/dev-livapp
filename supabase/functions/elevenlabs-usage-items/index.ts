// Returns raw ElevenLabs history items (minimal fields) for client-side filtering
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
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "no api key" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const maxPages = Math.min(parseInt(url.searchParams.get("max_pages") || "20"), 30);

    const items: Array<{
      ts: number;
      date: string;
      month: string;
      voice: string;
      voice_id: string;
      source: string;
      chars: number;
      text_sample: string;
      state: string;
    }> = [];

    let lastId: string | null = null;
    for (let p = 0; p < maxPages; p++) {
      const u = new URL("https://api.elevenlabs.io/v1/history");
      u.searchParams.set("page_size", "1000");
      if (lastId) u.searchParams.set("start_after_history_item_id", lastId);
      const res = await fetch(u, { headers: { "xi-api-key": apiKey } });
      if (!res.ok) break;
      const data = await res.json();
      if (!data?.history?.length) break;
      for (const it of data.history) {
        const chars = (it.character_count_change_to ?? 0) - (it.character_count_change_from ?? 0);
        const ts = (it.date_unix || 0) * 1000;
        const d = new Date(ts);
        items.push({
          ts,
          date: d.toISOString().slice(0, 10),
          month: d.toISOString().slice(0, 7),
          voice: it.voice_name || it.voice_id || "?",
          voice_id: it.voice_id || "",
          source: it.source || "?",
          chars: chars || (it.text || "").length,
          text_sample: (it.text || "").slice(0, 80),
          state: it.state || "?",
        });
      }
      lastId = data.last_history_item_id;
      if (!data.has_more) break;
    }

    return new Response(JSON.stringify({ items, count: items.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
