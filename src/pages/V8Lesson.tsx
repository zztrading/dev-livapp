import { useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { V8LessonData } from "@/types/v8Lesson";
import { V8LessonPlayer } from "@/components/lessons/v8/V8LessonPlayer";
import { V8CompletionScreen } from "@/components/lessons/v8/V8CompletionScreen";
import { ExercisesSection } from "@/components/lessons/ExercisesSection";
import { V8LessonSkeleton } from "@/components/skeletons";
import { Json } from "@/integrations/supabase/types";

export default function V8Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const hasSavedProgress = useRef(false);
  const queryClient = useQueryClient();

  // Fetch lesson
  const { data: lesson, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["v8-lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, trail_id, course_id, content, exercises, estimated_time")
        .eq("id", lessonId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
    // Fase 2c: alinhar com useCourseDetailQuery / useLesson
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    retry: (failureCount, error: any) => {
      if (error?.code === 'PGRST116') return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => (attempt === 0 ? 500 : 1500),
  });

  // Parse V8LessonData from JSONB content
  const lessonData = useMemo<V8LessonData | null>(() => {
    if (!lesson?.content) return null;
    const raw = lesson.content as Record<string, Json>;
    if (raw.contentVersion !== "v8") return null;
    return raw as unknown as V8LessonData;
  }, [lesson?.content]);

  // Parse exercises from separate column (fallback to content.exercises)
  // Bug 5 fix: filter out inline exercise stubs that have no `data` field
  const exercises = useMemo(() => {
    const raw = (lesson?.exercises && Array.isArray(lesson.exercises) && lesson.exercises.length > 0)
      ? lesson.exercises
      : (lessonData?.exercises ?? []);
    // Only keep exercises that have a valid `data` object (not inline stubs)
    return (raw as any[]).filter((ex: any) =>
      ex && typeof ex === 'object' && ex.data && typeof ex.data === 'object' && Object.keys(ex.data).length > 0
    );
  }, [lesson?.exercises, lessonData?.exercises]);

  // Merge exercises into lessonData for the player
  const playerData = useMemo<V8LessonData | null>(() => {
    if (!lessonData) return null;
    return { ...lessonData, exercises: exercises as V8LessonData["exercises"] };
  }, [lessonData, exercises]);

  // Save progress
  const saveProgress = async (status: "in_progress" | "completed", score?: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !lessonId) return;

      const { data: existing } = await supabase
        .from("user_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("user_progress")
          .update({
            status,
            score: score ?? undefined,
            completed_at: status === "completed" ? new Date().toISOString() : undefined,
            last_accessed: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("user_progress").insert({
          user_id: user.id,
          lesson_id: lessonId,
          status,
          score: score ?? 0,
          started_at: new Date().toISOString(),
          last_accessed: new Date().toISOString(),
          completed_at: status === "completed" ? new Date().toISOString() : undefined,
        });
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error("[V8Lesson] Failed to save progress:", err);
      // Toast só em status="completed" (momento crítico). "in_progress" é silencioso
      // para evitar toast logo ao abrir a aula se rede falhar.
      if (status === "completed") {
        toast.error(
          "Não conseguimos salvar seu progresso agora. Recarregue a página e tente novamente.",
          { duration: 8000 }
        );
      }
    }
  };

  const handleComplete = async (scores: number[]) => {
    const avg = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 100;
    await saveProgress("completed", avg);

    // Invalidate course-detail cache so progress is fresh on return
    // FIX: a chave real em useCourseDetailQuery é 'course-detail-v2' — sem isto a invalidação nunca disparava
    queryClient.invalidateQueries({ queryKey: ['course-detail-v2'] });

    // Navigate back to journey or dashboard
    if (lesson?.course_id) {
      navigate(`/course/${lesson.course_id}`);
    } else {
      navigate("/dashboard");
    }
  };

  const handleBack = () => {
    if (lesson?.course_id) {
      navigate(`/course/${lesson.course_id}`);
    } else {
      navigate("/dashboard");
    }
  };

  // Mark as in_progress on first render
  useEffect(() => {
    if (!hasSavedProgress.current && playerData) {
      hasSavedProgress.current = true;
      saveProgress("in_progress");
    }
  }, [playerData, lessonId]);

  // Preload do primeiro áudio da aula — browser baixa em paralelo
  // ao render do player. Hint puro, sem efeito colateral.
  const firstAudioUrl: string | undefined = (() => {
    const sections = (playerData as any)?.sections;
    if (Array.isArray(sections)) {
      for (const s of sections) {
        if (s?.audioUrl && typeof s.audioUrl === 'string') return s.audioUrl;
      }
    }
    return undefined;
  })();

  useEffect(() => {
    if (!firstAudioUrl) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'audio';
    link.href = firstAudioUrl;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    return () => {
      try { document.head.removeChild(link); } catch {}
    };
  }, [firstAudioUrl]);

  if (isLoading) {
    return <V8LessonSkeleton />;
  }

  if (error || !playerData) {
    const isMissingContent = !error && !playerData;
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-slate-900 px-6">
        <p className="text-base font-medium text-slate-700">
          {isMissingContent ? "Conteúdo V8 não encontrado" : "Não foi possível carregar a aula"}
        </p>
        <p className="text-sm text-slate-500 text-center max-w-xs">
          {isMissingContent
            ? "Esta aula pode ter sido removida ou ainda não está disponível."
            : "Verifique sua conexão e tente novamente."}
        </p>
        {import.meta.env.DEV && error instanceof Error && (
          <pre className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-2 max-w-md overflow-auto">
            {error.message}
          </pre>
        )}
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {!isMissingContent && (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {isFetching ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Tentando…</>
              ) : (
                <>Tentar novamente</>
              )}
            </button>
          )}
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-xl text-sm text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <V8LessonPlayer
      lessonData={playerData}
      lessonId={lessonId}
      onComplete={handleComplete}
      onBack={handleBack}
      renderExercises={({ exercises: exs, onComplete: onExComplete, onScoreUpdate }) => (
        <ExercisesSection
          exercises={exs}
          onComplete={onExComplete}
          onScoreUpdate={onScoreUpdate}
        />
      )}
      renderCompletion={({ scores, startedAt, onContinue }) => (
        <V8CompletionScreen
          scores={scores}
          startedAt={startedAt}
          lessonId={lessonId!}
          onContinue={onContinue}
          onBackToTrail={handleBack}
        />
      )}
    />
  );
}
