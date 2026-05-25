import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onboardingQuestions } from '@/data/onboardingQuestions';
import { useOnboarding } from '@/hooks/useOnboarding';
import { supabase } from '@/integrations/supabase/client';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { QuestionScreen } from './onboarding/QuestionScreen';
import { ReassuranceScreen } from './onboarding/ReassuranceScreen';
import { LoadingScreen } from './onboarding/LoadingScreen';
import { ProfileScreen } from './onboarding/ProfileScreen';
import { ChallengeScreen } from './onboarding/ChallengeScreen';
import { PricingScreen } from './onboarding/PricingScreen';

type Screen = 'welcome' | 'questions' | 'reassurance' | 'loading' | 'profile' | 'challenge' | 'pricing';

interface UserProfile {
  readiness_score: number;
  readiness_level: string;
  motivation: string;
  potential: string;
  focus: string;
  priority_trail: string;
}

export const OnboardingFlow = () => {
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { saveAnswer, completeOnboarding, createPricingSession } = useOnboarding();

  // Check session — but DO NOT redirect anonymous users to /auth.
  // Anonymous flow is supported; answers persist in localStorage until signup at PricingScreen.
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);

        // Ensure users row exists
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (!userData && !userError) {
          await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.name || 'Usuário',
              onboarding_completed: false,
            });
        } else if (userData?.onboarding_completed) {
          navigate('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setChecking(false);
      }
    };

    init();
  }, [navigate]);

  const handleStart = () => {
    setCurrentScreen('questions');
  };

  const handleAnswer = async (questionId: string, value: string) => {
    await saveAnswer(questionId, value);

    if (questionId === 'fear') {
      setCurrentScreen('reassurance');
      return;
    }

    if (currentQuestionIndex < onboardingQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setCurrentScreen('loading');

      setTimeout(async () => {
        const userProfile = await completeOnboarding();
        setProfile(userProfile);
        setCurrentScreen('profile');
      }, 3000);
    }
  };

  const handleReassuranceContinue = () => {
    setCurrentScreen('questions');
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const handleProfileContinue = () => {
    setCurrentScreen('challenge');
  };

  const handleChallengeContinue = async () => {
    await createPricingSession();
    setCurrentScreen('pricing');
  };

  if (checking) {
    return <LoadingScreen />;
  }

  if (currentScreen === 'welcome') {
    return <WelcomeScreen onStart={handleStart} />;
  }

  if (currentScreen === 'questions') {
    const question = onboardingQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / onboardingQuestions.length) * 100;
    return <QuestionScreen question={question} progress={progress} onAnswer={handleAnswer} />;
  }

  if (currentScreen === 'reassurance') {
    return <ReassuranceScreen onContinue={handleReassuranceContinue} />;
  }

  if (currentScreen === 'loading') {
    return <LoadingScreen />;
  }

  if (currentScreen === 'profile') {
    return <ProfileScreen profile={profile} onContinue={handleProfileContinue} />;
  }

  if (currentScreen === 'challenge') {
    return <ChallengeScreen profile={profile} onContinue={handleChallengeContinue} />;
  }

  if (currentScreen === 'pricing') {
    return <PricingScreen profile={profile} isAuthenticated={isAuthenticated} />;
  }

  return null;
};
