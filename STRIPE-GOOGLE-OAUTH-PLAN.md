# Implementation Plan — Stripe BR + Google OAuth

**Project:** `intel-ignite-pro` (Aluri)
**Date:** 2026-05-24 (revised after codebase re-scan)
**Owner:** TBD
**Status:** Draft v2 — awaiting clarification on plan structure

---

## What changed in v2 vs v1

After re-scanning the codebase, three findings forced a rewrite:

1. **Existing anonymous-onboarding initiative.** [.lovable/plan.md](.lovable/plan.md) describes an active refactor where landing CTAs go to `/onboarding` (no auth required), answers are stored in `localStorage`, and the signup gate is at [PricingScreen.tsx](src/components/onboarding/PricingScreen.tsx). Post-signup, `/onboarding/finish` replays answers into the DB. **Stripe must integrate with this flow, not replace it.**
2. **PricingScreen already exists.** v1 said "create `src/pages/Pricing.tsx`" — wrong. Real work is **wiring [PricingScreen.tsx](src/components/onboarding/PricingScreen.tsx) to a real Stripe checkout** and respecting the existing `isAuthenticated` branching.
3. **Live plan structure ≠ task spec.** The component shows period plans (1/4/12 weeks at R$13.90 / R$39.80 / R$79.60), not "Basic/Ultra/Pro" monthly tiers. **Blocking question — see § Open Questions.**

Additionally noted from [MIGRATION.md](MIGRATION.md) + [RUNBOOK.md](RUNBOOK.md): project is migrating off Lovable. Canonical workflow uses `supabase migration new` / `supabase db push` / `supabase gen types typescript`. New work must follow it.

---

## Context

**Stack:**
- Vite + React 18 + TypeScript
- Supabase (Auth + Postgres + Edge Functions on Deno) — project ref `pspvppymcdjbwsudxzdx`
- TanStack Query, shadcn/ui, React Router v6
- Auth in [src/pages/Auth.tsx](src/pages/Auth.tsx) is email/password only
- Edge Functions follow [supabase/functions/_shared/auth.ts](supabase/functions/_shared/auth.ts) (`requireUser`, `requireAdmin`)
- 61 edge functions, 171 migrations (per [MIGRATION.md](MIGRATION.md))
- **No Stripe code today**
- Active flows that touch Stripe scope:
  - [PricingScreen.tsx](src/components/onboarding/PricingScreen.tsx) — current fake CTA → `/dashboard`
  - [.lovable/plan.md](.lovable/plan.md) — anonymous-first onboarding spec
  - [src/pages/Auth.tsx](src/pages/Auth.tsx) — already supports `returnTo` query param (used by PricingScreen)

**Goal:** Ship 6 deliverables:
1. Stripe BR sandbox setup + 3 test products
2. Google Cloud OAuth client + consent screen
3. Stripe checkout end-to-end for all 3 plans
4. Stripe webhooks (signed + idempotent), subscription state in DB
5. Google OAuth integrated in frontend (signup + login)
6. Automatic Stripe receipts + branded payment-confirmation email

---

## Open Questions (BLOCKING — resolve before Phase 0)

| # | Question | Why it blocks |
|---|---|---|
| Q1 | Is the Stripe account BR-domiciled or US-domiciled? | Determines if BRL charges are legal on this account |
| Q2 | Plan structure: **monthly recurring** (Basic/Ultra/Pro per task spec) OR **period-based** (1/4/12 weeks per current UI)? | Drives data model, Stripe Price recurring config, webhook event handling, refund/cancel policy |
| Q3 | If period-based: is "12 Semanas" a single one-time payment with access expiring after 12 weeks, OR a 3-month subscription that auto-renews? | Stripe `mode: 'payment'` vs `mode: 'subscription'` |
| Q4 | Plan amounts final? UI shows R$13.90/39.80/79.60 — task description implies different tiers | Stripe Price creation |
| Q5 | Email provider — Resend / Postmark / SES / other? | Edge function dependency + secret |
| Q6 | Staging URL for `APP_URL` and OAuth redirect | OAuth client config + Stripe success_url |
| Q7 | Does the post-Lovable hosting (Vercel?) already provide a staging domain? | Same as Q6 |

