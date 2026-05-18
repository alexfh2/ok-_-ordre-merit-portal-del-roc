import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { admin } from "../_shared/drive.ts";

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
    const sb = admin();
    const { data } = await sb.from("drive_settings").select("connected_email, connected_at, folder_id, folder_name").eq("id", 1).maybeSingle();
    return new Response(JSON.stringify({
      connected: !!data?.connected_email,
      email: data?.connected_email ?? null,
      connected_at: data?.connected_at ?? null,
      folder_id: data?.folder_id ?? null,
      folder_name: data?.folder_name ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
