import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
  valor?: number
) => {
  const { dispositivo, navegador } = getDeviceInfo();
  await supabase.from("galeria_analytics" as any).insert({
    foto_id: fotoId,
    tipo_evento: tipoEvento,
    valor: valor ?? null,
    cookie_visitante: getVisitorCookie(),
    dispositivo,
    navegador,
  } as any);
};

// Skeleton card for loading state
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStartTime = useRef<number>(0);
  const trackedPlayRef = useRef<string | null>(null);
  const autoOpenedRef = useRef(false);

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

  const trackVideoDuration = useCallback(() => {
    if (videoRef.current && lightbox && getFotoTipo(lightbox.url_foto) === "video" && videoStartTime.current > 0) {
      const duration = (Date.now() - videoStartTime.current) / 1000;
      if (duration >= 1) trackGalleryEvent(lightbox.id, "duracao_video", Math.round(duration));
      videoStartTime.current = 0;
    }
  }, [lightbox]);

  const openLightbox = useCallback((foto: Foto) => {
    setImgLoaded(false);
    setLightbox(foto);
    trackGalleryEvent(foto.id, "visualizacao");
    trackedPlayRef.current = null;
    videoStartTime.current = 0;
  }, []);

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
      if (duration >= 1) trackGalleryEvent(lightbox.id, "duracao_video", Math.round(duration));
      videoStartTime.current = 0;
    }
  }, [lightbox]);

  // Close lightbox on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeLightbox]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightbox) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

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

  const filteredFotos = selectedAlbum
    ? fotos.filter((f) => f.album_id === selectedAlbum)
    : fotos;

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

          {/* Album filter */}
          {albuns.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              <button
                onClick={() => setSelectedAlbum(null)}
                className={`rounded-full px-5 py-2 text-sm font-medium border transition-colors ${
                  !selectedAlbum ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                }`}
              >
                Todas
              </button>
              {albuns.map((album) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbum(album.id)}
                  className={`rounded-full px-5 py-2 text-sm font-medium border transition-colors ${
                    selectedAlbum === album.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                  }`}
                >
                  {album.nome}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredFotos.map((foto, i) => {
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
                        src={foto.url_foto}
                        alt={foto.titulo}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        style={getFocalStyle(foto.legenda)}
                        loading={i < 6 ? "eager" : "lazy"}
                        decoding="async"
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
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl overflow-hidden bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {getFotoTipo(lightbox.url_foto) === "video" ? (
              <video
                ref={videoRef}
                src={lightbox.url_foto}
                className="w-full max-h-[78vh] bg-black"
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
              <div className="relative w-full max-h-[78vh] flex items-center justify-center bg-black min-h-[200px]">
                {!imgLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                  </div>
                )}
                <img
                  src={lightbox.url_foto}
                  alt={lightbox.titulo}
                  className="max-w-full max-h-[78vh] object-contain"
                  style={{ display: imgLoaded ? "block" : "none" }}
                  onLoad={() => setImgLoaded(true)}
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
                <button
                  onClick={async () => {
                    const fotoUrl = `${window.location.origin}/galeria?foto=${lightbox.id}`;
                    const texto = `${lightbox.titulo} — Fernanda Sarelli\n\n📷 Veja a foto: ${fotoUrl}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: lightbox.titulo,
                          text: texto,
                          url: fotoUrl,
                        });
                      } catch { /* cancelled */ }
                    } else {
                      await navigator.clipboard.writeText(texto);
                      toast.success("Link copiado!");
                    }
                  }}
                  className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  title="Compartilhar"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GaleriaPublica;
