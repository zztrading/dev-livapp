// @ts-nocheck — Deno edge function; not compiled by the Vite tsconfig.
// Creates a Stripe Checkout Session for the authenticated user + selected plan.
// Returns { url } so the frontend can window.location.href = url.
//
// Env vars required:
//   STRIPE_SECRET_KEY
//   APP_URL
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//
// CORS helpers are inlined (was supabase/functions/_shared/cors.ts) so this file
// is self-contained and deployable via the Supabase Dashboard UI, which doesn't
// bundle sibling _shared/* files.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

// ─── Inlined CORS helpers ───────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Stripe client ──────────────────────────────────────────────────────────

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

// ─── Handler ────────────────────────────────────────────────────────────────

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user || !user.email) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const planId = body.plan_id as string | undefined;
    if (!planId) {
      return jsonResponse({ error: "Missing plan_id" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: plan, error: planErr } = await adminClient
      .from("plans")
      .select("id, name, stripe_price_id, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planErr || !plan) {
      return jsonResponse({ error: `Plan not found: ${planId}` }, 404);
    }
    if (!plan.is_active) {
      return jsonResponse({ error: `Plan inactive: ${planId}` }, 400);
    }
    if (!plan.stripe_price_id || plan.stripe_price_id.startsWith("price_REPLACE_")) {
      return jsonResponse({
        error: "Plan has placeholder Stripe price_id. Run scripts/stripe-seed-products.ts and update the plans table.",
      }, 500);
    }

    // Find or create Stripe customer
    const { data: existingSub } = await adminClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      await adminClient.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          status: "inactive",
        },
        { onConflict: "user_id" },
      );
    }

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      customer: customerId,
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      locale: "pt-BR",
      automatic_tax: { enabled: false },
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan.id,
        },
      },
    });

    return jsonResponse({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[create-checkout-session] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
