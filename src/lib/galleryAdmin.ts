/**
 * Helper to call the gallery-admin edge function
 * for all write operations (delete, update, insert) that need service role access.
 */
const CLOUD_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const CLOUD_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const BASE_URL = `https://${CLOUD_PROJECT_ID}.supabase.co/functions/v1/gallery-admin`;

export async function galleryAdmin(body: Record<string, unknown>): Promise<{ success: boolean; error?: string; status?: number; [key: string]: unknown }> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": CLOUD_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  let data: { success?: boolean; error?: string; [key: string]: unknown } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Erro na operação (${res.status})`);
  }

  return { ...data, status: res.status, success: true };
}
