import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ALLOWED_KEYS = ["galeria_ativa", "agenda_ativa"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (req.method === "POST") {
      // Require auth (any authenticated user with admin role can update)
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) return json({ error: "unauthorized" }, 401);

      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

      const { data: isAdmin } = await admin.rpc("eh_admin", { _user_id: userData.user.id });
      if (!isAdmin) return json({ error: "forbidden" }, 403);

      const body = await req.json();
      const { chave, valor } = body || {};
      if (!ALLOWED_KEYS.includes(chave)) return json({ error: "invalid key" }, 400);

      const valorStr = String(valor);
      const { data: existing } = await admin
        .from("configuracoes")
        .select("id")
        .eq("chave", chave)
        .maybeSingle();

      if (existing) {
        await admin.from("configuracoes").update({ valor: valorStr }).eq("chave", chave);
      } else {
        await admin.from("configuracoes").insert({ chave, valor: valorStr });
      }
      return json({ ok: true, chave, valor: valorStr });
    }

    // GET: read public config
    const { data, error } = await admin
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ALLOWED_KEYS);

    if (error) throw error;

    const config: Record<string, string> = {};
    for (const row of data || []) config[row.chave] = row.valor ?? "true";
    if (!("galeria_ativa" in config)) config.galeria_ativa = "true";
    if (!("agenda_ativa" in config)) config.agenda_ativa = "true";

    return new Response(JSON.stringify(config), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return json({ galeria_ativa: "true", agenda_ativa: "true", error: String(e) }, 200);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
