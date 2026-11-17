# Verificacion S3-03 — Gemini

Fecha: 17/11/2026. Responsable de planificacion: Pablo Lozada (HU-06).
Rama: `feature/s3-03-gemini-pablo`, base develop `11deafc`.

## Matriz de cumplimiento y evidencia

| Punto | Implementacion y comprobacion |
|---|---|
| 1. Proveedor, acceso y clave en servidor | Gemini Developer API; GEMINI_API_KEY solo en backend; destino HTTPS fijo y cabecera privada. .env ignorado. Captura del equipo confirma clave del proyecto ihc-grupo6 en nivel gratuito. |
| 2. Adaptador, espera y limites | generateContent con systemInstruction y contents separados, JSON estructurado, timeout que incluye cuerpo, presupuesto total, limite de tokens y 512 KiB de transporte. |
| 3. Reintentos y errores controlados | Reintentos 0..2, backoff y jitter; Retry-After/RetryInfo; errores de red, acceso, cuota, servicio, bloqueo y salida invalida sin bucles ni fallback. |
| 4. Demo separada y conexion al proveedor | Modos disabled/demo/gemini explicitos; pruebas del transporte Gemini con respuestas controladas; demo local ejecutada. La llamada externa con clave del equipo necesita el ensayo --live. |
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
enviada a Gemini. El contrato S3-02 permanece intacto. Hace falta repetir --live
con esta correccion para acreditar que el proveedor acepta la peticion.

## Evidencia externa que debe completar el equipo

No hay una clave Gemini accesible en este entorno. La captura de una clave
oculta no permite autenticar una solicitud. No se afirma haber ejecutado una
llamada externa ni se declara cerrado al 100 % ese criterio sin comprobarlo.

En el backend local, completar las variables documentadas y ejecutar desde raiz:

```powershell
npm ci --prefix backend
npm run build --prefix backend
node --env-file=backend/.env backend/scripts/verify-ai.cjs --live
```

El ensayo envia una observacion ficticia sin BD ni participantes reales. Aprobado
requiere modo=gemini, estado=completado, respuesta=borrador, origen valido y la
linea APROBADO de conexion real. La salida incluye fecha/modelo para conservar
evidencia sin credenciales. Si falla, conservar el codigo controlado y corregir
configuracion, acceso, cuota o compatibilidad del modelo antes de cerrar la tarea.

Los endpoints y pantalla completos de analisis corresponden a S3-07; aprobacion y
persistencia de hallazgos a S3-08. La cobertura de este adaptador no acredita esas
otras tareas ni la integracion con Supabase, que no se modifica aqui.
