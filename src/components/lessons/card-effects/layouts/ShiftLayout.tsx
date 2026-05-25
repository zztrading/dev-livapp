/**
 * ShiftLayout — layout data-driven para `strategic-shift`.
 *
 * Renderiza cada `chapter` como uma transição "antes(cinza) → depois(glow)".
 * Lê props canônicas de DataDrivenCardProps (_shared.ts).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useSmartScenes } from '../useSmartScenes';
import { resolveIcon, resolveColorScheme, type DataDrivenCardProps } from '../_shared';

interface Props extends DataDrivenCardProps {
  isActive?: boolean;
  duration?: number;
  defaultIconName?: string;
  defaultColorScheme?: string;
}

const ShiftLayout: React.FC<Props> = ({
  title,
  subtitle,
  chapters = [],
  icon,
  colorScheme,
  isActive = false,
  duration = 28,
  defaultIconName = 'sparkles',
  defaultColorScheme = 'purple',
}) => {
  const Icon = resolveIcon(icon ?? defaultIconName);
  const cs = resolveColorScheme(colorScheme ?? defaultColorScheme);

  const totalScenes = chapters.length + 2;
  const { currentScene } = useSmartScenes(totalScenes, duration, isActive);

  return (
    <div className={`relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] flex flex-col items-center overflow-hidden rounded-2xl bg-gradient-to-br ${cs.bgGradient} p-6 sm:p-8`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center mb-6"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${cs.iconBg} flex items-center justify-center mb-4`}
        >
          <Icon className={`w-10 h-10 sm:w-12 sm:h-12 ${cs.iconColor}`} />
        </motion.div>
        {title && <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1.5 leading-tight">{title}</h2>}
        {subtitle && <p className={`text-sm sm:text-base ${cs.subtitleColor} max-w-md`}>{subtitle}</p>}
      </motion.div>

      <div className="relative z-10 flex flex-col gap-3 w-full max-w-md flex-1">
        {chapters.map((chapter, i) => {
          const sceneIndex = i + 1;
          const revealed = currentScene >= sceneIndex;
          return (
            <motion.div
              key={`${chapter}-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2"
            >
              <div className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
                <p className="text-white/40 text-xs sm:text-sm text-center line-through decoration-white/30">Sem direção</p>
              </div>
              <motion.div
                animate={revealed ? { x: [0, 4, 0] } : {}}
                transition={{ duration: 0.8, repeat: revealed ? Infinity : 0 }}
                className="flex-shrink-0"
              >
                <ArrowRight className={`w-4 h-4 sm:w-5 sm:h-5 ${cs.iconColor}`} />
              </motion.div>
              <motion.div
                animate={
                  revealed
                    ? {
                        opacity: 1,
                        scale: 1,
                        boxShadow: [
                          '0 0 0 rgba(255,255,255,0)',
                          '0 0 18px rgba(255,255,255,0.25)',
                          '0 0 0 rgba(255,255,255,0)',
                        ],
                      }
                    : { opacity: 0.3, scale: 0.97 }
                }
                transition={{ duration: 0.5, boxShadow: { duration: 2, repeat: Infinity } }}
                className={`flex-1 flex items-center gap-2 ${cs.chapterBg} border ${cs.chapterBorder} px-3 py-2.5 rounded-lg backdrop-blur-sm`}
              >
                <span className={`flex-shrink-0 w-6 h-6 rounded-full ${cs.iconBg} ${cs.iconColor} flex items-center justify-center text-xs font-bold`}>
                  {i + 1}
                </span>
                <span className="text-white text-xs sm:text-sm font-medium leading-snug">{chapter}</span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      <div className="relative z-10 flex gap-1.5 mt-6">
        {Array.from({ length: totalScenes }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= currentScene ? `w-6 ${cs.progressActive}` : `w-1.5 ${cs.progressInactive}`
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default ShiftLayout;
