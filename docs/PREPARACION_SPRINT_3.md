# Correcciones previas al Sprint 3

Base revisada: `b20a43e8b935751387c884493c799760e736986c` de `develop`.
Rama propuesta: `fix/pre-sprint-3-integracion-seguridad`.

## Cambios

1. Evidencias nuevas en Supabase Storage privado en lugar del disco de cada backend. Apertura autenticada y URL firmada de descarga por 60 segundos. No se distribuyen claves administrativas al navegador.
2. Carga/eliminación de evidencias valida sesión en curso y consentimiento con el mismo orden de bloqueo que guardar/cerrar resultados. Los resultados base de evidencias quedan incompletos hasta que se registre la evaluación.
3. La interfaz solo cuenta evaluaciones completas; bloquea cerrar si hay borradores modificados o cronómetros en marcha. Un plan sin tareas muestra un aviso en lugar de fallar.
4. Resultados y evidencias muestran fallos reales de consulta y reintento. Resultados descarta respuestas de sesiones anteriores.
5. Recepción multipart limitada a 15 MB; validación de extensión, MIME, tamaño real y firma. Los enlaces exigen HTTP(S), hostname y ausencia de credenciales. Estas comprobaciones no sustituyen un antivirus.
6. Inicio de sesión con Supabase Auth, renovación gestionada por su SDK y autorización del equipo por correo confirmado. Todas las rutas NestJS requieren token. No hay rutas de aplicación públicas ni registro público en la interfaz.
7. TLS PostgreSQL verifica certificados. Las tareas no pueden modificarse después de iniciar una sesión del plan, para conservar los resultados históricos.
8. Esquemas sincronizados, semillas repetibles, configuración sin datos de proyecto concretos, documentación vigente y CI de pruebas/compilación.
9. Eliminación de metadatos y cola de limpieza de Storage en la misma transacción. Si Storage falla, la limpieza permanece pendiente y puede reintentarse. No existe una transacción distribuida entre PostgreSQL y Storage: un corte abrupto durante la subida puede dejar un objeto sin metadatos; revisar periódicamente el bucket. El script de migración conserva originales.

## Activación sobre el Supabase del equipo

Estos pasos requieren acceso al Dashboard y a la configuración privada del equipo; no se aplican desde las pruebas automáticas.

### 1. Base de datos

Ejecuta en orden las tres migraciones de `backend/migrations`, luego `database/03_storage_supabase.sql`. No borres ni recrees las tablas de producción. Verifica:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name = 'planes' AND column_name = 'cupo'
    OR table_name = 'resultados' AND column_name = 'con_ayuda'
    OR table_name = 'evidencias' AND column_name IN ('nombre_archivo', 'tamano_bytes', 'mime_type'));
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'evidencias';
SELECT COUNT(*) AS pendientes FROM public.storage_deletions;
```

### 2. Variables y cuentas

- Actualiza los `.env` locales a partir de sus ejemplos sin compartir secretos en capturas, Git o frontend.
- Backend: `DATABASE_URL`, `DATABASE_SSL=true`, CA si corresponde, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=evidencias`, `AUTH_ALLOWED_EMAILS` y origen React.
- Frontend: URL API, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Usa Node.js 22.12 o superior. Ejecuta `npm ci` en backend y frontend para instalar sus lockfiles.
- Crea las cuentas necesarias en **Authentication → Users**, con correo confirmado y contraseña. Las invitaciones a la organización del Dashboard no crean estas cuentas de aplicación.
- Mantén deshabilitado el registro público en la configuración de Auth si solo el equipo utilizará la aplicación. La API también restringe por `AUTH_ALLOWED_EMAILS`, incluso si existe otra cuenta en Auth.
- La clave secreta permite operar Storage desde el backend; no la coloques en ninguna variable `VITE_`.
- Si la URI PostgreSQL contiene opciones SSL, el backend las reemplaza por la configuración TLS verificada de `DATABASE_SSL`/`DATABASE_CA_CERT`. Usa la CA oficial del proveedor cuando sea necesaria.

### 3. Migrar evidencias físicas existentes

En el equipo que conserva los archivos originales:

1. Configura `LEGACY_EVIDENCE_ROOT` con la carpeta que contiene `uploads/evidencias` antiguos. Normalmente es la carpeta `backend` del equipo que recibió los archivos.
2. Desde la raíz del repositorio, ejecuta:

```powershell
npm run storage:migrate --prefix backend
```

Este modo solo valida y enumera registros. No sube archivos ni cambia rutas. Si hay archivos ausentes, recupéralos desde el equipo original. No inventes archivos ni sustituyas evidencia perdida.

3. Tras revisar la salida, aplica:

```powershell
npm run storage:migrate --prefix backend -- --apply
```

Sube cada archivo válido, cambia su ruta únicamente si el registro no cambió y conserva el original en disco. Volver a ejecutar omite las rutas ya migradas. Las evidencias antiguas que no hayan migrado muestran un mensaje explícito en la aplicación. Los enlaces externos no requieren migración.

4. Reintenta eliminaciones pendientes periódicamente:

```powershell
npm run storage:cleanup --prefix backend
```

### 4. Comprobación integrada obligatoria antes de iniciar el Sprint 3

- Cuenta autorizada: puede consultar y guardar. Cuenta ajena o petición sin token: 403/401.
- Crear plan con dos tareas; recargar y recuperar sus datos.
- Crear sesión, confirmar consentimiento, iniciar, registrar resultados y recuperar avance.
- Subir una evidencia antes de guardar su evaluación y recargar: esa tarea sigue pendiente.
- Guardar ambas tareas; modificar una observación sin guardar; ir al resumen: cierre bloqueado y borrador conservado.
- Guardar cambios y cerrar: no permite volver a editar resultados ni evidencias por API.
- Desde otra máquina con backend propio y la misma configuración, abrir la evidencia subida: debe descargarse desde Storage.
- Simular pérdida de red: las consultas muestran error/reintento, no una lista vacía falsa.
- Verificar los tiempos y errores registrados con lo esperado y conservar evidencia del ensayo real.

## Verificación automatizada

`npm test` ejecuta contratos/HTTP, autorizaciones, validación de archivos, límites multipart, ciclo de sesiones, limpieza compensatoria y transacciones. `schema.test.cjs` ejecuta esquema, migraciones repetidas, semillas y servicios contra PostgreSQL embebido (PGlite). Comprueba también actualización desde un esquema anterior. Este motor no valida concurrencia multiproceso ni los certificados de Supabase.

`npm run build` compila ambos componentes. `npm run test:e2e --prefix frontend` prueba Chromium con red controlada: login, evaluación incompleta, recuperación de borradores, cierre bloqueado, errores de consulta y respuestas fuera de orden. No son pruebas contra Supabase real.

## Alcance siguiente

Los indicadores, análisis de IA, revisión humana de hallazgos, backlog y Scrum corresponden a las actividades siguientes. Esta corrección prepara su base; no implementa esas tareas ni declara validado un entorno remoto sin comprobarlo.
