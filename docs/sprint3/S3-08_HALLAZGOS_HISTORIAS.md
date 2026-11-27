# S3-08 — Persistir hallazgos revisados e historias

Responsable previsto: Pablo Lozada. HU-07 y HU-08. Base: develop ce5efb9.
Contrato para S3-09 y S3-10. Todas las rutas requieren AuthGuard, correo confirmado
y autorizado. El equipo comparte los planes; no se inventan propietarios por usuario.

## Modelo y reglas

- `hallazgos`: pendiente, aprobado o rechazado; categoria, severidad, criterio,
  version optimista y copia inmutable de la propuesta IA.
- `hallazgo_observaciones`: relacion N:M con resultados del mismo plan, texto
  original y texto revisado enviado al proveedor. RLS sin politicas publicas.
- La importacion solo lee grupos completados de Gemini, valida S3-02 nuevamente
  y conserva los IDs y el origen. Grupos fallidos no crean hallazgos. Las respuestas
  demo no se incorporan. No se vuelve a llamar al proveedor al importar.
- Identidad unica de propuesta `(analisis_id,grupo_id,indice_propuesta)`; reimportar
  conserva la edicion y decision humanas. Hallazgos existentes permanecen.
- Aprobar exige criterio de aceptacion y origen. Aprobacion e historia se guardan
  en una transaccion. Un reintento devuelve la misma historia, incluso tras perder
  la respuesta HTTP. No se permite descartar o editar un hallazgo ya aprobado.
- Descartar requiere un comentario; conserva el origen y no crea historia.
- Historias manuales usan UUID v4 `solicitud_id` y huella de entrada para
  reintentos idempotentes. Reusar UUID con otros datos devuelve 409.
- `version` en edicion evita sobrescribir cambios de otro miembro. Orden separado
  con `version_orden` y bloqueo del plan. Reordenar exige todos los IDs del plan.
- Prioridad 1 (mas alta) a 5; puntos sin estimar (`null`) o enteros 1..100;
  estado pendiente/en_progreso/terminada. El orden manual es independiente de
  prioridad. Maximo 1000 historias por plan; no se admite orden parcial filtrado.
- Los IDs BIGINT viajan como cadenas. No se evalua HTML ni se ejecuta texto de IA.

## Endpoints (prefijo /api/planes/:planId)

| Metodo y ruta | Uso |
|---|---|
| GET observaciones-ia | Hasta 1000 fuentes elegibles para seleccion y revision de privacidad |
| GET analisis-ia | Ultimos 100 analisis S3-07; no ejecuta el proveedor |
| POST analisis-ia/:id/hallazgos | Importar borradores validos, cuerpo `{}` |
| GET hallazgos | Filtros opcionales estado y analisis_id |
| GET hallazgos/:id | Propuesta inicial, revision actual, observaciones N:M e historia |
| PUT hallazgos/:id | Guardar borrador con version, resumen, categoria, severidad, mejora_sugerida y criterio_aceptacion |
| POST hallazgos/:id/aprobar | Version, titulo, prioridad y puntos; crea/devuelve la misma historia |
| POST hallazgos/:id/descartar | Version y comentario obligatorio |
| GET historias | `{plan_id,version_orden,historias}`; filtros opcionales estado/prioridad |
| GET historias/:id | Detalle con hallazgo y observaciones de origen, o hallazgo=null si manual |
| POST historias | solicitud_id UUID v4, titulo, descripcion, criterio_aceptacion, prioridad, puntos y estado |
| PATCH historias/:id | Version y campos editados; no permite cambiar origen/plan/orden |
| PUT historias/orden | `{version_orden,historia_ids:["3","1","2"]}` completo y sin duplicados |

Ejemplo de borrador:

```json
{"version":1,"resumen":"Confirmacion poco visible","categoria":"retroalimentacion","severidad":"media","mejora_sugerida":"Mantener la confirmacion en pantalla","criterio_aceptacion":"Al guardar se muestra el resultado de la operacion."}
```

Errores: 400 entrada/seleccion invalida, 401/403 acceso, 404 registro ajeno o
inexistente, 409 cambio concurrente/decision previa/configuracion de analisis,
413 cuerpo excesivo y 500 fallo interno normalizado. Una peticion fallida no
transforma silenciosamente un hallazgo en aprobado.

## Instalacion y comprobacion

El esquema base no se vuelve a cargar encima de la BD del equipo. Aplicar la
migracion S3-07 y despues `20261127000000_s3_08_hallazgos_historias.sql`.
El script preserva la configuracion TLS de DatabaseService:

```powershell
npm ci --prefix backend
npm test --prefix backend
node --env-file=backend/.env backend/scripts/migrate-review.cjs --apply
npm run dev:backend
```

La migracion es repetible y conserva registros previos. Historias legadas sin
hallazgo ni plan se conservan sin asignar: no se atribuyen a un plan al azar.
La API nueva opera sobre historias con plan, evitando mezclar backlogs.

## Evidencia de desarrollo

La prueba `s3-08-backlog.test.cjs` ejecuta NestJS HTTP real con guard, servicios,
contrato, adaptador y PostgreSQL PGlite desechable. Controla solo Auth remoto y
el transporte de Gemini; no usa claves del equipo ni consume cuota. Comprueba
migracion repetida/legado/RLS, N:M, BIGINT, importacion, edicion, rollback de
aprobacion, duplicados, descarte, filtros, orden, concurrencia optimista y rechazo
de relaciones SQL incorrectas. Una nueva instancia de servicio recupera lo guardado.
La aplicacion de la migracion y el ensayo con Supabase del equipo se realizan al
instalar; no se presenta esa operacion remota como ejecutada por esta entrega.
