# S4-07 - Informe Markdown y PDF

Responsable: William Martinez. HU-11. Requiere S4-06 y S3-08.
Ruta `/informes`; desde una comparacion valida puede usarse el enlace de exportar.
Elegir plan, periodo [desde,hasta) por cierre y secciones. Preparar vista previa,
comprobar y descargar Markdown/PDF. Se usan las mismas filas y textos de una
instantanea en memoria de diez minutos; cambiar filtros invalida la vista previa.
Reinicio o caducidad: error controlado que solicita preparar otra. Maximo 20
instantaneas por proceso; no quedan archivos privados en el repositorio o disco.

Endpoints privados:
- POST /api/informes/previsualizar: plan_id, desde?, hasta?, secciones.
- GET /api/informes/:reporteId/markdown o /pdf: attachment y Cache-Control no-store.

Secciones: resultados, hallazgos, historias, comparacion. Solo hallazgos aprobados
con todos sus origenes dentro del periodo, del plan y de sesiones elegibles.
Historias: exclusivamente las vinculadas a esos hallazgos aprobados. Historias
manuales y borradores no se presentan como aprobados. No se exportan identidades,
correos de participantes, Auth, evidencias privadas ni observaciones originales.
Se redactan identificadores directos en textos editables; se conservan los IDs
de trazabilidad y fechas estructuradas. Revisar nombres/direcciones antes de compartir.

Para comparacion incluir su configuracion S4-06, con A identica al alcance del
informe. Si no hay datos comparables, se omite esa seccion con aviso. Las dos
fuentes y periodos, pares y exclusiones quedan explicitos. Los indicadores no
mezclan resultado sin ayuda, con ayuda y no completado.

PDFKit 0.21.0 es dependencia exclusiva del backend, fijada en package-lock.
Fuentes DejaVu incluidas con su licencia; no requieren instalar fuentes ni
navegadores en el servidor. Se soportan acentos espanoles, tablas y paginacion.
Limites controlados: 100 tareas, 200 hallazgos/historias, Markdown 256 KiB,
PDF 200 paginas/4 MiB. Un exceso solicita reducir el alcance, sin truncarlo.

Instalar dependencias con npm ci --prefix backend; compilar y ejecutar como
el README. Pruebas HTTP/SQL y descargas, periodo y origen mixto, PII, BIGINT,
snapshot, errores y PDF largo. Las referencias PDF son datos tecnicos de prueba,
no resultados de sesiones de usabilidad S4-09.
