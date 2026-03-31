import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    let body: Record<string, unknown>;

    // Support both JSON and sendBeacon (plain text / blob)
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "Invalid body" }, 400);
      }
    }

    const action = body.action as string;

    // ─── AUDIT 2: IP CAPTURE SERVER-SIDE ───
    const ip = extractIP(req);
    console.log(`[Chama] Action: ${action}, IP: ${ip}`);

    // ─── PAGE VIEW CAPTURE ───
    if (action === "pageview") {
      let geoFields: Record<string, unknown> = {};
      if (!body.cidade) {
        geoFields = await serverGeoLookup(ip);
      }

      const visitRow: Record<string, unknown> = {
        pagina: body.pagina || "/",
        dominio_origem: body.dominio_origem || null,
        user_agent: body.user_agent || null,
        largura_tela: body.largura_tela || null,
        altura_tela: body.altura_tela || null,
        referrer: body.referrer || null,
        dispositivo: body.dispositivo || null,
        sistema_operacional: body.sistema_operacional || null,
        navegador: body.navegador || null,
        cookie_visitante: body.cookie_visitante || null,
        primeira_visita: body.primeira_visita ?? null,
        contador_visitas: body.contador_visitas || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_content: body.utm_content || null,
        utm_term: body.utm_term || null,
        endereco_ip: ip,
        cidade: body.cidade || geoFields.cidade || null,
        estado: body.estado || geoFields.estado || null,
        pais: body.pais || geoFields.pais || null,
        bairro: body.bairro || geoFields.bairro || null,
        cep: body.cep || geoFields.cep || null,
        rua: body.rua || geoFields.rua || null,
        endereco_completo: body.endereco_completo || geoFields.endereco_completo || null,
        latitude: body.latitude || geoFields.latitude || null,
        longitude: body.longitude || geoFields.longitude || null,
        zona_eleitoral: body.zona_eleitoral || geoFields.zona_eleitoral || null,
        regiao_planejamento: body.regiao_planejamento || geoFields.regiao_planejamento || null,
        precisao_localizacao: body.precisao_localizacao || "IP_APROXIMADO",
      };

      const { data: result, error } = await supabase
        .from("acessos_site")
        .insert(visitRow)
        .select("id")
        .single();

      if (error) {
        console.error("Pageview insert error:", error.message);
        return json({ error: error.message }, 500);
      }

      return json({ success: true, id: result?.id });
    }

    // ─── UPDATE LOCATION ───
    if (action === "update-location") {
      const cookie = body.cookie_visitante as string;
      const table = body.table as string;

      if (!cookie) {
        return json({ error: "Missing cookie_visitante" }, 400);
      }

      const locationCols = ["endereco_ip", "pais", "estado", "cidade", "bairro", "cep", "rua", "endereco_completo", "zona_eleitoral", "regiao_planejamento", "latitude", "longitude", "precisao_localizacao"];
      const updateFields: Record<string, unknown> = {};
      for (const field of locationCols) {
        if (body[field] !== undefined && body[field] !== null) {
          updateFields[field] = body[field];
        }
      }

      if (Object.keys(updateFields).length === 0) {
        return json({ message: "No fields to update" }, 200);
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const enderecoIp = (body.endereco_ip as string) || ip;

      const updates = table
        ? [runLocationUpdate(supabase, table, updateFields, cookie, enderecoIp, twentyFourHoursAgo)]
        : [
            runLocationUpdate(supabase, "acessos_site", updateFields, cookie, enderecoIp, twentyFourHoursAgo),
            runLocationUpdate(supabase, "cliques_whatsapp", updateFields, cookie, enderecoIp, twentyFourHoursAgo),
            runLocationUpdate(supabase, "mensagens_contato", updateFields, cookie, enderecoIp, twentyFourHoursAgo),
          ];

      const results = await Promise.allSettled(updates);
      const errors = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && r.value?.error));
      if (errors.length > 0) {
        console.error("Update location errors:", JSON.stringify(errors));
      }

      console.log(`[Chama] Update-location for ${cookie}: ${Object.keys(updateFields).join(", ")}`);
      return json({ success: true });
    }

    // ─── CLICK CAPTURE ───
    if (action === "click") {
      // AUDIT 3: Server-side geo with parallel calls and merge
      let geoFields: Record<string, unknown> = {};
      if (!body.cidade) {
        geoFields = await serverGeoLookup(ip);
      }

      const clickRow: Record<string, unknown> = {
        tipo_clique: body.tipo_clique || "whatsapp",
        pagina_origem: body.pagina_origem || null,
        dominio_origem: body.dominio_origem || null,
        cookie_visitante: body.cookie_visitante || null,
        texto_botao: body.texto_botao || null,
        secao_pagina: body.secao_pagina || null,
        url_destino: body.url_destino || null,
        telefone_destino: body.telefone_destino || null,
        user_agent: body.user_agent || null,
        endereco_ip: ip,
        cidade: body.cidade || geoFields.cidade || null,
        estado: body.estado || geoFields.estado || null,
        pais: body.pais || geoFields.pais || null,
        bairro: body.bairro || geoFields.bairro || null,
        cep: body.cep || geoFields.cep || null,
        rua: body.rua || geoFields.rua || null,
        endereco_completo: body.endereco_completo || geoFields.endereco_completo || null,
        latitude: body.latitude || geoFields.latitude || null,
        longitude: body.longitude || geoFields.longitude || null,
        dispositivo: body.dispositivo || null,
        sistema_operacional: body.sistema_operacional || null,
        navegador: body.navegador || null,
        precisao_localizacao: body.precisao_localizacao || "IP_APROXIMADO",
      };

      const { error } = await supabase.from("cliques_whatsapp").insert(clickRow);
      if (error) {
        console.error("Click insert error:", error.message);
      }

      return json({ success: !error });
    }

    // ─── RETROACTIVE ENRICHMENT ───
    if (action === "retroactive-enrich") {
      const cookie = body.cookie_visitante as string;
      if (!cookie) return json({ error: "Missing cookie" }, 400);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const updateData: Record<string, unknown> = {};
      for (const f of ["endereco_ip", "pais", "estado", "cidade", "bairro", "cep", "rua", "endereco_completo", "zona_eleitoral", "regiao_planejamento", "latitude", "longitude", "precisao_localizacao"]) {
        if (body[f]) updateData[f] = body[f];
      }

      if (Object.keys(updateData).length > 0) {
        await Promise.allSettled([
          supabase.from("acessos_site").update(updateData)
            .eq("cookie_visitante", cookie).gte("criado_em", sevenDaysAgo).is("cidade", null),
          supabase.from("cliques_whatsapp").update(updateData)
            .eq("cookie_visitante", cookie).gte("criado_em", sevenDaysAgo).is("cidade", null),
          supabase.from("mensagens_contato").update(updateData)
            .eq("cookie_visitante", cookie).gte("criado_em", sevenDaysAgo).is("cidade", null),
        ]);
      }

      console.log(`Retroactive enrich for ${cookie}: updated with ${JSON.stringify(updateData)}`);
      return json({ success: true });
    }

    // ─── EXIT TRACKING ───
    if (action === "exit") {
      const cookie = body.cookie_visitante as string;
      if (cookie) {
        console.log(`Exit: ${cookie}, page: ${body.pagina}, time: ${body.tempo_na_pagina}s, scroll: ${body.profundidade_scroll}%`);
      }
      return json({ success: true });
    }

    // ─── FORM CAPTURE ───
    if (action === "form") {
      // AUDIT 3: Server-side geo with parallel calls
      let geoFields: Record<string, unknown> = {};
      if (!body.cidade) {
        geoFields = await serverGeoLookup(ip);
      }

      const formRow: Record<string, unknown> = {
        nome: body.nome,
        telefone: body.telefone,
        email: body.email || null,
        mensagem: body.mensagem,
        dominio_origem: body.dominio_origem || null,
        endereco_ip: ip,
        user_agent: body.user_agent || null,
        cidade: body.cidade || geoFields.cidade || null,
        estado: body.estado || geoFields.estado || null,
        pais: body.pais || geoFields.pais || null,
        bairro: body.bairro || geoFields.bairro || null,
        cep: body.cep || geoFields.cep || null,
        rua: body.rua || geoFields.rua || null,
        endereco_completo: body.endereco_completo || geoFields.endereco_completo || null,
        latitude: body.latitude || geoFields.latitude || null,
        longitude: body.longitude || geoFields.longitude || null,
        zona_eleitoral: body.zona_eleitoral || geoFields.zona_eleitoral || null,
        precisao_localizacao: body.precisao_localizacao || "IP_APROXIMADO",
      };

      const { data: result, error } = await supabase
        .from("mensagens_contato")
        .insert(formRow)
        .select("id")
        .single();

      if (error) {
        console.error("Form insert error:", error.message);
        return json({ error: error.message }, 500);
      }

      return json({ success: true, id: result?.id });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("track-capture error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ─── HELPERS ───

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// AUDIT 2: IP extraction with full priority chain + proxy warnings
function extractIP(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) { console.log(`[Chama] IP source: cf-connecting-ip`); return cfIp; }

  const trueClientIp = req.headers.get("true-client-ip");
  if (trueClientIp) { console.log(`[Chama] IP source: true-client-ip`); return trueClientIp; }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map(s => s.trim());
    // Find first non-private IP
    const publicIp = ips.find(ip => !isPrivateIP(ip));
    if (publicIp) {
      console.log(`[Chama] IP source: x-forwarded-for (public)`);
      return publicIp;
    }
    // If all are private, use first one
    console.log(`[Chama] IP source: x-forwarded-for (private — PROXY_IP_NOT_CONFIGURED)`);
    console.warn(`[Chama] PROXY_IP_NOT_CONFIGURED: All forwarded IPs are private: ${forwarded}`);
    return ips[0];
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    if (isPrivateIP(realIp)) {
      console.warn(`[Chama] PROXY_IP_NOT_CONFIGURED: x-real-ip is private: ${realIp}`);
    }
    console.log(`[Chama] IP source: x-real-ip`);
    return realIp;
  }

  console.warn("[Chama] PROXY_IP_NOT_CONFIGURED: No IP headers found, using 0.0.0.0");
  return "0.0.0.0";
}

