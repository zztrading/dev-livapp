/**
 * ChecklistLayout — layout data-driven para `human-check`.
 *
 * Itens com checkbox marcando um a um, selo "Confirmado" ao final.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, ShieldCheck } from 'lucide-react';
import { useSmartScenes } from '../useSmartScenes';
import { resolveIcon, resolveColorScheme, type DataDrivenCardProps } from '../_shared';

interface Props extends DataDrivenCardProps {
  isActive?: boolean;
  duration?: number;
  defaultIconName?: string;
  defaultColorScheme?: string;
}

const ChecklistLayout: React.FC<Props> = ({
  title,
  subtitle,
  chapters = [],
  icon,
  colorScheme,
  isActive = false,
  duration = 28,
  defaultIconName = 'shield-check',
  defaultColorScheme = 'blue',
}) => {
  const Icon = resolveIcon(icon ?? defaultIconName);
  const cs = resolveColorScheme(colorScheme ?? defaultColorScheme);

  const totalScenes = chapters.length + 2;
  const { currentScene } = useSmartScenes(totalScenes, duration, isActive);
  const allChecked = currentScene >= chapters.length + 1;

  return (
    <div className={`relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] flex flex-col items-center overflow-hidden rounded-2xl bg-gradient-to-br ${cs.bgGradient} p-6 sm:p-8`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center mb-6"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
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
          const checked = currentScene >= sceneIndex;
          return (
            <motion.div
              key={`${chapter}-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 ${cs.chapterBg} border ${cs.chapterBorder} px-4 py-3 rounded-xl backdrop-blur-sm`}
            >
              <motion.div
                animate={
                  checked
                    ? { scale: [1, 1.2, 1], backgroundColor: 'rgba(255,255,255,0.18)' }
                    : { scale: 1 }
                }
                transition={{ duration: 0.4 }}
                className={`relative flex-shrink-0 w-7 h-7 rounded-md border-2 ${
                  checked ? cs.chapterBorder : 'border-white/25'
                } flex items-center justify-center`}
              >
                {checked && (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260 }}
                  >
                    <Check className={`w-4 h-4 ${cs.iconColor}`} strokeWidth={3} />
                  </motion.div>
                )}
              </motion.div>
              <span
                className={`text-sm sm:text-base font-medium leading-snug flex-1 ${
                  checked ? 'text-white' : 'text-white/50'
                }`}
              >
                {chapter}
              </span>
              <span className={`text-[10px] uppercase tracking-wider ${checked ? cs.iconColor : 'text-white/30'}`}>
                {checked ? 'OK' : '...'}
              </span>
            </motion.div>
          );
        })}

        {allChecked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{
              opacity: 1,
              scale: 1,
              boxShadow: [
                '0 0 0 rgba(255,255,255,0)',
                '0 0 24px rgba(255,255,255,0.3)',
                '0 0 0 rgba(255,255,255,0)',
              ],
            }}
            transition={{ duration: 0.5, type: 'spring', boxShadow: { duration: 2, repeat: Infinity } }}
            className={`mt-2 self-center inline-flex items-center gap-2 px-4 py-2 rounded-full ${cs.chapterBg} border ${cs.chapterBorder}`}
          >
            <ShieldCheck className={`w-4 h-4 ${cs.iconColor}`} />
            <span className={`text-xs sm:text-sm font-semibold ${cs.iconColor}`}>Confirmado</span>
          </motion.div>
        )}
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

export default ChecklistLayout;
