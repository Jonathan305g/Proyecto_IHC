# S4-04 - Review y retrospectiva del producto

Responsable: Pablo Lozada. HU-10. Requiere S4-02.
La migracion agrega producto_cierres y producto_acuerdos con RLS e indices de FK.
No utiliza ni sobrescribe acuerdos del equipo academico.

Prefijo `/api/planes/:planId/sprints-producto/:id`:
- GET cierre: detalle del sprint, avance real, revision, acuerdos e instantanea.
- PUT cierre: version, entregas, pendientes, observaciones, aspectos_positivos,
  dificultades, acuerdos [{id UUID v4,accion,responsable_id,fecha_compromiso,completado}].
- POST cerrar: version, confirmacion:true y motivo_pendientes.

Borradores admiten textos vacios. Los acuerdos creados tienen accion, responsable
activo del mismo plan y fecha real no anterior al inicio. Edicion completa con
version; repetir un acuerdo usa su ID estable, sin duplicarlo. Guardar reemplaza
la lista del borrador, siempre dentro de una transaccion.

Cerrar requiere sprint activo, review y retrospectiva completas y al menos un
acuerdo. Las historias incompletas exigen motivo y vuelven al backlog pendientes,
conservando tareas, estados y puntos del sprint en su historial. Las terminadas
permanecen entregadas. Se libera el compromiso para otro sprint. La instantanea
conserva la revision y responsables del cierre aunque cambien los alias despues.
El cierre es atomico, inmutable e idempotente; no se elimina trabajo pendiente.

Instalar con migrate-sprint4.cjs --apply despues de compilar backend.
Pruebas HTTP/SQL: borrador, edicion, fecha, aislamiento, acuerdos, puntos reales,
rollback ante fallo, cierre repetido, retorno al backlog y snapshot recuperable.
