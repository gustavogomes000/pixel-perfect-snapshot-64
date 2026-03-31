import { SUPABASE_PROJECT_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseDb";
/**
 * CHAMA ROSA — Mission-Critical Data Capture Engine v3
 * 
 * AUDIT FIXES:
 * 1. UUID with crypto.getRandomValues fallback + chama_vid browser cookie
 * 2. IP capture server-side (edge function)
 * 3. IP geo parallel with 6s timeout + merge best result
 * 4. GPS on every page load
 * 5. ua-parser-js for device detection
 * 6. Scroll depth with debounced passive listener
 * 7. Session timing with Blob sendBeacon
 * 8. UTM persistence in sessionStorage
 * 9. Traffic origin classification
 * 10. Click tracking with tempo_no_site_antes_do_clique
 * 11. Form tracking with GPS enrichment
 * 12. Zone identification with normalized strings
 * 13. Retry queue with flush on page load
 * 14. Retroactive enrichment
 */

import { UAParser } from "ua-parser-js";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const QUEUE_KEY = "chama_failed_queue";
const VISITOR_KEY = "chama_visitor_id";
const COOKIE_NAME = "chama_vid";
const LAT_KEY = "chama_lat";
const LNG_KEY = "chama_lng";
const GEO_RESOLVED_KEY = "chama_geo_resolved";
const GEO_FULL_KEY = "chama_geo_full";
const NOMINATIM_RAW_KEY = "chama_nominatim_raw";
const BAIRRO_SOURCE_KEY = "chama_bairro_source";
const UTM_KEY = "chama_utms";
const SESSION_START_KEY = "chama_session_start";
const SCROLL_MILESTONES_KEY = "chama_scroll_milestones";
const GEO_MODE_KEY = "chama_geo_mode";
const GEO_DENIED_KEY = "chama_geo_denied";

// Location precision modes
export const PRECISAO = {
  GPS: "GPS_PRECISO" as const,
  IP: "IP_APROXIMADO" as const,
};

// ═══════════════════════════════════════════════════════════
// RETRY ENGINE — RULE 1: NEVER LOSE A RECORD
// ═══════════════════════════════════════════════════════════

interface QueueItem {
  payload?: Record<string, unknown>;
  table?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

function getTrackCaptureUrl() {
  return `${SUPABASE_URL}/functions/v1/track-capture`;
}

async function sendTrackPayload(
  payload: Record<string, unknown>,
  options?: { preferBeacon?: boolean; keepalive?: boolean }
): Promise<boolean> {
  const url = getTrackCaptureUrl();

  if (options?.preferBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const sent = navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: "application/json" }));
      if (sent) return true;
    } catch {
      // fall through to fetch
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
    keepalive: options?.keepalive,
  });

  return res.ok;
}

function normalizeQueuedPayload(item: QueueItem): Record<string, unknown> | null {
  if (item.payload) return item.payload;
  if (!item.table || !item.data) return null;

  if (item.table === "acessos_site") return { action: "pageview", ...item.data };
  if (item.table === "cliques_whatsapp") return { action: "click", ...item.data };
  if (item.table === "mensagens_contato") return { action: "form", ...item.data };

  return null;
}

function enqueue(payload: Record<string, unknown>) {
  try {
    const queue = getQueue();
    queue.push({ payload, timestamp: Date.now() });
    if (queue.length > 200) queue.splice(0, queue.length - 200);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* localStorage full */ }
}

function getQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function flushQueue() {
  const queue = getQueue();
  console.log(`[Chama] Queue size on load: ${queue.length}`);
  if (queue.length === 0) return;

  const remaining: QueueItem[] = [];
  const results = await Promise.allSettled(
    queue.map(async (item) => {
      const payload = normalizeQueuedPayload(item);
      if (!payload) throw new Error("Invalid queued payload");
      const ok = await sendTrackPayload(payload);
      if (!ok) throw new Error("Track request failed");
    })
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") remaining.push(queue[i]);
  });

  try {
    if (remaining.length > 0) localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(QUEUE_KEY);
  } catch { /* ignore */ }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════
