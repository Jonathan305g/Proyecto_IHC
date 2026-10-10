# Backend: contratos, persistencia y ejecución de sesiones (S2-02, S2-04, S2-06)

Esta implementación usa las tablas `public.planes`, `tareas`, `participantes`, `sesiones` y `resultados` del esquema de Supabase creado por el equipo. React llama a NestJS; solo NestJS utiliza la credencial PostgreSQL. No uses `anon`, `service_role` ni la contraseña de la BD en variables `VITE_`.

## Ejecución

1. Copia `.env.example` a `.env` y escribe la cadena de conexión **solo en tu máquina**. Si tu red no admite IPv6, usa el *session pooler* indicado por Supabase. Ajusta `DATABASE_SSL` según tu conexión.
2. Ejecuta `npm install` y `npm run dev` en `backend/`.
3. En `frontend/`, copia `.env.example` a `.env`, ejecuta `npm install` y `npm run dev`.
4. Abre el frontend; la API usa `http://localhost:3000/api`.

No vuelvas a ejecutar el SQL de creación sobre una base que ya está en uso. El archivo `.env` está excluido de Git.

## Contratos de la API

| Método | Ruta | Datos principales | Respuesta |
| --- | --- | --- | --- |
| GET | `/api/planes` | — | Lista de planes |
| POST | `/api/planes` | `nombre`, `objetivo`, `tareas[]` | Plan con tareas |
| GET | `/api/planes/:id` | — | Plan con tareas |
| PATCH | `/api/planes/:id` | `nombre`, `objetivo` o `estado` | Plan actualizado |
| POST | `/api/planes/:id/tareas` | `titulo`, `descripcion`, `orden`; `codigo` y `criterio_exito` opcionales | Plan actualizado |
| PATCH | `/api/planes/:id/tareas/:taskId` | Campos editables de tarea | Plan actualizado |
| GET | `/api/sesiones` | — | Lista de sesiones |
| POST | `/api/sesiones` | `plan_id`, `consentimiento_confirmado: true`; alternativamente código manual | Sesión anónima en curso; pendiente con código manual |
| GET | `/api/sesiones/:id` | — | Sesión, plan y tareas |
| PATCH | `/api/sesiones/:id` | `accion: iniciar` con consentimiento; `continuar` o `cerrar` | Sesión con avance |
| GET | `/api/sesiones/:id/resultados` | — | Resultados guardados |
| PUT | `/api/sesiones/:id/resultados/:tareaId` | Resultado completo de una tarea | Resultado creado o reemplazado (200) |

Ejemplo de creación de plan:

```json
{
  "nombre": "Prueba de navegación",
  "objetivo": "Encontrar información de un curso",
  "tareas": [
    { "titulo": "Buscar curso", "descripcion": "Localiza un curso", "orden": 1, "codigo": "T-01", "criterio_exito": "Abrir la ficha" }
  ]
}
```

IDs PostgreSQL `BIGINT` se entregan como **cadenas** por `pg`. `estado` de plan: `borrador`, `activo`, `finalizado`. `estado` de sesión: `pendiente`, `en_curso`, `cerrada`. Errores: NestJS devuelve 400 para datos inválidos, 404 para registro inexistente y 409 para conflicto. La creación del plan y sus tareas es transaccional. La sesión puede recuperarse con `GET /api/sesiones/:id` tras recargar.

## Arquitectura y validaciones S2-02

El contrato oficial de esta implementación utiliza las tablas españolas existentes en Supabase. La migración Prisma de `feature/HU-03-bd` (`test_plans`, UUID y estados ingleses) es incompatible: no la ejecutes sobre la base existente. La conexión y sus credenciales se conservan intactas.

- `DatabaseModule` comparte una única instancia del servicio PostgreSQL existente.
- `PlansModule` administra planes; `TasksModule` contiene controlador y servicio propios para las rutas anidadas de tareas.
- `SessionsModule` administra participantes por código y transiciones de sesiones.
- `EvidencesModule` está registrado como punto de integración, **sin endpoints ni persistencia habilitados**. El repositorio no contiene su esquema oficial ni el contrato de almacenamiento. Se necesitan columnas, relaciones, tipos de archivo y mecanismo de carga antes de implementar DTOs y operaciones. No se inventa una tabla ni se crean migraciones.

