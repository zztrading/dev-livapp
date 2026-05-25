/**
 * CalculatorLayout — layout data-driven para `profit-calculator`.
 *
 * Linhas de extrato com símbolos crescentes e total `R$ N` contando.
 * Os números são simbólicos — quem fala é a narração.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useSmartScenes } from '../useSmartScenes';
import { resolveIcon, resolveColorScheme, type DataDrivenCardProps } from '../_shared';

interface Props extends DataDrivenCardProps {
  isActive?: boolean;
  duration?: number;
  defaultIconName?: string;
  defaultColorScheme?: string;
}

const CalculatorLayout: React.FC<Props> = ({
  title,
  subtitle,
  chapters = [],
  icon,
  colorScheme,
  isActive = false,
  duration = 28,
  defaultIconName = 'star',
  defaultColorScheme = 'gold',
}) => {
  const Icon = resolveIcon(icon ?? defaultIconName);
  const cs = resolveColorScheme(colorScheme ?? defaultColorScheme);

  const totalScenes = chapters.length + 2;
  const { currentScene } = useSmartScenes(totalScenes, duration, isActive);

  const [total, setTotal] = useState(0);
  useEffect(() => {
    const target = Math.min(currentScene, chapters.length);
    let raf = 0;
    const start = performance.now();
    const from = total;
    const to = target * 1000;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      setTotal(Math.round(from + (to - from) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, chapters.length]);

  return (
    <div className={`relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] flex flex-col items-center overflow-hidden rounded-2xl bg-gradient-to-br ${cs.bgGradient} p-6 sm:p-8`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center mb-5"
      >
        <motion.div
          animate={{ rotate: [0, 6, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${cs.iconBg} flex items-center justify-center mb-3`}
        >
          <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${cs.iconColor}`} />
        </motion.div>
        {title && <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 leading-tight">{title}</h2>}
        {subtitle && <p className={`text-sm sm:text-base ${cs.subtitleColor} max-w-md`}>{subtitle}</p>}
      </motion.div>

      <div className={`relative z-10 w-full max-w-md ${cs.chapterBg} border ${cs.chapterBorder} rounded-2xl backdrop-blur-sm overflow-hidden`}>
        {chapters.map((chapter, i) => {
          const sceneIndex = i + 1;
          const visible = currentScene >= sceneIndex;
          return (
            <motion.div
              key={`${chapter}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0.25, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`flex items-center justify-between px-4 py-3 ${
                i < chapters.length - 1 ? `border-b ${cs.chapterBorder}` : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full ${cs.iconBg} ${cs.iconColor} flex items-center justify-center text-xs font-bold`}>
                  {i + 1}
                </span>
                <span className="text-white text-sm sm:text-base font-medium truncate">{chapter}</span>
              </div>
              <motion.span
                key={visible ? 'on' : 'off'}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: visible ? 1 : 0.3 }}
                className={`text-sm sm:text-base font-mono font-semibold ${cs.iconColor}`}
              >
                {visible ? '+++' : '...'}
              </motion.span>
            </motion.div>
          );
        })}

        <div className={`flex items-center justify-between px-4 py-3 bg-white/5 border-t ${cs.chapterBorder}`}>
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${cs.iconColor}`} />
            <span className="text-white text-sm font-semibold uppercase tracking-wider">Total</span>
          </div>
          <motion.span
            className={`text-lg sm:text-xl font-bold ${cs.iconColor}`}
            animate={{
              textShadow: [
                '0 0 0 rgba(255,255,255,0)',
                '0 0 12px rgba(255,255,255,0.4)',
                '0 0 0 rgba(255,255,255,0)',
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            R$ {total.toLocaleString('pt-BR')}
          </motion.span>
        </div>
      </div>

      <div className="relative z-10 flex gap-1.5 mt-auto pt-6">
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

export default CalculatorLayout;
