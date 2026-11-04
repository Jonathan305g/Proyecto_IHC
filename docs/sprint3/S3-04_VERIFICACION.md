# Comprobación S3-04

Fecha: 03/11/2026 (America/Bogota). Responsable: Manuel Cusme.
Rama: `feature/s3-04-api-indicadores-manuel`.
Base local y `develop` al comenzar: `d01327784b90d86d36ad35bda5aff2673fc97c45`.

## Auditoría previa

Se revisaron la estructura completa de archivos versionados; README principal,
backend, frontend y BD; scripts, dependencias y locks; TypeScript estricto del backend
(el frontend usa JS/Vite); módulos, controladores, servicios y DTO; `DatabaseService`,
transacciones, AuthGuard Supabase y filtro global de errores; esquema y migraciones;
pruebas de servicios, HTTP, SQL, entorno y Playwright. Se leyeron los seis archivos
de definición/verificación S3-01 y su prueba actual, sin asumir versiones anteriores.
No se encontraron archivos `AGENTS.md` dentro del repositorio. Git estaba limpio,
en la rama solicitada y en el mismo commit que `develop`.

Existían el SQL comprobado, sus 15 casos manuales, los servicios de planes/sesiones/
resultados y la infraestructura de Auth/errores. Faltaban servicio de indicadores,
validación de query, rutas, documentación y pruebas HTTP del reporte. Se añadieron
en el módulo de planes, sin un nuevo módulo ni cambios de esquema, IA o frontend.

La primera ejecución de `npm test` fue bloqueada por `npm.ps1`. Con `npm.cmd`,
la compilación inicial falló por dependencias locales ausentes (ajv y Supabase),
y el test SQL falló por PGlite ausente. Se ejecutó `npm.cmd ci` en backend y frontend
usando los locks existentes, con caché temporal y acceso de red revisado. No se
cambiaron dependencias ni locks. Después, **antes de editar código**, la regresión
inicial aprobó 78 pruebas backend + 21 frontend; S3-01 aprobó 20/20. La compilación
inicial de ambos proyectos también terminó correctamente.

Entorno observado: Windows, PowerShell, Node.js `v25.9.0`, npm `11.12.1`.
CI conserva su configuración existente de Node 22; no se ejecutó CI remota.

## Resultados finales observados

| Comando desde la raíz | Aprobadas | Fallidas | Omitidas | Resultado |
|---|---:|---:|---:|---|
| `node --test backend/test/s3-01-metricas.test.cjs` | 20 | 0 | 0 | SQL y guardas del fixture |
| `node --test backend/test/s3-01-metricas.test.cjs backend/test/s3-04-*.test.cjs` | 46 | 0 | 0 | 20 S3-01 + 26 S3-04: servicio, validaciones, HTTP e integración |
| `npm.cmd test` | 125 | 0 | 0 | 104 backend + 21 frontend; incluye las filas anteriores |
| `npm.cmd run test:e2e --prefix frontend` | 4 | 0 | 0 | Chromium; regresión existente con Auth/API controladas |
| `npm.cmd run build` | — | — | — | TypeScript y Vite correctos |
| `git diff --check` | — | — | — | Sin errores |

Total sin duplicar ejecuciones: **129 aprobadas, 0 fallidas, 0 omitidas**.
Las 26 nuevas pruebas incluyen los contenedores que cuenta `node:test`.
En Windows se instaló Chromium de Playwright. La primera ejecución de E2E mostró
los cuatro casos aprobados pero se detuvo en el cierre del servidor dentro del
sandbox; se interrumpió y repitió con gestión de procesos autorizada, terminando
con código 0 y `4 passed`. No se modificó Playwright ni se desactivaron pruebas.

## Cobertura e incidencias resueltas

- Los **15 casos oficiales**, sin cambiar valores esperados, se ejecutan por
  servicio y por las tres rutas HTTP. Los éxitos se contrastan también contra el
  JSON completo de la consulta original; los errores conservan 400/404.
- Cobertura, conteos, categorías exclusivas, medias, sumas, NULL frente a cero,
  resultados parciales, planes sin tareas/sesiones y aislamiento de planes.
- Filtros múltiples/restablecimiento, límite inclusivo/exclusivo por cierre,
  offsets equivalentes, límites unilaterales y precisión de microsegundos.
- IDs hasta el máximo BIGINT, fechas imposibles, bisiestos, tipos/coerciones,
  selección vacía, duplicada, inexistente o ajena, parámetros repetidos/desconocidos.
- AuthGuard global real en las tres rutas: 401 por token ausente/vencido y 403
  por correo ajeno/no confirmado. Solo se controla `getUser` del proveedor externo.
- Flujo HTTP con servicios y SQL reales: alta de plan, inicio consentido, resultado,
  dos evidencias, cierre e indicadores. Las sesiones en curso aún no se incluyen;
  adjuntar más evidencias no modifica los indicadores ni los resultados previos.
- Durante la preparación de esta última prueba, el fixture con IDs explícitos
  produjo colisión de identidad (409). Se sincronizaron sus secuencias **solo en
  la BD PGlite desechable de la prueba**, sin modificar el fixture oficial. Se adaptó
  además la salida BIGINT de PGlite por OID 20 al formato de cadenas de `pg`.
  Se repitieron las pruebas afectadas y la regresión completa, con éxito.

## Integridad y pendientes

Archivos creados (9):

- `backend/src/dto/indicadores.dto.ts`
- `backend/src/indicators.types.ts`
- `backend/src/indicators.service.ts`
- `backend/src/indicators.controller.ts`
- `backend/test/s3-04-indicadores.test.cjs`
- `backend/test/s3-04-http.test.cjs`
- `backend/test/s3-04-integracion.test.cjs`
- `docs/sprint3/S3-04_API_INDICADORES.md`
- `docs/sprint3/S3-04_VERIFICACION.md`

Archivos modificados (3): `backend/src/planes.module.ts`, `backend/README.md`
y `README.md`.

SQL, reglas, esquema, fixtures y valores esperados S3-01 permanecen intactos.
No se tocaron módulos S3-02/S3-07, autenticación, frontend ni dependencias.
No se cargaron fixtures ni se crearon datos en Supabase compartido.
Solo se incluyen fuentes, pruebas y documentación: no `.env`, claves ni generados.
`develop` permanece en su SHA inicial; no se publicó la rama ni se creó un PR.
Los commits se consultan con `git log --oneline develop..HEAD`.

**Pendiente de integración externa:** no existen `backend/.env` ni `frontend/.env`
locales. No se verificaron estos endpoints contra PostgreSQL/Supabase Auth reales,
TLS ni cuentas del equipo. Las pruebas aisladas no acreditan esa integración.
Para completar esa comprobación se necesitan la configuración privada y un token
de usuario autorizado. Preparar el entorno según los README, ejecutar
`npm run verify:environment`, arrancar el backend y consultar las rutas con un plan
existente. No ejecutar `datos_verificacion.sql` en el entorno compartido.

La implementación está validada localmente y preparada para revisión; la
verificación de integración externa queda explícitamente pendiente.
