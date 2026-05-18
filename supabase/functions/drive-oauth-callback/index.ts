import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { completeDriveOAuth, verifyDriveOAuthState } from "../_shared/drive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const callbackUrl = `${SUPABASE_URL}/functions/v1/drive-oauth-callback`;

      const verifiedState = state ? await verifyDriveOAuthState(state) : null;
      const redirectTo = new URL(verifiedState?.returnTo ?? `${url.origin.replace('.supabase.co', '.lovable.app')}/admin`);

      if (error) {
        redirectTo.searchParams.set("drive_error", error);
        return Response.redirect(redirectTo.toString(), 302);
      }

      if (!code || !verifiedState) {
        redirectTo.searchParams.set("drive_error", "invalid_callback");
        return Response.redirect(redirectTo.toString(), 302);
      }

      await completeDriveOAuth(code, callbackUrl);
      redirectTo.searchParams.set("drive_connected", "1");
      return Response.redirect(redirectTo.toString(), 302);
    }

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    const tmp = createClient(SUPABASE_URL, ANON_KEY);
    const { data: u } = await tmp.auth.getUser(token);
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) throw new Error("code and redirect_uri required");

    const { email } = await completeDriveOAuth(code, redirect_uri);
    return new Response(JSON.stringify({ success: true, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("oauth-callback error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
