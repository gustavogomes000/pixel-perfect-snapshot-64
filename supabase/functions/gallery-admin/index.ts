import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// External Supabase project credentials
const EXT_URL = Deno.env.get("EXT_SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXT_SERVICE_KEY = Deno.env.get("EXT_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

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

      // ── DELETE photo ──
      case "delete-photo": {
        const { id } = body;
        const { data, error } = await ext.from("galeria_fotos").delete().eq("id", id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          return json({ success: false, error: "Item não encontrado ou já foi removido." }, 404);
        }
        return json({ success: true, deleted: data.length });
      }

      // ── BULK DELETE photos ──
      case "bulk-delete": {
        const { ids } = body;
        const { data, error } = await ext.from("galeria_fotos").delete().in("id", ids).select();
        if (error) throw error;
        return json({ success: true, deleted: data?.length || 0 });
      }

      // ── UPDATE photo ──
      case "update-photo": {
        const { id, updates } = body;
        const { data, error } = await ext.from("galeria_fotos").update(updates).eq("id", id).select();
        if (error) throw error;
        return json({ success: true, data: data?.[0] });
      }

      // ── BULK UPDATE photos ──
      case "bulk-update": {
        const { ids, updates } = body;
        const results = [];
        for (const id of ids) {
          const { error } = await ext.from("galeria_fotos").update(updates).eq("id", id);
          if (!error) results.push(id);
        }
        return json({ success: true, updated: results.length });
      }

      // ── INSERT photo ──
      case "insert-photo": {
        const { photo } = body;
        const { data, error } = await ext.from("galeria_fotos").insert(photo).select();
        if (error) throw error;
        return json({ success: true, data: data?.[0] });
      }

      // ── INSERT multiple photos ──
      case "insert-photos": {
        const { photos } = body;
        const { data, error } = await ext.from("galeria_fotos").insert(photos).select();
        if (error) throw error;
        return json({ success: true, data, count: data?.length || 0 });
      }

      // ── MOVE photo to album ──
      case "move-photo": {
        const { id, album_id } = body;
        const { error } = await ext.from("galeria_fotos").update({ album_id }).eq("id", id);
        if (error) throw error;
        return json({ success: true });
      }

      // ── Album CRUD ──
      case "create-album": {
        const { nome } = body;
        const { data, error } = await ext.from("albuns").insert({ nome }).select();
        if (error) throw error;
        return json({ success: true, data: data?.[0] });
      }

      case "update-album": {
        const { id, ...rest } = body;
        // Remove action from the updates
        const { action: _a, ...updates } = rest;
        const { error } = await ext.from("albuns").update(updates).eq("id", id);
        if (error) throw error;
        return json({ success: true });
      }

      case "delete-album": {
        const { id } = body;
        // Move photos to no-album first
        await ext.from("galeria_fotos").update({ album_id: null }).eq("album_id", id);
        const { error } = await ext.from("albuns").delete().eq("id", id);
        if (error) throw error;
        return json({ success: true });
      }

      case "reorder-albums": {
        const { updates } = body; // [{ id, ordem }]
        for (const u of updates) {
          await ext.from("albuns").update({ ordem: u.ordem }).eq("id", u.id);
        }
        return json({ success: true });
      }

      // ── Ensure schema (idempotent) ──
      case "ensure-schema": {
        // Use the Supabase SQL API to add the column
        const sqlRes = await fetch(`${EXT_URL}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EXT_SERVICE_KEY,
            "Authorization": `Bearer ${EXT_SERVICE_KEY}`,
          },
          body: JSON.stringify({ sql: "ALTER TABLE public.albuns ADD COLUMN IF NOT EXISTS fixado_home boolean NOT NULL DEFAULT false;" }),
        });
        
        if (!sqlRes.ok) {
          // exec_sql RPC doesn't exist, try the pg_query approach via /pg endpoint
          // Fall back to checking if column exists
          const { error: checkErr } = await ext.from("albuns").select("fixado_home" as any).limit(1);
          if (checkErr && checkErr.message?.includes("fixado_home")) {
            return json({ 
              success: false, 
              error: "Coluna fixado_home não existe. Execute no SQL Editor do Supabase: ALTER TABLE public.albuns ADD COLUMN IF NOT EXISTS fixado_home boolean NOT NULL DEFAULT false;", 
              needsManualMigration: true 
            });
          }
          // Column exists already or error is about something else
          return json({ success: true, note: "Column already exists or check passed" });
        }
        return json({ success: true });
      }

      // ── Config ──
      case "update-config": {
        const { chave, valor } = body;
        const { error } = await ext.from("configuracoes").update({ valor }).eq("chave", chave);
        if (error) throw error;
        return json({ success: true });
      }

      // ── Create signed upload URL ──
      case "create-upload-url": {
        const { path: filePath } = body;
        const CLOUD_URL = Deno.env.get("SUPABASE_URL")!;
        const CLOUD_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const cloudClient = createClient(CLOUD_URL, CLOUD_SERVICE_KEY);
        const { data, error } = await cloudClient.storage.from("galeria").createSignedUploadUrl(filePath);
        if (error) throw error;
        return json({ success: true, signedUrl: data.signedUrl, token: data.token, path: data.path });
      }

      // ── Test data ──
      case "delete-test-photos": {
        const { urls } = body;
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
