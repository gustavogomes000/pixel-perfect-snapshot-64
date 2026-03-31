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
}

const CACHE_KEY = "agenda_events_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

interface CachedData {
  events: CalendarEvent[];
  timestamp: number;
  filter: string;
}

function getCached(filter: string): CalendarEvent[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CachedData = JSON.parse(raw);
    if (data.filter !== filter) return null;
    // Return cached even if stale — we'll refresh in background
    return data.events;
  } catch {
    return null;
  }
}

function setCache(events: CalendarEvent[], filter: string) {
  try {
    const data: CachedData = { events, timestamp: Date.now(), filter };
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
  const cached = getCached(filterKey);

  const [events, setEvents] = useState<CalendarEvent[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
  }, [options.filter, options.limit]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchEvents = async () => {
      try {
        // Only show spinner if we have no cached data
        if (!cached) setLoading(true);

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

        const data = await res.json();

        if (data.success) {
          setEvents(data.events);
          setCache(data.events, filterKey);
        } else {
          // Only set error if we have no cached data to show
          if (!cached) setError(data.error || "Erro ao carregar eventos");
        }
      } catch (err) {
        console.error("Erro ao buscar eventos:", err);
        if (!cached) setError("Não foi possível carregar os eventos");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [options.filter, options.limit]);

  return { events, loading, error };
}
