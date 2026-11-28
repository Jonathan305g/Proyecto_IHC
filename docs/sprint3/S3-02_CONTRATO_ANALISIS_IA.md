# S3-02 - Contrato de análisis de observaciones con IA

Responsable: William Martínez. Historia: HU-06. Versión: **1.0**.
Base independiente: `develop` en `e83ea3b`. Dependencia de inicio: S2-06.
Entrega: selección de fuentes, instrucción, dos JSON Schema, validador ejecutable,
ejemplos y verificación. Este contrato desbloquea S3-03 y S3-07 a S3-10.

## 1. Qué información se analiza

Cada observación nace del campo `public.resultados.observaciones` y conserva como
origen el ID de resultado, representado como `resultado:123`. El ID es BIGINT
positivo en cadena decimal; se conserva exacto incluso por encima de 2^53.
Cada solicitud pertenece a un solo plan y contiene entre 1 y 50 observaciones.

Son elegibles resultados evaluados de sesiones cerradas con consentimiento,
inicio/cierre presentes y fechas coherentes, con observación no vacía. Se envían
las observaciones seleccionadas expresamente, incluso de tareas completadas:
un éxito puede contener una dificultad. No se crea una observación para cada
archivo; las evidencias no multiplican las fuentes.

`seleccionar_observaciones.sql` recibe plan e IDs y devuelve los textos originales
solo al servidor/persona autorizada. `comprobarSeleccion(ids,filas)` debe ejecutarse
después: rechaza selecciones vacías, repetidas, ajenas, no elegibles o inexistentes.
Si una selección de diez IDs recupera nueve, se devuelve un error controlado antes
de llamar al proveedor. Las verificaciones de acceso siguen en el AuthGuard.

## 2. Privacidad y contexto mínimo

Una persona autorizada revisa el texto, elimina nombres, direcciones, contactos y
datos personales innecesarios, y entrega `observacion_revisada` junto con
`privacidad_revisada=true`. La API futura debe derivar esa revisión de una acción
autorizada en el servidor; una bandera enviada por un cliente no acredita por sí
sola la revisión. El texto original se conserva para trazabilidad y revisión interna.

`prepararSolicitud` exige esa revisión y proyecta exclusivamente:

| Campo enviado | Propósito |
|---|---|
| `version` | Contrato 1.0 |
| `plan_id` | Mantener un único contexto de evaluación |
| `observaciones[].id` | Vínculo exacto al resultado de origen |
| `tarea.id` | Identificar la tarea del resultado |
| `tarea.titulo` | Interpretar la acción evaluada, hasta 150 caracteres |
| `tarea.criterio_exito` | Contexto de éxito o NULL, hasta 500 caracteres |
| `resultado` | sin_ayuda, con_ayuda o no_completado |
| `texto` | Observación revisada, hasta 2000 caracteres |

La proyección descarta nombres/correos de integrantes, código o ID de participante,
ID de sesión, enlaces de Storage, archivos, claves, metadatos del navegador y
cualquier otra propiedad de la fuente. No se envía el objetivo completo del plan.

Como defensa adicional, `redactarDatosDirectos` sustituye correos, teléfonos o
secuencias numéricas largas, IP, URLs, claves con prefijo Supabase y tokens de
tres segmentos. También se aplica a título y criterio. Esta redacción puede
suprimir números/URLs legítimos; la persona debe revisar el sentido del texto.
No detecta todos los nombres, direcciones ni información identificable por contexto:
la revisión humana de privacidad sigue siendo obligatoria. El validador rechaza
identificadores directos evidentes en solicitudes que omitan la preparación y
en respuestas; sus errores no reproducen contenido sensible.

## 3. Instrucción y esquema

Archivos canónicos en `backend/contracts/s3-02/`:

- `instruccion.md`: instrucción completa en español, criterios y forma de salida.
- `solicitud.schema.json`: entrada estricta JSON Schema draft 2020-12.
- `respuesta.schema.json`: salida estricta del proveedor.
- `ejemplos/`: solicitud válida y respuestas válidas/incorrectas reproducibles.

`crearMensajes` produce dos mensajes: `system` con la instrucción y `user` con
el JSON de la solicitud. Los textos de observaciones, títulos y criterios son
datos no confiables: una orden incrustada nunca debe incorporarse al rol system.
El prompt exige basarse en hechos recibidos, expresar incertidumbre, no inventar
frecuencia/impacto y no producir decisiones de aprobación ni historias.

