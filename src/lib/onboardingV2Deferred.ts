// Onboarding V2 — helpers de deferred token (cookie HttpOnly 7d).
//
// O token vive em cookie HttpOnly no domínio das Edge Functions (*.supabase.co).
// O front nunca acessa o cookie diretamente — só chama as funções abaixo, que
// fazem fetch com `credentials: "include"` pra que o browser anexe/receba o cookie.

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1`;

interface RedeemResponse {
  ok: boolean;
  session_id: string | null;
  completed?: boolean;
  reason?: "expired" | "already_linked";
}

/**
 * Tela 13 → "DEPOIS": pede pra Edge Function emitir cookie HttpOnly de 7d
 * vinculado ao session_id. Retorna true se setou com sucesso.
 */
export async function setDeferredToken(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/set-deferred-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    return res.ok;
  } catch (err) {
    console.error("[setDeferredToken] fetch failed:", err);
    return false;
  }
}

/**
 * Ao retornar à home (visitante): pergunta à Edge Function se o cookie atual
 * (se houver) aponta pra uma sessão ainda válida. O browser anexa o cookie
 * automaticamente; o front só processa a resposta.
 */
export async function redeemDeferredToken(): Promise<RedeemResponse> {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/redeem-deferred-token`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) {
      return { ok: false, session_id: null };
    }
    return (await res.json()) as RedeemResponse;
  } catch (err) {
    console.error("[redeemDeferredToken] fetch failed:", err);
    return { ok: false, session_id: null };
  }
}
