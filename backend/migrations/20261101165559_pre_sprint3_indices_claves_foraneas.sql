BEGIN;
-- Índices de apoyo para las ocho claves foráneas detectadas en Supabase.
-- Repetible: conserva los registros y los índices existentes.
CREATE INDEX IF NOT EXISTS idx_acuerdos_responsable ON public.acuerdos_retrospectiva(responsable_id);
CREATE INDEX IF NOT EXISTS idx_acuerdos_retrospectiva ON public.acuerdos_retrospectiva(retrospectiva_id);
CREATE INDEX IF NOT EXISTS idx_analisis_ia_plan ON public.analisis_ia(plan_id);
CREATE INDEX IF NOT EXISTS idx_hallazgos_analisis_plan ON public.hallazgos(analisis_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_hallazgos_resultado_plan ON public.hallazgos(resultado_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_historias_responsable ON public.historias(responsable_id);
CREATE INDEX IF NOT EXISTS idx_resultados_sesion_plan ON public.resultados(sesion_id,plan_id);
CREATE INDEX IF NOT EXISTS idx_resultados_tarea_plan ON public.resultados(tarea_id,plan_id);
COMMIT;
