import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function fetchHandicap(license: string): Promise<{ handicap: number | null; raw: string | null; federationDate: string | null }> {
  try {
    const formData = new URLSearchParams();
    formData.append("LOGIN", license);
    formData.append("action", "consultar");

    const response = await fetch("https://pitch.cat/handicap.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("iso-8859-1");
    const html = decoder.decode(buffer);

    const handicapMatch = html.match(/Handicap exacte:\s*<strong>([^<]+)<\/strong>/i);
    if (!handicapMatch) return { handicap: null, raw: null, federationDate: null };

    const rawHandicap = handicapMatch[1].trim();
    const cleaned = rawHandicap.replace(/\s/g, "");
    let handicapValue: number;

    if (cleaned.startsWith("(+)")) {
      handicapValue = parseFloat(cleaned.replace("(+)", "").replace(",", "."));
    } else if (cleaned.startsWith("(-)")) {
      handicapValue = -parseFloat(cleaned.replace("(-)", "").replace(",", "."));
    } else {
      handicapValue = -parseFloat(cleaned.replace(",", "."));
    }

    const dateMatch = html.match(/[Úú]ltima actualitzaci[óo] el\s*(\d{2})\.(\d{2})\.(\d{4})/i);
    let federationDate: string | null = null;
    if (dateMatch) {
      federationDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    return { handicap: handicapValue, raw: rawHandicap, federationDate };
  } catch (e) {
    console.error(`Error fetching handicap for ${license}:`, e);
    return { handicap: null, raw: null, federationDate: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force } = await req.json().catch(() => ({ force: false }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all players with license numbers
    const { data: players, error } = await supabase
      .from("players")
      .select("id, license_number, handicap_actual, handicap_updated_at")
      .not("license_number", "is", null)
      .neq("license_number", "");

    if (error) throw error;
    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, message: "No players with licenses found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const results: { id: string; handicap: number | null; status: string }[] = [];

    // Process in batches of 5 to avoid overwhelming pitch.cat
    const batchSize = 5;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      const promises = batch.map(async (player) => {
        // Skip if recently updated (24h cache) unless forced
        if (!force && player.handicap_updated_at) {
          const lastUpdate = new Date(player.handicap_updated_at);
          const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
          if (hoursDiff < 24 && player.handicap_actual !== null) {
            results.push({ id: player.id, handicap: player.handicap_actual, status: "cached" });
            return;
          }
        }

        const result = await fetchHandicap(player.license_number!);
        if (result.handicap !== null) {
          await supabase
            .from("players")
            .update({
              handicap_actual: result.handicap,
              handicap_updated_at: now.toISOString(),
            })
            .eq("id", player.id);
          results.push({ id: player.id, handicap: result.handicap, status: "updated" });
        } else {
          results.push({ id: player.id, handicap: null, status: "not_found" });
        }
      });
      await Promise.all(promises);
      // Small delay between batches
      if (i + batchSize < players.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const updated = results.filter(r => r.status === "updated").length;
    const cached = results.filter(r => r.status === "cached").length;
    const notFound = results.filter(r => r.status === "not_found").length;

    return new Response(
      JSON.stringify({ updated, cached, not_found: notFound, total: players.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
