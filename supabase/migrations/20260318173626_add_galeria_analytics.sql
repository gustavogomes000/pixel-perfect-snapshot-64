-- Table to track gallery interactions (photo views, video plays, video duration)
CREATE TABLE public.galeria_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_id uuid REFERENCES public.galeria_fotos(id) ON DELETE CASCADE NOT NULL,
  tipo_evento text NOT NULL, -- 'visualizacao' | 'play_video' | 'duracao_video'
  valor numeric DEFAULT NULL, -- for duracao_video: seconds watched
  cookie_visitante text,
  dispositivo text,
  navegador text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.galeria_analytics ENABLE ROW LEVEL SECURITY;

-- Public can insert analytics
CREATE POLICY "Inserir analytics publico"
  ON public.galeria_analytics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read analytics
CREATE POLICY "Admin le analytics"
  ON public.galeria_analytics
  FOR SELECT
  TO authenticated
  USING (eh_admin(auth.uid()) OR eh_admin_painel(auth.uid()));

-- Index for fast aggregation queries
CREATE INDEX idx_galeria_analytics_foto ON public.galeria_analytics(foto_id);
CREATE INDEX idx_galeria_analytics_tipo ON public.galeria_analytics(tipo_evento);
CREATE INDEX idx_galeria_analytics_criado ON public.galeria_analytics(criado_em);
