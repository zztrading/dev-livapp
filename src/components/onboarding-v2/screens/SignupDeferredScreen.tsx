/**
 * Tela 12 do Onboarding V2 — Cadastro Deferred.
 *
 * Final do quiz pré-signup. Apresenta 2 CTAs:
 *   - CRIAR UM PERFIL → /auth?mode=signup → após signup, Auth.tsx chama
 *     RPC link_onboarding_v2_to_user pra vincular respostas anônimas
 *   - DEPOIS → vai pra landing estática. Sessão fica preservada no cookie
 *     (30 dias) — se voltar em /quiz retoma de onde parou.
 *
 * Não destrói progresso em nenhum cenário.
 */
import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

interface SignupDeferredScreenProps {
  sessionId: string | null;
}

export const SignupDeferredScreen = ({ sessionId }: SignupDeferredScreenProps) => {
  const [navigating, setNavigating] = useState<"signup" | "later" | null>(null);

  const handleCreateProfile = useCallback(() => {
    if (navigating) return;
    setNavigating("signup");
    window.location.href = "/auth?mode=signup&from=quiz";
  }, [navigating]);

  const handleLater = useCallback(() => {
    if (navigating) return;
    setNavigating("later");
    window.location.href = "/landing/index.html";
  }, [navigating]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-12 pb-10"
    >
      <div className="max-w-md w-full mx-auto flex flex-col items-center text-center flex-1 justify-center gap-6">
        {/* Headline + texto (em cima da Liv) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
            Hora de criar seu perfil!
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed max-w-xs mx-auto">
            Crie um perfil pra{" "}
            <span className="font-semibold text-indigo-600">salvar seu progresso</span>{" "}
            e continuar aprendendo grátis.
          </p>
        </motion.div>

        {/* Liv apontando pra baixo (em direção aos CTAs) — reusa o vídeo da Tela 8 */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5, type: "spring", stiffness: 160 }}
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
          <video
            src="/liv-point-down.mp4"
            poster="/liv-point-down-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="relative w-full h-full object-cover rounded-full"
          />
        </motion.div>
      </div>

      {/* CTAs no rodapé (Liv aponta pra cá) */}
      <div className="max-w-md w-full mx-auto flex flex-col gap-3">
        <motion.button
          type="button"
          onClick={handleCreateProfile}
          disabled={navigating !== null}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.35 }}
          whileTap={navigating === null ? { scale: 0.97 } : undefined}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Sparkles className="w-5 h-5" />
          {navigating === "signup" ? "Indo pro cadastro..." : "Criar um perfil"}
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        <motion.button
          type="button"
          onClick={handleLater}
          disabled={navigating !== null}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.3 }}
          className="w-full py-3 rounded-2xl text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {navigating === "later" ? "Voltando..." : "Depois"}
        </motion.button>

        <p className="text-[11px] text-slate-400 text-center leading-relaxed max-w-xs mx-auto mt-2">
          Sem cartão. Seu progresso fica salvo se você criar conta depois — só voltar nesse link.
        </p>

        {import.meta.env.DEV && sessionId && (
          <p className="text-[10px] text-slate-300 text-center font-mono">
            session: {sessionId.slice(0, 8)}...
          </p>
        )}
      </div>
    </motion.div>
  );
};
