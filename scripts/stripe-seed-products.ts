// @ts-nocheck — Deno script; not compiled by the Vite tsconfig.
// One-off script to create the 3 YesLiv plans in Stripe (test or live mode).
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_... deno run -A scripts/stripe-seed-products.ts
//
// After running, copy the printed price IDs and update the `plans` table:
//   update public.plans set stripe_price_id = 'price_xxx' where id = 'starter';
//   (etc.)

import Stripe from "npm:stripe@17";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY env var");
  Deno.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const plans = [
  { id: "starter", name: "YesLiv — Starter", amount:  9700 },
  { id: "pro",     name: "YesLiv — Pro",     amount: 19700 },
  { id: "elite",   name: "YesLiv — Elite",   amount: 39700 },
];

console.log("Creating products + prices in Stripe...\n");
console.log("plan_id\tprice_id");
console.log("─".repeat(60));

for (const p of plans) {
  const product = await stripe.products.create({
    name: p.name,
    metadata: { plan_id: p.id, brand: "yesliv" },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "brl",
    unit_amount: p.amount,
    recurring: { interval: "month", interval_count: 1 },
    metadata: { plan_id: p.id },
  });
  console.log(`${p.id}\t${price.id}`);
}

console.log("\nDone. Update plans.stripe_price_id with the values above.");
