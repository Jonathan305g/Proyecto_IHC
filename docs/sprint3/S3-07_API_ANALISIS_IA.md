# S3-07 — API de análisis con IA y sus estados

Fecha: 18/11/2026 (America/Guayaquil). Responsable: Manuel Cusme. HU-06.
Rama: `feature/s3-07-api-analisis-ia-manuel`. Integración prevista: `develop`.

## Objetivo y alcance

Analizar observaciones seleccionadas mediante `ProveedorIA`/`ProveedorIaModule`
de S3-03, usando íntegramente el contrato 1.0 y el SQL de elegibilidad de S3-02.
La ejecución es HTTP síncrona: la petición espera a que terminen los grupos.
Otra petición puede consultar el avance guardado. No hay colas, tareas en memoria,
workers ni respuestas 202 que prometan procesamiento posterior.

Se separan preparación, revisión de privacidad y ejecución para cumplir S3-02:
una bandera enviada al ejecutar no acredita una revisión. La persona autorizada
consulta los textos preparados, elimina datos personales también en título y
criterio, y realiza la acción explícita `PUT .../revision`. La API registra en una
transacción los textos concretos revisados y `revision_en`. Esto es una declaración
humana autorizada; el servidor no puede demostrar que se leyó cada texto ni detectar
todos los nombres/direcciones. No equivale a aprobar propuestas de la IA.

La aplicación mantiene su modelo de equipo compartido: `AuthGuard` global exige
Supabase Auth, correo confirmado y `AUTH_ALLOWED_EMAILS`. Todos los miembros
autorizados pueden consultar/revisar los mismos planes. No se inventan propietarios
por plan ni se confía en identidades aportadas por el cliente. La revisión registra
fecha y contenido, sin añadir una auditoría individual de usuarios al AuthGuard.

## Arquitectura y persistencia mínima

- `analisis.controller.ts`: cinco rutas bajo `/api/planes/:planId/analisis-ia`,
  siguiendo el anidamiento por plan de indicadores y tareas.
- `analisis.dto.ts`: valida selección, revisión y cuerpos vacíos; utiliza las
  utilidades existentes y `comprobarSeleccion`.
- `analisis.service.ts`: obtiene las fuentes desde PostgreSQL, prepara la revisión,
  coordina el adaptador, valida cada respuesta y confirma el avance por grupo.
- `analisis.types.ts`: tipos del diario y cálculo del estado agregado.
- `analisis.module.ts`: importa `DatabaseModule` y `ProveedorIaModule`.

Aplicar **también en instalaciones nuevas**, después del esquema base:

`backend/migrations/20261118000000_s3_07_ejecuciones_ia.sql`.

Es una migración repetible y aditiva sobre `public.analisis_ia`, cuya restricción
de estados ya contiene los estados necesarios. Incorpora `solicitud_id`,
`ejecucion` JSONB, `revision_en`, `bloqueo` y `bloqueado_hasta`. No ejecuta DDL al
arrancar. Conserva RLS existente, sin políticas públicas; utiliza la conexión
privilegiada del backend detrás de AuthGuard.

El diario guarda IDs exactos, huella SHA-256 de las fuentes, solicitudes canónicas
revisadas/versionadas y resultados/metadatos/errores por grupo. No copia tokens,
participantes, sesiones ni evidencias. El texto original permanece en `resultados`;
el diario conserva la versión redactada/revisada usada por el proveedor. La huella
no se expone por HTTP. Revisar/ejecutar/reintentar vuelve a comprobar elegibilidad
y huella: cambios posteriores exigen una nueva preparación. Consultar un análisis
finalizado conserva su versión histórica sin volver a analizar.

Este diario es persistencia **operativa de S3-07**, necesaria para recuperar
consultas y reintentos. No escribe en `hallazgos` ni `historias`. S3-08 debe consumir
solo `grupos[].respuesta` válidas, conservar categoría/severidad y todos los orígenes
N:M, y persistir propuestas pendientes de revisión humana. S3-09/S3-10 conservan
la aprobación explícita, creación de historias y backlog. No se altera su esquema
ni se implementa esa funcionalidad por adelantado. Los registros antiguos con
`ejecucion IS NULL` no son operables mediante esta API y responden 404.

## Endpoints y ejemplos