Los DTOs de `src/dto/` son interfaces TypeScript con funciones de validación en ejecución. Los servicios las invocan antes de consultar la BD; no requieren `class-validator`. La entrada debe ser un objeto JSON. Los campos desconocidos se rechazan, y PATCH exige al menos un campo editable. Los textos se recortan y deben quedar no vacíos.

| Campo | Validación |
| --- | --- |
| `nombre`, `titulo` | Texto de 1 a 150 caracteres |
| `objetivo`, `descripcion` | Texto de 1 a 10000 caracteres |
| `criterio_exito` | Opcional en POST; texto de 1 a 10000 caracteres o `null` |
| `codigo` de tarea | Opcional; texto de 1 a 30 caracteres; `null` o `""` lo limpian |
| `codigo_participante` | Texto de 1 a 30 caracteres |
| `orden` | Número entero de 1 a 2147483647; no admite cadenas |
| `tareas` de nuevo plan | Arreglo no vacío; órdenes y códigos no nulos únicos dentro del arreglo |
| `estado` de plan | `borrador`, `activo`, `finalizado` |
| `accion` de sesión | `iniciar`, `continuar` o `cerrar` |
| `consentimiento_confirmado` | Booleano; obligatoriamente `true` al iniciar |

Los IDs de ruta son enteros positivos canónicos sin ceros iniciales, hasta `9223372036854775807`. En el request de nueva sesión, `plan_id` admite una cadena BIGINT o un entero positivo seguro de JavaScript; se recomienda la cadena para evitar pérdida de precisión. Todas las respuestas entregan IDs como cadenas.

En POST de tarea, omitir `codigo` o `criterio_exito` guarda `null`. En PATCH, omitir un campo conserva su valor; `null` solo limpia `codigo` o `criterio_exito`. Los campos `id`, fechas, relaciones y estado inicial de sesión son administrados por el servidor/BD.

## Ejemplos por endpoint

Datos ilustrativos; usa `Content-Type: application/json`. GET no lleva body. POST devuelve **201**; GET y PATCH **200**. Las listas pueden devolver `[]`. Las fechas son cadenas ISO 8601; inicio y cierre pueden ser `null`.

### GET `/api/planes`

Request: sin body. Response **200**, sin tareas:

```json
[
  { "id": "1", "nombre": "Prueba de navegación", "objetivo": "Encontrar un curso", "estado": "borrador", "creado_en": "2026-10-08T15:00:00.000Z", "actualizado_en": "2026-10-08T15:00:00.000Z" }
]
```

### POST `/api/planes`

Request:

```json
{
  "nombre": "Prueba de navegación", "objetivo": "Encontrar un curso",
  "tareas": [{ "titulo": "Buscar curso", "descripcion": "Localiza un curso", "orden": 1, "codigo": "T-01", "criterio_exito": "Abrir la ficha" }]
}
```

Response **201**:

```json
{
  "id": "1", "nombre": "Prueba de navegación", "objetivo": "Encontrar un curso", "estado": "borrador",
  "creado_en": "2026-10-08T15:00:00.000Z", "actualizado_en": "2026-10-08T15:00:00.000Z",
  "tareas": [{ "id": "4", "plan_id": "1", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "codigo": "T-01", "orden": 1 }]
}
```

La creación del plan y todas sus tareas es transaccional; si alguna falla, no se conserva un plan parcial.

### GET `/api/planes/:id`

Request: `GET /api/planes/1`, sin body. Response **200**:

```json
{
  "id": "1", "nombre": "Prueba de navegación", "objetivo": "Encontrar un curso", "estado": "borrador",
  "creado_en": "2026-10-08T15:00:00.000Z", "actualizado_en": "2026-10-08T15:00:00.000Z",
  "tareas": [{ "id": "4", "plan_id": "1", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "codigo": "T-01", "orden": 1 }]
}
```

Las tareas se ordenan por `orden`. Plan inexistente: **404**.

### PATCH `/api/planes/:id`

Request: `PATCH /api/planes/1`. Cualquier subconjunto no vacío de `nombre`, `objetivo`, `estado`:

```json
{ "nombre": "Navegación de cursos", "estado": "activo" }
```

Response **200**:

```json
{
  "id": "1", "nombre": "Navegación de cursos", "objetivo": "Encontrar un curso", "estado": "activo",
  "creado_en": "2026-10-08T15:00:00.000Z", "actualizado_en": "2026-10-08T15:05:00.000Z",
  "tareas": [{ "id": "4", "plan_id": "1", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "codigo": "T-01", "orden": 1 }]
}
```

