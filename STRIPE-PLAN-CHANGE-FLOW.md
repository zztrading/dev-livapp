# Plan Change Flow — Upgrade / Downgrade / Same

**Project:** `intel-ignite-pro` (YesLiv)
**Date:** 2026-05-27
**Status:** Draft — awaiting approval to implement
**Depends on:** [STRIPE-GOOGLE-OAUTH-PLAN.md](STRIPE-GOOGLE-OAUTH-PLAN.md) (baseline Stripe checkout flow)

---

## Goals

1. **Same plan** → button disabled with "Plano Atual" label
2. **Upgrade** (Starter → Pro, Pro → Elite, Starter → Elite) → applies **immediately** with prorated charge; old plan is replaced in the same subscription
3. **Downgrade** (Elite → Pro, Pro → Starter, Elite → Starter) → applies at **end of current billing period**; user keeps higher tier until then; clear notification of when the change takes effect

---

## Architecture decisions

### Single subscription, never multiple
Stripe handles plan changes via **`stripe.subscriptions.update()`** — there is no "cancel + recreate". The subscription ID stays the same; only the `items[0].price` changes. This is critical for billing continuity and analytics.

### Upgrade vs downgrade detection
Compare `plans.amount_cents` of current vs target plan:
- `target.amount_cents > current.amount_cents` → **upgrade** (immediate, prorate)
- `target.amount_cents < current.amount_cents` → **downgrade** (scheduled at period end)
- `target.amount_cents == current.amount_cents` → **same** (block in UI)

Using `display_order` is fragile if prices change; `amount_cents` is the source of truth.

### Stripe primitives per case

| Case | Stripe API call | Effect |
|---|---|---|
| **Upgrade** | `stripe.subscriptions.update(subId, { items: [{ id, price: newPriceId }], proration_behavior: 'always_invoice' })` | New plan active **now**, customer charged prorated diff immediately, new monthly cycle anchored to today (or unchanged — design call) |
| **Downgrade** | `stripe.subscriptionSchedules.create()` with 2 phases: phase 1 = current plan until `current_period_end`, phase 2 = new (lower) plan starting at `current_period_end` | User keeps current plan until period ends, then auto-transitions to new plan, charged the new (lower) amount from that point forward |
| **Cancel scheduled downgrade** | `stripe.subscriptionSchedules.release(scheduleId)` | Reverts to a normal subscription on current plan (no scheduled change) |

### Why `always_invoice` for upgrade (not `create_prorations`)
- `create_prorations`: Stripe just records a credit/debit on the next invoice → user is surprised by extra charges at next renewal
- `always_invoice`: Stripe charges the prorated diff **right now** → matches user's mental model ("I paid for the upgrade, I get it now")

Trade-off: user gets a small charge immediately. Acceptable for SaaS pricing.

### Why scheduled downgrade (not immediate-with-credit)
- User already paid for the higher tier this month → they should get what they paid for
- Stripe's `subscription_schedules` is the canonical way to express "change at period end"
- Frontend can show "Downgrade scheduled for DD/MM/YYYY" and offer cancellation

---

## Database changes

**Migration:** `supabase/migrations/<timestamp>_subscription_pending_changes.sql`

Add columns to `public.subscriptions`:

| Column | Type | Purpose |
|---|---|---|
| `pending_plan_id` | `text references plans(id)` | If set, a downgrade is scheduled to this plan |
| `pending_change_at` | `timestamptz` | When the scheduled change takes effect (= `current_period_end` at schedule creation) |
| `stripe_subscription_schedule_id` | `text unique` | The Stripe schedule ID, so we can `.release()` it for cancellation |

All three are null when no pending change exists.

After migration: `supabase gen types typescript --project-id zfscbxwisoikeqxwxwkw > src/integrations/supabase/types.ts`.

---

## Edge function changes

### New function: `change-subscription-plan`

**Path:** `supabase/functions/change-subscription-plan/index.ts`
**Auth:** `verify_jwt = true` (user only)

**Request body:**
```json
{ "plan_id": "elite", "action": "upgrade" | "downgrade" | "cancel_downgrade" }
```

The `action` field is for explicit confirmation — the function recomputes the comparison server-side and refuses if it doesn't match. Prevents UI/backend disagreement from causing the wrong billing operation.

