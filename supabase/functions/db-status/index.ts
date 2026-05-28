// Read-only DB status endpoint. Admin-only. Zero writes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const TABLES = [
  'users',
  'user_roles',
  'trails',
  'courses',
  'lessons',
  'user_gamification_events',
  'lesson_reports',
  'pipeline_executions',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(url, serviceKey);
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Latency probe: lightweight read-only round trip
    const t0 = performance.now();
    const { error: pingErr } = await admin
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .limit(1);
    const latency_ms = Math.round(performance.now() - t0);
    const connection = pingErr ? 'error' : 'ok';

    // Count rows per table (head:true → no rows returned)
    const tables = await Promise.all(
      TABLES.map(async (name) => {
        try {
          const { count, error } = await admin
            .from(name)
            .select('*', { count: 'exact', head: true });
          return {
            name,
            rows: error ? null : (count ?? 0),
            error: error?.message ?? null,
          };
        } catch (e: any) {
          return { name, rows: null, error: e?.message ?? String(e) };
        }
      })
    );

    return new Response(
      JSON.stringify({
        connection,
        latency_ms,
        connection_error: pingErr?.message ?? null,
        tables,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