**v2 plan below assumes** (pending confirmation): period-based plans, all `mode: 'subscription'` with weekly billing intervals to match the UI. If Q3 answer is "one-time", swap `mode: 'subscription'` → `mode: 'payment'` and drop `customer.subscription.*` webhook events.

---

## Phase 0 — Prerequisites (do once, before any code)

| # | Action | Where |
|---|---|---|
| 0.1 | Create Stripe **test** account in BR mode (BRL currency) | dashboard.stripe.com |
| 0.2 | Enable **Test Mode**; grab `sk_test_...`, `pk_test_...` | Stripe → Developers → API keys |
| 0.3 | Add secrets to Supabase Edge Functions via CLI (see RUNBOOK.md) | `supabase secrets set ... --project-ref pspvppymcdjbwsudxzdx` |
| 0.4 | Create Google Cloud project + OAuth consent screen (External, "In testing") | console.cloud.google.com |
| 0.5 | Add Fernando as test user on consent screen | GCP → OAuth consent screen → Test users |
| 0.6 | Create OAuth 2.0 Client ID (Web app). Authorized redirect URI: `https://pspvppymcdjbwsudxzdx.supabase.co/auth/v1/callback` | GCP → Credentials |
| 0.7 | Supabase Dashboard → Authentication → Providers → enable **Google**, paste Client ID + Secret | Supabase |

**Secrets to add to Supabase Edge Functions:**
```bash
supabase secrets set STRIPE_SECRET_KEY="sk_test_..." --project-ref pspvppymcdjbwsudxzdx
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..." --project-ref pspvppymcdjbwsudxzdx
supabase secrets set APP_URL="https://staging.aluri.app" --project-ref pspvppymcdjbwsudxzdx
supabase secrets set RESEND_API_KEY="re_..." --project-ref pspvppymcdjbwsudxzdx
supabase secrets set RESEND_FROM_EMAIL="billing@aluri.app" --project-ref pspvppymcdjbwsudxzdx
```

**Frontend `.env` additions** ([.env](.env)):
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Also add same vars to `.env.example` (per [docs/migration/02-secrets.md](docs/migration/02-secrets.md) guidance — never commit real `.env`).

---

## Phase 1 — Database schema (foundation for Tasks 1 + 4)

**Create migration:**
```bash
supabase migration new billing_schema
# edits supabase/migrations/<timestamp>_billing_schema.sql
```

**Schema (revised for period-based plans):**

```sql
-- 1. Plans catalog (source of truth, mirrors Stripe Prices)
create table public.plans (
  id text primary key,                       -- 'week_1' | 'week_4' | 'week_12'
  name text not null,                        -- '1 Semana' | '4 Semanas' | '12 Semanas'
  stripe_price_id text not null unique,
  amount_cents integer not null,             -- 1390 | 3980 | 7960
  currency text not null default 'brl',
  interval text not null,                    -- 'week' (Stripe accepts week/month/year)
  interval_count integer not null default 1, -- 1 / 4 / 12
  features jsonb not null default '[]'::jsonb,
  badge text,                                -- '👑 MAIS POPULAR!' for week_4
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Per-user subscription state (1 row per user, upserted by webhook)
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_id text references public.plans(id),
  status text not null default 'inactive',   -- active|trialing|past_due|canceled|inactive
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 3. Webhook idempotency (prevents double-processing)
create table public.stripe_webhook_events (
  event_id text primary key,                 -- Stripe's evt_... id
  type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb
);

-- 4. Payment history (for receipts page)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payment_intent_id text unique,
  stripe_invoice_id text,
  amount_cents integer not null,
  currency text not null,
  status text not null,                      -- succeeded|failed|refunded
  receipt_url text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy "plans readable by all" on public.plans
  for select using (true);

create policy "users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "users read own payments" on public.payments
  for select using (auth.uid() = user_id);

-- webhook_events: no policy → service role only

-- Seed plans (replace stripe_price_id after Phase 2)
insert into public.plans (id, name, stripe_price_id, amount_cents, interval, interval_count, badge, display_order) values
  ('week_1',  '1 Semana',   'price_REPLACE_W1',  1390, 'week', 1,  null,              1),
  ('week_4',  '4 Semanas',  'price_REPLACE_W4',  3980, 'week', 4,  '👑 MAIS POPULAR!', 2),
  ('week_12', '12 Semanas', 'price_REPLACE_W12', 7960, 'week', 12, null,              3);
```