**Flow:**
1. Auth user (extract JWT, call `auth.getUser(token)`)
2. Read user's current `subscriptions` row + the target `plans` row (both via service role)
3. Compare `amount_cents` → determine actual operation
4. Reject if:
   - User has no active subscription (`status` not in `active`/`trialing`) → tell them to use Checkout instead
   - Same plan
   - Action mismatch (e.g. body says "upgrade" but server sees downgrade)
5. Execute via Stripe API:
   - **Upgrade:** `stripe.subscriptions.retrieve()` to get current item ID → `stripe.subscriptions.update(subId, { items: [{ id: itemId, price: newPriceId }], proration_behavior: 'always_invoice' })`
   - **Downgrade:** `stripe.subscriptionSchedules.create({ from_subscription: subId })` → then `.update()` it with two phases. Store the schedule ID + pending fields in DB.
   - **Cancel downgrade:** `stripe.subscriptionSchedules.release(scheduleId)`. Clear pending fields in DB.
6. Return `{ ok: true, message: "..." }`

The webhook will pick up the `customer.subscription.updated` event and sync the rest, but for the pending-change fields we update DB directly because the schedule events don't carry plan info clearly.

**Register in [supabase/config.toml](supabase/config.toml):**
```toml
[functions.change-subscription-plan]
verify_jwt = true
```

### Webhook updates

[stripe-webhook/index.ts](supabase/functions/stripe-webhook/index.ts) already handles `customer.subscription.updated`. Extend it to:

- Read `subscription.schedule` — if null, clear `pending_plan_id` / `pending_change_at` / `stripe_subscription_schedule_id` in DB (the schedule was released or fully transitioned)
- If schedule exists, leave pending fields as set by `change-subscription-plan`
- When phase transitions (period rolls over), Stripe emits `customer.subscription.updated` with the new plan → handler updates `plan_id` and `current_period_end` as today, no special logic needed

### Optional: `customer.subscription.pending_update_applied` and `customer.subscription.pending_update_expired`
Stripe emits these events when scheduled updates execute or expire. Subscribe to them in Stripe Dashboard if we want belt-and-suspenders syncing. Not required for v1.

---

## Frontend changes

### [src/hooks/useSubscription.ts](src/hooks/useSubscription.ts)
Extend `Subscription` interface with the new pending fields. No logic change — Realtime already picks them up.

### [src/services/billing.ts](src/services/billing.ts)
Add three helpers:
- `upgradeSubscription(planId)` → calls `change-subscription-plan` with `action: 'upgrade'`
- `downgradeSubscription(planId)` → calls with `action: 'downgrade'`
- `cancelScheduledDowngrade()` → calls with `action: 'cancel_downgrade'`

### [src/components/onboarding/PricingScreen.tsx](src/components/onboarding/PricingScreen.tsx)
The crux of the UX. Per-card logic:

```
For each plan card:
  if no current subscription:
    → button "Escolher Plano" → existing Checkout flow
  else if plan.id === current.plan_id:
    if pending_plan_id is set:
      → label "Plano Atual" + "Cancelar downgrade agendado" link
    else:
      → button "Plano Atual" — disabled, with checkmark badge
  else if plan.amount_cents > current.amount_cents:
    → button "Fazer Upgrade" → opens UpgradeConfirmModal
  else if plan.amount_cents < current.amount_cents:
    if pending_plan_id === plan.id:
      → button "Downgrade Agendado" — disabled, with date label
    else:
      → button "Fazer Downgrade" → opens DowngradeConfirmModal
```

Above the cards, if `pending_plan_id` is set, show a banner:

> ⏳ Mudança de plano agendada — você está no Pro até **DD/MM/YYYY**. Depois disso, será cobrado **R$ 97/mês** (Starter). [Cancelar agendamento]

### New components

**`src/components/billing/UpgradeConfirmModal.tsx`**
```
Title: "Fazer upgrade para Elite"
Body:
  "Você terá acesso ao Elite imediatamente."
  "Será cobrado um valor proporcional aos dias restantes do ciclo atual (~R$ X)."
  "A partir do próximo ciclo, R$ 397/mês."
Buttons: [Cancelar] [Confirmar upgrade]
```

The prorated estimate (~R$ X) is computed client-side as a rough estimate:
`(target.amount - current.amount) * (days_remaining / 30)` — disclaim as "valor aproximado". Stripe calculates the real number; we don't need to be perfect here.

**`src/components/billing/DowngradeConfirmModal.tsx`**
```
Title: "Fazer downgrade para Starter"
Body:
  "Você continuará com Pro até DD/MM/YYYY."
  "A partir de DD/MM/YYYY, seu plano será Starter (R$ 97/mês)."
  "Você não será cobrado agora."
Buttons: [Cancelar] [Confirmar downgrade]
```

