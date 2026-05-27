# Launch Readiness Plan — 4 Critical Gaps

**Project:** `intel-ignite-pro` (YesLiv)
**Date:** 2026-05-27
**Status:** Draft — awaiting approval to implement
**Target milestone:** Around 10 June 2026
**Related:** [STRIPE-GOOGLE-OAUTH-PLAN.md](STRIPE-GOOGLE-OAUTH-PLAN.md), [STRIPE-PLAN-CHANGE-FLOW.md](STRIPE-PLAN-CHANGE-FLOW.md), [GOOGLE-OAUTH-PLAN.md](GOOGLE-OAUTH-PLAN.md)

---

## Context

The current 6-item acceptance scope (Stripe checkout, webhooks, Google OAuth, landing, dashboard, CI) covers happy paths but leaves 4 critical gaps that will surface as production bugs or compliance issues:

1. **Entitlements not wired** — paying users can't access paid content
2. **No cancellation flow** — BR consumer law issue (CDC Art. 49)
3. **No failed-payment recovery** — silent churn
4. **CI/CD only catches a fraction of regressions** — webhook/auth bugs slip through

This plan addresses all four. Each is independent; suggested execution order at the end.

---

## 1. Entitlements wiring

### Problem

`subscriptions.status` is read by [Profile.tsx](src/pages/Profile.tsx) and [PricingScreen.tsx](src/components/onboarding/PricingScreen.tsx), but nothing else gates content. [CursoExclusivo.tsx](src/pages/CursoExclusivo.tsx) hardcodes `locked: true` for 4 of 5 modules — a user paying R$397 for Elite sees the same locked screens as a free user.

### Approach — three layers

**Layer 1: entitlements config (source of truth)**
- New `src/services/entitlements.ts` — `PLAN_FEATURES: Record<PlanId, Feature[]>` mapping
- Features as union: `'basic_lessons' | 'pro_lessons' | 'elite_lessons' | 'mentorship' | 'unlimited_ai' | ...`
- `userHasEntitlement(planId, feature) → boolean`

**Layer 2: frontend gate**
- New `src/hooks/useEntitlement.ts` — `useEntitlement(feature) → { allowed, loading, plan }`. Wraps `useSubscription` + `PLAN_FEATURES`.
- New `src/components/billing/EntitlementGate.tsx` — render-prop component:
  ```tsx
  <EntitlementGate feature="pro_lessons" fallback={<UpgradePrompt />}>
    <V10LessonPlayer />
  </EntitlementGate>
  ```
- New `src/components/billing/UpgradePrompt.tsx` — soft block UI: "Este conteúdo é exclusivo do plano Pro. [Fazer Upgrade]" → `/pricing`.

**Layer 3: backend gate (RLS — actual security boundary)**
- Update RLS policies on `v10_lessons`, `v8_lessons`, etc. to require active subscription. Pattern:
  ```sql
  create policy "v10_lessons_subscriber_read" on public.v10_lessons
  for select using (
    status = 'published'
    and exists (
      select 1 from public.subscriptions s
      where s.user_id = auth.uid()
        and s.status in ('active', 'trialing')
        -- and s.plan_id in ('pro', 'elite') for tiered gating
    )
  );
  ```
- Frontend gate is UX; backend gate is the actual security boundary. Both required.

**Layer 4: content inventory**
- Audit which routes/components serve paid content (best guess from filenames: v8, v10 lessons; AIPlayground; prompt library premium tier?)
- For each: assign required feature; wrap with `EntitlementGate`; add RLS policy

### Files

- New: `src/services/entitlements.ts`, `src/hooks/useEntitlement.ts`, `src/components/billing/EntitlementGate.tsx`, `src/components/billing/UpgradePrompt.tsx`
- New migration: `supabase/migrations/<ts>_entitlement_policies.sql` (one per gated table, ~3–6 tables)
- Modify: `CursoExclusivo.tsx` to derive `locked` from `useEntitlement`; any other gated pages

### Effort

