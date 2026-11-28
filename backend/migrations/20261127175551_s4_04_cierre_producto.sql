BEGIN;
CREATE TABLE IF NOT EXISTS public.producto_cierres(
 sprint_id BIGINT PRIMARY KEY REFERENCES public.producto_sprints(id),
 entregas TEXT NOT NULL DEFAULT '',pendientes TEXT NOT NULL DEFAULT '',observaciones TEXT NOT NULL DEFAULT '',
 aspectos_positivos TEXT NOT NULL DEFAULT '',dificultades TEXT NOT NULL DEFAULT '',
 guardado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),cerrado_en TIMESTAMPTZ,
 instantanea JSONB
);
CREATE TABLE IF NOT EXISTS public.producto_acuerdos(
 id UUID PRIMARY KEY,sprint_id BIGINT NOT NULL,plan_id BIGINT NOT NULL,
 accion TEXT NOT NULL CHECK(length(btrim(accion))>0),responsable_id BIGINT NOT NULL,
 fecha_compromiso DATE NOT NULL,completado BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(sprint_id,plan_id) REFERENCES public.producto_sprints(id,plan_id),
 FOREIGN KEY(responsable_id,plan_id) REFERENCES public.producto_responsables(id,plan_id)
);
CREATE INDEX IF NOT EXISTS idx_producto_acuerdos_sprint_plan ON public.producto_acuerdos(sprint_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_producto_acuerdos_responsable_plan ON public.producto_acuerdos(responsable_id,plan_id);
ALTER TABLE public.producto_cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_acuerdos ENABLE ROW LEVEL SECURITY;
COMMIT;