### POST `/api/planes/:id/tareas`

Request: `POST /api/planes/1/tareas`:

```json
{ "titulo": "Abrir ficha", "descripcion": "Consulta los detalles del curso", "orden": 2 }
```

Response **201**, el plan completo:

```json
{
  "id": "1", "nombre": "Prueba de navegación", "objetivo": "Encontrar un curso", "estado": "borrador",
  "creado_en": "2026-10-08T15:00:00.000Z", "actualizado_en": "2026-10-08T15:00:00.000Z",
  "tareas": [
    { "id": "4", "plan_id": "1", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "codigo": "T-01", "orden": 1 },
    { "id": "5", "plan_id": "1", "titulo": "Abrir ficha", "descripcion": "Consulta los detalles del curso", "criterio_exito": null, "codigo": null, "orden": 2 }
  ]
}
```

### PATCH `/api/planes/:id/tareas/:taskId`

Request: `PATCH /api/planes/1/tareas/4`. Campos editables: `titulo`, `descripcion`, `criterio_exito`, `codigo`, `orden`:

```json
{ "titulo": "Encontrar curso", "codigo": null, "criterio_exito": null }
```

Response **200**, el plan completo:

```json
{
  "id": "1", "nombre": "Prueba de navegación", "objetivo": "Encontrar un curso", "estado": "borrador",
  "creado_en": "2026-10-08T15:00:00.000Z", "actualizado_en": "2026-10-08T15:00:00.000Z",
  "tareas": [{ "id": "4", "plan_id": "1", "titulo": "Encontrar curso", "descripcion": "Localiza un curso", "criterio_exito": null, "codigo": null, "orden": 1 }]
}
```

La tarea debe pertenecer al plan indicado; de lo contrario devuelve **404**. Las restricciones de unicidad de la BD devuelven **409**. Las rutas de tareas conservan el comportamiento de S2-04 respecto a las fechas del plan.

### GET `/api/sesiones`

Request: sin body. Response **200**, sin tareas:

```json
[
  {
    "id": "2", "plan_id": "1", "plan_nombre": "Prueba de navegación", "participante_id": "3", "participante_codigo": "P-001",
    "estado": "pendiente", "consentimiento_confirmado": false, "iniciada_en": null, "cerrada_en": null, "creada_en": "2026-10-08T15:10:00.000Z"
  }
]
```

### POST `/api/sesiones`

Request:

```json
{ "plan_id": "1", "codigo_participante": "P-001" }
```

Response **201**:

```json
{
  "id": "2", "plan_id": "1", "plan_nombre": "Prueba de navegación", "participante_id": "3", "participante_codigo": "P-001",
  "estado": "pendiente", "consentimiento_confirmado": false, "iniciada_en": null, "cerrada_en": null, "creada_en": "2026-10-08T15:10:00.000Z",
  "tareas": [{ "id": "4", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "orden": 1 }]
}
```

Reutiliza o crea el participante por `public.participantes.codigo` y crea la sesión en la misma transacción. El plan debe existir (**404** si no existe).

### GET `/api/sesiones/:id`

Request: `GET /api/sesiones/2`, sin body. Response **200**:

```json
{
  "id": "2", "plan_id": "1", "plan_nombre": "Prueba de navegación", "participante_id": "3", "participante_codigo": "P-001",
  "estado": "en_curso", "consentimiento_confirmado": true, "iniciada_en": "2026-10-08T15:11:00.000Z", "cerrada_en": null, "creada_en": "2026-10-08T15:10:00.000Z",
  "tareas": [{ "id": "4", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "orden": 1 }]
}
```

Permite recuperar la sesión tras recargar; S2-06 añade `resultados`, `progreso`, `cupo` y `cupo_completo` a esta respuesta. Las tareas de esta respuesta no incluyen `plan_id` ni `codigo`. Sesión inexistente: **404**.

### PATCH `/api/sesiones/:id`

Request para iniciar: `PATCH /api/sesiones/2`:

```json
{ "accion": "iniciar", "consentimiento_confirmado": true }
```

Response **200**:

