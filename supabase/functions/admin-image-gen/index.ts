// admin-image-gen — generates a single image from a prompt via Lovable AI Gateway.
// Returns { ok, base64 } on success. Admin/supervisor required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) return json({ ok: false, error: "LOVABLE_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ ok: false, error: "Invalid token" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const userRoles = (roles ?? []).map((r: any) => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("supervisor")) {
      return json({ ok: false, error: "Admin/supervisor required" }, 403);
    }

    const { prompt, model } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return json({ ok: false, error: "prompt required" }, 400);
    }

    const selectedModel = model || "google/gemini-2.5-flash-image";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (resp.status === 402) return json({ ok: false, error: "Créditos insuficientes" }, 402);
    if (resp.status === 429) return json({ ok: false, error: "Rate limit" }, 429);
    if (!resp.ok) {
      const text = await resp.text();
      return json({ ok: false, error: `Gateway ${resp.status}: ${text.slice(0, 200)}` }, 502);
    }

    const payload = await resp.json();
    // Image returned as data URL in assistant message images[0].image_url.url
    const message = payload?.choices?.[0]?.message;
    const dataUrl: string | undefined =
      message?.images?.[0]?.image_url?.url ?? message?.images?.[0]?.url;

    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      return json({ ok: false, error: "No image in response" }, 502);
    }

    const base64 = dataUrl.split(",")[1] ?? "";
    return json({ ok: true, base64 });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
