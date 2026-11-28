# S4-02 - Servicios de sprints del producto

Responsable: Manuel Cusme. HU-09. Base: develop 922a934.

El modulo usa `producto_*`, separado de las tareas academicas S4-01 a S4-10 y
de las tablas legadas `sprints`/`miembros`. Cada sprint pertenece a un plan.
Los responsables son alias del producto, sin requerir correos ni credenciales.

## Contrato

Prefijo `/api/planes/:planId`. Todas las rutas heredan AuthGuard y equipo autorizado.

| Ruta | Operacion |
|---|---|
| GET/POST responsables-producto | Consultar o crear alias con solicitud_id UUID v4 |
| PATCH responsables-producto/:id | Alias, activo y version; reasignar trabajo antes de desactivar |
| GET/POST sprints-producto | Listar o guardar planificacion idempotente |
| GET/PUT sprints-producto/:id | Detalle y edicion completa con version |
| POST sprints-producto/:id/activar | Activar con version; requiere historias y responsables |
| POST sprints-producto/:id/tareas | Crear tarea de una historia seleccionada; UUID y version |
| PATCH sprints-producto/:id/tareas/:tareaId | Editar titulo/responsable con version |
| POST .../tareas/:tareaId/retirar | Retirar antes de activar; body version |
| POST .../tareas/:tareaId/estado | Cambiar con version y estado |

Planificacion: nombre, objetivo, fecha_inicio/fecha_fin YYYY-MM-DD reales,
capacidad entera 0..10000 e historias [{historia_id,responsable_id}]. Crear agrega
solicitud_id; editar agrega version. IDs BIGINT son cadenas, nunca floats.
Maximo 100 historias y 500 tareas por sprint. Estimar puntos en el backlog antes
de seleccionar; no se supera capacidad ni se compromete una historia en dos
sprints abiertos. Planificacion congelada al activar. La prioridad se puede
modificar en backlog; campos comprometidos y estado se gestionan en el modulo.

Transiciones: pendiente -> en_progreso -> en_revision -> terminada; se permite
volver al paso anterior. Las tareas determinan el estado de la historia. Puntos
entregados cuentan solo historias cuyas tareas estan todas terminadas. El avance
por tareas usa otro denominador y se presenta separado. Sin denominador: null.
Las transacciones bloquean el plan y la version evita perder cambios concurrentes.
Repetir una solicitud crea el mismo registro; UUID con contenido distinto: 409.
Los eventos registran cambios, estados anteriores y nuevos.

## Instalacion

Con S3-08 instalado y backend/.env existente:

```powershell
npm run build --prefix backend
node --env-file=backend/.env backend/scripts/migrate-sprint4.cjs --apply
node --env-file=backend/.env backend/scripts/migrate-sprint4.cjs --check
```

El instalador aplica solo las migraciones S4 presentes, en orden, sin fixtures.
Las tablas tienen RLS sin politicas publicas: se accede por el backend privado.
No se aplica automaticamente ninguna migracion a Supabase al instalar el ZIP.

## Verificacion

`npm test --prefix backend`: pruebas HTTP NestJS y PostgreSQL PGlite, migracion
repetida, autenticacion, capacidad, fechas, aislamiento, UUID, edicion, conflictos,
estados y recarga. Auth se controla; no se necesitan secretos ni cuota remota.
