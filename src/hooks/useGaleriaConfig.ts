/**
 * Backwards-compatible wrapper using centralized site-config.
 */
import { useSiteConfig, getSiteConfig } from "./useSiteConfig";

export function getGaleriaAtiva(): Promise<boolean> {
  return getSiteConfig().then((c) => c.galeria_ativa);
}

export function useGaleriaConfig() {
  const { galeria_ativa } = useSiteConfig();
  return { galeriaAtiva: galeria_ativa };
}
