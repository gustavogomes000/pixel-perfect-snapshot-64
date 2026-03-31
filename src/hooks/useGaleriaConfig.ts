/**
 * Shared hook for galeria_ativa config.
 * Uses a module-level promise cache so the query fires only once
 * regardless of how many components call this hook simultaneously.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseDb";

let cachedValue: boolean | null = null;
let fetchPromise: Promise<boolean> | null = null;

export function getGaleriaAtiva(): Promise<boolean> {
  if (cachedValue !== null) return Promise.resolve(cachedValue);
  if (!fetchPromise) {
    fetchPromise = supabase
      .from("configuracoes" as any)
      .select("valor")
      .eq("chave", "galeria_ativa")
      .maybeSingle()
      .then(({ data }) => {
        const val = String((data as any)?.valor ?? "true").toLowerCase() === "true";
        cachedValue = val;
        return val;
      })
      .catch(() => {
        fetchPromise = null; // allow retry on next call
        return true; // default: galeria ativa
      });
  }
  return fetchPromise;
}

export function useGaleriaConfig() {
  const [galeriaAtiva, setGaleriaAtiva] = useState<boolean>(cachedValue ?? true);

  useEffect(() => {
    getGaleriaAtiva().then(setGaleriaAtiva);
  }, []);

  return { galeriaAtiva };
}
