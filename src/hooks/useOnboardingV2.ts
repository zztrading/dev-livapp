import { useCallback, useEffect, useMemo, useState } from "react";
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
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=lax`;
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
 * - Expõe state machine de telas + answers
 */
export const useOnboardingV2 = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [variant, setVariant] = useState<"v1" | "v2">("v2");
  const [step, setStep] = useState<V2Step>("liv_intro");
  const [answers, setAnswers] = useState<OnboardingV2Answers>({});
  const [ready, setReady] = useState(false);

  // Bootstrap session na primeira renderização
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const existingSessionId = getCookie(SESSION_COOKIE);
      const existingVariant = (getCookie(VARIANT_COOKIE) as "v1" | "v2" | null) ?? "v2";

      if (existingSessionId) {
        // Retomada: carregar respostas já salvas
        const { data } = await (supabase as any)
          .from("onboarding_v2_answers")
          .select("question_id, answer_value")
          .eq("session_id", existingSessionId);

        const restoredAnswers: OnboardingV2Answers = {};
        (data ?? []).forEach((row: { question_id: string; answer_value: string }) => {
          (restoredAnswers as Record<string, string>)[row.question_id] = row.answer_value;
        });

        if (!mounted) return;
        setSessionId(existingSessionId);
        setVariant(existingVariant);
        setAnswers(restoredAnswers);
        setReady(true);
        return;
      }

      // Primeira visita: cria sessão
      const newId = newSessionId();
      const utms = captureUTMs();

      await (supabase as any).from("onboarding_v2_sessions").insert({
        session_id: newId,
        variant: "v2",
        ...utms,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent.slice(0, 500),
      });

      setCookie(SESSION_COOKIE, newId);
      setCookie(VARIANT_COOKIE, "v2");

      if (!mounted) return;
      setSessionId(newId);
      setVariant("v2");
      setReady(true);
    };

    bootstrap().catch(() => {
      // Falha silenciosa — sessão fica só no client; flow continua
      if (mounted) setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Salva resposta com upsert (idempotente)
  const saveAnswer = useCallback(
    async (questionId: V2QuestionId, value: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));

      if (!sessionId) return;

      await (supabase as any)
        .from("onboarding_v2_answers")
        .upsert(
          {
            session_id: sessionId,
            question_id: questionId,
            answer_value: value,
            answered_at: new Date().toISOString(),
          },
          { onConflict: "session_id,question_id" }
        );

      // daily_goal também é coluna direta na session pra query rápida
      if (questionId === "daily_goal") {
        await (supabase as any)
          .from("onboarding_v2_sessions")
          .update({ daily_goal_xp: parseInt(value, 10) })
          .eq("session_id", sessionId);
      }
    },
    [sessionId]
  );

  // Tracking de eventos (analytics caseiro)
  const trackEvent = useCallback(
    async (eventName: string, eventData?: Record<string, unknown>) => {
      if (!sessionId) return;
      await (supabase as any).from("onboarding_v2_events").insert({
        session_id: sessionId,
        variant,
        event_name: eventName,
        event_data: eventData ?? null,
      });
    },
    [sessionId, variant]
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

  const markCompleted = useCallback(async () => {
    if (!sessionId) return;
    await (supabase as any)
      .from("onboarding_v2_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("session_id", sessionId);
  }, [sessionId]);

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
    markCompleted,
  };
};
