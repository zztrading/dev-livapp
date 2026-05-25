import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface LessonContent {
  [key: string]: any;
}

export interface Lesson {
  id: string;
  trail_id: string;
  course_id?: string | null;
  title: string;
  description: string;
  lesson_type: 'fill-blanks' | 'fill-text' | 'drag-drop' | 'quiz-playground' | 'before-after' | 'flashcards' | 'guided';
  content: LessonContent;
  passing_score: number;
  estimated_time: number;
  difficulty_level: string;
  order_index: number;
  audio_url?: string | null;
  audio_urls?: string[] | null;
  model?: string;
  user_status?: string;
  user_score?: number;
  user_answers?: any;
  attempts?: number;
  exercises?: any[];
  exercises_version?: number;
}

/** Fetch lesson data — exported for prefetching */
export async function fetchLessonData(lessonId: string): Promise<Lesson> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');

  const [{ data: lessonData, error: lessonError }, { data: progressData }] = await Promise.all([
    supabase.from('lessons').select(
      'id, trail_id, course_id, title, description, lesson_type, content, exercises, exercises_version, passing_score, estimated_time, difficulty_level, order_index, audio_url, audio_urls, model'
    ).eq('id', lessonId).single(),
    supabase.from('user_progress')
      .select('status, score, answers, attempts')
      .eq('lesson_id', lessonId)
      .eq('user_id', session.user.id)
      .maybeSingle(),
  ]);

  if (lessonError) throw lessonError;

  return {
    ...lessonData,
    lesson_type: lessonData.lesson_type as any,
    content: lessonData.content as LessonContent,
    exercises: Array.isArray(lessonData.exercises) ? lessonData.exercises : [],
    user_status: progressData?.status || 'not_started',
    user_score: progressData?.score || 0,
    user_answers: progressData?.answers,
    attempts: progressData?.attempts || 0,
  };
}

export const useLesson = (lessonId: string) => {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const queryResult = useQuery<Lesson>({
    queryKey: ['lesson', lessonId],
    queryFn: () => fetchLessonData(lessonId),
    enabled: !!lessonId,
    // Fase 2c: alinhar com useCourseDetailQuery — cache curto + refetch on mount
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

  const lesson = queryResult.data ?? null;
  const loading = queryResult.isLoading;
  const refetch = queryResult.refetch;

  // Preload do áudio assim que a aula chega — browser baixa o MP3
  // em paralelo com o render do player. Hint puro, sem efeito colateral.
  useEffect(() => {
    const url = lesson?.audio_url;
    if (!url) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'audio';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    return () => {
      try { document.head.removeChild(link); } catch {}
    };
  }, [lesson?.audio_url]);

  const submitAnswers = async (answers: any, timeSpent: number) => {
    if (!lesson) return null;

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const score = calculateScore(lesson.lesson_type, lesson.content, answers);
      const passed = score >= lesson.passing_score;

      if (passed) {
        const { error: progressError } = await supabase.functions.invoke('user-progress', {
          body: { action: 'complete', lesson_id: lesson.id, time_spent: timeSpent },
        });

        if (progressError) {
          if (progressError.message?.includes('401') || progressError.message?.includes('Unauthorized')) {
            toast({ title: "Sessão expirada", description: "Por favor, faça login novamente.", variant: "destructive" });
            window.location.href = '/auth';
            return null;
          }
        }
      }

      const { data: currentProgress } = await supabase
        .from('user_progress')
        .select('audio_progress_percentage')
        .eq('user_id', session.user.id)
        .eq('lesson_id', lesson.id)
        .maybeSingle();
      
      const audioProgress = answers.audioProgress || 0;
      const maxAudioProgress = Math.max(audioProgress, currentProgress?.audio_progress_percentage || 0);
      
      const { error: upsertError } = await supabase
        .from('user_progress')
        .upsert({
          user_id: session.user.id,
          lesson_id: lesson.id,
          answers: answers,
          score: score,
          audio_progress_percentage: maxAudioProgress,
          time_spent_seconds: timeSpent,
          status: passed ? 'completed' : 'in_progress',
          completed_at: passed ? new Date().toISOString() : null,
        }, { onConflict: 'user_id,lesson_id' });

      if (upsertError) throw upsertError;

      return { score, passed, feedback: generateFeedback(score) };
    } catch (error: any) {
      console.error('❌ [SUBMIT] Erro:', error);
      toast({ title: "Erro ao enviar respostas", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const testInPlayground = async (prompt: string) => {
    if (!lesson) return null;
    try {
      const { data, error } = await supabase.functions.invoke('lesson-playground', {
        body: { lessonId: lesson.id, prompt },
      });
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Playground error:', error);
      toast({ title: "Erro no playground", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  return { lesson, loading, submitting, submitAnswers, testInPlayground, refetch };
};

// Helper functions
function calculateScore(lessonType: string, content: any, answers: any): number {
  switch (lessonType) {
    case 'guided': {
      const audioProgress = answers.audioProgress || 0;
      const hasExercises = content.exercisesConfig || content.finalPlaygroundConfig;
      if (hasExercises) {
        const allExercisesCompleted = answers.allExercisesCompleted || false;
        return (audioProgress >= 100 && allExercisesCompleted) ? 100 : audioProgress;
      }
      return audioProgress;
    }
    case 'fill-blanks': {
      if (!content.sentences || !Array.isArray(content.sentences)) return 0;
      const correct = content.sentences.filter((s: any, i: number) => {
        const userAnswer = answers[i];
        const correctAnswer = s.correct;
        return JSON.stringify(userAnswer?.sort?.()) === JSON.stringify(correctAnswer?.sort?.());
      }).length;
      return Math.round((correct / content.sentences.length) * 100);
    }
    case 'fill-text': {
      if (!content.exercises || !Array.isArray(content.exercises)) return 0;
      let totalBlanks = 0;
      let correctBlanks = 0;
      content.exercises.forEach((exercise: any, exerciseIdx: number) => {
        const userAnswers = answers[exerciseIdx] || [];
        exercise.blanks.forEach((blank: any, blankIdx: number) => {
          totalBlanks++;
          const userAnswer = (userAnswers[blankIdx] || '').toLowerCase().trim();
          if (blank.keywords.some((keyword: string) => userAnswer.includes(keyword.toLowerCase()))) correctBlanks++;
        });
      });
      return totalBlanks > 0 ? Math.round((correctBlanks / totalBlanks) * 100) : 0;
    }
    case 'drag-drop':
      return JSON.stringify(content.correctOrder) === JSON.stringify(answers) ? 100 : 50;
    case 'quiz-playground':
      return answers.quizCorrect ? 100 : 0;
    case 'flashcards':
      return 100;
    case 'before-after':
      return answers.improved ? 80 : 50;
    default:
      return 0;
  }
}

function generateFeedback(score: number): string {
  if (score === 100) return "🎉 Perfeito! Você dominou este conteúdo!";
  if (score >= 80) return "💪 Muito bem! Continue assim!";
  if (score >= 60) return "👍 Bom trabalho! Revise os pontos que errou.";
  return "📚 Que tal revisar o conteúdo e tentar novamente?";
}
