import type { PlanId } from '@/services/billing';

/**
 * Feature flags — what each plan grants access to.
 *
 * TODO(product): Audit which routes/components serve paid content and assign
 * the correct feature here. The mapping below is a placeholder starting point.
 * Decisions need product input — talk to Fernando before relying on these.
 */
export type Feature =
  | 'basic_lessons'      // free tier content (also granted to all paid plans)
  | 'pro_lessons'        // V8/V10 lessons, advanced content
  | 'elite_lessons'      // Elite-exclusive content + early access
  | 'ai_playground'      // /ai-playground route
  | 'mentorship'         // 1:1 mentorship (Elite only)
  | 'certificate'        // certification feature
  | 'unlimited_missions';

const PLAN_FEATURES: Record<PlanId, Feature[]> = {
  starter: [
    'basic_lessons',
    'ai_playground',
  ],
  pro: [
    'basic_lessons',
    'pro_lessons',
    'ai_playground',
    'certificate',
    'unlimited_missions',
  ],
  elite: [
    'basic_lessons',
    'pro_lessons',
    'elite_lessons',
    'ai_playground',
    'mentorship',
    'certificate',
    'unlimited_missions',
  ],
};

/** Plans that grant access to the given feature, ordered cheapest → most expensive. */
const PLANS_FOR_FEATURE: Record<Feature, PlanId[]> = (() => {
  const map = {} as Record<Feature, PlanId[]>;
  for (const plan of Object.keys(PLAN_FEATURES) as PlanId[]) {
    for (const feature of PLAN_FEATURES[plan]) {
      if (!map[feature]) map[feature] = [];
      map[feature].push(plan);
    }
  }
  return map;
})();

/**
 * Does the given plan grant the given feature?
 * Returns false if planId is null/unknown or feature isn't on the plan.
 */
export function planGrants(planId: PlanId | string | null | undefined, feature: Feature): boolean {
  if (!planId) return false;
  const features = PLAN_FEATURES[planId as PlanId];
  if (!features) return false;
  return features.includes(feature);
}

/**
 * The cheapest plan that grants this feature — useful for "Upgrade to X" prompts.
 * Returns null if no plan grants it (shouldn't happen with valid Feature type).
 */
export function cheapestPlanForFeature(feature: Feature): PlanId | null {
  const plans = PLANS_FOR_FEATURE[feature];
  return plans?.[0] ?? null;
}

/** Human-readable plan name — for UI use. */
export const PLAN_DISPLAY_NAMES: Record<PlanId, string> = {
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
};
