import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { admin, refreshAccessTokenIfNeeded, uploadToDrive, getDriveSettings } from "../_shared/drive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = "pitchputt-vendrell-cron-2026";

const TABLES = [
  "tournaments", "players", "pairs", "pair_members",
  "results", "hole_scores", "pair_results", "pair_hole_scores",
  "rankings", "pair_rankings",
  "historic_seasons", "historic_results", "historic_hole_scores",
  "historic_rankings", "historic_winners",
] as const;

async function isAuthorized(req: Request): Promise<{ ok: boolean; userId?: string }> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return { ok: false };
  // Service role / anon for cron
  if (token === SERVICE_ROLE || token === ANON_KEY) return { ok: true };
  const tmp = createClient(SUPABASE_URL, ANON_KEY);
  const { data } = await tmp.auth.getUser(token);
  if (!data?.user) return { ok: false };
  return { ok: true, userId: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = admin();
  let logId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const tipo = body.tipo === "automatico" ? "automatico" : "manual";

    // Auth: accept user JWT, service role, anon key, OR cron_secret in body (for scheduled jobs)
    const isCron = body.cron_secret === CRON_SECRET;
    let userId: string | undefined;
    if (!isCron) {
      const { ok, userId: uid } = await isAuthorized(req);
      if (!ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = uid;
    }

    const snapshot: Record<string, unknown[]> = {};
    let totalRecords = 0;
    for (const t of TABLES) {
      const all: unknown[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await sb.from(t).select("*").range(from, from + pageSize - 1);
        if (error) throw new Error(`${t}: ${error.message}`);
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      snapshot[t] = all;
      totalRecords += all.length;
    }

    const meta = {
      created_at: new Date().toISOString(),
      type: tipo,
      tables: Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, v.length])),
    };
    const payload = JSON.stringify({ meta, data: snapshot });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = tipo === "automatico" ? "auto" : "manual";
    const filename = `backup-${stamp}.json`;
    const storagePath = `${folder}/${filename}`;
    const sizeBytes = new Blob([payload]).size;

    // Insert log row first as 'exitoso' after upload succeeds
    const { data: logRow, error: logErr } = await sb.from("backups_log").insert({
      filename,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      tipo,
      estado: "exitoso",
      tablas_incluidas: TABLES as unknown as string[],
      total_registros: totalRecords,
      created_by: userId ?? null,
    }).select("id").single();
    if (logErr) throw new Error(`log insert: ${logErr.message}`);
    logId = logRow.id;

    // Upload to storage
    const { error: upErr } = await sb.storage
      .from("backups")
      .upload(storagePath, new Blob([payload], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (upErr) throw new Error(`storage: ${upErr.message}`);

    // Try Drive upload (best effort)
    let driveFileId: string | null = null;
    try {
      const settings = await getDriveSettings();
      if (settings?.refresh_token && settings?.folder_id) {
        const token = await refreshAccessTokenIfNeeded();
        if (token) {
          const result = await uploadToDrive(token, settings.folder_id, filename, payload);
          driveFileId = result.id;
          await sb.from("backups_log").update({
            drive_file_id: driveFileId,
            drive_uploaded_at: new Date().toISOString(),
          }).eq("id", logId);
        }
      }
    } catch (driveErr) {
      console.error("Drive upload failed (non-fatal):", driveErr);
    }

    // Retention cleanup
    await cleanup(sb, "auto", 14);
    await cleanup(sb, "manual", 30);

    return new Response(JSON.stringify({ success: true, filename, total_registros: totalRecords, drive_file_id: driveFileId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-backup error:", err);
    if (logId) {
      await sb.from("backups_log").update({
        estado: "error",
        error_mensaje: (err as Error).message,
      }).eq("id", logId);
    } else {
      await sb.from("backups_log").insert({
        filename: "error",
        storage_path: "error",
        tipo: "manual",
        estado: "error",
        error_mensaje: (err as Error).message,
      });
    }
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function cleanup(sb: any, folder: string, keep: number) {
  const tipo = folder === "auto" ? "automatico" : "manual";
  const { data } = await sb.from("backups_log")
    .select("id, storage_path, drive_file_id")
    .eq("tipo", tipo)
    .eq("estado", "exitoso")
    .order("created_at", { ascending: false });
  if (!data || data.length <= keep) return;
  const toDelete = data.slice(keep);
  const paths = toDelete.map((r: { storage_path: string }) => r.storage_path);
  if (paths.length) {
    await sb.storage.from("backups").remove(paths);
    await sb.from("backups_log").delete().in("id", toDelete.map((r: { id: string }) => r.id));
  }
}
