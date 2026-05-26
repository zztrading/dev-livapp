// Stripe webhook handler — signed + idempotent.
//
// Env vars required:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   RESEND_API_KEY, RESEND_FROM_EMAIL (branded receipts)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { sendBrandedReceipt } from "../_shared/email.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  // Verify signature (async required on Deno)
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[stripe-webhook] Signature verification failed: ${message}`);
    return new Response(`Bad signature: ${message}`, { status: 400 });
  }

  // Idempotency guard — insert event.id before any side effect
  const { error: insertErr } = await supabase
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log(`[stripe-webhook] Duplicate event ${event.id}, skipping`);
      return new Response("ok (duplicate)", { status: 200 });
    }
    console.error("[stripe-webhook] Failed to insert event row:", insertErr);
    return new Response("DB error", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] Handler failed for ${event.type} ${event.id}:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  if (!userId || !planId) {
    console.warn("[stripe-webhook] checkout.session.completed missing metadata", session.id);
    return;
  }

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;

  let currentPeriodEnd: string | null = null;
  let status = "active";
  let cancelAtPeriodEnd = false;

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
    status = sub.status;
    cancelAtPeriodEnd = sub.cancel_at_period_end;
  }

  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id ?? null;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_id: planId,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
  console.log(`[stripe-webhook] Subscription activated for user=${userId} plan=${planId}`);
}

async function handleSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.user_id;
  const planId = sub.metadata?.plan_id;

  let query = supabase
    .from("subscriptions")
    .update({
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      ...(planId ? { plan_id: planId } : {}),
    });

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("stripe_subscription_id", sub.id);
  }

  const { error } = await query;
  if (error) throw error;
  console.log(`[stripe-webhook] Subscription ${sub.id} → status=${sub.status}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) {
    console.warn("[stripe-webhook] invoice.payment_succeeded without customer", invoice.id);
    return;
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id, plan_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!sub) {
    console.warn(`[stripe-webhook] No subscription row for customer ${customerId}`);
    return;
  }

  const paymentIntentId = typeof invoice.payment_intent === "string"
    ? invoice.payment_intent
    : invoice.payment_intent?.id ?? null;

  const { error: payErr } = await supabase.from("payments").insert({
    user_id: sub.user_id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_invoice_id: invoice.id,
    amount_cents: invoice.amount_paid,
    currency: invoice.currency,
    status: "succeeded",
    receipt_url: invoice.hosted_invoice_url ?? null,
  });

  if (payErr && payErr.code !== "23505") {
    throw payErr;
  }

  let planName = sub.plan_id ?? "Plano";
  if (sub.plan_id) {
    const { data: plan } = await supabase
      .from("plans")
      .select("name")
      .eq("id", sub.plan_id)
      .maybeSingle();
    if (plan?.name) planName = plan.name;
  }

  if (invoice.customer_email) {
    try {
      await sendBrandedReceipt({
        to: invoice.customer_email,
        planName,
        amountBrl: invoice.amount_paid / 100,
        invoicePdfUrl: invoice.invoice_pdf,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
      });
    } catch (err) {
      console.error("[stripe-webhook] sendBrandedReceipt failed:", err);
    }
  }

  console.log(`[stripe-webhook] Payment recorded for user=${sub.user_id} invoice=${invoice.id}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", customerId);

  if (error) throw error;
  console.log(`[stripe-webhook] Subscription past_due for customer=${customerId}`);
}
