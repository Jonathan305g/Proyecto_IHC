-- Script de datos de desarrollo y prueba (Sprint 2 - S2-03)
-- Usability Test Dashboard con IA y Scrum - Grupo 6

BEGIN;

-- 1. Insertar miembros del equipo
INSERT INTO public.miembros (nombre, correo, activo) VALUES
('Pablo Lozada', 'pablo.lozada@epn.edu.ec', true),
('William Martínez', 'william.martinez@epn.edu.ec', true),
('Manuel Cusme', 'manuel.cusme@epn.edu.ec', true),
('Jonathan Gamboa', 'jonathan.gamboa@epn.edu.ec', true),
('Emilio Abril', 'emilio.abril@epn.edu.ec', true)
ON CONFLICT DO NOTHING;

-- 2. Insertar Planes de prueba de ejemplo
INSERT INTO public.planes (nombre, objetivo, estado) VALUES
('Prueba Usabilidad Portal E-commerce v1', 'Evaluar la efectividad del flujo de compra y la claridad de navegación en el prototipo.', 'activo'),
('Prueba Usabilidad App Móvil Registro', 'Verificar la tasa de éxito al completar el registro y recuperar contraseña.', 'borrador');

-- 3. Insertar Tareas asociadas al Plan 1
INSERT INTO public.tareas (plan_id, codigo, titulo, descripcion, criterio_exito, orden) VALUES
(1, 'T-01', 'Buscar Producto', 'Utilizar la barra de búsqueda para encontrar "Zapatos deportivos".', 'Encontrar el producto en menos de 30 segundos.', 1),
(1, 'T-02', 'Agregar al Carrito', 'Seleccionar talla 40 y añadir el producto al carrito de compras.', 'Producto visible en el carrito con la talla especificada.', 2),
(1, 'T-03', 'Completar Checkout', 'Ingresar datos de envío ficticios y seleccionar método de pago.', 'Llegar a la pantalla de confirmación de pedido.', 3);

-- 4. Insertar Participantes Anónimos
INSERT INTO public.participantes (codigo) VALUES
('PART-2026-001'),
('PART-2026-002'),
('PART-2026-003');

-- 5. Insertar Sesiones de prueba
INSERT INTO public.sesiones (plan_id, participante_id, estado, consentimiento_confirmado, iniciada_en, cerrada_en) VALUES
(1, 1, 'cerrada', true, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes'),
(1, 2, 'en_curso', true, NOW() - INTERVAL '15 minutes', NULL),
(1, 3, 'pendiente', false, NULL, NULL);

-- 6. Insertar Resultados de la Sesión 1
INSERT INTO public.resultados (plan_id, sesion_id, tarea_id, completada, duracion_segundos, cantidad_errores, observaciones) VALUES
(1, 1, 1, true, 25, 0, 'El usuario encontró el buscador rápidamente.'),
(1, 1, 2, true, 40, 1, 'Hubo una breve confusión con la selección del menú desplegable de talla.'),
(1, 1, 3, true, 110, 0, 'Completó el proceso sin inconvenientes.');

-- 7. Insertar Evidencias asociadas al Resultado
INSERT INTO public.evidencias (resultado_id, tipo, ruta, descripcion) VALUES
(2, 'imagen', 'storage/evidencias/sesion_1_tarea_2_error_talla.png', 'Captura de pantalla de la selección de talla fallida');

-- 8. Insertar Sprints de ejemplo
INSERT INTO public.sprints (nombre, objetivo, fecha_inicio, fecha_fin, estado) VALUES
('Sprint 2', 'Crear un plan, registrar una sesión, reanudarla, cerrarla y consultar sus evidencias.', '2026-10-01', '2026-10-15', 'activo'),
('Sprint 3', 'Indicadores comprobados, IA con errores controlados, revisión humana y backlog persistente.', '2026-10-16', '2026-10-30', 'planificado');

COMMIT;
