import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verify that the request comes from an authenticated admin user.
 * Returns the authenticated user on success, or a Response to send on failure.
 */
export async function requireAdmin(req: Request): Promise<
  { user: { id: string; email?: string }; error?: never } |
  { user?: never; error: Response }
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized: missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized: invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  // Check admin role via user_roles table (service role to bypass RLS)
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = (roles ?? []).some(
    (r: { role: string }) => r.role === 'admin' || r.role === 'supervisor'
  );

  if (!isAdmin) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { user: { id: user.id, email: user.email } };
}

/**
 * Verify that the request comes from any authenticated user.
 * Returns the authenticated user on success, or a Response to send on failure.
 */
export async function requireUser(req: Request): Promise<
  { user: { id: string; email?: string }; error?: never } |
  { user?: never; error: Response }
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized: missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized: invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { user: { id: user.id, email: user.email } };
}

/**
 * Aceita requisição de admin user OU chamadas server-to-server autenticadas
 * com a SUPABASE_SERVICE_ROLE_KEY no Authorization header. Use em edge
 * functions invocadas tanto por admins via UI quanto por outras edge
 * functions (ex.: cron jobs internos).
 *
 * O service_role só é conhecido por edge functions e pelo dashboard do
 * Supabase, nunca exposto ao cliente.
 */
export async function requireAdminOrService(req: Request): Promise<
  { user: { id: string; email?: string }; error?: never } |
  { user?: never; error: Response }
> {
  const authHeader = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    return { user: { id: '__service__', email: 'service_role' } };
  }
  return requireAdmin(req);
}
