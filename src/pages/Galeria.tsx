import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Image as ImageIcon, Play, X, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabaseDb";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { decodeFocalPoint, getFocalStyle, decodeThumbnail } from "@/components/admin/FocalPointPicker";

interface Album {
  id: string;
  nome: string;
}

interface Foto {
  id: string;
  titulo: string;
  legenda: string | null;
  url_foto: string;
  album_id: string | null;
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".MOV", ".MP4"];
const isVideoUrl = (url: string) => VIDEO_EXTENSIONS.some(ext => url.toLowerCase().includes(ext.toLowerCase()));
const getFotoTipo = (url: string) => isVideoUrl(url) ? "video" : "foto";

const PHOTOS_PER_PAGE = 20;

const getVisitorCookie = (): string => {
  const key = "chama_visitor";
  let cookie = localStorage.getItem(key);
  if (!cookie) {
    cookie = crypto.randomUUID();
    localStorage.setItem(key, cookie);
  }
  return cookie;
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let dispositivo = "desktop";
  if (/Mobi|Android/i.test(ua)) dispositivo = "mobile";
  else if (/Tablet|iPad/i.test(ua)) dispositivo = "tablet";
  let navegador = "outro";
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) navegador = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) navegador = "Safari";
  else if (/Firefox/i.test(ua)) navegador = "Firefox";
  else if (/Edge/i.test(ua)) navegador = "Edge";
  return { dispositivo, navegador };
};

const trackGalleryEvent = async (
  fotoId: string,
  tipoEvento: "visualizacao" | "play_video" | "duracao_video",
) => {
  try {
    const { dispositivo, navegador } = getDeviceInfo();
    await supabase.from("galeria_analytics" as any).insert({
      foto_id: fotoId,
      tipo_evento: tipoEvento,
      cookie_visitante: getVisitorCookie(),
      dispositivo,
      navegador,
    } as any);
  } catch {
    // silently fail - analytics should never break UX
  }
};

const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden border bg-card animate-pulse">
    <div className="w-full aspect-[3/4] bg-muted" />
    <div className="p-3">
      <div className="h-4 bg-muted rounded w-3/4" />
    </div>
  </div>
);

