-- Datos ficticios para desarrollo; repetible sin duplicar registros.
BEGIN;
DO $$
DECLARE plan BIGINT; participante BIGINT; sesion BIGINT;
BEGIN
  SELECT id INTO plan FROM public.planes WHERE nombre = 'DEMO - Prueba de usabilidad' ORDER BY id LIMIT 1;
  IF plan IS NULL THEN
    INSERT INTO public.planes (nombre, objetivo, estado, cupo)
    VALUES ('DEMO - Prueba de usabilidad', 'Evaluar búsqueda y registro en un prototipo de ejemplo.', 'activo', 5)
    RETURNING id INTO plan;
  END IF;
  INSERT INTO public.tareas (plan_id, codigo, titulo, descripcion, criterio_exito, orden)
  VALUES (plan, 'DEMO-01', 'Buscar una opción', 'Encuentra la opción de registro.', 'Localiza el formulario sin ayuda.', 1),
         (plan, 'DEMO-02', 'Completar el formulario', 'Introduce datos ficticios y confirma.', 'Aparece la confirmación del registro.', 2)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.participantes (codigo) VALUES ('DEMO-P-001') ON CONFLICT DO NOTHING;
  SELECT id INTO participante FROM public.participantes WHERE codigo = 'DEMO-P-001';
  SELECT id INTO sesion FROM public.sesiones WHERE plan_id = plan AND participante_id = participante ORDER BY id LIMIT 1;
  IF sesion IS NULL THEN
    INSERT INTO public.sesiones (plan_id, participante_id, estado, consentimiento_confirmado, iniciada_en, cerrada_en)
    VALUES (plan, participante, 'cerrada', true, NOW() - INTERVAL '10 minutes', NOW()) RETURNING id INTO sesion;
  END IF;
  INSERT INTO public.resultados (plan_id, sesion_id, tarea_id, completada, con_ayuda, duracion_segundos, cantidad_errores, observaciones)
  SELECT plan, sesion, id, true, false, 30, 0, 'Dato ficticio de desarrollo.' FROM public.tareas WHERE plan_id = plan
  ON CONFLICT DO NOTHING;
  -- No registrar rutas de archivos que no existen.
END $$;
COMMIT;