```json
{
  "id": "2", "plan_id": "1", "plan_nombre": "Prueba de navegación", "participante_id": "3", "participante_codigo": "P-001",
  "estado": "en_curso", "consentimiento_confirmado": true, "iniciada_en": "2026-10-08T15:11:00.000Z", "cerrada_en": null, "creada_en": "2026-10-08T15:10:00.000Z",
  "tareas": [{ "id": "4", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "orden": 1 }]
}
```

Request para cerrar:

```json
{ "accion": "cerrar" }
```

Response **200**:

```json
{
  "id": "2", "plan_id": "1", "plan_nombre": "Prueba de navegación", "participante_id": "3", "participante_codigo": "P-001",
  "estado": "cerrada", "consentimiento_confirmado": true, "iniciada_en": "2026-10-08T15:11:00.000Z", "cerrada_en": "2026-10-08T15:20:00.000Z", "creada_en": "2026-10-08T15:10:00.000Z",
  "tareas": [{ "id": "4", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "orden": 1 }]
}
```

Solo se admite `pendiente → en_curso → cerrada`. S2-06 exige resultados completos de todas las tareas antes de cerrar (incluidas las no completadas); un plan sin tareas tampoco permite el cierre. Transición inválida o repetida: **409**. Sesión inexistente: **404**. Al cerrar también se admite `consentimiento_confirmado: false` o `true` por compatibilidad con React, pero no cambia el consentimiento persistido: el cierre exige que ya esté confirmado en la BD.

## Errores JSON

Toda respuesta de error HTTP tiene `{ code, message, details }`: `message` siempre es una cadena y `details` un arreglo. `ApiErrorFilter` se registra mediante `APP_FILTER`, incluidas rutas inexistentes y JSON mal formado. Las respuestas exitosas no llevan un envoltorio adicional; las sesiones incluyen los campos de avance de S2-06.

| HTTP | `code` | Situación |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | DTO inválido, JSON mal formado, ID fuera de rango o restricciones de datos |
| 404 | `NOT_FOUND` | Registro o ruta inexistente |
| 409 | `CONFLICT` | Duplicado, conflicto de relación o transición inválida |
| 500 | `INTERNAL_ERROR` | Fallo inesperado o de conexión; mensaje genérico |

Ejemplo **400**, campo desconocido:

```json
{ "code": "INVALID_REQUEST", "message": "Hay campos no admitidos.", "details": [{ "field": "nombre_ingles", "message": "Campo no admitido." }] }
```

Ejemplo **400**, iniciar sin consentimiento:

```json
{ "code": "INVALID_REQUEST", "message": "Confirma el consentimiento antes de iniciar.", "details": [] }
```

Ejemplo **404**:

```json
{ "code": "NOT_FOUND", "message": "El plan no existe.", "details": [] }
```

Ejemplo **409**:

```json
{ "code": "CONFLICT", "message": "La sesión ya cambió de estado o no permite esta operación.", "details": [] }
```

Ejemplo **500**:

```json
{ "code": "INTERNAL_ERROR", "message": "No se pudo completar la solicitud.", "details": [] }
```

El filtro traduce restricciones PostgreSQL a 400/409 incluso en operaciones sin captura local. No expone SQL, credenciales, detalles internos de PostgreSQL ni trazas en la respuesta. El frontend sigue leyendo `message`.

## Calidad técnica

Desde `backend/`, `npm ci` instala las dependencias fijadas y `npm run build` comprueba los tipos y compila en `dist/`. `npm test` compila y ejecuta validaciones de DTOs, compatibilidad HTTP de las rutas existentes y nuevas, ejecución de sesiones, resultados y rollback transaccional. No hay script `lint` configurado.

Las pruebas HTTP usan persistencia simulada y una URL PostgreSQL ficticia; no requieren `.env` ni acceden a Supabase. La verificación con la BD real requiere una conexión local configurada y el esquema oficial disponible.

## S2-06: ejecución de sesiones (HU-02, Manuel Cusme)

### Migración previa al despliegue

El esquema original no incluye cupo ni distingue ayuda. Antes de ejecutar esta versión, aplica **una vez** `migrations/001_s2_06_ejecucion_sesiones.sql` mediante el procedimiento de migraciones del equipo. El backend no aplica DDL al arrancar. No vuelvas a ejecutar los scripts completos de creación. Esta entrega prepara el archivo; no modifica la base remota ni su conexión.