function isPrivateIP(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.16.") || ip.startsWith("172.17.") || ip.startsWith("172.18.") || ip.startsWith("172.19.") || ip.startsWith("172.2") || ip.startsWith("172.3");
}

async function runLocationUpdate(
  supabase: ReturnType<typeof createClient>,
  table: string,
  updateFields: Record<string, unknown>,
  cookie: string,
  enderecoIp: string,
  sinceIso: string,
) {
  if (table === "mensagens_contato") {
    return await supabase
      .from(table)
      .update(updateFields)
      .eq("endereco_ip", enderecoIp)
      .gte("criado_em", sinceIso);
  }

  return await supabase
    .from(table)
    .update(updateFields)
    .eq("cookie_visitante", cookie)
    .gte("criado_em", sinceIso);
}

// AUDIT 3: Server-side geo with parallel calls and merge
async function serverGeoLookup(ip: string): Promise<Record<string, unknown>> {
  if (!ip || ip === "0.0.0.0" || isPrivateIP(ip)) {
    console.warn(`[Chama] Skipping geo lookup for private/missing IP: ${ip}`);
    return {};
  }

  // Run both in parallel
  const [primaryResult, fallbackResult] = await Promise.allSettled([
    (async () => {
      const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error("ipapi failed");
      const d = await res.json();
      if (!d.city) throw new Error("ipapi no city");
      return {
        cidade: d.city || null,
        estado: d.region || null,
        pais: d.country_name || null,
        cep: d.postal || null,
        latitude: d.latitude || null,
        longitude: d.longitude || null,
        bairro: d.district || null,
        provedor: d.org || null,
      };
    })(),
    (async () => {
      const res = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,region,city,district,zip,lat,lon,isp,org,as,query`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error("ip-api failed");
      const d = await res.json();
      if (d.status !== "success") throw new Error("ip-api not success");
      return {
        cidade: d.city || null,
        estado: d.regionName || null,
        pais: d.country || null,
        cep: d.zip || null,
        latitude: d.lat || null,
        longitude: d.lon || null,
        bairro: d.district || null,
        provedor: d.isp || null,
      };
    })(),
  ]);

  const primary = primaryResult.status === "fulfilled" ? primaryResult.value : null;
  const fallback = fallbackResult.status === "fulfilled" ? fallbackResult.value : null;

  if (!primary && !fallback) return {};

  // Merge: prefer primary, fill gaps from fallback
  const base = primary || {};
  const fill = fallback || {};
  const merged: Record<string, unknown> = { ...base };

  for (const key of Object.keys(fill)) {
    if (!merged[key] && (fill as any)[key]) {
      merged[key] = (fill as any)[key];
    }
  }

  console.log(`[Chama] Geo lookup for ${ip}: cidade=${merged.cidade}, estado=${merged.estado}, bairro=${merged.bairro}`);
  return merged;
}
