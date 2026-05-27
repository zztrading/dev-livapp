import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_COOKIE = "yesliv_quiz_session";
const VARIANT_COOKIE = "yesliv_quiz_variant";
const COOKIE_MAX_AGE_DAYS = 30;

export type V2QuestionId =
  | "attribution"
  | "motivation"
  | "ai_level"
  | "daily_goal"
  | "prompt_knowledge"
  | "notification_opt";

export type V2Step =
  | "liv_intro"        // Tela 2
  | "attribution"      // Tela 3
  | "motivation"       // Tela 4
  | "ai_level"         // Tela 5
  | "promise"          // Tela 6
  | "daily_goal"       // Tela 7
  | "notification"     // Tela 8
  | "prompt_knowledge" // Tela 9
  | "mini_experience"  // Tela 10
  | "reveal"           // Tela 11
  | "signup_deferred"; // Tela 12

const STEP_ORDER: V2Step[] = [
  "liv_intro",
  "attribution",
  "motivation",
  "ai_level",
  "promise",
  "daily_goal",
  "notification",
  "prompt_knowledge",
  "mini_experience",
  "reveal",
  "signup_deferred",
];

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
  motivation?: string;
  ai_level?: string;
  daily_goal?: string;
  prompt_knowledge?: string;
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
      const existingSessionId = getCookie(SESSION_COOKIE);
      const existingVariant = (getCookie(VARIANT_COOKIE) as "v1" | "v2" | null) ?? "v2";

      if (!existingSessionId) {
        // Primeira visita: NÃO cria sessão ainda — espera primeira ação real
        if (!mounted) return;
        setReady(true);
        return;
      }

      // Retomada: carrega respostas + step
      const [answersRes, sessionRes] = await Promise.all([
        supabase
          .from("onboarding_v2_answers")
          .select("question_id, answer_value")
          .eq("session_id", existingSessionId),
        supabase
          .from("onboarding_v2_sessions")
          .select("last_step")
          .eq("session_id", existingSessionId)
          .maybeSingle(),
      ]);

      const restoredAnswers: OnboardingV2Answers = {};
      (answersRes.data ?? []).forEach((row) => {
        (restoredAnswers as Record<string, string>)[row.question_id] = row.answer_value;
      });

      const restoredStep = sessionRes.data?.last_step;

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

  // Salva resposta com upsert (idempotente)
  // Cria sessão lazy se for a primeira ação do usuário (fix #3 auditoria)
  const saveAnswer = useCallback(
    async (questionId: V2QuestionId, value: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));

      const sid = await ensureSession();

      await supabase.from("onboarding_v2_answers").upsert(
        {
          session_id: sid,
          question_id: questionId,
          answer_value: value,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "session_id,question_id" },
      );

      // daily_goal também vai pra coluna direta na session pra query analítica
      if (questionId === "daily_goal") {
        const goalXp = parseInt(value, 10);
        if (!Number.isNaN(goalXp)) {
          await supabase
            .from("onboarding_v2_sessions")
            .update({ daily_goal_xp: goalXp })
            .eq("session_id", sid);
        }
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
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

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
