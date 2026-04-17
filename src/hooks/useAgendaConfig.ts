/**
 * Backwards-compatible wrapper using centralized site-config.
 */
import { useSiteConfig, getSiteConfig, invalidateSiteConfig } from "./useSiteConfig";

export function getAgendaAtiva(): Promise<boolean> {
  return getSiteConfig().then((c) => c.agenda_ativa);
}

export function invalidateAgendaCache() {
  invalidateSiteConfig();
}

export function useAgendaConfig() {
  const { agenda_ativa, loaded } = useSiteConfig();
  return { agendaAtiva: agenda_ativa, loaded };
}
