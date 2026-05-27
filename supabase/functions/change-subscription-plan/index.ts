// @ts-nocheck — Deno edge function; not compiled by the Vite tsconfig.
// Plan change handler — upgrade (immediate, prorated) / downgrade (scheduled at
// period end) / cancel scheduled downgrade. See STRIPE-PLAN-CHANGE-FLOW.md.
//
// Env vars required:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

type Action = "upgrade" | "downgrade" | "cancel_downgrade";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return jsonResponse({ error: "Unauthorized", detail: userErr?.message ?? null }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as Action | undefined;
    const planId = body.plan_id as string | undefined;

    if (!action) return jsonResponse({ error: "Missing action" }, 400);

    // Fetch current subscription
    const { data: sub } = await admin
      .from("subscriptions")
      .select("user_id, stripe_subscription_id, stripe_subscription_schedule_id, plan_id, status, pending_plan_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub) {
      return jsonResponse({
        error: "No active subscription",
        detail: "Use Checkout to create a subscription first.",
      }, 400);
    }
    if (sub.status !== "active" && sub.status !== "trialing") {
      return jsonResponse({
        error: "Subscription not active",
        detail: `Current status is "${sub.status}". Resolve it before changing plans.`,
      }, 400);
    }
    if (!sub.stripe_subscription_id) {
      return jsonResponse({ error: "Subscription missing Stripe id" }, 500);
    }

    // ─── cancel_downgrade ────────────────────────────────────────────────────
    if (action === "cancel_downgrade") {
      if (!sub.stripe_subscription_schedule_id) {
        return jsonResponse({ error: "No scheduled change to cancel" }, 400);
      }
      await stripe.subscriptionSchedules.release(sub.stripe_subscription_schedule_id);
      await admin
        .from("subscriptions")
        .update({
          pending_plan_id: null,
          pending_change_at: null,
          stripe_subscription_schedule_id: null,
        })
        .eq("user_id", user.id);
      return jsonResponse({ ok: true, message: "Scheduled change canceled." });
    }

    // upgrade / downgrade → need plan_id
    if (!planId) return jsonResponse({ error: "Missing plan_id" }, 400);

    const [{ data: currentPlan }, { data: targetPlan }] = await Promise.all([
      admin.from("plans").select("id, amount_cents, stripe_price_id, name").eq("id", sub.plan_id).maybeSingle(),
      admin.from("plans").select("id, amount_cents, stripe_price_id, name").eq("id", planId).maybeSingle(),
    ]);

    if (!currentPlan) return jsonResponse({ error: "Current plan not found" }, 500);
    if (!targetPlan) return jsonResponse({ error: `Target plan not found: ${planId}` }, 404);
    if (targetPlan.stripe_price_id.startsWith("price_REPLACE_")) {
      return jsonResponse({ error: "Target plan has placeholder Stripe price_id" }, 500);
    }

    if (targetPlan.id === currentPlan.id) {
      return jsonResponse({ error: "Already on this plan" }, 400);
    }

    // Server-side validation of declared action
    const isUpgrade = targetPlan.amount_cents > currentPlan.amount_cents;
    const isDowngrade = targetPlan.amount_cents < currentPlan.amount_cents;

    if (action === "upgrade" && !isUpgrade) {
      return jsonResponse({
        error: "Action/plan mismatch",
        detail: "Declared upgrade but target plan is not higher tier.",
      }, 400);
    }
    if (action === "downgrade" && !isDowngrade) {
      return jsonResponse({
        error: "Action/plan mismatch",
        detail: "Declared downgrade but target plan is not lower tier.",
      }, 400);
    }

    // ─── upgrade ─────────────────────────────────────────────────────────────
    if (action === "upgrade") {
      // If a downgrade was scheduled, release it first — upgrade supersedes it.
      if (sub.stripe_subscription_schedule_id) {
        try {
          await stripe.subscriptionSchedules.release(sub.stripe_subscription_schedule_id);
        } catch (e) {
          console.warn("[change-subscription-plan] Failed to release schedule before upgrade:", e);
        }
      }

      // Retrieve current subscription to find the item id we need to update
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const itemId = stripeSub.items.data[0]?.id;
      if (!itemId) {
        return jsonResponse({ error: "Subscription has no items" }, 500);
      }

      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: itemId, price: targetPlan.stripe_price_id }],
        proration_behavior: "always_invoice",
        metadata: { user_id: user.id, plan_id: targetPlan.id },
      });

      // Webhook will sync plan_id + period; clear any pending fields here
      // so the UI flips immediately without waiting for the webhook.
      await admin
        .from("subscriptions")
        .update({
          plan_id: targetPlan.id,
          pending_plan_id: null,
          pending_change_at: null,
          stripe_subscription_schedule_id: null,
        })
        .eq("user_id", user.id);

      return jsonResponse({
        ok: true,
        action: "upgraded",
        message: `Plano alterado para ${targetPlan.name}. O valor proporcional foi cobrado.`,
      });
    }

    // ─── downgrade ───────────────────────────────────────────────────────────
    // Build (or update) a subscription schedule with two phases:
    //   phase 1: current plan, until current_period_end
    //   phase 2: target plan, starts at current_period_end (open-ended)
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const itemId = stripeSub.items.data[0]?.id;
    const currentPriceId = stripeSub.items.data[0]?.price.id;
    const periodEnd = stripeSub.current_period_end; // unix seconds

    if (!itemId || !currentPriceId) {
      return jsonResponse({ error: "Subscription has no items" }, 500);
    }

    let scheduleId = sub.stripe_subscription_schedule_id;

    if (!scheduleId) {
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: sub.stripe_subscription_id,
      });
      scheduleId = schedule.id;
    }

    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: "release",
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          start_date: stripeSub.current_period_start,
          end_date: periodEnd,
          proration_behavior: "none",
        },
        {
          items: [{ price: targetPlan.stripe_price_id, quantity: 1 }],
          start_date: periodEnd,
          proration_behavior: "none",
          metadata: { user_id: user.id, plan_id: targetPlan.id },
        },
      ],
      metadata: { user_id: user.id, downgrade_to: targetPlan.id },
    });

    await admin
      .from("subscriptions")
      .update({
        pending_plan_id: targetPlan.id,
        pending_change_at: new Date(periodEnd * 1000).toISOString(),
        stripe_subscription_schedule_id: scheduleId,
      })
      .eq("user_id", user.id);

    return jsonResponse({
      ok: true,
      action: "downgrade_scheduled",
      effective_at: new Date(periodEnd * 1000).toISOString(),
      message: `Downgrade para ${targetPlan.name} agendado para ${new Date(periodEnd * 1000).toLocaleDateString("pt-BR")}.`,
    });
  } catch (err) {
    console.error("[change-subscription-plan] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
