import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { motion } from "framer-motion";
import { V8InlinePlayground } from "@/types/v8Lesson";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, ArrowRight, Send, RotateCcw, Sparkles, AlertTriangle, CheckCircle2, XCircle, Copy, Loader2, ImageIcon } from "lucide-react";
import { scheduleCTAScroll } from "./v8ScrollUtils";
import { V8AudioPlayer } from "./V8AudioPlayer";
import { useV7SoundEffects } from "@/components/lessons/v7/cinematic/useV7SoundEffects";
import { PASS_SCORE } from "@/constants/v8Rules";
import { fireInlineConfetti } from "./v8Confetti";
interface V8PlaygroundInlineProps {
  playground: V8InlinePlayground;
  lessonId?: string;
  onContinue?: () => void;
  onScore?: (score: number) => void;
  isActive?: boolean;
  isActiveAudio?: boolean;
}

type Phase = "intro" | "amateur" | "professional" | "compare" | "challenge" | "done";

const PHASE_ORDER: Phase[] = ["intro", "amateur", "professional", "compare", "challenge", "done"];
const phaseToIndex = (p: Phase) => PHASE_ORDER.indexOf(p);

export interface V8PlaygroundInlineHandle {
  resetPlayground: () => void;
}

export const V8PlaygroundInline = forwardRef<V8PlaygroundInlineHandle, V8PlaygroundInlineProps>(({ playground, lessonId, onContinue, onScore, isActive = true, isActiveAudio = false }, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [justReset, setJustReset] = useState(false);

  // Expose reset method for external callers (e.g. "Refazer Desafio" from InsightReward)
  useImperativeHandle(ref, () => ({
    resetPlayground: () => {
      setPhase(playground.userChallenge ? "challenge" : "intro");
      setAttempts(0);
      setChallengeScore(null);
      setFeedback(null);
      setStructuredFeedback(null);
      setUserPrompt("");
      setShowHints(false);
      setGeneratedImageUrl(null);
      setIsGeneratingImage(false);
      setImageError(null);
      setJustReset(true);
      setTimeout(() => setJustReset(false), 1500);
      setTimeout(() => {
        const target = textareaRef.current ?? rootRef.current;
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        textareaRef.current?.focus();
      }, 120);
    },
  }));

  const { playSound } = useV7SoundEffects(0.6, true);
  const [phase, setPhase] = useState<Phase>("intro");
  const [amateurResult, setAmateurResult] = useState(playground.amateurResult || "");
  const [professionalResult, setProfessionalResult] = useState(playground.professionalResult || "");
  const [isLoadingResult, setIsLoadingResult] = useState(false);

  // Challenge state
  const [userPrompt, setUserPrompt] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [structuredFeedback, setStructuredFeedback] = useState<{
    verdict?: string;
    feedback?: string;
    criteriaBreakdown?: Array<{ criterion: string; met: boolean; detail: string }>;
    suggestions?: string[];
    improvedExample?: string;
  } | null>(null);
  const [challengeScore, setChallengeScore] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showHints, setShowHints] = useState(false);

  // AI Image generation state
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const maxAttempts = playground.userChallenge?.maxAttempts ?? 3;

  // Generate result via AI if not pre-baked
  const generateResult = useCallback(async (prompt: string, setter: (v: string) => void) => {
    setIsLoadingResult(true);
    try {
      const { data, error } = await supabase.functions.invoke("v8-evaluate-prompt", {
        body: {
          mode: "generate-result",
          prompt,
        },
      });
      if (error) throw error;
      setter(data?.result || "Resultado indisponível.");
    } catch {
      setter(playground.offlineFallback?.exampleAnswer || "Não foi possível gerar o resultado. Continue a aula.");
    } finally {
      setIsLoadingResult(false);
    }
  }, [playground.offlineFallback]);

  const handleNextPhase = useCallback(async () => {
    const phases: Phase[] = ["intro", "amateur", "professional", "compare"];
    if (playground.userChallenge) phases.push("challenge");
    phases.push("done");

    const currentIdx = phases.indexOf(phase);
    const nextPhase = phases[currentIdx + 1] || "done";

    // Load AI results if needed
    if (nextPhase === "amateur" && !amateurResult) {
      await generateResult(playground.amateurPrompt, setAmateurResult);
    }
    if (nextPhase === "professional" && !professionalResult) {
      await generateResult(playground.professionalPrompt, setProfessionalResult);
    }

    setPhase(nextPhase);
  }, [phase, amateurResult, professionalResult, playground, generateResult]);

  // ─── Local heuristic pre-check (avoids AI call for obviously bad prompts) ───
  const localHeuristicCheck = useCallback((prompt: string): { pass: false; score: number; feedback: string; verdict: string } | { pass: true } => {
    const trimmed = prompt.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

    // Too short
    if (wordCount < 5) {
      return { pass: false, score: 10, feedback: "Seu prompt tem menos de 5 palavras. Adicione mais contexto, objetivo e detalhes para obter um resultado melhor.", verdict: "Prompt muito curto!" };
    }

    // Too short for quality
    if (wordCount < 10) {
      return { pass: false, score: 25, feedback: "Prompts eficazes geralmente têm pelo menos 10 palavras. Tente adicionar mais contexto e especificidade.", verdict: "Quase lá, mas precisa de mais detalhes!" };
    }

    // Client-side copy detection (quick Jaccard on trigrams)
    const refs = [playground.professionalPrompt, playground.amateurPrompt, playground.userChallenge?.challengePrompt].filter(Boolean) as string[];
    for (const ref of refs) {
      const sim = quickSimilarity(trimmed, ref);
      if (sim >= 0.75) {
        return { pass: false, score: 0, feedback: "Seu prompt é muito parecido com um dos exemplos da aula. Escreva com suas próprias palavras!", verdict: "Prompt copiado detectado" };
      }
    }

    return { pass: true };
  }, [playground]);

  // Quick trigram similarity (lightweight client-side version)
  const quickSimilarity = (a: string, b: string): number => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-záàâãéèêíïóôõúüç0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
    const ta = norm(a), tb = norm(b);
    if (ta.length < 3 || tb.length < 3) return 0;
    const setA = new Set<string>(), setB = new Set<string>();
    for (let i = 0; i <= ta.length - 3; i++) setA.add(ta.substring(i, i + 3));
    for (let i = 0; i <= tb.length - 3; i++) setB.add(tb.substring(i, i + 3));
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    return inter / (setA.size + setB.size - inter);
  };

  // Evaluate user challenge
  const handleEvaluate = useCallback(async () => {
    if (!userPrompt.trim() || !playground.userChallenge) return;

    // ─── Step 1: Local heuristic (FREE — no AI call) ───
    const heuristic = localHeuristicCheck(userPrompt);
    if (!heuristic.pass) {
      const h = heuristic as { pass: false; score: number; feedback: string; verdict: string };
      setAttempts((prev) => prev + 1);
      setChallengeScore(h.score);
      setFeedback(h.feedback);
      setStructuredFeedback({
        verdict: h.verdict,
        feedback: h.feedback,
        criteriaBreakdown: (playground.userChallenge.evaluationCriteria || []).map((c: string) => ({
          criterion: c, met: false, detail: "Não avaliado — prompt insuficiente."
        })),
        suggestions: ["Escreva um prompt mais detalhado com pelo menos 15 palavras", "Inclua contexto, objetivo e tom desejado"],
        improvedExample: "",
      });
      onScore?.(h.score);
      playSound("error");
      return;
    }

    // ─── Step 2: Backend (cache → AI barato) ───
    setIsEvaluating(true);
    setAttempts((prev) => prev + 1);

    try {
      const { data, error } = await supabase.functions.invoke("v8-evaluate-prompt", {
        body: {
          mode: "evaluate",
          userPrompt: userPrompt.trim(),
          evaluationCriteria: playground.userChallenge.evaluationCriteria,
          rubric: playground.userChallenge.scoring?.rubric,
          maxScore: playground.userChallenge.scoring?.maxScore ?? 100,
          professionalPrompt: playground.professionalPrompt || "",
          amateurPrompt: playground.amateurPrompt || "",
          professionalResult: playground.professionalResult || "",
          amateurResult: playground.amateurResult || "",
          challengePrompt: playground.userChallenge.challengePrompt || "",
          playgroundId: playground.id || "",
          lessonId: lessonId || "",
        },
      });

      if (error) throw error;

      const score = data?.score ?? 0;
      setChallengeScore(score);
      if (score >= PASS_SCORE) {
        playSound("success");
      } else {
        playSound("error");
      }
      if (score === 100) fireInlineConfetti();
      setFeedback(data?.feedback || (score >= PASS_SCORE ? playground.successMessage : playground.tryAgainMessage));
      setStructuredFeedback({
        verdict: data?.verdict || "",
        feedback: data?.feedback || "",
        criteriaBreakdown: data?.criteriaBreakdown || [],
        suggestions: data?.suggestions || [],
        improvedExample: data?.improvedExample || "",
      });

      onScore?.(score);

      // Trigger AI image generation if enabled (any score > 0 — user should see their image)
      if (playground.generateAiImage && score > 0 && lessonId) {
        generateAiImage(userPrompt.trim());
      }
    } catch {
      setFeedback(playground.offlineFallback?.message || "Avaliação indisponível no momento. Continue a aula.");
      setStructuredFeedback(null);
      setChallengeScore(null);
    } finally {
      setIsEvaluating(false);
    }
  }, [userPrompt, playground, onScore, playSound, localHeuristicCheck, lessonId]);

  // Generate AI image from user prompt
  const generateAiImage = useCallback(async (prompt: string) => {
    setIsGeneratingImage(true);
    setImageError(null);
    setGeneratedImageUrl(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("v10-generate-ai-image", {
        body: { prompt, lessonId, model: "google/gemini-3-pro-image-preview" },
      });
      if (fnError) throw fnError;
      if (data?.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      } else {
        setImageError(data?.error || "Falha ao gerar imagem");
      }
    } catch (err) {
      console.error("[Playground] Image generation error:", err);
      setImageError("Erro ao gerar imagem. Tente novamente.");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [lessonId]);

  const canRetry = attempts < maxAttempts && (challengeScore === null || challengeScore < PASS_SCORE);

  const bottomRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll: ensure CTA button is visible after phase transitions
  // Only scroll when this is the active item to prevent stale items from hijacking scroll
  useEffect(() => {
    if (!isActive) return;
    if (phase === "intro") return;
    if (isLoadingResult || isEvaluating) return;

    return scheduleCTAScroll(
      () => ctaRef.current,
      () => bottomRef.current
    );
  }, [phase, isLoadingResult, isEvaluating, feedback, challengeScore, isActive]);

  const cardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm p-5";

  const pi = phaseToIndex(phase);
  // For challenge skip: if no userChallenge, treat challenge(4) as done(5)
  const hasChallenge = !!playground.userChallenge;

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`space-y-4 ${justReset ? "ring-2 ring-violet-400 ring-offset-2 rounded-2xl transition-all duration-700" : ""}`}
      style={{ scrollMarginTop: "88px" }}
    >
      {/* Title */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Playground
        </div>
        <h2 className="text-xl font-bold text-slate-900">{playground.title}</h2>
        {playground.subtitle && (
          <p className="text-sm text-slate-500 mt-1">{playground.subtitle}</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* Phase: Intro (index 0) — always visible */}
        {pi >= 0 && (
          <motion.div
            key="intro"
            initial={pi === 0 ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            className={cardClass}
          >
            <p className="text-sm text-slate-700 leading-relaxed">{playground.instruction}</p>
            {pi === 0 && (
              <button
                onClick={handleNextPhase}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {isLoadingResult ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                ) : (
                  <>Ver Prompt Amador <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Phase: Amateur (index 1) */}
        {pi >= 1 && (
          <motion.div
            key="amateur"
            initial={pi === 1 ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className={`${cardClass} border-red-200`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold uppercase">Amador</span>
              </div>
              <p className="text-sm text-slate-700 font-mono bg-slate-50 rounded-lg p-3">{playground.amateurPrompt}</p>
            </div>
            {amateurResult && (
              <div className={`${cardClass} border-red-100`}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Resultado</p>
                <p className="text-sm text-slate-600 leading-relaxed">{amateurResult}</p>
              </div>
            )}
            {isLoadingResult && pi === 1 && (
              <div className="text-center py-4 text-xs text-slate-400 animate-pulse">Gerando resultado...</div>
            )}
            {pi === 1 && (
              <button
                ref={ctaRef}
                onClick={handleNextPhase}
                disabled={isLoadingResult}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoadingResult ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                ) : (
                  <>Agora o Profissional <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Phase: Professional (index 2) */}
        {pi >= 2 && (
          <motion.div
            key="professional"
            initial={pi === 2 ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className={`${cardClass} border-emerald-200`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">Profissional</span>
              </div>
              <p className="text-sm text-slate-700 font-mono bg-slate-50 rounded-lg p-3">{playground.professionalPrompt}</p>
            </div>
            {professionalResult && (
              <div className={`${cardClass} border-emerald-100`}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Resultado</p>
                <p className="text-sm text-slate-600 leading-relaxed">{professionalResult}</p>
              </div>
            )}
            {isLoadingResult && pi === 2 && (
              <div className="text-center py-4 text-xs text-slate-400 animate-pulse">Gerando resultado...</div>
            )}
            {pi === 2 && (
              <button
                ref={ctaRef}
                onClick={handleNextPhase}
                disabled={isLoadingResult}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoadingResult ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                ) : (
                  <>Comparar <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Phase: Compare (index 3) */}
        {pi >= 3 && (
          <motion.div
            key="compare"
            initial={pi === 3 ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`${cardClass} border-red-200`}>
                <p className="text-[10px] font-bold text-red-500 uppercase mb-2">❌ Amador</p>
                <p className="text-xs text-slate-600 line-clamp-4">{playground.amateurPrompt}</p>
              </div>
              <div className={`${cardClass} border-emerald-200`}>
                <p className="text-[10px] font-bold text-emerald-500 uppercase mb-2">✅ Profissional</p>
                <p className="text-xs text-slate-600 line-clamp-4">{playground.professionalPrompt}</p>
              </div>
            </div>
            {pi === 3 && (
              <button
                ref={ctaRef}
                onClick={handleNextPhase}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {hasChallenge ? "Sua Vez!" : "Continuar"}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}

        {/* Phase: Challenge (index 4) */}
        {pi >= 4 && hasChallenge && playground.userChallenge && (
          <motion.div
            key="challenge"
            initial={pi === 4 ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className={cardClass}>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">{playground.userChallenge.instruction}</p>

              <textarea
                ref={textareaRef}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Digite seu prompt aqui..."
                className={`w-full h-28 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 resize-none ${pi >= 5 ? "opacity-60 cursor-not-allowed" : ""}`}
                disabled={isEvaluating || (!canRetry && challengeScore !== null) || pi >= 5}
                readOnly={pi >= 5}
              />

              {/* Hints */}
              {playground.userChallenge.hints.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowHints(!showHints)}
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {showHints ? "Esconder dicas" : "Ver dicas"}
                  </button>
                  {showHints && (
                    <ul className="mt-2 space-y-1">
                      {playground.userChallenge.hints.map((hint, i) => (
                         <li key={i} className="text-xs text-amber-600/70 flex items-start gap-2">
                           <span className="text-amber-500 mt-0.5">•</span>
                          {hint}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Structured Feedback */}
              {feedback && (
                <div className="mt-3 space-y-3">
                  {/* Header: verdict + score */}
                    <div className={`p-4 rounded-xl border ${challengeScore !== null && challengeScore >= PASS_SCORE ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                     <div className="flex items-center justify-between mb-1">
                       <span className={`text-sm font-bold ${challengeScore !== null && challengeScore >= PASS_SCORE ? "text-emerald-700" : "text-amber-700"}`}>
                         {structuredFeedback?.verdict || (challengeScore !== null && challengeScore >= PASS_SCORE ? "Excelente!" : "Quase lá!")}
                       </span>
                       {challengeScore !== null && (
                         <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${challengeScore >= PASS_SCORE ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                           {challengeScore}/100
                         </span>
                       )}
                     </div>
                     <p className={`text-sm leading-relaxed ${challengeScore !== null && challengeScore >= PASS_SCORE ? "text-emerald-600" : "text-amber-600"}`}>
                      {structuredFeedback?.feedback || feedback}
                    </p>
                  </div>

                  {/* Criteria breakdown */}
                  {structuredFeedback?.criteriaBreakdown && structuredFeedback.criteriaBreakdown.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-400 uppercase px-4 pt-3 pb-1">Análise por Critério</p>
                      <div className="divide-y divide-slate-100">
                        {structuredFeedback.criteriaBreakdown.map((item, i) => (
                          <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                            {item.met ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold ${item.met ? "text-emerald-700" : "text-red-600"}`}>
                                {item.criterion}
                              </p>
                              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                                {item.detail}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {structuredFeedback?.suggestions && structuredFeedback.suggestions.length > 0 && (
                     <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-[10px] font-bold text-violet-500 uppercase mb-1.5">💡 Sugestões para melhorar</p>
                      <ul className="space-y-1.5">
                        {structuredFeedback.suggestions.map((suggestion, i) => (
                          <li key={i} className="text-xs text-violet-700 leading-relaxed flex items-start gap-2">
                            <span className="text-violet-400 mt-0.5 flex-shrink-0">→</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improved example */}
                  {structuredFeedback?.improvedExample && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase">✨ Versão Melhorada</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(structuredFeedback.improvedExample || "")}
                          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Copiar
                        </button>
                      </div>
                      <p className="text-xs text-indigo-700 font-mono leading-relaxed bg-white/60 rounded-lg p-2 border border-indigo-100">
                        {structuredFeedback.improvedExample}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Hint on fail */}
              {feedback && challengeScore !== null && challengeScore < PASS_SCORE && playground.hintOnFail && attempts <= playground.hintOnFail.length && (
                <div className="mt-2 flex items-start gap-2 text-xs text-violet-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {playground.hintOnFail[attempts - 1]}
                </div>
              )}

              {/* AI Generated Image */}
              {playground.generateAiImage && (isGeneratingImage || generatedImageUrl || imageError) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4"
                >
                  {isGeneratingImage && (
                    <div className="rounded-xl overflow-hidden">
                      <div
                        className="w-full h-48 rounded-xl"
                        style={{
                          background: "linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)",
                          backgroundSize: "200% 100%",
                          animation: "shimmer 1.5s ease-in-out infinite",
                        }}
                      />
                      <p className="text-xs text-slate-400 text-center mt-2 flex items-center justify-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Gerando sua imagem com IA...
                      </p>
                      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                    </div>
                  )}
                  {generatedImageUrl && (
                    <div className="space-y-2" style={{ animation: "fadeInImg 0.6s ease-out" }}>
                      <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        🎨 Sua imagem gerada:
                      </p>
                      <img
                        src={generatedImageUrl}
                        alt="Imagem gerada pelo seu prompt"
                        className="w-full rounded-xl border border-slate-200 shadow-sm"
                      />
                      <style>{`@keyframes fadeInImg { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    </div>
                  )}
                  {imageError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{imageError}</p>
                    </div>
                  )}
                </motion.div>
              )}


              {pi === 4 && (
                <div className="mt-3 flex flex-col gap-2">
                  {canRetry && challengeScore === null && (
                    <button
                      ref={ctaRef}
                      onClick={handleEvaluate}
                      disabled={isEvaluating || !userPrompt.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isEvaluating ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Avaliando...</>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Avaliar Meu Prompt
                        </>
                      )}
                    </button>
                  )}

                  {attempts > 0 && canRetry && challengeScore !== null && challengeScore < PASS_SCORE && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        ref={ctaRef}
                        onClick={() => {
                          setChallengeScore(null);
                          setFeedback(null);
                          setStructuredFeedback(null);
                          setUserPrompt("");
                          setShowHints(false);
                          setGeneratedImageUrl(null);
                          setImageError(null);
                          setJustReset(true);
                          setTimeout(() => setJustReset(false), 1500);
                          setTimeout(() => {
                            const target = textareaRef.current ?? rootRef.current;
                            target?.scrollIntoView({ behavior: "smooth", block: "center" });
                            textareaRef.current?.focus();
                          }, 120);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Tentar Novamente ({maxAttempts - attempts})
                      </button>
                      <button
                        onClick={() => setPhase("done")}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-300 text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                        Continuar Aula
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {((!canRetry && attempts > 0) || (challengeScore !== null && challengeScore >= PASS_SCORE)) && (
                    <button
                      ref={ctaRef}
                      onClick={() => setPhase("done")}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                      Continuar
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-center mt-2">
                {attempts}/{maxAttempts} tentativas
              </p>
            </div>
          </motion.div>
        )}

        {/* Phase: Done (index 5) */}
        {pi >= 5 && (
          <motion.div
            key="done"
            initial={pi === 5 ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
            className={`${cardClass} text-center`}
          >
            {/* Badge: Tarefa concluída or Playground concluído */}
            <div className="flex justify-center mb-3">
            {challengeScore !== null && challengeScore >= PASS_SCORE ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tarefa concluída
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Playground concluído
                </div>
              )}
            </div>
            <p className={`text-sm font-semibold mb-3 ${challengeScore !== null && challengeScore >= PASS_SCORE ? "text-emerald-600" : "text-slate-600"}`}>
            {challengeScore !== null && challengeScore >= PASS_SCORE ? playground.successMessage : "Você concluiu o playground. Continue a aula para aprender mais!"}
            </p>
            {/* Play success or tryAgain audio — only in Listen mode */}
            {isActiveAudio && challengeScore !== null && challengeScore >= PASS_SCORE && playground.successAudioUrl && (
              <V8AudioPlayer audioUrl={playground.successAudioUrl} autoPlay />
            )}
            {isActiveAudio && (challengeScore === null || challengeScore < PASS_SCORE) && playground.tryAgainAudioUrl && (
              <V8AudioPlayer audioUrl={playground.tryAgainAudioUrl} autoPlay />
            )}
            {onContinue && (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <button
                  onClick={() => {
                    setPhase(playground.userChallenge ? "challenge" : "intro");
                    setAttempts(0);
                    setChallengeScore(null);
                    setFeedback(null);
                    setStructuredFeedback(null);
                    setUserPrompt("");
                    setShowHints(false);
                    setJustReset(true);
                    setTimeout(() => setJustReset(false), 1500);
                    setTimeout(() => {
                      const target = textareaRef.current ?? rootRef.current;
                      target?.scrollIntoView({ behavior: "smooth", block: "center" });
                      textareaRef.current?.focus();
                    }, 120);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Repetir tarefa
                </button>
                <button
                  ref={ctaRef}
                  onClick={onContinue}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Continuar Aula
                  <ArrowRight className="w-4 h-4 inline ml-2" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </motion.div>
  );
});

V8PlaygroundInline.displayName = "V8PlaygroundInline";
