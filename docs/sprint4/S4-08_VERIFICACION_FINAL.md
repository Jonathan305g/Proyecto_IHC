# Verificacion de la entrega S4-01 a S4-08

Base remota: develop 922a934ec953e6cbc821e02ad87695e47afd86b5.
Fecha: 27/11/2026. Entorno de desarrollo: Node 24 y Chromium 158.
Version candidata: 0.4.0-rc.1. Identificacion exacta: MANIFIESTO de la entrega y
git rev-parse HEAD en el repositorio donde se incorporen los parches.

## Alcance de las comprobaciones

- HTTP NestJS con PostgreSQL PGlite, migraciones repetidas, RLS y FK indexadas.
- Contratos privados, equipo autorizado, referencias del mismo plan y BIGINT.
- Planificacion, capacidad, responsables, tareas, cambios de estado y recarga.
- Borradores de cierre, acuerdos, rollback, snapshot y retorno al backlog.
- Comparacion con dos conjuntos manuales, ausencia de datos y distintas coberturas.
- Exportacion de estados aprobados y alcance completo del origen, privacidad,
  instantanea compartida, PDF/Markdown, caducidad y limites de salida.
- Recorrido integrado desde plan y sesion hasta IA, aprobacion, backlog, sprint,
  cierre, comparacion y dos descargas; limpieza conserva registros ajenos.
- Chromium: formularios, filtros, errores, aprobacion, tablero, acuerdos,
  descargas, navegacion con borrador y foco al mover por teclado.
- PDF de una y cinco paginas revisados visualmente y con extraccion de texto.

El registro ejecutable se genera con npm run verify:sprint4 en
verification-results/sprint4/verificacion.json, con fecha, revision, arbol y
codigo de salida de cada etapa. Los conteos finales se incluyen en LEEME_PRIMERO
y los README del ZIP despues de ejecutar la comprobacion completa.

## Limites y activacion

Auth remoto y transporte Gemini se controlan en pruebas automaticas; SQL, HTTP,
transacciones y render PDF son reales. UI usa respuestas API controladas. Esto
no constituye una sesion de usabilidad ni una llamada al Gemini del equipo.
La configuracion privada existente se conserva y las migraciones S4 se aplican
en el entorno compartido cuando el equipo incorpore los cambios. El script de
ensayo remoto se entrega, requiere --apply y no se ejecuta automaticamente.

No se incluyeron S4-09/S4-10: el usuario decidio posponerlas hasta contar con
datos de pruebas reales. La version evaluable deja preparado su punto de partida.
