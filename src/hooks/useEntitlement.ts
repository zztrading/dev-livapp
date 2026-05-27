import { useSubscription, isSubscriptionActive } from '@/hooks/useSubscription';
import { planGrants, type Feature } from '@/services/entitlements';

export interface EntitlementResult {
  /** Whether the user can access this feature right now */
  allowed: boolean;
  /** Whether the subscription data is still loading */
  loading: boolean;
  /** The user's current active plan ID, or null if no active subscription */
  planId: string | null;
  /** Whether the user has any active subscription at all (regardless of feature) */
  hasAnySubscription: boolean;
}

/**
 * Resolves whether the current user is entitled to a given feature.
 *
 * Logic:
 *  - subscription.status ∈ {active, trialing} → check planGrants(planId, feature)
 *  - subscription.status === 'past_due' → keep access (Stripe smart-retry window)
 *  - otherwise → no access
 *
 * This is the FRONTEND gate (UX). Real security must also be enforced at the
 * backend with RLS policies that check subscriptions.status server-side.
 */
export function useEntitlement(feature: Feature): EntitlementResult {
  const { data: subscription, isLoading } = useSubscription();

  const planId = subscription?.plan_id ?? null;
  const hasAnySubscription = !!subscription && isSubscriptionActive(subscription);

  // Grant access during past_due (Stripe smart-retry grace window) — losing
  // access on first failed retry would feel punitive.
  const effectiveActive = hasAnySubscription || subscription?.status === 'past_due';

  const allowed = effectiveActive && planGrants(planId, feature);

  return {
    allowed,
    loading: isLoading,
    planId,
    hasAnySubscription,
  };
}
