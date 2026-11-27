# Verificacion integrada S3-08, S3-09 y S3-10

Fecha: 27/11/2026. Base inicial develop: ce5efb945f2d7b149d62fb3320ccc100dd7b4500.
Versiones del proyecto conservadas; no se modificaron package.json ni locks.

## Resultados ejecutados

| Comprobacion | Resultado |
|---|---|
| npm test: backend | 178 aprobadas, 0 fallidas, 0 omitidas |
| npm test: frontend | 41 aprobadas, 0 fallidas, 0 omitidas |
| npm run build | TypeScript y Vite correctos |
| Navegador Chromium | 14 aprobadas, 0 fallidas (4 previas, 5 S3-09, 5 S3-10) |
| Total de pruebas sin duplicar | 233 aprobadas |

Entorno: Node 24 y Chromium 158. La instalacion local del navegador estandar
estaba incompleta y su descarga por CDN fue rechazada. Se uso un ejecutable
Chromium de pruebas desde un paquete del registro npm, fuera del repositorio,
mediante CHROMIUM_EXECUTABLE_PATH. No se agrego ese paquete como dependencia ni
se modifico Playwright/CI. El equipo puede instalar el Chromium habitual de su
version Playwright con el comando documentado en los README.

## Criterios del plan y evidencia

| Tarea y criterio | Comprobacion |
|---|---|
| S3-08: modelo y relaciones | Migracion repetida, legado conservado, RLS, relacion N:M del mismo plan y BIGINT mayor que 2^53 |
| S3-08: editar/aprobar/descartar | API HTTP real; versiones, criterio requerido, decisiones explicitas y rechazo de cambios de aprobados |
| S3-08: historias y orden | Crear/editar/consultar, prioridad/puntos/estado, reorden completo y persistencia con nueva instancia |
| S3-08: no duplicar | Importar de nuevo conserva edicion; aprobar de nuevo devuelve la misma historia; UUID manual y conflicto de contenido |
| S3-08: fallo de escritura | Se fuerza un fallo al insertar historia y se confirma rollback de la aprobacion |
| S3-09: contraste y edicion | Chromium muestra originales/propuesta; guardar borrador, recargar y recuperar la edicion |
| S3-09: decisiones humanas | Motivo de descarte, cancelacion/confirmacion, aprobacion con criterio y enlace a historia |
| S3-09: fallos parciales/repeticion | Mensajes por grupo; reintento solo fallidos; confirmacion perdida y consulta sin duplicar |
| S3-10: listado/formulario | Validacion, creacion manual, edicion y origen visible |
| S3-10: filtros persistentes | Estado/prioridad en URL, recarga y restablecimiento |
| S3-10: orden durable | Subir/bajar, recarga, conflicto de version y restriccion de orden parcial filtrado |
| S3-10: recorrido desde IA | Aprobar, consultar historia, localizar en backlog y abrir hallazgo/observacion de origen |

## Correcciones encontradas durante la verificacion

La primera ejecucion de navegador no pudo iniciar por ausencia del binario.
Tras disponer de Chromium, los nueve casos previos/S3-09 pasaron. En S3-10 se
detectaron dos fallos con la misma causa: el formulario nuevo recibia `null`
y la funcion de borrador esperaba un objeto. Se normalizo ese valor y se agrego
la regresion. La ejecucion final completa termino con las 14 pruebas aprobadas.

## Limites de la evidencia

Los tests backend ejecutan controladores NestJS, SQL, transacciones, contrato y
adaptador con PostgreSQL PGlite desechable. Auth remoto y transporte Gemini se
controlan; ninguna prueba necesita secretos ni cuota externa. Las pruebas de UI
usan respuestas API controladas que conservan estado entre recargas dentro del
caso. No se confunde ese estado con persistencia en Supabase: esa parte se
comprueba con SQL en el backend y se valida contra el entorno compartido al instalar.

El ZIP aporta codigo implementado, pruebas e instrucciones por tarea. No acredita
que las ramas ya se hayan publicado, que los PR se hayan fusionado ni que la nueva
migracion se haya aplicado sobre la BD del equipo. Esas acciones se realizan en
el orden S3-08, S3-09, S3-10 indicado en sus README.
