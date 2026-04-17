import { useState, useEffect, useRef } from "react";

const CLOUD_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const CLOUD_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface CalendarEvent {
  id: string;
  titulo: string;
  desc: string;
  local: string;
  dia: string;
  mes: string;
  diaSemana: string;
  hora: string;
  horaFim: string;
  dataISO: string;
  dataFimISO: string;
  passado: boolean;
  gcal: string;
  mapsUrl: string;
}

interface UseGoogleCalendarOptions {
  filter?: "proximos" | "passados" | "all";
  limit?: number;
  enabled?: boolean;
}

const CACHE_KEY = "agenda_events_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

interface CachedData {
  events: CalendarEvent[];
  timestamp: number;
  filter: string;
}

function normalizeEvent(event: Partial<CalendarEvent> | null | undefined, index: number): CalendarEvent {
  return {
    id: typeof event?.id === "string" && event.id ? event.id : `evento-${index}`,
    titulo: typeof event?.titulo === "string" && event.titulo ? event.titulo : "Evento",
    desc: typeof event?.desc === "string" ? event.desc : "",
    local: typeof event?.local === "string" ? event.local : "",
    dia: typeof event?.dia === "string" ? event.dia : "",
    mes: typeof event?.mes === "string" ? event.mes : "",
    diaSemana: typeof event?.diaSemana === "string" ? event.diaSemana : "",
    hora: typeof event?.hora === "string" ? event.hora : "",
    horaFim: typeof event?.horaFim === "string" ? event.horaFim : "",
    dataISO: typeof event?.dataISO === "string" ? event.dataISO : "",
    dataFimISO: typeof event?.dataFimISO === "string" ? event.dataFimISO : "",
    passado: Boolean(event?.passado),
    gcal: typeof event?.gcal === "string" && event.gcal ? event.gcal : "#",
    mapsUrl: typeof event?.mapsUrl === "string" && event.mapsUrl ? event.mapsUrl : "#",
  };
}

function normalizeEvents(events: unknown): CalendarEvent[] {
  if (!Array.isArray(events)) return [];
  return events.map((event, index) => normalizeEvent(event as Partial<CalendarEvent>, index));
}

function getCached(filter: string): CalendarEvent[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CachedData = JSON.parse(raw);
    if (data.filter !== filter) return null;
    // Return cached even if stale — we'll refresh in background
    return normalizeEvents(data.events);
  } catch {
    return null;
  }
}

function setCache(events: CalendarEvent[], filter: string) {
  try {
    const data: CachedData = { events: normalizeEvents(events), timestamp: Date.now(), filter };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

function isCacheStale(filter: string): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const data: CachedData = JSON.parse(raw);
    if (data.filter !== filter) return true;
    return Date.now() - data.timestamp > CACHE_TTL;
  } catch {
    return true;
  }
}

export function useGoogleCalendar(options: UseGoogleCalendarOptions = {}) {
  const filterKey = options.filter || "all";
  const cached = normalizeEvents(getCached(filterKey));

  const [events, setEvents] = useState<CalendarEvent[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
  }, [options.filter, options.limit]);

  useEffect(() => {
    if (options.enabled === false) { setLoading(false); return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchEvents = async () => {
      try {
        // Only show spinner if we have no cached data
        if (!cached.length) setLoading(true);

        if (!CLOUD_PROJECT_ID || !CLOUD_ANON_KEY) {
          if (!cached.length) {
            setEvents([]);
            setError("Agenda temporariamente indisponível");
          }
          return;
        }

        const params = new URLSearchParams();
        if (options.filter) params.set("filter", options.filter);
        if (options.limit) params.set("limit", String(options.limit));

        const query = params.toString();
        const url = `https://${CLOUD_PROJECT_ID}.supabase.co/functions/v1/google-calendar?${query ? `${query}&` : ''}t=${Date.now()}`;

        const res = await fetch(url, {
          headers: {
            "apikey": CLOUD_ANON_KEY,
          },
        });

        const data = await res.json().catch(() => null);
        const normalizedEvents = normalizeEvents(data?.events);

        if (res.ok && data?.success) {
          setEvents(normalizedEvents);
          setCache(normalizedEvents, filterKey);
          setError(null);
        } else {
          // Only set error if we have no cached data to show
          if (!cached.length) setError(data?.error || "Erro ao carregar eventos");
        }
      } catch (err) {
        console.error("Erro ao buscar eventos:", err);
        if (!cached.length) setError("Não foi possível carregar os eventos");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [options.filter, options.limit]);

  return { events, loading, error };
}
