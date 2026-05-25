/**
 * AlertLayout — layout data-driven para `problem-identifier`.
 *
 * Renderiza cada `chapter` como sintoma pulsando em alerta. Halo radial,
 * grid de fundo, badge `!` por linha; pulso boxShadow no item da scene atual.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useSmartScenes } from '../useSmartScenes';
import { resolveIcon, resolveColorScheme, type DataDrivenCardProps } from '../_shared';

interface Props extends DataDrivenCardProps {
  isActive?: boolean;
  duration?: number;
  defaultIconName?: string;
  defaultColorScheme?: string;
}

const AlertLayout: React.FC<Props> = ({
  title,
  subtitle,
  chapters = [],
  icon,
  colorScheme,
  isActive = false,
  duration = 28,
  defaultIconName = 'zap',
  defaultColorScheme = 'orange',
}) => {
  const Icon = resolveIcon(icon ?? defaultIconName);
  const cs = resolveColorScheme(colorScheme ?? defaultColorScheme);

  const totalScenes = chapters.length + 2;
  const { currentScene } = useSmartScenes(totalScenes, duration, isActive);

  return (
    <div className={`relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] flex flex-col items-center overflow-hidden rounded-2xl bg-gradient-to-br ${cs.bgGradient} p-6 sm:p-8`}>
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.18) 0%, transparent 70%)' }}
        animate={currentScene > 0 ? { scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] } : { opacity: 0 }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center mb-6"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
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
          const visible = currentScene >= sceneIndex;
          const isCurrent = currentScene === sceneIndex;
          return (
            <motion.div
              key={`${chapter}-${i}`}
              initial={{ opacity: 0, x: -40 }}
              animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
              transition={{ duration: 0.5 }}
              className={`relative flex items-center gap-3 ${cs.chapterBg} border ${cs.chapterBorder} px-4 py-3 rounded-xl backdrop-blur-sm`}
              style={isCurrent ? { boxShadow: '0 0 22px rgba(239,68,68,0.35)' } : undefined}
            >
              <motion.div
                animate={visible ? { scale: [1, 1.15, 1] } : { scale: 0 }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className={`flex-shrink-0 w-9 h-9 rounded-full ${cs.iconBg} ${cs.iconColor} flex items-center justify-center`}
              >
                <AlertTriangle className="w-4 h-4" />
              </motion.div>
              <span className="text-white text-sm sm:text-base font-medium leading-snug">{chapter}</span>
              <span className={`ml-auto text-[10px] uppercase tracking-wider ${cs.subtitleColor} opacity-60`}>
                #{i + 1}
              </span>
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

export default AlertLayout;
