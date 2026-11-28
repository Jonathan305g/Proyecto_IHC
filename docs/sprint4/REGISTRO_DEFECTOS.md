# Registro de integracion Sprint 4

| ID | Caso y evidencia | Correccion y repeticion | Estado |
|---|---|---|---|
| INT-01 | La primera migracion S4-02 rechazo una expresion CASE de trigger | Expresion parentetizada; repetir DDL, API y claves foraneas en PGlite | Corregido en S4-02 |
| INT-02 | Selectores exactos de campos anidados incluian texto de opciones/textarea despues de recuperar | Etiquetas accesibles explicitas; repetir activar tablero y recuperar review en Chromium | Corregido en S4-03/05 |
| INT-03 | Datos iniciales del fixture insertados con ID manual dejaban la secuencia de historias en 1 | Sincronizar la secuencia solo en el fixture; repetir exportacion y flujo integrado | Corregido en pruebas S4-07 |
| INT-04 | El foco salia de la tarjeta al moverla entre columnas mediante teclado | Restaurar foco despues de la confirmacion; prueba Chromium y capturas antes/despues | Corregido en S4-08 |
| INT-05 | Navegar desde una review sin guardar descartaba el formulario sin confirmacion | Bloqueo de navegacion y aviso de recarga en review y planificacion; probar enlaces y Atras | Corregido en S4-08 |
| INT-06 | Revision de codigo: comparacion del informe abria otro snapshot de lectura | Compartir transaccion con indicadores y datos aprobados; repetir exportacion e integracion | Corregido en S4-08 |
| INT-07 | Revision de codigo: --check podia aceptar cinco tablas aunque faltaran las de cierre | Exigir los nombres y RLS de todas las tablas esperadas segun migraciones presentes | Corregido en S4-08 |

Los defectos anteriores proceden de integracion tecnica, no de sesiones con
usuarios. Los hallazgos de S4-09 y sus mejoras S4-10 se agregan con identificador,
evidencia y version cuando se ejecuten. No se crea evidencia de participantes.
