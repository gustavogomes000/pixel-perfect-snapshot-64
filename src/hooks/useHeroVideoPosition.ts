import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseDb";

const CONFIG_KEY = "hero_video_position";

interface BreakpointPosition {
  x: number;
  y: number;
  scale: number;
}

interface AllPositions {
  mobile: BreakpointPosition;
  tablet: BreakpointPosition;
  desktop: BreakpointPosition;
}

const DEFAULTS: AllPositions = {
  mobile: { x: 50, y: 50, scale: 100 },
  tablet: { x: 50, y: 50, scale: 100 },
  desktop: { x: 37, y: 28, scale: 133 },
};

const normalizePositions = (value?: Partial<AllPositions> | null): AllPositions => ({
  mobile: { ...DEFAULTS.mobile, ...(value?.mobile ?? {}), scale: 100 },
  tablet: { ...DEFAULTS.tablet, ...(value?.tablet ?? {}), scale: 100 },
  desktop: { ...DEFAULTS.desktop, ...(value?.desktop ?? {}) },
});

export function useHeroVideoPosition() {
  const [positions, setPositions] = useState<AllPositions>(DEFAULTS);

  useEffect(() => {
    supabase
      .from("configuracoes" as any)
      .select("valor")
      .eq("chave", CONFIG_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).valor) {
          try {
            const parsed = JSON.parse((data as any).valor);
            setPositions(normalizePositions(parsed));
          } catch {}
        }
      });
  }, []);

  return positions;
}

export function getVideoStyle(pos: BreakpointPosition): React.CSSProperties {
  return {
    objectPosition: `${pos.x}% ${pos.y}%`,
    transform: pos.scale !== 100 ? `scale(${pos.scale / 100})` : undefined,
    transformOrigin: pos.scale !== 100 ? `${pos.x}% ${pos.y}%` : undefined,
  };
}
