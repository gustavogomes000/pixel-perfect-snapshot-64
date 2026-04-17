import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// External Supabase project credentials
const EXT_URL = Deno.env.get("EXT_SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXT_SERVICE_KEY = Deno.env.get("EXT_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

// Allowed fields for safety (prevent injection of arbitrary columns)
const ALLOWED_PHOTO_FIELDS = new Set(["titulo", "legenda", "url_foto", "album_id", "visivel", "ordem", "destaque_home"]);
const ALLOWED_ALBUM_FIELDS = new Set(["nome", "descricao", "capa_url", "ordem", "fixado_home"]);

function sanitizeFields(obj: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (allowed.has(key)) result[key] = val;
  }
  return result;
}

function getExtClient() {
  return createClient(EXT_URL, EXT_SERVICE_KEY);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!action || typeof action !== "string") {
      return json({ success: false, error: "Missing or invalid 'action'" }, 400);
    }

    // Validate service role key for write operations
    const isWriteAction = action !== "debug";
    if (isWriteAction && !EXT_SERVICE_KEY?.startsWith("eyJ")) {
      return json({ success: false, error: "Service role key inválida. Atualize EXT_SUPABASE_SERVICE_ROLE_KEY com a chave JWT (começa com 'eyJ...')." }, 403);
    }

    const ext = getExtClient();

    switch (action) {
      // ── DEBUG: check connectivity ──
      case "debug": {
        const keyPrefix = EXT_SERVICE_KEY?.substring(0, 10) || "MISSING";
        const { data, error } = await ext.from("galeria_fotos").select("id").limit(1);
        return json({ 
          success: true, 
          keyPrefix,
          keyIsServiceRole: EXT_SERVICE_KEY?.startsWith("eyJ") || false,
          urlSet: !!EXT_URL,
          canRead: !error, 
          readError: error?.message || null,
          rowCount: data?.length || 0 
        });
      }

      // ── DELETE photo (idempotent: nunca falha se já removida) ──
      case "delete-photo": {
        const { id } = body;
        if (!id || typeof id !== "string") return json({ success: false, error: "Missing 'id'" }, 400);
        const { data, error } = await ext.from("galeria_fotos").delete().eq("id", id).select();
        if (error) throw error;
        return json({ success: true, deleted: data?.length || 0 });
      }

      // ── BULK DELETE photos ──
      case "bulk-delete": {
        const { ids } = body;
        if (!Array.isArray(ids) || ids.length === 0) return json({ success: false, error: "Missing 'ids' array" }, 400);
        if (ids.length > 100) return json({ success: false, error: "Max 100 items per bulk delete" }, 400);
        const { data, error } = await ext.from("galeria_fotos").delete().in("id", ids).select();
        if (error) throw error;
        return json({ success: true, deleted: data?.length || 0 });
      }

      // ── UPDATE photo ──
      case "update-photo": {
        const { id, updates } = body;
        if (!id || typeof id !== "string") return json({ success: false, error: "Missing 'id'" }, 400);
        if (!updates || typeof updates !== "object") return json({ success: false, error: "Missing 'updates'" }, 400);
        const safe = sanitizeFields(updates, ALLOWED_PHOTO_FIELDS);
        if (Object.keys(safe).length === 0) return json({ success: false, error: "No valid fields to update" }, 400);
        const { data, error } = await ext.from("galeria_fotos").update(safe).eq("id", id).select();
        if (error) throw error;
        return json({ success: true, data: data?.[0] });
      }

      // ── BULK UPDATE photos (single query instead of N queries) ──
      case "bulk-update": {
        const { ids, updates } = body;
        if (!Array.isArray(ids) || ids.length === 0) return json({ success: false, error: "Missing 'ids'" }, 400);
        if (ids.length > 100) return json({ success: false, error: "Max 100 items per bulk update" }, 400);
        if (!updates || typeof updates !== "object") return json({ success: false, error: "Missing 'updates'" }, 400);
        const safe = sanitizeFields(updates, ALLOWED_PHOTO_FIELDS);
        if (Object.keys(safe).length === 0) return json({ success: false, error: "No valid fields" }, 400);
        const { data, error } = await ext.from("galeria_fotos").update(safe).in("id", ids).select("id");
        if (error) throw error;
        return json({ success: true, updated: data?.length || 0 });
      }

      // ── INSERT photo ──
      case "insert-photo": {
        const { photo } = body;
        if (!photo || typeof photo !== "object") return json({ success: false, error: "Missing 'photo'" }, 400);
        const safe = sanitizeFields(photo, ALLOWED_PHOTO_FIELDS);
        if (!safe.titulo || !safe.url_foto) return json({ success: false, error: "Missing titulo or url_foto" }, 400);
        const { data, error } = await ext.from("galeria_fotos").insert(safe).select();
        if (error) throw error;
        return json({ success: true, data: data?.[0] });
      }

      // ── INSERT multiple photos (batch) ──
      case "insert-photos": {
        const { photos } = body;
        if (!Array.isArray(photos) || photos.length === 0) return json({ success: false, error: "Missing 'photos' array" }, 400);
        if (photos.length > 50) return json({ success: false, error: "Max 50 photos per batch" }, 400);
        const safePhotos = photos.map((p: Record<string, unknown>) => sanitizeFields(p, ALLOWED_PHOTO_FIELDS));
        const { data, error } = await ext.from("galeria_fotos").insert(safePhotos).select();
        if (error) throw error;
        return json({ success: true, data, count: data?.length || 0 });
      }

      // ── MOVE photo to album ──
      case "move-photo": {
        const { id, album_id } = body;
        if (!id) return json({ success: false, error: "Missing 'id'" }, 400);
        const { error } = await ext.from("galeria_fotos").update({ album_id: album_id || null }).eq("id", id);
        if (error) throw error;
        return json({ success: true });
      }

      // ── Album CRUD ──
      case "create-album": {
        const { nome } = body;
        if (!nome || typeof nome !== "string" || nome.trim().length === 0) return json({ success: false, error: "Missing 'nome'" }, 400);
        const { data, error } = await ext.from("albuns").insert({ nome: nome.trim() }).select();
        if (error) throw error;
        return json({ success: true, data: data?.[0] });
      }

      case "update-album": {
        const { id, ...rest } = body;
        if (!id || typeof id !== "string") return json({ success: false, error: "Missing 'id'" }, 400);
        const { action: _a, ...rawUpdates } = rest;
        const safe = sanitizeFields(rawUpdates, ALLOWED_ALBUM_FIELDS);
        if (Object.keys(safe).length === 0) return json({ success: false, error: "No valid fields to update" }, 400);
        const { error } = await ext.from("albuns").update(safe).eq("id", id);
        if (error) throw error;
        return json({ success: true });
      }

      case "delete-album": {
        const { id } = body;
        if (!id || typeof id !== "string") return json({ success: false, error: "Missing 'id'" }, 400);
        await ext.from("galeria_fotos").update({ album_id: null }).eq("album_id", id);
        const { error } = await ext.from("albuns").delete().eq("id", id);
        if (error) throw error;
        return json({ success: true });
      }

      case "reorder-albums": {
        const { updates } = body;
        if (!Array.isArray(updates)) return json({ success: false, error: "Missing 'updates' array" }, 400);
        for (const u of updates) {
          if (u.id && typeof u.ordem === "number") {
            await ext.from("albuns").update({ ordem: u.ordem }).eq("id", u.id);
          }
        }
        return json({ success: true });
      }

      // ── Config ──
      case "update-config": {
        const { chave, valor } = body;
        if (!chave || typeof chave !== "string") return json({ success: false, error: "Missing 'chave'" }, 400);
        // Only allow specific config keys
        const allowedKeys = new Set(["galeria_ativa"]);
        if (!allowedKeys.has(chave)) return json({ success: false, error: "Config key not allowed" }, 403);
        const { error } = await ext.from("configuracoes").update({ valor }).eq("chave", chave);
        if (error) throw error;
        return json({ success: true });
      }

      // ── Create signed upload URL ──
      case "create-upload-url": {
        const { path: filePath } = body;
        if (!filePath || typeof filePath !== "string") return json({ success: false, error: "Missing 'path'" }, 400);
        // Validate path to prevent directory traversal
        if (filePath.includes("..") || filePath.startsWith("/")) {
          return json({ success: false, error: "Invalid path" }, 400);
        }
        const CLOUD_URL = Deno.env.get("SUPABASE_URL")!;
        const CLOUD_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const cloudClient = createClient(CLOUD_URL, CLOUD_SERVICE_KEY);
        const { data, error } = await cloudClient.storage.from("galeria").createSignedUploadUrl(filePath);
        if (error) throw error;
        return json({ success: true, signedUrl: data.signedUrl, token: data.token, path: data.path });
      }

      // ── Batch create signed upload URLs (reduce round-trips) ──
      case "create-upload-urls": {
        const { paths } = body;
        if (!Array.isArray(paths) || paths.length === 0) return json({ success: false, error: "Missing 'paths' array" }, 400);
        if (paths.length > 200) return json({ success: false, error: "Max 200 paths" }, 400);
        for (const p of paths) {
          if (typeof p !== "string" || p.includes("..") || p.startsWith("/")) {
            return json({ success: false, error: `Invalid path: ${p}` }, 400);
          }
        }
        const CLOUD_URL = Deno.env.get("SUPABASE_URL")!;
        const CLOUD_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const cloudClient = createClient(CLOUD_URL, CLOUD_SERVICE_KEY);
        const results = await Promise.all(
          paths.map(async (p: string) => {
            const { data, error } = await cloudClient.storage.from("galeria").createSignedUploadUrl(p, { upsert: true });
            if (error) return { path: p, error: error.message };
            return { path: p, signedUrl: data.signedUrl, token: data.token };
          })
        );
        return json({ success: true, urls: results });
      }

      // ── Test data ──
      case "delete-test-photos": {
        const { urls } = body;
        if (!Array.isArray(urls)) return json({ success: false, error: "Missing 'urls'" }, 400);
        const { data, error } = await ext.from("galeria_fotos").delete().in("url_foto", urls).select();
        if (error) throw error;
        return json({ success: true, deleted: data?.length || 0 });
      }

      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("[gallery-admin] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
