import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { flushAnonymousAnswersToDb, clearAnonState } from '@/lib/onboardingAnonStorage';
import { LoadingScreen } from '@/components/onboarding/LoadingScreen';

/**
 * Post-signup finalizer:
 * - Replays anonymous onboarding answers from localStorage into the DB
 * - Marks onboarding complete
 * - Redirects to /dashboard
 *
 * If user is not signed in, sends them to /auth.
 */
const OnboardingFinish = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const finish = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth?mode=signup&returnTo=/onboarding/finish', { replace: true });
          return;
        }

        await flushAnonymousAnswersToDb(
          user.id,
          user.email || '',
          (user.user_metadata as any)?.name || 'Usuário'
        );
      } catch (err) {
        console.error('[OnboardingFinish] flush failed:', err);
        clearAnonState();
      } finally {
        navigate('/dashboard', { replace: true });
      }
    };

    finish();
  }, [navigate]);

  return <LoadingScreen />;
};

export default OnboardingFinish;
