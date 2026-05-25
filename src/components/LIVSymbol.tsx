/**
 * LIVSymbol — Componente React do anel da LIV (mascote AILIV)
 *
 * Substitui a presença completa da LIV em contextos onde a personagem inteira
 * seria visualmente pesada. Aparece em: header do app, notificações push,
 * indicador de "LIV pensando", ícones pequenos, badges de conquista.
 *
 * Uso:
 *   <LIVSymbol />                              // estado idle, 64px
 *   <LIVSymbol state="speaking" size={48} />   // falando, 48px
 *   <LIVSymbol state="thinking" />             // pensando, 64px
 *   <LIVSymbol state="celebrating" size={96} />// celebrando, 96px
 *
 * Estados disponíveis:
 *   - idle:        pulsação suave em loop (default)
 *   - speaking:    pulsação rápida ritmada (use durante TTS/áudio)
 *   - thinking:    anéis girando (use quando Claude API processa)
 *   - celebrating: brilho dourado pulsante (conquistas, fim de trilha)
 *   - concerned:   pulsação âmbar lenta (streak em risco, sem hearts)
 *
 * Sem dependências externas. SVG inline + CSS keyframes.
 * Respeita `prefers-reduced-motion` pra acessibilidade.
 */

import React from 'react'

export type LIVState = 'idle' | 'speaking' | 'thinking' | 'celebrating' | 'concerned'

export interface LIVSymbolProps {
  /** Estado emocional/funcional da LIV. Default: 'idle' */
  state?: LIVState
  /** Tamanho em pixels (largura = altura). Default: 64 */
  size?: number
  /** Classes Tailwind/CSS adicionais aplicadas ao wrapper */
  className?: string
  /** Aria-label customizado. Default: descrição do estado em pt-BR */
  ariaLabel?: string
  /** Desligar o glow blur (melhora performance em mobile low-end). Default: true */
  enableGlow?: boolean
}

interface StateTokens {
  outer: string
  middle: string
  inner: string
  glow: string
  description: string
}

const STATE_TOKENS: Record<LIVState, StateTokens> = {
  idle: {
    outer: '#A78BFA',
    middle: '#C4B5FD',
    inner: '#E0E7FF',
    glow: '#818CF8',
    description: 'LIV presente',
  },
  speaking: {
    outer: '#7C3AED',
    middle: '#A78BFA',
    inner: '#C4B5FD',
    glow: '#6366F1',
    description: 'LIV falando',
  },
  thinking: {
    outer: '#A78BFA',
    middle: '#C4B5FD',
    inner: '#E0E7FF',
    glow: '#818CF8',
    description: 'LIV pensando',
  },
  celebrating: {
    outer: '#FBBF24',
    middle: '#FCD34D',
    inner: '#FEF3C7',
    glow: '#F59E0B',
    description: 'LIV celebrando',
  },
  concerned: {
    outer: '#F59E0B',
    middle: '#FBBF24',
    inner: '#FCD34D',
    glow: '#D97706',
    description: 'LIV preocupada',
  },
}

