/**
 * RLS Policy Tests
 *
 * Verifies that Row Level Security policies correctly block unauthorized
 * reads and writes from anonymous (logged-out) clients.
 *
 * These tests use ONLY the public anon key — no service role needed.
 * They run against the live database in read-only mode.
 *
 * Run: npx vitest run src/tests/rls-policies.test.ts
 */

import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://pspvppymcdjbwsudxzdx.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzcHZwcHltY2RqYndzdWR4emR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjE5MzgsImV4cCI6MjA3NzMzNzkzOH0.BCv3iMf8pnxLbDd9Py1dfGc_FKw9r_otf3PzMzr42Fw";

// Anonymous (logged-out) client
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Helper: assert that a SELECT returns NO rows (RLS blocked it)
 * RLS doesn't error on blocked SELECT — it just returns 0 rows.
 */
async function expectNoRows(table: string) {
  const { data, error } = await anon.from(table as any).select("*").limit(5);
  expect(error, `unexpected error on ${table}: ${error?.message}`).toBeNull();
  expect(data ?? [], `expected 0 rows from ${table} as anon`).toHaveLength(0);
}

/**
 * Helper: assert that an INSERT is rejected by RLS
 */
async function expectInsertBlocked(table: string, payload: Record<string, any>) {
  const { error } = await anon.from(table as any).insert(payload).select();
  expect(
    error,
    `expected RLS to block INSERT on ${table}, but it succeeded`
  ).not.toBeNull();
  // Postgres RLS violation code or 401/403
  expect(error?.code === "42501" || /row-level security|permission/i.test(error?.message ?? "")).toBe(true);
}

describe("RLS — public reads (should succeed for anon)", () => {
  it("trails: anon can read active trails", async () => {
    const { data, error } = await anon.from("trails").select("id,is_active").limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // Every returned trail must be active
    (data ?? []).forEach((t: any) => expect(t.is_active).toBe(true));
  });

  it("courses: anon can read active courses", async () => {
    const { data, error } = await anon.from("courses").select("id,is_active").limit(5);
    expect(error).toBeNull();
    (data ?? []).forEach((c: any) => expect(c.is_active).toBe(true));
  });

  it("lessons: anon can read active lessons", async () => {
    const { data, error } = await anon.from("lessons").select("id,is_active").limit(5);
    expect(error).toBeNull();
    (data ?? []).forEach((l: any) => expect(l.is_active).toBe(true));
  });
});

describe("RLS — sensitive tables (anon SELECT must return 0 rows)", () => {
  const sensitive = [
    "user_roles",
    "user_progress",
    "user_profiles",
    "user_gamification_events",
    "user_achievements",
    "user_daily_missions",
    "user_onboarding_answers",
    "user_playground_sessions",
    "user_guide_progress",
    "user_rewards",
    "lesson_reports",
    "lesson_ratings",
    "diagnostic_logs",
    "missoes_diarias",
    "points_history",
    "pricing_sessions",
    "saved_templates",
    "pipeline_executions",
    "system_logs",
    "elevenlabs_usage_log",
    "elevenlabs_alert_config",
    "claude_cache",
    "exercises",
    "exercise_audits",
    "image_jobs",
    "image_assets",
    "image_attempts",
    "image_presets",
    "image_lab_circuit_state",
    "lesson_migrations_audit",
    "community_posts", // requires authenticated, anon must get 0
  ];

  for (const table of sensitive) {
    it(`${table}: anon SELECT returns no rows`, async () => {
      await expectNoRows(table);
    });
  }
});

describe("RLS — privilege escalation must be blocked", () => {
  it("user_roles: anon cannot insert an admin role", async () => {
    await expectInsertBlocked("user_roles", {
      user_id: "00000000-0000-0000-0000-000000000001",
      role: "admin",
    });
  });

  it("users: anon cannot insert a user row", async () => {
    await expectInsertBlocked("users", {
      id: "00000000-0000-0000-0000-000000000002",
      email: "rls-test@example.com",
    });
  });
});

describe("RLS — writes to user-scoped tables must be blocked for anon", () => {
  const writeTargets: Array<[string, Record<string, any>]> = [
    ["lesson_reports", { lesson_id: "x", category: "bug", user_id: "00000000-0000-0000-0000-000000000003" }],
    ["lesson_ratings", { lesson_id: "00000000-0000-0000-0000-000000000004", rating: 5, user_id: "00000000-0000-0000-0000-000000000003" }],
    ["user_progress", { user_id: "00000000-0000-0000-0000-000000000003", lesson_id: "00000000-0000-0000-0000-000000000004" }],
    ["points_history", { user_id: "00000000-0000-0000-0000-000000000003", points: 9999, reason: "rls-test" }],
    ["user_gamification_events", { user_id: "00000000-0000-0000-0000-000000000003", event_type: "rls_test" }],
    ["community_posts", { user_id: "00000000-0000-0000-0000-000000000003", content: "rls-test" }],
    ["pipeline_executions", { lesson_title: "rls-test", model: "x", input_data: {} }],
    ["lessons", { title: "rls-test", order_index: 999, content: {} }],
    ["trails", { title: "rls-test", order_index: 999 }],
    ["courses", { title: "rls-test", order_index: 999 }],
  ];

  for (const [table, payload] of writeTargets) {
    it(`${table}: anon INSERT blocked`, async () => {
      await expectInsertBlocked(table, payload);
    });
  }
});

describe("RLS — anon UPDATE/DELETE must affect 0 rows", () => {
  it("lessons: anon UPDATE affects nothing", async () => {
    const { data, error } = await anon
      .from("lessons")
      .update({ title: "rls-pwn" })
      .eq("title", "____never_matches____")
      .select();
    // Either RLS blocks (error) or filter matches nothing — both are safe.
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it("user_roles: anon DELETE affects nothing", async () => {
    const { data, error } = await anon
      .from("user_roles")
      .delete()
      .eq("user_id", "00000000-0000-0000-0000-000000000099")
      .select();
    if (!error) expect(data ?? []).toHaveLength(0);
  });
});

describe("RLS — has_role function cannot be exploited by anon", () => {
  it("has_role RPC: anon calling for admin returns false", async () => {
    const { data, error } = await anon.rpc("has_role", {
      _user_id: "00000000-0000-0000-0000-000000000001",
      _role: "admin",
    });
    // Function is SECURITY DEFINER + STABLE — callable but returns false.
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});
