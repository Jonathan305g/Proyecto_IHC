# S3-04 — API de indicadores y filtros (HU-05)

Responsable: Manuel Cusme. Contrato de métricas: **S3-01 1.0**.
Rama: `feature/s3-04-api-indicadores-manuel`; destino de revisión: `develop`.

## Rutas privadas

Prefijo `/api`; todas requieren `Authorization: Bearer <access_token>` de Supabase,
correo confirmado y permitido por `AUTH_ALLOWED_EMAILS`. Los miembros del equipo
comparten planes, como en el resto de la API; no hay autorización por propietario.

| Método | Ruta | Respuesta 200 |
|---|---|---|
| GET | `/planes/:id/indicadores` | Reporte S3-01 completo, con `general` y `por_tarea` |
| GET | `/planes/:id/indicadores/general` | Mismo reporte sin la propiedad `por_tarea` |
| GET | `/planes/:id/indicadores/tareas` | Mismo reporte sin la propiedad `general` |

Usar el reporte completo cuando tarjetas, tabla y gráficos deban mostrar la misma
instantánea. Cada petición ejecuta una sola sentencia SQL; peticiones independientes
pueden observar cierres de sesión diferentes. No hay caché (`Cache-Control: no-store`).

## Parámetros

| Parámetro | Ubicación | Contrato |
|---|---|---|
| `id` | Ruta | ID de plan como cadena decimal canónica positiva, máximo `9223372036854775807` |
| `desde` | Query opcional | Cierre inclusivo, fecha con zona explícita |
| `hasta` | Query opcional | Cierre exclusivo; si hay ambos límites, `desde < hasta` |
| `tarea_ids` | Query opcional | Una cadena de IDs únicos separados por comas, todos del plan: `1001,1002` |

Fechas admitidas: `YYYY-MM-DDTHH:mm:ss[.ffffff]Z` o con offset `±HH:mm`
(hasta `±14:00`). Año 0001–9999, fecha de calendario real y 1–6 dígitos
fraccionarios opcionales. No se admiten horas sin zona, hora 24, segundos
intercalares, fechas imposibles ni más precisión que PostgreSQL. Se comparan los
instantes con precisión de microsegundos y se conserva el texto para el parámetro SQL.

Omitir un filtro equivale a SQL `NULL`: todas las fechas o todas las tareas.
Para restablecer, conservar el plan en la ruta y quitar los parámetros. No enviar
las cadenas `null`/`undefined`, valores vacíos, arrays JSON ni parámetros repetidos.
Una selección vacía (`tarea_ids=`), duplicada, con espacios o con IDs ajenos produce
400; también se rechazan parámetros desconocidos. En particular `plan_id` se
define exclusivamente en la ruta, y `tarea_ids[]=...` no es un formato admitido.

Para un día local UTC-05, convertir los límites explícitamente:
`2026-10-20T00:00:00-05:00` a `2026-10-21T00:00:00-05:00`.
Construir la query con `URLSearchParams` para codificar correctamente `+` en offsets.

## JSON de éxito

El reporte completo conserva exactamente el JSON de la consulta S3-01:

```text
{
  version: "1.0",
  filtro_valido: true,
  error_filtro: null,
  filtros: { plan_id: string, desde: string|null, hasta: string|null, tarea_ids: string[]|null },
  sesiones_incluidas: number,
  tareas_seleccionadas: number,
  general: Indicadores,
  por_tarea: [{ tarea_id: string, codigo: string|null, titulo: string, ...Indicadores }]
}
```

`Indicadores` contiene `esperados`, `evaluados`, `pendientes`,
`cobertura_porcentaje` y `por_resultado`. Esta última propiedad contiene las tres
categorías `sin_ayuda`, `con_ayuda`, `no_completado`; cada una incluye:

```text
{
  cantidad: number,
  porcentaje: number|null,
  tiempo: { n: number, total_segundos: number|null, promedio_segundos: number|null },
  errores: { n: number, total: number|null, promedio: number|null }
}
```

