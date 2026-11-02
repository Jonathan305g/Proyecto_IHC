# S3-01 - Métricas y conjunto de verificación

Responsable: William Martínez. Historia: HU-05. Contrato: **1.0**.
Base: `develop` en `e83ea3b`. Corresponde a la definición y verificación;
Manuel implementa la API en S3-04, Jonathan el dashboard en S3-05 y Emilio
sus filtros en S3-06. Este entregable puede integrarse independientemente de S3-02.

## 1. Universo y reglas de inclusión

La unidad es **un par sesión/tarea**, identificado por `(sesion_id, tarea_id)`.
Se consulta un único `plan_id`. Se incluyen sesiones `cerrada`, con
`consentimiento_confirmado=true`, inicio y cierre presentes y cierre >= inicio.
No importa si el plan sigue activo o ya finalizó. El cupo previsto no es un denominador.

Se excluyen sesiones pendientes, en curso, sin consentimiento, sin fechas válidas,
de otro plan o cuyo cierre queda fuera del período solicitado. El esquema actual
no tiene una marca de exclusión manual: no se inventa una columna ni se descarta
una evaluación por fallar, durar mucho o registrar errores.

Cada sesión incluida se combina con cada tarea seleccionada del plan. Un resultado
ausente o con `completada=NULL` es **pendiente**, incluso si ya tiene evidencia.
Una sesión cerrada antigua con resultados incompletos aporta los pares esperados
y sus pendientes; solo sus evaluaciones válidas aportan a tasas, tiempo y errores.
Esto hace visible la cobertura sin convertir faltantes en fracasos.

| Categoría | Condición persistida |
|---|---|
| `sin_ayuda` | `completada=true` y `con_ayuda=false` |
| `con_ayuda` | `completada=true` y `con_ayuda=true` |
| `no_completado` | `completada=false` y `con_ayuda=false` |
| Pendiente | Sin resultado o `completada=NULL` |

La restricción `resultados_ayuda_completada` rechaza ayuda=true si no se completó.
La consulta clasifica otras combinaciones anómalas como pendientes, sin darles
categoría válida. La unicidad de resultado por sesión/tarea evita doble conteo.
El número de archivos adjuntos nunca interviene en los indicadores.

## 2. Diccionario de métricas

Sean S las sesiones incluidas, T las tareas seleccionadas, E = S × T los pares
esperados, N los evaluados y P = E - N los pendientes. Para cada categoría c:
Nc = cantidad evaluada, Dc = cantidad con duración conocida y Rc = cantidad con
número de errores conocido. Todas las medias son aritméticas.

| Campo de salida | Fórmula y denominador | Unidad / vacío |
|---|---|---|
| `sesiones_incluidas` | S | sesiones; 0 si no hay |
| `tareas_seleccionadas` | T | tareas; 0 si el plan no tiene |
| `esperados` | E | pares; 0 |
| `evaluados` | N = Nsin + Ncon + Nno | pares; 0 |
| `pendientes` | E - N | pares; 0 |
| `cobertura_porcentaje` | 100 × N / E | %; NULL si E=0 |
| `por_resultado[c].cantidad` | Nc | evaluaciones; 0 |
| `por_resultado[c].porcentaje` | 100 × Nc / N | %; NULL si N=0 |
| `tiempo.n` | Dc | evaluaciones con tiempo conocido; 0 |
| `tiempo.total_segundos` | suma de duraciones conocidas de c | segundos; NULL si Dc=0 |
| `tiempo.promedio_segundos` | suma / Dc | segundos; NULL si Dc=0 |
| `errores.n` | Rc | evaluaciones con errores conocidos; 0 |
| `errores.total` | suma de errores conocidos de c | errores; NULL si Rc=0 |
| `errores.promedio` | suma / Rc | errores/evaluación; NULL si Rc=0 |

