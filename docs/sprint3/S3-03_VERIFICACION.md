# Verificacion S3-03 — Gemini

Fecha: 17/11/2026. Responsable de planificacion: Pablo Lozada (HU-06).
Rama: `feature/s3-03-gemini-pablo`, base develop `11deafc`.

## Matriz de cumplimiento y evidencia

| Punto | Implementacion y comprobacion |
|---|---|
| 1. Proveedor, acceso y clave en servidor | Gemini Developer API; GEMINI_API_KEY solo en backend; destino HTTPS fijo y cabecera privada. .env ignorado. Captura del equipo confirma clave del proyecto ihc-grupo6 en nivel gratuito. |
| 2. Adaptador, espera y limites | generateContent con systemInstruction y contents separados, JSON estructurado, timeout que incluye cuerpo, presupuesto total, limite de tokens y 512 KiB de transporte. |
| 3. Reintentos y errores controlados | Reintentos 0..2, backoff y jitter; Retry-After/RetryInfo; errores de red, acceso, cuota, servicio, bloqueo y salida invalida sin bucles ni fallback. |
| 4. Demo separada y conexion al proveedor | Modos disabled/demo/gemini explicitos; transporte y fallos controlados probados; demo local aprobada. El equipo ejecuto --live con Gemini y obtuvo APROBADO el 17/11/2026; evidencia detallada abajo. |
| Estado para el consumidor | ok, error.code/message/details y meta.estado/modo/proveedor/modelo/intentos; una salida valida siempre es borrador. Modulo Nest exportable para S3-07. |

## Pruebas ejecutadas

- `npm test --prefix backend`: **126 aprobadas, 0 fallidas** (104 existentes y 22 nuevas).
- La suite compila TypeScript antes de probar.
- `npm test --prefix frontend`: **29 aprobadas, 0 fallidas**.
- `npm run build --prefix frontend`: compilacion Vite correcta.
- `node backend/scripts/verify-ai.cjs --demo`: **APROBADO**, modo demo, 0 envios,
  meta.estado=completado, respuesta=borrador y advertencia visible.
- El comando --live sin configuracion devuelve PENDIENTE de forma controlada;
  no envia solicitudes ni usa la demo como reemplazo.
- `git diff --check`: correcto.

Los 22 casos cubren configuracion, PII previa al envio, solicitud generateContent,
JSON Schema y validacion S3-02, reintentos 429/503, Retry-After/RetryInfo, cuota
diaria/cero, acceso/red, timeout de cuerpo y global, truncamiento, bloqueos,
JSON/formatos invalidos, tamanos, copia de origenes, exclusion de razonamiento,
rechazo de herramientas/candidatos multiples, limite maximo de intentos,
proteccion de URL/clave, inyeccion en Nest y una transferencia HTTP local real.
La regresion del esquema comprueba que no se envian minItems/maxItems y que Ajv
sigue rechazando mas de 100 hallazgos, mas de 50 origenes por hallazgo, mas de
50 observaciones sin hallazgo y hallazgos sin origen; sin reenvio automatico.

## Diagnostico real del 17/11/2026

El equipo comprobo que `gemini-3.5-flash-lite` aparece en su catalogo. La llamada
real devolvio HTTP 400 `INVALID_ARGUMENT`: el esquema generaba demasiados estados
para servirlo. Se retiraron las cardinalidades de arrays solo de la proyeccion
enviada a Gemini. El contrato S3-02 permanece intacto. Tras aplicar el commit
445c3d8, las 126 pruebas pasaron tambien en el equipo. Un ensayo posterior devolvio
IA_PROVEEDOR_NO_DISPONIBLE tras dos intentos; el error se manejo sin bucles ni demo.
La repeticion de diagnostico finalmente aprobo la conexion real, como se registra abajo.

## Conexion real aprobada en el equipo

Fuente: captura de terminal proporcionada por William Martinez el 17/11/2026.
El equipo ejecuto `verify-ai.cjs --live` con un envoltorio de diagnostico que
mantiene la clave en el entorno y fija `IA_MAX_RETRIES=0` solo para ese proceso.
El envoltorio conserva el fetch real y la validacion del adaptador; no sustituye
la respuesta del proveedor. No modifica backend/.env.

Salida observada:

```text
OK | modo=gemini | intentos=1 | estado=completado | respuesta=borrador
EVIDENCIA | fecha=2026-11-17T22:19:25.987Z | modelo=gemini-3.5-flash-lite
OK | Contrato y origen validos | hallazgos=1
APROBADO | Conexion real y respuesta validadas; calidad del contenido requiere revision humana.
```

Fecha local Ecuador: 17/11/2026, 17:19:25 (UTC-05). La salida acredita una respuesta
real de Gemini aceptada por el contrato S3-02 y su validacion de origen. Se obtuvo
un hallazgo en borrador a partir de la observacion ficticia del ensayo, sin tocar BD
ni datos reales de participantes. No se afirma que esta llamada se haya ejecutado
en el entorno del asistente: se registra la evidencia aportada por el equipo.

**Resultado de S3-03: implementacion y comprobacion tecnica aprobadas.** Incluye
demo, solicitud valida al proveedor real, configuracion privada y pruebas de
fallos controlados. La revision humana de calidad sigue siendo parte del flujo
de hallazgos; una respuesta valida no equivale a una aprobacion automatica.

La subida de esta rama y su PR a develop son pasos de integracion separados;
este registro no acredita que ya hayan ocurrido.

Los endpoints y pantalla completos de analisis corresponden a S3-07; aprobacion y
persistencia de hallazgos a S3-08. La cobertura de este adaptador no acredita esas
otras tareas ni la integracion con Supabase, que no se modifica aqui.
