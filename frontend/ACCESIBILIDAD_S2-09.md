# S2-09: estados y accesibilidad del flujo de planes y sesiones

Revisión del 11/10/2026 sobre las pantallas de `develop` (planes, sesiones y ejecución). Herramienta: `axe-core` 4.10.2 con las reglas WCAG 2.0/2.1/2.2 A y AA más buenas prácticas, ejecutado en el navegador sobre una API simulada. Las verificaciones de teclado se hicieron enviando eventos de teclado a la página.

## Resultado automático (axe)

| Pantalla | Antes | Después |
| --- | --- | --- |
| `/planes` | sin violaciones | sin violaciones |
| `/planes/nuevo` | contraste ×3 | sin violaciones |
| `/planes/:id` | contraste ×5 | sin violaciones |
| `/sesiones`, `/sesiones/nueva`, `/sesiones/:id` | sin violaciones | sin violaciones |
| `/sesiones/:id/ejecutar` | sin violaciones | sin violaciones |
| `/resultados` | sin violaciones | sin violaciones |
| `/planes/nuevo` y `/sesiones/nueva` con errores de validación visibles | — | sin violaciones |

## Lista de verificación

| # | Criterio de S2-09 | Estado | Evidencia / corrección |
| --- | --- | --- | --- |
| 1 | Etiquetas persistentes, ayudas breves y mensajes de error específicos | Corregido | Nueva sesión ahora tiene ayuda visible del código anónimo (antes solo un `placeholder`) y mensajes por campo. En el asistente, cada error queda asociado a su campo con `aria-invalid` y `aria-describedby`. |
| 2 | Teclado, orden de foco y foco visible | Corregido / parcial | Al fallar la validación el foco va al primer campo con error (asistente y nueva sesión). El modal de confirmación mueve el foco al botón seguro, lo mantiene dentro (Tab y Mayús+Tab), se cierra con Escape y devuelve el foco a quien lo abrió. Foco visible: ya definido en `styles.css` (`:focus-visible`). Falta una pasada manual completa solo con teclado. |
| 3 | Asociación entre etiquetas y campos | Cumple | Todos los campos están dentro de su `<label>`; axe no reporta `label`. |
| 4 | Contraste y legibilidad | Corregido | Texto de ayuda, subtítulos del paso y rótulos del resumen del plan pasaron de 3,9–4,3:1 a 5,4:1 o más (color `#52667a`). |
| 5 | Estados comunicados con texto, no solo con color | Cumple | Estados de sesión y plan con texto («En curso», «Cerrada», «Cupo completo»); resultados de tarea con texto; guardado y error con símbolo y texto. |
| 6 | Estados vacío, cargando, guardado y error | Cumple | Vacío y error con reintento en planes y sesiones; cargando con `role="status"`; guardado y error de red en la ejecución con región `aria-live`. Mensajes de carga más específicos en Nueva sesión. |
| 7 | Confirmaciones antes de cerrar o descartar | Cumple | Cancelar el asistente, eliminar tarea, reiniciar cronómetro y cerrar sesión piden confirmación. |

## Pendiente (no se puede cerrar todavía)

- **Evidencias (S2-08, Jonathan):** aún no existe; la revisión de carga de archivos (progreso, error, texto alternativo) debe hacerse cuando esté en `develop`.
- **Lector de pantalla:** no se probó con NVDA/Narrador; axe no detecta todo. Hace falta una pasada manual.
- **Recorrido solo con teclado de punta a punta** y con datos reales (API de S2-06 y base de Supabase): se verificó por partes contra una API simulada.
- El asistente mantiene los mensajes de error dentro del `<label>` del campo, por lo que forman parte de su nombre accesible. Funciona, pero conviene sacarlos del `<label>` en una mejora futura.