Todas las rutas exigen `Authorization: Bearer <access_token>`. IDs BIGINT positivos
en cadenas decimales, sin pérdida por encima de 2^53. Cuerpos JSON estrictos, sin
campos desconocidos; no se aceptan solicitudes canónicas ni modos del proveedor
en las rutas de ejecución.

| Método | Ruta relativa a `/api/planes/:planId/analisis-ia` | Operación |
|---|---|---|
| POST | `/` | Preparar selección desde BD, sin llamar a IA. 201 |
| GET | `/:analisisId` | Consultar revisión, grupos, resultados y avance. 200 |
| PUT | `/:analisisId/revision` | Confirmar textos revisados antes de ejecutar. 200 |
| POST | `/:analisisId/ejecutar` | Ejecutar grupos pendientes, una sola vez. 200/422/503 |
| POST | `/:analisisId/reintentar` | Reintentar solo fallidos con intentos disponibles. 200/422/503 |

### 1. Preparar selección

`POST /api/planes/101/analisis-ia`

```json
{"solicitud_id":"dca14dc7-a4d5-4ea4-8714-e81d348392b1","resultado_ids":["1","2"]}
```

El cliente genera un UUID v4 y lo conserva para repetir esta misma petición si
pierde su respuesta. La combinación plan/UUID identifica una preparación: repetir
IDs en otro orden recupera el mismo registro; usar el UUID con otros IDs da 409.
Una nueva selección/revisión tras cambios de origen requiere otro UUID.

Se admiten 1..100 resultados únicos; se ordenan por BIGINT y se dividen en grupos
estables de hasta 50. Cada grupo mantiene los límites de tamaño de S3-02 (128 KiB
de entrada, 256 KiB de salida). No se altera el límite global JSON existente de
Nest/Express (100 KiB): una revisión extensa puede recibir 413 y debe prepararse
en selecciones más pequeñas. No se truncan textos ni se reduce una selección
silenciosamente.

SQL S3-02 exige mismo plan/tarea/sesión, evaluación presente, observación no vacía,
sesión cerrada, consentimiento y fechas coherentes. La selección incompleta se
rechaza entera antes de llamar al proveedor. Identidad, relaciones, resultado y
textos iniciales se obtienen de BD. La redacción de identificadores directos de
S3-02 se aplica al contexto mínimo antes de devolverlo para revisión.

### 2. Revisar privacidad

Tras leer `grupos[].solicitud.observaciones` devueltos por POST/GET, la persona
autorizada confirma **toda** la selección. Se permiten correcciones de texto para
privacidad; siempre son datos no confiables para el modelo, nunca instrucciones
system. No pueden cambiar IDs de tarea, plan o resultado, ni la evaluación.

`PUT /api/planes/101/analisis-ia/7/revision`

```json
{
  "observaciones": [
    {"resultado_id":"1","texto":"La confirmación pasó desapercibida.","titulo_tarea":"Guardar","criterio_exito":"Reconocer confirmación"},
    {"resultado_id":"2","texto":"Se necesitó ayuda para volver.","titulo_tarea":"Volver","criterio_exito":null}
  ]
}
```

Solo admite los cuatro campos mostrados, IDs únicos y exactamente los originales.
No admite textos vacíos, `privacidad_revisada`, `aprobado`, identidades o relaciones
adicionales. El servidor combina los textos con su snapshot, aplica
`prepararSolicitud` y guarda `revision_en`. Se permite corregir la revisión mientras
el análisis siga pendiente. Tras iniciarse, se preserva la versión analizada.

### 3. Ejecutar, consultar o reintentar

```text
POST /api/planes/101/analisis-ia/7/ejecutar    cuerpo: {}
GET  /api/planes/101/analisis-ia/7
POST /api/planes/101/analisis-ia/7/reintentar  cuerpo: {}
```

Ejemplo **ilustrativo**, sin atribuirlo a una llamada real a Gemini:

