import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setAnonAnswer, setAnonProfile, getAnonState } from '@/lib/onboardingAnonStorage';

interface UserProfile {
  readiness_score: number;
  readiness_level: string;
  motivation: string;
  potential: string;
  focus: string;
  priority_trail: string;
}

export const calculateUserProfile = (answersMap: Record<string, string>): UserProfile => {
  let readinessScore = 0;

  const knowledgeScores: Record<string, number> = {
    'none': 25,
    'beginner': 50,
    'intermediate': 75,
    'advanced': 100
  };
  readinessScore = knowledgeScores[answersMap.knowledge] || 50;

  if (answersMap.intimidated === 'always') readinessScore -= 10;
  if (answersMap.intimidated === 'sometimes') readinessScore -= 5;

  let level = 'Iniciante';
  if (readinessScore > 50 && readinessScore <= 75) level = 'Intermediário';
  if (readinessScore > 75) level = 'Avançado';

  let focus = 'Médio';
  if (readinessScore > 60) focus = 'Alto';
  if (readinessScore < 40) focus = 'Limitado';

  const goalToTrail: Record<string, string> = {
    'income': 'rendaExtra',
    'growth': 'negocios',
    'productivity': 'diaADia',
    'future': 'fundamentos',
    'learning': 'fundamentos'
  };

  return {
    readiness_score: readinessScore,
    readiness_level: level,
    focus,
    priority_trail: goalToTrail[answersMap.goal] || 'fundamentos',
    motivation: 'Alta',
    potential: 'Alto'
  };
};

export const useOnboarding = () => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const saveAnswer = async (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Anonymous flow — persist to localStorage
        setAnonAnswer(questionId, value);
        return;
      }

      await supabase
        .from('user_onboarding_answers')
        .insert({
          user_id: user.id,
          question_id: questionId,
          answer_value: value
        });
    } catch (error) {
      console.error('Failed to save answer:', error);
      // Fallback to anonymous storage
      setAnonAnswer(questionId, value);
    }
  };

  const completeOnboarding = async (): Promise<UserProfile> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Anonymous flow — compute profile locally, persist to localStorage
      if (!user) {
        const answersMap = getAnonState().answers || {};
        const profile = calculateUserProfile(answersMap);
        setAnonProfile(profile);
        return profile;
      }

      // Authenticated flow
      const { data: answersData } = await supabase
        .from('user_onboarding_answers')
        .select('question_id, answer_value')
        .eq('user_id', user.id)
        .order('answered_at');

      const answersMap = (answersData || []).reduce((acc: any, row: any) => {
        acc[row.question_id] = row.answer_value;
        return acc;
      }, {});

      const profile = calculateUserProfile(answersMap);

      await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          age_range: answersMap['age'],
          main_goal: answersMap['goal'],
          intimidated_by_ai: answersMap['intimidated'],
          knowledge_level: answersMap['knowledge'],
          familiar_tools: answersMap['tools'] ? answersMap['tools'].split(',') : [],
          fear_replacement: answersMap['fear'],
          interest_areas: answersMap['interests'] ? answersMap['interests'].split(',') : [],
          readiness_score: profile.readiness_score,
          readiness_level: profile.readiness_level,
          focus: profile.focus,
          priority_trail: profile.priority_trail,
          motivation: profile.motivation,
          potential: profile.potential
        });

      await supabase
        .from('users')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          profession: answersMap['goal'] || 'Não informado',
          learning_goal: answersMap['goal'] || 'learning'
        })
        .eq('id', user.id);

      return profile;
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createPricingSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null; // Anonymous — skip; pricing session created post-signup if needed

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await supabase
        .from('pricing_sessions')
        .insert({
          user_id: user.id,
          session_token: sessionToken,
          discount_percentage: 50,
          expires_at: expiresAt.toISOString()
        });

      return { sessionToken, expiresAt };
    } catch (error) {
      console.error('Failed to create pricing session:', error);
      return null;
    }
  };

  return { answers, saveAnswer, completeOnboarding, createPricingSession, loading };
};