Tipos completos: [`backend/src/indicators.types.ts`](../../backend/src/indicators.types.ts).
Las fechas devueltas son TIMESTAMPTZ serializados por PostgreSQL; comparar instantes,
sin depender de la representación textual de su zona. La selección y `por_tarea`
se ordenan por ID. Los IDs siempre son cadenas; los indicadores son números JSON.

Se incluyen solo sesiones cerradas, consentidas, con inicio/cierre presentes y
cierre >= inicio. El período se aplica a **cerrada_en**. El universo esperado es
sesiones incluidas × tareas elegidas; una evaluación ausente o reservada para
evidencias cuenta como pendiente. Las evidencias no multiplican evaluaciones.

Los porcentajes por categoría usan los evaluados como denominador. La cobertura
usa los esperados. Tiempo y errores usan solo los valores conocidos de cada
categoría. Se redondean porcentajes y medias a dos decimales en SQL.
`null` significa «Sin datos», mientras que `0` es un valor real. No promediar las
medias de tareas para construir tarjetas: consumir `general` directamente.

Plan sin sesiones: 200, conteos cero, cobertura/porcentajes/medidas `null` y filas
de sus tareas. Plan sin tareas: 200, general vacío, `por_tarea: []`.
Las reglas y fórmulas completas permanecen en [S3-01](S3-01_METRICAS_Y_VERIFICACION.md).

## Errores

Se conserva el filtro global `{ code, message, details }`:

| Estado | `code` | Motivo |
|---|---|---|
| 400 | `INVALID_REQUEST` | IDs, fechas, período, selección o parámetros inválidos |
| 401 | `UNAUTHORIZED` | Sin token o token inválido/vencido |
| 403 | `FORBIDDEN` | Correo no autorizado o sin confirmar |
| 404 | `NOT_FOUND` | Plan inexistente |
| 503 | `SERVICE_UNAVAILABLE` | Auth sin configurar, según AuthGuard existente |
| 500 | `INTERNAL_ERROR` | Fallo interno; sin SQL ni secretos en la respuesta |

Los errores de sintaxis incluyen `{ field, message }` en `details`. Los detectados
por SQL incluyen `{ field, rule }`, conservando `PLAN_INEXISTENTE`,
`TAREA_INVALIDA` y demás reglas S3-01. Por ejemplo:

```json
{"code":"NOT_FOUND","message":"El plan no existe.","details":[{"field":"plan_id","rule":"PLAN_INEXISTENTE"}]}
```

## Consumo y comprobación local

Con `.env` privado del backend configurado según su README, ejecutar desde la raíz
`npm run dev:backend`. En Windows con restricciones de PowerShell, usar `npm.cmd`.
Usar un ID existente del entorno y un token de la sesión de usuario autorizada:

```js
const params = new URLSearchParams({
  desde: '2026-10-20T00:00:00Z',
  hasta: '2026-10-22T00:00:00Z',
  tarea_ids: '1001,1002',
})
const response = await fetch(`http://localhost:3000/api/planes/101/indicadores?${params}`, {
  headers: { Authorization: `Bearer ${accessToken}` },
})
const data = await response.json()
if (!response.ok) throw new Error(data.message)
// data.general: tarjetas/gráficos; data.por_tarea: tabla/gráficos por tarea.
```

Ejemplos adicionales: `GET /api/planes/101/indicadores/general` sin filtros;
`GET /api/planes/101/indicadores/tareas?tarea_ids=1002` para una tarea.
Los IDs 101/1001/1002 son los del fixture aislado, no presuponen datos remotos.

Prueba reproducible sin credenciales: `npm test --prefix backend`. El conjunto
S3-04 arranca la aplicación real contra PGlite, carga S3-01 con su guarda y comprueba
servicio y HTTP. **Nunca cargar ese fixture en la BD compartida.**

El despliegue debe conservar `database/sprint3/s3-01/metricas.sql` junto al backend,
en la estructura del repositorio. Se carga una vez mediante ruta relativa al módulo
compilado (`backend/dist`); no depende del directorio desde el que arranca Node.
No se requieren migraciones, paquetes nuevos ni cambios de configuración.

Evidencia y pendientes: [S3-04_VERIFICACION.md](S3-04_VERIFICACION.md).
