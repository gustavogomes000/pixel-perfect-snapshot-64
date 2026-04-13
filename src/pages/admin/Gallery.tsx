import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Trash2, Eye, EyeOff, Upload, FolderPlus, Sparkles, Eraser,
  Pin, Pencil, ArrowLeft, ArrowRight, Check, X, FolderOpen, ImagePlus,
  Move, ChevronDown, Camera, Images, Video, Play, Crosshair
} from "lucide-react";
import FocalPointPicker, { encodeFocalPoint, decodeFocalPoint, getFocalStyle, decodeThumbnail } from "@/components/admin/FocalPointPicker";
import { supabase } from "@/lib/supabaseDb";
import { supabase as cloudSupabase } from "@/integrations/supabase/client";
import { galleryAdmin } from "@/lib/galleryAdmin";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Album {
  id: string;
  nome: string;
  descricao: string | null;
  capa_url: string | null;
  ordem: number | null;
  fixado_home: boolean;
  atualizado_em: string;
}

interface Foto {
  id: string;
  titulo: string;
  legenda: string | null;
  url_foto: string;
  album_id: string | null;
  visivel: boolean;
  ordem: number;
  destaque_home: boolean;
}

// Derive tipo from URL since column doesn't exist in DB
const getFotoTipo = (url: string): string => isVideoUrl(url) ? "video" : "foto";

const TEST_ALBUMS = ["Eventos Comunitários", "Ações Sociais", "Campanha"] as const;

const TEST_PHOTOS = [
  { url: "/test-gallery/comunidade.svg", legenda: "Imagem de teste para visualizar a composição da galeria." },
  { url: "/test-gallery/agenda.svg", legenda: "Imagem de teste para validar cortes e proporções." },
  { url: "/test-gallery/lideranca.svg", legenda: "Imagem de teste para ocupar o layout do álbum." },
  { url: "/test-gallery/encontro.svg", legenda: "Imagem de teste com composição horizontal." },
  { url: "/test-gallery/campanha.svg", legenda: "Imagem de teste para revisar espaçamento visual." },
  { url: "/test-gallery/territorio.svg", legenda: "Imagem de teste para checar contraste e leitura." },
  { url: "/test-gallery/comunidade.svg", legenda: "Imagem de teste duplicada de propósito para volume visual." },
  { url: "/test-gallery/agenda.svg", legenda: "Imagem de teste duplicada de propósito para volume visual." },
  { url: "/test-gallery/lideranca.svg", legenda: "Imagem de teste duplicada de propósito para volume visual." },
  { url: "/test-gallery/encontro.svg", legenda: "Imagem de teste duplicada de propósito para volume visual." },
  { url: "/test-gallery/campanha.svg", legenda: "Imagem de teste duplicada de propósito para volume visual." },
  { url: "/test-gallery/territorio.svg", legenda: "Imagem de teste duplicada de propósito para volume visual." },
] as const;

const TEST_IMAGE_URLS: string[] = [...new Set(TEST_PHOTOS.map((photo) => photo.url))];

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi"];
const isVideoFile = (file: File) => file.type.startsWith("video/");
const isVideoUrl = (url: string) => {
  const lower = url.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.includes(ext));
};

const compressImage = (file: File, maxPx = 2048, quality = 0.92): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size < 800 * 1024) {
      resolve(file);
      return;
    }
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { width, height } = img;
      if (width <= maxPx && height <= maxPx) {
        resolve(file);
        return;
      }
      if (width > height) {
        height = Math.round((height * maxPx) / width);
        width = maxPx;
      } else {
        width = Math.round((width * maxPx) / height);
        height = maxPx;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const outName = file.name.replace(/\.[^.]+$/, ".jpg");
        resolve(new File([blob], outName, { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
};

const WRITE_BLOCKED_MESSAGE = "Edições bloqueadas no painel: configure a service_role key correta do backend externo para liberar salvar, mover e apagar.";

const captureVideoFrame = (video: HTMLVideoElement): string | null => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
};

const autoCaptureVideoFrame = (file: File, seekTo = 2): Promise<string | null> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTo, video.duration > 0 ? video.duration * 0.1 : seekTo);
    };

    video.onseeked = () => {
      const dataUrl = captureVideoFrame(video);
      cleanup();
      resolve(dataUrl);
    };

    video.onerror = () => { cleanup(); resolve(null); };
    video.src = url;
  });
};

