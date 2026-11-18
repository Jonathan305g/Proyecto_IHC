# Comprobación S3-07

Fecha: 18/11/2026 (America/Guayaquil). Responsable: Manuel Cusme. HU-06.
Rama autorizada: `feature/s3-07-api-analisis-ia-manuel`.
Commit inicial: `f4a06c13cfacb6cf455ac2a3f770841bde0d1e62`.

## Auditoría anterior a los cambios

`git status` confirmó árbol limpio, sin conflictos; `git branch --show-current`
confirmó la rama autorizada. El último commit era el merge de S3-03 (PR #30).
`git merge-base --is-ancestor 410e76f develop` terminó con código 0, y
`git ls-remote origin refs/heads/develop` confirmó el SHA inicial también en el
remoto. No se modificaron `develop`, `main` ni otras ramas.

Se revisaron estructura de archivos, README principal/backend/frontend/BD,
documentación de preparación y verificación, documentos S3-01 a S3-05 relevantes,
scripts y configuración TypeScript/Vite/Playwright/CI, dependencias y pruebas,
controladores/servicios/módulos NestJS, validaciones, AuthGuard Supabase, filtro de
errores, DatabaseService/transacciones, SQL base y migraciones. Se revisaron
contrato, esquemas, SQL, ejemplos, validadores y pruebas S3-02; adaptador,
configuración, módulo, ejecutor y pruebas S3-03; e integración S3-04/Sprint 2.

No hay `AGENTS.md` en el repositorio ni en los directorios padre consultados.
No se encontró en el workspace el documento independiente «Plan detallado de
trabajo para los Sprints 2, 3 y 4». Se utilizaron la solicitud proporcionada y las
responsabilidades explícitas de la documentación S3-02/S3-03 disponible. No se
inventaron requisitos adicionales de ese documento ausente.

Hallazgos de alcance: `analisis_ia` ya admite estados pendiente/procesando/parcial/
completado/fallido, pero no tenía diario por grupo ni servicio HTTP. `hallazgos`
solo tiene un resultado de origen, carece de categoría/severidad y necesita la
extensión N:M de S3-08. Se implementó únicamente el diario operativo, manteniendo
la persistencia de hallazgos y aprobación/historias fuera de S3-07.

Entorno observado: Windows/PowerShell, Node `v25.9.0`, npm `11.12.1`, dependencias
locales ya instaladas. No se cambiaron versiones, locks ni configuración CI.

## Línea base ejecutada

Antes de escribir código:

| Comando | Resultado observado |
|---|---|
| `npm test` | 126 backend + 29 frontend aprobadas; 0 fallidas/omitidas |
| `npm run build` | TypeScript backend y Vite frontend correctos |

La regresión inicial de navegador también terminó con `4 passed`, código 0.
Su ejecución comenzó durante la auditoría y acabó después de las primeras
adiciones de backend, sin cambios de frontend.

## Resultados finales ejecutados

| Comprobación | Aprobadas | Fallidas | Omitidas | Resultado |
|---|---:|---:|---:|---|
| `npm test`: backend | 163 | 0 | 0 | Incluye regresión S3-01/02/03/04 y Sprint 2 |
| `npm test`: frontend | 29 | 0 | 0 | Lógica y contratos existentes |
| S3-07 dentro de la suite backend | 37 | 0 | 0 | Subconjunto de las 163; no sumar otra vez |
| `npm run test:e2e --prefix frontend` | 4 | 0 | 0 | Chromium, Auth/API controladas; código 0 |
| `npm run build` | — | — | — | TypeScript y Vite correctos; código 0 |
| `git diff --check` | — | — | — | Sin errores |
| `npm run verify:ai --prefix backend -- --demo` | — | — | — | Contrato válido, borrador, sin red; código 0 |
| `npm run verify:ai --prefix backend -- --live` | — | — | — | **Pendiente**, configuración ausente; código 1 |

Total final sin duplicar: **196 pruebas automatizadas aprobadas**, cero fallidas,
cero omitidas en las suites locales. Los contenedores contados por `node:test`
están incluidos. Esto no convierte el ensayo remoto pendiente en una prueba aprobada.

Durante la implementación pasaron primero 35 y luego 36 casos S3-07. Al añadir
la comprobación del límite JSON de revisión se reprodujo una falla: HTTP 500 en
lugar de 413. Era comportamiento preexistente del filtro global: Express rechaza
el cuerpo antes del controlador con un error que no es `HttpException`.
Se corrigió exclusivamente la normalización `type='entity.too.large', status=413`,
con mensaje fijo y sin reproducir el cuerpo privado. Se añadieron comprobaciones
unitaria y HTTP. La regresión completa y las compilaciones se repitieron después
de la corrección con los resultados finales anteriores. No quedan fallas conocidas
introducidas por esta implementación.

## Cobertura nueva y evidencia

- Selección estricta 1..100, grupos de 50, duplicados, tipos, BIGINT mayor que 2^53,
  máximo BIGINT, JSON malformado y excesivo, campos desconocidos, IDs inexistentes.
- SQL canónico S3-02 sobre el esquema real: otro plan, sesión abierta, sin
  consentimiento, evaluación pendiente, texto vacío y fechas ausentes. No se
  selecciona silenciosamente un subconjunto.
- Cinco rutas NestJS con AuthGuard global real. Solo se controla la respuesta de
  `getUser`: 401 por token ausente/vencido, 403 por correo ajeno/no confirmado.
  Consulta/revisión/ejecución/reintento quedan aislados por plan.
- Preparación idempotente por plan/UUID, revisión exacta previa, rechazo de banderas
  y relaciones del cliente, mantenimiento de origen y copia canónica del servidor.
- Respuestas atómicas: borrador válido, categoría/severidad inválida, origen ajeno,
  cobertura incompleta, PII y estado de aprobación automática rechazado.
- Adaptador S3-03 real con transporte controlado: JSON inválido, timeout, fallo de
  red, configuración ausente, disabled y proveedor no disponible. Se ocultan
  mensajes privados, trazas y respuestas inválidas. Se conserva la advertencia demo.
- Todos los estados, avance consultable mientras el proveedor está pendiente,
  bloqueo de concurrencia por análisis y plan, respaldo del índice único de BD.
- Dos grupos con uno fallido: se conserva la respuesta válida, se reintenta solo
  el fallido y no se duplica el aceptado. Máximo de tres intentos y respuesta 409
  después del límite. Repetir un completado no invoca de nuevo al proveedor.
- Reinicio **simulado con una nueva instancia de servicio**, mismo diario
  PostgreSQL y reserva vencida. Recupera el estado sin memoria anterior; conserva
  el primer grupo y reintenta el restante. No se afirmó reinicio de un servidor
  remoto ni de un proceso real de PostgreSQL.
- Una reserva vencida no sobrescribe el resultado confirmado por una nueva.
  Un fallo de BD al guardar el segundo grupo conserva el primero y permite recuperar
  el diario. Cambios de fuente o revocación de consentimiento impiden otro envío.
- Migración ejecutada dos veces sobre registros previos; conserva datos antiguos.
  La regresión de esquema también aplica todas las migraciones repetidas.
- Se verifica que `hallazgos` e `historias` siguen vacías en la BD desechable y
  que el análisis no modifica las observaciones originales.

Las pruebas de SQL y persistencia usan PGlite desechable; solo se adapta el
transporte de BD. Servicios, controladores, guard, filtro y SQL son los reales.
No se aplicó la migración ni se cargaron fixtures en Supabase compartido.

## Gemini y verificaciones pendientes

Se comprobó sin imprimir valores que no existen `backend/.env` ni clave Gemini en
las variables del proceso. El script demo informó `modo=demo`, `intentos=0`,
`estado=completado`, `respuesta=borrador`, cero hallazgos, y advirtió que no realiza
análisis. Su evidencia fechada fue `2026-11-18T16:54:11.854Z`.

El script `--live` informó literalmente:

```text
PENDIENTE | Configura IA_MODE=gemini, IA_MODEL y GEMINI_API_KEY en backend/.env.
```

Terminó con código 1 antes de enviar al proveedor. **No se verificó Gemini real
en esta entrega**, ni se infiere éxito de la evidencia anterior de Pablo. Las
pruebas nuevas usan dobles o transporte controlado; no consumen cuota Gemini.
La ausencia de credenciales se trata según la excepción explícita de la solicitud:
no impide publicar una rama que supera las verificaciones locales obligatorias.

Antes de activar en el entorno del equipo:

1. Aplicar la migración S3-07 sobre la BD de desarrollo, configurar Auth y las
   variables privadas ya definidas por S3-03, sin subir `.env`.
2. Ejecutar `npm run verify:ai --prefix backend -- --live` con la configuración
   válida: envía una sola observación ficticia. Guardar únicamente evidencia segura.
3. Preparar, revisar y ejecutar las rutas con token autorizado y datos de
   desarrollo; consultar el resultado tras reconectar.
4. Verificar concurrencia desde varios procesos contra PostgreSQL real y el
   timeout del proxy. PGlite no acredita conexiones PostgreSQL independientes,
   TLS, Supabase Auth remoto ni concurrencia multiproceso real.
5. Coordinar con S3-08 el consumo de los borradores, su relación N:M y revisión
   humana. No introducir historias aprobadas mediante esta API.

## Archivos e integridad

Creados (10):

- `backend/src/analisis-ia/analisis.controller.ts`
- `backend/src/analisis-ia/analisis.dto.ts`
- `backend/src/analisis-ia/analisis.module.ts`
- `backend/src/analisis-ia/analisis.service.ts`
- `backend/src/analisis-ia/analisis.types.ts`
- `backend/migrations/20261118000000_s3_07_ejecuciones_ia.sql`
- `backend/test/s3-07-analisis.test.cjs`
- `backend/test/s3-07-integracion.test.cjs`
- `docs/sprint3/S3-07_API_ANALISIS_IA.md`
- `docs/sprint3/S3-07_VERIFICACION.md`

Modificados (5): `backend/src/app.module.ts`, `backend/src/api-error.filter.ts`,
`README.md`, `backend/README.md`, `database/README.md`.

El filtro compartido solo cambia para devolver correctamente 413 ante JSON
excesivo; el módulo raíz solo registra `AnalisisModule`. Los README enlazan la
API y aclaran la migración requerida también en instalaciones nuevas. Frontend,
S3-02/S3-03, dependencias, locks, esquemas de hallazgos/historias y configuración
compartida permanecen sin cambios. No se incorporan secretos, `.env`, dependencias,
generados, trazas, archivos temporales ni cambios ajenos.

Los commits de esta entrega se pueden consultar con
`git log --oneline f4a06c1..HEAD`. La publicación se limita a la rama autorizada;
el resultado efectivo del push, los SHA finales y el estado del árbol se informan
al terminar, después de esta verificación. No se crea PR ni se fusionan ramas.

Recomendación: implementación validada localmente, preparada para revisión humana
de Manuel y posterior decisión sobre PR. La activación compartida conserva los
pendientes externos descritos; no se presenta como una integración remota aprobada.
