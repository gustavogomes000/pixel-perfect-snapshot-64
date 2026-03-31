ALTER TABLE public.galeria_fotos
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'foto';

UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
] WHERE id = 'galeria';
