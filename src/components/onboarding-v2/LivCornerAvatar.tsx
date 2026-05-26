import { motion } from "framer-motion";

/**
 * LIV pequena no canto, presença sutil nas telas de pergunta (3-9).
 * Imagem ESTÁTICA — sem vídeo em loop pra não distrair durante a leitura.
 * Halo pulsante leve + sombra macia indigo pra dar vida sem agitar.
 */
export const LivCornerAvatar = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    className="relative flex-shrink-0"
    aria-hidden="true"
  >
    {/* Halo pulsante atrás do avatar — respiração lenta */}
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.08, 1] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -inset-1.5 rounded-full bg-indigo-400/40 blur-xl pointer-events-none"
    />
    {/* Avatar com sombra macia */}
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-white/80 bg-gradient-to-br from-indigo-100 to-violet-100 shadow-[0_8px_24px_-8px_rgba(99,102,241,0.5),0_0_0_1px_rgba(139,92,246,0.15)]">
      <img
        src="/liv-wizard.jpg"
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover rounded-full"
      />
    </div>
  </motion.div>
);
