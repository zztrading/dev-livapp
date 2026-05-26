# Implementation Plan — Stripe BR + Google OAuth

**Project:** `intel-ignite-pro` (YesLiv)
**Date:** 2026-05-26 (v3 — pricing finalized)
**Owner:** TBD
**Status:** Implementation ready

---

## What changed in v3 vs v2

1. **Plan structure finalized** (resolves blocking Q2 from v2):
   - Monthly recurring tiers — **Starter / Pro / Elite**
   - Prices: **R$ 97 / R$ 197 / R$ 397 per month** (BRL)
2. **App brand confirmed:** YesLiv (was Aluri in v1/v2)
3. **Lovable-sync risk noted:** prior implementations have been wiped by Lovable syncs that overwrite local files (PricingScreen, OnboardingFinish, App.tsx, config.toml). After applying changes from this plan, push to Git ASAP to avoid loss.

---

## Context

**Stack:**
- Vite + React 18 + TypeScript
- Supabase (Auth + Postgres + Edge Functions on Deno) — project ref `pspvppymcdjbwsudxzdx`
- TanStack Query, shadcn/ui, React Router v6
- Auth in [src/pages/Auth.tsx](src/pages/Auth.tsx) is email/password only
- Edge Functions follow [supabase/functions/_shared/auth.ts](supabase/functions/_shared/auth.ts)
- Anonymous-onboarding flow (per [.lovable/plan.md](.lovable/plan.md)) — answers stored in localStorage, signup gate at PricingScreen, replay via [/onboarding/finish](src/pages/OnboardingFinish.tsx)
- **No Stripe code in repo**

**Goal:** Ship 6 deliverables:
1. Stripe BR sandbox setup + 3 test products
2. Google Cloud OAuth client + consent screen
3. Stripe checkout end-to-end for all 3 plans
4. Stripe webhooks (signed + idempotent), subscription state in DB
5. Google OAuth integrated in frontend (signup + login)
6. Automatic Stripe receipts + branded payment-confirmation email

---

## Plans (final)

| ID | Name | Price (BRL/month) | amount_cents | Badge | Highlighted |
|---|---|---|---|---|---|
| `starter` | Starter | R$ 97 | 9700 | — | no |
| `pro` | Pro | R$ 197 | 19700 | 👑 MAIS POPULAR! | **yes** |
| `elite` | Elite | R$ 397 | 39700 | — | no |

All are `mode: 'subscription'` with `recurring: { interval: 'month', interval_count: 1 }`.

UI displays a 50% off promo (old-price = new × 2):

| Tier | Old | New | Per day | Savings text |
|---|---|---|---|---|
| Starter | R$ 194,00 | R$ 97,00 | R$ 3,23/dia | — |
| Pro | R$ 394,00 | R$ 197,00 | R$ 6,57/dia | Economize R$ 197,00 |
| Elite | R$ 794,00 | R$ 397,00 | R$ 13,23/dia | Economize R$ 397,00 |

---

## Phase 0 — Prerequisites

| # | Action |
|---|---|
| 0.1 | Stripe **test** account in BR mode (BRL) — `sk_test_...`, `pk_test_...`, `whsec_...` |
| 0.2 | Google Cloud project + OAuth consent screen (External, "In testing"), Fernando as test user, OAuth 2.0 Web Client. Redirect URI: `https://pspvppymcdjbwsudxzdx.supabase.co/auth/v1/callback` |
| 0.3 | Supabase Dashboard → Authentication → Providers → enable Google with Client ID + Secret |
| 0.4 | Resend account + verified domain → set `RESEND_FROM_EMAIL` |

**Supabase Edge Function secrets:**
```bash
supabase secrets set STRIPE_SECRET_KEY="sk_test_..."    --project-ref pspvppymcdjbwsudxzdx
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."  --project-ref pspvppymcdjbwsudxzdx
supabase secrets set APP_URL="https://staging.yesliv.app" --project-ref pspvppymcdjbwsudxzdx
supabase secrets set RESEND_API_KEY="re_..."            --project-ref pspvppymcdjbwsudxzdx
supabase secrets set RESEND_FROM_EMAIL="billing@yesliv.app" --project-ref pspvppymcdjbwsudxzdx
```

