import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive';
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
}

/**
 * Returns the current user's subscription row and stays in sync via Supabase
 * Realtime — when the Stripe webhook flips `status` to 'active' the UI updates
 * without a manual refetch.
 */
export function useSubscription() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['subscription'],
    queryFn: async (): Promise<Subscription | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return (data as Subscription | null) ?? null;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`subscription:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['subscription'] });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  return query;
}

export function isSubscriptionActive(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trialing';
}
