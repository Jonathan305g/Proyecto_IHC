BEGIN;
-- Diario operativo S3-07. No modifica hallazgos ni historias (S3-08/S3-09).
-- Las ejecuciones anteriores conservan NULL y no se procesan mediante esta API.
ALTER TABLE public.analisis_ia
  ADD COLUMN IF NOT EXISTS solicitud_id UUID,
  ADD COLUMN IF NOT EXISTS ejecucion JSONB,
  ADD COLUMN IF NOT EXISTS revision_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bloqueo UUID,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_analisis_ia_solicitud
  ON public.analisis_ia(plan_id, solicitud_id);
-- Respaldo al bloqueo transaccional del plan, también entre procesos NestJS.
CREATE UNIQUE INDEX IF NOT EXISTS uq_analisis_ia_plan_en_curso
  ON public.analisis_ia(plan_id) WHERE bloqueo IS NOT NULL;
COMMIT;
