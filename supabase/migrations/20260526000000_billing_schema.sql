-- Billing schema for YesLiv (Stripe BR integration)
-- Plans: Starter (R$97/mo), Pro (R$197/mo), Elite (R$397/mo)

create table if not exists public.plans (
  id text primary key,                          -- 'starter' | 'pro' | 'elite'
  name text not null,
  stripe_price_id text not null unique,
  amount_cents integer not null,
  currency text not null default 'brl',
  interval text not null default 'month',
  interval_count integer not null default 1,
  features jsonb not null default '[]'::jsonb,
  badge text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_id text references public.plans(id),
  status text not null default 'inactive',     -- active|trialing|past_due|canceled|inactive
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_subscriptions_stripe_customer on public.subscriptions(stripe_customer_id);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payment_intent_id text unique,
  stripe_invoice_id text,
  amount_cents integer not null,
  currency text not null,
  status text not null,
  receipt_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_user on public.payments(user_id, created_at desc);

-- RLS
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "plans readable by all" on public.plans;
create policy "plans readable by all" on public.plans
  for select using (true);

drop policy if exists "users read own subscription" on public.subscriptions;
create policy "users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "users read own payments" on public.payments;
create policy "users read own payments" on public.payments
  for select using (auth.uid() = user_id);

-- stripe_webhook_events: NO policy → service role only

create or replace function public.touch_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_subscriptions_updated_at();

-- Seed plans (placeholder Stripe Price IDs — run scripts/stripe-seed-products.ts then
-- UPDATE plans SET stripe_price_id = 'price_xxx' WHERE id = 'starter'; (etc.))
insert into public.plans (id, name, stripe_price_id, amount_cents, interval, interval_count, badge, display_order, features) values
  ('starter', 'Starter', 'price_REPLACE_STARTER',  9700, 'month', 1, null,                       1, '["Acesso à plataforma","Conteúdo básico","Suporte por e-mail"]'::jsonb),
  ('pro',     'Pro',     'price_REPLACE_PRO',     19700, 'month', 1, E'\U0001F451 MAIS POPULAR!', 2, '["Tudo do Starter","Conteúdo completo","Suporte prioritário"]'::jsonb),
  ('elite',   'Elite',   'price_REPLACE_ELITE',   39700, 'month', 1, null,                       3, '["Tudo do Pro","Mentoria 1:1","Acesso antecipado a novidades"]'::jsonb)
on conflict (id) do nothing;
