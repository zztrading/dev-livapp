import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { redeemDeferredToken } from "@/lib/onboardingV2Deferred";

const SESSION_COOKIE = "yesliv_quiz_session";
const VARIANT_COOKIE = "yesliv_quiz_variant";
// 7d conforme spec onboarding v2 (era 30d em V1)
const COOKIE_MAX_AGE_DAYS = 7;

export type V2QuestionId =
  | "attribution"
  | "hook"
  | "motivation"
  | "ai_level"
  | "daily_goal"
  | "choose_path"
  | "notification_opt";

export type V2Step =
  | "liv_intro"        // Tela 2
  | "attribution"      // Tela 3
  | "hook"             // Tela 4
  | "motivation"       // Tela 5
  | "ai_level"         // Tela 6
  | "promise"          // Tela 7
  | "daily_goal"       // Tela 8
  | "choose_path"      // Tela 9
  | "mini_experience"  // Tela 10
  | "reveal"           // Tela 11
  | "notification"     // Tela 12
  | "signup_deferred"; // Tela 13

const STEP_ORDER: V2Step[] = [
  "liv_intro",
  "attribution",
  "hook",
  "motivation",
  "ai_level",
  "promise",
  "daily_goal",
  "choose_path",
  "mini_experience",
  "reveal",
  "notification",
  "signup_deferred",
];

// Mapa explícito % de progresso por step (spec onboarding v2).
// null = ocultar barra (Telas 2 e 4 — liv_intro e hook).
const PROGRESS_BY_STEP: Record<V2Step, number | null> = {
  liv_intro: null,        // Tela 2: LIV se apresenta (sem barra)
  attribution: 10,        // Tela 3
  hook: null,             // Tela 4: Hook emocional (sem barra)
  motivation: 22,         // Tela 5
  ai_level: 33,           // Tela 6
  promise: 45,            // Tela 7
  daily_goal: 56,         // Tela 8
  choose_path: 67,        // Tela 9
  mini_experience: 78,    // Tela 10
  reveal: 89,             // Tela 11
  notification: 95,       // Tela 12
  signup_deferred: 100,   // Tela 13
};

