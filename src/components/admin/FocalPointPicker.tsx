import { useState, useRef, useCallback } from "react";
import { Move, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface FocalPointPickerProps {
  src: string;
  focalX?: number; // 0-100
  focalY?: number; // 0-100
  zoom?: number;   // 100-300 (100 = normal)
  onChange: (x: number, y: number, zoom?: number) => void;
}

/**
 * Allows user to click/drag on an image to set the focal point + zoom.
 * Works in all directions (left, right, up, down).
 * The preview shows exact crop result with zoom applied.
 */
const FocalPointPicker = ({ src, focalX = 50, focalY = 50, zoom = 100, onChange }: FocalPointPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onChange(Math.round(x), Math.round(y), zoom);
  }, [onChange, zoom]);

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

  const handlePointerUp = () => {
    setDragging(false);
  };

  const handleZoomChange = (value: number[]) => {
    onChange(focalX, focalY, value[0]);
  };

  const handleReset = () => {
    onChange(50, 50, 100);
  };

  const scale = zoom / 100;

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Move className="h-4 w-4" />
          <span>Toque e arraste para posicionar</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground"
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3" /> Resetar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Image with crosshair */}
        <div
          ref={containerRef}
          className="relative rounded-xl overflow-hidden border-2 border-border cursor-crosshair select-none touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <img
            src={src}
            alt="Posicionar"
            className="w-full block"
            draggable={false}
            style={{ maxHeight: 300, objectFit: "contain", width: "100%", background: "hsl(var(--muted))" }}
          />
          {/* Crosshair */}
          <div
            className="absolute pointer-events-none"
            style={{ left: `${focalX}%`, top: `${focalY}%`, transform: "translate(-50%, -50%)" }}
          >
            {/* Outer ring */}
            <div className="h-8 w-8 rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)] flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary shadow-sm" />
            </div>
            {/* Crosshair lines */}
            <div className="absolute left-1/2 top-0 -translate-x-px -translate-y-4 w-0.5 h-3 bg-white/80" />
            <div className="absolute left-1/2 bottom-0 -translate-x-px translate-y-4 w-0.5 h-3 bg-white/80" />
            <div className="absolute top-1/2 left-0 -translate-y-px -translate-x-4 h-0.5 w-3 bg-white/80" />
            <div className="absolute top-1/2 right-0 -translate-y-px translate-x-4 h-0.5 w-3 bg-white/80" />
          </div>
        </div>

        {/* Preview: how it looks as square crop */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground text-center">Prévia no site</p>
          <div className="aspect-square rounded-xl overflow-hidden border-2 border-primary/30 bg-muted">
            <img
              src={src}
              alt="Prévia"
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${focalX}% ${focalY}%`,
                transform: `scale(${scale})`,
                transformOrigin: `${focalX}% ${focalY}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Zoom slider */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <ZoomOut className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Slider
            value={[zoom]}
            onValueChange={handleZoomChange}
            min={100}
            max={300}
            step={5}
            className="flex-1"
          />
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Zoom: {zoom}% · Posição: {focalX}%, {focalY}%
        </p>
      </div>
    </div>
  );
};

export default FocalPointPicker;

// Helpers to encode/decode focal point + zoom in legenda field
export const FOCAL_POINT_REGEX = /\[fp:(\d+),(\d+)(?:,(\d+))?\]$/;
export const THUMBNAIL_REGEX = /\[tn:([^\]]+)\]/;

export function encodeFocalPoint(legenda: string | null, x: number, y: number, zoom: number = 100): string {
  const clean = (legenda || "").replace(FOCAL_POINT_REGEX, "").trim();
  // Don't store default values
  if (x === 50 && y === 50 && zoom === 100) return clean;
  const zoomPart = zoom !== 100 ? `,${zoom}` : "";
  return clean ? `${clean} [fp:${x},${y}${zoomPart}]` : `[fp:${x},${y}${zoomPart}]`;
}

export function decodeFocalPoint(legenda: string | null): { cleanLegenda: string; focalX: number; focalY: number; zoom: number } {
  if (!legenda) return { cleanLegenda: "", focalX: 50, focalY: 50, zoom: 100 };
  // Strip thumbnail encoding before processing focal point
  const withoutTn = legenda.replace(THUMBNAIL_REGEX, "").trim();
  const match = withoutTn.match(FOCAL_POINT_REGEX);
  if (!match) return { cleanLegenda: withoutTn, focalX: 50, focalY: 50, zoom: 100 };
  return {
    cleanLegenda: withoutTn.replace(FOCAL_POINT_REGEX, "").trim(),
    focalX: parseInt(match[1], 10),
    focalY: parseInt(match[2], 10),
    zoom: match[3] ? parseInt(match[3], 10) : 100,
  };
}

export function decodeThumbnail(legenda: string | null): string | null {
  if (!legenda) return null;
  const match = legenda.match(THUMBNAIL_REGEX);
  return match ? match[1] : null;
}

export function getFocalStyle(legenda: string | null): React.CSSProperties {
  const { focalX, focalY, zoom } = decodeFocalPoint(legenda);
  const style: React.CSSProperties = {};
  if (focalX !== 50 || focalY !== 50) {
    style.objectPosition = `${focalX}% ${focalY}%`;
  }
  if (zoom !== 100) {
    style.transform = `scale(${zoom / 100})`;
    style.transformOrigin = `${focalX}% ${focalY}%`;
  }
  return style;
}