Los tres porcentajes usan **el mismo N** y categorías mutuamente excluyentes.
Si N>0 y Nc=0, su porcentaje es 0; si N=0, es NULL. No existe una tasa única que
oculte la diferencia entre éxito con y sin ayuda. Un éxito con ayuda cuenta solo
en `con_ayuda`, nunca también en `sin_ayuda`.

Tiempo y errores se publican por categoría para no mezclar éxito autónomo,
éxito asistido y abandono. Un tiempo NULL conserva la clasificación del resultado,
pero no incrementa Dc. Un tiempo registrado de **0 sí incrementa Dc**. La misma
regla vale para errores; hoy su columna es NOT NULL y Rc=Nc. No se estiman tiempos
a partir de inicio/cierre ni se reemplazan valores ausentes por cero.

Las medias y porcentajes se redondean a dos decimales al final con PostgreSQL
`round(numeric,2)`. Las medias generales se calculan con todas las observaciones
del subconjunto, no promediando medias de tareas. Por redondeo, tres porcentajes
33.33 pueden sumar 99.99. Los conteos y sumas permanecen enteros.

## 3. Filtros y contrato de consulta

Archivo: `database/sprint3/s3-01/metricas.sql`. Una sola sentencia SELECT produce
`reporte` (JSONB), incluyendo general y por tarea desde la misma instantánea.
No requiere migraciones ni expone nuevas vistas/RPC ni modifica RLS.

| Parámetro | Regla |
|---|---|
| `$1` `plan_id` | BIGINT positivo existente. API: identificadores como cadenas decimales, hasta 9223372036854775807 |
| `$2` `desde` | TIMESTAMPTZ inclusivo o NULL; se filtra **cerrada_en** |
| `$3` `hasta` | TIMESTAMPTZ exclusivo o NULL; desde < hasta si existen ambos |
| `$4` `tarea_ids` | BIGINT[] con IDs únicos del mismo plan, o NULL para todas; [] es inválido |

Las fechas de la API deben ser ISO 8601 con Z u offset explícito. Para días de
Ecuador se convierten los límites de `America/Guayaquil` a instantes; no se
concatena una hora local sin zona. Ejemplo: [20/10/2026 00:00 -05,
21/10/2026 00:00 -05) equivale a [20/10 05:00Z, 21/10 05:00Z).
Restablecer filtros conserva el plan elegido y envía NULL para período y tareas.
El caso de referencia usa límites UTC expresamente para que sea reproducible.

Una tarea se identifica por `id` dentro del plan; `codigo` y título se devuelven
para mostrar. No se agrupan tareas de planes diferentes porque compartan código.

La consulta devuelve `filtro_valido=false`, `general=null`, `por_tarea=[]` y
`error_filtro` con PLAN_INVALIDO, PLAN_INEXISTENTE, PERIODO_INVALIDO, TAREAS_VACIAS
o TAREA_INVALIDA. Las selecciones repetidas, nulas o ajenas al plan son inválidas.
La API S3-04 debe validar sintaxis/tipos antes de castear, usar parámetros de `pg`
y mapear plan inexistente a 404 y otros filtros inválidos a 400. No interpolar SQL.
Un error de filtro es distinto de un filtro válido sin resultados.

```js
const { rows } = await db.query(sqlMetricas, [
  '101', '2026-10-20T00:00:00Z', '2026-10-22T00:00:00Z', null
])
const reporte = rows[0].reporte
```

Para un plan válido sin sesiones: conteos 0, cobertura NULL, porcentajes NULL,
medias y sumas NULL; se mantienen las filas de sus tareas. Para un plan sin
tareas: general vacío y `por_tarea=[]`. El dashboard debe representar NULL como
“Sin datos” y un cero real como 0; S3-05/S3-06 completan sus estados de interfaz.

## 4. Conjunto pequeño y cálculo manual

`datos_verificacion.sql` usa una BD **vacía y desechable**, con guarda explícita
`ihc.s301_fixture=true`. El test la crea con PGlite; no se ejecuta contra Supabase
compartido. Las sesiones no consentidas/incompletas son casos defensivos que el
flujo actual de la API ya restringe, pero pueden existir en datos antiguos.

