BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='historias' AND column_name='solicitud_huella')
 THEN RAISE EXCEPTION 'Aplicar primero S3-08'; END IF;
END $$;
-- Modulo del producto: no reutiliza los sprints ni acuerdos del equipo academico.
CREATE TABLE IF NOT EXISTS public.producto_responsables(
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 plan_id BIGINT NOT NULL REFERENCES public.planes(id),
 alias VARCHAR(120) NOT NULL CHECK(length(btrim(alias))>0),
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 solicitud_id UUID NOT NULL,
 UNIQUE(id,plan_id), UNIQUE(plan_id,solicitud_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_responsable_alias ON public.producto_responsables(plan_id,lower(alias));
CREATE TABLE IF NOT EXISTS public.producto_sprints(
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 plan_id BIGINT NOT NULL REFERENCES public.planes(id),
 nombre VARCHAR(100) NOT NULL, objetivo TEXT NOT NULL,
 fecha_inicio DATE NOT NULL,fecha_fin DATE NOT NULL CHECK(fecha_fin>=fecha_inicio),
 capacidad INTEGER NOT NULL CHECK(capacidad BETWEEN 0 AND 10000),
 estado VARCHAR(20) NOT NULL DEFAULT 'planificado' CHECK(estado IN ('planificado','activo','cerrado')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 solicitud_id UUID NOT NULL,solicitud_huella VARCHAR(64) NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(id,plan_id),UNIQUE(plan_id,solicitud_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_historias_id_plan_producto ON public.historias(id,plan_id);
CREATE TABLE IF NOT EXISTS public.producto_sprint_historias(
 sprint_id BIGINT NOT NULL,historia_id BIGINT NOT NULL,plan_id BIGINT NOT NULL,
 responsable_id BIGINT,
 titulo VARCHAR(180) NOT NULL,descripcion TEXT NOT NULL,criterio_aceptacion TEXT,
 puntos INTEGER NOT NULL CHECK(puntos BETWEEN 1 AND 100),orden INTEGER NOT NULL CHECK(orden>0),
 estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_progreso','en_revision','terminada')),
 comprometida BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY(sprint_id,historia_id),
 FOREIGN KEY(sprint_id,plan_id) REFERENCES public.producto_sprints(id,plan_id),
 FOREIGN KEY(historia_id,plan_id) REFERENCES public.historias(id,plan_id),
 FOREIGN KEY(responsable_id,plan_id) REFERENCES public.producto_responsables(id,plan_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_historia_comprometida_producto ON public.producto_sprint_historias(historia_id) WHERE comprometida;
CREATE INDEX IF NOT EXISTS idx_producto_sh_sprint_plan ON public.producto_sprint_historias(sprint_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_producto_sh_historia_plan ON public.producto_sprint_historias(historia_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_producto_sh_responsable_plan ON public.producto_sprint_historias(responsable_id,plan_id);
CREATE TABLE IF NOT EXISTS public.producto_sprint_tareas(
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 sprint_id BIGINT NOT NULL,historia_id BIGINT NOT NULL,plan_id BIGINT NOT NULL,
 titulo VARCHAR(240) NOT NULL,responsable_id BIGINT NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_progreso','en_revision','terminada')),
 solicitud_id UUID NOT NULL,solicitud_huella VARCHAR(64) NOT NULL,
 FOREIGN KEY(sprint_id,historia_id) REFERENCES public.producto_sprint_historias(sprint_id,historia_id),
 FOREIGN KEY(sprint_id,plan_id) REFERENCES public.producto_sprints(id,plan_id),
 FOREIGN KEY(responsable_id,plan_id) REFERENCES public.producto_responsables(id,plan_id),
 UNIQUE(sprint_id,solicitud_id)
);
CREATE INDEX IF NOT EXISTS idx_producto_tareas_historia ON public.producto_sprint_tareas(sprint_id,historia_id);
CREATE INDEX IF NOT EXISTS idx_producto_tareas_plan ON public.producto_sprint_tareas(sprint_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_producto_tareas_responsable ON public.producto_sprint_tareas(responsable_id,plan_id);
CREATE TABLE IF NOT EXISTS public.producto_sprint_eventos(
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 sprint_id BIGINT NOT NULL REFERENCES public.producto_sprints(id),
 accion VARCHAR(50) NOT NULL,detalle JSONB NOT NULL,
 registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_producto_eventos_sprint ON public.producto_sprint_eventos(sprint_id);
ALTER TABLE public.producto_responsables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_sprint_historias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_sprint_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_sprint_eventos ENABLE ROW LEVEL SECURITY;
-- El backlog no puede invalidar estimaciones ni estados de un compromiso abierto.
CREATE OR REPLACE FUNCTION public.producto_proteger_compromiso() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE estado_sprint TEXT;
BEGIN
 SELECT sh.estado INTO estado_sprint FROM public.producto_sprint_historias sh WHERE sh.historia_id=OLD.id AND sh.comprometida;
 IF FOUND THEN
  IF NEW.puntos IS DISTINCT FROM OLD.puntos OR NEW.titulo IS DISTINCT FROM OLD.titulo
    OR NEW.descripcion IS DISTINCT FROM OLD.descripcion OR NEW.criterio_aceptacion IS DISTINCT FROM OLD.criterio_aceptacion
    OR NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
   RAISE EXCEPTION 'La historia esta comprometida en un sprint abierto' USING ERRCODE='23514';
  END IF;
  IF NEW.estado IS DISTINCT FROM (CASE WHEN estado_sprint='en_revision' THEN 'en_progreso' ELSE estado_sprint END) THEN
   RAISE EXCEPTION 'El estado se gestiona desde el tablero del sprint' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS producto_compromiso_historia ON public.historias;
CREATE TRIGGER producto_compromiso_historia BEFORE UPDATE ON public.historias FOR EACH ROW EXECUTE FUNCTION public.producto_proteger_compromiso();
COMMIT;
