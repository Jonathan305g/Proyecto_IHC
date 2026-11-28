# S4-01 - Planificacion de sprints

Responsable: William Martinez. HU-09. Requiere S4-02 integrado y migrado.
Ruta `/sprints?plan_id=ID`. El menu dice Sprints del producto.

Crear responsables por alias, estimar historias en Backlog y abrir Nuevo sprint.
Guardar objetivo, fechas, capacidad e historias seleccionadas con responsables.
La suma de puntos se calcula con la seleccion; sin estimar no equivale a cero.
El formulario bloquea exceso de capacidad, conserva datos ante fallos y reutiliza
el UUID para un reintento. Cancelar cambios requiere confirmacion accesible.
Se recupera la planificacion por API para editar; la version evita sobrescrituras.
Las fechas y referencias se vuelven a validar en el servidor. Antes de activar
se pueden quitar historias; si tienen tareas, retirarlas primero en el tablero.

Pruebas: dominio de puntos/IDs, Chromium con crear, recuperar, editar, quitar,
capacidad insuficiente y error de guardado. La API se controla en navegador;
la persistencia SQL real se comprueba en S4-02.