const setCookie = (name: string, value: string, days = COOKIE_MAX_AGE_DAYS) => {
  const maxAge = days * 24 * 60 * 60;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=lax${secure}`;
};

const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const newSessionId = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const captureUTMs = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_term: params.get("utm_term"),
    utm_content: params.get("utm_content"),
  };
};

const isValidStep = (value: string | null | undefined): value is V2Step =>
  !!value && (STEP_ORDER as readonly string[]).includes(value);

export interface OnboardingV2Answers {
  attribution?: string;
  hook?: string;
  motivation?: string;
  ai_level?: string;
  daily_goal?: string;
  choose_path?: string;
  notification_opt?: string;
}

/**
 * Hook central do onboarding V2 pré-signup.
 *
 * - Cria session_id anônimo em cookie na primeira visita
 * - Persiste UTM/referrer no Supabase via RLS (anon insert permitido)
 * - Upsert idempotente de respostas (corrige bug do v1)
 * - **Persiste `step` no DB** (last_step) — refresh recupera onde parou
 * - Expõe state machine de telas + answers
 */
export const useOnboardingV2 = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [variant, setVariant] = useState<"v1" | "v2">("v2");
  const [step, setStep] = useState<V2Step>("liv_intro");
  const [answers, setAnswers] = useState<OnboardingV2Answers>({});
  const [ready, setReady] = useState(false);

  // Promessa do INSERT lazy — escritas concorrentes aguardam ela
  // (anti-TOCTOU + lazy: só cria sessão na primeira ação real do usuário)
  const sessionInsertPromiseRef = useRef<Promise<string> | null>(null);

  // Bootstrap: APENAS retoma sessão existente. NÃO cria nada.
  // Sessão nova só é criada no primeiro write (saveAnswer/trackEvent) — fix #3 auditoria
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      let existingSessionId = getCookie(SESSION_COOKIE);
      const existingVariant = (getCookie(VARIANT_COOKIE) as "v1" | "v2" | null) ?? "v2";

      // Redemption: se NÃO tem cookie local mas tem deferred token HttpOnly,
      // tenta recuperar a sessão (aluno clicou "Depois" e voltou em <7d).
      // spec onboarding v2 — PR 4 PBI 4.
      if (!existingSessionId) {
        try {
          const redeemed = await redeemDeferredToken();
          if (redeemed.ok && redeemed.session_id && !redeemed.completed) {
            existingSessionId = redeemed.session_id;
            // Restaura cookie local pro fluxo normal saber qual sessão é
            setCookie(SESSION_COOKIE, existingSessionId);
            setCookie(VARIANT_COOKIE, "v2");
          }
        } catch {
          // Falha silenciosa — segue como primeira visita
        }
      }

      if (!existingSessionId) {
        // Primeira visita: NÃO cria sessão ainda — espera primeira ação real
        if (!mounted) return;
        setReady(true);
        return;
      }

      // Retomada: carrega respostas direto das cols dedicadas em sessions
      // (BL.2 fechou: onboarding_v2_answers key-value foi dropada).
      const sessionRes = await supabase
        .from("onboarding_v2_sessions")
        .select("last_step, attribution, hook_answer, motivation, ai_level, path_choice, notif_permission, daily_goal_xp")
        .eq("session_id", existingSessionId)
        .maybeSingle();

      const sessionData = sessionRes.data;
      const restoredAnswers: OnboardingV2Answers = {};
      if (sessionData) {
        if (sessionData.attribution) restoredAnswers.attribution = sessionData.attribution;
        if (sessionData.hook_answer) restoredAnswers.hook = sessionData.hook_answer;
        if (sessionData.motivation) restoredAnswers.motivation = sessionData.motivation;
        if (sessionData.ai_level) restoredAnswers.ai_level = sessionData.ai_level;
        if (sessionData.path_choice) restoredAnswers.choose_path = sessionData.path_choice;
        if (sessionData.notif_permission) restoredAnswers.notification_opt = sessionData.notif_permission;
        if (sessionData.daily_goal_xp != null) {
          restoredAnswers.daily_goal = String(sessionData.daily_goal_xp);
        }
      }

      const restoredStep = sessionData?.last_step;

      if (!mounted) return;
      setSessionId(existingSessionId);
      setVariant(existingVariant);
      setAnswers(restoredAnswers);
      if (isValidStep(restoredStep)) {
        setStep(restoredStep);
      }
      setReady(true);
    };

    bootstrap().catch(() => {
      if (mounted) setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Cria sessão sob demanda — chamada por saveAnswer/trackEvent na primeira ação
  // Idempotente: chamadas concorrentes compartilham a mesma promessa
  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    if (sessionInsertPromiseRef.current) {
      return sessionInsertPromiseRef.current;
    }

    const newId = newSessionId();
    const utms = captureUTMs();

    sessionInsertPromiseRef.current = (async () => {
      await supabase.from("onboarding_v2_sessions").insert({
        session_id: newId,
        variant: "v2",
        ...utms,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent.slice(0, 500),
      });
      setCookie(SESSION_COOKIE, newId);
      setCookie(VARIANT_COOKIE, "v2");
      setSessionId(newId);
      setVariant("v2");
      return newId;
    })();

    return sessionInsertPromiseRef.current;
  }, [sessionId]);

  // Persiste `step` no DB a cada mudança (fix #15 da auditoria)
  // Só dispara se a sessão JÁ existe — não força criação (fix #3 lazy)
  useEffect(() => {
    if (!ready || !sessionId) return;
    void supabase
      .from("onboarding_v2_sessions")
      .update({ last_step: step })
      .eq("session_id", sessionId);
  }, [ready, sessionId, step]);

  // Auto-mark completed quando entra em "reveal" (fix #18 da auditoria)
  useEffect(() => {
    if (!ready || !sessionId) return;
    if (step !== "reveal" && step !== "signup_deferred") return;
    void supabase
      .from("onboarding_v2_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("session_id", sessionId);
  }, [ready, sessionId, step]);

  // Salva resposta nas colunas dedicadas de onboarding_v2_sessions.
  // Cria sessão lazy se for a primeira ação do usuário (fix #3 auditoria).
  // Retorna true se persistiu com sucesso, false se houve falha.
  // Componente chamador deve checar o retorno antes de avançar (fix PR 2: erros engolidos).
  //
  // BL.2 fechou: deixou de escrever em onboarding_v2_answers (key-value, dropada).
  // Source of truth = colunas dedicadas em onboarding_v2_sessions.
  const saveAnswer = useCallback(
    async (questionId: V2QuestionId, value: string): Promise<boolean> => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));

      try {
        const sid = await ensureSession();

        // Mapeia question_id → coluna em onboarding_v2_sessions
        const sessionUpdate: Record<string, string | number> = {};
        switch (questionId) {
          case "attribution":
            sessionUpdate.attribution = value;
            break;
          case "hook":
            sessionUpdate.hook_answer = value;
            break;
          case "motivation":
            sessionUpdate.motivation = value;
            break;
          case "ai_level":
            sessionUpdate.ai_level = value;
            break;
          case "choose_path":
            sessionUpdate.path_choice = value;
            break;
          case "notification_opt":
            sessionUpdate.notif_permission = value;
            break;
          case "daily_goal": {
            const goalXp = parseInt(value, 10);
            if (!Number.isNaN(goalXp)) sessionUpdate.daily_goal_xp = goalXp;
            break;
          }
        }
        if (Object.keys(sessionUpdate).length > 0) {
          const sessionRes = await supabase
            .from("onboarding_v2_sessions")
            .update(sessionUpdate)
            .eq("session_id", sid);
          if (sessionRes.error) throw sessionRes.error;
        }

        return true;
      } catch (err) {
        console.error("[onboarding-v2] saveAnswer failed", { questionId, err });
        toast.error("Não consegui salvar sua resposta. Tente de novo.");
        return false;
      }
    },
    [ensureSession],
  );

  // Tracking de eventos (analytics caseiro)
  // Também cria sessão lazy se for a primeira ação (fix #3 auditoria)
  const trackEvent = useCallback(
    async (eventName: string, eventData?: Record<string, unknown>) => {
      const sid = await ensureSession();
      await supabase.from("onboarding_v2_events").insert({
        session_id: sid,
        variant,
        event_name: eventName,
        event_data: (eventData as never) ?? null,
      });
    },
    [ensureSession, variant],
  );

  // Navegação
  const stepIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);
  const totalSteps = STEP_ORDER.length;
  // Lookup por step (não cálculo linear). null = ocultar barra (Tela 2 e 4).
  const progressPercent = PROGRESS_BY_STEP[step];

  const goNext = useCallback(() => {
    setStep((current) => {
      const idx = STEP_ORDER.indexOf(current);
      return STEP_ORDER[Math.min(idx + 1, totalSteps - 1)];
    });
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setStep((current) => {
      const idx = STEP_ORDER.indexOf(current);
      return STEP_ORDER[Math.max(idx - 1, 0)];
    });
  }, []);

  const goTo = useCallback((target: V2Step) => {
    setStep(target);
  }, []);

  return {
    ready,
    sessionId,
    variant,
    step,
    stepIndex,
    totalSteps,
    progressPercent,
    answers,
    saveAnswer,
    trackEvent,
    goNext,
    goBack,
    goTo,
  };
};