**`src/components/billing/CancelDowngradeButton.tsx`**
Simple confirm → calls `cancelScheduledDowngrade()` → toast.

---

## Edge cases

| Scenario | Handling |
|---|---|
| User upgrades while a downgrade is scheduled | Release the schedule first, then apply upgrade. Backend handles both in one function call. |
| User downgrades to a plan that's still higher than the pending one | Update the existing schedule (single `subscriptionSchedules.update()`) — don't release + recreate |
| Webhook arrives before frontend confirmation modal closes | UI uses Realtime, will update instantly; modal should auto-close on `subscription` change |
| Payment fails on upgrade proration invoice | Stripe webhook fires `invoice.payment_failed` → marks `status: past_due` → user sees existing past_due message on Profile |
| User cancels mid-period via Stripe Customer Portal (if we add one later) | Webhook `customer.subscription.updated` syncs `cancel_at_period_end: true` → UI shows cancellation banner. Out of scope for this plan. |
| Same `plan_id` clicked twice rapidly | Frontend disables all buttons during in-flight request; backend is idempotent (same-plan check returns no-op) |
| Plan with placeholder `stripe_price_id` | Function returns the existing "Plan has placeholder Stripe price_id" error |

---

## Execution order

1. **DB migration** — add `pending_plan_id`, `pending_change_at`, `stripe_subscription_schedule_id` to `subscriptions`
2. **Regen types** — `supabase gen types typescript ...`
3. **Backend** — write `change-subscription-plan` function
4. **Backend** — extend webhook to handle schedule lifecycle
5. **Deploy backend** — function + webhook updates to `zfscbxwisoikeqxwxwkw`
6. **Frontend** — extend `billing.ts` with three new helpers
7. **Frontend** — extend `useSubscription.ts` types
8. **Frontend** — write `UpgradeConfirmModal`, `DowngradeConfirmModal`, `CancelDowngradeButton` components
9. **Frontend** — update `PricingScreen` with per-card branching logic + banner
10. **Frontend** — type check, manual test all 6 transitions:
    - none → Starter (existing flow, smoke test)
    - Starter → Pro (upgrade, immediate)
    - Pro → Elite (upgrade, immediate)
    - Elite → Pro (downgrade, scheduled)
    - Pro → Starter (downgrade, scheduled)
    - cancel pending downgrade
11. **Verify** in Stripe Dashboard → Subscriptions → confirm schedule is created and prorations look right

---

## Out of scope (flag for later)

- **Annual plans** — current model is monthly only. Annual would need different proration math.
- **Stripe Customer Portal** — Stripe-hosted page for managing card, viewing invoices, canceling. Worth adding eventually; not in this scope.
- **Cancel subscription entirely** — separate "cancelar minha assinatura" button. Should set `cancel_at_period_end: true`. Different flow from downgrade.
- **Refunds** — none for downgrades (user gets what they paid for). For upgrade reversals within an hour, could add a "switched by mistake" undo. Not in scope.
- **Trial periods** — no trials currently in the plans. If added later, trial-to-paid transitions need their own UI state.
- **Tax handling** — `automatic_tax: false` currently. If Brazil tax rates are added via Stripe Tax, no logic change needed.

---

## Estimated effort

| Phase | Effort |
|---|---|
| 1-2. Migration + types | 30min |
| 3-4. `change-subscription-plan` + webhook | 3h |
| 5. Deploy + Stripe sandbox config | 30min |
| 6-7. Frontend helpers + hook | 1h |
| 8. Modal components | 2h |
| 9. PricingScreen branching | 2h |
| 10. Manual testing all 6 paths | 1.5h |
| **Total** | **~10h** (1.5 days focused) |

---

## Approval checkpoint

Before implementing, confirm:
1. ✅ **Upgrade timing:** immediate + prorated invoice now (`always_invoice`) vs proration credit on next renewal (`create_prorations`) — proposing `always_invoice`. Confirm.
2. ✅ **Downgrade timing:** end of period (scheduled). Confirm.
3. ✅ **Schedule cancel:** allowed (user can change mind). Confirm.
4. ✅ **No refunds** for downgrades (Stripe doesn't auto-refund; user keeps current period). Confirm.
5. ✅ **No annual plans yet.** Confirm.

If all five are yes, proceed phase by phase starting with the migration.
