# S4-03 - Tablero y responsables

Responsable: Jonathan Gamboa. HU-09. Requiere S4-02 y S4-01 integrados.
Abrir un tablero desde `/sprints`, ruta `/sprints/:id/tablero?plan_id=ID`.

Cuatro columnas con tareas, historia, puntos y responsable. Controles select y
botones nativos operables por teclado; no se exige arrastrar. Crear y editar
tareas con responsable del mismo plan. Antes de activar se pueden retirar.
Activacion con confirmacion; la API valida seleccion, responsables y version.
Estado y porcentajes provienen del detalle del servidor. El cliente conserva
el ultimo estado confirmado ante error y permite actualizar para resolver una
respuesta perdida o conflicto. No se inventa avance con porcentajes locales.

S4-02 registra eventos y sincroniza estado del backlog. Los puntos de una
historia se entregan cuando todas sus tareas terminan; no se suman puntos por
tarjeta. La planificacion y el tablero recuperan las mismas historias guardadas.
Los sprints cerrados quedan de consulta; el cierre se incorpora en S4-04/05.

Verificacion Chromium: activacion, movimiento con teclado, progreso, recarga,
edicion y cambio rechazado sin mover la tarjeta. SQL/HTTP real: S4-02.