- `planes.cupo`: entero positivo o `null` (sin límite). Los planes existentes quedan con `null`; no se inventa un cupo predeterminado. POST/PATCH de planes admiten este campo. GET de planes lo devuelve.
- Se cuentan **todas** las sesiones del plan: pendientes, en curso y cerradas. Crear consume un cupo; iniciar o continuar una sesión existente no consume otro. No se permite reducir el cupo por debajo del total ya creado.
- `resultados.con_ayuda`: booleano, por defecto `false`. Los resultados históricos conservan sus métricas; su ayuda previa no se puede inferir. La restricción exige `completada = true` cuando `con_ayuda = true`.
- Se conserva la restricción única existente `(sesion_id, tarea_id)` y las relaciones compuestas que obligan a que tarea y sesión pertenezcan al mismo plan.

Configurar cupo: `PATCH /api/planes/1`, request `{"cupo":5}`. Response **200**: plan con tareas y `"cupo":5`. `{"cupo":null}` elimina el límite. Un cupo cero, negativo, fraccionario o enviado como cadena devuelve **400**; reducirlo bajo las sesiones creadas devuelve **409**.

### Iniciar una sesión anónima

`POST /api/sesiones`, request:

```json
{ "plan_id": "1", "consentimiento_confirmado": true }
```

Response **201** (fechas e IDs ilustrativos):

```json
{
  "id": "2", "plan_id": "1", "plan_nombre": "Prueba de navegación",
  "participante_id": "3", "participante_codigo": "P-001",
  "estado": "en_curso", "consentimiento_confirmado": true,
  "iniciada_en": "2026-10-10T15:00:00.000Z", "cerrada_en": null,
  "creada_en": "2026-10-10T15:00:00.000Z", "cupo": 5, "cupo_completo": false,
  "tareas": [{ "id": "4", "titulo": "Buscar curso", "descripcion": "Localiza un curso", "criterio_exito": "Abrir la ficha", "orden": 1 }],
  "resultados": [],
  "progreso": { "total": 1, "registradas": 0, "pendientes": ["4"] }
}
```

El código se genera globalmente según el mayor número `P-...` existente: `P-001`, `P-002`, …, `P-1000`. No se trunca al superar 999. La asignación, participante y sesión se guardan en una transacción; un fallo revierte todo. El cupo se comprueba con bloqueo del plan; la asignación de códigos se serializa con un bloqueo de participantes.

El consentimiento debe ser exactamente el booleano `true`. Omitirlo o enviar `false`, `null`, `1` o `"true"` devuelve **400**. Plan inexistente: **404**. Plan finalizado o cupo completo: **409**. Se admite crear en planes borrador o activos, como en S2-04.

Por compatibilidad, `{"plan_id":"1","codigo_participante":"P-001"}` sigue creando una sesión **pendiente** (con control de cupo), sin autorizar su ejecución. Para ejecutarla es obligatorio `PATCH` con `{"accion":"iniciar","consentimiento_confirmado":true}`. No se admite mezclar código manual y consentimiento en POST.

### Consultar y continuar

`GET /api/sesiones/2`, sin body, devuelve **200** con la forma completa anterior, más los resultados guardados. `progreso.pendientes` contiene los IDs de tareas sin resultados completos. La lista `GET /api/sesiones` añade `cupo` y `cupo_completo` a cada sesión.

`PATCH /api/sesiones/2`, request:

```json
{ "accion": "continuar" }
```

Response **200**: la misma forma de GET, con `estado: "en_curso"`, resultados y progreso. Es idempotente: conserva consentimiento, participante y fechas. Solo admite una sesión en curso con consentimiento confirmado. Pendiente o cerrada: **409**; inexistente: **404**. Un cupo completo no impide continuar ni guardar resultados de sesiones existentes.

### Guardar o reemplazar un resultado

`PUT /api/sesiones/2/resultados/4`, request con el contrato del esquema:

```json
{
  "completada": true, "con_ayuda": true,
  "duracion_segundos": 61, "cantidad_errores": 2,
  "observaciones": "Dudó en el menú"
}
```

| Situación | `completada` | `con_ayuda` |
| --- | --- | --- |
| Completada sin ayuda | `true` | `false` |
| Completada con ayuda | `true` | `true` |
| No completada | `false` | `false` |

