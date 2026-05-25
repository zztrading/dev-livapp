/**
 * DataDrivenCard — fallback genérico para card-effects data-driven (V5).
 *
 * Layout neutro (Hero + 3 chapters numerados + barra de progresso) usado
 * apenas como fallback / referência. Os 5 cards data-driven canônicos
 * NÃO usam este componente — cada um tem seu próprio layout especializado
 * em `./layouts/`:
 *
 *   - strategic-shift     → layouts/ShiftLayout.tsx
 *   - problem-identifier  → layouts/AlertLayout.tsx
 *   - profit-calculator   → layouts/CalculatorLayout.tsx
 *   - automation          → layouts/FlowLayout.tsx
 *   - human-check         → layouts/ChecklistLayout.tsx
 *
 * Este arquivo permanece como fallback para tipos data-driven futuros
 * que ainda não tenham um layout próprio. Ver
 * docs/contracts/MODELO-PADRAO-AT.md.
 */


import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSmartScenes } from './useSmartScenes';
import {
  resolveIcon,
  resolveColorScheme,
  type DataDrivenCardProps,
} from './_shared';

interface Props extends DataDrivenCardProps {
  isActive?: boolean;
  duration?: number;
  /** Ícone padrão usado caso `icon` não venha nas props. */
  defaultIconName?: string;
  /** Nome do esquema de cor padrão caso `colorScheme` não venha nas props. */
  defaultColorScheme?: string;
}

const DataDrivenCard: React.FC<Props> = ({
  title,
  subtitle,
  chapters = [],
  icon,
  colorScheme,
  isActive = false,
  duration = 28,
  defaultIconName,
  defaultColorScheme = 'purple',
}) => {
  const Icon = resolveIcon(icon ?? defaultIconName);
  const cs = resolveColorScheme(colorScheme ?? defaultColorScheme);

  // Cada chapter ganha sua scene; +1 para o hero, +1 para encerramento
  const totalScenes = chapters.length + 2;
  const { currentScene } = useSmartScenes(totalScenes, duration, isActive);

  return (
    <div
      className={`relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] flex flex-col items-center justify-start overflow-hidden rounded-2xl bg-gradient-to-br ${cs.bgGradient} p-6 sm:p-10`}
    >
      {/* Halo decorativo */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
        }}
        animate={
          currentScene > 0
            ? { scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }
            : { opacity: 0 }
        }
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* Hero */}
      <AnimatePresence>
        {currentScene >= 0 && (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 flex flex-col items-center text-center mb-6"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${cs.iconBg} flex items-center justify-center mb-5`}
            >
              <Icon className={`w-10 h-10 sm:w-12 sm:h-12 ${cs.iconColor}`} />
            </motion.div>
            {title && (
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className={`text-base sm:text-lg ${cs.subtitleColor} max-w-md`}>
                {subtitle}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chapters empilhados */}
      <div className="relative z-10 flex flex-col gap-3 w-full max-w-md">
        {chapters.map((chapter, i) => {
          const sceneIndex = i + 1; // hero = 0, chapters começam em 1
          const visible = currentScene >= sceneIndex;
          return (
            <motion.div
              key={`${chapter}-${i}`}
              initial={{ opacity: 0, x: 30 }}
              animate={
                visible ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }
              }
              transition={{ duration: 0.5, delay: visible ? 0.1 : 0 }}
              className={`flex items-center gap-3 ${cs.chapterBg} border ${cs.chapterBorder} px-4 py-3 sm:px-5 sm:py-4 rounded-xl backdrop-blur-sm`}
            >
              <span
                className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full ${cs.iconBg} ${cs.iconColor} flex items-center justify-center text-sm font-bold`}
              >
                {i + 1}
              </span>
              <span className="text-white text-sm sm:text-base font-medium leading-snug">
                {chapter}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Indicador de progresso */}
      <div className="relative z-10 flex gap-1.5 mt-auto pt-6">
        {Array.from({ length: totalScenes }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= currentScene
                ? `w-6 ${cs.progressActive}`
                : `w-1.5 ${cs.progressInactive}`
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default DataDrivenCard;
