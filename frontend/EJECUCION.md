# Ejecución y cierre de sesiones

Integración actual: S2-05, S2-06, S2-07 y S2-08 comparten el contrato de la [API](../backend/README.md).

Ruta `/sesiones/:id/ejecutar`: instrucciones y criterio de cada tarea, cronómetro con pausa/reanudación y reinicio confirmado, resultado, errores, observaciones y evidencias. El servidor guarda por tarea mediante PUT idempotente. Los borradores locales sobreviven a recargas y se conservan si falla el guardado.

Solo las evaluaciones completas cuentan para el progreso. Un registro base para evidencias no equivale a una evaluación. El resumen bloquea el cierre si faltan tareas o hay cambios sin guardar; el backend repite las comprobaciones del estado y consentimiento. Las sesiones cerradas se consultan como resumen y sus evidencias están disponibles en Resultados.

Las evidencias nuevas viven en un bucket privado compartido. Su apertura requiere autorización y genera una URL firmada temporal. Consulta el procedimiento de migración de archivos antiguos en [preparación del Sprint 3](../docs/PREPARACION_SPRINT_3.md).

Pruebas: `npm test` y `npm run test:e2e` desde `frontend`. El ensayo real con Supabase y otra máquina se realiza con la guía de preparación, sin atribuir resultados remotos a las pruebas controladas.
