# Base de datos · PostgreSQL / Supabase

## Archivos oficiales

| Archivo | Uso |
|---|---|
| `01_esquema.sql` | Instalación nueva. 14 tablas del dominio y la cola técnica `storage_deletions`; índices, claves foráneas, restricciones y RLS. |
| `schema.sql` | Copia de compatibilidad idéntica a `01_esquema.sql`; una prueba impide que diverjan. |
| `02_datos_ejemplo.sql` | Datos ficticios opcionales para desarrollo. Repetible; no registra archivos inexistentes. |
| `03_storage_supabase.sql` | Solo Supabase: crea/configura el bucket privado `evidencias` (15 MB). |
| `../backend/migrations/` | Actualización incremental de instalaciones existentes. |

## Instalación nueva

1. Ejecuta `01_esquema.sql` desde SQL Editor con el rol administrador de tu proyecto.
2. Ejecuta `03_storage_supabase.sql`.
3. Opcionalmente, carga `02_datos_ejemplo.sql` en una BD de desarrollo. Los registros DEMO son ficticios.
4. Configura el backend según el README principal. El esquema no carga credenciales ni crea cuentas de Auth.

## Actualizar la base que ya usa el equipo

Conserva los datos existentes y aplica en orden:

1. `../backend/migrations/001_s2_06_ejecucion_sesiones.sql` (cupo y ayuda).
2. `../backend/migrations/002_s2_08_evidencias.sql` (metadatos de archivos).
3. `../backend/migrations/003_pre_sprint3_storage_cleanup.sql` (cola de eliminación).
4. `../backend/migrations/20261101165559_pre_sprint3_indices_claves_foraneas.sql` (ocho índices para claves foráneas).
4. `03_storage_supabase.sql` (bucket privado).

Estas migraciones son repetibles. Ejecutar de nuevo un `CREATE TABLE IF NOT EXISTS` no actualiza las columnas de una tabla existente: para actualizar utiliza las migraciones. El backend no ejecuta DDL durante el arranque.

## Seguridad

Las tablas públicas tienen RLS habilitado y no incluyen políticas públicas de lectura/escritura. React utiliza Auth y la API NestJS; no consulta estas tablas directamente. La conexión privilegiada de NestJS puede evitar RLS, por eso cada petición API exige token verificado y correo autorizado. RLS por sí solo no protege una API administrativa expuesta.

Los archivos se almacenan en el bucket privado. `evidencias.ruta` contiene `supabase://<objeto>` para archivos nuevos o una URL HTTP(S) para enlaces. Las rutas locales anteriores requieren el script de migración explicado en `../docs/PREPARACION_SPRINT_3.md`.

## Alcance del modelo

Planes, tareas, participantes, sesiones, resultados y evidencias forman el núcleo actual. `analisis_ia`, `hallazgos`, `historias`, `miembros`, `sprints`, `revisiones_sprint`, `retrospectivas` y `acuerdos_retrospectiva` preparan las siguientes actividades. Tener sus tablas no implica que sus funcionalidades estén desarrolladas.
