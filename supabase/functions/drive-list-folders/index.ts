import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { refreshAccessTokenIfNeeded } from "../_shared/drive.ts";

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
    const accessToken = await refreshAccessTokenIfNeeded();
    if (!accessToken) throw new Error("Drive no connectat");

    const url = "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false") +
      "&fields=files(id,name,parents)&pageSize=200";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return new Response(JSON.stringify({ folders: json.files || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
