# API NestJS

Consulta [README principal](../README.md), [BD](../database/README.md) y [activación previa al Sprint 3](../docs/PREPARACION_SPRINT_3.md).

## Ejecución

Node.js >= 22.12. Desde `backend`: `npm ci`, copia `.env.example` a `.env`, configura PostgreSQL, Auth y Storage, aplica las migraciones y ejecuta `npm run dev`. Producción: `npm run build` y `node --env-file=.env dist/main.js` (o inyecta las variables desde el proveedor).

TLS PostgreSQL exige certificados válidos cuando `DATABASE_SSL=true`. `DATABASE_CA_CERT` permite una CA PEM con saltos `\n`. Ninguna clave secreta debe enviarse a React.

## Contrato HTTP

Prefijo `/api`. **Todas las rutas requieren `Authorization: Bearer <access_token>`**, verificado con Supabase Auth y correo confirmado incluido en `AUTH_ALLOWED_EMAILS`. Es una aplicación compartida por un equipo; todos los miembros autorizados acceden al mismo conjunto de planes.

| Método | Ruta | Operación |
|---|---|---|
| GET / POST | `/planes` | Listar / crear plan y tareas en transacción |
| GET / PATCH | `/planes/:id` | Consultar / actualizar plan |
| POST | `/planes/:id/tareas` | Agregar tarea |
| PATCH | `/planes/:id/tareas/:tareaId` | Editar tarea |
| GET / POST | `/sesiones` | Listar / crear sesión |
| GET / PATCH | `/sesiones/:id` | Detalle / iniciar, continuar, cerrar |
| GET | `/sesiones/:id/resultados` | Evaluaciones y registros base de evidencias |
| PUT | `/sesiones/:id/resultados/:tareaId` | Guardado idempotente de evaluación |
| POST / GET | `/sesiones/:id/resultados/:tareaId/evidencias` | Adjuntar archivo/enlace / listar |
| GET | `/sesiones/:id/evidencias` | Evidencias de la sesión |
| GET / DELETE | `/evidencias/:id` | Metadatos / eliminar en sesión editable |
| GET | `/evidencias/:id/acceso` | JSON `{ url }`: enlace externo validado o descarga firmada 60 s |
| GET | `/evidencias/:id/archivo` | Redirección compatible; también requiere token |

IDs BIGINT se intercambian como cadenas. Los cuerpos se validan sin coerciones de objetos ni campos desconocidos. Errores `{ code, message, details }`, con 400 para datos inválidos, 401/403 para acceso, 404 inexistente, 409 conflicto, 413 archivo excesivo, 503 servicio/configuración no disponible y 500 para errores internos sin revelar secretos.

### Plan y tareas

```json
{"nombre":"Prueba de registro","objetivo":"Comprobar claridad","cupo":5,"tareas":[{"titulo":"Registrarse","descripcion":"Completa el formulario","criterio_exito":"Aparece confirmación","codigo":"T-01","orden":1}]}
```

Estados de plan: `borrador`, `activo`, `finalizado`. `cupo` positivo o `null`; cuenta todas las sesiones creadas y no puede reducirse por debajo de ellas. Las tareas se congelan después del primer inicio de sesión para conservar la evaluación histórica. Para evaluar tareas distintas, crea otro plan.

### Sesiones

- Alta manual pendiente: `{"plan_id":"1","codigo_participante":"P-001"}`.
- Alta anónima con código generado e inicio: `{"plan_id":"1","consentimiento_confirmado":true}`. No mezclar ambos contratos.
- PATCH inicio: `{"accion":"iniciar","consentimiento_confirmado":true}`; continuación: `{"accion":"continuar"}`; cierre: `{"accion":"cerrar"}`.
- Estados `pendiente → en_curso → cerrada`. Cierre exige al menos una tarea y resultados completos de todas. Una tarea evaluada como no completada sí cuenta como registrada.

### Resultados

```json
{"resultado":"con_ayuda","tiempo_segundos":61,"errores":2,"observacion":"Confusión en el menú"}
```

`resultado`: `sin_ayuda`, `con_ayuda`, `no_completado`. Tiempo y errores: enteros no negativos. Se conserva el contrato alternativo `completada`, `con_ayuda`, `duracion_segundos`, `cantidad_errores`, `observaciones`. La consulta expone ambos nombres. Un registro con resultado nulo solo asocia evidencias y no completa una evaluación.

### Evidencias

Archivo multipart en campo `archivo`, descripción opcional; o JSON `{"tipo":"enlace","ruta":"https://example.com","descripcion":null}`. Formatos: PNG/JPEG/WebP/GIF, MP4/WebM/MOV, MP3/WAV/OGG/M4A, PDF/TXT. 15 MB por archivo. Se exige coherencia entre extensión, MIME y firma. Modificación solo en sesión en curso con consentimiento; consulta también en cerradas. Archivos nuevos se suben a Storage privado. No existe un directorio local de archivos nuevos.

El borrado guarda una orden en `storage_deletions` antes de eliminar metadatos; el mantenimiento reintenta los fallos de Storage. Comandos: `npm run storage:cleanup`; `npm run storage:migrate` para inspección y `npm run storage:migrate -- --apply` para migrar originales locales.

## Pruebas

`npm test` incluye compilación, HTTP con servicios externos controlados y esquema/servicios contra PostgreSQL embebido. El ensayo contra Supabase real se describe en la guía de preparación y requiere la configuración del equipo.
