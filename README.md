# Usability Test Dashboard · Grupo 6

Proyecto de Interacción Humano–Computador: preparación de pruebas, participantes anónimos, ejecución de tareas, resultados y evidencias. React + Vite consume la API NestJS; el backend utiliza PostgreSQL y un bucket privado de Supabase Storage.

## Estado

- Sprint 2: planes y tareas; sesiones, consentimiento y cupos; cronómetro, resultados, recuperación de borradores y evidencias compartidas.
- Sprint 3 / S3-04: [API privada de indicadores y filtros](docs/sprint3/S3-04_API_INDICADORES.md) basada en S3-01, con reporte general y por tarea. [Verificación y pendientes](docs/sprint3/S3-04_VERIFICACION.md).
- Sprint 3 / S3-03: [adaptador de Gemini](docs/sprint3/S3-03_PROVEEDOR_IA.md), modos disabled/demo/gemini, clave solo en backend, limites, reintentos y validacion S3-02. [Comprobacion y activacion real](docs/sprint3/S3-03_VERIFICACION.md).
- Sprint 3 / S3-07: [API privada de análisis y estados](docs/sprint3/S3-07_API_ANALISIS_IA.md), revisión de privacidad, grupos, borradores y reintentos recuperables. Requiere su migración operativa. [Verificación y pendientes](docs/sprint3/S3-07_VERIFICACION.md). Las pantallas, persistencia de hallazgos y aprobación de historias corresponden a las actividades siguientes.
- Integración y activación de esta rama: [PREPARACION_SPRINT_3.md](docs/PREPARACION_SPRINT_3.md).

## Requisitos e instalación

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
