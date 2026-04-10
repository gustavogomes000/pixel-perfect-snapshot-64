import { useEffect, useState, useRef, useCallback } from "react";
import { Monitor, Smartphone, Tablet, Save, RotateCcw, Move, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/lib/supabaseDb";
import { useAdmin } from "@/hooks/useAdmin";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import heroBgVideo from "@/assets/bandeira-goias-hero.mp4.asset.json";
import heroBgVideoMobile from "@/assets/bandeira-goias-hero-mobile-v3.mp4.asset.json";

const CONFIG_KEY = "hero_video_position";

type Breakpoint = "mobile" | "tablet" | "desktop";

interface BreakpointPosition {
  x: number; // 0-100 object-position X
  y: number; // 0-100 object-position Y
  scale: number; // 100-300
}

interface AllPositions {
  mobile: BreakpointPosition;
  tablet: BreakpointPosition;
  desktop: BreakpointPosition;
}

const DEFAULTS: AllPositions = {
  mobile: { x: 50, y: 50, scale: 100 },
  tablet: { x: 45, y: 22, scale: 108 },
  desktop: { x: 37, y: 28, scale: 133 },
};

const BREAKPOINT_META: Record<Breakpoint, { label: string; icon: typeof Monitor; width: number; height: number; videoSrc: string }> = {
  mobile: { label: "Celular", icon: Smartphone, width: 375, height: 667, videoSrc: heroBgVideoMobile.url },
  tablet: { label: "Tablet", icon: Tablet, width: 768, height: 1024, videoSrc: heroBgVideo.url },
  desktop: { label: "Computador", icon: Monitor, width: 1280, height: 600, videoSrc: heroBgVideo.url },
};

const HeroVideoAdmin = () => {
  useAdmin();
  const [positions, setPositions] = useState<AllPositions>(DEFAULTS);
  const [activeBreakpoint, setActiveBreakpoint] = useState<Breakpoint>("mobile");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = positions[activeBreakpoint];
  const meta = BREAKPOINT_META[activeBreakpoint];

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("configuracoes" as any)
        .select("valor")
        .eq("chave", CONFIG_KEY)
        .single();
      if (data && (data as any).valor) {
        try {
          const parsed = JSON.parse((data as any).valor);
          setPositions({ ...DEFAULTS, ...parsed });
        } catch {}
      }
    };
    load();
  }, []);

  const updateCurrent = useCallback(
    (patch: Partial<BreakpointPosition>) => {
      setPositions((prev) => ({
        ...prev,
        [activeBreakpoint]: { ...prev[activeBreakpoint], ...patch },
      }));
    },
    [activeBreakpoint]
  );

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
      const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
      updateCurrent({ x, y });
    },
    [updateCurrent]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updatePosition(e.clientX, e.clientY);
  };
  const handlePointerUp = () => setDragging(false);

  const handleReset = () => {
    setPositions((prev) => ({ ...prev, [activeBreakpoint]: DEFAULTS[activeBreakpoint] }));
    toast.info(`Posição ${meta.label} resetada`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await supabase.functions.invoke("gallery-admin", {
        body: { action: "upsert-config", chave: CONFIG_KEY, valor: JSON.stringify(positions) },
      });
      if (res.error) throw res.error;
      const result = res.data;
      if (!result?.success) throw new Error(result?.error || "Erro desconhecido");
      toast.success("Posições salvas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const scale = current.scale / 100;

  // Preview dimensions (fit in available space)
  const maxPreviewW = 500;
  const aspect = meta.height / meta.width;
  const previewW = Math.min(maxPreviewW, meta.width);
  const previewH = previewW * aspect;

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Posição do Vídeo Hero</h2>
          <Button onClick={handleSave} disabled={saving} className="rounded-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Tudo"}
          </Button>
        </div>

        {/* Breakpoint tabs */}
        <div className="flex gap-2">
          {(Object.keys(BREAKPOINT_META) as Breakpoint[]).map((bp) => {
            const m = BREAKPOINT_META[bp];
            const Icon = m.icon;
            const active = bp === activeBreakpoint;
            return (
              <button
                key={bp}
                onClick={() => setActiveBreakpoint(bp)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Info */}
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Move className="h-4 w-4" />
              <span>Toque e arraste para posicionar o vídeo no {meta.label.toLowerCase()}</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={handleReset}>
              <RotateCcw className="h-3 w-3" /> Resetar
            </Button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex justify-center">
          <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden border-2 border-primary/40 cursor-crosshair select-none touch-none bg-muted"
            style={{ width: Math.min(previewW, 400), height: Math.min(previewH, 500) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <video
              src={meta.videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: `${current.x}% ${current.y}%`,
                transform: `scale(${scale})`,
                transformOrigin: `${current.x}% ${current.y}%`,
              }}
            />

            {/* Crosshair overlay */}
            <div
              className="absolute pointer-events-none z-10"
              style={{ left: `${current.x}%`, top: `${current.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className="h-8 w-8 rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)] flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary shadow-sm" />
              </div>
              <div className="absolute left-1/2 top-0 -translate-x-px -translate-y-4 w-0.5 h-3 bg-white/80" />
              <div className="absolute left-1/2 bottom-0 -translate-x-px translate-y-4 w-0.5 h-3 bg-white/80" />
              <div className="absolute top-1/2 left-0 -translate-y-px -translate-x-4 h-0.5 w-3 bg-white/80" />
              <div className="absolute top-1/2 right-0 -translate-y-px translate-x-4 h-0.5 w-3 bg-white/80" />
            </div>

            {/* Device frame label */}
            <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg">
              {meta.label} ({meta.width}×{meta.height})
            </div>
          </div>
        </div>

        {/* Zoom slider */}
        <div className="space-y-1.5 max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <ZoomOut className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Slider
              value={[current.scale]}
              onValueChange={(v) => updateCurrent({ scale: v[0] })}
              min={100}
              max={300}
              step={1}
              className="flex-1"
            />
            <ZoomIn className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Zoom: {current.scale}% · Posição: {current.x}%, {current.y}%
          </p>
        </div>

        {/* Summary of all breakpoints */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-sm font-semibold">Resumo das posições</p>
          {(Object.keys(BREAKPOINT_META) as Breakpoint[]).map((bp) => {
            const p = positions[bp];
            const m = BREAKPOINT_META[bp];
            const Icon = m.icon;
            const isActive = bp === activeBreakpoint;
            return (
              <div
                key={bp}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{m.label}</span>
                <span className="font-mono text-xs">
                  pos({p.x}%, {p.y}%) zoom({p.scale}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
};

export default HeroVideoAdmin;
