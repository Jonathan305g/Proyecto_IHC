# S4-05 - Vistas de review y retrospectiva

Responsable: Emilio Abril. HU-10. Requiere S4-03 y S4-04.
Desde el tablero abrir Review y retrospectiva, `/sprints/:id/cierre?plan_id=ID`.

La vista consulta el mismo detalle y puntos del tablero. Propone entregas y
pendientes por ID de historia, permite comentarios, dificultades, aspectos
positivos y acuerdos con accion/responsable/fecha/estado. Guardar borrador
persiste sin cerrar. Se informa guardado, cambios pendientes y errores.
Los fallos conservan el formulario y no declaran un cierre exitoso.

Cerrar requiere guardar primero y confirmacion en dialogo con foco y Escape.
Si hay historias incompletas se solicita un motivo del retorno al backlog.
El resultado cerrado es de consulta; el servidor conserva el snapshot.
No se mezclan porcentajes por tareas con puntos de historias entregadas.

Pruebas Chromium: comentarios y acuerdos al recargar, bloqueo por cambios
sin guardar, cancelar cierre, confirmar, recuperar cerrado y fallo de red.