Plan 101, período [2026-10-20T00:00Z, 2026-10-22T00:00Z):

| Sesión | Tarea | Resultado | Segundos | Errores |
|---|---|---|---:|---:|
| 1101 | 1001 / T1 | sin_ayuda | 30 | 0 |
| 1101 | 1002 / T2 | con_ayuda | 60 | 2 |
| 1101 | 1003 / T3 | ausente | - | - |
| 1102 | 1001 / T1 | no_completado | 90 | 3 |
| 1102 | 1002 / T2 | sin_ayuda | NULL | 0 |
| 1102 | 1003 / T3 | pendiente con resultado reservado | NULL | 0 reservado |
| 1103 | 1001 / T1 | con_ayuda | 50 | 1 |
| 1103 | 1002 / T2 | sin_ayuda | 0 | 0 |
| 1103 | 1003 / T3 | ausente | - | - |

Son S=3, T=3, E=9, N=6, P=3 y cobertura 100×6/9 = **66.67%**.

| Categoría | Nc | Porcentaje | Dc | Total tiempo | Media tiempo | Total errores | Media errores |
|---|---:|---:|---:|---:|---:|---:|---:|
| sin_ayuda | 3 | 50.00% | 2 | 30 s | 15.00 s | 0 | 0.00 |
| con_ayuda | 2 | 33.33% | 2 | 110 s | 55.00 s | 3 | 1.50 |
| no_completado | 1 | 16.67% | 1 | 90 s | 90.00 s | 3 | 3.00 |

T1: tres evaluados; cada categoría 33.33%; tiempos 30, 50 y 90 s.
T2: tres evaluados; sin ayuda 66.67%, con ayuda 33.33%, no completado 0%; media
sin ayuda 0 s con Dc=1 (el otro tiempo es NULL). T3: tres pendientes, cobertura
0%, porcentajes y medias NULL. Hay dos evidencias en T1 que no alteran estos valores.

Se añaden casos de otro plan (un no completado de 0 s/0 errores), sesión en curso
(999 s), sin consentimiento (888 s), fuera del período (777 s), fechas ausentes
(666 s), período vacío y plan sin tareas. Los valores centinela revelan inclusiones
accidentales. El límite hasta=21/10 00:00Z excluye exactamente la sesión 1103.

## 5. Verificación reproducible y entrega al equipo

```powershell
npm ci --prefix backend
node --test backend/test/s3-01-metricas.test.cjs
npm test --prefix backend
```

`resultados_esperados.json` contiene 15 casos de referencia con valores fijados
desde el cálculo manual. Se comprueban SQL sobre el esquema real, NULL frente a
cero, guardas del fixture, aislamiento, fechas semiabiertas, zona -05, límites
unilaterales, ponderación general y ausencia de duplicación por evidencias.

Manuel: reutilizar SELECT, reglas y JSON esperado en S3-04; respetar AuthGuard.
Jonathan: tarjetas/tabla/gráficos leen el mismo reporte y muestran unidad y
denominador. Emilio: filtros por tarea usan IDs, período explícito y selección
vacía inválida; restablecer usa NULL. Las tres tareas pueden usar estos archivos
como contrato y deben comparar con el fixture antes de cerrar su integración.

S2-03 es la base del esquema; S2-10 es la dependencia de cierre. El ensayo HTTP
real del entorno fue aprobado por William el 02/11/2026; la comprobación desde
otra máquina sigue siendo una actividad distinta. Las pruebas de este contrato
no acreditan aún una API de indicadores ni un dashboard implementados.

## Referencias técnicas

- PostgreSQL 17, agregados y tratamiento de NULL: https://www.postgresql.org/docs/17/functions-aggregate.html
- PostgreSQL 17, fechas con zona: https://www.postgresql.org/docs/17/datatype-datetime.html
- Plan de trabajo Grupo 6: S3-01, S3-04, S3-05 y S3-06.