After applying migration: `supabase gen types typescript --project-id pspvppymcdjbwsudxzdx > src/integrations/supabase/types.ts` (per [RUNBOOK.md](RUNBOOK.md)).

---

## Phase 2 — Stripe Test Products (Task 1)

**New file:** [scripts/stripe-seed-products.ts](scripts/stripe-seed-products.ts)

```ts
// Run with: STRIPE_SECRET_KEY=sk_test_... deno run -A scripts/stripe-seed-products.ts
import Stripe from "npm:stripe@17";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const plans = [
  { id: "week_1",  name: "Aluri — 1 Semana",   amount: 1390, interval_count: 1  },
  { id: "week_4",  name: "Aluri — 4 Semanas",  amount: 3980, interval_count: 4  },
  { id: "week_12", name: "Aluri — 12 Semanas", amount: 7960, interval_count: 12 },
];

for (const p of plans) {
  const product = await stripe.products.create({
    name: p.name,
    metadata: { plan_id: p.id, brand: "aluri" },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "brl",
    unit_amount: p.amount,
    recurring: { interval: "week", interval_count: p.interval_count },
    metadata: { plan_id: p.id },
  });
  console.log(`${p.id}\t${price.id}`);
}
```

Then write a follow-up migration updating `plans.stripe_price_id` with the printed IDs (or use SQL editor for the test seed and only migration-track production seed).

**Acceptance:** Stripe Dashboard → Products shows 3 products in BRL. `select id, stripe_price_id from plans` returns 3 rows with real IDs.

---

## Phase 3 — Edge Function: `create-checkout-session` (Task 3)

**New folder:** `supabase/functions/create-checkout-session/`
- `index.ts` — handler
- (no `_shared` changes — reuse `requireUser`)

