import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["galeria_ativa", "agenda_ativa"]);

    if (error) throw error;

    const config: Record<string, string> = {};
    for (const row of data || []) {
      config[row.chave] = row.valor ?? "true";
    }

    // defaults
    if (!("galeria_ativa" in config)) config.galeria_ativa = "true";
    if (!("agenda_ativa" in config)) config.agenda_ativa = "true";

    return new Response(JSON.stringify(config), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ galeria_ativa: "true", agenda_ativa: "true", error: String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