| Step | Time |
|---|---|
| Config + hook + gate components | 2h |
| Content inventory (which pages are paid) | 1h — needs product input |
| Wrap N pages with `EntitlementGate` | 2h |
| RLS policies migration | 1h |
| Browser test all gating paths | 1h |
| **Total** | **~7h** |

### Verification

- Free user can't read paid `v10_lessons` via direct PostgREST URL (RLS enforces)
- Free user sees `UpgradePrompt` on paid pages (frontend enforces)
- Pro user sees Pro content but not Elite-only content
- Status `past_due` keeps access during Stripe smart-retry window (don't revoke immediately on first failure)

---

## 2. Cancellation flow

### Problem

No way to cancel. CDC Art. 49 requires "easy cancellation" for online subscriptions. ANATEL/CADE precedent: same number of clicks to cancel as to sign up. Failing this risks consumer complaints + fines.

### Approach — Stripe Customer Portal

Stripe maintains it, handles BR-localized strings, knows about Stripe's billing model. Custom UI here is more risk than value.

**Backend:**
- New edge function `create-customer-portal-session` — generates short-lived Portal URL for the authenticated user, returns it to frontend, frontend does `window.location.href = url`
- Same auth pattern as `change-subscription-plan` (JWT verify, get customer_id from `subscriptions`)

**Stripe Dashboard config:**
- Settings → Billing → Customer Portal → enable
- Configure features:
  - ✅ Cancel subscription (period end + immediate refund option per BR law)
  - ✅ Update payment method
  - ✅ View invoices
  - ✅ Update billing info
  - ❌ Switch plans (we have custom upgrade/downgrade flow already)
- Set business info, terms-of-service URL, privacy policy URL

**Frontend:**
- Add "Gerenciar assinatura" button to [Profile.tsx](src/pages/Profile.tsx) "Plano Atual" card — opens Portal
- Add same button to PricingScreen for active subscribers

**Webhook integration (already partial):**
- `customer.subscription.deleted` already handled → sets `status: 'canceled'` in DB → Profile shows canceled banner
- `customer.subscription.updated` with `cancel_at_period_end: true` already syncs to DB
- Display in Profile: "Sua assinatura foi cancelada. Acesso até DD/MM/YYYY." (new copy needed)

### Files

- New: `supabase/functions/create-customer-portal-session/index.ts` (~80 lines, similar shape to `change-subscription-plan`)
- Modify: `supabase/config.toml` — register function with `verify_jwt = true`
- Modify: `src/services/billing.ts` — add `openCustomerPortal()` helper
- Modify: `src/pages/Profile.tsx` — add button
- Modify: `src/components/onboarding/PricingScreen.tsx` — add button for active subscribers

### Stripe Dashboard work (manual, ~15min)

1. https://dashboard.stripe.com/test/settings/billing/portal → enable
2. Configure features per the list above
3. Save

### Effort

| Step | Time |
|---|---|
| Stripe Dashboard config | 15min |
| Edge function | 1.5h |
| Frontend wiring + button | 1h |
| Cancellation copy in Profile | 30min |
| Test full cancel + reactivate flow | 1h |
| **Total** | **~4h** |

### Edge cases

- User cancels via Portal → Profile shows "canceled, access until X" banner via webhook sync
- User wants to reactivate before period end → Portal allows it; webhook flips `cancel_at_period_end: false`
- User signs up, immediately cancels within 7 days → CDC right of withdrawal → full refund. Stripe Portal can be configured to allow self-serve refund within N days, OR refund is done manually in Stripe Dashboard. **Decide before launch.**

---

## 3. Failed payment recovery

### Problem

Renewal fails → webhook sets `status: 'past_due'` → user sees banner on Profile but has no action to take. After 4 failed retries (Stripe smart retries, ~3 weeks default), subscription is canceled. User churns silently.

### Approach — three layers

**Layer 1: notify (email)**
- On `invoice.payment_failed` webhook, send branded "atualize seu cartão" email
- New helper `sendPaymentFailedEmail` (inlined in stripe-webhook/index.ts, same pattern as `sendBrandedReceipt`)
- Template: "Seu pagamento falhou. Atualize seu cartão para manter o acesso. [Link to Customer Portal]"

**Layer 2: link (in-app banner)**
- Profile already shows "⚠️ Pagamento pendente" when `past_due` — extend it with a button: "Atualizar cartão" → opens Customer Portal
- Add same banner globally (e.g., on Dashboard) for higher visibility — not just on Profile

**Layer 3: recover (entitlement during grace)**
- During `past_due`, KEEP entitlements active (don't gate the user out immediately) — Stripe is still retrying, user shouldn't lose access during retry window
- After Stripe gives up and emits `customer.subscription.deleted` → entitlements revoke automatically (Layer 1 of #1 already handles this)

**Layer 4: Stripe smart retries (verify already on)**
- Verify in Stripe Dashboard → Settings → Subscriptions → Retries → "Smart retries" enabled, max 4 attempts, ~3 weeks total
- Configure dunning emails in Stripe Dashboard → Emails → "Failed payment" — Stripe will send its own version too (belt + suspenders with our branded one)

### Files

- Modify: `supabase/functions/stripe-webhook/index.ts` — extend `handleInvoiceFailed` to call new `sendPaymentFailedEmail`
- Modify: same file, add `sendPaymentFailedEmail` function (inline, same shape as `sendBrandedReceipt`)
- Modify: `src/pages/Profile.tsx` — make `past_due` label a button to Customer Portal
- New (optional): `src/components/billing/PaymentFailedBanner.tsx` — global banner shown on Dashboard if status is `past_due`

### Effort

| Step | Time |
|---|---|
| Email template + send function | 1h |
| Webhook integration | 30min |
| Profile button update | 30min |
| Global banner component + mount on Dashboard | 1h |
| Stripe Dashboard verify smart retries enabled | 15min |
| Test: trigger failed payment, verify email + banner + Portal access | 1.5h |
| **Total** | **~5h** |

### Edge cases

- User updates card in Portal → Stripe retries succeed → webhook flips to `active` → banner disappears via Realtime
- User ignores 4 retries → Stripe cancels → webhook fires `customer.subscription.deleted` → entitlements revoke → user sees Profile "canceled" message
- Resend domain not yet verified → email skipped silently (existing `RESEND_FROM_EMAIL` guard). User still sees in-app banner. Belt + suspenders.

---

## 4. CI/CD coverage

### Problem

Current state (best guess): GitHub Actions running lint + typecheck + build on PR. Missing: tests, edge function deploys, branch protection, secret scanning. Result: webhook/auth bugs we hit during this session would have been caught by CI if it existed.

### Approach — concrete pipeline

**4a — verify what's there**
- Audit `.github/workflows/*.yml` — list current jobs
- Confirm `npm run test:unit` (Vitest) and `npm run test:e2e:v7` (Playwright) work locally on CI Node version

**4b — PR validation workflow**

`.github/workflows/pr-check.yml`:
- Job 1: `lint` → `npm run lint`
- Job 2: `typecheck` → `npx tsc --noEmit`
- Job 3: `build` → `npm run build`
- Job 4: `test-unit` → `npm run test:unit`
- Job 5: `test-e2e` → `npm run test:e2e:v7` (Playwright)
- Job 6: `deno-check` → run `deno check` on `supabase/functions/**/*.ts` to catch Deno syntax errors before runtime

All jobs required for merge.

**4c — Edge Function deploy automation**

`.github/workflows/deploy-edge-functions.yml`:
- Trigger: push to `main` that changes `supabase/functions/**`
- Detect changed functions via git diff
- For each changed function: `supabase functions deploy <name> --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}`
- Requires GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`

Replaces "I forgot to deploy" bug class.

**4d — Migration deploy automation**

Similar workflow for `supabase/migrations/**` changes:
- On merge to main → `supabase db push`
- Riskier than function deploys (irreversible) — start with manual review + manual deploy, add automation once team is confident

**4e — Branch protection (GitHub repo settings, not code)**

Settings → Branches → Add rule for `main`:
- Require PR before merge
- Require status checks: `lint`, `typecheck`, `build`, `test-unit`, `deno-check` (e2e optional — they can be flaky)
- Require approvals: 1
- Block force push
- Block deletion

**4f — Secret scanning**

- GitHub Secret scanning (free for public, paid for private) — enable in repo settings
- Or use [gitleaks](https://github.com/gitleaks/gitleaks) action — free, runs on PR, fails on detected secrets

**4g — Preview deployments per PR**

- Vercel already does this for the frontend (default behavior)
- Edge functions: harder — Supabase doesn't have native PR previews. Workaround: a "staging" project ref + workflow that deploys PR branches to it with name suffix. **Defer this** — too much yak-shaving for milestone-1.

### Files

- New: `.github/workflows/pr-check.yml`
- New: `.github/workflows/deploy-edge-functions.yml`
- New: `.github/workflows/deploy-migrations.yml` (or document manual process)
- GitHub repo settings: branch protection + secret scanning (manual, ~15min)
- Optional new: `.github/workflows/secret-scan.yml` using gitleaks

### Effort

| Step | Time |
|---|---|
| Audit existing workflows | 30min |
| PR validation workflow with all 6 jobs | 2h |
| Edge function deploy workflow | 1.5h |
| Migration deploy workflow (or doc) | 1h |
| Branch protection + secret scanning config | 30min |
| Test the pipeline (intentionally break PR, verify red CI; merge, verify deploy) | 2h |
| **Total** | **~7.5h** |

### Verification

- Open a PR with a TS error → CI red, can't merge
- Open a PR that modifies an edge function → on merge, function auto-deploys (check Supabase dashboard)
- Push a fake secret to a branch → secret scanning catches it
- Push to main directly (with permissions) → blocked by branch protection

---

## Execution order

The 4 items are independent of each other. Suggested parallelization:

| Day | Track A (one engineer) | Track B (another, if available) |
|---|---|---|
| Day 1 | #2 Cancellation flow + Stripe Portal config | #4 CI/CD pipeline (PR validation + edge function deploy) |
| Day 2 | #3 Failed payment recovery | Continue #4 (branch protection + verify pipeline) |
| Day 3 | #1 Entitlements config + hook + gate component | — |
| Day 4 | #1 RLS policies + content inventory + wrapping pages | — |
| Day 5 | Cross-cutting verification: all 4 items work together | — |

Solo engineer: same order, ~7 working days at the estimated effort.

---

## Total effort + timeline

| Area | Effort | Risk |
|---|---|---|
| 1. Entitlements | 7h | Medium — needs content inventory |
| 2. Cancellation | 4h | Low — Stripe Portal does heavy lifting |
| 3. Payment recovery | 5h | Low — incremental on existing webhook |
| 4. CI/CD | 7.5h | Medium — CI is fiddly, can take longer than estimated |
| **Total** | **~24h (3 focused days)** | |

Against the **June 10 milestone**, this is achievable if started immediately — 2 weeks gives slack for testing, copy review, and unforeseen issues. If you wait until June 8, expect cuts.

---

## Out of scope (intentional deferrals)

- **Stripe Tax / NF-e (nota fiscal eletrônica)** — required for B2B sales in BR, less strict for B2C subscriptions. Stripe BR doesn't issue NF-e; needs a third-party integration (Vindi, Iugu, or custom Nubank). **Out of scope for first launch** but legally required eventually.
- **Refund flow within app** — currently a manual operation in Stripe Dashboard. Self-serve refund (Customer Portal) can be enabled but proration math gets weird. Defer to v2.
- **Annual plans** — not in pricing today.
- **Free trial period** — not in pricing today; if added, entitlement gate handles `trialing` already.
- **Edge function preview deploys per PR** — nice-to-have, complex.
- **End-to-end Playwright suite for billing flows** — only smoke test for now; full suite is its own initiative.
- **Sentry / observability** — flagged but separate plan needed.

---

## Approval

- [ ] Plan reviewed
- [ ] Stripe Customer Portal config decided (allow self-serve refund within N days?)
- [ ] Content inventory completed (which pages require which plan?)
- [ ] Approved to start
