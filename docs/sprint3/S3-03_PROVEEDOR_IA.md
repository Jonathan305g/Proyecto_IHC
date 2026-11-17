# S3-03 — Conectar el proveedor de IA

Fecha: 17/11/2026. Responsable del plan: Pablo Lozada. HU-06.
Implementación preparada como apoyo del equipo. Base: `develop` en `11deafc`.

## Entrega

Adaptador de servidor `backend/src/analisis-ia/proveedor.ts`, compatible con el
contrato S3-02 1.0. Gemini Developer API es el proveedor implementado, mediante
`fetch` de Node 22; no requiere nuevas dependencias. El modelo se configura
explícitamente según los modelos habilitados en la cuenta, con soporte de
generateContent y respuestas JSON estructuradas. No se presupone disponibilidad ni saldo.

La operación `analizar(solicitud)` devuelve:

```ts
{ ok: true, data: RespuestaIA, meta: { estado, modo, proveedor, modelo, intentos, advertencia? } }
// o
{ ok: false, error: { code, message, details }, meta: { ... } }
```

`data` conserva exactamente la forma canónica de S3-02. Los metadatos del proveedor
se mantienen fuera del JSON del modelo. Ninguna ejecución guarda, aprueba ni crea
historias. S3-07 implementará los endpoints autenticados y sus estados; S3-08 la
persistencia. S3-03 no incorpora una pantalla de análisis.

## Configuración del servidor

Agregar a `backend/.env`, tomando `backend/.env.example` como referencia:

| Variable | Valor / límite |
|---|---|
| `IA_MODE` | `disabled` por defecto, `demo` u `gemini` |
| `GEMINI_API_KEY` | Clave privada del proyecto Google AI Studio; solo backend |
| `IA_MODEL` | `gemini-3.5-flash-lite` por defecto; configurable segun disponibilidad de la cuenta |
| `IA_TIMEOUT_MS` | 15000 por intento; entero entre 10 y 60000 |
| `IA_TOTAL_TIMEOUT_MS` | 30000 para todos los intentos y esperas; entre 10 y 120000 |
| `IA_MAX_RETRIES` | 1 adicional por defecto; 0 a 2 (máximo 3 envíos) |
| `IA_MAX_OUTPUT_TOKENS` | 4096 por defecto; 128 a 8192 |

No agregar estas variables a `frontend/.env` ni usar prefijos `VITE_` para ellas.
La clave no se devuelve, registra ni incorpora a los mensajes del modelo.
El destino HTTPS está fijado a `https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`; no acepta
URLs suministradas por usuarios ni sigue redirecciones. La clave viaja en la cabecera `x-goog-api-key`, nunca en la URL.
El proyecto del equipo esta en nivel gratuito segun su captura de AI Studio;
este codigo no cambia ni activa su facturacion. En esa modalidad Google puede
utilizar contenido para mejorar sus productos: usar textos ficticios o revisados
sin informacion personal, conforme a S3-02.

`disabled` devuelve IA_DESHABILITADA sin acceso a red. `demo` devuelve una respuesta
de contrato vacía, con todos los orígenes representados y advertencia explícita.
La demo **no analiza ni descarta problemas de usabilidad**; permite probar el
transporte interno del contrato. Nunca debe presentarse como análisis real.
Una falta de clave o fallo del modo `gemini` nunca activa la demo automáticamente.

## Solicitudes y validación

Antes de llamar, S3-07 debe comprobar acceso, selección SQL completa y revisión
humana de privacidad, y usar `prepararSolicitud` de S3-02. Una solicitud canónica
validada no acredita por sí misma permisos sobre sus IDs. No aceptar directamente
del cliente banderas de autorización o revisión de privacidad.

El adaptador copia la solicitud, valida límites, PII evidente y orígenes antes de
transmitir. Usa los mensajes system/user de S3-02. Solicita JSON Schema estricto:
estructura, campos obligatorios, categorias, severidad y estado borrador,
mediante `generationConfig.responseMimeType=application/json` y `responseJsonSchema`.
La proyección de esquema para el proveedor omite limites de longitud,
patrones y unicidad; conserva limites de cantidad, y convierte `const` en `enum`, para mantener un subconjunto
estructural compatible. **Ajv aplica después todas las restricciones originales**,
incluidos tamanos, IDs, PII evidente, cobertura y duplicados; el contrato no se flexibiliza.

Solo se acepta un candidato con `finishReason=STOP`. Se concatenan sus partes
de texto final y se excluyen partes `thought`; no se aceptan llamadas a herramientas.
`MAX_TOKENS` y bloqueos `promptFeedback`/seguridad generan errores controlados. Se rechazan
negativas, respuestas incompletas y JSON malformado, sin reparación automática.
Se limita el cuerpo remoto a 512 KiB y el JSON de salida a los 256 KiB de S3-02.
La entrada conserva el límite de 128 KiB y 50 observaciones de S3-02. Estos límites
restringen cada llamada, pero no sustituyen un presupuesto o control de concurrencia
por usuario en S3-07. Las llamadas reales pueden consumir saldo de la API.

## Tiempo y política de reintento

El timeout abarca conexión y lectura del cuerpo; se cancela con AbortController.
Un presupuesto total también limita los intervalos de espera.

- Solo se reintentan HTTP 429 temporal y 500/502/503/504.
- Se respeta `Retry-After` numérico o fecha; si excede el tiempo restante no se envía
  otra solicitud. Sin cabecera válida se espera 500 ms, luego 1000 ms, con jitter de hasta 99 ms.
