import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseDb";
import {
  getVisitorId,
  getVisitorCookieStatus,
  detectDevice,
  getUTMParams,
  resolveLocation,
  forceGPS,
  reverseGeocode,
  identifyZone,
  getFailedQueue,
  flushQueue,
  getScrollDepth,
  getSessionDuration,
  classifyOrigin,
  getCachedGeo,
  getNominatimRaw,
  getBairroSource,
  updateLocationViaEdge,
  getGeoMode,
  PRECISAO,
  ZONE_MAP,
  type GeoData,
} from "@/lib/tracking";

type Status = "pending" | "ok" | "warn" | "error";

interface Check {
  label: string;
  status: Status;
  detail: string;
}

const ValidarCaptura = () => {
  const [searchParams] = useSearchParams();
  const [checks, setChecks] = useState<Check[]>([]);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [zoneBairro, setZoneBairro] = useState("");
  const [zoneResult, setZoneResult] = useState("");
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");
  const [coordZoneResult, setCoordZoneResult] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsData, setGpsData] = useState<GeoData | null>(null);
  const [nominatimRaw, setNominatimRaw] = useState<Record<string, unknown> | null>(null);
  const [clickResults, setClickResults] = useState<Record<string, string>>({});
  const [formResult, setFormResult] = useState("");
  const [queueItems, setQueueItems] = useState<unknown[]>([]);
  const [updateResult, setUpdateResult] = useState("");
  const [recentClicks, setRecentClicks] = useState<unknown[]>([]);
  const [recentForm, setRecentForm] = useState<unknown>(null);

  const isAuthorized = searchParams.get("chama") === "validar";

  const updateCheck = useCallback((label: string, status: Status, detail: string) => {
    setChecks((prev) => {
      const existing = prev.findIndex((c) => c.label === label);
      const newCheck = { label, status, detail };
      if (existing >= 0) { const updated = [...prev]; updated[existing] = newCheck; return updated; }
      return [...prev, newCheck];
    });
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;

    // ═══════════════════════════════════════════════════════
    // AUDIT 15: Run all checks on load
    // ═══════════════════════════════════════════════════════

    // 1. Supabase connection
    (async () => {
      updateCheck("Conexão Supabase", "pending", "Testando...");
      try {
        const tables = ["configuracoes", "acessos_site", "cliques_whatsapp", "mensagens_contato", "galeria_fotos"];
        const counts: Record<string, number> = {};
        await Promise.all(tables.map(async (t) => {
          const { count, error } = await (supabase.from as any)(t).select("id", { count: "exact", head: true });
          if (error) throw error;
          counts[t] = count || 0;
        }));
        const detail = Object.entries(counts).map(([t, c]) => `${t}: ${c}`).join(" | ");
        updateCheck("Conexão Supabase", "ok", `Conectado — ${detail}`);
      } catch (e) { updateCheck("Conexão Supabase", "error", `Falha: ${(e as Error).message}`); }
    })();

    // 2. Visitor Cookie — check both localStorage and browser cookie
    const cookieStatus = getVisitorCookieStatus();
    const bothPresent = cookieStatus.localStorage && cookieStatus.cookie;
    updateCheck(
      "Cookie do Visitante",
      bothPresent ? "ok" : cookieStatus.localStorage || cookieStatus.cookie ? "warn" : "error",
      `ID: ${cookieStatus.id || "AUSENTE"} | localStorage: ${cookieStatus.localStorage ? "✅" : "❌"} | cookie (chama_vid): ${cookieStatus.cookie ? "✅" : "❌"}`
    );

    // 3. Device Detection — check all fields are populated strings
    const device = detectDevice();
    const deviceFields = Object.entries(device);
    const hasUndefined = deviceFields.some(([, v]) => !v || v === "undefined" || v === "null");
    updateCheck(
      "Detecção de Dispositivo",
      hasUndefined ? "warn" : "ok",
      deviceFields.map(([k, v]) => `${k}: ${v}`).join(" | ")
    );

    // 4. UTMs
    const utms = getUTMParams();
    const hasUtm = Object.values(utms).some(Boolean);
    updateCheck("Captura de UTMs", "ok", hasUtm ? Object.entries(utms).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(", ") : "Nenhum UTM na URL — adicione ?utm_source=teste para validar");

    // 5. Traffic origin
    updateCheck("Origem do Tráfego", "ok", `Classificado como: ${classifyOrigin(utms, document.referrer || "")}`);

    // 6. Session
    updateCheck("Sessão", "ok", `Duração: ${getSessionDuration()}s | Scroll: ${getScrollDepth()}%`);

    // 6b. Geo Mode
    const geoMode = getGeoMode();
    updateCheck("Precisão Localização", geoMode === PRECISAO.GPS ? "ok" : "warn",
      `Modo: ${geoMode} ${geoMode === PRECISAO.GPS ? "— GPS preciso ativo" : "— Usando aproximação por IP"}`
    );

    // 7. Queue
    const queue = getFailedQueue();
    setQueueItems(queue);
    updateCheck("Fila de Redundância", queue.length === 0 ? "ok" : "warn", `${queue.length} item(s) na fila`);

    // 8. Location resolution
    (async () => {
      updateCheck("Resolução de Localização", "pending", "Resolvendo 4 camadas (GPS + 2x IP + Timezone)...");
      try {
        const geo = await resolveLocation();
        const fields = [
          `Camada: ${geo.geo_layer || "?"}`,
          geo.bairro && `Bairro: ${geo.bairro} (fonte: ${geo.bairro_source || getBairroSource()})`,
          geo.cidade && `Cidade: ${geo.cidade}`,
          geo.estado && `Estado: ${geo.estado}`,
          geo.cep && `CEP: ${geo.cep}`,
          geo.rua && `Rua: ${geo.rua} ${geo.numero || ""}`,
          geo.latitude && `Lat: ${geo.latitude}`,
          geo.longitude && `Lng: ${geo.longitude}`,
          geo.endereco_ip && `IP: ${geo.endereco_ip}`,
          `Zona: ${geo.zona_eleitoral || "Não identificada"}`,
          geo.endereco_completo && `Endereço: ${geo.endereco_completo}`,
        ].filter(Boolean).join(" | ");

        const ipOk = !!geo.endereco_ip && geo.endereco_ip !== "0.0.0.0" && !geo.endereco_ip.startsWith("127.") && !geo.endereco_ip.startsWith("192.168.");
        const geoOk = !!geo.cidade && !!geo.estado && !!geo.latitude && !!geo.longitude;

        updateCheck("Resolução de Localização", geoOk ? "ok" : "warn", fields || "Nenhum dado obtido");
        updateCheck("IP Capturado", ipOk ? "ok" : "warn", `IP: ${geo.endereco_ip || "NÃO CAPTURADO"} ${!ipOk ? "— IP local/privado detectado" : ""}`);
        updateCheck("IP Geolocalização", geoOk ? "ok" : "error",
          `Cidade: ${geo.cidade || "❌"} | Estado: ${geo.estado || "❌"} | Lat: ${geo.latitude || "❌"} | Lng: ${geo.longitude || "❌"}`
        );
      } catch (e) { updateCheck("Resolução de Localização", "error", `Erro: ${(e as Error).message}`); }
    })();

    // 9. Fetch recent clicks for this visitor
    (async () => {
      try {
        const vid = getVisitorId();
        const { data } = await (supabase.from as any)("cliques_whatsapp")
          .select("id, tipo_clique, texto_botao, secao_pagina, criado_em")
          .eq("cookie_visitante", vid)
          .order("criado_em", { ascending: false })
          .limit(3);
        setRecentClicks(data || []);
        updateCheck("Click Tracking", data && data.length > 0 ? "ok" : "warn",
          data && data.length > 0 ? `${data.length} clique(s) recente(s) encontrado(s)` : "Nenhum clique registrado para este visitante"
        );
      } catch { updateCheck("Click Tracking", "error", "Falha ao consultar cliques"); }
    })();

    // 10. Fetch recent form for this visitor
    (async () => {
      try {
        const { data } = await (supabase.from as any)("mensagens_contato")
          .select("id, nome, criado_em, cidade, bairro, zona_eleitoral")
          .order("criado_em", { ascending: false })
          .limit(1);
        setRecentForm(data?.[0] || null);
        updateCheck("Form Tracking", data && data.length > 0 ? "ok" : "warn",
          data && data.length > 0 ? `Último: ${data[0].nome} em ${data[0].criado_em}` : "Nenhum formulário registrado"
        );
      } catch { updateCheck("Form Tracking", "error", "Falha ao consultar formulários"); }
    })();

  }, [isAuthorized, updateCheck]);

  // Scroll live
  useEffect(() => {
    if (!isAuthorized) return;
    const interval = setInterval(() => setScrollDepth(getScrollDepth()), 1000);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  if (!isAuthorized) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Acesso não autorizado.</p></div>;
  }

  const handleGPSTest = async () => {
    setGpsLoading(true);
    setNominatimRaw(null);
    try {
      const pos = await forceGPS();
      if (pos) {
        const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        geo.zona_eleitoral = identifyZone(geo.bairro || "", geo.cidade || "", geo.latitude, geo.longitude);
        setGpsData(geo);
        setNominatimRaw(getNominatimRaw());
      } else {
        setGpsData({ geo_layer: "denied" } as GeoData);
      }
    } catch { setGpsData({ geo_layer: "error" } as GeoData); }
    setGpsLoading(false);
  };

  const handleUpdateLocationTest = async () => {
    setUpdateResult("Testando...");
    const geo = getCachedGeo();
    if (!geo || !geo.latitude) { setUpdateResult("❌ Sem dados de GPS para atualizar"); return; }
    try {
      const result = await updateLocationViaEdge(getVisitorId(), "acessos_site", geo);
      setUpdateResult(result?.success ? "✅ Registros atualizados com sucesso" : `❌ ${JSON.stringify(result)}`);
    } catch (e) { setUpdateResult(`❌ ${(e as Error).message}`); }
  };

  const handleClickTest = async (platform: string) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/track-capture`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: "click", tipo_clique: platform, pagina_origem: "/validar-captura", cookie_visitante: getVisitorId(), texto_botao: `Teste ${platform}`, secao_pagina: "validacao", url_destino: `https://${platform}.com/test` }),
      });
      const data = await res.json();
      setClickResults((prev) => ({ ...prev, [platform]: data.success ? "✅ Registrado" : `❌ ${data.error}` }));
    } catch (e) { setClickResults((prev) => ({ ...prev, [platform]: `❌ ${(e as Error).message}` })); }
  };

  const handleFormTest = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/track-capture`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: "form", nome: "Teste Validação", telefone: "(00) 00000-0000", mensagem: "Registro de teste automático", cookie_visitante: getVisitorId() }),
      });
      const data = await res.json();
      setFormResult(data.success ? `✅ Registrado (ID: ${data.id})` : `❌ ${data.error}`);
    } catch (e) { setFormResult(`❌ ${(e as Error).message}`); }
  };

  const statusIcon = (s: Status) => s === "ok" ? "✅" : s === "warn" ? "🟡" : s === "error" ? "❌" : "⏳";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">🔍 Validação de Captura v3</h1>
          <p className="text-sm text-muted-foreground mt-1">Auditoria completa — 15 pontos de verificação</p>
        </div>

        {/* Auto checks */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-bold text-lg">Verificações Automáticas</h2>
          {checks.map((check) => (
            <div key={check.label} className="flex items-start gap-3 py-2 border-b last:border-0">
              <span className="text-xl mt-0.5">{statusIcon(check.status)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{check.label}</p>
                <p className="text-xs text-muted-foreground break-all">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-bold text-lg mb-2">📜 Scroll Tracking (ao vivo)</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${scrollDepth}%` }} />
            </div>
            <span className="text-sm font-mono font-bold">{scrollDepth}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Role a página para ver os milestones 25%, 50%, 75%, 100% sendo registrados</p>
        </div>

        {/* GPS + Nominatim detail */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-bold text-lg">📍 Teste de GPS + Nominatim</h2>
          <button onClick={handleGPSTest} disabled={gpsLoading} className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            {gpsLoading ? "Solicitando GPS..." : "Solicitar GPS e Geocodificação Reversa"}
          </button>

          {gpsData && (
            <div className="space-y-3">
              {gpsData.geo_layer === "denied" ? (
                <p className="text-destructive text-sm">❌ GPS negado ou indisponível</p>
              ) : gpsData.geo_layer === "error" ? (
                <p className="text-destructive text-sm">❌ Erro ao obter GPS</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                      gpsData.bairro ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {gpsData.bairro ? "🟢 GPS Preciso com Bairro" : "🟡 GPS sem Bairro"}
                    </span>
                  </div>

                  <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
                    <p><strong>Coordenadas:</strong> {gpsData.latitude}, {gpsData.longitude}</p>
                    <p><strong>Rua:</strong> {gpsData.rua || "—"} {gpsData.numero || ""}</p>
                    <p><strong>Bairro:</strong> {gpsData.bairro || "—"} <span className="text-muted-foreground">(fonte: {gpsData.bairro_source || getBairroSource()})</span></p>
                    <p><strong>Cidade:</strong> {gpsData.cidade || "—"}</p>
                    <p><strong>Estado:</strong> {gpsData.estado || "—"}</p>
                    <p><strong>CEP:</strong> {gpsData.cep || "—"}</p>
                    <p><strong>Endereço completo:</strong> {gpsData.endereco_completo || "—"}</p>
                    <p><strong>Zona Eleitoral:</strong> {gpsData.zona_eleitoral || "—"}</p>
                  </div>

                  {nominatimRaw && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-primary">🔬 Resposta bruta do Nominatim</summary>
                      <pre className="mt-2 bg-muted rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap">
                        {JSON.stringify(nominatimRaw, null, 2)}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Update location test */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-bold text-lg mb-3">🔄 Teste de Atualização de Localização</h2>
          <p className="text-xs text-muted-foreground mb-2">Testa o PATCH /update-location atualizando registros recentes com dados GPS.</p>
          <button onClick={handleUpdateLocationTest} className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            Atualizar Registros com GPS
          </button>
          {updateResult && <p className="mt-2 text-sm">{updateResult}</p>}
        </div>

        {/* Zone tests */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-bold text-lg">🗺️ Teste de Zona Eleitoral</h2>
          <div>
            <label className="text-sm font-medium">Por Bairro:</label>
            <div className="flex gap-2 mt-1">
              <input value={zoneBairro} onChange={(e) => setZoneBairro(e.target.value)} placeholder="Ex: Setor Bueno" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
              <button onClick={() => { if (zoneBairro) setZoneResult(identifyZone(zoneBairro, "Goiânia")); }} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm">Testar</button>
            </div>
            {zoneResult && <p className="mt-1 text-sm">Resultado: <strong>{zoneResult}</strong></p>}
          </div>
          <div>
            <label className="text-sm font-medium">Por Coordenadas:</label>
            <div className="flex gap-2 mt-1">
              <input value={coordLat} onChange={(e) => setCoordLat(e.target.value)} placeholder="Latitude" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
              <input value={coordLng} onChange={(e) => setCoordLng(e.target.value)} placeholder="Longitude" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
              <button onClick={() => {
                const lat = parseFloat(coordLat), lng = parseFloat(coordLng);
                setCoordZoneResult(isNaN(lat) || isNaN(lng) ? "Inválido" : identifyZone("", "Goiânia", lat, lng));
              }} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm">Testar</button>
            </div>
            {coordZoneResult && <p className="mt-1 text-sm">Resultado: <strong>{coordZoneResult}</strong></p>}
          </div>
        </div>

        {/* Recent clicks from DB */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-bold text-lg mb-3">🖱️ Cliques Recentes (Supabase)</h2>
          {recentClicks.length > 0 ? (
            <div className="space-y-2">
              {recentClicks.map((c: any, i: number) => (
                <div key={i} className="bg-muted rounded-lg p-2 text-xs">
                  <span className="font-bold">{c.tipo_clique}</span> — {c.texto_botao} — {c.secao_pagina} — {new Date(c.criado_em).toLocaleString("pt-BR")}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhum clique registrado</p>}

          <h3 className="font-medium text-sm mt-4 mb-2">Testar Clique Manual:</h3>
          <div className="flex gap-2 flex-wrap">
            {["whatsapp", "instagram", "facebook"].map((p) => (
              <div key={p} className="flex items-center gap-2">
                <button onClick={() => handleClickTest(p)} className="rounded-full border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-accent">Testar {p}</button>
                {clickResults[p] && <span className="text-xs">{clickResults[p]}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Recent form from DB */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-bold text-lg mb-3">📝 Último Formulário (Supabase)</h2>
          {recentForm ? (
            <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
              {Object.entries(recentForm as Record<string, unknown>).map(([k, v]) => (
                <p key={k}><strong>{k}:</strong> {String(v ?? "—")}</p>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhum formulário registrado</p>}

          <button onClick={handleFormTest} className="mt-3 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Submeter Formulário Teste</button>
          {formResult && <p className="mt-2 text-sm">{formResult}</p>}
        </div>

        {/* Queue */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-bold text-lg mb-3">📦 Fila de Redundância</h2>
          {queueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">✅ Nenhum registro na fila</p>
          ) : (
            <>
              <p className="text-sm text-destructive mb-2">⚠️ {queueItems.length} registro(s) aguardando</p>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-40">{JSON.stringify(queueItems, null, 2)}</pre>
              <button onClick={async () => { await flushQueue(); setQueueItems(getFailedQueue()); }} className="mt-2 rounded-full border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-accent">Reenviar</button>
            </>
          )}
        </div>

        {/* Zone reference */}
        <details className="rounded-xl border bg-card p-5">
          <summary className="font-bold text-lg cursor-pointer">📋 Referência de Zonas</summary>
          <div className="mt-3 space-y-3 text-xs">
            {Object.entries(ZONE_MAP).map(([zone, neighborhoods]) => (
              <div key={zone}><p className="font-bold text-primary">{zone}</p><p className="text-muted-foreground">{neighborhoods.join(", ")}</p></div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

export default ValidarCaptura;
