// Anonymous onboarding storage — persists answers in localStorage until signup.
import { supabase } from '@/integrations/supabase/client';

export const ANON_KEY = 'aiv_onboarding_anon_v1';

export interface AnonOnboardingState {
  answers: Record<string, string>;
  profile?: any;
  started_at: string;
}

function safeRead(): AnonOnboardingState {
  try {
    const raw = localStorage.getItem(ANON_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { answers: {}, started_at: new Date().toISOString() };
}

function safeWrite(state: AnonOnboardingState) {
  try {
    localStorage.setItem(ANON_KEY, JSON.stringify(state));
  } catch {}
}

export function getAnonState(): AnonOnboardingState {
  return safeRead();
}

export function setAnonAnswer(questionId: string, value: string) {
  const state = safeRead();
  state.answers[questionId] = value;
  safeWrite(state);
}

export function setAnonProfile(profile: any) {
  const state = safeRead();
  state.profile = profile;
  safeWrite(state);
}

export function clearAnonState() {
  try { localStorage.removeItem(ANON_KEY); } catch {}
}

/**
 * Replay anonymous answers to DB after signup.
 * Idempotent — safe to call multiple times.
 */
export async function flushAnonymousAnswersToDb(userId: string, userEmail?: string, userName?: string) {
  const state = safeRead();
  const answers = state.answers || {};
  if (Object.keys(answers).length === 0) return null;

  // Insert each answer (best-effort; ignore duplicates)
  const rows = Object.entries(answers).map(([question_id, answer_value]) => ({
    user_id: userId,
    question_id,
    answer_value,
  }));

  if (rows.length > 0) {
    await supabase.from('user_onboarding_answers').insert(rows);
  }

  // Upsert profile
  if (state.profile) {
    await supabase.from('user_profiles').upsert({
      user_id: userId,
      age_range: answers['age'],
      main_goal: answers['goal'],
      intimidated_by_ai: answers['intimidated'],
      knowledge_level: answers['knowledge'],
      familiar_tools: answers['tools'] ? answers['tools'].split(',') : [],
      fear_replacement: answers['fear'],
      interest_areas: answers['interests'] ? answers['interests'].split(',') : [],
      readiness_score: state.profile.readiness_score,
      readiness_level: state.profile.readiness_level,
      focus: state.profile.focus,
      priority_trail: state.profile.priority_trail,
      motivation: state.profile.motivation,
      potential: state.profile.potential,
    });
  }

  // Mark onboarding complete on users row (update if exists, insert otherwise)
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existingUser) {
    await supabase
      .from('users')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        profession: answers['goal'] || 'Não informado',
        learning_goal: (answers['goal'] || 'learning') as any,
      })
      .eq('id', userId);
  } else {
    await supabase.from('users').insert([{
      id: userId,
      email: userEmail || '',
      name: userName || 'Usuário',
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      profession: answers['goal'] || 'Não informado',
      learning_goal: (answers['goal'] || 'learning') as any,
    }]);
  }

  clearAnonState();
  return state.profile;
}
