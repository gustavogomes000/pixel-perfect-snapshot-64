import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api-v1\/?/, "").replace(/\/$/, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Auth check: Bearer token
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response(JSON.stringify({ error: "Token obrigatório" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate token against configuracoes table
  const { data: config } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "api_token")
    .single();

  if (!config || config.valor !== token) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // GET /formularios
    if (path === "formularios" && req.method === "GET") {
      const { data, error } = await supabase.from("mensagens_contato").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    // GET /visitantes
    if (path === "visitantes" && req.method === "GET") {
      const { data, error } = await supabase.from("acessos_site").select("*").order("criado_em", { ascending: false }).limit(500);
      if (error) throw error;
      return json(data);
    }

    // GET /cliques
    if (path === "cliques" && req.method === "GET") {
      const { data, error } = await supabase.from("cliques_whatsapp").select("*").order("criado_em", { ascending: false }).limit(500);
      if (error) throw error;
      return json(data);
    }

    // GET /metricas
    if (path === "metricas" && req.method === "GET") {
      const [{ count: forms }, { count: visitors }, { count: clicks }] = await Promise.all([
        supabase.from("mensagens_contato").select("*", { count: "exact", head: true }),
        supabase.from("acessos_site").select("*", { count: "exact", head: true }),
        supabase.from("cliques_whatsapp").select("*", { count: "exact", head: true }),
      ]);
      return json({ formularios: forms, visitantes: visitors, cliques: clicks });
    }

    // GET /galeria
    if (path === "galeria" && req.method === "GET") {
      const { data, error } = await supabase.from("galeria_fotos").select("*").order("ordem");
      if (error) throw error;
      return json(data);
    }

    // GET /status
    if (path === "status" && req.method === "GET") {
      return json({ status: "ok", timestamp: new Date().toISOString() });
    }

    return json({ error: "Rota não encontrada" }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
