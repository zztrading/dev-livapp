/**
 * RLS Authenticated Cross-User Tests
 *
 * Creates two real users via the service role, signs each in, then verifies:
 *  - User A can read/write their OWN rows
 *  - User A canNOT read User B's rows
 *  - User A canNOT write rows scoped to User B
 *  - Neither user can escalate to admin via user_roles
 *
 * Requires env: SUPABASE_SERVICE_ROLE_KEY
 *   Add it as a Workspace Build Secret, or run locally with:
 *     SUPABASE_SERVICE_ROLE_KEY=<key> npx vitest run src/tests/rls-cross-user.test.ts
 *
 * Skips gracefully when the key is absent (so CI without it stays green).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  "https://pspvppymcdjbwsudxzdx.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzcHZwcHltY2RqYndzdWR4emR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjE5MzgsImV4cCI6MjA3NzMzNzkzOH0.BCv3iMf8pnxLbDd9Py1dfGc_FKw9r_otf3PzMzr42Fw";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const skipSuite = !SERVICE_KEY;
const d = skipSuite ? describe.skip : describe;

if (skipSuite) {
  // eslint-disable-next-line no-console
  console.warn(
    "[rls-cross-user] SKIPPED — set SUPABASE_SERVICE_ROLE_KEY env to enable."
  );
}

// Lazily built clients (avoids constructing with undefined service key)
let admin: SupabaseClient;
let userA: SupabaseClient;
let userB: SupabaseClient;
let userAId: string;
let userBId: string;

const stamp = Date.now();
const A_EMAIL = `rls-test-a-${stamp}@aliv-test.local`;
const B_EMAIL = `rls-test-b-${stamp}@aliv-test.local`;
const PASSWORD = `Rls!Test-${stamp}-Aa1`;

async function makeUserClient(email: string, password: string) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

d("RLS — cross-user authenticated", () => {
  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const a = await admin.auth.admin.createUser({
      email: A_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (a.error) throw a.error;
    userAId = a.data.user!.id;

    const b = await admin.auth.admin.createUser({
      email: B_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (b.error) throw b.error;
    userBId = b.data.user!.id;

    userA = await makeUserClient(A_EMAIL, PASSWORD);
    userB = await makeUserClient(B_EMAIL, PASSWORD);

    // Seed a row owned by User A in user_gamification_events (user-writable, user-readable)
    const seed = await userA.from("user_gamification_events").insert({
      user_id: userAId,
      event_type: "rls_seed_event",
      payload: { test: stamp },
      xp_delta: 0,
      coins_delta: 0,
    });
    expect(seed.error, `seed insert failed: ${seed.error?.message}`).toBeNull();
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    // Best-effort cleanup
    try {
      await admin.from("user_gamification_events").delete().eq("user_id", userAId);
      await admin.from("user_gamification_events").delete().eq("user_id", userBId);
      await admin.from("users").delete().in("id", [userAId, userBId]);
    } catch {
      /* ignore */
    }
    if (userAId) await admin.auth.admin.deleteUser(userAId).catch(() => undefined);
    if (userBId) await admin.auth.admin.deleteUser(userBId).catch(() => undefined);
  }, 30_000);

  // --- Reads --------------------------------------------------------------

  it("User A sees their own gamification event", async () => {
    const { data, error } = await userA
      .from("user_gamification_events")
      .select("user_id,event_type")
      .eq("event_type", "rls_seed_event");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThanOrEqual(1);
    data!.forEach((r: any) => expect(r.user_id).toBe(userAId));
  });

  it("User B cannot see User A's gamification events", async () => {
    const { data, error } = await userB
      .from("user_gamification_events")
      .select("user_id,event_type")
      .eq("user_id", userAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("User B cannot see User A's profile via direct user_id filter", async () => {
    const { data, error } = await userB
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", userAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("User B cannot see User A's row in users table", async () => {
    const { data, error } = await userB
      .from("users")
      .select("id,email")
      .eq("id", userAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("User B cannot see User A's progress rows", async () => {
    const { data, error } = await userB
      .from("user_progress")
      .select("user_id")
      .eq("user_id", userAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("User B cannot see User A's lesson_reports", async () => {
    const { data, error } = await userB
      .from("lesson_reports")
      .select("user_id")
      .eq("user_id", userAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // --- Cross-user writes --------------------------------------------------

  it("User B cannot INSERT a gamification event spoofing User A", async () => {
    const { error } = await userB.from("user_gamification_events").insert({
      user_id: userAId, // pretending to be A
      event_type: "rls_spoof",
      xp_delta: 9999,
      coins_delta: 9999,
    });
    expect(error, "expected RLS to block spoofed insert").not.toBeNull();
  });

  it("User B cannot INSERT lesson_reports as User A", async () => {
    const { error } = await userB.from("lesson_reports").insert({
      user_id: userAId,
      lesson_id: "rls-test-lesson",
      category: "bug",
      details: "spoof",
    });
    expect(error).not.toBeNull();
  });

  it("User B cannot UPDATE User A's gamification events", async () => {
    const { data, error } = await userB
      .from("user_gamification_events")
      .update({ event_type: "rls_pwn" })
      .eq("user_id", userAId)
      .select();
    // RLS makes the row invisible → either error or empty result, never a successful update
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it("User B cannot DELETE User A's gamification events", async () => {
    const { data, error } = await userB
      .from("user_gamification_events")
      .delete()
      .eq("user_id", userAId)
      .select();
    if (!error) expect(data ?? []).toHaveLength(0);
    // Verify A's row still exists from A's perspective
    const verify = await userA
      .from("user_gamification_events")
      .select("event_type")
      .eq("event_type", "rls_seed_event");
    expect(verify.error).toBeNull();
    expect(verify.data?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  // --- Privilege escalation ----------------------------------------------

  it("User A cannot grant themselves admin in user_roles", async () => {
    const { error } = await userA.from("user_roles").insert({
      user_id: userAId,
      role: "admin",
    });
    expect(error, "expected RLS to block self-promotion to admin").not.toBeNull();
  });

  it("User A cannot read user_roles table", async () => {
    const { data, error } = await userA.from("user_roles").select("user_id,role");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("has_role RPC: User A querying admin for User B returns false", async () => {
    const { data, error } = await userA.rpc("has_role", {
      _user_id: userBId,
      _role: "admin",
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  // --- Same-user own-row writes still work --------------------------------

  it("User A can write to their own user_gamification_events", async () => {
    const { error } = await userA.from("user_gamification_events").insert({
      user_id: userAId,
      event_type: "rls_own_write_ok",
      xp_delta: 0,
      coins_delta: 0,
    });
    expect(error).toBeNull();
  });
});