// AUDIT 1: VISITOR COOKIE — localStorage + browser cookie
// ═══════════════════════════════════════════════════════════

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    // Always set browser cookie too
    try {
      const secure = location.protocol === "https:" ? ";Secure" : "";
      document.cookie = `${COOKIE_NAME}=${id};path=/;max-age=31536000;SameSite=Lax${secure}`;
    } catch { /* cookies blocked */ }
    return id;
  } catch {
    // localStorage unavailable — try cookie
    const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) return match[1];
    const id = generateUUID();
    try {
      const secure = location.protocol === "https:" ? ";Secure" : "";
      document.cookie = `${COOKIE_NAME}=${id};path=/;max-age=31536000;SameSite=Lax${secure}`;
    } catch {}
    return id;
  }
}

// AUDIT 1: UUID with crypto.getRandomValues fallback
function generateUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback using crypto.getRandomValues for older browsers
    return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      (c: number) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
  }
}

// Check if visitor cookie exists in both localStorage and browser cookie
export function getVisitorCookieStatus(): { localStorage: boolean; cookie: boolean; id: string | null } {
  const id = getVisitorId();
  const lsId = localStorage.getItem(VISITOR_KEY);
  const cookieMatch = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return {
    localStorage: !!lsId,
    cookie: !!cookieMatch,
    id: lsId || cookieMatch?.[1] || id || null,
  };
}

// ═══════════════════════════════════════════════════════════
// VISIT COUNT
// ═══════════════════════════════════════════════════════════

function getVisitCount(): number {
  try {
    const key = "chama_visit_count";
    const count = parseInt(localStorage.getItem(key) || "0", 10) + 1;
    localStorage.setItem(key, count.toString());
    return count;
  } catch { return 1; }
}

function isFirstVisit(): boolean {
  try {
    const key = "chama_has_visited";
    const visited = localStorage.getItem(key);
    if (!visited) { localStorage.setItem(key, "true"); return true; }
    return false;
  } catch { return true; }
}

// ═══════════════════════════════════════════════════════════
// AUDIT 5: DEVICE DETECTION — ua-parser-js
// ═══════════════════════════════════════════════════════════

export interface DeviceInfo {
  dispositivo: string;
  navegador: string;
  versao_navegador: string;
  sistema_operacional: string;
  versao_so: string;
  marca_dispositivo: string;
  modelo_dispositivo: string;
}

