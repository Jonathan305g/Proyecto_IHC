# S2-07: pantalla de ejecución y cierre de sesiones

Ruta: `/sesiones/:id/ejecutar` (`src/pages/SessionRunPage.jsx`). Se llega desde **Sesiones → Continuar sesión**. Una sesión cerrada abre el mismo enlace como resumen de solo lectura.

## Qué hace

- Muestra instrucción, criterio de éxito y progreso («2 de 5 tareas registradas»).
- Cronómetro por tarea con iniciar, pausar/reanudar y reiniciar. El reinicio pide confirmación solo si ya hay tiempo medido.
- Captura resultado (sin ayuda, con ayuda, no completada), número de errores y observaciones.
- «Guardar avance» y «Guardar y continuar» envían la tarea al servidor; el estado de guardado, error o pérdida de conexión se comunica con texto.
- Copia local del borrador (`localStorage`, clave `ihc.sesion.<id>.borradores`): recargar o perder conexión no pierde lo escrito, incluido el cronómetro (se guarda con marcas de tiempo, no con un contador).
- Resumen antes del cierre. El botón «Cerrar sesión» queda deshabilitado mientras haya tareas sin registrar y pide confirmación.
- Una sesión con `cupo_completo: true` (campo opcional de la API) sigue pudiendo continuarse; el aviso solo indica que no se abrirá otra en ese plan.

## Contrato que consume (propuesto a S2-06, Manuel Cusme)

Las rutas de sesión existentes (`GET /api/sesiones`, `GET|PATCH /api/sesiones/:id`) no cambian. Se necesitan dos más:

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/sesiones/:id/resultados` | Lista los resultados guardados de la sesión |
| PUT | `/api/sesiones/:id/resultados/:tareaId` | Crea o reemplaza el resultado de **esa** tarea (idempotente: guardar dos veces no duplica) |

Cuerpo del PUT y elemento de la lista (la lista añade `tarea_id`, que el PUT toma de la ruta):

```json
{ "resultado": "con_ayuda", "tiempo_segundos": 61, "errores": 2, "observacion": "Dudó en el menú" }
```

- `resultado`: `sin_ayuda`, `con_ayuda` o `no_completado`.
- `tiempo_segundos` y `errores`: enteros ≥ 0. `observacion`: texto o `null`.
- Errores con el formato habitual `{ code, message, details }`. El mensaje se muestra tal cual al usuario.
- Cierre: `PATCH /api/sesiones/:id` con `{ "accion": "cerrar" }`. La pantalla ya impide cerrar con tareas pendientes, pero **el servidor debe repetir esa validación** (409 con un mensaje claro).

Referencia a evidencia (`evidencia_ref`) no se envía todavía: queda para la integración con S2-08.

## Pendiente de integración

El cierre de S2-07 depende de S2-06 (endpoints anteriores) y de S2-05 (plan guardado con el asistente). Hasta entonces la pantalla se verificó con una API simulada. Si S2-06 cambia nombres de campos o rutas, solo hay que ajustar `src/services/results.js` y `toResultPayload` en `src/domain/sessionRun.js`.

## Pruebas

`npm test` (en `frontend/`) ejecuta `test/sessionRun.test.js`: cronómetro, validación, carga útil, progreso, resumen y condición de cierre.
