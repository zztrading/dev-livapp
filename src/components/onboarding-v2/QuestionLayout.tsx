import { ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface QuestionLayoutProps {
  question: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
}

/**
 * Layout comum das telas de pergunta (Tela 3 em diante).
 * - Header com botão Voltar + progress (que já vem do Flow)
 * - Pergunta em destaque
 * - Subtítulo opcional
 * - Conteúdo (opções) abaixo
 */
export const QuestionLayout = ({
  question,
  subtitle,
  onBack,
  children,
}: QuestionLayoutProps) => {
  // Foco na pergunta ao montar — leitor de tela anuncia a nova etapa (a11y)
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [question]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-6 pb-10"
    >
      {/* Header: voltar */}
      <div className="flex items-center mb-8 max-w-md w-full mx-auto">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </div>

      {/* Pergunta */}
      <div className="max-w-md w-full mx-auto mb-6">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug focus:outline-none"
        >
          {question}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-2">{subtitle}</p>
        )}
      </div>

      {/* Opções */}
      <div className="max-w-md w-full mx-auto flex flex-col gap-2.5 flex-1">
        {children}
      </div>
    </motion.div>
  );
};
