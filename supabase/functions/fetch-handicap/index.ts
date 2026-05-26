import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { license_number, player_id, force } = await req.json();


    if (!license_number || !player_id) {
      return new Response(
        JSON.stringify({ error: "license_number and player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check cache (24h) unless force refresh
    if (!force) {
      const { data: player } = await supabase
        .from("players")
        .select("handicap_actual, handicap_updated_at")
        .eq("id", player_id)
        .single();

      if (player?.handicap_updated_at) {
        const lastUpdate = new Date(player.handicap_updated_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursDiff < 24 && player.handicap_actual !== null) {
          return new Response(
            JSON.stringify({
              handicap: player.handicap_actual,
              updated_at: player.handicap_updated_at,
              cached: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Scrape from pitch.cat
    const formData = new URLSearchParams();
    formData.append("LOGIN", license_number);
    formData.append("action", "consultar");

    const response = await fetch("https://pitch.cat/handicap.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("iso-8859-1");
    const html = decoder.decode(buffer);

    // Extract handicap from: Handicap exacte: <strong>(+)2,4</strong>
    const handicapMatch = html.match(
      /Handicap exacte:\s*<strong>([^<]+)<\/strong>/i
    );

    if (!handicapMatch) {
      return new Response(
        JSON.stringify({ error: "Handicap not found for this license", handicap: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawHandicap = handicapMatch[1].trim();
    // Parse: "(+)2,4" → 2.4 (positive), "2,4" → -2.4 (negative in pitch&putt convention)
    // In pitch.cat: (+) means positive handicap (better player)
    let handicapValue: number;
    const cleaned = rawHandicap.replace(/\s/g, "");
    
    if (cleaned.startsWith("(+)")) {
      // Positive handicap
      const numStr = cleaned.replace("(+)", "").replace(",", ".");
      handicapValue = parseFloat(numStr);
    } else if (cleaned.startsWith("(-)")) {
      // Negative handicap  
      const numStr = cleaned.replace("(-)", "").replace(",", ".");
      handicapValue = -parseFloat(numStr);
    } else {
      // Just a number
      const numStr = cleaned.replace(",", ".");
      handicapValue = -parseFloat(numStr); // Default negative in P&P
    }

    // Extract date: Última actualització el DD.MM.YYYY
    const dateMatch = html.match(
      /[Úú]ltima actualitzaci[óo] el\s*(\d{2})\.(\d{2})\.(\d{4})/i
    );
    let updatedDate: string | null = null;
    if (dateMatch) {
      updatedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    const now = new Date().toISOString();

    // Update player in database
    const { error: updateError } = await supabase
      .from("players")
      .update({
        handicap_actual: handicapValue,
        handicap_updated_at: now,
      })
      .eq("id", player_id);

    if (updateError) {
      console.error("Error updating player:", updateError);
    }

    return new Response(
      JSON.stringify({
        handicap: handicapValue,
        updated_at: now,
        federation_date: updatedDate,
        raw: rawHandicap,
        cached: false,
      }),
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