**Responsibilities:**
1. Auth via `requireUser` from [supabase/functions/_shared/auth.ts](supabase/functions/_shared/auth.ts).
2. Read `plan_id` from request body; look up `stripe_price_id` from `plans` table (service-role client).
3. Find-or-create Stripe Customer keyed by `user.email`; persist `stripe_customer_id` to `subscriptions`.
4. Create Checkout Session:
   ```ts
   {
     mode: 'subscription',
     payment_method_types: ['card'],
     line_items: [{ price: stripe_price_id, quantity: 1 }],
     customer: customerId,
     success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${APP_URL}/billing/cancel`,
     metadata: { user_id, plan_id },
     subscription_data: { metadata: { user_id, plan_id } },  // critical — webhook reads this
     locale: 'pt-BR',
     automatic_tax: { enabled: false },
     payment_intent_data: { receipt_email: user.email },     // Task 6 — Stripe receipt
   }
   ```
5. Return `{ url: session.url }`.

**Add to [supabase/config.toml](supabase/config.toml):**
```toml
[functions.create-checkout-session]
verify_jwt = true
```

---

## Phase 4 — Edge Function: `stripe-webhook` (Task 4)

**New folder:** `supabase/functions/stripe-webhook/`

**Hard requirements:**
1. `verify_jwt = false` — Stripe doesn't send Supabase JWTs.
2. Signature verification via `stripe.webhooks.constructEventAsync` (the **async** variant — Deno's Web Crypto rejects the sync version).
3. **Idempotency:** insert `event.id` into `stripe_webhook_events`. PK conflict (`23505`) → return 200 without re-processing.
4. Service-role Supabase client for all writes.
5. Return **200** on success or idempotent skip. **4xx** only on signature failure.

**Events handled:**
| Event | Action |
|---|---|
| `checkout.session.completed` | Upsert `subscriptions` with `stripe_subscription_id`, `current_period_end`, `plan_id`, status=`active` |
| `customer.subscription.updated` | Sync status, period end, `cancel_at_period_end` |
| `customer.subscription.deleted` | status = `canceled` |
| `invoice.payment_succeeded` | Insert into `payments`; trigger branded receipt email (Task 6) |
| `invoice.payment_failed` | status = `past_due` |

**Skeleton:**
```ts
import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (e) {
    return new Response(`Bad signature: ${e.message}`, { status: 400 });
  }

  const { error: dupErr } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, type: event.type, payload: event as any });
  if (dupErr?.code === "23505") return new Response("ok (duplicate)", { status: 200 });

  switch (event.type) {
    case "checkout.session.completed": { /* upsert subscriptions */ break; }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": { /* sync */ break; }
    case "invoice.payment_succeeded":   { /* insert payments + send email */ break; }
    case "invoice.payment_failed":      { /* mark past_due */ break; }
  }
  return new Response("ok", { status: 200 });
});
```

**Add to [supabase/config.toml](supabase/config.toml):**
```toml
[functions.stripe-webhook]
verify_jwt = false
```

**Local testing:** `stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook`
**Production:** Stripe Dashboard → Webhooks → endpoint `https://pspvppymcdjbwsudxzdx.supabase.co/functions/v1/stripe-webhook`. Subscribe to the 5 events above.

---

## Phase 5 — Frontend wiring (Task 3) — **revised for existing components**

This is the section that diverged most from v1. We do **NOT** create a new `Pricing.tsx`. We modify the existing onboarding flow.

### 5a. Wire [PricingScreen.tsx](src/components/onboarding/PricingScreen.tsx) to real Stripe

Replace the toast-only `handleSelectPlan` with:
```ts
const handleSelectPlan = async (planId: string, planName: string) => {
  if (!isAuthenticated) {
    // Existing flow — store intent + redirect to signup
    localStorage.setItem('aiv_pending_plan', planId);
    toast({ title: `Plano ${planName} reservado!`, description: 'Crie sua conta para finalizar.' });
    setTimeout(() => navigate('/auth?mode=signup&returnTo=/onboarding/finish'), 600);
    return;
  }
  // Authenticated — go straight to Stripe Checkout
  const { url } = await startCheckout(planId);
  window.location.href = url;
};
```

The `plans` array needs a stable `id` (`week_1` / `week_4` / `week_12`) matched to the DB.

### 5b. New helper [src/services/billing.ts](src/services/billing.ts)
```ts
export async function startCheckout(planId: string): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { plan_id: planId },
  });
  if (error) throw error;
  return data;
}
```

### 5c. New hook [src/hooks/useSubscription.ts](src/hooks/useSubscription.ts)
TanStack Query reading `public.subscriptions` for the current user. Supports Supabase Realtime subscription on the row so UI flips to "active" the moment the webhook updates it.

### 5d. Two new pages
- [src/pages/BillingSuccess.tsx](src/pages/BillingSuccess.tsx) — landing after Checkout success. Polls / Realtimes `subscriptions` until `status='active'`. Falls back to navigate `/dashboard` after 5s even if poll fails (webhook may lag).
- [src/pages/BillingCancel.tsx](src/pages/BillingCancel.tsx) — minimal "no charge made" page with retry CTA.

