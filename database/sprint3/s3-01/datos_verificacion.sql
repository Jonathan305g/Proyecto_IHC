-- EXCLUSIVO para PostgreSQL vacío y desechable. El test configura esta guarda.
DO $$ BEGIN
  IF current_setting('ihc.s301_fixture', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Use el ejecutor de pruebas S3-01 sobre una BD desechable';
  END IF;
END $$;

INSERT INTO public.planes (id, nombre, objetivo, estado) OVERRIDING SYSTEM VALUE VALUES
 (101, 'Referencia S3-01', 'Verificar cálculos manuales', 'activo'),
 (202, 'Otro plan', 'Comprobar aislamiento', 'finalizado'),
 (303, 'Plan sin tareas', 'Comprobar vacío', 'borrador');
INSERT INTO public.tareas (id, plan_id, codigo, titulo, descripcion, orden) OVERRIDING SYSTEM VALUE VALUES
 (1001,101,'T1','Buscar','Localizar una opción',1),
 (1002,101,'T2','Guardar','Guardar un cambio',2),
 (1003,101,'T3','Salir','Finalizar el recorrido',3),
 (2001,202,'T1','Otra búsqueda','Otra evaluación',1);
INSERT INTO public.participantes (id,codigo) OVERRIDING SYSTEM VALUE
 SELECT n, 'S301-' || n FROM generate_series(1,9) n;
INSERT INTO public.sesiones (id,plan_id,participante_id,estado,consentimiento_confirmado,iniciada_en,cerrada_en)
 OVERRIDING SYSTEM VALUE VALUES
 (1101,101,1,'cerrada',true,'2026-10-20T09:00:00Z','2026-10-20T10:00:00Z'),
 (1102,101,2,'cerrada',true,'2026-10-20T11:00:00Z','2026-10-20T12:00:00Z'),
 (1103,101,3,'cerrada',true,'2026-10-20T23:00:00Z','2026-10-21T00:00:00Z'),
 (1104,101,4,'en_curso',true,'2026-10-20T09:00:00Z',null),
 (1105,101,5,'cerrada',false,'2026-10-20T09:00:00Z','2026-10-20T10:00:00Z'),
 (1106,101,6,'cerrada',true,'2026-11-01T09:00:00Z','2026-11-01T10:00:00Z'),
 (1107,101,7,'pendiente',false,null,null),
 (1108,101,8,'cerrada',true,null,null),
 (2201,202,9,'cerrada',true,'2026-10-20T09:00:00Z','2026-10-20T10:00:00Z');
INSERT INTO public.resultados (id,plan_id,sesion_id,tarea_id,completada,con_ayuda,duracion_segundos,cantidad_errores)
 OVERRIDING SYSTEM VALUE VALUES
 (1,101,1101,1001,true,false,30,0),
 (2,101,1101,1002,true,true,60,2),
 (3,101,1102,1001,false,false,90,3),
 (4,101,1102,1002,true,false,null,0),
 (5,101,1102,1003,null,false,null,0),
 (6,101,1103,1001,true,true,50,1),
 (7,101,1103,1002,true,false,0,0),
 (8,101,1104,1001,true,false,999,99),
 (9,101,1105,1001,true,false,888,88),
 (10,101,1106,1001,true,false,777,77),
 (11,101,1108,1001,true,false,666,66),
 (12,202,2201,2001,false,false,0,0);
-- Dos evidencias de un mismo resultado: no deben duplicar ninguna métrica.
INSERT INTO public.evidencias (resultado_id,tipo,ruta) VALUES
 (1,'enlace','https://example.org/referencia-1'),
 (1,'enlace','https://example.org/referencia-2');
