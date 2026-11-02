-- Contrato S3-01 v1.0. Solo SELECT; no crea funciones, vistas ni permisos.
-- $1 plan BIGINT; $2 desde TIMESTAMPTZ inclusivo o NULL;
-- $3 hasta TIMESTAMPTZ exclusivo o NULL; $4 tareas BIGINT[] o NULL (todas).
WITH parametros AS (
  SELECT $1::bigint AS plan_id, $2::timestamptz AS desde,
         $3::timestamptz AS hasta, $4::bigint[] AS tarea_ids
), validacion AS (
  SELECT p.*, CASE
    WHEN p.plan_id IS NULL OR p.plan_id <= 0 THEN 'PLAN_INVALIDO'
    WHEN NOT EXISTS (SELECT 1 FROM public.planes WHERE id = p.plan_id) THEN 'PLAN_INEXISTENTE'
    WHEN p.desde IS NOT NULL AND p.hasta IS NOT NULL AND p.desde >= p.hasta THEN 'PERIODO_INVALIDO'
    WHEN p.tarea_ids IS NOT NULL AND cardinality(p.tarea_ids) = 0 THEN 'TAREAS_VACIAS'
    WHEN p.tarea_ids IS NOT NULL AND (
      cardinality(p.tarea_ids) <> (SELECT count(DISTINCT id) FROM unnest(p.tarea_ids) AS ids(id))
      OR EXISTS (SELECT 1 FROM unnest(p.tarea_ids) AS ids(id)
        WHERE NOT EXISTS (SELECT 1 FROM public.tareas t WHERE t.id = ids.id AND t.plan_id = p.plan_id))
    ) THEN 'TAREA_INVALIDA'
    ELSE NULL END AS error_filtro
  FROM parametros p
), tareas_filtradas AS (
  SELECT t.id, t.codigo, t.titulo FROM public.tareas t CROSS JOIN validacion p
  WHERE p.error_filtro IS NULL AND t.plan_id = p.plan_id
    AND (p.tarea_ids IS NULL OR t.id = ANY(p.tarea_ids))
), sesiones_filtradas AS (
  SELECT s.id FROM public.sesiones s CROSS JOIN validacion p
  WHERE p.error_filtro IS NULL AND s.plan_id = p.plan_id
    AND s.estado = 'cerrada' AND s.consentimiento_confirmado IS TRUE
    AND s.iniciada_en IS NOT NULL AND s.cerrada_en IS NOT NULL
    AND s.cerrada_en >= s.iniciada_en
    AND (p.desde IS NULL OR s.cerrada_en >= p.desde)
    AND (p.hasta IS NULL OR s.cerrada_en < p.hasta)
), base AS MATERIALIZED (
  -- Un par esperado por sesión/tarea. Las evidencias nunca multiplican filas.
  SELECT t.id AS tarea_id, s.id AS sesion_id,
    CASE WHEN r.completada IS TRUE AND r.con_ayuda IS FALSE THEN 'sin_ayuda'
         WHEN r.completada IS TRUE AND r.con_ayuda IS TRUE THEN 'con_ayuda'
         WHEN r.completada IS FALSE AND r.con_ayuda IS FALSE THEN 'no_completado'
         ELSE NULL END AS resultado,
    r.duracion_segundos, r.cantidad_errores
  FROM tareas_filtradas t CROSS JOIN sesiones_filtradas s
  LEFT JOIN public.resultados r ON r.sesion_id = s.id AND r.tarea_id = t.id
    AND r.plan_id = (SELECT plan_id FROM parametros)
), cobertura AS (
  SELECT GROUPING(tarea_id) AS general, tarea_id, count(*)::int AS esperados,
    count(resultado)::int AS evaluados,
    count(*) FILTER (WHERE resultado IS NULL)::int AS pendientes
  FROM base GROUP BY GROUPING SETS ((), (tarea_id))
), medidas AS (
  SELECT GROUPING(tarea_id) AS general, tarea_id, resultado,
    count(*)::int AS cantidad, count(duracion_segundos)::int AS n_tiempo,
    sum(duracion_segundos) AS tiempo_total,
    round(avg(duracion_segundos), 2) AS tiempo_promedio,
    count(cantidad_errores)::int AS n_errores,
    sum(cantidad_errores) AS errores_total,
    round(avg(cantidad_errores), 2) AS errores_promedio
  FROM base WHERE resultado IS NOT NULL
  GROUP BY GROUPING SETS ((resultado), (tarea_id, resultado))
), ambitos AS (
  SELECT 1 AS general, NULL::bigint AS tarea_id, NULL::text AS codigo, NULL::text AS titulo
  UNION ALL SELECT 0, id, codigo, titulo FROM tareas_filtradas
), grupos AS (
  SELECT a.general, a.tarea_id, a.codigo, a.titulo,
    coalesce(c.esperados, 0) AS esperados, coalesce(c.evaluados, 0) AS evaluados,
    coalesce(c.pendientes, 0) AS pendientes,
    round(100.0 * c.evaluados / nullif(c.esperados, 0), 2) AS cobertura_porcentaje,
    jsonb_object_agg(categoria.nombre, jsonb_build_object(
      'cantidad', coalesce(m.cantidad, 0),
      'porcentaje', round(100.0 * coalesce(m.cantidad, 0) / nullif(c.evaluados, 0), 2),
      'tiempo', jsonb_build_object('n', coalesce(m.n_tiempo, 0),
        'total_segundos', m.tiempo_total, 'promedio_segundos', m.tiempo_promedio),
      'errores', jsonb_build_object('n', coalesce(m.n_errores, 0),
        'total', m.errores_total, 'promedio', m.errores_promedio)
    )) AS por_resultado
  FROM ambitos a CROSS JOIN (VALUES ('sin_ayuda'), ('con_ayuda'), ('no_completado')) categoria(nombre)
  LEFT JOIN cobertura c ON c.general = a.general AND c.tarea_id IS NOT DISTINCT FROM a.tarea_id
  LEFT JOIN medidas m ON m.general = a.general AND m.tarea_id IS NOT DISTINCT FROM a.tarea_id
    AND m.resultado = categoria.nombre
  GROUP BY a.general, a.tarea_id, a.codigo, a.titulo, c.esperados, c.evaluados, c.pendientes
), indicadores AS (
  SELECT general, tarea_id, codigo, titulo, jsonb_build_object(
    'esperados', esperados, 'evaluados', evaluados, 'pendientes', pendientes,
    'cobertura_porcentaje', cobertura_porcentaje, 'por_resultado', por_resultado
  ) AS datos FROM grupos
)
SELECT jsonb_build_object(
  'version', '1.0', 'filtro_valido', v.error_filtro IS NULL, 'error_filtro', v.error_filtro,
  'filtros', jsonb_build_object('plan_id', v.plan_id::text, 'desde', v.desde, 'hasta', v.hasta,
    'tarea_ids', CASE WHEN v.tarea_ids IS NULL THEN NULL ELSE
      (SELECT jsonb_agg(x.id::text ORDER BY x.id) FROM unnest(v.tarea_ids) x(id)) END),
  'sesiones_incluidas', CASE WHEN v.error_filtro IS NULL THEN (SELECT count(*) FROM sesiones_filtradas) END,
  'tareas_seleccionadas', CASE WHEN v.error_filtro IS NULL THEN (SELECT count(*) FROM tareas_filtradas) END,
  'general', CASE WHEN v.error_filtro IS NULL THEN (SELECT datos FROM indicadores WHERE general = 1) END,
  'por_tarea', CASE WHEN v.error_filtro IS NULL THEN coalesce((
    SELECT jsonb_agg(datos || jsonb_build_object('tarea_id', tarea_id::text, 'codigo', codigo, 'titulo', titulo)
      ORDER BY tarea_id) FROM indicadores WHERE general = 0
  ), '[]'::jsonb) ELSE '[]'::jsonb END
) AS reporte FROM validacion v;
