import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useEntitlement } from '@/hooks/useEntitlement';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { type Feature } from '@/services/entitlements';

interface EntitlementGateProps {
  feature: Feature;
  children: ReactNode;
  /**
   * Custom fallback when user is not entitled. Defaults to <UpgradePrompt feature={...} />.
   */
  fallback?: ReactNode;
  /**
   * Custom loading UI. Defaults to a centered spinner.
   */
  loadingFallback?: ReactNode;
}

/**
 * Renders children only if the current user is entitled to the given feature.
 * Shows <UpgradePrompt /> otherwise.
 *
 * Frontend-only gate. Real security MUST be enforced at the backend via RLS
 * policies that check subscriptions.status + plan_id server-side.
 *
 * Usage:
 *   <EntitlementGate feature="pro_lessons">
 *     <V10LessonPlayer />
 *   </EntitlementGate>
 */
export function EntitlementGate({
  feature,
  children,
  fallback,
  loadingFallback,
}: EntitlementGateProps) {
  const { allowed, loading } = useEntitlement(feature);

  if (loading) {
    return (
      loadingFallback ?? (
        <div className="min-h-[400px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )
    );
  }

  if (!allowed) {
    return <>{fallback ?? <UpgradePrompt feature={feature} />}</>;
  }

  return <>{children}</>;
}