### Respuesta válida de referencia

```json
{
  "version": "1.0",
  "estado": "borrador",
  "hallazgos": [{
    "observacion_ids": ["resultado:1"],
    "resumen": "La confirmación de guardado no fue reconocible.",
    "categoria": "retroalimentacion",
    "severidad": "media",
    "mejora_sugerida": "Mostrar una confirmación textual visible después de guardar."
  }],
  "observaciones_sin_hallazgo": ["resultado:2"]
}
```

| Categoría | Criterio |
|---|---|
| navegacion | Ubicación, recorrido o acceso a opciones |
| comprension | Consignas, etiquetas o modelo mental |
| accesibilidad | Barreras visuales, motoras, teclado o apoyo |
| retroalimentacion | Estado, confirmaciones y mensajes |
| eficiencia | Esfuerzo o pasos innecesarios |
| prevencion_errores | Validación y recuperación de acciones equivocadas |
| contenido | Información ausente, ilegible o poco útil |
| otro | Problema observable fuera de las anteriores |

| Severidad | Regla basada en lo observado |
|---|---|
| baja | Fricción menor y recuperación fácil, sin bloqueo observado |
| media | Esfuerzo adicional; la tarea puede completarse |
| alta | Bloqueo importante o necesidad de ayuda en una tarea relevante |
| critica | Flujo esencial imposible de completar sin recuperación observada |

Se permite agrupar varios orígenes del mismo problema; también describir problemas
diferentes a partir de una observación. Cada hallazgo contiene 1..50 IDs únicos.
Todos deben pertenecer a la selección exacta de esta solicitud. Las observaciones
sin problema accionable figuran en `observaciones_sin_hallazgo`; esta lista es
única y disjunta de los IDs usados por hallazgos. La unión debe cubrir toda la
entrada. Es válida una respuesta con cero hallazgos si todos los IDs aparecen
en esa lista. No se acepta omitir una fuente silenciosamente.

Hasta 100 hallazgos; resumen 1..1000 caracteres, mejora 1..1500, ambos con texto
no blanco. Campos desconocidos, coerciones de tipos y estados distintos de
`borrador` se rechazan. El máximo serializado es 128 KiB para entrada y 256 KiB
para salida. Los límites de tokens/costo del proveedor corresponden a S3-03.

## 4. Validación y errores controlados

Módulo: `backend/src/analisis-ia/contrato.ts`. Usa Ajv2020 8.20.0 fijado en
package.json/lock; no transforma valores ni elimina campos durante la validación.
`validarRespuesta(raw,solicitud)` valida JSON, esquema, PII evidente, origen,
cobertura completa y hallazgos exactamente duplicados (incluye orden alterno de IDs).
No extrae JSON desde Markdown ni repara salidas incompletas.

La función devuelve `{ok:true,data}` o `{ok:false,error:{code,message,details}}`.
`details` contiene solo ruta y regla, con un máximo de diez elementos. No devuelve
el JSON bruto, claves, contactos ni enlaces firmados en errores.

| Código | Causa / acción del llamador |
|---|---|
| IA_SIN_OBSERVACIONES | Selección vacía o textos revisados vacíos; no llamar al proveedor |
| IA_PRIVACIDAD_PENDIENTE | Falta revisión autorizada de privacidad |
| IA_SOLICITUD_INVALIDA | Entrada con tipos/campos/textos inválidos |
| IA_LIMITE_EXCEDIDO | Tamaño o cantidad superior al límite |
| IA_JSON_INVALIDO | JSON malformado, Markdown o contenido no serializable |
| IA_ESQUEMA_INVALIDO | Campo faltante, extra, enumeración inválida o aprobación automática |
| IA_ORIGEN_INVALIDO | ID inválido, ajeno, repetido o inexistente |
| IA_COBERTURA_INCOMPLETA | Hay fuentes seleccionadas sin representación |
| IA_COBERTURA_INVALIDA | Una fuente figura con y sin hallazgo |
| IA_HALLAZGO_DUPLICADO | Repetición exacta de una propuesta |
| IA_DATOS_PERSONALES | Identificadores directos evidentes en entrada o salida |