- Se interpreta tambien `google.rpc.RetryInfo`. Cuota diaria agotada, cuota cero
  y HTTP 402 se devuelven sin reintentos automaticos.
- Cuota agotada, acceso inválido, configuración rechazada, negativas, JSON/contrato
  inválido y otros estados HTTP no se reintentan automáticamente.
- Timeout y fallo de red tampoco se reintentan automáticamente: el proveedor pudo
  haber procesado el envío. No se promete ejecución remota exactamente una vez.
- S3-07 debe identificar los grupos y evitar crear ejecuciones concurrentes o
  persistencias duplicadas cuando una persona solicite un reintento.

## Errores para el llamador

| Código | Tratamiento |
|---|---|
| IA_DESHABILITADA | Activar expresamente un modo |
| IA_CONFIGURACION_INVALIDA | Revisar variables requeridas y límites del servidor |
| IA_CONFIGURACION_PROVEEDOR | Revisar modelo, acceso a recurso y compatibilidad del request |
| IA_ACCESO_PROVEEDOR | Revisar credencial y permisos del proyecto |
| IA_CUOTA_AGOTADA | Revisar saldo/cuota; no repetir automáticamente |
| IA_LIMITE_PROVEEDOR | Límite temporal de solicitudes tras agotar política permitida |
| IA_PROVEEDOR_NO_DISPONIBLE | Servicio remoto no disponible o HTTP no aceptado |
| IA_ERROR_CONEXION | Red/transporte; procesamiento remoto incierto |
| IA_TIEMPO_AGOTADO | Límite temporal alcanzado |
| IA_RECHAZADA | El proveedor no produjo un análisis permitido |
| IA_RESPUESTA_INCOMPLETA | Salida truncada o incompleta; revisar tamaño del grupo/límite |
| IA_RESPUESTA_INVALIDA | Envoltura del proveedor inválida |
| IA_LIMITE_EXCEDIDO | Tamaño remoto o de contrato excedido |
| IA_* de S3-02 | Error de esquema, privacidad, origen o cobertura; no persistir |

Los errores no reproducen cuerpos del proveedor, observaciones ni credenciales.
La interfaz futura debe traducirlos a mensajes comprensibles y permitir reintento
humano cuando corresponda. El estado operativo del análisis y su mapeo HTTP
pertenecen a S3-07, conservando `meta.modo` y la advertencia de demo visibles.

## Uso por S3-07

```ts
const proveedor = new ProveedorIA() // importar desde analisis-ia/proveedor
// Tras AuthGuard, comprobarSeleccion y prepararSolicitud:
const resultado = await proveedor.analizar(solicitudValidada)
if (!resultado.ok) return resultado // adaptar a error/estado de S3-07
// resultado.data sigue siendo borrador; conservar meta.modo para no confundir demo.
```

S3-07 puede importar `ProveedorIaModule` e inyectar `ProveedorIA`.
El modulo esta implementado y probado. `meta.estado` vale `completado` solo tras
validacion o demo valida; un error conserva `fallido`. Se devuelve un mensaje
comprensible y un codigo estable, listos para su presentacion por S3-07. No se activa ningún
endpoint adicional ni se requieren migraciones de Supabase para este adaptador.

## Ensayos reproducibles

Desde la raíz del repositorio:

```powershell
npm ci --prefix backend
npm test --prefix backend
node backend/scripts/verify-ai.cjs --demo
```

Con un `backend/.env` propio que contenga `IA_MODE=gemini`, `IA_MODEL` y
`GEMINI_API_KEY`, después de compilar:

```powershell
node --env-file=backend/.env backend/scripts/verify-ai.cjs --live
```

El ensayo real envía una única observación ficticia de guardado sin datos personales;
la política configurada puede efectuar los reintentos acotados descritos. No usa BD
ni registros del equipo. Informa estado, intentos y conteo, sin imprimir textos ni
claves. `--live` puede consumir saldo y es una comprobación distinta de las pruebas
aisladas. Una respuesta estructuralmente válida requiere revisión humana de calidad.

## Referencias oficiales consultadas

- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/troubleshooting


## Activacion local del equipo

Agregar o actualizar SOLO estas variables en backend/.env (sin sobrescribir las de Supabase):

```dotenv
IA_MODE=gemini
GEMINI_API_KEY=PEGAR_AQUI_LA_CLAVE_DEL_PROYECTO_IHC
IA_MODEL=gemini-3.5-flash-lite
IA_TIMEOUT_MS=15000
IA_TOTAL_TIMEOUT_MS=30000
IA_MAX_RETRIES=1
IA_MAX_OUTPUT_TOKENS=4096
```

El archivo .env sigue ignorado por Git. Reiniciar el backend tras cambiarlo.
Si el modelo no existe en la cuenta, el ensayo devuelve IA_CONFIGURACION_PROVEEDOR;
seleccionar explicitamente un modelo de texto con JSON estructurado disponible
segun AI Studio. No hay cambio automatico a otro modelo o nivel de pago.

La captura de creacion de clave prueba su existencia y nivel gratuito, pero no
acredita aun el envio desde este adaptador: la prueba real --live debe ejecutarse
con esa clave en el equipo. Su salida no contiene la clave y puede adjuntarse como
evidencia. Esta implementacion reemplaza el paquete provisional de OpenAI, que
no debe importarse ni combinarse con esta rama.
