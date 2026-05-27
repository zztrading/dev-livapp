-- Adds columns to track scheduled plan changes (downgrades) on subscriptions.
-- See STRIPE-PLAN-CHANGE-FLOW.md for the design.

alter table public.subscriptions
  add column if not exists pending_plan_id text references public.plans(id),
  add column if not exists pending_change_at timestamptz,
  add column if not exists stripe_subscription_schedule_id text unique;

create index if not exists idx_subscriptions_pending_change_at
  on public.subscriptions(pending_change_at)
  where pending_change_at is not null;
