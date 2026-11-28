# Usability Test Dashboard · Grupo 6

Proyecto de Interacción Humano–Computador: preparación de pruebas, participantes anónimos, ejecución de tareas, resultados y evidencias. React + Vite consume la API NestJS; el backend utiliza PostgreSQL y un bucket privado de Supabase Storage.

## Estado

- Sprint 2: planes y tareas; sesiones, consentimiento y cupos; cronómetro, resultados, recuperación de borradores y evidencias compartidas.
- Sprint 3 / S3-04: [API privada de indicadores y filtros](docs/sprint3/S3-04_API_INDICADORES.md) basada en S3-01, con reporte general y por tarea. [Verificación y pendientes](docs/sprint3/S3-04_VERIFICACION.md).
- Sprint 3 / S3-03: [adaptador de Gemini](docs/sprint3/S3-03_PROVEEDOR_IA.md), modos disabled/demo/gemini, clave solo en backend, limites, reintentos y validacion S3-02. [Comprobacion y activacion real](docs/sprint3/S3-03_VERIFICACION.md).
- Sprint 3 / S3-07: [API privada de análisis y estados](docs/sprint3/S3-07_API_ANALISIS_IA.md), revisión de privacidad, grupos, borradores y reintentos recuperables. Requiere su migración operativa. [Verificación y pendientes](docs/sprint3/S3-07_VERIFICACION.md). Su consumo por la interfaz y la persistencia de revision se integran en S3-08, S3-09 y S3-10.
- Sprint 3 / S3-08: [hallazgos e historias persistentes](docs/sprint3/S3-08_HALLAZGOS_HISTORIAS.md), origen N:M, aprobacion atomica, UUID de reintento y orden durable. Aplicar su migracion.
- Sprint 3 / S3-09: [revision humana](docs/sprint3/S3-09_REVISION_HUMANA.md) en `/revision`, con privacidad, edicion, descarte y aprobacion explicita.
- Sprint 3 / S3-10: [backlog de mejoras](docs/sprint3/S3-10_BACKLOG_MEJORAS.md) en `/backlog`, creacion manual, origen, edicion, filtros y orden persistente. [Verificacion integrada](docs/sprint3/S3-10_VERIFICACION.md).
- Integración y activación de esta rama: [PREPARACION_SPRINT_3.md](docs/PREPARACION_SPRINT_3.md).

## Sprint 4 - Version evaluable (S4-01 a S4-08)

| Tarea | Funcionalidad y documentacion |
|---|---|
| S4-01 | [Planificacion de sprints](docs/sprint4/S4-01_PLANIFICACION.md), capacidad y seleccion de historias |
| S4-02 | [API y persistencia Scrum](docs/sprint4/S4-02_SERVICIOS_SCRUM.md), responsables y estados |
| S4-03 | [Tablero accesible](docs/sprint4/S4-03_TABLERO.md), tareas y avance |
| S4-04 | [Review, retrospectiva y cierre](docs/sprint4/S4-04_CIERRE_PERSISTENTE.md) con historial |
| S4-05 | [Vistas de cierre](docs/sprint4/S4-05_VISTAS_CIERRE.md) y acuerdos |
| S4-06 | [Comparacion de evaluaciones](docs/sprint4/S4-06_COMPARACION.md) por tareas equivalentes |
| S4-07 | [Exportacion Markdown y PDF](docs/sprint4/S4-07_EXPORTACION.md) de datos aprobados |
| S4-08 | [Instalacion e integracion](docs/sprint4/S4-08_INTEGRACION.md), verificacion y candidata evaluable |

Rutas nuevas: `/sprints`, `/comparacion`, `/informes`. Las tablas `producto_*`
gestionan sprints del producto y se mantienen separadas de las tareas academicas.
Aplicar las migraciones S4 tras S3-08 usando `migrate-sprint4.cjs` como indica la
guia de instalacion. `npm run verify:sprint4` comprueba la version integrada.
Las sesiones con participantes y los ajustes derivados corresponden a S4-09/S4-10,
que quedan fuera de esta entrega por decision del equipo.

## Instalacion local

Node.js **22.12 o superior**, npm y un proyecto Supabase. Desde la raíz:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Completa ambos `.env` con los datos de tu proyecto. Las claves secretas y la URI PostgreSQL pertenecen exclusivamente al backend. Si ya tienes `.env`, actualízalo manualmente sin sobrescribirlo.

1. Crea o actualiza la BD siguiendo [database/README.md](database/README.md).
2. Crea el bucket privado ejecutando `database/03_storage_supabase.sql` en Supabase.
3. Prepara las cuentas de aplicación en **Supabase → Authentication → Users** (correo/contraseña y correo confirmado). Incluye los correos permitidos en `AUTH_ALLOWED_EMAILS` del backend. Estas cuentas son independientes de las invitaciones al Dashboard de Supabase. El frontend no ofrece registro público.
4. Configura `SUPABASE_URL`, clave pública y clave secreta en backend; solo URL y clave pública en frontend. El bucket predeterminado es `evidencias`.
5. Si ya existen archivos locales, sigue la migración de evidencias en la guía de preparación.

Dos terminales desde la raíz:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Abre `http://localhost:5173` e inicia sesión con una cuenta autorizada. La API escucha normalmente en `http://localhost:3000/api`. `npm run dev` inicia únicamente el frontend.

## Verificación

```powershell
npm test
npm run build
npm run test:e2e --prefix frontend
```

Antes de la primera prueba de navegador: `cd frontend`, `npx playwright install chromium`, y vuelve a la raíz. Las pruebas de navegador usan API y Auth controladas; las pruebas SQL usan PostgreSQL embebido sin credenciales de producción. La conexión, TLS, cuentas y Storage del proyecto real se verifican con el procedimiento de integración de la guía.

Con los `.env` privados completos, comprobar el entorno y ejecutar el ensayo remoto:

```powershell
npm run verify:environment
npm run verify:live -- --apply
```

El segundo comando crea datos temporales propios y los retira al terminar. Un resultado `PENDIENTE` o un código de salida distinto de cero impide declarar el entorno validado. Consulta [Validación del entorno del Sprint 3](docs/VALIDACION_ENTORNO_SPRINT_3.md) para configurar las cuentas, conocer el alcance y revisar los pendientes de acceso de esta entrega.

## Seguridad y mantenimiento

- Todas las rutas API requieren un token válido de Supabase Auth y un correo autorizado. CORS no sustituye autenticación.
- Bucket privado, sin políticas de acceso público; descargas mediante enlaces firmados de 60 segundos.
- Se comprueban extensión, MIME, firma del archivo y límite de 15 MB desde la recepción multipart. La firma identifica el formato; no es un análisis antivirus.
- Sesiones cerradas conservan evaluaciones y evidencias sin permitir su modificación mediante la API.
- Las tareas del plan se congelan al iniciar su primera sesión para no alterar las evaluaciones existentes.
- TLS verifica el certificado PostgreSQL. Usa `DATABASE_CA_CERT` si el proveedor requiere su CA; no desactives la verificación.
- Ejecuta periódicamente `npm run storage:cleanup --prefix backend` para reintentar eliminaciones pendientes. Los errores de Storage no se confunden con listas vacías en la interfaz.

## Git Flow

Crear ramas desde `develop`, abrir PR hacia `develop` y reservar `main` para versiones entregables.