`completada`, duración y errores son obligatorios. `con_ayuda` es opcional, con valor `false` si se omite; debe ser booleano si se envía. Duración y errores admiten números enteros entre 0 y 2147483647, sin coerción de cadenas. Observaciones admite texto de hasta 10000 caracteres, `null` u omisión; se recorta y el texto vacío se guarda como `null`. Al reemplazar, omitir observaciones las limpia; PUT recibe el resultado completo, no un parche.

También se admite el contrato que ya consume S2-07, con traducción al esquema español:

```json
{ "resultado": "con_ayuda", "tiempo_segundos": 61, "errores": 2, "observacion": "Dudó en el menú" }
```

`resultado` solo admite `sin_ayuda`, `con_ayuda` o `no_completado`. No se permite mezclar campos de ambos contratos; los campos desconocidos se rechazan.

Response **200** en creación y actualización:

```json
{
  "id": "10", "plan_id": "1", "sesion_id": "2", "tarea_id": "4",
  "completada": true, "con_ayuda": true, "duracion_segundos": 61,
  "cantidad_errores": 2, "observaciones": "Dudó en el menú",
  "registrado_en": "2026-10-10T15:01:00.000Z",
  "resultado": "con_ayuda", "tiempo_segundos": 61, "errores": 2,
  "observacion": "Dudó en el menú"
}
```

Las respuestas incluyen ambos juegos de nombres para que React pueda recuperar el avance sin cambios. `INSERT ... ON CONFLICT (sesion_id, tarea_id) DO UPDATE` conserva el ID y `registrado_en` de la primera creación; reemplaza las métricas y observaciones. Los resultados solo se escriben en una sesión en curso con consentimiento. Pendiente o cerrada: **409**. Sesión inexistente o tarea ajena al plan: **404**.

### Listar resultados

`GET /api/sesiones/2/resultados`, sin body. Response **200**: arreglo de objetos con la forma del resultado anterior, ordenados por `tarea_id`. Una sesión existente sin resultados devuelve `[]`; una sesión inexistente devuelve **404**. Las sesiones cerradas permiten consultar su resumen. Los resultados históricos incompletos mantienen sus valores `null` y no permiten cerrar hasta reemplazarlos con métricas completas.

### Cerrar y errores

`PATCH /api/sesiones/2`, request `{"accion":"cerrar"}`. Response **200**: sesión completa con `estado: "cerrada"`, `cerrada_en` ISO, resultados y progreso sin pendientes. Una tarea marcada no completada **sí cuenta como registrada**.

El servidor comprueba que esté en curso, con consentimiento, que haya tareas y que todas tengan resultado con `completada` y duración no nulos. No se admite iniciar dos veces, cerrar dos veces, cerrar desde pendiente ni continuar una cerrada. Guardado y cierre usan el mismo orden de bloqueos (plan y sesión); al cerrarse, las escrituras posteriores se rechazan. Las tareas evaluadas son las actuales del plan: esta entrega no introduce versiones ni snapshots de tareas.

Todos los errores conservan `{ code, message, details }` y el filtro existente, sin exponer SQL ni credenciales. Ejemplos:

**409**, cupo:

```json
{ "code": "CONFLICT", "message": "El cupo del plan está completo. Puedes continuar una sesión existente.", "details": [] }
```

**409**, cierre con pendientes:

```json
{
  "code": "CONFLICT",
  "message": "No se puede cerrar la sesión: faltan resultados de tareas o el plan no tiene tareas.",
  "details": [{ "tarea_id": "4", "message": "Resultado pendiente." }]
}
```

**400**, duración inválida:

```json
{
  "code": "INVALID_REQUEST", "message": "duracion_segundos debe ser un entero entre 0 y 2147483647.",
  "details": [{ "field": "duracion_segundos", "message": "Entero no negativo requerido." }]
}
```

**409**, intentar guardar fuera de ejecución:

```json
{ "code": "CONFLICT", "message": "Solo se pueden guardar resultados en una sesión en curso con consentimiento confirmado.", "details": [] }
```

### Verificación

Desde `backend/`, ejecuta `npm test` (incluye `npm run build`). Las pruebas cubren DTOs, rutas HTTP existentes y nuevas, códigos automáticos, cupo, continuación, upsert, pertenencia de tarea al plan, estados, cierre incompleto y rollback. Usan PostgreSQL simulado; no se ha validado esta entrega contra Supabase real ni se ha aplicado la migración remota. Los bloqueos y restricciones deben comprobarse también en el entorno PostgreSQL de integración antes del despliegue.
