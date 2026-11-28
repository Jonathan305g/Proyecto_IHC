# S4-06 - Comparar evaluaciones registradas

Responsable: Pablo Lozada. HU-12. Reutiliza S3-01/S3-04, sin otra definicion de exito.
Ruta `/comparacion`. Evaluacion = plan + periodo opcional de cierre de sesiones.
Puede comparar dos planes o dos periodos distintos del mismo plan; no la misma
seleccion consigo misma. El periodo es [desde,hasta), como el dashboard.

POST privado `/api/comparaciones`:
`{a:{plan_id,desde?,hasta?},b:{plan_id,desde?,hasta?},equivalencias:[{tarea_a,tarea_b}]}`.
Equivalencias explicitamente uno a uno. No se infieren por titulo ni orden.
Validar con el equipo que las tareas y el protocolo son conceptualmente equivalentes.
Solo sesiones cerradas, consentimiento y resultados elegibles conforme al SQL S3.
Ambos reportes se leen en una transaccion de solo lectura y snapshot repetible.

El agregado incluye solo pares con evaluados>0 en ambos lados. Las exclusivas y
los pares sin registros se identifican y no entran en ese agregado. Coberturas,
esperados, evaluados y n de tiempo/errores permanecen visibles. Coberturas o
denominadores distintos generan un aviso; no se interpreta una mejora causal.
Tasas = cantidad/evaluados; tiempo y errores conservan categoria y n propios.
Se suman totales y denominadores, nunca se promedian porcentajes de tareas.
Variacion = B-A; tasas en puntos porcentuales, tiempos en segundos. NULL no es cero.

## Referencias calculadas manualmente

| Tarea | A | B |
|---|---|---|
| Guardar | sin ayuda 60s/1error; con ayuda 90s/2errores | sin ayuda 40s/0errores y 60s/1error |
| Buscar | no completado 120s/3errores; sin ayuda tiempo NULL y 0 errores | sin ayuda 10s/0errores; con ayuda 20s/1error |

Solo Guardar: exito sin ayuda 50% -> 100% = +50 pp; tiempo 60 -> 50 = -10s;
errores 1 -> 0.5 = -0.5. Con ayuda B no tiene medidas, por tanto diferencia NULL.
Guardar+Buscar: exito sin ayuda 2/4 -> 3/4 = +25pp. Tiempo autonomo A=60/1;
B=110/3=36.67; variacion -23.33s. Errores A=1/2=.5, B=1/3=.33; variacion -.17.
Tareas exclusivas se excluyen. Un periodo sin sesiones devuelve sin_comparables,
sin agregado y sin inventar variacion. Los casos son datos tecnicos de referencia,
no sesiones con participantes ni evidencia de mejora del sistema.
