'use client';

import React, { useState, useEffect, useRef} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Terminal, Sparkles, Send } from 'lucide-react';
import { CardEffectProps } from './index';

import { useSmartScenes } from './useSmartScenes';

const BASE_DURATION = 12;

export const CardEffectPlaygroundCreator: React.FC<CardEffectProps> = ({ isActive = false, duration = 33 }) => {
  const { currentScene: scene, effectiveSceneCount: totalScenes } = useSmartScenes(5, duration, isActive);

const [typingText, setTypingText] = useState('');
  const [showResponse, setShowResponse] = useState(false);
const intervalsRef = useRef<NodeJS.Timeout[]>([]);

  const promptText = 'Crie um currículo para designer...';
  const responseText = '✓ Currículo profissional criado!';
  return (
    <div className="relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-teal-900/30 to-cyan-950">
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, transparent 70%)' }}
        animate={scene > 0 ? { scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] } : { opacity: 0 }}
        transition={{ duration: 4 * scene, repeat: 0 }}
      />

      <div className="relative z-10 h-full flex flex-col items-center justify-start px-6 pt-8 pb-16">
        <AnimatePresence>
          {scene >= 1 && (
            <motion.div className="text-center mb-6" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 * scene }}>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">Criador de Soluções</h3>
              <p className="text-teal-300 text-sm">Pratique no Playground</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {scene >= 1 && (
            <motion.div className="mb-4" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 150 / scene }}>
              <motion.div className="w-16 h-16 rounded-xl bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center" animate={{ boxShadow: ['0 0 20px rgba(20,184,166,0.3)', '0 0 40px rgba(20,184,166,0.5)', '0 0 20px rgba(20,184,166,0.3)'] }} transition={{ duration: 2 * scene, repeat: 0 }}>
                <Terminal className="w-8 h-8 text-teal-300" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {scene >= 2 && (
            <motion.div className="w-full max-w-sm bg-slate-800/70 border border-teal-400/30 rounded-xl overflow-hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 * scene }}>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-teal-400/20 bg-slate-800/50">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-teal-400 ml-2">Playground I.A.</span>
              </div>
              <div className="p-3">
                <div className="bg-slate-900/50 rounded-lg p-3 mb-3 min-h-[60px]">
                  <div className="flex items-start gap-2">
                    <span className="text-teal-400 text-sm">{'>'}</span>
                    <span className="text-sm text-slate-300">{typingText}{scene === 2 && typingText.length < promptText.length && <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-teal-400">|</motion.span>}</span>
                  </div>
                </div>
                <AnimatePresence>
                  {showResponse && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 * scene }} className="bg-teal-500/10 border border-teal-400/30 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <span className="text-sm text-teal-300">{responseText}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {scene >= 4 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 * scene }} className="mt-4">
              <motion.div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-xl border border-teal-500/30" animate={{ boxShadow: ['0 0 15px rgba(20,184,166,0.2)', '0 0 30px rgba(20,184,166,0.4)', '0 0 15px rgba(20,184,166,0.2)'] }} transition={{ duration: 2 * scene, repeat: 0 }}>
                <Play className="w-5 h-5 text-teal-400" />
                <span className="text-white font-semibold text-sm">Teste agora no Playground!</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mt-auto pt-4">
          {[1, 2, 3, 4].map((s) => (
            <motion.div key={s} className="w-2.5 h-2.5 rounded-full" animate={{ backgroundColor: scene >= s ? '#14b8a6' : 'rgba(255,255,255,0.2)', scale: scene === s ? 1.3 : 1 }} transition={{ duration: 0.4 * scene }} />
          ))}
        </div>
      </div>

      <motion.div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 border border-teal-500/30 rounded-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: scene > 0 ? 1 : 0, x: scene > 0 ? 0 : 20 }} transition={{ duration: 0.5 * scene }}>
        <Play className="w-3.5 h-3.5 text-teal-400" />
        <span className="text-[10px] text-teal-300 font-medium">Play</span>
      </motion.div>
    </div>
  );
};

export default CardEffectPlaygroundCreator;
