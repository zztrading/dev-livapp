/**
 * Helpers compartilhados para card-effects data-driven (V5).
 *
 * Card-effects "data-driven" são aqueles que renderizam conteúdo
 * vindo de `experienceCards[i].props` no JSON da aula, em vez de
 * conteúdo hardcoded. Os 5 tipos cobertos hoje:
 *
 *   - strategic-shift
 *   - problem-identifier
 *   - profit-calculator
 *   - automation
 *   - human-check
 *
 * Contrato: ver docs/contracts/CARD-EFFECTS-DATA-DRIVEN-CONTRACT.md
 */

import type { ComponentType } from 'react';
import {
  Sparkles,
  Zap,
  Star,
  Rocket,
  BookOpen,
  Lightbulb,
  Target,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Brain,
  Cog,
  Compass,
  Users,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface DataDrivenCardProps {
  title?: string;
  subtitle?: string;
  chapters?: string[];
  icon?: string;
  colorScheme?: string;
  effectDescription?: string;
}

export interface ColorScheme {
  /** classes Tailwind aplicadas no container raiz (gradiente de fundo) */
  bgGradient: string;
  /** classes Tailwind para o ícone */
  iconColor: string;
  /** classes Tailwind para o badge/halo do ícone */
  iconBg: string;
  /** classes Tailwind para os chapters (cards de etapa) */
  chapterBg: string;
  chapterBorder: string;
  /** classes Tailwind do texto secundário */
  subtitleColor: string;
  /** classes Tailwind do indicador de progresso ativo */
  progressActive: string;
  progressInactive: string;
}

/* ------------------------------------------------------------------ */
/*  resolveIcon                                                        */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  zap: Zap,
  star: Star,
  rocket: Rocket,
  book: BookOpen,
  'book-open': BookOpen,
  lightbulb: Lightbulb,
  target: Target,
  'trending-up': TrendingUp,
  shield: ShieldCheck,
  'shield-check': ShieldCheck,
  check: CheckCircle2,
  'check-circle': CheckCircle2,
  brain: Brain,
  cog: Cog,
  gear: Cog,
  compass: Compass,
  users: Users,
};

/**
 * Converte um nome de ícone (string vinda do JSON) num componente Lucide.
 * Se o nome não for reconhecido, devolve o `fallback`.
 */
export function resolveIcon(
  name: string | undefined,
  fallback: LucideIcon = Sparkles
): LucideIcon {
  if (!name) return fallback;
  return ICON_MAP[name.toLowerCase().trim()] ?? fallback;
}

/* ------------------------------------------------------------------ */
/*  resolveColorScheme                                                 */
/* ------------------------------------------------------------------ */