```json
{
  "id":"7","plan_id":"101","solicitud_id":"dca14dc7-a4d5-4ea4-8714-e81d348392b1",
  "estado":"completado","revision_en":"2026-11-18T15:00:00.000Z",
  "iniciado_en":"2026-11-18T14:59:00.000Z","terminado_en":"2026-11-18T15:00:01.000Z",
  "max_intentos":3,
  "grupos":[{
    "id":"1","estado":"completado","intentos":1,"reintentable":false,
    "solicitud":{"version":"1.0","plan_id":"101","observaciones":[
      {"id":"resultado:1","tarea":{"id":"1001","titulo":"Guardar","criterio_exito":null},"resultado":"con_ayuda","texto":"La confirmación pasó desapercibida."}
    ]},
    "respuesta":{"version":"1.0","estado":"borrador","hallazgos":[
      {"observacion_ids":["resultado:1"],"resumen":"La confirmación no fue reconocida.","categoria":"retroalimentacion","severidad":"media","mejora_sugerida":"Mostrar un mensaje visible."}
    ],"observaciones_sin_hallazgo":[]},
    "meta":{"estado":"completado","modo":"gemini","proveedor":"gemini","modelo":"gemini-configurado","intentos":1}
  }]
}
```

El ejemplo de respuesta representa una selección de una fuente, independiente de
los ejemplos de preparación/revisión de dos fuentes. `iniciado_en` corresponde a
la creación del registro; `revision_en` a su última revisión y `terminado_en` al
último ciclo concluido. Los metadatos `meta` los genera el adaptador y permanecen
fuera de `respuesta`. El modo demo conserva `meta.modo='demo'` y su advertencia:
no analiza ni descarta problemas y no se activa como fallback.

## Estados, validación y fallos parciales

| Estado persistido/API | Significado |
|---|---|
| `pendiente` | Selección preparada, aún no ejecutada; puede faltar revisión |
| `procesando` | En curso, reserva activa y grupos pendientes de confirmar |
| `completado` | Todos los grupos tienen respuesta válida, incluso sin hallazgos |
| `parcial` | Parcialmente fallido: al menos un grupo válido y otro fallido |
| `fallido` | Ningún grupo obtuvo una respuesta válida |

Transiciones: `pendiente → procesando → completado/parcial/fallido`;
`parcial/fallido → procesando → completado/parcial/fallido` mediante reintento.
Un corte deja `procesando` hasta vencer la reserva y recuperarse por consulta o
por la siguiente ejecución del plan. El estado del proceso nunca sustituye el
`estado='borrador'` de `respuesta`.

Cada grupo se valida atómicamente con `validarRespuesta`: JSON, estructura,
campos obligatorios, enums, privacidad evidente, IDs originales, cobertura y
ausencia de propuestas exactamente repetidas. No se repara JSON ni se acepta
una fracción de una respuesta inválida. Solo después se confirma ese grupo.
Los grupos válidos permanecen disponibles aunque falle otro. No se fusionan los
arrays en un supuesto contrato de más de 50 fuentes: cada respuesta conserva su
solicitud canónica exacta.

## Reintentos, concurrencia e interrupciones

Máximo tres reservas de ejecución por grupo: intento inicial y dos reintentos
manuales. Se reservan los intentos de los grupos elegidos antes de enviar; una
caída puede consumir un intento de un grupo todavía no enviado. Los reintentos
internos de S3-03 son independientes (`meta.intentos`, máximo tres envíos por
llamada al adaptador). No se repiten automáticamente grupos tras timeout/red.

`reintentar` elige únicamente `fallido` con `intentos < 3`. No agrega otra copia
de una respuesta aceptada: actualiza el mismo grupo. Repetir ejecutar/reintentar
un análisis completado devuelve lo guardado sin invocar al proveedor. Ejecutar
un análisis parcial/fallido exige usar la ruta de reintento. Si no quedan grupos
reintentables, devuelve 409. `reintentable` indica disponibilidad de intentos; no
garantiza que la configuración/cuota o la elegibilidad se hayan corregido.

La reserva se adquiere en una transacción corta con `SELECT ... FOR UPDATE` sobre
el plan y un índice único parcial que impide dos reservas activas para el mismo
plan, incluso desde otro proceso. La llamada remota no mantiene abierta esa
transacción. Cada avance compara UUID de reserva y fecha de vigencia al actualizar.
Un proceso antiguo no puede sobrescribir un reintento posterior.

