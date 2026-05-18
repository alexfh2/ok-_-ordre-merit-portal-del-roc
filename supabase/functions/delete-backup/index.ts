import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { admin, refreshAccessTokenIfNeeded } from "../_shared/drive.ts";

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
    const { id } = await req.json();
    if (!id) throw new Error("id required");
    const sb = admin();
    const { data: row } = await sb.from("backups_log").select("*").eq("id", id).maybeSingle();
    if (!row) throw new Error("not found");

    if (row.storage_path) {
      await sb.storage.from("backups").remove([row.storage_path]);
    }
    if (row.drive_file_id) {
      try {
        const tk = await refreshAccessTokenIfNeeded();
        if (tk) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${row.drive_file_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${tk}` },
          });
        }
      } catch (e) { console.error("Drive delete failed:", e); }
    }
    await sb.from("backups_log").delete().eq("id", id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