const COLOR_SCHEMES: Record<string, ColorScheme> = {
  purple: {
    bgGradient: 'from-purple-900 via-violet-900 to-slate-900',
    iconColor: 'text-purple-300',
    iconBg: 'bg-purple-500/30 ring-2 ring-purple-400/40',
    chapterBg: 'bg-purple-500/15',
    chapterBorder: 'border-purple-400/30',
    subtitleColor: 'text-purple-200',
    progressActive: 'bg-purple-400',
    progressInactive: 'bg-purple-400/30',
  },
  violet: {
    bgGradient: 'from-violet-900 via-purple-900 to-slate-900',
    iconColor: 'text-violet-300',
    iconBg: 'bg-violet-500/30 ring-2 ring-violet-400/40',
    chapterBg: 'bg-violet-500/15',
    chapterBorder: 'border-violet-400/30',
    subtitleColor: 'text-violet-200',
    progressActive: 'bg-violet-400',
    progressInactive: 'bg-violet-400/30',
  },
  indigo: {
    bgGradient: 'from-indigo-900 via-blue-900 to-slate-900',
    iconColor: 'text-indigo-300',
    iconBg: 'bg-indigo-500/30 ring-2 ring-indigo-400/40',
    chapterBg: 'bg-indigo-500/15',
    chapterBorder: 'border-indigo-400/30',
    subtitleColor: 'text-indigo-200',
    progressActive: 'bg-indigo-400',
    progressInactive: 'bg-indigo-400/30',
  },
  blue: {
    bgGradient: 'from-blue-900 via-indigo-900 to-slate-900',
    iconColor: 'text-blue-300',
    iconBg: 'bg-blue-500/30 ring-2 ring-blue-400/40',
    chapterBg: 'bg-blue-500/15',
    chapterBorder: 'border-blue-400/30',
    subtitleColor: 'text-blue-200',
    progressActive: 'bg-blue-400',
    progressInactive: 'bg-blue-400/30',
  },
  orange: {
    bgGradient: 'from-orange-900 via-red-900 to-slate-900',
    iconColor: 'text-orange-300',
    iconBg: 'bg-orange-500/30 ring-2 ring-orange-400/40',
    chapterBg: 'bg-orange-500/15',
    chapterBorder: 'border-orange-400/30',
    subtitleColor: 'text-orange-200',
    progressActive: 'bg-orange-400',
    progressInactive: 'bg-orange-400/30',
  },
  gold: {
    bgGradient: 'from-yellow-900 via-amber-900 to-slate-900',
    iconColor: 'text-yellow-300',
    iconBg: 'bg-yellow-500/30 ring-2 ring-yellow-400/40',
    chapterBg: 'bg-yellow-500/15',
    chapterBorder: 'border-yellow-400/30',
    subtitleColor: 'text-yellow-200',
    progressActive: 'bg-yellow-400',
    progressInactive: 'bg-yellow-400/30',
  },
  green: {
    bgGradient: 'from-emerald-900 via-green-900 to-slate-900',
    iconColor: 'text-emerald-300',
    iconBg: 'bg-emerald-500/30 ring-2 ring-emerald-400/40',
    chapterBg: 'bg-emerald-500/15',
    chapterBorder: 'border-emerald-400/30',
    subtitleColor: 'text-emerald-200',
    progressActive: 'bg-emerald-400',
    progressInactive: 'bg-emerald-400/30',
  },
};

/**
 * Resolve um esquema de cor pelo nome. Default: 'purple' (alinhado com a
 * paleta da marca AIliv — Indigo/Violet).
 */
export function resolveColorScheme(name: string | undefined): ColorScheme {
  if (!name) return COLOR_SCHEMES.purple;
  return COLOR_SCHEMES[name.toLowerCase().trim()] ?? COLOR_SCHEMES.purple;
}

/* ------------------------------------------------------------------ */
/*  hasDataDrivenContent                                               */
/* ------------------------------------------------------------------ */

/**
 * Retorna true se as props vindas do JSON têm conteúdo suficiente para
 * renderizar a versão data-driven (title + chapters[3]).
 * Caso contrário, o componente deve cair no fallback hardcoded.
 */
export function hasDataDrivenContent(
  props: Record<string, unknown> | undefined
): boolean {
  if (!props) return false;
  const title = (props as DataDrivenCardProps).title;
  const chapters = (props as DataDrivenCardProps).chapters;
  return (
    typeof title === 'string' &&
    title.trim().length > 0 &&
    Array.isArray(chapters) &&
    chapters.length >= 3 &&
    chapters.every((c) => typeof c === 'string' && c.trim().length > 0)
  );
}

/* ------------------------------------------------------------------ */
/*  toDataDrivenProps                                                  */
/* ------------------------------------------------------------------ */

export function toDataDrivenProps(
  props: Record<string, unknown> | undefined
): DataDrivenCardProps {
  if (!props) return {};
  const p = props as DataDrivenCardProps;
  return {
    title: typeof p.title === 'string' ? p.title : undefined,
    subtitle: typeof p.subtitle === 'string' ? p.subtitle : undefined,
    chapters: Array.isArray(p.chapters)
      ? p.chapters.filter((c): c is string => typeof c === 'string')
      : undefined,
    icon: typeof p.icon === 'string' ? p.icon : undefined,
    colorScheme: typeof p.colorScheme === 'string' ? p.colorScheme : undefined,
    effectDescription:
      typeof p.effectDescription === 'string' ? p.effectDescription : undefined,
  };
}