export const LIVSymbol: React.FC<LIVSymbolProps> = ({
  state = 'idle',
  size = 64,
  className = '',
  ariaLabel,
  enableGlow = true,
}) => {
  const tokens = STATE_TOKENS[state]
  const uid = React.useId().replace(/:/g, '')

  return (
    <div
      className={`liv-symbol liv-symbol-${state} ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        position: 'relative',
        lineHeight: 0,
      }}
      role="img"
      aria-label={ariaLabel ?? tokens.description}
    >
      <style>{LIV_SYMBOL_CSS}</style>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {enableGlow && (
          <defs>
            <filter
              id={`liv-glow-${uid}`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feFlood floodColor={tokens.glow} floodOpacity="0.5" />
              <feComposite in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        <g
          className="liv-rings"
          filter={enableGlow ? `url(#liv-glow-${uid})` : undefined}
        >
          <circle
            className="liv-ring liv-ring-outer"
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={tokens.outer}
            strokeWidth="2"
          />
          <circle
            className="liv-ring liv-ring-middle"
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke={tokens.middle}
            strokeWidth="1.5"
          />
          <circle
            className="liv-ring liv-ring-inner"
            cx="50"
            cy="50"
            r="30"
            fill="none"
            stroke={tokens.inner}
            strokeWidth="1"
          />
        </g>
      </svg>
    </div>
  )
}

const LIV_SYMBOL_CSS = `
.liv-symbol .liv-ring {
  transform-origin: 50px 50px;
  transform-box: fill-box;
  will-change: transform, opacity;
}

/* ========== IDLE ========== */
@keyframes liv-pulse-idle {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50%      { opacity: 1.00; transform: scale(1.04); }
}
.liv-symbol-idle .liv-ring-outer  { animation: liv-pulse-idle 3.2s ease-in-out infinite; }
.liv-symbol-idle .liv-ring-middle { animation: liv-pulse-idle 3.2s ease-in-out infinite 0.4s; }
.liv-symbol-idle .liv-ring-inner  { animation: liv-pulse-idle 3.2s ease-in-out infinite 0.8s; }

/* ========== SPEAKING ========== */
@keyframes liv-pulse-speaking {
  0%, 100% { opacity: 0.7; transform: scale(0.96); }
  50%      { opacity: 1.0; transform: scale(1.10); }
}
.liv-symbol-speaking .liv-ring-outer  { animation: liv-pulse-speaking 0.8s ease-in-out infinite; }
.liv-symbol-speaking .liv-ring-middle { animation: liv-pulse-speaking 0.8s ease-in-out infinite 0.12s; }
.liv-symbol-speaking .liv-ring-inner  { animation: liv-pulse-speaking 0.8s ease-in-out infinite 0.24s; }

/* ========== THINKING ========== */
@keyframes liv-rotate-thinking {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.liv-symbol-thinking .liv-rings {
  transform-origin: 50px 50px;
  transform-box: fill-box;
  animation: liv-rotate-thinking 4s linear infinite;
}

/* ========== CELEBRATING ========== */
@keyframes liv-pulse-celebrating {
  0%, 100% { opacity: 0.85; transform: scale(1.00); filter: brightness(1.0); }
  50%      { opacity: 1.00; transform: scale(1.16); filter: brightness(1.4); }
}
.liv-symbol-celebrating .liv-ring-outer,
.liv-symbol-celebrating .liv-ring-middle,
.liv-symbol-celebrating .liv-ring-inner {
  animation: liv-pulse-celebrating 0.55s ease-in-out infinite;
}

/* ========== CONCERNED ========== */
@keyframes liv-pulse-concerned {
  0%, 100% { opacity: 0.55; transform: scale(1.000); }
  50%      { opacity: 0.85; transform: scale(1.025); }
}
.liv-symbol-concerned .liv-ring-outer  { animation: liv-pulse-concerned 2.4s ease-in-out infinite; }
.liv-symbol-concerned .liv-ring-middle { animation: liv-pulse-concerned 2.4s ease-in-out infinite 0.3s; }
.liv-symbol-concerned .liv-ring-inner  { animation: liv-pulse-concerned 2.4s ease-in-out infinite 0.6s; }

/* ========== ACESSIBILIDADE ========== */
@media (prefers-reduced-motion: reduce) {
  .liv-symbol .liv-ring,
  .liv-symbol .liv-rings {
    animation: none !important;
  }
}
`

export default LIVSymbol

/* ============================================================
 * EXEMPLOS DE USO (cole no seu app pra testar)
 * ============================================================
 *
 * // 1. No header do app — idle, 32px
 * <LIVSymbol size={32} />
 *
 * // 2. Quando o áudio TTS está tocando
 * <LIVSymbol state="speaking" size={48} />
 *
 * // 3. Loading do Claude API
 * <LIVSymbol state="thinking" size={56} />
 *
 * // 4. Modal de conquista — grande, brilhante
 * <LIVSymbol state="celebrating" size={120} />
 *
 * // 5. Alerta de streak em risco
 * <LIVSymbol state="concerned" size={40} />
 *
 * // 6. Performance mode em mobile low-end (desliga blur do glow)
 * <LIVSymbol state="idle" enableGlow={false} />
 *
 * ============================================================
 * COMO INTEGRAR (passos pro Claude Code)
 * ============================================================
 *
 * 1. Salva esse arquivo como `src/components/liv/LIVSymbol.tsx`
 * 2. Importa onde quiser:
 *      import { LIVSymbol } from '@/components/liv/LIVSymbol'
 * 3. Substitui o atual avatar pequeno da LIV no header por:
 *      <LIVSymbol size={32} />
 *
 * Não precisa de Tailwind config. Não precisa de CSS global.
 * O componente é autocontido.
 *
 * ============================================================
 */
