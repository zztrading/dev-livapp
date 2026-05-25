'use client';

import React, { useEffect} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Calendar, Mail, CheckCircle, User, Zap, TrendingUp, Sparkles, Settings } from 'lucide-react';
import { CardEffectProps } from './index';
import FlowLayout from './layouts/FlowLayout';
import { hasDataDrivenContent, toDataDrivenProps } from './_shared';

import { useSmartScenes } from './useSmartScenes';

const BASE_DURATION = 36;

/**
 * CardEffectAutomation
 *
 * Data-driven quando recebe `props.title + props.chapters[]` (3 passos
 * do fluxo). Caso contrário, fallback para o fluxograma hardcoded original
 * (Lead → Mensagem → Agenda).
 */
export const CardEffectAutomation: React.FC<CardEffectProps> = ({ isActive = false, duration = 33, props }) => {
  if (hasDataDrivenContent(props)) {
    return (
      <FlowLayout
        {...toDataDrivenProps(props)}
        isActive={isActive}
        duration={duration}
        defaultIconName="rocket"
        defaultColorScheme="green"
      />
    );
  }
  return <LegacyAutomation isActive={isActive} duration={duration} />;
};

const LegacyAutomation: React.FC<{ isActive?: boolean; duration?: number }> = ({ isActive = false, duration = 33 }) => {
  const { currentScene: scene, effectiveSceneCount: totalScenes } = useSmartScenes(13, duration, isActive);
  const flowNodes = [
    { id: 1, label: 'Lead', icon: User, color: 'from-blue-500 to-cyan-500' },
    { id: 2, label: 'Mensagem', icon: MessageCircle, color: 'from-purple-500 to-indigo-500' },
    { id: 3, label: 'Qualifica', icon: CheckCircle, color: 'from-pink-500 to-rose-500' },
    { id: 4, label: 'Agenda', icon: Calendar, color: 'from-orange-500 to-amber-500' },
    { id: 5, label: 'Confirma', icon: Mail, color: 'from-green-500 to-emerald-500' },
  ];

  return (
    <div className="relative w-full min-h-[520px] sm:min-h-[600px] h-[70vh] max-h-[700px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30">
      {/* Grid de fundo */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.2) 0%, transparent 50%),
              linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 30px 30px, 30px 30px' }}
        />
      </div>

      <div className="relative z-10 h-full flex flex-col items-center justify-start px-4 sm:px-6 pt-8 pb-16">

        {/* ========== FASE 1: ELEMENTOS EMPILHADOS (Cenas 1-6) ========== */}
        <AnimatePresence>
          {scene >= 1 && scene <= 6 && (
            <motion.div 
              className="flex flex-col items-center gap-4 w-full max-w-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Cena 1: Título */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 * scene }}
              >
                <div className="flex items-center gap-2 justify-center mb-2">
                  <motion.div
                    className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <Settings className="w-5 h-5 text-white" />
                  </motion.div>
                  <span className="text-lg font-bold text-emerald-300">Fluxo de Automação</span>
                </div>
                <p className="text-sm text-slate-400">Processos inteligentes com I.A.</p>
              </motion.div>

              {/* Cena 2-6: Nós do fluxo aparecem */}
              <motion.div
                className="flex flex-wrap justify-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 * scene }}
              >
                {flowNodes.slice(0, Math.min(scene, 5)).map((node, i) => {
                  const Icon = node.icon;
                  return (
                    <motion.div
                      key={node.id}
                      className="relative"
                      initial={{ scale: 0, y: -20 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', delay: i * 0.15 * scene }}
                    >
                      <motion.div
                        className={`px-3 py-2 bg-gradient-to-br ${node.color} rounded-xl shadow-lg flex flex-col items-center gap-1`}
                        animate={scene > node.id ? {
                          boxShadow: ['0 0 0 rgba(16, 185, 129, 0)', '0 0 15px rgba(16, 185, 129, 0.4)', '0 0 0 rgba(16, 185, 129, 0)'] } : {}}
                        transition={{ duration: 1.5, repeat: scene > node.id ? Infinity : 0 }}
                      >
                        <Icon className="w-4 h-4 text-white" />
                        <span className="text-[9px] text-white font-medium">{node.label}</span>
                      </motion.div>
                      
                      {/* Seta conectora */}
                      {i < Math.min(scene, 5) - 1 && (
                        <motion.div
                          className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-emerald-500"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.3 * scene, delay: 0.3 * scene }}
                          style={{ originX: 0 }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Cena 6: Status */}
              {scene >= 6 && (
                <motion.div
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                >
                  <motion.div
                    className="w-2 h-2 bg-emerald-500 rounded-full"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-sm text-emerald-300">Fluxo ativo</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========== FASE 2: TELA LIMPA (Cenas 7-12) ========== */}
        <AnimatePresence>
          {scene >= 7 && (
            <motion.div 
              className="flex flex-col items-center justify-center h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 * scene }}
            >
              {/* Cena 7: Grande ícone */}
              {scene === 7 && (
                <motion.div
                  className="text-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                >
                  <motion.div
                    className="w-28 h-28 bg-gradient-to-br from-emerald-500 to-green-500 rounded-3xl flex items-center justify-center shadow-2xl mx-auto"
                    animate={{ boxShadow: ['0 0 30px rgba(16,185,129,0.3)', '0 0 60px rgba(16,185,129,0.6)', '0 0 30px rgba(16,185,129,0.3)'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Settings className="w-14 h-14 text-white" />
                  </motion.div>
                  <p className="text-xl font-bold text-white mt-4">Automação Ativa</p>
                </motion.div>
              )}

              {/* Cena 8: Stats */}
              {scene === 8 && (
                <motion.div
                  className="grid grid-cols-3 gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 * scene }}
                >
                  {[
                    { label: 'Tarefas/dia', value: '100+' },
                    { label: 'Tempo salvo', value: '8h' },
                    { label: 'Erros', value: '0%' },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      className="text-center p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.2 * scene }}
                    >
                      <p className="text-2xl font-bold text-emerald-400">{stat.value}</p>
                      <p className="text-xs text-slate-400">{stat.label}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Cena 9: Raio */}
              {scene === 9 && (
                <motion.div
                  className="text-center"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Zap className="w-20 h-20 text-emerald-400 mx-auto" />
                  </motion.div>
                  <p className="text-lg font-bold text-white mt-4">Velocidade 10x</p>
                </motion.div>
              )}

              {/* Cena 10: Crescimento */}
              {scene === 10 && (
                <motion.div
                  className="text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <TrendingUp className="w-20 h-20 text-green-400 mx-auto" />
                  </motion.div>
                  <p className="text-lg font-bold text-white mt-4">Produtividade Escalável</p>
                </motion.div>
              )}

              {/* Cena 11: Checkmark */}
              {scene === 11 && (
                <motion.div
                  className="text-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                >
                  <motion.div
                    className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto"
                    animate={{ boxShadow: ['0 0 20px rgba(34,197,94,0.3)', '0 0 40px rgba(34,197,94,0.6)', '0 0 20px rgba(34,197,94,0.3)'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <CheckCircle className="w-12 h-12 text-white" />
                  </motion.div>
                  <p className="text-xl font-bold text-green-400 mt-4">24/7 Ativo</p>
                </motion.div>
              )}

              {/* Cena 12: Mensagem Final */}
              {scene === 12 && (
                <motion.div
                  className="text-center max-w-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 * scene }}
                >
                  <motion.div
                    className="p-6 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl"
                    animate={{ boxShadow: ['0 0 20px rgba(16,185,129,0.2)', '0 0 40px rgba(16,185,129,0.4)', '0 0 20px rgba(16,185,129,0.2)'] }}
                    transition={{ duration: 2 * scene, repeat: Infinity }}
                  >
                    <Sparkles className="w-6 h-6 text-emerald-400 mx-auto mb-3" />
                    <p className="text-lg font-medium text-white">
                      <span className="text-emerald-400 font-bold">Fluxos e automações</span> que trabalham enquanto você descansa.
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress indicator */}
        <div className="flex gap-1.5 mt-auto pt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => (
            <motion.div
              key={s}
              className="w-2 h-2 rounded-full"
              animate={{
                backgroundColor: scene >= s ? '#10b981' : 'rgba(255,255,255,0.2)',
                scale: scene === s ? 1.3 : 1
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* Badge */}
      <motion.div
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: scene > 0 ? 1 : 0 }}
      >
        <Settings className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] text-emerald-300 font-medium">Automação</span>
      </motion.div>
    </div>
  );
};

export default CardEffectAutomation;
