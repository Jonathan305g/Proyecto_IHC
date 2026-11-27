# S3-10 — Crear y priorizar el backlog de mejoras

Responsable previsto: Emilio Abril. HU-08. Cierre despues de S3-08 y S3-09.
La ruta `/backlog` consume las historias persistentes de S3-08. No agrega tablas,
dependencias, claves ni un almacenamiento alternativo en React.

## Funciones

- Elegir el plan y consultar titulo, prioridad, puntos, estado, orden y origen.
- Crear una historia manual con titulo, descripcion y criterio obligatorios;
  prioridad 1..5 y puntos sin estimar o 1..100. UUID v4 estable por formulario
  para no duplicar la creacion si se pierde la confirmacion y se reintenta.
- Editar con version optimista. El formulario conserva lo escrito ante error;
  un conflicto no sobrescribe la version del servidor.
- Cancelar cambios locales exige confirmacion cuando el formulario fue modificado.
- Filtrar por estado y prioridad. Los filtros y el plan se conservan en la URL
  al recargar; no se guardan observaciones privadas en almacenamiento del navegador.
- Subir y bajar historias con botones accesibles. Envia todos los IDs y
  version_orden; espera confirmacion del servidor antes de presentar otro orden.
- El orden de trabajo es manual e independiente de prioridad. Con filtros activos
  se deshabilita reordenar; Restablecer filtros permite ordenar el conjunto completo.
- Las historias de IA muestran el hallazgo y permiten consultar su revision y las
  observaciones originales. Las manuales se identifican como Manual.
- El detalle de una historia ofrece Localizar en el backlog y destaca su fila.
- Vacio, cargando, guardado y error no se confunden. Un fallo de consulta no
  aparece como backlog vacio; se ofrece actualizar/reintentar.

## Recorrido del incremento

1. Abrir Revision de IA y elegir un plan con observaciones de sesiones cerradas.
2. Preparar, revisar privacidad, analizar e importar grupos validos, o recuperar
   un analisis previo. La clave y el modelo siguen en backend/.env.
3. Contrastar origen/propuesta, editar, guardar y confirmar Aprobar y añadir al backlog.
4. Abrir Ver historia y Localizar en el backlog. Comprobar el origen.
5. Crear una historia manual, editar prioridad/puntos/estado, filtrar y recargar.
6. Restablecer filtros, mover historias y recargar para comprobar el orden.

Las nuevas rutas son privadas y los .env existentes permanecen intactos. Si no se
aplicaron las migraciones S3-07/S3-08, hacerlo primero con el script documentado
en S3-08; no reemplazar el esquema completo ni cargar datos de prueba en Supabase.

## Verificacion automatizada

Consultar [S3-10_VERIFICACION.md](S3-10_VERIFICACION.md). El recorrido de navegador
usa Auth y API controladas; la persistencia, rollback, integridad y duplicados se
verifican con NestJS y PostgreSQL embebido real de S3-08. No se afirma haber
ejecutado esta version contra la BD compartida ni realizado una llamada nueva a Gemini.
