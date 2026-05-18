import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { createDriveOAuthState } from "../_shared/drive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data: u } = await tmp.auth.getUser(token);
  if (!u?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { redirect_uri } = await req.json();
    if (!redirect_uri) throw new Error("redirect_uri required");

    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
    const callbackUrl = `${SUPABASE_URL}/functions/v1/drive-oauth-callback`;
    const state = await createDriveOAuthState(redirect_uri);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
