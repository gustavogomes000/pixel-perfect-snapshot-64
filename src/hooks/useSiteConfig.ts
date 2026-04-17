/**
 * Centralized site config (galeria_ativa + agenda_ativa).
 * Reads from public edge function `site-config` (no auth required).
 */
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseDb";

type Config = { galeria_ativa: boolean; agenda_ativa: boolean };

let cached: Config | null = null;
let fetchPromise: Promise<Config> | null = null;

const SITE_CONFIG_URL = `${SUPABASE_URL}/functions/v1/site-config`;

export function getSiteConfig(): Promise<Config> {
  if (cached) return Promise.resolve(cached);
  if (!fetchPromise) {
    fetchPromise = fetch(SITE_CONFIG_URL, {
      headers: { apikey: SUPABASE_ANON_KEY },
    })
      .then((r) => r.json())
      .then((d) => {
        const cfg: Config = {
          galeria_ativa: String(d?.galeria_ativa ?? "true").toLowerCase() === "true",
          agenda_ativa: String(d?.agenda_ativa ?? "true").toLowerCase() === "true",
        };
        cached = cfg;
        return cfg;
      })
      .catch(() => {
        fetchPromise = null;
        return { galeria_ativa: true, agenda_ativa: true };
      });
  }
  return fetchPromise;
}

export function invalidateSiteConfig() {
  cached = null;
  fetchPromise = null;
}

export function useSiteConfig() {
  const [config, setConfig] = useState<Config | null>(cached);
  useEffect(() => {
    getSiteConfig().then(setConfig);
  }, []);
  return {
    galeria_ativa: config?.galeria_ativa ?? true,
    agenda_ativa: config?.agenda_ativa ?? true,
    loaded: config !== null,
  };
}
