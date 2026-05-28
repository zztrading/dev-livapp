// Onboarding V2 — redeem-deferred-token
//
// Endpoint chamado pelo app ao retornar à home (visitante). Lê o cookie HttpOnly
// `deferred_session_token` (que o browser anexa porque a request vai pro mesmo
// domínio supabase.co que setou o cookie), valida no DB e devolve o session_id
// se ainda estiver dentro da janela de 7 dias.
//
// O front, ao receber session_id válido, mostra o banner de recuperação
// ("Você fez o desafio. Quer salvar seu progresso?").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const parseCookie = (header: string | null, name: string): string | null => {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = parseCookie(req.headers.get("Cookie"), "deferred_session_token");

  if (!token) {
    return new Response(JSON.stringify({ ok: false, session_id: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase
    .from("onboarding_v2_sessions")
    .select("session_id, deferred_expires_at, user_id, completed_at")
    .eq("deferred_session_token", token)
    .maybeSingle();

  if (error) {
    console.error("[redeem-deferred-token] DB error:", error);
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!data) {
    // Token desconhecido — limpa cookie
    return new Response(JSON.stringify({ ok: false, session_id: null }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie":
          "deferred_session_token=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0",
      },
    });
  }

  const expiresAt = data.deferred_expires_at
    ? new Date(data.deferred_expires_at as string).getTime()
    : 0;

  if (expiresAt < Date.now()) {
    // Expirado — limpa cookie e retorna null
    return new Response(JSON.stringify({ ok: false, session_id: null, reason: "expired" }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie":
          "deferred_session_token=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0",
      },
    });
  }

  if (data.user_id) {
    // Sessão já vinculada — usuário cadastrou em outro device; não oferece recuperação
    return new Response(
      JSON.stringify({ ok: false, session_id: null, reason: "already_linked" }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Set-Cookie":
            "deferred_session_token=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0",
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      session_id: data.session_id,
      completed: !!data.completed_at,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