### 5e. Update `/onboarding/finish` (defined in [.lovable/plan.md](.lovable/plan.md))

The `.lovable` plan already specifies this route. Add one step to its flow:
1. Replay `aiv_onboarding_answers` to DB (existing spec).
2. **NEW:** if `aiv_pending_plan` exists in localStorage → call `startCheckout(plan)` → redirect to Stripe. Otherwise → `/dashboard`.

### 5f. Register routes in [src/App.tsx](src/App.tsx)
```tsx
<Route path="/billing/success" element={<BillingSuccess />} />
<Route path="/billing/cancel" element={<BillingCancel />} />
```

**Acceptance:**
- Anonymous user finishes onboarding → clicks plan → signs up → lands on Stripe Checkout (no manual click on Pricing again).
- Authenticated user opens onboarding/Pricing → clicks plan → goes straight to Stripe Checkout.
- `4242 4242 4242 4242` completes → returns to `/billing/success` → row visible in `subscriptions` within ~3s.

---

## Phase 6 — Google OAuth (Tasks 2 + 5)

Supabase handles the OAuth dance — we add the button + handle the callback + respect `returnTo`.

### 6a. Modify [src/pages/Auth.tsx](src/pages/Auth.tsx)

Add Google button above the email/password tabs (both login and signup):
```tsx
<Button
  type="button"
  variant="outline"
  className="w-full"
  disabled={loading}
  onClick={handleGoogleSignIn}
>
  <GoogleIcon className="mr-2 h-4 w-4" />
  Continuar com Google
</Button>
<div className="flex items-center gap-2 my-4">
  <Separator className="flex-1" />
  <span className="text-xs text-muted-foreground">ou</span>
  <Separator className="flex-1" />
</div>
```

Handler — **must respect existing `returnTo` param** used by PricingScreen:
```ts
const returnTo = searchParams.get('returnTo') || redirectTo;

const handleGoogleSignIn = async () => {
  setLoading(true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
};
```

### 6b. New file [src/pages/AuthCallback.tsx](src/pages/AuthCallback.tsx)

1. Read session.
2. Ensure row exists in `public.users` (extract from [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) into a shared `ensureUserRow()` in [src/services/users.ts](src/services/users.ts) to remove duplication).
3. Route to `returnTo` param (defaults to `/onboarding` for new users without `onboarding_completed`, else `/dashboard`).

