import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { admin } from "../_shared/drive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function isAuthorized(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data } = await tmp.auth.getUser(token);
  return data?.user ?? null;
}

// Insert order respecting FKs
const INSERT_ORDER = [
  "tournaments", "players", "pairs", "pair_members",
  "results", "hole_scores", "pair_results", "pair_hole_scores",
  "rankings", "pair_rankings",
  "historic_seasons", "historic_results", "historic_hole_scores",
  "historic_rankings", "historic_winners",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await isAuthorized(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = admin();

  try {
    const body = await req.json();
    let snapshot: Record<string, unknown[]> | null = null;

    if (body.path) {
      const { data, error } = await sb.storage.from("backups").download(body.path);
      if (error) throw error;
      const txt = await data.text();
      snapshot = JSON.parse(txt).data;
    } else if (body.payload) {
      snapshot = body.payload.data || body.payload;
    } else {
      throw new Error("path or payload required");
    }
    if (!snapshot) throw new Error("invalid snapshot");

    // Pre-restoration safety backup
    try {
      const TABLES = INSERT_ORDER;
      const safety: Record<string, unknown[]> = {};
      let total = 0;
      for (const t of TABLES) {
        const { data } = await sb.from(t).select("*").range(0, 9999);
        safety[t] = data || [];
        total += (data || []).length;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `pre-restore-${stamp}.json`;
      const storagePath = `pre-restore/${filename}`;
      const payload = JSON.stringify({
        meta: { created_at: new Date().toISOString(), type: "pre-restauracion", tables: Object.fromEntries(Object.entries(safety).map(([k,v]) => [k, v.length])) },
        data: safety,
      });
      await sb.storage.from("backups").upload(storagePath, new Blob([payload], { type: "application/json" }));
      await sb.from("backups_log").insert({
        filename, storage_path: storagePath,
        size_bytes: new Blob([payload]).size,
        tipo: "pre-restauracion", estado: "exitoso",
        tablas_incluidas: TABLES, total_registros: total,
        created_by: user.id,
      });
    } catch (safetyErr) {
      console.error("Pre-restore safety backup failed (non-fatal):", safetyErr);
    }

    // MERGE mode: upsert by id
    const counts: Record<string, number> = {};
    for (const t of INSERT_ORDER) {
      const rows = (snapshot[t] as unknown[]) || [];
      counts[t] = rows.length;
      if (!rows.length) continue;
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await sb.from(t).upsert(chunk, { onConflict: "id" });
        if (error) throw new Error(`upsert ${t}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, restored: counts, mode: "merge" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("restore-backup error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