**Frontend `.env`:**
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Phase 1 — Database schema

**Migration:** `supabase/migrations/<timestamp>_billing_schema.sql`

Tables (all with RLS):
- `plans` — id, name, stripe_price_id, amount_cents, currency, interval, interval_count, features (jsonb), badge, is_active, display_order — public read
- `subscriptions` — user_id (PK, FK auth.users), stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end, updated_at — user reads own
- `payments` — id, user_id, stripe_payment_intent_id (unique), stripe_invoice_id, amount_cents, currency, status, receipt_url, created_at — user reads own
- `stripe_webhook_events` — event_id (PK), type, processed_at, payload — service role only (no policy)

Seed rows: starter / pro / elite at 9700 / 19700 / 39700 with `interval: 'month'`, placeholder Stripe price IDs.

Apply: `supabase db push --project-ref pspvppymcdjbwsudxzdx`, then `supabase gen types typescript --project-id pspvppymcdjbwsudxzdx > src/integrations/supabase/types.ts`.

---

## Phase 2 — Stripe test products

**Script:** [scripts/stripe-seed-products.ts](scripts/stripe-seed-products.ts)

Creates 3 Stripe Products + recurring monthly BRL Prices. Run:
```bash
STRIPE_SECRET_KEY=sk_test_... deno run -A scripts/stripe-seed-products.ts
```

Then `UPDATE plans SET stripe_price_id = 'price_xxx' WHERE id = 'starter';` (etc.) via Supabase SQL editor.

---

## Phase 3 — `create-checkout-session` edge function

- `verify_jwt = true` — authenticated callers only
- Looks up plan, finds/creates Stripe Customer, creates Checkout Session in `pt-BR` / BRL
- `metadata.user_id` + `subscription_data.metadata.user_id` for webhook correlation
- Returns `{ url }` — caller does `window.location.href = url`

---

## Phase 4 — `stripe-webhook` edge function

- `verify_jwt = false` — Stripe doesn't send Supabase JWTs
- Signature verification via `constructEventAsync` (Deno async crypto)
- Idempotency via PK insert on `stripe_webhook_events.event_id` — duplicate `23505` → return 200
- Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- On `invoice.payment_succeeded` → insert into `payments` + send branded Resend email

**Stripe Dashboard:** register endpoint `https://pspvppymcdjbwsudxzdx.supabase.co/functions/v1/stripe-webhook` with the 5 events. Copy signing secret → `STRIPE_WEBHOOK_SECRET`.

---

## Phase 5 — Frontend wiring

**New files:**
- [src/services/billing.ts](src/services/billing.ts) — `startCheckout(planId)` + pending-plan localStorage helpers
- [src/hooks/useSubscription.ts](src/hooks/useSubscription.ts) — TanStack Query + Supabase Realtime on `subscriptions` row
- [src/pages/BillingSuccess.tsx](src/pages/BillingSuccess.tsx) — waits for webhook (Realtime), 8s fallback to `/dashboard`
- [src/pages/BillingCancel.tsx](src/pages/BillingCancel.tsx) — minimal "no charge made" page

**Modified files:**
- [src/components/onboarding/PricingScreen.tsx](src/components/onboarding/PricingScreen.tsx) — plans → `starter` / `pro` / `elite` at R$ 97 / 197 / 397; `handleSelectPlan` calls real Stripe Checkout (anonymous → setPendingPlan + signup; authenticated → straight to Stripe)
- [src/pages/OnboardingFinish.tsx](src/pages/OnboardingFinish.tsx) — after flush, if `pending_plan` exists → `startCheckout` → Stripe
- [src/App.tsx](src/App.tsx) — add `/billing/success` + `/billing/cancel` lazy routes (preserve existing `/quiz` route)
- [supabase/config.toml](supabase/config.toml) — register `create-checkout-session` (verify_jwt=true) + `stripe-webhook` (verify_jwt=false)

