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
    const body = await req.json();
    const { folder_id, folder_name, create_name } = body;
    const sb = admin();

    let finalId = folder_id;
    let finalName = folder_name;

    if (create_name) {
      const accessToken = await refreshAccessTokenIfNeeded();
      if (!accessToken) throw new Error("Drive no connectat");
      const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: create_name,
          mimeType: "application/vnd.google-apps.folder",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json));
      finalId = json.id;
      finalName = json.name;
    }

    if (!finalId) throw new Error("folder_id or create_name required");

    if (finalId && !finalName) {
      const accessToken = await refreshAccessTokenIfNeeded();
      if (!accessToken) throw new Error("Drive no connectat");
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${finalId}?fields=id,name,mimeType`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const meta = await metaRes.json();
      if (!metaRes.ok) throw new Error(`No es pot accedir a la carpeta: ${JSON.stringify(meta)}`);
      if (meta.mimeType !== "application/vnd.google-apps.folder") {
        throw new Error("L'ID proporcionat no és una carpeta de Drive");
      }
      finalName = meta.name;
    }

    await sb.from("drive_settings").update({
      folder_id: finalId,
      folder_name: finalName,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    return new Response(JSON.stringify({ success: true, folder_id: finalId, folder_name: finalName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
