/**
 * Tela 13 do Onboarding V2 — Cadastro Deferred (FASE 3).
 *
 * Spec onboarding v2 (linhas 1050-1099). 2 caminhos:
 *
 *  CRIAR UM PERFIL → form inline (email + senha + Google)
 *    - Cria conta no auth.users
 *    - Linka session anônima ao user via RPC link_onboarding_v2_to_user
 *      (popula users.* com dados do wizard + ganhos do desafio)
 *    - Limpa sessionStorage
 *    - Vai pra /dashboard
 *
 *  DEPOIS → cookie 7 dias + redirect
 *    - Chama setDeferredToken(sessionId) — Edge Function salva cookie HttpOnly
 *    - Vai pra /landing (visitante)
 *    - Se voltar em <7 dias com cookie, redeemDeferredToken() retoma sessão
 */
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setDeferredToken } from "@/lib/onboardingV2Deferred";

interface SignupDeferredScreenProps {
  sessionId: string | null;
}

type Mode = "choice" | "form";
type ChoicePhase = "idle" | "leaving" | "prepping";

const PREPPING_SAFETY_TIMEOUT_MS = 3500;

export const SignupDeferredScreen = ({ sessionId }: SignupDeferredScreenProps) => {
  const [mode, setMode] = useState<Mode>("choice");
  const [navigating, setNavigating] = useState<"signup" | "later" | "google" | null>(
    null,
  );

  // Fluxo de vídeos da Liv no mode "choice":
  // - idle: Liv topa em loop (joia)
  // - leaving: usuário clicou "Depois" → fade-out rápido + segue
  // - prepping: usuário clicou "Criar um perfil" → Liv super (comemoração 1x)
  //   + "Boa! Abrindo seu cadastro..." → onEnded → setMode("form")
  const [phase, setPhase] = useState<ChoicePhase>("idle");
  const preppingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formTransitionedRef = useRef(false);

  const goToForm = useCallback(() => {
    if (formTransitionedRef.current) return;
    formTransitionedRef.current = true;
    if (preppingTimerRef.current) {
      clearTimeout(preppingTimerRef.current);
      preppingTimerRef.current = null;
    }
    setMode("form");
  }, []);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);

  /**
   * Signup inline → cria user → linka sessão anônima → /dashboard.
   * RPC link_onboarding_v2_to_user popula users.* com dados do wizard + ganhos do desafio.
   */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (navigating) return;

    if (password.length < 8) {
      toast.error("A senha precisa ter no mínimo 8 caracteres.");
      return;
    }

    setNavigating("signup");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          toast.error("Email já cadastrado. Faça login ou use outro.");
        } else {
          toast.error(error.message || "Erro ao criar conta. Tente de novo.");
        }
        setNavigating(null);
        return;
      }

      // Caso 1: signup retorna session (auto-login) → linka + redireciona
      if (data.session && sessionId) {
        // RPC popula users.* com dados do wizard + ganhos do desafio.
        // Se falhar, NÃO redireciona — aluno entraria no dashboard sem XP/Sparks/Vidas.
        // Tenta 1 retry; se persistir, mostra erro e mantém na tela pra retry manual (F5).
        let linkOk = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const { error: linkErr } = await supabase.rpc("link_onboarding_v2_to_user", {
              p_session_id: sessionId,
              p_user_id: data.session.user.id,
            });
            if (!linkErr) {
              linkOk = true;
              break;
            }
            console.warn(`[SignupDeferred] link RPC attempt ${attempt} failed`, linkErr);
          } catch (linkErr) {
            console.warn(`[SignupDeferred] link RPC attempt ${attempt} threw`, linkErr);
          }
        }

        if (!linkOk) {
          toast.error(
            "Conta criada, mas tivemos um problema ao salvar seu progresso. Recarregue a página e tente entrar.",
            { duration: 8000 },
          );
          setNavigating(null);
          return;
        }

        // Limpa cookie da sessão anônima — usuário agora é autenticado
        document.cookie = "yesliv_quiz_session=; max-age=0; path=/";
        document.cookie = "yesliv_quiz_variant=; max-age=0; path=/";

        toast.success("Conta criada! Bora começar.");
        window.location.href = "/dashboard";
        return;
      }

      // Caso 2: signup retorna sem session (Supabase exige confirmação por email)
      // Aluno precisa confirmar antes de logar — link acontecerá no Auth.tsx via from=quiz.
      toast.success("Conta criada! Confira seu email pra confirmar.");
      setNavigating(null);
    } catch (err) {
      console.error("[SignupDeferred] signup error", err);
      toast.error("Erro inesperado. Tente de novo.");
      setNavigating(null);
    }
  };

  /**
   * Google OAuth — Supabase redireciona pro Google e volta. O link
   * com a sessão anônima precisa rodar no callback (fora do escopo deste PR
   * — fica no Auth.tsx que já tem essa lógica via from=quiz).
   */
  const handleGoogle = useCallback(async () => {
    if (navigating) return;
    setNavigating("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Após OAuth, volta pro Auth.tsx que detecta `from=quiz` e linka session
          redirectTo: `${window.location.origin}/auth?from=quiz`,
        },
      });
      if (error) {
        toast.error("Erro ao iniciar login com Google.");
        setNavigating(null);
      }
    } catch (err) {
      console.error("[SignupDeferred] google error", err);
      toast.error("Erro inesperado.");
      setNavigating(null);
    }
  }, [navigating]);

  /**
   * DEPOIS → fade-out rápido da Liv + salva deferred token + redirect.
   */
  const handleLater = useCallback(async () => {
    if (navigating || phase !== "idle") return;
    setNavigating("later");
    setPhase("leaving");
    if (sessionId) {
      const ok = await setDeferredToken(sessionId);
      if (!ok) {
        // Falha silenciosa — segue mesmo sem token (aluno pode voltar via session_id no cookie comum)
        console.warn("[SignupDeferred] setDeferredToken failed");
      }
    }
    window.location.href = "/landing/index.html";
  }, [navigating, phase, sessionId]);

  /**
   * CRIAR UM PERFIL → troca pra Liv super (comemoração 1x) + "Abrindo cadastro..."
   * onEnded do vídeo aciona setMode("form"). Safety timeout 3.5s caso falhe.
   */
  const handleStartSignup = useCallback(() => {
    if (navigating || phase !== "idle") return;
    formTransitionedRef.current = false;
    setPhase("prepping");
    preppingTimerRef.current = setTimeout(goToForm, PREPPING_SAFETY_TIMEOUT_MS);
  }, [navigating, phase, goToForm]);

  // ──────────────────────────────────────────────────────────────────
  // MODE: choice (initial) — Liv topa em loop → super (1x) → form
  // ──────────────────────────────────────────────────────────────────
  if (mode === "choice") {
    const isPrepping = phase === "prepping";
    const isLeaving = phase === "leaving";
    const livVisible = !isLeaving; // só some quando user clica "Depois"
    const ctasDisabled = navigating !== null || phase !== "idle";

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen flex flex-col px-5 sm:px-6 pt-12 pb-10"
      >
        <div className="max-w-md w-full mx-auto flex flex-col items-center text-center flex-1 justify-center gap-6">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
              Salve o que você fez.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed max-w-xs mx-auto">
              Pra continuar de onde parou, no seu tempo.
            </p>
          </motion.div>

          {/* Liv — topa (loop) → super (1x) */}
          <AnimatePresence>
            {livVisible && (
              <motion.div
                key={isPrepping ? "liv-super" : "liv-topa"}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={
                  isPrepping
                    ? {
                        scale: 0.5,
                        opacity: 0,
                        y: -8,
                        filter: "blur(8px)",
                        transition: { duration: 0.9, ease: [0.25, 0.1, 0.25, 1] },
                      }
                    : { opacity: 0, transition: { duration: 0.2 } }
                }
                transition={{
                  delay: 0.35,
                  duration: 0.5,
                  type: "spring",
                  stiffness: 150,
                }}
                className="relative w-32 h-32 rounded-full overflow-hidden border-[3px] border-white bg-gradient-to-br from-indigo-100 to-violet-100 shadow-[0_15px_35px_-10px_rgba(99,102,241,0.4)]"
              >
                <motion.span
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.5, 0], scale: [1, 1.3, 1.5] }}
                  transition={{
                    delay: 0.7,
                    duration: 1.6,
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 1.5,
                  }}
                  className="absolute inset-0 rounded-full bg-indigo-500/40 blur-2xl"
                />
                {isPrepping ? (
                  <video
                    key="super"
                    src="/liv-super.mp4"
                    poster="/liv-super-poster.jpg"
                    autoPlay
                    muted
                    playsInline
                    preload="auto"
                    aria-hidden="true"
                    onEnded={goToForm}
                    className="relative w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <video
                    key="topa"
                    src="/liv-topa.mp4"
                    poster="/liv-topa-poster.jpg"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    aria-hidden="true"
                    className="relative w-full h-full object-cover rounded-full"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Texto de transição quando prepping — com dots animados */}
          <AnimatePresence>
            {isPrepping && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center gap-1.5 text-base font-semibold text-indigo-600"
                role="status"
                aria-live="polite"
              >
                <span>Boa! Abrindo seu cadastro</span>
                <span className="inline-flex gap-[3px]" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeInOut",
                      }}
                      className="inline-block w-[5px] h-[5px] rounded-full bg-indigo-600"
                    />
                  ))}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTAs no rodapé — escondidos durante prepping */}
        <AnimatePresence>
          {!isPrepping && (
            <motion.div
              key="ctas"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="max-w-md w-full mx-auto flex flex-col gap-3"
            >
              <motion.button
                type="button"
                onClick={handleStartSignup}
                disabled={ctasDisabled}
                whileTap={!ctasDisabled ? { scale: 0.97 } : undefined}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-[0_10px_25px_-10px_rgba(99,102,241,0.45)] hover:shadow-[0_15px_35px_-10px_rgba(99,102,241,0.6)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <Sparkles className="w-5 h-5" />
                Criar um perfil
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              <button
                type="button"
                onClick={handleLater}
                disabled={ctasDisabled}
                className="w-full py-3 rounded-2xl text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                {navigating === "later" ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Voltando…
                  </span>
                ) : (
                  "Depois"
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // MODE: form (signup inline)
  // ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-6 pb-10"
    >
      <div className="max-w-md w-full mx-auto flex flex-col flex-1">
        <button
          type="button"
          onClick={() => setMode("choice")}
          disabled={navigating !== null}
          className="self-start -ml-2 p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="mt-6 mb-8">
          <h1 className="text-2xl font-bold text-slate-900 leading-snug">
            Crie sua conta
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Seu progresso e recompensas ficam salvos.
          </p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="signup-email"
              className="text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={navigating !== null}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-colors disabled:opacity-60"
            />
          </div>

          {/* Senha */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="signup-password"
              className="text-sm font-medium text-slate-700"
            >
              Senha
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={navigating !== null}
                className="w-full px-4 py-3 pr-10 rounded-xl border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">Mínimo de 8 caracteres</p>
          </div>

          {/* Manter conectado */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepConnected}
              onChange={(e) => setKeepConnected(e.target.checked)}
              disabled={navigating !== null}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
            />
            <span className="text-sm text-slate-700">Manter conectado</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={navigating !== null}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 mt-2"
          >
            {navigating === "signup" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Criar conta
              </>
            )}
          </button>
        </form>

        {/* Divisor */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            ou
          </span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={navigating !== null}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {navigating === "google" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {navigating === "google" ? "Conectando..." : "Continuar com Google"}
        </button>

        <AnimatePresence>
          {import.meta.env.DEV && sessionId && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-slate-300 text-center font-mono mt-6"
            >
              session: {sessionId.slice(0, 8)}...
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
    />
    <path
      fill="#FF3D00"
      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
    />
    <path
      fill="#1976D2"
      d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
    />
  </svg>
);