**Flows:**
- **Authenticated:** PricingScreen → `startCheckout` → Stripe Checkout (pt-BR/BRL) → success_url → `/billing/success` → Realtime flips to active → Dashboard
- **Anonymous:** PricingScreen → `setPendingPlan(planId)` → `/auth?mode=signup&returnTo=/onboarding/finish` → signup → OnboardingFinish replays answers → reads pending_plan → `startCheckout` → Stripe

---

## Phase 6 — Google OAuth (deferred — implement after Stripe)

- Add `Continuar com Google` button to [src/pages/Auth.tsx](src/pages/Auth.tsx) above email/password tabs
- Handler uses `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ..., queryParams: { access_type: 'offline', prompt: 'consent' } } })`
- Must respect existing `returnTo` query param (used by PricingScreen → /onboarding/finish chain)
- New [src/pages/AuthCallback.tsx](src/pages/AuthCallback.tsx) — read session, ensure `public.users` row, route by `returnTo`
- Register `/auth/callback` route in App.tsx

---

## Phase 7 — Receipts + email

- **Stripe receipt (automatic):** `payment_intent_data.receipt_email = user.email` in checkout session; enable in Stripe Dashboard → Settings → Emails
- **Branded receipt:** `supabase/functions/_shared/email.ts` wraps Resend API; HTML template with YesLiv header, plan name, amount in BRL, Stripe-hosted invoice link. Fired from webhook on `invoice.payment_succeeded`.

---

## Phase 8 — Verification matrix

| Task | How to verify |
|---|---|
| 1. Sandbox + 3 plans | `select * from plans` → 3 rows; Stripe Dashboard → Products shows 3 |
| 2. Google OAuth | OAuth client in GCP Credentials; consent "In testing" |
| 3. Checkout E2E | All 3 plans with `4242 4242 4242 4242`; Stripe Payments shows BRL charges |
| 4. Webhooks signed + idempotent | `stripe trigger checkout.session.completed` twice → 1 row in `payments`; 1 row per `event.id` in `stripe_webhook_events` |
| 5. Google login (staging) | Sign up + log out + log in → same `users.id`; `returnTo=/onboarding/finish` chain works |
| 6. Receipts | (a) Stripe email arrives, (b) Resend dashboard shows branded email delivered |

**Pre-commit gates** ([CLAUDE.md](CLAUDE.md)):
- `npx tsc --noEmit` → zero errors
- After migration: regen types.ts and commit together

---

## Phase 9 — Execution order

1. **Phase 0** — Stripe + GCP + Resend secrets
2. **Phase 1** (migration) → **Phase 2** (seed Stripe + update plans table)
3. **Phase 3** (`create-checkout-session`)
4. **Phase 5** (frontend wiring: PricingScreen + OnboardingFinish + Success/Cancel + service + hook)
5. **Phase 4** (webhook — needs real checkout sessions for E2E test)
6. **Phase 7** (receipts — bolted onto webhook)
7. **Phase 6** (Google OAuth — independent, can ship later)
8. **Phase 8** (verification)

---

## Risks / gotchas

| Risk | Mitigation |
|---|---|
| Lovable sync wipes local files | Push to Git **immediately** after each implementation phase |
| Stripe account US-domiciled, charging BRL → tax/legal | Confirm domicile before any live-mode charges |
| Webhook signature fails on Deno with sync `constructEvent` | Use `constructEventAsync` only |
| Webhook replays creating duplicate payments | PK on `stripe_webhook_events.event_id`, checked **first** |
| Idempotency keyed on `payment_intent_id` (wrong) | Must be `event.id` |
| PricingScreen redesigns in `.lovable/plan.md` overwrite Stripe wiring | Coordinate via Git — push Stripe changes before next Lovable sync |
| Webhook lags after Checkout return | Realtime on `subscriptions` + 8s fallback redirect in BillingSuccess |
| OAuth "In testing" capped at 100 users | Submit for verification before public launch |

---

## Approval

- [x] Pricing confirmed: Starter R$97 / Pro R$197 / Elite R$397 / month
- [x] Brand confirmed: YesLiv
- [x] Approved to implement
