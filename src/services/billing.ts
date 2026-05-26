import { supabase } from '@/integrations/supabase/client';

export const PENDING_PLAN_KEY = 'yesliv_pending_plan_v1';

export type PlanId = 'starter' | 'pro' | 'elite';

export interface CheckoutResult {
  url: string;
  session_id: string;
}

/**
 * Kick off a Stripe Checkout session for the authenticated user.
 * Caller is responsible for `window.location.href = url` (Stripe-hosted page).
 */
export async function startCheckout(planId: PlanId | string): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke<CheckoutResult>(
    'create-checkout-session',
    { body: { plan_id: planId } },
  );

  if (error) {
    throw new Error(error.message || 'Failed to create checkout session');
  }
  if (!data?.url) {
    throw new Error('Checkout session returned no URL');
  }
  return data;
}

/**
 * Anonymous users select a plan before signup. We stash the plan id in
 * localStorage so OnboardingFinish can pick it up and call startCheckout
 * immediately after the account is created.
 */
export function setPendingPlan(planId: PlanId | string): void {
  try {
    localStorage.setItem(PENDING_PLAN_KEY, planId);
  } catch {
    // localStorage unavailable — degrade silently
  }
}

export function getPendingPlan(): string | null {
  try {
    return localStorage.getItem(PENDING_PLAN_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPlan(): void {
  try {
    localStorage.removeItem(PENDING_PLAN_KEY);
  } catch {
    // ignore
  }
}