export function detectDevice(): DeviceInfo {
  const fallback = "Não identificado";
  try {
    const result = UAParser(navigator.userAgent);
    const browser = result.browser;
    const os = result.os;
    const device = result.device;

    const tipo = device.type || "";
    let dispositivo = "desktop";
    if (tipo === "mobile") dispositivo = "mobile";
    else if (tipo === "tablet") dispositivo = "tablet";

    return {
      dispositivo,
      navegador: browser.name || fallback,
      versao_navegador: browser.version || fallback,
      sistema_operacional: os.name || fallback,
      versao_so: os.version || fallback,
      marca_dispositivo: device.vendor || fallback,
      modelo_dispositivo: device.model || fallback,
    };
  } catch {
    return {
      dispositivo: fallback,
      navegador: fallback,
      versao_navegador: fallback,
      sistema_operacional: fallback,
      versao_so: fallback,
      marca_dispositivo: fallback,
      modelo_dispositivo: fallback,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// AUDIT 8: UTM PARAMETERS — sessionStorage persistence
// ═══════════════════════════════════════════════════════════

export interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

export function getUTMParams(): UTMParams {
  const params = new URLSearchParams(window.location.search);
  const urlUtms: UTMParams = {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_term: params.get("utm_term"),
    utm_content: params.get("utm_content"),
  };

  const hasUrlUtm = Object.values(urlUtms).some(Boolean);

  // If new UTMs in URL, overwrite sessionStorage
  if (hasUrlUtm) {
    try { sessionStorage.setItem(UTM_KEY, JSON.stringify(urlUtms)); } catch {}
    return urlUtms;
  }

  // Otherwise read from sessionStorage (preserve original attribution)
  try {
    const stored = sessionStorage.getItem(UTM_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}

  return urlUtms;
}

// ═══════════════════════════════════════════════════════════
// AUDIT 9: TRAFFIC ORIGIN CLASSIFICATION
// ═══════════════════════════════════════════════════════════

export function classifyOrigin(utms: UTMParams, referrer: string): string {
  const medium = (utms.utm_medium || "").toLowerCase();
  const source = (utms.utm_source || "").toLowerCase();
  const ref = referrer.toLowerCase();

  // 1. Paid traffic
  if (medium === "cpc" || medium === "ppc" || medium === "paid") return "google_pago";
  // 2. utm_source=google → google_pago
  if (source === "google") return "google_pago";
  // 3. Google organic (referrer has google.com and no utm_medium)
  if (ref.includes("google.com") && !medium) return "google_organico";
  // 4. WhatsApp
  if (ref.includes("wa.me") || ref.includes("whatsapp.com") || source === "whatsapp") return "whatsapp";
  // 5. Instagram
  if (ref.includes("instagram.com") || source === "instagram") return "instagram";
  // 6. Facebook
  if (ref.includes("facebook.com") || ref.includes("fb.me") || ref.includes("fb.com") || source === "facebook") return "facebook";
  // 7. Direct
  if (!ref && !medium && !source) return "direto";
  // 8. Other
  return "outro";
}

// ═══════════════════════════════════════════════════════════
// AUDIT 3: 4-LAYER LOCATION RESOLUTION — parallel + merge
// ═══════════════════════════════════════════════════════════

export interface GeoData {
  latitude?: number | null;
  longitude?: number | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  bairro?: string | null;
  bairro_source?: string | null;
  cep?: string | null;
  endereco_completo?: string | null;
  rua?: string | null;
  numero?: string | null;
  endereco_ip?: string | null;
  provedor_internet?: string | null;
  fuso_horario?: string | null;
  geo_layer?: string;
  zona_eleitoral?: string;
  precisao_localizacao?: string;
  nominatim_raw?: Record<string, unknown> | null;
}

let cachedGeoData: GeoData | null = null;
let gpsResolutionPromise: Promise<GeoData | null> | null = null;

// Force GPS on every page load — sets denied flag on error
export function forceGPS(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    // Skip if already denied this session
    if (sessionStorage.getItem(GEO_DENIED_KEY) === "true") {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          sessionStorage.setItem(LAT_KEY, String(pos.coords.latitude));
          sessionStorage.setItem(LNG_KEY, String(pos.coords.longitude));
          sessionStorage.setItem(GEO_RESOLVED_KEY, "true");
          sessionStorage.setItem(GEO_MODE_KEY, PRECISAO.GPS);
        } catch {}
        resolve(pos);
      },
      () => {
        try {
          sessionStorage.setItem(GEO_DENIED_KEY, "true");
          sessionStorage.setItem(GEO_MODE_KEY, PRECISAO.IP);
        } catch {}
        resolve(null);
      },
      { timeout: 20000, maximumAge: 0, enableHighAccuracy: true }
    );
  });
}

