# Evidencia tecnica de correcciones de integracion

Capturas de Chromium con Auth/API de prueba, sin participantes ni datos privados.

| Caso | Antes | Despues |
|---|---|---|
| QA-01: foco al mover tarea | El select de la tarjeta no recuperaba foco despues de confirmar el movimiento | Foco visible y prueba toBeFocused aprobada |
| QA-02: salida desde review | Se navegaba al tablero perdiendo el comentario sin guardar | Dialogo permite seguir editando o salir explicitamente |

Las carpetas antes/despues contienen las capturas de esos puntos del recorrido.
Se observaron dos fallos antes de corregir y ambos casos aprobaron despues.
La regresion agrega Atras del navegador y aviso de recarga de planificacion.
Estas comprobaciones pertenecen a S4-08. No se atribuyen a S4-09 ni a participantes.
