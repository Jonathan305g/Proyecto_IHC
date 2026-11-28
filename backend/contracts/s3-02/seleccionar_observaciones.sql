-- Solo lectura y revisión en el servidor autorizado, ANTES de enviar a IA.
-- $1 plan BIGINT existente; $2 IDs de resultado BIGINT[] seleccionados, únicos.
-- S3-07 debe comparar la selección solicitada con las filas devueltas y rechazar
-- IDs ajenos, inexistentes o no elegibles; nunca analizar silenciosamente una parte.
-- observacion_original solo llega a una persona autorizada para revisar privacidad.
SELECT r.id::text AS resultado_id, r.plan_id::text AS plan_id,
  t.id::text AS tarea_id, t.titulo AS titulo_tarea, t.criterio_exito,
  CASE WHEN NOT r.completada THEN 'no_completado'
       WHEN r.con_ayuda THEN 'con_ayuda' ELSE 'sin_ayuda' END AS resultado,
  r.observaciones AS observacion_original,
  s.estado AS estado_sesion, s.consentimiento_confirmado
FROM public.resultados r
JOIN public.sesiones s ON (s.id,s.plan_id)=(r.sesion_id,r.plan_id)
JOIN public.tareas t ON (t.id,t.plan_id)=(r.tarea_id,r.plan_id)
WHERE r.plan_id=$1::bigint AND r.id=ANY($2::bigint[])
  AND s.estado='cerrada' AND s.consentimiento_confirmado IS TRUE
  AND s.iniciada_en IS NOT NULL AND s.cerrada_en IS NOT NULL
  AND s.cerrada_en >= s.iniciada_en
  AND r.completada IS NOT NULL AND nullif(btrim(r.observaciones),'') IS NOT NULL
ORDER BY r.id;