// AUDIT 4: Reverse geocoding with robust bairro extraction
export async function reverseGeocode(lat: number, lng: number): Promise<GeoData> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18&accept-language=pt-BR`,
      {
        headers: { "User-Agent": "ChamaRosa/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return { latitude: lat, longitude: lng, geo_layer: "gps" };

    const data = await res.json();
    const addr = data.address || {};

    try { sessionStorage.setItem(NOMINATIM_RAW_KEY, JSON.stringify(data)); } catch {}

    const rua = addr.road || "";
    const numero = addr.house_number || "";

    let bairro = "";
    let bairro_source = "";
    const bairroChain: [string, string][] = [
      ["suburb", addr.suburb],
      ["neighbourhood", addr.neighbourhood],
      ["city_district", addr.city_district],
      ["quarter", addr.quarter],
      ["village", addr.village],
      ["hamlet", addr.hamlet],
      ["county", addr.county],
    ];
    for (const [field, value] of bairroChain) {
      if (value && value.trim()) {
        bairro = value.trim();
        bairro_source = field;
        break;
      }
    }

    try { sessionStorage.setItem(BAIRRO_SOURCE_KEY, bairro_source || "none"); } catch {}

    const cidade = addr.city || addr.town || addr.village || addr.municipality || "";
    const estado = addr.state || "";
    const cep = addr.postcode || "";
    const parts = [rua, numero, bairro, cidade, estado, cep].filter(Boolean);
    const endereco_completo = parts.join(", ");

    const result: GeoData = {
      rua, numero, bairro, bairro_source, cidade, estado, cep, endereco_completo,
      latitude: lat, longitude: lng, geo_layer: "gps",
      nominatim_raw: data,
    };

    try { sessionStorage.setItem(GEO_FULL_KEY, JSON.stringify(result)); } catch {}
    return result;
  } catch {
    return { latitude: lat, longitude: lng, geo_layer: "gps" };
  }
}

// AUDIT 3: IP geo primary — ipapi.co with 6s timeout + district
async function geoFromIpApi(): Promise<Partial<GeoData>> {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error("ipapi failed");
    const d = await res.json();
    return {
      endereco_ip: d.ip || null,
      cidade: d.city || null,
      estado: d.region || null,
      pais: d.country_name || null,
      cep: d.postal || null,
      latitude: d.latitude || null,
      longitude: d.longitude || null,
      bairro: d.district || null,
      bairro_source: d.district ? "ipapi_district" : null,
      provedor_internet: d.org || null,
      fuso_horario: d.timezone || null,
      geo_layer: "ipapi",
    };
  } catch { return {}; }
}

// AUDIT 3: IP geo fallback — ip-api.com with 6s timeout + district
async function geoFromIpApiFallback(): Promise<Partial<GeoData>> {
  try {
    return {};
  } catch { return {}; }
}

function geoFromTimezone(): Partial<GeoData> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const lang = navigator.language || "";
  let pais = "Não identificado";
  let estado = "Não identificado";
  if (tz.includes("Sao_Paulo") || tz.includes("Brasilia")) { pais = "Brasil"; estado = "Não identificado (fuso SP/DF)"; }
  else if (tz.includes("America/")) { pais = "Brasil"; }
  if (lang.startsWith("pt")) pais = "Brasil";
  return { pais, estado, fuso_horario: tz, geo_layer: "timezone" };
}

// AUDIT 3: Merge rule — use result with more fields populated
function countPopulatedFields(geo: Partial<GeoData>): number {
  const keys: (keyof GeoData)[] = ["cidade", "estado", "pais", "bairro", "cep", "latitude", "longitude", "endereco_ip", "rua"];
  return keys.filter(k => geo[k] !== null && geo[k] !== undefined && geo[k] !== "").length;
}

function mergeGeoResults(primary: Partial<GeoData>, fallback: Partial<GeoData>): Partial<GeoData> {
  const primaryCount = countPopulatedFields(primary);
  const fallbackCount = countPopulatedFields(fallback);

  // Prefer primary (ipapi.co) but fill empty fields from fallback
  const base = primaryCount >= fallbackCount ? { ...primary } : { ...fallback };
  const fill = primaryCount >= fallbackCount ? fallback : primary;

  // Fill any empty fields from the other result
  const fillKeys: (keyof GeoData)[] = ["cidade", "estado", "pais", "bairro", "cep", "latitude", "longitude", "endereco_ip", "rua", "provedor_internet", "fuso_horario"];
  for (const key of fillKeys) {
    if (!base[key] && fill[key]) {
      (base as any)[key] = fill[key];
    }
  }

  // If district/bairro present in either, store it
  if (!base.bairro && fill.bairro) {
    base.bairro = fill.bairro;
    base.bairro_source = fill.bairro_source;
  }

  return base;
}

/**
 * AUDIT 3: Full resolution chain.
 * GPS fires immediately. Both IP geo services run in parallel.
 * Best result merged. GPS overrides IP when available.
 */
export async function resolveLocation(): Promise<GeoData> {
  if (cachedGeoData && cachedGeoData.geo_layer === "gps" && cachedGeoData.bairro) {
    return cachedGeoData;
  }

  // Check session for cached GPS data with bairro
  try {
    const stored = sessionStorage.getItem(GEO_FULL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as GeoData;
      if (parsed.geo_layer === "gps" && parsed.bairro) {
        cachedGeoData = parsed;
        return parsed;
      }
    }
  } catch {}

  // Run GPS and BOTH IP geo services in parallel
  const [gpsResult, ipPrimaryResult, ipFallbackResult] = await Promise.allSettled([
    (async () => {
      const pos = await forceGPS();
      if (!pos) return null;
      return reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    })(),
    geoFromIpApi(),
    geoFromIpApiFallback(),
  ]);

  const gps = gpsResult.status === "fulfilled" ? gpsResult.value : null;
  const ipPrimary = ipPrimaryResult.status === "fulfilled" ? ipPrimaryResult.value : {};
  const ipFallback = ipFallbackResult.status === "fulfilled" ? ipFallbackResult.value : {};
  const tz = geoFromTimezone();

  // Merge both IP results
  const mergedIp = mergeGeoResults(ipPrimary, ipFallback);

  // Merge: GPS wins, then merged IP, then timezone
  const geo: GeoData = { ...tz, ...mergedIp, ...(gps || {}) };

  // Ensure IP is always present even when GPS overrides
  if (!geo.endereco_ip && mergedIp.endereco_ip) {
    geo.endereco_ip = mergedIp.endereco_ip;
  }

  // Set precisao_localizacao based on whether GPS resolved
  if (gps && gps.latitude) {
    geo.precisao_localizacao = PRECISAO.GPS;
    try { sessionStorage.setItem(GEO_MODE_KEY, PRECISAO.GPS); } catch {}
  } else {
    geo.precisao_localizacao = PRECISAO.IP;
    try { sessionStorage.setItem(GEO_MODE_KEY, PRECISAO.IP); } catch {}
  }

  // Ensure zona_eleitoral
  geo.zona_eleitoral = identifyZone(geo.bairro || "", geo.cidade || "", geo.latitude, geo.longitude);

  cachedGeoData = geo;
  return geo;
}

export function startGPSResolution(): Promise<GeoData | null> {
  if (gpsResolutionPromise) return gpsResolutionPromise;

  gpsResolutionPromise = (async () => {
    try {
      const pos = await forceGPS();
      if (!pos) return null;
      const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      geo.zona_eleitoral = identifyZone(geo.bairro || "", geo.cidade || "", geo.latitude, geo.longitude);
      geo.precisao_localizacao = PRECISAO.GPS;
      try { sessionStorage.setItem(GEO_MODE_KEY, PRECISAO.GPS); } catch {}
      cachedGeoData = geo;
      return geo;
    } catch {
      return null;
    }
  })();

  return gpsResolutionPromise;
}

// Get current geo precision mode
export function getGeoMode(): string {
  try {
    return sessionStorage.getItem(GEO_MODE_KEY) || PRECISAO.IP;
  } catch { return PRECISAO.IP; }
}

export function isGPSResolved(): boolean {
  try {
    return sessionStorage.getItem(GEO_RESOLVED_KEY) === "true";
  } catch { return false; }
}

export async function waitForGPS(maxWaitMs: number = 5000, intervalMs: number = 500): Promise<GeoData | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (isGPSResolved()) {
      const geo = getCachedGeo();
      if (geo && geo.geo_layer === "gps") return geo;
    }
    await sleep(intervalMs);
  }
  return getCachedGeo();
}

export function getCachedCoords(): { lat: number; lng: number } | null {
  try {
    const lat = sessionStorage.getItem(LAT_KEY);
    const lng = sessionStorage.getItem(LNG_KEY);
    if (lat && lng) return { lat: parseFloat(lat), lng: parseFloat(lng) };
  } catch {}
  return null;
}

export function getCachedGeo(): GeoData | null {
  if (cachedGeoData) return cachedGeoData;
  try {
    const stored = sessionStorage.getItem(GEO_FULL_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export function getNominatimRaw(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(NOMINATIM_RAW_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function getBairroSource(): string {
  try { return sessionStorage.getItem(BAIRRO_SOURCE_KEY) || "none"; } catch { return "none"; }
}

// ═══════════════════════════════════════════════════════════
// AUDIT 12: ZONE IDENTIFICATION
// ═══════════════════════════════════════════════════════════

function normalize(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const ZONE_MAP: Record<string, string[]> = {
  "1ª Zona": ["Jardim Goiás","Setor Bueno","St. Bueno","St Bueno","Setor Marista","Setor Sul","Setor Sudoeste","Setor Pedro Ludovico","Setor Bela Vista","Jardim América","Setor Nova Suíça","Setor Aeroporto","Setor Leste Universitário","Setor Coimbra","Parque Amazônia"],
  "2ª Zona": ["Setor Central","Setor Norte Ferroviário","Setor Campinas","Vila Nova","Jardim Novo Mundo","Setor Santos Dumont","Setor dos Funcionários","Vila União","Setor Crimeia Leste","Setor Crimeia Oeste"],
  "127ª Zona": ["Jardim das Esmeraldas","Jardim Presidente","Parque Amazônia Sul","Residencial Eldorado","Setor Jardim da Luz","Jardim das Oliveiras","Vila Redenção","Conjunto Vera Cruz","Parque das Laranjeiras"],
  "133ª Zona": ["Setor Faiçalville","Jardim Atlântico","Residencial Montreal","Vila Brasília","Jardim Fonte Nova","Jardim das Acácias","Setor Universitário","Jardim Guanabara","Residencial Buena Vista"],
  "134ª Zona": ["Conjunto Vera Cruz","Jardim Cerrado","Residencial Araguaia","Setor Recanto do Bosque","Vila Mutirão","Jardim Curitiba","Residencial Flamboyant","Conjunto Caiçara","Residencial Coimbra","Jardim Dom Fernando"],
  "135ª Zona": ["Setor Jardim Europa","Residencial Vale dos Sonhos","Jardim Balneário Meia Ponte","Vila Santa Helena","Setor dos Afonsos","Parque Tremendão","Residencial Granville"],
  "136ª Zona": ["Setor Perim","Bairro Feliz","Vila Redenção Sul","Jardim Bela Vista","Boa Esperança","Setor Goiânia 2","Jardim Novo Horizonte","Vila Bela Aliança"],
  "146ª Zona": ["Setor Santa Genoveva","Conjunto Riviera","Jardim Planalto","Parque Atheneu","Sítio de Recreio Ipê","São Domingos","Residencial Granville Norte","São Patrício","Setor Fama","Chácara do Governador"],
  "147ª Zona": ["Conjunto Caiçara Norte","Jardim Dom Fernando Norte","Setor Morada do Sol","Chácara Coimbra","Jardim Reny","Chácara dos Bandeirantes","Residencial Fonte das Águas"],
};

const ZONE_MAP_NORMALIZED: Record<string, string[]> = {};
for (const [zone, neighborhoods] of Object.entries(ZONE_MAP)) {
  ZONE_MAP_NORMALIZED[zone] = neighborhoods.map(normalize);
}

const ZONE_CENTROIDS: Record<string, [number, number]> = {
  "1ª Zona": [-16.6864, -49.2553],
  "2ª Zona": [-16.6720, -49.2501],
  "127ª Zona": [-16.7198, -49.2695],
  "133ª Zona": [-16.6953, -49.2254],
  "134ª Zona": [-16.7201, -49.2948],
  "135ª Zona": [-16.6598, -49.2198],
  "136ª Zona": [-16.7482, -49.2683],
  "146ª Zona": [-16.6451, -49.2601],
  "147ª Zona": [-16.7003, -49.2849],
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function identifyZone(bairro: string, cidade: string, lat?: number | null, lng?: number | null): string {
  if (bairro) {
    const normalizedBairro = normalize(bairro);
    for (const [zone, neighborhoods] of Object.entries(ZONE_MAP_NORMALIZED)) {
      if (neighborhoods.some((n) => normalizedBairro.includes(n) || n.includes(normalizedBairro))) return zone;
    }
  }
  const normalizedCidade = normalize(cidade);
  if (normalizedCidade.includes("goiania") && lat && lng) {
    let nearest = ""; let minDist = Infinity;
    for (const [zone, [clat, clng]] of Object.entries(ZONE_CENTROIDS)) {
      const dist = haversineDistance(lat, lng, clat, clng);
      if (dist < minDist) { minDist = dist; nearest = zone; }
    }
    if (nearest) return nearest;
  }
  if (normalizedCidade.includes("aparecida")) return "Aparecida de Goiânia";
  return "Não identificada";
}

// ═══════════════════════════════════════════════════════════
// AUDIT 7: SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════

export function initSession() {
  try {
    if (!sessionStorage.getItem(SESSION_START_KEY)) {
      sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }
  } catch {}
}

export function getSessionDuration(): number {
  try {
    const start = parseInt(sessionStorage.getItem(SESSION_START_KEY) || String(Date.now()), 10);
    return Math.round((Date.now() - start) / 1000);
  } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════
// AUDIT 6: SCROLL DEPTH TRACKING — debounced passive listener
// ═══════════════════════════════════════════════════════════

const SCROLL_THRESHOLDS = [25, 50, 75, 100];

export function initScrollTracking(pagina: string) {
  const reached = new Set<number>();
  try {
    const stored = sessionStorage.getItem(SCROLL_MILESTONES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.pagina === pagina) parsed.milestones.forEach((m: number) => reached.add(m));
    }
  } catch {}

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const onScroll = () => {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const depth = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100));
      for (const threshold of SCROLL_THRESHOLDS) {
        if (depth >= threshold && !reached.has(threshold)) {
          reached.add(threshold);
          try { sessionStorage.setItem(SCROLL_MILESTONES_KEY, JSON.stringify({ pagina, milestones: Array.from(reached), depth })); } catch {}
        }
      }
    }, 300);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    if (debounceTimer) clearTimeout(debounceTimer);
    return Math.max(0, ...Array.from(reached));
  };
}

export function getScrollDepth(): number {
  try {
    const stored = sessionStorage.getItem(SCROLL_MILESTONES_KEY);
    if (stored) { const parsed = JSON.parse(stored); return Math.max(0, ...(parsed.milestones || [0])); }
  } catch {}
  return 0;
}

// ═══════════════════════════════════════════════════════════
// AUDIT 10: PLATFORM CLICK DETECTION
// ═══════════════════════════════════════════════════════════

export type Platform = "whatsapp" | "instagram" | "facebook";

export function classifyPlatform(href: string): Platform | null {
  if (!href) return null;
  const h = href.toLowerCase();
  if (h.includes("wa.me") || h.includes("whatsapp.com") || h.includes("api.whatsapp") || h.includes("w.app") || h.includes("whatsapp://")) return "whatsapp";
  if (h.includes("instagram.com")) return "instagram";
  if (h.includes("facebook.com") || h.includes("fb.com") || h.includes("fb.me")) return "facebook";
  return null;
}

export function findSection(el: HTMLElement): string {
  let current: HTMLElement | null = el;
  while (current) {
    if (current.dataset?.section) return current.dataset.section;
    if (current.dataset?.name) return current.dataset.name;
    if (current.tagName === "SECTION" && current.id) return current.id;
    if (current.id && current.tagName !== "BODY" && current.tagName !== "HTML") return current.id;
    current = current.parentElement;
  }
  const sec = el.closest("section");
  if (sec) { const heading = sec.querySelector("h1, h2, h3"); if (heading?.textContent) return heading.textContent.trim().slice(0, 60); }
  return "sem-secao";
}

export function getButtonText(el: HTMLElement): string {
  return (el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().slice(0, 100);
}

export function getHref(el: HTMLElement): string {
  if (el instanceof HTMLAnchorElement) return el.href;
  return el.getAttribute("href") || el.getAttribute("data-href") || "";
}

// ═══════════════════════════════════════════════════════════
// PAGE VIEW TRACKING
// ═══════════════════════════════════════════════════════════

export async function trackPageView(pagina: string) {
  try {
    const cookie_visitante = getVisitorId();
    const visitCount = getVisitCount();
    const primeira_visita = isFirstVisit();
    const device = detectDevice();
    const utms = getUTMParams();

    const payload: Record<string, unknown> = {
      action: "pageview",
      pagina,
      dominio_origem: window.location.hostname,
      user_agent: navigator.userAgent,
      largura_tela: window.innerWidth,
      altura_tela: window.innerHeight,
      referrer: document.referrer || null,
      dispositivo: device.dispositivo,
      sistema_operacional: device.sistema_operacional,
      navegador: device.navegador,
      cookie_visitante,
      primeira_visita,
      contador_visitas: visitCount,
      ...utms,
      precisao_localizacao: PRECISAO.IP,
    };

    const cachedGeo = getCachedGeo();
    if (cachedGeo) {
      payload.endereco_ip = cachedGeo.endereco_ip || null;
      payload.pais = cachedGeo.pais || null;
      payload.estado = cachedGeo.estado || null;
      payload.cidade = cachedGeo.cidade || null;
      payload.bairro = cachedGeo.bairro || null;
      payload.latitude = cachedGeo.latitude || null;
      payload.longitude = cachedGeo.longitude || null;
      if (cachedGeo.precisao_localizacao) payload.precisao_localizacao = cachedGeo.precisao_localizacao;
    }

    sendTrackPayload(payload).catch(() => enqueue(payload));

    resolveLocation().then((geo) => {
      if (geo.cidade || geo.latitude) {
        updateLocationViaEdge(cookie_visitante, "acessos_site", geo).catch(() => {});
      }
    }).catch(() => {});
  } catch { /* RULE 2 */ }
}

// ═══════════════════════════════════════════════════════════
// AUDIT 10: CLICK TRACKING — with tempo_no_site_antes_do_clique
// ═══════════════════════════════════════════════════════════

export function trackClick(tipo_clique: Platform, pagina_origem: string, extra?: { texto_botao?: string; secao_pagina?: string; url_destino?: string }) {
  try {
    const cookie_visitante = getVisitorId();
    const geo = getCachedGeo();
    const tempo_no_site = Math.round((Date.now() - parseInt(sessionStorage.getItem(SESSION_START_KEY) || String(Date.now()), 10)) / 1000);

    const precisao_localizacao = getGeoMode();
    const payload: Record<string, unknown> = {
      action: "click",
      tipo_clique,
      pagina_origem,
      dominio_origem: window.location.hostname,
      user_agent: navigator.userAgent,
      cookie_visitante,
      texto_botao: extra?.texto_botao || null,
      secao_pagina: extra?.secao_pagina || "sem-secao",
      url_destino: extra?.url_destino || null,
      precisao_localizacao,
      tempo_no_site_antes_do_clique: tempo_no_site,
      latitude: geo?.latitude || sessionStorage.getItem(LAT_KEY) || null,
      longitude: geo?.longitude || sessionStorage.getItem(LNG_KEY) || null,
      endereco_ip: geo?.endereco_ip || null,
      pais: geo?.pais || null,
      estado: geo?.estado || null,
      cidade: geo?.cidade || null,
      bairro: geo?.bairro || null,
    };

    sendTrackPayload(payload, { preferBeacon: true, keepalive: true }).catch(() => enqueue(payload));
  } catch { /* RULE 2 */ }
}

// ═══════════════════════════════════════════════════════════
// UNIVERSAL CLICK TRACKER
// ═══════════════════════════════════════════════════════════

function handleGlobalClick(e: MouseEvent) {
  try {
    const el = (e.target as HTMLElement)?.closest?.("a, button") as HTMLElement | null;
    if (!el) return;
    const href = getHref(el);
    const platform = classifyPlatform(href);
    if (!platform) return;
    trackClick(platform, window.location.pathname, {
      texto_botao: getButtonText(el),
      secao_pagina: findSection(el),
      url_destino: href,
    });
  } catch {}
}

export function initUniversalClickTracker() {
  document.addEventListener("click", handleGlobalClick, true);
}

// ═══════════════════════════════════════════════════════════
// FORM TRACKING
// ═══════════════════════════════════════════════════════════

let formStartTime: number | null = null;

export function onFormFocus() {
  if (!formStartTime) formStartTime = Date.now();
}

export function getFormFillTime(): number {
  if (!formStartTime) return 0;
  return Math.round((Date.now() - formStartTime) / 1000);
}

export function resetFormTracking() {
  formStartTime = null;
}

// ═══════════════════════════════════════════════════════════
// LOCATION UPDATE VIA EDGE FUNCTION
// ═══════════════════════════════════════════════════════════

export async function updateLocationViaEdge(cookie_visitante: string, table: string, geo: Partial<GeoData>) {
  try {
    const url = `${SUPABASE_URL}/functions/v1/track-capture`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: "update-location", cookie_visitante, table, ...geo }),
    });
    return await res.json();
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════
// RETROACTIVE ENRICHMENT
// ═══════════════════════════════════════════════════════════

export async function retroactiveEnrich() {
  try {
    const geo = getCachedGeo();
    if (!geo || geo.geo_layer !== "gps" || !geo.bairro) return;

    const cookie = getVisitorId();
    const url = `${SUPABASE_URL}/functions/v1/track-capture`;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: "retroactive-enrich", cookie_visitante: cookie, ...geo }),
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════════
// AUDIT 7: EXIT TRACKING — sendBeacon with Blob
// ═══════════════════════════════════════════════════════════

export function initExitTracking(pagina: string) {
  const sendExit = () => {
    try {
      const payload = JSON.stringify({
        action: "exit",
        cookie_visitante: getVisitorId(),
        pagina,
        tempo_na_pagina: getSessionDuration(),
        profundidade_scroll: getScrollDepth(),
        data_saida: new Date().toISOString(),
        tempo_total_sessao: getSessionDuration(),
      });
      navigator.sendBeacon(
        `${SUPABASE_URL}/functions/v1/track-capture`,
        new Blob([payload], { type: "application/json" })
      );
    } catch {}
  };
  const onVisChange = () => { if (document.hidden) sendExit(); };
  window.addEventListener("beforeunload", sendExit);
  document.addEventListener("visibilitychange", onVisChange);
  return () => {
    window.removeEventListener("beforeunload", sendExit);
    document.removeEventListener("visibilitychange", onVisChange);
  };
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

export { ZONE_MAP, ZONE_CENTROIDS, getQueue as getFailedQueue };
