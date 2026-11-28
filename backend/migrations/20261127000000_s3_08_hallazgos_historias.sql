BEGIN;
-- Conservar datos anteriores; el diario S3-07 debe estar instalado primero.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='analisis_ia' AND column_name='ejecucion') THEN
    RAISE EXCEPTION 'Aplicar primero la migracion S3-07';
  END IF;
END $$;
ALTER TABLE public.planes ADD COLUMN IF NOT EXISTS backlog_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.hallazgos
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(30) NOT NULL DEFAULT 'otro',
  ADD COLUMN IF NOT EXISTS severidad VARCHAR(10) NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS criterio_aceptacion TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grupo_id VARCHAR(30),
  ADD COLUMN IF NOT EXISTS indice_propuesta INTEGER,
  ADD COLUMN IF NOT EXISTS propuesta_ia JSONB;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='hallazgos_clasificacion_s308') THEN
    ALTER TABLE public.hallazgos ADD CONSTRAINT hallazgos_clasificacion_s308 CHECK (
      categoria IN ('navegacion','comprension','accesibilidad','retroalimentacion','eficiencia','prevencion_errores','contenido','otro')
      AND severidad IN ('baja','media','alta','critica') AND version > 0);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hallazgos_id_plan ON public.hallazgos(id,plan_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hallazgos_propuesta ON public.hallazgos(analisis_id,grupo_id,indice_propuesta);

CREATE TABLE IF NOT EXISTS public.hallazgo_observaciones (
  hallazgo_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  resultado_id BIGINT NOT NULL,
  texto_original TEXT NOT NULL,
  texto_revisado TEXT NOT NULL,
  tarea_titulo TEXT NOT NULL,
  PRIMARY KEY(hallazgo_id,resultado_id),
  FOREIGN KEY(hallazgo_id,plan_id) REFERENCES public.hallazgos(id,plan_id),
  FOREIGN KEY(resultado_id,plan_id) REFERENCES public.resultados(id,plan_id)
);
CREATE INDEX IF NOT EXISTS idx_hallazgo_observaciones_hallazgo_plan ON public.hallazgo_observaciones(hallazgo_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_hallazgo_observaciones_resultado_plan ON public.hallazgo_observaciones(resultado_id,plan_id);
ALTER TABLE public.hallazgo_observaciones ENABLE ROW LEVEL SECURITY;
-- Incorporar el origen unico de hallazgos legados sin alterar su decision.
INSERT INTO public.hallazgo_observaciones(hallazgo_id,plan_id,resultado_id,texto_original,texto_revisado,tarea_titulo)
  SELECT h.id,h.plan_id,r.id,coalesce(r.observaciones,''),coalesce(r.observaciones,''),t.titulo
  FROM public.hallazgos h JOIN public.resultados r ON (r.id,r.plan_id)=(h.resultado_id,h.plan_id)
  JOIN public.tareas t ON t.id=r.tarea_id
  ON CONFLICT(hallazgo_id,resultado_id) DO NOTHING;

ALTER TABLE public.historias
  ADD COLUMN IF NOT EXISTS plan_id BIGINT REFERENCES public.planes(id),
  ADD COLUMN IF NOT EXISTS orden INTEGER,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS solicitud_id UUID,
  ADD COLUMN IF NOT EXISTS solicitud_huella VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_historias_solicitud ON public.historias(plan_id,solicitud_id);
UPDATE public.historias s SET plan_id=h.plan_id FROM public.hallazgos h
  WHERE s.hallazgo_id=h.id AND s.plan_id IS NULL;
WITH posiciones AS (SELECT id,row_number() OVER(PARTITION BY plan_id ORDER BY creada_en,id)::int AS n FROM public.historias)
UPDATE public.historias h SET orden=p.n FROM posiciones p WHERE h.id=p.id AND h.orden IS NULL;
ALTER TABLE public.historias ALTER COLUMN orden SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='historias_hallazgo_plan_s308') THEN
    ALTER TABLE public.historias ADD CONSTRAINT historias_hallazgo_plan_s308
      FOREIGN KEY(hallazgo_id,plan_id) REFERENCES public.hallazgos(id,plan_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='historias_orden_plan_s308') THEN
    ALTER TABLE public.historias ADD CONSTRAINT historias_orden_plan_s308 UNIQUE(plan_id,orden) DEFERRABLE INITIALLY DEFERRED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='historias_version_orden_s308') THEN
    ALTER TABLE public.historias ADD CONSTRAINT historias_version_orden_s308 CHECK(version>0 AND orden>0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_historias_hallazgo_plan ON public.historias(hallazgo_id,plan_id);

-- Una historia vinculada nueva exige hallazgo aprobado, incluso ante escrituras SQL.
CREATE OR REPLACE FUNCTION public.validar_historia_revisada_s308() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hallazgo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.hallazgos WHERE id=NEW.hallazgo_id AND plan_id=NEW.plan_id AND estado='aprobado'
  ) THEN RAISE EXCEPTION 'La historia requiere un hallazgo aprobado del mismo plan' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS historias_revision_s308 ON public.historias;
CREATE TRIGGER historias_revision_s308 BEFORE INSERT OR UPDATE OF hallazgo_id,plan_id ON public.historias
  FOR EACH ROW EXECUTE FUNCTION public.validar_historia_revisada_s308();
CREATE OR REPLACE FUNCTION public.proteger_hallazgo_aprobado_s308() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado<>'aprobado' AND EXISTS(SELECT 1 FROM public.historias WHERE hallazgo_id=OLD.id)
    THEN RAISE EXCEPTION 'Un hallazgo con historia no puede descartarse' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hallazgos_revision_s308 ON public.hallazgos;
CREATE TRIGGER hallazgos_revision_s308 BEFORE UPDATE OF estado ON public.hallazgos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_hallazgo_aprobado_s308();
COMMIT;