S3-07 debe adaptar el error al formato HTTP actual `{code,message,details}`:
400/INVALID_REQUEST para selección/entrada/privacidad inválida; para salida del
proveedor, 422 con un error de análisis controlado. Si usa `ApiErrorFilter`, el
código específico IA_* se conserva en `details[].rule`, pues el filtro normaliza
el `code` HTTP. Un error de contrato no se guarda como hallazgo válido.

## 5. Integración prevista y responsabilidades

Secuencia de referencia para Pablo y Manuel:

```ts
const seleccion = comprobarSeleccion(idsSolicitados, filasRecuperadas)
if (!seleccion.ok) return seleccion
const solicitud = prepararSolicitud(planId, fuentesRevisadas)
if (!solicitud.ok) return solicitud
const mensajes = crearMensajes(solicitud.data)
if (!mensajes.ok) return mensajes
// S3-03: enviar mensajes.data al proveedor con timeout/límites/reintento controlado.
// S3-07: recibir raw y validar antes de devolver o persistir.
const respuesta = validarRespuesta(raw, solicitud.data)
if (!respuesta.ok) return respuesta
// S3-08: persistir exclusivamente como pendiente de revisión humana.
```

La solicitud canónica y la lista exacta de IDs se conservan en el servidor para
validar la respuesta correspondiente. No validar contra otra selección ni contra
todos los IDs que existan en la BD. No usar user_metadata para autorizar análisis.

Pablo / S3-03: adaptar estos mensajes y esquemas al proveedor; timeout, errores
de conexión, límites y reintentos acotados son parte de su tarea. Cualquier modo
de demostración debe identificarse explícitamente; los ejemplos de contrato no
acreditan una llamada a un proveedor real.

Manuel / S3-07: aplicar AuthGuard, selección SQL completa, preparación, validación
y estados operativos pendiente/procesando/completado/parcial/fallido. La respuesta
del modelo sigue siendo borrador incluso cuando la ejecución termina completada.
Cada grupo se valida de forma atómica: si una respuesta es inválida se rechaza
todo ese grupo. En un análisis con varios grupos se conservan los grupos válidos
y se reintentan únicamente los fallidos. No reparar ni aceptar parte de un JSON inválido.

Pablo / S3-08: `hallazgos.estado='pendiente'` corresponde al borrador del contrato.
`mejora_sugerida` corresponde al actual `hallazgos.sugerencia`. Categoría/severidad
y el vínculo N:M con orígenes requieren la extensión de persistencia prevista
en S3-08: `resultado_id` solo permite un origen y no debe perder los demás si se
agrupan. Conservar el texto revisado/versionado como base del análisis; una edición
posterior de la observación no debe alterar la trazabilidad histórica. La aprobación
explícita y la deduplicación persistente de historias pertenecen a S3-08/S3-09.

Jonathan / S3-09: mostrar origen y propuesta juntos, permitir corrección humana,
guardar borrador, descartar y aprobar explícitamente. Solo esa acción puede crear
una historia; la validación estructural no demuestra que el contenido sea verdadero.
Emilio / S3-10: incorporar al backlog únicamente las historias creadas por ese flujo.

## 6. Casos y comprobación reproducible

```powershell
npm ci --prefix backend
npm run build --prefix backend
node --test backend/test/s3-02-*.test.cjs
npm test --prefix backend
```

Se verifican 15 archivos de respuesta: correcta, incompleta, origen inexistente,
cobertura incompleta, aprobación automática, severidad/categoría inválidas, texto
vacío, campo extra, cobertura contradictoria, origen repetido, hallazgo duplicado,
PII, ausencia justificada de hallazgos y JSON malformado. Hay un ejemplo adicional
de selección vacía que debe devolver IA_SIN_OBSERVACIONES sin llamar al proveedor.

Las pruebas cubren proyección mínima y revisión de privacidad, límites,
identificadores BIGINT, no modificación del original, separación system/user,
rechazo de campos desconocidos y SQL real con datos de otro plan, sesión abierta,
sin consentimiento, textos vacíos, resultado pendiente y fechas ausentes.
Ninguna prueba de este entregable necesita claves ni realiza llamadas a un modelo.

## Referencias técnicas

- JSON Schema 2020-12: https://json-schema.org/draft/2020-12/json-schema-validation
- Ajv, soporte draft 2020-12: https://ajv.js.org/json-schema.html
- Ajv, validación y opciones: https://ajv.js.org/options.html
- Plan de trabajo Grupo 6: S3-02, S3-03 y S3-07 a S3-10.