const GaleriaPublica = () => {
  const [searchParams] = useSearchParams();
  const [albuns, setAlbuns] = useState<Album[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [galeriaAtiva, setGaleriaAtiva] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<Foto | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PHOTOS_PER_PAGE);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStartTime = useRef<number>(0);
  const trackedPlayRef = useRef<string | null>(null);
  const autoOpenedRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: configData } = await supabase
        .from("configuracoes" as any)
        .select("valor")
        .eq("chave", "galeria_ativa")
        .maybeSingle();

      const ativa = String((configData as { valor?: string | null } | null)?.valor ?? "").toLowerCase() === "true";
      setGaleriaAtiva(ativa);
      if (!ativa) { setLoading(false); return; }

      const [{ data: albumData }, { data: fotoData }] = await Promise.all([
        supabase.from("albuns" as any).select("id, nome").order("ordem"),
        supabase.from("galeria_fotos").select("*").eq("visivel", true).order("ordem"),
      ]);

      if (albumData) setAlbuns(albumData as unknown as Album[]);
      if (fotoData) setFotos(fotoData as unknown as Foto[]);
      setLoading(false);
    };
    load();
  }, []);

  // Reset visible count when album changes
  useEffect(() => {
    setVisibleCount(PHOTOS_PER_PAGE);
  }, [selectedAlbum]);

  // Infinite scroll observer
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(prev => prev + PHOTOS_PER_PAGE);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fotos, selectedAlbum]);

  const trackVideoDuration = useCallback(() => {
    if (videoRef.current && lightbox && getFotoTipo(lightbox.url_foto) === "video" && videoStartTime.current > 0) {
      const duration = (Date.now() - videoStartTime.current) / 1000;
      if (duration >= 1) trackGalleryEvent(lightbox.id, "duracao_video");
      videoStartTime.current = 0;
    }
  }, [lightbox]);

  const filteredFotos = selectedAlbum
    ? fotos.filter((f) => f.album_id === selectedAlbum)
    : fotos;

  const openLightbox = useCallback((foto: Foto) => {
    setImgLoaded(false);
    setLightbox(foto);
    trackGalleryEvent(foto.id, "visualizacao");
    trackedPlayRef.current = null;
    videoStartTime.current = 0;
  }, []);

  const navigateLightbox = useCallback((direction: -1 | 1) => {
    if (!lightbox) return;
    const idx = filteredFotos.findIndex(f => f.id === lightbox.id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < filteredFotos.length) {
      setImgLoaded(false);
      const next = filteredFotos[newIdx];
      setLightbox(next);
      trackGalleryEvent(next.id, "visualizacao");
      trackedPlayRef.current = null;
      videoStartTime.current = 0;
    }
  }, [lightbox, filteredFotos]);

  // Auto-open photo from ?foto= query param
  useEffect(() => {
    if (autoOpenedRef.current || fotos.length === 0) return;
    const fotoId = searchParams.get("foto");
    if (fotoId) {
      const foto = fotos.find(f => f.id === fotoId);
      if (foto) {
        autoOpenedRef.current = true;
        openLightbox(foto);
      }
    }
  }, [fotos, searchParams, openLightbox]);

  // Auto-select album from ?album= query param
  useEffect(() => {
    if (albuns.length === 0) return;
    const albumParam = searchParams.get("album");
    if (albumParam && !selectedAlbum) {
      const found = albuns.find(a => a.id === albumParam);
      if (found) setSelectedAlbum(found.id);
    }
  }, [albuns, searchParams, selectedAlbum]);

  const closeLightbox = useCallback(() => {
    trackVideoDuration();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    setLightbox(null);
    setImgLoaded(false);
  }, [trackVideoDuration]);

  const handleVideoPlay = useCallback(() => {
    if (lightbox && trackedPlayRef.current !== lightbox.id) {
      trackGalleryEvent(lightbox.id, "play_video");
      trackedPlayRef.current = lightbox.id;
    }
    videoStartTime.current = Date.now();
  }, [lightbox]);

  const handleVideoPause = useCallback(() => {
    if (lightbox && videoStartTime.current > 0) {
      const duration = (Date.now() - videoStartTime.current) / 1000;
      if (duration >= 1) trackGalleryEvent(lightbox.id, "duracao_video");
      videoStartTime.current = 0;
    }
  }, [lightbox]);

  // Keyboard navigation: Escape, Left, Right
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "ArrowRight") navigateLightbox(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeLightbox, navigateLightbox]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightbox) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  // Prefetch next/prev images for instant lightbox navigation
  useEffect(() => {
    if (!lightbox) return;
    const idx = filteredFotos.findIndex(f => f.id === lightbox.id);
    if (idx < 0) return;
    [idx - 1, idx + 1].forEach(i => {
      const f = filteredFotos[i];
      if (f && !isVideoUrl(f.url_foto)) {
        const img = new Image();
        img.decoding = "async";
        img.src = f.url_foto;
      }
    });
  }, [lightbox, filteredFotos]);

  // Photo count per album
  const albumPhotoCounts = new Map<string, number>();
  fotos.forEach(f => {
    if (f.album_id) {
      albumPhotoCounts.set(f.album_id, (albumPhotoCounts.get(f.album_id) || 0) + 1);
    }
  });

  // Lightbox index info
  const lightboxIdx = lightbox ? filteredFotos.findIndex(f => f.id === lightbox.id) : -1;
  const hasPrev = lightboxIdx > 0;
  const hasNext = lightboxIdx >= 0 && lightboxIdx < filteredFotos.length - 1;

  if (galeriaAtiva === null || loading) {
    return (
      <Layout>
        <section className="py-16 md:py-20">
          <div className="container">
            <div className="text-center mb-10">
              <div className="h-4 w-40 bg-muted rounded mx-auto mb-3 animate-pulse" />
              <div className="h-8 w-72 bg-muted rounded mx-auto animate-pulse" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  if (!galeriaAtiva) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h1 className="text-2xl font-bold">Galeria</h1>
          <p className="mt-2 text-muted-foreground">A galeria estará disponível em breve.</p>
        </div>
      </Layout>
    );
  }

  const visibleFotos = filteredFotos.slice(0, visibleCount);
  const hasMore = visibleCount < filteredFotos.length;

  return (
    <Layout>
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
              📸 Registro das atividades
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Galeria de Fotos e Vídeos</h1>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Acompanhe os eventos, ações sociais e encontros comunitários
            </p>
          </div>

          {/* Album filter with counts */}
          {albuns.length > 0 && (
            <div className="mb-10">
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center items-center gap-2 px-2">
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className={`w-full sm:w-auto rounded-full px-5 py-2.5 text-sm font-medium border transition-colors text-center ${
                    !selectedAlbum ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                  }`}
                >
                  Todas ({fotos.length})
                </button>
                {albuns.map((album) => {
                  const isActive = selectedAlbum === album.id;
                  return (
                    <button
                      key={album.id}
                      onClick={() => setSelectedAlbum(album.id)}
                      className={`w-full sm:w-auto rounded-full px-5 py-2.5 text-sm font-medium border transition-colors text-center ${
                        isActive ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                      }`}
                    >
                      {album.nome} ({albumPhotoCounts.get(album.id) || 0})
                    </button>
                  );
                })}
              </div>

              {/* Share bar for selected album */}
              {selectedAlbum && (() => {
                const album = albuns.find(a => a.id === selectedAlbum);
                if (!album) return null;
                return (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={async () => {
                        const albumUrl = `${window.location.origin}/galeria?album=${album.id}`;
                        const texto = `📸 ${album.nome} — Galeria Fernanda Sarelli\n\n👉 Veja as fotos: ${albumUrl}`;
                        if (navigator.share) {
                          try {
                            await navigator.share({ title: album.nome, text: texto, url: albumUrl });
                            return;
                          } catch { /* cancelled */ }
                        }
                        try {
                          await navigator.clipboard.writeText(texto);
                          toast.success("🔗 Link copiado!");
                        } catch {
                          const ta = document.createElement("textarea");
                          ta.value = texto;
                          ta.style.position = "fixed";
                          ta.style.opacity = "0";
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                          toast.success("🔗 Link copiado!");
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Compartilhar pasta
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {visibleFotos.map((foto, i) => {
              const isVideo = getFotoTipo(foto.url_foto) === "video";
              return (
                <div
                  key={foto.id}
                  className="rounded-2xl overflow-hidden border bg-card group cursor-pointer h-full flex flex-col active:scale-[0.97] transition-transform"
                  onClick={() => openLightbox(foto)}
                >
                  {isVideo ? (
                    <div className="relative w-full aspect-[3/4] bg-muted">
                      <video
                        src={foto.url_foto}
                        className="w-full h-full object-cover"
                        muted
                        preload="none"
                        playsInline
                        poster={decodeThumbnail(foto.legenda) || undefined}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-[0_0_0_4px_rgba(255,255,255,0.35)] group-hover:scale-110 group-hover:shadow-[0_0_0_6px_rgba(255,255,255,0.45)] transition-all duration-200">
                          <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/4] bg-muted overflow-hidden">
                      <img
                        src={decodeThumbnail(foto.legenda) || foto.url_foto}
                        alt={foto.titulo}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        style={getFocalStyle(foto.legenda)}
                        loading={i < 6 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={i < 4 ? "high" : "auto"}
                      />
                    </div>
                  )}
                  <div className="p-3 mt-auto">
                    <div className="flex items-center gap-2">
                      {isVideo && (
                        <span className="text-[10px] font-semibold uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                          Vídeo
                        </span>
                      )}
                      <p className="text-sm font-medium truncate">{foto.titulo}</p>
                    </div>
                    {foto.legenda && (() => {
                      const { cleanLegenda } = decodeFocalPoint(foto.legenda);
                      return cleanLegenda ? (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cleanLegenda}</p>
                      ) : null;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lazy load trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {filteredFotos.length === 0 && (
            <p className="text-center text-muted-foreground py-16">
              Nenhum conteúdo disponível neste álbum.
            </p>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          {lightboxIdx >= 0 && (
            <div className="absolute top-4 left-4 z-10 text-white/60 text-sm font-medium">
              {lightboxIdx + 1} / {filteredFotos.length}
            </div>
          )}

          {/* Prev */}
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          {/* Next */}
          {hasNext && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Próxima"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          <div
            className="relative w-full max-w-6xl max-h-[95vh] flex flex-col rounded-xl overflow-hidden bg-neutral-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {getFotoTipo(lightbox.url_foto) === "video" ? (
              <video
                ref={videoRef}
                src={lightbox.url_foto}
                className="w-full max-h-[82vh] bg-black object-contain"
                controls
                muted={false}
                autoPlay
                playsInline
                controlsList="nodownload"
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onLoadStart={() => setImgLoaded(false)}
                onCanPlay={() => setImgLoaded(true)}
              />
            ) : (
              <div className="relative w-full bg-black flex items-center justify-center" style={{ minHeight: "60vh", maxHeight: "82vh" }}>
                {/* Thumbnail nítida aparece INSTANTANEAMENTE enquanto a full carrega */}
                {decodeThumbnail(lightbox.legenda) && (
                  <img
                    src={decodeThumbnail(lightbox.legenda)!}
                    alt=""
                    aria-hidden="true"
                    className="absolute max-w-full max-h-[82vh] w-auto h-auto object-contain"
                    style={{ opacity: imgLoaded ? 0 : 1, transition: "opacity 250ms ease-out" }}
                  />
                )}
                {!imgLoaded && (
                  <div className="absolute top-4 right-4">
                    <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                  </div>
                )}
                <img
                  src={lightbox.url_foto}
                  alt={lightbox.titulo}
                  className="relative max-w-full max-h-[82vh] w-auto h-auto object-contain"
                  style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 250ms ease-out" }}
                  onLoad={() => setImgLoaded(true)}
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            )}

            <div className="p-4 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {getFotoTipo(lightbox.url_foto) === "video" && (
                      <span className="text-xs font-semibold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded shrink-0">
                        Vídeo
                      </span>
                    )}
                    <p className="font-semibold truncate">{lightbox.titulo}</p>
                  </div>
                  {lightbox.legenda && (() => {
                    const { cleanLegenda } = decodeFocalPoint(lightbox.legenda);
                    return cleanLegenda ? (
                      <p className="text-sm text-muted-foreground mt-1">{cleanLegenda}</p>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Download */}
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(lightbox.url_foto);
                        const blob = await res.blob();
                        const ext = isVideoUrl(lightbox.url_foto) ? "mp4" : "jpg";
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `${lightbox.titulo.replace(/[^a-zA-Z0-9À-ú ]/g, "").trim() || "foto"}.${ext}`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                        toast.success("Download iniciado!");
                      } catch {
                        toast.error("Erro ao baixar.");
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                    title="Baixar"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Baixar</span>
                  </button>
                  {/* Share with image */}
                  <button
                    onClick={async () => {
                      const fotoUrl = `${window.location.origin}/galeria?foto=${lightbox.id}`;
                      const texto = `${lightbox.titulo} — Fernanda Sarelli\n\n📷 Veja mais: ${fotoUrl}`;

                      if (navigator.share) {
                        try {
                          const res = await fetch(lightbox.url_foto);
                          const blob = await res.blob();
                          const ext = isVideoUrl(lightbox.url_foto) ? "mp4" : "jpg";
                          const mimeType = isVideoUrl(lightbox.url_foto) ? "video/mp4" : "image/jpeg";
                          const file = new File([blob], `foto.${ext}`, { type: mimeType });

                          if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                              title: lightbox.titulo,
                              text: texto,
                              url: fotoUrl,
                              files: [file],
                            });
                          } else {
                            await navigator.share({
                              title: lightbox.titulo,
                              text: texto,
                              url: fotoUrl,
                            });
                          }
                        } catch { /* cancelled */ }
                      } else {
                        await navigator.clipboard.writeText(texto);
                        toast.success("Link copiado!");
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Compartilhar"
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Compartilhar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GaleriaPublica;
