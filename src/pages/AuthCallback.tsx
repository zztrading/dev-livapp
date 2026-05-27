import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ensureUserRow } from '@/services/users';
import { getPendingPlan } from '@/services/billing';

/**
 * Post-OAuth landing page. Supabase processes the OAuth code at its own
 * /auth/v1/callback, sets the session, then forwards the user here.
 *
 * Responsibilities:
 *  1. Wait for the session to hydrate (SDK reads it from the URL hash).
 *  2. Ensure a public.users row exists for the new identity.
 *  3. Decide where to send the user next:
 *     - pending plan in localStorage → /onboarding/finish (handles Stripe redirect)
 *     - onboarding not completed → /onboarding
 *     - else → returnTo query param or /dashboard
 *  4. On failure (no session even after retry) → /auth?reason=oauth_failed
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Wait briefly for the SDK to hydrate the session from the URL hash. On the
      // OAuth redirect, the session is fresh and may not be in storage on first read.
      let session = null;
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          session = data.session;
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      if (cancelled) return;

      if (!session) {
        navigate('/auth?reason=oauth_failed', { replace: true });
        return;
      }

      try {
        const { onboardingCompleted } = await ensureUserRow(session.user);

        // Priority 1: user picked a plan before signup → continue to Stripe checkout
        // (OnboardingFinish handles the actual redirect + answer flush)
        if (getPendingPlan()) {
          navigate('/onboarding/finish', { replace: true });
          return;
        }

        // Priority 2: new user needs to onboard
        if (!onboardingCompleted) {
          navigate('/onboarding', { replace: true });
          return;
        }

        // Priority 3: honor returnTo, else dashboard
        const dest = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
        navigate(dest, { replace: true });
      } catch (err) {
        console.error('[AuthCallback] post-auth setup failed:', err);
        // User is authenticated but we couldn't write the public.users row.
        // Still send them somewhere usable — Dashboard handles missing rows.
        navigate('/dashboard', { replace: true });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [navigate, returnTo]);

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary-foreground" />
        <p className="text-sm text-primary-foreground/80">Finalizando login...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