const Gallery = () => {
  const [albuns, setAlbuns] = useState<Album[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [galeriaAtiva, setGaleriaAtiva] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editAlbumId, setEditAlbumId] = useState<string | null>(null);
  const [editAlbumName, setEditAlbumName] = useState("");
  const [editAlbumOpen, setEditAlbumOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingPhoto, setEditingPhoto] = useState<Foto | null>(null);
  const [editPhotoTitle, setEditPhotoTitle] = useState("");
  const [editPhotoCaption, setEditPhotoCaption] = useState("");
  const [editFocalX, setEditFocalX] = useState(50);
  const [editFocalY, setEditFocalY] = useState(50);
  const [editZoom, setEditZoom] = useState(100);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [writeEnabled, setWriteEnabled] = useState<boolean | null>(null);
  const [writeErrorMessage, setWriteErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const [pendingUploads, setPendingUploads] = useState<Array<{ file: File; previewUrl: string; focalX: number; focalY: number; zoom: number; isVideo?: boolean; thumbnailDataUrl?: string | null }>>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showUploadPreview, setShowUploadPreview] = useState(false);

  const loadData = useCallback(async () => {
    const [{ data: albumData, error: albumError }, { data: fotoData, error: fotoError }, { data: configData, error: configError }] = await Promise.all([
      supabase.from("albuns" as any).select("*").order("ordem"),
      supabase.from("galeria_fotos").select("*").order("ordem"),
      supabase.from("configuracoes" as any).select("*").eq("chave", "galeria_ativa").maybeSingle(),
    ]);

    if (albumError || fotoError) {
      toast.error("Não foi possível carregar a galeria.");
      return;
    }

    setAlbuns((albumData as unknown as Album[]) || []);
    setFotos((fotoData as unknown as Foto[]) || []);
    setGaleriaAtiva((configData as { valor?: string } | null)?.valor === "true");
  }, []);

  const refreshWriteAccess = useCallback(async () => {
    try {
      const result = await galleryAdmin({ action: "debug" });
      const enabled = result.keyIsServiceRole === true;
      setWriteEnabled(enabled);
      setWriteErrorMessage(enabled ? null : WRITE_BLOCKED_MESSAGE);
    } catch {
      setWriteEnabled(false);
      setWriteErrorMessage(WRITE_BLOCKED_MESSAGE);
    }
  }, []);

  const handleActionError = useCallback((error: unknown, fallbackMessage: string) => {
    const message = error instanceof Error && error.message ? error.message : fallbackMessage;
    if (message.includes("Service role key inválida")) {
      setWriteEnabled(false);
      setWriteErrorMessage(WRITE_BLOCKED_MESSAGE);
      toast.error(WRITE_BLOCKED_MESSAGE);
      return;
    }
    toast.error(message);
  }, []);

  const ensureWriteEnabled = useCallback(() => {
    if (writeEnabled === false) {
      toast.error(writeErrorMessage || WRITE_BLOCKED_MESSAGE);
      return false;
    }
    return true;
  }, [writeEnabled, writeErrorMessage]);

  useEffect(() => {
    loadData();
    refreshWriteAccess();
  }, [loadData, refreshWriteAccess]);

  // === Album actions ===
  const createAlbum = async () => {
    if (!newAlbumName.trim() || !ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "create-album", nome: newAlbumName.trim() });
      setNewAlbumName("");
      setNewAlbumOpen(false);
      toast.success("📁 Pasta criada!");
      await loadData();
    } catch (error) {
      handleActionError(error, "Não foi possível criar a pasta.");
    }
  };

  const deleteAlbum = async (albumId: string) => {
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "delete-album", id: albumId });
      if (selectedAlbum === albumId) setSelectedAlbum(null);
      toast.success("Pasta excluída");
      await loadData();
    } catch (error) {
      handleActionError(error, "Não foi possível excluir a pasta.");
    }
  };

  const updateAlbum = async () => {
    if (!editAlbumId || !editAlbumName.trim() || !ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "update-album", id: editAlbumId, nome: editAlbumName.trim() });
      setEditAlbumOpen(false);
      setEditAlbumId(null);
      setEditAlbumName("");
      toast.success("Pasta renomeada");
      await loadData();
    } catch (error) {
      handleActionError(error, "Não foi possível renomear.");
    }
  };

  const toggleAlbumPin = async (albumId: string, currentPinned: boolean) => {
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "update-album", id: albumId, fixado_home: !currentPinned });
      toast.success(!currentPinned ? "📌 Pasta fixada na home" : "Pasta removida da home");
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao fixar/desfixar pasta.");
    }
  };

  const setAlbumCover = async (albumId: string, coverUrl: string) => {
    if (!ensureWriteEnabled()) return;
    if (!window.confirm("Definir esta foto como capa da pasta?")) return;
    try {
      await galleryAdmin({ action: "update-album", id: albumId, capa_url: coverUrl });
      toast.success("Capa da pasta atualizada!");
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao definir capa.");
    }
  };

  const moveAlbum = async (albumId: string, direction: "left" | "right") => {
    const idx = albuns.findIndex((a) => a.id === albumId);
    if (idx < 0 || !ensureWriteEnabled()) return;
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= albuns.length) return;
    try {
      await galleryAdmin({ action: "reorder-albums", updates: [
        { id: albuns[idx].id, ordem: swapIdx },
        { id: albuns[swapIdx].id, ordem: idx },
      ]});
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao reordenar.");
    }
  };

  // === Photo/Video actions ===
  const deletePhoto = async (id: string) => {
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "delete-photo", id });
      toast.success("Item removido");
      await loadData();
    } catch (error) {
      handleActionError(error, "Não foi possível remover.");
    }
  };

  const togglePhotoVisibility = async (id: string, visivel: boolean) => {
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "update-photo", id, updates: { visivel: !visivel } });
      toast.success(!visivel ? "Visível no site" : "Oculto do site");
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao alterar visibilidade.");
    }
  };

  const toggleDestaqueHome = async (id: string, atual: boolean) => {
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "update-photo", id, updates: { destaque_home: !atual } });
      toast.success(!atual ? "📌 Fixado na página inicial" : "Removido da página inicial");
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao alterar destaque.");
    }
  };

  const movePhotoToAlbum = async (photoId: string, albumId: string | null) => {
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "move-photo", id: photoId, album_id: albumId });
      const albumName = albumId ? albuns.find(a => a.id === albumId)?.nome : "Sem pasta";
      toast.success(`Movido para "${albumName}"`);
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao mover.");
    }
  };

  const updatePhoto = async () => {
    if (!editingPhoto || !ensureWriteEnabled()) return;
    const legendaWithFp = encodeFocalPoint(editPhotoCaption.trim() || null, editFocalX, editFocalY, editZoom);
    try {
      await galleryAdmin({ action: "update-photo", id: editingPhoto.id, updates: { titulo: editPhotoTitle.trim(), legenda: legendaWithFp || null } });
      setEditingPhoto(null);
      toast.success("Atualizado!");
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao salvar.");
    }
  };

  // === Bulk actions ===
  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkMoveToAlbum = async (albumId: string | null) => {
    const ids = Array.from(selectedPhotos);
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "bulk-update", ids, updates: { album_id: albumId } });
      const albumName = albumId ? albuns.find(a => a.id === albumId)?.nome : "Sem pasta";
      toast.success(`${ids.length} item(ns) movido(s) para "${albumName}"`);
      setSelectedPhotos(new Set());
      setSelectionMode(false);
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao mover itens.");
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedPhotos);
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "bulk-delete", ids });
      toast.success(`${ids.length} item(ns) removido(s)`);
      setSelectedPhotos(new Set());
      setSelectionMode(false);
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao remover itens.");
    }
  };

  const bulkToggleVisibility = async (makeVisible: boolean) => {
    const ids = Array.from(selectedPhotos);
    if (!ensureWriteEnabled()) return;
    try {
      await galleryAdmin({ action: "bulk-update", ids, updates: { visivel: makeVisible } });
      toast.success(`${ids.length} item(ns) ${makeVisible ? "visíveis" : "ocultos"}`);
      setSelectedPhotos(new Set());
      setSelectionMode(false);
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao alterar visibilidade.");
    }
  };

  // === Upload (photos + videos) ===
  const stageFilesForPreview = (files: File[]) => {
    const mediaFiles = files.filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (mediaFiles.length === 0) {
      toast.error("Nenhum arquivo válido. Selecione fotos ou vídeos.");
      return;
    }
    if (mediaFiles.length > 50) {
      toast.error(`Máximo de 50 arquivos por vez. Você selecionou ${mediaFiles.length}.`);
      return;
    }

    const previews = mediaFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      focalX: 50,
      focalY: 50,
      zoom: 100,
      isVideo: file.type.startsWith("video/"),
      thumbnailDataUrl: null as string | null,
    }));
    setPendingUploads(previews);
    setPreviewIndex(0);
    setShowUploadPreview(true);
  };

  const uploadFilesWithFocalPoints = async (items: Array<{ file: File; focalX: number; focalY: number; zoom: number; thumbnailDataUrl?: string | null }>) => {
    if (!ensureWriteEnabled()) return;
    setUploading(true);
    setUploadProgress(0);

    const toastId = `upload-${Date.now()}`;
    toast.loading(`Preparando ${items.length} arquivo(s)...`, { id: toastId });

    // 1. Compress all images in parallel
    const prepared = await Promise.all(
      items.map(async (item) => {
        const isVideo = isVideoFile(item.file);
        const fileToUpload = isVideo ? item.file : await compressImage(item.file);
        return { ...item, fileToUpload, isVideo };
      })
    );

    // 2. Build all paths and get signed URLs in a single batch request
    const allPaths: string[] = [];
    const thumbPaths: (string | null)[] = [];

    for (const { fileToUpload, isVideo, thumbnailDataUrl } of prepared) {
      const sanitizedName = fileToUpload.name.replace(/\s+/g, "-").toLowerCase();
      const folder = isVideo ? "videos" : "galeria";
      const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      allPaths.push(`${folder}/${uid}_${sanitizedName}`);

      if (isVideo && thumbnailDataUrl) {
        const tp = `thumbnails/${uid}.jpg`;
        thumbPaths.push(tp);
      } else {
        thumbPaths.push(null);
      }
    }

    const pathsToSign = [...allPaths, ...thumbPaths.filter(Boolean) as string[]];

    let signedUrlMap: Map<string, string>;
    try {
      const result = await galleryAdmin({ action: "create-upload-urls", paths: pathsToSign });
      const urls = result.urls as Array<{ path: string; signedUrl?: string; error?: string }>;
      signedUrlMap = new Map(urls.filter(u => u.signedUrl).map(u => [u.path, u.signedUrl!]));
    } catch {
      toast.error("Erro ao preparar URLs de upload");
      setUploading(false);
      toast.dismiss(toastId);
      return;
    }

    toast.loading(`Enviando ${items.length} arquivo(s)...`, { id: toastId });

    // 3. Upload files in parallel (concurrency 3)
    let done = 0;
    const successfulPhotos: Array<Record<string, unknown>> = [];
    const CONCURRENCY = 3;

    const chunks: typeof prepared[] = [];
    for (let i = 0; i < prepared.length; i += CONCURRENCY) {
      chunks.push(prepared.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async (item, chunkIdx) => {
          const idx = prepared.indexOf(item);
          const mainPath = allPaths[idx];
          const thumbPath = thumbPaths[idx];
          const signedUrl = signedUrlMap.get(mainPath);

          if (!signedUrl) {
            toast.error(`Sem URL para "${item.file.name}"`);
            done++;
            setUploadProgress(Math.round((done / prepared.length) * 100));
            return;
          }

          // Upload main file
          const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": item.fileToUpload.type || "application/octet-stream" },
            body: item.fileToUpload,
          });

          if (!uploadRes.ok) {
            toast.error(`Erro: "${item.file.name}" (${uploadRes.status})`);
            done++;
            setUploadProgress(Math.round((done / prepared.length) * 100));
            return;
          }

          const { data: urlData } = cloudSupabase.storage.from("galeria").getPublicUrl(mainPath);

          // Upload thumbnail if needed
          let legendaBase: string | null = null;
          if (item.isVideo && item.thumbnailDataUrl && thumbPath) {
            const thumbSignedUrl = signedUrlMap.get(thumbPath);
            if (thumbSignedUrl) {
              try {
                const res = await fetch(item.thumbnailDataUrl);
                const blob = await res.blob();
                const thumbRes = await fetch(thumbSignedUrl, {
                  method: "PUT",
                  headers: { "Content-Type": "image/jpeg" },
                  body: blob,
                });
                if (thumbRes.ok) {
                  const { data: thumbUrl } = cloudSupabase.storage.from("galeria").getPublicUrl(thumbPath);
                  legendaBase = `[tn:${thumbUrl.publicUrl}]`;
                }
              } catch { /* skip thumbnail */ }
            }
          }

          const legendaWithFp = encodeFocalPoint(legendaBase, item.focalX, item.focalY, item.zoom);
          successfulPhotos.push({
            titulo: item.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
            url_foto: urlData.publicUrl,
            album_id: selectedAlbum,
            visivel: true,
            legenda: legendaWithFp || null,
          });

          done++;
          setUploadProgress(Math.round((done / prepared.length) * 100));
          toast.loading(`Enviando… ${done}/${prepared.length}`, { id: toastId });
        })
      );
    }

    // 4. Batch insert all photos in a single DB call
    if (successfulPhotos.length > 0) {
      try {
        await galleryAdmin({ action: "insert-photos", photos: successfulPhotos });
      } catch (error) {
        handleActionError(error, "Erro ao salvar fotos no banco.");
      }
    }

    setUploadProgress(100);
    setUploading(false);
    toast.dismiss(toastId);

    if (successfulPhotos.length > 0) {
      toast.success(`✅ ${successfulPhotos.length} arquivo(s) enviado(s) com sucesso!`);
      await loadData();
    }
  };

  const confirmUploadPreviews = async () => {
    // Auto-capture frame for videos without a selected thumbnail
    const withThumbs = await Promise.all(
      pendingUploads.map(async (p) => {
        if (p.isVideo && !p.thumbnailDataUrl) {
          const thumb = await autoCaptureVideoFrame(p.file);
          return { ...p, thumbnailDataUrl: thumb };
        }
        return p;
      })
    );

    const items = withThumbs.map(p => ({ file: p.file, focalX: p.focalX, focalY: p.focalY, zoom: p.zoom, thumbnailDataUrl: p.thumbnailDataUrl }));
    withThumbs.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setPendingUploads([]);
    setShowUploadPreview(false);
    uploadFilesWithFocalPoints(items);
  };

  const cancelUploadPreviews = () => {
    pendingUploads.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setPendingUploads([]);
    setShowUploadPreview(false);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    stageFilesForPreview(Array.from(e.dataTransfer.files));
  };

  const addPhoto = async () => {
    if (!uploadUrl.trim() || !uploadTitle.trim() || !ensureWriteEnabled()) return;
    const tipo = isVideoUrl(uploadUrl) ? "video" : "foto";
    try {
      await galleryAdmin({ action: "insert-photo", photo: {
        titulo: uploadTitle.trim(),
        legenda: uploadCaption.trim() || null,
        url_foto: uploadUrl.trim(),
        album_id: selectedAlbum,
        visivel: true,
      }});
      setUploadUrl("");
      setUploadTitle("");
      setUploadCaption("");
      setUploadOpen(false);
      toast.success(`${tipo === "video" ? "Vídeo" : "Foto"} adicionado!`);
      await loadData();
    } catch (error) {
      handleActionError(error, "Não foi possível adicionar.");
    }
  };

  // === Test data ===
  const ensureTestAlbums = async () => {
    const { data: existingAlbums, error: existingError } = await supabase
      .from("albuns" as any).select("id, nome").in("nome", [...TEST_ALBUMS]);
    if (existingError) { toast.error("Erro ao preparar álbuns de teste."); return null; }
    const existingNames = new Set(((existingAlbums as unknown as Album[] | null) || []).map(a => a.nome));
    const missing = TEST_ALBUMS.filter(name => !existingNames.has(name));
    for (const name of missing) {
      try {
        await galleryAdmin({ action: "create-album", nome: name });
      } catch (error) {
        handleActionError(error, "Não foi possível preparar os álbuns de teste.");
        return null;
      }
    }
    const { data, error } = await supabase.from("albuns" as any).select("id, nome").in("nome", [...TEST_ALBUMS]).order("ordem");
    if (error) return null;
    return (data as unknown as Album[]) || [];
  };

  const clearTestPhotos = async (silent = false) => {
    if (!ensureWriteEnabled()) return false;
    try {
      await galleryAdmin({ action: "delete-test-photos", urls: TEST_IMAGE_URLS });
      if (!silent) toast.success("Fotos de teste removidas");
      await loadData();
      return true;
    } catch (error) {
      if (!silent) handleActionError(error, "Erro ao limpar teste.");
      return false;
    }
  };

  const populateTestPhotos = async () => {
    if (!ensureWriteEnabled()) return;
    const testAlbums = await ensureTestAlbums();
    if (!testAlbums || testAlbums.length === 0) return;
    const cleared = await clearTestPhotos(true);
    if (!cleared) return;
    const albumMap = new Map(testAlbums.map(a => [a.nome, a.id]));
    const payload = TEST_PHOTOS.map((photo, i) => ({
      titulo: `Foto de teste ${i + 1}`,
      legenda: photo.legenda,
      url_foto: photo.url,
      album_id: albumMap.get(TEST_ALBUMS[i % TEST_ALBUMS.length]) || null,
      visivel: true,
      ordem: i,
    }));
    try {
      await galleryAdmin({ action: "insert-photos", photos: payload });
      toast.success("Fotos de teste adicionadas!");
      await loadData();
    } catch (error) {
      handleActionError(error, "Erro ao criar fotos de teste.");
    }
  };

  const toggleGaleria = async () => {
    if (!ensureWriteEnabled()) return;
    const newVal = !galeriaAtiva;
    try {
      await galleryAdmin({ action: "update-config", chave: "galeria_ativa", valor: newVal ? "true" : "false" });
      setGaleriaAtiva(newVal);
      toast.success(newVal ? "Galeria ativada no site" : "Galeria desativada no site");
    } catch (error) {
      handleActionError(error, "Erro ao atualizar.");
    }
  };

  const semPasta = fotos.filter(f => !f.album_id);
  const filteredFotos = selectedAlbum ? fotos.filter(f => f.album_id === selectedAlbum) : semPasta;
  const hasTestPhotos = fotos.some(f => TEST_IMAGE_URLS.includes(f.url_foto));
  const selectedAlbumName = selectedAlbum ? albuns.find(a => a.id === selectedAlbum)?.nome : null;

  const photoCount = fotos.filter(f => getFotoTipo(f.url_foto) === "foto").length;
  const videoCount = fotos.filter(f => getFotoTipo(f.url_foto) === "video").length;

  return (
    <AdminLayout>
      <div className="space-y-4 pb-4">
        {writeEnabled === false && writeErrorMessage && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">Painel em modo leitura</p>
            <p className="mt-1 text-xs text-muted-foreground">{writeErrorMessage}</p>
          </div>
        )}

        {/* ===== HEADER ===== */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Images className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">Galeria</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {photoCount} foto(s) · {videoCount} vídeo(s) · {albuns.length} pasta(s)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground">
              {galeriaAtiva ? "Ativa" : "Oculta"}
            </span>
            <Switch checked={galeriaAtiva} onCheckedChange={toggleGaleria} />
          </div>
        </div>

        {/* ===== UPLOAD AREA ===== */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            stageFilesForPreview(Array.from(e.target.files || []));
            if (e.target) e.target.value = "";
          }}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`relative rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer
            ${dragOver
              ? "border-primary bg-accent scale-[1.01]"
              : "border-muted-foreground/30 hover:border-primary hover:bg-accent/30"
            }
            ${uploading ? "pointer-events-none opacity-70" : ""}
          `}
        >
          {uploading ? (
            <div className="space-y-3">
              <div className="h-2 w-full max-w-xs mx-auto rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">Enviando arquivos... {uploadProgress}%</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-2 mb-2">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Video className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-sm font-semibold">
                Toque para enviar fotos ou vídeos
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG, MP4, WebM · Máx. 50 arquivos por vez
              </p>
              {selectedAlbumName && (
                <Badge variant="secondary" className="mt-3">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  Serão salvos em: {selectedAlbumName}
                </Badge>
              )}
            </>
          )}
        </div>

        {/* ===== SECONDARY ACTIONS ===== */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-full text-xs h-8 gap-1">
                <ImagePlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Adicionar por</span> link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar por link</DialogTitle>
                <DialogDescription>Cole o endereço de uma foto ou vídeo</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="https://exemplo.com/foto.jpg" value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} />
                <Input placeholder="Nome" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
                <Input placeholder="Descrição (opcional)" value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} />
                {uploadUrl && isVideoUrl(uploadUrl) && (
                  <Badge variant="secondary" className="gap-1">
                    <Video className="h-3 w-3" /> Vídeo
                  </Badge>
                )}
              </div>
              <DialogFooter>
                <Button onClick={addPhoto} className="rounded-full w-full">Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            variant={selectionMode ? "default" : "outline"}
            className="rounded-full text-xs h-8 gap-1"
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelectedPhotos(new Set());
            }}
          >
            <Check className="h-3.5 w-3.5" />
            {selectionMode ? `${selectedPhotos.size} sel.` : "Selecionar"}
          </Button>

          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" className="rounded-full text-[10px] h-8 gap-0.5 text-muted-foreground px-2" onClick={populateTestPhotos}>
              <Sparkles className="h-3 w-3" />Teste
            </Button>
            {hasTestPhotos && (
              <Button size="sm" variant="ghost" className="rounded-full text-[10px] h-8 gap-0.5 text-muted-foreground px-2" onClick={() => clearTestPhotos()}>
                <Eraser className="h-3 w-3" />Limpar
              </Button>
            )}
          </div>
        </div>

        {/* ===== BULK ACTIONS BAR ===== */}
        {selectionMode && selectedPhotos.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5">
            <span className="text-xs font-medium text-primary">{selectedPhotos.size} sel.</span>
            <div className="flex-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-full text-[11px] h-7 gap-1 px-2">
                  <Move className="h-3 w-3" /> Mover
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="text-xs">Mover para</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => bulkMoveToAlbum(null)}>📂 Sem pasta</DropdownMenuItem>
                {albuns.map(a => (
                  <DropdownMenuItem key={a.id} onClick={() => bulkMoveToAlbum(a.id)}>📁 {a.nome}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" className="rounded-full text-[11px] h-7 gap-1 px-2" onClick={() => bulkToggleVisibility(true)}>
              <Eye className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="rounded-full text-[11px] h-7 gap-1 px-2" onClick={() => bulkToggleVisibility(false)}>
              <EyeOff className="h-3 w-3" />
            </Button>

            <Button
              size="sm"
              variant="destructive"
              className="rounded-full text-[11px] h-7 gap-1 px-2"
              onClick={() => {
                if (window.confirm(`Apagar ${selectedPhotos.size} item(ns)? Esta ação não pode ser desfeita.`)) {
                  void bulkDelete();
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>

            <Button size="sm" variant="ghost" className="rounded-full h-7 w-7 p-0" onClick={() => { setSelectedPhotos(new Set()); setSelectionMode(false); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* ===== PASTAS (ALBUMS) ===== */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pastas</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedAlbum(null)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium border-2 transition-all flex items-center gap-2 ${
                !selectedAlbum
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border hover:bg-accent hover:border-primary/30"
              }`}
            >
              <Images className="h-4 w-4" />
              Sem pasta
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${!selectedAlbum ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {semPasta.length}
              </span>
            </button>

            {albuns.map((album, idx) => {
              const count = fotos.filter(f => f.album_id === album.id).length;
              const isSelected = selectedAlbum === album.id;
              return (
                <div key={album.id} className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => setSelectedAlbum(album.id)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium border-2 transition-all flex items-center gap-2 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-card border-border hover:bg-accent hover:border-primary/30"
                    }`}
                  >
                    {album.fixado_home && <Pin className="h-3 w-3" />}
                    📁 {album.nome}
                    <span className={`text-xs rounded-full px-1.5 py-0.5 ${isSelected ? "bg-primary-foreground/20" : "bg-muted"}`}>
                      {count}
                    </span>
                  </button>

                  {isSelected && (
                    <div className="flex items-center gap-0.5 ml-1">
                      {idx > 0 && (
                        <button onClick={() => moveAlbum(album.id, "left")} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent border" title="Mover para esquerda">
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {idx < albuns.length - 1 && (
                        <button onClick={() => moveAlbum(album.id, "right")} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent border" title="Mover para direita">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleAlbumPin(album.id, !!album.fixado_home)}
                        className={`h-7 w-7 flex items-center justify-center rounded-lg border transition-colors ${
                          album.fixado_home ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        }`}
                        title={album.fixado_home ? "Remover da home" : "Fixar na home"}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditAlbumId(album.id); setEditAlbumName(album.nome); setEditAlbumOpen(true); }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent border"
                        title="Renomear pasta"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Excluir a pasta \"${album.nome}\"? As fotos e vídeos serão mantidos.`)) {
                            void deleteAlbum(album.id);
                          }
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive hover:text-destructive-foreground border transition-colors"
                        title="Excluir pasta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* New album button */}
            <Dialog open={newAlbumOpen} onOpenChange={setNewAlbumOpen}>
              <DialogTrigger asChild>
                <button className="shrink-0 rounded-xl h-10 px-4 flex items-center gap-2 border-2 border-dashed border-primary/50 text-primary hover:bg-accent transition-all text-sm font-medium">
                  <FolderPlus className="h-4 w-4" />
                  Nova pasta
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar nova pasta</DialogTitle>
                  <DialogDescription>Dê um nome para organizar suas fotos e vídeos</DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="Ex: Eventos de Março"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAlbum()}
                />
                <DialogFooter>
                  <Button onClick={createAlbum} className="rounded-full w-full">Criar pasta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Dialog editar álbum */}
        <Dialog open={editAlbumOpen} onOpenChange={setEditAlbumOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renomear pasta</DialogTitle>
            </DialogHeader>
            <Input
              value={editAlbumName}
              onChange={(e) => setEditAlbumName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && updateAlbum()}
            />
            <DialogFooter>
              <Button onClick={updateAlbum} className="rounded-full w-full">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog editar foto/vídeo */}
        <Dialog open={!!editingPhoto} onOpenChange={(open) => { if (!open) setEditingPhoto(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar {editingPhoto && getFotoTipo(editingPhoto.url_foto) === "video" ? "vídeo" : "foto"}</DialogTitle>
              <DialogDescription>Ajuste o nome, descrição e posicionamento da imagem</DialogDescription>
            </DialogHeader>
            {editingPhoto && (
              <div className="space-y-4">
                {getFotoTipo(editingPhoto.url_foto) === "video" ? (
                  <video
                    src={editingPhoto.url_foto}
                    className="w-full aspect-video rounded-xl bg-muted"
                    controls
                  />
                ) : (
                  <FocalPointPicker
                    src={editingPhoto.url_foto}
                    focalX={editFocalX}
                    focalY={editFocalY}
                    zoom={editZoom}
                    onChange={(x, y, z) => { setEditFocalX(x); setEditFocalY(y); if (z !== undefined) setEditZoom(z); }}
                  />
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input value={editPhotoTitle} onChange={(e) => setEditPhotoTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea value={editPhotoCaption} onChange={(e) => setEditPhotoCaption(e.target.value)} placeholder="Opcional" rows={2} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={updatePhoto} className="rounded-full w-full">Salvar alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog prévia de upload com ponto focal / thumbnail de vídeo */}
        <Dialog open={showUploadPreview} onOpenChange={(open) => { if (!open) cancelUploadPreviews(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {pendingUploads[previewIndex]?.isVideo ? "Selecionar capa do vídeo" : "Posicionar foto"} {previewIndex + 1} de {pendingUploads.length}
              </DialogTitle>
              <DialogDescription>
                {pendingUploads[previewIndex]?.isVideo
                  ? "Arraste o vídeo até o frame desejado e clique em Capturar frame. Se não selecionar, será capturado automaticamente."
                  : "Toque na imagem para definir o ponto focal. As fotos serão exibidas inteiras, sem corte."}
              </DialogDescription>
            </DialogHeader>
            {pendingUploads[previewIndex] && (
              <div className="space-y-4">
                {pendingUploads[previewIndex].isVideo ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden bg-muted">
                      <video
                        ref={previewVideoRef}
                        src={pendingUploads[previewIndex].previewUrl}
                        className="w-full max-h-[260px] object-contain"
                        controls
                        muted
                        preload="metadata"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full rounded-full gap-2"
                      onClick={() => {
                        if (!previewVideoRef.current) return;
                        const dataUrl = captureVideoFrame(previewVideoRef.current);
                        if (dataUrl) {
                          setPendingUploads(prev => prev.map((p, i) =>
                            i === previewIndex ? { ...p, thumbnailDataUrl: dataUrl } : p
                          ));
                        }
                      }}
                    >
                      <Camera className="h-4 w-4" /> Capturar este frame como capa
                    </Button>
                    {pendingUploads[previewIndex].thumbnailDataUrl ? (
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <img
                          src={pendingUploads[previewIndex].thumbnailDataUrl!}
                          className="h-14 w-14 object-cover rounded-lg shrink-0 border"
                          alt="capa"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-green-700 dark:text-green-400">Frame selecionado!</p>
                          <button
                            className="text-xs text-muted-foreground underline"
                            onClick={() => setPendingUploads(prev => prev.map((p, i) => i === previewIndex ? { ...p, thumbnailDataUrl: null } : p))}
                          >
                            Remover e capturar automaticamente
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                        Nenhum frame selecionado — será capturado automaticamente ao enviar
                      </p>
                    )}
                  </div>
                ) : (
                  <FocalPointPicker
                    src={pendingUploads[previewIndex].previewUrl}
                    focalX={pendingUploads[previewIndex].focalX}
                    focalY={pendingUploads[previewIndex].focalY}
                    zoom={pendingUploads[previewIndex].zoom}
                    onChange={(x, y, z) => {
                      setPendingUploads(prev => prev.map((p, i) =>
                        i === previewIndex ? { ...p, focalX: x, focalY: y, zoom: z ?? p.zoom } : p
                      ));
                    }}
                  />
                )}
                <p className="text-xs text-muted-foreground text-center">
                  {pendingUploads[previewIndex].file.name}
                </p>
              </div>
            )}
            <DialogFooter className="flex gap-2 sm:gap-2">
              {pendingUploads.length > 1 && (
                <div className="flex gap-2 mr-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={previewIndex === 0}
                    onClick={() => setPreviewIndex(i => i - 1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={previewIndex === pendingUploads.length - 1}
                    onClick={() => setPreviewIndex(i => i + 1)}
                  >
                    Próxima <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
              <Button variant="ghost" onClick={cancelUploadPreviews} className="rounded-full">
                Cancelar
              </Button>
              <Button onClick={confirmUploadPreviews} className="rounded-full">
                <Upload className="h-4 w-4 mr-1" />
                Enviar {pendingUploads.length > 1 ? `${pendingUploads.length} arquivo(s)` : pendingUploads[0]?.isVideo ? "vídeo" : "foto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== DESTAQUES DA HOME (reorder) ===== */}
        {(() => {
          const destaques = fotos.filter(f => f.destaque_home).sort((a, b) => a.ordem - b.ordem);
          if (destaques.length === 0) return null;

          const swapOrdem = async (idx: number, direction: "up" | "down") => {
            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= destaques.length || !ensureWriteEnabled()) return;
            const a = destaques[idx];
            const b2 = destaques[swapIdx];
            try {
              await Promise.all([
                galleryAdmin({ action: "update-photo", id: a.id, updates: { ordem: b2.ordem } }),
                galleryAdmin({ action: "update-photo", id: b2.id, updates: { ordem: a.ordem } }),
              ]);
              toast.success("Ordem atualizada");
              await loadData();
            } catch (error) {
              handleActionError(error, "Erro ao reordenar destaques.");
            }
          };

          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wider">Destaques da Home</span>
                <span className="text-xs text-muted-foreground">({destaques.length} itens — arraste para reordenar)</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {destaques.map((item, idx) => {
                  const isVideo = getFotoTipo(item.url_foto) === "video";
                  return (
                    <div key={item.id} className="shrink-0 w-32 rounded-xl border-2 border-primary/30 bg-card overflow-hidden relative">
                      {/* Position number */}
                      <div className="absolute top-1 left-1 z-10 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                      {/* Type badge */}
                      {isVideo && (
                        <div className="absolute top-1 right-1 z-10">
                          <span className="bg-blue-600 text-white text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5">
                            <Play className="h-2 w-2" /> Vídeo
                          </span>
                        </div>
                      )}
                      {/* Thumbnail */}
                      {isVideo ? (
                        <video src={item.url_foto} className="w-full aspect-[3/4] object-contain bg-muted" muted preload="none" poster={decodeThumbnail(item.legenda) || undefined} />
                      ) : (
                        <img src={item.url_foto} alt={item.titulo} className="w-full aspect-[3/4] object-contain bg-muted" />
                      )}
                      {/* Reorder + unpin controls */}
                      <div className="flex items-center justify-between p-1.5 gap-0.5">
                        <button
                          onClick={() => swapOrdem(idx, "up")}
                          disabled={idx === 0}
                          className="h-6 w-6 flex items-center justify-center rounded bg-accent hover:bg-accent/80 disabled:opacity-30 transition-colors"
                          title="Mover para esquerda"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <p className="text-[9px] font-medium truncate flex-1 text-center">{item.titulo}</p>
                        <button
                          onClick={() => swapOrdem(idx, "down")}
                          disabled={idx === destaques.length - 1}
                          className="h-6 w-6 flex items-center justify-center rounded bg-accent hover:bg-accent/80 disabled:opacity-30 transition-colors"
                          title="Mover para direita"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => toggleDestaqueHome(item.id, true)}
                          className="h-6 w-6 flex items-center justify-center rounded bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground transition-colors ml-0.5"
                          title="Remover da home"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ===== MEDIA GRID ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredFotos.map((foto) => {
            const isSelected = selectedPhotos.has(foto.id);
            const isVideo = getFotoTipo(foto.url_foto) === "video";
            return (
              <div
                key={foto.id}
                className={`group rounded-xl border-2 bg-card overflow-hidden relative transition-all ${
                  selectionMode ? "cursor-pointer" : ""
                } ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"}`}
                onClick={() => selectionMode && toggleSelectPhoto(foto.id)}
              >
                {/* Selection checkbox */}
                {selectionMode && (
                  <div className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-card/90 backdrop-blur-sm border-muted-foreground/30"
                  }`}>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </div>
                )}

                {/* Status badges */}
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  {isVideo && (
                    <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Play className="h-2.5 w-2.5" /> Vídeo
                    </span>
                  )}
                  {foto.destaque_home && (
                    <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Pin className="h-2.5 w-2.5" /> Home
                    </span>
                  )}
                  {!foto.visivel && (
                    <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <EyeOff className="h-2.5 w-2.5" /> Oculto
                    </span>
                  )}
                </div>

                {/* Media preview */}
                {isVideo ? (
                  <div className="relative w-full aspect-[3/4] bg-muted flex items-center justify-center">
                    <video
                      src={foto.url_foto}
                      className={`w-full h-full object-contain ${!foto.visivel ? "opacity-50" : ""}`}
                      muted
                      preload="none"
                      poster={decodeThumbnail(foto.legenda) || undefined}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-[0_0_0_3px_rgba(255,255,255,0.4)]">
                        <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden">
                    <img
                      src={foto.url_foto}
                      alt={foto.titulo}
                      className={`w-full h-full object-contain transition-opacity ${!foto.visivel ? "opacity-50" : ""}`}
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Info + actions */}
                <div className="p-2 space-y-1.5">
                  <div>
                    <p className="text-[11px] font-semibold truncate">{foto.titulo}</p>
                    {foto.legenda && <p className="text-[10px] text-muted-foreground truncate">{decodeFocalPoint(foto.legenda).cleanLegenda}</p>}
                  </div>

                  {!selectionMode && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { 
                          const { cleanLegenda, focalX, focalY, zoom } = decodeFocalPoint(foto.legenda);
                          setEditingPhoto(foto); 
                          setEditPhotoTitle(foto.titulo); 
                          setEditPhotoCaption(cleanLegenda); 
                          setEditFocalX(focalX);
                          setEditFocalY(focalY);
                          setEditZoom(zoom);
                        }}
                        className="flex h-7 items-center gap-1 px-1.5 rounded-lg text-[10px] font-medium bg-accent hover:bg-accent/80 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 items-center gap-1 px-1.5 rounded-lg text-[10px] font-medium bg-accent hover:bg-accent/80 transition-colors">
                            <Move className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel className="text-xs">Mover para</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => movePhotoToAlbum(foto.id, null)} disabled={!foto.album_id}>
                            📂 Sem pasta
                          </DropdownMenuItem>
                          {albuns.map(a => (
                            <DropdownMenuItem
                              key={a.id}
                              onClick={() => movePhotoToAlbum(foto.id, a.id)}
                              disabled={foto.album_id === a.id}
                            >
                              📁 {a.nome}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <button
                        onClick={() => togglePhotoVisibility(foto.id, foto.visivel)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                          foto.visivel ? "bg-accent hover:bg-accent/80" : "bg-muted"
                        }`}
                      >
                        {foto.visivel ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                      </button>

                      {foto.album_id && !getFotoTipo(foto.url_foto).includes("video") && (() => {
                        const isCover = albuns.find(a => a.id === foto.album_id)?.capa_url === foto.url_foto;
                        return (
                          <button
                            onClick={() => setAlbumCover(foto.album_id!, foto.url_foto)}
                            className={`flex h-7 items-center gap-1 px-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                              isCover
                                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                : "bg-accent hover:bg-accent/80"
                            }`}
                            title={isCover ? "✅ Capa atual da pasta" : "Definir como capa da pasta"}
                          >
                            <Camera className="h-3 w-3" />
                            {isCover && <span>Capa</span>}
                          </button>
                        );
                      })()}

                      <button
                        onClick={() => toggleDestaqueHome(foto.id, !!foto.destaque_home)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                          foto.destaque_home ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"
                        }`}
                      >
                        <Pin className="h-3 w-3" />
                      </button>

                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent hover:bg-destructive hover:text-destructive-foreground transition-colors ml-auto"
                        onClick={() => {
                          if (window.confirm(`Apagar \"${foto.titulo}\"?`)) {
                            void deletePhoto(foto.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredFotos.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="flex justify-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <Video className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <p className="text-muted-foreground font-medium">
              {selectedAlbum ? "Nenhum item nesta pasta" : "Nenhum item na galeria"}
            </p>
            <p className="text-sm text-muted-foreground">
              Toque no botão acima para enviar suas primeiras fotos ou vídeos
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Gallery;
