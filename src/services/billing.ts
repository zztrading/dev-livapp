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

// ─── Plan change (upgrade / downgrade / cancel scheduled downgrade) ──────────

export interface PlanChangeResult {
  ok: boolean;
  action?: 'upgraded' | 'downgrade_scheduled';
  effective_at?: string;
  message: string;
}

async function invokePlanChange(
  action: 'upgrade' | 'downgrade' | 'cancel_downgrade',
  planId?: PlanId | string,
): Promise<PlanChangeResult> {
  const body: Record<string, unknown> = { action };
  if (planId) body.plan_id = planId;

  const { data, error } = await supabase.functions.invoke<PlanChangeResult>(
    'change-subscription-plan',
    { body },
  );

  if (error) throw new Error(error.message || 'Plan change failed');
  if (!data) throw new Error('Plan change returned no response');
  return data;
}

/** Upgrade to a higher tier — applied immediately with prorated invoice. */
export function upgradeSubscription(planId: PlanId | string): Promise<PlanChangeResult> {
  return invokePlanChange('upgrade', planId);
}

/** Downgrade to a lower tier — applied at end of current billing period. */
export function downgradeSubscription(planId: PlanId | string): Promise<PlanChangeResult> {
  return invokePlanChange('downgrade', planId);
}

/** Cancel a previously scheduled downgrade — user stays on current plan. */
export function cancelScheduledDowngrade(): Promise<PlanChangeResult> {
  return invokePlanChange('cancel_downgrade');
}

// ─── Stripe Customer Portal (cancel, update card, view invoices) ─────────────

/**
 * Opens the Stripe-hosted Customer Portal in the current tab.
 * Stripe handles cancellation, payment-method updates, invoice viewing, etc.
 * On exit the user returns to /profile (configured server-side).
 */
export async function openCustomerPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'create-customer-portal-session',
    { body: {} },
  );

  if (error) throw new Error(error.message || 'Failed to open customer portal');
  if (!data?.url) throw new Error('Customer portal returned no URL');

  window.location.href = data.url;
}
