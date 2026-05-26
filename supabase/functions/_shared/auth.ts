import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verifies the Authorization header contains a valid Supabase JWT.
 * Returns the user on success, or a Response (401/403) on failure.
 */
export async function verifyAuth(req: Request, corsHeaders: Record<string, string>): Promise<
  | { user: { id: string; email?: string }; authHeader: string }
  | Response
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { user: { id: data.user.id, email: data.user.email ?? undefined }, authHeader };
}
