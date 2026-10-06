# Casos de Prueba de Aceptación — Sprint 2
**Historias:** HU-01, HU-02, HU-03  
**Elaborado por:** Pablo Lozada (Tester) y Manuel Cusme (Tester / Scrum Master)  
**Fecha:** 6 de octubre de 2026  

---

## HU-01 — Configurar Plan de Prueba

### Escenario 1: Crear plan de prueba con datos mínimos y consentimiento preparado (Caso Feliz)
- **Dado** que el usuario está en el asistente de creación de planes `/plans/new` en el Paso 1
- **Cuando** ingresa el nombre "Checkout Tienda", interfaz "Checkout Web", objetivo "Evaluar la fluidez de compra", perfil "Estudiantes universitarios", modalidad "MODERATED_IN_PERSON", cupo 5 y marca "Formulario de consentimiento preparado"
- **Y** avanza al Paso 2 y agrega 1 tarea con consigna neutral "Comprar un cuaderno A4", resultado esperado "Llegar a la pantalla de confirmación", métrica "SUCCESS_TIME", criterio de éxito "Compra finalizada en < 3 min"
- **Y** avanza al Paso 3 y presiona "Guardar e iniciar"
- **Entonces** el servidor guarda el plan con estado `READY`
- **Y** la aplicación redirige al detalle del plan habilitando la opción "Nueva sesión".

### Escenario 2: Intentar iniciar plan sin consentimiento informado preparado (RN-01)
- **Dado** que un plan tiene todos los datos obligatorios y 1 tarea completa
- **Pero** la casilla "Formulario de consentimiento preparado" está DESMARCADA (`consentReady = false`)
- **Cuando** el usuario está en el Paso 3 del asistente
- **Entonces** el botón "Guardar e iniciar" se muestra DESHABILITADO
- **Y** se visualiza el texto explicativo: "Falta preparar el consentimiento informado"
- **Y** al presionar "Guardar plan" (secundario), el plan se guarda con estado `READY` o `DRAFT` pero con `canStartSessions = false`.

### Escenario 3: Advertencia de consigna no neutral (RN-02)
- **Dado** que el usuario está creando una tarea en el Paso 2 del asistente
- **Cuando** ingresa en la consigna el texto "Haz clic en el botón Comprar"
- **Entonces** la interfaz muestra una advertencia no bloqueante
- **Y** despliega la sugerencia: "Describe el objetivo, no la ruta. Ej.: 'Compra el cuaderno A4' en lugar de 'Haz clic en el botón Comprar'".

### Escenario 4: Intentar modificar tareas en un plan con sesiones ya iniciadas (RN-04)
- **Dado** que un plan se encuentra en estado `IN_PROGRESS` con al menos 1 sesión registrada
- **Cuando** el usuario intenta agregar, eliminar, reordenar tareas o editar su `equivalenceKey`
- **Entonces** el servidor rechaza la petición con código de error HTTP 409 `TASKS_LOCKED`
- **Y** la interfaz deshabilita las acciones de reestructuración explicando que el plan tiene sesiones activas.

---

## HU-02 — Ejecutar Sesión de Prueba (Ruta Crítica)

### Escenario 1: Iniciar nueva sesión con consentimiento del participante (Caso Feliz)
- **Dado** un plan en estado `READY` con consentimiento preparado (`consentReady = true`) y cupo de 5 participantes
- **Cuando** el evaluador presiona "Nueva sesión", ingresa el perfil opcional y marca la casilla obligatoria "El participante otorgó su consentimiento"
- **Entonces** el servidor asigna el código correlativo `P-001`
- **Y** el plan cambia automáticamente a estado `IN_PROGRESS`
- **Y** se redirige a la pantalla de ejecución `/sessions/:id/run` en la Tarea 1.

### Escenario 2: Bloqueo de nueva sesión por cupo completo (RN-03)
- **Dado** un plan con `targetParticipants = 5` y 5 sesiones ya registradas
- **Cuando** el evaluador intenta crear una nueva sesión
- **Entonces** el servidor responde con error HTTP 409 `QUOTA_FULL`
- **Y** el botón "Nueva sesión" en la interfaz se deshabilita mostrando el motivo "Cupo de participantes alcanzado (5/5)"
- **Y** se destaca la acción "Continuar" en las sesiones que permanezcan abiertas.

### Escenario 3: Operación del cronómetro con tiempo del servidor (RN-08)
- **Dado** que el evaluador está en la ejecución de la Tarea 1
- **Cuando** presiona el botón "Iniciar cronómetro"
- **Entonces** el cliente envía `POST /sessions/:id/results/:taskId/timer` con `action: "start"`
- **Y** el servidor guarda `timerStartedAt = serverNow`
- **Y** si se recarga la pestaña, la interfaz consulta la sesión y reanuda el cronómetro mostrando el tiempo transcurrido exacto acumulado sin pérdidas.

### Escenario 4: Transición a revisión e intento de cierre con tareas pendientes (RN-05)
- **Dado** una sesión en ejecución con 3 tareas donde la Tarea 3 no tiene resultado asignado (`outcome = null`)
- **Cuando** el evaluador avanza a la pantalla de revisión `/sessions/:id/review`
- **Entonces** la Tarea 3 se marca explícitamente como "Pendiente"
- **Y** al intentar pulsar "Cerrar sesión", el servidor o cliente impide la acción retornando 409 `INCOMPLETE_RESULTS`
- **Y** se muestra un aviso indicando que todas las tareas deben tener un resultado registrado antes de cerrar.

### Escenario 5: Conflicto de concurrencia al guardar la sesión (RN-21)
- **Dado** que dos evaluadores tienen abierta la misma sesión `P-001` con la versión 3
- **Cuando** el Evaluador A guarda un resultado (incrementando la versión a 4)
- **Y** el Evaluador B intenta guardar una observación usando la versión 3
- **Entonces** la API responde con HTTP 409 `VERSION_CONFLICT`
- **Y** la interfaz del Evaluador B muestra el mensaje: "Otra persona actualizó esta sesión. Recarga para ver los cambios".

---

## HU-03 — Consultar Planes, Sesiones y Adjuntar Evidencias

### Escenario 1: Adjuntar archivo de evidencia válido (RN-15)
- **Dado** una sesión en estado `IN_PROGRESS`
- **Cuando** el evaluador adjunta una captura de pantalla en formato `PNG` de 2 MB
- **Entonces** el servidor verifica los bytes del archivo (MIME real `image/png`)
- **Y** guarda la evidencia asociándole un nombre UUID seguro en `UPLOAD_DIR`
- **Y** la interfaz muestra la vista previa en la galería de la sesión.

### Escenario 2: Rechazar ejecutable o archivo corrupto renombrado (RN-15)
- **Dado** una sesión en ejecución
- **Cuando** el evaluador intenta subir un ejecutable renombrado como `evidencia.png`
- **Entonces** el servidor analiza los bytes reales con `file-type`
- **Y** rechaza la carga con código HTTP 415 `INVALID_FILE_TYPE`
- **Y** la interfaz muestra el error: "Tipo de archivo no permitido. Solo se aceptan imágenes PNG, JPG, WEBP y PDF".

### Escenario 3: Cerrar un plan con sesiones en curso (RN-16)
- **Dado** un plan con 1 sesión en estado `IN_PROGRESS` o `IN_REVIEW`
- **Cuando** el investigador intenta ejecutar la acción "Cerrar plan"
- **Entonces** el servidor rechaza la petición con HTTP 409 `OPEN_SESSIONS`
- **Y** la UI explica que no se puede cerrar el plan mientras existan sesiones abiertas.
