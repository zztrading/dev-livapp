/**
 * FlowLayout — layout data-driven para `automation`.
 *
 * Nós verticais ligados por setas que se desenham. Ao final, badge "Fluxo ativo".
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

const FlowLayout: React.FC<Props> = ({
  title,
  subtitle,
  chapters = [],
  icon,
  colorScheme,
  isActive = false,
  duration = 28,
  defaultIconName = 'rocket',
  defaultColorScheme = 'green',
}) => {
  const Icon = resolveIcon(icon ?? defaultIconName);
  const cs = resolveColorScheme(colorScheme ?? defaultColorScheme);

  const totalScenes = chapters.length + 2;
  const { currentScene } = useSmartScenes(totalScenes, duration, isActive);
  const allRevealed = currentScene >= chapters.length + 1;

  return (
    <div className={`relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] flex flex-col items-center overflow-hidden rounded-2xl bg-gradient-to-br ${cs.bgGradient} p-6 sm:p-8`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center mb-6"
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${cs.iconBg} flex items-center justify-center mb-4`}
        >
          <Icon className={`w-10 h-10 sm:w-12 sm:h-12 ${cs.iconColor}`} />
        </motion.div>
        {title && <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1.5 leading-tight">{title}</h2>}
        {subtitle && <p className={`text-sm sm:text-base ${cs.subtitleColor} max-w-md`}>{subtitle}</p>}
      </motion.div>

      <div className="relative z-10 flex flex-col items-center gap-2 w-full max-w-md flex-1">
        {chapters.map((chapter, i) => {
          const sceneIndex = i + 1;
          const visible = currentScene >= sceneIndex;
          const arrowVisible = currentScene >= sceneIndex + 1;
          return (
            <React.Fragment key={`${chapter}-${i}`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.45, type: 'spring' }}
                className={`flex items-center gap-3 ${cs.chapterBg} border ${cs.chapterBorder} px-4 py-3 rounded-xl backdrop-blur-sm w-full`}
              >
                <span className={`flex-shrink-0 w-8 h-8 rounded-full ${cs.iconBg} ${cs.iconColor} flex items-center justify-center text-sm font-bold`}>
                  {i + 1}
                </span>
                <span className="text-white text-sm sm:text-base font-medium leading-snug flex-1">{chapter}</span>
                {visible && (
                  <motion.span
                    className={`w-2 h-2 rounded-full ${cs.progressActive}`}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {i < chapters.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={arrowVisible ? { opacity: 1, scaleY: 1 } : { opacity: 0.15, scaleY: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ originY: 0 }}
                  className="flex flex-col items-center"
                >
                  <ArrowRight className={`w-4 h-4 ${cs.iconColor} rotate-90`} />
                </motion.div>
              )}
            </React.Fragment>
          );
        })}

        {allRevealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring' }}
            className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full ${cs.chapterBg} border ${cs.chapterBorder}`}
          >
            <motion.span
              className={`w-2 h-2 rounded-full ${cs.progressActive}`}
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className={`text-xs sm:text-sm font-semibold ${cs.iconColor}`}>Fluxo ativo</span>
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

export default FlowLayout;