La reserva vence a los 270 segundos: dos grupos con el presupuesto máximo de
S3-03 de 120 segundos cada uno, más 30 segundos de margen. Al consultar una reserva
vencida o ejecutar otra del mismo plan, los grupos todavía `procesando` pasan a
fallidos con `IA_EJECUCION_INTERRUMPIDA`; los completados se conservan. No se
reenvía nada en GET. Antes de vencer, un servidor reiniciado devuelve el último
estado en curso: el cliente debe consultar después y decidir el reintento.

Si el cliente pierde conexión pero el proceso continúa, el servicio continúa la
ejecución síncrona y guarda el avance; el cliente consulta el ID conocido. Si el
servidor o la BD falla, solo se garantiza conservar lo ya confirmado en PostgreSQL.
Una respuesta recibida remotamente pero no confirmada localmente puede volver a
consumir cuota al reintentar; no se promete exactamente una llamada remota.
No hay recuperación automática en segundo plano. El proxy HTTP debe permitir el
presupuesto de la operación o el cliente debe recuperar el resultado por GET.

## Errores HTTP y seguridad

Se conserva `ApiErrorFilter` y el formato `{code,message,details}`.

| HTTP / code | Uso |
|---|---|
| 400 / `INVALID_REQUEST` | Cuerpo, IDs, selección, elegibilidad o revisión inválidos |
| 401 / `UNAUTHORIZED` | Token ausente/vencido |
| 403 / `FORBIDDEN` | Correo no autorizado o sin confirmar |
| 404 / `NOT_FOUND` | Plan/análisis inexistente, ajeno al plan o registro anterior sin diario |
| 409 / `CONFLICT` | UUID reutilizado con otros IDs, fuente modificada, concurrencia, estado o límite de intentos |
| 413 / `PAYLOAD_TOO_LARGE` | Límite JSON de transporte existente |
| 422 / `HTTP_ERROR` | Todos los grupos fallaron por respuesta/contrato inválido |
| 503 / `SERVICE_UNAVAILABLE` | Ningún grupo válido y hay fallo operativo/configuración/proveedor |
| 500 / `INTERNAL_ERROR` | Fallo interno/BD, mensaje genérico sin traza |

Una ejecución parcial responde 200 con `estado='parcial'` y los errores por grupo.
Una ejecución totalmente fallida confirma el diario antes de devolver 422/503:

```json
{
  "code":"SERVICE_UNAVAILABLE",
  "message":"No se obtuvo ningún grupo válido. Consulta el análisis antes de reintentar.",
  "details":[{"field":"analisis_id","value":"7"},{"field":"grupos.1","rule":"IA_TIEMPO_AGOTADO"}]
}
```

Los códigos IA específicos se conservan en `details[].rule` o `grupos[].error.code`.
Los errores de grupo tienen mensajes fijos y no reproducen el JSON inválido ni
mensajes privados del proveedor. Configuración ausente, proveedor deshabilitado,
red, timeout, cuota, disponibilidad, bloqueos y contrato inválido usan los códigos
controlados de S3-03/S3-02. Excepciones inesperadas del adaptador se convierten en
`IA_ERROR_PROVEEDOR`. No se registran observaciones, claves ni respuestas brutas.
Todas las respuestas conservan `Cache-Control: no-store` y `nosniff` existentes.

## Configuración y verificación

No hay dependencias nuevas. Se conserva Node >=22.12, PostgreSQL, Auth y la
configuración S3-03: `IA_MODE`, `GEMINI_API_KEY`, `IA_MODEL`, `IA_TIMEOUT_MS`,
`IA_TOTAL_TIMEOUT_MS`, `IA_MAX_RETRIES`, `IA_MAX_OUTPUT_TOKENS` exclusivamente en
backend. Consulta [proveedor S3-03](S3-03_PROVEEDOR_IA.md).

```powershell
npm test
node --test backend/test/s3-07-*.test.cjs
npm run build
npm run test:e2e --prefix frontend
npm run verify:ai --prefix backend -- --demo
npm run verify:ai --prefix backend -- --live
git diff --check
```

Antes del ensayo real, configura un `.env` privado con `IA_MODE=gemini` y clave
válida. El script existente envía una sola observación ficticia mediante el
adaptador S3-03 y muestra metadatos seguros. No acredita por sí solo HTTP/Auth/BD
remotos. No se suben `.env`, claves ni salidas con datos privados.
Resultados de esta entrega: [S3-07_VERIFICACION.md](S3-07_VERIFICACION.md).
