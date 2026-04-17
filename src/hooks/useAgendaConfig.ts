/**
 * Shared hook for agenda_ativa config.
 * Module-level promise cache so the query fires only once.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseDb";

let cachedValue: boolean | null = null;
let fetchPromise: Promise<boolean> | null = null;

export function getAgendaAtiva(): Promise<boolean> {
  if (cachedValue !== null) return Promise.resolve(cachedValue);
  if (!fetchPromise) {
    fetchPromise = supabase
      .from("configuracoes" as any)
      .select("valor")
      .eq("chave", "agenda_ativa")
      .maybeSingle()
      .then(({ data }) => {
        const val = String((data as any)?.valor ?? "true").toLowerCase() === "true";
        cachedValue = val;
        return val;
      })
      .catch(() => {
        fetchPromise = null;
        return true;
      });
  }
  return fetchPromise;
}

export function invalidateAgendaCache() {
  cachedValue = null;
  fetchPromise = null;
}

export function useAgendaConfig() {
  const [agendaAtiva, setAgendaAtiva] = useState<boolean>(cachedValue ?? true);

  useEffect(() => {
    getAgendaAtiva().then(setAgendaAtiva);
  }, []);

  return { agendaAtiva };
}
