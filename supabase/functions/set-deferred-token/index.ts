// Onboarding V2 — set-deferred-token
//
// Endpoint chamado pela Tela 13 (Signup Deferred) quando o usuário clica "DEPOIS".
// Gera um UUID opaco, salva em onboarding_v2_sessions e retorna no Set-Cookie
// HttpOnly. Cookie vive no domínio das Edge Functions (*.supabase.co) — o app
// não lê o cookie diretamente; ao retornar à home, o app chama redeem-deferred-token
// e o browser anexa o cookie pra Edge Function validar o token e devolver session_id.
//
// SameSite: usamos 'None' (não 'Lax' como o spec sugeria) porque a chamada do app
// ao Edge Function é cross-site fetch; SameSite=Lax bloquearia o cookie nesse caso.
// Mitigação: HttpOnly + Secure + token de baixo risco (apenas continua onboarding
// anônimo; não dá acesso a dados sensíveis).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  session_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { session_id } = body;
  if (!session_id || typeof session_id !== "string") {
    return new Response(JSON.stringify({ error: "Missing session_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_SECONDS * 1000).toISOString();

  // Só seta token se a sessão ainda não estiver vinculada a um user (anônima)
  const { data, error } = await supabase
    .from("onboarding_v2_sessions")
    .update({
      deferred_session_token: token,
      deferred_expires_at: expiresAt,
    })
    .eq("session_id", session_id)
    .is("user_id", null)
    .select("session_id")
    .maybeSingle();

  if (error) {
    console.error("[set-deferred-token] DB error:", error);
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!data) {
    return new Response(
      JSON.stringify({ error: "Session not found or already linked" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ ok: true, expires_at: expiresAt }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Set-Cookie": `deferred_session_token=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${SEVEN_DAYS_SECONDS}`,
    },
  });
});
