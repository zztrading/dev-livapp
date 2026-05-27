import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { flushAnonymousAnswersToDb, clearAnonState } from '@/lib/onboardingAnonStorage';
import { LoadingScreen } from '@/components/onboarding/LoadingScreen';
import { getPendingPlan, clearPendingPlan, startCheckout } from '@/services/billing';

/**
 * Post-signup finalizer:
 * - Replays anonymous onboarding answers from localStorage into the DB
 * - Marks onboarding complete
 * - If a pending plan was selected pre-signup → starts Stripe Checkout
 * - Otherwise redirects to /dashboard
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

        // If the user picked a plan before signing up, kick off Stripe Checkout now.
        const pendingPlan = getPendingPlan();
        if (pendingPlan) {
          try {
            const { url } = await startCheckout(pendingPlan);
            // pendingPlan is cleared by BillingSuccess after Stripe redirects back.
            window.location.href = url;
            return;
          } catch (err) {
            console.error('[OnboardingFinish] startCheckout failed:', err);
            clearPendingPlan();
            // Fall through to dashboard so the user isn't stuck.
          }
        }
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