### 6c. Register route in [src/App.tsx](src/App.tsx)
```tsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

**Acceptance:** Click "Continuar com Google" in staging → Google consent → returns to app authenticated → row exists in `auth.users` + `public.users`. `returnTo=/onboarding/finish` continues correctly into the Stripe flow.

---

## Phase 7 — Receipts + Email (Task 6)

### 7a. Stripe receipt (automatic)
Set `payment_intent_data.receipt_email = user.email` in `create-checkout-session` (already in Phase 3). Enable in Stripe Dashboard → Settings → Emails → "Successful payments".

### 7b. Branded confirmation email
**New file:** `supabase/functions/_shared/email.ts` — wrapper over Resend API (assuming Q5 answer is Resend; trivially swappable).

In `stripe-webhook` on `invoice.payment_succeeded`:
```ts
await sendBrandedReceipt({
  to: invoice.customer_email!,
  planName: <lookup from plans>,
  amountBrl: invoice.amount_paid / 100,
  invoicePdfUrl: invoice.hosted_invoice_url,
});
```

**HTML template** (inline in `email.ts`): Aluri logo, "Pagamento confirmado", plan name, amount in BRL, link to Stripe-hosted invoice PDF, support email.

**Why a separate provider:** Supabase's built-in SMTP is for auth emails only. Transactional receipts need Resend/Postmark/SES.

---

## Phase 8 — Verification matrix

| Task | How to verify |
|---|---|
| 1. Sandbox + 3 plans | `select * from plans` → 3 rows; Stripe Dashboard → Products shows 3 in test mode |
| 2. Google OAuth | OAuth client in GCP Credentials; consent screen "In testing" with Fernando |
| 3. Checkout E2E | Manual run all 3 plans with `4242 4242 4242 4242`; Stripe Dashboard → Payments shows BRL charges |
| 4. Webhooks signed + idempotent | `stripe trigger checkout.session.completed` twice → exactly **one** row in `payments`; `stripe_webhook_events` has 1 row per `event.id` |
| 5. Google login (staging) | Sign up with Google → log out → log back in → same `users.id`; check `auth.identities` table; verify `returnTo` chain through `/onboarding/finish` |
| 6. Receipts | After paid checkout: (a) Stripe email arrives, (b) Resend dashboard shows branded email delivered |

**Pre-commit gates ([CLAUDE.md](CLAUDE.md)):**
- `npx tsc --noEmit` → zero errors
- Deno check on edge functions
- After migration: `supabase gen types typescript ...` and commit the regenerated [types.ts](src/integrations/supabase/types.ts)

---

## Phase 9 — Execution order

1. **Open Questions** Q1–Q7 answered (BLOCKING).
2. **Phase 0** — secrets, GCP, Stripe account.
3. **Phase 1** (DB migration) → **Phase 2** (seed Stripe products) → update `plans.stripe_price_id`.
4. **Phase 6** (Google OAuth) — independent, ship in parallel.
5. **Phase 3** (`create-checkout-session`).
6. **Phase 5** (frontend wiring: PricingScreen + onboarding/finish + Success/Cancel).
7. **Phase 4** (webhook) — needs real checkout sessions for testing.
8. **Phase 7** (branded receipts) — bolted onto webhook.
9. **Phase 8** (verification matrix).

---

## Risks / gotchas

| Risk | Mitigation |
|---|---|
| Stripe account US-domiciled, charging BRL → tax/legal issue | Confirm Q1 before any Stripe work |
| Webhook signature fails on Deno with sync `constructEvent` | Use `constructEventAsync` only |
| Webhook replays creating duplicate payments | PK on `stripe_webhook_events.event_id` — checked **first**, before any side effect |
| Idempotency keyed on `payment_intent_id` (wrong) — same PI across success+failure events | Idempotency must be on `event.id` |
| PricingScreen redesign in `.lovable/plan.md` breaks our wiring | Coordinate with author of [.lovable/plan.md](.lovable/plan.md); both touch `handleSelectPlan` |
| Webhook lags after Checkout return → BillingSuccess shows "inactive" | Realtime subscription on `subscriptions` row + 5s fallback redirect |
| OAuth consent screen "In testing" capped at 100 users | Submit for verification before public launch |
| `npx tsc --noEmit` fails after `gen types` if column types drift | Re-run `gen types` immediately after `db push`, commit together |
| Lovable migration in flight changes deploy URL mid-sprint | Use Supabase URL (`pspvppymcdjbwsudxzdx.supabase.co`) for webhook — stable across hosting moves |

---

## Estimated effort (revised)

| Phase | Effort |
|---|---|
| 0. Prerequisites | 1–2h |
| 1. DB schema + regen types | 1.5h |
| 2. Stripe seed | 30min |
| 3. Checkout function | 3h |
| 4. Webhook function | 4h |
| 5. Frontend wiring (PricingScreen + onboarding/finish + Success/Cancel + hook) | 5h |
| 6. Google OAuth + AuthCallback + ensureUserRow extract | 3.5h |
| 7. Receipts + branded email | 2h |
| 8. Verification + type check + commit hygiene | 2h |
| **Total** | **~3–4 focused days for one engineer** |

---

## Approval

- [ ] Open Questions Q1–Q7 answered
- [ ] Plan reviewed
- [ ] Coordinated with author of `.lovable/plan.md` (PricingScreen shared touchpoint)
- [ ] Approved to start Phase 0
